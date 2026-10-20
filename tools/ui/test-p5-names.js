// Guard for the one real safety net of p5's friendly-error system (FES): a variable or function in setup() or draw() of sketch.js named like a p5 member or constant ("you have used a
// p5.js reserved function "dot""), and a top-level script name that overwrites a p5 global function or constant. Source text only; no browser, no network.
//   node tools/ui/test-p5-names.js
//   SKETCH_JS=... INDEX_HTML=... P5_NAMES_JSON=... P5_NAMES_READER=<a copy of p5-names-reader.js> P5_EXTRA_SCRIPT=<a js file scanned as one more classic script> P5_NAMES_STRICT=1 node tools/ui/test-p5-names.js        (sabotage runs, strict mode)
//
// Why a separate file and not an extension of tools/session/test-session-wiring.js: that test pins the SESSION wiring of sketch.js (script order, restore call, writer); this one needs a data
// file, a mirror of p5's reader, a tokenizer for every script of the page and a version pin: a different concern with its own inputs. The wiring test keeps its own pin (no block comment
// in setup() and draw(): p5's comment stripper loops forever on one); this test covers the other half of the reader.
//
// WHAT p5@1.9.0 DOES (read from lib/p5.js, `fesCodeReader`; the mirror and each quirk are in tools/ui/p5-names-reader.js and are replayed here against 71 cases recorded from the REAL reader):
//   it runs at every page load, only with the non-minified p5.js (p5.min.js has no FES: `IS_MINIFIED`; p5.disableFriendlyErrors does NOT stop it, measured). It scans
//   1. top-level names (globalConstFuncCheck): every key of `constants` (128) and of Object.keys(Renderer / Renderer2D / RendererGL .prototype) (40, "globalFunctions": text, rect, line, ellipse,
//      image, vertex, normal, curve, ... and underscore internals); a global of the page with such a name (a function, var, let or const of a classic script) that is not p5's own value warns, and
//      the scan of setup() and draw() below is then SKIPPED (one hit silences the second check). This test approximates it statically (item 4).
//   2. the source text of setup() and draw() ONLY ('' + setup + '\n' + draw). Lines are trimmed; a line is looked at only when it contains NO '//' anywhere (the whole line is dropped,
//      `const dot = 1; // note` included), contains the substring 'let' or 'const' (anywhere: "delta" does not, "letter" does) and, for the variable list, no '=>' and no 'function'.
//      Names come from `^(let|const|var)? NAME = value (, NAME = value)*`: only the LAST TWO names of a one-line list; `let dot;`, `const {dot} = x`, `if (a) { const dot = 1; }`,
//      `for (let dot = 0;;)` and a `var` line without let/const are NOT seen; `dot = 5 + letter;` (a plain assignment) IS. Function lines (with '=>' or 'function') give the first `let|const NAME`.
//      A name warns when constants[name] !== undefined (128 constants and the 12 names of Object.prototype, because `constants` is a plain object) or, unless it is in `ignoreFunction`
//      (setup draw preload deviceMoved deviceTurned deviceShaken doubleClicked mousePressed mouseReleased mouseMoved mouseDragged mouseClicked mouseWheel touchStarted touchMoved touchEnded
//      keyPressed keyReleased keyTyped windowResized name parent toString print stop onended), when it is a member of one of the 29 p5 constructors (422 member names). Only the FIRST hit per
//      list is reported; `width` and `height` THROW an uncaught TypeError instead (a getter on FramebufferTexture.prototype) and end the run.
//   3. the 534 names the real reader reacts to = 128 constants + 12 Object.prototype names + 392 non-ignored members + width + height (class and default cannot be declared).
//   The guard reports EVERY such name in setup() and draw() with its function and sketch.js line, where p5 reports one.
//
// THE FROZEN LIST: tools/ui/p5-names-1.9.0.json (constants 128, Object.prototype names 12, members 422, ignoreFunction 26, globalFunctions 40, constructors 29, reacting names 534, corpus 71).
// It is derived from the built library with this snippet (a Chromium page that loads ONLY https://cdn.jsdelivr.net/npm/p5@<version>/lib/p5.js, no sketch; paste into the console and replace
// the JSON file with the printed object; keep readerCorpus: re-record it with p5._fesCodeReader() as described in p5-names-reader.js). RE-RUN IT AND REPLACE THE FILE WHENEVER THE PINNED p5
// VERSION CHANGES: the version pin is in index.html (the p5 <script> tag) and this test fails with a message when it is not the version of the file.
//   const ctors = Object.keys(p5).filter(k => typeof p5[k] === 'function' && k[0] !== k[0].toLowerCase());            // the reader's constructor list
//   const members = new Set(), orig = p5._friendlyError, logs = []; p5._friendlyError = m => logs.push(m);
//   for (const c of ctors) { const P = p5[c].prototype; for (let o = P; o; o = Object.getPrototypeOf(o)) for (const n of Object.getOwnPropertyNames(o)) { try { if (P[n] !== undefined) members.add(n); } catch (e) { members.add(n); } } }
//   const src = await (await fetch('https://cdn.jsdelivr.net/npm/p5@' + p5.VERSION + '/lib/p5.js')).text();               // the constants module lists `exports.NAME =`
//   const k0 = src.indexOf('exports.WEBGL2 = exports.WEBGL'), consts = [...new Set([...src.slice(k0 - 3000, k0 + 9000).matchAll(/exports\.([A-Za-z_]\w*)\s*=/g)].map(m => m[1]))];
//   window.draw = eval('(function draw() {\n})'); const react = {const: [], func: [], threw: []};
//   for (const n of new Set([...members, ...consts])) { if (!/^[A-Za-z_$][\w$]*$/.test(n) || n === 'class' || n === 'default') continue; logs.length = 0;
//     try { window.setup = eval('(function setup() {\n  const ' + n + ' = 1;\n})'); p5._fesCodeReader(); } catch (e) { react.threw.push(n); continue; }
//     if (logs.length) (/reserved variable/.test(logs[0]) ? react.const : react.func).push(n); }                         // ground truth: what the real reader reacts to
//   const globalFunctions = [...new Set(['Renderer', 'Renderer2D', 'RendererGL'].flatMap(c => Object.keys(p5[c].prototype)))];
//   // constants = react.const without the 12 Object.prototype names; members as collected (it holds names that cannot be declared); throwOnAccess = react.threw; ignoreFunction: copy the
//   // `ignoreFunction` array from the reader's source (search lib/p5.js for "var ignoreFunction"). Check: constants + 12 + (members - ignore) + throwOnAccess = reactingCount.
//
// DOCUMENTED QUIRKS, each pinned below (corpus replay and named checks): a name hidden behind a `//` on its line is NOT seen by the reader (no warning at runtime) but it still shadows the p5 member
// for every later line of the function. The guard has an optional STRICTER mode for those cases and for the other things the reader does not see (a later declarator of a list, `let dot;`,
// destructuring, a `var` line): by default they are printed as NOTE lines and do not fail; P5_NAMES_STRICT=1 makes them fail. (The maintainer decides; see the commit message.)
const fs = require('fs');
const path = require('path');
const { makeReader } = require(process.env.P5_NAMES_READER || './p5-names-reader.js');
const ROOT = path.join(__dirname, '..', '..');
const read = (env, rel) => fs.readFileSync(process.env[env] || path.join(ROOT, rel), 'utf8');
const SKETCH = read('SKETCH_JS', 'sketch.js'), HTML = read('INDEX_HTML', 'index.html');
const DATA = JSON.parse(fs.readFileSync(process.env.P5_NAMES_JSON || path.join(__dirname, 'p5-names-1.9.0.json'), 'utf8'));
const STRICT = process.env.P5_NAMES_STRICT === '1';

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined && detail !== '' ? '  [' + detail + ']' : ''}`); };
const T = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'threw: ' + String(e && e.stack || e).slice(0, 300)); } };
const R = makeReader(DATA);

// ================= 1. the version pin and the data file =================
console.log('== the pinned p5 version and the frozen list ==');
const tag = (HTML.match(/<script src="(https:\/\/cdn\.jsdelivr\.net\/npm\/p5@([\d.]+)\/lib\/(p5(?:\.min)?\.js))"><\/script>/) || []);
T('version pin', () => {
    check('index.html loads p5 from the CDN with an exact version (p5@x.y.z/lib/p5.js or p5.min.js)', !!tag[1], tag[1] || 'no p5 <script> tag found');
    check('the frozen list is for the version index.html loads: p5@' + tag[2] + ' vs the file\'s ' + DATA.p5Version + (tag[2] === DATA.p5Version ? '' : ' - p5 was swapped without regenerating tools/ui/p5-names-' + DATA.p5Version + '.json: run the snippet in the header of this test on the new build and replace the file'), tag[2] === DATA.p5Version);
    console.log('NOTE  index.html loads ' + tag[3] + (tag[3] === 'p5.js' ? ': the friendly-error reader runs at every load, this guard mirrors it' : ': NO friendly-error reader runs (p5.min.js): this guard is then the only net against a name that shadows a p5 member'));
});
T('data', () => {
    const sizes = { constructors: 29, constants: 128, objectPrototypeNames: 12, members: 422, ignoreFunction: 26, globalFunctions: 40 };
    check('the list sizes are the ones measured on p5@1.9.0: ' + Object.entries(sizes).map(([k, v]) => k + ' ' + v).join(', '), Object.entries(sizes).every(([k, v]) => Array.isArray(DATA[k]) && DATA[k].length === v), Object.keys(sizes).map(k => k + ':' + (DATA[k] || []).length).join(' '));
    const ok = n => /^[A-Za-z_$][\w$]*$/.test(n) && n !== 'class' && n !== 'default';
    const react = new Set([...R.constKeys, ...[...R.members].filter(n => !R.ignore.has(n)), ...DATA.throwOnAccess].filter(ok));
    check('the names the guard reacts to: constants + Object.prototype names + non-ignored members + width and height = ' + DATA.reactingCount + ' (what the real reader reacted to when the list was derived)', react.size === DATA.reactingCount, String(react.size));
    check('spot checks of the list: dot, add, set, get, copy, size, value, id, html, limit, position, fill, image, width, height, PI, TWO_PI, constructor and toString react; name, parent, print, stop, setup, draw and mousePressed do not; foo does not', ['dot', 'add', 'set', 'get', 'copy', 'size', 'value', 'id', 'html', 'limit', 'position', 'fill', 'image', 'width', 'height', 'PI', 'TWO_PI', 'constructor', 'toString'].every(n => R.kindOf(n) !== null) && ['name', 'parent', 'print', 'stop', 'setup', 'draw', 'mousePressed', 'foo'].every(n => R.kindOf(n) === null));
});

// ================= 2. the mirror equals the real reader =================
console.log('\n== the mirror of the reader against 71 cases recorded from the real p5@1.9.0 reader ==');
T('corpus', () => {
    const fmt = a => a.map(x => x.kind === 'throws' ? 'throws' : x.kind + ':' + x.name).join('|');
    const bad = DATA.readerCorpus.filter(([body, real]) => fmt(R.readerWarnings('function setup() {\n  ' + body.split('\n').join('\n  ') + '\n}\nfunction draw() {\n}')) !== real.join('|')).map(c => c[0]);
    check('the mirror reports exactly what the real reader reported, for all ' + DATA.readerCorpus.length + ' recorded cases (names, kinds, first hit per list, the throw of width and height)', DATA.readerCorpus.length >= 71 && bad.length === 0, bad.join(' ## '));
    const find = body => DATA.readerCorpus.find(c => c[0] === body);
    const sees = body => (find(body) || [null, ['?']])[1].length > 0;
    check('quirk: a line with // anywhere is dropped whole: `const dot = 1; // note` and `const url = \'http://x\'; const dot = 1;` give no warning, `const dot = 1;` does', !sees('const dot = 1; // note') && !sees("const url = 'http://x'; const dot = 1;") && sees('const dot = 1;'));
    check('quirk: a name hidden by a // is still a shadowing declaration: the STRICT scan finds `dot` where the reader does not', R.strictEntries('const dot = 1; // note').some(e => e.name === 'dot' && /contains \/\//.test(e.why)) && R.allHits('const dot = 1; // note').length === 0);
    check('quirk: of a one-line list only the last two names are seen (`const dot = 1, a = 2, b = 3, c = 4;` is silent, `const a = 1, b = 2, dot = 3;` warns); the strict scan sees all of them', !sees('const dot = 1, a = 2, b = 3, c = 4;') && sees('const a = 1, b = 2, dot = 3;') && R.strictEntries('const dot = 1, a = 2, b = 3, c = 4;').some(e => e.name === 'dot'));
    check('quirk: not seen at all: `let dot;` (no =), `const {dot} = obj;`, `var dot = 1;`, `if (a) { const dot = 1; }`, `for (let dot = 0; dot < 3; dot++) {}`, `const f = () => { const dot = 1; };` (strict sees the first three)', ['let dot;', 'const {dot} = obj;', 'var dot = 1;', 'if (a) { const dot = 1; }', 'for (let dot = 0; dot < 3; dot++) {}', 'const f = () => { const dot = 1; };'].every(b => !sees(b)) && ['let dot;', 'const {dot} = obj;', 'var dot = 1;'].every(b => R.strictEntries(b).some(e => e.name === 'dot')));
    check('quirk: a plain assignment on a line that has "let" in a word IS seen (`dot = delta + letter;`), one without let/const is not (`dot = 5;`); a second statement on the line is not (`const dot = 1; const width = 2;` gives dot only)', sees('dot = delta + letter;') && !sees('dot = 5;') && J(find('const dot = 1; const width = 2;')[1]) === '["func:dot"]');
    check('quirk: width and height THROW (an uncaught TypeError at load, no warning) and end the run, also after an earlier hit in the same list', J(find('let width = 1;')[1]) === '["throws"]' && J(find('const width = 1, dot = 2;')[1]) === '["throws"]' && J(find('const dot = 1, width = 2;')[1]) === '["func:dot"]');
    check('quirk: toString and constructor are "reserved variable" (constants is a plain object: Object.prototype counts) although toString is on the ignore list; name, parent, print, stop, draw, setup and mouseMoved are silent', J(find('const toString = 1;')[1]) === '["const:toString"]' && J(find('const constructor = 1;')[1]) === '["const:constructor"]' && ['const name = 1;', 'const parent = 1;', 'const print = 1;', 'const stop = 1;', 'const draw = 1;', 'const setup = () => 1;', 'const mouseMoved = 1;'].every(b => !sees(b)));
    check('quirk: the constants win over members in a list (`const dot = 1, PI = 2;` reports PI only) and the function list is a second, independent call (`const dot = () => 1;` warns)', J(find('const dot = 1, PI = 2;')[1]) === '["const:PI"]' && J(find('const dot = () => 1;')[1]) === '["func:dot"]');
});
function J(x) { return JSON.stringify(x); }

// ================= 3. setup() and draw() of sketch.js =================
console.log('\n== setup() and draw() of sketch.js ==');
const cut = name => { const m = SKETCH.match(new RegExp('\\nfunction ' + name + '\\(\\) \\{[\\s\\S]*?\\n\\}\\n')); if (!m) return null; const start = SKETCH.slice(0, m.index + 1).split('\n').length; return { text: m[0].slice(1), start }; };
T('setup and draw', () => {
    const fns = ['setup', 'draw'].map(n => Object.assign({ name: n }, cut(n)));
    check('setup() and draw() are found in sketch.js (the same cut the wiring test makes: from `function NAME() {` to the first `}` at column 0)', fns.every(f => f.text && f.text.length > 1000), fns.map(f => f.name + ':' + (f.text ? f.text.length : 'missing')).join(' '));
    const hits = [], strict = [], stats = [];
    for (const f of fns) {
        if (!f.text) continue;
        const es = R.entries(f.text); stats.push(f.name + '(): ' + f.text.split('\n').length + ' lines, ' + es.length + ' declared names seen by the reader');
        R.allHits(f.text).forEach(h => hits.push(`${h.name} (${h.kind === 'const' ? 'p5 constant' : h.kind === 'throws' ? 'p5 member, the reader THROWS' : 'p5 member'}) in ${f.name}() at sketch.js:${f.start + h.idx}: ${h.text.slice(0, 90)}`));
        R.strictEntries(f.text).forEach(h => strict.push(`${h.name} (${h.kind}) in ${f.name}() at sketch.js:${f.start + h.idx}: ${h.why}: ${h.text.slice(0, 80)}`));
    }
    console.log('NOTE  ' + stats.join('; '));
    check('no variable or function declared in setup() or draw() has the name of a p5 member or constant (the reader\'s line filter and regular expressions, every name, not only the first)', hits.length === 0, hits.length ? '\n        ' + hits.join('\n        ') : '');
    check('the scan is alive: the reader\'s filter extracts declared names from both functions (a broken filter would pass everything)', R.entries(fns[0].text || '').length >= 100 && R.entries(fns[1].text || '').length >= 3, stats.join('; '));
    check('no block comment in setup() or draw() (p5\'s comment stripper loops forever on one; the wiring test pins it too)', fns.every(f => f.text && !f.text.includes('/*')));
    strict.forEach(s => console.log('NOTE  stricter than the reader would flag: ' + s));
    console.log('NOTE  the stricter scan (names the reader does not see) found ' + strict.length + ' case(s) in setup() and draw()' + (STRICT ? '' : ' (not failing: P5_NAMES_STRICT=1 makes them fail)'));
    if (STRICT) check('STRICT: no declared name the reader does not see (a // on the line, a later declarator, no =, destructuring, a var line) is a p5 member or constant', strict.length === 0, strict.length ? '\n        ' + strict.join('\n        ') : '');
});

// ================= 4. the top-level names of the page's classic scripts =================
console.log('\n== top-level names of the classic scripts index.html loads (a static approximation of the reader\'s global check) ==');
// a tokenizer: comments, strings, templates and regex literals skipped; each token has its line and the nesting depth of ([{ before it
function tokenize(src) {
    const toks = []; let i = 0, line = 1, depth = 0, prev = null; const n = src.length;
    const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']), KW = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else']);
    const push = (t, ln) => { toks.push({ t, line: ln, depth }); prev = t; };
    while (i < n) {
        const c = src[i];
        if (c === '\n') { line++; i++; continue; }
        if (/\s/.test(c)) { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; } i += 2; continue; }
        if (c === '"' || c === "'") { const ln = line; let j = i + 1; while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') line++; j++; } push('"str"', ln); i = j + 1; continue; }
        if (c === '`') { const ln = line; let j = i + 1, d = 0; while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '\n') line++; if (src[j] === '$' && src[j + 1] === '{') { d++; j += 2; continue; } if (src[j] === '}' && d > 0) { d--; j++; continue; } if (src[j] === '`' && d === 0) break; if (src[j] === '`') { j++; while (j < n && src[j] !== '`') { if (src[j] === '\\') j++; j++; } } j++; } push('`tpl`', ln); i = j + 1; continue; }
        if (c === '/' && (prev === null || REGEX_AFTER.has(prev) || KW.has(prev))) { let j = i + 1, cls = false; while (j < n) { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; else if (d === '\n') break; j++; } j++; while (j < n && /[a-z]/i.test(src[j])) j++; push('/re/', line); i = j; continue; }
        if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; push(src.slice(i, j), line); i = j; continue; }
        if (/[0-9]/.test(c)) { let j = i; while (j < n && /[\w.]/.test(src[j])) j++; push('0', line); i = j; continue; }
        if ('([{'.includes(c)) { push(c, line); depth++; i++; continue; }
        if (')]}'.includes(c)) { depth--; push(c, line); i++; continue; }
        push(c, line); i++;
    }
    return toks;
}
// top-level (depth 0) function, class, var, let and const names, plus `window.NAME =` / `globalThis.NAME =` / `self.NAME =` at any depth (they create globals at run time)
function topLevelNames(src) {
    const t = tokenize(src), out = [], ID = /^[A-Za-z_$][\w$]*$/;
    for (let i = 0; i < t.length; i++) {
        const k = t[i];
        if ((k.t === 'window' || k.t === 'globalThis' || k.t === 'self') && t[i + 1] && t[i + 1].t === '.' && t[i + 2] && ID.test(t[i + 2].t) && t[i + 3] && t[i + 3].t === '=' && !(t[i + 4] && t[i + 4].t === '=')) out.push({ name: t[i + 2].t, line: t[i + 2].line, how: k.t + '.' + t[i + 2].t + ' =' });
        if (k.depth !== 0) continue;
        if (k.t === 'function') { let j = i + 1; if (t[j] && t[j].t === '*') j++; if (t[j] && ID.test(t[j].t) && t[j].depth === 0) out.push({ name: t[j].t, line: t[j].line, how: 'function' }); }
        else if (k.t === 'class' && t[i + 1] && ID.test(t[i + 1].t)) out.push({ name: t[i + 1].t, line: t[i + 1].line, how: 'class' });
        else if (k.t === 'var' || k.t === 'let' || k.t === 'const') {
            let j = i + 1;
            for (;;) {
                // one declarator: an identifier, or a { } / [ ] pattern (its identifiers); then an optional initializer up to a depth-0 comma or semicolon
                if (t[j] && (t[j].t === '{' || t[j].t === '[')) { const d0 = t[j].depth; j++; while (t[j] && !(t[j].depth === d0 && (t[j].t === '}' || t[j].t === ']'))) { if (ID.test(t[j].t) && t[j - 1] && (t[j - 1].t === '{' || t[j - 1].t === ',' || t[j - 1].t === ':' || t[j - 1].t === '.')) out.push({ name: t[j].t, line: t[j].line, how: k.t + ' (destructuring)' }); j++; } j++; }
                else if (t[j] && ID.test(t[j].t)) { out.push({ name: t[j].t, line: t[j].line, how: k.t }); j++; }
                else break;
                if (t[j] && t[j].t === '=') { j++; while (t[j] && !(t[j].depth === 0 && (t[j].t === ',' || t[j].t === ';' || t[j].t === 'const' || t[j].t === 'let' || t[j].t === 'var'))) j++; }
                if (t[j] && t[j].t === ',' && t[j].depth === 0) { j++; continue; }
                break;
            }
        }
    }
    return out;
}
T('top level', () => {
    // the classic scripts of index.html: <script src> without type="module", local files only (the p5 CDN tag and the module entry are skipped)
    const tags = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(m => ({ attrs: m[1], body: m[2], src: (m[1].match(/\bsrc="([^"]+)"/) || [])[1] || null, type: (m[1].match(/\btype="([^"]+)"/) || [])[1] || 'classic' }));
    const classic = tags.filter(x => x.type === 'classic' && x.src && !/^(https?:)?\/\//.test(x.src)).map(x => x.src.replace(/\?.*$/, ''));
    const skipped = tags.filter(x => !(x.type === 'classic' && x.src && !/^(https?:)?\/\//.test(x.src))).map(x => x.type !== 'classic' ? x.type + (x.src ? ' ' + x.src.replace(/\?.*$/, '') : '') : (x.src ? 'external ' + x.src.slice(0, 50) : 'inline'));
    const inline = tags.filter(x => x.type === 'classic' && !x.src && x.body.trim()).map((x, i) => ({ name: 'index.html <script> #' + (i + 1), text: x.body }));
    const files = classic.map(f => ({ name: f, text: f === 'sketch.js' ? SKETCH : fs.readFileSync(path.join(ROOT, f), 'utf8') })).concat(inline);
    if (process.env.P5_EXTRA_SCRIPT) files.push({ name: 'EXTRA:' + path.basename(process.env.P5_EXTRA_SCRIPT), text: fs.readFileSync(process.env.P5_EXTRA_SCRIPT, 'utf8') });
    check('index.html lists classic local scripts (sketch.js, core/*.js and the ui*.js files): ' + classic.length + ' scanned; skipped: ' + skipped.join(', '), classic.length >= 25 && classic.includes('sketch.js') && classic.includes('core/state.js') && classic.includes('ui-timeline.js'), classic.length + ' scripts');
    const global = new Set(DATA.constants.concat(DATA.globalFunctions.filter(n => !DATA.ignoreFunction.includes(n))));
    let total = 0; const hits = [];
    for (const f of files) { const names = topLevelNames(f.text); total += names.length; names.filter(x => global.has(x.name)).forEach(x => hits.push(`${x.name} (${DATA.constants.includes(x.name) ? 'p5 constant' : 'p5 global function'}) at ${f.name}:${x.line} (${x.how})`)); }
    console.log('NOTE  ' + total + ' top-level names in ' + files.length + ' scripts (function, class, var, let, const, and window.NAME =), compared with ' + global.size + ' p5 names (128 constants + 40 global functions)');
    check('no top-level name of a classic script, and no window.NAME assignment, is a p5 constant or global function name (the reader\'s first check; a hit there also silences the setup() and draw() check at run time). Static: a global created some other way is not seen; ES modules are skipped', hits.length === 0, hits.length ? '\n        ' + hits.join('\n        ') : '');
    check('the top-level scan is alive: it finds known globals (setup, draw, mousePressed in sketch.js; nodes-state names in core/state.js), so an unparsed file would not pass silently', (() => { const s = topLevelNames(SKETCH).map(x => x.name); const c = topLevelNames(fs.readFileSync(path.join(ROOT, 'core/state.js'), 'utf8')).map(x => x.name); return ['setup', 'draw', 'mousePressed', 'sideOfLine', 'optionalSelect'].every(n => s.includes(n)) && c.includes('rebuildGrid') && c.includes('altNetSeed'); })());
    // the scanner and the names it must catch, on small inputs
    const names = s => topLevelNames(s).map(x => x.name).join(',');
    check('the scanner: top-level function, class, var, let and const (several declarators, a destructuring, an initializer with commas and a function body) and window.NAME are found; names inside a function, an IIFE, a block or a for are not', names('function a(){ function in1(){} } class B {} var c = 1, d = [1,2], e = {x: 1}; let f; const {g, h: i} = o; const j = function() { const k = 1; }, l = 2; (function(){ var m = 1; })(); if (x) { let n = 1; } for (let q = 0;;) {} window.W1 = 1; function* gen() {}') === 'a,B,c,d,e,f,g,i,j,l,W1,gen' || names('function a(){ function in1(){} } class B {} var c = 1, d = [1,2], e = {x: 1}; let f; const {g, h: i} = o; const j = function() { const k = 1; }, l = 2; (function(){ var m = 1; })(); if (x) { let n = 1; } for (let q = 0;;) {} window.W1 = 1; function* gen() {}') === 'a,B,c,d,e,f,g,h,i,j,l,W1,gen', names('function a(){ function in1(){} } class B {} var c = 1, d = [1,2], e = {x: 1}; let f; const {g, h: i} = o; const j = function() { const k = 1; }, l = 2; (function(){ var m = 1; })(); if (x) { let n = 1; } for (let q = 0;;) {} window.W1 = 1; function* gen() {}'));
    check('the scanner finds a p5 name at the top level: `function rect() {}`, `const PI = 3;`, `let text;`, `var line = 1, k = 2;` and `window.ellipse = 1;`; and ignores them in comments, strings and nested scopes', names('function rect() {}\nconst PI = 3;\nlet text;\nvar line = 1, k = 2;\nwindow.ellipse = 1;').split(',').filter(n => global.has(n)).join() === 'rect,PI,text,line,ellipse' && names('// function rect() {}\n/* const PI = 3; */\nconst s = "let text;";\n(function () { var line = 1; })();\nfunction f() { const PI = 1; }') === 's,f');
});

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
