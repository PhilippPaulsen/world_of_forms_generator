// Task 117 (browser check, not a test): the REAL page, the real driver, format 'svg'. Inject into index.html served from the repo root; run (reload between runs; tools/anim/receive-zip.js on port 8952):
//   await verifySvgExport({ shape: 'hex', X: 9, Y: 9, field: true, layers: 3, morph: false, noFaces: false, frames: 24, name: 'hex9-L3-faces' })
// Builds three keyframe layers + the timeline (+ `layers` layers on the base grid with face fills, + the hexagon Field net with `field`, + the spatial morph with `morph`), takes a snapshot, runs runAnimationExport() on the real
// env (SVG), PUTs the ZIP to the receiver, and returns: per-frame ms, sizes, the state difference, the flags, the canvas pixel difference, and whether the SVG of the shown state is the same before and after.
// Also (check: true) whether every frame equals the same frame generated with a redraw() in between.
async function verifySvgExport(o) {
    o = Object.assign({ shape: 'square', X: 3, Y: 3, frames: 24, layers: 0, field: false, morph: false, noFaces: false, name: 'svg', lines: 10, send: true, check: true }, o);
    const sleep = (ms) => new Promise(r => setTimeout(r, ms)), cv = () => document.querySelector('#canvas-container canvas');
    const errors = []; const oe = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ').slice(0, 200)); oe.apply(console, a); };
    window.addEventListener('error', (e) => errors.push('window error: ' + e.message));
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
    const idleT0 = performance.now(); while (!timelineImageCheckIdle() && performance.now() - idleT0 < 20000) await sleep(100);
    const pixels = async () => { const bm = await createImageBitmap(await new Promise(r => cv().toBlob(r, 'image/png'))); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return new Uint8ClampedArray(x.getImageData(0, 0, c.width, c.height).data); };
    const flags = () => JSON.stringify([showFaces, additionalLayers.map(l => l.showFaces)]);
    const snap = () => ({ tl: JSON.stringify({ e: timeline.elapsedMs, p: timeline.playing, s: timeline.startTime, n: timeline.netLive, c: timeline.currentFrame }), status: document.getElementById('timeline-status').innerHTML, density: pixelDensity(), layers: JSON.stringify(additionalLayers.map(l => [l.connections, l.enabled, l.offsetX, l.rotation, l.showFaces])).length, flags: flags() });
    redraw(); await pixels(); redraw();
    const before = snap(), P0 = await pixels(), svgBefore = generateSVGString();
    const frameMs = [], realDownload = window.downloadBlob; let zipBlob = null; window.downloadBlob = (b) => { zipBlob = b; };
    const env = animExportEnv({ onProgress: (p) => { if (p.phase === 'frame') frameMs.push(Math.round(p.ms)); } });
    const probe = await animExportProbeSvg(env, o.noFaces);
    const t0 = performance.now();
    const res = await runAnimationExport(env, { frames: o.frames, format: 'svg', noFaces: o.noFaces, bytesPerFrame: probe.packed, density: 1 });
    const totalMs = performance.now() - t0; window.downloadBlob = realDownload;
    let put = null; if (zipBlob && o.send) { const r = await fetch('http://localhost:8952/' + o.name + '.zip', { method: 'PUT', body: zipBlob }); put = r.status; }
    await sleep(200); redraw(); await pixels(); redraw();
    const after = snap(), P1 = await pixels(), svgAfter = generateSVGString();
    let pixelDiff = P0.length === P1.length ? 0 : -1; if (pixelDiff === 0) for (let i = 0; i < P0.length; i++) if (P0[i] !== P1[i]) pixelDiff++;
    let framesSameWithRedraw = null;
    if (o.check) { framesSameWithRedraw = true; const T = animFrameTimes({ frames: o.frames }).times; for (const t of T) { setTimelineProgress(t); const a = animExportSvgString(o.noFaces); redraw(); const b = animExportSvgString(o.noFaces); if (a !== b) { framesSameWithRedraw = false; break; } } setTimelineProgress(0.37); redraw(); }
    console.error = oe;
    const sorted = frameMs.slice().sort((a, b) => a - b);
    return { name: o.name, res: { ok: res.ok, code: res.code, n: res.n, bytes: res.bytes, msg: res.message }, canvas: cv().width + 'x' + cv().height, probe, zipMB: zipBlob ? +(zipBlob.size / 1048576).toFixed(2) : 0, put, frameMs: { min: sorted[0], median: sorted[sorted.length >> 1], max: sorted[sorted.length - 1] }, totalMs: Math.round(totalMs),
        stateDiff: Object.keys(before).filter(k => before[k] !== after[k]), flagsBefore: before.flags, flagsAfter: after.flags, pixelsDifferingAfterExport: pixelDiff, svgOfShownStateSameBeforeAfter: svgBefore === svgAfter, framesSameWithRedraw, errors };
}
