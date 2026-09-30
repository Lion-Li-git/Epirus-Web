#!/usr/bin/env node
/* §E190 · 珠价读得多，到底卡在哪一步：**转化率链**（产品桌 n=5 · 与 §E185~§E189 同一装配、同一批 seed 带）
 *
 * 为什么要这一格：§E187/§E189 立住了"珠价 `E1` 确实在读对手、且不是菜单假象"，
 *   但 §E169 早量过它的**结果面是亏的**（电磁炮全程 0.00、珠过期 ×15、把开档净收益 +11.67 压到 +6.33）。
 *   ⇒ 现在要的是**卡点定位**：有珠的那些决策里，是"买不起炮"（经济结构）还是"买得起却不开"（选择）？
 *
 * ⚠ **定义零复制**：计数器与三条判据一律用 `tools/behavior-profile.mjs` 那份（门 D206/D207 在断言同一份算术）
 *   ⇒ `tally()` / `tallyPick()` / `share()` 全部 import，本文件**不自己数珠**。
 *   本文件只负责：产品桌装配（0 席人类形状 ‖ 1 席被测 ‖ 2/3 席环境原型 ‖ 4 席关档冠军）+ 胜负/局长 + 配对差。
 *   ⚠ 与 §E169 的"转化率 = 消耗/获得（按珠子计）"**不同尺**：这里 `beadHeld/beadLive` 是**按决策计**
 *     ⇒ 两把尺只并排、不互校（`epirus-web-caliber-traps` 的"手感指标要有第二种定义"那一族）。
 * 只读 `js/**`，不改引擎、不加门、不动冠军包。
 *
 * §E192 在本文件里加了**第 6 枚**（只给"可兑现的珠"定价 = 跨回合**可行性**约束），
 * §E193 加**第 7 枚**（给"转移"定价 = 这一手真把珠花出去就发钱；接在候选循环里，**不动 `np-test` D210 的两处钉**）。
 *   ⇒ 两枚合起来把 §E190 那条"读得多、转化 0"的链拆开复查：**卡点会随定价形式在"买不起 ↔ 不开"之间来回平移**。
 *   ⚠ `H1/H3` 是机理判别档：若动作价与状态价**按大小相抵** ⇒ 它是价格；若状态价整块抬不动它 ⇒ 它实际是**破平票的序偏置**（`F1≡F8` 那个红旗）。
 */
import { sandbox, mulberry32, loadChamp } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';
import { tally, tallyPick, tallyClose, share } from './behavior-profile.mjs';

const argv = process.argv.slice(2);
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const GAMES = Math.max(4, Number(arg('games', 16)) || 16);
const BANDS = arg('band', 'all') === 'all' ? [1, 2] : [Number(arg('band', 1))];
const SEED = { 1: 4100, 2: 21000 };
const N = 5, FOCUS = 1;                      // 产品桌：焦点席固定 1 号（0 号 = 人类形状代表）
const W = sandbox(), R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const SK = R.SK;
if (typeof tallyPick !== 'function' || typeof tally !== 'function') { console.error('⛔ 拿不到 behavior-profile 的计数器 ⇒ 本文件不许自己数珠，退出'); process.exit(2); }
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENV_PICK = ['random', 'balanced', 'aggro', 'defend', 'wall', 'antidef', 'breakdef', 'mix', 'farmer', 'tankline', 'heavyfire', 'ringspam'];
const ENVS = ENV_PICK.map(n => { const p = POOL.find(q => q.name === n); if (!p) { console.error('⛔ 环境 `' + n + '` 不在原型池'); process.exit(2); } return p; });
const HB = loadPool(W, 'human');

/* ---- 臂：一律**实例级**开档（模块档恒关 ⇒ 对手席不会被带着搜） ----
 * ⚠ `belief()` 每次把**七个**旋钮全部显式赋值（§E192 加了第六个，§E193 加了第七个）——
 *   漏一个就会把上一臂的档带进来，而这类"旋钮串档"在本仓有过前科（模块档没复位那次是同一族）。 */
function belief(ply, tgt, tie, bead, ring, rd, fire) {
  return function () {
    T.setBeliefPly(ply); T.setBeliefTarget(tgt); T.setBeliefTie(tie); T.setBeliefBead(bead); T.setBeliefRingPrice(ring);
    T.setBeliefBeadRedeemable(rd || 0); T.setBeliefFireSpend(fire || 0);
    T.setBeliefSearch(0);
    return T.policyChooserBelief(params, 0.15);
  };
}
const ARMS = {
  A0: { name: '关档（现役出厂形状）', mk: () => T.policyChooserN(params, 0.15) },
  B1: { name: 'ply1 tie0', mk: belief(1, 0, 0, 0, 0, 0) },
  B2: { name: 'ply2 tie0', mk: belief(2, 0, 0, 0, 0, 0) },
  E1: { name: 'ply1 · 珠价 1', mk: belief(1, 0, 0, 1, 0, 0) },
  E4: { name: 'ply1 · 珠价 4', mk: belief(1, 0, 0, 4, 0, 0) },
  D1: { name: 'ply1 · 环价 1', mk: belief(1, 0, 0, 0, 1, 0) },
  /* §E192 的第 6 剂：**只给"可兑现的珠"定价**（手上有珠且 ep≥2，下一手真的开得出炮才算钱） */
  R1: { name: 'ply1 · 可兑现珠价 1', mk: belief(1, 0, 0, 0, 0, 1) },
  R2: { name: 'ply1 · 可兑现珠价 2', mk: belief(1, 0, 0, 0, 0, 2) },
  R6: { name: 'ply1 · 可兑现珠价 6', mk: belief(1, 0, 0, 0, 0, 6) },
  R12: { name: 'ply1 · 可兑现珠价 12', mk: belief(1, 0, 0, 0, 0, 12) },
  R6E1: { name: 'ply1 · 可兑现珠价 6 + 珠价 1', mk: belief(1, 0, 0, 1, 0, 6) },
  /* §E193 的第 7 剂：**给"转移"定价**（这一手真的把珠花出去 = 出电磁炮/激光眼就发钱）。
     接在 `beliefSearchPick` 的候选循环里，**不穿进 `beliefValue/beadTerm`** ⇒ 门 D210①′/①″ 两处钉一字未动。
     剂量梯挂在 `R2` 上（§E192 里它的卡点是"买得起却不开 98.7~99.1%"），另加一枚**不带状态价**的 `G1` 把两种价分开。 */
  F1: { name: 'ply1 · 可兑现珠价 2 + 动作价 1', mk: belief(1, 0, 0, 0, 0, 2, 1) },
  F3: { name: 'ply1 · 可兑现珠价 2 + 动作价 3', mk: belief(1, 0, 0, 0, 0, 2, 3) },
  F8: { name: 'ply1 · 可兑现珠价 2 + 动作价 8', mk: belief(1, 0, 0, 0, 0, 2, 8) },
  G1: { name: 'ply1 · 只有动作价 1（无状态价）', mk: belief(1, 0, 0, 0, 0, 0, 1) },
  /* §E193 的**机理判别档**：smoke 里 `F1 ≡ F8`（动作价抬 8 倍整行一字不差）⇒ "大小"不重要，可能这枚起的只是**破平票**的作用
     （`beliefValue` 是整数血尺，`if (v > bv + 1e-9)` 是严格大于 ⇒ 平票由候选枚举顺序裁决，见 §E161c）。
     分辨办法：**把状态价抬到 6**（持有可兑现的珠 = +6），再看动作价 1 vs 3 还动不动得了开火率。
     · 若 `H1 ≡ H3 ≡ R6`（开火率被打回 0.2%）⇒ 动作价是**真的价格**，与状态价按大小相抵；
     · 若 `H1 ≡ H3 ≡ F1`（照旧 3%）⇒ 状态价整块失效 ⇒ 这一枚实际是**序上的偏置**（破平票），不是定价 ⇒ 不许写成"给转移定价有效"。 */
  H1: { name: 'ply1 · 可兑现珠价 6 + 动作价 1', mk: belief(1, 0, 0, 0, 0, 6, 1) },
  H3: { name: 'ply1 · 可兑现珠价 6 + 动作价 3', mk: belief(1, 0, 0, 0, 0, 6, 3) },
  /* §E193 追加：**动作价 × 搜索深度**的交乘。§E190 量到 `ply2` 的卡点是**纯 A 机制**（买得起却不开 90.8/78.6%），
     而动作价治的正是 A 机制 ⇒ 如果两者相乘还是不加（`J1/K1` 不比 `B1/B2` 好），那"把读来的东西变成伤害"这条路
     就只剩"改目标函数本身"（状态价值头），旋钮面到此见底。 */
  J1: { name: 'ply1 · 只有动作价 2（无状态价）', mk: belief(1, 0, 0, 0, 0, 0, 2) },
  K2: { name: 'ply2 · 只有动作价 1', mk: belief(2, 0, 0, 0, 0, 0, 1) },
  K3: { name: 'ply2 · 可兑现珠价 2 + 动作价 1', mk: belief(2, 0, 0, 0, 0, 2, 1) },
  /* §E193 判别的**第二把**（把"是价格还是破平票"从推断变成实测）：`H1/H3` 显示状态价从 2 抬到 6 几乎动不了开火率
     ⇒ 动作价不像与状态价按大小相抵的钱，更像"把行权从**精确平票**里拉出来"的序偏置（§E161c：整数血尺 + `v > bv + 1e-9` ⇒ 平票由枚举顺序裁决）。
     仓库里**本来就有一枚破平票的档**（`BELIEF_TIE=1` ⇒ 平票交给网络自己的打分）⇒ 直接并排量：
     · `L1` = 状态价 2 + **破平票交给网络**（不开火钱）——若它自己就能把"买得起却不开"从 98.7% 打下来 ⇒ "囤珠"这个吸引子主要是**平票裁决**的产物，不是定价的产物；
     · `L2` = 两枚一起开 ⇒ 若 ≈ `max(L1, F1)` 而不是相加 ⇒ 它们破的是**同一批平票**。 */
  L1: { name: 'ply1 · 可兑现珠价 2 · 平票交给网络（无动作价）', mk: belief(1, 0, 1, 0, 0, 2, 0) },
  L2: { name: 'ply1 · 可兑现珠价 2 · 平票交给网络 + 动作价 1', mk: belief(1, 0, 1, 0, 0, 2, 1) },
};
const ARMWANT = (arg('arms', '') || Object.keys(ARMS).join(',')).split(',').filter(k => ARMS[k]);

function playOne(armKey, env, g, seedBase, t) {
  const rnd = mulberry32(seedBase + g * 7919);
  const st = S.createState('multi', { next: rnd }, N);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const base = ARMS[armKey].mk();
  const ctx = { lastTgt: {}, tgtCnt: {}, seat: FOCUS };          // 每局重置（连段/集中度的口径也只有一个定义）
  const rec = function (state, pid, legal) {
    const r = base(state, pid, legal);
    if (pid === FOCUS) tallyPick(t, state, pid, r, ctx, legal);   // ← 只数主体席，与 §E169 同一席位过滤
    return r;
  };
  const chs = [];
  const mimic = makeMimic(W, HB, 'rand', function () { return st.rng.next(); });
  const off = T.policyChooserN(params, 0.15);                    // 4 席 = 关档冠军（恒不搜 ⇒ 臂间对照稳定）
  chs.push(mimic, rec, env.sel, env.sel, off);
  Play.autoGameN(st, chs, undefined, undefined);
  tallyClose(t, ctx);
  const me = st.p[FOCUS];
  const top = me && me.hp > 0 && st.p.every((q, i) => i === FOCUS || q.hp <= me.hp);
  t.games = (t.games || 0) + 1;
  if (top) t.wins = (t.wins || 0) + 1;
  t.rounds += st.round;
  t.humanTop += (st.p[0].hp > 0 && st.p.slice(1).every(q => q.hp <= st.p[0].hp)) ? 1 : 0;
  return st;
}

const RES = {};
for (const band of BANDS) {
  RES[band] = {};
  for (const k of ARMWANT) {
    RES[band][k] = {};
    for (const env of ENVS) for (let g = 0; g < GAMES; g++) {
      const key = env.name + '#' + g;
      let t = RES[band][k][key];
      if (!t) t = RES[band][k][key] = Object.assign(tally(), { games: 0, humanTop: 0 });
      playOne(k, env, g, SEED[band], t);
    }
    process.stdout.write('|');
  }
}
process.stdout.write('\n');

const agg = (band, k) => {
  const o = Object.assign(tally(), { games: 0, humanTop: 0 });
  for (const key in RES[band][k]) {
    const s = RES[band][k][key];
    /* ⚠ `keys` 是**对象**（按卡计数），第一版写成 `o[f] = (o[f]||0) + s[f]` ⇒ `{} + {}` = NaN
     *   ⇒ 所有"某张卡的%"整列被静默抹成 0.0（蓄能/电磁炮全 0，而 `有珠决策%` 却非零——就是这个矛盾露出来的）。
     *   数值列与 `keys` 必须分开合。 */
    for (const f in s) {
      if (f === 'keys') continue;
      o[f] = (typeof o[f] === 'number' ? o[f] : 0) + (typeof s[f] === 'number' ? s[f] : 0);
    }
    for (const kk in s.keys) o.keys[kk] = (o.keys[kk] || 0) + s.keys[kk];
  }
  return o;
};
const pct = (a, b) => (b > 0 ? (100 * a / b) : NaN);
function row(t) {
  const live = t.beadLive;
  return { acts: t.acts, games: t.games, charge: pct(t.keys[SK.CHARGE] || 0, t.acts), rail: pct(t.keys[SK.RAILGUN] || 0, t.acts),
    laser: pct(t.keys[SK.LASER_EYE] || 0, t.acts), liveShare: pct(live, t.acts),
    broke: pct(t.beadBroke, live), held: pct(t.beadHeld, live), win: pct(t.wins, t.games), hwin: pct(t.humanTop, t.games), rounds: t.rounds / Math.max(1, t.games) };
}
console.log('# §E190/§E192/§E193 珠的转化链（产品桌 n=5 · 焦点席 1 号 · ' + GAMES + ' 局/环境 × ' + ENVS.length + ' 环境 · **计数器 import 自 behavior-profile，本文件不自数珠**）');
for (const band of BANDS) {
  console.log('\n## 带 ' + band + '（seed ' + SEED[band] + '）· 全部**按决策计**');
  console.log('| 臂 | 每局出手 | 蓄能% | **电磁炮%** | 激光眼% | **有珠的决策%** | 其中**买不起炮** | 其中**买得起却不开** | 焦点席夺冠 | 人类席夺冠 | 局长 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of ARMWANT) {
    const r = row(agg(band, k));
    console.log('| `' + k + '` ' + ARMS[k].name + ' | ' + (r.acts / Math.max(1, r.games)).toFixed(1) + ' | ' + r.charge.toFixed(1) + ' | **' + r.rail.toFixed(1) + '** | '
      + r.laser.toFixed(1) + ' | ' + r.liveShare.toFixed(1) + ' | ' + (isFinite(r.broke) ? r.broke.toFixed(1) : '—') + ' | **'
      + (isFinite(r.held) ? r.held.toFixed(1) : '—') + '** | ' + r.win.toFixed(1) + ' | ' + r.hwin.toFixed(1) + ' | ' + r.rounds.toFixed(1) + ' |');
  }
  console.log('\n> 每臂实际出过的卡（普查，防"整列静默 0"）：');
  for (const k of ARMWANT) {
    const t = agg(band, k), tot = Object.values(t.keys).reduce((a, b) => a + b, 0) || 1;
    console.log('>  · `' + k + '` ' + Object.entries(t.keys).sort((a, b) => b[1] - a[1]).map(([kk, v]) => kk + ' ' + (100 * v / tot).toFixed(1) + '%').join(' ‖ '));
  }
  /* 配对差（同 (环境,局) 键 ⇒ 逐格相减后再取均值）：只引差，不引绝对值 */
  const base = RES[band].A0;
  console.log('\n> **配对差 vs 关档**（同 (环境,局) 逐格相减取均值 ‖ 单位 pt）：');
  for (const k of ARMWANT.slice(1)) {
    const d = { rail: [], held: [], win: [] };
    for (const key in base) {
      const a = RES[band][k][key], b = base[key];
      if (!a) continue;
      d.rail.push(pct(a.keys[SK.RAILGUN] || 0, a.acts) - pct(b.keys[SK.RAILGUN] || 0, b.acts));
      if (a.beadLive > 0 && b.beadLive > 0) d.held.push(pct(a.beadHeld, a.beadLive) - pct(b.beadHeld, b.beadLive));
      d.win.push((a.wins ? 100 : 0) - (b.wins ? 100 : 0));
    }
    const m = (x) => x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN;
    console.log('> · `' + k + '` 电磁炮出手 ' + (m(d.rail) >= 0 ? '+' : '') + m(d.rail).toFixed(2) + ' ‖ 买得起却不开 ' + (isFinite(m(d.held)) ? (m(d.held) >= 0 ? '+' : '') + m(d.held).toFixed(1) + '（n=' + d.held.length + ' 格）' : '两侧都有珠的格子=0，不可比')
      + ' ‖ 夺冠 ' + (m(d.win) >= 0 ? '+' : '') + m(d.win).toFixed(1));
  }
}
/* ---- 心跳与自检：这一格最容易死在"没对比度"上（§E180 那三个假 0.0% 的同族） ---- */
console.log('\n## 心跳 / 自检');
let bad = [];
for (const band of BANDS) {
  for (const k of ARMWANT) {
    const t = agg(band, k), r = row(t);
    if (t.acts / Math.max(1, t.games) < 6) bad.push('带' + band + ' `' + k + '`：每局出手 ' + (t.acts / t.games).toFixed(1) + ' < 6 ⇒ 桌没跑起来');
    if (!(t.maxEp >= 1)) bad.push('带' + band + ' `' + k + '`：峰值 ep < 1 ⇒ 这一臂全程没钱，转化率链无从谈起（不是"卡在不打"）');
    if (t.beadLive === 0) console.log('  ⚠ 带' + band + ' `' + k + '`：**全程没有一次"手里有电珠"的决策** ⇒ `买不起/不开` 两列对它没有定义（不许读成 0%）');
    /* ⭐ 机械式一致性守卫（这次 NaN bug 的形状）：珠不会凭空出现 —— 有"手里有珠"的决策，却全程既没蓄能、也没打过任何花珠的卡
     *   ⇒ 一定是计数管道断了（对象被当数字相加、键名不匹配之类），当场红，别让整列 0.0% 蒙混过关。 */
    if (t.beadLive > 0 && !(t.keys[SK.CHARGE] > 0) && !(t.keys[SK.RAILGUN] > 0) && !(t.keys[SK.LASER_EYE] > 0)) {
      bad.push('带' + band + ' `' + k + '`：有 ' + t.beadLive + ' 次"手里有珠"的决策，但蓄能/电磁炮/激光眼**一次都没有** ⇒ 珠不可能凭空出现 ⇒ **计数管道坏了**（本守卫专抓把对象当数字相加那类 bug）');
    }
  }
  const px = ARMWANT.includes('E1') ? agg(band, 'E1') : null, a0 = agg(band, 'A0');
  if (px && !(px.beadLive > a0.beadLive)) bad.push('带' + band + '：珠价臂 `E1` 的"有珠决策数"没超过关档（' + px.beadLive + ' vs ' + a0.beadLive + '）⇒ **旋钮没作用到珠上**，本节的转化链读数全部作废');
  /* ⭐ §E193 的**动作价有牙检查**（专抓"静默等效"）：给动作发钱这一枚如果没接进评估，`F*` 就会与它的基座 `R2` **逐格一字相同**。
     ⇒ 判据取最大剂量档 `F8`：花珠卡（电磁炮 + 激光眼）的出手数必须**严格大于** `R2`。
     为什么不是"看夺冠/看有珠"：那些是效应，效应为零既可能是旋钮死了、也可能是真没用；**出手数**只问"接没接上"。 */
  if (ARMWANT.includes('F8') && ARMWANT.includes('R2')) {
    const f8 = agg(band, 'F8'), r2 = agg(band, 'R2');
    const spend = t => (t.keys[SK.RAILGUN] || 0) + (t.keys[SK.LASER_EYE] || 0);
    if (!(spend(f8) > spend(r2))) bad.push('带' + band + '：`F8` 的花珠卡出手 ' + spend(f8) + ' 没有超过基座 `R2` 的 ' + spend(r2)
      + ' ⇒ **动作价那一枚可能根本没接进评估**（§E192 的教训：取不存在的字段不报错，只静默等价）⇒ 先查仪器，不许把这条读成"动作定价无效"');
  }
}
/* ⭐ **逐格相同分组**（§E193 加的，通用于任何新旋钮）：两臂整行一字不差 ⇒ 当场点名，
   读表人必须先回答"这一档是死的，还是真的饱和了"，而不是直接给效应下判语。
   分辨办法（已写进 §E192）：把系数挪回 0 —— 整行回到关档 ⇒ 旋钮是死的；回到别的形状 ⇒ 旋钮活着、只是 argmax 不再移动。 */
for (const band of BANDS) {
  const groups = {};
  for (const k of ARMWANT) {
    const t = agg(band, k), r = row(t);
    const sig = JSON.stringify([r.acts, r.games, r.charge, r.rail, r.laser, r.liveShare, r.broke, r.held, r.win, r.hwin, r.rounds,
      Object.entries(t.keys).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; })]);
    (groups[sig] = groups[sig] || []).push(k);
  }
  for (const sig in groups) if (groups[sig].length > 1) {
    console.log('  ⚠ 带' + band + '：**逐格一字相同**的一组臂 `' + groups[sig].join('` ‖ `') + '` ⇒ 要么这些档在 argmax 上已经锁死（同 §E192 的 `R2≡R6≡R12`），要么其中某枚根本没接上（§E192 的 `firedRailgun` 那类）。**不许据此说"两枚旋钮等价"**。');
  }
}
console.log(bad.length ? '⛔ ' + bad.join('\n⛔ ') : '✔ 桌是活的（每臂每局出手 ≥6）‖ 每臂都到过 ep≥1 ‖ 珠价臂确实比关档更多"手里有珠"（旋钮作用到了珠上）');
console.log('rc=' + (bad.length ? 3 : 0));
if (bad.length) process.exit(3);
