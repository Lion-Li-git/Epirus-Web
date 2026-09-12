/* Epirus 5 人局评测（P3.5「改考卷」）
 * 用法: node tools/eval-5p.mjs [每组合局数=12] [人数=5] [seed=77000] [冠军文件] [--pool=core|all]
 *
 * 为什么不复用 tools/eval-3p.mjs（它有两个结构性缺陷，正是 REVIEW-3P §2-P3.5 说的"考卷"问题）：
 *   1) eval-3p 只取 **2 个脚本** 并循环填充所有对手座位 ⇒ 5 人局会把同一对脚本
 *      重复填满 4 个座位，"4 个对手"实际只有 2 种压力；
 *   2) 它的对手池里**没有深经济对手** —— `pickDeepSaver`（"会攒 + 会还手"）在 v1.3.30
 *      被静默删除、v1.3.55 才恢复。而池里剩下的 `pickFarmer` 只攒不还手、
 *      `pickHeavyFire` 会还手但不攒（ep<=2 使贵技能分支永不触发）
 *      ⇒ "不攒钱"在这张考卷上**没有任何惩罚来源**。
 *
 * 本工具：4 个**互不相同**的脚本组成对手场；池子显式包含 deepsaver；
 * 并把「含 / 不含深经济对手」的组合**拆开报**，让考卷本身的判别力可被检查。
 * 另附 **pickRandom 对照行**（同一张考卷下的基线），否则百分比无法解释。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* 位置参数：剔除 --flag（否则会被当成局数/人数） */
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a);
  if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2];
}
const GAMES = Number(ARGV[0] || 12);
const N = Number(ARGV[1] || 5);
const SEED = Number(ARGV[2] || 77000);
const FILE = ARGV[3] || 'js/bundled-champion-3p.js';
const POOL_MODE = FLAG.pool || 'core';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots;

const src = readFileSync(FILE, 'utf8');
const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
if (!mm) { console.error('未找到 EPIRUS_CHAMPION_3P: ' + FILE); process.exit(1); }
const metaM = src.match(/window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('冠军包不兼容: ' + JSON.stringify(P.checkPack(JSON.parse(mm[1])))); process.exit(1); }

/* ---------- 对手池 ---------- */
const ALL = [
  ['random', Bots.pickRandom], ['aggro', Bots.pickAggro], ['defend', Bots.pickDefend],
  ['balanced', Bots.pickBalanced], ['antidef', Bots.pickAntiDef], ['breakdef', Bots.pickBreakDef],
  ['wall', Bots.pickWall], ['mix', Bots.pickMix], ['farmer', Bots.pickFarmer],
  ['tankline', Bots.pickTankLine], ['heavyfire', Bots.pickHeavyFire], ['deepsaver', Bots.pickDeepSaver]
];
/* "深经济对手"的定义：会攒钱**并且**会把攒的钱换成重击。farmer 只攒不还手，不算。 */
const DEEP = { deepsaver: 1, heavyfire: 1 };
const CORE = ['random', 'defend', 'antidef', 'wall', 'farmer', 'heavyfire', 'deepsaver'];
const poolNames = (POOL_MODE === 'all') ? ALL.map(function (x) { return x[0]; }) : CORE;
const FN = {};
for (const kv of ALL) FN[kv[0]] = kv[1];
for (const nm of poolNames) if (!FN[nm]) { console.error('对手池里有未知脚本: ' + nm); process.exit(1); }

/* 所有 4 子集（每个对手场 4 个互不相同的脚本） */
const combos = [];
(function rec(start, cur) {
  if (cur.length === 4) { combos.push(cur.slice()); return; }
  for (let i = start; i < poolNames.length; i++) { cur.push(poolNames[i]); rec(i + 1, cur); cur.pop(); }
})(0, []);

/* 脚本 chooser 包一层：与 evo.wrapBotN 同规则，但**保留脚本自己选的目标**
 * （v1.3.55 修好了 wrapBotN；这里独立实现，避免评测反过来依赖被测代码） */
function asChooser(fn) {
  return function (state, pid, legal) {
    const k = fn(state, pid, legal);
    const key = (typeof k === 'string') ? k : (k && k.key);
    if (key == null) return { key: R.SK.JI, target: null, target2: null };
    const obj = (typeof k === 'object' && k) ? k : null;
    const t1 = (obj && obj.target != null) ? obj.target : T.pickTargetN(state, pid, key);
    const t2 = (obj && obj.target2 != null) ? obj.target2 : T.pickTarget2N(state, pid, key, t1);
    return { key: key, target: t1, target2: t2 };
  };
}

function runSubject(makeSel, label) {
  const ranks = new Array(N).fill(0);
  const seatFirst = new Array(N).fill(0), seatGames = new Array(N).fill(0);
  const use = {}, cost3Picks = { n: 0 };
  const epBands = [0, 0, 0, 0];          // 决策时的 ep 分带：0-1 / 2-4 / 5-9 / 10+
  let maxEp = 0, epGe3 = 0, decisions = 0;
  let deepGames = 0, deepFirst = 0, shallowGames = 0, shallowFirst = 0;
  let total = 0;
  for (const combo of combos) {
    const hasDeep = combo.some(function (nm) { return !!DEEP[nm]; });
    for (let g = 0; g < GAMES; g++) {
      const seat = g % N;
      /* ⚠️ 必须把"对手槽位"相对座位旋转：否则 combo 的第 k 个脚本总是坐在固定几个座位上，
       * 座位率与脚本强度**混淆**在一起，测出来的"座位偏置"分不清是引擎偏置还是脚本排布。
       * combo 长 4、座位 5，gcd(4,5)=1 ⇒ 取 GAMES 为 20 的倍数时 (槽位,座位) 恰好全覆盖。 */
      const rot = g % combo.length;
      const field = combo.slice(rot).concat(combo.slice(0, rot));
      const choosers = [];
      let oi = 0;
      const sel = makeSel();
      for (let pid = 0; pid < N; pid++) {
        if (pid === seat) {
          choosers.push(function (state, id, legal) {
            const ep = state.p[id].ep;
            decisions++;
            if (ep > maxEp) maxEp = ep;
            if (ep >= 3) epGe3++;
            epBands[ep <= 1 ? 0 : (ep <= 4 ? 1 : (ep <= 9 ? 2 : 3))]++;
            const a = sel(state, id, legal);
            const c = S.computeCost(state, id, a.key);
            use[a.key] = (use[a.key] || 0) + 1;
            if (c && c.ok && c.ep >= 3) cost3Picks.n++;
            return a;
          });
        } else { choosers.push(asChooser(FN[field[oi % field.length]])); oi++; }
      }
      const r = T.oneGameN(choosers, SEED + g * 977 + total, N);
      const rank = T.rankOf(r.state, seat, SEED + g * 977 + total);   // v1.3.57: 名次平局用本局种子洗牌（pid 中性）
      ranks[rank - 1]++;
      seatGames[seat]++; if (rank === 1) seatFirst[seat]++;
      if (hasDeep) { deepGames++; if (rank === 1) deepFirst++; }
      else { shallowGames++; if (rank === 1) shallowFirst++; }
      total++;
    }
  }
  const pct = function (x, y) { return y ? (x / y * 100).toFixed(1) + '%' : '-'; };
  return {
    label: label, total: total, ranks: ranks, use: use, decisions: decisions,
    maxEp: maxEp, epGe3: epGe3, cost3: cost3Picks.n, epBands: epBands,
    seatFirst: seatFirst, seatGames: seatGames,
    deepGames: deepGames, deepFirst: deepFirst, shallowGames: shallowGames, shallowFirst: shallowFirst,
    firstRate: total ? ranks[0] / total : 0,
    top2Rate: total ? (ranks[0] + ranks[1]) / total : 0,
    top3Rate: total ? (ranks[0] + ranks[1] + ranks[2]) / total : 0,
    pct: pct
  };
}

const hasDeepInExam = combos.filter(function (c) { return c.some(function (nm) { return !!DEEP[nm]; }); }).length;
console.log('=== ' + N + ' 人局评测 ===');
console.log('主体: ' + FILE);
console.log('meta: ' + (metaM ? metaM[1] : '{}'));
console.log('对手池(' + poolNames.length + '): ' + poolNames.join(' '));
console.log('对手场 = 4 个互不相同的脚本，全部 ' + combos.length + ' 组合 × ' + GAMES + ' 局 = ' +
  (combos.length * GAMES) + ' 局；含深经济对手的组合 ' + hasDeepInExam + '/' + combos.length);
console.log('随机基线（5 人局）: 1st 20.0% / top2 40.0% / top3 60.0%');
console.log('');

/* ===== 干净消融：同架构、只换"弹头" =====
 * 为什么需要：`pickHeavyFire` 是"取可负担的最重一击"，ep<=2 时只够坦克
 * ⇒ **它从不攒钱去放大雷**（§1-D 记录的 `tankline ≡ heavyfire` 就是这个原因），
 * 所以拿它和 tankline 比**测不到大雷**。要回答"5 人局有没有货架"，
 * 必须让两边的**攒钱-花钱结构完全相同**，只把 payload 换掉：
 *   一直出ジ，直到 payload 买得起 → 打出 payload → 回到出ジ（循环）。
 * payload 的费用差异（大雷 5 vs 坦克 2 vs 狙击 2 …）正是被测量的东西。 */
function makeSaver(payloadKey) {
  return function (state, pid, legal) {
    const by = {};
    for (const l of legal) by[l.key] = l;
    if (by[payloadKey] && by[payloadKey].affordable) {
      return { key: payloadKey, target: T.pickTargetN(state, pid, payloadKey) };
    }
    return { key: R.SK.JI, target: null };
  };
}

const t0 = Date.now();
/* --subject=<脚本名>：把主体换成池子里的某个脚本。用途之一是不依赖别人的数字，
 * 自己复核"5 人局才是深经济的正确考卷"这条判断（例如 --subject=tankline vs heavyfire）。 */
const SUBJECT = FLAG.subject || '';
const PAYLOAD = FLAG.payload || '';
if (SUBJECT && !FN[SUBJECT]) { console.error('--subject 未知脚本: ' + SUBJECT + '（可选: ' + ALL.map(function (x) { return x[0]; }).join(' ') + '）'); process.exit(1); }
const PAY_KEY = { bigT: R.SK.BIG_T, tank: R.SK.TANK, railgun: R.SK.RAILGUN, snipe: R.SK.SNIPE, dualGun: R.SK.DUAL_GUN, laserEye: R.SK.LASER_EYE, mirror: R.SK.MIRROR };
const subjectSel = PAYLOAD
  ? (function () {
    const k = PAY_KEY[PAYLOAD];
    if (!k) { console.error('--payload 未知: ' + PAYLOAD + '（可选: ' + Object.keys(PAY_KEY).join(' ') + '）'); process.exit(1); }
    return function () { return asChooser(makeSaver(k)); };
  })()
  : (SUBJECT
    ? function () { return asChooser(FN[SUBJECT]); }
    : function () { return T.policyChooserN(params, 0.15); });
const subjectLabel = PAYLOAD ? ('消融·只换弹头 ' + PAYLOAD) : (SUBJECT ? ('脚本 ' + SUBJECT) : '冠军');
const champ = runSubject(subjectSel, subjectLabel);
const ctrl = runSubject(function () { return asChooser(Bots.pickRandom); }, '对照 pickRandom');

for (const s of [champ, ctrl]) {
  console.log('[' + s.label + '] 1st=' + s.pct(s.ranks[0], s.total) +
    '  2nd=' + s.pct(s.ranks[1], s.total) + '  3rd=' + s.pct(s.ranks[2], s.total) +
    '  4th=' + s.pct(s.ranks[3], s.total) + '  5th=' + s.pct(s.ranks[4], s.total) +
    '   | top2=' + s.pct(s.ranks[0] + s.ranks[1], s.total) + ' top3=' + s.pct(s.ranks[0] + s.ranks[1] + s.ranks[2], s.total));
  console.log('    各座位 1st 率: ' + s.seatGames.map(function (g, i) { return 'P' + i + '=' + s.pct(s.seatFirst[i], g); }).join(' '));
  console.log('    拆分: 含深经济对手 ' + s.pct(s.deepFirst, s.deepGames) + '（' + s.deepGames + ' 局）  vs  不含 ' +
    s.pct(s.shallowFirst, s.shallowGames) + '（' + s.shallowGames + ' 局）  Δ=' +
    ((s.deepGames && s.shallowGames) ? ((s.deepFirst / s.deepGames - s.shallowFirst / s.shallowGames) * 100).toFixed(1) + 'pt' : '-'));
}

console.log('');
console.log('=== ' + subjectLabel + ' 的经济行为（这套指标才是"货架"的直接读数）===');
console.log('决策次数=' + champ.decisions + '  到达过的最高 ep=' + champ.maxEp +
  '  ep>=3 的决策占比=' + champ.pct(champ.epGe3, champ.decisions) +
  '  cost>=3 出手占比=' + champ.pct(champ.cost3, champ.decisions));
console.log('  决策时 ep 分带: 0-1=' + champ.pct(champ.epBands[0], champ.decisions) +
  '  2-4=' + champ.pct(champ.epBands[1], champ.decisions) +
  '  5-9=' + champ.pct(champ.epBands[2], champ.decisions) +
  '  10+=' + champ.pct(champ.epBands[3], champ.decisions) +
  '   ← 若 5+/10+ 占比高，则"钱不够"不是约束，问题是**买了什么**');
const tot = Object.keys(champ.use).reduce(function (a, k) { return a + champ.use[k]; }, 0);
const sorted = Object.keys(champ.use).sort(function (x, y) { return champ.use[y] - champ.use[x]; });
console.log('出手种类=' + sorted.length + '  分布（前 12）:');
for (const k of sorted.slice(0, 12)) {
  const nm = R.byKey[k] ? R.byKey[k].name : k;
  const c = S.computeCost(S.createState('multi', { next: T.mulberry32(7) }, N), 0, k);
  console.log('  ' + nm.padEnd(10) + (champ.use[k] / tot * 100).toFixed(1).padStart(5) + '%' +
    '   费用=' + ((c && c.ok) ? c.ep : '?'));
}
console.log('耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
