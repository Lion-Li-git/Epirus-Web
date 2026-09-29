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

const V1 = st => { const me = st.p[0]; const o = st.p.filter((p, i) => i !== 0 && p.hp > 0);
  return 20 * (me.hp > 0 ? 1 : 0) + me.hp - (o.length ? o.reduce((a, p) => a + p.hp, 0) / o.length : 0); };
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
  'b-seat-nb': { key: 'seat+sig2', reset: 'table' }
};
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
  for (let i = 1; i < 5; i++) {
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
  for (let i = 1; i < 5; i++) {
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

function runArm(arm, pick, seedBase) {
  const rows = [];
  /* 信念表**每臂从零学起**：留着上一臂的表 = 让臂之间互相污染（轨迹不同，学到的分布也不同） */
  const bmk = MODEL_OF[arm] || (MODELS[arm] ? arm : null);   /* bmk != null ⇒ 这一臂带在线对手模型（不能叫 mk：下面第 171 行的"每席脚本工厂"就叫 mk，会在块作用域里把它悄悄换掉） */
  const bcat = arm === 'b-cat';                               /* 类别级那臂走另一张表（见上） */
  BELIEF.clear(); CATC.clear(); CATCARD.clear();
  belTot = 0; belHit = 0; belFresh = 0; catTot = 0; catHit = 0; oppObs = 0; beadTrue = 0; beadFromCharge = 0;
  let decIdx = 0, greedyCalls = 0;
  for (let t = 0; t < TABLES; t++) {
    if ((bmk && MODELS[bmk].reset === 'table') || bcat) { BELIEF.clear(); CATC.clear(); CATCARD.clear(); }   /* "身份锚但不跨桌"这一格 */
    const r0 = T.mulberry32(SEED + t * 7919);
    const pk4 = []; while (pk4.length < 4) { const n = NAMES[Math.floor(r0() * NAMES.length)]; if (pk4.indexOf(n) < 0) pk4.push(n); }
    let first = 0, rounds = 0;
    for (let g = 0; g < GAMES; g++) {
      if (bmk && MODELS[bmk].reset === 'game') BELIEF.clear();   /* "只在本局内学"这一格 */
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
        const predict = arm === 'greedy' ? 'policy' : (arm === 'greedy-none' ? 'none' : (bcat ? 'cat' : (bmk ? 'model' : 'history')));
        const oppPicks = [null];
        keyAt = [null, null, null, null, null];
        tierAt = [null, null, null, null, null];
        for (let i = 1; i < 5; i++) {
          if (s.p[i].hp <= 0) { oppPicks.push(null); continue; }
          oppObs++; if (s.p[i].elec || s.p[i].boom) { beadTrue++; if (s.p[i].lastSkill === R.SK.CHARGE) beadFromCharge++; }
          tierAt[i] = Math.min(5, s.p[i].ep >> 1);
          keyAt[i] = bmk ? mkey(bmk, i, s.p[i]) : sig(s.p[i]);
          if (predict === 'none') {
            /* 空模型：只假设"对手会拿 1 ジ"⇒ 这一臂与前几臂的差**全部来自前瞻本身**，不含任何对手建模 */
            oppPicks.push({ key: R.SK.JI, target: null, target2: null, bead: null });
          } else if (predict === 'history') {
            const k = s.p[i].lastSkill || R.SK.JI;
            oppPicks.push({ key: k, target: (s.p[i].lastTarget == null ? null : s.p[i].lastTarget), target2: null, bead: null });
          } else if (predict === 'model') {
            /* 只预测"做哪张卡"，目标交给引擎按默认解析 ⇒ 不去猜那些同样被藏起来的东西 */
            oppPicks.push({ key: predict2(keyAt[i]), target: null, target2: null, bead: null });
          } else if (predict === 'cat') {
            oppPicks.push({ key: catPredict(i, tierAt[i]), target: null, target2: null, bead: null });
          } else {
            const q = S.cloneState(s); q.rng = { next: T.mulberry32(ds) };
            const lg = Play.legalActions(q, i).filter(l => l.affordable);
            const rr = asChooser(FN[pk4[i - 1]])(q, i, lg.length ? lg : [{ key: R.SK.JI, affordable: true }]);
            oppPicks.push(norm(rr));
          }
        }
        let best = cands[0], bv = -1e9;
        for (let ci = 0; ci < cands.length; ci++) {
          const picks = [norm(cands[ci])].concat(oppPicks.slice(1));
          const v = V1(replay(s, ds + ci * 7919, picks));
          greedyCalls++;
          if (v > bv + 1e-9) { bv = v; best = cands[ci]; }
        }
        return norm(best);
      };
      /* 记录对手真实动作（给 belief 臂在线学习用），并照原样返回 ⇒ 除"多记一份"外与旧口径逐字相同 */
      const mk = i => function (s, pid, legal) { const r = asChooser(FN[pk4[i]])(s, pid, legal); actual[pid] = norm(r); return actual[pid]; };
      /* 回合末（`resolveActions` + `endTurn` 之后）用"决策前的 key → 真做的动作"更新在线表 ⇒ **先判后学**（见 train()） */
      const onTurn = function () { if (bmk) train(keyAt, actual); if (bcat) catTrain(tierAt, keyAt, actual); keyAt = null; tierAt = null; };
      Play.autoGameN(st, [subject, mk(0), mk(1), mk(2), mk(3)], onTurn, null);
      if (st.winner === 0) first++;
      rounds += st.round;
    }
    rows.push({ table: pk4.join(','), first: first, g: GAMES, rounds: rounds / GAMES });
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
const mean = x => x.rows.reduce((s, r) => s + r.first / r.g, 0) / TABLES;
for (const a of ARMS) for (const b of ARMS) {
  if (a >= b) continue;
  const d = pairedDiff(res[a].rows.map(r => r.first / r.g), res[b].rows.map(r => r.first / r.g), 1.96);
  console.log('  配对差 ' + a + ' − ' + b + ' = **' + (100 * d.m).toFixed(2) + 'pt [' + (100 * d.lo).toFixed(2) + ', ' + (100 * d.hi).toFixed(2) + ']**（逐桌 n=' + d.n + '）');
}
console.log('\n  自证：三臂用同一批桌子与同一批 seed，且被测席不消耗 `state.rng` ⇒ 差异只能来自"出招规则"本身。');
console.log('  ⚠ `greedy` 的"对手本回合动作"是**预测**的（真实游戏里那时对手还没出），所以它是"有限信息的贪心"，不是全知；这与 §E152 的 regret 口径有意不同，别再混引。');
