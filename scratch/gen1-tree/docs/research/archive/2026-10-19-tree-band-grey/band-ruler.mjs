/* 底图断层尺：取样框内不同色数 ‖ 竖直/水平剖面的电平数与最长平台 ‖ 相邻像素跳变（中位/P99/最大）。 */
import { decode, mkAt, luma } from './png.mjs';
const img = decode(process.argv[2]); const A = mkAt(img);
const num = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? Number(a.slice(k.length + 3)) : d; };
const { W, H } = img;
const rx0 = Math.round(num('x0', .40) * W), rx1 = Math.round(num('x1', .95) * W);
const ry0 = Math.round(num('y0', .30) * H), ry1 = Math.round(num('y1', .80) * H);
const colX = Math.round(num('col', .55) * W), rowY = Math.round(num('row', .55) * H);
const seen = new Set();
for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) { const c = A.rgb(x, y); seen.add((c[0] << 16) | (c[1] << 8) | c[2]); }
const d = [];
for (let y = ry0; y < ry1 - 1; y++) for (let x = rx0; x < rx1; x++) { const a = A.rgb(x, y), b = A.rgb(x, y + 1); d.push(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }
for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1 - 1; x++) { const a = A.rgb(x, y), b = A.rgb(x + 1, y); d.push(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }
d.sort((p, q) => p - q);
function prof(fixed, from, to, vertical) {
  const lv = []; for (let i = from; i < to; i++) lv.push(Math.round(vertical ? luma(A.rgb(fixed, i)) : luma(A.rgb(i, fixed))));
  const s = new Set(lv); let run = 1, best = 1;
  for (let i = 1; i < lv.length; i++) { if (lv[i] === lv[i - 1]) { run++; if (run > best) best = run; } else run = 1; }
  return { levels: s.size, plateau: best, n: lv.length };
}
const v = prof(colX, ry0, ry1, true), h = prof(rowY, rx0, rx1, false);
const q = p => d[Math.min(d.length - 1, Math.floor(d.length * p))];
console.log('图 ' + W + 'x' + H + ' ‖ 取样框 x[' + rx0 + ',' + rx1 + '] y[' + ry0 + ',' + ry1 + '] = ' + ((rx1 - rx0) * (ry1 - ry0)).toLocaleString('en') + ' 像素');
console.log('① 不同颜色数      ' + seen.size);
console.log('② 竖直 x=' + colX + '      电平 ' + v.levels + ' ‖ 最长平台 ' + v.plateau + ' 行（n=' + v.n + '）');
console.log('③ 水平 y=' + rowY + '      电平 ' + h.levels + ' ‖ 最长平台 ' + h.plateau + ' 列（n=' + h.n + '）');
console.log('④ 相邻跳变        中位 ' + q(.5) + ' ‖ P99 ' + q(.99) + ' ‖ 最大 ' + d[d.length - 1] + '（样本 ' + d.length.toLocaleString('en') + '）');
