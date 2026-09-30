#!/usr/bin/env node
/* ============================================================================
 * explain-champion-decision.mjs —— **现役冠军 AI 到底靠什么决定出手**（§E180）
 *
 * 起因：§E179 量到"对手的下一手已被现有输入定死 95%"之后，用户问的是另一面 ——
 *   "**那我们自己这个 AI 又是怎么决定出手的？**能不能可视化地讲一下。"
 * 这台仪器不训练、不动 `js/**`，只做三件事：
 *   ① **把决策管线摊开**：合法 → 付得起 → `econBase` 启发式 → `candidatesFor` 展开成"技能×目标×珠"候选
 *      → 每个候选过一次 **235 → 24 → 1** 的小网络打分 → 取最高（温度 0.15）。
 *      ⚠ 网络不是唯一的裁判：`ep<2 不蓄能`（v1.5.82 用户裁定）、`lastCancelOther 锁目标`、`econBase`
 *        都在它前面剪候选 ⇒ 本机的候选枚举是**近似**（没接 lockTarget），讲"网络在剩下的里怎么排"。
 *   ② **精确归因**（不是近似、不是 SHAP）：单隐层 ReLU 网络的分数是**逐项可加**的
 *        score = b2 + Σ_{j: z_j>0} W2[j]·( b1[j] + Σ_i W1[j][i]·x_i + Σ_k W1[j][S+k]·a_k )
 *      ⇒ 每一维对这一手分数的贡献 = `x_i · Σ_{j 激活} W2[j]·W1[j][i]` —— 恒等式，不是估计。
 *      本机自己实现这一遍算式，并**与 `P.value()` 逐位对账**（差 > 1e-9 就拒绝出数）：
 *      对不上说明我对参数布局的理解是错的，那归因全是编的（同族教训："签名行是量具的锚"）。
 *   ③ **消融翻转率**（最能给人看的那一列）：把某一块输入**整块抹成 0**、重打所有候选，
 *      数"这一手换不换"。这比贡献量更硬：不受正负抵消影响，也不依赖我的块边界标签对不对。
 *
 * 状态特征布局（`FEAT_S=213`，从 `policy.js:featuresV7` 源码逐条数出来，本机自检钉住）：
 *   [0,63) 我自己 ‖ [63,103) 对手席 4×10 ‖ [103,123) 历史 5×(HIST_K+1) ‖ [123,143) 指向 5×4 ‖ [143,213) 持续效果 5×14
 *   动作段 `FEAT_A=22` 的子块（目标 6 维、珠 2 维）**不靠数源码**，用 `setFeatMask` 关掉再对索引差**测出来**。
 *
 * 用法：node tools/explain-champion-decision.mjs [--games=12] [--seed=77000] [--trace=4] [--n=3] [--json=…]
 * ==========================================================================*/
import { writeFileSync } from 'node:fs';
import { sandbox, rejectUnknownFlags, mulberry32, loadChamp } from './audit-lib.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['games', 'seed', 'trace', 'n', 'opp', 'json', 'quiet']);
const GAMES = Math.max(1, Number(arg('games', 12)) || 12);
const N = Math.max(2, Number(arg('n', 3)) || 3);
const SEED0 = Number(arg('seed', 77000)) || 77000;
const TRACES = Math.max(0, Number(arg('trace', 4)) || 0);
const QUIET = process.argv.indexOf('--quiet') >= 0;

const W = sandbox(), P = W.EpirusPolicy, R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
if (!P || typeof P.featuresV7 !== 'function' || typeof T.policyChooserN !== 'function' || typeof T.econBase !== 'function') {
  console.error('⛔ 拿不到 featuresV7/policyChooserN/econBase'); process.exit(2);
}
const PACK = loadChamp(W, 'js/bundled-champion-3p.js', process.cwd());
/* `unpack(json, true)` 直接返回**参数数组本身**（Float64Array，长度 = paramCount()），不是 `{params:…}` 包装
 *  ⇒ 两种形状都接下来：哪天它改成包装对象，本机不许静默拿到 undefined 再算出一堆 NaN。 */
const params = PACK && PACK.params ? PACK.params : PACK;
if (!params || params.length !== P.paramCount()) { console.error('⛔ 取不到现役 3p 冠军包的参数（拿到 ' + (params && params.length) + '，期望 ' + P.paramCount() + '）'); process.exit(2); }
const FS = P.FEAT_S, FA = P.FEAT_A, FN = P.FEAT_N, HID = P.HID;
if (params.length !== HID * FN + HID + HID + 1) { console.error('⛔ 包长与 ' + FN + ' 形状不符（' + params.length + '）⇒ 布局假设作废'); process.exit(3); }
const B1 = HID * FN, W2 = B1 + HID, B2 = W2 + HID;
const sel = T.policyChooserN(params, 0.15);

/* ---- 块边界（逐条从 featuresV7 源码数出来的）---- */
const SLOT = P.OPP_SLOTS, PSLOT = P.PLAYER_SLOTS, HK = P.HIST_K, EF = P.EFFECTS.length;
const MAIN = FS - SLOT * 10 - (1 + SLOT) * (HK + 1) - PSLOT * 4 - PSLOT * EF;
const OFF = { slot: MAIN, hist: MAIN + SLOT * 10 };
OFF.rel = OFF.hist + (1 + SLOT) * (HK + 1); OFF.eff = OFF.rel + PSLOT * 4;
const BLOCKS = [
  { name: '我自己（血/能量/珠/架势/前摇/回合）', lo: 0, hi: MAIN, note: '第 1 段：我这边的所有公开状态' },
  { name: '对手席 ×' + SLOT + '（各自血、能量、上一手、前摇）', lo: OFF.slot, hi: OFF.hist, note: '4 槽 × 10 维，**槽位顺序每次决策洗牌**（L7）' },
  { name: '行动历史 ×' + (1 + SLOT) + '（最近 ' + HK + ' 手 + 连续同招）', lo: OFF.hist, hi: OFF.rel, note: '每席 ' + (HK + 1) + ' 维' },
  { name: '指向关系（上一手打谁 / 镜面复制到哪张）', lo: OFF.rel, hi: OFF.eff, note: 'v7 的 T 块' },
  { name: '持续效果（' + EF + ' 种 × 自施+/他施−）', lo: OFF.eff, hi: FS, note: 'v7 的 B 块' },
];

/* ---- 本机 forward（精确归因用），并与 P.value 逐位对账 ---- */
function scoreVec(x, af) {
  const z = new Float64Array(HID); let v = params[B2];
  for (let j = 0; j < HID; j++) {
    let s = params[B1 + j]; const base = j * FN;
    for (let i = 0; i < FS; i++) s += params[base + i] * x[i];
    for (let k = 0; k < FA; k++) s += params[base + FS + k] * (k < af.length ? af[k] : 0);
    z[j] = s; if (s > 0) v += params[W2 + j] * s;
  }
  return { v, z };
}
function attribute(x, af, z) {
  const ci = new Float64Array(FS), ca = new Float64Array(FA); let konst = params[B2];
  for (let j = 0; j < HID; j++) {
    if (!(z[j] > 0)) continue;
    const w2 = params[W2 + j], base = j * FN;
    konst += w2 * params[B1 + j];
    for (let i = 0; i < FS; i++) ci[i] += w2 * params[base + i] * x[i];
    for (let k = 0; k < FA; k++) ca[k] += w2 * params[base + FS + k] * (k < af.length ? af[k] : 0);
  }
  return { ci, ca, konst };
}
const blockSum = (ci, b) => { let s = 0; for (let i = b.lo; i < b.hi; i++) s += ci[i]; return s; };

/* ---- 一次中局快照（自检①状态块边界 / 自检②动作段子块边界都靠它）
 *   ⚠ `autoGameN` 的第三个形参 `onTurn` 在 `play.js` 里**根本没人调用**（只在 2 人入口 `autoGame` 里调）
 *     ⇒ 第一版把它当回合钩子用 ⇒ 快照永远是 null ⇒ 两道自检都会"因为读不到数据而红"（结果对、理由错那一族）。
 *     现在改成**在 chooser 里抓**：只克隆、不改决策，返回的还是原 chooser 的答案。 */
function midGameSnapshot() {
  const st = S.createState('multi', { next: mulberry32(SEED0 + 1) }, N);
  st.slotSalt = 12345;
  let snap = null, best = -1;
  const grab = function (state, pid, legal) {
    if (pid === 0 && state.round >= 4) {
      let ok = true; for (let p = 1; p < N; p++) if (state.p[p].hp <= 0) ok = false;
      if (!ok || (legal || []).length < 3) return sel(state, pid, legal);
      /* **夹具必须有对比度**（本仓那条"缺对比度让自检变装饰"的教训）：
       *   中局的 `lastTarget` / 架势位很可能全是空 ⇒ 掩码前后一维都没差 ⇒ 边界自检"通过"却什么都没验。
       *   ⇒ 在这里**人为灌入**指向与几种持续效果，再要求相关区段确实非零；灌了还是零 = 量具坏了，硬失败。
       *   ⚠ 只灌在**克隆出来的快照**上（不改真实对局，也不影响上面那条"事件流逐字相同"的红线）。 */
      const c = S.cloneState(state);
      for (let p = 0; p < c.p.length; p++) {
        c.p[p].lastTarget = (p + 1) % c.p.length;
        c.p[p].guardNext = p % 2 === 0; c.p[p].copiedGuard = (R.SK && R.SK.GUN) || 'gun';
        if (c.p[p].hp > 3) { c.p[p].baguaExtra = true; c.p[p].nightmare = true; c.p[p].vampire = true; c.p[p].mineArmed = true; c.p[p].tauntActive = true; c.p[p].rodGuard = 2; }
        if (p === 1) c.p[p].stickers = [{ owner: 0 }, { owner: 2 }];
      }
      const v = P.featuresV7(c, 0); P.setFeatMask('all');
      let nz = 0; for (let i = OFF.rel; i < FS; i++) if (Math.abs(v[i]) > 1e-12) nz++;
      if (nz > best) { best = nz; snap = { state: c, pid: 0 }; }
    }
    return sel(state, pid, legal);
  };
  const chs = [grab]; for (let i = 1; i < N; i++) chs.push(sel);
  Play.autoGameN(st, chs.slice(0, N), undefined, () => {});
  return snap;
}
function stateBlockSelfCheck(snap) {
  if (!snap) return { ok: false, why: '拿不到中局快照' };
  const grab = (spec) => { P.setFeatMask(spec); const v = P.featuresV7(snap.state, snap.pid); P.setFeatMask('all'); return v; };
  const all = grab('all'), noRel = grab('bead,target,effects'), noEff = grab('bead,target,rel');
  const diff = (a, b2) => a.map((v, i) => Math.abs(v - b2[i]) > 1e-12 ? i : -1).filter(i => i >= 0);
  const dRel = diff(all, noRel), dEff = diff(all, noEff);
  /* ⚠ 判据是**子集 + 非空**，不是"恰好等于整段"（第一版写成相等 ⇒ 明明布局是对的却报⛔）：
   *   掩码只让**本来非零**的那些列变化，一格里"指自己/指我/指别人"三选一永远只有一个非零 ⇒ 相等不可能成立。
   *   子集这条才是要害：关 `rel` 只许动 `[123,143)`、关 `effects` 只许动 `[143,213)` ⇒ 越界 = 我的块边界是编的。 */
  const inRange = (xs, lo, hi) => xs.length > 0 && xs.every(i => i >= lo && i < hi);
  return { ok: inRange(dRel, OFF.rel, OFF.eff) && inRange(dEff, OFF.eff, FS), rel: dRel.length + '/' + (OFF.eff - OFF.rel), eff: dEff.length + '/' + (FS - OFF.eff),
    relIdx: dRel, effIdx: dEff, nonzero: all.filter(x => Math.abs(x) > 1e-12).length };
}
/* ---- 语义点检：**一维一维**验转录（灌一个字段 ⇒ 只许它那一列动）----
 * 布局若有一维数错，这里就红 —— 比"整段子集"强得多，而且它是后面那些"第 N 维是谁"标签的地基。 */
function semanticSpotCheck() {
  /* ⚠ 判据是"**必须包含我说的那一列**"，不是"只动那一列"：同一个字段常常**还**出现在持续效果块里
   *   （`mineArmed` 既进 #23 又进效果块的 `mine`），那是设计如此，不是布局错。
   * ⚠ 槽位号不能当预期：`oppSlots` 每次决策洗牌（L7 的教训）⇒ "哪个对手落进槽 1"本来就不确定
   *   ⇒ 对手侧只验状态块那一列 + "每 10 列一个槽、偏移固定"用 `slotOffset` 单独验。 */
  const cases = [
    { name: '我持电珠', set: (c) => { c.p[0].elec = 1; }, want: [4] },
    { name: '我持爆珠', set: (c) => { c.p[0].boom = 1; }, want: [5] },
    { name: '任一对手持珠（珠类型不许泄漏到我方列）', set: (c) => { c.p[1].elec = 1; }, want: [6], forbid: [4, 5] },
    { name: '任一对手刚蓄能', set: (c) => { c.p[1].lastSkill = (R.SK && R.SK.CHARGE) || 'charge'; }, want: [7] },
    { name: '我的聚能环连击', set: (c) => { c.p[0].ringStreak = 3; }, want: [16] },
    { name: '我的电磁炮计数 %3', set: (c) => { c.p[0].cannonCount = 1; }, want: [19] },
    { name: '我埋了雷', set: (c) => { c.p[0].mineArmed = true; }, want: [23] },
    { name: '任一对手埋了雷', set: (c) => { c.p[1].mineArmed = true; }, want: [24] },
    { name: '我嘲讽中', set: (c) => { c.p[0].tauntActive = true; }, want: [25] },
    { name: '我下一步有防御架势', set: (c) => { c.p[0].guardNext = true; }, want: [31] },
    { name: '我有八卦阵（架势延续）', set: (c) => { c.p[0].baguaExtra = true; }, want: [33] },
    { name: '我被梦魇缠上', set: (c) => { c.p[0].nightmare = true; }, want: [41] },
    { name: '我带吸血', set: (c) => { c.p[0].vampire = true; }, want: [43] },
    { name: '我的避雷针强度', set: (c) => { c.p[0].rodGuard = 2; }, want: [51] },
    { name: '我残血（≤1）', set: (c) => { c.p[0].hp = 1; }, want: [61] },
    { name: '我的能量比最强对手高', set: (c) => { c.p[0].ep = 6; }, want: [54] },
    { name: '我上一手打向别人（T 块"打别人"= 偏移 2）', set: (c) => { c.p[0].lastTarget = 2; }, want: [OFF.rel + 2] },
    { name: '对手血量落进"每槽偏移 1"（血量列）', set: (c) => { c.p[1].hp = 1; }, slotOffset: 1 },
    { name: '对手上一手落进"每槽偏移 6"（类别列）', set: (c) => { c.p[1].lastSkill = (R.SK && R.SK.GUN) || 'gun'; }, slotOffset: 6 },
  ];
  const out = [];
  for (const k of cases) {
    const base = S.cloneState(S.createState('multi', { next: mulberry32(31) }, N));
    base.slotSalt = 7; P.setFeatMask('all');
    const v0 = P.featuresV7(base, 0);
    const c = S.cloneState(base); k.set(c); const v1 = P.featuresV7(c, 0);
    const d = v0.map((v, i) => Math.abs(v - v1[i]) > 1e-12 ? i : -1).filter(i => i >= 0);
    let ok, why = '';
    if (k.slotOffset != null) {
      const inSlot = d.filter(i => i >= OFF.slot && i < OFF.hist);
      /* 判据 = "**包含**那个偏移"，不是"只动那个偏移"：`lastSkill` 一个字段合法地会同时动
       *   槽内的 牌序/类别/有上一手 三列（外加状态块里"威胁对手"那几列）⇒ 写成"只动一列"会把对的判成红的。 */
      ok = inSlot.length > 0 && inSlot.some(i => (i - OFF.slot) % 10 === k.slotOffset);
      why = ok ? '' : '落在偏移 ' + (inSlot.length ? inSlot.map(i => (i - OFF.slot) % 10).join(',') : '（没落在对手席块里）') + '，期望包含 ' + k.slotOffset;
    } else {
      const missing = k.want.filter(w => d.indexOf(w) < 0);
      const leaked = (k.forbid || []).filter(w => d.indexOf(w) >= 0);
      ok = missing.length === 0 && leaked.length === 0;
      why = leaked.length ? '珠类型泄漏到 #' + leaked.join(',') : (missing.length ? '期望的 #' + missing.join(',') + ' 没动' : '');
    }
    out.push({ name: k.name, want: (k.want || ['槽内偏移 ' + k.slotOffset]).join(','), got: d.join(','), ok, why });
  }
  return out;
}
/* 动作段子块：**测出来**而不是数源码 —— 关掉 `target`/`bead` 掩码看哪几列变了 */
/* ---- 213 维的**人话标签表**（转录自 featuresV7 的源码顺序；上面那张"语义点检"逐列验过它）---- */
const MAIN_NAMES = ['我的血量', '最脆对手血量', '我的能量', '最强对手能量', '我持电珠', '我持爆珠', '有对手持珠(类型未知)', '有对手刚蓄能',
  '我上一手·牌序', '我上一手·类别', '我上一手·优先级', '威胁对手上一手·牌序', '威胁对手上一手·类别', '威胁对手上一手·优先级',
  '我上一手没打过(空)', '威胁上一手没打过(空)', '我的聚能环连击', '对手最大聚能环连击', '我正好跨过环启动线', '我的电磁炮计数', '对手电磁炮计数',
  '我的冷却数', '对手最多冷却数', '我埋了雷', '有对手埋雷', '我嘲讽中', '有对手嘲讽', '我嘲讽待结算', '有对手嘲讽待结算',
  '我身上的符咒', '我贴出的符咒', '我有防御架势', '有对手有防御架势', '我有八卦阵(架势延续)', '有对手有八卦阵', '我火弱·下回合', '我火弱·现在',
  '有对手火弱·下回合', '有对手火弱·现在', '我有铁索', '有对手有铁索', '我被梦魇', '有对手被梦魇', '我带吸血', '有对手带吸血',
  '我吸血回过血', '有对手吸血回过血', '我有回魂', '有对手有回魂', '我无限能量', '有对手无限能量', '我的避雷针窗口', '对手最高避雷针窗口',
  '回合数/上限', '我的能量比最强对手', '有人要放电磁炮', '有人能量≥5(大雷前摇)', '有人要放激光眼', '有人正要起环', '有人能量≥2', '有人刚蓄能(聚合)', '我残血(≤1)', '有对手残血(≤1)'];
const SLOT_NAMES = ['存活', '血量', '能量', '持珠(类型未知)', '刚蓄能', '上一手·牌序', '上一手·类别', '有上一手', '能量≥2', '能量≥5'];
const HIST_NAMES = []; for (let t = 0; t < HK; t++) HIST_NAMES.push('最近第 ' + (t + 1) + ' 手'); HIST_NAMES.push('连续同招比例');
const REL_NAMES = ['打自己', '打我', '打别人', '复制来的架势·牌序'];
const EFF_CN = { guardCarry: '架势延续', guardPrev: '防御架势', copiedGuard: '复制架势', rodGuard: '避雷针', fireWeak: '火弱', mine: '地雷', tauntActive: '嘲讽中', tauntPend: '嘲讽待结算', nightmare: '梦魇', vampire: '吸血', revive: '回魂', infinite: '无限能量', stickers: '符咒', chains: '铁索' };
const EFF_NAMES = P.EFFECTS.map(e => (EFF_CN[e[0]] || e[0]) + (e[1] ? '(他人施加)' : '(自施)'));
function nameOf(i) {
  if (i < 0 || i >= FS) return '?';
  if (i < MAIN) return MAIN_NAMES[i] || ('我自己 第 ' + (i + 1) + ' 维');
  if (i < OFF.hist) { const k = i - OFF.slot; return '对手席' + (Math.floor(k / 10) + 1) + '·' + SLOT_NAMES[k % 10]; }
  if (i < OFF.rel) { const k = i - OFF.hist; const seat = Math.floor(k / (HK + 1)); return (seat === 0 ? '我自己' : '对手席' + seat) + '·' + HIST_NAMES[k % (HK + 1)]; }
  if (i < OFF.eff) { const k = i - OFF.rel; const seat = Math.floor(k / 4); return (seat === 0 ? '我自己' : '席' + seat) + '上一手·' + REL_NAMES[k % 4]; }
  { const k = i - OFF.eff; const seat = Math.floor(k / EF); return (seat === 0 ? '我自己' : '席' + seat) + '·' + EFF_NAMES[k % EF]; }
}

function actionBlockSelfCheck(snap) {
  if (!snap) return { ok: false, why: '没有快照' };
  const key = (R.SK && R.SK.GUN) || 'gun';
  const mk = (spec) => { P.setFeatMask(spec); const a = P.actionFeatures(snap.state, snap.pid, key, { key, target: 1, bead: 'elec' }); P.setFeatMask('all'); return a; };
  const all = mk('bead,target,effects,rel'), noT = mk('bead,effects,rel'), noB = mk('target,effects,rel');
  const diff = (a, b2) => a.map((v, i) => Math.abs((v || 0) - (b2[i] || 0)) > 1e-12 ? i : -1).filter(i => i >= 0);
  const t = diff(all, noT), bd = diff(all, noB);
  /* ⚠ 这里**不许**要求"恰好 6 列 / 恰好 2 列"（第一版就是这么写的，于是把正确的布局判成红的）：
   *   掩码只让**当场非零**的列变化 ⇒ 独热形式只能看见其中一两列。真正的红线是"变的列必须落在动作段内"。 */
  const inAction = (xs) => xs.length > 0 && xs.every(i => i >= 0 && i < FA);
  return { ok: all.length === FA && inAction(t) && inAction(bd), len: all.length, target: t, bead: bd,
    both: [...new Set(t.concat(bd))].sort((x, y) => x - y) };
}
function forwardSelfCheck() {
  const st = S.createState('multi', { next: mulberry32(SEED0 + 7) }, N);
  st.slotSalt = 999;
  let seen = 0, worst = 0;
  const wrap = function (state, pid, legal) {
    if (pid === 0 && seen < 300 && state.round >= 2) {
      const x = P.featuresV7(state, pid);
      for (const l of (legal || [])) {
        const af = P.actionFeatures(state, pid, l.key);
        const mine = scoreVec(x, af).v, theirs = P.value(state, pid, l.key, params, null);
        if (!isFinite(theirs)) continue;
        worst = Math.max(worst, Math.abs(mine - theirs)); seen++;
      }
    }
    return sel(state, pid, legal);
  };
  const chs = [wrap]; for (let i = 1; i < N; i++) chs.push(sel);
  Play.autoGameN(st, chs.slice(0, N), undefined, () => {});
  return { ok: worst < 1e-9 && seen > 20, worst, seen };
}

/* 快照与块边界**必须在主循环之前**算：动作段的两个子块要作为消融行进到 ABL 里，
 *   晚一步算就等于"注册了两行从不参与统计的表头"（第一版正是这样 ⇒ 那两行永远印 0.0%，
 *   而我差点把它读成"AI 不在乎打谁"）。 */
const snap = midGameSnapshot(), bm = stateBlockSelfCheck(snap), ab = actionBlockSelfCheck(snap);
const ACT_SUB = [];
if (ab.ok) {
  /* 消融用的**必须是一整块**，不是"这次测出来变化的那几列"：目标块有 7 列，一次抽样只亮其中 4 列 ⇒
   *   只抹那 4 列会留下 3 列继续区分目标 ⇒ 看着像"AI 不在乎打谁"，其实是我抹得不干净。
   *   ⇒ 由测到的 `bead` 列反推整块边界：珠 = [min, min+1]，目标 = 珠之后到动作段末尾。 */
  const beadLo = Math.min.apply(null, ab.bead), beadHi = beadLo + 1;
  const tgt = []; for (let k = beadHi + 1; k < FA; k++) tgt.push(k);
  const bd = []; for (let k = beadLo; k <= beadHi; k++) bd.push(k);
  ACT_SUB.push({ name: '  └ 动作段·**目标**整块 ' + tgt.length + ' 列（[' + tgt[0] + '..' + tgt[tgt.length - 1] + ']，一次抽样亮的是 [' + ab.target.join(',') + ']）', kind: 'action', lo: 0, hi: 0, afT: tgt, n: 0, flip: 0, mag: 0 });
  ACT_SUB.push({ name: '  └ 动作段·**珠**整块 2 列（带电珠还是爆珠）', kind: 'action', lo: 0, hi: 0, afT: bd, n: 0, flip: 0, mag: 0 });
}

/* ================= 主循环 =================
 * ⚠ 对手是谁 = 这台仪器的一部分（"夹具必须有对比度"那一族的新型态）：
 *   第一版四个 AI 席**全塞冠军自己** ⇒ 持续效果块 721 个决策里**一列都没亮过**（符咒/八卦/嘲讽这些
 *   只有原型池里的脚本会打），于是"抹掉效果块翻转率 0.0%"看着像发现，其实是**夹具在装死**。
 *   ⇒ 默认对手 = 原型池（与 §E179 同一批），并把"每块的对比度"当心跳印出来。 */
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
const OPP = arg('opp', 'pool');
const { pool: POOL2 } = poolFromSpecs(B, OPP_SPECS);
const ABL = BLOCKS.map(b => ({ name: b.name, kind: 'state', lo: b.lo, hi: b.hi, afT: null, n: 0, flip: 0, mag: 0 }));
ABL.push({ name: '动作段（这张卡自己：身份/费用/威力/目标/珠）', kind: 'action', lo: 0, hi: 0, all: true, afT: null, n: 0, flip: 0, mag: 0 });
for (const a of ACT_SUB) ABL.push(a);
const pipe = { n: 0, legal: 0, aff: 0, econ: 0, cands: 0, notArgmax: 0, solo: 0 };
const dimMag = new Float64Array(FS), dimFire = new Int32Array(FS);
const traces = []; let traceCount = 0;
const oppNames = new Set();
const contrast = { rel: 0, eff: 0, slot: 0, hist: 0 };
const tieSelf = { ok: false };
/* ===== v1.5.307（DS · 接千问 §E180「意外之二」）：**破平票三件套**（只记录 · 先证判别力）=====
 * 动因：两席属性相同时（例如 sword@1 与 sword@2）分数**逐位相同** —— 属性一样，特征里就是同一样本，
 *   于是选择退化成"**枚举顺序 + 温度采样**"。这一节把 ①率 ②方向 ③后果 量出来。
 * 机制：scored.sort 是 ES2019 稳定排序 ⇒ 平票保持 cands 原序 ⇒ **第一名 = 枚举里最早的那个**。
 * 反事实（不需要克隆状态）：**把 scored 反转再取 argmax** —— 第一名换人 ⇒ 这一手完全由顺序决定。 */
const tie = { n: 0, dec: 0, decAll: 0, sameAttrs: 0, diffAttrs: 0, tiedTargetN: 0, pickInTied: 0, pickLowestSeat: 0, pickFirstInOrder: 0, orderDecisive: 0, sameKeyIdentical: 0 };
const tieByRound = { all: 0, 'r1-2': 0, 'r3-5': 0, 'r6+': 0, unknown: 0 };
const firstTargets = {};
let decThisGame = 0;
let firstTargetSeen = false;
let games = 0, alive = 0, hpSum = 0, roundsSum = 0, top1Sum = 0, top1N = 0, marginSum = 0;
const evSig = (st) => st.events.map(e => (e.type + ':' + (e.pid == null ? '-' : e.pid) + ':' + (e.key || '') + ':' + (e.outcome || '') + ':' + (e.to == null ? '' : '>' + e.to) + ':' + (e.amt == null ? '' : e.amt))).join(',');
let wrapSig = null; const sigGame = GAMES - 1;

for (let g = 0; g < GAMES; g++) {
  decThisGame = 0; firstTargetSeen = false;
  const st = S.createState('multi', { next: mulberry32(SEED0 + g * 7919) }, N);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const rg = POOL2[g % POOL2.length];
  const oppSel = OPP === 'champ' ? T.policyChooserN(params, 0.15) : rg.sel;
  oppNames.add(OPP === 'champ' ? '冠军自己' : rg.name);
  const mine = function (state, pid, legal) {
    if (pid !== 0) return oppSel(state, pid, legal);
    const aff = (legal || []).filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: (R.SK && R.SK.JI) || 'ji', affordable: true }];
    let eb = base, cands = [];
    try { eb = T.econBase(state, pid, base) || base; } catch (e) { eb = base; }
    try { cands = P.candidatesFor(state, pid, eb, {}); } catch (e) { cands = []; }
    if (!cands.length) for (const l of eb) cands.push({ key: l.key, target: null, bead: null });
    const x = P.featuresV7(state, pid);
    pipe.n++; pipe.legal += (legal || []).length; pipe.aff += aff.length; pipe.econ += eb.length; pipe.cands += cands.length;
    /* 对比度心跳：**这一块在这份夹具里到底有没有亮过**（没亮过 ⇒ "抹掉它翻转率 0%"是夹具的功劳，不是发现）*/
    { const lit = (lo, hi) => { for (let i = lo; i < hi; i++) if (Math.abs(x[i]) > 1e-12) return 1; return 0; };
      contrast.slot += lit(OFF.slot, OFF.hist); contrast.hist += lit(OFF.hist, OFF.rel);
      contrast.rel += lit(OFF.rel, OFF.eff); contrast.eff += lit(OFF.eff, FS); }
    if (cands.length <= 1) pipe.solo++;
    const scored = [];
    for (const c of cands) {
      const af = P.actionFeatures(state, pid, c.key, c);
      const sc = scoreVec(x, af);
      /* 决策的**身份 = (打哪张卡, 打谁)**：第一版只比 key ⇒ "抹掉目标那几列也不换招"是假的，
       *   因为换目标在我眼里根本没被算成"换了"。目标才是这只手的一半。 */
      scored.push({ key: c.key, target: c.target == null ? '-' : c.target, sig: c.key + '@' + (c.target == null ? '-' : c.target), v: sc.v, attr: attribute(x, af, sc.z) });
    }
    scored.sort((a, b2) => b2.v - a.v);
    if (scored.length > 1) { top1Sum += scored[0].v; top1N++; marginSum += (scored[0].v - scored[1].v); }
    const picked = sel(state, pid, legal);
    const pickSig = picked ? (picked.key + '@' + (picked.target == null ? '-' : picked.target)) : null;
    /* ── 破平票三件套（v1.5.307 · 只记录）────────────────────────── */
    decThisGame++; tie.decAll++;   /* v1.5.307 补：**分母必须是独立的量** —— 第一版拿 tie.dec（只在平票分支 +1）当分母 ⇒ 必然印 100% */
    if (scored.length > 1) {
      const EPS_T = 1e-12, best0 = scored[0].v;
      const tiedSet = scored.filter(function (q) { return Math.abs(q.v - best0) <= EPS_T; });
      /* (0) 同卡·不同目标·分数逐位相同 = "两席属性一样"的可观测指纹（§E180 的原观察） */
      for (let i2 = 0; i2 < tiedSet.length; i2++) for (let j2 = i2 + 1; j2 < tiedSet.length; j2++)
        if (tiedSet[i2].key === tiedSet[j2].key && tiedSet[i2].target !== tiedSet[j2].target) tie.sameKeyIdentical++;
      const diffTgt = tiedSet.some(function (q) { return q.target !== tiedSet[0].target; });
      if (tiedSet.length > 1 && diffTgt) {
        tie.n++; tie.dec++;
        /* 按回合分桶：区分"结构上不看目标"与"只是开局对称"（我的预测：平票集中在前 1~2 回合） */
        { const rd = (typeof round !== 'undefined' && round != null) ? Number(round) : (state && state.round != null ? Number(state.round) : -1);
          const b2 = rd < 0 ? 'unknown' : (rd <= 2 ? 'r1-2' : (rd <= 5 ? 'r3-5' : 'r6+'));
          tieByRound.all++; tieByRound[b2] = (tieByRound[b2] || 0) + 1; }
        const tset = {}; for (const q of tiedSet) if (q.target !== '-') tset[String(q.target)] = 1;
        const tnums = Object.keys(tset).map(Number).sort(function (x2, y2) { return x2 - y2; });
        tie.tiedTargetN += tnums.length;
        /* 关键分辨：平票的那些目标席，**属性真的一样吗**（读 state 而不是猜特征布局） */
        {
          const attrs = tnums.map(function (pid2) { const q = state.p[pid2]; return q ? (q.hp + '/' + q.ep) : '?'; });
          const uniq = {}; for (const a of attrs) uniq[a] = 1;
          if (Object.keys(uniq).length === 1) tie.sameAttrs++; else tie.diffAttrs++;
        }
        if (picked) {
          if (tiedSet.some(function (q) { return q.sig === pickSig; })) {
            tie.pickInTied++;
            if (tnums.length && String(picked.target) === String(tnums[0])) tie.pickLowestSeat++;
            if (pickSig === tiedSet[0].sig) tie.pickFirstInOrder++;
          }
        }
        const revTop = scored.slice().reverse()[0];
        if (revTop && revTop.sig !== scored[0].sig) tie.orderDecisive++;
      }
    }
    if (picked && picked.target != null && firstTargetSeen === false) { firstTargetSeen = true; firstTargets[String(picked.target)] = (firstTargets[String(picked.target)] || 0) + 1; }
    if (scored.length && picked && pickSig !== scored[0].sig) pipe.notArgmax++;
    const a0 = scored.length ? scored[0].attr : null;
    if (a0) for (let i = 0; i < FS; i++) { dimMag[i] += Math.abs(a0.ci[i]); if (Math.abs(a0.ci[i]) > 1e-6) dimFire[i]++; }
    for (const a of ABL) {
      if (scored.length < 2) continue;
      a.n++;
      let bestV = -Infinity, bestKey = null;
      for (const c of cands) {
        const af0 = P.actionFeatures(state, pid, c.key, c);
        const xp = x.slice(); const ap = af0.slice();
        if (a.kind === 'state') for (let i = a.lo; i < a.hi; i++) xp[i] = 0;
        else if (a.all) for (let k = 0; k < ap.length; k++) ap[k] = 0;
        else if (a.afT) for (const k of a.afT) ap[k] = 0;
        const v = scoreVec(xp, ap).v;
        if (v > bestV) { bestV = v; bestKey = c.key + '@' + (c.target == null ? '-' : c.target); }
      }
      if (bestKey !== scored[0].sig) a.flip++;
      if (a.kind === 'state') a.mag += blockSum(a0.ci, a);
    }
    if (traceCount < TRACES && scored.length > 2 && state.round >= 3) {
      traceCount++;
      traces.push({ g, round: state.round, hp: state.p[0].hp, ep: state.p[0].ep, bead: (state.p[0].elec ? '电' : '') + (state.p[0].boom ? '爆' : '') || '无',
        legal: (legal || []).length, aff: aff.length, econ: eb.length, cands: cands.length, pick: picked && picked.key, pickSig, pickT: picked && picked.target,
        top: scored.slice(0, 4).map(s2 => ({ sig: s2.sig, v: s2.v, konst: s2.attr.konst, blocks: BLOCKS.map(b => blockSum(s2.attr.ci, b)),
          act: (() => { let t = 0; for (let k = 0; k < s2.attr.ca.length; k++) t += s2.attr.ca[k]; return t; })(),
          dims: (() => { const o = []; for (let i = 0; i < s2.attr.ci.length; i++) if (Math.abs(s2.attr.ci[i]) > 1e-9) o.push({ i, v: s2.attr.ci[i] }); o.sort((q, r) => Math.abs(r.v) - Math.abs(q.v)); return o.slice(0, 3); })() })) });
    }
    /* ⚠ 决策**只许问一次**：`sel(...)` 内部可能从 `state.rng` 抽数（温度采样 / ε 探索）⇒
       第一版这里"先问一次做记录、再问一次当返回值"= **每手多抽一次随机数 ⇒ 整局跑偏**
       （本仓那个"换个包装就整条流错位"的老族）。现在记录与返回同一个对象。 */
    return picked;
  };
  const chs = [mine]; for (let i = 1; i < N; i++) chs.push(oppSel);
  Play.autoGameN(st, chs.slice(0, N), undefined, () => {});
  if (g === sigGame) wrapSig = evSig(st);
  games++; roundsSum += st.round;
  const me = st.p[0]; if (me && me.hp > 0) { alive++; hpSum += me.hp; }
  if (!QUIET) process.stdout.write('.');
}
if (!QUIET) process.stdout.write('\n');
/* 自检③（红线）：**记这一手不能改变这一手** ⇒ 同一颗种子"包 vs 不包"事件流必须逐字相同
 * ⚠ 对照跑必须用**同一批对手**：主循环第 `sigGame` 局的对手是 `POOL2[sigGame % POOL2.length]`，
 *   这里若偷懒全用冠军自己，比的就是两张不同的桌子（第一版正是这样，于是"红线"自己红了）。 */
{
  const st = S.createState('multi', { next: mulberry32(SEED0 + sigGame * 7919) }, N);
  st.slotSalt = (Math.imul(sigGame + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const rgPlain = POOL2[sigGame % POOL2.length];
  const oSel = OPP === 'champ' ? T.policyChooserN(params, 0.15) : rgPlain.sel;
  const pchs = [sel]; for (let i = 1; i < N; i++) pchs.push(oSel);
  Play.autoGameN(st, pchs.slice(0, N), undefined, () => {});
  var driftOk = evSig(st) === wrapSig, driftLen = wrapSig ? wrapSig.length : 0;
}

const fsc = forwardSelfCheck();
const spots = semanticSpotCheck(), spotBad = spots.filter(s => !s.ok);
console.log('# §E180 现役冠军 AI 是怎么决定出手的（包 `bundled-champion-3p.js` · 网络 ' + FN + '→' + HID + '→1 · 温度 0.15 · **信念搜索默认关**）');
console.log('\n## ⓪ 先证明"我读对了这张网络"（四道自检，任一不过 ⇒ **后面一手都不许解释**）');
console.log('| 自检 | 实测 | 判定 |');
console.log('|---|---|---|');
console.log('| 记这一手不改变这一手（包记录器 vs 不包 · 事件流逐字） | ' + driftLen + ' 字符相同 | ' + (driftOk ? '✔' : '⛔ 记录器让整局跑偏') + ' |');
console.log('| 本机 forward vs `P.value()` | 最大差 ' + (fsc.worst ? fsc.worst.toExponential(1) : '0') + '（' + fsc.seen + ' 个打分点） | ' + (fsc.ok ? '✔ 归因是恒等式，不是估计' : '⛔ 对不上 ⇒ 归因作废') + ' |');
console.log('| 状态块边界 vs `setFeatMask`（判据 = **子集 + 非空**） | 指向动 ' + bm.rel + ' 列 ⊂ [' + OFF.rel + ',' + OFF.eff + ') ‖ 效果动 ' + bm.eff + ' 列 ⊂ [' + OFF.eff + ',' + FS + ') | ' + (bm.ok ? '✔ 没有一列越界' : '⛔ ' + (bm.why || '有列落在块外 ⇒ 边界是编的')) + ' |');
console.log('| 语义点检（灌**一个**字段 ⇒ 只许那一列动） | ' + spots.length + ' 项，错 ' + spotBad.length + ' 项 | ' + (spotBad.length === 0 ? '✔ 逐列对得上转录表' : '⛔ ' + spotBad.map(s => s.name + '：期望 [' + s.want + '] 实测 [' + s.got + ']').join(' ‖ ')) + ' |');
console.log('| 动作段子块（**测出来**不是数源码） | 长 ' + ab.len + '/' + FA + ' ‖ 目标 [' + (ab.target || []).join(',') + '] ‖ 珠 [' + (ab.bead || []).join(',') + '] | ' + (ab.ok ? '✔' : '⛔ 动作段长度对不上') + ' |');
if (!driftOk || !bm.ok || !fsc.ok || !ab.ok || spotBad.length) { console.log('\n⛔ 自检没过 ⇒ 这台仪器**没有资格**解释任何一手。'); process.exit(3); }

console.log('\n## ① 决策管线（' + games + ' 局 · 冠军坐第 0 席 · ' + pipe.n + ' 个决策 ‖ 对手 = ' + (OPP === 'champ' ? '冠军自己' : '原型池 ' + oppNames.size + ' 个原型') + '）');
console.log('每回合平均：**合法 ' + (pipe.legal / pipe.n).toFixed(1) + ' 张 → 付得起 ' + (pipe.aff / pipe.n).toFixed(1) + ' 张 → `econBase` 剪后 ' + (pipe.econ / pipe.n).toFixed(1) + ' 张 → 展开成候选（技能×目标×珠）' + (pipe.cands / pipe.n).toFixed(1) + ' 个** → 每个过一次网络 → 取最高');
console.log('只剩 1 个候选（网络无话可说）的决策占 ' + (100 * pipe.solo / pipe.n).toFixed(1) + '%；温度 0.15 下**实际出手 ≠ 网络第一名** ' + (100 * pipe.notArgmax / pipe.n).toFixed(1) + '%');
console.log('**对比度心跳**（这一块在这批桌子里"亮过"的决策比例）：对手席 ' + (100 * contrast.slot / pipe.n).toFixed(0) + '% ‖ 历史 ' + (100 * contrast.hist / pipe.n).toFixed(0) + '% ‖ 指向 ' + (100 * contrast.rel / pipe.n).toFixed(0) + '% ‖ **持续效果 ' + (100 * contrast.eff / pipe.n).toFixed(0) + '%**'
  + (contrast.eff / pipe.n < 0.05 ? ' ⇒ ⚠ 这一块在这份夹具里几乎从不亮 ⇒ 它那一行"抹掉也不换招"是**夹具的功劳，不是发现**（换 `--opp=pool` 也一样低就是另一回事了）' : ''));
console.log('第一名平均分数 ' + (top1N ? top1Sum / top1N : 0).toFixed(3) + ' ‖ **与第二名的平均差距 ' + (top1N ? marginSum / top1N : 0).toFixed(3) + '**');

console.log('\n## ② 哪一块输入真的在驱动这一手（**抹掉整块 ⇒ 换不换招**）');
console.log('| 输入块 | 维度 | 抹掉后决策翻转率 | 第一名分数里这块的平均贡献 |');
console.log('|---|---|---|---|');
for (const a of ABL) {
  const dims = a.kind === 'state' ? (a.hi - a.lo) : (a.afT ? a.afT.length : FA);
  console.log('| ' + a.name + ' | ' + dims + ' | **' + (100 * a.flip / Math.max(1, a.n)).toFixed(1) + '%** | ' + (a.kind === 'state' ? ((a.mag / Math.max(1, a.n)) >= 0 ? '+' : '') + (a.mag / Math.max(1, a.n)).toFixed(3) : '（动作段不按块求和）') + ' |');
}
console.log('\n> ⚠ 读这张表的三条规矩：');
console.log('> ① **动作段整体归零**那一行不是发现 —— 把所有卡抹成"同一张无名卡"，第一名自然换（它测的是"卡的身份信息有多少"，不是"AI 在乎不在乎"）；');
console.log('> ② 所以要看**测出来的子列**（目标那几列 / 珠那一列）与状态侧各块；');
console.log('> ③ 某块"抹掉也不换招"且**对比度心跳很低** ⇒ 是这块在这批桌上根本没亮过，不能读成"AI 不用它"。');
const rank = ABL.filter(a => a.kind === 'state').slice().sort((a, b2) => b2.flip / b2.n - a.flip / a.n);
console.log('> 状态侧按"抹掉就换招"排序：**' + rank[0].name + ' ' + (100 * rank[0].flip / rank[0].n).toFixed(1) + '%** > ' + rank[1].name + ' ' + (100 * rank[1].flip / rank[1].n).toFixed(1) + '%');

console.log('\n## ③ 单维热点（第一名分数里 ‖贡献‖ 最大的 14 维 · 跨 ' + pipe.n + ' 个决策平均）');
const per = []; for (let i = 0; i < FS; i++) if (dimMag[i] > 0) per.push({ i, m: dimMag[i] / pipe.n, fires: dimFire[i] / pipe.n });
per.sort((a, b2) => b2.m - a.m);
console.log('| 索引 | 落在哪 | 平均‖贡献‖ | 这一维"上榜"的比例 |');
console.log('|---|---|---|---|');
for (const p2 of per.slice(0, 14)) console.log('| #' + p2.i + ' | ' + nameOf(p2.i) + ' | ' + p2.m.toFixed(4) + ' | ' + (100 * p2.fires).toFixed(0) + '% |');

for (const t of traces) {
  console.log('\n## ④ 真实一手（第 ' + (t.g + 1) + ' 局 · 回合 ' + t.round + ' ‖ 我 ' + t.hp + ' 血 / ' + t.ep + ' ジ / 珠 ' + t.bead + ' ‖ 合法 ' + t.legal + '→付得起 ' + t.aff + '→剪后 ' + t.econ + '→候选 ' + t.cands + '）');
  for (let i = 0; i < t.top.length; i++) {
    const s2 = t.top[i];
    const parts = s2.blocks.map((v, k) => BLOCKS[k].name.split('（')[0] + ' ' + (v >= 0 ? '+' : '') + v.toFixed(3)).join(' ‖ ') + ' ‖ 动作段 ' + (s2.act >= 0 ? '+' : '') + s2.act.toFixed(3);
    console.log('  ' + (i === 0 ? '▶ 网络第一' : '  次选') + ' `' + s2.sig + '` 分 ' + (s2.v >= 0 ? '+' : '') + s2.v.toFixed(3) + ' = 常数 ' + (s2.konst >= 0 ? '+' : '') + s2.konst.toFixed(3) + ' ‖ ' + parts);
    console.log('              最大三维：' + s2.dims.map(d => '#' + d.i + '（' + nameOf(d.i) + '）' + (d.v >= 0 ? '+' : '') + d.v.toFixed(3)).join(' ‖ '));
  }
  console.log('  实际出手：`' + t.pickSig + '`' + (t.pickSig !== (t.top[0] && t.top[0].sig) ? '  ⚠ ≠ 网络第一（温度/枚举差异）' : ''));
}
console.log('\n（' + games + ' 局汇总：冠军席位存活率 ' + (100 * alive / games).toFixed(0) + '% · 平均终局血量 ' + (alive ? hpSum / alive : 0).toFixed(1) + ' · 平均 ' + (roundsSum / games).toFixed(1) + ' 回合）');
/* ===== ⑤ 破平票三件套（v1.5.307 · 只记录）===== */
{
  const pct = function (a, b2) { return b2 ? (100 * a / b2).toFixed(1) + '%' : '—'; };
  console.log('\n## ⑤ 破平票：两席属性相同时，这手是谁在破？（分母 ' + tie.decAll + ' 个多候选决策；条件统计的分母单列 = 平票数）');
  console.log('| 量 | 实测 |');
  console.log('|---|---|');
  console.log('| 平票决策（同分且目标不同） | **' + pct(tie.n, tie.decAll) + '**（' + tie.n + '/' + tie.decAll + '） |');
  console.log('| └ 同卡·不同目标·分数逐位相同（=两席属性一样的指纹） | ' + tie.sameKeyIdentical + ' 对 |');
  console.log('| └ 实际出手落在平票集合里 | ' + pct(tie.pickInTied, tie.n) + '（' + tie.pickInTied + '/' + tie.n + '） |');
  console.log('| └ 其中选了**枚举顺序最早**那个 | ' + pct(tie.pickFirstInOrder, tie.n) + ' |');
  console.log('| └ 其中选了**最低席号** | ' + pct(tie.pickLowestSeat, tie.n) + ' |');
  console.log('| **反转候选列表**后第一名换人（=顺序决定） | **' + pct(tie.orderDecisive, tie.n) + '**（' + tie.orderDecisive + '/' + tie.n + '） |');
  {
    const ft = Object.keys(firstTargets).sort(function (a, b2) { return firstTargets[b2] - firstTargets[a]; })
      .map(function (k) { return '席' + k + ' ' + firstTargets[k]; }).join(' · ');
    console.log('| └ 平票目标的属性（读 state 的 hp/ep） | **一样 ' + tie.sameAttrs + '** · 不一样 ' + tie.diffAttrs + ' |');
  console.log('| └ 平票按回合分桶 | r1-2 ' + tieByRound['r1-2'] + ' · r3-5 ' + tieByRound['r3-5'] + ' · r6+ ' + tieByRound['r6+'] + ' · unknown ' + tieByRound.unknown + '（分母 ' + tieByRound.all + ' = **平票数**，不是多候选决策数） |');
  console.log('| 首手目标分布 | ' + (ft || '—') + ' |');
  }
  {
    const mkL = function (vals, tgs) { return vals.map(function (v, i) { return { v: v, sig: 'x@' + tgs[i], target: String(tgs[i]), key: 'x' }; }); };
    const topOf = function (arr) { return arr.slice().sort(function (a, b2) { return b2.v - a.v; })[0].sig; };
    const revOf = function (arr) { return arr.slice().reverse().sort(function (a, b2) { return b2.v - a.v; })[0].sig; };
    const t1 = mkL([1, 1], [1, 2]), u1 = mkL([1, 0.5], [1, 2]);
    tieSelf.ok = (topOf(t1) === 'x@1') && (revOf(t1) === 'x@2') && (topOf(u1) === 'x@1') && (revOf(u1) === 'x@1');
    console.log('| 判别力自检（合成：平票须顺序破且反转翻转 ‖ 差 0.5 分须不翻） | ' + (tieSelf.ok ? '✔ 过' : '⛔ **不过 ⇒ 上面几行不算数**') + ' |');
  }
}if (arg('json', '')) {
  writeFileSync(arg('json'), JSON.stringify({ meta: { games, n: N, seed0: SEED0, opp: OPP, opponents: [...oppNames], pack: 'bundled-champion-3p', FS, FA, FN, HID, temp: 0.15, layout: { MAIN, OFF, HK, EF, SLOT, PSLOT } },
    contrast, spots,
    selfCheck: { bm, ab, fsc, tie: tieSelf },
    tie: { n: tie.n, dec: tie.dec, sameKeyIdentical: tie.sameKeyIdentical, pickInTied: tie.pickInTied, pickFirstInOrder: tie.pickFirstInOrder, pickLowestSeat: tie.pickLowestSeat, orderDecisive: tie.orderDecisive, firstTargets: firstTargets, sameAttrs: tie.sameAttrs, diffAttrs: tie.diffAttrs }, pipe, margin: top1N ? marginSum / top1N : null, abl: ABL.map(a => ({ name: a.name, dims: a.kind === 'state' ? a.hi - a.lo : FA, flipRate: a.flip / Math.max(1, a.n), mag: a.mag / Math.max(1, a.n) })),
    topDims: per.slice(0, 20).map(p2 => ({ i: p2.i, name: nameOf(p2.i), m: p2.m, fires: p2.fires })), traces }, null, 1));
  console.log('  json → ' + arg('json'));
}
