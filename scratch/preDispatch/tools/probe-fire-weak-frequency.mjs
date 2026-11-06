#!/usr/bin/env node
/* ===== 环境适应的**分母普查**（§E698 火弱 ‖ §E701 破盾 / 净化 · 千问 10-23 夜 · 研究分支）=====
 * 用户 10-23 的第二条探索线里给了三张具体的处方：
 *   「藤甲集火（可以在训练时随机给角色上火训练是否会使用坦克等火焰伤害集火），被贴火弱的角色是否使用净化或各种防御技能」
 *   「显性的除了全息屏障，还有激光眼破盾」
 * ⇒ 在造任何训练旋钮**之前**必须先回答一件更便宜的事：**这一格在真桌面上出现几次**。
 *   §E690 已经量过"把这一格摆出来它翻不翻"（合成桌），它不回答"值不值得为这一格去动 `evo.js` / `policy.js`"。
 *   而 §E695/§E696 刚付过一次学费：一个 800~1200 局里**计数为 0** 的格子，任何"训练会不会学会"的实验都没有判语权。
 *
 * 这台尺量的就是分母，逐决策点采样（不只看事件，因为"该出手那一刻有没有这一格"才是分母）：
 *   ① = 该决策点上**那一格摆出来了**（三格各自的定义见 `CELL_SPEC`）
 *   ② = 我此刻买得起"那一张/那一族牌"；另有一列 `listed` = 这张牌**出现在合法表里**（不管买不买得起）
 *        ⇒ 两条分开是因为 `play.js:16-23` 把"条件不满足"直接从合法表里 `continue` 掉了：
 *          激光眼/电磁炮缺珠时**根本不在表上**（`state.js:150-158`），所以 ② 里含珠子门；`listed` 才看得见珠子那一门卡掉多少。
 *   ③ = ①∩② ⇒ 这一刻真能做用户说的那个决定（分子的分母）
 *   ④ = 其中真交出那些牌 ⇒ 与 §E692 的"可负担 → 被选"同一口径
 * 另有一列**来源普查**（§E690 的教训 ⑥）：没有来源时 ① 的 0 是**这套桌子的性质**，不是"这一格罕见"。
 *
 * 三格各自"①"的定义（都是**决策时刻可读**的，不偷看未决状态）：
 *   `--cell=fireweak` 至少一个活对手 `fireWeakNow`（`resolve.js:311` 的 +1 只挂在 Now 上）；来源 = 藤甲（`resolve.js:1154` 唯一写手）
 *   `--cell=guard`    至少一个活对手**此刻真的挂着盾**：`state.actions[q]` 未作废且属 `GUARD_FAMILY`（`rules.js:106`），
 *                     全息按 `resolve.js:190/290-298` 记到**被作用者**头上而不是施放者，另收 `copiedGuard`（N14 镜面复制）与
 *                     `baguaExtra`（R21 无极变速第二回合）两个"无行动槽的盾"。
 *                     ⚠ 同时印一列**代理信号** `lastSkill ∈ GUARD_FAMILY`：`lastSkill` 到下一手才被覆盖（`resolve.js:1279`），
 *                       而 `state.actions[]` 每回合开局清空（`resolve.js:154`）⇒ 代理会把**上一轮的盾**也算进来（虚高），
 *                       这一列存在的意义就是量"虚高多少"，因为 `policy.js` 的特征面能看见的只有代理那一维。
 *   `--cell=purify`   我自己身上挂着可清的负面（符咒 / 火弱 / 梦魇 / 挑衅义务 / 禁用 / 埋雷，逐项分开印）；来源 = 贴贴（`resolve.js:1082` 写符咒）
 *
 * 用法：node tools/probe-fire-weak-frequency.mjs [--cell=fireweak|guard|purify] [--games=200] [--n=5] [--mode=multi] [--arm=kit|champ|mix] [--seed=77000] [--quiet]
 *   `--mode=` 是 §E701b 补的**桌形把手**（`multi`/`multi4`(4 血)/`long`(5 血)）：§E701 三格只在 `multi · n=5` 一具桌子上量过，
 *   而"人数 × 血量"是用户 10-23 点名的另一条轴 ⇒ 同一格在别的桌子上分母可能完全不同（§E699 已证"反应率一半量的是桌子"）。
 *   ⚑ **默认档（不带 `--mode`）的输出逐字不变**：只有非 `multi` 才多印一段"‖ 模式=…"，这样 §E698/§E701 的在册数字仍然可以直接 `diff` 复算。
 * 只读：不落任何文件。 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['games', 'n', 'arm', 'seed', 'quiet', 'cell', 'mode'], 'probe-fire-weak-frequency');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 200)), N = Number(arg('n', 5)), SEED0 = Number(arg('seed', 77000));
const ARM = arg('arm', 'mix');
const CELL = arg('cell', 'fireweak');
const MODE = arg('mode', 'multi');
const QUIET = argv.includes('--quiet');
if (!(GAMES >= 20 && GAMES <= 5000)) { console.error('⛔ --games 要在 20~5000（实测 ' + GAMES + '）'); process.exit(2); }
if (['kit', 'champ', 'mix'].indexOf(ARM) < 0) { console.error('⛔ --arm 只认 kit|champ|mix（实测 ' + ARM + '）'); process.exit(2); }
const CELLS = ['fireweak', 'guard', 'purify'];
if (CELLS.indexOf(CELL) < 0) { console.error('⛔ --cell 只认 ' + CELLS.join('|') + '（实测 ' + CELL + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const K = R.SK, GUARD = R.GUARD_FAMILY;
if (!R.MODES[MODE]) { console.error('⛔ --mode 不是在册模式（' + Object.keys(R.MODES).join('|') + '），实测 ' + MODE + '）'); process.exit(2); }
const PACK = 'js/bundled-champion-3p.js';
const champ = loadChamp(W, PACK);
if (!champ || champ.length !== W.EpirusPolicy.paramCount()) { console.error('⛔ 包读不出/维度不符：' + PACK); process.exit(2); }
const params = Float64Array.from(champ);

/* ---------- 三格的定义（① 的谓词 ‖ ②④ 要的牌 ‖ 来源普查）---------- */
/* 能"选"的火焰牌（`dmg.type === FIRE` 的只有坦克；天火的伤害在 resolve:1111 里显式打 FIRE） */
const FIRE_CARDS = [K.TANK, K.FIRESTORM];
const FIRE_VIA = { tank: '坦克', firestorm: '天火', focusCannon: '聚光炮', hop: '反复横跳' };
const ARMOR_SRC = K.ARMOR;   // 藤甲 = 火弱的唯一写手（`resolve.js:1154`）
/* 破防牌**从表里现读**，不写死卡名：`pierce.defense` 那三张（坦克/狙击/电磁炮）+ 激光眼。
 * 激光眼没有静态旗标——它的破防写在 `resolve.js:1053-1063`（无效化目标任意防御类/转移，否则打 1 光伤）。
 * ⚠ 反面对照：小雷/大雷**不算**破防牌（`rules.js:70-71` 明写"防御/反弹/原型制御豁免"⇒ 对挂盾的目标无效）。 */
const PIERCE_DEF = R.skills.filter(function (s) { return s.pierce && s.pierce.defense; }).map(function (s) { return s.key; });
const BREAK_CARDS = [K.LASER_EYE].concat(PIERCE_DEF);
const PURIFY_CARDS = [K.PURIFY];
const CURSE_SRC = K.CURSE;    // 贴贴 = 符咒的写手（`resolve.js:1082`）

function liveAction(state, q) { const a = state.actions[q]; return (a && !a.voided) ? a : null; }   // 与 `resolve.js:15-18` 同口径
/* 盾的**来源分解**（不返回布尔）：这样"① 那一格是从哪一支来的"是读数而不是推理。
 * ⚑ 前提：`Play.autoGameN`（`play.js:56-73`）是**先全员选靶、再统一结算**⇒ 本回合才产生的行动槽在决策时刻恒空，
 *   所以"本回合行动槽"那一支结构性为 0（在册：`policy.js:434-446` v1.5.116 那次"死特征" ‖ DIM-V8-LANDING §32-33）。
 *   决策时刻真能看见的只有 **R21 无极延续**（`resolve.js:157` 在 startTurn 把 `guardNext` 兑成 `baguaExtra`）。 */
function shieldKindsOf(state, q) {
  const out = [];
  const p = state.p[q];
  const a = liveAction(state, q);
  if (a && GUARD.indexOf(a.key) >= 0 && a.key !== K.HOLO) out.push('本回合行动槽');
  if (p.copiedGuard) out.push('镜面复制的架势');
  if (p.baguaExtra) out.push('无极延续(R21)');
  for (let i = 0; i < state.p.length; i++) {
    const h = liveAction(state, i);
    if (h && h.key === K.HOLO && h.target === q) out.push('全息作用于他');
  }
  return out;
}
function burdenOf(p) {
  const ban = Object.keys(p.cooldown || {}).filter(function (k) { return (p.cooldown[k] || 0) > 0; }).length;
  return { 符咒: p.stickers.length, 火弱: p.fireWeakNow ? 1 : 0, 梦魇: p.nightmare ? 1 : 0,
    挑衅: p.tauntActive ? 1 : 0, 禁用: ban, 埋雷: p.mineArmed ? 1 : 0 };
}
const CELL_SPEC = {
  fireweak: {
    title: '"火弱该不该学"的分母普查（§E698）',
    kinds: function (state, pid) {
      let n = 0;
      for (let q = 0; q < state.p.length; q++) {
        if (q === pid) continue;
        const o = state.p[q];
        if (o && o.hp > 0 && o.fireWeakNow) n++;
      }
      return { '对手挂火弱': n };
    },
    sigLabel: '有活对手挂火弱', cards: FIRE_CARDS, cardLabel: '火焰牌',
    affLabel: '买得起火焰牌(坦克/天火)', srcKey: ARMOR_SRC, srcLabel: '藤甲', srcName: '藤甲'
  },
  guard: {
    title: '"激光眼破盾"这一格的分母普查（§E701）',
    kinds: function (state, pid) {
      const m = {};
      for (let q = 0; q < state.p.length; q++) {
        if (q === pid) continue;
        const o = state.p[q];
        if (!o || o.hp <= 0) continue;
        for (const k of shieldKindsOf(state, q)) m[k] = (m[k] || 0) + 1;
      }
      return m;
    },
    /* 代理信号：决策时刻特征面**实际看得见**的那一维（`policy.js` 只有 lastSkill，没有"当前架势"） */
    proxy: function (state, pid) {
      for (let q = 0; q < state.p.length; q++) {
        if (q === pid) continue;
        const o = state.p[q];
        if (o && o.hp > 0 && GUARD.indexOf(o.lastSkill) >= 0) return true;
      }
      return false;
    },
    proxyLabel: '代理信号：有活对手 lastSkill∈防御族（但那一盾**上一回合末已随行动槽清空**）',
    sigLabel: '有活对手**决策时刻可见的现役盾**',
    caveat: '⚑ 结构性前提：引擎**先全员选靶、再统一结算**（`play.js:56-73`）⇒ "他这一轮挂不挂盾"在选择时点**还不存在**；' +
      '决策时刻可见的只有 R21 无极延续（`resolve.js:157`）与镜面复制。所以"破盾"作为条件句只能被建模成**预判**（上一手是防御 = 一个倾向先验），不是"看见盾再打盾"。',
    cards: BREAK_CARDS, cardLabel: '破防牌',
    affLabel: '买得起破防牌(激光眼+' + PIERCE_DEF.map(function (k) { return R.byKey[k].name; }).join('/') + ')',
    srcKey: null, srcKeys: GUARD, srcLabel: '防御族', srcName: '防御族', bead: true
  },
  purify: {
    title: '"被贴/挂了负面会不会净化"这一格的分母普查（§E701）',
    kinds: function (state, pid) { return burdenOf(state.p[pid]); },
    sigLabel: '我自己身上有可清的负面', cards: PURIFY_CARDS, cardLabel: '净化',
    affLabel: '买得起净化', srcKey: CURSE_SRC, srcLabel: '贴贴', srcName: '贴贴'
  }
};
const SPEC = CELL_SPEC[CELL];

const stat = { games: 0, sides: {} };
/* 分侧各数一份（**两侧都是同一套判据**，只是"谁在看"不同；把它们混进一列就分不出"脚本不学"与"冠军不学"） */
const sideOf = function (i) {
  if (ARM === 'kit') return '脚本(杂货铺)';
  if (ARM === 'champ') return '冠军';
  return (i % 2 === 0) ? '冠军' : '脚本(杂货铺)';
};
const blank = function () {
  return { dec: 0, sig: 0, both: 0, bothPicked: 0, aff: 0, listed: 0, picked: 0, srcDecisions: 0, proxy: 0, proxyAndSig: 0, kinds: {}, cardStat: {}, elecOn: 0, boomOn: 0 };
};
/* 逐张那一栏**先把 0 铺好**（否则"激光眼从没出现"与"这栏没数"同形 —— §E698 那条"空集与零违规同形"的老病） */
const S_ = function (nm) {
  if (!stat.sides[nm]) {
    const s = blank();
    SPEC.cards.forEach(function (k) {
      s.cardStat[R.byKey[k] ? R.byKey[k].name : k] = { listed: 0, aff: 0, picked: 0, inBoth: 0, bothPicked: 0 };
    });
    stat.sides[nm] = s;
  }
  return stat.sides[nm];
};
function runGame(g) {
  const st = S.createState(MODE, { next: T.mulberry32(SEED0 + g * 977) }, N);
  st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
  const choosers = [];
  for (let i = 0; i < N; i++) {
    const isKit = ARM === 'kit' || (ARM === 'mix' && i % 2 === 1);
    const inner = isKit ? B.pickToolKit : T.policyChooserN(params, 0.15, 0.15);
    const nm = sideOf(i);
    const wrapped = function (state, pid, legal) {
      const act = inner(state, pid, legal);
      const key = (typeof act === 'string') ? act : (act && act.key);
      const listed = legal.some(function (l) { return SPEC.cards.indexOf(l.key) >= 0; });
      const aff = legal.some(function (l) { return SPEC.cards.indexOf(l.key) >= 0 && l.affordable; });
      const s = S_(nm);
      s.dec++;
      if (SPEC.bead) { const me = state.p[pid]; if (me.elec > 0) s.elecOn++; if (me.boom > 0) s.boomOn++; }
      const kb = SPEC.kinds(state, pid);
      let hit = false;
      for (const kk in kb) { if (kb[kk] > 0) { hit = true; s.kinds[kk] = (s.kinds[kk] || 0) + kb[kk]; } }
      if (hit) s.sig++;
      if (SPEC.proxy && SPEC.proxy(state, pid)) { s.proxy++; if (hit) s.proxyAndSig++; }
      if (listed) s.listed++;
      if (aff) s.aff++;
      if (hit && aff) { s.both++; if (SPEC.cards.indexOf(key) >= 0) s.bothPicked++; }
      if (SPEC.cards.indexOf(key) >= 0) s.picked++;
      /* 逐张各数一份 ⇒ "② 里那扇门卡在哪一张牌上"看得见（并集会把 always-listed 的坦克/狙击盖掉，激光眼的爆珠门就消失了） */
      for (const l of legal) {
        if (SPEC.cards.indexOf(l.key) < 0) continue;
        const cn = R.byKey[l.key] ? R.byKey[l.key].name : l.key;
        const c = s.cardStat[cn] || (s.cardStat[cn] = { listed: 0, aff: 0, picked: 0, inBoth: 0, bothPicked: 0 });
        c.listed++;
        if (l.affordable) {
          c.aff++;
          if (hit) c.inBoth++;
          if (l.key === key) { c.picked++; if (hit) c.bothPicked++; }
        }
      }
      if (SPEC.srcKey ? key === SPEC.srcKey : ((SPEC.srcKeys || []).indexOf(key) >= 0)) s.srcDecisions++;
      return act;
    };
    choosers.push(wrapped);
  }
  Play.autoGameN(st, choosers);
  for (const e of st.events) {
    if (CELL === 'fireweak' && e.type === 'damage' && FIRE_VIA[e.via]) {
      stat.via = stat.via || {}; stat.via[e.via] = (stat.via[e.via] || 0) + 1;
    }
    if (e.type === 'action' && e.outcome === 'ok') {
      const isSrc = SPEC.srcKey ? e.key === SPEC.srcKey : ((SPEC.srcKeys || []).indexOf(e.key) >= 0);
      if (isSrc) {
        stat.srcPlayedBy = stat.srcPlayedBy || {};
        const ak = '席' + e.pid + '(' + sideOf(e.pid) + ')';
        stat.srcPlayedBy[ak] = (stat.srcPlayedBy[ak] || 0) + 1;
        stat.srcKeys = stat.srcKeys || {};
        const kn = R.byKey[e.key] ? R.byKey[e.key].name : e.key;
        stat.srcKeys[kn] = (stat.srcKeys[kn] || 0) + 1;
      }
    }
  }
  stat.games++;
}
for (let g = 0; g < GAMES; g++) runGame(g);

const pct = function (a, b) { return b ? (100 * a / b).toFixed(2) + '%' : '—'; };
console.log('== ' + SPEC.title + '· ' + GAMES + ' 局 ‖ n=' + N + ' ‖ 装配=' + ARM +
  '（' + (ARM === 'kit' ? '全脚本' : ARM === 'champ' ? '全冠军' : '偶数席冠军 / 奇数席杂货铺') + '）‖ seed0=' + SEED0 +
  (MODE === 'multi' ? '' : ' ‖ 模式=' + MODE + '（血 ' + R.MODES[MODE].hp + '）') + ' ==');
if (SPEC.caveat) console.log('\n   ' + SPEC.caveat);
const sides = Object.keys(stat.sides);
let totBoth = 0, totDec = 0, totSrc = 0, totSig = 0, totProxy = 0;
for (const nm of sides) {
  const s = stat.sides[nm];
  totBoth += s.both; totDec += s.dec; totSrc += s.srcDecisions; totSig += s.sig; totProxy += s.proxy;
  console.log('\n  ── 受评侧：' + nm + ' ──');
  console.log('   决策点 ' + s.dec + '   ① ' + SPEC.sigLabel + ' = ' + s.sig + ' (' + pct(s.sig, s.dec) + ' ‖ 每局 ' + (s.sig / GAMES).toFixed(2) + ')');
  if (SPEC.proxy) {
    console.log('   ①′ ' + SPEC.proxyLabel + ' = ' + s.proxy + ' (' + pct(s.proxy, s.dec) + ')');
    console.log('      代理命中时**真值也成立** = ' + s.proxyAndSig + ' (' + pct(s.proxyAndSig, s.proxy) + ' ⇒ 这就是那一维当触发器的精确率)');
  }
  console.log('   ① 的构成（按**对手/项**累加，一个决策点里可多名多项并存）= ' + JSON.stringify(s.kinds));
  console.log('   ② ' + SPEC.affLabel + ' = ' + s.aff + ' (' + pct(s.aff, s.dec) + ') ‖ 卡出现在合法表里 = ' + s.listed + ' (' + pct(s.listed, s.dec) + ')');
  const cn = Object.keys(s.cardStat).sort(function (a, b) { return s.cardStat[b].listed - s.cardStat[a].listed; });
  if (cn.length) {
    console.log('   逐张（在表/买得起/真出手 ‖ ①成立时的机会/交出）= ' +
      cn.map(function (k) { const c = s.cardStat[k]; return k + ' ' + c.listed + '/' + c.aff + '/' + c.picked + ' ‖ ' + c.inBoth + '/' + c.bothPicked; }).join(' ‖ '));
  }
  if (SPEC.bead) {
    console.log('   决策时我身上有珠：电珠 ' + s.elecOn + ' (' + pct(s.elecOn, s.dec) + ') ‖ 爆珠 ' + s.boomOn + ' (' + pct(s.boomOn, s.dec) + ')' +
      ' ⇒ 激光眼**首次**必须带 1 枚爆珠（`state.js:150-153`），所以 ② 里那一张的天花板就是这个数');
  }
  console.log('   ③ **两者同时**（这一格真能做决定）= ' + s.both + '  每局 ' + (s.both / GAMES).toFixed(3) + ' 次');
  console.log('   ④ 其中真交出' + SPEC.cardLabel + ' = ' + s.bothPicked + ' (' + pct(s.bothPicked, s.both) + ' of ③) ‖ ' + SPEC.cardLabel + '总出手 ' + s.picked + ' (局均 ' + (s.picked / GAMES).toFixed(2) + ')');
  console.log('   ' + SPEC.srcLabel + '由这一侧打出的次数 = ' + s.srcDecisions);
}
console.log('\n   ' + SPEC.srcLabel + '是谁打的（来源普查）              = ' + JSON.stringify(stat.srcPlayedBy || {}));
if (stat.srcKeys) console.log('   来源按卡名分                       = ' + JSON.stringify(stat.srcKeys));
if (CELL === 'fireweak') console.log('   火焰伤害来源（按 `via` 数事件，全场）  = ' + JSON.stringify(stat.via || {}));
const noSource = !Object.keys(stat.srcPlayedBy || {}).length;
const verdict = totBoth === 0
  ? (noSource
    ? '⚠ **这一格在本装配里不存在**（桌上没人打' + SPEC.srcName + ' ⇒ 没有来源）⇒ 训练旋钮现在**没有分母**，先造来源再谈"会不会学"'
    : '⛔ 有' + SPEC.srcName + '来源却一次也没形成"那一格摆出来 + 我买得起"⇒ 要查时机（盾/负面只活一回合，`resolve.js:154/170`）')
  : (totBoth / GAMES < 0.5
    ? '⚠ 这一格每局不到 0.5 次 ⇒ 做"训练会不会学会"必须先把剂量算清楚：要凑 ~100 次机会需要 **~' +
      Math.ceil(100 / Math.max(1e-9, totBoth / GAMES)) + ' 局训练桌**'
    : '✅ 这一格有分母（每局 ' + (totBoth / GAMES).toFixed(2) + ' 次）⇒ §E690 那个"看得见不伸手"可以进训练侧实验');
console.log('\n   ⇒ ' + verdict);
if (totBoth > 0) {
  const totPicked = sides.reduce(function (a, nm) { return a + stat.sides[nm].bothPicked; }, 0);
  console.log('   合计：机会 ③ = ' + totBoth + ' ‖ 其中真交出 = ' + totPicked + ' (' + pct(totPicked, totBoth) + ') ‖ 机会率 = ' + pct(totBoth, totDec) + ' of 决策点');
}
if (!QUIET) {
  console.log('   口径：分母按**决策点**数（不是按事件），因为"该出手那一刻桌上有没有这一格"才是训练能不能学到它的条件；');
  console.log('   ③ 是 ①②的交集，④ 只数 ③ 里真交出这些牌的那些 ⇒ 与 §E692 的"可负担 → 被选"同一条链，只是多了一个"桌上有没有那一格"这一维。');
  console.log('   ⚠ 两侧混在一列就分不出"脚本不学"与"冠军不学"⇒ 本表按侧分开数（换 --arm 各跑一遍可以再看装配的影响）。');
  console.log('   ⚠ ② 含"珠子门"：激光眼缺爆珠、电磁炮缺电珠时**根本不在合法表里**（`state.js:150-158`）⇒ 想知道卡掉在哪一门，看 `卡出现在合法表里` 那一列。');
}
