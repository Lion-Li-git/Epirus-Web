
import { readFileSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
for (const [id, p] of [['KD-G2','scratch/night-adapt2/KD-G2.bak'],['FOCUS-Q-s13','scratch/ds-1108/FOCUS-Q-s13.js'],['CLEAR-Q-s13','scratch/ds-1108/CLEAR-Q-s13.js'],['WIDE-Q-s13','scratch/ds-1108/WIDE-Q-s13.js'],['KD-Qg','scratch/night-adapt2/KD-Qg.bak']]) {
  const s = readFileSync(p, 'utf8');
  const hs = (s.match(/"hotstartFrom":"([^"]*)"/) || [])[1] || '';
  const seed = (s.match(/"seed":(\d+)/) || [])[1] || '';
  console.log(id.padEnd(14) + ' wid=' + widOf(s) + '  hotstart=' + hs + '  seed=' + seed);
}
const t = readFileSync('champion-map/lineage-g3.tsv','utf8').replace(/\r\n/g,'\n').split('\n');
for (const l of t) { const c = l.split('\t'); if (['KD-G2','KD-Qg','KD-Qg-l','KD-K2-l'].includes(c[0])) console.log('sidecar ' + c[0] + ' parent=' + c[5] + ' psrc=' + c[9] + ' wid=' + c[8]); }
