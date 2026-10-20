// Guard for the <head> of the three pages: each declares ONE icon, an empty data URI, so that no page asks the server for /favicon.ico (a 404 on every load on a plain server). Source text, no browser.
//   node tools/ui/test-head.js
//   HEAD_INDEX=... HEAD_GALLERY=... HEAD_FARBE=... node tools/ui/test-head.js        (sabotage runs: a copy of a page in place of the real one)
//
// What it pins, for index.html, gallery.html and color-harmony/ui/index.html:
//   1. exactly one <link rel="icon"> in the whole file (a second one, or a "shortcut icon" / apple-touch-icon / manifest link next to it, is a decision, not an accident),
//   2. it is inside <head>,
//   3. its href is exactly "data:," - an empty icon: no request, no file, and no ?v= to keep in step (the cache-bust version is for scripts and styles).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const PAGES = [
    ['index.html', 'HEAD_INDEX', 'index.html'],
    ['gallery.html', 'HEAD_GALLERY', 'gallery.html'],
    ['color-harmony/ui/index.html', 'HEAD_FARBE', 'color-harmony/ui/index.html'],
].map(([name, env, rel]) => ({ name, text: fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8') }));

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

for (const p of PAGES) {
    const icons = p.text.match(/<link\b[^>]*\brel\s*=\s*["'][^"']*\bicon\b[^"']*["'][^>]*>/gi) || [];
    const other = p.text.match(/<link\b[^>]*\brel\s*=\s*["'](?:manifest|mask-icon)["'][^>]*>/gi) || [];
    check(p.name + ': exactly one <link rel="icon"> (rel is exactly "icon"; no shortcut icon, apple-touch-icon, manifest or mask-icon next to it)', icons.length === 1 && /\brel\s*=\s*"icon"/i.test(icons[0]) && other.length === 0, icons.length + ' icon link(s), ' + other.length + ' other');
    const head = (p.text.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1];
    check(p.name + ': the icon link is inside <head>', icons.length === 1 && head.includes(icons[0]));
    const href = icons.length === 1 ? (icons[0].match(/\bhref\s*=\s*"([^"]*)"/i) || [, null])[1] : null;
    check(p.name + ': its href is exactly "data:," (empty icon: no request, no ?v=)', href === 'data:,', String(href));
}
check('the three pages declare the same icon line', new Set(PAGES.map(p => ((p.text.match(/<link\b[^>]*\brel="icon"[^>]*>/i) || [''])[0]))).size === 1);

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
