// Task 096: the rule between a DRAWN morph polygon (grown by spatialMorphRenderGrow) and the exact face polygon it comes from. Not a test; shared by the morph face tests.
//   drawn polygon = the face, every vertex moved OUTWARDS by at most offset x miter limit (0.3 x 1.6 = 0.48 px); same number of polygons, same order, same fill, same number of vertices; a polygon that is not grown
//   (translucent, splitter < 1 px2, degenerate) is identical.
'use strict';
const OFFSET = 0.3, MITER = 1.6, SEAM_MAX = OFFSET * MITER;
const area = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
// drawn / exact: [{ fill, pts: [[x, y], ...] }, ...]  ->  { ok, worst (largest vertex displacement), grown (polygons that differ), why }
function seamRule(drawn, exact) {
    if (drawn.length !== exact.length) return { ok: false, why: `count ${drawn.length} vs ${exact.length}` };
    let worst = 0, grown = 0;
    for (let i = 0; i < drawn.length; i++) {
        const a = drawn[i], b = exact[i];
        if (a.fill !== b.fill) return { ok: false, why: `fill #${i}: ${a.fill} vs ${b.fill}` };
        if (a.pts.length !== b.pts.length) return { ok: false, why: `vertex count #${i}` };
        let d = 0; for (let k = 0; k < a.pts.length; k++) d = Math.max(d, Math.hypot(a.pts[k][0] - b.pts[k][0], a.pts[k][1] - b.pts[k][1]));
        if (d > SEAM_MAX + 1e-9) return { ok: false, why: `#${i}: vertex moved ${d.toFixed(4)} > ${SEAM_MAX}` };
        if (d > 1e-12) { grown++; if (Math.abs(area(a.pts)) + 1e-9 < Math.abs(area(b.pts))) return { ok: false, why: `#${i}: the grown polygon is smaller than its face` }; }
        worst = Math.max(worst, d);
    }
    return { ok: true, worst, grown };
}
module.exports = { seamRule, SEAM_MAX, OFFSET, MITER };
