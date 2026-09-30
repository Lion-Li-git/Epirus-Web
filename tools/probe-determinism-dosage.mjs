#!/usr/bin/env node
/* §E191 · 对手随机化**剂量曲线**：信念搜索的夺冠增益里，有多少只是在"吃确定性"？
 *
 * 为什么要这一格：§E183 说 Route B 买到的是"收官能力"，§E179 的旁证说"搜索的价值在于拿模型做了 1-ply 重放、
 *   不在模型更准"。但"它是不是只在**对手是脚本**时才有效"这件事一直只是推断 —— 而它直接决定用户那句
 *   "要不要开档 / 按席位开"（难度表 §E173 已给出开 4 席玩家夺冠 0.5~1.3%）。
 *   ⇒ 做法：把环境原型对手包一层"**以概率 p 改出一张随机可负担的卡**"，扫 p ⇒ 若 B1 对 A0 的差随 p 塌，
 *     "吃确定性"就有剂量曲线；若不塌，它是在读局面本身。
 *
 * 装配与 §E185~§E190 同一张产品桌（0 席人类形状 ‖ 1 席被测 ‖ 2/3 席对手 ‖ 4 席关档冠军），两批 seed 带、同批配对。
 * 只读 `js/**`，不改引擎、不加门、不动冠军包。
 */
import { sandbox, mulberry32, loadChamp } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';

const argv = process.argv.slice(2);
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const GAMES = Math.max(4, Number(arg('games', 14)) || 14);
const BANDS = arg('band', 'all') === 'all' ? [1, 2] : [Number(arg('band', 1))];
const SEED = { 1: 4100, 2: 21000 };
const PS = (arg('p', '') || '0,0.2,0.4,0.6,0.8').split(',').map(Number);
const N = 5, FOCUS = 1;
const W = sandbox(), S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENV_PICK = ['random', 'balanced', 'aggro', 'defend', 'wall', 'antidef', 'breakdef', 'mix', 'farmer', 'tankline', 'heavyfire', 'ringspam'];
const ENVS = ENV_PICK.map(n => { const q = POOL.find(x => x.name === n); if (!q) { console.error('⛔ 环境 `' + n + '` 不在原型池'); process.exit(2); } return q; });
const HB = loadPool(W, 'human');

function armChooser(kind) {
  if (kind === 'A0') return T.policyChooserN(params, 0.15);
  T.setBeliefPly(1); T.setBeliefTarget(0); T.setBeliefTie(0); T.setBeliefBead(0); T.setBeliefRingPrice(0); T.setBeliefSearch(0);
  return T.policyChooserBelief(params, 0.15);              // **实例级**开档（模块档恒关 ⇒ 对手席不会被带着搜）
}
/** 打乱用的是**独立随机流** `ornd`，不是 `state.rng`。
 *   ⚠ 为什么不能抽 `state.rng`：策略自己的温度采样也抽它（`policy.js:713` 那条）⇒ 提高 p 会顺带把
 *     **两臂自己的抽样位置**挪开，等于在"对手变随机"之外又加了一个扰动，端点之间不再同流。
 *   ⇒ 每局一条自己的 `ornd`，p 只改对手的分布，不改桌子的随机流。
 *  ⚠ p=0 那一档必须**只调一次** `sel`：第一版写成 `sel(...) && sel(...).key !== undefined ? sel(...) : sel(...)`
 *    ⇒ 一个决策里把对手脚本跑三遍（浪费，还会污染 `bots.js` 那份共享 `__mem`）。 */
function randomize(sel, p, agg, ornd) {
  return function (state, pid, legal) {
    agg.oppActs++;
    if (p > 0 && ornd() < p) {
      const aff = (legal || []).filter(l => l.affordable);
      if (aff.length) { agg.overrode++; return aff[Math.floor(ornd() * aff.length)]; }
    }
    return sel(state, pid, legal);
  };
}
function playOne(kind, env, p, g, seedBase, agg) {
  const rnd = mulberry32(seedBase + g * 7919);
  const ornd = mulberry32((seedBase ^ 0x5f3759df) + g * 104729);          // 对手打乱专用流
  const st = S.createState('multi', { next: rnd }, N);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const base = armChooser(kind);
  const rec = function (state, pid, legal) { const r = base(state, pid, legal); if (pid === FOCUS && r) agg.acts++; return r; };
  const mimic = makeMimic(W, HB, 'rand', function () { return st.rng.next(); });
  const champ = T.policyChooserN(params, 0.15);
  const wrapped = randomize(env.sel, p, agg, ornd);
  Play.autoGameN(st, [mimic, rec, wrapped, wrapped, champ]);
  const me = st.p[FOCUS];
  agg.games++;
  if (me && me.hp > 0 && st.p.every((q, i) => i === FOCUS || q.hp <= me.hp)) agg.focusWin++;
  if (st.p[0].hp > 0 && st.p.slice(1).every(q => q.hp <= st.p[0].hp)) agg.humanWin++;
  agg.rounds += st.round;
}
const key = (p, kind) => p + '|' + kind;
const RES = {};
for (const band of BANDS) {
  RES[band] = {};
  for (const p of PS) for (const kind of ['A0', 'B1']) {
    const agg = { acts: 0, games: 0, focusWin: 0, humanWin: 0, rounds: 0, oppActs: 0, overrode: 0 };
    RES[band][key(p, kind)] = agg;
    for (const env of ENVS) for (let g = 0; g < GAMES; g++) playOne(kind, env, p, g, SEED[band], agg);
    process.stdout.write('|');
  }
}
process.stdout.write('\n');
console.log('# §E191 对手随机化剂量曲线（产品桌 n=5 · 焦点席 1 号 · ' + GAMES + ' 局/环境 × ' + ENVS.length + ' 环境 · p = 对手"改出随机可负担卡"的概率）');
for (const band of BANDS) {
  console.log('\n## 带 ' + band + '（seed ' + SEED[band] + '）');
  console.log('| p（名义） | 实际打乱率 | `A0` 关档夺冠 | `B1` ply1 夺冠 | **差 B1−A0** | 人类席夺冠 A0 / B1 | 局长 A0 / B1 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const p of PS) {
    const a = RES[band][key(p, 'A0')], b = RES[band][key(p, 'B1')];
    const w = (t) => 100 * t.focusWin / Math.max(1, t.games), hw = (t) => 100 * t.humanWin / Math.max(1, t.games), rd = (t) => t.rounds / Math.max(1, t.games);
    const eff = 100 * (a.overrode + b.overrode) / Math.max(1, a.oppActs + b.oppActs);
    const d = w(b) - w(a);
    console.log('| **' + p.toFixed(1) + '** | ' + eff.toFixed(1) + '% | ' + w(a).toFixed(1) + '% | ' + w(b).toFixed(1) + '% | **'
      + (d >= 0 ? '+' : '') + d.toFixed(1) + 'pt** | ' + hw(a).toFixed(1) + ' / ' + hw(b).toFixed(1) + ' | ' + rd(a).toFixed(1) + ' / ' + rd(b).toFixed(1) + ' |');
  }
}
/* 剂量斜率：把 p 当自变量，对"差"做最小二乘 ⇒ 一个数就能说"吃确定性有多陡" */
for (const band of BANDS) {
  const xs = [], ys = [];
  for (const p of PS) {
    const a = RES[band][key(p, 'A0')], b = RES[band][key(p, 'B1')];
    xs.push(p); ys.push(100 * b.focusWin / Math.max(1, b.games) - 100 * a.focusWin / Math.max(1, a.games));
  }
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  console.log('\n> 带 ' + band + ' 斜率：**每把对手确定性打乱 100%，B1 对 A0 的夺冠差变化 ' + (slope >= 0 ? '+' : '') + slope.toFixed(1) + 'pt**'
    + ' ‖ 端点差 p=0 ' + ys[0].toFixed(1) + 'pt → p=' + PS[PS.length - 1] + ' ' + ys[ys.length - 1].toFixed(1) + 'pt');
}
console.log('\n## 自检');
let bad = [];
for (const band of BANDS) for (const kind of ['A0', 'B1']) {
  const st = RES[band][key(0, kind)];
  if (st.overrode !== 0) bad.push('带' + band + ' ' + kind + '：p=0 却发生了 ' + st.overrode + ' 次打乱 ⇒ 包装漏了，端点不可比');
  if (st.acts / Math.max(1, st.games) < 6) bad.push('带' + band + ' ' + kind + '：每局出手 ' + (st.acts / st.games).toFixed(1) + ' < 6 ⇒ 桌没跑起来');
  const hi = RES[band][key(PS[PS.length - 1], kind)];
  if (!(hi.oppActs > 0 && hi.overrode / hi.oppActs > 0.3)) bad.push('带' + band + ' ' + kind + '：最大 p 下实际打乱率只有 ' + (100 * hi.overrode / Math.max(1, hi.oppActs)).toFixed(1) + '% ⇒ 剂量没给上去（曲线不算数）');
}
console.log(bad.length ? '⛔ ' + bad.join('\n⛔ ') : '✔ p=0 端点未被扰动（与基线同形）‖ 桌是活的 ‖ 最大 p 档实际打乱率 >30%');
