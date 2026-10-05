/**
 * tools/session/fixtures.js
 * Shared test plumbing for the session tests (not a test itself - the glob only runs test-*.js): a vm context holding the REAL core
 * files plus core/state.js (so the real rebuildGrid() / rebuildGridFromConstruction() and the real `let` globals are available as the
 * oracle), the tiny p5 surface they call, and a few fixtures. The session code under test is read from SESSION_JS when set (the
 * sabotage runs), else from the working tree.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const C = require(path.join(ROOT, 'tools', 'color', 'corpus.js'));

const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
// session modules in load order; SESSION_JS replaces core/session.js, SESSION_APPLY_JS replaces core/session-apply.js
function sessionSources() {
    const out = [fs.readFileSync(process.env.SESSION_JS || path.join(ROOT, 'core', 'session.js'), 'utf8')];
    const apply = process.env.SESSION_APPLY_JS || path.join(ROOT, 'core', 'session-apply.js');
    if (fs.existsSync(apply)) out.push(fs.readFileSync(apply, 'utf8'));
    const store = process.env.SESSION_STORE_JS || path.join(ROOT, 'core', 'session-store.js');
    if (fs.existsSync(store)) out.push(fs.readFileSync(store, 'utf8'));
    return out.join('\n');
}

// opts.state: also load core/state.js (the real globals); opts.export: also core/export.js (buildExportData)
function makeContext(opts) {
    opts = opts || {};
    const files = [C.loadSrc(false)];
    files.push(read('core/symmetry-toggles.js'));   // symmetryModeFor() / symmetryCategoryFoldFor() - the pure half of the Form row's symmetry logic
    if (opts.state) files.push(read('core/state.js'));
    if (opts.export) files.push(read('core/export.js'));
    files.push(sessionSources());
    const sb = {
        console, dist: (a, b, c, d) => Math.hypot(c - a, d - b), sqrt: Math.sqrt, radians: d => d * Math.PI / 180, degrees: r => r * 180 / Math.PI,
        cos: Math.cos, sin: Math.sin, abs: Math.abs, atan2: Math.atan2, strokeWeight() { },
    };
    if (!opts.state) Object.assign(sb, { segmentCollector: null, svgPathCollector: null, curveType: { kind: 'straight' }, baseNetTransform: null, baseNetAnimation: null, timeline: null,
        activeNetWarp: null, additionalLayers: [], baseFaceAssignments: new Map(), baseFacePalette: null, faceHover: null, lineColor: '#000000', altNetSeed: null });
    vm.createContext(sb);
    vm.runInContext(files.join('\n'), sb);
    const ctx = { sb, run: code => vm.runInContext(code, sb), get: name => vm.runInContext(name, sb) };
    return ctx;
}

// the live globals, gathered into the state-like object buildSessionSnapshot() takes (P1b replaces this with collectSessionState())
function peekState(ctx) {
    return ctx.run(`({ currentShape, nodeCount, shapeSizeFactor, canvasW, canvasH, symmetryMode, curveType, lineColor, showNodes, showFaces, freeEndpointsEnabled,
        altNetSeed, baseNetTransform, connections, redoStack, nodes, baseFaceAssignments, baseFacePalette, baseFaceAnchor, baseLastHarmonyType, baseLastSelection,
        baseDistributionStrategy, additionalLayers, timeline, activeLayer })`);
}

function member(hueIndex, w, s, srgb) { return { analyticalCoordinate: { hueIndex, v: hueIndex === null ? 0 : 1 - w - s, w, s }, srgb }; }
function selectionOf(members) { return { version: 1, source: 'farborgel', members, classification: { cardinality: members.length }, activeMemberIndex: 0 }; }
const SEL3 = selectionOf([member(1, 0.1, 0.1, [200, 30, 40]), member(13, 0.2, 0.3, [40, 120, 200]), member(null, 0.5, 0.5, [128, 128, 128])]);
const GRAY1 = selectionOf([member(null, 0.3, 0.3, [90, 90, 90])]);
const clone = x => JSON.parse(JSON.stringify(x));
const J = x => JSON.stringify(x);

module.exports = { ROOT, C, read, makeContext, peekState, member, selectionOf, SEL3, GRAY1, clone, J, vm };
