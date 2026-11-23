// Browser pane script (not a Node test), task 121 (3C-1). Evaluate in the generator page (index.html of the tree under test, served from its root), then
//   await verify3C()            -> { hit, export, svg, session, timeline, errs }
//   await frame3C({ n: 20 })    -> median redraw() ms: regular, Field 9 x 9 and 3C (4,8 full; 3,7 half) on three square patterns, faces off / on
// The way to SET a 3C net by hand (no UI before 3C-3):  baseNetTransform = netProjectiveSpec(a, b, 'full' | 'half'); redraw();   (setGridSize(X, Y) sets the frame = the canvas; it clears the lines)
async function verify3C() {
    const out = { errs: [] };
    window.__errs = window.__errs || []; window.addEventListener('error', e => __errs.push('error: ' + e.message));
    setGridSize(4, 3); connections = [[1, 5], [5, 3], [3, 1], [2, 8], [4, 6], [1, 9], [3, 7], [7, 8], [8, 9]]; showFaces = true; netLinesOn = false; baseNetTransform = netProjectiveSpec(2, 4, 'full'); redraw();
    // hit test: every drawn node is hit; a free endpoint lands where it was clicked (edit tile and another tile)
    const w = netWarpBaseNow(), P = w.projective, F = w.frame, dn = drawnHitNodes();
    out.hit = { dots: dn.length, allHit: dn.every(n => { const h = nodeHit(n.x, n.y, 'mouse'); return h && h.id === n.id; }), editTile: [P.i0, P.j0] };
    const pix = (p, q) => applyNetWarp(w, { x: F.c0.x + (p - P.i0) * F.v1.x + (q - P.j0) * F.v2.x, y: F.c0.y + (p - P.i0) * F.v1.y + (q - P.j0) * F.v2.y });
    freeEndpointsEnabled = true;
    const click = c => { const n0 = nodes.length; connections = [[1]]; pressAt(c.x, c.y, 'mouse', nodeHit(c.x, c.y, 'mouse')); return nodes.length - n0; };
    const cA = pix(1.3, 1.4), cB = pix(2.5, 0.7);
    click(cA); const nA = nodes[nodes.length - 1], bA = applyNetWarp(w, nA);
    click(cB); const nB = nodes[nodes.length - 1], bB = applyNetWarp(w, { x: nB.x + (2 - P.i0) * F.v1.x + (0 - P.j0) * F.v2.x, y: nB.y + (2 - P.i0) * F.v1.y + (0 - P.j0) * F.v2.y });
    freeEndpointsEnabled = false; out.hit.errEditTile = Math.hypot(bA.x - cA.x, bA.y - cA.y); out.hit.errOtherTile = Math.hypot(bB.x - cB.x, bB.y - cB.y);
    setGridSize(4, 3); connections = [[1, 5], [5, 3], [3, 1], [2, 8], [4, 6], [1, 9], [3, 7], [7, 8], [8, 9]]; baseNetTransform = netProjectiveSpec(2, 4, 'full'); showFaces = true; redraw();
    const data = buildExportData(), svg = generateSVGString(), nums = (svg.match(/-?\d+\.\d+/g) || []).map(Number), doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    out.export = { version: data.meta.netTransform.version, kind: data.meta.netTransform.kind, W: data.meta.netTransform.W, facesOmitted: data.meta.netTransform.facesOmitted, faces: (data.geometry.faces || data.faces || []).length };
    out.svg = { xmlOk: !doc.querySelector('parsererror'), maxAbs: Math.max(...nums.map(Math.abs)), nonFinite: nums.filter(n => !Number.isFinite(n)).length, paths: doc.querySelectorAll('path').length, polygons: doc.querySelectorAll('polygon').length };
    setGridSize(3, 3); baseNetTransform = netProjectiveSpec(3, 6, 'half'); redraw();
    const snap = buildSessionSnapshot(collectSessionState(null), Date.now()), v = validateSession(JSON.parse(JSON.stringify(snap))), bad = JSON.parse(JSON.stringify(snap)); bad.settings.netTransform.a = 1;
    out.session = { net: snap.settings.netTransform, valid: v.ok, a1Rejected: !validateSession(bad).ok };
    const A = netProjectiveSpec(2, 4, 'full'), B = netProjectiveSpec(3, 6, 'full'); setGridSize(4, 3); baseNetTransform = A; const saved = timeline;
    timeline = { keyframeLayerIds: [1, 2], netStates: [A, B], currentFrame: { segmentIndex: 0, localT: 0.5 }, netLive: true, segmentDurationsMs: [1000], elapsedMs: 500 };
    out.timeline = { coupled: timelineNetCoupled(), mid: netTransformNow(), summary: timelineNetSummary().state };
    timeline.netStates = [A, { regular: true }]; out.timeline.refused = timelineNetSummary().state; timeline = saved;
    out.errs = window.__errs.slice(); return out;
}
async function frame3C(o) {
    o = o || {}; const n = o.n || 20;
    const src = await fetch('/tools/morph/off-path-script.js', { cache: 'no-store' }).then(r => r.text()), specs = await fetch('/tools/morph/off-path-specs.json', { cache: 'no-store' }).then(r => r.json());
    const offPathScript = (0, eval)('(function () {' + src + '; return offPathScript; })()');
    const med = f => { const t = []; f(); for (let i = 0; i < n; i++) { const t0 = performance.now(); f(); t.push(performance.now() - t0); } t.sort((a, b) => a - b); return +t[Math.floor(n / 2)].toFixed(1); };
    const FIELD = { x: { kind: 'trig', w: -0.8 }, y: 'same', domain: 'field' }, sq = specs.filter(s => s.shape === 'square' && s.group === 'corpus').map(s => s.id), out = {};
    for (const id of [sq[0], sq[1], 'layers-two']) for (const faces of [false, true]) {
        const s = specs.find(x => x.id === id), run = (size, net) => { (0, eval)(offPathScript(Object.assign({}, s, { size }))); showFaces = faces; netLinesOn = false; baseNetTransform = net; return med(() => redraw()); };
        const reg = run(3, null), fld = run(9, FIELD), c3 = run(3, netProjectiveSpec(4, 8, 'full')), w = netWarpBaseNow(), c3b = run(3, netProjectiveSpec(3, 7, 'half'));
        out[id + (faces ? '+faces' : '')] = { regular3: reg, field9x9: fld, c3_4_8_full: c3, tiles: w && w.projective.nx * w.projective.ny, ratio: +(c3 / fld).toFixed(2), c3_3_7_half: c3b };
    }
    return out;
}
window.verify3C = verify3C; window.frame3C = frame3C;
