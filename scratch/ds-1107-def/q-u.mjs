
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
for (const id of ['Q-s47', 'U-s205']) {
  const r = t.slice(1).find(x => x[h.id] === id);
  if (!r) { console.log(id + ' 不在表里'); continue; }
  console.log('=== ' + id + ' ===');
  for (const k of ['lineage','ver','path','H5','Hp5','S','Geff','F','rank','dmg','heavy','holo','rounds','drawRate','zeroRate','seatSpread','distinctKeys','charges','waste','noThreatStance','fieldAAtk','rwDmg','X2','X3','X5','X8','P2','P3','P5','P8','xt','yt']) {
    if (h[k] !== undefined) console.log('  ' + k.padEnd(12) + (r[h[k]] === '' ? '(空)' : r[h[k]]));
  }
}
