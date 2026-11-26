/**
 * tools/anim/test-anim-svg-driver.js
 * Task 117: the SVG-sequence branch of the export driver of sketch.js (runAnimationExport with format 'svg', animExportSvgString, animExportProbeSvg) on stand-ins (no p5, no DOM, no browser), plus the static wiring
 * of the dialog. The functions are cut out of the REAL sketch.js text (SKETCH_JS replaces the file for the sabotage runs: tools/anim/sabotage-anim-svg-driver.js).
 *   node tools/anim/test-anim-svg-driver.js
 *
 *  1. The sequence: n = 2, 24, 96; the progress values are animFrameTimes, the last exactly 1; frame_0001.svg ...; method 8 (deflate-raw), each entry inflates to the SVG of ITS t; `unzip -t`, Python zipfile.
 *  2. THE FLAGS: with noFaces the face flags (the base and every layer) are off only inside generateSVGString and are back BEFORE THE FIRST AWAIT of the frame (checked at the deflate call and at every sleep),
 *     exactly as they were (mixed on / off), also when generateSVGString throws; with faces on they are never touched.
 *  3. State as the PNG export: position, paused, status text, start time, netLive, currentFrame back (also after a cancel and an error); NO pixel density, NO toBlob, NO redraw per frame in the SVG branch.
 *  4. Limits (estimate with the PACKED size), noCompression, pre-checks; nothing is touched when refused.
 *  5. The probe frame changes nothing and reports raw / packed / times; the PNG branch is still the PNG branch.
 *  6. The tree: the eight protected functions and draw() byte-equal to main; core/export.js and core/ (but anim-export.js) unchanged; no block comment added to sketch.js.
 *  7. The wiring: ids, the script tag, the dictionary (DE and EN, placeholders), the German of the markup keys, the handlers.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), zlib = require('zlib'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), BASE = '4e182dfb';
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
let checks = 0, failures = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('unhandledRejection', (e) => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'anim117-')); process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ } });
const grab = (src, name) => { const m = src.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const NAMES = ['runAnimationExport', 'animExportPrecheck', 'animExportSvgString', 'animExportProbeSvg', 'animExportSizeText', 'timelineImageCheckIdle'];
globalThis.timelineImageCheck = { timer: null, job: { queue: [], i: 0 } };
globalThis.showFaces = true; globalThis.additionalLayers = []; globalThis.generateSVGString = () => '';
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'core', 'anim-export.js'), 'utf8') + '\n' + NAMES.map(n => grab(SKETCH, n)).join('\n'));
const G = globalThis;
function readZip(buf) {
    const eocd = buf.length - 22; if (buf.readUInt32LE(eocd) !== 0x06054b50) throw new Error('no end record');
    const n = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16), out = []; let p = cdOff;
    for (let i = 0; i < n; i++) {
        const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), off = buf.readUInt32LE(p + 42), crc = buf.readUInt32LE(p + 16), method = buf.readUInt16LE(p + 10);
        const name = buf.toString('latin1', p + 46, p + 46 + nl), lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28);
        const raw = buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
        out.push({ name, method, crc, csize, usize, data: method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw) });
        p += 46 + nl + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    }
    return out;
}
const blobBuf = async (b) => Buffer.from(await b.arrayBuffer());
const J = JSON.stringify;

function mkWorld(o) {
    o = Object.assign({ keyframes: 3, total: 4000, playing: false, sm: { enabled: true, mode: 'linear' }, idleAfter: 0, layers: [true, false, true], base: true, noDeflate: false }, o);
    const tl = { keyframeLayerIds: Array.from({ length: o.keyframes }, (_, i) => i), segmentDurationsMs: Array.from({ length: Math.max(0, o.keyframes - 1) }, () => o.total / Math.max(1, o.keyframes - 1)),
        elapsedMs: 1234, startTime: 777, playing: o.playing, netLive: false, currentFrame: { segmentIndex: 0, localT: 0.3 } };
    const W = { tl, status: 'Segment 1/2', density: 2, log: [], downloads: [], clock: 100000, flagsAt: [], genCalls: [], redraws: 0, blobCalls: 0, throwAt: -1, frame: 0, cancelNow: false, cancelAfter: Infinity, idleCalls: 0, parts: null };
    G.showFaces = o.base; G.additionalLayers = o.layers.map((f) => ({ showFaces: f }));
    W.flags = () => J([G.showFaces, G.additionalLayers.map(l => l.showFaces)]);
    W.orig = W.flags();
    const svgOf = (t, faces) => '<svg xmlns="http://www.w3.org/2000/svg">' + `<path d="M0,0L${Math.round(t * 1000)},1"/>`.repeat(20) + (faces ? `<polygon points="0,0 ${Math.round(t * 1000)},0 1,1"/>`.repeat(30) : '') + '</svg>\n';
    W.svgOf = svgOf;
    G.generateSVGString = () => { const k = W.genCalls.length; W.genCalls.push(W.flags()); if (k === W.throwAt) throw new Error('svg broke'); return svgOf(W.tl.elapsedMs / (W.tl.segmentDurationsMs.reduce((a, b) => a + b, 0)), G.showFaces); };
    W.env = {
        timeline: () => W.tl, totalMs: () => W.tl.segmentDurationsMs.reduce((a, b) => a + b, 0), segmentOk: () => true, otherClockPlaying: () => false, morphBlock: () => o.sm,
        setProgress: (t) => { W.log.push(['progress', t, W.tl.playing]); W.tl.elapsedMs = t * W.env.totalMs(); W.tl.playing = false; W.tl.netLive = true; W.tl.currentFrame = { segmentIndex: 1, localT: t }; W.status = 'frame ' + t; },
        redraw: () => { W.redraws++; W.log.push(['redraw']); },
        toBlob: async () => { W.blobCalls++; return null; },
        density: { get: () => { W.log.push(['density-get']); return W.density; }, set: (d) => { W.log.push(['density', d]); W.density = d; } },
        millis: () => W.clock, now: () => W.clock, sleep: async (ms) => { W.clock += ms; W.log.push(['sleep', ms]); W.flagsAt.push(['sleep', W.flags()]); },
        idle: () => { W.idleCalls++; return W.idleCalls > o.idleAfter; }, pauseBackground: () => { W.log.push(['pauseBackground']); },
        status: { get: () => W.status, set: (h) => { W.status = h; } },
        pauseTimeline: (p) => { W.log.push(['pause', p]); W.tl.elapsedMs = p; W.tl.playing = false; },
        applyFrame: () => { W.log.push(['applyFrame']); W.tl.currentFrame = { segmentIndex: 1, localT: 0.99 }; W.status = 'applied'; }, syncLoop: () => { W.log.push(['syncLoop']); },
        makeBlob: (parts, type) => { W.parts = parts; return new Blob(parts, { type }); }, download: (blob, name) => { W.downloads.push([blob, name]); },
        onProgress: () => { }, shouldCancel: () => W.cancelNow || W.log.filter(l => l[0] === 'progress').length >= W.cancelAfter,
        svgFrame: (nf) => G.animExportSvgString(nf), encode: (s) => new TextEncoder().encode(s),
        deflate: o.noDeflate ? null : async (b) => { W.flagsAt.push(['deflate', W.flags()]); await new Promise(r => setImmediate(r)); return new Uint8Array(zlib.deflateRawSync(b)); },
    };
    W.snap = () => J([W.tl.elapsedMs, W.tl.playing, W.tl.startTime, W.tl.netLive, W.tl.currentFrame, W.status, W.density]);
    return W;
}
const opts = (more) => Object.assign({ frames: 24, format: 'svg', bytesPerFrame: 1000, density: 1 }, more);
const untouched = (W) => !W.log.some(l => ['progress', 'redraw', 'density', 'pause', 'applyFrame'].includes(l[0])) && W.downloads.length === 0 && W.genCalls.length === 0;
const run = (...a) => G.runAnimationExport(...a);

(async () => {
    console.log('== 1. the sequence ==');
    for (const n of [2, 24, 96]) {
        const W = mkWorld(); const r = await run(W.env, opts({ frames: n }));
        const ps = W.log.filter(l => l[0] === 'progress').map(l => l[1]), want = G.animFrameTimes({ frames: n }).times;
        check(`n = ${n}: ok, ${n} frames at animFrameTimes, the last exactly t = 1, one download world_of_forms_animation_svg.zip`, r.ok && r.n === n && ps.length === n && ps.every((t, i) => t === want[i]) && ps[n - 1] === 1 && W.downloads.length === 1 && W.downloads[0][1] === 'world_of_forms_animation_svg.zip', J(r));
        const rd = readZip(await blobBuf(W.downloads[0][0]));
        check(`n = ${n}: frame_0001.svg ... in order, method 8, and each entry inflates to the SVG of ITS frame (CRC and sizes right)`, rd.length === n && rd.every((e, i) => e.name === G.animFrameName(i + 1, n, 'svg') && e.method === 8 && e.data.toString() === W.svgOf(want[i], true) && e.usize === e.data.length && e.csize < e.usize));
    }
    {
        const W = mkWorld(); await run(W.env, opts({ frames: 12 })); const f = path.join(TMP, 'svg.zip'); fs.writeFileSync(f, await blobBuf(W.downloads[0][0]));
        let u = 'skipped'; try { execFileSync('unzip', ['-tq', f], { stdio: 'pipe' }); u = true; } catch (e) { u = e.code === 'ENOENT' ? 'skipped' : false; }
        let py = 'skipped'; try { py = execFileSync('python3', ['-I', '-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip(),len(z.namelist()),set(i.compress_type for i in z.infolist()))', f], { stdio: 'pipe' }).toString().trim(); } catch (e) { py = e.code === 'ENOENT' ? 'skipped' : 'FAIL'; }
        check('the 12-frame ZIP: unzip -t and Python zipfile (compress_type 8 for every entry)', u !== false && (py === 'skipped' || py === 'None 12 {8}'), `${u} / ${py}`);
        const Wp = mkWorld(); const rp = await run(Wp.env, opts({ fps: 24, frames: undefined }));
        check('4000 ms at 24 fps = 96 SVG frames', rp.ok && rp.n === 96);
        const Wb = mkWorld(); await run(Wb.env, opts({ frames: 6 }));
        check('the ZIP parts hold the frames as Blobs of the PACKED bytes (6), the Uint8Arrays are only headers and the directory', Wb.parts.filter(p => p instanceof Blob).length === 6 && Wb.parts.filter(p => p instanceof Uint8Array).every(a => a.length < 120));
    }
    console.log('== 2. the flags ==');
    {
        const W = mkWorld(); const orig = W.orig; const r = await run(W.env, opts({ frames: 6, noFaces: true }));
        check('noFaces: generateSVGString sees ALL flags off (the base, every layer), the frame result has no polygons, the SVGs are the ones without faces', r.ok && W.genCalls.every(f => f === J([false, [false, false, false]])) && readZip(await blobBuf(W.downloads[0][0])).every((e, i) => e.data.toString() === W.svgOf(G.animFrameTimes({ frames: 6 }).times[i], false)), W.genCalls[0]);
        check('noFaces: the flags are back, exactly as they were (base on, layers on / off / on), at the end', W.flags() === orig, W.flags());
        check('noFaces: the flags are back BEFORE THE FIRST AWAIT of every frame (at every deflate call and at every sleep)', W.flagsAt.length >= 12 && W.flagsAt.every(([, f]) => f === orig), J(W.flagsAt.filter(([, f]) => f !== orig).slice(0, 1)));
        const W2 = mkWorld({ base: false, layers: [false, true] }); await run(W2.env, opts({ frames: 3, noFaces: true }));
        check('mixed original flags (base off, layers off / on) are restored exactly', W2.flags() === W2.orig && W2.flagsAt.every(([, f]) => f === W2.orig));
        const W3 = mkWorld(); W3.throwAt = 2; const r3 = await run(W3.env, opts({ frames: 6, noFaces: true }));
        check('generateSVGString throws in frame 3: code error with the message, the flags are back, no download, the state is back', r3.code === 'error' && /svg broke/.test(r3.message) && W3.flags() === W3.orig && W3.downloads.length === 0);
        const W4 = mkWorld(); await run(W4.env, opts({ frames: 4 }));
        check('with faces: the flags are never changed (every call sees them as they were)', W4.genCalls.every(f => f === W4.orig) && W4.flagsAt.every(([, f]) => f === W4.orig));
        const W5 = mkWorld(); W5.cancelAfter = 3; await run(W5.env, opts({ frames: 6, noFaces: true }));
        check('a cancel after 3 frames leaves the flags as they were', W5.flags() === W5.orig);
    }
    console.log('== 3. the state, no canvas ==');
    {
        const W = mkWorld(), before = W.snap(); const r = await run(W.env, opts({ frames: 5 }));
        check('after an export: position, paused, start time, netLive, currentFrame, status and density are what they were', r.ok && W.snap() === before, W.snap());
        check('NO pixel density call (get or set), NO toBlob, and exactly ONE redraw (the final one after the restore) in the SVG branch', !W.log.some(l => l[0] === 'density' || l[0] === 'density-get') && W.blobCalls === 0 && W.redraws === 1, `${W.redraws} redraws`);
        const last = W.log.filter(l => l[0] !== 'sleep').slice(-3).map(l => l[0]);
        check('the end: applyFrame, syncLoop, a final redraw', J(last) === J(['applyFrame', 'syncLoop', 'redraw']), J(last));
        const Wp = mkWorld({ playing: true }); Wp.tl.startTime = Wp.clock - 1500; const rp = await run(Wp.env, opts({ frames: 3 }));
        const pause = Wp.log.find(l => l[0] === 'pause');
        check('a PLAYING timeline is paused at its position BEFORE the first frame and stays paused there', rp.ok && pause[1] === 1500 && Wp.log.indexOf(pause) < Wp.log.findIndex(l => l[0] === 'progress') && Wp.tl.playing === false && Wp.tl.elapsedMs === 1500);
        const Wc = mkWorld(), bc = Wc.snap(); Wc.cancelAfter = 2; const rc = await run(Wc.env, opts({ frames: 6 }));
        check('cancel after 2 frames: cancelled, no download, state back', rc.code === 'cancelled' && rc.done === 2 && Wc.downloads.length === 0 && Wc.snap() === bc);
        const We = mkWorld(), be = We.snap(); We.env.deflate = async () => { throw new Error('pack failed'); }; const re = await run(We.env, opts({ frames: 4 }));
        check('a failing compression: code error, no download, state and flags back', re.code === 'error' && /pack failed/.test(re.message) && We.downloads.length === 0 && We.snap() === be && We.flags() === We.orig);
    }
    console.log('== 4. limits and pre-checks ==');
    {
        const W = mkWorld(); const r = await run(W.env, opts({ frames: 301, bytesPerFrame: 100 }));
        check('301 frames: tooBig with 300 allowed, nothing touched (no frame generated)', r.code === 'tooBig' && r.allowedFrames === 300 && untouched(W));
        const W2 = mkWorld(); const r2 = await run(W2.env, opts({ frames: 100, bytesPerFrame: 6 * 1048576 }));
        check('100 frames of 6 MiB PACKED: tooBig (bytes), 83 fit, nothing touched', r2.code === 'tooBig' && r2.allowedFrames === 83 && untouched(W2));
        const W3 = mkWorld({ noDeflate: true }); const r3 = await run(W3.env, opts({ frames: 5 }));
        check('no CompressionStream (env.deflate missing): noCompression, nothing touched', r3.code === 'noCompression' && untouched(W3));
        const W4 = mkWorld({ sm: { enabled: true, mode: 'bilinear' } }); const r4 = await run(W4.env, opts());
        check('bilinear: static, nothing touched', r4.code === 'static' && untouched(W4));
        const W5 = mkWorld({ keyframes: 1 }); const r5 = await run(W5.env, opts());
        check('one keyframe: noTimeline, nothing touched', r5.code === 'noTimeline' && untouched(W5));
        const W6 = mkWorld(); const r6 = await run(W6.env, opts({ frames: 1 }));
        check('frames = 1 is an error before anything is touched', r6.code === 'error' && untouched(W6));
    }
    console.log('== 5. the probe, the PNG branch ==');
    {
        const W = mkWorld(), before = W.snap(); const p = await G.animExportProbeSvg(W.env, false);
        check('the probe: raw, packed (smaller), times; it changes no state (no progress, no pause, no redraw), generates ONE frame', p.raw > p.packed && p.packed > 0 && typeof p.genMs === 'number' && typeof p.packMs === 'number' && W.snap() === before && W.genCalls.length === 1 && W.log.filter(l => l[0] !== 'sleep').length === 0, J(p));
        const W2 = mkWorld(); const p2 = await G.animExportProbeSvg(W2.env, true);
        check('the probe without faces is smaller than the probe with faces, and the flags are back', p2.raw < p.raw && W2.flags() === W2.orig && W2.flagsAt.every(([, f]) => f === W2.orig));
        const Wn = mkWorld(); Wn.env.toBlob = async () => { Wn.blobCalls++; return new Blob([Buffer.from('PNGDATA' + Wn.tl.elapsedMs)]); };
        const rn = await run(Wn.env, { frames: 3, density: 1, bytesPerFrame: 1000 });
        const rdn = readZip(await blobBuf(Wn.downloads[0][0]));
        check('without opts.format the export is still the PNG sequence: store, frame_0001.png, density set, toBlob used, no deflate, no generateSVGString', rn.ok && Wn.downloads[0][1] === 'world_of_forms_animation.zip' && rdn.every(e => e.name.endsWith('.png') && e.method === 0) && Wn.blobCalls === 3 && Wn.log.some(l => l[0] === 'density') && Wn.genCalls.length === 0 && Wn.flagsAt.every(([k]) => k !== 'deflate'));
    }
    console.log('== 6. the tree ==');
    {
        let git = true; const show = (rel) => execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
        try { execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' }); } catch (e) { git = false; }
        if (!git) check('the tree checks (the base commit is not available here: SKIPPED)', true);
        else {
            const old = show('sketch.js'), PROT = ['applyTimelineFrame', 'applyLayerConnectionsMorphFrame', 'resolveTimelineKeyframeCoords', 'resolveTimelineSegment', 'totalTimelineDurationMs', 'setTimelineProgress', 'toggleTimelinePlayback', 'previewTimelineSegmentMidpoint', 'draw'];
            check('the eight protected functions and draw() are byte-equal to main', PROT.every(n => grab(SKETCH, n) === grab(old, n)));
            const core = execFileSync('git', ['diff', '--name-only', BASE, '--', 'core/'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
            check('core/ differs from main only in anim-export.js; core/export.js is byte-equal', core.every(f => f === 'core/anim-export.js' || f === 'core/netwarp.js' || f === 'core/curves.js' || f === 'core/session.js' /* task 121: 3C-1 */ || f === 'core/session-apply.js' || f === 'core/session-store.js' /* task 138: ?lang= */ || f === 'core/state.js' /* task 133: the session field uiMode (session.js, session-apply.js, state.js) */) && !core.includes('core/export.js'), J(core));
            const n = (s, re) => (s.match(re) || []).length;
            check('no block comment was added to sketch.js (the old source-text tests strip comments with a regex): the same count of "/*" and "*/" as main', n(SKETCH, /\/\*/g) === n(old, /\/\*/g) && n(SKETCH, /\*\//g) === n(old, /\*\//g));
            const rest = SKETCH.replace(/\/\/ The spatial morph's write and read access[\s\S]*?window\.getSpatialMorph = getSpatialMorph;\n/, '').replace(/\/\/ d3 \(K3\): "only conclusive pairings"[\s\S]*?\nfunction timelineConclusiveView\([\s\S]*?\n\}\n/, '');
            check('the word spatialMorph (case as written) stays out of the driver text', !/spatialMorph/.test(grab(SKETCH, 'runAnimationExport') + grab(SKETCH, 'animExportPrecheck') + grab(SKETCH, 'animExportSvgString') + grab(SKETCH, 'animExportProbeSvg')) && /spatialMorph/.test(rest) === /spatialMorph/.test(old.replace(/\/\/ The spatial morph's write and read access[\s\S]*?window\.getSpatialMorph = getSpatialMorph;\n/, '').replace(/\/\/ d3 \(K3\): "only conclusive pairings"[\s\S]*?\nfunction timelineConclusiveView\([\s\S]*?\n\}\n/, '')));
        }
    }
    console.log('== 7. the wiring ==');
    {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), i18n = fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8');
        const ids = ['export-anim-fmt-png', 'export-anim-fmt-svg', 'export-anim-size-group', 'export-anim-faces-group', 'export-anim-faces-on', 'export-anim-faces-off', 'export-anim-netnote', 'export-anim-estimate', 'export-anim-msg', 'export-anim-start', 'export-anim-size1', 'export-anim-size2'];
        check('index.html has the new ids; the faces group and the net note are hidden by default; PNG is the pressed format and "with faces" the pressed faces button', ids.every(id => html.includes(`id="${id}"`)) && /id="export-anim-faces-group"[^>]*\bhidden\b/.test(html) && /id="export-anim-netnote"[^>]*\bhidden\b/.test(html) && /id="export-anim-fmt-png"[^>]*aria-pressed="true"/.test(html) && /id="export-anim-fmt-svg"[^>]*aria-pressed="false"/.test(html) && /id="export-anim-faces-on"[^>]*aria-pressed="true"/.test(html));
        const dict = {}; for (const m of i18n.matchAll(/'export\.anim\.([A-Za-z0-9]+)': \{ de: '([^']*)', en: '([^']*)' \}/g)) dict[m[1]] = { de: m[2], en: m[3] };
        const used = [...new Set([...SKETCH.matchAll(/animExportT\('([A-Za-z0-9]+)'/g)].map(m => m[1]).concat(['noCompression', 'tooBigSvg', 'otherClock', 'framesInvalid', 'cancelled', 'done', 'error', 'tooBig', 'static', 'unresolved'], [...html.matchAll(/data-i18n="export\.anim\.([A-Za-z0-9]+)"/g)].map(m => m[1])))];
        const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join();
        check('every export.anim key used (code and markup) is in the dictionary, German and English, with the same placeholders', used.length >= 20 && used.every(k => dict[k] && dict[k].de && dict[k].en && ph(dict[k].de) === ph(dict[k].en)), used.filter(k => !dict[k]).join(','));
        const authored = [...html.matchAll(/data-i18n="export\.anim\.([A-Za-z0-9]+)">([^<]*)</g)];
        check('the German of every markup key equals the authored text (the format buttons and the faces buttons included)', authored.length >= 12 && authored.every(m => dict[m[1]] && dict[m[1]].de === m[2]) && ['formatPng', 'formatSvg', 'facesOn', 'facesOff'].every(k => authored.some(m => m[1] === k)), authored.filter(m => !dict[m[1]] || dict[m[1]].de !== m[2]).map(m => m[1]).join(','));
        check('the script tag of core/anim-export.js is still before sketch.js with ?v=; the handlers of the format and faces buttons exist', /core\/anim-export\.js\?v=\d+[a-z]+/.test(html) && html.indexOf('core/anim-export.js') < html.indexOf('src="sketch.js') && ['fmtPng', 'fmtSvg', 'facesOn', 'facesOff'].every(k => new RegExp('E\\.' + k + "\\.addEventListener\\('click'").test(SKETCH)));
        check('the lock of the running export covers the new buttons', /\[E\.fps, E\.frames, E\.s1, E\.s2, E\.fmtPng, E\.fmtSvg, E\.facesOn, E\.facesOff, E\.start\]/.test(SKETCH));
    }
    console.log(`\n${checks - failures}/${checks} checks passed`);
    process.exit(failures ? 1 : 0);
})();
