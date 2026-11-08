
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const rows = t.slice(1).map(r => Object.fromEntries(Object.keys(h).map(k => [k, r[h[k]]])));
for (const id of ['CTRL2-Q-s7', 'CTRL2-Q-s13', 'ADAPT2-Q-s7', 'Q-s47', 'U-s205']) {
  const r = rows.find(x => x.id === id); if (!r) continue;
  console.log('=== ' + id + ' ===');
  for (const k of ['H5','Hp5','X2','X3','X5','X8','P2','P3','P5','P8','deck','examG','F','rank','S','Geff','rounds','dmg','heavy']) if (r[k] !== undefined) console.log('  ' + k.padEnd(6) + (r[k] === '' ? '(空)' : r[k]));
}
/* 按 viewer 口径算 F：X̄4 在有格上重归一 + T*S */
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const F = (r, T) => { let a = 0, w = 0; for (const n of [2,3,5,8]) { const v = r['P'+n]; if (v !== '' && v !== undefined && isFinite(+v)) { a += W[n] * +v; w += W[n]; } } return w ? a / w + T * (+r.S || 0) : NaN; };
console.log('\n默认权重 F（T=0.10，缺格重归一）：');
for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7','Q-s47','U-s205']) { const r = rows.find(x => x.id === id); console.log('  ' + id.padEnd(14) + F(r, 0.10).toFixed(3) + '  （有格 ' + [2,3,5,8].filter(n => r['P'+n] !== '' && r['P'+n] !== undefined).join('/') + '）'); }
