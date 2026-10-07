/**
 * core/session-store.js
 * Phase 3 autosave, P1c: the storage side of the session snapshot. Everything that touches sessionStorage goes through here (the P2 writer
 * too), and NOTHING here throws: a storage that is missing, full, blocked or lying degrades to "start fresh" / "not saved", never to a
 * broken page.
 *
 * Depends on core/session.js (SESSION_STORAGE_KEY, SESSION_QUARANTINE_KEY, SESSION_MAX_CHARS); loads after it. Storage, performance and
 * location are all INJECTED, so the whole module runs in Node against a fake storage.
 *
 * Layout. One key per tab (sessionStorage is per tab): 'wof:session' = JSON envelope { v: 1, href, at, snapshot } where `snapshot` is the
 * text buildSessionSnapshot()/serializeSession() made (a string inside the envelope, so the P0 validator still gets exactly its own text),
 * `href` = origin + path + query WITHOUT the hash, `at` = ms timestamp. A snapshot that was rejected (corrupt, other version, grids do not
 * match, apply failed) is moved to ONE slot 'wof:session:quarantine' = { v: 1, reason, at, truncated, text }, newest wins. Neither key can
 * be mistaken for the Farborgel mailbox ('wof:farborgel:handoff' / 'wof:farborgel:ack', localStorage, filtered by exact key).
 *
 * Size. The cap (SESSION_MAX_CHARS, 2 Mi characters) applies to the STORED envelope, not only to the snapshot inside it: the envelope
 * escapes every quote of the snapshot, so it is longer. A quota of 5 MB counts UTF-16 units (2 bytes per character), so one entry of the
 * cap is ~4 MB; that is why a rejected entry is REMOVED first and only then written to the quarantine slot - the two never coexist.
 *
 * Startup, in P1d:  const g = sessionStorageGuard(window);
 *                   const r = loadSessionForStartup({ storage: g.storage, perf: performance, currentHref: sessionCurrentHref(location), allowed: g.allowed });
 *                   r.action === 'restore' ? parseSession(r.text) -> planSessionRestore -> applySessionSnapshot
 *                                          : start fresh.   Any failure after 'restore': quarantineSession(storage, r.text, reason).
 */

const SESSION_ENVELOPE_VERSION = 1;
const SESSION_QUARANTINE_REASONS = Object.freeze(['corrupt', 'schema-version', 'trail-key-version', 'grid-mismatch', 'apply-failed']);
const SESSION_NAV_TYPES = Object.freeze(['navigate', 'reload', 'back_forward']);   // 'prerender' and anything unknown read as 'navigate'

// storage trouble is never an exception, but it is not silent either: one console.warn
function _sessionWarn(message, detail) {
    try { if (typeof console !== 'undefined' && console && typeof console.warn === 'function') console.warn('[session] ' + message + (detail ? ': ' + detail : '')); } catch (e) { /* nothing left to do */ }
}
const _sessionErr = e => (e && (e.name || e.message)) ? String(e.name || e.message) : String(e);

// ---- pure helpers --------------------------------------------------------------------------------------------------------
// origin + path + query, no hash. The reader compares two of these; the hash is dropped on BOTH sides (a #fragment never changes the drawing).
function _sessionStripHash(href) { const i = href.indexOf('#'); return i < 0 ? href : href.slice(0, i); }
function sessionCurrentHref(loc) {
    try {
        if (!loc) return null;
        if (typeof loc.origin === 'string' && typeof loc.pathname === 'string') return loc.origin + loc.pathname + (typeof loc.search === 'string' ? loc.search : '');
        return typeof loc.href === 'string' ? _sessionStripHash(loc.href) : null;
    } catch (e) { return null; }
}

// How this page load came about, from the injected `performance`. Anything unreadable is 'navigate' (the fresh-start side).
function readNavigationType(perf) {
    try {
        if (!perf || typeof perf.getEntriesByType !== 'function') return 'navigate';
        const list = perf.getEntriesByType('navigation');
        if (!list || !list.length || !list[0]) return 'navigate';
        const t = list[0].type;
        return t === 'reload' || t === 'back_forward' || t === 'navigate' ? t : 'navigate';
    } catch (e) { return 'navigate'; }
}

// The one decision: restore or start fresh. Table-driven in tools/session/test-session-store.js.
//   restore only if  allowed  &&  a snapshot exists  &&  navType is reload | back_forward | navigate  &&  snapshotHref === currentHref (hash ignored).
// The href comparison applies to EVERY navigation type: the snapshot belongs to the URL it was written under. Without it, A1 -> A2 in one tab
// (fresh, A1's snapshot deleted, A2 edited and saved) and then Back to A1 would restore A2's work onto A1; and a removeItem that failed on a
// fresh load could let a later reload restore the stale entry. A same-URL navigate (Enter in Safari) therefore restores the edit instead of
// reloading a catalog pattern.
// The restore reason names the navigation type: 'reload', 'back-forward', 'same-href' (navigate).
// -> { restore: boolean, reason: string }   reasons for fresh: not-allowed, no-snapshot, unknown-nav-type, no-href, different-href
function sessionShouldRestore(o) {
    o = o || {};
    if (o.allowed !== true) return { restore: false, reason: 'not-allowed' };
    if (!o.hasSnapshot) return { restore: false, reason: 'no-snapshot' };
    if (o.navType !== 'reload' && o.navType !== 'back_forward' && o.navType !== 'navigate') return { restore: false, reason: 'unknown-nav-type' };
    if (typeof o.snapshotHref !== 'string' || typeof o.currentHref !== 'string') return { restore: false, reason: 'no-href' };
    if (_sessionStripHash(o.snapshotHref) !== _sessionStripHash(o.currentHref)) return { restore: false, reason: 'different-href' };
    return { restore: true, reason: o.navType === 'reload' ? 'reload' : o.navType === 'back_forward' ? 'back-forward' : 'same-href' };
}

// Where the page may use sessionStorage at all. Not in a frame (an embedded generator must not restore or write over the host's tab) and
// sessionStorage must be reachable (it throws in some blocked-storage modes). `win` = window. -> { allowed, storage, reason }
function sessionStorageGuard(win) {
    let framed;
    try { framed = win.top !== win.self; } catch (e) { framed = true; }
    if (framed) return { allowed: false, storage: null, reason: 'iframe' };
    let storage = null;
    try { storage = win.sessionStorage; } catch (e) { storage = null; }
    if (!storage) return { allowed: false, storage: null, reason: 'storage-unavailable' };
    return { allowed: true, storage, reason: 'ok' };
}

// ---- the envelope ----------------------------------------------------------------------------------------------------------
function makeSessionEnvelope(snapshotText, href, now) {
    return JSON.stringify({ v: SESSION_ENVELOPE_VERSION, href, at: now, snapshot: snapshotText });
}
// raw string -> { ok: true, env } | { ok: false, code: 'empty'|'not-json'|'too-large'|'invalid-envelope', detail }. Never throws.
function parseSessionEnvelope(raw) {
    if (raw === null || raw === undefined || raw === '') return { ok: false, code: 'empty', detail: 'nothing stored' };
    if (typeof raw !== 'string') return { ok: false, code: 'not-json', detail: 'not a string (' + typeof raw + ')' };
    if (raw.length > SESSION_MAX_CHARS) return { ok: false, code: 'too-large', detail: `larger than ${SESSION_MAX_CHARS} characters` };
    let o;
    try { o = JSON.parse(raw); } catch (e) { return { ok: false, code: 'not-json', detail: 'not valid JSON' }; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, code: 'invalid-envelope', detail: 'not an object' };
    if (o.v !== SESSION_ENVELOPE_VERSION) return { ok: false, code: 'invalid-envelope', detail: 'envelope version ' + String(o.v) };
    if (typeof o.href !== 'string') return { ok: false, code: 'invalid-envelope', detail: 'href is not a string' };
    if (typeof o.at !== 'number' || !isFinite(o.at)) return { ok: false, code: 'invalid-envelope', detail: 'at is not a finite number' };
    if (typeof o.snapshot !== 'string') return { ok: false, code: 'invalid-envelope', detail: 'snapshot is not a string' };
    // (the snapshot is within the cap because the whole stored value is: the check above)
    return { ok: true, env: { v: o.v, href: o.href, at: o.at, snapshot: o.snapshot } };
}

// ---- writing, removing, quarantining (none of them throws) ------------------------------------------------------------------
// The P2 writer's one way to save. -> { ok: true, size } | { ok: false, code: 'no-storage'|'too-large'|'storage-error', detail }
// `quiet`: no console.warn of its own - the caller (core/session-writer.js) warns once per kind of failure and backs off, so a full storage is not
// reported on every attempt.
function writeSession(storage, snapshotText, href, now, quiet) {
    if (!storage) return { ok: false, code: 'no-storage', detail: 'sessionStorage is not available' };
    let text;
    try {
        if (typeof snapshotText !== 'string' || typeof href !== 'string' || typeof now !== 'number' || !isFinite(now)) return { ok: false, code: 'storage-error', detail: 'bad arguments' };
        text = makeSessionEnvelope(snapshotText, _sessionStripHash(href), now);
    } catch (e) { return { ok: false, code: 'storage-error', detail: _sessionErr(e) }; }
    if (text.length > SESSION_MAX_CHARS) { if (!quiet) _sessionWarn('snapshot not saved, too large', text.length + ' characters'); return { ok: false, code: 'too-large', detail: text.length + ' characters' }; }
    try { storage.setItem(SESSION_STORAGE_KEY, text); return { ok: true, size: text.length }; }
    catch (e) { if (!quiet) _sessionWarn('snapshot not saved', _sessionErr(e)); return { ok: false, code: 'storage-error', detail: _sessionErr(e) }; }
}
// -> boolean (false when the storage threw; a key that was not there counts as removed)
function removeSession(storage) {
    try { if (storage) storage.removeItem(SESSION_STORAGE_KEY); return !!storage; }
    catch (e) { _sessionWarn('could not remove the saved session', _sessionErr(e)); return false; }
}
// Move a rejected snapshot out of the way. ORDER: remove the main key FIRST, then write the quarantine slot from the text already in
// memory, so the two never coexist (see "Size"); if the write throws the main key is already gone. `text` may be anything the storage
// returned; it is capped. -> { removed: boolean, stored: boolean }
function quarantineSession(storage, text, reason) {
    const removed = removeSession(storage);
    let stored = false;
    try {
        if (storage) {
            const raw = typeof text === 'string' ? text : '<non-string ' + typeof text + '>';
            const truncated = raw.length > SESSION_MAX_CHARS;
            const why = SESSION_QUARANTINE_REASONS.indexOf(reason) >= 0 ? reason : 'corrupt';
            let now = 0; try { now = Date.now(); } catch (e) { now = 0; }
            storage.setItem(SESSION_QUARANTINE_KEY, JSON.stringify({ v: SESSION_ENVELOPE_VERSION, reason: why, at: now, truncated, text: truncated ? raw.slice(0, SESSION_MAX_CHARS) : raw }));
            stored = true;
        }
    } catch (e) { _sessionWarn('could not keep the rejected snapshot', _sessionErr(e)); }
    return { removed, stored };
}

// ---- startup ------------------------------------------------------------------------------------------------------------------
// The one entry point at page start. Reads this tab's snapshot, decides, and does the deleting itself:
//   -> { action: 'restore', text, reason, savedAt }      the snapshot text for parseSession(); the stored entry STAYS (the writer overwrites it, or
//                                                         quarantineSession() removes it if the restore fails)
//    | { action: 'fresh', reason }                       start fresh; the stored entry (if any) is already removed or quarantined
// reasons for fresh: not-allowed, storage-error, no-snapshot, different-href, no-href, unknown-nav-type, envelope-invalid (quarantined).
function loadSessionForStartup(o) {
    o = o || {};
    const storage = o.storage;
    if (o.allowed !== true || !storage) return { action: 'fresh', reason: 'not-allowed' };      // nothing is read, deleted or written
    let raw;
    try { raw = storage.getItem(SESSION_STORAGE_KEY); }
    catch (e) { _sessionWarn('could not read the saved session', _sessionErr(e)); return { action: 'fresh', reason: 'storage-error' }; }
    if (raw === null || raw === undefined) return { action: 'fresh', reason: 'no-snapshot' };
    if (raw === '') { removeSession(storage); return { action: 'fresh', reason: 'no-snapshot' }; }
    const parsed = parseSessionEnvelope(raw);
    if (!parsed.ok) {
        quarantineSession(storage, raw, 'corrupt');
        return { action: 'fresh', reason: 'envelope-invalid', detail: parsed.code + ': ' + parsed.detail };
    }
    const decision = sessionShouldRestore({ navType: readNavigationType(o.perf), hasSnapshot: true, snapshotHref: parsed.env.href, currentHref: o.currentHref, allowed: true });
    if (decision.restore) return { action: 'restore', text: parsed.env.snapshot, reason: decision.reason, savedAt: parsed.env.at };
    removeSession(storage);
    return { action: 'fresh', reason: decision.reason };
}
