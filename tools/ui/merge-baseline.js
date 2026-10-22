// Merges recordings of tools/ui/record-baseline.js (recordBaseline or recordPhone: { "<width key>": { tab: ... } }) into one baseline file: tooling, not part of the test suite.
//   node tools/ui/merge-baseline.js <out.json> <a.json> [b.json ...] [--phase phone-1] [--commit <hash>] [--note "..."]
// The result has the shape compare-baseline.js reads: { phase, commit, note, modes, widths }. A key that two inputs both hold is an error.
const fs = require('fs');
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : ''; };
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && /^--(phase|commit|note)$/.test(args[i - 1])));
if (files.length < 2) { console.error('usage: node tools/ui/merge-baseline.js <out.json> <a.json> [b.json ...] [--phase P] [--commit C] [--note N]'); process.exit(2); }
const out = { phase: opt('--phase'), commit: opt('--commit'), note: opt('--note'), modes: {}, widths: {} };
for (const f of files.slice(1)) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const k of Object.keys(j)) { if (out.widths[k]) { console.error('key ' + k + ' is in two inputs'); process.exit(1); } out.widths[k] = j[k]; }
}
fs.writeFileSync(files[0], JSON.stringify(out));
console.log(files[0] + ': ' + Object.keys(out.widths).join(', ') + ' (' + fs.statSync(files[0]).size + ' bytes)');
