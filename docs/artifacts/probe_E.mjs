import { sandbox, fieldRate } from '../../tools/audit-lib.mjs';
import fs from 'node:fs';
const W = sandbox(); const P = W.EpirusPolicy;
const rd = f => { const s = fs.readFileSync(f, 'utf8'); return P.unpack(JSON.parse(/EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(s)[1]), true); };
console.log('冠军            旧E   新:无威胁摆架势  无威胁最长连摆  无威胁回合数');
for (const f of ['v7f-35', 'eco-34', 'v7press-36', 'v7anneal-34', 'v7ring-34']) {
  const r = fieldRate(W, rd('docs/artifacts/' + f + '.bak'), 'passive', 'multi', 10);
  console.log(f.padEnd(15) + (r.stance * 100).toFixed(0).padStart(4) + '%' + (r.noThreatStanceRate * 100).toFixed(0).padStart(16) + '%' + String(r.maxNoThreatRun).padStart(16) + String(r.noThreatRounds).padStart(14));
}
