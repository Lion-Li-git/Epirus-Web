
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n').map(l=>l.split('\t'));
const pool = rd('champion-map/pool-members.tsv').slice(1);
const co = rd('champion-map/coords-gen3-1105.tsv'); const ch = Object.fromEntries(co[0].map((x,i)=>[x,i]));
const by = {}; for (const r of co.slice(1)) by[r[ch.id]] = r;
const W = {2:0.15,3:0.25,5:0.45,8:0.15};
const x4 = (r) => { let a=0,w=0; for (const n of [2,3,5,8]) { const v=r[ch['P'+n]]; if (v!=='' && v!==undefined) { a+=W[n]*+v; w+=W[n]; } } return w?a/w:NaN; };
console.log('| 带 | 包 | X̄₄短 | 短门 | 长门 |');
console.log('|---|---|---|---|---|');
for (const p of pool.sort((a,b)=>(a[3]==='hard'?0:1)-(b[3]==='hard'?0:1))) {
  const r = by[p[0]]; if (!r) continue;
  console.log('| ' + p[3] + ' | ' + p[0] + ' | ' + x4(r).toFixed(3) + ' | ' + (r[ch.okShort]==='1'?'✔':'✘') + ' | ' + (r[ch.okLong]==='1'?'✔':'✘') + ' |');
}
