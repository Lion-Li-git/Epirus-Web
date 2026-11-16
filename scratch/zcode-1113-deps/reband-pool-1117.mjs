/* reband-pool-1117.mjs —— 池强度分带重做（用户令 02:0x：重新做池强度分带）。
 * 量具 = mx1116 mixed 夹具复合 C̄ =（MxC+MxCL）/2（11-16/17 全库同尺，962+ 枚有读数）。
 * 断点 = 实测分布的天然谷：hard ≥0.165 ‖ mid 0.135~0.165 ‖ soft <0.135（10/6/8）。
 * 只改 tier 列；invited/promoteVerdict/seatKill/note 全部不动（分带=强度分层，不洗门账）。 */
import { readFileSync, writeFileSync } from 'node:fs';

const rd = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
const pool = rd('champion-map/data/page/pool-members.tsv');
const co = rd('champion-map/data/page/coords.tsv');
const ph = pool[0]; const pix = Object.fromEntries(ph.map((c, i) => [c, i]));
const cix = Object.fromEntries(co[0].map((c, i) => [c, i]));
const coBy = new Map(co.slice(1).map((r) => [r[cix.id], r]));
const HARD = 0.165, MID = 0.135;

const out = [pool[0]];
const report = [];
for (const r of pool.slice(1)) {
  const id = r[pix.id];
  const c = coBy.get(id);
  const mxC = c ? +c[cix.MxC] : NaN, mxcl = c ? +c[cix.MxCL] : NaN;
  const C = (Number.isFinite(mxC) && Number.isFinite(mxcl)) ? (mxC + mxcl) / 2 : null;
  const tier = C === null ? r[pix.tier] : (C >= HARD ? 'hard' : C >= MID ? 'mid' : 'soft');
  const old = r[pix.tier];
  if (old !== tier) { r[pix.note] = (r[pix.note] ? r[pix.note] + ' ‖ ' : '') + '11-17 强度分带重做：C̄=' + C.toFixed(4) + ' ' + old + '→' + tier; report.push(id + ': ' + old + '→' + tier + '（C̄=' + C.toFixed(4) + '）'); }
  else report.push(id + ': ' + tier + '（C̄=' + (C === null ? '—' : C.toFixed(4)) + '，不变）');
  r[pix.tier] = tier;
  out.push(r);
}
writeFileSync('champion-map/data/page/pool-members.tsv', out.map((r) => r.join('\t')).join('\n') + '\n');
console.log(report.join('\n'));
const by = {};
for (const r of out.slice(1)) (by[r[pix.tier]] = by[r[pix.tier]] || []).push(1);
console.log('带计数: ' + JSON.stringify(Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length]))));
