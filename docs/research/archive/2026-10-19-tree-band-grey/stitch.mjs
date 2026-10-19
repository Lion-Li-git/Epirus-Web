/* 把两张截图的同一小块抠出来、各自放大 N 倍、左右并排写进一张 PNG（无第三方依赖：自己写 IHDR/IDAT/IEND）。
 * 用法：node stitch.mjs <off.png> <on.png> <out.png> --x=0.86 --y=0.62 --w=128 --h=128 --scale=3 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { decode, mkAt } from './png.mjs';

const num = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? Number(a.slice(k.length + 3)) : d; };
function crcTable() { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; }
const CRC = crcTable();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function writePng(path, W, H, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = W * 3, raw = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) { raw[y * (stride + 1)] = 0; rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  fs.writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

const [,, offF, onF, outF] = process.argv;
const A = mkAt(decode(offF)), B = mkAt(decode(onF));
const px = Math.round(num('x', .86) * A.W), py = Math.round(num('y', .62) * A.H);
const cw = Math.round(num('w', 128)), chh = Math.round(num('h', 128)), S = Math.round(num('scale', 3));
const GAP = 6;
const W = cw * S * 2 + GAP, H = chh * S;
const buf = Buffer.alloc(W * H * 3);
function put(x, y, c) { const o = (y * W + x) * 3; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; }
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (x >= cw * S && x < cw * S + GAP) { put(x, y, [255, 255, 255]); continue; }
  const right = x >= cw * S + GAP;
  const sx = Math.floor((right ? x - cw * S - GAP : x) / S), sy = Math.floor(y / S);
  const src = right ? B : A;
  put(x, y, src.rgb(px + sx, py + sy));
}
writePng(outF, W, H, buf);
console.log('已写 ' + outF + '（' + W + 'x' + H + ' ‖ 抠 ' + cw + 'x' + chh + ' @(' + px + ',' + py + ') 放大 ' + S + ' 倍 ‖ 左=关抖动 右=开抖动）');
