// Static guard for the gallery's shim: every global that core/state.js defines and that a core/ file loaded by gallery.html reads must be defined by the page.
//   node tools/gallery/test-gallery-globals.js
//   GALLERY_ROOT=/path/to/clean/export node tools/gallery/test-gallery-globals.js      (a clean export of any commit)
//   GALLERY_HTML=... GALLERY_FILE_OVERRIDES='{"gallery-render.js":"/path/to/mutated.js"}' node ...      (sabotage runs)
//
// The gallery loads a subset of core/ (see gallery.html) and NOT core/state.js, whose top-level declarations (nodes, timeline, nodeCount, ...) the app's core files
// read as bare globals; gallery-render.js defines the ones the gallery needs (a shim). A core file that starts reading another state.js global then breaks the
// gallery's detail view without any error at load time - this is what happened from 629e7575 (2026-09-24) on. test-gallery-smoke.js catches that by running the
// render path; this test catches it by reading the source, for every path, executed or not.
//
// How it reads. Comments and string text are blanked; each core file is cut into its top-level functions; a name that a function declares itself (parameter, let,
// const, var, arrow parameter, catch variable) is that function's own and is not a global read there (core/forms.js takes nodeCount, canvasW, ... as parameters);
// a name after a dot, before a colon (object key) or after `typeof` is not a read. Granularity is the top-level function: a name shadowed somewhere in a function
// is treated as shadowed in all of it (a false negative is possible for a global read next to a same-named local in one function; the smoke test covers the paths it executes).
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ROOT = process.env.GALLERY_ROOT || REPO;
const overrides = process.env.GALLERY_FILE_OVERRIDES ? JSON.parse(process.env.GALLERY_FILE_OVERRIDES) : {};
const fileOf = rel => overrides[rel] || path.join(ROOT, rel);
const htmlPath = process.env.GALLERY_HTML || path.join(ROOT, 'gallery.html');

let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };

// blank comments and the text of strings, keep line structure and the code inside template ${...}
function blank(src) {
    let out = '', i = 0; const n = src.length; const stack = [];   // stack of template brace depths
    const keepNl = ch => (ch === '\n' ? '\n' : ' ');
    while (i < n) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out += ' '; i++; } continue; }
        if (c === '/' && d === '*') { out += '  '; i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += keepNl(src[i]); i++; } out += '  '; i += 2; continue; }
        if (c === '"' || c === "'") { const q = c; out += ' '; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') { out += '  '; i += 2; continue; } out += keepNl(src[i]); i++; } out += ' '; i++; continue; }
        if (c === '`') {
            out += ' '; i++;
            while (i < n && src[i] !== '`') {
                if (src[i] === '\\') { out += '  '; i += 2; continue; }
                if (src[i] === '$' && src[i + 1] === '{') {   // code inside: copy it until the matching brace
                    out += '  '; i += 2; let depth = 1;
                    while (i < n && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') { depth--; if (!depth) break; } out += src[i]; i++; }
                    out += ' '; i++; continue;
                }
                out += keepNl(src[i]); i++;
            }
            out += ' '; i++; continue;
        }
        out += c; i++;
    }
    return out;
}
const ID = '[A-Za-z_$][\\w$]*';
const topLevelDecls = code => {   // names declared at column 0
    const names = new Set();
    for (const m of code.matchAll(new RegExp('^(?:let|const|var)\\s+(' + ID + ')', 'gm'))) names.add(m[1]);
    for (const m of code.matchAll(new RegExp('^(?:async\\s+)?function\\s*\\*?\\s*(' + ID + ')', 'gm'))) names.add(m[1]);
    for (const m of code.matchAll(new RegExp('^class\\s+(' + ID + ')', 'gm'))) names.add(m[1]);
    return names;
};
const idsIn = text => (text.match(new RegExp(ID, 'g')) || []);

// ---- the page's script list ---------------------------------------------------------------------------------------------------------------------------
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map(m => m[1].replace(/\?.*$/, '')).filter(s => !/^(https?:)?\/\//.test(s));
const coreLoaded = scripts.filter(s => /^core\/.*\.js$/.test(s));
console.log('gallery.html loads: ' + scripts.join(', '));
check('gallery.html loads core files and the shim', coreLoaded.length >= 4 && scripts.includes('gallery-render.js'), coreLoaded.length + ' core files');
check('core/state.js is NOT loaded by the gallery (the shim stands in for it; loading it would shadow the shim\'s globals)', !scripts.includes('core/state.js'));

// ---- what state.js defines, what the page defines -----------------------------------------------------------------------------------------------------
const stateCode = blank(fs.readFileSync(path.join(ROOT, 'core/state.js'), 'utf8'));
const stateNames = topLevelDecls(stateCode);
check('core/state.js parsed: its top-level let / const / var / function names found', stateNames.size >= 20 && stateNames.has('timeline') && stateNames.has('nodes') && stateNames.has('baseNetTransform'), stateNames.size + ' names');
const definedBy = new Map();   // name -> first loaded script that declares it at top level
for (const rel of scripts) for (const nm of topLevelDecls(blank(fs.readFileSync(fileOf(rel), 'utf8')))) if (!definedBy.has(nm)) definedBy.set(nm, rel);

// ---- bare reads of state.js names in the loaded core files --------------------------------------------------------------------------------------------
function regionsOf(code) {   // [{ start line, text, declared:Set }] per top-level function, plus the rest as one region
    const lines = code.split('\n'), regions = []; let cur = null;
    lines.forEach((line, idx) => {
        const m = line.match(new RegExp('^(?:async\\s+)?function\\s*\\*?\\s*(' + ID + ')\\s*\\(([^)]*)\\)'));
        if (!cur && m) { cur = { name: m[1], start: idx, lines: [], header: m[2] }; }
        if (cur) { cur.lines.push(line); if (/^\}/.test(line) || (idx === cur.start && /\}\s*$/.test(line) && !/\{\s*$/.test(line))) { regions.push(cur); cur = null; } }
        else regions.push({ name: '<top>', start: idx, lines: [line], header: '' });
    });
    if (cur) regions.push(cur);
    return regions;
}
function declaredIn(text, header) {
    const d = new Set(idsIn(header));
    for (const m of text.matchAll(new RegExp('\\b(?:let|const|var)\\s+(' + ID + ')', 'g'))) d.add(m[1]);
    for (const m of text.matchAll(/\b(?:let|const|var)\s*[\[{]([^=;]*?)[\]}]\s*=/g)) idsIn(m[1]).forEach(x => d.add(x));
    for (const m of text.matchAll(new RegExp('\\b(?:let|const|var)\\s+' + ID + '(?:\\s*=[^;,]*)?((?:\\s*,\\s*' + ID + '(?:\\s*=[^;,]*)?)+)', 'g'))) idsIn(m[1].replace(/=[^,]*/g, '')).forEach(x => d.add(x));
    for (const m of text.matchAll(new RegExp('\\bcatch\\s*\\(\\s*(' + ID + ')', 'g'))) d.add(m[1]);
    for (const m of text.matchAll(new RegExp('(' + ID + ')\\s*=>', 'g'))) d.add(m[1]);
    for (const m of text.matchAll(/\(([^()]*)\)\s*=>/g)) idsIn(m[1]).forEach(x => d.add(x));
    for (const m of text.matchAll(new RegExp('\\bfunction\\s*' + ID + '?\\s*\\(([^)]*)\\)', 'g'))) idsIn(m[1]).forEach(x => d.add(x));
    return d;
}
const reads = new Map();   // name -> [ 'file:line (function)' ]
for (const rel of coreLoaded) {
    const code = blank(fs.readFileSync(fileOf(rel), 'utf8'));
    for (const r of regionsOf(code)) {
        const text = r.lines.join('\n'), declared = declaredIn(text, r.header);
        r.lines.forEach((line, k) => {
            for (const name of stateNames) {
                if (declared.has(name) && r.name !== '<top>') continue;
                const re = new RegExp('(?<![\\w$.])' + name.replace(/\$/g, '\\$') + '(?![\\w$])', 'g');
                let m;
                while ((m = re.exec(line))) {
                    const before = line.slice(0, m.index), after = line.slice(m.index + name.length);
                    if (/typeof\s*$/.test(before)) continue;                         // typeof x is a safe probe
                    if (/^\s*:(?!:)/.test(after) && !/\?\s*[^:?]*$/.test(before)) continue;   // an object key
                    if (/^(?:let|const|var)\s+$/.test(before.trim() ? before.trim().split(/\s+/).slice(-1)[0] + ' ' : '')) continue;   // its own declaration
                    if (r.name === '<top>' && new RegExp('^(?:let|const|var|function|class)\\s+' + name + '\\b').test(line)) continue;
                    if (!reads.has(name)) reads.set(name, []);
                    reads.get(name).push(`${rel}:${r.start + k + 1}${r.name === '<top>' ? '' : ' (' + r.name + ')'}`);
                }
            }
        });
    }
}

console.log('\n== state.js globals that a loaded core file reads as a bare identifier ==');
const readNames = [...reads.keys()].sort();
for (const name of readNames) console.log(`   ${name.padEnd(22)} defined by ${(definedBy.get(name) || '*** NOTHING ON THE PAGE ***').padEnd(18)} read at ${reads.get(name).slice(0, 3).join(', ')}${reads.get(name).length > 3 ? ' ... (' + reads.get(name).length + ')' : ''}`);
check('the scan found the reads it should (state.js globals the shim has to cover: not an empty result)', readNames.length >= 8, readNames.length + ' names');
const missing = readNames.filter(nm => !definedBy.has(nm));
check('every state.js global a loaded core file reads is defined by the shim or by a loaded script', missing.length === 0, missing.length ? 'UNDEFINED ON THE PAGE: ' + missing.join(', ') : readNames.length + ' names, all defined');
const sixShim = ['timeline', 'baseNetAnimation', 'baseNetTransform', 'activeNetWarp', 'nodeCount', 'shapeSizeFactor'];
for (const nm of sixShim) check('the shim defines ' + nm + ' (gallery-render.js, a plain var)', definedBy.get(nm) === 'gallery-render.js', definedBy.get(nm) || 'not defined');

console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures ? 'FAIL' : 'PASS');
process.exit(failures ? 1 : 0);
