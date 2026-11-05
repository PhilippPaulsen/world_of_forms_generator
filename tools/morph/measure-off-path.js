// Browser pane script (not a Node test): the PIXEL half of the "switch OFF changes nothing" proof of morph stage c, and the measurements of the morph itself.
// How to use (the pane's page must be the generator, served from a root that also holds tools/morph/off-path-script.js and off-path-specs.json):
//   1. open the page with the error listeners installed BEFORE its scripts (navigate to /style.css, fetch /index.html, put a <script> with window.__errs + error / unhandledrejection / console.error
//      listeners after <head>, document.open() / write() / close(), history.replaceState(null, '', '/index.html')); the header of this file is the recipe the stage-c report used;
//   2. evaluate this file, then   await measureOffPath({ })                      -> { id: 'fnv:length', ... } the canvas hash of each of the 30 patterns (the morph stays off)
//                                 await measureOffPath({ perf: 20 })             -> also the median / min / max of 20 redraw() calls per pattern, in ms
//                                 await measureOffPath({ morph: { enabled: true, mode: 'bilinear', angleDeg: 0 } })    -> the same with the switch ON (needs two keyframes in the pattern)
//                                 await measureOffPath({ ids: ['corpus-230'] })  -> a subset
//   3. the golden pixel hashes of the OFF case are in tools/morph/off-path-golden.json (recorded at c432056c); compare with   node -e "..." or by eye; regenerate by running step 2 on the tree you trust.
// The hash is FNV-1a over canvas.toDataURL(): stable for the same pixels (the page draws deterministically; the mouse is not over a node).
async function measureOffPath(o) {
    o = o || {};
    const hash = () => { const s = document.querySelector('canvas').toDataURL(); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16) + ':' + s.length; };
    const src = await fetch('/tools/morph/off-path-script.js', { cache: 'no-store' }).then((r) => r.text());
    const specs = await fetch('/tools/morph/off-path-specs.json', { cache: 'no-store' }).then((r) => r.json());
    const offPathScript = (0, eval)('(function () {' + src + '; return offPathScript; })()');
    const out = {};
    for (const s of specs) {
        if (o.ids && !o.ids.includes(s.id)) continue;
        (0, eval)(offPathScript(s));
        if (o.morph) (0, eval)('spatialMorph = ' + JSON.stringify(o.morph) + ';');
        try { redraw(); } catch (e) { out[s.id] = 'redraw threw: ' + e.message; continue; }
        const rec = { hash: hash() };
        if (o.morph && typeof spatialMorphStatus === 'function') rec.status = spatialMorphStatus().code;
        if (o.perf) {
            const t = [];
            for (let i = 0; i < o.perf; i++) { const t0 = performance.now(); redraw(); t.push(performance.now() - t0); }
            t.sort((a, b) => a - b);
            rec.median = +t[Math.floor(t.length / 2)].toFixed(2); rec.min = +t[0].toFixed(2); rec.max = +t[t.length - 1].toFixed(2);
        }
        out[s.id] = o.perf || o.morph ? rec : rec.hash;
    }
    return out;
}
window.measureOffPath = measureOffPath;
