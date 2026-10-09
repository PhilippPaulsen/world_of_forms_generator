/*
 * Records a layout baseline with tools/ui/measure-layout.js: tooling, not part of the test suite (it needs a browser).
 *
 * How to run. Serve the repo root (for example `python3 -m http.server 8990 --bind 127.0.0.1` from it), open ANY page of that origin in a browser (index.html, or a text file such as
 * _marker.txt), paste this file into the console (or inject it with a browser tool) and call, one width at a time (a width takes about 25 s: three tabs, each a fresh page load and the
 * whole measure-layout scenario):
 *
 *   const r = await recordBaseline({ width: 1440 })        // -> { "1440": { form: {...}, netz: {...}, farbe: {...} } }
 *
 * Do it for 375, 768, 1100 and 1440 and merge the four objects under "widths" of the baseline file (tools/ui/baseline-rail-3.json has the shape). Options: { width, tabs: ['form', 'netz',
 * 'farbe'], path: '' (the folder that holds index.html, with a trailing slash if not empty, e.g. 'new/'), coarse: true, script: path + 'tools/ui/measure-layout.js' (the
 * measuring script: give the same one for two trees to compare them) }.
 *
 * What it does. A same-origin iframe of the given width (the page is loaded fresh, by a unique ?v= so no stale cached script is measured, with the tab in the URL hash), `--target: 48px` forced
 * when coarse (a coarse pointer, as on a phone or a tablet; the browser pane has a fine one), then tools/ui/measure-layout.js evaluated inside the iframe and `await measureLayout({ raw: true })`.
 * Each result has the rects of every tracked element (null = hidden or absent) for: start (no layer), shape_switch, the net chapter (square_sin_field: netz_row, square_sin_field,
 * more_netz_open, found), and layer_timeline (two layers, two keyframes).
 *
 * The files. baseline-phase1.json is the ORIGINAL phase-1 baseline (commit 7ae041c0, before any rework, Form tab only, the old toolbar); it stays as it is, as the "before" of the whole UI rework.
 * baseline-rail-3.json is the baseline after rail rearrangement commit 3 (all three tabs, the five-group rail, the Netz row and its overlay); compare a later state with it, not with phase 1.
 */
async function recordBaseline(opts) {
  opts = opts || {};
  const width = opts.width, tabs = opts.tabs || ['form', 'netz', 'farbe'], path = opts.path || '', coarse = opts.coarse !== false;
  if (!width) throw new Error('recordBaseline({ width }) needs a width');
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
    if (coarse) { const s = d.createElement('style'); s.textContent = ':root{--target:48px !important}'; d.head.appendChild(s); await sleep(200); }
    f.contentWindow.eval(src);
    out[width][tab] = await f.contentWindow.measureLayout({ raw: true });
    f.remove();
  }
  return out;
}
window.recordBaseline = recordBaseline;
