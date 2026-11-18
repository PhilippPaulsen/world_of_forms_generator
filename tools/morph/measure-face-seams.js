// Browser pane script (tasks 094 part 2 and 096; not a Node test): do the face FILLS of the spatial morph show seams (the background between neighbouring faces: anti-aliasing of the shared edges)?
// How: the page is the generator on 127.0.0.1; evaluate this file, then   await measureFaceSeams({ })   ->  { rows, compare, time }
//   Each frame is drawn TWICE with two different backgrounds (the sketch reads --panel-bg-color on every draw): magenta and green. A pixel covered by the fill is identical in both draws;
//   a pixel that shows the background differs by exactly the background difference times its exposure alpha: alpha = |p1 - p2| / |bg1 - bg2|, independent of the face colours.
//   Per frame: exposed = share of pixels with alpha > 0.02, clear = share with alpha > 0.5, sum = sum of alpha / pixels (exposed area share), cover = 1 - sum (covered share of the canvas).
//   lines = 'off' (stroke fully transparent: the fills alone) or 'on' (the lines as the sketch draws them over the fills).
// Options: shapes, times, save ('http://127.0.0.1:8941/save': POSTs the magenta draw, lines off, as PNG), static: true (task 096: the STATIC pattern, morph off, base faces: 'partial' = share of pixels with 0.02 < alpha < 0.98, an upper
//   bound for the seams there because the pattern's real edge against the background counts too), variant: 'new' | 'old' ('old' swaps in the fill function of main before task 096), compare: true (old and new on the same frames:
//   changed pixels, interior colour difference (pixels with a uniform 9 x 9 device-pixel neighbourhood in the old draw), changed pixels on the canvas rim, frame time old / new), tag (name part of the saved files).
const __OLD_FILL_SRC = ` function spatialMorphRenderFillFaces(res, tile, warp, colors) {
    if (typeof netWarpRefineFaces === 'function' && warp && warp.refineFaces === true) res = netWarpRefineFaces(res, warp);   // task 091: the hexagon Field: the polygons are split at the mesh lines first (a no-op for every other warp)
    const faces = res && res.faces;
    if (!faces || faces.length === 0) return 0;
    const byId = new Map(res.nodes.map((n) => [n.id, n]));
    push();
    try {
        noStroke();
        faces.forEach((face, fi) => {
            fill(colors && colors[fi] ? colors[fi] : face.color);
            beginShape();
            face.nodeIds.forEach((id) => {
                const p = toTileLocal(byId.get(id), tile.c, tile.flip, tile.rot);
                const q = warp ? applyNetWarp(warp, p) : p;
                vertex(q.x, q.y);
            });
            endShape(CLOSE);
        });
    } finally {
        pop();
    }
    return faces.length;
}
`;
async function measureFaceSeams(o) {
    o = o || {};
    const src = await fetch('/tools/morph/off-path-script.js', { cache: 'no-store' }).then((r) => r.text());
    const offPathScript = (0, eval)('(function () {' + src + '; return offPathScript; })()');
    const A = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false, domain: 'field' }, B = { x: { kind: 'trig', w: -0.3 }, y: 'same', repeat: false, domain: 'field' };
    const KF = { square: [[[1, 5], [2, 8], [3, 7]], [[1, 9], [2, 6], [4, 8]]], triangle: [[[1, 5], [2, 6], [3, 4]], [[1, 6], [2, 5], [3, 5]]], hex: [[[1, 10], [3, 14], [5, 20]], [[2, 11], [4, 15], [6, 21]]] };
    const cases = []; for (const shape of ['square', 'triangle', 'hex']) for (const net of ['none', 'field']) cases.push({ shape, net });
    const canvas = () => document.querySelector('canvas');
    const px = () => { const c = canvas(); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
    const setBg = (c) => document.body.style.setProperty('--panel-bg-color', c);
    const BG1 = [255, 0, 255], BG2 = [0, 255, 0], dn = Math.hypot(255, 255, 255);
    const NEWFN = window.__newFill || (window.__newFill = (0, eval)('spatialMorphRenderFillFaces'));
    const OLDFN = o.selfTest ? NEWFN : (0, eval)('(' + __OLD_FILL_SRC.replace(/^function spatialMorphRenderFillFaces/, 'function') + ')');   // selfTest: old = new, the ratio must be 1 (bias of the alternation)
    const useOld = (b) => { (0, eval)('0'); window.spatialMorphRenderFillFaces = b ? OLDFN : NEWFN; };
    const draw = (bg) => { setBg(`rgb(${bg})`); redraw(); return px(); };
    const stats = (p1, p2) => {
        const n = p1.length / 4; let exposed = 0, clear = 0, sum = 0, partial = 0;
        for (let i = 0; i < p1.length; i += 4) { const a = Math.min(1, Math.hypot(p1[i] - p2[i], p1[i + 1] - p2[i + 1], p1[i + 2] - p2[i + 2]) / dn); sum += a; if (a > 0.02) exposed++; if (a > 0.5) clear++; if (a > 0.02 && a < 0.98) partial++; }
        return { pixels: n, exposed: +(exposed / n).toFixed(6), clear: +(clear / n).toFixed(6), sum: +(sum / n).toFixed(6), cover: +(1 - sum / n).toFixed(6), partial: +(partial / n).toFixed(6), clearPx: clear };
    };
    const rows = [], compare = [], time = [];
    for (const cs of cases) {
        if (o.shapes && !o.shapes.includes(cs.shape)) continue;
        if (o.static && cs.net === 'field' && o.noStaticField) continue;
        const K = KF[cs.shape], id = cs.shape + '-' + cs.net + (o.static ? '-static' : '');
        const spec = o.static
            ? { id, shape: cs.shape, order: 3, size: 5, mode: 'rotation_reflection6', connections: K[0].concat(K[1]), net: cs.net === 'field' ? A : null }
            : { id, shape: cs.shape, order: 3, size: 5, mode: 'rotation_reflection6', connections: K[0], net: cs.net === 'field' ? A : null,
                layers: K.map((k) => ({ shape: cs.shape, order: 3, size: 5, mode: 'rotation_reflection6', offsetX: 0, offsetY: 0, rotation: 0, connections: k, enabled: true })), timeline: { keyframes: [0, 1], progress: 0.5, playing: false } };
        (0, eval)(offPathScript(spec));
        if (o.static) (0, eval)(`showFaces = true; showNodes = false; spatialMorph = { enabled: false, mode: 'linear', angleDeg: 0 };`);
        else (0, eval)(`additionalLayers[0].showFaces = true; additionalLayers[1].showFaces = true; showNodes = false; spatialMorph = { enabled: true, mode: 'linear', angleDeg: 0 };` +
            (cs.net === 'field' ? ` timeline.netStates = ${JSON.stringify([A, B])}; timeline.netLive = true;` : ''));
        redraw(); redraw();   // warm-up: the first draw after a set-up builds the corner colour fields
        const total = o.static ? 1 : (0, eval)('totalTimelineDurationMs(timeline)'), savedLine = (0, eval)('lineColor');
        for (const t of (o.static ? [0] : (o.times || [0.25, 0.5, 0.75]))) for (const lines of ['off', 'on']) {
            (0, eval)(`lineColor = ${JSON.stringify(lines === 'off' ? 'rgba(0,0,0,0)' : savedLine)};` + (o.static ? '' : ` timeline.elapsedMs = ${t} * ${total}; applyTimelineFrame();`));
            useOld(o.variant === 'old');
            const p1 = draw(BG1); let dataUrl = null; if (o.save && lines === 'off') dataUrl = canvas().toDataURL('image/png');
            const p2 = draw(BG2);
            const rec = Object.assign({ id, t, lines, variant: o.variant || 'new', status: o.static ? 'static' : spatialMorphStatus().code, w: canvas().width, h: canvas().height }, stats(p1, p2));
            if (dataUrl) { rec.saved = `${o.tag || '094'}-seam-${id}-t${Math.round(t * 100)}.png`; await fetch(o.save + '?name=' + rec.saved, { method: 'POST', body: dataUrl }); }
            rows.push(rec);
            if (o.compare) {   // old and new, same frame, magenta background
                useOld(true); const q0 = draw(BG1); const q0b = draw(BG2); useOld(false); const q1 = draw(BG1);
                const W = canvas().width, H = canvas().height; let changed = 0, interiorChangedExposed = 0, interior = 0, interiorSum = 0, interiorMax = 0, rim = 0, interiorChanged = 0;
                const same = (i, j) => q0[i] === q0[j] && q0[i + 1] === q0[j + 1] && q0[i + 2] === q0[j + 2];
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const i = (y * W + x) * 4, d = Math.abs(q0[i] - q1[i]) + Math.abs(q0[i + 1] - q1[i + 1]) + Math.abs(q0[i + 2] - q1[i + 2]);
                    if (d > 0) { changed++; if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) rim++; }
                    if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) continue;
                    let uni = true;   // a uniform 9 x 9 neighbourhood in BOTH backgrounds of the old draw = a face interior (>= 2 css px from any edge at density 2)
                    for (let dy = -4; dy <= 4 && uni; dy += 2) for (let dx = -4; dx <= 4; dx += 2) { const j = ((y + dy) * W + (x + dx)) * 4; if (!same(i, j)) { uni = false; break; } }
                    if (uni) { interior++; interiorSum += d / 3; interiorMax = Math.max(interiorMax, d); if (d > 0) { interiorChanged++; if (q0[i] !== q0b[i] || q0[i + 1] !== q0b[i + 1] || q0[i + 2] !== q0b[i + 2]) interiorChangedExposed++; } }
                }
                compare.push({ id, t, lines, changedShare: +(changed / (W * H)).toFixed(6), changedPx: changed, interiorPx: interior, interiorMeanDiff: interior ? +(interiorSum / interior).toFixed(6) : 0, interiorMaxDiff: interiorMax, interiorChanged, interiorChangedExposed, rimChanged: rim });
                if (lines === 'off' && !o.noTime) {
                // frame time like a playback: 36 frames at p = 0.30 ... 0.65 (every frame has other lines, the faces are computed again); at EACH p old and new are drawn back to back, the order alternating (ABBA),
                // and the time includes the canvas flush (a 1 x 1 getImageData): block-wise alternation drifted by tens of percent in this pane, the per-frame pairs do not (selfTest: ratio 1)
                setBg('rgb(255,0,255)'); const to = [], tn = [];
                const one = (isOld, p) => { useOld(isOld); (0, eval)(`timeline.elapsedMs = ${p} * ${total}; applyTimelineFrame();`); const t0 = performance.now(); redraw(); canvas().getContext('2d').getImageData(0, 0, 1, 1); return performance.now() - t0; };
                for (let w = 0; w < 4; w++) { one(true, 0.4); one(false, 0.4); }
                for (let i = 0; i < 36; i++) { const p = 0.3 + 0.01 * i; if (i % 2) { const a = one(true, p), b = one(false, p); to.push(a); tn.push(b); } else { const b = one(false, p), a = one(true, p); to.push(a); tn.push(b); } }
                to.sort((x, y) => x - y); tn.sort((x, y) => x - y); const tOld = to[18], tNew = tn[18]; useOld(false);
                (0, eval)(`timeline.elapsedMs = ${t} * ${total}; applyTimelineFrame();`);
                time.push({ id, t, lines, oldMs: +tOld.toFixed(2), newMs: +tNew.toFixed(2) });
                }
            }
        }
        (0, eval)(`lineColor = ${JSON.stringify(savedLine)};`);
    }
    useOld(false);
    document.body.style.removeProperty('--panel-bg-color'); redraw();
    return { rows, compare, time };
}
