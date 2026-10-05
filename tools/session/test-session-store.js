/**
 * tools/session/test-session-store.js
 * Phase 3 autosave, P1c: core/session-store.js against a FAKE storage (quota in UTF-16 units, throwing methods, non-string values).
 *
 *   node tools/session/test-session-store.js
 *   SESSION_STORE_JS=/path/to/mutated/session-store.js node tools/session/test-session-store.js    (sabotage runs)
 *
 * What is proved here:
 *  1. sessionShouldRestore: a table (reason string per row) including the measured Safari and Chromium cases;
 *  2. readNavigationType: missing/empty/unknown all read as 'navigate';
 *  3. the guards (iframe, throwing sessionStorage) and that a disallowed load touches nothing;
 *  4. the envelope (v, href, at, snapshot) and its validation;
 *  5. loadSessionForStartup end to end: restore keeps the entry, fresh deletes it, an invalid envelope or non-JSON goes to the quarantine;
 *  6. quarantine order: remove first, then write - with a quota fake that fails when both entries coexist;
 *  7. a throwing / lying storage: nothing ever throws out of the store API;
 *  8. the key names cannot be confused with the Farborgel mailbox.
 */
const fs = require('fs');
const path = require('path');
const F = require('./fixtures.js');
const { makeContext, J } = F;

let failures = 0, checks = 0;
function check(name, ok, detail) { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); }
const safe = f => { try { return f(); } catch (e) { return { threw: String(e && e.message) }; } };   // a throw must become a FAILED check, not a crashed run
process.on('uncaughtException', e => { console.log('FAIL  the test run itself crashed: ' + (e && e.message)); process.exit(1); });

const ctx = makeContext();
const warnings = [];
ctx.sb.console = { log() { }, warn(m) { warnings.push(String(m)); }, error() { } };       // the store's console.warn is captured, not printed
const S = new Proxy({}, { get: (_, name) => ctx.get(name) });
const K = name => ctx.get(name);
const CAP = K('SESSION_MAX_CHARS'), MAIN = K('SESSION_STORAGE_KEY'), QKEY = K('SESSION_QUARANTINE_KEY');
const HREF = 'https://example.org/world/index.html?shape=square&nodes=4';

// ---- the fake storage -------------------------------------------------------------------------------------------------------
// quota in BYTES, 2 bytes per UTF-16 unit of key + value (the way browsers count); `throws` makes single methods fail;
// `lie` lets getItem return something that is not a string
function fakeStorage(o) {
    o = o || {};
    const map = new Map();
    const bytes = () => { let n = 0; for (const [k, v] of map) n += 2 * (k.length + v.length); return n; };
    const st = {
        map, calls: [], bytes,
        getItem(k) { st.calls.push(['get', k]); if (o.throws && o.throws.getItem) throw o.throws.getItem; if (o.lie && o.lie[k] !== undefined) return o.lie[k]; return map.has(k) ? map.get(k) : null; },
        setItem(k, v) {
            st.calls.push(['set', k]);
            if (o.throws && o.throws.setItem) throw o.throws.setItem;
            const old = map.has(k) ? 2 * (k.length + map.get(k).length) : 0;
            if (o.quota !== undefined && bytes() - old + 2 * (k.length + String(v).length) > o.quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
            map.set(k, String(v));
        },
        removeItem(k) { st.calls.push(['remove', k]); if (o.throws && o.throws.removeItem) throw o.throws.removeItem; map.delete(k); },
    };
    return st;
}
const secErr = () => { const e = new Error('denied'); e.name = 'SecurityError'; return e; };
const quotaErr = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; return e; };
const perfOf = type => ({ getEntriesByType: n => n === 'navigation' ? [{ type }] : [] });
const envelope = (text, href, at) => S.makeSessionEnvelope(text, href === undefined ? HREF : href, at === undefined ? 1700000000000 : at);
const quarantined = st => { const v = st.map.get(QKEY); return v === undefined ? null : JSON.parse(v); };
const load = (st, type, href, allowed) => safe(() => S.loadSessionForStartup({ storage: st, perf: perfOf(type), currentHref: href === undefined ? HREF : href, allowed: allowed === undefined ? true : allowed }));

// ---- 1. sessionShouldRestore: the table --------------------------------------------------------------------------------------
console.log('== 1. sessionShouldRestore: table (each row has its reason) ==');
{
    const A = HREF, B = 'https://example.org/world/index.html?shape=hex';
    const rows = [
        // name, input, restore, reason
        ['reload, snapshot present',                              { navType: 'reload', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'reload'],
        ['back_forward, snapshot present',                        { navType: 'back_forward', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'back-forward'],
        ['navigate, equal href',                                  { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'same-href'],
        ['navigate, different href',                              { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: B }, false, 'different-href'],
        ['navigate, equal href but different hash (hash ignored)', { navType: 'navigate', hasSnapshot: true, snapshotHref: A + '#a', currentHref: A + '#b' }, true, 'same-href'],
        ['navigate, hash on one side only',                       { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: A + '#x' }, true, 'same-href'],
        ['navigate, same path, different query',                  { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: A + '&z=1' }, false, 'different-href'],
        ['no snapshot, reload',                                   { navType: 'reload', hasSnapshot: false, snapshotHref: null, currentHref: A }, false, 'no-snapshot'],
        ['no snapshot, back_forward',                             { navType: 'back_forward', hasSnapshot: false, snapshotHref: null, currentHref: A }, false, 'no-snapshot'],
        ['no snapshot, navigate',                                 { navType: 'navigate', hasSnapshot: false, snapshotHref: null, currentHref: A }, false, 'no-snapshot'],
        ['unknown navType (prerender)',                           { navType: 'prerender', hasSnapshot: true, snapshotHref: A, currentHref: A }, false, 'unknown-nav-type'],
        ['navType missing',                                       { hasSnapshot: true, snapshotHref: A, currentHref: A }, false, 'unknown-nav-type'],
        ['navigate, snapshotHref null',                           { navType: 'navigate', hasSnapshot: true, snapshotHref: null, currentHref: A }, false, 'no-href'],
        ['navigate, snapshotHref missing',                        { navType: 'navigate', hasSnapshot: true, currentHref: A }, false, 'no-href'],
        ['navigate, currentHref missing',                         { navType: 'navigate', hasSnapshot: true, snapshotHref: A }, false, 'no-href'],
        ['allowed false (iframe / blocked storage), reload',      { navType: 'reload', hasSnapshot: true, snapshotHref: A, currentHref: A, allowed: false }, false, 'not-allowed'],
        ['allowed false, navigate equal href',                    { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: A, allowed: false }, false, 'not-allowed'],
        ['allowed missing',                                       { navType: 'reload', hasSnapshot: true, snapshotHref: A, currentHref: A, allowed: undefined }, false, 'not-allowed'],
        // measured cases (ROADMAP: Safari measured by the user, Chromium measured in the browser pane)
        ['Safari: Cmd+R reload',                                  { navType: 'reload', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'reload'],
        ['Safari: Enter on the same URL (measured as navigate)',  { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'same-href'],
        ['Safari: duplicate tab (back_forward, storage EMPTY)',   { navType: 'back_forward', hasSnapshot: false, snapshotHref: null, currentHref: A }, false, 'no-snapshot'],
        ['Safari: reopened closed tab (back_forward, EMPTY)',     { navType: 'back_forward', hasSnapshot: false, snapshotHref: null, currentHref: A }, false, 'no-snapshot'],
        ['Chromium: reload',                                      { navType: 'reload', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'reload'],
        ['Chromium: link click to another page',                  { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: B }, false, 'different-href'],
        ['Chromium: link click to the SAME url',                  { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'same-href'],
        ['Chromium: navigate to the same URL',                    { navType: 'navigate', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'same-href'],
        ['Chromium: back/forward (same page)',                    { navType: 'back_forward', hasSnapshot: true, snapshotHref: A, currentHref: A }, true, 'back-forward'],
        // the href rule applies to EVERY navigation type
        ['reload with a different href',                          { navType: 'reload', hasSnapshot: true, snapshotHref: B, currentHref: A }, false, 'different-href'],
        ['back_forward with a different href (A1 -> A2 -> Back)', { navType: 'back_forward', hasSnapshot: true, snapshotHref: B, currentHref: A }, false, 'different-href'],
        ['reload, different query only',                          { navType: 'reload', hasSnapshot: true, snapshotHref: A + '&z=1', currentHref: A }, false, 'different-href'],
        ['reload, equal href, different hash (hash ignored)',     { navType: 'reload', hasSnapshot: true, snapshotHref: A + '#a', currentHref: A + '#b' }, true, 'reload'],
        ['back_forward, equal href, different hash',              { navType: 'back_forward', hasSnapshot: true, snapshotHref: A + '#a', currentHref: A }, true, 'back-forward'],
        ['reload, snapshotHref null',                             { navType: 'reload', hasSnapshot: true, snapshotHref: null, currentHref: A }, false, 'no-href'],
        ['back_forward, currentHref missing',                     { navType: 'back_forward', hasSnapshot: true, snapshotHref: A }, false, 'no-href'],
        ['unknown navType with a different href',                 { navType: 'prerender', hasSnapshot: true, snapshotHref: B, currentHref: A }, false, 'unknown-nav-type'],
    ];
    for (const [name, input, restore, reason] of rows) {
        const o = Object.assign({ allowed: true }, input);
        if (input.allowed === undefined && 'allowed' in input) delete o.allowed;
        const r = safe(() => S.sessionShouldRestore(o));
        check(`row: ${name}`, r.restore === restore && r.reason === reason, `${r.restore}/${r.reason}`);
    }
    check('no argument at all -> not allowed, no throw', safe(() => S.sessionShouldRestore()).reason === 'not-allowed');
}

// ---- 2. readNavigationType -----------------------------------------------------------------------------------------------------
console.log('\n== 2. readNavigationType ==');
{
    const t = p => safe(() => S.readNavigationType(p));
    check('reload / back_forward / navigate are read as they are', t(perfOf('reload')) === 'reload' && t(perfOf('back_forward')) === 'back_forward' && t(perfOf('navigate')) === 'navigate');
    check('missing getEntriesByType -> navigate', t({}) === 'navigate' && t(null) === 'navigate' && t(undefined) === 'navigate');
    check('empty entry list -> navigate', t({ getEntriesByType: () => [] }) === 'navigate' && t({ getEntriesByType: () => null }) === 'navigate' && t({ getEntriesByType: () => [null] }) === 'navigate');
    check('prerender -> navigate (the fresh side)', t(perfOf('prerender')) === 'navigate');
    check('unknown / missing / odd types -> navigate', t(perfOf('weird')) === 'navigate' && t(perfOf(undefined)) === 'navigate' && t(perfOf(7)) === 'navigate' && t(perfOf('RELOAD')) === 'navigate');
    check('getEntriesByType throwing -> navigate', t({ getEntriesByType() { throw new Error('x'); } }) === 'navigate');
}

// ---- 3. guards -------------------------------------------------------------------------------------------------------------------
console.log('\n== 3. guards ==');
{
    const st = fakeStorage();
    const me = {};
    const g1 = safe(() => S.sessionStorageGuard({ top: me, self: me, sessionStorage: st }));
    check('top === self and a reachable sessionStorage -> allowed', g1.allowed === true && g1.storage === st);
    const g2 = safe(() => S.sessionStorageGuard({ top: {}, self: me, sessionStorage: st }));
    check('top !== self (iframe) -> not allowed, no storage handed out', g2.allowed === false && g2.storage === null && g2.reason === 'iframe');
    const g3 = safe(() => S.sessionStorageGuard({ get top() { throw secErr(); }, self: me, sessionStorage: st }));
    check('reading window.top throws -> not allowed (treated as framed)', g3.allowed === false && g3.reason === 'iframe');
    const g4 = safe(() => S.sessionStorageGuard({ top: me, self: me, get sessionStorage() { throw secErr(); } }));
    check('sessionStorage access throws -> not allowed', g4.allowed === false && g4.storage === null && g4.reason === 'storage-unavailable');
    const g5 = safe(() => S.sessionStorageGuard({ top: me, self: me, sessionStorage: null }));
    check('sessionStorage null -> not allowed', g5.allowed === false);
    // allowed false: nothing is read, deleted or written - not even with a snapshot sitting there
    const st2 = fakeStorage(); st2.map.set(MAIN, envelope('x'));
    const r = load(st2, 'reload', HREF, false);
    check('loadSessionForStartup with allowed:false -> fresh, and the storage is not touched at all', r.action === 'fresh' && r.reason === 'not-allowed' && st2.calls.length === 0 && st2.map.has(MAIN));
    check('loadSessionForStartup without storage / without arguments -> fresh, no throw', safe(() => S.loadSessionForStartup({ allowed: true, perf: perfOf('reload'), currentHref: HREF })).action === 'fresh' && safe(() => S.loadSessionForStartup()).action === 'fresh');
}

// ---- 4. envelope ---------------------------------------------------------------------------------------------------------------------
console.log('\n== 4. envelope ==');
{
    const text = J({ hello: 'wörld "quoted"' });
    const env = envelope(text);
    const p = safe(() => S.parseSessionEnvelope(env));
    check('make -> parse round trip keeps the snapshot text byte for byte', p.ok === true && p.env.snapshot === text && p.env.href === HREF && p.env.at === 1700000000000 && p.env.v === 1);
    const bad = (name, v) => { const r = safe(() => S.parseSessionEnvelope(typeof v === 'string' ? v : J(v))); check(`rejected: ${name}`, r.ok === false && r.code === 'invalid-envelope', r.code + (r.detail ? ': ' + r.detail : '')); };
    const good = { v: 1, href: HREF, at: 5, snapshot: '{}' };
    bad('wrong envelope version', Object.assign({}, good, { v: 2 }));
    bad('missing version', { href: HREF, at: 5, snapshot: '{}' });
    bad('href is a number', Object.assign({}, good, { href: 4 }));
    bad('href missing', { v: 1, at: 5, snapshot: '{}' });
    bad('at is a string', Object.assign({}, good, { at: '5' }));
    bad('at is null (what JSON makes of NaN/Infinity)', Object.assign({}, good, { at: null }));
    bad('snapshot is an object, not a string', Object.assign({}, good, { snapshot: {} }));
    bad('snapshot missing', { v: 1, href: HREF, at: 5 });
    bad('an array', []);
    bad('null', 'null');
    bad('a number', '42');
    check('a snapshot over the cap can only arrive inside an envelope over the cap, which is refused as a whole (too-large)', safe(() => S.parseSessionEnvelope(J(Object.assign({}, good, { snapshot: 'x'.repeat(CAP + 1) })))).code === 'too-large');
    check('not JSON -> not-json', safe(() => S.parseSessionEnvelope('{oops')).code === 'not-json');
    check('over the cap as a whole -> too-large', safe(() => S.parseSessionEnvelope('x'.repeat(CAP + 1))).code === 'too-large');
    check('null / undefined / "" -> empty', ['empty', 'empty', 'empty'].every((c, i) => safe(() => S.parseSessionEnvelope([null, undefined, ''][i])).code === c));
    check('a non-string -> not-json', safe(() => S.parseSessionEnvelope(7)).code === 'not-json' && safe(() => S.parseSessionEnvelope({})).code === 'not-json');
    const h = safe(() => S.sessionCurrentHref({ origin: 'https://a.b', pathname: '/p/i.html', search: '?x=1', hash: '#frag' }));
    check('sessionCurrentHref = origin + path + query, no hash', h === 'https://a.b/p/i.html?x=1');
    check('sessionCurrentHref without search / from href only / nothing', safe(() => S.sessionCurrentHref({ origin: 'https://a.b', pathname: '/p' })) === 'https://a.b/p'
        && safe(() => S.sessionCurrentHref({ href: 'file:///x/i.html?a=1#h' })) === 'file:///x/i.html?a=1' && safe(() => S.sessionCurrentHref(null)) === null);
    // writeSession
    const st = fakeStorage();
    const w = safe(() => S.writeSession(st, text, HREF + '#drop', 1700000000001));
    const back = S.parseSessionEnvelope(st.map.get(MAIN));
    check('writeSession stores a valid envelope without the hash', w.ok === true && back.ok && back.env.href === HREF && back.env.at === 1700000000001 && back.env.snapshot === text);
    check('writeSession refuses an envelope over the cap (nothing written)', (() => { const s2 = fakeStorage(); const r = safe(() => S.writeSession(s2, 'x'.repeat(CAP), HREF, 1)); return r.ok === false && r.code === 'too-large' && !s2.map.has(MAIN); })());
    check('writeSession counts the ESCAPED envelope: a snapshot just under the cap but full of quotes is refused', (() => { const s2 = fakeStorage(); const r = safe(() => S.writeSession(s2, '"'.repeat(CAP - 10), HREF, 1)); return r.ok === false && r.code === 'too-large'; })());
    check('writeSession without storage / with bad arguments -> a result, no throw', safe(() => S.writeSession(null, 'x', HREF, 1)).code === 'no-storage' && safe(() => S.writeSession(fakeStorage(), 5, HREF, 1)).ok === false && safe(() => S.writeSession(fakeStorage(), 'x', HREF, NaN)).ok === false);
}

// ---- 5. loadSessionForStartup, end to end ------------------------------------------------------------------------------------------
console.log('\n== 5. loadSessionForStartup ==');
{
    const SNAP = J({ some: 'snapshot text' });
    const withEntry = (href, text) => { const st = fakeStorage(); st.map.set(MAIN, envelope(text === undefined ? SNAP : text, href)); return st; };

    let st = withEntry(HREF); let r = load(st, 'reload');
    check('reload: restore, returns the snapshot text, and the entry STAYS', r.action === 'restore' && r.text === SNAP && r.reason === 'reload' && r.savedAt === 1700000000000 && st.map.has(MAIN) && !st.calls.some(c => c[0] === 'remove'));
    st = withEntry(HREF); r = load(st, 'back_forward');
    check('back_forward: restore', r.action === 'restore' && r.reason === 'back-forward' && st.map.has(MAIN));
    st = withEntry(HREF + '#old'); r = load(st, 'navigate', HREF + '#new');
    check('navigate to the same URL (other hash): restore', r.action === 'restore' && r.reason === 'same-href' && st.map.has(MAIN));
    st = withEntry(HREF); r = load(st, 'navigate', 'https://example.org/world/index.html?shape=hex');
    check('navigate to another URL: fresh, and the old entry is DELETED', r.action === 'fresh' && r.reason === 'different-href' && !st.map.has(MAIN) && quarantined(st) === null);
    st = withEntry(HREF); r = load(st, 'prerender');
    check('prerender reads as navigate: same href -> restore (reason same-href, NOT reload)', r.action === 'restore' && r.reason === 'same-href');
    st = withEntry(HREF); r = load(st, 'prerender', 'https://example.org/other');
    check('prerender reads as navigate: other href -> fresh, entry deleted', r.action === 'fresh' && r.reason === 'different-href' && !st.map.has(MAIN));
    st = fakeStorage(); r = load(st, 'reload');
    check('nothing stored: fresh / no-snapshot, nothing deleted, nothing written', r.action === 'fresh' && r.reason === 'no-snapshot' && st.calls.every(c => c[0] === 'get') && st.map.size === 0);
    st = fakeStorage(); st.map.set(MAIN, ''); r = load(st, 'reload');
    check('an empty string stored: fresh, removed, not quarantined', r.action === 'fresh' && r.reason === 'no-snapshot' && !st.map.has(MAIN) && quarantined(st) === null);

    // invalid envelope / not JSON -> quarantined as raw text, never thrown, never a reload loop
    const raws = [['not JSON at all', 'this is { not json'], ['JSON but not an envelope', '[1,2,3]'], ['envelope with a wrong version', J({ v: 9, href: HREF, at: 1, snapshot: '{}' })],
        ['envelope with a missing snapshot', J({ v: 1, href: HREF, at: 1 })], ['a bare snapshot (P0 text, no envelope)', J({ schema: 1, settings: {} })]];
    for (const [name, raw] of raws) {
        st = fakeStorage(); st.map.set(MAIN, raw); r = load(st, 'reload');
        const q = quarantined(st);
        check(`invalid stored value (${name}): fresh, main removed, raw text quarantined`, r.action === 'fresh' && r.reason === 'envelope-invalid' && !st.map.has(MAIN) && q && q.text === raw && q.reason === 'corrupt' && q.truncated === false);
        const again = load(st, 'reload');
        check(`  ...and the next load is a plain fresh start (no loop)`, again.action === 'fresh' && again.reason === 'no-snapshot');
    }
    st = fakeStorage(); const huge = 'x'.repeat(CAP + 500); st.map.set(MAIN, huge); r = load(st, 'reload');
    const qh = quarantined(st);
    check('a stored value over the cap: fresh, quarantined CAPPED (truncated flag), main removed', r.action === 'fresh' && !st.map.has(MAIN) && qh && qh.truncated === true && qh.text.length === CAP);
    st = fakeStorage(); st.map.set(MAIN, 'old'); st.map.set(QKEY, J({ v: 1, reason: 'corrupt', at: 1, truncated: false, text: 'older' }));
    S.quarantineSession(st, 'newer', 'apply-failed');
    check('the quarantine is ONE slot: the newest wins', quarantined(st).text === 'newer' && quarantined(st).reason === 'apply-failed' && [...st.map.keys()].filter(k => k.startsWith('wof:session:quarantine')).length === 1);
    st = fakeStorage(); S.quarantineSession(st, 'x', 'no-such-reason');
    check('an unknown reason is recorded as corrupt', quarantined(st).reason === 'corrupt');
    for (const reason of ['corrupt', 'schema-version', 'trail-key-version', 'grid-mismatch', 'apply-failed']) {
        st = withEntry(HREF); const q = safe(() => S.quarantineSession(st, 'T', reason));
        check(`quarantineSession(${reason}): main removed, slot written, result says so`, q.removed === true && q.stored === true && !st.map.has(MAIN) && quarantined(st).reason === reason);
    }

    // A1 -> A2 -> Back, end to end through loadSessionForStartup (the case the href rule exists for)
    {
        const A1 = 'https://example.org/world/index.html?shape=square&nodes=3', A2 = 'https://example.org/world/index.html?shape=hex&nodes=3';
        const st = fakeStorage();
        S.writeSession(st, J({ work: 'A1 edit' }), A1, 1);
        let r1 = load(st, 'navigate', A2);                                           // A1 -> A2 in the same tab (link / typed URL)
        check('A1 -> A2: fresh, A1\'s snapshot deleted', r1.action === 'fresh' && r1.reason === 'different-href' && !st.map.has(MAIN));
        S.writeSession(st, J({ work: 'A2 edit' }), A2, 2);                           // the user edits A2, the writer saves under A2
        const r2 = load(st, 'back_forward', A1);                                     // Back to A1 (no bfcache): the page loads again
        check('...Back to A1: fresh, A2\'s work is NOT restored onto A1, and the entry is deleted', r2.action === 'fresh' && r2.reason === 'different-href' && !st.map.has(MAIN));
        S.writeSession(st, J({ work: 'A2 edit' }), A2, 3);
        const r3 = load(st, 'back_forward', A2);                                     // coming back to A2 itself restores it
        check('...whereas back_forward onto A2 itself restores A2\'s work', r3.action === 'restore' && r3.text === J({ work: 'A2 edit' }));
    }
    // the failed-delete hole: removeItem throws on a fresh load, the stale entry stays, a later reload at ANOTHER href must not restore it
    {
        const A1 = 'https://example.org/world/index.html?shape=square', A2 = 'https://example.org/world/index.html?shape=hex';
        const st = fakeStorage(); S.writeSession(st, J({ work: 'A1 edit' }), A1, 1);
        let failRemove = true; const origRemove = st.removeItem;
        st.removeItem = k => { if (failRemove) { st.calls.push(['remove', k]); throw secErr(); } return origRemove(k); };
        const r1 = load(st, 'navigate', A2);
        check('fresh load at A2 while removeItem throws: fresh, the stale A1 entry is still there', r1.action === 'fresh' && st.map.has(MAIN));
        const callsBefore = st.calls.filter(c => c[0] === 'remove').length;
        const r2 = load(st, 'reload', A2);                                           // a reload of A2: the stale entry is A1's
        check('reload at A2: fresh, the stale A1 entry is NOT restored', r2.action === 'fresh' && r2.reason === 'different-href');
        check('...and the deletion is attempted again', st.calls.filter(c => c[0] === 'remove').length === callsBefore + 1);
        failRemove = false;
        const r3 = load(st, 'reload', A2);
        check('once removeItem works again the stale entry goes away', r3.action === 'fresh' && !st.map.has(MAIN));
    }
    // Safari Enter on the same URL after an edit restores the edit (the consequence of the rule)
    {
        const st = fakeStorage(); S.writeSession(st, J({ work: 'edit of a catalog pattern' }), HREF, 1);
        const r = load(st, 'navigate', HREF);
        check('same-URL navigate (Enter in Safari) restores the EDIT instead of reloading the catalog pattern', r.action === 'restore' && r.reason === 'same-href' && r.text === J({ work: 'edit of a catalog pattern' }));
    }
}

// ---- 6. quarantine order: remove first, then write; quota fake -------------------------------------------------------------------------------
console.log('\n== 6. quarantine order (quota in UTF-16 units) ==');
{
    const QUOTA = 5 * 1024 * 1024;                                             // 5 MB, 2 bytes per UTF-16 unit
    const big = 'x'.repeat(CAP);                                               // 2 Mi characters = 4 MB in the quota's units
    let st = fakeStorage({ quota: QUOTA }); st.map.set(MAIN, big);
    check('fixture: one cap-sized entry fits, two do not (4 MB + 4 MB > 5 MB)', (() => { try { st.setItem(QKEY, big); return false; } catch (e) { return e.name === 'QuotaExceededError'; } })());
    st = fakeStorage({ quota: QUOTA }); st.map.set(MAIN, big);
    let r = load(st, 'reload');
    const q = quarantined(st);
    check('a cap-sized corrupt entry is quarantined although two copies would not fit', r.action === 'fresh' && !st.map.has(MAIN) && q && q.text.length === CAP, st.bytes() + ' bytes');
    check('the call order is remove(main) BEFORE set(quarantine)', (() => { const calls = st.calls.filter(c => c[0] !== 'get').map(c => c[0] + ':' + c[1]); return calls.indexOf('remove:' + MAIN) >= 0 && calls.indexOf('remove:' + MAIN) < calls.indexOf('set:' + QKEY); })(), J(st.calls));
    check('the main key and the quarantine slot never coexisted (storage never held both at once)', (() => {
        // replay with a storage that records the maximum number of wof:session* keys held after every call
        const s2 = fakeStorage({ quota: QUOTA }); s2.map.set(MAIN, big); let peak = 0;
        for (const m of ['setItem', 'removeItem']) { const orig = s2[m]; s2[m] = (...a) => { const v = orig(...a); peak = Math.max(peak, [...s2.map.keys()].filter(k => k.startsWith('wof:session')).length); return v; }; }
        S.quarantineSession(s2, big, 'corrupt');
        return peak === 1;
    })());
    // the quarantine write fails (quota too small for the slot): the main key is already gone, nothing throws
    st = fakeStorage({ quota: 120 }); st.map.set(MAIN, 'garbage that is not an envelope');
    r = load(st, 'reload');
    check('quarantine write throws (quota): fresh start, main key already gone, nothing thrown', r.action === 'fresh' && !st.map.has(MAIN) && quarantined(st) === null && warnings.some(w => /could not keep/.test(w)));
    const qr = safe(() => S.quarantineSession(st, 'abc', 'corrupt'));
    check('quarantineSession reports stored:false, removed:true in that case', qr.stored === false && qr.removed === true);
    // writeSession in a full storage
    st = fakeStorage({ quota: 100 }); const w = safe(() => S.writeSession(st, 'hello', HREF, 1));
    check('writeSession in a full storage -> { ok:false, code: storage-error }, no throw, one warning', w.ok === false && w.code === 'storage-error' && warnings.some(x => /not saved/.test(x)));
}

// ---- 7. a throwing / lying storage ------------------------------------------------------------------------------------------------------------
console.log('\n== 7. throwing and lying storage ==');
{
    const mk = (opts, pre) => { const st = fakeStorage(opts); if (pre !== false) st.map.set(MAIN, envelope('S')); return st; };
    // getItem throws
    for (const [nm, err] of [['SecurityError', secErr()], ['QuotaExceededError', quotaErr()]]) {
        const st = mk({ throws: { getItem: err } });
        const r = load(st, 'reload');
        check(`getItem throws ${nm}: fresh / storage-error, nothing deleted (it could not be read)`, r.action === 'fresh' && r.reason === 'storage-error' && !st.calls.some(c => c[0] === 'remove' || c[0] === 'set'));
    }
    // removeItem throws on a fresh load
    for (const [nm, err] of [['SecurityError', secErr()], ['QuotaExceededError', quotaErr()]]) {
        const st = mk({ throws: { removeItem: err } });
        const r = load(st, 'navigate', 'https://example.org/other');
        check(`removeItem throws ${nm} on a fresh load: still a fresh start, no throw`, r.action === 'fresh' && r.reason === 'different-href');
        const st2 = mk({ throws: { removeItem: err } }, false); st2.map.set(MAIN, 'garbage');
        const r2 = load(st2, 'reload');
        check(`removeItem throws ${nm} while quarantining: fresh, no throw; the slot is still attempted`, r2.action === 'fresh' && r2.reason === 'envelope-invalid' && st2.calls.some(c => c[0] === 'set' && c[1] === QKEY));
    }
    // setItem throws
    for (const [nm, err] of [['SecurityError', secErr()], ['QuotaExceededError', quotaErr()]]) {
        const st = mk({ throws: { setItem: err } }, false); st.map.set(MAIN, 'garbage');
        const r = load(st, 'reload');
        check(`setItem throws ${nm} while quarantining: fresh, main removed, no throw`, r.action === 'fresh' && !st.map.has(MAIN));
        const w = safe(() => S.writeSession(st, 'x', HREF, 1));
        check(`setItem throws ${nm} in writeSession: { ok:false, storage-error }`, w.ok === false && w.code === 'storage-error');
    }
    // everything throws
    const allBad = fakeStorage({ throws: { getItem: secErr(), setItem: secErr(), removeItem: secErr() } });
    check('every method throws: load, quarantine, write and remove all return normally', safe(() => {
        const a = S.loadSessionForStartup({ storage: allBad, perf: perfOf('reload'), currentHref: HREF, allowed: true });
        const b = S.quarantineSession(allBad, 'x', 'corrupt'); const c = S.writeSession(allBad, 'x', HREF, 1); const d = S.removeSession(allBad);
        return a.action === 'fresh' && b.removed === false && b.stored === false && c.ok === false && d === false;
    }) === true);
    // a throw that is not an Error (a string, null, undefined)
    for (const odd of ['plain string', null, undefined, 42]) {
        const st = fakeStorage({ throws: { getItem: odd } });
        st.getItem = () => { throw odd; };
        check(`getItem throws a non-Error (${String(odd)}): fresh, no throw`, load(st, 'reload').action === 'fresh');
        const st2 = fakeStorage(); st2.setItem = () => { throw odd; }; st2.removeItem = () => { throw odd; };
        check(`setItem/removeItem throw a non-Error (${String(odd)}): quarantine and write return normally`, safe(() => { const q = S.quarantineSession(st2, 'x', 'corrupt'); const w = S.writeSession(st2, 'x', HREF, 1); return !q.stored && !w.ok; }) === true);
    }
    // a storage that returns non-strings
    for (const [nm, val] of [['a number', 5], ['an object', { v: 1 }], ['an array', [1]], ['true', true], ['undefined', undefined]]) {
        const st = fakeStorage({ lie: { [MAIN]: val } });
        const r = load(st, 'reload');
        if (val === undefined) check(`getItem returns ${nm}: treated as nothing stored`, r.action === 'fresh' && r.reason === 'no-snapshot');
        else check(`getItem returns ${nm}: fresh, no throw, main removed, quarantined as a placeholder`, r.action === 'fresh' && r.reason === 'envelope-invalid' && st.calls.some(c => c[0] === 'remove' && c[1] === MAIN) && quarantined(st) && /non-string/.test(quarantined(st).text));
    }
    // the main key disappears between the read and the delete
    {
        const st = fakeStorage(); st.map.set(MAIN, envelope('S'));
        const orig = st.getItem; st.getItem = k => { const v = orig(k); st.map.delete(MAIN); return v; };      // someone removes it right after we read it
        const r = load(st, 'navigate', 'https://example.org/other');
        check('the main key disappears between read and delete: fresh start, removeItem of a missing key is harmless', r.action === 'fresh' && r.reason === 'different-href' && !st.map.has(MAIN));
        const st2 = fakeStorage(); st2.map.set(MAIN, 'garbage'); const o2 = st2.getItem; st2.getItem = k => { const v = o2(k); st2.map.delete(MAIN); return v; };
        const r2 = load(st2, 'reload');
        check('...and while quarantining the raw text already read', r2.action === 'fresh' && quarantined(st2) && quarantined(st2).text === 'garbage');
    }
    // restore must not mutate when everything is fine
    {
        const st = fakeStorage(); const t = envelope('S'); st.map.set(MAIN, t);
        load(st, 'reload'); load(st, 'back_forward');
        check('repeated restores leave the entry byte for byte as it was', st.map.get(MAIN) === t && st.map.size === 1);
    }
}

// ---- 8. key names ---------------------------------------------------------------------------------------------------------------------------------
console.log('\n== 8. key names ==');
{
    const HANDOFF = 'wof:farborgel:handoff', ACK = 'wof:farborgel:ack';
    check('the session keys are exactly wof:session and wof:session:quarantine', MAIN === 'wof:session' && QKEY === 'wof:session:quarantine');
    check('neither key equals or starts with a Farborgel mailbox key or the namespace wof:farborgel', [MAIN, QKEY].every(k => k !== HANDOFF && k !== ACK && !k.startsWith('wof:farborgel') && !HANDOFF.startsWith(k + ':') && !ACK.startsWith(k + ':')));
    const bridge = fs.readFileSync(path.join(F.ROOT, 'core', 'farborgel-bridge.js'), 'utf8');
    const handoff = fs.readFileSync(path.join(F.ROOT, 'color-harmony', 'ui', 'handoff.mjs'), 'utf8');
    check('the mailbox keys in the sources are the ones this test assumes', bridge.includes(`'${HANDOFF}'`) && bridge.includes(`'${ACK}'`) && handoff.includes(`'${HANDOFF}'`) && handoff.includes(`'${ACK}'`));
    check('the Farborgel storage listener filters by EXACT key equality (a prefix match would be a problem)', /event\.key !== ACK_KEY/.test(handoff) && !/\.key\.(startsWith|includes|indexOf|match)/.test(handoff));
    check('the session code never reads or writes a Farborgel key', !/wof:farborgel/.test(fs.readFileSync(path.join(F.ROOT, 'core', 'session-store.js'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')));
    check('the store touches only its own two keys (every call of a full scenario)', (() => {
        const st = fakeStorage(); st.map.set(MAIN, 'garbage');
        load(st, 'reload'); S.writeSession(st, 'x', HREF, 1); load(st, 'reload'); load(st, 'navigate', 'https://example.org/other'); S.quarantineSession(st, 'y', 'apply-failed');
        return st.calls.every(c => c[1] === MAIN || c[1] === QKEY);
    })());
}

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
