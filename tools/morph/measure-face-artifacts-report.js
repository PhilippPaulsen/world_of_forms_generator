// Task 094: aggregation and images for tools/morph/measure-face-artifacts.js  (sum | image | one)
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..', '..');

function load(files) {
    const all = [];
    for (const f of files) { const j = JSON.parse(fs.readFileSync(f, 'utf8')); for (const r of j.results) all.push(Object.assign({ variant: j.variant }, r)); }
    return all;
}
const KEYS = ['frames', 'seqs', 'errors', 'gapFrames', 'gapPx2Max', 'overFrames', 'overPx2Max', 'areaFrames', 'smallFrames', 'smallPolys', 'dupFrames', 'dupPolys', 'selfFrames', 'selfPolys', 'nanPolys', 'jitFrames', 'jitCountFrames', 'eps005Frames', 'eps2Frames', 'blips', 'changes', 'appear', 'colJump', 'colSpike', 'stepJump', 'd2big', 'matched'];
function agg(rs) {
    const o = {}; KEYS.forEach((k) => { o[k] = 0; });
    for (const r of rs) {
        if (!r.ok) { o.errors++; continue; }
        o.seqs++;
        for (const f of r.frames) {
            o.frames++;
            if (r.mode === 'morph') { if (f.gapPx2 > 0) { o.gapFrames++; o.gapPx2Max = Math.max(o.gapPx2Max, f.gapPx2); } if (f.overPx2 > 0) { o.overFrames++; o.overPx2Max = Math.max(o.overPx2Max, f.overPx2); } if (Math.abs(f.areaDelta) > 1e-3) o.areaFrames++; }
            else if (f.overPx2 > 0) { o.overFrames++; o.overPx2Max = Math.max(o.overPx2Max, f.overPx2); }
            if (f.small) { o.smallFrames++; o.smallPolys += f.small; }
            if (f.dup) { o.dupFrames++; o.dupPolys += f.dup; }
            if (f.selfX) { o.selfFrames++; o.selfPolys += f.selfX; }
            o.nanPolys += f.nonFinite;
            o.jitFrames += f.jit; o.jitCountFrames += f.jitCount; o.eps005Frames += f.eps005 || 0; o.eps2Frames += f.eps2 || 0;
        }
        const s = r.seq; o.blips += s.blips; o.changes += s.changes; o.appear += s.appear; o.colJump += s.colJump; o.colSpike += s.colSpike; o.stepJump += s.stepJump; o.d2big += s.d2big; o.matched += s.matchedTot;
    }
    return o;
}
const key = (r) => [r.ci, r.net, r.mode, r.seed].join('/');
function groups(all) {
    const g = {};
    const add = (name, r) => { (g[name] = g[name] || []).push(r); };
    for (const r of all) {
        const cfg = r.cfg; add('ALL', r);
        add(`${r.mode}:${r.mode === 'anim' ? 'none' : r.net}`, r);
        add(`${r.mode}:${r.mode === 'anim' ? 'none' : r.net}:${cfg.shape}`, r);
        if (r.mode === 'morph') add(`sym:${cfg.sym}:${cfg.order}:${cfg.size}`, r);
    }
    return g;
}
function table(g, names, cols) {
    const rows = [['group'].concat(cols)];
    for (const n of names) { const a = agg(g[n] || []); rows.push([n].concat(cols.map((c) => a[c]))); }
    const w = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
    return rows.map((r) => r.map((c, i) => String(c).padEnd(w[i])).join('  ')).join('\n');
}
function sum(files) {
    const all = load(files); const g = groups(all);
    const names = Object.keys(g).filter((n) => !n.startsWith('sym:')).sort();
    console.log('variant', [...new Set(all.map((r) => r.variant))].join(','), 'sequences', all.length);
    console.log(table(g, names, ['seqs', 'errors', 'frames', 'gapFrames', 'gapPx2Max', 'overFrames', 'overPx2Max', 'areaFrames']));
    console.log(table(g, names, ['smallFrames', 'smallPolys', 'dupFrames', 'dupPolys', 'selfFrames', 'selfPolys', 'nanPolys']));
    console.log(table(g, names, ['jitFrames', 'jitCountFrames', 'eps005Frames', 'eps2Frames']));
    console.log(table(g, names, ['changes', 'blips', 'appear', 'matched', 'stepJump', 'd2big', 'colJump', 'colSpike']));
    const errs = all.filter((r) => !r.ok); if (errs.length) console.log('ERRORS', errs.slice(0, 5).map((r) => key(r) + ' ' + r.error).join('\n'));
}
function cmp(fa, fb) {   // before / after on identical jobs
    const A = load(fa), B = load(fb), mb = new Map(B.map((r) => [key(r), r]));
    const pairs = A.filter((r) => mb.has(key(r)) && r.ok && mb.get(key(r)).ok).map((r) => [r, mb.get(key(r))]);
    const ga = groups(pairs.map((p) => p[0])), gb = groups(pairs.map((p) => p[1]));
    const names = Object.keys(ga).filter((n) => !n.startsWith('sym:')).sort();
    for (const cols of [['frames', 'gapFrames', 'overFrames', 'areaFrames', 'smallPolys', 'dupPolys', 'selfPolys'], ['jitFrames', 'jitCountFrames', 'eps005Frames', 'eps2Frames'], ['changes', 'blips', 'appear', 'colSpike', 'd2big']]) {
        console.log('cols', cols.join(' '));
        for (const n of names) { const a = agg(ga[n]), b = agg(gb[n]); console.log(n.padEnd(22), cols.map((c) => `${c}:${a[c]}→${b[c]}`).join('  ')); }
    }
}
// ---- PNG
function crc32(buf) { let c, crc = -1; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ -1) >>> 0; }
function png(w, h, rgb) {
    const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
    const chunk = (t, d) => { const b = Buffer.alloc(8 + d.length + 4); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function drawFrame(R, cfgIndex, net, seed, mode, tIndex, variant, outFile, extra) {
    const w = R.build(R.CONFIGS[cfgIndex], net, seed, mode, variant);
    const polys = R.frameAt(w, tIndex / (R.NT - 1));
    const a = R.analyseFrame(polys, w.dims);
    const Wd = 600, img = Buffer.alloc(Wd * Wd * 3, 255);
    const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [200, 200, 200]; const v = parseInt(m[1], 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    const mark = (px, py, c) => { if (px < 0 || py < 0 || px >= Wd || py >= Wd) return; const o = (py * Wd + px) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; };
    // fill: scanline per polygon at pixel centres (later polygons overwrite: an overlap shows as blue below)
    const cover = new Uint8Array(Wd * Wd);
    for (const q of polys) {
        const p = q.p; if (p.length < 3) continue; const col = hexRgb(q.f);
        let y0 = Infinity, y1 = -Infinity; for (const v of p) { y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]); }
        for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(Wd - 1, Math.floor(y1 - 0.5)); y++) {
            const yc = y + 0.5, xs = []; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; if ((u[1] <= yc) !== (v[1] <= yc)) xs.push(u[0] + (yc - u[1]) / (v[1] - u[1]) * (v[0] - u[0])); }
            xs.sort((m, n) => m - n);
            for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(Wd - 1, Math.floor(xs[k + 1] - 0.5)); x++) { mark(x, y, col); if (cover[y * Wd + x] < 255) cover[y * Wd + x]++; }
        }
    }
    if (!(extra && extra.plain)) for (let i = 0; i < cover.length; i++) { const x = i % Wd, y = (i / Wd) | 0; if (mode === 'morph' && cover[i] === 0) mark(x, y, [255, 0, 0]); else if (cover[i] > 1) mark(x, y, [0, 80, 255]); }
    // outlines of the invalid polygons in magenta
    for (const q of a.P) { if (!q.bad && !(q.area < 0.25)) continue; const pts = q.p; for (const v of pts) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) mark(Math.round(v[0]) + dx, Math.round(v[1]) + dy, [255, 0, 255]); }
    fs.writeFileSync(outFile, png(Wd, Wd, img));
    return a;
}
function worst(all) {   // frames ranked by class
    const list = [];
    for (const r of all) { if (!r.ok) continue; for (const f of r.frames) list.push({ r, f }); }
    const best = (score) => list.map((x) => ({ x, s: score(x) })).filter((y) => y.s > 0).sort((a, b) => b.s - a.s)[0];
    return {
        gap: best(({ r, f }) => r.mode === 'morph' ? f.gapPx2 : 0), over: best(({ f }) => f.overPx2), dup: best(({ f }) => f.dup), small: best(({ f }) => f.small), self: best(({ f }) => f.selfX),
        jit: best(({ f }) => f.jitCount ? 1 : f.jit ? 0.5 : 0), eps: best(({ f }) => Math.abs((f.n2 || f.n) - f.n) + Math.abs((f.n005 || f.n) - f.n)),
    };
}
function main(cmd, args) {
    const R = require('./measure-face-artifacts.js');
    if (cmd === 'sum') return sum(args);
    if (cmd === 'cmp') return cmp([args[0]].flat().length ? args[0].split(',') : [], args[1].split(','));
    if (cmd === 'image') {
        const all = load(args[0].split(',')); const out = args[1] || path.join(ROOT, 'reports', 'logs'); const wst = worst(all);
        for (const [k, v] of Object.entries(wst)) { if (!v) { console.log(k, 'none'); continue; } const { r, f } = v.x; const file = path.join(out, `094-worst-${k}.png`); drawFrame(R, r.ci, r.net, r.seed, r.mode, f.i, r.variant, file); console.log(k, key(r), 't#' + f.i, JSON.stringify(f), file); }
        return;
    }
    if (cmd === 'one') { const [ci, net, seed, ti, variant, out, mode] = args; const a = drawFrame(R, +ci, net, +seed, mode || 'morph', +ti, variant || 'base', out || 'one.png'); console.log(JSON.stringify({ n: a.n, gap: a.gapPx2, over: a.overPx2, small: a.small, dup: a.dup, selfX: a.selfX })); return; }
    console.error('usage: sum | cmp A.json,.. B.json,.. | image files outdir | one ci net seed tIndex variant out mode');
}
module.exports = { main, load, agg, groups, drawFrame, key };
