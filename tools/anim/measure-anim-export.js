// Task 114 (measurement only, nothing in the tree is changed): what an animation export needs, measured in the real core files (render harness, p5 drawing stubbed).
//   node tools/anim/measure-anim-export.js det        determinism: the same t gives the same frame (20 times t; forward, backward, shuffled; timeline playback layer, spatial morph, hexagon Field)
//   node tools/anim/measure-anim-export.js svg        SVG per frame: bytes, ms, polygons; faces on/off, net on/off; timeline and spatial morph
//   node tools/anim/measure-anim-export.js zip        a "store" ZIP writer (own, no compression): bytes, ms for 30 / 120 / 300 frames, check against zlib deflate and `unzip -t`
//   node tools/anim/measure-anim-export.js noface     task 117: the face fills switched off by the FLAGS (showFaces of the base and of every layer) instead of by post-processing: is the SVG the same minus the polygon group, and what does it save?
//   node tools/anim/measure-anim-export.js clip       task 117: how many polygons and paths of a frame lie completely outside the canvas, and the bytes they take
//   node tools/anim/measure-anim-export.js time       frame time (draw only, and SVG) with hexagon Field, layers, timeline, morph; stop line 2500 ms
// The browser half (PNG per frame, memory) is tools/anim/measure-png-frames.browser.js.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), J = JSON.stringify;
const { makeRenderWorld } = require(path.join(ROOT, 'tools', 'morph', 'render-harness.js'));
const S = require(path.join(ROOT, 'tools', 'session', 'scenarios.js'));
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const med = a => { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; };
const ms = f => { const t0 = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t0) / 1e6, r]; };

const K0 = [[1, 5], [2, 8], [3, 7], [4, 6], [1, 9]], K1 = [[1, 9], [2, 6], [4, 8], [5, 9], [3, 7]], K2 = [[1, 7], [2, 9], [3, 5], [4, 8], [6, 9]];
const FIELD = { x: { kind: 'trig', w: 0.3 }, y: 'same', repeat: false, domain: 'field' };
const SEG_MS = 2000;

// kind: 'timeline' (playback layer, applyTimelineFrame) | 'morph' (spatial morph follows timeline.elapsedMs) | 'plain' (no animation)
function mk(o) {
    o = Object.assign({ kind: 'timeline', shape: 'square', order: 3, size: 3, mode: 'none', net: null, faces: true, K: [K0, K1, K2], layers: 0, nBase: 5 }, o);
    const w = makeRenderWorld(o.shape, o.order, o.size, o.mode, {});
    const sb = w.sb;
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000';
    sb.__n = 0; sb.__polys = []; sb.__cur = null;
    // p5 drawing stubs: the polygons are collected only by generateSVGString (it swaps fill/vertex itself); a plain frame just counts
    ['push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'fill', 'noFill', 'beginShape', 'vertex', 'endShape'].forEach(n => { sb[n] = () => { }; });
    sb.CLOSE = 'close';
    if (o.base) w.baseConnections(o.base);
    const ids = o.K.map(k => w.addKeyframeLayer(k));
    ids.forEach(i => w.set(`additionalLayers[${i}].showFaces = ${o.faces};`));
    w.set(`showFaces = ${o.faces};`);
    if (o.kind === 'timeline') {
        S.addLayer(w.ctx, { shape: o.shape, order: o.order, size: o.size, mode: o.mode === 'none' ? 'none' : o.mode, connections: [], playback: true });
        w.setTimeline(ids, { playbackLayerIndex: ids.length });
    } else if (o.kind === 'morph') {
        w.setTimeline(ids);
        w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 });
    }
    if (o.net) w.set(`baseNetTransform = ${J(o.net)};`);
    w.total = SEG_MS * (ids.length - 1);
    // the app's own frame order for a PAUSED timeline: elapsedMs is authoritative (setTimelineProgress does the same, plus the loop gate)
    w.at = (t) => { w.set(`timeline.elapsedMs = ${t * w.total}; timeline.playing = false; timeline.netLive = true; ${o.kind === 'timeline' ? 'applyTimelineFrame();' : ''}`); };
    w.svg = () => w.get('generateSVGString()');
    w.draw = () => w.run('drawTessellation()');
    return w;
}
// the hexagon Field of task 112: Field net, layers on the base grid, timeline over them
function mkHex(X, layers, kind) {
    const MODE = 'rotation_reflection6', HOOK = 'var canvasSizeSync = function () { width = canvasW; height = canvasH; };';
    const w = makeRenderWorld('hex', 3, 3, MODE, {});
    const sb = w.sb; w.set(HOOK);
    sb.document = { body: {} }; sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' }); sb.lineColor = '#000000'; sb.CLOSE = 'close';
    ['push', 'pop', 'noStroke', 'stroke', 'strokeWeight', 'ellipse', 'rect', 'fill', 'noFill', 'beginShape', 'vertex', 'endShape'].forEach(n => { sb[n] = () => { }; });
    const NET = { x: { kind: 'trig', w: -0.8 }, y: { kind: 'trig', w: 0.56 }, repeat: false, domain: 'field' };
    w.set(`currentShape = 'hex'; projectGridSpec({ shape: 'hex', ordnung: 3, lage: 1 }); shapeSizeFactorX = null; shapeSizeFactorY = null; canvasW = 600; canvasH = 600; width = 600; height = 600; setGridSize(${X}, ${X});
        baseNetTransform = ${J(NET)}; baseNetAnimation = null; additionalLayers = []; timeline = null; activeLayer = 'base'; baseFaceAssignments = new Map(); baseFacePalette = null; showFaces = true; rebuildGrid(currentShape);`);
    const all = w.get('computeThemeLineOrbits(nodes, centroid, currentShape, symmetryMode, outerCorners).orbits.map(o => o.pairs[0].slice())');
    w.set(`connections = ${J(all.slice(0, 10).map(p => p.slice()))};`);
    for (let k = 0; k < layers; k++) S.addLayer(w.ctx, { shape: 'hex', order: 3, size: X, mode: MODE, connections: all.slice(k + 1, k + 11), showFaces: true });
    if (kind === 'timeline' || kind === 'morph') {
        const ids = [layers, layers + 1].map((_, i) => w.addKeyframeLayer(all.slice(20 + i * 3, 30 + i * 3)));
        ids.forEach(i => w.set(`additionalLayers[${i}].showFaces = true;`));
        if (kind === 'timeline') { S.addLayer(w.ctx, { shape: 'hex', order: 3, size: X, mode: MODE, connections: [], playback: true }); w.setTimeline(ids, { playbackLayerIndex: ids[1] + 1 }); }
        else { w.setTimeline(ids); w.setMorph({ enabled: true, mode: 'linear', angleDeg: 0 }); }
        w.total = SEG_MS;
    } else w.total = 1;
    w.at = (t) => w.set(`if (timeline) { timeline.elapsedMs = ${t * w.total}; timeline.playing = false; timeline.netLive = true; ${kind === 'timeline' ? 'applyTimelineFrame();' : ''} }`);
    w.svg = () => w.get('generateSVGString()');
    w.draw = () => w.run('drawTessellation()');
    return w;
}

const mode = process.argv[2] || 'det';
const T20 = Array.from({ length: 20 }, (_, i) => i / 19);
const rng = (() => { let s = 114; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

if (mode === 'det') {
    // a frame = the SVG string at t (lines + face polygons as drawn); the SVG is what the export would write
    const cases = {
        'timeline square 3/3, net off': () => mk({ kind: 'timeline' }),
        'timeline square 3/3, field net': () => mk({ kind: 'timeline', net: FIELD }),
        'morph linear square 3/3, field net': () => mk({ kind: 'morph', net: FIELD }),
        'morph linear square 3/3, no net': () => mk({ kind: 'morph' }),
        'hex 4/4 Field, 2 layers + timeline': () => mkHex(4, 2, 'timeline'),
        'hex 4/4 Field, 2 layers + morph': () => mkHex(4, 2, 'morph'),
    };
    for (const name of Object.keys(cases)) {
        const w = cases[name](); const fwd = T20.map(t => { w.at(t); return sha(w.svg()); });
        const back = T20.slice().reverse().map(t => { w.at(t); return sha(w.svg()); }).reverse();
        const idx = shuffle(T20.map((_, i) => i)); const shuf = []; idx.forEach(i => { w.at(T20[i]); shuf[i] = sha(w.svg()); });
        w.at(0.37); w.svg(); w.at(0.37); const a = sha(w.svg()); w.at(0.37); const b = sha(w.svg());   // same t twice in a row
        const fresh = cases[name](); const f2 = T20.map(t => { fresh.at(t); return sha(fresh.svg()); });   // a second world built from scratch
        const same = (x, y) => x.every((v, i) => v === y[i]);
        console.log(J({ case: name, distinctOf20: new Set(fwd).size, fwd_eq_back: same(fwd, back), fwd_eq_shuffled: same(fwd, shuf), twice: a === b, fwd_eq_freshWorld: same(fwd, f2) }));
    }
} else if (mode === 'svg') {
    const rows = [];
    const run = (name, w) => { w.at(0.5); w.svg(); const t = [], by = []; let svg; for (let i = 0; i < 5; i++) { w.at(0.2 + i * 0.15); const [d, s] = ms(() => w.svg()); t.push(d); by.push(s.length); svg = s; }
        rows.push({ name, ms: +med(t).toFixed(1), kB: +(med(by) / 1024).toFixed(1), polygons: (svg.match(/<polygon /g) || []).length, paths: (svg.match(/<path /g) || []).length, hasNetOverlay: /net/i.test(svg) }); };
    for (const faces of [true, false]) for (const net of [null, FIELD]) {
        run(`timeline square 3/3, faces ${faces ? 'on' : 'off'}, net ${net ? 'on' : 'off'}`, mk({ kind: 'timeline', faces, net }));
        run(`morph square 3/3, faces ${faces ? 'on' : 'off'}, net ${net ? 'on' : 'off'}`, mk({ kind: 'morph', faces, net }));
    }
    for (const X of [4, 8]) { run(`hex ${X}/${X} Field, 3 layers, timeline`, mkHex(X, 3, 'timeline')); run(`hex ${X}/${X} Field, 3 layers, morph`, mkHex(X, 3, 'morph')); }
    rows.forEach(r => console.log(J(r)));
} else if (mode === 'noface' || mode === 'clip') {
    const GROUP = /  <g stroke="none">\n[\s\S]*?  <\/g>\n/;
    const flagsOff = (w) => w.set('showFaces = false; additionalLayers.forEach(l => { l.showFaces = false; });');
    const cases = [['timeline square 3/3', () => mk({ kind: 'timeline' })], ['morph square 3/3', () => mk({ kind: 'morph' })], ['morph square 3/3 field net', () => mk({ kind: 'morph', net: FIELD })],
        ['hex 4/4 Field, 3 layers, timeline', () => mkHex(4, 3, 'timeline')], ['hex 4/4 Field, 3 layers, morph', () => mkHex(4, 3, 'morph')], ['hex 8/8 Field, 3 layers, morph', () => mkHex(8, 3, 'morph')]];
    for (const [name, make] of cases) {
        const w = make(); w.at(0.5); w.svg();
        const [tOn, a] = ms(() => w.svg());
        if (mode === 'noface') {
            const post = a.replace(GROUP, '');
            flagsOff(w); w.at(0.5); w.svg(); const [tOff, b] = ms(() => w.svg());
            const [tDraw] = ms(() => w.draw());
            console.log(J({ name, onMs: +tOn.toFixed(0), flagsOffMs: +tOff.toFixed(0), onKB: Math.round(a.length / 1024), flagsOffKB: Math.round(b.length / 1024), equalToPostProcessed: b === post, polygonsOn: (a.match(/<polygon /g) || []).length, polygonsOff: (b.match(/<polygon /g) || []).length, drawMsFlagsOff: +tDraw.toFixed(0) }));
        } else {
            const W = Number((a.match(/ width="(\d+(?:\.\d+)?)"/) || [])[1]), H = Number((a.match(/ height="(\d+(?:\.\d+)?)"/) || [])[1]);
            const out = (xs, ys) => Math.max(...xs) < 0 || Math.min(...xs) > W || Math.max(...ys) < 0 || Math.min(...ys) > H;
            let polyOut = 0, polyBytes = 0, polyTot = 0, pathOut = 0, pathBytes = 0, pathTot = 0;
            for (const m of a.matchAll(/    <polygon points="([^"]*)"[^>]*\/>\n/g)) { polyTot++; const pts = m[1].split(' ').map(p => p.split(',').map(Number)); if (out(pts.map(p => p[0]), pts.map(p => p[1]))) { polyOut++; polyBytes += m[0].length; } }
            for (const m of a.matchAll(/    <path d="([^"]*)" \/>\n/g)) { pathTot++; const n = m[1].match(/-?\d+(?:\.\d+)?/g).map(Number), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1); if (out(xs, ys)) { pathOut++; pathBytes += m[0].length; } }
            // task 117 (before a possible stage 4): what is left AFTER PACKING when the elements completely outside the canvas are dropped (deflate level 6, as CompressionStream uses)
            const keep = a.replace(/    <polygon points="([^"]*)"[^>]*\/>\n/g, (m0, pts) => { const q = pts.split(' ').map(p => p.split(',').map(Number)); return out(q.map(p => p[0]), q.map(p => p[1])) ? '' : m0; })
                .replace(/    <path d="([^"]*)" \/>\n/g, (m0, d) => { const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number); return out(n.filter((_, i) => i % 2 === 0), n.filter((_, i) => i % 2 === 1)) ? '' : m0; });
            const [tp0, p0] = ms(() => zlib.deflateRawSync(a, { level: 6 }).length), [tp1, p1] = ms(() => zlib.deflateRawSync(keep, { level: 6 }).length);
            console.log(J({ name, rawKB: Math.round(a.length / 1024), clippedRawKB: Math.round(keep.length / 1024), packedKB: Math.round(p0 / 1024), clippedPackedKB: Math.round(p1 / 1024), packedSaved: +(1 - p1 / p0).toFixed(2), packMs: Math.round(tp0), clippedPackMs: Math.round(tp1) }));
            console.log(J({ name, canvas: W + 'x' + H, polygons: polyTot, polygonsOutside: polyOut, polygonOutsideKB: Math.round(polyBytes / 1024), paths: pathTot, pathsOutside: pathOut, pathOutsideKB: Math.round(pathBytes / 1024), totalKB: Math.round(a.length / 1024), outsideShare: +((polyBytes + pathBytes) / a.length).toFixed(3) }));
        }
    }
} else if (mode === 'time') {
    // frame time as the app pays it: a draw (stubs, no pixels) and the SVG string; the stop line is 2500 ms per frame
    for (const X of [4, 8, 9]) for (const layers of [0, 3, 5]) for (const kind of ['timeline', 'morph']) {
        const w = mkHex(X, layers, kind); w.at(0.5); w.draw();
        const d = [], v = []; for (let i = 0; i < 3; i++) { w.at(0.3 + i * 0.2); d.push(ms(() => w.draw())[0]); v.push(ms(() => w.svg())[0]); }
        console.log(J({ hex: X + '/' + X, layers, kind, drawMs: +med(d).toFixed(0), svgMs: +med(v).toFixed(0) }));
    }
} else if (mode === 'zip') {
    // minimal ZIP writer, method 0 (store): local header + data per entry, central directory, end record. No ZIP64 (entries < 65535, sizes < 4 GiB: checked), names ASCII, DOS time fixed.
    const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }; })();
    const zipStore = (entries) => {
        const parts = [], central = []; let off = 0;
        for (const e of entries) {
            const name = Buffer.from(e.name, 'utf8'), data = e.data, crc = CRC(data);
            const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
            lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
            parts.push(lh, name, data);
            const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
            ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
            central.push(ch, name); off += 30 + name.length + data.length;
        }
        const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
        return Buffer.concat([...parts, cd, end]);
    };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zip114-'));
    // payloads: real SVG frames of the timeline scenario; PNG-like payloads: incompressible bytes of the measured PNG size (the browser half gives the real size; 600x600 at density 1 is a few 10 kB)
    const w = mk({ kind: 'timeline', net: FIELD });
    const svgFrames = []; for (let i = 0; i < 300; i++) { w.at(i / 299); svgFrames.push(Buffer.from(w.svg())); }
    const PNG_KB = +(process.argv[3] || 60), png = i => crypto.randomBytes(PNG_KB * 1024 + (i % 7));
    for (const kind of ['svg', 'png']) for (const n of [30, 120, 300]) {
        const entries = Array.from({ length: n }, (_, i) => ({ name: `frame_${String(i + 1).padStart(4, '0')}.${kind}`, data: kind === 'svg' ? svgFrames[i] : png(i) }));
        const raw = entries.reduce((a, e) => a + e.data.length, 0);
        const [tz, z] = ms(() => zipStore(entries));
        const [td, dsize] = ms(() => entries.reduce((a, e) => a + zlib.deflateRawSync(e.data, { level: 6 }).length, 0));
        const f = path.join(tmp, `${kind}-${n}.zip`); fs.writeFileSync(f, z);
        let ok = 'n/a'; try { execSync(`unzip -tq "${f}"`, { stdio: 'pipe' }); ok = 'unzip -t OK'; } catch (e) { ok = 'unzip FAIL ' + String(e.stdout || e.message).slice(0, 80); }
        let py = 'n/a'; try { py = execSync(`python3 -I -c "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip(),len(z.namelist()))" "${f}"`, { stdio: 'pipe' }).toString().trim(); } catch (e) { py = 'python FAIL'; }
        console.log(J({ kind, frames: n, rawMB: +(raw / 1048576).toFixed(2), storeMB: +(z.length / 1048576).toFixed(2), overheadB: z.length - raw, storeMs: +tz.toFixed(1), deflateMB: +(dsize / 1048576).toFixed(2), deflateMs: +td.toFixed(0), unzip: ok, pythonTestzipNames: py }));
    }
    fs.rmSync(tmp, { recursive: true, force: true });
} else { console.error('mode: det | svg | noface | clip | time | zip'); process.exit(2); }
