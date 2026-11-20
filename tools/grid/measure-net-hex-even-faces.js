// Task 109 (measurement, uses the detector of tasks 094 / 101 / 103 as a module): the faces of the spatial MORPH under the hexagon Field at EVEN sizes against ODD sizes and against no net.
//   node tools/grid/measure-net-hex-even-faces.js [sizes=4,6,5] [seeds=1]     prints per (size, net) the sums over the 41 frames of every numeric per-frame measure (gaps, overlaps, invalid polygons, face counts ...)
// measure-face-artifacts.js build() switches the 0.3 px growth of the drawn polygons off (task 096 / 103), so the detector sees the exact faces.
const path = require('path');
const M = require(path.join(__dirname, '..', 'morph', 'measure-face-artifacts.js'));
const sizes = (process.argv[2] || '4,6,5').split(',').map(Number), seeds = +(process.argv[3] || 1);
const out = [];
for (const size of sizes) for (const net of ['field', 'none']) for (let k = 0; k < seeds; k++) {
    const cfg = { shape: 'hex', order: 3, size, sym: 'rotation_reflection6' }, t0 = Date.now();
    let r; try { r = M.runSequence(cfg, net, 3 + k, 'morph', { variant: 'base' }); } catch (e) { console.log(size, net, 'THROWS', String(e && e.message).slice(0, 120)); continue; }
    const tot = {}, mx = {}; for (const f of r.frames) for (const [key, v] of Object.entries(f)) if (typeof v === 'number') { tot[key] = (tot[key] || 0) + v; mx[key] = Math.max(mx[key] === undefined ? -Infinity : mx[key], v); }
    const row = { size, net, seed: 3 + k, status: r.status, ok: r.ok, frames: r.frames.length, sums: tot, max: mx, seq: r.seq, secs: Math.round((Date.now() - t0) / 1000) };
    out.push(row); console.log(JSON.stringify(row));
}
