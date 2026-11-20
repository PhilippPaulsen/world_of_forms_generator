// Task 114 (measurement only): PNG per frame in the REAL page. Not a test (no test- prefix). Inject into index.html served from the repo root (preview server) and run:
//   await measurePngFrames({ shape: 'square', X: 3, Y: 3, density: 1, frames: 8, kind: 'timeline', net: false })   -> JSON rows
// kind: 'timeline' (three keyframe layers + playback layer, setTimelineProgress) | 'morph' (same, spatial morph on) | 'plain' (base only, no animation)
// It changes the page state (grid size, layers): reload the page between runs. Per frame: setTimelineProgress(t) + redraw() (ms), canvas.toBlob('image/png') (ms, bytes); also
// usedJSHeapSize (Chromium only) before / after, and the canvas pixel size. The ZIP and the SVG are measured in node (measure-anim-export.js).
async function measurePngFrames(o) {
    o = Object.assign({ shape: 'square', X: 3, Y: 3, density: 1, frames: 8, kind: 'timeline', net: false, lines: 10 }, o);
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const cv = () => document.querySelector('#canvas-container canvas');
    const heap = () => (performance.memory ? performance.memory.usedJSHeapSize : null);
    const toBlob = (c) => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob null')), 'image/png'));
    if (o.shape !== currentShape) { currentShape = o.shape; rebuildGrid(currentShape); }
    setGridSize(o.X, o.Y);
    pixelDensity(o.density);
    showFaces = true;
    if (o.kind !== 'plain') {
        const orbits = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(p => p.pairs[0].slice());
        const n = Math.min(o.lines, Math.floor(orbits.length / 3));
        additionalLayers.length = 0; timeline = null;
        for (let k = 0; k < 3; k++) {
            addLayer();
            const L = additionalLayers[additionalLayers.length - 1];
            L.connections = orbits.slice(k * n, (k + 1) * n).map(c => c.slice()); L.showFaces = true;   // equal line counts: the timeline refuses keyframes that differ
            activeLayer = additionalLayers.length - 1; addLayerToTimeline();
        }
        if (o.kind === 'morph') setSpatialMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
    }
    activeLayer = 'base';
    connections = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(p => p.pairs[0].slice()).slice(0, 8);
    redraw(); await sleep(50);
    const rows = [], blobs = [], h0 = heap(), t0 = performance.now();
    for (let i = 0; i < o.frames; i++) {
        const t = o.kind === 'plain' ? 0 : i / Math.max(1, o.frames - 1);
        const a = performance.now(); if (o.kind !== 'plain') setTimelineProgress(t); redraw(); const b = performance.now();
        const blob = await toBlob(cv()); const c = performance.now();
        blobs.push(blob);   // kept on purpose: the memory a collector would hold for the ZIP
        rows.push({ i, drawMs: +(b - a).toFixed(0), pngMs: +(c - b).toFixed(0), bytes: blob.size });
    }
    const med = (k) => rows.map(r => r[k]).sort((x, y) => x - y)[rows.length >> 1];
    const c = cv();
    return { opts: o, canvasPx: c.width + 'x' + c.height, cssPx: width + 'x' + height, dpr: window.devicePixelRatio, medianDrawMs: med('drawMs'), medianPngMs: med('pngMs'), medianBytes: med('bytes'),
        totalMs: +(performance.now() - t0).toFixed(0), heapBeforeMB: h0 === null ? null : +(h0 / 1048576).toFixed(1), heapAfterMB: heap() === null ? null : +(heap() / 1048576).toFixed(1),
        heldBlobsMB: +(blobs.reduce((s, x) => s + x.size, 0) / 1048576).toFixed(2), rows: rows.slice(0, 3) };
}
