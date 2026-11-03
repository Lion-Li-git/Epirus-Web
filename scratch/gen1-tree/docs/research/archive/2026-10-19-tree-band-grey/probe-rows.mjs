import { decode, mkAt, luma } from './png.mjs';
const img = decode(process.argv[2]); const A = mkAt(img);
const XF = Number(process.env.XF || 0.62), Y0F = Number(process.env.Y0 || 0.26), Y1F = Number(process.env.Y1 || 0.83);
const COL = Math.round(XF * img.W), Y0 = Math.round(Y0F * img.H), Y1 = Math.round(Y1F * img.H);
console.log('图 ' + img.W + 'x' + img.H + ' ‖ 竖扫描线 x=' + COL + ' ‖ y ' + Y0 + '…' + Y1);
const runs = []; let cur = null;
for (let y = Y0; y < Y1; y++) { const c = A.rgb(COL, y).join(','); if (cur && cur.c === c) cur.n++; else { cur = { c, n: 1 }; runs.push(cur); } }
const hist = new Map();
for (const r of runs) hist.set(r.c, (hist.get(r.c) || 0) + r.n);
const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [c, n] of top) console.log('  rgb(' + c + ') 占 ' + n + ' 行  L=' + luma(c.split(',').map(Number)).toFixed(1));
const long = runs.filter(r => r.n >= 4).slice(0, 18);
console.log('≥4 行的同色段：' + (long.length ? long.map(r => r.c + '×' + r.n).join('  ') : '（无）'));
console.log('该线上不同颜色数：' + hist.size);
