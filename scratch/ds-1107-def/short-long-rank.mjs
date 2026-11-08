
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const W = [0.15, 0.25, 0.45, 0.15];
const rows = t.slice(1).map(r => {
  const g = (k) => r[h[k]] === '' ? NaN : +r[h[k]];
  const sc = (suf) => { let s = 0, w = 0; for (let i = 0; i < 4; i++) { const v = g('P' + [2,3,5,8][i] + suf); if (isFinite(v)) { s += W[i] * v; w += W[i]; } } return w ? s / w : NaN; };
  return { id: r[h.id], s: sc(''), l: sc('L') };
});
for (const [lab, key] of [['短程', 's'], ['长程', 'l']]) {
  const a = rows.filter(r => isFinite(r[key])).sort((x, y) => y[key] - x[key]);
  console.log(lab + ' top6：' + a.slice(0, 6).map(r => r.id + ' ' + r[key].toFixed(3)).join(' ‖ '));
  console.log('   Q-s47 第 ' + (a.findIndex(r => r.id === 'Q-s47') + 1) + ' ‖ U-s205 第 ' + (a.findIndex(r => r.id === 'U-s205') + 1));
}
