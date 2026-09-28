#!/usr/bin/env node
/* ============================================================================
 * probe-sig-separable.mjs —— **特征可分性前置检验**（v1.5.290 · §E134）
 *
 * 为什么要有它（今晚最贵的一条教训直接变成的工具）：
 *   §E129→§E133 一路都在"打一桌 → 算 fit/胜率 → 配区间"，而 §E131 的真正原因
 *   （33 个原型在签名空间里只落在 15 个点上、94% 的桌子逐位重合）
 *   本来用**几乎不花钱的一步**就能先量出来：只看"能不能把原型分开"，不看值多少分。
 *   ⇒ 本工具就是那一步。它**不打 fit、不算胜率、不 promote**，只回答一句：
 *     "**这组特征够不够把 33 个原型分开？**"
 *
 * 判据（§E134 跑前写死，含 03:05 那条只收紧不放松的口径澄清）：
 *   `U_sep` = **可分原型数**：原型 X 被算"分开"，当且仅当
 *     `min_{Y≠X} dist(质心X, 质心Y)  >  median_{X 内部两两} dist`
 *     （"别的环境离我，比我自己的桌子之间的距离还远"）
 *   **过线**：`U_sep ≥ 25`（33 个里至少 25 个）**且** 歧义率 ≤ 40%。
 *   次读数（只报不判）：逐样本唯一点数、逐原型质心唯一点数、留一最近邻准确率。
 *
 * 用法：node tools/probe-sig-separable.mjs [--games=40] [--n=3] [--ks=3,8,15] [--seed=4243] [--json=…]
 * ==========================================================================*/
import { writeFileSync } from 'node:fs';
import { sandbox, rejectUnknownFlags, mulberry32 } from './audit-lib.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { poolFromSpecs, heldFromNames, HELDOUT } from './regime-panel.mjs';
import { nearestDistinct, medianOf, separabilityOf, euclid } from './routing-gain-lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['games', 'n', 'ks', 'seed', 'json', 'quiet']);
const GAMES = Math.max(6, Number(arg('games', 40)) || 40);
const N = Math.max(3, Number(arg('n', 3)) || 3);
const KMAX = 20;                                          // §E135：半局级窗口（§E134 用的是 15）；**不往整局跑**（预注册里写死的限制）
const KS = (arg('ks', '8,15,20') || '').split(',').map(x => Number(x)).filter(x => x >= 1 && x <= KMAX);
const SEED0 = Number(arg('seed', 4243)) || 4243;
const U_BAR = 25, AMB_BAR = 0.40;                       // §E134 跑前定死

const W = sandbox(), B = W.EpirusBots, RU = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
if (!Play || typeof Play.autoGameN !== 'function' || !S || typeof S.createState !== 'function') {
  console.error('⛔ 拿不到 autoGameN/createState ⇒ 拒绝用近似算法出这份判据'); process.exit(2);
}
const { pool: POOL_BLOCKS, byFn } = poolFromSpecs(B, OPP_SPECS);
const regimes = POOL_BLOCKS.map(p => ({ name: p.name, sel: p.sel }));
for (const h of heldFromNames(B, byFn, Object.keys(HELDOUT))) { if (!h.clash) regimes.push({ name: h.name, sel: h.sel }); }

/* ---- 观测面（全部**置换不变**：跨对手席取均值/直方图，绝不按席位排列）----
 * A 类别直方图 ‖ B 资源轨迹（ep / 珠）‖ C 费列结构（打出卡的费用分布）‖ D 压制与伤害
 * ⚠ 费用是 `RU.byKey[key].cost`，函数型费用（聚能环/过载炮那类）单独占一格 —— 不许静默当 0。 */
const CATS = Object.keys(RU.byKey || {}).map(k => (RU.byKey[k] || {}).cat).filter(Boolean);
const CATS_U = [...new Set(CATS)].sort();
const ci = {}; CATS_U.forEach((c, i) => { ci[c] = i; });
const COST_BUCKETS = ['0', '1', '2', '3+', 'dyn'];      // 固定 5 格，跑前定死
function costBucket(st, pid, key) {
  const meta = (RU.byKey || {})[key] || {};
  const c = meta.cost;
  if (typeof c === 'function') { let v = null; try { v = Number(c(st, pid)); } catch (e) { v = null; } return (v === null || !isFinite(v)) ? 'dyn' : (v >= 3 ? '3+' : String(Math.max(0, Math.round(v)))); }
  const v = Number(c); if (!isFinite(v)) return 'dyn';
  return v >= 3 ? '3+' : String(Math.max(0, Math.round(v)));
}
function observe(rg) {
  const perGame = [];
  const neutral = B.pickBalanced;
  if (typeof neutral !== 'function') { console.error('⛔ 中性 0 座脚本 pickBalanced 取不到'); process.exit(2); }
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: mulberry32(SEED0 + g * 7919) }, N);
    st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
    const snaps = [], marks = [];
    const chs = [neutral]; for (let i = 1; i < N; i++) chs.push(rg.sel);
    Play.autoGameN(st, chs, undefined, function () {
      /* ⚠ **窗口截断要靠这里记的标记**，不能靠事件上的 `round` 字段 ——
       * 实测 `type:'action'` 的事件**根本没有 round**（`{"type":"action","pid":0,"key":"ji","outcome":"ok"}`），
       * 第一版拿 `e.round` 分组 ⇒ 全部落到"第 0 回合"⇒ A/C 两组其实把**整局**当成"前 K 回合"在算，
       * K=3/8/15 三档读数字父相同还看不出来。工具不崩、数看着合理 ⇒ 本仓最熟的那族错。 */
      marks.push({ round: st.round, at: st.events.length });
      if (st.round >= 1 && st.round <= KMAX) {
        const opps = [];
        for (let p = 1; p < N; p++) if (st.p && st.p[p]) opps.push(st.p[p]);
        if (opps.length) {
          const meanOf = (f) => opps.reduce((s, p) => s + f(p), 0) / opps.length;
          /* 架势/状态这些是**公共可见**的（`state.js` 的注释就写着"公共信息；供特征 T 块与 UI"）
           * ⇒ 路由器理论上能看见；§E135 赌的就是"看得见的状态比看不出的出招类别更能分开原型"。 */
          const stance = {
            guard: meanOf(p => ((p.guardNext || p.copiedGuard) ? 1 : 0)),
            bagua: meanOf(p => (p.baguaExtra ? 1 : 0)),
            fireWeak: meanOf(p => ((p.fireWeakNow || p.fireWeakNext) ? 1 : 0)),
            rod: meanOf(p => ((p.rodGuard || 0) > 0 ? 1 : 0)),
            taunt: meanOf(p => (p.tauntActive ? 1 : 0)),
            chain: meanOf(p => ((p.chains || []).length > 0 ? 1 : 0)),
            vamp: meanOf(p => (p.vampire ? 1 : 0)),
            night: meanOf(p => (p.nightmare ? 1 : 0)),
            ring: meanOf(p => (p.ringStreak || 0)),
            cannon: meanOf(p => (p.cannonCount || 0)),
            mineOn: meanOf(p => (p.mineArmed ? 1 : 0)),
            mineTurns: meanOf(p => (p.mineTurns || 0)),
            elec: meanOf(p => (p.elec || 0)), boom: meanOf(p => (p.boom || 0)),
          };
          /* 指向性（G 组）：对手席上一手指向谁 ⇒ "集火"与"各打各的"是**类别直方图看不见**的差别 */
          const tg = opps.map(p => p.lastTarget).filter(x => x != null);
          const uniq = new Set(tg).size;
          const shared = tg.length >= 2 && uniq < tg.length ? 1 : 0;
          const onZero = tg.length ? tg.filter(x => x === 0).length / tg.length : 0;
          snaps.push({
            round: st.round,
            epMean: meanOf(p => p.ep), epMax: Math.max(...opps.map(p => p.ep)),
            beadMean: meanOf(p => (p.elec || 0) + (p.boom || 0)),
            hp0: st.p[0] ? st.p[0].hp : null,
            hpOppMean: meanOf(p => p.hp),
            stance, tgUniqRatio: tg.length ? uniq / tg.length : 1, shared, onZero,
          });
        }
      }
    });
    marks.push({ round: 1e9, at: st.events.length });
    const evs = [];
    for (let i = 0; i < st.events.length; i++) {
      const e = st.events[i];
      if (e && e.type === 'action' && e.outcome === 'ok' && e.key && e.pid !== 0) evs.push({ idx: i, key: e.key, pid: e.pid });
    }
    perGame.push({ snaps, evs, marks, nEvents: st.events.length, finalRounds: st.round });
  }
  return perGame;
}
/** 前 K 回合的事件上界（`marks` 里第一个 round > K 的 `at`） */
function cutAt(g, K) {
  for (const m of g.marks) if (m.round > K) return m.at;
  return g.nEvents;
}
function inWindow(g, K) { const c = cutAt(g, K); return g.evs.filter(e => e.idx < c); }
const data = {};
for (const rg of regimes) if (!data[rg.name]) data[rg.name] = observe(rg);
const names = Object.keys(data);
if (names.length < 8) { console.error('⛔ 可用原型不足 8（实测 ' + names.length + '）⇒ 这份判据无从算起'); process.exit(2); }

/* ---- 把一局变成各组特征向量 ---- */
function vecA(g, K) {                                     // 类别直方图（占比，**只算前 K 回合**）
  const v = new Array(CATS_U.length).fill(0); let tot = 0;
  for (const e of inWindow(g, K)) { const c = (RU.byKey[e.key] || {}).cat; if (c != null && ci[c] != null) { v[ci[c]]++; tot++; } }
  return tot ? v.map(x => x / tot) : v;
}
function vecC(g, K) {                                     // 费列结构（占比，**只算前 K 回合**）
  const v = new Array(COST_BUCKETS.length).fill(0); let tot = 0;
  for (const e of inWindow(g, K)) { const i = COST_BUCKETS.indexOf(costBucket(null, e.pid, e.key)); if (i >= 0) { v[i]++; tot++; } }
  return tot ? v.map(x => x / tot) : v;
}
function vecB(g, K) {                                     // 资源轨迹：均值 / 峰值 / 斜率 / 高资源回合占比
  const s = g.snaps.filter(x => x.round <= K);
  if (!s.length) return [0, 0, 0, 0, 0, 0];
  const ep = s.map(x => x.epMean), bd = s.map(x => x.beadMean);
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const slope = ep.length >= 2 ? (ep[ep.length - 1] - ep[0]) / (ep.length - 1) : 0;
  const hiEp = ep.filter(x => x >= 3).length / ep.length;
  const hiBe = bd.filter(x => x >= 1).length / bd.length;
  return [m(ep), Math.max(...ep), slope, hiEp, m(bd), hiBe];
}
function vecD(g, K) {                                     // 压制与伤害：0 座掉血速率、对手掉血速率、有过伤的回合占比
  const s = g.snaps.filter(x => x.round <= K);
  if (s.length < 2 || s[0].hp0 == null) return [0, 0, 0];
  const d0 = (s[0].hp0 - s[s.length - 1].hp0) / s.length;
  const dO = (s[0].hpOppMean - s[s.length - 1].hpOppMean) / s.length;
  let hit = 0; for (let i = 1; i < s.length; i++) if (s[i].hp0 < s[i - 1].hp0 || s[i].hpOppMean < s[i - 1].hpOppMean) hit++;
  return [d0, dO, hit / (s.length - 1)];
}
function vecE(g, K) {                                     // §E135 E 架势与防御：八种公共可见状态的回合均值（占比形）
  const s = g.snaps.filter(x => x.round <= K);
  if (!s.length) return [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const m = (k) => s.reduce((a, x) => a + x.stance[k], 0) / s.length;
  const any = s.reduce((a, x) => a + ((x.stance.guard + x.stance.bagua + x.stance.fireWeak + x.stance.rod + x.stance.taunt) > 0 ? 1 : 0), 0) / s.length;
  return [m('guard'), m('bagua'), m('fireWeak'), m('rod'), m('taunt'), m('chain'), m('vamp'), m('night'), any];
}
function vecF(g, K) {                                     // §E135 F 资源存量轨迹：六种存量的"均值 + 峰值"
  const s = g.snaps.filter(x => x.round <= K);
  if (!s.length) return new Array(12).fill(0);
  /* ep 在快照顶层、珠/环/炮/雷在 `stance` 里（两处都查，别哪天搬个字段就静默变 0） */
  const val = (x, k) => (x.stance && x.stance[k] !== undefined ? x.stance[k] : (x[k] !== undefined ? x[k] : 0));
  const m = (k) => s.reduce((a, x) => a + val(x, k), 0) / s.length;
  const mx = (k) => Math.max(...s.map(x => val(x, k)));
  return [m('epMean'), mx('epMean'), m('elec'), mx('elec'), m('boom'), mx('boom'),
    m('ring'), mx('ring'), m('cannon'), mx('cannon'), m('mineOn'), m('mineTurns')];
}
function vecG(g, K) {                                     // §E135 G 指向性：目标集中度 / 同回合并指 / 指 0 座的比例
  const s = g.snaps.filter(x => x.round <= K);
  if (!s.length) return [0, 0, 0];
  const m = (k) => s.reduce((a, x) => a + x[k], 0) / s.length;
  return [m('tgUniqRatio'), m('shared'), m('onZero')];
}
const GROUPS = { A: vecA, B: vecB, C: vecC, D: vecD, E: vecE, F: vecF, G: vecG };
const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'ALL'];
function znorm(all) {                                     // 组合组用：每维在**全体样本**上 z 标准化（§E134 澄清里定死的拼接方式）
  const n = all.length, d = all[0].length;
  const mu = new Array(d).fill(0), sd = new Array(d).fill(0);
  for (let i = 0; i < d; i++) { mu[i] = all.reduce((s, x) => s + x[i], 0) / n; const v = all.reduce((s, x) => s + (x[i] - mu[i]) ** 2, 0) / n; sd[i] = Math.sqrt(v); }
  return all.map(x => x.map((v, i) => (sd[i] > 1e-9 ? (v - mu[i]) / sd[i] : 0)));
}

/* ---- 一把尺：`separabilityOf`（住在 routing-gain-lib，门 D196 直接喂合成向量验它）---- */
const score = (envVecs) => separabilityOf(envVecs, euclid);

const rows = [];
for (const K of KS) {
  const perGroup = {};
  for (const gname in GROUPS) {
    const ev = {}; for (const e of names) ev[e] = data[e].map(g => GROUPS[gname](g, K));
    perGroup[gname] = ev;
  }
  const allRaw = [];
  for (const e of names) for (let i = 0; i < data[e].length; i++) allRaw.push(
    Object.keys(GROUPS).reduce((acc, gname) => acc.concat(GROUPS[gname](data[e][i], K)), []));
  const z = znorm(allRaw);
  const combo = {}; let p = 0;
  for (const e of names) { combo[e] = []; for (let i = 0; i < data[e].length; i++) combo[e].push(z[p++]); }
  const labels = { ALL: combo };
  for (const gname in GROUPS) labels[gname] = perGroup[gname];
  /* 窗口自检：必须**走与特征向量同一条 `inWindow`**。
   * 第一版这里另写了一遍 `g.evs.filter(idx < cutAt(...))` ⇒ 把 `inWindow` 改坏也照样印 ✔
   * （等于一把只会给自己打勾的自检），是变异实测抓出来的：`inWindow` 整体失效时 D196 居然还是绿的。 */
  const allGames = [];
  for (const e of names) for (const g of data[e]) allGames.push(g);
  const inWin = medianOf(allGames.map(g => inWindow(g, K).length));
  const allE = medianOf(allGames.map(g => g.evs.length));
  console.log('\n  —— K=' + K + ' —— 窗口自检（' + allGames.length + ' 局取中位数）：A/C 实际用的那条 `inWindow` = **前 ' + K + ' 回合 '
    + inWin + ' 次出招** ‖ 整局 ' + allE + ' 次'
    + (K < KMAX && inWin >= allE ? '  ⛔ **窗口没截断**（这档读数等同于整局，别信）' : '  ✔'));
  for (const lab of ORDER) {
    const s = score(labels[lab]);
    const pass = s.U_sep >= U_BAR && s.ambRate !== null && s.ambRate <= AMB_BAR;
    rows.push({ K, group: lab, ...s, pass });
  }
}
console.log('# §E134/§E135 特征可分性前置检验 · ' + names.length + ' 个原型 × ' + GAMES + ' 局 · N=' + N + ' · seed=' + SEED0
  + ' · 窗口 K=' + KS.join('/') + ' · 过线：U_sep ≥ ' + U_BAR + ' 且 歧义率 ≤ ' + (100 * AMB_BAR) + '%（两条线都是跑前定死的）');
console.log('  组：A 出招类别直方图 ‖ B 资源轨迹(ep/珠) ‖ C 费列结构 ‖ D 压制与伤害'
  + ' ‖ **E 架势与防御** ‖ **F 资源存量六轨迹** ‖ **G 指向性(集火)** ‖ ALL 七组拼接(每维 z 标准化)');
console.log('| K | 组 | **U_sep**（/ ' + names.length + '） | 歧义率 | 唯一点(样本 / 质心) | LOO 准确率 | 过线？ |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log('| ' + r.K + ' | ' + r.group + ' | **' + r.U_sep + '** | ' + (r.ambRate === null ? '—' : (100 * r.ambRate).toFixed(0) + '%')
    + ' | ' + r.U_sample + ' / ' + r.U_centroid + ' | ' + (r.acc === null ? '—' : (100 * r.acc).toFixed(1) + '%')
    + ' | ' + (r.pass ? '✅ 过线' : '⛔ 不过线') + ' |');
}
for (const r of rows.filter(x => x.pass)) {
  console.log('\n  过线组 ' + r.group + '@K=' + r.K + ' 分不开的那几个（b/w ≤ 1 ⇒ 别的环境离我得比我自己的桌子还近）：'
    + r.worst.map(x => x.env + ' b/w=' + x.ratio).join(' ‖ '));
}
const anyPass = rows.some(r => r.pass);
console.log('\n  判读：' + (anyPass
  ? '有 ' + rows.filter(r => r.pass).length + ' 组过线 ⇒ 允许进 §E135（**终点必须直接落在 eval-5p 产品口径**，§E133 已证 N=3 不可外推）'
  : '⛔ **没有任何一组过线** ⇒ 桌面早期这几条便宜观测面**都分不开这 ' + names.length + ' 个原型**；'
    + '⇒ "改观测面"这件事的理由不能建立在这组特征上，剩下的只有更贵的观测（更长窗口 / 对局内状态）或承认不值得做'));
if (arg('json', '')) {
  writeFileSync(arg('json'), JSON.stringify({
    meta: { games: GAMES, n: N, seed0: SEED0, ks: KS, envs: names.length, uBar: U_BAR, ambBar: AMB_BAR },
    rows: rows.map(r => ({ K: r.K, group: r.group, U_sep: r.U_sep, ambRate: r.ambRate, U_sample: r.U_sample, U_centroid: r.U_centroid, acc: r.acc, pass: r.pass, worst: r.worst })),
    anyPass,
  }, null, 1));
  console.log('  json → ' + arg('json'));
}
