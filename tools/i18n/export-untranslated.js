#!/usr/bin/env node
// tools/i18n/export-untranslated.js - exports the user-visible German strings that do not run through
// ui-i18n.js (task 040, read-only: it reads the sources and writes only the JSON).
//   node tools/i18n/export-untranslated.js            writes tools/i18n/untranslated-de.json
//   node tools/i18n/export-untranslated.js --stdout   prints the JSON instead
//   node tools/i18n/export-untranslated.js --summary  prints the counts only
//
// Scanned: index.html (text, title, aria-label, placeholder, alt without data-i18n*), sketch.js, ui*.js, core/*.js.
// Group "gallery" (own page, listed apart): gallery.html, gallery.js, gallery-render.js, nav.js.
// Skipped: comments, tools/, tests, ui-i18n.js itself, the strings of the dictionary, keys (ASCII dotted ids).
// A string counts as German when it has an umlaut / sharp s or a word of the German vocabulary below
// (the German words of the dictionary plus STOP). It is a heuristic: the output is meant to be reviewed.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const rd = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---- the dictionary: existing German texts -> key; vocabulary ----
const ctx = vm.createContext({ console }); ctx.window = ctx;
vm.runInContext(rd('ui-i18n.js'), ctx, { filename: 'ui-i18n.js' });
const DICT = ctx.uiI18n.DICT;
const deToKey = {};
Object.keys(DICT).forEach(k => { if (!(DICT[k].de in deToKey)) deToKey[DICT[k].de] = k; });
const norm = s => s.replace(/\s+/g, ' ').trim();
const STOP = 'der die das den dem des ein eine einen einem einer und oder nicht kein keine nur mit ohne für von zu zur zum im in am an auf aus bei nach über unter als wie wird werden ist sind hat haben kann können noch schon auch alle alles jede jeder dann wenn bis gilt zeigen zeigt aktiv aus an ein hinzufügen entfernen löschen speichern laden zurück weiter wählen farbe farben form formen netz netze ebene ebenen knoten linie linien fläche flächen herunterladen hilfe schließen öffnen mehr weniger breite höhe größe drehung versatz zufall muster raster'.split(' ');
const VOCAB = new Set(STOP.concat('schwarz anker kreis'.split(' ')));   // task 042: words without umlaut that the dictionary did not know yet
Object.keys(DICT).forEach(k => (DICT[k].de.toLowerCase().match(/[a-zäöüß]{3,}/g) || []).forEach(w => VOCAB.add(w)));
const EN_WORDS = new Set(); Object.keys(DICT).forEach(k => (DICT[k].en.toLowerCase().match(/[a-z]{3,}/g) || []).forEach(w => EN_WORDS.add(w)));
const EN_ONLY = /\b(the|is|are|must|does|not|and|for|with|of|to|has|have|can|be|from|when|only|each|every|no|or|this|that|per)\b/i;
const DE_STRONG = /\b(der|die|das|und|oder|nicht|ist|sind|von|mit|für|eine?|zu|auf|nur|bei|wird|kein)\b/i;
// words that are German AND an English/technical token: not enough alone (single-word strings need an umlaut or two vocabulary hits)
const AMBIG = new Set(['form', 'info', 'name', 'status', 'mode', 'zoom', 'start', 'stop', 'sin', 'tan', 'cos', 'basis', 'layer', 'net', 'text', 'rand', 'hex', 'rgb', 'bild', 'pause', 'phase', 'test', 'fold', 'color', 'ton', 'rot', 'grün', 'blau', 'gelb', 'normal', 'frame', 'index', 'name', 'ebene', 'alle', 'an', 'aus', 'in', 'am', 'im', 'als', 'wie', 'die', 'der', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'und', 'oder', 'mit', 'von', 'zu', 'bei', 'auf', 'for', 'man', 'war', 'rat', 'art', 'gut', 'bis', 'dann', 'wenn', 'nur', 'noch', 'schon', 'auch', 'ist', 'hat', 'kann', 'alles', 'jede', 'nach', 'aus']);
function isGerman(s) {
    if (!/[A-Za-zÄÖÜäöüß]/.test(s)) return false;
    if (/[äöüÄÖÜß]/.test(s)) return true;
    if (/^(Aus|Geo)$/.test(s)) return true;   // task 042: short German texts (net kind buttons)
    const words = (s.toLowerCase().match(/[a-zäöüß]{2,}/g) || []);
    if (!words.length) return false;
    if (EN_ONLY.test(s) && !DE_STRONG.test(s)) return false;
    const hits = words.filter(w => VOCAB.has(w) && !AMBIG.has(w) && !EN_WORDS.has(w));
    if (words.length === 1) return hits.length === 1 && words[0].length >= 4;
    return hits.length >= 1 && !/^(https?:|\.|#|\/|[a-z-]+:[^ ])/.test(s);
}
const looksLikeCode = s => /^[A-Za-z]:\w+$/.test(s) || (/^[\w-]+(?: [\w-]+)*$/.test(s) && /-/.test(s) && !/[A-ZÄÖÜ]/.test(s)) || /^[\w.\-#\[\]=:>~* ,()'"%/+]*$/.test(s) && /^(\.|#|\[|[a-z][a-z0-9-]*([.\[#:>][^ ]*)?$)/.test(s) && !/[A-ZÄÖÜ][a-zäöüß]+ /.test(s) && !/ [a-zäöüß]+ [a-zäöüß]+/.test(s);

// ---- JS tokenizer: string literals outside comments ----
function decode(raw, q) {
    return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/g, (m, e) => {
        if (e[0] === 'u') return String.fromCodePoint(parseInt(e[1] === '{' ? e.slice(2, -1) : e.slice(1), 16));
        if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
        if (e === 'n') return '\n'; if (e === 't') return '\t'; if (e === 'r') return '';
        if (e[0] === '\n' || e[0] === '\r') return '';
        return e;
    });
}
function jsStrings(src) {
    const out = []; let i = 0; const n = src.length; let prevSig = '';
    const regexOk = () => prevSig === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig) || /(^|[^\w$])(return|typeof|case|in|of)$/.test(src.slice(Math.max(0, i - 8), i).replace(/\s+$/, ''));
    while (i < n) {
        const c = src[i], d = src[i + 1];
        if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
        if (c === '"' || c === "'") {
            let j = i + 1; while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
            out.push({ pos: i, text: decode(src.slice(i + 1, j), c), q: c, tpl: false }); i = j + 1; prevSig = c; continue;
        }
        if (c === '`') {
            let j = i + 1, depth = 0, buf = '';
            while (j < n) {
                if (src[j] === '\\') { buf += src.slice(j, j + 2); j += 2; continue; }
                if (src[j] === '$' && src[j + 1] === '{') { let k = j + 2, dd = 1; while (k < n && dd) { if (src[k] === '{') dd++; else if (src[k] === '}') dd--; k++; } buf += '{expr}'; j = k; continue; }
                if (src[j] === '`') break; buf += src[j]; j++;
            }
            out.push({ pos: i, text: decode(buf, '`'), q: '`', tpl: true }); i = j + 1; prevSig = '`'; continue;
        }
        if (c === '/' && regexOk()) { let j = i + 1, cls = false; while (j < n && src[j] !== '\n') { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break; j++; } i = j + 1; prevSig = ')'; continue; }
        if (!/\s/.test(c)) prevSig = c;
        i++;
    }
    return out;
}
// the enclosing function, nearest preceding declaration (approximate)
function fnAt(src, pos) {
    const head = src.slice(Math.max(0, pos - 6000), pos);
    let best = '';
    const re = /(?:function\s+([A-Za-z_$][\w$]*)\s*\(|(?:^|\n)\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()\n]*\)\s*\{|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>))/g;
    let m; while ((m = re.exec(head))) { const nm = m[1] || m[2] || m[3]; if (nm && !/^(if|for|while|switch|catch|function|return)$/.test(nm)) best = nm; }
    return best || '(top level)';
}
function lineOf(src, pos) { let l = 1; for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) l++; return l; }

// ---- kind from the code just before the literal ----
function kindFor(src, pos, q) {
    const before = src.slice(Math.max(0, pos - 90), pos).replace(/\s+/g, ' ');
    const line = src.slice(src.lastIndexOf('\n', pos) + 1, src.indexOf('\n', pos) < 0 ? src.length : src.indexOf('\n', pos));
    if (/\b(alert|confirm|prompt)\s*\(\s*$/.test(before)) return 'dialog';
    if (/aria-label['"]?\s*[,:=]\s*$|ariaLabel\s*[:=]\s*$/.test(before)) return 'aria';
    if (/\btitle['"]?\s*[,:=]\s*$|\.title\s*=\s*$|setAttribute\(\s*['"]title['"]\s*,\s*$/.test(before)) return 'title';
    if (/placeholder['"]?\s*[,:=]\s*$/.test(before)) return 'placeholder';
    if (/(status|Status|setStatus|setMsg|msg|message|hint|reason|toast|note|err|error|warn)\w*['"]?\s*(?:[:=(,]|\+=)\s*$/.test(before) || /(setStatus|showStatus|flash|toast|notify)\s*\(\s*$/.test(before)) return 'status';
    if (/(textContent|innerText|innerHTML|\.text|label|Label|text|caption|name|desc|tip)['"]?\s*(?:[:=]|\+=)\s*$/.test(before) || /(createTextNode|\.fillText|\.text|\.label)\s*\(\s*$/.test(before)) return 'text';
    if (/title=|aria-label=|placeholder=/.test(line)) return 'other';
    return 'other';
}

// ---- HTML analysis ----
function htmlItems(src, baseOffset) {
    const items = [];
    const noI18n = attrs => !/data-i18n/.test(attrs);
    // strip comments, script and style bodies (kept as same-length blanks for the offsets)
    const blank = (s, re) => s.replace(re, m => m.replace(/[^\n]/g, ' '));
    let h = blank(src, /<!--[\s\S]*?-->/g);
    h = blank(h, /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi).replace(/<script\b[^>]*>/gi, m => m); // bodies handled as JS by the caller
    h = h.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi, (m, a, t, body, z) => a + body.replace(/[^\n]/g, ' ') + z);
    const stack = []; let m; const re = /<(\/?)([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/g;
    const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
    while ((m = re.exec(h))) {
        const at = m.index + baseOffset;
        if (m[4] !== undefined) {
            const text = norm(m[4].replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (x, d) => String.fromCharCode(+d)));
            if (!text || !isGerman(text)) continue;
            const top = stack[stack.length - 1];
            if (top && top.skip) continue;
            // translated when an ancestor-or-self carries data-i18n (own text) - only the element itself writes its own text node
            if (top && /data-i18n(?![-\w])/.test(top.attrs)) continue;
            items.push({ kind: 'text', de: text, pos: at, sel: top ? selector(top) : '', maxLen: null });
            continue;
        }
        const closing = m[1] === '/', tag = m[2].toLowerCase(), attrs = m[3] || '';
        if (closing) { for (let k = stack.length - 1; k >= 0; k--) if (stack[k].tag === tag) { stack.length = k; break; } continue; }
        const el = { tag, attrs, skip: /^(script|style|noscript|svg|template)$/.test(tag) && tag !== 'template' };
        const attr = nm => { const r = new RegExp('(?:^|\\s)' + nm + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')'); const x = r.exec(attrs); return x ? (x[1] !== undefined ? x[1] : x[2]) : null; };
        const hasKey = nm => new RegExp('(?:^|\\s)' + nm + '(?=[\\s=]|$)').test(attrs);
        // data-i18n-label sets aria-label AND title (when the element has one), data-i18n without own text does the same, data-i18n-title only the title (ui-i18n.js applyEl)
        const named = hasKey('data-i18n-label') || hasKey('data-i18n');
        const covered = { title: named || hasKey('data-i18n-title'), 'aria-label': named, placeholder: hasKey('data-i18n'), alt: named };
        [['title', 'title'], ['aria-label', 'aria'], ['placeholder', 'placeholder'], ['alt', 'title']].forEach(([a, kind]) => {
            const v = attr(a); if (v === null) return; const text = norm(v);
            if (!text || !isGerman(text)) return;
            if (covered[a]) return;
            items.push({ kind, de: text, pos: at, sel: selector(el), attrName: a, maxLen: null });
        });
        if (!VOID.test(tag) && !/\/\s*$/.test(attrs)) stack.push(el);
    }
    return items;
}
function selector(el) {
    const id = /(?:^|\s)id\s*=\s*"([^"]+)"/.exec(el.attrs), cls = /(?:^|\s)class\s*=\s*"([^"]+)"/.exec(el.attrs);
    return el.tag + (id ? '#' + id[1] : cls ? '.' + cls[1].trim().split(/\s+/)[0] : '');
}
// HTML inside a JS string (innerHTML / template): the text between the tags
function htmlInString(s) {
    if (!/<[A-Za-z][^>]*>/.test(s)) return null;
    return htmlItems(s, 0);
}

// ---- collect ----
const MAIN = ['index.html', 'sketch.js'].concat(fs.readdirSync(ROOT).filter(f => /^ui-.*\.js$/.test(f) && f !== 'ui-i18n.js').sort(), fs.readdirSync(path.join(ROOT, 'core')).filter(f => /\.js$/.test(f)).sort().map(f => 'core/' + f));
const GALLERY = ['gallery.html', 'gallery.js', 'gallery-render.js', 'nav.js'].filter(f => fs.existsSync(path.join(ROOT, f)));
const entries = [], covered = [];
function scanFile(rel, group) {
    const src = rd(rel);
    const push = (e, pos, extra) => entries.push(Object.assign({ file: rel, group, line: lineOf(src, pos) }, e, extra));
    if (rel.endsWith('.html')) {
        htmlItems(src, 0).forEach(it => push({ de: it.de, kind: it.kind, where: it.sel + (it.attrName ? '[' + it.attrName + ']' : '') }, it.pos, { markup: true }));
        // inline <script> bodies: strings
        const sre = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m;
        while ((m = sre.exec(src))) { const base = m.index + m[0].indexOf('>') + 1; scanJs(m[1], src, base, rel, group); }
        return;
    }
    scanJs(src, src, 0, rel, group);
}
function scanJs(body, full, base, rel, group) {
    jsStrings(body).forEach(s => {
        const pos = base + s.pos, text = s.text;
        const lineStart = body.lastIndexOf('\n', s.pos) + 1, lineEnd = body.indexOf('\n', s.pos);
        const line = body.slice(lineStart, lineEnd < 0 ? body.length : lineEnd);
        const fn = fnAt(body, s.pos), ln = lineOf(full, pos);
        const km = /^\s*['"]([\w.\-]+)['"]\s*:/.exec(line) || /\b(?:tr|t|T)\(\s*['"]([\w.\-]+)['"]/.exec(line) || /\bi18n\s*:\s*['"]([\w.\-]+)['"]/.exec(line);
        const im = /\bi18n\s*:\s*['"]([\w.\-]+)['"]\s*,\s*text\s*:\s*$/.exec(body.slice(Math.max(0, s.pos - 80), s.pos));
        const lineKey = im ? im[1] : (km ? km[1] : null);
        if (lineKey && Object.prototype.hasOwnProperty.call(DICT, lineKey) && s.text !== lineKey) { if (isGerman(norm(text))) covered.push({ file: rel, line: ln, key: lineKey }); return; }
        const add = (de, kind, extra) => {
            const t = norm(de); if (!t || !isGerman(t)) return;
            entries.push(Object.assign({ file: rel, group, line: ln, de: t, kind, where: fn, lineText: line.trim().slice(0, 160), tableKey: lineKey && !/^[A-Z]/.test(lineKey) && /\./.test(lineKey) ? lineKey : undefined }, extra || {}));
        };
        const markup = htmlInString(text);
        if (markup) { markup.forEach(it => add(it.de, it.kind, { where: fn + ' > ' + it.sel + (it.attrName ? '[' + it.attrName + ']' : ''), markup: true, inString: true })); return; }
        if (looksLikeCode(text)) return;
        const kind = kindFor(body, s.pos, s.q);
        add(text, kind, { tpl: s.tpl || undefined });
    });
}
MAIN.forEach(f => scanFile(f, 'main'));
GALLERY.forEach(f => scanFile(f, 'gallery'));

// ---- post-processing ----
const PH = /\{[A-Za-z_]\w*\}|\{expr\}|%[sd]|%\d*\.?\d*[fdsi]|\$\{[^}]*\}/g;
const slug = s => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'text';
const fileKey = f => f.replace(/^ui-/, '').replace(/^core\//, 'core-').replace(/\.(js|html)$/, '').replace(/^index$/, 'index');
const used = {};
const out = entries.map(e => {
    const ph = (e.de.match(PH) || []);
    const concat = /["'`]\s*\+\s*[\w.$(]|[\w.$)]\s*\+\s*["'`]/.test(e.lineText || '') && !ph.length;
    const viaI18n = /UI\.t\(|\bt\(['"]|i18n\s*:/.test(e.lineText || '');
    const idPre = e.tableKey;
    const id = idPre || (e.file.startsWith('core/') || e.file === 'sketch.js' || /^ui-/.test(e.file) || e.file === 'index.html' ? '' : '') + fileKey(e.file) + '.' + slug(e.de);
    used[id] = (used[id] || 0) + 1;
    if (e.kind === 'other' && e.tableKey) {
        if (/^(reason|note)\./.test(e.tableKey)) e.kind = 'status';
        else if (/\.title$/.test(e.tableKey)) e.kind = 'dialog';
        else if (/^timeline\.(clear|dia)\./.test(e.tableKey)) e.kind = 'dialog';
        else if (/\.(add|remove|more|chip|in|out|state)/.test(e.tableKey)) e.kind = 'title';
    }
    const ctxs = { text: 'visible text', title: 'tooltip (title)', aria: 'aria-label (screen reader)', placeholder: 'input placeholder', status: 'status / hint message', dialog: 'browser dialog', other: 'string in code, visibility to check' };
    return {
        id: used[id] > 1 ? id + '-' + used[id] : id,
        de: e.de,
        file: e.file, line: e.line, group: e.group,
        function: e.markup && !e.inString && e.file.endsWith('.html') ? undefined : e.where,
        selector: e.markup && e.file.endsWith('.html') ? e.where : (e.inString ? e.where : undefined),
        kind: e.kind,
        context: ctxs[e.kind] + (e.markup ? ' in markup' : ' in ' + e.file.replace(/^core\//, 'core/')) + (ph.length ? '; placeholders: ' + ph.join(' ') : ''),
        placeholders: ph.length ? ph : undefined,
        composed: concat ? true : undefined,
        needsCode: !(e.markup && e.file.endsWith('.html')),
        existingKey: deToKey[e.de],
        tableKey: e.tableKey,
        viaI18nNearby: viaI18n || undefined,
        maxLen: /ui-phone/.test(e.file) && (e.kind === 'text' || e.kind === 'status') ? 40 : null,
        existingEn: undefined
    };
});
// duplicates: same de text more than once
const byText = {}; out.forEach(e => { (byText[e.de] = byText[e.de] || []).push(e); });
out.forEach(e => { if (byText[e.de].length > 1) e.duplicateOf = byText[e.de].length; });
out.forEach(e => { Object.keys(e).forEach(k => e[k] === undefined && delete e[k]); });

const count = (arr, f) => arr.reduce((o, e) => { const k = f(e); o[k] = (o[k] || 0) + 1; return o; }, {});
const summary = {
    total: out.length,
    byGroup: count(out, e => e.group), byFile: count(out, e => e.file), byKind: count(out, e => e.kind),
    uniqueTexts: Object.keys(byText).length, duplicateEntries: out.filter(e => e.duplicateOf).length,
    withPlaceholders: out.filter(e => e.placeholders).length, composed: out.filter(e => e.composed).length,
    needsCodeChange: out.filter(e => e.needsCode).length, markupOnly: out.filter(e => !e.needsCode).length,
    existingKey: out.filter(e => e.existingKey).length, coveredFallbackLiterals: covered.length, tableKeyNotInDict: out.filter(e => e.tableKey).length, viaI18nNearby: out.filter(e => e.viaI18nNearby).length
};
const doc = { generator: 'tools/i18n/export-untranslated.js', note: 'Heuristic export (task 040): review before use. Placeholders ({n}, ${...}) and composed strings (composed: true) must be translated whole, with the same placeholders. needsCode: the English needs a code change (hard string in JS), not only an entry in ui-i18n.js.', summary, entries: out };
if (process.argv.includes('--summary')) console.log(JSON.stringify(summary, null, 1));
else if (process.argv.includes('--stdout')) console.log(JSON.stringify(doc, null, 1));
else { fs.writeFileSync(path.join(__dirname, 'untranslated-de.json'), JSON.stringify(doc, null, 1) + '\n'); console.log(JSON.stringify(summary)); }
