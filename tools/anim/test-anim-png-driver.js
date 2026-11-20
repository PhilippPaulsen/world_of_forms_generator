/**
 * tools/anim/test-anim-png-driver.js
 * Task 116: the PNG-sequence export driver of sketch.js (runAnimationExport, animExportPrecheck, animExportSizeText, timelineImageCheckIdle) run on stand-ins (no p5, no DOM, no browser), plus the static
 * wiring of the dialog block. The functions are cut out of the REAL sketch.js text (SKETCH_JS replaces the file for the sabotage runs: tools/anim/sabotage-anim-png-driver.js).
 *   node tools/anim/test-anim-png-driver.js
 *
 *  1. The frame sequence: n = 2, 24, 96 (frames) and 4000 ms x 24 fps; the progress values are animFrameTimes, the last is exactly 1; the ZIP has frame_0001.png ... with the bytes of that frame (own reader, unzip -t, zipfile).
 *  2. The state afterwards is the state before: position, paused, start time, netLive, currentFrame, status text, pixel density (set while rendering, put back), also after a cancel and an error; a PLAYING timeline is paused
 *     before the first frame and stays paused at its position.
 *  3. Cancel (before the first frame, in the middle): no download, the state is back. Error (a frame without image, a throwing canvas, frames = 1): no download, state back.
 *  4. Limits: 301 frames and 501 MiB are refused BEFORE anything is touched, with the number that fits. Pre-checks: no timeline, one keyframe, unresolved segment, another clock playing, bilinear.
 *  5. The wait for the timeline's background check; the ZIP parts are the frames' Blobs (not Uint8Arrays); size text.
 *  6. The tree: the eight protected functions and draw() byte-equal to main; sketch.js removed only the two closing lines of the export dialog handlers; core/ unchanged apart from anim-export.js.
 *  7. The wiring: ids in index.html, the script tag before sketch.js, every export.anim.* key in the dictionary in both languages with the same placeholders, the handlers.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), BASE = '94ef6e5b';
const SKETCH = fs.readFileSync(process.env.SKETCH_JS || path.join(ROOT, 'sketch.js'), 'utf8');
let checks = 0, failures = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
process.on('unhandledRejection', (e) => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'anim116-')); process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ } });
const grab = (src, name) => { const m = src.match(new RegExp(`(?:async )?function ${name}\\([\\s\\S]*?\\n\\}\\n`)); if (!m) throw new Error('cannot extract ' + name); return m[0]; };
const NAMES = ['runAnimationExport', 'animExportPrecheck', 'animExportSizeText', 'timelineImageCheckIdle'];
globalThis.timelineImageCheck = { timer: null, job: { queue: [], i: 0 } };
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'core', 'anim-export.js'), 'utf8') + '\n' + NAMES.map(n => grab(SKETCH, n)).join('\n'));
const { runAnimationExport, animExportPrecheck, animExportSizeText, timelineImageCheckIdle } = globalThis;
const ZIPFN = globalThis.animZipWriter;
void ZIPFN;

// the independent reader of the central directory
function readZip(buf) {
    const eocd = buf.length - 22; if (buf.readUInt32LE(eocd) !== 0x06054b50) throw new Error('no end record');
    const n = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16), out = []; let p = cdOff;
    for (let i = 0; i < n; i++) {
        const csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), off = buf.readUInt32LE(p + 42), crc = buf.readUInt32LE(p + 16), method = buf.readUInt16LE(p + 10);
        const name = buf.toString('latin1', p + 46, p + 46 + nl), lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28);
        out.push({ name, method, crc, data: Buffer.from(buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize)) });
        p += 46 + nl + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    }
    return out;
}
const blobBuf = async (b) => Buffer.from(await b.arrayBuffer());
const partsBuf = async (parts) => Buffer.concat(await Promise.all(parts.map(async p => p instanceof Blob ? blobBuf(p) : Buffer.from(p.buffer, p.byteOffset, p.byteLength))));

// ---- the stand-in world ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function mkWorld(o) {
    o = Object.assign({ keyframes: 3, total: 4000, playing: false, bytes: 600, sm: { enabled: true, mode: 'linear', angleDeg: 0 }, idleAfter: 0 }, o);
    const tl = { keyframeLayerIds: Array.from({ length: o.keyframes }, (_, i) => i), segmentDurationsMs: Array.from({ length: Math.max(0, o.keyframes - 1) }, () => o.total / Math.max(1, o.keyframes - 1)),
        elapsedMs: 1234, startTime: 777, playing: o.playing, netLive: false, currentFrame: { segmentIndex: 0, localT: 0.3 } };
    const W = { tl, status: 'Segment 1/2', density: 2, loop: o.playing, log: [], downloads: [], clock: 100000, densitySeen: [], idleCalls: 0, redraws: 0, parts: null, otherClock: false, segOk: true, cancelAfter: Infinity, cancelNow: false, frameCalls: 0, failAt: -1, throwAt: -1 };
    const fakePng = (t, density) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from(String(Math.round(t * 1e6)).padStart(8, '0') + 'd' + density), Buffer.alloc(o.bytes, Math.round(t * 200))]);
    W.fakePng = fakePng;
    W.env = {
        timeline: () => W.tl, totalMs: () => W.tl.segmentDurationsMs.reduce((a, b) => a + b, 0), segmentOk: () => W.segOk, otherClockPlaying: () => W.otherClock, spatialMorph: () => o.sm,
        setProgress: (t) => { W.log.push(['progress', t, W.tl.playing]); W.tl.elapsedMs = t * W.env.totalMs(); W.tl.playing = false; W.tl.netLive = true; W.tl.currentFrame = { segmentIndex: 1, localT: t }; W.status = 'frame ' + t; },
        redraw: () => { W.redraws++; W.log.push(['redraw']); },
        toBlob: async () => { const k = W.frameCalls++; if (k === W.throwAt) throw new Error('canvas lost'); if (k === W.failAt) return null; W.densitySeen.push(W.density); return new Blob([fakePng(W.tl.elapsedMs / W.env.totalMs(), W.density)]); },
        density: { get: () => W.density, set: (d) => { W.log.push(['density', d]); W.density = d; } },
        millis: () => W.clock, now: () => W.clock, sleep: async (ms) => { W.clock += ms; W.log.push(['sleep', ms]); },
        idle: () => { W.idleCalls++; return W.idleCalls > o.idleAfter; },
        pauseBackground: () => { W.log.push(['pauseBackground']); },
        status: { get: () => W.status, set: (h) => { W.status = h; } },
        pauseTimeline: (p) => { W.log.push(['pause', p]); W.tl.elapsedMs = p; W.tl.playing = false; W.loop = false; },
        applyFrame: () => { W.log.push(['applyFrame']); W.tl.currentFrame = { segmentIndex: 1, localT: 0.99 }; W.status = 'applied'; },
        syncLoop: () => { W.log.push(['syncLoop']); },
        makeBlob: (parts, type) => { W.parts = parts; return new Blob(parts, { type }); },
        download: (blob, name) => { W.downloads.push([blob, name]); },
        onProgress: (p) => { W.log.push(['progress-report', p.phase, p.i, p.n]); },
        shouldCancel: () => W.cancelNow || W.log.filter(l => l[0] === 'progress').length >= W.cancelAfter,
    };
    W.snap = () => JSON.stringify([W.tl.elapsedMs, W.tl.playing, W.tl.startTime, W.tl.netLive, W.tl.currentFrame, W.status, W.density]);
    return W;
}
const J = JSON.stringify;
const opts = (more) => Object.assign({ frames: 24, density: 1, bytesPerFrame: 1000 }, more);
const untouched = (W) => !W.log.some(l => ['progress', 'redraw', 'density', 'pause', 'applyFrame'].includes(l[0])) && W.downloads.length === 0;

(async () => {
    console.log('== 1. the frame sequence ==');
    for (const n of [2, 24, 96]) {
        const W = mkWorld(); const r = await runAnimationExport(W.env, opts({ frames: n }));
        const ps = W.log.filter(l => l[0] === 'progress').map(l => l[1]), want = globalThis.animFrameTimes({ frames: n }).times;
        check(`n = ${n}: ok, ${n} frames rendered at animFrameTimes, the last at exactly t = 1, one download of world_of_forms_animation.zip`, r.ok && r.n === n && ps.length === n && ps.every((t, i) => t === want[i]) && ps[n - 1] === 1 && ps[0] === 0 && W.downloads.length === 1 && W.downloads[0][1] === 'world_of_forms_animation.zip', J(r));
        const rd = readZip(await blobBuf(W.downloads[0][0]));
        check(`n = ${n}: the ZIP has frame_0001.png ... in order, store, and each entry holds the bytes of ITS frame`, rd.length === n && rd.every((e, i) => e.name === globalThis.animFrameName(i + 1, n, 'png') && e.method === 0 && e.data.equals(W.fakePng(want[i], 1))));
        check(`n = ${n}: every frame is redrawn after its progress value (progress, redraw, progress, redraw ...)`, (() => { const seq = W.log.filter(l => l[0] === 'progress' || l[0] === 'redraw').map(l => l[0]).slice(0, 2 * n); return seq.every((x, i) => x === (i % 2 === 0 ? 'progress' : 'redraw')); })());
    }
    {
        const W = mkWorld({ total: 4000 }); const r = await runAnimationExport(W.env, { fps: 24, density: 1, bytesPerFrame: 1000 });
        check('4000 ms at 24 fps = 96 frames', r.ok && r.n === 96);
        const f = path.join(TMP, 'seq.zip'); const W2 = mkWorld(); await runAnimationExport(W2.env, opts({ frames: 24 })); fs.writeFileSync(f, await blobBuf(W2.downloads[0][0]));
        let ok = 'skipped';
        try { execFileSync('unzip', ['-tq', f], { stdio: 'pipe' }); ok = true; } catch (e) { ok = e.code === 'ENOENT' ? 'skipped' : false; }
        let py = 'skipped'; try { py = execFileSync('python3', ['-I', '-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip(),len(z.namelist()))', f], { stdio: 'pipe' }).toString().trim(); } catch (e) { py = e.code === 'ENOENT' ? 'skipped' : 'FAIL'; }
        check(`the 24-frame ZIP: unzip -t ${ok === 'skipped' ? '(not available: SKIPPED)' : ''}, Python zipfile ${py === 'skipped' ? '(not available: SKIPPED)' : ''}`, ok !== false && (py === 'skipped' || py === 'None 24'), `${ok} / ${py}`);
    }
    console.log('== 2. the state is put back ==');
    {
        const W = mkWorld(), before = W.snap(); const r = await runAnimationExport(W.env, opts({ density: 1 }));
        check('after an export: position, paused, start time, netLive, currentFrame, status text and pixel density are what they were', r.ok && W.snap() === before, W.snap());
        check('the density was 1 while the frames were taken (and was 2 before and after)', W.densitySeen.length === 24 && W.densitySeen.every(d => d === 1) && W.density === 2);
        const last = W.log.filter(l => l[0] !== 'sleep' && l[0] !== 'progress-report').slice(-4).map(l => l[0]);
        check('the end: applyFrame, syncLoop, a final redraw (the canvas shows the restored position again)', J(last.slice(-3)) === J(['applyFrame', 'syncLoop', 'redraw']), J(last));
        const W2 = mkWorld(), b2 = W2.snap(); await runAnimationExport(W2.env, opts({ density: 2 }));
        check('density 2 equals the stored 2 (nothing to put back) and the state is the same', W2.snap() === b2 && W2.densitySeen.every(d => d === 2));
    }
    {
        const W = mkWorld({ playing: true }); W.tl.startTime = W.clock - 1500; const r = await runAnimationExport(W.env, opts({ frames: 5 }));
        const first = W.log.find(l => l[0] === 'progress'), pause = W.log.find(l => l[0] === 'pause');
        check('a PLAYING timeline is paused at its position (clock - startTime) BEFORE the first frame, and stays paused there afterwards', r.ok && pause[1] === 1500 && W.log.indexOf(pause) < W.log.indexOf(first) && W.tl.playing === false && W.tl.elapsedMs === 1500 && first[2] === false, J(pause));
        const W2 = mkWorld({ playing: true }); W2.tl.startTime = W2.clock - 99999; await runAnimationExport(W2.env, opts({ frames: 3 }));
        check('the paused position is clamped to the total length', W2.tl.elapsedMs === 4000);
    }
    console.log('== 3. cancel and errors ==');
    {
        const W = mkWorld({}), before = W.snap(); W.cancelNow = true; const r = await runAnimationExport(W.env, opts());
        check('cancel before the first frame: code cancelled, nothing rendered, no download, the state is back', !r.ok && r.code === 'cancelled' && r.done === 0 && !W.log.some(l => l[0] === 'progress') && W.downloads.length === 0 && W.snap() === before && W.density === 2);
        const W2 = mkWorld({}), b2 = W2.snap(); W2.cancelAfter = 7; const r2 = await runAnimationExport(W2.env, opts());
        check('cancel after 7 frames: code cancelled, done = 7, no download, no ZIP made, state and density are back', r2.code === 'cancelled' && r2.done === 7 && W2.downloads.length === 0 && W2.parts === null && W2.snap() === b2 && W2.density === 2, J(r2));
        const W3 = mkWorld({ idleAfter: 1e9 }); W3.cancelNow = true; const t0 = W3.clock; const r3 = await runAnimationExport(W3.env, opts());
        check('cancel during the wait for the background check ends the wait at once', r3.code === 'cancelled' && W3.clock === t0);
    }
    {
        const W = mkWorld({}), before = W.snap(); W.failAt = 2; const r = await runAnimationExport(W.env, opts());
        check('a frame without image (toBlob gives null) in frame 3: code error, no download, state and density back', !r.ok && r.code === 'error' && /image/.test(r.message) && W.downloads.length === 0 && W.snap() === before && W.density === 2, J(r));
        const W2 = mkWorld({}), b2 = W2.snap(); W2.throwAt = 4; const r2 = await runAnimationExport(W2.env, opts());
        check('a throwing canvas in frame 5: code error with the message, no download, state back', r2.code === 'error' && /canvas lost/.test(r2.message) && W2.downloads.length === 0 && W2.snap() === b2);
        const W3 = mkWorld({}); const r3 = await runAnimationExport(W3.env, opts({ frames: 1 }));
        check('frames = 1 is an error before anything is touched', r3.code === 'error' && untouched(W3));
        const W4 = mkWorld({}); W4.env.download = () => { throw new Error('blocked'); }; const b4 = W4.snap(); const r4 = await runAnimationExport(W4.env, opts({ frames: 3 }));
        check('a failing download: code error, state back', r4.code === 'error' && /blocked/.test(r4.message) && W4.snap() === b4);
    }
    console.log('== 4. limits and pre-checks ==');
    {
        const W = mkWorld({}), before = W.snap(); const r = await runAnimationExport(W.env, opts({ frames: 301, bytesPerFrame: 100 }));
        check('301 frames: tooBig with 300 allowed, BEFORE anything is touched', r.code === 'tooBig' && r.allowedFrames === 300 && untouched(W) && W.snap() === before, J(r.allowedFrames));
        const W2 = mkWorld({}); const r2 = await runAnimationExport(W2.env, opts({ frames: 100, bytesPerFrame: 6 * 1048576 }));
        check('100 frames of 6 MiB: tooBig (bytes), 83 fit, nothing touched', r2.code === 'tooBig' && r2.allowedFrames === 83 && untouched(W2), J(r2.allowedFrames));
        const W3 = mkWorld({}); const r3 = await runAnimationExport(W3.env, opts({ frames: 300, bytesPerFrame: 1000 }));
        check('exactly 300 frames are fine', r3.ok && r3.n === 300);
        const mk = (f) => { const W = mkWorld({}); f(W); return W; };
        check('no timeline: noTimeline', animExportPrecheck(mk(W => { W.env.timeline = () => null; }).env) === 'noTimeline');
        check('one keyframe: noTimeline', animExportPrecheck(mkWorld({ keyframes: 1 }).env) === 'noTimeline');
        check('a segment that cannot be resolved: unresolved', animExportPrecheck(mk(W => { W.segOk = false; }).env) === 'unresolved');
        { const Wo = mk(w => { w.otherClock = true; }); const ro = await runAnimationExport(Wo.env, opts());
          check('a layer or net animation playing: otherClockPlaying, and the export refuses without touching anything', animExportPrecheck(mk(w => { w.otherClock = true; }).env) === 'otherClockPlaying' && ro.code === 'otherClockPlaying' && untouched(Wo)); }
        check('bilinear morph on: static; bilinear with the morph OFF, linear and radial: allowed', animExportPrecheck(mkWorld({ sm: { enabled: true, mode: 'bilinear' } }).env) === 'static' && animExportPrecheck(mkWorld({ sm: { enabled: false, mode: 'bilinear' } }).env) === null && animExportPrecheck(mkWorld({ sm: { enabled: true, mode: 'radial' } }).env) === null && animExportPrecheck(mkWorld({ sm: null }).env) === null);
        const Wb = mkWorld({ sm: { enabled: true, mode: 'bilinear' } }); const rb = await runAnimationExport(Wb.env, opts());
        check('bilinear: the export is refused with code static, nothing touched', rb.code === 'static' && untouched(Wb));
    }
    console.log('== 5. waiting, parts, text ==');
    {
        const W = mkWorld({ idleAfter: 3 }); const r = await runAnimationExport(W.env, opts({ frames: 3 }));
        const iFirst = W.log.findIndex(l => l[0] === 'progress'), sleeps = W.log.slice(0, iFirst).filter(l => l[0] === 'sleep').length;
        check('the first frame waits until the background check is quiet (3 busy answers = 3 waits of 50 ms)', r.ok && sleeps === 3 && W.idleCalls === 5, sleeps);
        const W2 = mkWorld({ idleAfter: 1e9 }); const t0 = W2.clock; const r2 = await runAnimationExport(W2.env, opts({ frames: 2 }));
        check('a check that never ends does not hold the export: after 15 s it goes on', r2.ok && W2.clock - t0 >= 15000 && W2.clock - t0 < 15200, W2.clock - t0);
        check('a check that never ends is parked once for the export (pauseBackground); one that ends in time is left alone', W2.log.filter(l => l[0] === 'pauseBackground').length === 1 && W.log.filter(l => l[0] === 'pauseBackground').length === 0);
        const W3 = mkWorld({}); await runAnimationExport(W3.env, opts({ frames: 6 }));
        const blobs = W3.parts.filter(p => p instanceof Blob), arrays = W3.parts.filter(p => p instanceof Uint8Array);
        check('the ZIP parts hold the frames as Blobs (6), the Uint8Arrays are only headers and the directory (no frame bytes kept)', blobs.length === 6 && arrays.every(a => a.length < 120), `${blobs.length} blobs, largest array ${Math.max(...arrays.map(a => a.length))}`);
        check('size text: 1,2 MB (de) / 1.2 MB (en), 15 MB, 90 kB, 1 kB minimum', animExportSizeText(1.2 * 1048576, 'de') === '1,2 MB' && animExportSizeText(1.2 * 1048576, 'en') === '1.2 MB' && animExportSizeText(15 * 1048576, 'de') === '15 MB' && animExportSizeText(92160, 'en') === '90 kB' && animExportSizeText(10, 'en') === '1 kB');
        const g = globalThis.timelineImageCheck;
        check('timelineImageCheckIdle: quiet only without a timer and with the queue worked off', (g.timer = null, g.job = { queue: [1, 2], i: 2 }, timelineImageCheckIdle()) && (g.job = { queue: [1, 2], i: 1 }, !timelineImageCheckIdle()) && (g.job = { queue: [], i: 0 }, g.timer = 5, !timelineImageCheckIdle()));
    }
    console.log('== 6. the tree ==');
    {
        let git = true; const show = (rel) => execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
        try { execFileSync('git', ['rev-parse', '--verify', '--quiet', BASE + '^{commit}'], { cwd: ROOT, stdio: 'ignore' }); } catch (e) { git = false; }
        if (!git) check('the tree checks (git base commit not available here: SKIPPED)', true);
        else {
            const old = show('sketch.js'), PROT = ['applyTimelineFrame', 'applyLayerConnectionsMorphFrame', 'resolveTimelineKeyframeCoords', 'resolveTimelineSegment', 'totalTimelineDurationMs', 'setTimelineProgress', 'toggleTimelinePlayback', 'previewTimelineSegmentMidpoint', 'draw'];
            check('the eight protected functions and draw() are byte-equal to main', PROT.every(n => grab(SKETCH, n) === grab(old, n)));
            const diff = execFileSync('git', ['diff', '-U0', BASE, '--', 'sketch.js'], { cwd: ROOT, maxBuffer: 1 << 28 }).toString().split('\n');
            const removed = diff.filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => '-' + l.slice(1).trim());
            // the working tree may already be committed: then diff against BASE is the whole change as well
            check('sketch.js removed only two lines of the export dialog handlers (Close and the backdrop click, now guarded)', removed.length <= 2 && removed.every(l => l === "-exportOverlay.addClass('hidden');" || l === "-if (e.target.id === 'export-overlay') exportOverlay.addClass('hidden');"), J(removed));
            const core = execFileSync('git', ['diff', '--name-only', BASE, '--', 'core/'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
            check('core/ differs from main only in anim-export.js', core.every(f => f === 'core/anim-export.js'), J(core));
        }
    }
    console.log('== 7. the wiring ==');
    {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), i18n = fs.readFileSync(path.join(ROOT, 'ui-i18n.js'), 'utf8');
        const ids = ['export-anim', 'export-anim-fps', 'export-anim-frames', 'export-anim-size1', 'export-anim-size2', 'export-anim-estimate', 'export-anim-msg', 'export-anim-start', 'export-anim-progress', 'export-anim-progress-text', 'export-anim-cancel', 'export-anim-run'];
        check('index.html has every id the driver reads; the block is hidden by default; the run area too', ids.every(id => html.includes(`id="${id}"`)) && /id="export-anim"[^>]*\bhidden\b/.test(html) && /id="export-anim-run"[^>]*\bhidden\b/.test(html));
        const iA = html.indexOf('core/anim-export.js'), iS = html.indexOf('src="sketch.js'), iE = html.indexOf('core/export.js?v');
        check('the script tag of core/anim-export.js sits after core/export.js and before sketch.js, with ?v=', iE > 0 && iA > iE && iA < iS && /core\/anim-export\.js\?v=\d+[a-z]+/.test(html));
        const used = [...new Set([...SKETCH.matchAll(/animExportT\('([A-Za-z0-9]+)'/g)].map(m => m[1]).concat([...SKETCH.matchAll(/'(?:otherClock|framesInvalid|cancelled|done|error|tooBig|static|unresolved)'/g)].map(m => m[0].replace(/'/g, ''))), [...html.matchAll(/data-i18n="export\.anim\.([A-Za-z0-9]+)"/g)].map(m => m[1]))];
        const dict = {}; for (const m of i18n.matchAll(/'export\.anim\.([A-Za-z0-9]+)': \{ de: '([^']*)', en: '([^']*)' \}/g)) dict[m[1]] = { de: m[2], en: m[3] };
        const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join();
        check('every export.anim key used (code and markup) is in the dictionary, German and English, with the same placeholders', used.length >= 15 && used.every(k => dict[k] && dict[k].de && dict[k].en && ph(dict[k].de) === ph(dict[k].en)), used.length + ' keys; missing: ' + used.filter(k => !dict[k]).join(','));
        const authored = [...html.matchAll(/data-i18n="export\.anim\.([A-Za-z0-9]+)">([^<]*)</g)];
        check('the German of every markup key equals the authored text', authored.length >= 7 && authored.every(m => dict[m[1]] && dict[m[1]].de === m[2]), authored.filter(m => !dict[m[1]] || dict[m[1]].de !== m[2]).map(m => m[1]).join(','));
        check('handlers: the dialog opens the block, Close / backdrop cancel a running export, animExportInit() is called in setup()', /exportOverlay\.removeClass\('hidden'\);\s*animExportDialogOpened\(\);/.test(SKETCH) && (SKETCH.match(/animExportCancelIfRunning\(\)/g) || []).length >= 3 && /\n    animExportInit\(\);\n/.test(SKETCH));
    }
    console.log(`\n${checks - failures}/${checks} checks passed`);
    process.exit(failures ? 1 : 0);
})();
