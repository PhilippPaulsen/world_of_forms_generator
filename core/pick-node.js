/*
 * Phase 2 (touch), B4a: the node hit test as a pure function. NOT wired into the app yet (sketch.js pressAt() still has its own first-match loop);
 * this file and tools/ui/test-pick-node.js exist so the rule is decided and tested before it replaces anything.
 *
 *   pickNodeAt(nodes, x, y, radius) -> the NEAREST node within the radius (distance < radius, strictly - like the old `dist(...) < 18`), or null.
 *       nodes   [{ id, x, y }, ...] in the coordinates the caller hits against: where the nodes are DRAWN (a layer's offset / rotation and a net warp
 *               already applied), the same space as x, y. Ties go to the LOWER index. A node with a non-finite coordinate is skipped.
 *   hitRadius(pointerType, scale) -> the radius in sketch units
 *       fine pointer ('mouse', anything that is not touch or pen):  18
 *       'touch' and 'pen':   max(18, 22 / scale)   - 22 css px on screen, never less than the fine radius
 *       scale = css px per sketch unit (canvas.scrollWidth / width: 0.572 at 375 px, 0.933 from 592 px); a missing or non-positive scale gives 18.
 *
 * What it replaces. The loop in pressAt() takes the FIRST node in array order that is within 18 units, not the nearest one. Wherever two nodes are
 * closer together than the radius allows (square order 9 and up, hexagon order 4 and up, at size 5), clicking exactly on a node picks another one
 * (measured with the real handler: square 9 80 of 81, hexagon 4 50 of 61 nodes wrong). Where only one node is in range the two rules agree.
 */

const HIT_RADIUS_FINE = 18;      // sketch units
const HIT_TOUCH_CSS_PX = 22;     // css px on screen for touch and pen

function hitRadius(pointerType, scale) {
    if (pointerType !== 'touch' && pointerType !== 'pen') return HIT_RADIUS_FINE;
    if (typeof scale !== 'number' || !isFinite(scale) || !(scale > 0)) return HIT_RADIUS_FINE;
    return Math.max(HIT_RADIUS_FINE, HIT_TOUCH_CSS_PX / scale);
}

function pickNodeAt(nodes, x, y, radius) {
    if (!nodes || typeof nodes.length !== 'number') return null;
    if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return null;
    if (typeof radius !== 'number' || !isFinite(radius) || !(radius > 0)) return null;
    let best = null, bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n || typeof n.x !== 'number' || typeof n.y !== 'number' || !isFinite(n.x) || !isFinite(n.y)) continue;
        const d = Math.hypot(x - n.x, y - n.y);
        if (d < radius && d < bestD) { best = n; bestD = d; }   // strictly nearer: an equal distance keeps the earlier (lower) index
    }
    return best;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pickNodeAt, hitRadius, HIT_RADIUS_FINE, HIT_TOUCH_CSS_PX };
}
