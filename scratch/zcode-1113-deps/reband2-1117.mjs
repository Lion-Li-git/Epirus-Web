/* reband2-1117.mjs —— 两带重切（用户令 03:3x：分带回两带，切点要拉开难度差距 + 最大化覆盖）。
 * 规则：hard = C̄ 前五（第5/6名边界落差 0.0257 全表最大谷，均差 0.128 ≈ 最大）；soft = 其余。
 * 覆盖核对：transfer 载体 MX4-GD-T2 已入池 soft ⇒ 全层级（T1/T2/T3/T4）在池内至少一枚载体。
 * 只改 tier 列，门账列不动。 */
import { readFileSync, writeFileSync } from 'node:fs';

const rd = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
const pool = rd('champion-map/data/page/pool-members.tsv');
const co = rd('champion-map/data/page/coords.tsv');
const ph = pool[0]; const pix = Object.fromEntries(ph.map((c, i) => [c, i]));
const cix = Object.fromEntries(co[0].map((c, i) => [c, i]));
const coBy = new Map(co.slice(1).map((r) => [r[cix.id], r]));

const mem = pool.slice(1).map((r, i) => {
  const c = coBy.get(r[pix.id]);
  const mxC = c ? +c[cix.MxC] : NaN, mxcl = c ? +c[cix.MxCL] : NaN;
  return { row: r, C: (Number.isFinite(mxC) && Number.isFinite(mxcl)) ? (mxC + mxcl) / 2 : null };
});
mem.sort((a, b) => (b.C ?? -9) - (a.C ?? -9));
const K = 5;
const out = [pool[0]];
const log = [];
mem.forEach((m, i) => {
  const tier = (i < K && m.C !== null) ? 'hard' : 'soft';
  const old = m.row[pix.tier];
  if (old !== tier) m.row[pix.note] = (m.row[pix.note] ? m.row[pix.note] + ' ‖ ' : '') + '11-17 两带重切：C̄=' + (m.C === null ? '—' : m.C.toFixed(4)) + ' ' + old + '→' + tier;
  m.row[pix.tier] = tier;
  log.push((i < K ? 'H' : 'S') + ' ' + m.row[pix.id] + '  C̄=' + (m.C === null ? '—' : m.C.toFixed(4)) + (old !== tier ? '（' + old + '→' + tier + '）' : ''));
  out.push(m.row);
});
writeFileSync('champion-map/data/page/pool-members.tsv', out.map((r) => r.join('\t')).join('\n') + '\n');
console.log(log.join('\n'));
