
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const rows = t.slice(1).map(r => {
  const g = (k) => r[h[k]] === '' || r[h[k]] === undefined ? NaN : +r[h[k]];
  const cells = [2,3,5,8].map(n => g('P' + n));
  let a = 0, w = 0; for (let i = 0; i < 4; i++) if (isFinite(cells[i])) { a += W[[2,3,5,8][i]] * cells[i]; w += W[[2,3,5,8][i]]; }
  const S = g('S');
  return { id: r[h.id], x4: w ? a / w : NaN, S, F: w ? a / w + 0.10 * (isFinite(S) ? S : 0) : NaN, n: [2,3,5,8].filter(n => isFinite(g('P' + n))).length };
});
const ranked = rows.filter(r => isFinite(r.F)).sort((a, b) => b.F - a.F);
console.log('F = X̄₄(P) + 0.10·S 前 8：');
for (const r of ranked.slice(0, 8)) console.log('  ' + r.id.padEnd(16) + ' F=' + r.F.toFixed(3) + '  X̄₄=' + r.x4.toFixed(3) + '  S=' + r.S.toFixed(2) + '  格数=' + r.n);
for (const id of ['Q-s47','U-s205','CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7']) {
  const i = ranked.findIndex(r => r.id === id);
  console.log(id.padEnd(14) + (i < 0 ? ' 未测' : ' 第 ' + (i + 1) + ' / ' + ranked.length + '  F=' + ranked[i].F.toFixed(3)));
}
