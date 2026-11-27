/**
 * tools/presets/test-clip-svg.js (task 170): tools/presets/clip-svg.js on synthetic SVG texts shaped like the Studio export (line-per-element, absolute M/L paths, polygons).
 *   node tools/presets/test-clip-svg.js
 */
const { clipSvg, MARGIN } = require('./clip-svg.js');
let checks = 0, failures = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">\n  <title>4q1/4* 64g+66d</title>\n  <rect x="0" y="0" width="600" height="600" fill="#ffffff" />\n${body}\n</svg>\n`;
const P = d => `    <path d="${d}" />`, G = pts => `    <polygon points="${pts}" fill="#000000" />`;
const has = (svg, s) => svg.includes(s);

const raw = wrap([
    P('M 10.00 10.00 L 300.00 300.00'),            // inside
    P('M -800.00 -600.00 L -600.00 -600.00'),      // far outside (top left)
    P('M 700 100 L 900 100'),                      // outside right
    P('M -200 300 L 800 300'),                     // crosses the whole sheet: kept
    P('M 600.5 100 L 650 100'),                    // starts within the margin: kept
    P('M -0.5 -0.5 L -3 -3'),                      // touches the margin box: kept
    P('M -5 -5 L -3 -4'),                          // beyond the margin: dropped
    G('0.00,169.27 84.63,169.27 67.71,135.41'),    // inside
    G('-100,-100 -50,-100 -75,-50'),               // outside
    G('-100,-100 700,-100 300,700'),               // bigger than the sheet, crosses it: kept
    P('M 0 0 A 10 10 0 0 1 20 20'),                // an arc: not understood, kept (even if it were outside)
    P('M -900 -900 A 10 10 0 0 1 -880 -880'),      // an arc outside: still kept
    P('M 10 10 H 50'),                             // H: kept
    '    <g stroke="#000000" stroke-width="2" fill="none">',
    '    </g>',
].join('\n'));
const r = clipSvg(raw);
check('the title (the internal short name) is removed', !has(r.svg, '<title>') && !has(r.svg, '4q1/4*'));
check('the root element, size, viewBox and the white sheet rectangle are kept', has(r.svg, 'viewBox="0 0 600 600"') && has(r.svg, '<rect x="0" y="0" width="600" height="600"'));
check('a path inside is kept', has(r.svg, 'M 10.00 10.00 L 300.00 300.00'));
check('a path far outside (top left, right) is dropped', !has(r.svg, 'M -800.00 -600.00') && !has(r.svg, 'M 700 100'));
check('a path crossing the whole sheet is kept (its bounding box overlaps)', has(r.svg, 'M -200 300 L 800 300'));
check(`the margin of ${MARGIN} unit: a path within it is kept, a path beyond it is dropped`, has(r.svg, 'M 600.5 100') && has(r.svg, 'M -0.5 -0.5') && !has(r.svg, 'M -5 -5 L -3 -4'));
check('a polygon inside is kept, one outside is dropped, one bigger than the sheet is kept', has(r.svg, '0.00,169.27') && !has(r.svg, '-75,-50') && has(r.svg, '-100,-100 700,-100'));
check('paths with commands the tool does not read (A, H) are kept, even outside', has(r.svg, 'A 10 10 0 0 1 20 20') && has(r.svg, 'M -900 -900 A') && has(r.svg, 'M 10 10 H 50'));
check('other lines (group tags) are untouched', (r.svg.match(/<g /g) || []).length === 1 && (r.svg.match(/<\/g>/g) || []).length === 1);
check('the counts are right: dropped 4 (3 outside paths... see list), kept the rest', r.dropped === 4 && r.kept === 9, `dropped ${r.dropped}, kept ${r.kept}`);
check('idempotent: clipping the result changes nothing', clipSvg(r.svg).svg === r.svg && clipSvg(r.svg).dropped === 0);
check('deterministic and smaller than the input', clipSvg(raw).svg === r.svg && r.bytesAfter < r.bytesBefore);
check('the text stays well formed: tags balance', (r.svg.match(/<svg\b/g) || []).length === 1 && (r.svg.match(/<\/svg>/g) || []).length === 1);
check('windows line ends are normalised', !/\r/.test(clipSvg(raw.replace(/\n/g, '\r\n')).svg));
const throws = f => { try { f(); return false; } catch (e) { return true; } };
check('input that is not an SVG, or has no viewBox, throws', throws(() => clipSvg('hello')) && throws(() => clipSvg('<svg width="5"></svg>')) && throws(() => clipSvg('<svg viewBox="0 0 0 5"></svg>')));
const off = clipSvg(`<svg viewBox="100 100 200 200">\n<path d="M 0 0 L 50 50" />\n<path d="M 150 150 L 160 160" />\n</svg>`);
check('a sheet that does not start at 0 is read from the viewBox', !has(off.svg, 'M 0 0') && has(off.svg, 'M 150 150'));
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
