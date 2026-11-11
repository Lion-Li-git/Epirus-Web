
import { readFileSync } from 'node:fs';
import { sandbox } from '../../tools/audit-lib.mjs';
const W = sandbox(); const R = W.EpirusRules; const all = R.skills.map(s => s.key);
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const pool = rd('champion-map/pool-members.tsv').slice(1);
const ids = new Set(pool.map(r => r[0]));
const u = rd('scratch/ds-1108/card-usage.tsv'); const H = u[0], cards = H.slice(5);
/* 旧表里没有 WIDE2-200：用 def-trio 那批？没有。改用 pool20 表 + 单补 WIDE2-200 的读数（已知 bagua18/guard5/holo3/ji46/gun13/charge6/railgun4/sword3） */
const extra = { 'WIDE2-200': { ji:46, bagua:18, gun:13, charge:6, guard:5, railgun:4, sword:3, holo:3 } };
const cov = {}; for (const k of all) cov[k] = 0;
let n = 0;
for (const r of u.slice(1)) {
  if (!ids.has(r[0])) continue; n++;
  for (const k of cards) if ((+r[H.indexOf(k)] || 0) >= 0.5) cov[k]++;
}
for (const [id, m] of Object.entries(extra)) { if (!ids.has(id)) continue; n++; for (const [k, v] of Object.entries(m)) if (v >= 0.5) cov[k]++; }
const used = all.filter(k => cov[k] > 0);
console.log('池 ' + ids.size + ' 枚（有出手谱 ' + n + '）覆盖 ' + used.length + '/' + all.length + ' = ' + (100*used.length/all.length).toFixed(0) + '%');
console.log('逐卡：' + used.map(k => k + ' ' + cov[k]).join(' ‖ '));
const zero = all.filter(k => cov[k] === 0);
console.log('未覆盖 ' + zero.length + ' 张：' + zero.join(' '));
