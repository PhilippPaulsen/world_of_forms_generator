// Task 103: the 6 sabotages of core/faces.js (text patches of COPIES in the OS temp dir); each must turn tools/morph/test-face-shadow.js red (exit != 0).
//   node tools/morph/sabotage-face-shadow.js
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8');
const CALL = '    if (faceRepairCollinear) _dropShadowed(deduped);\n';
const BOTH = 'if (near(a.x1, a.y1, segs[j]) && near(a.x2, a.y2, segs[j])) { drop[i] = true; any = true; break; }';
const BBOX = /            if \(a\.x1 < x0\[j\][^\n]*\n/;
function rep(s, from, to) { const ok = typeof from === 'string' ? s.includes(from) : from.test(s); if (!ok) throw new Error('patch anchor missing: ' + from); return s.replace(from, to); }
const S = [
  ['1. rule off', (s) => rep(s, CALL, '    if (false) _dropShadowed(deduped);\n')],
  ['2. only one end instead of both', (s) => rep(s, BOTH, BOTH.replace('&&', '||'))],
  ['3. both ends, but on different lines allowed', (s) => { s = rep(s, BBOX, ''); s = rep(s, '        const a = segs[i];\n', '        const a = segs[i]; let e1 = false, e2 = false;\n'); s = rep(s, BOTH, 'if (near(a.x1, a.y1, segs[j])) e1 = true; if (near(a.x2, a.y2, segs[j])) e2 = true; if (e1 && e2) { drop[i] = true; any = true; break; }'); return s; }],
  ['4. eps x 10', (s) => { const a = s.indexOf('function _dropShadowed'), b = s.indexOf('// task 103 }', a); return s.slice(0, a) + s.slice(a, b).split('FACE_EPSILON').join('(FACE_EPSILON * 10)') + s.slice(b); }],
  ['5. rule active with the switch off', (s) => rep(s, CALL, '    _dropShadowed(deduped);\n')],
  ['6. dropped segments also removed from the caller\'s (drawn) list', (s) => rep(s, CALL, '    if (faceRepairCollinear) { _dropShadowed(deduped); _dropShadowed(segments); }\n')],
];
let bad = 0;
S.forEach(([name, f], i) => {
  let txt; try { txt = f(SRC); } catch (e) { console.log('PATCH ERROR', name, e.message); bad++; return; }
  const file = path.join(os.tmpdir(), `faces103-sab${i + 1}-${process.pid}.js`); fs.writeFileSync(file, txt);
  const r = spawnSync('node', [path.join(__dirname, 'test-face-shadow.js')], { env: Object.assign({}, process.env, { FACES_JS: file }), encoding: 'utf8' });
  fs.unlinkSync(file);
  const red = r.status !== 0, fails = (r.stdout.match(/^FAIL .*/gm) || []).map((l) => l.slice(0, 60));
  console.log(`${red ? 'RED  ' : 'GREEN'} sabotage ${name}: ${r.stdout.trim().split('\n').pop()}${fails.length ? ' | ' + fails.map((x) => x.split(' ')[1]).join(' ') : ''}`);
  if (!red) bad++;
});
console.log(bad ? `${bad} sabotage(s) NOT detected` : 'all 6 sabotages red');
process.exit(bad ? 1 : 0);
