/* 一个框的平均色与电平数（判"抖动有没有把读法带跑"：均值必须几乎不动） */
import { decode, mkAt } from './png.mjs';
const img = decode(process.argv[2]); const A = mkAt(img);
const num = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? Number(a.slice(k.length + 3)) : d; };
const { W, H } = img;
const x0 = Math.round(num('x0', .86) * W), x1 = Math.round(num('x1', .98) * W);
const y0 = Math.round(num('y0', .62) * H), y1 = Math.round(num('y1', .80) * H);
let s = [0, 0, 0], n = 0, hist = new Map();
for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
  const c = A.rgb(x, y); s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; n++;
  const k = c.join(','); hist.set(k, (hist.get(k) || 0) + 1);
}
const mean = s.map(v => (v / n).toFixed(3));
const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(e => e[0] + '×' + e[1]);
console.log(process.argv[2].split(/[\\/]/).pop() + '  框 ' + n.toLocaleString('en') + ' px ‖ 均值 rgb(' + mean.join(',') + ') ‖ 不同色 ' + hist.size + ' ‖ 最常见 ' + top.join('  '));
