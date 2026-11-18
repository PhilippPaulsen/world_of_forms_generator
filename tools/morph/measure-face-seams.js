// Browser pane script (task 094, part 2; not a Node test): do the face FILLS of the spatial morph show seams (the background between neighbouring faces: anti-aliasing of the shared edges, noStroke() fills)?
// How: the page is the generator on 127.0.0.1; evaluate this file, then   await measureFaceSeams({ })   ->  [{ id, t, ... }]
//   Each frame is drawn TWICE with two different backgrounds (the sketch reads --panel-bg-color on every draw): magenta and green. A pixel that is covered by the fill is identical in both draws;
//   a pixel that shows the background differs by exactly the background difference times its exposure alpha. So alpha = |p1 - p2| / |bg1 - bg2| per channel, independent of the face colours.
//   Reported per frame: exposed = share of the canvas pixels with alpha > 0.02 (any seam), clear = share with alpha > 0.5 (a pixel that is mostly background), sum = sum of alpha / pixels (the exposed area share).
//   Variants: lines = 'off' (stroke made fully transparent: the fills alone, the worst case) and 'on' (the lines as the sketch draws them over the fills).
//   o.save = 'http://127.0.0.1:8941/save' also POSTs the magenta draw of each frame (lines off) as PNG (reports/logs, not committed).
// Cases: square, triangle, hexagon, size 5 (area 5 x 5), order 3; with a Field net (net states A -> B) and without a net; t = 0.25, 0.5, 0.75 of one playback segment; faces on both keyframes.
async function measureFaceSeams(o) {
    o = o || {};
    const src = await fetch('/tools/morph/off-path-script.js', { cache: 'no-store' }).then((r) => r.text());
    const offPathScript = (0, eval)('(function () {' + src + '; return offPathScript; })()');
    const A = { x: { kind: 'trig', w: -0.8 }, y: 'same', repeat: false, domain: 'field' }, B = { x: { kind: 'trig', w: -0.3 }, y: 'same', repeat: false, domain: 'field' };
    const KF = { square: [[[1, 5], [2, 8], [3, 7]], [[1, 9], [2, 6], [4, 8]]], triangle: [[[1, 5], [2, 6], [3, 4]], [[1, 6], [2, 5], [3, 5]]], hex: [[[1, 10], [3, 14], [5, 20]], [[2, 11], [4, 15], [6, 21]]] };
    const cases = []; for (const shape of ['square', 'triangle', 'hex']) for (const net of ['none', 'field']) cases.push({ shape, net });
    const canvas = () => document.querySelector('canvas');
    const px = () => { const c = canvas(); const g = c.getContext('2d'); return g.getImageData(0, 0, c.width, c.height).data; };
    const setBg = (c) => document.body.style.setProperty('--panel-bg-color', c);
    const BG1 = [255, 0, 255], BG2 = [0, 255, 0];
    const out = [];
    for (const cs of cases) {
        if (o.shapes && !o.shapes.includes(cs.shape)) continue;
        const K = KF[cs.shape], spec = { id: cs.shape + '-' + cs.net, shape: cs.shape, order: 3, size: 5, mode: 'rotation_reflection6', connections: K[0], net: cs.net === 'field' ? A : null,
            layers: K.map((k) => ({ shape: cs.shape, order: 3, size: 5, mode: 'rotation_reflection6', offsetX: 0, offsetY: 0, rotation: 0, connections: k, enabled: true })), timeline: { keyframes: [0, 1], progress: 0.5, playing: false } };
        (0, eval)(offPathScript(spec));
        (0, eval)(`additionalLayers[0].showFaces = true; additionalLayers[1].showFaces = true; showNodes = false; spatialMorph = { enabled: true, mode: 'linear', angleDeg: 0 };` +
            (cs.net === 'field' ? ` timeline.netStates = ${JSON.stringify([A, B])}; timeline.netLive = true;` : ''));
        const total = (0, eval)('totalTimelineDurationMs(timeline)'), savedLine = (0, eval)('lineColor');
        for (const t of (o.times || [0.25, 0.5, 0.75])) for (const lines of ['off', 'on']) {
            (0, eval)(`lineColor = ${JSON.stringify(lines === 'off' ? 'rgba(0,0,0,0)' : savedLine)}; timeline.elapsedMs = ${t} * ${total}; applyTimelineFrame();`);
            setBg(`rgb(${BG1})`); redraw(); const p1 = px();
            let dataUrl = null; if (o.save && lines === 'off') dataUrl = canvas().toDataURL('image/png');
            setBg(`rgb(${BG2})`); redraw(); const p2 = px();
            const n = p1.length / 4, dB = [BG1[0] - BG2[0], BG1[1] - BG2[1], BG1[2] - BG2[2]], dn = Math.hypot(dB[0], dB[1], dB[2]);
            let exposed = 0, clear = 0, sum = 0;
            for (let i = 0; i < p1.length; i += 4) {
                const d = Math.hypot(p1[i] - p2[i], p1[i + 1] - p2[i + 1], p1[i + 2] - p2[i + 2]), a = Math.min(1, d / dn);
                sum += a; if (a > 0.02) exposed++; if (a > 0.5) clear++;
            }
            const rec = { id: spec.id, t, lines, status: spatialMorphStatus().code, w: canvas().width, h: canvas().height, pixels: n, exposed: +(exposed / n).toFixed(6), clear: +(clear / n).toFixed(6), sum: +(sum / n).toFixed(6), exposedPx: exposed, clearPx: clear };
            if (dataUrl) { rec.saved = `094-seam-${spec.id}-t${Math.round(t * 100)}.png`; await fetch(o.save + '?name=' + rec.saved, { method: 'POST', body: dataUrl }); }
            out.push(rec);
        }
        (0, eval)(`lineColor = ${JSON.stringify(savedLine)};`);
    }
    document.body.style.removeProperty('--panel-bg-color'); redraw();
    return out;
}
