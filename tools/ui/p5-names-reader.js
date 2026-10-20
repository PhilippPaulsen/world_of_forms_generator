// A mirror of p5@1.9.0's friendly-error SKETCH READER (core/friendly_errors/sketch_reader.js, compiled into lib/p5.js as `fesCodeReader`), for tools/ui/test-p5-names.js.
// Pure: no fs, no DOM. `makeReader(data)` takes the frozen lists of tools/ui/p5-names-1.9.0.json. Every regular expression is built the way p5 builds it; the filter and
// the order of the checks are p5's. The mirror was checked against the REAL reader (p5 1.9.0 loaded in a Chromium pane, window.setup / window.draw replaced, p5._fesCodeReader()
// called, p5._friendlyError spied) on the corpus in tools/ui/p5-names-1.9.0.json ("readerCorpus"): the test replays that corpus.
//
// What p5 does (p5.js 1.9.0, in this order):
//   load event -> fesCodeReader():
//     1. globalConstFuncCheck(): for every key of `constants` (128 constants) and of Object.keys(Renderer.prototype, Renderer2D.prototype, RendererGL.prototype) (40 names, "globalFunctions"):
//        eval(name); if the name resolves (a global of the page) to something other than p5's own value, warn "reserved variable / function" and RETURN TRUE: the line scan below is then skipped.
//        (This is the check of top-level names of the page's scripts; the test approximates it statically.)
//     2. code = '' + setup + '\n' + draw   (the source text of the two functions only; a missing one is ''), then removeMultilineComments(code) (loops forever, until
//        "RangeError: Invalid string length", when a `*/` comes before the first `/*`), then codeToLines(code).
//   codeToLines: lines = code.split('\n') trimmed. arrayVariables = lines that are not '', do NOT contain '//' ANYWHERE (the whole line is dropped, also `const dot = 1; // note` and
//     `const url = 'http://x'`), contain the substring 'let' or 'const' (anywhere: "delta", "letter", "constant" count), and contain neither '=>' nor 'function'.
//     arrayFunctions = the same lines but containing '=>' or 'function'.
//   extractVariables(arrayVariables): each line is matched with  ^(?:(?:let|const|var)\s+)?  then one or more `NAME = value` separated by commas  (NAME = [\w$]+; value = brackets or [^\n,]);
//     the capture groups are the NAME of the LAST repeated assignment and the NAME of the final one: of `const a = 1, b = 2, c = 3, d = 4` only c and d are seen; a line without `=`
//     (`let dot;`), a destructuring (`const {dot} = x`), a line that starts with something else (`for (let dot = 0;`, `if (x) { const dot = 1; }`) is not matched at all; a line of plain
//     assignments (`dot = 5 + letter;`) IS matched (the keyword is optional); `const dot = 1; const y = 2;` yields only dot (the value runs to the end of the line);
//     a `var` line is only seen when it also contains 'let' or 'const' somewhere.
//   extractFuncVariables(arrayFunctions): the first `(let|const) NAME` of the line.
//   checkForConstsAndFuncs(names), called ONCE for each of the two lists, warns for the FIRST hit only and returns:
//     (a) the first name with constants[name] !== undefined  ("reserved variable"). `constants` is a plain object, so the 12 names of Object.prototype count (constructor, toString, valueOf, ...);
//     (b) else the first name that is NOT in ignoreFunction (setup draw preload deviceMoved deviceTurned deviceShaken doubleClicked mousePressed mouseReleased mouseMoved mouseDragged mouseClicked
//         mouseWheel touchStarted touchMoved touchEnded keyPressed keyReleased keyTyped windowResized name parent toString print stop onended) and for which Constructor.prototype[name] !== undefined
//         for one of the 29 p5 constructors (Object.keys(p5) that are functions with an upper-case first letter): "reserved function". `width` and `height` THROW instead (a getter on
//         FramebufferTexture.prototype reads this.framebuffer.width): an uncaught TypeError at load and no warning, and the second call (the function list) is never made.
// The names are the 534 that make the real reader react: 128 constants + 12 Object.prototype names (one warning kind) + the 392 members that are not ignored (the other kind) + width and height.
'use strict';

function makeReader(data) {
    const constKeys = new Set(data.constants.concat(data.objectPrototypeNames));
    const members = new Set(data.members), ignore = new Set(data.ignoreFunction), throwers = new Set(data.throwOnAccess);

    // the regular expressions, built exactly like p5 builds them
    const optionalVarKeyword = /(?:(?:let|const|var)\s+)?/;
    const roundBracketedExpr = /(?:\([^)]*\))/;
    const squareBracketedExpr = /(?:\[[^\]]*\])/;
    const curlyBracketedExpr = /(?:\{[^}]*\})/;
    const bracketedExpr = new RegExp([roundBracketedExpr, squareBracketedExpr, curlyBracketedExpr].map(r => r.source).join('|'));
    const rightHandSide = new RegExp('(?:' + bracketedExpr.source + '|[^\\n,])+');
    const leftHandSide = /([\w$]+)/;
    const assignmentOperator = /\s*=\s*/;
    const singleAssignment = new RegExp(leftHandSide.source + assignmentOperator.source + rightHandSide.source);
    const listSeparator = /,\s*/;
    const oneOrMoreAssignments = new RegExp('(?:' + singleAssignment.source + listSeparator.source + ')*' + singleAssignment.source);
    const assignmentStatement = new RegExp('^' + optionalVarKeyword.source + oneOrMoreAssignments.source);
    const letConstName = /(?:(?:let|const)\s+)([\w$]+)/;

    const trimmedLines = code => code.split('\n').map((text, idx) => ({ text: text.trim(), idx }));
    const readerLines = code => {
        const base = trimmedLines(code).filter(l => l.text !== '' && !l.text.includes('//') && (l.text.includes('let') || l.text.includes('const')));
        return { variables: base.filter(l => !l.text.includes('=>') && !l.text.includes('function')), functions: base.filter(l => l.text.includes('=>') || l.text.includes('function')) };
    };
    // the names p5 extracts, in p5's order: the variable list first, then the function list
    function entries(code) {
        const { variables, functions } = readerLines(code), out = [];
        variables.forEach(l => { const m = l.text.match(assignmentStatement); if (m) m.slice(1).filter(g => g !== undefined).forEach(name => out.push({ name, idx: l.idx, via: 'variable', text: l.text })); });
        functions.forEach(l => { const m = l.text.match(letConstName); if (m !== null) out.push({ name: m[1], idx: l.idx, via: 'function', text: l.text }); });
        return out;
    }
    const kindOf = name => constKeys.has(name) ? 'const' : (!ignore.has(name) && throwers.has(name) ? 'throws' : (!ignore.has(name) && members.has(name) ? 'func' : null));
    // what the real reader would report: one result per list (first hit), or a throw that ends the run
    function readerWarnings(code) {
        const es = entries(code), out = [];
        for (const via of ['variable', 'function']) {
            const names = es.filter(e => e.via === via).map(e => e.name);
            const c = names.find(n => constKeys.has(n));
            if (c !== undefined) { out.push({ kind: 'const', name: c }); continue; }
            const f = names.find(n => !ignore.has(n) && (members.has(n) || throwers.has(n)));
            if (f !== undefined) { if (throwers.has(f)) { out.push({ kind: 'throws', name: f }); return out; } out.push({ kind: 'func', name: f }); }
        }
        return out;
    }
    // every extracted name that the reader reacts to (the guard reports all of them, p5 only the first per list)
    const allHits = code => entries(code).map(e => Object.assign({ kind: kindOf(e.name) }, e)).filter(e => e.kind !== null);

    // ---- STRICTER than the reader (best effort, an extra of the guard, not p5's behaviour) ----------------------------------------------------------------
    const stripLineComment = line => { let q = null; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '\\') i++; else if (c === q) q = null; } else if (c === '"' || c === "'" || c === '`') q = c; else if (c === '/' && line[i + 1] === '/') return line.slice(0, i); } return line; };
    const splitTop = s => { const out = []; let d = 0, cur = ''; for (const c of s) { if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; if (c === ',' && d === 0) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
    const patternNames = p => { p = p.trim(); if (/^[\w$]+$/.test(p)) return [p]; if (/^[[{]/.test(p)) return splitTop(p.slice(1, p.lastIndexOf(p[0] === '{' ? '}' : ']'))).flatMap(x => { x = x.replace(/=.*$/s, '').trim(); const k = x.match(/^(?:\.\.\.)?([\w$]+)(?:\s*:\s*(.+))?$/s); return k ? (k[2] ? patternNames(k[2]) : [k[1]]) : []; }); return []; };
    // every declared name of a `let|const|var` statement (all declarators, with or without `=`, destructuring), from the part of the line before a `//`
    function declaredNames(line) {
        const m = line.match(/^(?:let|const|var)\s+([\s\S]*)$/); if (!m) return [];
        return splitTop(m[1].replace(/;\s*$/, '')).flatMap(d => patternNames(d.split(/=(?!=)/)[0]));
    }
    // names the reader does NOT see although the tree declares them: lines it drops for a `//`, declarators it does not capture, `var` lines without let/const, no-`=` declarations, destructuring
    function strictEntries(code) {
        const seen = new Set(entries(code).map(e => e.idx + ':' + e.name)), out = [];
        trimmedLines(code).forEach(l => {
            const body = stripLineComment(l.text).trim(); if (body === '') return;
            const why = l.text.includes('//') ? 'the line contains // (the reader drops the whole line)' : 'not captured by the reader (a later declarator, no =, a var line, destructuring)';
            declaredNames(body).forEach(name => { if (!seen.has(l.idx + ':' + name)) { const k = kindOf(name); if (k !== null) out.push({ name, idx: l.idx, kind: k, why, text: l.text }); } });
        });
        return out;
    }
    return { entries, kindOf, readerWarnings, allHits, strictEntries, declaredNames, constKeys, members, ignore };
}

module.exports = { makeReader };
