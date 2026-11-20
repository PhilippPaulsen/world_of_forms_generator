// Task 116 (browser check, not a test): the REAL page, the real driver. Inject into index.html served from the repo root; run (reload between runs):
//   await verifyAnimExport({ shape: 'square', X: 3, Y: 3, density: 1, frames: 24, morph: false, layers: 0, field: false, name: 'sq-tl-1x' })
// Builds three keyframe layers + the timeline (+ `layers` extra layers on the base grid with face fills, + the hexagon Field net when `field`), takes a snapshot of the page state, runs runAnimationExport() on the real env
// with a per-frame clock, PUTs the downloaded ZIP to tools/anim/receive-zip.js (port 8952) and takes the snapshot again. Returns the numbers; the ZIP is checked outside (unzip -t, zipfile).
async function verifyAnimExport(o) {
    o = Object.assign({ shape: 'square', X: 3, Y: 3, density: 1, frames: 24, morph: false, layers: 0, field: false, name: 'run', lines: 10, playing: false, send: true }, o);
    const sleep = (ms) => new Promise(r => setTimeout(r, ms)), cv = () => document.querySelector('#canvas-container canvas');
    const hash = (u) => { let h = 0; for (let i = 0; i < u.length; i += 41) h = (h * 31 + u.charCodeAt(i)) | 0; return h; };
    const errors = []; const oe = console.error; console.error = (...a) => { errors.push(a.map(String).join(' ').slice(0, 200)); oe.apply(console, a); };
    window.addEventListener('error', (e) => errors.push('window error: ' + e.message));
    if (o.shape !== currentShape) { currentShape = o.shape; rebuildGrid(currentShape); }
    setGridSize(o.X, o.Y); showFaces = true;
    const orbits = computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(p => p.pairs[0].slice());
    const n = Math.min(o.lines, Math.floor(orbits.length / 3));
    additionalLayers.length = 0; timeline = null; baseNetTransform = null; setSpatialMorph({ enabled: false });   // a clean scene per run
    for (let k = 0; k < 3; k++) { addLayer(); const L = additionalLayers[additionalLayers.length - 1]; L.connections = orbits.slice(k * n, (k + 1) * n).map(c => c.slice()); L.showFaces = true; activeLayer = additionalLayers.length - 1; addLayerToTimeline(); }
    for (let k = 0; k < o.layers; k++) { addLayer(); const L = additionalLayers[additionalLayers.length - 1]; L.connections = orbits.slice(k + 1, k + 1 + 10).map(c => c.slice()); L.showFaces = true; }
    if (o.field) baseNetTransform = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' };
    if (o.morph) setSpatialMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
    activeLayer = 'base';
    connections = orbits.slice(0, 8).map(c => c.slice());
    setTimelineProgress(0.37); redraw();
    if (o.playing) { toggleTimelinePlayback(); await sleep(300); }
    const idleT0 = performance.now(); while (!timelineImageCheckIdle() && performance.now() - idleT0 < 20000) await sleep(100);
    const snap = () => ({ tl: JSON.stringify({ e: timeline.elapsedMs, p: timeline.playing, s: timeline.startTime, n: timeline.netLive, c: timeline.currentFrame }), status: document.getElementById('timeline-status').innerHTML,
        density: pixelDensity(), layers: hash(JSON.stringify(additionalLayers.map(l => [l.connections, l.enabled, l.offsetX, l.rotation, l.showFaces]))), cpx: cv().width + 'x' + cv().height });
    // the canvas is read through toBlob + decode, never through getImageData on the page canvas: a canvas that was read back becomes CPU-backed and its toBlob takes about a second at 1800 x 600 (measured, task 116)
    const pixels = async () => { const bm = await createImageBitmap(await new Promise(r => cv().toBlob(r, 'image/png'))); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; const x = c.getContext('2d'); x.drawImage(bm, 0, 0); return new Uint8ClampedArray(x.getImageData(0, 0, c.width, c.height).data); };
    redraw(); await pixels(); redraw();   // the canvas as the page shows it now: drawn, read once, drawn again (the first draw after a rebuild of the scene can differ in antialiasing from the steady state, measured, task 116)
    const before = snap(), P0 = await pixels(), playingBefore = timeline.playing;
    const frameMs = [], sent = { bytes: 0 };
    const realDownload = window.downloadBlob; let zipBlob = null;
    window.downloadBlob = (b) => { zipBlob = b; };
    const env = animExportEnv({ onProgress: (p) => { if (p.phase === 'frame') frameMs.push(+p.ms.toFixed(0)); } });
    const t0 = performance.now(); const est = await new Promise(r => cv().toBlob(b => r(b), 'image/png'));
    const per = est.size / (cv().width * cv().height);
    const res = await runAnimationExport(env, { frames: o.frames, density: o.density, bytesPerFrame: Math.round(per * width * height * o.density * o.density) });
    const totalMs = performance.now() - t0; window.downloadBlob = realDownload;
    if (zipBlob && o.send) { const r = await fetch('http://localhost:8952/' + o.name + '.zip', { method: 'PUT', body: zipBlob }); sent.bytes = zipBlob.size; sent.status = r.status; }
    await sleep(200);
    redraw(); await pixels(); redraw();   // the same steady-state routine as before the export (a first read of a canvas that was just resized can differ in antialiasing)
    const after = snap(), P1 = await pixels(); let pixelDiff = P0.length === P1.length ? 0 : -1;
    let box = null, maxd = 0;
    if (pixelDiff === 0) for (let i = 0; i < P0.length; i++) if (P0[i] !== P1[i]) { pixelDiff++; maxd = Math.max(maxd, Math.abs(P0[i] - P1[i])); const p = (i >> 2), x = p % cv().width, y = (p / cv().width) | 0; box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y]; }
    const diff = Object.keys(before).filter(k => before[k] !== after[k]);
    const sorted = frameMs.slice().sort((a, b) => a - b);
    console.error = oe;
    return { name: o.name, res: { ok: res.ok, code: res.code, n: res.n, bytes: res.bytes, msg: res.message }, canvas: before.cpx, estimatedPerFrameKB: Math.round(per * width * height * o.density * o.density / 1024), zipBytes: sent.bytes, putStatus: sent.status,
        frameMs: { median: sorted[sorted.length >> 1], max: sorted[sorted.length - 1], min: sorted[0], all: frameMs.length <= 30 ? frameMs : undefined }, totalMs: +totalMs.toFixed(0), playingBefore, playingAfter: timeline.playing, stateDiff: diff, pixelsDifferingAfterExport: pixelDiff, pixelDiffBox: box, pixelDiffMax: maxd, before, after, errors };
}
