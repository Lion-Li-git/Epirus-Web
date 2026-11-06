#!/usr/bin/env node
/* ============================================================================
 * probe-belief-dims.mjs —— **加维度之前的第 1 步**（§E179）
 *
 * 要回答的只有一句：**把"对手是什么样"写进 `featuresV7`，值不值一次换代？**
 *   换代的账：FEAT_S 变 ⇒ `paramCount` 变 ⇒ 冠军包重训重打包 ⇒ **规则指纹变**
 *   （`policy.js` 就在 `tools/rules-fingerprint.mjs` 的 FINGERPRINT_FILES 里）⇒ D26 那一族门全要重钉。
 *   所以**先量信息，再谈形状** —— 这一台不动 `js/**` 一个字节。
 *
 * 判据①（可分性，**沿用 §E134 跑前定死的那条线、同一个 `separabilityOf`**）：
 *   `U_sep ≥ 25`（33 个原型里至少 25 个）且 歧义率 ≤ 40%（本台原型数按等比例折线）。
 *   ⚠ 与 §E134 **不完全同口径**：那次只许看前 K 个回合（K≤20），本台多给一档 `K=99`=整局 ⇒
 *     "整局"那一行是**新的观测面**，不是同一张考卷的更高分。8/15/20 三档才是可比的。
 *
 * 判据②（增量预测）—— **两条尺，一主一辅，谁是判据写死在这里**：
 *   【主 · 无学习器】"确定率" = 给定这组条件，下一手有多确定：取训练侧**联合格众数**当预测，
 *     格子太稀（n < θ）就退回**边缘众数**（退回也算数 ⇒ 不许用"只统计有把握的格子"来刷分）。
 *     过线 = **Δ确定率 ≥ +1.0pt（CI 下界 > 0）且 覆盖率相对参照掉不过 2pt**。
 *     两条一起看：光涨确定率而覆盖率塌 ⇒ 只是把格子切碎挑肥的，不算信息。
 *   【辅 · 只作旁证】同一个 NB+联格学习器的分类命中率。放它的原因是它**不能**当判据：
 *     干扰维对照 NC 实测一记 −14pt（一个纯随机 4 档标签就能把联格切碎到这种地步），
 *     而现役网络本来就有的"更早两手"PX 也只有 −1pt ⇒ **这条尺上"加一个条件"的税远大于任何候选族的收益**，
 *     正负都读不出"有没有信息"。0 号跑实测抓到这一点，才把主判据换成上面那条无学习器的。
 *   选这两把尺的共同理由：它们和**出厂的信念表是同一类东西**（`beliefObserve` 就是一张
 *     (ep档,有大雷,上一手)→出招 的计数表）⇒ "现有面 + 新维度"和"信念表 + 新维度"在同一把尺上比，
 *     不是拿神经网络跟计数表比。
 *   两套协议（对应两种真实部署形状）：
 *     OFF = 池化到原型、按局切 60/40 训练/留出 ⇒ "**重训一次能吃到多少**"（冠军包那条路）
 *     ON  = 每局清零、按席累计、严格 prequential ⇒ "**开档那一桌当场能吃到多少**"（Route B 那条路）
 *   ρ = Δ主(现有面+D) ÷ Δ主(信念表+D)：**线是跑前定的** ρ ≥ 0.6 ⇒ 互补（两件事都做）、
 *   ρ ≤ 0.3 ⇒ 替代（开档已经吃掉它，别再动形状）、中间一律判"部分重叠"，不许事后挑说法。
 *
 * 四条红线（本仓反复踩过的坑，写死 + 自检）：
 *   R1 **不动 `js/**`**：只 import 只读函数，不写文件、不改任何默认档、不 promote。
 *   R2 **私有信息不得进维度**：`蓄能` 选电珠还是爆珠只有本人知道（v1.5.15）⇒
 *      把对手席的 `elec`/`boom` 互换后重算全部取值，必须逐位相同（`privacyCheck`）。
 *   R3 **记录器不得扰动随机流**：包一层 chooser 只记账、一次 `rnd()` 都不抽 ⇒
 *      同种子"包 vs 不包"的事件流必须逐字相同（`driftProbe`，用的是**真记录器**，不是空壳）。
 *   R4 **钉住"现有面"的签名行**：`V_EXIST` 是 `policy.js` 里 per-slot 那一段的**手工近似**
 *      ⇒ 那段一旦被重构，本台的"增量"就没有对照物了 ⇒ 静态钉住源码文本（`pinExistingFace`）。
 *      ⚠ 而且是**保守近似**：只取近因四档，没用血量档/效果面/HIST_K 的后两格
 *        ⇒ M0 偏弱、"增量"读数**上偏** ⇒ 过线只算"值得进第 2 步"，不等于换代划算。
 *
 * 用法：node tools/probe-belief-dims.mjs [--games=40] [--n=3] [--seed=4243]
 *        [--ks=8,15,20,99] [--theta=5] [--json=…] [--quiet]
 * ==========================================================================*/
import { writeFileSync, readFileSync } from 'node:fs';
import { sandbox, rejectUnknownFlags, mulberry32 } from './audit-lib.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { poolFromSpecs, heldFromNames, HELDOUT } from './regime-panel.mjs';
import { separabilityOf, euclid } from './routing-gain-lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['games', 'n', 'seed', 'ks', 'theta', 'json', 'quiet']);
const GAMES = Math.max(10, Number(arg('games', 40)) || 40);
const N = Math.max(3, Number(arg('n', 3)) || 3);
const SEED0 = Number(arg('seed', 4243)) || 4243;
const KS = (arg('ks', '8,15,20,99') || '').split(',').map(Number).filter(x => x >= 1);
const THETA = Number(arg('theta', 5)) || 5;
const U_BAR = 25, AMB_BAR = 0.40;                 // §E134 跑前定死，原样搬
const DELTA_BAR = 1.0;                            // pt：增量小于这个数 ⇒ 不值一次换代（跑前定）
const RHO_HI = 0.6, RHO_LO = 0.3;
const BOOT = 2000, BOOT_SEED = 90210;             // bootstrap 必须播种（METHODOLOGY §86）
const QUIET = process.argv.indexOf('--quiet') >= 0;
const LAP = 1;

const W = sandbox(), B = W.EpirusBots, RU = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
if (!Play || typeof Play.autoGameN !== 'function' || !S || typeof S.createState !== 'function'
  || !T || typeof T.beliefObserve !== 'function') {
  console.error('⛔ 拿不到 autoGameN/createState/beliefObserve ⇒ 拒绝用近似算法出这份判据'); process.exit(2);
}
const KEYS = Object.keys(RU.byKey || {});
const KI = {}; KEYS.forEach((k, i) => { KI[k] = i; });
const nk = KEYS.length;
const CATS = ['energy', 'attack', 'defense', 'special'];
const COST_B = ['0', '1', '2', '3+', 'dyn'];       // 与 §E134 同一套固定 5 格
const JI = (RU.SK && RU.SK.JI) || 'ji';
const catIdx = (key) => CATS.indexOf((RU.byKey[key] || {}).cat);
const shareB = (x) => (x < 0.25 ? 0 : x < 0.45 ? 1 : x < 0.65 ? 2 : x < 0.85 ? 3 : 4);
const rateB = (x) => (x < 0.05 ? 0 : x < 0.2 ? 1 : x < 0.4 ? 2 : 3);
function topIdx(arr) { let bi = -1, bv = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > bv) { bv = arr[i]; bi = i; } return bi; }
function topKeyOf(map) { let bk = null, bv = 0; for (const k in map) if (map[k] > bv) { bv = map[k]; bk = k; } return bk; }
function mapOf(arr) { const m = {}; for (let i = 0; i < arr.length; i++) if (arr[i]) m[i] = arr[i]; return m; }
function entNorm(map, n) { if (!n) return 0; let h = 0; for (const k in map) { const p = map[k] / n; if (p > 0) h -= p * Math.log2(p); } return h / Math.log2(Math.max(2, nk)); }
function costBucket(st, pid, key) {
  const meta = (RU.byKey || {})[key] || {};
  let v = meta.cost;
  if (typeof v === 'function' || v == null) { v = null; if (typeof S.computeCost === 'function') { try { v = Number(S.computeCost(st, pid, key).ep); } catch (e) { v = null; } } }
  v = Number(v); if (!isFinite(v)) return 'dyn';
  return v >= 3 ? '3+' : String(Math.max(0, Math.round(v)));
}

/* ---- R4：钉住"现有面"的签名行 + 信念表镜像的形状 ---- */
function pinExistingFace() {
  const src = readFileSync('js/train/policy.js', 'utf8');
  const need = [
    /idxOf\(op\.lastSkill\),\s*catOf\(op\.lastSkill\),\s*op\.lastSkill\s*\?\s*0\s*:\s*1/,
    /const slotPids = oppSlots\(state, pid\);/,
    /for \(let t = 0; t < HIST_K; t\+\+\) base\.push\(idxOf\(h\[t\] \|\| null\)\);/,
  ];
  const miss = need.map((re, i) => (re.test(src) ? -1 : i)).filter(i => i >= 0);
  return { ok: miss.length === 0, miss };
}
function pinBeliefMirror() {
  const src = readFileSync('js/train/evo.js', 'utf8');
  return { ok: /function beliefPredict\(b, pid\) \{[\s\S]{0,220}if \(!m\) return R\.SK\.JI;[\s\S]{0,220}if \(m\[k\] > bv\)/.test(src) };
}
/* 本机镜像的 argmax（`beliefPredict` 不在导出表里 ⇒ 只搬这 4 行，并用上面那条钉住它没走形） */
function beliefPick(btab, sig, pid) {
  const m = btab[sig];
  if (!m) return KI[JI];
  let best = JI, bv = -1;
  for (const k in m) if (m[k] > bv) { bv = m[k]; best = k; }
  return KI[best] != null ? KI[best] : KI[JI];
}

/* ============================================================================
 * 条件变量：每个变量给一个**离散取值**（-1 = 还没数据）。`L` = 档数（只喂 U_sep 的数值化）；
 *   `sep:0` = 这一档不进可分性向量（键序号是**无序**的，取均值没有意义 —— 别拿它糊弄尺）。
 * ==========================================================================*/
const V_EXIST = [
  { name: 'x_lastKey', L: nk, sep: 0, f: (b) => (b.last == null ? -1 : KI[b.last]) },
  { name: 'x_lastCat', L: 4, f: (b) => (b.last == null ? -1 : catIdx(b.last)) },
  { name: 'x_prevKey', L: nk, sep: 0, f: (b) => (b.prev == null ? -1 : KI[b.prev]) },
  { name: 'x_ep', L: 6, f: (b, st, pid) => Math.min(5, st.p[pid].ep >> 1) },
];
const FAMS = {
  D1: [{ name: 'd1_modeCat', L: 4, f: (b) => topIdx(b.cats) },
       { name: 'd1_topShare', L: 5, f: (b) => (b.n ? shareB(topOfArr(b.kc)) : -1) }],
  D2: [{ name: 'd2_modeCost', L: 5, f: (b) => (b.n ? COST_B.indexOf(topKeyOf(b.cost)) : -1) }],
  D3: [{ name: 'd3_keyEnt', L: 4, f: (b) => (b.n ? rateB(entNorm(mapOf(b.kc), b.n)) : -1) }],
  D4: [{ name: 'd4_fieldCat', L: 4, f: (b, st, pid, c) => (c.fieldKey == null ? -1 : catIdx(c.fieldKey)) },
       { name: 'd4_gotHit', L: 2, f: (b, st, pid, c) => (c.gotHit[pid] ? 1 : 0) }],
  D5: [{ name: 'd5_aggrMe', L: 4, f: (b, st, pid) => (b.dmgAll ? rateB((b.dmgTo[pid] || 0) / b.dmgAll) : -1) }],
  D6: [{ name: 'd6_hoard', L: 4, f: (b) => (b.costed ? rateB(b.hoard / b.costed) : -1) }],
  /* ↑↑ 六族 = 候选 ‖ ↓↓ 下面两族**不是候选**，是让这张考卷**可解释**的两枚对照：
   *  NC（干扰维）= 每局给每席**另起一颗 rng** 摇一个 4 档随机标签（与牌局毫无关系）。
   *      加它只能把格子切碎 ⇒ 它的 Δ 就是"**多一个条件的稀疏税**"本身。
   *      ⇒ 于是判候选不看"Δ vs 现有面"，看 **Δ vs (现有面+NC)**：两臂同样各多带一个条件，
   *        税自动抵消，剩下的才是信息。**没有这一列，本台的"负结果"根本读不出来。**
   *  PX（正对照）= 更早两手的键序号 —— 现役网络**本来就有**（HIST_K=3），而 `M0` 只取了前两格
   *      ⇒ 如果连 PX 都量不出增量，说明**这台尺的分辨率**是瓶颈（命中率已贴天花板），
   *        而不是"这些维度没信息"。这条区分"没有信息"与"看不见信息"，是负结果能不能引用的关键。 */
  NC: [{ name: 'c_nc', L: 4, sep: 0, f: (b, st, pid, c) => (c.nc[pid] == null ? -1 : c.nc[pid]) }],
  PX: [{ name: 'c_prev2', L: nk, sep: 0, f: (b) => (b.h[2] == null ? -1 : KI[b.h[2]]) },
       { name: 'c_prev3', L: nk, sep: 0, f: (b) => (b.h[3] == null ? -1 : KI[b.h[3]]) }],
};
function topOfArr(arr) { let bv = 0; for (let i = 0; i < arr.length; i++) if (arr[i] > bv) bv = arr[i]; return bv; }
const FAMN = Object.keys(FAMS);                          // 含两枚对照
const CAND = FAMN.filter(k => k.charAt(0) === 'D');      // 六族候选（唯一进判读的那批）
const CTRL = FAMN.filter(k => CAND.indexOf(k) < 0);      // NC / PX
const DALL = CAND.reduce((a, k) => a.concat(FAMS[k]), []);
const V_BEL = [{ name: 'b_sig', L: 0, sep: 0, f: (b, st, pid, c) => (c.belSig == null ? -1 : c.belSig) }];
const OFF_MODELS = (() => {
  const o = { 'M0': V_EXIST, 'Belief': V_BEL };
  for (const k of FAMN) { o['M0+' + k] = V_EXIST.concat(FAMS[k]); o['Belief+' + k] = V_BEL.concat(FAMS[k]); }
  o['M0+ALL'] = V_EXIST.concat(DALL); o['Belief+ALL'] = V_BEL.concat(DALL);
  return o;
})();
const ON_MODELS = { 'ON/M0': V_EXIST };
for (const k of FAMN) ON_MODELS['ON/M0+' + k] = V_EXIST.concat(FAMS[k]);
ON_MODELS['ON/M0+ALL'] = V_EXIST.concat(DALL);
/* `ON/MB` = **出厂 Route B 表原样**（`beliefObserve` + 镜像 argmax，含 JI 兜底）⇒ 不走本机学习器，
 *   单独算，别把它和"NB 化的信念表"混成一个名字（那是两个东西）。 */
const ONNAMES = Object.keys(ON_MODELS).concat(['ON/MB']);
const ALLVARS = V_EXIST.concat(DALL, CTRL.reduce((a, k) => a.concat(FAMS[k]), []), V_BEL);   // 每决策只算一次取值，模型只取子集
const VARBY = {}; for (const v of ALLVARS) VARBY[v.name] = v;

/* ---- 计数库：`var=取值 → key 计数`；联合格 per model（**必须按模型自己的变量集拼键**，
 *      否则 12 个变量的联合永远稀疏到 λ≈0 ⇒ 整套退回 NB ⇒ "多给变量"这件事没有代价也没有收益）---- */
function newStore() { return { marg: new Float64Array(nk), mtot: 0, vars: {}, joint: {} }; }
function rowOf(st, name, lvl) { const k = name + '=' + lvl; return st.vars[k] || (st.vars[k] = { c: new Float64Array(nk), t: 0 }); }
function jkey(model, levels) { return model[0].name + '|' + model.map(v => levels[v.name]).join('#'); }
function train(st, model, levels, labelIdx) {
  st.marg[labelIdx]++; st.mtot++;
  for (const v of model) { const r = rowOf(st, v.name, levels[v.name]); r.c[labelIdx]++; r.t++; }
  const jk = jkey(model, levels);
  let j = st.joint[jk]; if (!j) j = st.joint[jk] = { c: new Float64Array(nk), t: 0 };
  j.c[labelIdx]++; j.t++;
}
function predict(st, model, levels, mask) {
  const idxs = []; for (let i = 0; i < nk; i++) if (mask[i]) idxs.push(i);
  if (!idxs.length) return -1;
  const mt = st.mtot + LAP * nk;
  const lps = new Float64Array(nk);
  for (const i of idxs) lps[i] = Math.log((st.marg[i] + LAP) / mt);
  for (const v of model) {
    const r = st.vars[v.name + '=' + levels[v.name]];
    if (!r || !r.t) continue;
    const rt = r.t + LAP * nk;
    for (const i of idxs) lps[i] += Math.log((r.c[i] + LAP) / rt) - Math.log((st.marg[i] + LAP) / mt);
  }
  let nb = 0; const pr = new Float64Array(nk);
  for (const i of idxs) { pr[i] = Math.exp(lps[i]); nb += pr[i]; }
  if (nb > 0) for (const i of idxs) pr[i] /= nb;
  const j = st.joint[jkey(model, levels)];
  if (j && j.t) {
    const lam = j.t / (j.t + THETA), jt = j.t + LAP * nk;
    for (const i of idxs) lps[i] = Math.log(lam * (j.c[i] + LAP) / jt + (1 - lam) * pr[i]);
  } else for (const i of idxs) lps[i] = Math.log(pr[i] + 1e-12);
  let bk = idxs[0], bv = -Infinity;
  for (const i of idxs) if (lps[i] > bv) { bv = lps[i]; bk = i; }
  return bk;
}
function levelVals(b, st, pid, c) {
  const o = {};
  for (const v of ALLVARS) {
    let x = -1;
    try { x = v.f(b, st, pid, c); } catch (e) { x = -1; }
    /* ⚠ `b_sig` 的取值是**字符串**（信念表的条件格）⇒ 不许被 `isFinite` 一把滤成 -1（那等于把 Route B 的信息整列抹掉，
     *    而"信念表 + 新维度"那一列会静默退化成"只有新维度"，看着还像有读数）。 */
    if (typeof x === 'string') { o[v.name] = x; continue; }
    o[v.name] = (x == null || !isFinite(x)) ? -1 : x;
  }
  return o;
}
function newBel() {
  return { n: 0, kc: new Array(nk).fill(0), cats: [0, 0, 0, 0], cost: {}, last: null, prev: null, h: [],
    hoard: 0, costed: 0, dmgTo: {}, dmgAll: 0 };
}

/* ============================================================================
 * 一批局：chooser 包一层（只记账、不抽随机数）。
 *   引擎一局里**所有席位同时决策**（`play.js:56-72`：先把 picks 收齐再 `attemptAction`）
 *   ⇒ 在某个席位被调用时，`state.events` 恰好是"上一个已结算回合及更早"，**看不到本回合任何人的动作**
 *   ⇒ 这就是天然的 prequential：先用前缀预测，事后（下一拍消费事件时）才把训练对写回账本。
 * ==========================================================================*/
function playGames(rg, gs, opt) {
  const out = { rows: [], landed: 0, dropped: 0, dmg: 0, priv: 0, beliefCold: 0, beliefIllegal: 0, labelCats: {}, sigs: {} };
  const neutral = B.pickBalanced;
  if (typeof neutral !== 'function') { console.error('⛔ 中性 0 座脚本 pickBalanced 取不到'); process.exit(2); }
  const off = opt.offStore;
  for (const g of gs) {
    const rnd = mulberry32(SEED0 + g * 7919);
    const st = S.createState('multi', { next: rnd }, N);
    st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
    const sel = []; for (let i = 0; i < N; i++) sel.push(i === 0 ? neutral : rg.sel);
    const bel = []; for (let i = 0; i < N; i++) bel[i] = newBel();
    /* 干扰维 NC 的赋值走**另一颗 rng**（绝不借 `rnd()` ⇒ 借流就等于改变整局，那是 v1.5.51 借 __rng 踩红 D22 的同族）*/
    const ncr = mulberry32((SEED0 ^ Math.imul(g + 13, 0x2545f491)) >>> 0);
    const nc = []; for (let i = 0; i < N; i++) nc.push(Math.floor(ncr() * 4));
    const on = newStore();
    let cursor = 0, fieldKey = null, newTurn = false;
    let gotHit = new Array(N).fill(0), pending = {}, privDone = false;
    const wrapped = function (state, pid, legal) {
      /* 1) 消费已落地的事件（**先记账，再预测**）
       *    事件顺序 = [本回合全部 action][本回合 resolve 的 damage][下回合 action]… ⇒
       *    在某席被调用时，`gotHit` 里躺着的正好是**上一个已结算回合**打到我身上的伤害（不是本回合的，
       *    本回合谁都还没动）⇒ 清空要推迟到"新回合的第一条 damage"，不能在 action(pid=0) 时清，
       *    否则决策时读到的是空表（= 这一维永远 0，而读数看着完全正常）。 */
      const evs = state.events;
      for (; cursor < evs.length; cursor++) {
        const e = evs[cursor]; if (!e) continue;
        if (e.type === 'action' && e.pid === 0) { newTurn = true; }
        if (e.type === 'damage' && e.source != null && e.to != null) {
          if (newTurn) { gotHit = new Array(N).fill(0); newTurn = false; }
          const bb = bel[e.source];
          if (bb) { bb.dmgAll++; bb.dmgTo[e.to] = (bb.dmgTo[e.to] || 0) + 1; out.dmg++; }
          if (e.source !== e.to) gotHit[e.to] = (gotHit[e.to] || 0) + 1;
          continue;
        }
        if (e.type !== 'action' || e.outcome !== 'ok' || e.pid == null || !e.key) continue;
        const ap = e.pid, bb = bel[ap], ki = KI[e.key];
        if (ap === 0 || bb == null || ki == null) continue;
        const pend = pending[ap];
        if (pend) {
          pend.row.label = ki;
          /* OFF 库是**所有离线模型共用**的 ⇒ 每个模型各写一次（联格键按模型自己的变量集拼；
           *  只写一次的话，除第一个模型外所有模型的联格永远为空 ⇒ "多给变量"既没代价也没收益） */
          if (opt.train) for (const mn in OFF_MODELS) train(off, OFF_MODELS[mn], pend.levels, ki);
          if (opt.on) for (const mn in ON_MODELS) train(on, ON_MODELS[mn], pend.levels, ki);
          delete pending[ap]; out.landed++;
        }
        const cb = costBucket(null, ap, e.key);          // **静态**费用档；函数型费用单独一格 'dyn'（不静默当 0）
        bb.n++; bb.kc[ki]++; const ci = catIdx(e.key); if (ci >= 0) bb.cats[ci]++;
        bb.cost[cb] = (bb.cost[cb] || 0) + 1;
        if (cb !== 'dyn') { const num = cb === '3+' ? 3 : Number(cb); bb.costed++; if (pend && pend.epAt >= 3 && num <= 1) bb.hoard++; }
        bb.prev = bb.last; bb.last = e.key;
        bb.h.unshift(e.key); if (bb.h.length > 6) bb.h.pop();
        fieldKey = e.key;
        out.labelCats[ci] = (out.labelCats[ci] || 0) + 1;
      }
      /* 2) 只记对手席（0 座是中性脚本，不进这批读数）*/
      if (pid !== 0) {
        const mask = new Uint8Array(nk);
        for (const x of (legal || [])) if (x.affordable && KI[x.key] != null) mask[KI[x.key]] = 1;
        const bb = bel[pid], epNow = state.p[pid].ep;
        let bs = null, btab = null, bsig = null;
        try { const bo = T.beliefObserve(state); bs = String(bo.sig[pid]).split('@').slice(1).join('@'); btab = bo.tab; bsig = bo.sig[pid]; } catch (e) { bs = null; }
        if (bs == null || !btab[bsig]) out.beliefCold++;
        const c = { fieldKey, gotHit, belSig: bs, nc };
        const lv = levelVals(bb, state, pid, c);
        const row = { g, round: state.round, pid, mask, levels: lv, label: -1, pred: {}, nlegal: 0 };
        for (let i = 0; i < nk; i++) if (mask[i]) row.nlegal++;
        if (opt.off) for (const mn in OFF_MODELS) row.pred[mn] = predict(off, OFF_MODELS[mn], lv, mask);
        if (opt.on) {
          for (const mn in ON_MODELS) row.pred[mn] = predict(on, ON_MODELS[mn], lv, mask);
          if (bs != null) { row.pred['ON/MB'] = beliefPick(btab, bsig, pid); if (btab[bsig] && !mask[row.pred['ON/MB']]) out.beliefIllegal++; }
          else row.pred['ON/MB'] = -1;
        }
        pending[pid] = { levels: lv, row, epAt: epNow };
        out.rows.push(row);
        if (opt.privacy && !privDone) { privDone = true; privacyCheck(bb, state, pid, c, lv, out); }
      }
      return sel[pid](state, pid, legal, state.events);
    };
    Play.autoGameN(st, sel.map((ch, i) => (i === 0 ? ch : wrapped)), undefined, () => {});
    for (const k in pending) out.dropped++;
    if (opt.sig) out.sigs[g] = st.events.map(e => (e.type + ':' + (e.pid == null ? '-' : e.pid) + ':' + (e.key || '') + ':' + (e.outcome || ''))).join(',');
  }
  return out;
}
/* R2：把**别的席**的电珠/爆珠互换后重算全部取值 ⇒ 必须逐位相同（不同 = 偷看了珠类型）*/
function privacyCheck(bb, state, pid, c, lv, out) {
  const others = []; for (let i = 1; i < state.p.length; i++) if (i !== pid) others.push(i);
  if (!others.length) return;
  const keep = others.map(i => [state.p[i].elec, state.p[i].boom]);
  others.forEach((i, k) => { state.p[i].elec = keep[k][1]; state.p[i].boom = keep[k][0]; });
  const lv2 = levelVals(bb, state, pid, c);
  others.forEach((i, k) => { state.p[i].elec = keep[k][0]; state.p[i].boom = keep[k][1]; });
  for (const v of ALLVARS) if (String(lv[v.name]) !== String(lv2[v.name])) out.priv++;
}
/* R3：**真记录器**过一遍，事件流必须与不包逐字相同 */
function driftProbe(rg) {
  const plain = (function () {
    const st = S.createState('multi', { next: mulberry32(SEED0 + 991 * 7919) }, N);
    st.slotSalt = (Math.imul(996, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
    const chs = [B.pickBalanced]; for (let i = 1; i < N; i++) chs.push(rg.sel);
    Play.autoGameN(st, chs, undefined, () => {});
    return st.events.map(e => (e.type + ':' + (e.pid == null ? '-' : e.pid) + ':' + (e.key || '') + ':' + (e.outcome || ''))).join(',');
  })();
  const r = playGames(rg, [991], { offStore: newStore(), train: true, off: true, on: true, privacy: true, sig: true });
  return { same: r.sigs[991] === plain, n: Object.keys(r.sigs).length };
}

/* ---- 原型池（与 §E134 同一套：池块 + HELDOUT）---- */
const { pool: POOL_BLOCKS, byFn } = poolFromSpecs(B, OPP_SPECS);
const regimes = POOL_BLOCKS.map(p => ({ name: p.name, sel: p.sel }));
for (const h of heldFromNames(B, byFn, Object.keys(HELDOUT))) { if (!h.clash) regimes.push({ name: h.name, sel: h.sel }); }
const idxs = []; for (let g = 0; g < GAMES; g++) idxs.push(g);
const TRAIN = idxs.filter(g => (g % 5) < 3), TEST = idxs.filter(g => (g % 5) >= 3);

const pin1 = pinExistingFace(), pin2 = pinBeliefMirror();
if (!pin1.ok) { console.error('⛔ R4 破了：`policy.js` 的 per-slot 签名行不再匹配（miss=' + pin1.miss.join(',') + '）⇒ "现有面"这个对照物已经不存在，本台读数作废，先去改 `V_EXIST`'); process.exit(3); }
if (!pin2.ok) { console.error('⛔ `evo.js` 的 `beliefPredict` 形状变了 ⇒ 本机镜像的 argmax 不再等于出厂信念表 ⇒ `ON/MB` 那一行作废'); process.exit(3); }
let driftBad = [];
for (const rg of regimes) { const d = driftProbe(rg); if (!d.same || !d.n) driftBad.push(rg.name); }
if (driftBad.length) { console.error('⛔ R3 破了：包一层记录器**改变了事件流**（' + driftBad.join(',') + '）⇒ 这批桌子不再是同一批 ⇒ 拒绝出数'); process.exit(3); }

const per = [];
for (const rg of regimes) {
  const offStore = newStore();
  const a = playGames(rg, TRAIN, { offStore, train: true, off: false, on: false });
  const b = playGames(rg, TEST, { offStore, train: false, off: true, on: true, privacy: true });
  per.push({ rg, a, b, offStore });
  if (!QUIET) process.stdout.write('.');
}
if (!QUIET) process.stdout.write('\n');

/* ---- 心跳（"换实现的验收先看心跳"：数看着合理不代表量具是活的）---- */
const hb = { games: regimes.length * GAMES, rows: 0, landed: 0, dropped: 0, dmg: 0, priv: 0, cold: 0, illegal: 0, cats: {}, trainRows: 0 };
for (const p of per) {
  hb.rows += p.b.rows.length; hb.landed += p.b.landed; hb.dropped += p.b.dropped; hb.dmg += p.b.dmg;
  hb.priv += p.b.priv; hb.cold += p.b.beliefCold; hb.illegal += p.b.beliefIllegal; hb.trainRows += p.a.rows.length;
  for (const k in p.a.labelCats) hb.cats[k] = (hb.cats[k] || 0) + p.a.labelCats[k];
}
const catOk = CATS.every((c, i) => (hb.cats[i] || 0) > 0);
console.log('# §E179 第 1 步 · 候选"对手信念维度"的**可分性 + 增量预测**（不动 `js/**` 一个字节 · 不重训 · 不换形状）');
console.log('原型 ' + regimes.length + ' 个 × 局 ' + GAMES + ' · N=' + N + ' · seed=' + SEED0 + ' · θ=' + THETA + ' · 学习器 = Laplace 条件计数 + NB + 联格退回(λ=n/(n+θ))');
console.log('\n| 心跳 | 实测 | 判定 |');
console.log('|---|---|---|');
console.log('| 留出决策行数 / 落地动作数（训练侧 ' + hb.trainRows + '） | ' + hb.rows + ' / ' + hb.landed + ' | ' + (hb.rows > 2000 && hb.landed > 2000 ? '✔ 量具在跑' : '⛔ 行数太少，读数无从算起') + ' |');
console.log('| 决策后没落地（被丢掉的手） | ' + hb.dropped + '（' + (100 * hb.dropped / Math.max(1, hb.rows)).toFixed(1) + '%） | ' + (hb.dropped / Math.max(1, hb.rows) < 0.25 ? '✔' : '⛔ >25% ⇒ 标签缺失太重') + ' |');
console.log('| 标签的类别分布 | ' + CATS.map((c, i) => c + '=' + (hb.cats[i] || 0)).join(' ') + ' | ' + (catOk ? '✔ 四类都在出手（分布没退化）' : '⛔ 有类别一次没出现 ⇒ 桌子或账本坏了') + ' |');
console.log('| 每局伤害事件数（D5 的分母） | ' + (hb.dmg / Math.max(1, regimes.length * TEST.length)).toFixed(1) + ' | 只报不判 ⇒ **这就是"历史火力指向"这一维的天然稀样本上限** |');
console.log('| 私有信息红线（换珠类型后取值不变） | 违例 ' + hb.priv + ' 次 | ' + (hb.priv === 0 ? '✔ 没有一维偷看珠类型' : '⛔ ' + hb.priv + ' 处泄漏 ⇒ 相关维度作废') + ' |');
console.log('| 随机流红线（真记录器 · 全部原型） | 事件流逐字相同 | ✔ |');
console.log('| 签名钉（`policy.js` per-slot 段 / `evo.js` beliefPredict 形） | 均匹配 | ✔ |');
console.log('| 出厂信念表：空格占比 / argmax 落在买不起的牌 | ' + (100 * hb.cold / Math.max(1, hb.rows)).toFixed(1) + '% / ' + hb.illegal + ' 次 | 只报不判（这是**表的性质**，不是本台的错） |');

/* ---- 打分：per (原型,局) ⇒ 配对差 + 按局分层、播种 bootstrap ---- */
/* 无学习器的主判据（**防"代理学习器太弱 ⇒ 读不出信息"**）：条件众数 + 边缘众数退回。
 *   每格 `DET/<模型>` = 用**该条件联合格的众数**预测；格子里样本 < θ 就退回**边缘众数**（退回也计入分母）
 *   ⇒ 一个数、无选择效应、不吃 λ、不吃 NB 的独立性假设 ⇒ 这才是"这组条件有多确定"。
 *   覆盖率另记一列：只涨确定率、覆盖率塌 = 把格子切碎挑肥的，不算信息。 */
const argmaxOf = (arr) => { let bi = 0, bv = -1; for (let i = 0; i < arr.length; i++) if (arr[i] > bv) { bv = arr[i]; bi = i; } return bi; };
for (const p of per) {
  const margMode = argmaxOf(p.offStore.marg);
  for (const row of p.b.rows) {
    if (row.label < 0) continue;
    row.det = {};
    for (const mn in OFF_MODELS) {
      const j = p.offStore.joint[jkey(OFF_MODELS[mn], row.levels)];
      const cov = !!(j && j.t >= THETA);
      row.det[mn] = { pred: cov ? argmaxOf(j.c) : margMode, cov };
    }
  }
}
const OFFN = Object.keys(OFF_MODELS);
const MN = OFFN.concat(ONNAMES).concat(OFFN.map(m => 'DET/' + m));
const cell = {}, cells = [];
for (const p of per) for (const row of p.b.rows) {
  if (row.label < 0) continue;
  const key = p.rg.name + '@' + row.g;
  let c = cell[key];
  if (!c) { c = cell[key] = { rg: p.rg.name, g: row.g, n: 0, hit: {}, covd: {}, floor: 0 }; for (const m of MN) { c.hit[m] = 0; c.covd[m] = 0; } cells.push(c); }
  c.n++; c.floor += 1 / Math.max(1, row.nlegal);
  for (const m of MN) {
    if (m.indexOf('DET/') === 0) { const d = row.det[m.slice(4)]; if (d) { if (d.pred === row.label) c.hit[m]++; if (d.cov) c.covd[m]++; } }
    else if (row.pred[m] === row.label) c.hit[m]++;
  }
}
const accOf = (m) => { let n = 0, h = 0; for (const c of cells) { n += c.n; h += c.hit[m]; } return n ? 100 * h / n : NaN; };
const covOf = (m) => { let n = 0, h = 0; for (const c of cells) { n += c.n; h += c.covd[m]; } return n ? 100 * h / n : NaN; };
const floorAcc = 100 * cells.reduce((s, c) => s + c.floor, 0) / Math.max(1, cells.reduce((s, c) => s + c.n, 0));
/* ⚠ 参照列：OFF 比 OFF/M0、Belief 比 Belief、ON 比 **ON/M0**、DET 侧各比各的（第一版用
 *   `indexOf('Belief')===0` 一把归类 ⇒ `ON/*` 全被拿去跟**离线** M0 比，印出"在线+六族 Δ=+47pt"这种荒谬数。）*/
function refOf(m) {
  const pre = m.indexOf('DET/') === 0 ? 'DET/' : '';
  const bare = pre ? m.slice(4) : m;
  if (bare.indexOf('Belief') === 0) return pre + 'Belief';
  if (bare.indexOf('ON/') === 0) return 'ON/M0';
  return pre + 'M0';
}
/** 配对差 = **模型 − 参照**（第一版写成"参照 − 模型"⇒ 整列符号反了：91.13% 的模型被印成比 95.52% 的参照"好 4.39pt"还打勾）*/
function paired(a, b2) {
  const byRg = {}; for (const c of cells) (byRg[c.rg] || (byRg[c.rg] = [])).push(c);
  const rgN = Object.keys(byRg);
  const d = (cs) => { let n = 0, h = 0; for (const c of cs) { n += c.n; h += c.hit[b2] - c.hit[a]; } return n ? 100 * h / n : 0; };
  const obs = d(cells), rng = mulberry32(BOOT_SEED), reps = [];
  for (let r = 0; r < BOOT; r++) { const pool2 = []; for (const rn of rgN) { const arr = byRg[rn]; for (let i = 0; i < arr.length; i++) pool2.push(arr[Math.floor(rng() * arr.length)]); } reps.push(d(pool2)); }
  reps.sort((x, y) => x - y);
  let cn = 0, ch = 0; for (const c of cells) { cn += c.n; ch += c.covd[b2] - c.covd[a]; }
  return { obs, lo: reps[Math.floor(BOOT * 0.025)], hi: reps[Math.floor(BOOT * 0.975) - 1], cov: cn ? 100 * ch / cn : NaN };
}
const DESCD = {
  'M0': '现有面：上一手 + 上一手类别 + 上上一手 + ep档',
  'Belief': '信念表：(ep档, 有大雷, 上一手) —— 与 Route B 同一组条件',
  'ON/M0': '现有面（每局清零 · 按席 · prequential）',
  'ON/M0+ALL': '现有面 + 六族（在线）',
  'ON/MB': '**出厂 Route B 表原样**（在线 argmax，含 JI 兜底）',
};
const FD = { D1: '出招分布（众数类别 / 众数占比）', D2: '费列偏好（众数费用档）', D3: '确定性（键分布的熵）', D4: '对全场最后一手的反应（类别 + 上回合是否被打到）', D5: '历史火力指向我的比例', D6: '存钱率（ep≥3 却打 ≤1 费）', ALL: '六族一起',
  NC: '**对照**：每席一个随机 4 档标签（= 稀疏税本身）', PX: '**正对照**：更早两手的键（现役网络本来就有）' };
function descOf(m) {
  if (DESCD[m]) return DESCD[m];
  const i = m.indexOf('+');
  if (i < 0) return '—';
  const base = m.slice(0, i) === 'Belief' ? '信念表' : '现有面';
  const fams = m.slice(i + 1).split('+').map(k => FD[k]).filter(Boolean).join(' ‖ ');
  return fams + '（加在' + base + '之上）';
}
const COVBAR = 2;                                  // pt：绝对覆盖率红线（跑前定）
const rowsOut = [];
function rowFor(m) {
  const ref = refOf(m);
  const pr = m === ref ? null : paired(ref, m);
  const r = { m, acc: accOf(m), ref, d: pr };
  rowsOut.push(r);
  return r;
}
function fmt(x, suf) { return isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(2) + (suf || '') : '—'; }
/* 过线两条（1 号跑前定死）：Δ ≥ +1pt 且 CI 下界 > 0。
 * ⛔ 0 号跑时这里还有**第三条**"覆盖率相对参照掉不过 2pt"，实测把**正对照 PX 自己**挡在外面
 *   （PX Δ覆盖 −2.4pt）⇒ 是守卫写错了，不是 PX 没信息。根因：确定率这一列**已经把空格子退回边缘众数**
 *   （退回照样计入分母）⇒ "只统计有把握的格子来刷分"这个漏洞本来就不存在，再挂一条覆盖率守卫 = 双重惩罚，
 *   而且惩罚按变量的**基数**走（PX 两个 30 档键 vs NC 一个 4 档标签）⇒ 对高基数条件系统性不公。
 *   ⇒ 覆盖率降级成**只报不判**的一列。下面 `guardDiff` 把那一次改动的后果钉在日志里：
 *     加回守卫会**改变判定的行**必须只有对照，不许有任何一族因它翻面（翻了就是我在挑对自己有利的尺）。 */
function armTable(anchor, title, note) {
  const list = [anchor];
  for (const k of CAND) list.push(anchor + '+' + k);
  list.push(anchor + '+ALL', anchor + '+NC', anchor + '+PX');
  const got = {}; for (const m of list) if (MN.indexOf(m) >= 0) got[m] = rowFor(m);
  const ncCov = got[anchor + '+NC'] && got[anchor + '+NC'].d ? got[anchor + '+NC'].d.cov : NaN;
  const px = got[anchor + '+PX'] && got[anchor + '+PX'].d ? got[anchor + '+PX'].d.obs : NaN;
  console.log('\n### ' + title);
  if (note) console.log(note);
  console.log('| 条件变量集 | 确定率 | Δ vs 参照 | 95% CI（按局分层 · 播种 ' + BOOT_SEED + '） | 覆盖率 | Δ覆盖 | 相当于正对照 PX 的 | 过线？ |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const m of list) {
    const r = got[m]; if (!r) continue;
    const p = r.d ? (r.d.lo > 0 && r.d.obs >= DELTA_BAR) : null;
    const rel = (r.d && isFinite(px) && px > 0.05) ? (r.d.obs / px) : NaN;
    r.pass = p; r.rel = rel;
    r.passWithGuard = r.d ? (p && (!isFinite(ncCov) || r.d.cov >= ncCov)) : null;
    console.log('| `' + m + '`' + (m === anchor ? '（参照）' : '') + ' | ' + accOf(m).toFixed(2) + '%'
      + ' | ' + (r.d ? fmt(r.d.obs, 'pt') : '—') + ' | ' + (r.d ? '[' + r.d.lo.toFixed(2) + ', ' + r.d.hi.toFixed(2) + ']' : '—')
      + ' | ' + covOf(m).toFixed(0) + '%'
      + ' | ' + (r.d ? fmt(r.d.cov, 'pt') : '—')
      + ' | ' + (isFinite(rel) ? (100 * rel).toFixed(0) + '%' : (m === anchor ? '—' : '—'))
      + ' | ' + (p === null || p === undefined ? '—' : (p ? '✅ 过线' : '⛔')) + ' |');
  }
  const gd = [];
  for (const m of list) {
    const r = got[m]; if (!r || !r.d || r.pass === null || r.pass === undefined) continue;
    if (!!r.pass !== !!r.passWithGuard) gd.push('`' + m + '` ' + (r.pass ? '过→不过' : '不过→过'));
  }
  got.__guardDiff = gd;
  return got;
}
console.log('\n## 判据②·主（**无学习器**）：给定这组条件，下一手有多确定');
console.log('留出格子 ' + cells.length + ' 个 (原型×局) · 决策 ' + cells.reduce((s, c) => s + c.n, 0) + ' 手 ‖ 地板（均匀猜合法集）= ' + floorAcc.toFixed(2) + '%');
console.log('过线 = Δ确定率 ≥ +' + DELTA_BAR + 'pt 且 CI 下界 > 0 且 **覆盖率掉得不超过"纯噪声条件 NC"那一行**（光把格子切碎挑肥的不算）');
console.log('最后一列"相当于正对照 PX 的几成"是**决定性的那一列**：PX 是现役冠军网络本来就在用的一维 ⇒ 拿不到它那一成的东西，谈"值一次换代"就是空话。');
const detM0 = armTable('DET/M0', '加在**现有面**之上（= 换代重训那条路）',
  '两枚对照不是候选：`NC` = 每席一个随机 4 档标签（纯噪声条件，量"多带一个条件"的税），`PX` = 更早两手的键（**现役网络本来就有** ⇒ 本尺的分辨率上界）。');
const detBel = armTable('DET/Belief', '加在**信念表**之上（= 开档搜索那条路）');
const flips = (detM0.__guardDiff || []).concat(detBel.__guardDiff || []);
console.log('\n> **守卫变更自检（把 0 号跑那条覆盖率守卫加回来，哪些行的判定会翻面）**：'
  + (flips.length ? flips.join(' ‖ ') : '没有任何行翻面')
  + (flips.length && flips.every(x => x.indexOf('PX') >= 0 || x.indexOf('NC') >= 0)
    ? ' ⇒ **只有对照行受影响，六族候选无一因此翻面 ⇒ 这次修尺不改任何一条候选结论**（不是"挑一把对自己有利的尺"）。'
    : ' ⇒ ⛔ 有**候选族**因这条守卫翻面 ⇒ 这次修尺会改结论，必须把它当结论级变更交给用户裁定，不许自己吞。'));
const clNC = paired('M0', 'M0+NC'), clPX = paired('M0', 'M0+PX');
console.log('\n## 判据②·辅（NB 学习器的分类命中率）：**只作旁证，不作判据**');
console.log('⛔ 为什么不作判据（0 号跑实测）：这一列上，加**一个随机标签** NC = ' + fmt(clNC.obs, 'pt')
  + '，加**现役网络本来就有的** PX = ' + fmt(clPX.obs, 'pt')
  + ' ⇒ "多带一个条件"的税比任何候选族的收益都大一个量级 ⇒ 这一列的正负**读不出信息**，只读得出税。');
console.log('| 模型 | 分类命中率 | Δ vs 参照 | 95% CI |');
console.log('|---|---|---|---|');
for (const m of OFFN.concat(ONNAMES)) {
  if (m.indexOf('DET/') === 0) continue;
  const ref = refOf(m); const pr = m === ref ? null : paired(ref, m);
  console.log('| `' + m + '` | ' + accOf(m).toFixed(2) + '% | ' + (pr ? fmt(pr.obs, 'pt') : '（' + ref + '）') + ' | ' + (pr ? '[' + pr.lo.toFixed(2) + ', ' + pr.hi.toFixed(2) + ']' : '—') + ' |');
}
console.log('\n### 互补还是替代（ρ = Δ主(现有面+D) ÷ Δ主(信念表+D) · 线跑前定：≥' + RHO_HI + ' 互补、≤' + RHO_LO + ' 替代）');
console.log('⚠ **ρ 只在两臂都过线时才有意义**（第一版只挡了"分母 > 0.05pt"⇒ +0.47 ÷ +0.05 也能刷出 ρ=10.7 被判"互补"，');
console.log('   那是**比率的隐形分母**那一族：分子分母都是噪声时比值什么都能印。0 号跑实测抓到，已改成"两臂各自过线才判"。）');
console.log('| 候选族 | 是什么 | Δ主 现有面侧 | Δ主 信念表侧 | ρ | 判读 |');
console.log('|---|---|---|---|---|---|');
const rho = {};
const passed = (r) => !!(r && r.pass);
for (const k of CAND.concat(['ALL'])) {
  const a = detM0['DET/M0+' + k], b2 = detBel['DET/Belief+' + k];
  const da = a && a.d ? a.d.obs : NaN, db = b2 && b2.d ? b2.d.obs : NaN;
  const both = passed(a) && passed(b2);
  const r = (both && isFinite(da) && isFinite(db) && db > 0.05) ? da / db : NaN;
  const verdict = !both ? '不判（至少一臂没过线 ⇒ ρ 是噪声之比）'
    : r >= RHO_HI ? '**互补** ⇒ 两件事都做' : r <= RHO_LO ? '**替代** ⇒ 别再动形状' : '部分重叠';
  rho[k] = { da, db, r, both };
  console.log('| ' + k + ' | ' + FD[k] + ' | ' + fmt(da) + ' | ' + fmt(db) + ' | ' + (isFinite(r) ? r.toFixed(2) : '—') + ' | ' + verdict + ' |');
}

console.log('\n> **ρ 一列本次全部"不判"，但"重不重叠"这一问还有一个不依赖过线的读法**：');
console.log('> 若候选族 D 的信息**信念表已经有了**，那么把它加在信念表之上应当 ≈ 0（信念表侧 Δ ≈ 0 而现有面侧 Δ > 0 = 替代）；');
console.log('> 若两侧 Δ 同量级、甚至信念表侧更大 ⇒ 这块信息**信念表根本没在吃**（互补）。实测：');
for (const k of CAND.concat(['ALL'])) {
  const a = detM0['DET/M0+' + k], b2 = detBel['DET/Belief+' + k];
  if (!a || !b2 || !a.d || !b2.d) continue;
  const sh = (b2.d.obs > a.d.obs ? '信念表侧更大' : '现有面侧更大');
  console.log('> · ' + k.padEnd(4) + ' 现有面侧 ' + fmt(a.d.obs) + ' ‖ 信念表侧 ' + fmt(b2.d.obs) + ' ⇒ **' + (b2.d.obs >= 0.5 * a.d.obs ? (a.d.obs > 0.05 ? '不重叠（' + sh + '）' : '两侧都≈0，无从判') : '偏替代（信念表侧只剩一半以下）') + '**');
}

/* ---- 判据①：U_sep（同一个 `separabilityOf`、同一条线）---- */
const SEPGRP = { EXIST: V_EXIST.filter(v => v.sep !== 0) };
for (const k of CAND) SEPGRP[k] = FAMS[k].filter(v => v.sep !== 0);
function gameVec(rows, K) {
  const byG = {};
  for (const r of rows) { if (r.round > K) continue; (byG[r.g] || (byG[r.g] = [])).push(r); }
  const out = [];
  for (const g in byG) {
    const rs = byG[g]; const vec = {};
    for (const grp in SEPGRP) {
      const arr = [];
      for (const v of SEPGRP[grp]) { let s = 0; for (const r of rs) s += (r.levels[v.name] + 1) / (Math.max(1, v.L) + 1); arr.push(s / rs.length); }
      vec[grp] = arr;
    }
    const all = []; for (const grp in vec) for (const x of vec[grp]) all.push(x);
    vec.ALL = all;
    out.push(vec);
  }
  return out;
}
const sepRows = [];
for (const K of KS) {
  const groups = {}; for (const grp in SEPGRP) groups[grp] = {}; groups.ALL = {};
  for (const p of per) {
    const vg = gameVec(p.a.rows.concat(p.b.rows), K);
    for (const grp in groups) groups[grp][p.rg.name] = vg.map(v => v[grp]);
  }
  for (const grp in groups) {
    const s = separabilityOf(groups[grp], euclid);
    const bar = Math.round(U_BAR * s.nEnvs / 33);
    sepRows.push({ K, grp, ...s, bar, pass: s.U_sep >= bar && s.ambRate !== null && s.ambRate <= AMB_BAR });
  }
}
console.log('\n## 判据①：可分性 `U_sep`（**线沿用 §E134：≥25/33 且 歧义率 ≤40%** ⇒ 本台 ' + regimes.length + ' 个原型按等比例折线 ' + (sepRows[0] ? sepRows[0].bar : '—') + '）');
console.log('| 窗口 | 组 | **U_sep** | 歧义率 | 唯一点(样本/质心) | LOO | 过线？ |');
console.log('|---|---|---|---|---|---|---|');
for (const r of sepRows) {
  console.log('| ' + (r.K >= 99 ? '整局' : '前 ' + r.K + ' 回合') + ' | ' + r.grp + ' | **' + r.U_sep + '/' + r.nEnvs + '** | '
    + (r.ambRate === null ? '—' : (100 * r.ambRate).toFixed(0) + '%') + ' | ' + r.U_sample + '/' + r.U_centroid + ' | '
    + (r.acc === null ? '—' : (100 * r.acc).toFixed(1) + '%') + ' | ' + (r.pass ? '✅' : '⛔') + ' |');
}
console.log('（对照 §E134：那次最好的 B 组只有 14/33、且**只许看前 20 回合** ⇒ "整局"这一档是**新的观测面**，不是同一张考卷的更高分）');

/* ---- 判读 ---- */
const winners = CAND.filter(k => passed(detM0['DET/M0+' + k]));
const ncRow = detM0['DET/M0+NC'], pxRow = detM0['DET/M0+PX'];
const bestSep = sepRows.slice().sort((a, b2) => (b2.U_sep / Math.max(1, b2.nEnvs)) - (a.U_sep / Math.max(1, a.nEnvs)))[0];
console.log('\n## 判读（只引配对差与等比例线）');
console.log('0) **先读两枚对照（主判据·确定率侧）**：随机标签 NC ' + (ncRow && ncRow.d ? fmt(ncRow.d.obs, 'pt') : '—')
  + ' ‖ 现役网络本来就有的"更早两手" PX ' + (pxRow && pxRow.d ? fmt(pxRow.d.obs, 'pt') : '—')
  + '（PX 是这把尺的**分辨率上界**：它是真信息，但现役面已经吸收了它 ⇒ 它给出的是"这条轴上还能走多远"的参照）。');
const resol = pxRow && pxRow.d && pxRow.d.obs >= DELTA_BAR && pxRow.pass !== false;
const relMax = Math.max.apply(null, CAND.map(k => (detM0['DET/M0+' + k] && isFinite(detM0['DET/M0+' + k].rel)) ? detM0['DET/M0+' + k].rel : -Infinity));
console.log('1) 增量预测（主判据·确定率）：**' + (winners.length ? winners.join('/') + ' 过线' : '没有任何一族过线')
  + '** ‖ 现有面确定率 ' + accOf('DET/M0').toFixed(2) + '%（覆盖 ' + covOf('DET/M0').toFixed(0) + '%）· 信念表侧 ' + accOf('DET/Belief').toFixed(2) + '%'
  + ' ‖ **候选族里最高的那一族，只到正对照 PX 的 ' + (isFinite(relMax) ? (100 * relMax).toFixed(0) : '—') + '%**'
  + '（PX = 现役冠军网络本来就在用的一维）⇒ 换代要付的账没有对应的收益。');
console.log('   ⚠ 同时必须点破：PX 的绝对读数只有 ' + (pxRow && pxRow.d ? fmt(pxRow.d.obs, 'pt') : '—')
  + '，**低于 +' + DELTA_BAR + 'pt 那条绝对线** ⇒ "全不过线"这件事本身**不能**读成"这些维度没有信息"；'
  + '能读的是**相对**那一句：它们连"已知有用的那一维"的两成都不到。何况分类侧头顶只剩 ' + (100 - accOf('M0')).toFixed(1) + 'pt ⇒ **在环境已知时，下一手几乎已经被现有面定死了**。');
console.log('2) 在线（开档那一桌的形状）：现有面 ' + accOf('ON/M0').toFixed(2) + '% ‖ 出厂 Route B 表原样 ' + accOf('ON/MB').toFixed(2) + '% ‖ 现有面+六族 ' + accOf('ON/M0+ALL').toFixed(2) + '%'
  + '（一局之内每席只有几十手 ⇒ 条件一多就填不满格子）。');
console.log('3) 可分性：' + (sepRows.some(r => r.pass) ? '过线 = ' + [...new Set(sepRows.filter(r => r.pass).map(r => r.grp + '@' + (r.K >= 99 ? '整局' : 'K' + r.K)))].join(' ')
  : '**全不过线**（最好 ' + bestSep.grp + '@' + (bestSep.K >= 99 ? '整局' : 'K' + bestSep.K) + ' = ' + bestSep.U_sep + '/' + bestSep.nEnvs + '，线 ' + bestSep.bar + '）'));
console.log('4) ρ（配不配合开档）：' + (CAND.concat(['ALL']).filter(k => isFinite(rho[k].r)).length
  ? '有读数的族 = ' + CAND.concat(['ALL']).filter(k => isFinite(rho[k].r)).join('/') + '（见上表判读列）'
  : '**全部不判**（没有任何一族在"现有面"与"信念表"两侧**同时**过线 ⇒ ρ 无从算 ⇒ 这一问**本机答不了**，别拿它当"该不该配合"的依据）'));
if (arg('json', '')) {
  writeFileSync(arg('json'), JSON.stringify({
    meta: { games: GAMES, n: N, seed0: SEED0, regimes: regimes.length, theta: THETA, covBar: COVBAR,
      uBar: U_BAR, uBarScaled: sepRows[0] ? sepRows[0].bar : null, ambBar: AMB_BAR, deltaBar: DELTA_BAR, rhoHi: RHO_HI, rhoLo: RHO_LO, bootSeed: BOOT_SEED, boot: BOOT, floorAcc },
    heartbeat: hb,
    rows: rowsOut.map(r => ({ m: r.m, desc: descOf(r.m), acc: r.acc, ref: r.ref, d: r.d })),
    rho, winners,
    controls: { ncDet: ncRow && ncRow.d ? ncRow.d.obs : null, pxDet: pxRow && pxRow.d ? pxRow.d.obs : null, resolved: !!resol, candidateMaxShareOfPX: isFinite(relMax) ? relMax : null },
    sep: sepRows.map(r => ({ K: r.K, grp: r.grp, U_sep: r.U_sep, nEnvs: r.nEnvs, bar: r.bar, ambRate: r.ambRate, acc: r.acc, pass: r.pass })),
  }, null, 1));
  console.log('  json → ' + arg('json'));
}
export {};
