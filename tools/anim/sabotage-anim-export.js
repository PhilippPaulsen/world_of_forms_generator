// Task 115: the sabotage runs of tools/anim/test-anim-export.js (not a test itself: no test- prefix). Each run changes ONE thing in a COPY of core/anim-export.js and the test must go red.
//   node tools/anim/sabotage-anim-export.js        exit 0 only if every sabotage was caught
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), src = fs.readFileSync(path.join(ROOT, 'core', 'anim-export.js'), 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'anim115sab-'));
const SAB = [
    ['last frame not at t = 1', 'times[i] = i === n - 1 ? 1 : i / (n - 1);', 'times[i] = i / n;'],
    ['CRC polynomial wrong', '0xEDB88320 ^ (c >>> 1)', '0xEDB88321 ^ (c >>> 1)'],
    ['entry count in the end record wrong', 'v.setUint16(10, entries.length, true);\n        v.setUint32(12, cdSize', 'v.setUint16(10, entries.length + 1, true);\n        v.setUint32(12, cdSize'],
    ['limits without effect (frames and bytes)', 'const overFrames = o.frames > lim.maxFrames, overBytes = totalBytes > lim.maxBytes;', 'const overFrames = false, overBytes = false;'],
    ['compressed size in the local header = the uncompressed size', 'v.setUint32(18, data.length, true); v.setUint32(22, bytes.length, true);', 'v.setUint32(18, bytes.length, true); v.setUint32(22, bytes.length, true);'],
    ['entry limit off by one (65 536 pass)', 'if (entries.length >= animZipMaxEntries) throw', 'if (entries.length > animZipMaxEntries) throw'],
    ['4 GiB check removed', 'used > animZipMaxBytes', 'false'],
    ['the handle is ignored (the bytes go into the parts)', 'parts.push(lh, handle !== undefined ? handle : data);', 'parts.push(lh, data);'],
    ['frame names without padding', "String(i).padStart(Math.max(4, String(n).length), '0')", 'String(i)'],
];
let bad = 0;
for (const [name, from, to] of SAB) {
    if (!src.includes(from)) { console.log('ANCHOR MISSING  ' + name); bad++; continue; }
    const f = path.join(TMP, 'sab.js'); fs.writeFileSync(f, src.split(from).join(to));
    const r = spawnSync('node', [path.join(__dirname, 'test-anim-export.js')], { env: Object.assign({}, process.env, { ANIM_EXPORT_JS: f }), encoding: 'utf8' });
    const fails = (r.stdout.match(/^FAIL/gm) || []).length;
    const red = r.status !== 0;
    console.log(`${red ? 'RED (caught)' : 'GREEN (NOT caught)'}  ${name}  [${fails} failing checks]`);
    if (!red) bad++;
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(bad ? `${bad} sabotage(s) not caught` : `all ${SAB.length} sabotages caught`);
process.exit(bad ? 1 : 0);
