/**
 * color-harmony/ui/handoff.mjs
 * Farborgel sub-page P3: the RETURN handoff, Farborgel side. A HarmonySelection composed on this page is written
 * to a localStorage "mailbox"; the generator tab that opened the page (it passed its id as `?from=<12 hex>`) picks
 * it up through the `storage` event, applies it through its own existing pipeline and writes an acknowledgement
 * back. This file only moves a record: the Farborgel stays a module - it imports nothing from the generator, knows
 * nothing about trails/faces/the assignment store, and sends exactly the version-1 record createHarmonySelection()
 * built (INTEGRATION_INTERFACE.md "Return handoff").
 *
 *   handoff key  wof:farborgel:handoff   this page -> generator  { v:1, id, to, at, selection }
 *   ack key      wof:farborgel:ack       generator -> this page   { v:1, id, ok, sheet | reason, at }
 *
 * Every emit gets a fresh `id`, and that matters: setItem() with a value identical to the stored one fires NO
 * `storage` event (measured), so a re-emit of the same selection would otherwise vanish. The other tab's
 * `storage` event is also the ONLY signal there is - the browser never fires it in the writing tab.
 *
 * The constants below are duplicated in the generator's classic script (core/farborgel-bridge.js - a classic script
 * and an ES module cannot share a file); tools/color/test-farborgel-handoff.js asserts they are identical, and that
 * every rejection reason the generator can send has a message in i18n.mjs.
 *
 * createHandoffSender() takes its storage, its storage-event subscription and its timers as parameters so the whole
 * state machine is tested headlessly with fakes; in the browser the defaults are window.localStorage,
 * window 'storage' events and the global timers.
 */
export const HANDOFF_KEY = 'wof:farborgel:handoff';
export const ACK_KEY = 'wof:farborgel:ack';
export const TAB_ID_PATTERN = /^[0-9a-f]{12}$/;
export const ACK_TIMEOUT_MS = 3000;
export const ACK_REASONS = Object.freeze(['fill-off', 'sheet-unavailable', 'no-trails', 'invalid-selection', 'invalid-envelope', 'internal-error']);

/** The generator tab this page was opened from: `?from=<12 hex>` -> the id, else null. An unusable value is warned
 * about and ignored (the page then behaves exactly as when opened directly). Never throws. */
export function tabIdFromSearch(search, warn = (...args) => console.warn(...args)) {
  const raw = new URLSearchParams(search || '').get('from');
  if (raw === null) return null;
  if (!TAB_ID_PATTERN.test(raw)) { warn(`Farborgel: ignoring from=${JSON.stringify(raw)} (expected 12 lowercase hex characters); the selection cannot be handed back`); return null; }
  return raw;
}

/** A fresh message id: 16 hex characters. Uniqueness per emit is what matters, not secrecy. */
export function newHandoffId() {
  let bytes;
  if (typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function') bytes = Array.from(crypto.getRandomValues(new Uint8Array(8)));
  else bytes = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
  return bytes.map(b => (b < 16 ? '0' : '') + b.toString(16)).join('');
}

/** The envelope written to HANDOFF_KEY. `selection` is passed through untouched. */
export function createHandoffMessage(selection, to, id = newHandoffId(), at = Date.now()) {
  return { v: 1, id, to, at, selection };
}

/** Reads the raw string of an ACK_KEY event. -> { ok: true, sheet } | { ok: false, reason } for an ack answering
 * `expectedId`; null for anything else (another message, a removal, malformed). Never throws. */
export function parseAck(rawString, expectedId) {
  if (typeof rawString !== 'string' || rawString.length > 4096) return null;
  let ack;
  try { ack = JSON.parse(rawString); } catch (e) { return null; }
  if (typeof ack !== 'object' || ack === null || Array.isArray(ack) || ack.v !== 1 || ack.id !== expectedId) return null;
  if (ack.ok === true) return { ok: true, sheet: ack.sheet === 'base' || Number.isInteger(ack.sheet) ? ack.sheet : null };
  if (ack.ok === false) return { ok: false, reason: ACK_REASONS.includes(ack.reason) ? ack.reason : 'internal-error' };
  return null;
}

/**
 * The sender. onStatus receives, in order of a normal run: { state: 'pending' } then { state: 'ok', sheet } or
 * { state: 'rejected', reason } or, after ACK_TIMEOUT_MS without an answer, { state: 'timeout' } - and a LATE
 * ack still turns a timeout into ok/rejected (the timeout means "no answer yet", not "failed"). When storage is
 * unusable (blocked, private mode, quota) it reports { state: 'storage-unavailable' } right after the pending one.
 * Only the most recent send is tracked; an ack for an older id is ignored.
 */
export function createHandoffSender({
  tabId,
  onStatus,
  storage = (() => { try { return globalThis.localStorage; } catch (e) { return null; } })(),
  subscribe = listener => { const f = event => listener({ key: event.key, newValue: event.newValue }); globalThis.addEventListener('storage', f); return () => globalThis.removeEventListener('storage', f); },
  setTimer = (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer = handle => globalThis.clearTimeout(handle),
  timeoutMs = ACK_TIMEOUT_MS
}) {
  let lastId = null, timer = null;
  const safe = fn => { try { fn(); } catch (e) { /* storage may have vanished: nothing left to clean up */ } };
  subscribe(event => {
    if (event.key !== ACK_KEY || event.newValue === null || lastId === null) return;
    const ack = parseAck(event.newValue, lastId);
    if (ack === null) return;
    if (timer !== null) { clearTimer(timer); timer = null; }
    safe(() => storage.removeItem(ACK_KEY));      // each side cleans up the other's key
    onStatus(ack.ok ? { state: 'ok', sheet: ack.sheet } : { state: 'rejected', reason: ack.reason });
  });
  return {
    send(selection) {
      if (timer !== null) { clearTimer(timer); timer = null; }
      const id = newHandoffId();
      lastId = id;
      // Everything the ack handler touches (lastId, the timer, the pending status) is in place BEFORE the record is
      // written: the browser delivers `storage` events asynchronously, but nothing here should depend on that - an
      // ack that arrived during setItem() (as it does in the synchronous fakes of the headless test) must still find
      // a pending send to resolve, in the right order.
      onStatus({ state: 'pending' });
      timer = setTimer(() => {
        timer = null;
        safe(() => storage.removeItem(HANDOFF_KEY));  // nobody took it: do not leave the record lying around
        onStatus({ state: 'timeout' });
      }, timeoutMs);
      try {
        if (!storage) throw new Error('no storage');
        storage.setItem(HANDOFF_KEY, JSON.stringify(createHandoffMessage(selection, tabId, id)));
      } catch (e) {
        lastId = null;
        if (timer !== null) { clearTimer(timer); timer = null; }
        onStatus({ state: 'storage-unavailable' });
      }
      return id;
    }
  };
}
