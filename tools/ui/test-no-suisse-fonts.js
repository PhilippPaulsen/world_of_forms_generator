// Guard (task 130): Suisse Int'l is commercially licensed and must not be in this repository (public repos are not allowed by the licence).
// The web fonts are served from https://bachmann-paulsen.de/fonts/ and only declared in the CSS.
//   node tools/ui/test-no-suisse-fonts.js
// Fails if (1) a woff/woff2/otf/ttf with "suisse" in its name is in the working tree (outside .git, node_modules) or tracked by git or in the index,
// (2) .gitignore does not block them, (3) the CSS declares fewer than the expected faces, a face points at a local file, or a URL is not on the font host.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`); };
const FONT = /suisse.*\.(woff2?|otf|ttf)$/i;
const BASE = 'https://bachmann-paulsen.de/fonts/';

const walk = (dir, out) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out); else if (FONT.test(e.name)) out.push(path.relative(ROOT, p));
    }
    return out;
};
const inTree = walk(ROOT, []);
check('no woff/woff2/otf/ttf with "Suisse" in its name in the working tree', inTree.length === 0, inTree.join(', '));
let tracked = [];
try { tracked = cp.execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(n => FONT.test(path.basename(n))); } catch (e) { check('git ls-files runs', false, String(e.message).slice(0, 100)); }
check('none tracked by git or staged / addable (git ls-files --cached --others --exclude-standard)', tracked.length === 0, tracked.join(', '));

const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
for (const ext of ['woff', 'woff2', 'otf', 'ttf']) check(`.gitignore blocks *Suisse*.${ext}`, gi.split('\n').some(l => l.trim() === `*[Ss]uisse*.${ext}`));
// the ignore rules really act (a probe path, never created)
for (const probe of ['assets/fonts/SuisseIntl-Book.woff2', 'color-harmony/ui/assets/fonts/SuisseIntl-Bold.woff2']) {
    const r = cp.spawnSync('git', ['check-ignore', '-q', probe], { cwd: ROOT });
    check(`git check-ignore accepts ${probe}`, r.status === 0);
}

const css = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const urls = f => [...css(f).matchAll(/@font-face\s*\{[^}]*\}/g)].map(m => (m[0].match(/url\(\s*["']?([^"')]+)/) || [])[1]).filter(Boolean);
for (const [f, n] of [['style.css', 2], ['color-harmony/ui/tokens.css', 4]]) {
    const u = urls(f);
    check(`${f}: ${n} font faces, each a ${BASE}suisseintl-<cut>.woff2 URL (no local path)`, u.length === n && u.every(x => /^https:\/\/bachmann-paulsen\.de\/fonts\/suisseintl-[a-z]+\.woff2$/.test(x)), u.join(', '));
}
const all = [...new Set([...urls('style.css'), ...urls('color-harmony/ui/tokens.css')])];
check('distinct font URLs in the CSS: 4 (book, semibold, bold, bookit)', all.length === 4, all.join(', '));
for (const f of ['index.html', 'color-harmony/ui/index.html']) {
    const m = fs.readFileSync(path.join(ROOT, f), 'utf8').match(/<link rel="preload"[^>]*as="font"[^>]*>/g) || [];
    check(`${f}: the font preload points at the font host and has crossorigin`, m.length === 1 && m[0].includes(BASE + 'suisseintl-book.woff2') && /crossorigin/.test(m[0]), m.join(' '));
}
const bad = []; for (const f of ['style.css', 'color-harmony/ui/tokens.css', 'color-harmony/ui/styles.css', 'index.html', 'color-harmony/ui/index.html']) if (/assets\/fonts\//.test(css(f).replace(/<!--[\s\S]*?-->/g, ''))) bad.push(f);
check('no CSS / HTML refers to assets/fonts/ any more', bad.length === 0, bad.join(', '));

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
