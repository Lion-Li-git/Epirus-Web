
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const rows = t.slice(1).map(r => ({ id: r[h.id], P: [2,3,5,8].map(n => r[h['P'+n]] === '' ? NaN : +r[h['P'+n]]), PL: [2,3,5,8].map(n => r[h['P'+n+'L']] === '' ? NaN : +r[h['P'+n+'L']]) }));
for (const [lab, key] of [['短程','P'],['长程','PL']]) {
  for (let i = 0; i < 4; i++) {
    const n = [2,3,5,8][i];
    const a = rows.filter(r => isFinite(r[key][i])).sort((x, y) => y[key][i] - x[key][i]);
    const top = a.slice(0, 5).map(r => r.id + ' ' + r[key][i].toFixed(3)).join(' ‖ ');
    console.log(lab + ' N=' + n + '：' + top + '   ‖ Q 第 ' + (a.findIndex(r => r.id === 'Q-s47') + 1) + ' / U 第 ' + (a.findIndex(r => r.id === 'U-s205') + 1));
  }
}
