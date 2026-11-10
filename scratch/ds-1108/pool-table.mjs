
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const pool = rd('champion-map/pool-members.tsv');
const ph = Object.fromEntries(pool[0].map((x, i) => [x, i]));
const co = rd('champion-map/coords-gen3-1105.tsv');
const ch = Object.fromEntries(co[0].map((x, i) => [x, i]));
const byId = {};
for (const r of co.slice(1)) byId[r[ch.id]] = r;
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const x4 = (r) => { let a = 0, w = 0; for (const n of [2,3,5,8]) { const v = r[ch['P'+n]]; if (v !== '' && v !== undefined) { a += W[n] * +v; w += W[n]; } } return w ? a / w : NaN; };
console.log('| 带 | 包 | X̄₄短 | 短门 | 长门 |');
console.log('|---|---|---|---|---|');
for (const p of pool.slice(1)) {
  const id = p[ph.id]; const r = byId[id]; if (!r) { console.log('| ' + p[ph.tier] + ' | ' + id + ' | (不在图) | | |'); continue; }
  console.log('| ' + p[ph.tier] + ' | ' + id + ' | ' + (x4(r)).toFixed(3) + ' | ' + (r[ch.okShort] === '1' ? '✔' : '✘' + (r[ch.failsShort] || '')) + ' | ' + (r[ch.okLong] === '1' ? '✔' : '✘' + (r[ch.failsLong] || '')) + ' |');
}
