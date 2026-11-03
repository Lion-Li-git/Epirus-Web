#!/usr/bin/env node
/* rollout-pilot.mjs — "这一手之后赢的概率"当标签：先量**成本**与**它和 v7 的一致率**（千问 · 10-29 03:0x · #143 前置）
 * 口径写死在这里（不与 §E817 的 oracle1 混用，也不同名）：
 *   · 局面来源：v7 走出来的对局里焦点席（seat 0）的决策点（与 rankfit 缺省同一套抓法）；
 *   · 强制焦点席走候选 c 一手 ⇒ **之后焦点席继续用 v7、其余席用同一张对手表 POOL**（"teacher continuation"）；
 *   · 每条流一个种子 ⇒ win = 焦点席是否夺冠；REP 条取均值 = 标签。
 * 为什么要先跑这个：① 成本（每组 ~cands×REP 局残局）；② 如果 v7 自己的选择与"rollout 最优"只有 ~60% 一致，
 *   那"复刻 v7"这条路上限就摆在那儿 ⇒ 这条读数本身就值钱。
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GROUPS = Math.max(10, Number(arg('groups', 80)) || 80);
const REP = Math.max(1, Number(arg('rep', 8)) || 8);
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay;
let v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const POOL = T.buildOpps(v7, 0.05);
console.log('# rollout 标签试点 ‖ 组 ' + GROUPS + ' ‖ rep=' + REP + ' ‖ 延续：焦点席=v7 ‖ 其余席=POOL');

function mul(seedVal) { let a = seedVal >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let gseed = 20261029;
const grnd = () => { gseed = (gseed * 1664525 + 1013904223) >>> 0; return gseed / 4294967296; };
const FOCUS = 0;
function rolloutWin(state, pid, cand, n, streamId) {
  const q = S.cloneState(state);
  q.rng = { next: mul(((state.round | 0) + 1) * 2654435761 + pid * 7919 + streamId * 104729) >>> 0 };
  const chos = [];
  let used = false;
  const contV7 = T.policyChooserN(v7, 0.6);
  for (let i = 0; i < n; i++) {
    if (i !== FOCUS) { const o = POOL[(i + streamId) % POOL.length]; chos.push(o.sel); continue; }
    chos.push((st2, pid2, legal) => {
      if (used) return contV7(st2, pid2, legal);
      used = true;
      return { key: cand.key, target: cand.target == null ? null : cand.target, target2: cand.target2 == null ? null : cand.target2, bead: cand.bead || null };
    });
  }
  Play.autoGameN(q, chos);
  return q.winner === FOCUS ? 1 : 0;
}
const fixtures = [];
function walk(sb, n) {
  const cs = []; for (let p = 0; p < n; p++) cs.push(T.policyChooserN(v7));
  const probe = (st, p, legal) => {
    if (fixtures.length < GROUPS && legal && legal.length >= 2 && (p % n) === 0) {
      const cl = S.cloneState(st); cl.rng = { next: mul((fixtures.length + 1) * 2654435761 + 91) };
      fixtures.push({ state: cl, pid: p, legal, n });
    }
    return POOL[(p + 1) % POOL.length].sel(st, p, legal);
  };
  const copy = cs.slice(); copy[0] = probe;
  T.oneGameN(copy, sb, n, { regen: 0, mode: 'multi' });
}
const t0 = Date.now();
let g = 0;
while (fixtures.length < GROUPS && g < 2000) { walk(90000 + g * 13, g % 2 ? 5 : 3); g++; }
console.log('  抓局面 ' + fixtures.length + ' 组花了 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
const t1 = Date.now();
let agree = 0, tot = 0, rows = 0, spreadSum = 0;
for (const fx of fixtures) {
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  if (!cands || cands.length < 2) continue;
  const vals = [], ref = [];
  for (const c of cands) {
    let s = 0;
    for (let k = 0; k < REP; k++) s += rolloutWin(fx.state, fx.pid, c, fx.n, k + 1);
    vals.push(s / REP);
    ref.push(P.value(fx.state, fx.pid, c.key, v7, c.bead || null, c));
  }
  let bi = 0, ri = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] > vals[bi]) bi = i;
  for (let i = 1; i < ref.length; i++) if (ref[i] > ref[ri]) ri = i;
  const mx = Math.max(...vals), mn = Math.min(...vals);
  spreadSum += mx - mn;
  if (bi === ri) agree++;
  tot++; rows += cands.length;
}
const secs = (Date.now() - t1) / 1000;
console.log('  ⇒ 打完 ' + rows + ' 个"候选×' + REP + ' 流" = ' + rows * REP + ' 次残局，用 ' + secs.toFixed(1) + 's ‖ 每组 ' + (secs / Math.max(1, tot)).toFixed(3) + 's');
console.log('  ⇒ **v7 的选择与 rollout 最优的一致率 = ' + (100 * agree / Math.max(1, tot)).toFixed(1) + '%**（' + agree + '/' + tot + '）‖ 组内赢率极差均值 = ' + (spreadSum / Math.max(1, tot)).toFixed(3));
console.log('  ⇒ 抓一组的成本若 ≈' + (secs / Math.max(1, tot)).toFixed(2) + 's，则 1200 组 ≈ ' + (secs / Math.max(1, tot) * 1200).toFixed(0) + 's（一次性，标签冻住后 ES 不再花钱）');
