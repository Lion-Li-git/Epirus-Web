#!/usr/bin/env node
/* §E679 探索训练（10-22 夜班·千问 · 用户 10-21 夜授权「开新分支搞一些探索训练…之前提过的优化算子和梯度训练
 * 的东西可以再拿出来研究一些以前没搞过的东西」）：**CEM（对角高斯精英再拟合）** 与 GA 在**同一份评估预算**下对比。
 *
 * 为什么是这条：全仓 grep `CEM|NES|tabu|surrogate|岛模型` 零命中（在册调研结论，见
 * `docs/research/GATE-AUDIT-2026-10-22-qoder.md` 引用的两支调研）⇒ 算子面这是真空白；而梯度面 E1 已经跑过
 * （`CHANGELOG.md:2148`），结论是"输在对手场错位、不是输在梯度"（E6 同场回收 +24.9/+43.8pt）。
 *
 * 预算口径（跑前写死，不给事后挑空间的余地）：**单位 = 个体评估次数**，两臂都只调同一个
 * `T.scoreMemberN(params, opps, games, n, gen, idx, h)` ⇒ GA 一代 = pop 次评估，CEM 一轮 = samples 次评估；
 * 两臂吃同一个 `--evals` 总预算。**没有第三个自由量**（§E194 那条"一次对照只能有一个自由量"）。
 *
 * 自证（发臂前先跑，任一不过就 exit 2，不许开跑）：
 *   ① 同一粒、同一 (gen=0, idx=0) 连跑三遍 ⇒ fit 必须**逐字相同**（这才叫"两臂读同一件事"）；
 *      顺手把"同一粒只换 idx 的散布"当**量具噪声底**打出来（10-22 实测 games=6·n=3：SD≈0.12–0.17 ⇒ `inLoopBest` 有一截是抽签）。
 *      ⚠ 第一版这里写的是"退化臂 POP 个全同样本取 max 必须等于起点"——那是把"同源"错写成"与 idx 无关"，pop>1 时必然 FAIL。
 *   ② 起点分母必须报出来（seed 粒与随机粒各一次），否则"涨了多少"没有参照（记忆里那条"发臂前先量起点分母"）。
 *
 * 用法：node tools/probe-cem-arm.mjs --mode=ga|cem --evals=2000 [--pop=14] [--games=4] [--n=3]
 *        [--seed=7] [--elite=4] [--sig=0.2] [--degenerate=1] [--out=<pack 落点>] [--quiet]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { install as installArch2, verifyWired as verifyArch2Wired } from './proto2/arch2.mjs';   // §E821：默认关（不带 EPIRUS_ARCH2 ⇒ 逐字照旧）

/* §E679 补（10-22）：这台量具原先**没有输入消毒层**（D218 那条门当场抓到，是我今夜建它时就漏的）。
 * 拼错的旗标被静默忽略 = 读数按默认档跑完而没人知道 ⇒ 与"黑键"同族。名单跟着 `arg('…')` 走。 */
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['mode', 'evals', 'pop', 'games', 'n', 'seed', 'elite', 'sig', 'degenerate',
  'start', 'out', 'quiet', 'trainMode', 'holdoutGames', 'targetGames', 'fxSelect', 'fxGames', 'sigmaAdaptive'], 'probe-cem-arm');

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const MODE = arg('mode', '');
if (MODE !== 'ga' && MODE !== 'cem' && MODE !== 'esa') {
  console.error('⛔ --mode 只认 ga|cem|esa（实测 ' + (MODE || '(空)') + '）。本工具只吃 --旗标，不吃位置参数。');
  process.exit(64);
}
const EVALS = Number(arg('evals', 2000));
const POP = Number(arg('pop', 14));
const GAMES = Number(arg('games', 4));
/* `--fxSelect=1`：ES 的当选改到**冻结桌**上判（gen=500，与终局读数 gen=999 那批桌**不是同一批** ⇒ 没在考卷上选答案） */
const FXSEL = Number(arg('fxSelect', 0)) > 0;
/* `--fxGames=`：当选用的冻结桌**每格打几局**。默认跟 `--games` 同档，但 10-29 的读数是：
 *   6 局的冻结桌读数自己就比父子差还吵 ⇒ 接受/拒绝成了掷硬币。要当筛子就得把这一档抬到几十局。 */
const FXG = Math.max(0, Number(arg('fxGames', 0)) || 0);   /* 0 = 沿用 --games（别让 Math.max(1,…) 把默认变成 1 局） */
const N = Number(arg('n', 3));
const SEED = Number(arg('seed', 7));
const ELITE = Number(arg('elite', 4));
const SIG0 = Number(arg('sig', 0.2));
const SIG_FLOOR = 0.01;
const DEG = arg('degenerate', '') === '1';
/* ===== §E822（10-28 傍晚 · 千问）：`--targetGames=` ⇒ **按计数器停，不按记账停** =====
 * 为什么必须加：实测同一 GA 的"每代真打几局"**不是常数**（60 evals 校准时 ≈8 局/代，6000 evals 真跑时 ≈2 局/代
 *   ⇒ 因为 `EpirusTrainer.step` 每代评估的新粒数随精英/移民/σ 退火变）。所以"把 `--evals` 配平等预算"这条路
 *   本身就不可行 —— 唯一可靠的货币是**数出来的局数**。给了这个旗标就忽略 `--evals`（后者只当"计划剂量"印着）。 */
const TARGET_G = Number(arg('targetGames', 0)) || 0;
const QUIET = process.argv.includes('--quiet');
const START_PACK = arg('start', 'docs/artifacts/eval-out/win-Ldemo.bak');
if (!/^[a-zA-Z0-9._/-]+.(bak|js)$/.test(START_PACK)) { console.error('⛔ --start 要一个仓库内包文件（实测 ' + START_PACK + '）'); process.exit(64); }
const OUT = arg('out', '') || defaultOut();
/* ===== §E822（用户 10-28 傍晚裁定：「以后给一个默认落盘路径吧」）=====
 * 病（今天我自己踩的）：`--out` 缺省为空 ⇒ 三臂跑完**权重没落盘**，事后任何别的尺都量不到它们
 *   （组内判别力、12 行、演化图……全都要重新训一遍才能问）。臂的产物本身就是读数的一部分。
 * 默认落点选 `scratch/arms/` 而不是 `docs/artifacts/`：后者是门禁比哈希的活文件夹，
 *   研究臂默认往里撒 `.bak` 会当场吃 `D191`（未登记重复）——这条提醒写在 `tools/train-3p.mjs:2493-2500`。
 *   要入库/进图的包仍由人**显式**点名搬到 `docs/artifacts/`（默认值不该替人做入库决定）。 */
function defaultOut() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const tag = process.env.EPIRUS_ARCH2 ? String(process.env.EPIRUS_ARCH2).split(':')[0] : 'v7';
  return 'scratch/arms/' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes())
    + '-' + tag + '-' + MODE + '-' + (process.env.EPIRUS_MUT_MODE || 'x') + '-s' + SEED + '.bak';
}

const W = sandbox(HERE + '/..');
const T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
const TMODE = arg('trainMode', 'multi');
if (T.setTrainMode) T.setTrainMode(TMODE);
if (T.trainMode && T.trainMode() !== TMODE) { console.error('⛔ 桌形没生效（要 ' + TMODE + ' 读到 ' + (T.trainMode && T.trainMode()) + '）⇒ 记下来的口径是假的'); process.exit(2); }
const HOLD = Number(arg('holdoutGames', 60));
/* ===== §E821（10-28 傍晚 · 千问）：`EPIRUS_ARCH2` ⇒ 两臂都训在 **2.0 结构**上 =====
 * 与 `tools/train-3p.mjs` 那处同一手法（覆盖沙箱里的导出入口，`js/**` 不动 ⇒ 规则指纹不变），
 *   所以 GA / CEM 两个模式**天然吃到同一份 DIM 与同一套算子** —— 这正是"优化器 × 新结构"要的同场对照。
 * ⚠ 结构换成 2.0 之后，`--start` 那枚在册 v7 夹具包**读不进来**（本工具的 `unpack` 已被覆盖 ⇒ 走它本来就有的
 *   "退回固定种子随机粒"那条腿）⇒ 起点标签会印 `makePolicy(0.25)`，**这是设计而非事故**：
 *   2.0 没有热启动来源，两臂同起点随机、只差算子。 */
if (process.env.EPIRUS_ARCH2) {
  const parts = String(process.env.EPIRUS_ARCH2).split(':');
  const cfg = { mutMode: String(process.env.EPIRUS_MUT_MODE || 'seg') };
  if (parts[1]) parts[1].split(',').forEach(function (kv) { const e = kv.split('='); if (e.length === 2) cfg[e[0].trim()] = Number(e[1]); });
  const A2 = installArch2(W, cfg);
  if (T.mulberry32) A2.rngRef.r = T.mulberry32((SEED * 7919 + 13) >>> 0);
  /* ⚑ **开臂前的接线自证**（10-28 晚三波读数作废换来的闸）：打一局量一下 `forwardCands` 有没有被叫到。
   *   没叫到 ⇒ 训练环在走 v7/旧口径分支（`evo.js:21` 的 `LEGACY(params)` 把认不出形状的包判成旧包），
   *   这时整批臂的 `fit` 照样出数、臂照样跑完 ⇒ "没崩"与"接上了"同形。宁可开不了臂。 */
  let wired;
  try { wired = verifyArch2Wired(W, A2, { mode: TMODE, n: N, games: 1 }); }
  catch (e) { console.error('⛔ ' + String(e && e.message || e)); process.exit(7); }
  console.log('[cem-arm] ⚙ 架构 = 2.0 原型 `' + process.env.EPIRUS_ARCH2 + '`（§E821） ‖ paramCount=' + P.paramCount() +
    ' ‖ 变异算子=' + cfg.mutMode + ' ‖ 起点=随机（v7 夹具包读不进 2.0 ⇒ 两臂同起点、只差算子）' +
    ' ‖ **接线自证 PASS**：校准局里 forwardCands ' + wired.forwards + ' 次 ‖ chooseCandidates(2.0 版) ' + wired.chooseCandidatesCalls + ' 次 ‖ fit=' + (wired.fit == null ? 'n/a' : wired.fit.toFixed(3)));
}
/* ===== 2026-10-29（千问）：把 DS 的**配对评估**接进臂里（`EPIRUS_PAIRED=1`）=====
 * §E822 的病：同代每个个体各抽各的桌 ⇒ 适值差里混着"这桌好不好打"，两臂 ES 因此在**选择噪声上爬坡**
 *   （inLoopBest 涨、固定桌 holdoutFit 反跌）。配对之后同代所有个体吃同一批局 ⇒ 差就是权重差。
 * ⚑ 光把开关拨上不算数（DS 的 `preflight2` ③ 只验了 `evalSeedOf` 这个**函数**，那与"评估路径真走它"同形差别）：
 *   这里除读回 + 同代两个下标种子相同之外，再加一条**记账**：把开/关两侧的"同代种子集合"当场打出来，
 *   跑完的人在回执里能直接看到臂到底配对没配对，不用信我说。 */
if (process.env.EPIRUS_PAIRED) {
  if (typeof T.setPairedEval !== 'function' || typeof T.evalSeedOf !== 'function') {
    console.error('⛔ 下达了 EPIRUS_PAIRED 但引擎没有 setPairedEval/evalSeedOf ⇒ 拒绝静默空转'); process.exit(7);
  }
  T.setPairedEval(true);
  if (T.pairedEvalOn() !== true) { console.error('⛔ EPIRUS_PAIRED 读回不是 true'); process.exit(7); }
  const s0 = T.evalSeedOf(7, 0), s3 = T.evalSeedOf(7, 3), s0b = T.evalSeedOf(8, 0), s3b = T.evalSeedOf(8, 3);
  if (s0 !== s3 || s0b !== s3b) { console.error('⛔ 配对没生效（gen7 idx0/idx3 = ' + s0 + '/' + s3 + ' ‖ gen8 = ' + s0b + '/' + s3b + '）'); process.exit(7); }
  if (s0 === s0b) { console.error('⛔ 跨代没换桌（gen7 与 gen8 种子相同 ⇒ 整轮钉死一张桌，那不是配对，是过拟合同一批局）'); process.exit(7); }
  console.log('[cem-arm] ⚙ **配对评估开**：同代同局号 = 同种子（gen7 idx0=idx3=' + s0 + ' ‖ gen8=' + s0b + ' ⇒ 跨代仍换桌）‖ 每评估 ' + GAMES + ' 局');
}
const DIM = P.paramCount();

/* 起点粒：用**在册的 3P 夹具包**而不是活槽（R3：会换主人的指针不配当夹具）。读不出来就退回固定种子随机粒。 */
let startParams = null, startLabel = '';
const c = loadChamp(W, START_PACK, HERE + '/..');
if (c && c.length === DIM) { startParams = Float64Array.from(c); startLabel = '夹具包 ' + START_PACK; }
if (!startParams) { P.setRng(T.mulberry32(SEED)); startParams = P.makePolicy(0.25); startLabel = 'makePolicy(0.25)'; }
startParams = Float64Array.from(startParams);
/* §E822 起手三件固定动作（都是被"读数看着正常"逼出来的）：
 *   ① 只读副本 `START_COPY` —— 内部 GA 会**就地改**传进去的数组，起点基线绝不能再吃 `startParams`；
 *   ② 固定对手表 `FIX_OPPS`（用起点粒造一次）⇒ 起点与冠军吃**同一批桌**，跨臂才是配对比较；
 *   ③ 算子真实性自检：同一父代、同一条随机流，`seg` 与 `flat` 两档变异**必须产出不同的子代**，
 *      否则"我在比算子"这句话是空的（今天 GA 两臂 md5 相同就是这么来的）。 */
/* 固定对手表（**必须在任何读数之前建好**；用 `var` 声明在这里、真正赋值在下面 `START_COPY` 之后，
 *   因为造它要用到 `T.buildOpps` 而那时 `startParams` 才刚定下来） */
var FIX_OPPS = null;
const START_COPY = Float64Array.from(startParams);
FIX_OPPS = T.buildOpps(START_COPY, 0.05);
{
  const mk = function (mode) {
    const bak = P.mutatePolicy;
    const before = P.__arch2 ? P.__arch2.OPT.mutMode : null;
    if (P.__arch2) P.__arch2.OPT.mutMode = mode;
    const r = bak(START_COPY, 0.2);
    if (P.__arch2) P.__arch2.OPT.mutMode = before;
    return r;
  };
  if (P.__arch2) {
    const a = mk('flat'), b = mk('seg');
    let same = true; for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) { same = false; break; } }
    if (same) { console.error('⛔ 算子档没生效：seg 与 flat 产出**同一个子代** ⇒ "比算子"是空的（今天 GA 两臂 md5 相同的同一个病）'); process.exit(7); }
    console.log('[cem-arm] ✔ 算子真实性自检：seg 与 flat 对同一父代产出**不同**子代（逐位比对第一个差异在第 ' + (() => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i; return -1; })() + ' 个坐标）');
  }
}
/* 每臂一条自己的随机流：同一 seed 两臂可配对（起点相同、预算相同，只差算子） */
function rngFor(s) { let x = (s >>> 0) || 1; return function () { x = (x + 0x6D2B79F5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = function (r) { const u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/* 评估口径两臂共用同一个 opps 构造函数（同一份对手 = E6 那条"与验收同场"的教训） */
/* ===== §E822（10-28 晚，三处"看着正常"的读数一起修）=====
 *   ① `T.buildOpps(params, …)` 里有一部分对手是**按被评的这粒权重**造的 ⇒ 不同臂的"同一函数"其实吃了不同的桌 ⇒
 *      跨臂比读数必须先钉住一份**固定对手表**（用起点粒造一次，之后所有读数都用它）。
 *   ② GA 侧会**就地改**传进去的数组 ⇒ "同场起点基线"若复用 `startParams`，量到的是冠军自己（今天就是这样：
 *      报表起点 fit 与冠军逐字相同，而我另起一次量到的起点是 0.337 vs 报表 0.399）。⇒ 起手前先 `slice()` 一份只读副本。
 *   ③ 内部 GA（`T.makeTrainer`/`step`）不调 `EpirusPolicy.mutatePolicy` ⇒ 我那两档"算子"跑出来是**同一份权重**（md5 相同）。
 *      ⇒ 加一条工具自己拥有的进化策略 `--mode=esa`：父代 + λ 个子代全走 `P.mutatePolicy`/`P.crossover`，
 *      `EPIRUS_MUT_MODE=seg|flat` 才第一次真的改变干预。 */
/* （`FIX_OPPS` 在上面 `START_COPY` 那一节声明并赋值 —— 必须先于任何读数） */
function evalOne(params, gen, idx) {
  const opps = T.buildOpps(params, 0.05);
  const r = T.scoreMemberN(params, opps, GAMES, N, gen, idx, 0);
  return { fit: r.fit == null ? -1 : r.fit, first: r.firstRate == null ? 0 : r.firstRate, top2: r.top2Rate == null ? 0 : r.top2Rate };
}
function evalFixed(params, gen, idx, gamesOverride) {   /* 固定对手表 ⇒ 跨臂配对；games 用 HOLD 的那一档做终局读数 */
  const r = T.scoreMemberN(params, FIX_OPPS, gamesOverride || (gen === 999 ? HOLD : GAMES), N, gen, idx, 0);
  return { fit: r.fit == null ? -1 : r.fit, first: r.firstRate == null ? 0 : r.firstRate, top2: r.top2Rate == null ? 0 : r.top2Rate };
}
const holdout = function (params) {      /* 终局读数：固定场（同一批桌 + 同一 idx/gen） */
  return evalFixed(params, 999, 0);
};

/* ===== ② 起点分母（必须先报，否则"涨了多少"没有参照）===== */
const base = evalOne(startParams, 0, 0);
P.setRng(T.mulberry32(SEED + 1));
const randParams = Float64Array.from(P.makePolicy(0.25));
const rnd = evalOne(randParams, 0, 0);
console.log('桌形 trainMode=' + TMODE + ' ‖ 人数 n=' + N + ' ‖ 每评估局数 games=' + GAMES + ' ‖ 终局读数 holdoutGames=' + HOLD);
console.log('起点分母：' + startLabel + ' fit=' + base.fit.toFixed(4) + ' 夺1=' + (base.first * 100).toFixed(1) + '% ‖' +
  ' 随机粒 fit=' + rnd.fit.toFixed(4) + ' 夺1=' + (rnd.first * 100).toFixed(1) + '%');
if (!(isFinite(base.fit) && isFinite(rnd.fit))) { console.error('⛔ 起点分母读不出（fit 非有限）⇒ 这台尺是死的，不开跑'); process.exit(2); }

/* ===== ① 退化 CEM 自证：同一粒、同一 (gen,idx) 跑几遍必须**逐字相同** =====
 * ⚠ 10-22 凌晨改正了自己的判据形状。第一版写的是"std=0 ⇒ POP 个全同样本取 max 必须等于起点 fit"，
 *   而 `idx` 是 `scoreMemberN` 的入参、**每格抽的桌不同** ⇒ 同一粒权重只换 idx 就能差出一大截
 *   （实测 `idx-spread.mjs`：games=6 · n=3 · 同一粒只换 idx(8 个) ⇒ multi SD=0.167 极差 0.488 ‖ long SD=0.120 极差 0.341）。
 *   ⇒ 那条 max 判据把"两臂同源"错写成"fit 与 idx 无关"，只要 pop>1 就必然 FAIL（本次 multi/long 都 FAIL 过 —— 判据错，不是产品错）。
 *   真正的同源判据是**同格重复逐字相同**；idx 那一截不是 bug，是要**报出来的量具噪声底**。 */
if (DEG) {
  const dup0a = evalOne(startParams, 0, 0), dup0b = evalOne(startParams, 0, 0);
  const same = dup0a.fit === base.fit && dup0b.fit === base.fit;
  const xs = [];
  for (let i = 0; i < POP; i++) xs.push(evalOne(startParams, 0, i).fit);
  const mean = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  const sd = xs.length > 1 ? Math.sqrt(xs.reduce(function (a, b) { return a + (b - mean) ** 2; }, 0) / (xs.length - 1)) : 0;
  console.log('同格重复（同一粒、gen=0、idx=0 共三遍）fit 逐字相同? ' + (same ? 'PASS' : 'FAIL'));
  console.log('量具噪声底：同一粒只换 idx(前 ' + POP + ' 格) ⇒ 均值 ' + mean.toFixed(4) + ' ‖ SD ' + sd.toFixed(4) +
    ' ‖ 极差 ' + (Math.max.apply(null, xs) - Math.min.apply(null, xs)).toFixed(4) +
    ' ⇒ **inLoopBest 里有一截是 idx 抽签，不是权重变好**（跨臂只比固定场读数）');
  console.log(same ? 'PASS 评估口径两臂同源' : 'FAIL 不同源 ⇒ 两臂对比作废');
  process.exit(same ? 0 : 1);
}

const t0 = Date.now();
/* ===== §E822（10-28 傍晚）：**实际局数计数器** =====
 * 动因（实测，不是猜）：三臂标称都是 `--evals=600 --games=2`，但 GA 用了 35.8s、CEM 用了 113.3s ⇒
 *   "评估次数"这一口径在两个模式里**不是同一笔钱**（GA 的 `makeTrainer` 走精英保留 + shaped 适应度，
 *   每代真正打出去的局数与 `POP×GAMES×iters` 不等）。拿它当"同预算"报，就是把**记账口径**当成**干预强度**
 *   （[[feedback-cross-process-readings-must-share-conditions]] 同族）。
 * 修法：在沙箱外面给 `EpirusPlay.autoGameN` 包一层计数器（只数、不改行为），把**实际局数**印进每臂读数。
 *   ⇒ 之后横比只认这个数；标称 evals 仍印着，但它只是"计划剂量"。 */
let GAMES_PLAYED = 0;
{
  const Play = W.EpirusPlay;
  const origN = Play.autoGameN;
  Play.autoGameN = function () { GAMES_PLAYED++; return origN.apply(null, arguments); };
}
const gamesIn = function () { return GAMES_PLAYED; };
let best = startParams, bestFit = -Infinity, used = 0, curve = [];
const checkpoints = [0.1, 0.25, 0.5, 0.75, 1.0].map(function (f) { return f * EVALS; });
const cpG = TARGET_G ? [0.1, 0.25, 0.5, 0.75, 1.0].map(function (f) { return Math.round(f * TARGET_G); }) : [];

if (MODE === 'esa') {
  /* (1+λ)-ES：**全部算子都由本工具拥有**（父代 + λ 个子代各过一遍 `P.mutatePolicy`）
   *   ⇒ `EPIRUS_MUT_MODE=flat|seg` 第一次成为真正的干预（内部 GA 那条路不调这些算子，见上面 ③ 的自检）。
   * ===== `--fxSelect=1`：把"当选"从**每代换桌的最大值**改成**同一批冻结桌上的改进**（10-29 段 C 的直接处方）=====
   * 病（10-29 00:3x 四臂实测）：配对评估开与不开，三条 ES 臂都是 `inLoopBest` 一路涨（0.79~1.09），
   *   而固定桌留出的 dFirst 是 −3.5 / −0.5 / −0.3pt ⇒ 配对只把**同代**个体配平了，
   *   而这里的最优是**跨迭代棘轮**——每次换一批桌取 max，涨的是"哪代桌好打"，不是权重。
   * 处方：廉价环内读数只做**预选**；要真的换父代，必须在**同一批冻结桌**上把父子各评一遍，比的是同格配对差。
   * ⚠ 代价要说清：每接受一次改进就多花 `FX_GAMES` 局 ⇒ 同样的 targetGames 预算下迭代数会变少（读数里能看见）。 */
  let parent = Float64Array.from(startParams);
  let pf = evalOne(parent, 0, 0).fit; bestFit = pf; best = parent;
  let parentFix = FXSEL ? evalFixed(parent, 500, 0, FXG || undefined).fit : 0;
  const r = rngFor(SEED + 17);
  void r;
  const iters = TARGET_G ? 1000000 : Math.max(1, Math.floor(EVALS / POP));
  let accepted = 0, screened = 0;
  /* ===== `--sigmaAdaptive=1`：Rechenberg 的 **1/5 成功律**（10-29 段 C 的第二个旋钮）=====
   * 为什么现在加：两波读数合起来看，问题不在"当选在哪批桌上判"，而在**步长**——
   *   `--fxSelect=1` 把棘轮砍掉了（inLoopBest 0.98→0.765），可 6000 局里只接受了 3~4 次改进
   *   ⇒ σ=0.2 固定一步到底，搜索基本在原地随机游走。1/5 律让 σ 自己找尺度：
   *   近 10λ 次尝试里成功率 >1/5 ⇒ σ×1.22；<1/5 ⇒ σ÷1.22。窗口与判定都写死在这里，别事后调。 */
  const ADAPT = Number(arg('sigmaAdaptive', 0)) > 0;
  const WIN = Math.max(10, POP * 3);
  const hist = [];
  let sig = SIG0, sigTraj = [SIG0];
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < POP; i++) {
      const child = P.mutatePolicy(parent, sig);
      const e = evalOne(child, it, i);
      used += 1;
      let ok = false;
      if (e.fit > bestFit) {
        screened++;
        if (!FXSEL) { bestFit = e.fit; best = child; ok = true; }
        else {
          const cf = evalFixed(child, 500, 0, FXG || undefined);
          if (cf.fit > parentFix) { parentFix = cf.fit; parent = Float64Array.from(child); bestFit = e.fit; best = child; accepted++; ok = true; }
        }
      }
      if (ADAPT) {
        hist.push(ok ? 1 : 0); if (hist.length > WIN) hist.shift();
        if (hist.length === WIN) {
          const rate = hist.reduce(function (a, b) { return a + b; }, 0) / WIN;
          sig = rate > 0.2 ? sig * 1.22 : sig / 1.22;
          sig = Math.min(2.0, Math.max(1e-4, sig));
          sigTraj.push(Math.round(sig * 1e5) / 1e5);
          hist.length = 0;
        }
      }
      while (cpG.length && gamesIn() >= cpG[0]) { curve.push({ games: gamesIn(), best: bestFit }); cpG.shift(); }
      if (TARGET_G && gamesIn() >= TARGET_G) break;
    }
    if (!FXSEL && best !== parent) { parent = Float64Array.from(best); pf = bestFit; }
    if (!TARGET_G) { used += 0; while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); } }
    if (TARGET_G && gamesIn() >= TARGET_G) break;
  }
  if (ADAPT) console.log('[cem-arm] ⚑ 1/5 律自适应 σ：起 ' + SIG0 + ' → 终 ' + sig.toFixed(5) + ' ‖ 轨迹样本 ' + sigTraj.length + ' 点 ‖ 窗口 ' + WIN + ' 次尝试');
  if (FXSEL) console.log('[cem-arm] ⚑ 冻结桌当选：环内预选 ' + screened + ' 次 ‖ 在冻结桌上真打过父代 ' + accepted + ' 次 ‖ 每次验证花 ' + (FXG || GAMES) + ' 局（fxGames=' + FXG + ' ‖ 预算被这块吃掉，迭代数会少）');
} else if (MODE === 'ga') {
  const tr = T.makeTrainer({ popSize: POP, gamesPerOpp: GAMES });
  /* 两臂必须**从同一粒起步**，否则比的不是算子而是起点。GA 侧用仓库自己的热启动 API
   * （`T.seedChampion` ⇒ 0 号位放种子粒、其余围绕它变异），不自己改种群内部结构。 */
  T.seedChampion(tr, startParams);
  const seededOk = tr.pop[0] && tr.pop[0].params.length === DIM;
  if (!seededOk) { console.error('⛔ GA 播种没落地 ⇒ 两臂起点不同，对比作废'); process.exit(2); }
  const gens = TARGET_G ? 1000000 : Math.max(1, Math.floor(EVALS / POP));
  if (T.setSeed) T.setSeed(SEED);
  for (let g = 0; g < gens; g++) {
    const st = T.step(tr);
    used += POP;
    if (st && st.best != null && st.best > bestFit) { bestFit = st.best; }
    if (TARGET_G) {
      if (gamesIn() >= TARGET_G) break;
      while (cpG.length && gamesIn() >= cpG[0]) { curve.push({ games: gamesIn(), best: bestFit }); cpG.shift(); }
    } else while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); }
  }
  best = Float64Array.from(tr.champion);
} else {
  /* 对角 CEM：mean/σ 各 DIM 维；精英取 top ELITE 重拟合；σ 有地板（不做任何"看结果再调"的事后旋钮） */
  let mean = Float64Array.from(startParams);
  let sd = new Float64Array(DIM).fill(SIG0);
  const r = rngFor(SEED);
  const iters = TARGET_G ? 1000000 : Math.max(1, Math.floor(EVALS / POP));
  for (let it = 0; it < iters; it++) {
    const cand = [], scored = [];
    for (let i = 0; i < POP; i++) {
      const v = new Float64Array(DIM);
      for (let d = 0; d < DIM; d++) v[d] = mean[d] + sd[d] * gauss(r);
      cand.push(v); scored.push(evalOne(v, it, i));
    }
    const order = scored.map(function (s, i) { return i; }).sort(function (a, b) { return scored[b].fit - scored[a].fit; });
    const keep = order.slice(0, Math.max(2, ELITE));
    const nm = new Float64Array(DIM), ns = new Float64Array(DIM);
    for (let d = 0; d < DIM; d++) {
      let m = 0; for (const k of keep) m += cand[k][d]; m /= keep.length; nm[d] = m;
    }
    for (let d = 0; d < DIM; d++) {
      let v = 0; for (const k of keep) { const e = cand[k][d] - nm[d]; v += e * e; } v /= keep.length;
      ns[d] = Math.sqrt(v) < SIG_FLOOR ? SIG_FLOOR : Math.sqrt(v);
    }
    const bf = scored[keep[0]].fit; if (bf > bestFit) { bestFit = bf; best = cand[keep[0]]; }
    mean = nm; sd = ns;
    used += POP;
    if (TARGET_G) {
      if (gamesIn() >= TARGET_G) break;
      while (cpG.length && gamesIn() >= cpG[0]) { curve.push({ games: gamesIn(), best: bestFit }); cpG.shift(); }
    } else while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); }
  }
}
const gLoop = gamesIn();
/* §E822：**同场起点基线** —— 终局那把尺必须先在同一批桌上量一次"起点粒"，否则 6.5% / 13.0% 这种数没有地板
 *   （第一波只印了 `起点分母 fit=… 夺1=50.0%`，那是 **2 局**的读数，拿来当参照就是把噪声当地板）。 */
const hoStart = holdout(START_COPY);
const gStart = gamesIn() - gLoop;
const ho = holdout(best);
const gHold = gamesIn() - gLoop - gStart;
const row = { mode: MODE, seed: SEED, evals: used, pop: POP, games: GAMES, n: N, elite: ELITE, sig0: SIG0,
  /* §E822：**实际局数**（计数器数出来的）与"标称预算"并列印 ⇒ 谁想拿 `evals` 当等预算，先看见这两个数 */
  gamesPlanned: used * GAMES, gamesActualLoop: gLoop, gamesActualHoldout: gHold, gamesActualStartHoldout: gStart,
  targetGames: TARGET_G || null,
  /* §E822 吞吐记账（2.0 才有 ⇒ 不带 EPIRUS_ARCH2 时为 null）：横比与"要不要上 GPU"都得先看这两个数 */
  netForwards: P.__arch2 ? P.__arch2.CNT.forwards : null,
  netCandScores: P.__arch2 ? P.__arch2.CNT.cands : null,
  /* §E679 补（10-22）：回执里必须自带**桌形与终局读数局数** —— 批 D 的数当时只能从日志首行的打印抄，
   *   而"哪台尺 + 哪种启动"是读数可不可比的一部分（记忆：记下用哪台尺与哪种启动）。 */
  trainMode: TMODE, holdoutGames: HOLD,
  startFit: base.fit, inLoopBest: bestFit, holdoutFit: ho.fit, holdoutFirst: ho.first, holdoutTop2: ho.top2,
  /* §E822 同场起点基线：与上面三个 `holdout*` 走**同一函数、同一批桌** ⇒ `dFirst/dTop2` 才是这趟训练买到的东西
   *   （第一波只印了 2 局的"起点分母"，那不是地板，是噪声）。 */
  holdoutStartFit: hoStart.fit, holdoutStartFirst: hoStart.first, holdoutStartTop2: hoStart.top2,
  dFirst: ho.first - hoStart.first, dTop2: ho.top2 - hoStart.top2,
  curve: curve, secs: Number(((Date.now() - t0) / 1000).toFixed(1)), startLabel: startLabel };
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(best)) + ';\n', 'utf8');
  row.wrote = OUT;
}
if (!QUIET) console.log(JSON.stringify(row));
else console.log('RESULT ' + JSON.stringify(row));
console.log('⚠ inLoopBest 是各臂**循环内部**的分（GA 走 shaped/内部择优，CEM 走原始 fit）⇒ 跨臂不可比；跨臂只比 holdoutFit / holdoutFirst（同一函数同一场）。');
console.log('⚑ 实际局数（计数器数的，含起点分母与 holdout 之外的循环）：循环 ' + gLoop + ' 局 ‖ holdout ' + gHold + ' 局 ‖' +
  ' 而标称 `evals×games` = ' + (used * GAMES) + ' ⇒ **横比只认这个数**；两臂循环局数不等 ⇒ "同预算"这句话不成立（§E822 实测 GA 与 CEM 差 3 倍）');
if (P.__arch2) {
  const c = P.__arch2.CNT;
  console.log('⚑ 吞吐（2.0 前向自己的账）：决策打分 ' + c.forwards + ' 次 ‖ 候选打分 ' + c.cands + ' 个 ‖' +
    ' 每局平均 ' + (c.forwards / Math.max(1, gLoop + gHold + gStart)).toFixed(1) + ' 次决策 ⇒' +
    ' **"局数相等"不等于"算力相等"：赢面高的包局更长、决策更多**（这一格以前没人印过）');
}
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT + '.meta.json', JSON.stringify(row, null, 1), 'utf8'); }
