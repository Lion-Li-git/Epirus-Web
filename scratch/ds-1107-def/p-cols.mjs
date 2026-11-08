
import { readFileSync } from 'node:fs';
const raw = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/^\uFEFF/, '');
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
const h = Object.fromEntries(H.map((x, i) => [x, i]));
const rows = lines.slice(1).map(l => l.split('\t'));
const q = (a, p) => { const s = a.filter(v => isFinite(v)).sort((x, y) => x - y); return s[Math.floor((s.length - 1) * p)]; };
console.log('列数', H.length, '行数', rows.length);
for (const k of ['P2','P3','P5','P8','X2','X3','X5','X8']) {
  const a = rows.map(r => (r[h[k]] === '' ? NaN : +r[h[k]]));
  console.log(k.padEnd(3) + ' 有数 ' + a.filter(isFinite).length + '  min=' + q(a,0).toFixed(3) + ' med=' + q(a,.5).toFixed(3) + ' max=' + q(a,1).toFixed(3));
}
// P vs X 的差异（应当不同：页面剂量 vs 贪心）
let same = 0, n = 0;
for (const r of rows) { const a = r[h['P5']], b = r[h['X5']]; if (a !== '' && b !== '' ) { n++; if (Math.abs(+a - +b) < 1e-9) same++; } }
console.log('\nP5 与 X5 逐位相同：' + same + '/' + n + '（应当很少 —— 两把尺）');
