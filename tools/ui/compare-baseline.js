// Compares two layout baselines (tools/ui/record-baseline.js, tools/ui/measure-layout.js): tooling, not part of the test suite.
//   node tools/ui/compare-baseline.js <a.json> <b.json> [--shared] [--widths 375,1100] [--tabs form,netz] [--max 200]
// Walks widths -> tabs -> scenario -> snapshot and prints every element whose rect differs ([x, y, w, h], null = hidden or absent), every `dom_present` entry that differs, every scalar
// that differs (scrollWidth, clientWidth, docHeight, canvasTop, the found / probe / pointer facts) and the snapshots only one file has. --shared compares only the elements BOTH files track
// (for a file of an older method: baseline-rail-3.json tracks fewer elements and forced --target); without it an element only one file tracks is reported as "only in a" / "only in b".
// Exit code 0 when the files are identical under the chosen filter, 1 otherwise.
const fs = require('fs');
const args = process.argv.slice(2);
const flag = n => args.includes(n), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(widths|tabs|max)$/.test(args[i - 1])));
if (files.length !== 2) { console.error('usage: node tools/ui/compare-baseline.js <a.json> <b.json> [--shared] [--widths 375,1100] [--tabs form,netz] [--max 200]'); process.exit(2); }
const A = JSON.parse(fs.readFileSync(files[0], 'utf8')), B = JSON.parse(fs.readFileSync(files[1], 'utf8'));
const shared = flag('--shared'), onlyWidths = opt('--widths') && opt('--widths').split(','), onlyTabs = opt('--tabs') && opt('--tabs').split(','), max = +(opt('--max') || 200);
const J = JSON.stringify;
const isRect = v => v === null || (Array.isArray(v) && v.length === 4 && v.every(n => typeof n === 'number'));
const counts = { rect: 0, scalar: 0, present: 0, only: 0, snapshot: 0 };
let printed = 0;
const say = (kind, where, msg) => { counts[kind]++; if (printed++ < max) console.log(kind.padEnd(8) + where + '  ' + msg); };

// a snapshot = { selector: rect | null, scrollWidth, ..., beyondViewport: [...] }
function snapshot(where, a, b) {
  for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
    const inA = k in a, inB = k in b;
    if (!inA || !inB) { if (!shared && (k.startsWith('#') || k.startsWith('.'))) say('only', where + ' ' + k, 'only in ' + (inA ? 'a' : 'b') + ' (' + J(inA ? a[k] : b[k]) + ')'); else if (!shared && !k.startsWith('#')) say('scalar', where + ' ' + k, J(a[k]) + ' -> ' + J(b[k])); continue; }
    if (J(a[k]) === J(b[k])) continue;
    say(isRect(a[k]) && isRect(b[k]) ? 'rect' : 'scalar', where + ' ' + k, J(a[k]) + ' -> ' + J(b[k]));
  }
}
function isSnapshot(o) { return o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).some(k => k.startsWith('#')); }
function walk(where, a, b) {
  if (a === undefined || b === undefined) { say('snapshot', where, 'only in ' + (a === undefined ? 'b' : 'a')); return; }
  if (isSnapshot(a) && isSnapshot(b)) return snapshot(where, a, b);
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
    if (where.endsWith('dom_present')) { for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) { if (shared && !(k in a && k in b)) continue; if (a[k] !== b[k]) say('present', where + ' ' + k, J(a[k]) + ' -> ' + J(b[k])); } return; }
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
      if (shared && (!(k in a) || !(k in b))) continue;
      walk(where + ' ' + k, a[k], b[k]);
    }
    return;
  }
  if (J(a) !== J(b)) say('scalar', where, J(a) + ' -> ' + J(b));
}
for (const w of new Set(Object.keys(A.widths).concat(Object.keys(B.widths)))) {
  if (onlyWidths && !onlyWidths.includes(w)) continue;
  if (!A.widths[w] || !B.widths[w]) { say('snapshot', w, 'width only in ' + (A.widths[w] ? 'a' : 'b')); continue; }
  for (const t of new Set(Object.keys(A.widths[w]).concat(Object.keys(B.widths[w])))) {
    if (onlyTabs && !onlyTabs.includes(t)) continue;
    walk(w + '/' + t, A.widths[w][t], B.widths[w][t]);
  }
}
if (printed > max) console.log('... ' + (printed - max) + ' more (raise --max)');
console.log('\n' + J(counts) + (shared ? '  (--shared)' : ''));
process.exit(Object.values(counts).some(n => n) ? 1 : 0);
