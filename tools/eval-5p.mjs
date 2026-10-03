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
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
/* v1.5.71：对手名字→函数的单一来源（见下面 ALL 的构造） */
import { OPP_SPECS } from '../server/opp-pool.mjs';
/* §E142：脚本 chooser 的包装规则搬进单一来源（见下面 `asChooser`） */
import { makeAsChooser, pushTarget } from './bot-chooser-lib.mjs';

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

/* ===== §E255 费用表反事实：`--bigtcost=<n>`（不设 ⇒ 引擎读到的仍是出厂价，一行都不多跑）=====
 * 为什么在工具里改而不是在规则里改：`js/core/rules.js` 是指纹五件套，动它 = 规则换代、全部历史基线作废（仓里硬规矩）。
 * 这里只在**本进程内存里**改 `R.byKey[BIG_T].cost`，仓库文件一字不动 ⇒ 指纹不变；同形先例 `tools/probe-ep-reach.mjs:88`。
 * ⚠ 语义是"**整个世界**都变便宜了"（脚本对手也读同一张费用表）⇒ **跨世界的绝对电平不可比**，只许引世界内的配对差。 */
const BIGTCOST = FLAG.bigtcost == null ? null : Number(FLAG.bigtcost);
let FACTORY_BIGTCOST = null;
if (FLAG.bigtcost != null) {
  if (!Number.isInteger(BIGTCOST) || BIGTCOST < 0) {
    console.error('⛔ --bigtcost 必须是 ≥0 的整数（收到 `' + FLAG.bigtcost + '`）'); process.exit(2);
  }
  const def = R && R.byKey && R.SK ? R.byKey[R.SK.BIG_T] : null;
  if (!def || typeof def.cost !== 'number') {
    console.error('⛔ 改价反事实接不上：引擎里 `R.byKey[BIG_T].cost` 不是数字（读法大概已变 ⇒ 不许静默按出厂价出读数）'); process.exit(2);
  }
  FACTORY_BIGTCOST = def.cost;
  def.cost = BIGTCOST;
  /* 接线证据（判作用点，不判配置）：改完必须让**引擎自己**报出新价，否则就是"设了等于没设"（METHODOLOGY 第一条那一族）。 */
  const probe = S.computeCost(S.createState('multi', { next: T.mulberry32(7) }, N), 0, R.SK.BIG_T);
  const epSeen = probe && probe.ok !== false ? probe.ep : null;
  if (epSeen !== BIGTCOST) {
    console.error('⛔ 改价没生效：`computeCost` 仍报 大雷 ep=' + epSeen + '（要的是 ' + BIGTCOST + '）⇒ 有别的缓存在定价，本实验会量到假世界'); process.exit(2);
  }
  console.log('[bigtcost] 费用表反事实生效：大雷单价 **出厂 ' + FACTORY_BIGTCOST + ' → 本世界 ' + BIGTCOST + '**'
    + '（`computeCost` 回读 ep=' + epSeen + '；只在内存里，`js/core/*` 一字未动）'
    + ' ⚠ 所有席都在这个改价世界里 ⇒ 只引世界内配对差，不许引跨世界电平');
}

const src = readFileSync(FILE, 'utf8');
const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
if (!mm) { console.error('未找到 EPIRUS_CHAMPION_3P: ' + FILE); process.exit(1); }
const metaM = src.match(/window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('冠军包不兼容: ' + JSON.stringify(P.checkPack(JSON.parse(mm[1])))); process.exit(1); }
/* ===== §E136：`--swap=<第二粒包>@<回合R>` —— **不识别任何环境，只按"第几回合"换权重** =====
 * 为什么要这条：§E135 已经量到"桌面早期信息分不开这 33 个原型"（可分原型数最好 14/33，线在 25），
 * 于是"环境自适应"里剩下的可量版本就是**阶段条件化**。这条把决定权交给回合数，不需要任何识别能力。
 * ⚠ 默认关：不带 `--swap` 时走的必须还是原来那条 `T.policyChooserN(params, 0.15)`（门 D197 用"换包点写在终局之后
 *    ⇒ 与不换包**逐位相同**"钉住这件事），产品口径的量具不许被加一条悄悄生效的分支。 */
const SWAP = FLAG.swap || '';
let SWAP_FILE = '', SWAP_ROUND = 0, swapParams = null;
if (SWAP) {
  const at = SWAP.lastIndexOf('@');
  SWAP_FILE = at < 0 ? '' : SWAP.slice(0, at);
  SWAP_ROUND = at < 0 ? NaN : Number(SWAP.slice(at + 1));
  if (!SWAP_FILE || !existsSync(SWAP_FILE)) {
    console.error('--swap 要写成 `<第二粒包路径>@<回合R>`，且第二粒包必须存在（实测 `' + SWAP + '`）'); process.exit(2);
  }
  if (!isFinite(SWAP_ROUND) || SWAP_ROUND < 1 || Math.floor(SWAP_ROUND) !== SWAP_ROUND) {
    console.error('--swap 的回合必须是 ≥1 的整数（实测 `' + SWAP + '`）⇒ 拒绝拿"第 0 回合换包"当基线'); process.exit(2);
  }
  const src2 = readFileSync(SWAP_FILE, 'utf8');
  const m2 = /window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src2);
  if (!m2) { console.error('--swap 的第二粒包里没有冠军外壳：' + SWAP_FILE); process.exit(2); }
  let p2 = null;
  try { p2 = P.unpack(JSON.parse(m2[1]), true); } catch (e) { p2 = null; }
  if (!p2) { console.error('--swap 的第二粒包不兼容（维度/版本）：' + SWAP_FILE); process.exit(2); }
  if (SWAP_FILE === FILE) { console.error('--swap 的第二粒包与主包是同一个文件 ⇒ 这一臂没有可测之差'); process.exit(2); }
  swapParams = p2;
}
/** 主体席的 chooser：`makeSel()` 每局调一次 ⇒ 这里给的是"这一局用的策略对象" */
function subjectPolicy() {
  const a = T.policyChooserN(params, 0.15);
  if (!swapParams) return a;
  const b = T.policyChooserN(swapParams, 0.15);
  return function (state, id, legal) { return (state.round >= SWAP_ROUND ? b : a)(state, id, legal); };
}
/* ⚠ `--swap` 只与"纯冠军主体"组合。其余主体改写（`--subject/--payload/--inject/--smart/--combo/--pure/--ban/--plan`）
 * 会各自接管主体席 ⇒ 若允许同时给，`--swap` 会被**静默忽略**（那比报错危险得多），所以在这里直接拒。
 * 这些 FLAG 在上面是后定义的 ⇒ 检查只能放在这里，不能挪到解析 `--swap` 的那一段。
 * ⚠ `--field` **不在**这个名单里：它只改对手场（`combos` 换成一组固定脚本），不碰主体席 ⇒
 *   与 `--swap` 兼容，而且它是唯一能把一臂压到"1 组 × 几局"的便宜口径（门 D197 靠它）。 */
if (swapParams && (FLAG.subject || FLAG.payload || FLAG.inject || FLAG.smart || FLAG.combo || FLAG.pure || FLAG.ban || FLAG.plan)) {
  console.error('--swap 只能单独用（它会与 --subject/--payload/--inject/--smart/--combo/--pure/--ban/--plan 抢主体席，'
    + '同时给就会被静默忽略）⇒ 拒绝出读数'); process.exit(2);
}

/* ---------- 对手池 ---------- */
/* v1.5.71：名字→函数**从训练池的单一来源派生**（`server/opp-pool.mjs` 的 `OPP_SPECS`），
 * 再补上只属于评测的器材（focusfire / minespam / cursestorm —— 它们故意不进训练池）。
 * 起因（又一个"加名字漏一处"）：`--field=targeter` 直接崩栈 —— 这个文件自己持有一份名字表，
 * 而 `opp-pool.mjs` 的文件头已记录过同类事故三次（v1.3.59 漏 worker、v1.4.8 漏 server、
 * v1.4.14 漏 eval-5p）。派生之后，往 OPP_SPECS 加对手就自动在评测里可见。 */
const EVAL_ONLY = [
  /* v1.3.60：集火脚本。转移伤害的价值 ∝ 本回合承伤 N，而 pickFocusFire 的注释写明
   * "当前 meta 里 N>=2 的唯一常见来源就是被集火" ⇒ 它是转移伤害的**前置条件提供者**。 */
  ['focusfire', Bots.pickFocusFire],
  /* v1.4.1：前置条件提供者（铺雷者 / 贴符咒+天火者），池里原先没有 ⇒ 藤甲的火弱、
   * 贴贴×天火这两条线在任何考卷上都测不到。 */
  ['minespam', Bots.pickMineSpam], ['cursestorm', Bots.pickCurseStorm]
];
const ALL = OPP_SPECS
  .map(function (o) { return [o.name, Bots[o.fn]]; })
  .concat(EVAL_ONLY);
/* 登记了名字但取不到函数 ⇒ **响亮报错**（不许静默剔除：那正是"漏一处"变成静默半开的老路） */
for (const kv of ALL) {
  if (typeof kv[1] !== 'function') {
    console.error('对手登记了但函数不存在: ' + kv[0] + '（核对 server/opp-pool.mjs 的 fn 与 js/train/bots.js 的导出）');
    process.exit(1);
  }
}
/* "深经济对手"的定义：会攒钱**并且**会把攒的钱换成重击。farmer 只攒不还手，不算。 */
const DEEP = { deepsaver: 1, heavyfire: 1 };
/* ===== E62（qoder 09-27 晚）：**反弹席**分箱 —— 只记录，不判 =====
 * 动因：`Ldemo` 上槽前已知"反弹墙里主动伤害 2.00/局 vs 在位 21.00"，而我昨夜那把
 * 环境尺复量到它对**反弹系**的胜率掉得最狠（`defreflectgun` 60%→21%、`reflectspam` 60%→41%）。
 * ⇒ 本分箱量的是**混合桌**（14,950 组合 × 4 局）里"至少一席反弹"的那一格，与"整桌都是反弹"是两场不同的仗。
 * ⚠ **09-28 更正（我原来把这条动因写成了"判据盲区"，那是错的）**：单型反弹场**早就有覆盖** ——
 *   `--field=reflectwall`（4 席 reflectspam · v1.4.7）+ `promote` 的反弹墙闸（v1.5.28）+ `champ-audit` 的 D 列（就是这一场的 1st 率）。
 *   真缺口不是"没有场"，是**这一场阻断的量选的是伤害/穿透落地（`pierceLand>0`、`dmgPerGame>0.5`），胜率只印不判**
 *   （v1.5.59 因"1st 被并列污染"把它降权）⇒ 实测线上包在 D 列 **0%**、被换下的旧包 **99%**（§E63）。
 *   另：G4 是 **8 格**（v1.5.129 加了「珠爆发」），其中仍没有反弹型反手格 —— 那句本来是对的，但它不等于"反弹场没尺"。
 * 严格口径：只算 `reflectspam`（脚本行为就是刷反弹）；`protowall`/`wall` 是墙不是反弹，不算。 */
const REFL = { reflectspam: 1 };
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
/* `--every=N`（§E136）：**只取每第 N 个组合**，用来把"要跑 8 个臂"的实验压进可接受的时间。
 * 默认 1 ⇒ 数组逐位不变（不重新洗牌、不抽样偏移），所以老读数的口径不动。
 * 采样后**组合数会印在表头上**（下面那行 `全部 N 组合`），所以"我少跑了多少"不可能被藏起来。 */
const EVERY = Number(FLAG.every || 1);
if (!(EVERY >= 1) || !isFinite(EVERY) || Math.floor(EVERY) !== EVERY) {
  console.error('--every 必须是 ≥1 的整数（实测 `' + (FLAG.every || '') + '`）⇒ 拒绝拿一个含糊的采样率出结论'); process.exit(2);
}
/* 采样是**确定性的**（`i % EVERY === 0` ⇒ 同 seed 同池子内不同臂面对同一批桌子，配对才成立），
 * 但它**不是无偏的**：桌子按池子名字的字典序枚举，每第 7 张会采出一种**格点**，
 * 于是子集上的绝对水平可能与全池差 1pt 级别（§E136 实测：同一粒包全池 42.5% ‖ 每第 7 张 41.7%）。
 * ⇒ 落盘里必须带 `#every`，任何跨口径比较都要先问"是不是同一批桌子"（头部也会响亮印出来）。 */
if (EVERY > 1) {
  const kept = [];
  for (let i = 0; i < combos.length; i++) if (i % EVERY === 0) kept.push(combos[i]);
  combos.length = 0;
  for (const c of kept) combos.push(c);
}

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
/* ⚠ 这面旗标的正写是 `--drainHp`（**大写 H**）：解析器按原样保留键名 ⇒ `--drainhp=3` 落进 `FLAG.drainhp`，
 *   没人读它 ⇒ 那一臂的"放宽窗口"根本不存在，读数却会归因给它（§E265 自我报告 #11：我今天就是这么写的，门 D223 ⑤i 当场判红）。
 *   含糊拼写一律 exit 2，不许降级成"当没写"。 */
if (FLAG.drainhp != null) {
  console.error('⛔ 拼写是 `--drainHp=`（大写 H），收到 `--drainhp=' + FLAG.drainhp + '` ⇒ 这面键不在解析表里、会被静默忽略，拒跑'); process.exit(2);
}
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
  protowall:  ['protowall', 'protowall', 'protowall', 'protowall'],
  /* v1.4.11：4 个开环经济流 —— 用来测"小雷反制聚能环"这条线的价值（用户指出：小雷不是陷阱卡，
   * 最典型的用法就是打掉别人的环）。 */
  ringwall:   ['ringspam', 'ringspam', 'ringspam', 'ringspam'],
  /* 半墙：2 个开环 + 2 个普通进攻，避免纯经济场退化 */
  ringmix:    ['ringspam', 'ringspam', 'aggro', 'random'],
  /* v1.5.71（第五轮复核 §4-1/§4-2）：**会瞄人的对手**场 —— 复核反向验证的现成器材。
   * 复核实测：给 4 席对手加一条"谁用狙击就瞄谁"的规则 ⇒ 候选 v17-146 的夺冠率 30% → 0%
   * ⇒ 这条场就是"狙击专精是不是假优势"的判决实验（`--field=targeter` vs 默认 A 考卷）。
   * `sniperwall` = 4 席狙击专精（量生存/胜率；**没有靶向判别力**，见 tools/probe-sniper.mjs）；
   * `snipermix` = 1 席狙击 + 3 席只攒不还手 = 探针里的"混合场"（低压力场里出不出手）。 */
  targeter:   ['targeter', 'targeter', 'targeter', 'targeter'],
  sniperwall: ['snipespam', 'snipespam', 'snipespam', 'snipespam'],
  snipermix:  ['snipespam', 'farmer', 'farmer', 'farmer'],
  /* v1.5.36（第三方复核 §4-1/§4-2）：
   * mix4 = **4 个不同风格同时在场**（最接近"人来打"的构造；A 考卷一局只面对 1~2 个脚本 ⇒ 对这类退化完全无感）；
   * farmerwall = **4 席只按ジ**（"面对不还手的对手它自己也不动手"这个从 v1.5.17 就存在的空洞，此前没有任何指标覆盖）。 */
  mix4:       ['aggro', 'defend', 'wall', 'farmer'],
  farmerwall: ['farmer', 'farmer', 'farmer', 'farmer']
};
if (FIELD) {
  if (!FIELDS[FIELD]) { console.error('--field 未知: ' + FIELD + '（可选: ' + Object.keys(FIELDS).join(' ') + '）'); process.exit(1); }
  combos.length = 0;
  combos.push(FIELDS[FIELD]);
}

/* 脚本 chooser 包一层：与 evo.wrapBotN 同规则，但**保留脚本自己选的目标**
 * （v1.3.55 修好了 wrapBotN；评测原先为了避免反过来依赖被测代码而独立实现了一份，
 *  §E142 起这份搬进 `tools/bot-chooser-lib.mjs` 当唯一来源 —— 两份同构实现漂移的话，
 *  "评测里的对手"和"探针里的对手"就不是同一种对手，而 §E142 的 `oracle − best_single` 要求 33 个原型用同一套对手规则。
 *  行为逐字不变由门 D200 钉（改动前后 stdout 逐字相同）。 */
const asChooser = makeAsChooser({ T: T, R: R });

function runSubject(makeSel, label) {
  const ranks = new Array(N).fill(0);
  const seatFirst = new Array(N).fill(0), seatGames = new Array(N).fill(0);
  const use = {}, cost3Picks = { n: 0 };
  const epBands = [0, 0, 0, 0];          // 决策时的 ep 分带：0-1 / 2-4 / 5-9 / 10+
  let maxEp = 0, epGe3 = 0, decisions = 0;
  let deepGames = 0, deepFirst = 0, shallowGames = 0, shallowFirst = 0;
  /* 反弹席分箱与深经济分箱**可以同真**（一桌里既能有大雷/重火力也能有反弹）⇒ 不用 else。 */
  let reflGames = 0, reflFirst = 0, noreflGames = 0, noreflFirst = 0;
  let total = 0;
  /* v1.3.60 前置条件自检：没有这三个数，"条件性卡的 Δ" 无法解释 ——
   * 中性场上 转移伤害 的 Δ=−30.8pt 完全可能只是"前置条件不存在"。 */
  let takenSum = 0, transferEv = 0, fireEv = 0, takenGames = 0, roundSum = 0;
  /* v1.4.7 机制读数（第十轮复核 §3.2/3.3 用的量）：自己的攻击被弹回几次、平局率、终局血量。
   * `reflect` 事件的语义是 {to: 格挡持有者(墙), from: 攻击者(主体)} ⇒ 数 from===seat 就是"我被打回"。 */
  let reflectSelf = 0, drawGames = 0, hpEndSum = 0;
  /* v1.5.58（第五轮复核 §4-1）：`1st` 走 rankOf ⇒ **并列算第一**（'熬满'场里多打 1 点伤害就第一）。
   * 并报严格口径：严胜 = 引擎判我们赢；并列 = 名次第一但引擎没判我们赢。 */
  let strictFirst = 0, tieOnlyFirst = 0;
  /* §E136 配对区间要用**逐桌子**的命中数（汇总百分比算不出配对差，§E137 那种"未配对 SE"只能偏保守地板）。
   * 每桌三个计数器是**无条件**累计的（不改任何判据、不改 stdout），只有给了 `--dump-per=<file>` 才落盘
   *   ⇒ 不带旗标时逐字输出与老版本完全相同（门 D197 ②/⑤、D198 ⑪′ 钉的就是"逐字"而不是"大致"）。 */
  const perCombo = [];
  for (const combo of combos) {
    let cGames = 0, cFirst = 0, cStrict = 0;
    const hasDeep = combo.some(function (nm) { return !!DEEP[nm]; });
    const hasRefl = combo.some(function (nm) { return !!REFL[nm]; });
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
          /* v1.5.71：场里出现未登记的名字必须**报错点名**，不许崩栈
           * （`--field=targeter` 曾因漏登记而 `asChooser(undefined)` 抛栈，真因被埋掉）。 */
          if (nm !== 'focusme' && !FN[nm]) {
            console.error('--field 里的对手未登记: ' + nm + '（可选: ' + ALL.map(function (x) { return x[0]; }).join(' ') + '）');
            process.exit(1);
          }
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
      if (r.winner === seat) strictFirst++;
      else if (rank === 1) tieOnlyFirst++;
      seatGames[seat]++; if (rank === 1) seatFirst[seat]++;
      if (hasDeep) { deepGames++; if (rank === 1) deepFirst++; }
      else { shallowGames++; if (rank === 1) shallowFirst++; }
      if (hasRefl) { reflGames++; if (rank === 1) reflFirst++; }
      else { noreflGames++; if (rank === 1) noreflFirst++; }
      for (const e of r.state.events) {
        if (e.type === 'damage' && e.to === seat) takenSum += e.amt;
        if (e.type === 'damage' && (e.via === R.SK.MINE || e.via === R.SK.FIRESTORM)) fireEv++;
        if (e.type === 'transfer') transferEv++;
        if (e.type === 'reflect' && e.from === seat) reflectSelf++;
      }
      if (r.winner === 'draw') drawGames++;
      hpEndSum += Math.max(0, r.state.p[seat].hp);
      takenGames++; roundSum += r.rounds;
      cGames++; if (rank === 1) cFirst++; if (r.winner === seat) cStrict++;
      total++;
    }
    perCombo.push({ names: combo.join(','), games: cGames, first: cFirst, strict: cStrict });
  }
  const pct = function (x, y) { return y ? (x / y * 100).toFixed(1) + '%' : '-'; };
  return {
    label: label, total: total, ranks: ranks, use: use, decisions: decisions,
    maxEp: maxEp, epGe3: epGe3, cost3: cost3Picks.n, epBands: epBands,
    seatFirst: seatFirst, seatGames: seatGames,
    deepGames: deepGames, deepFirst: deepFirst, shallowGames: shallowGames, shallowFirst: shallowFirst,
    reflGames: reflGames, reflFirst: reflFirst, noreflGames: noreflGames, noreflFirst: noreflFirst,
    takenPerGame: takenGames ? takenSum / takenGames : 0, transferEv: transferEv, fireEv: fireEv,
    reflectSelfPerGame: takenGames ? reflectSelf / takenGames : 0,
    drawRate: takenGames ? drawGames / takenGames : 0,
    hpEnd: takenGames ? hpEndSum / takenGames : 0,
    avgRounds: takenGames ? roundSum / takenGames : 0,
    firstRate: total ? ranks[0] / total : 0,
    strictFirstRate: total ? strictFirst / total : 0,
    tieFirstRate: total ? tieOnlyFirst / total : 0,
    strictFirst: strictFirst, tieOnlyFirst: tieOnlyFirst,
    top2Rate: total ? (ranks[0] + ranks[1]) / total : 0,
    top3Rate: total ? (ranks[0] + ranks[1] + ranks[2]) / total : 0,
    perCombo: perCombo,
    pct: pct
  };
}

const hasDeepInExam = combos.filter(function (c) { return c.some(function (nm) { return !!DEEP[nm]; }); }).length;
console.log('=== ' + N + ' 人局评测 ===');
console.log('主体: ' + FILE);
console.log('meta: ' + (metaM ? metaM[1] : '{}'));
console.log('对手池(' + poolNames.length + '): ' + poolNames.join(' '));
if (EVERY > 1) console.log('!! **只取每第 ' + EVERY + ' 个组合**（确定性格点采样 ⇒ 同 seed 各臂同桌子，但**绝对水平不代表全池**' +
  ' ⇒ 跨口径引用前先问是不是同一批桌子）');
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
/* v1.4.11：**从技能表自动生成**，不再手写映射 —— 手写版漏了 miniT/charge/cannon/…
 * 于是 report 的 INSTR 推荐 `--inject=miniT` 时脚本直接 exit(1)，而我在 grep 里只看到"没有输出"，
 * 差点当成"这一臂没信号"。这是"白名单与技能表两份维护"的又一例，故改成从 R.skills 派生。 */
const PAY_KEY = {};
for (const sk of R.skills) PAY_KEY[sk.key] = sk.key;                   // v1.3.60：**贴贴(符咒) × 天火(引爆)** 组合对
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
/* ===== §E262（用户 10-03 指令）：`--bigtpush=<1..6>` = **在"打得出来"的窗口里按 1/N 抽样兑现** + `--bigttgt=<规则>` 挑该打的人 =====
 * 用户的话：「既然冠军会打环、偶尔能攒到高 ep，那就在 ep 达到 5 之后调高大雷在随机探索中的排名，并指向最有可能发动进攻或被集火的人」。
 * 与仓里已有的两族**都不相同**，所以值得单独测：
 *   · `--inject=bigT` = "**能用就用**、不挑时机不挑人"（测的是这张卡的天花板）；
 *   · `--theta=`（§E233）= 在**打分层**按 ep×费用做线性倾斜（双侧都赔，已关）；
 *   · 本旗标 = **只在 `ep≥门槛` 那扇窗口里**、按**确定性 1/N 抽样**出手（不新增随机流、不碰 `state.rng`），且**目标由规则给**。
 * ⚠ 剂量形状被门 D223 的 ④e~④h 钉住（本班自我报告 #9：先按"局内窗口序号"数 ⇒ 1/3 退化成像 1/1；再按 `round % N` ⇒ 非单调）。
 *   现在 = `hash(每局盐, 回合, 座位) % N === 0` ⇒ 兑现率在统计上就是 1/N，且不依赖桌子顺序。
 * ⚠ 默认关（不设旗标 ⇒ `PUSH=0`，主体席走的还是原来那条 `subjectPolicy()`，一行都不多跑）。 */
const PUSH_RAW = FLAG.bigtpush;
const PUSH = PUSH_RAW == null ? 0 : Number(PUSH_RAW);
const PUSH_MINEP = FLAG.pushminep == null ? 5 : Number(FLAG.pushminep);
const PUSHTGT = FLAG.bigttgt || 'net';
/* §E264②：`--pushkey=` 把这同一套"窗口 + 确定性 1/N 兑现"搬到别的卡上（默认 `bigT` = 逐字不变的老行为）。
 * 摄魂的窗口与大雷不同形：它的前提是**自己** HP≤`drainHpMax`（在 `state.js:159` 的合法性里，不在这里抄），
 * 所以配套用 `--pushminep=0` ⇒ 窗口就是"这张牌在菜单里且现在打得出来"的那些决策。 */
const PUSHKEY = FLAG.pushkey || 'bigT';
const PUSH_ST = { opp: 0, fired: 0, tgt: {}, tie: 0 };
/* 旗标**给了就必须合法**（`abc`/`0.5`/`4` 都不许降级成"当没写"——那正是本仓最怕的静默臂）；`0` 是合法的"明确关档"，
 * 留着它才能做门 D223 的零剂量证明：`--bigtpush=0` 与不设旗标必须逐字相同。 */
if (PUSH_RAW != null && !(PUSH === 0 || (Number.isInteger(PUSH) && PUSH >= 1 && PUSH <= 6))) {
  console.error('⛔ --bigtpush 只能是 0 或 1..6（0 = 明确关档；N = 每 N 个回合兑现一次；收到 `' + PUSH_RAW + '`）'); process.exit(2);
}
/* ⚠ 这两个旗标的合法性**不挂在 `if (PUSH)` 下面**：拼错目标规则/门槛而忘了开 push，
 * 会被静默当成"没写" ⇒ 那臂的读数就归因到了不存在的规则上（§E233 那条"回退链取不到要印未测"的同一族）。 */
if (FLAG.bigttgt != null && ['net', 'threat', 'bead', 'lowhp', 'focus'].indexOf(PUSHTGT) < 0) {
  console.error('⛔ --bigttgt 不认识的规则：`' + FLAG.bigttgt + '`（可选 net|threat|bead|lowhp|focus）'); process.exit(2);
}
if (FLAG.pushminep != null && (!Number.isInteger(PUSH_MINEP) || PUSH_MINEP < 0)) {
  console.error('⛔ --pushminep 要 ≥0 的整数（收到 `' + FLAG.pushminep + '`）'); process.exit(2);
}
/* `--pushkey` 同一条纪律：拼错的卡名不许降级成"当没写"（那臂的读数会归因到一张不存在的卡上）。 */
const PUSH_SK = PUSHKEY === 'bigT' ? R.SK.BIG_T : PUSHKEY === 'drain' ? R.SK.DRAIN : null;
if (FLAG.pushkey != null && !PUSH_SK) {
  console.error('⛔ --pushkey 只认识 bigT | drain（收到 `' + FLAG.pushkey + '`）'); process.exit(2);
}
const PUSH_NAME = PUSHKEY === 'drain' ? '摄魂指法' : '大雷';
if (PUSH) {
  /* 与其他"改写主体席"的旗标同时给就会被静默忽略（比报错危险得多）⇒ 直接拒。 */
  const clash = ['payload', 'inject', 'smart', 'combo', 'ban', 'pure', 'subject'].filter(function (k) { return FLAG[k]; });
  if (clash.length || planSubjectSel || swapParams) {
    console.error('⛔ --bigtpush 不能与 ' + (clash.join('/') || 'plan/swap') + ' 同时给（都抢主体席 ⇒ 会被静默忽略）'); process.exit(2);
  }
  console.log('[bigtpush] 探索提前已生效：卡=`' + PUSHKEY + '`（' + PUSH_NAME + '）**ep≥' + PUSH_MINEP + ' 且合法可付、且 `round % ' + PUSH + ' === 0` 时打**'
    + ' · 目标规则 `' + PUSHTGT + '`'
    + '（平手按座位号小者优先，不新增随机流；规则本身是 `bot-chooser-lib.pushTarget` 的纯函数，由门钉）');
}
const pushSel = !PUSH ? null : function () {
  const inner = subjectPolicy();
  /* ⚠ 剂量**不能按"第几个窗口"数**（我第一版就是这么写的：`ctr` 每局归零 ⇒ 局内窗口数常常只有 1~2 个，
   *    "1/3" 实际退化成像"1/1"：实测 fired/窗口 = 36314/36314 ‖ 33774/52905 ‖ 30124/60784 ⇒ 三档的用量差不到 1.2 倍，
   *    于是"剂量响应几乎是平的"是仪器假象，不是结论 —— §E265 自我报告 #9）。
   * ⇒ 改成**按回合取模**（`state.round % PUSH === 0`）：与"这局有几个窗口"无关，剂量是真的 1/PUSH，且仍是确定性的（不引入随机流）。 */
  return function (state, pid, legal) {
    const ep = (state.p[pid] && state.p[pid].ep) || 0;
    if (ep >= PUSH_MINEP) {
      const l = legal.find(function (x) { return x && x.key === PUSH_SK; });
      /* 可付一律问菜单自带的 `affordable`（与线上同一道闸），不在这里抄一份价钱（§E190 那一族）。 */
      if (l && l.affordable !== false) {
        /* ⚠ 分母必须是"**所有打得出来的决策**"，回合取模只能筛**是否兑现** ——
         *    我第一版把取模写进了窗口条件里 ⇒ `opp` 与 `fired` 同增同减、兑现率恒等于 100%，
         *    门 D223 的 ④f 腿（"p=3 的兑现率必须明显低于 p=1"）当场把它判红（§E265）。 */
        PUSH_ST.opp++;
        /* ⚠ 剂量换过三版，前两版都是**假剂量**（门 D223 的 ④e~④h 量出来的，见 §E265 自我报告 #9）：
         *    ① 按"局内第几个窗口"取模 ⇒ 每局窗口常常只有 1~2 个 ⇒ 1/3 退化成像 1/1（三档出手只差 1.2 倍）；
         *    ② `round % N` ⇒ **非单调**（p=2 兑现率 100%、p=3 30.4%、p=4 47.8%），因为窗口本身集中在特定回合；
         *    ③ 加法散列 `slotSalt + round*7919 + pid*104729` 在 `guardwall` 夹具上是干净的（50.0/32.2/15.9%），
         *      但**真考卷上不干净**（p=2 的出手只比 p=1 少 7%）⇒ 同一局内回合奇偶高度相关，加法没打散。
         *    ⇒ 现在：异或 + 奇数乘子 + 移位混淆的 avalanche 散列（不碰 `state.rng`、不依赖桌子顺序），
         *      而且**门的夹具换成真池子**（小样本 `--pool=all --every=64`）—— 第三条的教训就是"夹具形状不像使用场景"。 */
        let h = ((state.slotSalt | 0) ^ Math.imul(state.round | 0, 0x9E3779B1) ^ Math.imul(pid | 0, 0x85EBCA6B)) >>> 0;
        h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D) >>> 0;
        h = (h ^ (h >>> 12)) >>> 0;
        if ((h % PUSH) === 0) {
          const pool = S.opponentsOf(state, pid);
          const got = pushTarget(pool, state, PUSHTGT);
          const tgt = (PUSHTGT === 'net' || !got) ? T.pickTargetN(state, pid, PUSH_SK) : got.target;
          if (tgt != null) {
            PUSH_ST.fired++; PUSH_ST.tgt[tgt] = (PUSH_ST.tgt[tgt] || 0) + 1;
            if (got && got.tie > 1) PUSH_ST.tie++;
            const t2 = T.pickTarget2N ? T.pickTarget2N(state, pid, PUSH_SK, tgt) : null;
            return { key: PUSH_SK, target: tgt, target2: t2 };
          }
        }
      }
    }
    return inner(state, pid, legal);
  };
};
/* ===== §E266（用户 10-03 更正机制）：**提顺位**，不是强制替换 =====
 * 用户原话：「提高在随机探索时的**顺位**，而不是强制注入。冠军也可以选原本要做的事情，
 *   只是在本来**一选和二选差距不大、有随机性**的地方加上。」（大雷与摄魂都是这个意思）
 * ⚠ 与 `--bigtpush` 的差别是根本性的：`--bigtpush` 命中时**直接 return 那张卡、从不问冠军**（强制替换）；
 *   本档**不动冠军的采样器**，只在"这一手本来就不确定"时把目标卡的**概率抬高**，冠军仍可能选回原来那一手。
 * ⚠ 纯工具侧：用冠军**已导出**的候选 API（`EpirusPolicy.candidatesFor` / `forwardCands`）
 *   ⇒ `js/train/policy.js` 与 `js/core/*` 都不动（指纹不变、不需要换代）。 */
const RANK_RAW = FLAG.pushrank;
const RANK = RANK_RAW != null;
const RANK_SPEC = String(RANK_RAW == null ? '' : RANK_RAW).split(',');
const RANK_MARGIN = RANK ? Number(RANK_SPEC[0]) : 0;
const RANK_BIAS = RANK ? Number(RANK_SPEC[1] == null || RANK_SPEC[1] === '' ? 1 : RANK_SPEC[1]) : 0;
/** 闸的读法（§E267，用户 10-03 追问"差距不大"指哪一对）：
 *   · `top2`（默认）= **一选与二选**的概率差（"这一手本来就不确定"）
 *   · `near`       = **目标卡自己最好的条目**与一选的概率差（"这张卡离一选不远"） */
const RANK_GATE = RANK ? (RANK_SPEC[2] == null || RANK_SPEC[2] === '' ? 'top2' : String(RANK_SPEC[2])) : 'top2';
/* 第四段 = **算子**（§E268）：给 share 就换成「概率下界」——把目标卡的概率抬到至少 share × 一选概率。
 * 为什么不继续用 ×倍数：实测**惰性**（抬了 6 万次、对局逐位相同 ⇒ ×2 个 ≈0 仍是 ≈0）。
 * 缺省不写 ⇒ 仍是旧的 ×(1+bias)（旧臂可复现）；写了 ⇒ 走下界算子。 */
const RANK_FLOOR = RANK && RANK_SPEC[3] != null && RANK_SPEC[3] !== '' ? Number(RANK_SPEC[3]) : null;
if (RANK_FLOOR != null && !(isFinite(RANK_FLOOR) && RANK_FLOOR > 0 && RANK_FLOOR <= 1)) { console.error('⛔ --pushrank 第四段（概率下界的 share）要 ∈(0,1]（收到 `' + RANK_SPEC[3] + '`）'); process.exit(2); }
if (RANK && ['top2', 'near'].indexOf(RANK_GATE) < 0) { console.error('⛔ --pushrank 第三段（闸的读法）只认识 top2 | near（收到 `' + RANK_GATE + '`）'); process.exit(2); }
if (RANK && !(isFinite(RANK_MARGIN) && RANK_MARGIN >= 0 && RANK_MARGIN <= 1 && isFinite(RANK_BIAS) && RANK_BIAS >= 0)) {
  console.error('⛔ --pushrank=<margin>[,<bias>] 要 margin∈[0,1]、bias≥0（收到 `' + RANK_RAW + '`）；margin = "一选与二选的概率差"的上限，bias = 目标卡概率的放大倍数'); process.exit(2);
}
const RANK_TEMP = 0.15;   /* 与线上同一档（`policyChooserN(params, 0.15)`）⇒ 闸判的是冠军**自己的**决策分布 */
const RANK_ST = { dec: 0, close: 0, fired: 0, gapSum: 0, moved: 0 };
/* §E267：自检挂**进程出口** —— 前面两版分别落在 `if (PUSH)` 与 `if (FLAG['dump-per'])` 里，
 * 于是"纯提顺位臂"与"不落盘的跑法"都**一声不响**（同一族病：静默的量具）。出口钩子与作用域无关。 */
if (RANK) process.on('exit', function () {
  console.log('[pushrank 自检] 闸读法=' + RANK_GATE + ' · margin=' + RANK_MARGIN + ' bias=' + RANK_BIAS
    + ' · 决策 ' + RANK_ST.dec + ' 个（平均 gap=' + (RANK_ST.gapSum / Math.max(1, RANK_ST.dec)).toFixed(4) + '）'
    + ' · 落在闸内的 ' + RANK_ST.close + ' 个（' + (100 * RANK_ST.close / Math.max(1, RANK_ST.dec)).toFixed(1) + '%）'
    + ' · 真抬高 ' + RANK_ST.fired + ' 次（兑现率 ' + (100 * RANK_ST.fired / Math.max(1, RANK_ST.close)).toFixed(1) + '%）'
    + ' · 真搬动的概率质量 ' + RANK_ST.moved.toFixed(4) + '（0 ⇒ 算子惰性）'
    + (RANK_FLOOR == null ? '' : (' · 算子=概率下界 ' + RANK_FLOOR + '×一选')));
});
if (RANK) {
  console.log('[pushrank] 提顺位已生效：卡=`' + PUSHKEY + '`（' + PUSH_NAME + '）**ep≥' + PUSH_MINEP + ' 且合法可付、且"一选与二选概率差 ≤ '
    + RANK_MARGIN + '"（闸读法 `' + RANK_GATE + '`）**时把它的概率 ×(1+' + RANK_BIAS + ')，随后**仍用冠军那套按概率抽**（冠军可以选回原来那一手）'
    + ' · 工具侧实现，不动 policy.js');
}
const rankSel = !RANK ? null : function () {
  const inner = subjectPolicy();
  return function (state, pid, legal) {
    const ep = (state.p[pid] && state.p[pid].ep) || 0;
    if (ep >= PUSH_MINEP) {
      const cands = P.candidatesFor(state, pid, legal);        /* 纯枚举、不抽 rng */
      const f = P.forwardCands(state, pid, cands, params, { temp: RANK_TEMP });   /* 纯打分、不抽 rng */
      RANK_ST.dec++;
      let p1 = -1, p2 = -1;
      for (let i = 0; i < f.probs.length; i++) { const v = f.probs[i]; if (v > p1) { p2 = p1; p1 = v; } else if (v > p2) p2 = v; }
      /* ← 用户要的那条闸："本来一选和二选差距不大、有随机性的地方"才动 */
      let gap = 2;
      if (RANK_GATE === 'near') {
        let pt = -1;
        for (let i = 0; i < cands.length; i++) if (cands[i].key === PUSH_SK && f.probs[i] > pt) pt = f.probs[i];
        if (pt >= 0) gap = p1 - pt;                      /* 目标卡不在菜单里 ⇒ gap=2 ⇒ 不动手 */
      } else gap = p1 - p2;
      RANK_ST.gapSum += gap;
      if (f.probs.length > 1 && gap <= RANK_MARGIN) {
        RANK_ST.close++;
        let hit = -1;
        for (let i = 0; i < cands.length; i++) if (cands[i].key === PUSH_SK) { hit = i; break; }
        const l = legal.find(function (x) { return x && x.key === PUSH_SK; });
        if (hit >= 0 && l && l.affordable !== false) {
          RANK_ST.fired++;
          let tot = 0; const w = new Float64Array(cands.length);
          const pFloor = (RANK_FLOOR == null) ? -1 : RANK_FLOOR * p1;
          for (let i = 0; i < cands.length; i++) {
            w[i] = f.probs[i];
            if (i === hit) w[i] = (RANK_FLOOR == null) ? (f.probs[i] * (1 + RANK_BIAS)) : Math.max(f.probs[i], pFloor);
            tot += w[i];
          }
          RANK_ST.moved += Math.max(0, w[hit] - f.probs[hit]);
          if (tot > 0) {
            /* 一次 `state.rng.next()`（与"原样交给冠军"那条路消耗**同样多**的随机流 ⇒ 两支可比） */
            const r = state.rng.next(); let acc = 0;
            for (let i = 0; i < cands.length; i++) { acc += w[i] / tot; if (r < acc) return cands[i]; }
            return cands[cands.length - 1];
          }
        }
      }
    }
    return inner(state, pid, legal);
  };
};

const subjectSel = (RANK && !PAYLOAD && !INJECT && !SMART && !COMBO && !BAN && !PURE && !SUBJECT && !planSubjectSel && !swapParams)
  ? rankSel
  : (PUSH && !PAYLOAD && !INJECT && !SMART && !COMBO && !BAN && !PURE && !SUBJECT && !planSubjectSel && !swapParams)
  ? pushSel
  : (PURE && !PAYLOAD && !INJECT && !SMART && !COMBO && !BAN && !planSubjectSel)
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
    : function () { return subjectPolicy(); });
const subjectLabel = (PUSH && !PAYLOAD && !INJECT && !SMART && !COMBO && !BAN && !PURE && !SUBJECT)
  ? ('探索提前·' + PUSH_NAME + ' ep≥' + PUSH_MINEP + ' 且 round%' + PUSH + ' ·目标=' + PUSHTGT)
  : PAYLOAD ? ('消融·只换弹头 ' + PAYLOAD)
  : (PURE && !INJECT && !SMART && !COMBO && !BAN && !planSubjectSel) ? ('纯招·只出 ' + PURE + ' + ジ')
  : (planSubjectSel && !INJECT && !SMART && !COMBO) ? ('连招·蓄能→电磁炮')
  : (BAN && !INJECT && !SMART && !COMBO) ? ('消融·拿掉 ' + BAN)
  : (COMBO && !INJECT && !SMART) ? (comboLabel + ' 叠' + STACK)
  : (SMART && !INJECT) ? ('正确用法 ' + SMART)
  : INJECT ? ('边际注入·能用就用 ' + INJECT)
    : (SUBJECT ? ('脚本 ' + SUBJECT)
      : (SWAP_FILE ? ('冠军→第 ' + SWAP_ROUND + ' 回合换 ' + SWAP_FILE.replace(/^.*[\\/]/, '').replace(/\.bak$/, '')) : '冠军'));
const champ = runSubject(subjectSel, subjectLabel);
const ctrl = runSubject(function () { return asChooser(Bots.pickRandom); }, '对照 pickRandom');

for (const s of [champ, ctrl]) {
  console.log('[' + s.label + '] 1st=' + s.pct(s.ranks[0], s.total) +
    ' 严胜=' + s.pct(s.strictFirst, s.total) + ' 并列=' + s.pct(s.tieOnlyFirst, s.total) +
    '  2nd=' + s.pct(s.ranks[1], s.total) + '  3rd=' + s.pct(s.ranks[2], s.total) +
    '  4th=' + s.pct(s.ranks[3], s.total) + '  5th=' + s.pct(s.ranks[4], s.total) +
    '   | top2=' + s.pct(s.ranks[0] + s.ranks[1], s.total) + ' top3=' + s.pct(s.ranks[0] + s.ranks[1] + s.ranks[2], s.total));
  console.log('    各座位 1st 率: ' + s.seatGames.map(function (g, i) { return 'P' + i + '=' + s.pct(s.seatFirst[i], g); }).join(' '));
  console.log('    前置条件: 主体场均承伤=' + s.takenPerGame.toFixed(2) + '  平均回合=' + s.avgRounds.toFixed(1) + '  转移事件=' + s.transferEv + '  火焰伤害事件=' + s.fireEv);
  console.log('    机制: 自己的攻击被弹回=' + s.reflectSelfPerGame.toFixed(2) + ' 次/局  平局率=' + (s.drawRate * 100).toFixed(0) + '%  终局血量=' + s.hpEnd.toFixed(2));
  console.log('    拆分: 含深经济对手 ' + s.pct(s.deepFirst, s.deepGames) + '（' + s.deepGames + ' 局）  vs  不含 ' +
    s.pct(s.shallowFirst, s.shallowGames) + '（' + s.shallowGames + ' 局）  Δ=' +
    ((s.deepGames && s.shallowGames) ? ((s.deepFirst / s.deepGames - s.shallowFirst / s.shallowGames) * 100).toFixed(1) + 'pt' : '-'));
  /* E62（qoder 09-27）：**反弹席**分箱（只记录）—— 看的是"混合桌里有一席反弹"这一格；
   * 整桌反弹那一格由 `--field=reflectwall` 量（v1.4.7 起就在，见本文件 `REFL` 处的 09-28 更正）。 */
  console.log('    拆分: 含反弹席(reflectspam) ' + s.pct(s.reflFirst, s.reflGames) + '（' + s.reflGames + ' 局）  vs  不含 ' +
    s.pct(s.noreflFirst, s.noreflGames) + '（' + s.noreflGames + ' 局）  Δ=' +
    ((s.reflGames && s.noreflGames) ? ((s.reflFirst / s.reflGames - s.noreflFirst / s.noreflGames) * 100).toFixed(1) + 'pt' : '-'));
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
if (PUSH) {
  /* 生效判据落在**行为计数**上（窗口开了多少次 / 真打出去多少次 / 打在谁身上），不落在"旗标读到了"上。
   * 并且**并报兑现率** `fired/opp` —— 门 D223 的"剂量真的分档"腿读的就是这个数（第一版按局内窗口序号数，三档几乎没差，被它抓到）。 */
  const rate = PUSH_ST.opp ? PUSH_ST.fired / PUSH_ST.opp : 0;
  const seatN = Object.keys(PUSH_ST.tgt).length;
  console.log('[提前自检] 窗口（主体 `ep≥' + PUSH_MINEP + '` 且' + PUSH_NAME + '可付的决策）' + PUSH_ST.opp + ' 个 = ' +
    (champ.total ? (PUSH_ST.opp / champ.total).toFixed(3) : '0') + ' 个/局（' + champ.total + ' 局），'
    + '打出去 ' + PUSH_ST.fired + ' 次（兑现率 ' + (rate * 100).toFixed(1) + '% · 口径 = 只在 `round % ' + PUSH + ' === 0` 的回合兑现）' +
    ' · 目标分布 ' + JSON.stringify(PUSH_ST.tgt) + '（' + seatN + ' 个不同席位）· 平手 ' + PUSH_ST.tie + ' 次' +
    (PUSH_ST.opp === 0 ? '   !!! 窗口从不打开 ⇒ 这一臂没测到任何东西（门槛 ep≥' + PUSH_MINEP + ' · 卡=`' + PUSHKEY + '`），Δ 不可读'
      : (PUSH_ST.fired === 0 ? '   !!! 窗口开了却一次没打 ⇒ 计数/可付判定失效' : '   OK 实验有效')));
}
if (GRANT) {
  console.log('[补贴自检] --grant=' + GRANT + ' 已生效 ' + GRANT_ST.rounds + ' 个主体回合（主体回合数应≈局数×回合数）');}
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

/* ===== §E136：逐桌子命中数落盘（`--dump-per=<file>`，默认关）=====
 * 为什么要它：配对 95% 区间的分母是**同一批桌子上的差值**，汇总百分比算不出来（§E137 那种"未配对 SE"只会偏保守）。
 * 只在旗标给出时写文件，stdout 一字不加 ⇒ 与老口径逐字相同。 */
if (FLAG['dump-per']) {
  const lines = ['#eval5p-percombo', '#seed=' + SEED, '#games=' + GAMES, '#n=' + N, '#pool=' + POOL_MODE,
    /* v1.5.325 §E246（千问 10-02 夜班撞上来的）：表头**必须能唯一确定装配**。
     * 原来少了 `#mode` 这一维 ⇒ 把 multi 的落盘和 long 的落装配对，这把尺自己看不见（两边的 seed/桌数一模一样），
     * 而跨模式的 1st 差好几 pt —— 正是本仓"结果对、理由错"那一族。加一行，旧落盘不受影响（读侧按 key 取）。 */
    '#mode=' + (MODE || 'multi(默认)'), '#every=' + EVERY, '#field=' + (FIELD || '-'), '#file=' + FILE,
    /* §E255：改价世界必须写进配对身份 —— 否则"世界 4 珠"的落盘与"出厂 5 珠"的落盘会被这把尺当成同世界配对着配对，
     * 而跨世界的绝对电平本来就不可以比（那正是本节判据 Q3 要防的）。 */
    '#bigtcost=' + (FLAG.bigtcost == null ? 'factory' : String(BIGTCOST)), '#ban=' + (BAN || '-'),
    /* §E262：探索提前这一臂的两个自由量也必须进配对身份（`--bigtpush` 与 `--bigttgt` 任一不同就不是同一臂）。 */
    '#bigtpush=' + (PUSH || 0) + '/' + PUSH_MINEP, '#bigttgt=' + (PUSH ? PUSHTGT : '-'),
    /* §E264：`--pushkey` 决定"提前的是哪张卡"、`--drainhp` 决定摄魂那扇窗有多宽 ⇒ 两维都进配对身份。
     * ⚠ 摄魂臂与大雷臂的 seed/桌数/剂量可以完全一样，只有这两维不同 ⇒ 少写一行就会把两张卡的臂配成同世界（§E246 那一族）。 */
    /* §E267：**提顺位臂的卡名也必须落盘** —— 否则这一臂的落盘里 `#pushkey=-`，
     * 与"出厂"那一份逐字相同 ⇒ 下一个人从表头读不出这臂动的是哪张卡（"回显生效值"那条）。 */
    '#pushkey=' + ((PUSH || RANK) ? PUSHKEY : '-'),
    /* §E266：提顺位这一臂的自由量（margin/bias）也必须进配对身份 —— 少写一行就会把两档配成同世界。 */
    '#pushrank=' + (RANK ? (RANK_MARGIN + '/' + RANK_BIAS + '/' + RANK_GATE + '/' + (RANK_FLOOR == null ? '-' : RANK_FLOOR)) : '-'),
    '#drainhp=' + ((R.MODES[MODE || 'multi'] || {}).drainHpMax),
    '#swap=' + (SWAP || '-'), '#arm\tidx\tnames\tgames\tfirst\tstrict'];
  for (const s of [{ arm: 'subject', r: champ }, { arm: 'ctrl', r: ctrl }]) {
    s.r.perCombo.forEach(function (c, i) {
      lines.push(s.arm + '\t' + i + '\t' + c.names + '\t' + c.games + '\t' + c.first + '\t' + c.strict);
    });
  }
  writeFileSync(FLAG['dump-per'], lines.join('\n') + '\n');
  /* §E267：**自检必须在顶层无条件印** —— 我第一版把它挂在 `[提前自检]` 后面，
 * 而那一行在 `if (PUSH)` 里 ⇒ 纯提顺位臂（不设 `--bigtpush`）**一声不响**（本条正是这一族病：静默的量具）。 */
console.log('逐桌子命中数 → ' + FLAG['dump-per'] + '（' + champ.perCombo.length + ' 组 × ' + GAMES + ' 局）');
}
