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
  ['tankline', Bots.pickTankLine], ['heavyfire', Bots.pickHeavyFire], ['deepsaver', Bots.pickDeepSaver],
  /* v1.3.60：集火脚本。转移伤害的价值 ∝ 本回合承伤 N，而 pickFocusFire 的注释写明
   * "当前 meta 里 N>=2 的唯一常见来源就是被集火" ⇒ 它是转移伤害的**前置条件提供者**。 */
  ['focusfire', Bots.pickFocusFire],
  /* v1.4.1：前置条件提供者（铺雷者 / 贴符咒+天火者），池里原先没有 ⇒ 藤甲的火弱、
   * 贴贴×天火这两条线在任何考卷上都测不到。 */
  ['minespam', Bots.pickMineSpam], ['cursestorm', Bots.pickCurseStorm],
  /* v1.4.7：单一防御 specialists。第十轮复核指出：它们作为"玩家对手"确实无聊（v1.3.22 按熵=1.00 剔除，
   * 那是 UI 判断），但作为**训练/评测的 exploit cursor** 正是缺的那类 —— 它们暴露的是
   * "冠军会不会反制一堵 0 ジ 的墙"。且它们**原本不在 server 的 BOT_FN_N 里**。 */
  ['reflectspam', Bots.pickReflectSpam], ['guardspam', Bots.pickGuardSpam],
  ['baguaspam', Bots.pickBaguaSpam], ['protowall', Bots.pickProtoWall]
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

/* ===== --field=<preset>：把对手场换成**能提供前置条件**的场（用户 2026-09-12 提出的问题）=====
 * 动机：转移伤害 / 藤甲 这类卡的价值是**条件性**的 ——
 *   转移伤害 的价值 ∝ 本回合承伤 N ⇒ 需要"被集火"或"被高伤单体打"；
 *   藤甲 的价值 = 目标下回合受**火焰**伤害 +1 ⇒ 需要同局有铺雷/天火来源。
 * 在中性考卷上它们的 Δ 会把"前置条件不存在"误读成"这张卡没用"。
 * 预设场用**允许重复**的 4 槽（默认考卷是 4 个互不相同的脚本，重复不了）。 */
/* 定向集火**主体座位**的攻击者（实验器材，不是可训练策略，故不进 bots.js）。
 * 为什么不能用现成的 pickFocusFire：它打"血量最低"的对手，4 个集火脚本会互相打成那个最低的
 * ⇒ 集火根本没集到主体身上。实测（v1.3.60）：focusfire 场主体场均承伤 1.50，
 * 反而**低于**中性场的 2.53，转移事件 0、火焰事件 0 —— 前置条件没造出来。 */
function makeFocusMe(seat) {
  return function (state, pid, legal) {
    if (seat === pid || !state.p[seat] || state.p[seat].hp <= 0) return Bots.pickRandom(state, pid, legal);
    const by = {};
    for (const l of legal) by[l.key] = l;
    /* 优先高伤单体（把单回合 N 抬到 2），否则枪（1 伤）。
     * 用户要测的正是"集火**或高伤害**"——两种来源都覆盖。 */
    for (const k of [R.SK.BIG_T, R.SK.RAILGUN, R.SK.TANK, R.SK.SNIPE, R.SK.DUAL_GUN, R.SK.GUN]) {
      if (by[k] && by[k].affordable) return { key: k, target: seat };
    }
    return { key: R.SK.JI, target: null };
  };
}
/* ===== --smart=<卡>:<条件> —— **正确用法**口径（用户 2026-09-12 问题的核心）=====
 * 为什么必须有它：`--inject` 是贪心的（能买就放）。对 转移伤害 这类**反应型**卡，
 * 贪心 = 每回合都放 = 全程不攻击 ⇒ 无论前置条件多充分都必然输。
 * 实测 regen=1 时贪心注入产出 370 次转移事件，1st 仍只有 3.9%（基线 19.4%）——
 * 那个数只证明"贪心误用很糟"，**不能**回答"这卡对不对"。
 * 条件写法：`2` = 上一回合我实际承伤 >= 2；`hp1` = 我 hp <= 1（濒死才转）。 */
const SMART = FLAG.smart || '';
const SM = SMART ? SMART.split(':') : null;
const SM_ST = { cand: 0, hit: 0, lastTakenSum: 0, fired: 0 };
function buildSmartSel() {   // 工厂函数（hoisted）：PAY_KEY 在**调用时**才解析，
  const k = PAY_KEY[SM[0]];  // 否则就是 TDZ —— 本会话第三次踩（ARGV / injectSel / 这里）
  if (!k) { console.error('--smart 未知卡: ' + SM[0] + '（可选: ' + Object.keys(PAY_KEY).join(' ') + '）'); process.exit(1); }
  const cond = SM[1] || '2';
  const hpMode = /^hp(\d+)$/.exec(cond);
  const thr = hpMode ? Number(hpMode[1]) : Number(cond);
  return function () {
    const inner = T.policyChooserN(params, 0.15);
    let seenRound = -1, evIdx = 0, curTaken = 0, lastTaken = 0;
    return function (state, pid, legal) {
      while (evIdx < state.events.length) {
        const e = state.events[evIdx++];
        if (e.type === 'damage' && e.to === pid) curTaken += e.amt;
      }
      if (state.round !== seenRound) { lastTaken = curTaken; curTaken = 0; seenRound = state.round; }
      SM_ST.cand++;
      const by = {};
      for (const l of legal) by[l.key] = l;
      const want = hpMode ? (state.p[pid].hp <= thr) : (lastTaken >= thr);
      if (want && by[k] && by[k].affordable) {
        SM_ST.hit++; SM_ST.lastTakenSum += lastTaken;
        return { key: k, target: T.pickTargetN(state, pid, k), target2: null };
      }
      return inner(state, pid, legal);
    };
  };
}
/* ===== --ban=<技能>：**消融（拿掉）** —— report 一直缺的镜像口径 =====
 * `--inject` 测的是"强制用它"，只有**冠军根本不用**的技能才需要它；
 * 而"冠军已经在用的技能"（hA9 的聚能环 5.5%、hB12 的大雷 1.8%、armB12f 的坦克 27%）
 * 唯一能测的办法是**把它从冠军手里拿掉**，看损失多少。对连招尤其重要：
 * 拿掉 聚能环 测的是它在自己策略里的作用，这跟"强制 spam 聚能环"完全不是一回事。
 * 实现：只过滤 chooser 拿到的 legal —— 冠军的 softmax 在剩余可负担动作上重算。 */
const BAN = FLAG.ban || '';
const BAN_ST = { dec: 0, legal: 0 };
function buildBanSel() {
  const k = PAY_KEY[BAN] || BAN;
  return function () {
    const inner = T.policyChooserN(params, 0.15);
    return function (state, pid, legal) {
      BAN_ST.dec++;
      if (legal.some(function (l) { return l.key === k && l.affordable; })) BAN_ST.legal++;
      const f = legal.filter(function (l) { return l.key !== k; });
      return inner(state, pid, f.length ? f : legal);
    };
  };
}

/* ===== --grant=<epN|elec|boom 用 + 连>：在 legalActions **之前**给主体开资源 =====
 * 专治"珠类技能测不了"：珠子按 R9' 回合末清空，补珠必须发生在 legal 之前。
 * ⚠️ 这是补贴，必须与**同样的 --grant 基线**对比（同一补贴下比"用它 vs 不用它"）。 */
const GRANT = FLAG.grant || '';
const GRANT_ST = { rounds: 0 };
function makeGrantHook(seat) {
  if (!GRANT) return undefined;
  const parts = GRANT.split('+');
  let epN = 0;
  for (const p of parts) { const m = /^ep(\d+)$/.exec(p); if (m) epN = Number(m[1]); }
  const elec = parts.indexOf('elec') >= 0, boom = parts.indexOf('boom') >= 0;
  return function (state) {
    const p = state.p[seat];
    if (!p || p.hp <= 0) return;
    GRANT_ST.rounds++;
    if (epN) p.ep = Math.max(p.ep, epN);
    if (elec) p.elec = Math.max(p.elec, 1);
    if (boom) p.boom = Math.max(p.boom, 1);
  };
}

/* ===== --pure=<技能>：**纯招主体**（"只出这一招 + ジ"）=====
 * 为什么 `--inject` 不够：它是"优先用它，买不起就回落到冠军策略"，而冠军策略里有枪
 * ⇒ 在反弹墙上照样被弹死。实测（v1.4.7，1400 局）`--inject=sword/snipe/railgun` 全是
 * **场均承伤 3.00 = 3 血上限、被弹回 3.00 次/局、终局血量 0.00**，与冠军本体逐位相同 ——
 * 也就是说那三个臂测的根本不是"激光剑能不能破墙"，而是"冠军策略里那 3 次枪"。
 * `--pure` 把 legal 限制到 {该技能, ジ}，才真正回答"单一卡片策略能不能破这堵墙"。 */
const PURE = FLAG.pure || '';
const PURE_ST = { dec: 0, hit: 0 };
function buildPureSel() {
  const k = PAY_KEY[PURE] || PURE;
  return function () {
    const inner = T.policyChooserN(params, 0.15);
    return function (state, pid, legal) {
      PURE_ST.dec++;
      const keep = legal.filter(function (l) { return l.key === k || l.key === R.SK.JI; });
      if (keep.some(function (l) { return l.key === k && l.affordable; })) PURE_ST.hit++;
      return inner(state, pid, keep.length ? keep : legal);
    };
  };
}

const REGEN = Number(FLAG.regen || 0);   // 每回合回 ep（0 = 与线上规则一致）
/* v1.4.0：--mode=<key>（multi=3血 / long=5血 / …）；--drainHp=N 覆盖摄魂指法的启用血量门槛。 */
const MODE = FLAG.mode || '';
const DRAINHP = Number(FLAG.drainHp || 0);
if (MODE && !R.MODES[MODE]) { console.error('--mode 未知: ' + MODE + '（可选: ' + Object.keys(R.MODES).join(' ') + '）'); process.exit(1); }
if (DRAINHP > 0) { R.MODES[MODE || 'multi'].drainHpMax = DRAINHP; }
const FIELD = FLAG.field || '';
const FIELDS = {
  focusfire: ['focusfire', 'focusfire', 'focusfire', 'focusfire'],
  focusme:   ['focusme', 'focusme', 'focusme', 'focusme'],   // 4 个定向打主体的攻击者（太狠：实测冠军 5th 95%，秒杀）
  /* N=4 会把主体第 1~2 回合就打死，什么也测不到；转移伤害的盈亏平衡点是 **N≥2**
   * （承伤 N 时省 N + 转出 N = 摆幅 2N，每ジ收益 N；枪是每ジ 1 ⇒ N≥1 就该赚，
   *  实测 avg 每次只转 1 点，真实条件是"同回合有 ≥2 点可转"）⇒ 用 2 个攻击者 + 2 个中性。 */
  focusme2:  ['focusme', 'focusme', 'random', 'defend'],
  tank:      ['tankline', 'tankline', 'tankline', 'tankline'],
  mine:      ['aggro', 'defend', 'antidef', 'wall'],    // 这四个脚本都有铺雷分支（bots.js:114/125/146/214）
  minespam:  ['minespam', 'minespam', 'minespam', 'minespam'],   // v1.4.1：饱和火焰源（专精铺雷者 ×4）
  cursestorm:['cursestorm', 'cursestorm', 'cursestorm', 'cursestorm'],
  /* v1.4.7：四种"单一防御墙"（4 个座位同一种，允许重复）——复验第十轮复核的头号发现 */
  reflectwall:['reflectspam', 'reflectspam', 'reflectspam', 'reflectspam'],
  guardwall:  ['guardspam', 'guardspam', 'guardspam', 'guardspam'],
  baguawall:  ['baguaspam', 'baguaspam', 'baguaspam', 'baguaspam'],
  protowall:  ['protowall', 'protowall', 'protowall', 'protowall']
};
if (FIELD) {
  if (!FIELDS[FIELD]) { console.error('--field 未知: ' + FIELD + '（可选: ' + Object.keys(FIELDS).join(' ') + '）'); process.exit(1); }
  combos.length = 0;
  combos.push(FIELDS[FIELD]);
}

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
  /* v1.3.60 前置条件自检：没有这三个数，"条件性卡的 Δ" 无法解释 ——
   * 中性场上 转移伤害 的 Δ=−30.8pt 完全可能只是"前置条件不存在"。 */
  let takenSum = 0, transferEv = 0, fireEv = 0, takenGames = 0, roundSum = 0;
  /* v1.4.7 机制读数（第十轮复核 §3.2/3.3 用的量）：自己的攻击被弹回几次、平局率、终局血量。
   * `reflect` 事件的语义是 {to: 格挡持有者(墙), from: 攻击者(主体)} ⇒ 数 from===seat 就是"我被打回"。 */
  let reflectSelf = 0, drawGames = 0, hpEndSum = 0;
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
        } else {
          const nm = field[oi % field.length];
          choosers.push(asChooser(nm === 'focusme' ? makeFocusMe(seat) : FN[nm]));
          oi++;
        }
      }
      /* --regen=N：每回合给所有人 +N ep（对应 evo.regenForGame 的补贴切片）。
       * 用途：检验"某张卡难用"到底是**卡本身**的问题，还是**攒不起钱**（经济锁）的问题。 */
      const GOPT = {};
      if (REGEN) GOPT.regen = REGEN;
      if (MODE) GOPT.mode = MODE;
      const grantHook = makeGrantHook(seat);      // 钩子要捕获本局座位，故在循环内构造
      if (grantHook) GOPT.onRoundStart = grantHook;
      const r = T.oneGameN(choosers, SEED + g * 977 + total, N, Object.keys(GOPT).length ? GOPT : undefined);
      const rank = T.rankOf(r.state, seat, SEED + g * 977 + total);   // v1.3.57: 名次平局用本局种子洗牌（pid 中性）
      ranks[rank - 1]++;
      seatGames[seat]++; if (rank === 1) seatFirst[seat]++;
      if (hasDeep) { deepGames++; if (rank === 1) deepFirst++; }
      else { shallowGames++; if (rank === 1) shallowFirst++; }
      for (const e of r.state.events) {
        if (e.type === 'damage' && e.to === seat) takenSum += e.amt;
        if (e.type === 'damage' && (e.via === R.SK.MINE || e.via === R.SK.FIRESTORM)) fireEv++;
        if (e.type === 'transfer') transferEv++;
        if (e.type === 'reflect' && e.from === seat) reflectSelf++;
      }
      if (r.winner === 'draw') drawGames++;
      hpEndSum += Math.max(0, r.state.p[seat].hp);
      takenGames++; roundSum += r.rounds;
      total++;
    }
  }
  const pct = function (x, y) { return y ? (x / y * 100).toFixed(1) + '%' : '-'; };
  return {
    label: label, total: total, ranks: ranks, use: use, decisions: decisions,
    maxEp: maxEp, epGe3: epGe3, cost3: cost3Picks.n, epBands: epBands,
    seatFirst: seatFirst, seatGames: seatGames,
    deepGames: deepGames, deepFirst: deepFirst, shallowGames: shallowGames, shallowFirst: shallowFirst,
    takenPerGame: takenGames ? takenSum / takenGames : 0, transferEv: transferEv, fireEv: fireEv,
    reflectSelfPerGame: takenGames ? reflectSelf / takenGames : 0,
    drawRate: takenGames ? drawGames / takenGames : 0,
    hpEnd: takenGames ? hpEndSum / takenGames : 0,
    avgRounds: takenGames ? roundSum / takenGames : 0,
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
if (FIELD) console.log('!! 前置条件场 --field=' + FIELD + ' : ' + FIELDS[FIELD].join(' ') + '（允许重复）');
if (REGEN) console.log('!! 经济补贴 regen=' + REGEN + ' ep/回合（全体，非线上规则）');
if (MODE) console.log('!! 模式 --mode=' + MODE + ' : ' + R.MODES[MODE].name + '  hp=' + R.MODES[MODE].hp + '  摄魂门槛 HP<=' + ((R.MODES[MODE].drainHpMax) || 1));
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
const PAY_CASTS = { n: 0 };   // 消融自检：payload 到底被打出去了几次
function makeSaver(payloadKey) {
  return function (state, pid, legal) {
    const by = {};
    for (const l of legal) by[l.key] = l;
    if (by[payloadKey] && by[payloadKey].affordable) {
      /* v1.3.59：必须先证明实验真的跑到了。`转移伤害`/`藤甲`/`地雷` 有**条件门**，
       * 条件不满足时 play.js 不会把它放进 legal ⇒ saver 会一直出ジ，
       * Δ 静默变成"恒出ジ vs 自由发挥"的差值 —— 读起来像结论，其实什么都没测。 */
      PAY_CASTS.n++;
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
const PAY_KEY = { bigT: R.SK.BIG_T, tank: R.SK.TANK, railgun: R.SK.RAILGUN, snipe: R.SK.SNIPE, dualGun: R.SK.DUAL_GUN, laserEye: R.SK.LASER_EYE, mirror: R.SK.MIRROR,
  armor: R.SK.ARMOR, mine: R.SK.MINE, transfer: R.SK.TRANSFER,     // v1.3.59：用户点名的藤甲/地雷/转移三张多人卡
  drain: R.SK.DRAIN,                                                 // v1.4.0：摄魂指法（自我门控：只在 HP≤门槛 时可选 ⇒ 贪心注入正好是正确用法）
  gun: R.SK.GUN, sword: R.SK.SWORD,                                 // v1.4.7：report 的 INSTR 已推荐 --inject=sword/gun，表里缺会直接 exit(1)
  reflect: R.SK.REFLECT, guard: R.SK.GUARD, ring: R.SK.RING,        // v1.3.60：费用 0 的防御族对照（反弹 vs 藤甲）
  curse: R.SK.CURSE, firestorm: R.SK.FIRESTORM };                   // v1.3.60：**贴贴(符咒) × 天火(引爆)** 组合对
/* ===== 边际注入（v1.3.59，用户要的"边际价值"口径）=====
 * 为什么需要：`--payload` 的 saver 架构是"一直出ジ，攒够就打 payload"。
 * 对**纯辅助/防御**卡（藤甲/转移/地雷）这等于**全程不攻击** ⇒ 测出来的是
 * "只防守不还手会输"这个平凡事实，而不是这张卡的边际价值（实测 transfer 1st=2.6% 远低于随机 12.3%）。
 * 注入口径：主体仍打冠军策略，只在**这张卡可负担且合法**时优先用它 ⇒ Δ 就是这张卡
 * "能用就用"相对于冠军自身策略的净收益。同样带自检计数。 */
const INJECT = FLAG.inject || '';
const INJ = { n: 0, dec: 0 };
const injectSel = !INJECT ? null : (function () {   // 惰性：无 --inject 时绝不能求值（否则 PAY_KEY[''] 未定义 -> exit(1)，把基线臂一起干掉）
  const k = PAY_KEY[INJECT];
  if (!k) { console.error('--inject 未知: ' + INJECT + '（可选: ' + Object.keys(PAY_KEY).join(' ') + '）'); process.exit(1); }
  return function () {
    const inner = T.policyChooserN(params, 0.15);
    return function (state, pid, legal) {
      INJ.dec++;
      const by = {};
      for (const l of legal) by[l.key] = l;
      if (by[k] && by[k].affordable) {
        INJ.n++;
        return { key: k, target: T.pickTargetN(state, pid, k), target2: null };
      }
      return inner(state, pid, legal);
    };
  };
})();
/* ===== --combo=<name>：**组合技主体**（用户 2026-09-12：这类卡需要专门的脚本）=====
 * 为什么 mono-spam 原理上测不到它：贴贴×天火的价值来自一条**轨迹** ——
 *   「先贴 N 枚符咒，再每回合引爆 N 点火伤」（天火"符咒仍存"，可重复引爆到 age>3）。
 * 单动作口径只能表达"一直贴"或"一直引爆"，两者都接近什么都不做
 * ⇒ 旧报告把两张卡都判成"辅助/防御（Δ 结构性为负）"，那不是结论，是口径的表达能力上限。
 * 本主体：已有我的符咒 → 天火引爆；否则 → 贴贴给血最少的对手；其余回合照打冠军策略。 */
const COMBO = FLAG.combo || '';
const COMBO_ST = { curse: 0, detonate: 0, save: 0, dec: 0 };
const STACK = Number((COMBO.split(':')[1]) || 3);   // 先叠几张符咒再进引爆循环
function buildComboSel() {
  return function () {
    const inner = T.policyChooserN(params, 0.15);
    return function (state, pid, legal) {
      COMBO_ST.dec++;
      const by = {};
      for (const l of legal) by[l.key] = l;
      const mine = [];
      for (const o of S.opponentsOf(state, pid)) {
        let n = 0;
        const st = state.p[o].stickers || [];
        for (const x of st) if (x.owner === pid && x.age <= 3) n++;
        if (n > 0) mine.push({ o: o, n: n });
      }
      mine.sort(function (a, b) { return (state.p[a.o].hp - state.p[b.o].hp) || (b.n - a.n); });
      const FS = by[R.SK.FIRESTORM], CU = by[R.SK.CURSE];
      const JI = by[R.SK.JI];
      /* ⚠️ 第一版在这里错了：见 CU 能买就贴 ⇒ 永远停在 1 ジ，攒不到天火的 2 ジ。
       * 实测 23031 次决策里贴符咒 10907 次、天火只引爆 **8** 次（1st 0.1%）。
       * 组合技**必须先承诺攒钱**（ep 的唯一来源是 ジ 的 +1，`resolve.js:501`），
       * 与 evo.js 的 makeCommitChooser"承诺级 ε"是同一件事。 */
      /* 叠层数：1 张符咒 = 天火每 3 回合 1 点火伤（0.33 伤/回合，实测 1st 5.5%）；
       * 必须先叠到 N 张再进引爆循环，N 张 = 每次引爆 N 点火伤。
       * 这是"轨迹"，单动作口径永远表达不了 —— 也正是用户说需要专门脚本的原因。 */
      const stk = mine.length ? mine[0].n : 0;
      if (stk >= STACK) {
        if (FS && FS.affordable) { COMBO_ST.detonate++; return { key: R.SK.FIRESTORM, target: mine[0].o, target2: null }; }
        COMBO_ST.save++;
        if (JI && JI.affordable) return { key: R.SK.JI, target: null, target2: null };
        return inner(state, pid, legal);
      }
      if (CU && CU.affordable) {
        const opp = S.opponentsOf(state, pid).slice().sort(function (a, b) { return state.p[a].hp - state.p[b].hp; });
        COMBO_ST.curse++;
        return { key: R.SK.CURSE, target: opp[0], target2: null };
      }
      COMBO_ST.save++;
      if (JI && JI.affordable) return { key: R.SK.JI, target: null, target2: null };
      return inner(state, pid, legal);
    };
  };
}
/* ===== --plan=<name>：**连招主体**（序列口径，mono-spam 原理上表达不了）=====
 * 用户 2026-09-12 指出：蓄能/聚能环/贴贴这类连招"总不能测单技能结果"。
 * 实测动机：给冠军每回合白送 1 枚电珠，它就从 38.4% 涨到 **51.2%**（+12.8pt）——
 * 而珠子按 R9' 回合末清空，所以 蓄能(1 ジ) → 下回合 电磁炮(2 ジ) 是一条**必须连着的两回合轨迹**。
 * 本主体：有电珠且买得起 → 电磁炮；没电珠且买得起蓄能 → 蓄能；否则照打冠军策略。
 * 注意：蓄能的珠型由 play.js 的 beadOf() 决定（elec==boom 时取电珠）⇒ 不需要额外指定。 */
const PLAN = FLAG.plan || '';
const PLAN_ST = { charge: 0, rail: 0, save: 0, dec: 0 };
function buildChargeRailgunSel() {
  return function () {
    const inner = T.policyChooserN(params, 0.15);
    return function (state, pid, legal) {
      PLAN_ST.dec++;
      const by = {};
      for (const l of legal) by[l.key] = l;
      const me = state.p[pid];
      const opp = S.opponentsOf(state, pid).slice().sort(function (a, b) {
        return state.p[a].hp - state.p[b].hp || a - b;
      });
      const t = opp.length ? opp[0] : null;
      if (by[R.SK.RAILGUN] && by[R.SK.RAILGUN].affordable && me.elec >= 1 && t != null) {
        PLAN_ST.rail++;
        return { key: R.SK.RAILGUN, target: t, target2: null };
      }
      /* 蓄能只在 **ep>=3** 时用 —— 这是 R9'+resolve.js:501 逼出来的硬条件：
       *   · 蓄能不给 ep 收入（唯一来源是 ジ 的 +1）；
       *   · 珠子时效 R9'（resolve.js:790-796）只有"本回合新蓄"才保留 ⇒ 持珠那回合若打 ジ 攒钱，
       *     珠子会在回合末被清空。
       * 所以要一次到位：ep>=3 蓄能（ep→2，珠=电）→ 下回合 ep=2（无收入）+珠 → 电磁炮。
       * 第一版我在 ep=1 就蓄能 ⇒ 永远差 1 点，28401 次决策只打出 1 次电磁炮（1st 0.8%）。 */
      if (me.elec < 1 && me.ep >= 3 && by[R.SK.CHARGE] && by[R.SK.CHARGE].affordable) {
        PLAN_ST.charge++;
        return { key: R.SK.CHARGE, target: null, target2: null };
      }
      if (me.elec < 1 && me.ep < 3 && by[R.SK.JI] && by[R.SK.JI].affordable) {
        PLAN_ST.save++;                      // 先攒到 3 再蓄能（这段是连招的**轨迹成本**）
        return { key: R.SK.JI, target: null, target2: null };
      }
      return inner(state, pid, legal);
    };
  };
}
const planOk = PLAN === '' || PLAN === 'chargeRailgun';
if (PLAN && !planOk) { console.error('--plan 未知: ' + PLAN + '（可选: chargeRailgun）'); process.exit(1); }
const planSubjectSel = (PLAN === 'chargeRailgun') ? buildChargeRailgunSel() : null;

const comboLabel = '组合技·贴贴×天火';
const comboOk = COMBO === '' || COMBO === 'curseStorm' || /^curseStorm:\d+$/.test(COMBO);
if (COMBO && !comboOk) { console.error('--combo 未知: ' + COMBO + '（可选: curseStorm）'); process.exit(1); }
const comboSubjectSel = (!COMBO || !comboOk) ? null : buildComboSel();
const pureSel = !PURE ? null : buildPureSel();     // 必须在 PAY_KEY 声明之后
const banSel = !BAN ? null : buildBanSel();        // 必须在 PAY_KEY 声明之后
const smartSel = !SM ? null : buildSmartSel();     // 必须在 PAY_KEY 声明之后
const subjectSel = (PURE && !PAYLOAD && !INJECT && !SMART && !COMBO && !BAN && !planSubjectSel)
  ? pureSel
  : (planSubjectSel && !PAYLOAD && !INJECT && !SMART && !COMBO)
  ? planSubjectSel
  : (BAN && !PAYLOAD && !INJECT && !SMART && !COMBO)
  ? banSel
  : (COMBO && !PAYLOAD && !INJECT && !SMART)
  ? comboSubjectSel
  : (SMART && !PAYLOAD && !INJECT)
  ? smartSel
  : (INJECT && !PAYLOAD)
  ? injectSel
  : PAYLOAD
  ? (function () {
    const k = PAY_KEY[PAYLOAD];
    if (!k) { console.error('--payload 未知: ' + PAYLOAD + '（可选: ' + Object.keys(PAY_KEY).join(' ') + '）'); process.exit(1); }
    return function () { return asChooser(makeSaver(k)); };
  })()
  : (SUBJECT
    ? function () { return asChooser(FN[SUBJECT]); }
    : function () { return T.policyChooserN(params, 0.15); });
const subjectLabel = PAYLOAD ? ('消融·只换弹头 ' + PAYLOAD)
  : (PURE && !INJECT && !SMART && !COMBO && !BAN && !planSubjectSel) ? ('纯招·只出 ' + PURE + ' + ジ')
  : (planSubjectSel && !INJECT && !SMART && !COMBO) ? ('连招·蓄能→电磁炮')
  : (BAN && !INJECT && !SMART && !COMBO) ? ('消融·拿掉 ' + BAN)
  : (COMBO && !INJECT && !SMART) ? (comboLabel + ' 叠' + STACK)
  : (SMART && !INJECT) ? ('正确用法 ' + SMART)
  : INJECT ? ('边际注入·能用就用 ' + INJECT) : (SUBJECT ? ('脚本 ' + SUBJECT) : '冠军');
const champ = runSubject(subjectSel, subjectLabel);
const ctrl = runSubject(function () { return asChooser(Bots.pickRandom); }, '对照 pickRandom');

for (const s of [champ, ctrl]) {
  console.log('[' + s.label + '] 1st=' + s.pct(s.ranks[0], s.total) +
    '  2nd=' + s.pct(s.ranks[1], s.total) + '  3rd=' + s.pct(s.ranks[2], s.total) +
    '  4th=' + s.pct(s.ranks[3], s.total) + '  5th=' + s.pct(s.ranks[4], s.total) +
    '   | top2=' + s.pct(s.ranks[0] + s.ranks[1], s.total) + ' top3=' + s.pct(s.ranks[0] + s.ranks[1] + s.ranks[2], s.total));
  console.log('    各座位 1st 率: ' + s.seatGames.map(function (g, i) { return 'P' + i + '=' + s.pct(s.seatFirst[i], g); }).join(' '));
  console.log('    前置条件: 主体场均承伤=' + s.takenPerGame.toFixed(2) + '  平均回合=' + s.avgRounds.toFixed(1) + '  转移事件=' + s.transferEv + '  火焰伤害事件=' + s.fireEv);
  console.log('    机制: 自己的攻击被弹回=' + s.reflectSelfPerGame.toFixed(2) + ' 次/局  平局率=' + (s.drawRate * 100).toFixed(0) + '%  终局血量=' + s.hpEnd.toFixed(2));
  console.log('    拆分: 含深经济对手 ' + s.pct(s.deepFirst, s.deepGames) + '（' + s.deepGames + ' 局）  vs  不含 ' +
    s.pct(s.shallowFirst, s.shallowGames) + '（' + s.shallowGames + ' 局）  Δ=' +
    ((s.deepGames && s.shallowGames) ? ((s.deepFirst / s.deepGames - s.shallowFirst / s.shallowGames) * 100).toFixed(1) + 'pt' : '-'));
}

if (PURE && !PAYLOAD && !INJECT && !SMART && !COMBO && !BAN && !planSubjectSel) {
  console.log('[纯招自检] 决策 ' + PURE_ST.dec + ' 次，其中 ' + PURE + ' 可负担 ' + PURE_ST.hit + ' 次 = ' +
    (PURE_ST.dec ? (PURE_ST.hit / PURE_ST.dec * 100).toFixed(1) : '0') + '%' +
    (PURE_ST.hit === 0 ? '   !!! 从未可负担 ⇒ 纯招没跑起来，Δ 不可读' : '   OK 纯招有效'));
}
if (planSubjectSel && !PAYLOAD && !INJECT && !SMART && !COMBO) {
  console.log('[连招自检] 决策 ' + PLAN_ST.dec + ' 次：攒钱(ジ) ' + PLAN_ST.save + ' 次、蓄能 ' + PLAN_ST.charge + ' 次、电磁炮 ' + PLAN_ST.rail + ' 次' +
    (PLAN_ST.rail === 0 ? '   !!! 从未打出电磁炮 ⇒ 连招没走通，Δ 不可读' : '   OK 连招跑通了'));
}
if (BAN && !PAYLOAD && !INJECT && !SMART && !COMBO) {
  console.log('[消融自检] 决策 ' + BAN_ST.dec + ' 次，其中被拿掉的技能在可负担集里 ' + BAN_ST.legal + ' 次 = ' +
    (BAN_ST.dec ? (BAN_ST.legal / BAN_ST.dec * 100).toFixed(1) : '0') + '%' +
    (BAN_ST.legal === 0 ? '   !!! 该技能从不进 legal ⇒ 消融是空操作，Δ 不可读' : '   OK 消融有效'));
}
if (GRANT) {
  console.log('[补贴自检] --grant=' + GRANT + ' 已生效 ' + GRANT_ST.rounds + ' 个主体回合（主体回合数应≈局数×回合数）');
}
if (COMBO && !PAYLOAD && !INJECT && !SMART) {
  console.log('[组合技自检] 叠层=' + STACK + ' 决策 ' + COMBO_ST.dec + ' 次：贴符咒 ' + COMBO_ST.curse + ' 次、攒钱(ジ) ' + COMBO_ST.save + ' 次、天火引爆 ' + COMBO_ST.detonate + ' 次' +
    (COMBO_ST.detonate === 0 ? '   !!! 从未引爆 => 组合从未走通，Δ 不可读' : '   OK 组合跑通了'));
}
if (SMART && !PAYLOAD && !INJECT) {
  console.log('[正确用法自检] 决策 ' + SM_ST.cand + ' 次，条件成立且可负担 ' + SM_ST.hit + ' 次 = ' +
    (SM_ST.cand ? (SM_ST.hit / SM_ST.cand * 100).toFixed(1) : '0') + '%' +
    (SM_ST.hit === 0 ? '   !!! 0 次 => 条件从未成立，Δ 不可读' : '   OK 实验有效'));
}
if (INJECT && !PAYLOAD) {
  const r = INJ.dec ? INJ.n / INJ.dec : 0;
  console.log('[注入自检] 决策 ' + INJ.dec + ' 次，其中可用并注入 ' + INJ.n + ' 次 = ' + (r * 100).toFixed(1) + '%' +
    (INJ.n === 0 ? '   !!! 0 次 => 该卡进不了 legal（条件门），Δ 不可读' : '   OK 实验有效'));
}
if (PAYLOAD) {
  const perGame = PAY_CASTS.n / Math.max(1, champ.total);
  console.log('[消融自检] payload 实际打出 ' + PAY_CASTS.n + ' 次 = 每局 ' + perGame.toFixed(2) + ' 次' +
    (PAY_CASTS.n === 0 ? '   !!! 0 次 => 该 payload 进不了 legal（条件门），Δ 不可读'
      : (perGame < 0.05 ? '   !!! 打出过少，Δ 主要由"恒出ジ"决定' : '   OK 实验有效')));
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
