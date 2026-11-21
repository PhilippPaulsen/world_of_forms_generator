// Task 117 (measurement only, not a test): SVG per frame in the REAL page. Inject into index.html served from the repo root, then (reload between runs):
//   await measureSvgFrames({ shape: 'hex', X: 9, Y: 9, field: true, layers: 3, morph: false, frames: 6 })
// Builds three keyframe layers + the timeline (+ `layers` more layers on the base grid with face fills, + the hexagon Field net with `field`, + the spatial morph with `morph`), then for `frames` values of t:
// setTimelineProgress(t) [+ redraw() when `redraw`] -> generateSVGString() with the face fills ON and again with the FLAGS off (showFaces of the base and of every layer false, then put back) ->
// bytes, polygons, ms, the deflate-raw size and time (CompressionStream), XML validity (DOMParser), and whether the svg is the same with and without the redraw. Returns the numbers.
async function measureSvgFrames(o) {
    o = Object.assign({ shape: 'square', X: 3, Y: 3, frames: 6, layers: 0, field: false, morph: false, lines: 10, redraw: false }, o);
    const sleep = (ms) => new Promise(r => setTimeout(r, ms)), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    if (o.shape !== currentShape) { currentShape = o.shape; rebuildGrid(currentShape); }
    setGridSize(o.X, o.Y); showFaces = true; baseNetTransform = null; setSpatialMorph({ enabled: false });
    const orbits = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(p => p.pairs[0].slice());
    const n = Math.min(o.lines, Math.floor(orbits.length / 3));
    additionalLayers.length = 0; timeline = null;
    for (let k = 0; k < 3; k++) { addLayer(); const L = additionalLayers[additionalLayers.length - 1]; L.connections = orbits.slice(k * n, (k + 1) * n).map(c => c.slice()); L.showFaces = true; activeLayer = additionalLayers.length - 1; addLayerToTimeline(); }
    for (let k = 0; k < o.layers; k++) { addLayer(); const L = additionalLayers[additionalLayers.length - 1]; L.connections = orbits.slice(k + 1, k + 11).map(c => c.slice()); L.showFaces = true; }
    if (o.field) baseNetTransform = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' };
    if (o.morph) setSpatialMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
    activeLayer = 'base'; connections = orbits.slice(0, 8).map(c => c.slice());
    setTimelineProgress(0.37); redraw();
    const t0 = performance.now(); while (!timelineImageCheckIdle() && performance.now() - t0 < 20000) await sleep(100);
    const deflate = async (s) => { const b = new TextEncoder().encode(s); const c0 = performance.now(); const st = new Blob([b]).stream().pipeThrough(new CompressionStream('deflate-raw')); const out = new Uint8Array(await new Response(st).arrayBuffer()); return { raw: b.length, packed: out.length, ms: performance.now() - c0 }; };
    const xmlOk = (s) => { const d = new DOMParser().parseFromString(s, 'image/svg+xml'); return !d.querySelector('parsererror'); };
    const rows = [], flagSave = () => ({ base: showFaces, layers: additionalLayers.map(l => l.showFaces) });
    let sameWithAndWithoutRedraw = true;
    for (let i = 0; i < o.frames; i++) {
        const t = i / Math.max(1, o.frames - 1);
        setTimelineProgress(t); if (o.redraw) redraw();
        const a0 = performance.now(); const on = generateSVGString(); const onMs = performance.now() - a0;
        if (i === 1) { redraw(); const again = generateSVGString(); if (again !== on) sameWithAndWithoutRedraw = false; }
        const saved = flagSave(); showFaces = false; additionalLayers.forEach(l => { l.showFaces = false; });
        const b0 = performance.now(); const off = generateSVGString(); const offMs = performance.now() - b0;
        showFaces = saved.base; additionalLayers.forEach((l, k) => { l.showFaces = saved.layers[k]; });
        const dOn = await deflate(on), dOff = await deflate(off);
        rows.push({ t: +t.toFixed(2), onMs: Math.round(onMs), offMs: Math.round(offMs), onKB: Math.round(on.length / 1024), offKB: Math.round(off.length / 1024), onPackedKB: Math.round(dOn.packed / 1024), offPackedKB: Math.round(dOff.packed / 1024), packMs: Math.round(dOn.ms), polygons: (on.match(/<polygon /g) || []).length, paths: (on.match(/<path /g) || []).length, xmlOn: xmlOk(on), xmlOff: xmlOk(off), offIsOnMinusGroup: off === on.replace(/  <g stroke="none">\n[\s\S]*?  <\/g>\n/, '') });
    }
    setTimelineProgress(0.37); redraw();
    const k = (f) => rows.map(r => r[f]);
    return { opts: o, canvas: width + 'x' + height, sameWithAndWithoutRedraw, medianOnMs: med(k('onMs')), medianOffMs: med(k('offMs')), maxOnMs: Math.max(...k('onMs')), medianOnKB: med(k('onKB')), medianOffKB: med(k('offKB')), medianOnPackedKB: med(k('onPackedKB')), medianOffPackedKB: med(k('offPackedKB')),
        medianPackMs: med(k('packMs')), allXmlValid: rows.every(r => r.xmlOn && r.xmlOff), allOffIsOnMinusGroup: rows.every(r => r.offIsOnMinusGroup), polygons: med(k('polygons')), paths: med(k('paths')), rows };
}
