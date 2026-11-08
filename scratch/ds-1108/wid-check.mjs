
import { readFileSync } from 'node:fs';
import { widOf } from '../../champion-map/pack-id.mjs';
for (const f of ['scratch/night-adapt2/KD-Qg.bak','scratch/night-adapt2/KD-K2-l.bak','scratch/night-adapt2/KD-K2.bak','docs/artifacts/night-adapt/CTRL2-Q-s7.js','docs/artifacts/night-adapt/CTRL2-Q-s13.js','docs/artifacts/night-adapt/ADAPT2-Q-s7.js']) {
  const s = readFileSync(f, 'utf8');
  const hs = (s.match(/"hotstartFrom":"([^"]*)"/) || [])[1] || '(无)';
  console.log(f.split('/').pop().padEnd(20) + ' hotstartFrom=' + hs + '  wid=' + widOf(s));
}
const t = readFileSync('champion-map/lineage-g3.tsv', 'utf8').split(/\r?\n/);
const h = t[0].split('\t');
for (const l of t.slice(1)) { const c = l.split('\t'); if (['KD-V7','KDFULL2','KD-Qg','KD-K2-l'].includes(c[0])) console.log('sidecar ' + c[0] + ' wid=' + c[h.indexOf('wid')] + ' parent=' + c[h.indexOf('parent')]); }
