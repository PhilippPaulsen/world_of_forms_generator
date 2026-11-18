// Task 095: reference values of the working tree's core/faces.js, taken BEFORE the change and compared AFTER it.
//   node tools/morph/measure-face-baseline.js corpus <out.json>        the 258 patterns of tools/color/corpus.js: per pattern a hash of the whole face result (node ids and coordinates, faces, colours), the face count and the trail keys
//   node tools/morph/measure-face-baseline.js corpus-cmp <ref.json>    same run, compared with a reference: number of identical patterns (face hash / count / keys)
//   node tools/morph/measure-face-baseline.js time <out.json>          frame time of the morph with faces (6 sheets x without net / Field), min of 3 draws per frame, sum over 21 frames
'use strict';
const fs = require('fs'), crypto = require('crypto');
const C = require('../color/corpus.js');
const A = require('./measure-face-artifacts.js');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
function corpus() {
    const pats = C.buildPatterns();
    return pats.map((p) => {
        const res = p.sh.faces(p.ids);
        return { id: p.sh.label + ':' + p.ids.join(','), n: res.faces.length, h: sha(JSON.stringify(res)), keys: p.sh.sb.computeFaceTrails(res, p.sh.group).map((t) => t.key).sort().join('|') };
    });
}
function timing() {
    const out = {};
    for (const ci of [4, 9, 15, 20, 26, 31]) for (const net of ['none', 'field']) {
        const cfg = A.CONFIGS[ci], { seed } = A.acceptedSeed(cfg, net, 1, 'morph');
        const w = A.build(cfg, net, seed, 'morph', 'base');
        for (let i = 0; i < 3; i++) A.frameAt(w, 0.5);   // warm up (corner colour fields are built on the first frame)
        let sum = 0;
        for (let i = 0; i <= 20; i++) { let best = Infinity; for (let r = 0; r < 3; r++) { const t0 = process.hrtime.bigint(); A.frameAt(w, i / 20); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6); } sum += best; }
        out[`${cfg.shape}/${cfg.sym}/s${cfg.size}/${net}`] = +sum.toFixed(1);
    }
    out.total = +Object.values(out).reduce((a, b) => a + b, 0).toFixed(1);
    return out;
}
const [cmd, file] = process.argv.slice(2);
if (cmd === 'corpus') { const c = corpus(); fs.writeFileSync(file, JSON.stringify(c)); console.log('patterns', c.length); }
else if (cmd === 'corpus-cmp') {
    const ref = JSON.parse(fs.readFileSync(file, 'utf8')), now = corpus();
    const same = (f) => now.filter((x, i) => ref[i] && ref[i].id === x.id && ref[i][f] === x[f]).length;
    console.log(`patterns ${now.length}/${ref.length}; face result identical ${same('h')}; face count identical ${same('n')}; trail keys identical ${same('keys')}`);
    process.exit(same('h') === ref.length && now.length === ref.length && same('n') === ref.length && same('keys') === ref.length ? 0 : 1);
}
else if (cmd === 'time') { const t = timing(); fs.writeFileSync(file, JSON.stringify(t)); console.log(JSON.stringify(t)); }
else { console.error('usage: corpus|corpus-cmp|time file'); process.exit(2); }
