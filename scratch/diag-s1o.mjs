#!/usr/bin/env node
/* diag-s1o.mjs — 查 fit2 的 obs3 档 top-1=0.0% 是**哪种**错位（千问 · 10-29 01:2x）
 * 假设清单（跑前写死，逐条读回来）：
 *   H1 mine 里有 NaN ⇒ 比较恒 false ⇒ 当选永远停在 keep[0]；若 v7 的 argmax 又从不落 keep[0]，读数正好是 0.0%
 *   H2 头输出恒定（所有候选同一个数）⇒ top-1 靠下标破号 ⇒ flat 该非零
 *   H3 前向只认第一枚候选（obs3 的 parts() 里某项按 cand 长度建了缓冲 ⇒ 残留）
 *   H4 真·反号（我的分最高的那枚恰好是 v7 分最低的那枚）⇒ 看名次分布能分辨
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState;
let v7 = loadChamp(W, 'js/bundled-champion-3p.js', '');
if (!v7) { console.error('⛔ v7 读不出'); process.exit(2); }
v7 = Float64Array.from(v7);
const ARM = process.argv[2] || 'scratch/arms/202610281705-distill-S1o.bak';
const INPUT = /S1o/.test(ARM) ? 'obs3' : 'v7';
const A = installArch2(W, { mutMode: 'seg', input: INPUT === 'obs3' ? 'obs3' : undefined });
const mine0 = loadChamp(W, ARM, '');
if (!mine0) { console.error('⛔ 蒸馏包读不出：' + ARM); process.exit(2); }
const mineP = Float64Array.from(mine0);
console.log('# 档位 ' + ARM + ' ‖ arch=' + (INPUT === 'obs3' ? 'S1o(obs3)' : 'S1(v7)') + ' ‖ paramCount=' + P.paramCount());

let seed = 20261029;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const POOL = T.buildOpps(v7, 0.05);
const fixtures = [];
function walk(seedBase, n) {
  const choosers = [];
  for (let pid = 0; pid < n; pid++) choosers.push(T.policyChooserN(v7));
  const probe = (state, pid, legal) => {
    if (fixtures.length < 120 && legal && legal.length >= 2 && (pid % n) === 0) {
      const cl = S.cloneState(state); cl.rng = { next: rnd }; fixtures.push({ state: cl, pid, legal });
    }
    return POOL[(pid + 1) % POOL.length].sel(state, pid, legal);
  };
  const cs = choosers.slice(); cs[0] = probe;
  T.oneGameN(cs, seedBase, n, { regen: 0, mode: 'multi' });
}
for (let g = 0; fixtures.length < 120 && g < 90; g++) walk(90000 + g * 13, g % 2 ? 5 : 3);

const posHistMine = {}, posHistRef = {}, nNeg = {};
let groups = 0, nanGroups = 0, constGroups = 0, hit = 0, rankSumMine = 0;
for (const fx of fixtures) {
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  if (!cands || cands.length < 2) continue;
  const lg = P.forwardCands(fx.state, fx.pid, cands, mineP, { temp: 0.5 }).logits;
  const rv = cands.map((c) => P.value(fx.state, fx.pid, c.key, v7, c.bead || null, c));
  if (lg.length !== cands.length) { console.log('⛔ logits 长度 ' + lg.length + ' ≠ 候选数 ' + cands.length); process.exit(3); }
  const hasNaN = lg.some((v) => !Number.isFinite(v));
  if (hasNaN) nanGroups++;
  groups++;
  let a = 0, b = 0;
  for (let i = 1; i < lg.length; i++) if (lg[i] > lg[a]) a = i;
  for (let i = 1; i < rv.length; i++) if (rv[i] > rv[b]) b = i;
  const spread = Math.max(...lg) - Math.min(...lg);
  if (spread < 1e-9) constGroups++;
  posHistMine[a] = (posHistMine[a] || 0) + 1;
  posHistRef[b] = (posHistRef[b] || 0) + 1;
  if (a === b) hit++;
  /* H4：我这枚当选候选在 v7 名次表里排第几（1 = 最好） */
  const order = rv.map((v, i) => i).sort((p, q) => rv[q] - rv[p]);
  nNeg[order.indexOf(a)] = (nNeg[order.indexOf(a)] || 0) + 1;
  rankSumMine += order.indexOf(a) + 1;
}
console.log('  组数 ' + groups + ' ‖ 我的 logits 含 NaN 的组 ' + nanGroups + ' ‖ 头输出恒定的组 ' + constGroups + ' ‖ top-1 一致 ' + hit + '（' + (100 * hit / Math.max(1, groups)).toFixed(1) + '%）');
const keys = (o) => Object.keys(o).sort((p, q) => Number(p) - Number(q)).map((k) => k + ':' + o[k]);
console.log('  我当选候选的**位置**分布 ' + keys(posHistMine).join(' '));
console.log('  v7 当选候选的**位置**分布 ' + keys(posHistRef).join(' '));
console.log('  我这枚在 v7 名次表里的位置分布（0=最好） ' + keys(nNeg).join(' ') + ' ‖ 平均名次 ' + (rankSumMine / Math.max(1, groups)).toFixed(2));
console.log('  判读：NaN 组>0 ⇒ H1；恒定组≈全部 ⇒ H2；"我的当选在 v7 表里排最后"占多数 ⇒ H4 反号；否则 H3/别的');
