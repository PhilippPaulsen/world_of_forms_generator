// Task 098/103: core/faces.js WITHOUT its marker blocks (task 095, 103) must be byte-equal to a reference (default: main). Marker blocks: lines "// task NNN {" ... "// task NNN }" inclusive (098 stays, it is already in main).
//   node tools/morph/check-faces-markers.js [ref-file]      (default: git show main:core/faces.js)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const ref = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : cp.execSync('git show main:core/faces.js', { cwd: ROOT, maxBuffer: 1 << 26 }).toString();
const cur = fs.readFileSync(path.join(ROOT, 'core', 'faces.js'), 'utf8');
function strip(t, ids) { const out = []; let skip = null; for (const l of t.split('\n')) { const o = /^\/\/ task (\d+) \{\s*$/.exec(l), c = /^\/\/ task (\d+) \}\s*$/.exec(l); if (!skip && o && ids.includes(o[1])) { skip = o[1]; continue; } if (skip && c && c[1] === skip) { skip = null; continue; } if (!skip) out.push(l); } return out.join('\n'); }
const a = strip(cur, ['095', '103']), b = strip(ref, ['095', '103']);
console.log(a === b ? 'OK: faces.js without the 095/103 blocks is byte-equal to the reference' : 'DIFF: faces.js differs outside the 095/103 blocks');
process.exit(a === b ? 0 : 1);
