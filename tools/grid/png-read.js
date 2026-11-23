// Task 120: minimaler PNG-Leser (8 Bit, nicht verschachtelt, Gray/RGB/RGBA) nur fuer Bildmessungen. Kein Import aus core/.
'use strict';
const fs = require('fs'), zlib = require('zlib');
function readPng(file) {
  const b = fs.readFileSync(file); let o = 8, w, h, ct, bd, il; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; } else if (type === 'IDAT') idat.push(d); o += 12 + len; }
  if (bd !== 8 || il !== 0) throw new Error('nur 8 Bit, nicht verschachtelt: bd=' + bd + ' interlace=' + il);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct], bpp = ch, stride = w * ch, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) { const r = raw[src + x], a = x >= bpp ? px[dst + x - bpp] : 0, up = y ? px[dst - stride + x] : 0, c = (x >= bpp && y) ? px[dst - stride + x - bpp] : 0;
      let v; if (f === 0) v = r; else if (f === 1) v = r + a; else if (f === 2) v = r + up; else if (f === 3) v = r + ((a + up) >> 1); else { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
      px[dst + x] = v & 255; } }
  return { w, h, ch, px, at: (x, y) => { const i = (y * w + x) * ch; return ch >= 3 ? [px[i], px[i + 1], px[i + 2]] : [px[i], px[i], px[i]]; } };
}
module.exports = { readPng };
if (require.main === module) { const im = readPng(process.argv[2]); console.log(im.w + 'x' + im.h, 'Kanaele', im.ch); }
