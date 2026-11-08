
import { readFileSync } from 'node:fs';
import { sandbox } from '../../tools/audit-lib.mjs';
const W = sandbox();
const P = W.EpirusPolicy;
for (const f of ['docs/artifacts/night-adapt/CTRL2-Q-s7.js', 'scratch/night-adapt2/KD-Qg.bak', 'docs/artifacts/night-adapt/PASS2-Q-s13.js']) {
  const src = readFileSync(f, 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
  const o = JSON.parse(m[1]);
  let raw = null, err = '';
  try { raw = P.unpack(o, true); } catch (e) { err = e.message.slice(0, 100); }
  console.log(f.split('/').pop() + '  v=' + o.v + ' arch=' + o.arch + ' a.len=' + (o.a ? o.a.length : '?') + ' unpack=' + (raw ? raw.length : 'null') + (err ? ' err=' + err : ''));
}
console.log('paramCount=', P.paramCount());
