import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pairedDiff } from 'file:///D:/code/Epirus-Web/tools/routing-gain-lib.mjs';

/* §E152b · 分水岭实验：`V1`（1-ply 血量优势）到底是好目标还是坏目标？
   §E152 量到现役包在"1-ply 贪心"这把刻度上只有百分位 54.5（随机按构造 = 50），但那**不能**读成"还有 1.2 血可拿"：
   这游戏的正解常常是"现在拿 1 ジ / 蓄一颗珠"，一个长程策略在近视刻度上本来就该像随机。
   ⇒ 唯一的了断办法是让"照 V1 打"的贪手真的去上桌，和现役比**夺冠率**：
       贪手赢得更多 ⇒ V1 是真目标，§E153 可以把它接进适应度；
       贪手赢不过现役（甚至不如随机） ⇒ V1 是坏目标，§E153 直接砍掉，别再造第 N 把近视尺。
   三臂：`pack`（现役包 argmax，ε=0）‖ `greedy`（每决策枚举候选 + 重放，取 V1 最大）‖ `rand`（候选里定种随机一手）
   配对口径：同一张桌（同 4 个脚本 + 同座位序）× 同一批局号 ⇒ **逐桌配对**，`pairedDiff` 给 95%CI。
   ⚠ 被测席**一律不碰 `state.rng`**（贪手/随机手都用按决策定种的本地流）⇒ 三臂面对的对手流逐字相同，配对才成立。 */
const REPO = 'D:/code/Epirus-Web/';
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const TABLES = Number(arg('tables', 10));
const GAMES = Number(arg('games', 10));
const SEED = Number(arg('seed', 77000));
const ARMS = arg('arms', 'pack,greedy,rand').split(',');
const { OPP_SPECS } = await import('file://' + REPO + 'server/opp-pool.mjs');
const { makeAsChooser } = await import('file://' + REPO + 'tools/bot-chooser-lib.mjs');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots, Play = W.EpirusPlay, X = W.EpirusResolve;
const asChooser = makeAsChooser({ T: T, R: R });
const NAMES = OPP_SPECS.map(o => o.name).concat(['focusfire', 'minespam', 'cursestorm']);
const FN = {}; for (const o of OPP_SPECS) FN[o.name] = Bots[o.fn];
FN.focusfire = Bots.pickFocusFire; FN.minespam = Bots.pickMineSpam; FN.cursestorm = Bots.pickCurseStorm;
const mm = readFileSync(REPO + PACK, 'utf8').match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('⛔ 包不兼容'); process.exit(1); }

const V1P = (st, pid) => { const me = st.p[pid]; const o = st.p.filter((p, i) => i !== pid && p.hp > 0);
  return 20 * (me.hp > 0 ? 1 : 0) + me.hp - (o.length ? o.reduce((a, p) => a + p.hp, 0) / o.length : 0); };
/* `--mode=duel`：**正面对撞**——被测信念臂坐 1 号位，现役包坐 0 号位，其余三席是脚本。
   与 `arm` 模式的唯一区别是"包也在桌上、且信念臂对它的预测同样只走可观测面"（不许问它的策略 ⇒ 那才是公平对撞）。
   ⚠ 对撞模式下被测席是 1 号位 ⇒ `V1P` 按席取，`SS` 是唯一的座位口径开关。 */
const MODE = arg('mode', 'arm');
const SS = MODE === 'duel' ? 1 : 0;
/* `--dbgkeys=1`：印被测席实际选了哪些卡 ⇒ 混合臂在 3×2 烟测里 0% 夺冠，第一反应必须是"先证尺没弯" */
const hybDbg = arg('dbgkeys', '0') === '1';
let hybDbgLog = {};
function replay(snap, seed, picks) {
  const st = S.cloneState(snap);
  st.rng = { next: T.mulberry32(seed) };
  for (let pid = 0; pid < picks.length; pid++) {
    const pk = picks[pid]; if (!pk) continue;
    const p = st.p[pid]; if (!p || p.hp <= 0) continue;
    S.attemptAction(st, pid, pk.key, { bead: pk.bead || (p.elec > p.boom ? 'boom' : 'elec'), target: pk.target, target2: pk.target2 });
  }
  X.resolveActions(st); X.endTurn(st);
  return st;
}
const norm = c => ({ key: c.key, target: c.target == null ? null : c.target, target2: c.target2, bead: c.bead });

/* ===== §E152d · 把"对手模型"拆成两件可以分开买的东西 =====
   §E152c 那臂 `greedy-belief`（+34.50pt）**同时**买了两样：
     ① **身份锚** —— 预测的 key 里带"这是第几席" ⇒ 能攒"他 7 次里 5 次放大雷"
     ② **跨局累积** —— 表不清空，同一张桌 10 局一路学下去
   这两样在 `policy.js` 侧的价格完全不同（①只要特征随行、②要持久状态）⇒ 必须拆开量。四个组合 + 一个"最便宜形状"：
     b-global      = 无身份（key 只有可观测签名）+ 跨局累积    ‖ **就是 §E152c 那臂**（`greedy-belief` 是别名）
     b-ingame      = 无身份 + 每局清空
     b-seat        = 有身份 + 每张桌清空（同桌内 pid↔脚本一一对应 ⇒ 跨局学的正是"这个原型"）
     b-seat-ingame = 有身份 + 每局清空
     b-top1        = 有身份、**完全不看状态**：预测"这一席本局打得最多的那张卡"（每席一个量 ⇒ 若它保住大头，换代就只值几维）
   ⚠ 所有臂（含 `pack` 与 `greedy` 两端锚）在**同一批次**里跑 ⇒ 配对与比例都只在同一遍的表内算
      （§E152b 更正那次的教训：我拿过另一遍的分母，算出过"78%"这种不存在的数）。 */
const MODELS = {
  'b-global': { key: 'sig', reset: 'none' },
  'b-ingame': { key: 'sig', reset: 'game' },
  'b-seat': { key: 'seat+sig', reset: 'table' },
  'b-seat-ingame': { key: 'seat+sig', reset: 'game' },
  'b-top1': { key: 'seat', reset: 'game' },
  /* §E152e 对齐用：去掉"有没有持珠"这一维 ⇒ 与人类日志里**能重建出来的**条件集同构（日志里没有珠的类型，也没有费用行） */
  'b-seat-nb': { key: 'seat+sig2', reset: 'table' },
  /* §E153 的两条混合臂：表结构与 `b-seat`/`b-global` 完全一样，**只有评估函数换成现役包自己** */
  'b-seat-hyb': { key: 'seat+sig', reset: 'table' },
  'b-global-hyb': { key: 'sig', reset: 'none' }
};
const HYB_OF = { 'b-seat-hyb': 'seat', 'hyb-none': 'none', 'b-global-hyb': 'global' };
const MODEL_OF = { 'greedy-belief': 'b-global' };   /* 向后兼容：§E152c 的臂名仍可点 */
const BELIEF = new Map();
const sig = p => [Math.min(5, p.ep >> 1), p.ep >= 5 ? 1 : 0, (p.elec || p.boom) ? 1 : 0, p.lastSkill || '-'].join('/');
/* 只用**日志里也拿得到**的量：钱档 / 是否富 / 上一手（hp 与存活人数在日志里可重建，但引擎侧本来就是可见的 ⇒ 不动） */
const sig2 = p => [Math.min(5, p.ep >> 1), p.ep >= 5 ? 1 : 0, p.lastSkill || '-'].join('/');
/* key 里出现 pid ⇒ 有身份锚；只出现签名 ⇒ 所有原型池化成一张表 */
function mkey(mk, pid, p) {
  const kind = MODELS[mk] ? MODELS[mk].key : 'sig';
  if (kind === 'sig') return sig(p);
  if (kind === 'sig2') return sig2(p);
  if (kind === 'seat') return 'S' + pid;
  if (kind === 'seat+sig2') return 'S' + pid + '@' + sig2(p);
  return 'S' + pid + '@' + sig(p);
}
function predict2(k) {
  const m = BELIEF.get(k); if (!m) return R.SK.JI;
  let best = R.SK.JI, bv = -1;
  for (const key in m) if (m[key] > bv) { bv = m[key]; best = key; }
  return best;
}
/* ⚠ **先判后学**（§E152c 那版写反了：先 `m[key]++` 再 `predict2()` ⇒ 没见过的新 key 必然"命中"，
   那个 70.7% 是**虚高**的。修法就是下面的顺序：用"更新前"的表预测，再记账、再学习。 */
function train(keyAt, actual) {
  for (let i = 0; i < 5; i++) {
    if (!keyAt || !keyAt[i] || !actual[i]) continue;
    const pred = predict2(keyAt[i]);          /* 用**更新前**的表 ⇒ 这才是"在线预测"的真实口径 */
    const fresh = !BELIEF.has(keyAt[i]);
    belTot++; if (pred === actual[i].key) belHit++; if (fresh) belFresh++;
    let m = BELIEF.get(keyAt[i]); if (!m) { m = {}; BELIEF.set(keyAt[i], m); }
    m[actual[i].key] = (m[actual[i].key] || 0) + 1;
  }
}
/* ===== §E152d-补 · `b-cat`：把"每席要表示多少东西"也定价 =====
   `b-seat` 的输出端是**一张 26 个卡名的分布** ⇒ 特征块根本装不下（26 维/席）；
   而"该席本局各**类别**的份额 + 该类别里最常打的那张"只要 ~4 维/席 ⇒ 装得下。
   这一臂就是问："类别级"这一刀砍下去，50.75pt 还剩多少？
/* 实现：两张表 —— (席,钱档) → {类别: 次数} 决定"他在这档钱下主要干什么"，(席,类别) → {卡名: 次数} 把类别落回具体卡。 */
let belTot = 0, belHit = 0, belFresh = 0;
const CATC = new Map(), CATCARD = new Map();
let tierAt = null;
function catOfKey(key) { const c = R.byKey && R.byKey[key]; return c && c.cat ? c.cat : '?'; }
function catPredict(pid, tier) {
  const m = CATC.get(pid + '@' + tier); if (!m) return R.SK.JI;
  let bc = '?', bv = -1;
  for (const c in m) if (m[c] > bv) { bv = m[c]; bc = c; }
  const mm = CATCARD.get(pid + '@' + bc); if (!mm) return R.SK.JI;
  let bk = R.SK.JI, kv = -1;
  for (const k in mm) if (mm[k] > kv) { kv = mm[k]; bk = k; }
  return bk;
}
/* 钱档取**决策点**那个（回合末再读 `s.p[i].ep` 就已经被这回合的收支改掉了 ⇒ 与 keyAt 同理，必须在决策点存） */
function catTrain(tierAt, keyAt, actual) {
  for (let i = 0; i < 5; i++) {
    if (!tierAt || !keyAt || !keyAt[i] || !actual[i]) continue;
    const pred = catPredict(i, tierAt[i]);        /* 先判 */
    catTot++; if (pred === actual[i].key) catHit++;
    const cat = catOfKey(actual[i].key);          /* 后学 */
    let m = CATC.get(i + '@' + tierAt[i]); if (!m) { m = {}; CATC.set(i + '@' + tierAt[i], m); }
    m[cat] = (m[cat] || 0) + 1;
    let n = CATCARD.get(i + '@' + cat); if (!n) { n = {}; CATCARD.set(i + '@' + cat, n); }
    n[actual[i].key] = (n[actual[i].key] || 0) + 1;
  }
}
let catTot = 0, catHit = 0;
/* 诊断：**决策点上**对手"持珠"这一维到底有多少次为真（§E152e 的教训：`b-seat` 与 `b-seat-nb` 逐位相同，
   第一反应不该是"珠维没用"，而是先证明这个维**取到过值** —— 一维恒定时它就是个装饰，签名描述也跟着失真） */
let oppObs = 0, beadTrue = 0, beadFromCharge = 0;
let keyAt = null, actual = [null, null, null, null, null];

/* ===== §E153 · 把评估函数从"近视 V1"换成**现役包自己** =====
 * §E152c 那句"前瞻本身不值钱（−10.50pt）"混了一个因素：搜索的目标是 `V1`（只看这一回合的血量优势），
 * 而这游戏的正解常常是"现在攒一颗珠 / 铺垫一张符咒" ⇒ 近视目标会把长程动作判成差的。
 * 于是这里把目标换成**训练出来的网络**：重放完这一回合后，取现役包在下一回合各候选的**原始 logit** 最大值
 * （`P.value` 就是那条通道 ⇒ 不新造第二套评分，避免"两份同构实现必漂移"）。
 * ⚠ 不能用 `forwardCands().probs`：那是**每个状态内部**归一化的 softmax（跨状态不可比），而我们要比的正是"哪个后继状态更好"。
 * 两条新臂：
 *   `b-seat-hyb` = 身份信念表预测对手 + **网络评估**     ‖  ← 这才是"给现役 AI 装对手模型"的产品形状
 *   `hyb-none`   = 空模型（假设对手只拿 ジ）+ 网络评估    ‖  ← 对照：把"对手模型"这一维单独摘出来看值多少
 */
function netEval(st, pid) {
  if (!st.p[pid] || st.p[pid].hp <= 0) return -1e6;
  const lg = Play.legalActions(st, pid).filter(l => l.affordable);
  const cs = P.candidatesFor(st, pid, lg.length ? lg : [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
  if (!cs.length) return -1e6;
  let bv = -1e9;
  for (let i = 0; i < cs.length; i++) { const v = P.value(st, pid, cs[i].key, params, null, cs[i]); if (v > bv) bv = v; }
  /* 终局加成：网络 logit 是"下一手"的量纲，不知道"这一回合打完谁死了" ⇒ 补一项存活/血量，否则搜索会忽视击杀 */
  const o = st.p.filter((p, i) => i !== pid && p.hp > 0);
  return bv + 20 * (st.p[pid].hp > 0 ? 1 : 0) + st.p[pid].hp - (o.length ? o.reduce((a, p) => a + p.hp, 0) / o.length : 0);
}

function runArm(arm, pick, seedBase) {
  const rows = [];
  /* 信念表**每臂从零学起**：留着上一臂的表 = 让臂之间互相污染（轨迹不同，学到的分布也不同） */
  const bmk = MODEL_OF[arm] || (MODELS[arm] ? arm : null);   /* bmk != null ⇒ 这一臂带在线对手模型（不能叫 mk：下面第 171 行的"每席脚本工厂"就叫 mk，会在块作用域里把它悄悄换掉） */
  const bcat = arm === 'b-cat' || arm === 'b-cat-ingame';            /* 类别级那臂走另一张表（见上） */
  /* ⚠ 产品口径只该引"**只在一局之内**"那一档（`b-cat-ingame` / `b-seat-ingame` / `b-top1`）：
     `b-seat` 吃的是"同一批对手连打 10 局"的跨局累积，这在真实产品里是个**未被保证**的前提。 */
  const bcatReset = arm === 'b-cat-ingame' ? 'game' : 'table';
  BELIEF.clear(); CATC.clear(); CATCARD.clear();
  belTot = 0; belHit = 0; belFresh = 0; catTot = 0; catHit = 0; oppObs = 0; beadTrue = 0; beadFromCharge = 0;
  let decIdx = 0, greedyCalls = 0;
  for (let t = 0; t < TABLES; t++) {
    if ((bmk && MODELS[bmk].reset === 'table') || (bcat && bcatReset === 'table')) { BELIEF.clear(); CATC.clear(); CATCARD.clear(); }   /* "身份锚但不跨桌"这一格 */
    const r0 = T.mulberry32(SEED + t * 7919);
    const pk4 = []; while (pk4.length < 4) { const n = NAMES[Math.floor(r0() * NAMES.length)]; if (pk4.indexOf(n) < 0) pk4.push(n); }
    let first = 0, packFirst = 0, rounds = 0;
    /* 座位 → 脚本名（arm 模式：1~4 号位是 pk4[0..3]；duel 模式：0 号位是现役包、2~4 号位是 pk4[0..2]） */
    const pkName = function (pid) { return MODE === 'duel' ? (pid >= 2 ? pk4[pid - 2] : null) : pk4[pid - 1]; };
    for (let g = 0; g < GAMES; g++) {
      if ((bmk && MODELS[bmk].reset === 'game') || (bcat && bcatReset === 'game')) { BELIEF.clear(); CATC.clear(); CATCARD.clear(); }   /* "只在本局内学"这一格 */
      const st = S.createState('multi', { next: T.mulberry32(seedBase + t * 104729 + g) }, 5);
      if (T.slotSaltFor) st.slotSalt = T.slotSaltFor(seedBase + t * 104729 + g);
      /* ⚠⚠ 第三处量具陷阱（前两处见 §E150d 的 memo）：`pack` 臂**必须**用引擎自己的 `T.policyChooserN(params, 0.15)`，
         不能自己拿 `forwardCands` 重搓一个 argmax —— 因为 `policyChooserN` 里还住着**用户裁定的规则**
         （ep<2 不蓄能、铺垫卡要 3ep、贴贴后的优先级、`lockTarget` 等，见 `evo.js:420/524` 一带）。
         我第一版手搓 argmax ⇒ 那是个被削过的包，50pt 里有一部分是这么来的（本仓"两份同构实现必漂移"的第四次）。 */
      const sel = T.policyChooserN(params, 0.15);
      keyAt = null; actual = [null, null, null, null, null];
      const subject = function (s, pid, legal) {
        const ds = ((++decIdx) * 2654435761) >>> 6;
        const v7 = legal.filter(l => l.affordable);
        const use = v7.length ? v7 : [{ key: R.SK.JI, affordable: true }];
        const cands = P.candidatesFor(s, pid, use, { lockTarget: false });
        if (arm === 'pack') return sel(s, pid, legal);
        if (arm === 'rand') return norm(cands[ds % cands.length]);
        /* 六种"对手下一手从哪来"（§E152b 拆泄漏 / §E152d 拆部件）：
             greedy          = 当场**问脚本策略**（含珠的类型/目标 ⇒ 游戏故意藏的信息，v1.5.15 就当泄漏修掉了）
             greedy-hist     = 只用可观测历史：把他这一手预测成**上一手做过的**
             b-global        = 在线频次表（跨桌跨局累积、不分席）        ‖ 别名 greedy-belief = §E152c 那臂
             b-ingame / b-seat / b-seat-ingame = 同一台机器，只换 key 与清空时机（2×2 的四格）
             b-top1          = 每席一个计数、不看状态 ⇒ "最便宜的特征形状"值多少
           ⇒ 2×2 的读法：`b-global − b-ingame` = **跨局累积**值多少；`b-seat − b-global`（同清空时机比才是身份差，
             严格说用 `b-seat − b-seat-ingame` 与 `b-global − b-ingame` 两格对照着看）= **身份锚**值多少。 */
        const predict = arm === 'greedy' ? 'policy' : (arm === 'greedy-none' || HYB_OF[arm] === 'none' ? 'none' : (bcat ? 'cat' : (bmk ? 'model' : 'history')));
        const hyb = HYB_OF[arm] != null;                       /* 目标函数用网络（否则用近视 V1） */
        const byPid = [null, null, null, null, null];
        keyAt = [null, null, null, null, null];
        tierAt = [null, null, null, null, null];
        for (let i = 0; i < 5; i++) {
          if (i === SS) continue;                                  /* 被测席由候选占位 */
          if (!s.p[i] || s.p[i].hp <= 0) continue;
          oppObs++; if (s.p[i].elec || s.p[i].boom) { beadTrue++; if (s.p[i].lastSkill === R.SK.CHARGE) beadFromCharge++; }
          tierAt[i] = Math.min(5, s.p[i].ep >> 1);
          keyAt[i] = bmk ? mkey(bmk, i, s.p[i]) : sig(s.p[i]);
          if (predict === 'none') {
            /* 空模型：只假设"对手会拿 1 ジ"⇒ 这一臂与前几臂的差**全部来自前瞻本身**，不含任何对手建模 */
            byPid[i] = { key: R.SK.JI, target: null, target2: null, bead: null };
          } else if (predict === 'history') {
            const k = s.p[i].lastSkill || R.SK.JI;
            byPid[i] = { key: k, target: (s.p[i].lastTarget == null ? null : s.p[i].lastTarget), target2: null, bead: null };
          } else if (predict === 'model') {
            /* 只预测"做哪张卡"，目标交给引擎按默认解析 ⇒ 不去猜那些同样被藏起来的东西 */
            byPid[i] = { key: predict2(keyAt[i]), target: null, target2: null, bead: null };
          } else if (predict === 'cat') {
            byPid[i] = { key: catPredict(i, tierAt[i]), target: null, target2: null, bead: null };
          } else {
            const q = S.cloneState(s); q.rng = { next: T.mulberry32(ds) };
            const lg = Play.legalActions(q, i).filter(l => l.affordable);
            const rr = asChooser(FN[pkName(i)])(q, i, lg.length ? lg : [{ key: R.SK.JI, affordable: true }]);
            byPid[i] = norm(rr);
          }
        }
        let best = cands[0], bv = -1e9;
        for (let ci = 0; ci < cands.length; ci++) {
          const picks = byPid.slice(); picks[SS] = norm(cands[ci]);
          const nx = replay(s, ds + ci * 7919, picks);
          const v = hyb ? netEval(nx, SS) : V1P(nx, SS);
          greedyCalls++;
          if (v > bv + 1e-9) { bv = v; best = cands[ci]; }
        }
        if (hybDbg) { const bk = norm(best).key; hybDbgLog[bk] = (hybDbgLog[bk] || 0) + 1; }
        return norm(best);
      };
      /* 记录对手真实动作（给在线学习用），并照原样返回 ⇒ 除"多记一份"外与旧口径逐字相同 */
      const rec = function (inner) { return function (s, pid, legal) { const r = inner(s, pid, legal); actual[pid] = norm(r); return actual[pid]; }; };
      const scriptSeat = function (name) { return rec(function (s, pid, legal) { return asChooser(FN[name])(s, pid, legal); }); };
      const seatFns = [null, null, null, null, null];
      if (MODE === 'duel') {
        seatFns[0] = rec(function (s, pid, legal) { return sel(s, pid, legal); });   /* 现役包：它的一手也要进信念表（"对撞"时它就是被测方要建模的对手） */
        seatFns[1] = subject;
        seatFns[2] = scriptSeat(pk4[0]); seatFns[3] = scriptSeat(pk4[1]); seatFns[4] = scriptSeat(pk4[2]);
      } else {
        seatFns[0] = subject;
        seatFns[1] = scriptSeat(pk4[0]); seatFns[2] = scriptSeat(pk4[1]); seatFns[3] = scriptSeat(pk4[2]); seatFns[4] = scriptSeat(pk4[3]);
      }
      /* 回合末（`resolveActions` + `endTurn` 之后）用"决策前的 key → 真做的动作"更新在线表 ⇒ **先判后学**（见 train()） */
      const onTurn = function () { if (bmk) train(keyAt, actual); if (bcat) catTrain(tierAt, keyAt, actual); keyAt = null; tierAt = null; };
      Play.autoGameN(st, seatFns, onTurn, null);
      if (st.winner === SS) first++;
      if (MODE === 'duel' && st.winner === 0) packFirst++;
      rounds += st.round;
    }
    rows.push({ table: pk4.slice(0, MODE === 'duel' ? 3 : 4).join(','), first: first, packFirst: packFirst, g: GAMES, rounds: rounds / GAMES });
  }
  return {
    rows: rows, calls: greedyCalls,
    belAcc: bcat ? (catTot ? (100 * catHit / catTot).toFixed(1) + '%' : '—') : (belTot ? (100 * belHit / belTot).toFixed(1) + '%' : '—'),
    belN: bcat ? catTot : belTot, fresh: (!bcat && belTot) ? (100 * belFresh / belTot).toFixed(1) + '%' : '—',
    keys: bcat ? CATC.size : (bmk ? BELIEF.size : 0), bmk: bmk,
    bead: oppObs ? (100 * beadTrue / oppObs).toFixed(2) + '% (' + beadTrue + '/' + oppObs + '，其中上一手=蓄能 ' + beadFromCharge + ')' : '—'
  };
}
console.log('# §E152b/§E152d 配对臂：现役包 vs 各种"对手下一手从哪来" ‖ 桌=' + TABLES + ' × 局=' + GAMES + ' ‖ 包=' + PACK);
const res = {};
for (const a of ARMS) res[a] = runArm(a, null, SEED);
const tot = {};
for (const a of ARMS) tot[a] = 100 * res[a].rows.reduce((x, r) => x + r.first, 0) / (TABLES * GAMES);
console.log('\n  臂            夺冠率      平均回合   V1 重放次数   预测命中(先判后学)  预测数   首次key   表大小(key 数)   决策点"对手持珠"占比');
for (const a of ARMS) {
  const rd = res[a].rows.reduce((x, r) => x + r.rounds, 0) / TABLES;
  console.log('  ' + a.padEnd(14) + tot[a].toFixed(2).padStart(7) + '%' + rd.toFixed(1).padStart(11) + String(res[a].calls).padStart(12) +
    '   ' + String(res[a].belAcc).padStart(8) + String(res[a].belN).padStart(9) + String(res[a].fresh).padStart(9) + String(res[a].keys).padStart(10) + '   ' + res[a].bead);
}
if (hybDbg) console.log('  被测席选卡分布（全部臂合并）：' + Object.entries(hybDbgLog).sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, v]) => k + '×' + v).join(' '));
const mean = x => x.rows.reduce((s, r) => s + r.first / r.g, 0) / TABLES;
if (MODE === 'duel') {
  console.log('\n  === 正面对撞（1 号位 = 该臂，0 号位 = 现役包，其余三席脚本）===');
  console.log('  臂              信念席夺冠    包席夺冠     配对差（逐桌 n=' + TABLES + '）');
  for (const a of ARMS) {
    if (a === 'pack') continue;
    const bf = res[a].rows.map(r => r.first / r.g), pf = res[a].rows.map(r => r.packFirst / r.g);
    const d = pairedDiff(bf, pf, 1.96);
    const mb = 100 * bf.reduce((x, y) => x + y, 0) / TABLES, mp = 100 * pf.reduce((x, y) => x + y, 0) / TABLES;
    console.log('  ' + a.padEnd(16) + mb.toFixed(2).padStart(8) + '% ' + mp.toFixed(2).padStart(8) + '%   **' +
      (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']**');
  }
  console.log('  ⚠ 对撞模式下信念臂对 0 号位（现役包）的预测**同样只走可观测面**（记它实际出过什么），没有读它的策略 ⇒ 这才叫公平对撞。');
  console.log('  ⚠ `greedy` 那一臂在对撞模式下无意义（它要"当场问策略"，而 0 号位是网络包、没有"策略"可问）⇒ 别点它。');
}
for (const a of ARMS) for (const b of ARMS) {
  if (a >= b) continue;
  const d = pairedDiff(res[a].rows.map(r => r.first / r.g), res[b].rows.map(r => r.first / r.g), 1.96);
  console.log('  配对差 ' + a + ' − ' + b + ' = **' + (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']**（逐桌 n=' + d.n + '）');
}
console.log('\n  自证：三臂用同一批桌子与同一批 seed，且被测席不消耗 `state.rng` ⇒ 差异只能来自"出招规则"本身。');
console.log('  ⚠ `greedy` 的"对手本回合动作"是**预测**的（真实游戏里那时对手还没出），所以它是"有限信息的贪心"，不是全知；这与 §E152 的 regret 口径有意不同，别再混引。');
