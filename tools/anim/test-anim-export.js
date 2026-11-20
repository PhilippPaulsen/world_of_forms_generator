/**
 * tools/anim/test-anim-export.js
 * Task 115: core/anim-export.js, the pure building blocks of the animation export (frame times, names, CRC-32, ZIP writer, estimate and limits).
 *   node tools/anim/test-anim-export.js
 *   ANIM_EXPORT_JS=/path/to/copy.js node tools/anim/test-anim-export.js      (the sabotage runs: tools/anim/sabotage-anim-export.js makes the copies; the repo file is never written)
 *
 *  1. Frame times: n = 2, 96, 300; { totalMs, fps } rounding and the minimum of 2; the last frame at exactly t = 1; bad input throws.
 *  2. Names: four digits, more past 9999; bad input throws.
 *  3. CRC-32 against zlib (the check value 0xCBF43926, random buffers, chunked with a seed).
 *  4. ZIP, store and deflate-raw: read back by an own parser of the central directory, by `unzip -t` and by Python zipfile (when present): names, bytes, CRC, sizes, methods;
 *     an asynchronous deflate; 0 entries; bad names, duplicates, wrong types, add after finish, a missing deflate function.
 *  5. The limits of the format: 65 535 entries pass and read back, the 65 536th throws; a size past 4 GiB throws (no ZIP64).
 *  6. The estimate: the total equals the real ZIP size, which limit bites (frames / bytes / both / none), how many frames still fit, custom limits, bad input.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib'), crypto = require('crypto'), { execFileSync } = require('child_process');
const A = require(process.env.ANIM_EXPORT_JS || path.join(__dirname, '..', '..', 'core', 'anim-export.js'));

let checks = 0, failures = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const throwsR = (f, re) => { try { f(); return false; } catch (e) { return !re || re.test(String(e && e.message)); } };
const rejectsR = async (f, re) => { try { await f(); return false; } catch (e) { return !re || re.test(String(e && e.message)); } };
process.on('unhandledRejection', (e) => { console.log('FAIL  the test run itself crashed: ' + (e && e.stack)); process.exit(1); });
const join = (parts) => Buffer.concat(parts.map(p => Buffer.from(p.buffer, p.byteOffset, p.byteLength)));
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'anim115-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ } });
const HAVE_UNZIP = (() => { try { execFileSync('unzip', ['-v'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();
const HAVE_PY = (() => { try { execFileSync('python3', ['-I', '-c', 'import zipfile'], { stdio: 'pipe' }); return true; } catch (e) { return false; } })();

// an independent reader of the central directory (not the writer's code)
function readZip(buf) {
    const eocd = buf.length - 22;
    if (buf.readUInt32LE(eocd) !== 0x06054b50) throw new Error('no end record');
    const n = buf.readUInt16LE(eocd + 10), cdSize = buf.readUInt32LE(eocd + 12), cdOff = buf.readUInt32LE(eocd + 16);
    if (buf.readUInt16LE(eocd + 8) !== n) throw new Error('entry counts differ');
    if (cdOff + cdSize !== eocd) throw new Error('directory does not end at the end record');
    const out = []; let p = cdOff;
    for (let i = 0; i < n; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central header ' + i);
        const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), off = buf.readUInt32LE(p + 42);
        const name = buf.toString('latin1', p + 46, p + 46 + nl);
        if (buf.readUInt32LE(off) !== 0x04034b50) throw new Error('bad local header ' + i);
        const lnl = buf.readUInt16LE(off + 26), lel = buf.readUInt16LE(off + 28), lm = buf.readUInt16LE(off + 8), lcrc = buf.readUInt32LE(off + 14), lcs = buf.readUInt32LE(off + 18), lus = buf.readUInt32LE(off + 22);
        if (lm !== method || lcrc !== crc || lcs !== csize || lus !== usize || buf.toString('latin1', off + 30, off + 30 + lnl) !== name) throw new Error('local and central header differ at ' + i);
        const raw = buf.subarray(off + 30 + lnl + lel, off + 30 + lnl + lel + csize);
        out.push({ name, method, crc, csize, usize, data: method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw) });
        p += 46 + nl + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    }
    return out;
}
const refCrc = (b) => (typeof zlib.crc32 === 'function') ? zlib.crc32(b) : Number(execFileSync('python3', ['-I', '-c', 'import sys,zlib;print(zlib.crc32(sys.stdin.buffer.read()))'], { input: b }).toString());

(async () => {
    console.log('== 1. frame times ==');
    {
        const r2 = A.animFrameTimes({ frames: 2 });
        check('n = 2: [0, 1]', r2.n === 2 && r2.times.length === 2 && r2.times[0] === 0 && r2.times[1] === 1);
        for (const n of [96, 300, 7, 1000]) {
            const r = A.animFrameTimes({ frames: n }), t = r.times;
            let inc = true, exact = true; for (let i = 0; i < n; i++) { if (i > 0 && !(t[i] > t[i - 1])) inc = false; if (i < n - 1 && t[i] !== i / (n - 1)) exact = false; }
            check(`n = ${n}: first t = 0, LAST t = 1 exactly, t_i = i/(n-1), strictly increasing`, r.n === n && t.length === n && t[0] === 0 && t[n - 1] === 1 && inc && exact);
        }
        check('4000 ms at 24 fps = 96 frames', A.animFrameTimes({ totalMs: 4000, fps: 24 }).n === 96);
        check('2000 ms at 24 fps = 48 frames; 2000 ms at 30 fps = 60', A.animFrameTimes({ totalMs: 2000, fps: 24 }).n === 48 && A.animFrameTimes({ totalMs: 2000, fps: 30 }).n === 60);
        check('rounding: 1000 ms at 2.4 fps (2.4 -> 2), 1000 ms at 2.5 fps (2.5 -> 3), 1000 ms at 3.6 fps (3.6 -> 4)', A.animFrameTimes({ totalMs: 1000, fps: 2.4 }).n === 2 && A.animFrameTimes({ totalMs: 1000, fps: 2.5 }).n === 3 && A.animFrameTimes({ totalMs: 1000, fps: 3.6 }).n === 4);
        const tiny = A.animFrameTimes({ totalMs: 10, fps: 1 });
        check('a clip shorter than one frame still has 2 frames (0 and 1)', tiny.n === 2 && tiny.times[0] === 0 && tiny.times[1] === 1);
        check('frames wins over totalMs and fps when given', A.animFrameTimes({ frames: 5, totalMs: 9999, fps: 99 }).n === 5);
        check('bad input throws: frames 0, 1, 2.5, -3, "4", NaN', [0, 1, 2.5, -3, '4', NaN].every(f => throwsR(() => A.animFrameTimes({ frames: f }), /frames/)));
        check('bad input throws: totalMs 0, -1, NaN, Infinity, "5"; fps 0, -1, NaN; no options', [0, -1, NaN, Infinity, '5'].every(v => throwsR(() => A.animFrameTimes({ totalMs: v, fps: 24 }), /totalMs/)) && [0, -1, NaN].every(v => throwsR(() => A.animFrameTimes({ totalMs: 1000, fps: v }), /fps/)) && throwsR(() => A.animFrameTimes()) && throwsR(() => A.animFrameTimes({})));
    }
    console.log('== 2. names ==');
    {
        check('frame_0001.png, frame_0096.svg', A.animFrameName(1, 96, 'png') === 'frame_0001.png' && A.animFrameName(96, 96, 'svg') === 'frame_0096.svg');
        check('n = 9999: four digits to the end', A.animFrameName(9999, 9999, 'png') === 'frame_9999.png');
        check('n = 10000: five digits for EVERY frame (the names sort the same way)', A.animFrameName(1, 10000, 'png') === 'frame_00001.png' && A.animFrameName(10000, 10000, 'svg') === 'frame_10000.svg');
        check('n = 100000: six digits', A.animFrameName(7, 100000, 'png') === 'frame_000007.png');
        const names = Array.from({ length: 12 }, (_, i) => A.animFrameName(i + 1, 12, 'png'));
        check('the names sort as the frames do', JSON.stringify(names.slice().sort()) === JSON.stringify(names));
        check('bad input throws: i 0, i > n, n 0, fractions, extension with a dot / empty / path', [[0, 5, 'png'], [6, 5, 'png'], [1, 0, 'png'], [1.5, 5, 'png'], [1, 5, '.png'], [1, 5, ''], [1, 5, 'p/g']].every(a => throwsR(() => A.animFrameName(...a))));
    }
    console.log('== 3. CRC-32 ==');
    {
        check('the check value of "123456789" is 0xCBF43926', A.animCrc32(Buffer.from('123456789')) === 0xCBF43926);
        check('empty input is 0', A.animCrc32(new Uint8Array(0)) === 0);
        let ok = true; const sizes = [1, 2, 255, 256, 1000, 65537, 300000];
        for (const n of sizes) { const b = crypto.randomBytes(n); if (A.animCrc32(b) !== refCrc(b)) ok = false; }
        check('random buffers (1 byte to 300 kB) equal zlib\'s CRC-32', ok);
        const b = crypto.randomBytes(5000), c1 = A.animCrc32(b.subarray(0, 1234)), c2 = A.animCrc32(b.subarray(1234), c1);
        check('chunked with a seed equals the CRC of the whole', c2 === A.animCrc32(b) && c2 === refCrc(b));
        check('the result is an unsigned 32-bit number', [0xFF, 0x80, 0x00].every(v => { const r = A.animCrc32(new Uint8Array(9).fill(v)); return Number.isInteger(r) && r >= 0 && r <= 0xFFFFFFFF; }));
    }
    console.log('== 4. ZIP: store and deflate-raw ==');
    const payloads = [crypto.randomBytes(5000), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">' + '<path d="M0,0L10,10"/>'.repeat(400) + '</svg>'), Buffer.alloc(0), Buffer.from([1, 2, 3]), crypto.randomBytes(70000)];
    const external = (file, expectMap) => {
        const r = {};
        if (HAVE_UNZIP) { try { execFileSync('unzip', ['-tq', file], { stdio: 'pipe' }); r.unzip = true; } catch (e) { r.unzip = false; r.err = String(e.stdout || e.message).slice(0, 100); } }
        if (HAVE_PY) {
            try {
                const out = execFileSync('python3', ['-I', '-c', 'import zipfile,sys,hashlib,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({"bad":z.testzip(),"files":{n:hashlib.sha1(z.read(n)).hexdigest() for n in z.namelist()}}))', file], { stdio: 'pipe' }).toString();
                const j = JSON.parse(out); r.pyBad = j.bad; r.pyEq = Object.keys(expectMap).length === Object.keys(j.files).length && Object.keys(expectMap).every(n => j.files[n] === crypto.createHash('sha1').update(expectMap[n]).digest('hex'));
            } catch (e) { r.pyBad = 'error'; r.pyEq = false; r.err = String(e.stderr || e.message).slice(0, 100); }
        }
        return r;
    };
    for (const method of ['store', 'deflate']) {
        const w = A.animZipWriter({ method, deflate: (b) => new Uint8Array(zlib.deflateRawSync(b)) });
        const expect = {}; const metas = [];
        for (let i = 0; i < payloads.length; i++) { const nm = A.animFrameName(i + 1, payloads.length, method === 'store' ? 'png' : 'svg'); metas.push(await w.add(nm, new Uint8Array(payloads[i]))); expect[nm] = payloads[i]; }
        const res = w.finish(), buf = join(res.parts);
        check(`${method}: finish() says entries and size, the parts add up to the size`, res.entries === payloads.length && res.size === buf.length && res.parts.every(p => p instanceof Uint8Array));
        let rd, err = null; try { rd = readZip(buf); } catch (e) { err = e.message; }
        check(`${method}: own central-directory reader: count, names, bytes, CRC, sizes, method`, !err && rd.length === payloads.length && rd.every((e, i) => e.name === Object.keys(expect)[i] && e.data.equals(payloads[i]) && e.crc === refCrc(payloads[i]) && e.usize === payloads[i].length && e.method === (method === 'store' ? 0 : 8) && (method === 'store' ? e.csize === payloads[i].length : e.csize === zlib.deflateRawSync(payloads[i]).length)), err || '');
        check(`${method}: add() reports crc, sizes and method`, metas.every((m, i) => m.crc === refCrc(payloads[i]) && m.size === payloads[i].length && m.method === (method === 'store' ? 0 : 8)));
        const f = path.join(TMP, method + '.zip'); fs.writeFileSync(f, buf);
        const ext = external(f, expect);
        check(`${method}: unzip -t ${HAVE_UNZIP ? '' : '(not available here: SKIPPED)'}`, HAVE_UNZIP ? ext.unzip === true : true, ext.err);
        check(`${method}: Python zipfile: testzip clean, every file's bytes equal ${HAVE_PY ? '' : '(not available here: SKIPPED)'}`, HAVE_PY ? (ext.pyBad === null && ext.pyEq === true) : true, ext.err);
    }
    {
        const mk = async () => { const w = A.animZipWriter({}); await w.add('a.png', new Uint8Array([1, 2, 3])); await w.add('b.png', new Uint8Array([4])); return join(w.finish().parts); };
        check('the same input gives the same bytes twice (fixed time stamp)', (await mk()).equals(await mk()));
        const w = A.animZipWriter({ method: 'deflate', deflate: async (b) => { await new Promise(r => setTimeout(r, 1)); return new Uint8Array(zlib.deflateRawSync(b)); } });
        await w.add('x.svg', new Uint8Array(payloads[1]));
        const rd = readZip(join(w.finish().parts));
        check('an ASYNCHRONOUS deflate function works (CompressionStream is asynchronous)', rd.length === 1 && rd[0].data.equals(payloads[1]) && rd[0].method === 8);
        const z0 = A.animZipWriter({}).finish(), b0 = join(z0.parts);
        check('0 entries: an end record only (22 bytes), counts 0', z0.entries === 0 && b0.length === 22 && readZip(b0).length === 0);
        if (HAVE_PY) { const f = path.join(TMP, 'empty.zip'); fs.writeFileSync(f, b0); let n = -1; try { n = Number(execFileSync('python3', ['-I', '-c', 'import zipfile,sys;print(len(zipfile.ZipFile(sys.argv[1]).namelist()))', f], { stdio: 'pipe' }).toString()); } catch (e) { /* n stays -1 */ } check('0 entries: Python zipfile opens it', n === 0); }
        const W = () => A.animZipWriter({});
        check('a non-ASCII name, a control character, a backslash, an empty name and a 256-character name throw', await (async () => { const bad = ['frame_ä.png', 'a\nb', 'a\\b', '', 'x'.repeat(256)]; for (const n of bad) if (!(await rejectsR(() => W().add(n, new Uint8Array(1)), /name|ASCII/i))) return false; return true; })());
        check('a name of 255 characters and a path with a slash are fine', await (async () => { const w = W(); await w.add('x'.repeat(255), new Uint8Array(1)); await w.add('dir/frame_0001.png', new Uint8Array(1)); return readZip(join(w.finish().parts)).length === 2; })());
        check('a duplicate name throws', await (async () => { const w = W(); await w.add('a.png', new Uint8Array(1)); return rejectsR(() => w.add('a.png', new Uint8Array(1)), /duplicate/); })());
        check('two add() calls started together with the same name: the second throws (the check is repeated after the await)', await (async () => { const w = A.animZipWriter({ method: 'deflate', deflate: async (b) => { await new Promise(r => setTimeout(r, 2)); return new Uint8Array(b); } }); const r = await Promise.allSettled([w.add('a.svg', new Uint8Array(1)), w.add('a.svg', new Uint8Array(1))]); return r.filter(x => x.status === 'fulfilled').length === 1 && w.count() === 1; })());
        check('data that is not a Uint8Array throws (a string, an ArrayBuffer, an array)', await (async () => { for (const d of ['abc', new ArrayBuffer(3), [1, 2]]) if (!(await rejectsR(() => W().add('a', d), /Uint8Array/))) return false; return true; })());
        check('add() or finish() after finish() throws', await (async () => { const w = W(); w.finish(); return (await rejectsR(() => w.add('a', new Uint8Array(1)), /finish/)) && throwsR(() => w.finish(), /finish/); })());
        check('method deflate without a function throws; an unknown method throws; a deflate that gives no Uint8Array throws', throwsR(() => A.animZipWriter({ method: 'deflate' }), /deflate/) && throwsR(() => A.animZipWriter({ method: 'bzip2' }), /method/) && await rejectsR(() => A.animZipWriter({ method: 'deflate', deflate: () => 'x' }).add('a', new Uint8Array(1)), /Uint8Array/));
    }
    console.log('== 5. the limits of the format ==');
    {
        const w = A.animZipWriter({}), e = new Uint8Array(0);
        for (let i = 0; i < 65535; i++) await w.add('f' + i, e);
        const over = await rejectsR(() => w.add('one-too-many', e), /65535|ZIP64/);
        const res = w.finish(), buf = join(res.parts);
        let n = -1, err = null; try { n = readZip(buf).length; } catch (x) { err = x.message; }
        check('65 535 entries are written and read back; the 65 536th throws', res.entries === 65535 && n === 65535 && over, err || '');
        if (HAVE_PY) { const f = path.join(TMP, 'many.zip'); fs.writeFileSync(f, buf); let pn = -1; try { pn = Number(execFileSync('python3', ['-I', '-c', 'import zipfile,sys;print(len(zipfile.ZipFile(sys.argv[1]).namelist()))', f], { stdio: 'pipe' }).toString()); } catch (x) { /* stays -1 */ } check('Python zipfile reads the 65 535 entries', pn === 65535); }
        // a result that PRETENDS to be big: the writer only ever reads its length, so nothing is allocated
        class Big extends Uint8Array { get length() { return Big.len; } }
        Big.len = 5 * 1024 * 1024 * 1024;
        const wb = A.animZipWriter({ method: 'deflate', deflate: () => new Big(1) });
        check('a compressed entry of 5 GiB throws (no ZIP64)', await rejectsR(() => wb.add('big.svg', new Uint8Array(3)), /4 GiB|ZIP64/));
        Big.len = 3 * 1024 * 1024 * 1024;
        const wc = A.animZipWriter({ method: 'deflate', deflate: () => new Big(1) });
        await wc.add('a.svg', new Uint8Array(3));
        check('two entries of 3 GiB: the first fits, the second takes the archive past 4 GiB and throws', await rejectsR(() => wc.add('b.svg', new Uint8Array(3)), /4 GiB|ZIP64/) && wc.count() === 1);
        Big.len = 0xFFFFFFFF - 30 - 5 - 22 - 46 - 5 + 1;   // the data itself still fits; the directory (51) and the end record (22) push the archive one byte over
        const wd = A.animZipWriter({ method: 'deflate', deflate: () => new Big(1) });
        await wd.add('a.svg', new Uint8Array(3));
        check('an archive whose data fits but whose central directory + end record do not: finish() throws', throwsR(() => wd.finish(), /4 GiB|ZIP64/));
    }
    console.log('== 6. estimate and limits ==');
    {
        const L = A.animExportLimits, MiB = 1024 * 1024;
        check('the limits are 300 frames and 500 MiB, and frozen', L.maxFrames === 300 && L.maxBytes === 500 * MiB && Object.isFrozen(L));
        const real = async (n, bytes, ext) => { const w = A.animZipWriter({}); for (let i = 1; i <= n; i++) await w.add(A.animFrameName(i, n, ext), new Uint8Array(bytes)); return w.finish().size; };
        let exact = true; for (const [n, bytes, ext] of [[2, 1000, 'png'], [96, 100000, 'png'], [300, 250, 'svg'], [10000, 3, 'png']]) { const e = A.animExportEstimate({ frames: n, bytesPerFrame: bytes, ext, limits: { maxFrames: 1e6, maxBytes: 1e12 } }); if (e.totalBytes !== await real(n, bytes, ext)) exact = false; }
        check('the estimated total equals the size of the real ZIP, to the byte (2, 96, 300 and 10 000 frames)', exact);
        let e = A.animExportEstimate({ frames: 300, bytesPerFrame: 100 * 1024 });
        check('300 frames of 100 kB: within the limits, no limit named', e.withinLimits === true && e.limit === null && e.allowedFrames === 300);
        e = A.animExportEstimate({ frames: 301, bytesPerFrame: 100 });
        check('301 frames: the FRAMES limit bites; 300 fit', e.withinLimits === false && e.limit === 'frames' && e.allowedFrames === 300);
        e = A.animExportEstimate({ frames: 100, bytesPerFrame: 6 * MiB });
        check('100 frames of 6 MiB (600 MiB): the BYTES limit bites; 83 fit', e.withinLimits === false && e.limit === 'bytes' && e.maxFramesByBytes === Math.floor((500 * MiB - 22) / (6 * MiB + e.zipBytesPerFrame)) && e.allowedFrames === 83, e.allowedFrames);
        e = A.animExportEstimate({ frames: 400, bytesPerFrame: 2 * MiB });
        check('400 frames of 2 MiB: both limits bite; 249 fit', e.limit === 'both' && e.withinLimits === false && e.allowedFrames === Math.floor((500 * MiB - 22) / (2 * MiB + e.zipBytesPerFrame)), e.allowedFrames);
        const edge = A.animExportEstimate({ frames: 1, bytesPerFrame: 500 * MiB - 22 - 30 - 46 - 2 * 'frame_0001.png'.length });
        const over = A.animExportEstimate({ frames: 1, bytesPerFrame: 500 * MiB - 22 - 30 - 46 - 2 * 'frame_0001.png'.length + 1 });
        check('the byte limit is exact: a ZIP of exactly 500 MiB passes, one byte more does not', edge.totalBytes === 500 * MiB && edge.withinLimits && over.totalBytes === 500 * MiB + 1 && over.limit === 'bytes');
        e = A.animExportEstimate({ frames: 5, bytesPerFrame: 0 });
        check('frames of 0 bytes: only the frames limit can bite (allowed = 300)', e.allowedFrames === 300 && e.withinLimits === true);
        e = A.animExportEstimate({ frames: 5, bytesPerFrame: 1000, limits: { maxFrames: 4 } });
        check('custom limits: maxFrames 4 bites at 5 frames; maxBytes keeps its default', e.limit === 'frames' && e.allowedFrames === 4 && e.limits.maxBytes === 500 * MiB);
        e = A.animExportEstimate({ frames: 2, bytesPerFrame: 1000, limits: { maxBytes: 1500 } });
        check('custom limits: maxBytes 1500 bites at 2 frames of 1000 bytes; 1 fits', e.limit === 'bytes' && e.allowedFrames === 1, e.allowedFrames);
        check('a frame bigger than the whole limit: 0 frames fit, the message is still a result, not a throw', (() => { const x = A.animExportEstimate({ frames: 1, bytesPerFrame: 600 * MiB }); return x.limit === 'bytes' && x.allowedFrames === 0; })());
        check('bad input throws: frames 0 / 1.5 / "3", bytesPerFrame -1 / NaN / "5", no options, a bad extension', [{ frames: 0, bytesPerFrame: 1 }, { frames: 1.5, bytesPerFrame: 1 }, { frames: '3', bytesPerFrame: 1 }, { frames: 3, bytesPerFrame: -1 }, { frames: 3, bytesPerFrame: NaN }, { frames: 3, bytesPerFrame: '5' }, undefined, { frames: 3, bytesPerFrame: 1, ext: '.png' }].every(o => throwsR(() => A.animExportEstimate(o))));
    }
    check('the file is loadable as a classic script and gives the same names (no DOM, no p5: a vm context with nothing in it)', (() => {
        const vm = require('vm'), src = fs.readFileSync(process.env.ANIM_EXPORT_JS || path.join(__dirname, '..', '..', 'core', 'anim-export.js'), 'utf8'), sb = {}; vm.createContext(sb);
        vm.runInContext(src, sb);
        return ['animFrameTimes', 'animFrameName', 'animCrc32', 'animZipWriter', 'animExportEstimate', 'animExportLimits'].every(n => vm.runInContext('typeof ' + n, sb) !== 'undefined') && vm.runInContext("animFrameName(3, 10, 'png')", sb) === 'frame_0003.png';
    })());
    console.log(`\n${checks - failures}/${checks} checks passed`);
    process.exit(failures ? 1 : 0);
})();
