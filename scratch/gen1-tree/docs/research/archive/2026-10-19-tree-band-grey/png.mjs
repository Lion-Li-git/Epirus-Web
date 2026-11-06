/* 最小 PNG 解码（8bit、非隔行、RGB/RGBA）—— 只为量截图上的行底色与断层，不依赖任何第三方包。 */
import fs from 'node:fs';
import zlib from 'node:zlib';

export function decode(p) {
  const b = fs.readFileSync(p);
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let off = 8, W = 0, H = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), type = b.toString('ascii', off + 4, off + 8), data = b.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = ctype === 6 ? 4 : ctype === 2 ? 3 : null;
  if (depth !== 8 || interlace !== 0 || !ch) throw new Error('不支持的 PNG：depth=' + depth + ' ctype=' + ctype + ' interlace=' + interlace);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = W * ch, px = Buffer.alloc(H * stride);
  let rp = 0;
  for (let y = 0; y < H; y++) {
    const f = raw[rp++], line = raw.subarray(rp, rp + stride); rp += stride;
    const out = px.subarray(y * stride, y * stride + stride);
    const prev = y ? px.subarray((y - 1) * stride, (y - 1) * stride + stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[i - ch] : 0, bb = prev ? prev[i] : 0, c = prev && i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) { const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c; }
      out[i] = v & 255;
    }
  }
  return { W, H, ch, px };
}
export function mkAt(img) {
  const { W, H, ch, px } = img;
  return {
    W, H,
    rgb: (x, y) => [px[y * W * ch + x * ch], px[y * W * ch + x * ch + 1], px[y * W * ch + x * ch + 2]],
  };
}
export const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
