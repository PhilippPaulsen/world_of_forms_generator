/**
 * tools/presets/clip-svg.js (task 170)
 * The Studio's SVG export (generateSVGString(), core/export.js) draws the whole tiling, also far outside the 600 x 600 sheet, and carries the pattern's internal short name as <title>.
 * For a start-page image both are dropped: every <path> / <polygon> that lies completely OUTSIDE the sheet (its bounding box does not touch [-MARGIN, 600 + MARGIN]) and the <title>.
 * Measured (task S1): 98 / 378 / 150 KB raw -> 16 / 44 / 20 KB; pixel difference against the Studio canvas unchanged (see tools/presets/svg-pixel-pins.json).
 *
 *   node tools/presets/clip-svg.js <raw.svg> [<out.svg>]        (without <out.svg> the result goes to stdout, the counts to stderr)
 *
 * MARGIN is 1 unit: the line width of the export is 2, so a line whose centre is further than 1 outside paints nothing inside. Anything this tool does not understand (a path with a command other than
 * M L C Z, an element without parsable numbers) is KEPT, never dropped. Pure function clipSvg(); the sheet size is read from the root's viewBox.
 */
const fs = require('fs');

const MARGIN = 1;

function sheetOf(svg) {
    const m = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(svg);
    if (!m) throw new Error('no viewBox on the root element');
    const v = m[1].trim().split(/[\s,]+/).map(Number);
    if (v.length !== 4 || v.some(x => !isFinite(x)) || v[2] <= 0 || v[3] <= 0) throw new Error('bad viewBox ' + m[1]);
    return { x0: v[0], y0: v[1], x1: v[0] + v[2], y1: v[1] + v[3] };
}

// -> true when the element is certainly outside the sheet
function outside(attr, isPath, sheet) {
    if (isPath && /[A-Za-z]/.test(attr.replace(/[MLCZ]/g, ''))) return false;   // commands we do not read: keep
    const nums = (attr.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) || []).map(Number);
    if (nums.length < 2 || nums.length % 2 !== 0) return false;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < nums.length; i += 2) { x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]); y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]); }
    return x1 < sheet.x0 - MARGIN || y1 < sheet.y0 - MARGIN || x0 > sheet.x1 + MARGIN || y0 > sheet.y1 + MARGIN;
}

// -> { svg, kept, dropped, bytesBefore, bytesAfter }
function clipSvg(raw) {
    if (typeof raw !== 'string' || !/<svg\b/.test(raw)) throw new Error('not an SVG text');
    const sheet = sheetOf(raw);
    let dropped = 0, kept = 0;
    const lines = raw.replace(/\r\n/g, '\n').replace(/\s*<title>[\s\S]*?<\/title>/, '').split('\n').filter(line => {
        const m = /<(path|polygon)\b[^>]*?\b(d|points)="([^"]*)"/.exec(line);
        if (!m) return true;
        if (outside(m[3], m[1] === 'path', sheet)) { dropped++; return false; }
        kept++; return true;
    });
    const svg = lines.join('\n');
    return { svg, kept, dropped, bytesBefore: Buffer.byteLength(raw), bytesAfter: Buffer.byteLength(svg) };
}
module.exports = { clipSvg, sheetOf, MARGIN };

if (require.main === module) {
    const [inp, out] = process.argv.slice(2);
    if (!inp) { console.error('usage: node tools/presets/clip-svg.js <raw.svg> [<out.svg>]'); process.exit(2); }
    const r = clipSvg(fs.readFileSync(inp, 'utf8'));
    console.error(`kept ${r.kept}, dropped ${r.dropped}, ${r.bytesBefore} -> ${r.bytesAfter} bytes`);
    if (out) fs.writeFileSync(out, r.svg); else process.stdout.write(r.svg);
}
