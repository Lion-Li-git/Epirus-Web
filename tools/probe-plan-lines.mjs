#!/usr/bin/env node
/* ===== 计划层 P0~P7 的真实触发率（§E692 · 千问 10-23 夜 · 研究分支）=====
 * 用户 10-23 给的方向（探索线第一条的后半）：
 *   「你这里提到断环其实只是很小的一个情况应对，**杂货铺里各种计划都算得上是可以学习（当然不是必须学习）的长程规划方案**」
 * ⇒ 在讨论"能不能学会"之前，先量清楚**这些计划线在真桌面上各触发多少次**。§E690 那一格（坦克/净化 0/300）已经说明：
 *   "冠军不做 X"有好几种完全不同的病因，混在一起谈就会白花钱去训练。
 *
 * 归因口径（**为什么不改产品加钩子**）：
 *   `js/train/bots.js` 的 `planPick(state,pid,legal)` 每条线各 return 一张牌 + 目标，但**不回报是哪条线**做的决定。
 *   两条路：① 在 `bots.js` 里加一个 `PLAN_LAST` 字段（要动 8 个 return，且给门体新增主语）
 *            ② 在探针侧按"返回的卡"归桶（本文件走的这条：零改动、可复算，代价是有两对歧义，写在下面）
 *   歧义只有一处实质性的：**贴贴 CURSE 既可能是 P4 的"试探入口"也可能是 P4 的"连贴补到 3 手"** —— 两条都属 P4，
 *   所以对"哪条线在跑"这个问题不影响结论；**天火 FIRESTORM = P4 引爆**，与贴贴同属 P4 但分得开。
 *   ⇒ 因此本表按**卡**报数（可核对），并把卡→线的映射印在表头，读者随时能质疑这一格归得对不对。
 *
 * 用法：node tools/probe-plan-lines.mjs [--games=200] [--seed=77000] [--quiet]
 * 只读：不落任何文件。 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['games', 'seed', 'quiet'], 'probe-plan-lines');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? Number(a.slice(k.length + 3)) : d; };
const GAMES = arg('games', 200), SEED0 = arg('seed', 77000);
const QUIET = argv.includes('--quiet');
if (!(GAMES >= 20 && GAMES <= 5000)) { console.error('⛔ --games 要在 20~5000（实测 ' + GAMES + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const K = R.SK;
const PACK = 'js/bundled-champion-3p.js';
const champ = loadChamp(W, PACK);
if (!champ) { console.error('⛔ 冠军包读不出：' + PACK); process.exit(2); }
const params = Float64Array.from(champ);

/* 卡 → 计划线（出处都是 `js/train/bots.js` 的 planPick，行号见下） */
const LINE_OF = {};
LINE_OF[K.RING] = 'P1 聚能环（开环/续环，bots.js:460-468）';
LINE_OF[K.CURSE] = 'P4 贴贴（试探入口 + 连贴补到 3 手，:436-445 ‖ :453-459）';
LINE_OF[K.FIRESTORM] = 'P4 引爆（连贴满 3 手且场上 ≥2 枚才点，:429-435）';
LINE_OF[K.BIG_T] = 'P3 大雷（先收一雷打死的 → 打断攒钱的 → 压领先者，:446-452）';
LINE_OF[K.CANNON] = 'P6 过载炮（按 cannonCount 三相位分花费，:469-475）';
LINE_OF[K.ROD] = 'P2 避雷针（对手蓄能或电珠在手，:476-480）';
LINE_OF[K.MINI_T] = 'P7 断环（对手连环到位就用小雷断，:481-490）';
const LINES = [K.RING, K.CURSE, K.FIRESTORM, K.BIG_T, K.CANNON, K.ROD, K.MINI_T];

/* 包一层记录器：只记**这个座位**的出手，不改选牌逻辑（返回原对象）。 */
function recorder(inner, sink) {
  return function (state, pid, legal) {
    const a = inner(state, pid, legal);
    if (a && a.key) sink[a.key] = (sink[a.key] || 0) + 1;
    return a;
  };
}

/* ===== "可负担但从不被选" 那一层（§E692 的第二问）=====
 *   §E690 量到坦克/净化在合成桌上 0/300 —— 但那要么是"进不了候选表"、要么是"进了不被选"，
 *   两种病因的处方完全不同（前者要练经济、后者要给这一手定价）。这里直接在真自对局里数：
 *     `可负担决策数` = 该卡出现在 `legal` 且 `affordable` 的决策点条数
 *     `被选数`      = 其中真被交出去的次数
 *   ⇒ 选中率 ≈ 0 而可负担数大 ⇒ **不是可达性问题，是那本账不给分**。 */
function affordRecorder(inner, sink, keys) {
  return function (state, pid, legal) {
    for (const k of keys) if (legal.some(function (l) { return l.key === k && l.affordable; })) sink[k] = (sink[k] || 0) + 1;
    const a = inner(state, pid, legal);
    if (a && a.key) sink['__' + a.key] = (sink['__' + a.key] || 0) + 1;
    return a;
  };
}
function runAffordArm(label, n) {
  const aff = {};
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: T.mulberry32(SEED0 + g * 977) }, n);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const base = affordRecorder(T.policyChooserN(params, 0.15, 0.15), aff, LINES);
    const seats = [];
    for (let i = 0; i < n; i++) seats.push(base);   // 同一台记录器：n 个冠军席的决策都汇到一处（本臂不需要按席分）
    Play.autoGameN(st, seats);
  }
  const rows = LINES.map(function (k) {
    const a = aff[k] || 0, picked = aff['__' + k] || 0;
    return { k: k, name: (R.byKey[k] || {}).name, aff: a, picked: picked, rate: a ? picked / a : null };
  });
  return { label: label, n: n, rows: rows };
}

function runArm(label, kitSeats, n) {
  /* 两类座位分开记：kitSink = 杂货铺席 ‖ champSink = 冠军席。**第一版这里把冠军席的 sink 写成了一个新的 {} 就地丢掉**
   *   ⇒ 臂 D（0 席杂货铺）整行 0.00，看着像"冠军从不出这些牌"，其实"根本没记"。
   *   加两列总出手数当地板：`出手/局 = 0` 才是真没跑，`出手/局 >0 而某卡 =0` 才是"不出这张"。 */
  const kitSink = {}, champSink = {}, gamesWin = { kit: 0, champ: 0, other: 0 };
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: T.mulberry32(SEED0 + g * 977) }, n);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const choosers = [];
    for (let i = 0; i < n; i++) {
      const isKit = i < kitSeats;
      choosers.push(recorder(isKit ? B.pickToolKit : T.policyChooserN(params, 0.15, 0.15), isKit ? kitSink : champSink));
    }
    Play.autoGameN(st, choosers);
    if (st.winner === 'draw' || st.winner == null) gamesWin.other++;
    else if (st.winner < kitSeats) gamesWin.kit++;
    else gamesWin.champ++;
  }
  const per = function (sink, key) { return ((sink[key] || 0) / GAMES).toFixed(2); };
  const total = function (sink) {
    let t = 0; for (const k of Object.keys(sink)) t += sink[k];
    return (t / GAMES).toFixed(1);
  };
  return { label: label, kitSeats: kitSeats, n: n, kitSink: kitSink, champSink: champSink,
    kitRows: LINES.map(function (k) { return per(kitSink, k); }),
    champRows: LINES.map(function (k) { return per(champSink, k); }),
    kitTotal: total(kitSink), champTotal: total(champSink), win: gamesWin };
}

console.log('== 计划层触发率（§E692）· ' + GAMES + ' 局/臂 ‖ seed0=' + SEED0 + ' ‖ 桌型 multi（3 血）· n=5 ==');
console.log('   卡→线映射（读法：本表按**卡**计数，线名只是标签；唯一实质歧义 = CURSE 同属 P4 的两条入口，见文件头）');
for (const k of LINES) console.log('     ' + ((R.byKey[k] || {}).name + ' [' + k + ']').padEnd(16) + LINE_OF[k]);

const ARMS = [
  function () { return runArm('A 5 席杂货铺（镜像）', 5, 5); },
  function () { return runArm('B 4 席杂货铺 + 1 席冠军', 4, 5); },
  function () { return runArm('C 1 席杂货铺 + 4 席冠军', 1, 5); },
  function () { return runArm('D 5 席冠军（镜像）', 0, 5); },
];
const out = ARMS.map(function (f) { return f(); });

const pad = function (s, w) { return String(s).padStart(w); };
console.log('\n   ── 杂货铺席每局出手次数（按卡）──');
console.log('   臂                            ' + LINES.map(function (k) { return ((R.byKey[k] || {}).name).padStart(8); }).join('') + '   合计出手/局  夺冠%');
for (const r of out) {
  if (!r.kitSeats) { console.log('   ' + r.label.padEnd(32, ' ') + '        —（本臂 0 席杂货铺）'.padStart(48) + '   ' + pad(r.kitTotal, 8) + ' ' + pad((100 * r.win.kit / GAMES).toFixed(1) + '%', 9)); continue; }
  console.log('   ' + r.label.padEnd(32, ' ') + r.kitRows.map(function (x) { return pad(x, 8); }).join('') +
    '   ' + pad(r.kitTotal, 8) + ' ' + pad((100 * r.win.kit / GAMES).toFixed(1) + '%', 9));
}
console.log('\n   ── 冠军席每局出手次数（按同一批卡）──');
console.log('   臂                            ' + LINES.map(function (k) { return ((R.byKey[k] || {}).name).padStart(8); }).join('') + '   合计出手/局  夺冠%');
for (const r of out) {
  if (r.kitSeats >= r.n) { console.log('   ' + r.label.padEnd(32, ' ') + '        —（本臂 0 席冠军）'.padStart(48) + '   ' + pad(r.champTotal, 8) + ' ' + pad((100 * r.win.champ / GAMES).toFixed(1) + '%', 9)); continue; }
  console.log('   ' + r.label.padEnd(32, ' ') + r.champRows.map(function (x) { return pad(x, 8); }).join('') +
    '   ' + pad(r.champTotal, 8) + ' ' + pad((100 * r.win.champ / GAMES).toFixed(1) + '%', 9));
}
/* 第二问：可负担 vs 被选（同一把尺、同一批种子，只是把"进了候选表但没被选"这一步显式化） */
const aff5 = runAffordArm('冠军镜像 n=5', 5);
console.log('\n   ── ' + aff5.label + '：每张计划线卡的"可负担决策数 → 被选数"（' + GAMES + ' 局合计）──');
console.log('   卡            可负担决策    被选    选中率      ⇒ 病因');
for (const r of aff5.rows) {
  const diag = !r.aff ? '候选表里从来没出现过 ⇒ 先查可负担性（钱/珠/时机）'
    : (r.rate < 0.005 ? '**可负担、在候选里、从不被选** ⇒ 是"那本账不给分"，不是可达性'
      : (r.rate < 0.1 ? '偶尔选 ⇒ 边际给分不足' : '常态会选 ⇒ 这一维不用补'));
  console.log('   ' + pad(r.name, 8) + ' ' + pad(r.aff, 10) + ' ' + pad(r.picked, 8) + ' ' + pad(r.rate == null ? '—' : (100 * r.rate).toFixed(2) + '%', 9) + '   ' + diag);
}
if (!QUIET) {
  console.log('\n   每格 = 该卡**每局被出的次数**，分两侧各报一次（杂货铺席 ‖ 冠军席）；`合计出手/局` 是地板：');
  console.log('     合计=0 才是"这一臂没跑/没记"，合计>0 而某卡=0.00 才是"这一侧不出这张牌"（第一版我就把冠军侧的计数器丢了，');
  console.log('     于是臂 D 整行 0.00 看着像"冠军从不出这些牌"——那其实是没记，见文件头第二段的自纠）。');
  console.log('   读法：① 看冠军那一侧——七条计划线的卡它出不出，决定要谈的是"训练"还是"可达性"；');
  console.log('   ② 臂 A 与臂 C 的差 = 杂货铺在有强对手时还打不打得出计划（打不出来 = 被经济挤掉，不是被逻辑改掉）；');
  console.log('   ③ 夺冠% 只说"这一臂谁赢"，不分辨是哪条线挣的 ⇒ 要分辨必须做**逐线消融**（下一步）。');
}
