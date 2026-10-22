#!/usr/bin/env node
/* ===== "火弱该不该学"这一格的**分母普查**（§E698 · 千问 10-23 夜 · 研究分支）=====
 * 用户 10-23 的第二条探索线里有一句具体的处方：
 *   「藤甲集火（可以在训练时随机给角色上火训练是否会使用坦克等火焰伤害集火），被贴火弱的角色是否使用净化或各种防御技能也是一种环境适应」
 * ⇒ 在造那个训练旋钮**之前**必须先回答一件更便宜的事：**这一格在真桌面上出现几次**。
 *   §E690 已经量过"把这一格摆出来它翻不翻"（三臂 + 三条自证全过，方向 = +0.0pt，坦克/净化 0/300 而牌买得起）；
 *   那一台是**合成桌**，它不回答"值不值得为这一格去动 `evo.js`"。
 *   而 §E695/§E696 刚付过一次学费：一个 800~1200 局里**计数为 0** 的格子，任何"训练会不会学会"的实验都没有判语权。
 *
 * 这台尺量的就是分母，逐决策点采样（不只看事件，因为"该出手那一刻有没有这一格"才是分母）：
 *   `opp火弱`   = 该决策点上有至少一个**活着的**对手 `fireWeakNow` 为真（`resolve.js:311` 的 +1 只在 Now 上生效）
 *   `火焰牌可买` = 我此刻买得起 坦克 或 天火（仓里 `DMG.FIRE` 的两张主动牌；`聚光炮/反复横跳` 是别的牌触发的 firelight，不能"选"，只进来源普查）
 *   `两者同时`   = 这一格**真的可以做出用户说的那个决定**（分子的分母）
 *   `实际出手`   = 其中真交出火焰牌多少次 ⇒ 与 §E692 的"可负担 → 被选"同一口径
 * 另有一列**来源普查**（§E690 的教训 ⑥）：火弱是由**藤甲**贴上去的（`resolve.js:1154`），所以必须同时数"这一桌有几个人会打藤甲、打了几次"——
 *   装配里根本没有藤甲来源时，`opp火弱 = 0` 是**这套桌子的性质**，不是"这一格罕见"。
 *
 * 用法：node tools/probe-fire-weak-frequency.mjs [--games=200] [--n=5] [--arm=kit|champ|mix] [--seed=77000] [--quiet]
 * 只读：不落任何文件。 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['games', 'n', 'arm', 'seed', 'quiet'], 'probe-fire-weak-frequency');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 200)), N = Number(arg('n', 5)), SEED0 = Number(arg('seed', 77000));
const ARM = arg('arm', 'mix');
const QUIET = argv.includes('--quiet');
if (!(GAMES >= 20 && GAMES <= 5000)) { console.error('⛔ --games 要在 20~5000（实测 ' + GAMES + '）'); process.exit(2); }
if (['kit', 'champ', 'mix'].indexOf(ARM) < 0) { console.error('⛔ --arm 只认 kit|champ|mix（实测 ' + ARM + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const K = R.SK;
const PACK = 'js/bundled-champion-3p.js';
const champ = loadChamp(W, PACK);
if (!champ || champ.length !== W.EpirusPolicy.paramCount()) { console.error('⛔ 包读不出/维度不符：' + PACK); process.exit(2); }
const params = Float64Array.from(champ);
/* 能"选"的火焰牌（`dmg.type === FIRE` 的只有坦克；天火的伤害在 resolve:1111 里显式打 FIRE） */
const FIRE_CARDS = [K.TANK, K.FIRESTORM];
const FIRE_VIA = { tank: '坦克', firestorm: '天火', focusCannon: '聚光炮', hop: '反复横跳' };
const ARMOR_SRC = K.ARMOR;   // 藤甲 = 火弱的唯一写手（`resolve.js:1154`）

const stat = { games: 0, sides: {} };
/* 分侧各数一份（**两侧都是同一套判据**，只是"谁在看"不同；把它们混进一列就分不出"脚本不学"与"冠军不学"） */
const sideOf = function (i) {
  if (ARM === 'kit') return '脚本(杂货铺)';
  if (ARM === 'champ') return '冠军';
  return (i % 2 === 0) ? '冠军' : '脚本(杂货铺)';
};
const blank = function () { return { dec: 0, oppFw: 0, fwAndAff: 0, fwAndPicked: 0, aff: 0, picked: 0, armorDecisions: 0 }; };
const S_ = function (nm) { if (!stat.sides[nm]) stat.sides[nm] = blank(); return stat.sides[nm]; };
function runGame(g) {
  const st = S.createState('multi', { next: T.mulberry32(SEED0 + g * 977) }, N);
  st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
  const choosers = [];
  for (let i = 0; i < N; i++) {
    const isKit = ARM === 'kit' || (ARM === 'mix' && i % 2 === 1);
    const inner = isKit ? B.pickToolKit : T.policyChooserN(params, 0.15, 0.15);
    const nm = sideOf(i);
    const wrapped = function (state, pid, legal) {
      const act = inner(state, pid, legal);
      const key = (typeof act === 'string') ? act : (act && act.key);
      let fw = false;
      for (let q = 0; q < state.p.length; q++) {
        if (q === pid) continue;
        const o = state.p[q];
        if (o && o.hp > 0 && o.fireWeakNow) { fw = true; break; }
      }
      const affFw = legal.some(function (l) { return FIRE_CARDS.indexOf(l.key) >= 0 && l.affordable; });
      const s = S_(nm);
      s.dec++;
      if (fw) s.oppFw++;
      if (affFw) s.aff++;
      if (fw && affFw) { s.fwAndAff++; if (FIRE_CARDS.indexOf(key) >= 0) s.fwAndPicked++; }
      if (FIRE_CARDS.indexOf(key) >= 0) s.picked++;
      if (key === ARMOR_SRC) s.armorDecisions++;
      return act;
    };
    choosers.push(wrapped);
  }
  Play.autoGameN(st, choosers);
  for (const e of st.events) {
    if (e.type === 'damage' && FIRE_VIA[e.via]) stat.via = stat.via || {}, stat.via[e.via] = (stat.via[e.via] || 0) + 1;
    if (e.type === 'action' && e.outcome === 'ok' && e.key === ARMOR_SRC) {
      stat.armorPlayedBy = stat.armorPlayedBy || {};
      const ak = '席' + e.pid + '(' + sideOf(e.pid) + ')';
      stat.armorPlayedBy[ak] = (stat.armorPlayedBy[ak] || 0) + 1;
    }
  }
  stat.games++;
}
for (let g = 0; g < GAMES; g++) runGame(g);

const pct = function (a, b) { return b ? (100 * a / b).toFixed(2) + '%' : '—'; };
console.log('== "火弱该不该学"的分母普查（§E698）· ' + GAMES + ' 局 ‖ n=' + N + ' ‖ 装配=' + ARM +
  '（' + (ARM === 'kit' ? '全脚本' : ARM === 'champ' ? '全冠军' : '偶数席冠军 / 奇数席杂货铺') + '）‖ seed0=' + SEED0 + ' ==');
const sides = Object.keys(stat.sides);
let totFwAff = 0, totDec = 0, totArmor = 0;
for (const nm of sides) {
  const s = stat.sides[nm];
  totFwAff += s.fwAndAff; totDec += s.dec; totArmor += s.armorDecisions;
  console.log('\n  ── 受评侧：' + nm + ' ──');
  console.log('   决策点 ' + s.dec + '   ① 有活对手挂火弱 = ' + s.oppFw + ' (' + pct(s.oppFw, s.dec) + ' ‖ 每局 ' + (s.oppFw / GAMES).toFixed(2) + ')');
  console.log('   ② 买得起火焰牌(坦克/天火) = ' + s.aff + ' (' + pct(s.aff, s.dec) + ')');
  console.log('   ③ **两者同时**（这一格真能做决定）= ' + s.fwAndAff + '  每局 ' + (s.fwAndAff / GAMES).toFixed(3) + ' 次');
  console.log('   ④ 其中真交出火焰牌 = ' + s.fwAndPicked + ' (' + pct(s.fwAndPicked, s.fwAndAff) + ' of ③) ‖ 火焰牌总出手 ' + s.picked + ' (局均 ' + (s.picked / GAMES).toFixed(2) + ')');
  console.log('   藤甲由这一侧打出的次数 = ' + s.armorDecisions);
}
console.log('\n   火焰伤害来源（按 `via` 数事件，全场）  = ' + JSON.stringify(stat.via || {}));
console.log('   藤甲是谁打的（来源普查）              = ' + JSON.stringify(stat.armorPlayedBy || {}));
const noSource = !Object.keys(stat.armorPlayedBy || {}).length;
const verdict = totFwAff === 0
  ? (noSource
    ? '⚠ **这一格在本装配里不存在**（桌上没人打藤甲 ⇒ 没有火弱来源）⇒ 训练旋钮现在**没有分母**，先造来源再谈"会不会学"'
    : '⛔ 有藤甲来源却一次也没形成"对手火弱 + 我有火焰牌"那一格 ⇒ 要查时机（火弱只活一回合，`resolve.js:174`）')
  : (totFwAff / GAMES < 0.5
    ? '⚠ 这一格每局不到 0.5 次 ⇒ 做"训练会不会学会集火"必须先把剂量算清楚：要凑 ~100 次机会需要 **~' +
      Math.ceil(100 / Math.max(1e-9, totFwAff / GAMES)) + ' 局训练桌**'
    : '✅ 这一格有分母（每局 ' + (totFwAff / GAMES).toFixed(2) + ' 次）⇒ §E690 那个"看得见不伸手"可以进训练侧实验');
console.log('\n   ⇒ ' + verdict);
if (!QUIET) {
  console.log('   口径：分母按**决策点**数（不是按事件），因为"该出手那一刻桌上有没有这一格"才是训练能不能学到它的条件；');
  console.log('   ③ 是 ①②的交集，④ 只数 ③ 里真交出火焰牌的那些 ⇒ 与 §E692 的"可负担 → 被选"同一条链，只是多了一个"对手身上有没有火弱"这一维。');
  console.log('   ⚠ 两侧混在一列就分不出"脚本不学"与"冠军不学"⇒ 本表按侧分开数（换 --arm 各跑一遍可以再看装配的影响）。');
}
