#!/usr/bin/env node
/* ===== 成对反事实 × 火弱（§E690 · 千问 10-23 夜 · 研究分支）=====
 * 用户 10-23 的原话（探索线第二条）：「藤甲集火（可以在训练时随机给角色上火训练是否会使用坦克等火焰伤害集火），
 *   被贴火弱的角色是否使用净化或各种防御技能也是一种环境适应。」
 *
 * 这台尺**不训练**，只回答训练之前那一问：**那格真的出现时，冠军会不会翻向"用火打挂火弱者 / 给自己净化"？**
 *   （`probe-state-blindspots.mjs:71` 已经量到"看得见"：改 `fireWeakNext` ⇒ 特征变 3/3 格、决策变 0/3；
 *    本尺补后半句——翻的那一手是不是规范要的那一手，并沿用 §E685 的配对分母纪律。）
 *
 * 在册事实（逐条给出处，不是推测）：
 *   · 火弱由**藤甲**传来：`resolve.js:1154` 记 `a.fireWeakPrev = {pid:t,…}`，`:32-34` 在结算时把火弱转给攻击它的目标；
 *   · 挂火弱的人吃火焰类伤害 **+1**：`resolve.js:311`（`DMG.FIRE ‖ DMG.FIRELIGHT` 且 `p.fireWeakNow`）；
 *   · **全场只有坦克是 FIRE 卡**：`rules.js:51`（`SK.TANK` 2 ジ ‖ dmg.type=FIRE ‖ 穿防御与转移）
 *     ⇒ "集火挂火弱者"在这套牌里唯一的具体形状就是**用坦克打那个挂着 fireWeakNow 的对手**；
 *   · 净化 `rules.js:82`（3 ジ ‖ pri1 ‖ self ‖ 清除自身全部持续状态）⇒ 自己挂着火弱时它是"付得起就有出口"那一张。
 *
 * 形状（预注册，写在跑之前）：
 *   E1 集火方向：同一局两个世界 —— A = 没人挂火弱，B = 把某个**存活对手**的 `fireWeakNow` 设成 true（座位 1..N-1 轮转防座位偏置）。
 *      规定动作 = {key: TANK, target: 那个挂火弱的对手}。
 *   E2 自净方向：A = 我自己干净，B = **我自己** `fireWeakNow=true`。规定动作 = {key: PURIFY}（self 卡不比目标）。
 *      **分母纪律（两把尺共用，跑之前写死）**：两世界里**同一张牌都必须付得起**才进配对
 *      —— A 世界里规范本身不适用（那正是设计），所以"能不能进分母"只看**可负担性**，不看规范；
 *      否则"没钱"会被记成"不反应"（§E681/§E685 那一格的老病；第一版我就踩了这条，拿规范当分母 ⇒ 120 副全被剔除）。
 *   每格记：命中A / 命中B / **方向 = 命中B − 命中A** / 换招率（规范维）/ 换招率（两枚无关事实：ep 4→5 ‖ 自己血 3→2）。
 *   三臂：被量的冠军（ε=0 贪心）‖ 正对照（规范适用就交那一手、不适用就**刻意交别的**）‖ 负对照（无视事实永远同一手）。
 *   三条自证（阈值现在写死，不许看完数再定）：正对照方向 >90pt ‖ 正对照在两枚无关事实上换招都 <5% ‖ 负对照 |方向| <2pt
 *     ⇒ 任一不过 ⇒ **本档主读数作废**，退出码 3。
 *
 * 用法：node tools/probe-fire-weak-response.mjs [--pack=…|--seeds=300|--n=5|--mode=multi|--quiet|--debug]
 * 只读：不落任何文件。 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['pack', 'seeds', 'n', 'mode', 'quiet', 'debug'], 'probe-fire-weak-response');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const SEEDS = Number(arg('seeds', 300));
const N = Number(arg('n', 5));
const MODE = arg('mode', 'multi');
const QUIET = argv.includes('--quiet');
const DEBUG = argv.includes('--debug');
if (!Number.isFinite(SEEDS) || SEEDS < 20) { console.error('⛔ --seeds 必须 ≥20（实测 ' + arg('seeds', 300) + '）'); process.exit(2); }
if (!(N >= 2 && N <= 5)) { console.error('⛔ --n 必须在 2~5（实测 ' + N + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules;
if (T.setTrainMode) T.setTrainMode(MODE === 'long' ? 'long' : 'multi');
const c = loadChamp(W, PACK);
if (!c || c.length !== W.EpirusPolicy.paramCount()) { console.error('⛔ 包读不出/维度不符：' + PACK); process.exit(2); }
const params = Float64Array.from(c);
const K = R.SK;

/* 合成桌：我（0 号）4 ジ（坦克 2 ジ、净化 3 ジ都付得起），其余座位血量/能量各异（别摆成对称桌）。
 * **必须每次新建 state**：policy.js 的 stateVec 按对象身份缓存 ⇒ 就地改会读旧向量。 */
function mkState(seed, weakSeat, tweak) {
  const st = S.createState(MODE, { next: T.mulberry32(seed * 7919 + 13) }, N);
  st.round = 9;
  for (let i = 0; i < N; i++) {
    const p = st.p[i];
    p.ep = i === 0 ? 4 : 1 + (i % 3);
    p.hp = 3 - (i % 2);
    p.fireWeakNow = (i === weakSeat);
  }
  if (N > 2) st.p[2].boom = 1;
  if (tweak === 'ep') st.p[0].ep = 5;
  if (tweak === 'hp') st.p[0].hp = 2;
  return st;
}
const findWeak = function (st, pid) {
  for (let q = 0; q < st.p.length; q++) {
    if (q === pid) continue;
    if (st.p[q] && st.p[q].hp > 0 && st.p[q].fireWeakNow) return q;
  }
  return -1;
};
const affordOf = function (legal, key) { return (legal || []).some(function (l) { return l.key === key && l.affordable; }); };
/* E1 规范（B 侧）：场上有"活着的挂火弱对手"且我付得起坦克 ⇒ 坦克打他。 */
const normFire = function (st, pid, legal) {
  if (!affordOf(legal, K.TANK)) return null;
  const q = findWeak(st, pid);
  return q < 0 ? null : { key: K.TANK, target: q };
};
/* E2 规范（B 侧）：我自己挂火弱且付得起净化 ⇒ 净化。 */
const normPurge = function (st, pid, legal) {
  if (!st.p[pid].fireWeakNow) return null;
  return affordOf(legal, K.PURIFY) ? { key: K.PURIFY, target: null } : null;
};

/* E3 规范（B 侧）：我自己挂火弱 ⇒ 交出防御族里的任意一张（GUARD_FAMILY，`rules.js:106`）——
 *   命中判据是"落进这一族"，不是某一张具体牌，所以 `hit` 用族判定而不是比 key+target。 */
const GUARDS = R.GUARD_FAMILY;
const normGuard = function (st, pid, legal) {
  const first = (legal || []).filter(function (l) { return l.affordable && GUARDS.indexOf(l.key) >= 0; })[0];
  if (!first) return null;
  return st.p[pid].fireWeakNow ? { key: first.key, target: first.target } : null;
};

const pickKey = function (a, keyOnly) { return a ? (keyOnly ? a.key : a.key + '#' + (a.target == null ? '-' : a.target)) : 'null'; };
const wilson = function (k, n) {
  if (!n) return '0—0';
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const cc = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return ((cc - h) * 100).toFixed(1) + '—' + ((cc + h) * 100).toFixed(1);
};

/* 三臂：`avoidKey` 给正对照用 —— 规范不适用的那一格必须**刻意不交那一手**，否则"命中A"会自己贴上去（自证就废了）。 */
function armsFor(norm, avoidKey) {
  const teacher = function () {
    return function (st, pid, legal) {
      const pres = norm(st, pid, legal);
      if (pres) return pres;
      const other = legal.filter(function (l) { return l.affordable && l.key !== avoidKey && l.key !== K.JI; });
      return other.length ? { key: other[0].key, target: other[0].target } : { key: K.JI, target: null };
    };
  };
  return [
    ['被量：冠军包（ε=0 贪心）', function () { return T.policyChooserN(params, 0.15, 0); }],
    ['正对照：照规范翻的教师', teacher],
    ['负对照：无视事实、永远同一手', function () {
      return function (st, pid, legal) {
        const g = legal.filter(function (l) { return l.key === K.GUN && l.affordable; })[0];
        return g ? { key: K.GUN, target: g.target } : { key: K.JI, target: null };
      };
    }],
  ];
}

function runExperiment(title, mkPres, opts) {
  const weakIsSelf = opts.self, avoidKey = opts.avoidKey, cardKey = opts.cardKey;
  /* 命中判据由调用方给（E1 比 key+target ‖ E2 比 key ‖ E3 比"落进防御族"）⇒ 三格共用同一条配对/自证纪律 */
  const hit = opts.hit || function (a, pres) { return pickKey(a, opts.keyOnly) === pickKey(pres, opts.keyOnly); };
  /* A 侧配对门槛：默认"规范要用的那张牌在 A 也必须付得起"；E3（一族牌）自定义成"族里有付得起的" */
  if (!opts.aPair) opts.aPair = function (legalA) { return affordOf(legalA, cardKey); };
  /* "用不用这一类牌"与"方不对"是两件事：前者 = `rep`（默认按 key 算，不比目标），后者 = `hit`。
   *   没有这一列就会把"这手牌根本不在它的 repertoire 里"误读成"它不看事实"（§E685 同一课）。 */
  const rep = opts.rep || function (a) { return !!a && a.key === cardKey; };
  const rows = []; let skipB = 0, skipA = 0, prescHist = {};
  for (const [label, mkChooser] of armsFor(mkPres, avoidKey)) {
    let hitA = 0, hitB = 0, flip = 0, flipEp = 0, flipHp = 0, repA = 0, repB = 0, n = 0;
    for (let s = 1; s <= SEEDS; s++) {
      const weakSeat = weakIsSelf ? 0 : (1 + (s % (N - 1)));
      const stA = mkState(s, -1), stB = mkState(s, weakSeat);
      const legalA = Play.legalActions(stA, 0), legalB = Play.legalActions(stB, 0);
      const pres = mkPres(stB, 0, legalB);
      if (!pres) { skipB++; continue; }                              // B 里规范不适用 ⇒ 不进分母
      if (!opts.aPair(legalA)) { skipA++; continue; }      // A 世界里"同一类动作"必须也付得起 ⇒ 配对才成立（**不看规范本身**）
      if (!weakIsSelf && !stA.p[pres.target]) { skipA++; continue; }
      prescHist[pres.key + '#' + (pres.target == null ? '-' : pres.target)] = (prescHist[pres.key + '#' + (pres.target == null ? '-' : pres.target)] || 0) + 1;
      const chooser = mkChooser();
      const a = chooser(stA, 0, legalA), b = chooser(stB, 0, legalB);
      const stEp = mkState(s, -1, 'ep'), stHp = mkState(s, -1, 'hp');
      const c2 = chooser(stEp, 0, Play.legalActions(stEp, 0));
      const d2 = chooser(stHp, 0, Play.legalActions(stHp, 0));
      n++;
      if (hit(b, pres, stB)) hitB++;
      if (hit(a, pres, stA)) hitA++;
      if (rep(a)) repA++;
      if (rep(b)) repB++;
      if (pickKey(a, opts.keyOnly) !== pickKey(b, opts.keyOnly)) flip++;
      if (pickKey(a, opts.keyOnly) !== pickKey(c2, opts.keyOnly)) flipEp++;
      if (pickKey(a, opts.keyOnly) !== pickKey(d2, opts.keyOnly)) flipHp++;
      if (DEBUG && s === 1) {
        console.log('   [debug] A 可付=' + legalA.filter(function (l) { return l.affordable; }).map(function (l) { return l.key; }).join(',') +
          ' ‖ B 可付=' + legalB.filter(function (l) { return l.affordable; }).map(function (l) { return l.key; }).join(',') +
          ' ‖ 冠军 A=' + JSON.stringify(a) + ' B=' + JSON.stringify(b));
      }
    }
    rows.push({ label, n, hitA, hitB, 命中A: n ? hitA / n : NaN, 命中B: n ? hitB / n : NaN,
      方向: n ? (hitB - hitA) / n : NaN, 换招率: n ? flip / n : NaN, 换招无关ep: n ? flipEp / n : NaN, 换招无关血: n ? flipHp / n : NaN,
      用牌A: n ? repA / n : NaN, 用牌B: n ? repB / n : NaN });
  }
  console.log('\n== ' + title + '（' + N + ' 人 · ' + MODE + ' · 摆 ' + SEEDS + ' 副 · B 侧规范不适用剔除 ' + skipB + ' ‖ A 侧付不起剔除 ' + skipA + '）==');
  if (rows[0].n < 20) { console.log('⛔ 进分母 <20 ⇒ 这一档**读不出**（不是"没反应"）。别引用方向读数。'); return { ok: null, rows: rows }; }
  console.log('   规定动作分布：' + JSON.stringify(prescHist));
  console.log('   臂                                进分母  命中A(%)          命中B(%)          方向(B−A)   用该类牌A→B(%)   换招率 规范/ep/血(%)');
  for (const r of rows) {
    console.log('   ' + r.label.padEnd(34, ' ') + ' ' + String(r.n).padStart(6) +
      '  ' + ((r.命中A * 100).toFixed(1) + ' [' + wilson(r.hitA, r.n) + ']').padEnd(16) +
      '  ' + ((r.命中B * 100).toFixed(1) + ' [' + wilson(r.hitB, r.n) + ']').padEnd(16) +
      '  ' + ((r.方向 * 100 >= 0 ? '+' : '') + (r.方向 * 100).toFixed(1) + 'pt').padStart(9) +
      '  ' + ((r.用牌A * 100).toFixed(1) + '→' + (r.用牌B * 100).toFixed(1)).padStart(13) +
      '  ' + ((r.换招率 * 100).toFixed(1) + ' / ' + (r.换招无关ep * 100).toFixed(1) + ' / ' + (r.换招无关血 * 100).toFixed(1)));
  }
  const pos = rows[1], neg = rows[2];
  const teethOK = pos.方向 > 0.9 && pos.换招无关ep < 0.05 && pos.换招无关血 < 0.05 && Math.abs(neg.方向) < 0.02;
  console.log('   尺子自证：正对照方向=' + (pos.方向 * 100).toFixed(1) + 'pt（要求 >90）‖ 正对照·无关事实换招 ep=' + (pos.换招无关ep * 100).toFixed(1) +
    '% 血=' + (pos.换招无关血 * 100).toFixed(1) + '%（都要求 <5）‖ 负对照方向=' + (neg.方向 * 100).toFixed(1) + 'pt（要求 |·|<2）⇒ ' +
    (teethOK ? '**通过**，主读数可引用' : '**不通过 ⇒ 本档主读数一律作废**'));
  return { ok: teethOK, rows: rows };
}

console.log('== 火弱 × 环境适应（§E690）· 包=' + PACK + ' ‖ 冠军 ε=0 贪心 ==');
const r1 = runExperiment('E1 集火方向（规范 = 用唯一的 FIRE 卡「坦克」打那个挂着 fireWeakNow 的存活对手）', normFire,
  { self: false, avoidKey: K.TANK, cardKey: K.TANK, hit: function (a, pres) { return !!a && a.key === pres.key && a.target === pres.target; } });
const r2 = runExperiment('E2 自净方向（规范 = 自己挂火弱且付得起 ⇒ 出「净化」）', normPurge,
  { self: true, keyOnly: true, avoidKey: K.PURIFY, cardKey: K.PURIFY });
const r3 = runExperiment('E3 自保方向（规范 = 自己挂火弱 ⇒ 交出防御族 GUARD_FAMILY 里任意一张）', normGuard,
  { self: true, keyOnly: true, avoidKey: null, cardKey: null,
    /* E3 的规范是"一族牌"⇒ A 侧门槛与命中都按族判（单张 cardKey 在这儿没有意义） */
    aPair: function (legalA) { return legalA.some(function (l) { return l.affordable && GUARDS.indexOf(l.key) >= 0; }); },
    rep: function (a) { return !!a && GUARDS.indexOf(a.key) >= 0; },
    hit: function (a) { return !!a && GUARDS.indexOf(a.key) >= 0; } });
if (!QUIET) {
  console.log('\n   读法：命中A 高 = 规范不适用那一格也交同一手（"没跟着事实翻"）；命中B 高 = 事实到位那一格真按规范交那一手。');
  console.log('   ⚠ 合成桌只回答"那格出现时会不会翻向规范要的那一手"，不回答"真实流里那格出现几次"（后者要另一把尺：真局里 fireWeakNow 的覆盖率）。');
  console.log('   ⚠ 规范是本尺自定义的（场上唯一 FIRE 卡 = 坦克 ‖ 净化 3 ジ self），不是在册裁定 ⇒ 引用时写明"自定义规范"。');
}
process.exit([r1, r2].some(function (x) { return x.ok === false; }) ? 3 : 0);
