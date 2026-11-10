
import { readFileSync } from 'node:fs';
const s = readFileSync('scratch/ds-1108/WIDE2-Q-s13.js', 'utf8');
const i = s.indexOf('EPIRUS_CHAMPION_3P_META');
const line = s.slice(i, s.indexOf('\n', i));
for (const k of ['killReward', 'killField', 'widthW', 'width', 'courseBot', 'env']) {
  const m = line.match(new RegExp('"' + k + '"[^,}]*'));
  if (m) console.log(m[0].slice(0, 200));
}
const e = line.match(/"env":\{[^}]*\}/);
if (e) console.log(e[0].slice(0, 400));
