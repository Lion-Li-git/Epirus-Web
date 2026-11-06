#!/usr/bin/env node
/* ===== 计划线**可达性普查**（§E696 · 千问 10-23 夜 · 研究分支）=====
 * 承接 §E695：那台消融尺在四个起点（800~1200 局/臂）里给 P2 避雷针 / P4a 天火引爆 / P7 断环 的**按住计数都是 0**。
 *   "计数 0"有三种完全不同的成因，而它们在读数上同形（同一族见 §E681/§E692/[[feedback-subcell-control]] ②⑥）：
 *     ① **我的构造漏了条件**（这一格根本没造出来 ⇒ 这台尺对它没有判语权）；
 *     ② **被同一具局面上的另一条线遮蔽**（次序问题：`planPick` 是一条固定优先梯子，上游一支把钱/时机花掉了）；
 *     ③ **结构上可达、但真桌的分布不把它推到那一格**（⇒ 要买的是"对手构成/经济剂量"，不是"改逻辑"）。
 *   分不清就会开错药：②被当成③会白跑一批实验，①被当成②会把"我没造出来"写成世界的结论。
 *
 * 做法 = **一手一手地构造**：给每条线写一具"我认为该判据全部成立"的最小局面（5 席 · 第 9 回合 · 血量人人相同以免踩到血比较那一维），
 *   同一颗种子**铺两遍**（一遍开着线 ‖ 一遍把这条线按住），要求：
 *     ON  那一遍交出这张卡 ⇒ 这一格真能出手（③ 或至少不是①）；
 *     ON  那一遍交出**另一条计划线的卡** ⇒ ②（遮蔽，且当场印出是谁抢的）；
 *     ON  那一遍落到地板/非计划卡 ⇒ ①（我漏了条件）⇒ 这台尺对它**作废**，`exit 5` 点名；
 *     OFF 那一遍的 `countPlanOff()` 合计必须 == ON 的出手次数 ⇒ 计数与出手咬合（不咬合就是接线错）。
 *   ⚠ 两遍必须各自新建状态：`rnd(state)` 消耗 `state.rng`，同一对象连调两次第二遍看到的是错位后的随机数。
 *   ⚠ 概率门（`rnd<0.5/0.6/0.7`）不是失败：那一档出手率应≈门值（再乘以上游门的补数），读数里把门值一起印出来当证据。
 *
 * 用法：node tools/probe-plan-reach.mjs [--trials=200] [--seed=77000] [--lines=P2,P4a,P7] [--quiet]
 * 只读：不落任何文件。 */
import { sandbox, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['trials', 'seed', 'lines', 'quiet'], 'probe-plan-reach');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const TRIALS = Number(arg('trials', 200)), SEED0 = Number(arg('seed', 77000));
const QUIET = argv.includes('--quiet');
if (!(TRIALS >= 20 && TRIALS <= 5000)) { console.error('⛔ --trials 要在 20~5000（实测 ' + TRIALS + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const K = R.SK;
if (typeof B.setPlanOff !== 'function' || typeof B.countPlanOff !== 'function') {
  console.error('⛔ 消融旋钮没导出（`EpirusBots.setPlanOff`/`countPlanOff`）⇒ 这台尺没接上'); process.exit(3);
}
const act = function (pid, key) { return { type: 'action', outcome: 'ok', pid: pid, key: key }; };
/* 卡 → 它属于哪条计划线（用来分"被线抢了"与"落到地板"）。出处 = `bots.js` 的 `planPick` 各支 return 的那张卡，现读：
 *   P4a 天火 ‖ P4b/P4c 贴贴 ‖ P3 大雷 ‖ P1a/P1b 聚能环 ‖ P6 过载炮 ‖ P2 避雷针 ‖ P7 小雷（雷击之枪）。 */
const LINE_CARD = {};
LINE_CARD[K.FIRESTORM] = 'P4a'; LINE_CARD[K.CURSE] = 'P4b/P4c'; LINE_CARD[K.BIG_T] = 'P3';
LINE_CARD[K.RING] = 'P1a/P1b'; LINE_CARD[K.CANNON] = 'P6'; LINE_CARD[K.ROD] = 'P2'; LINE_CARD[K.MINI_T] = 'P7';

/* 一具最小局面：5 席 · **血量所有人一样**（否则 `planHpNotBehind` 那一维会先把我挡掉，那是混淆因素不是结论）。 */
function base5(seed) {
  const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
  st.round = 9;
  for (let i = 0; i < 5; i++) { st.p[i].hp = 3; st.p[i].ep = 0; }
  st.events = [];
  return st;
}
const CASES = [
  { id: 'P2', card: K.ROD, name: '避雷针', gate: 'rnd<0.6（且上游 P4c 的 rnd<0.5 要先不中）',
    why: '雷管 4 珠（`rules.js` byKey.rod.cost=4）+ 至少一个对手 ep≥5 或带雷珠 ⇒ **珠数必须正好 4**：给到 5 就先满足大雷（P3 排在上面）',
    mk: function (s) { s.p[0].ep = 4; s.p[2].ep = 5; } },
  { id: 'P4a', card: K.FIRESTORM, name: '引爆', gate: '（无随机门）',
    why: '连贴满 3 手（ジ 不算打断）+ 场上自己贴的存活符咒 ≥2 枚 + 天火 2 珠买得起',
    mk: function (s) { s.p[0].ep = 4; s.p[1].stickers = [{ owner: 0, age: 1 }]; s.p[2].stickers = [{ owner: 0, age: 2 }];
      s.events = [act(0, K.CURSE), act(0, K.JI), act(0, K.CURSE), act(0, K.JI), act(0, K.CURSE)]; } },
  { id: 'P4b', card: K.CURSE, name: '连贴补一手', gate: '（无随机门）',
    why: '连贴 1~2 手 + 场上已有自己的一枚 + 贴贴 1 珠买得起 + 还有没贴过的人',
    mk: function (s) { s.p[0].ep = 3; s.p[1].stickers = [{ owner: 0, age: 1 }]; s.events = [act(0, K.CURSE)]; } },
  { id: 'P4c', card: K.CURSE, name: '贴（渐进式入口）', gate: 'rnd<0.5',
    why: '没贴过也没引爆 + 场上 0 枚 + 我 ≥4 珠 + 贴贴买得起 ⇒ 珠数取 4（5 就先把大雷那一支点亮）',
    mk: function (s) { s.p[0].ep = 4; } },
  { id: 'P7', card: K.MINI_T, name: '断环', gate: '（无随机门）',
    why: '我 ≥PLAN_BANK(5) 珠 + 小雷 2 珠买得起 + 有对手 ringStreak≥1 —— ⚠ 5 珠**正好是大雷的价** ⇒ 预期这一档会被 P3 遮蔽',
    mk: function (s) { s.p[0].ep = 5; s.p[3].ringStreak = 2; } },
  { id: 'P1a', card: K.RING, name: '开环', gate: 'rnd<0.7',
    why: 'ringStreak=0 + 首次开环 3 珠买得起 + 我血不劣势（所以本尺的血量人人相同）',
    mk: function (s) { s.p[0].ep = 3; } },
  { id: 'P1b', card: K.RING, name: '续环', gate: '（无随机门）',
    why: '1≤ringStreak<5 + 每手免费 + 我 <PLAN_SPEND(20) 珠',
    mk: function (s) { s.p[0].ringStreak = 2; s.p[0].ep = 1; } },
  { id: 'P3', card: K.BIG_T, name: '大雷', gate: '（无随机门）',
    why: '大雷 5 珠买得起 + 有可选目标',
    mk: function (s) { s.p[0].ep = 5; } },
  { id: 'P6', card: K.CANNON, name: '过载炮 phase1', gate: '（无随机门）',
    why: 'cannonCount%3=0 ⇒ phase1 只需"买得起"（`state.js:rawCost` 三相位不同价）⇒ 珠数取 2，免得点亮上游那几支',
    mk: function (s) { s.p[0].ep = 2; s.p[0].cannonCount = 0; } },
];
const want = String(arg('lines', 'P2,P4a,P4b,P4c,P7,P1a,P1b,P3,P6')).split(/[^A-Za-z0-9]+/).filter(Boolean);
const bad = want.filter(function (x) { return !CASES.some(function (c) { return c.id === x; }); });
if (bad.length) { console.error('⛔ 请求的线不在这台尺的案例表里 ⇒ ' + bad.join(',') + '\n   有：' + CASES.map(function (c) { return c.id; }).join(' ‖ ')); process.exit(2); }

const rows = [];
for (const c of CASES.filter(function (x) { return want.indexOf(x.id) >= 0; })) {
  let on = 0, offCount = 0, shadow = {}, floor = {};
  for (let t = 1; t <= TRIALS; t++) {
    const seed = SEED0 + t * 7919;
    B.setPlanOff('');                                  // 显式清空（"不调 setter ≠ 开关是空的"，§E695 A5 那句）
    const s1 = base5(seed); c.mk(s1);
    const a1 = B.pickToolKit(s1, 0, Play.legalActions(s1, 0));
    const k1 = (typeof a1 === 'string') ? a1 : (a1 && a1.key);
    if (k1 === c.card) on++;
    else if (LINE_CARD[k1]) shadow[LINE_CARD[k1]] = (shadow[LINE_CARD[k1]] || 0) + 1;
    else floor[(k1 || 'null') + '(' + ((R.byKey[k1] || {}).name || '?') + ')'] = (floor[(k1 || 'null') + '(' + ((R.byKey[k1] || {}).name || '?') + ')'] || 0) + 1;
    const s2 = base5(seed); c.mk(s2);
    B.setPlanOff(c.id);
    B.pickToolKit(s2, 0, Play.legalActions(s2, 0));
    const cnt = B.countPlanOff();
    /* 合计 = 这一档全部按住的次数（子支计数挂在 `P6a/P4a` 这种**支名**上，所以不能只读 `cnt[c.id]`——
     *   第一版就是这么读的，于是 P6 明明出手 105 次却报"计数 0"，被咬合腿当场判红）。 */
    offCount += Object.keys(cnt).reduce(function (s, k) { return s + cnt[k]; }, 0);
    B.setPlanOff('');
  }
  const fmt = function (o) { return Object.keys(o).sort().map(function (k) { return k + '×' + o[k]; }).join(' ‖ '); };
  rows.push({ c: c, on: on, rate: on / TRIALS, offCount: offCount,
    verdict: on > 0 ? '可达' : (Object.keys(shadow).length ? '遮蔽' : '构造不出'),
    shadow: fmt(shadow), floor: fmt(floor) });
}

console.log('== 计划线可达性普查（§E696）· 每档 ' + TRIALS + ' 颗种子 × 同一具最小局面（5 席 multi · 第 9 回合 · 血量人人 3）==');
console.log('   线    该卡              ON 出手率     OFF 计数   咬合   判语          被谁抢 / 落到哪张非计划卡');
for (const r of rows) {
  const mesh = r.offCount === r.on;
  console.log('   ' + r.c.id.padEnd(5) + (r.c.name + ' [' + (R.byKey[r.c.card] || {}).name + ']').padEnd(18) +
    ((100 * r.rate).toFixed(1) + '%').padStart(8) + String(r.offCount).padStart(9) + '   ' + (mesh ? '✅' : '❌') + '   ' +
    r.verdict.padEnd(10) + '   ' + (r.verdict === '可达' ? '' : (r.shadow || r.floor)));
}
const unmeshed = rows.filter(function (r) { return r.offCount !== r.on; });
const unbuilt = rows.filter(function (r) { return r.verdict === '构造不出'; });
console.log('\n   自证：计数与出手不咬合 = ' + (unmeshed.length ? '**' + unmeshed.map(function (r) { return r.c.id; }).join(',') + '**' : '无') +
  ' ‖ 构造不出（漏条件 ⇒ 这一档**没有判语权**，不许写成"这条线不会出手"）= ' + (unbuilt.length ? '**' + unbuilt.map(function (r) { return r.c.id; }).join(',') + '**' : '无'));
if (!QUIET) {
  console.log('   读法：判语=可达 且出手率≈门值 ⇒ 这一格结构上成立，§E695 真桌里计数为 0 属**成因③（分布没推到那一格）**；');
  console.log('        判语=遮蔽 ⇒ **成因②（次序问题）**：同一具局面上游那一支先满足，钱/时机轮不到它 —— 这不是"这条线坏了"，也不是"分布不够"。');
  console.log('   ⚠ 这具局面是**合成的**：它只回答"判据能不能同时成立、被谁抢先"，不回答"多久成立一次"（后者 = §E695 的按住计数）。');
}
if (unmeshed.length || unbuilt.length) { console.log('   ⇒ 有档不自证成立 ⇒ 退出码 5，这些档的读数一律不引用。'); process.exit(5); }
console.log('   ⇒ 全部档自证成立（咬合 ✅ ‖ 无"构造不出"）⇒ 上面每一行的判语（可达/遮蔽）都可引用。');
