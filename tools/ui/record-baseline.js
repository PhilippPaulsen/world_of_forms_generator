/*
 * Records a layout baseline with tools/ui/measure-layout.js: tooling, not part of the test suite (it needs a browser).
 *
 * How to run. Serve the repo root (for example `python3 -m http.server 8990 --bind 127.0.0.1` from it), open ANY page of that origin in a browser (index.html, or a text file such as
 * _marker.txt), paste this file into the console (or inject it with a browser tool) and call, one width at a time (a width takes about 30 s: three tabs, each a fresh page load and the
 * whole measure-layout scenario):
 *
 *   const r = await recordBaseline({ width: 1440 })        // -> { "1440": { form: {...}, netz: {...}, farbe: {...} } }
 *
 * Do it for 375, 768, 1100 and 1440 and merge the four objects under "widths" of the baseline file. Options: { width, tabs: ['form', 'netz', 'farbe'], path: '' (the folder that holds
 * index.html, with a trailing slash if not empty, e.g. 'new/'), pointer: 'target' | 'native', expect: 'coarse' | 'fine' (throws at the start of a tab when the page's pointer is not that one: the pane
 * clears a viewport emulation when a turn ends, which happened in the middle of a recording once), script: path + 'tools/ui/measure-layout.js' (the measuring script: give the same one for two
 * trees to compare them) }.
 *
 * The pointer. 'native' (the default since the cleanup) forces nothing: the page sees the pointer of the window it runs in, and every result says which one (`pointer`: coarse, fine, hover,
 * --target, innerWidth). For a REAL coarse pointer the window itself must be a touch device: in the Claude desktop app's browser pane that is the Mobile preset of resize_window (375 x 812,
 * Android Chrome user agent, 5 touch points: `(pointer: coarse)` is then true in the page AND in same-origin iframes, whatever their width, because the pointer media features belong to the
 * device, not to the frame), and the Desktop preset gives a fine pointer. 'target' is the old method (baseline-rail-3.json): the pointer stays whatever the window has and `--target: 48px` is
 * forced on the page, which makes the buttons 48px but does not switch any `(pointer: coarse)` media query (the layer table's 1032px threshold, for example): use it only to compare with that file.
 *
 * What it does. A same-origin iframe of the given width (the page is loaded fresh, by a unique ?v= so no stale cached script is measured, with the tab in the URL hash), then
 * tools/ui/measure-layout.js evaluated inside the iframe and `await measureLayout({ raw: true })`. Each result has the rects of every tracked element (null = hidden or absent) for: start (no
 * layer), shape_switch, the net chapter (square_sin_field: netz_row, square_sin_field, more_netz_open, found), layer_timeline (a layer, a keyframe, a second layer, two keyframes, driven through
 * window.layerApi), timeline_more, layer_more, plus_probe (one real click on the visible "+"; `probe` names it), notice (a notice showing), dom_present (which old and kept selectors exist)
 * and pointer.
 *
 * Saving. A result is big (60 to 120 KB per width): `postTo` (optional) is a URL that gets the JSON by POST (a tiny local server in the scratchpad did that for the cleanup baseline).
 *
 * The files. baseline-phase1.json is the ORIGINAL phase-1 baseline (commit 7ae041c0, before any rework, Form tab only, the old toolbar); it stays as it is, as the "before" of the whole UI
 * rework. baseline-rail-3.json is the baseline after rail rearrangement commit 3 (all three tabs, the five-group rail, the Netz row and its overlay, the OLD layer row and timeline controls,
 * `--target` forced). baseline-cleanup-1.json is the control recorded before the cleanup deleted the old layer, timeline and message DOM: the table, the rail, the strip, the timeline strip and
 * the notices are tracked, and `dom_present` lists the old elements that still exist. baseline-cleanup-1b.json is the same control recorded again on the tree after step 3 with the
 * DETERMINISTIC script (every snapshot but `notice` is taken with no notice on screen and #ui-notices is measured in viewport coordinates: two recordings of one tree give 0 differences,
 * whatever the speed or the visibility of the pane). baseline-cleanup-2.json is the state AFTER the cleanup (the tree of eeb1757d: the old layer, timeline and message DOM removed), with
 * two extra widths, 936 (fine) and 1032c (real coarse), the thresholds where the layer table shows; its "before" note holds the comparison with 1b (exactly the 20 removed selectors of
 * dom_present, true -> false, and nothing else). The relation: phase1 = before the whole UI rework; rail-3 = before the layer work; cleanup-1 and cleanup-1b = the controls on the old DOM
 * (1 with the first, nondeterministic script, 1b with the deterministic one); cleanup-2 = after the cleanup. LATER RUNS ARE COMPARED WITH baseline-cleanup-2.json.
 *
 * Comparing a later run with a file. Record the same widths, tabs and pointer modes of the later tree (the same steps, the same script), save them as a second file with the same shape
 * ({ phase, commit, note, modes, widths }), then
 *
 *   node tools/ui/compare-baseline.js tools/ui/baseline-cleanup-2.json <the new file>            (every difference: rect, presence, scalar)
 *   node tools/ui/compare-baseline.js <a> <b> --shared                                            (only elements both files track; for a file of an older method)
 *
 * It prints each element that differs, per width, tab and scenario, with both rects, and a count per kind. A run of a tree with no layout change gives 0 differences; a change that
 * removes or adds an element shows as its `dom_present` entry (true <-> false, counted as a scalar) and any rect that moved. Use the same widths (375, 768, 768c, 936, 1032c, 1100, 1100c,
 * 1440, 1440c; the suffix c = real coarse pointer) and pointer modes as the file you compare with.
 */
async function recordBaseline(opts) {
  opts = opts || {};
  const width = opts.width, tabs = opts.tabs || ['form', 'netz', 'farbe'], path = opts.path || '';
  const pointer = opts.pointer || 'native';
  if (!width) throw new Error('recordBaseline({ width }) needs a width');
  if (pointer !== 'native' && pointer !== 'target') throw new Error("recordBaseline: pointer must be 'native' or 'target'");
  const src = await (await fetch(opts.script || (path + 'tools/ui/measure-layout.js'), { cache: 'reload' })).text();   // never a cached copy of the script
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  out[width] = {};
  for (const tab of tabs) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:absolute;left:0;top:0;border:0;width:' + width + 'px;height:812px;background:#fff';
    document.body.appendChild(f);
    f.src = path + 'index.html?v=baseline' + Math.random().toString(36).slice(2) + '#' + tab;
    await new Promise((r) => f.addEventListener('load', r, { once: true }));
    const d = f.contentDocument;
    for (let i = 0; i < 100 && !d.querySelector('#canvas-container canvas'); i++) await sleep(100);
    await sleep(400);
    if (opts.expect) { const isCoarse = f.contentWindow.matchMedia('(pointer: coarse)').matches; if ((opts.expect === 'coarse') !== isCoarse) { f.remove(); throw new Error('recordBaseline: expected a ' + opts.expect + ' pointer, the page has a ' + (isCoarse ? 'coarse' : 'fine') + ' one (width ' + width + ', tab ' + tab + ')'); } }
    if (pointer === 'target') { const s = d.createElement('style'); s.textContent = ':root{--target:48px !important}'; d.head.appendChild(s); await sleep(200); }
    f.contentWindow.eval(src);
    out[width][tab] = await f.contentWindow.measureLayout({ raw: true });
    f.remove();
  }
  if (opts.postTo) await fetch(opts.postTo, { method: 'POST', body: JSON.stringify(out) });
  return out;
}
window.recordBaseline = recordBaseline;
