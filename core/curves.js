/**
 * core/curves.js
 * Curve substitution for straight theme lines. Part of the portable
 * "core" module set (see CLAUDE.md). Today implements only Ostwald's
 * simplest (1-fold) case via a single curveAmount parameter; this is
 * where roadmap 1.4 (systematic 1-/2-/3-fold curvature, compound
 * lines - 18 base cases) and 1.5 (free "clothing" of lines) will grow
 * substantially, which is why it already gets its own file rather than
 * staying folded into the symmetry or export modules.
 *
 * Dual-mode: draws to the canvas normally, or - when state.js's
 * svgPathCollector is set to an array - appends SVG path data instead
 * of drawing, so exportSVG() can reuse the exact same geometry/symmetry
 * code path as the on-screen render (see core/export.js).
 */

// ----------------- CURVE RENDERING ---------------------
function drawCurvedBezier(p1, p2, cAmt) {
    const scaleF = 0.01; const sign = (cAmt >= 0) ? 1 : -1; const mag = abs(cAmt) * scaleF;
    if (mag < 0.0001) {
        if (svgPathCollector) {
            svgPathCollector.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
            return;
        }
        line(p1.x, p1.y, p2.x, p2.y);
        return;
    }
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x, dy = p2.y - p1.y; const distLine = sqrt(dx * dx + dy * dy);
    let nx = -dy, ny = dx; const ln = sqrt(nx * nx + ny * ny); if (ln < 0.0001) return; nx /= ln; ny /= ln;
    const offset = distLine * mag * sign; const cx = mx + nx * offset, cy = my + ny * offset;
    if (svgPathCollector) {
        // p5's bezier(p1, cx,cy, cx,cy, p2) is a cubic bezier with both
        // control points identical - mathematically equivalent to a
        // quadratic bezier with control point (cx,cy), i.e. SVG's Q command.
        svgPathCollector.push(`M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
        return;
    }
    // Die Linien sollen immer ungefüllt sein, aber noFill() nicht global setzen!
    // Wir setzen fill/stroke im draw() global, daher hier keine Änderung.
    bezier(p1.x, p1.y, cx, cy, cx, cy, p2.x, p2.y);
}
