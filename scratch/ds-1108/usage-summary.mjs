
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('scratch/ds-1108/card-usage.tsv');
const H = t[0], iId = 0, iDist = H.indexOf('distinct'), iDef = H.indexOf('defShare');
const cards = H.slice(5);
const rows = t.slice(1).filter(r => r[0]);
const V7 = new Set(['Q-s47', 'T8-s114', 'U-s205']);
const pct = (r, k) => +r[H.indexOf(k)] || 0;
console.log('| 包 | 用卡数 | 防御% | 出手谱（≥2%） |');
console.log('|---|---|---|---|');
for (const r of rows) {
  const top = cards.map(k => [k, pct(r, k)]).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v.toFixed(0) + '%').join(' / ');
  console.log('| ' + (V7.has(r[0]) ? '**' + r[0] + '**(v7)' : r[0]) + ' | ' + r[iDist] + ' | ' + (+r[iDef]).toFixed(0) + ' | ' + top + ' |');
}
/* 池 vs v7 的卡覆盖差 */
const pool = rows.filter(r => !V7.has(r[0]));
const used = (set, k) => set.filter(r => pct(r, k) >= 0.5).length;
console.log('\n卡名 | 池里用它的枚数(/' + pool.length + ') | v7 三枚用它的枚数');
for (const k of cards) {
  const a = used(pool, k), b = used(rows.filter(r => V7.has(r[0])), k);
  if (a === 0 || b > 0) console.log('  ' + k.padEnd(10) + a + '  vs  ' + b);
}
const dists = pool.map(r => +r[iDist]).sort((a,b)=>a-b);
console.log('\n池用卡数：min ' + dists[0] + ' 中位 ' + dists[Math.floor(dists.length/2)] + ' max ' + dists[dists.length-1] + ' ‖ v7: ' + rows.filter(r=>V7.has(r[0])).map(r=>r[iDist]).join('/'));
