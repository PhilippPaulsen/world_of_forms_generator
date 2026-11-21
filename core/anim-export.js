/**
 * core/anim-export.js
 * Task 115 (animation export, stage 1 of tasks/114-animationsexport-plan.md): the pure building blocks of a frame-sequence export. Nothing here draws, reads the page or the clock:
 * no p5, no DOM, no globals read. Plain functions (every top-level name starts with anim: the file is a classic script in the browser, where a name is a global shared with p5 and
 * the other scripts) and, under Node, module.exports. Not loaded by any page yet (the driver of stage 2 will do that); tested in tools/anim/test-anim-export.js.
 *
 *   animFrameTimes({ totalMs, fps | frames })  the progress values t_i = i / (n - 1) of an n-frame sequence: the first frame at t = 0, the LAST frame at exactly t = 1 (n >= 2).
 *   animFrameName(i, n, ext)                   'frame_0001.png': 1-based, at least four digits, more when n > 9999.
 *   animCrc32(bytes, seed)                     CRC-32 (the zip / zlib one) of a Uint8Array; seed = the CRC of what came before (to run over chunks).
 *   animZipWriter({ method, deflate })         a ZIP of 'store' (method 0) or 'deflate' (method 8, raw deflate) entries: add() collects, finish() returns the PARTS (header, data, ...,
 *                                              central directory, end record) as a list of Uint8Array, for the caller to join as a Blob. ASCII names only, no ZIP64: an error past 65 535
 *                                              entries or 4 GiB. The compression is NOT done here: `deflate(bytes)` (sync or a Promise, raw deflate = what CompressionStream('deflate-raw') gives) is passed in.
 *   animExportLimits, animExportEstimate(...)  the size estimate and the limits (300 frames, 500 MiB): says which limit bites and how many frames still fit. A message, never an abort.
 */

const animExportLimits = Object.freeze({ maxFrames: 300, maxBytes: 500 * 1024 * 1024 });
const animZipMaxEntries = 65535;
const animZipMaxBytes = 0xFFFFFFFF;   // 4 GiB - 1: every size and offset of the classic format is 32 bit

// ---- the frame times -------------------------------------------------------------------------------------------------------------------------------------------------------------------
// { totalMs, fps }: n = round(totalMs / 1000 * fps), at least 2 (a shorter clip still has its first and its last frame). { frames }: n exactly (an integer >= 2, else RangeError).
// -> { n, times: [t_0 .. t_(n-1)] } with t_0 = 0 and t_(n-1) = 1 exactly.
function animFrameTimes(o) {
    if (!o || typeof o !== 'object') throw new RangeError('animFrameTimes: options missing');
    let n;
    if (o.frames !== undefined) {
        if (!Number.isInteger(o.frames) || o.frames < 2) throw new RangeError('animFrameTimes: frames must be an integer >= 2, got ' + String(o.frames));
        n = o.frames;
    } else {
        if (typeof o.totalMs !== 'number' || !Number.isFinite(o.totalMs) || o.totalMs <= 0) throw new RangeError('animFrameTimes: totalMs must be a number > 0, got ' + String(o.totalMs));
        if (typeof o.fps !== 'number' || !Number.isFinite(o.fps) || o.fps <= 0) throw new RangeError('animFrameTimes: fps must be a number > 0, got ' + String(o.fps));
        n = Math.max(2, Math.round(o.totalMs / 1000 * o.fps));
    }
    const times = new Array(n);
    for (let i = 0; i < n; i++) times[i] = i === n - 1 ? 1 : i / (n - 1);
    return { n, times };
}

// 'frame_0001.png' (i is 1-based; n is the frame count of the sequence: it fixes the width, at least 4 digits). ext without the dot, letters and digits only.
function animFrameName(i, n, ext) {
    if (!Number.isInteger(i) || !Number.isInteger(n) || i < 1 || n < 1 || i > n) throw new RangeError('animFrameName: need 1 <= i <= n, got ' + i + ', ' + n);
    if (typeof ext !== 'string' || !/^[a-z0-9]{1,8}$/i.test(ext)) throw new RangeError('animFrameName: bad extension ' + String(ext));
    return 'frame_' + String(i).padStart(Math.max(4, String(n).length), '0') + '.' + ext;
}

// ---- CRC-32 ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const animCrcTable = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
})();
function animCrc32(bytes, seed) {
    let c = ((seed === undefined ? 0 : seed) ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < bytes.length; i++) c = animCrcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

// ---- the ZIP writer --------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Layout (PKWARE appnote, the classic format): per entry a local header (30 bytes + name) and the data; then per entry a central header (46 bytes + name); then the end record (22 bytes).
// Flags 0 (ASCII names, sizes known up front, no data descriptor); version 20; the time stamp is the fixed DOS date 1980-01-01 00:00 (the same bytes for the same input).
const animZipDosTime = 0, animZipDosDate = 0x21;
function animZipAsciiName(name) {
    if (typeof name !== 'string' || name.length === 0 || name.length > 255) throw new RangeError('animZipWriter: a name must be 1 to 255 characters');
    const b = new Uint8Array(name.length);
    for (let i = 0; i < name.length; i++) {
        const c = name.charCodeAt(i);
        if (c < 0x20 || c > 0x7e || name[i] === '\\') throw new RangeError('animZipWriter: ASCII names only (no control characters, no backslash): ' + JSON.stringify(name));
        b[i] = c;
    }
    return b;
}
function animZipWriter(opts) {
    opts = opts || {};
    const method = opts.method === undefined ? 'store' : opts.method;
    if (method !== 'store' && method !== 'deflate') throw new RangeError('animZipWriter: method must be "store" or "deflate"');
    if (method === 'deflate' && typeof opts.deflate !== 'function') throw new RangeError('animZipWriter: method "deflate" needs a deflate(bytes) function (raw deflate)');
    const entries = [], names = new Set(), parts = [];
    let offset = 0, finished = false;

    // add(name, bytes, handle): bytes = the UNcompressed Uint8Array (CRC, size, and for deflate the input). handle (optional, task 116) = what goes into the PARTS in place of the stored data: a Blob of the
    // very same bytes, so the caller need not keep every frame as a Uint8Array in the JS heap. It is the caller's word that the handle holds exactly the bytes that would have gone in (store: `bytes`;
    // deflate: the COMPRESSED bytes the deflate function gave, e.g. a Blob of them; task 117). Resolves once the entry is in (always a Promise: deflate may be asynchronous).
    async function add(name, bytes, handle) {
        if (finished) throw new Error('animZipWriter: finish() was already called');
        if (!(bytes instanceof Uint8Array)) throw new TypeError('animZipWriter: data must be a Uint8Array');
        if (entries.length >= animZipMaxEntries) throw new RangeError('animZipWriter: more than ' + animZipMaxEntries + ' entries need ZIP64 (not supported)');
        const nm = animZipAsciiName(name);
        if (names.has(name)) throw new RangeError('animZipWriter: duplicate name ' + name);
        const crc = animCrc32(bytes);
        let data = bytes;
        if (method === 'deflate') {
            data = await opts.deflate(bytes);
            if (!(data instanceof Uint8Array)) throw new TypeError('animZipWriter: deflate() must give a Uint8Array');
        }
        // re-check after the await: two add() calls running at once must not both pass the checks above
        if (entries.length >= animZipMaxEntries) throw new RangeError('animZipWriter: more than ' + animZipMaxEntries + ' entries need ZIP64 (not supported)');
        if (names.has(name)) throw new RangeError('animZipWriter: duplicate name ' + name);
        const used = offset + 30 + nm.length + data.length;
        if (bytes.length > animZipMaxBytes || data.length > animZipMaxBytes || used > animZipMaxBytes) throw new RangeError('animZipWriter: more than 4 GiB need ZIP64 (not supported)');
        const m = method === 'deflate' ? 8 : 0;
        const lh = new Uint8Array(30 + nm.length), v = new DataView(lh.buffer);
        v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0, true); v.setUint16(8, m, true); v.setUint16(10, animZipDosTime, true); v.setUint16(12, animZipDosDate, true);
        v.setUint32(14, crc, true); v.setUint32(18, data.length, true); v.setUint32(22, bytes.length, true); v.setUint16(26, nm.length, true); v.setUint16(28, 0, true);
        lh.set(nm, 30);
        parts.push(lh, handle !== undefined ? handle : data);
        entries.push({ nm, m, crc, csize: data.length, usize: bytes.length, offset });
        names.add(name);
        offset = used;
        return { name, method: m, crc, compressedSize: data.length, size: bytes.length };
    }

    // finish() -> { parts: [Uint8Array], size, entries } ; the writer is closed afterwards.
    function finish() {
        if (finished) throw new Error('animZipWriter: finish() was already called');
        finished = true;
        const cdStart = offset;
        let cdSize = 0;
        for (const e of entries) {
            const ch = new Uint8Array(46 + e.nm.length), v = new DataView(ch.buffer);
            v.setUint32(0, 0x02014b50, true); v.setUint16(4, 20, true); v.setUint16(6, 20, true); v.setUint16(8, 0, true); v.setUint16(10, e.m, true); v.setUint16(12, animZipDosTime, true); v.setUint16(14, animZipDosDate, true);
            v.setUint32(16, e.crc, true); v.setUint32(20, e.csize, true); v.setUint32(24, e.usize, true); v.setUint16(28, e.nm.length, true);
            v.setUint16(30, 0, true); v.setUint16(32, 0, true); v.setUint16(34, 0, true); v.setUint16(36, 0, true); v.setUint32(38, 0, true); v.setUint32(42, e.offset, true);
            ch.set(e.nm, 46);
            parts.push(ch); cdSize += ch.length;
        }
        const end = new Uint8Array(22), v = new DataView(end.buffer);
        v.setUint32(0, 0x06054b50, true); v.setUint16(4, 0, true); v.setUint16(6, 0, true); v.setUint16(8, entries.length, true); v.setUint16(10, entries.length, true);
        v.setUint32(12, cdSize, true); v.setUint32(16, cdStart, true); v.setUint16(20, 0, true);
        parts.push(end);
        const size = cdStart + cdSize + 22;
        if (size > animZipMaxBytes) throw new RangeError('animZipWriter: more than 4 GiB need ZIP64 (not supported)');
        return { parts, size, entries: entries.length };
    }
    return { add, finish, count() { return entries.length; }, bytesSoFar() { return offset; } };
}

// ---- the estimate and the limits -------------------------------------------------------------------------------------------------------------------------------------------------
// animExportEstimate({ frames, bytesPerFrame, ext, limits }): frames = what the user asked for, bytesPerFrame = the size of ONE frame as it goes into the ZIP (for deflate: the compressed size).
// The ZIP's own cost per frame (local header 30 + central header 46 + the name twice) is added; the end record (22) once.
// -> { frames, bytesPerFrame, zipBytesPerFrame, totalBytes, limits, withinLimits, limit: null | 'frames' | 'bytes' | 'both', maxFramesByBytes, allowedFrames, allowedBytes }
//    limit = which limit the REQUEST breaks ('both' when both); allowedFrames = the ceiling under BOTH limits, whatever was asked: min(maxFrames, maxFramesByBytes), i.e. how many frames of this
//    size fit. The caller shows a message and offers allowedFrames; nothing here aborts.
function animExportEstimate(o) {
    if (!o || typeof o !== 'object') throw new RangeError('animExportEstimate: options missing');
    if (!Number.isInteger(o.frames) || o.frames < 1) throw new RangeError('animExportEstimate: frames must be an integer >= 1, got ' + String(o.frames));
    if (typeof o.bytesPerFrame !== 'number' || !Number.isFinite(o.bytesPerFrame) || o.bytesPerFrame < 0) throw new RangeError('animExportEstimate: bytesPerFrame must be a number >= 0, got ' + String(o.bytesPerFrame));
    const lim = Object.assign({}, animExportLimits, o.limits || {});
    const ext = o.ext === undefined ? 'png' : o.ext;
    const nameLen = animFrameName(o.frames, o.frames, ext).length;
    const zipPer = 30 + 46 + 2 * nameLen;
    const perFrame = o.bytesPerFrame + zipPer;
    const totalBytes = Math.ceil(perFrame * o.frames + 22);
    const maxByBytes = perFrame > 0 ? Math.max(0, Math.floor((lim.maxBytes - 22) / perFrame)) : Infinity;
    const overFrames = o.frames > lim.maxFrames, overBytes = totalBytes > lim.maxBytes;
    return {
        frames: o.frames, bytesPerFrame: o.bytesPerFrame, zipBytesPerFrame: zipPer, totalBytes, limits: { maxFrames: lim.maxFrames, maxBytes: lim.maxBytes },
        withinLimits: !overFrames && !overBytes, limit: overFrames && overBytes ? 'both' : (overFrames ? 'frames' : (overBytes ? 'bytes' : null)),
        maxFramesByBytes: maxByBytes, allowedFrames: Math.min(lim.maxFrames, maxByBytes), allowedBytes: lim.maxBytes,
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { animExportLimits, animZipMaxEntries, animZipMaxBytes, animFrameTimes, animFrameName, animCrc32, animZipWriter, animExportEstimate };
}
