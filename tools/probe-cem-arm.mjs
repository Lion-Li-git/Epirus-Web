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
import { install as installArch2 } from './proto2/arch2.mjs';   // §E821：默认关（不带 EPIRUS_ARCH2 ⇒ 逐字照旧）

/* §E679 补（10-22）：这台量具原先**没有输入消毒层**（D218 那条门当场抓到，是我今夜建它时就漏的）。
 * 拼错的旗标被静默忽略 = 读数按默认档跑完而没人知道 ⇒ 与"黑键"同族。名单跟着 `arg('…')` 走。 */
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['mode', 'evals', 'pop', 'games', 'n', 'seed', 'elite', 'sig', 'degenerate',
  'start', 'out', 'quiet', 'trainMode', 'holdoutGames'], 'probe-cem-arm');

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const MODE = arg('mode', '');
if (MODE !== 'ga' && MODE !== 'cem') {
  console.error('⛔ --mode 只认 ga|cem（实测 ' + (MODE || '(空)') + '）。本工具只吃 --旗标，不吃位置参数。');
  process.exit(64);
}
const EVALS = Number(arg('evals', 2000));
const POP = Number(arg('pop', 14));
const GAMES = Number(arg('games', 4));
const N = Number(arg('n', 3));
const SEED = Number(arg('seed', 7));
const ELITE = Number(arg('elite', 4));
const SIG0 = Number(arg('sig', 0.2));
const SIG_FLOOR = 0.01;
const DEG = arg('degenerate', '') === '1';
const QUIET = process.argv.includes('--quiet');
const START_PACK = arg('start', 'docs/artifacts/eval-out/win-Ldemo.bak');
if (!/^[a-zA-Z0-9._/-]+.(bak|js)$/.test(START_PACK)) { console.error('⛔ --start 要一个仓库内包文件（实测 ' + START_PACK + '）'); process.exit(64); }
const OUT = arg('out', '');

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
  console.log('[cem-arm] ⚙ 架构 = 2.0 原型 `' + process.env.EPIRUS_ARCH2 + '`（§E821） ‖ paramCount=' + P.paramCount() +
    ' ‖ 变异算子=' + cfg.mutMode + ' ‖ 起点=随机（v7 夹具包读不进 2.0 ⇒ 两臂同起点、只差算子）');
}
const DIM = P.paramCount();
/* 起点粒：用**在册的 3P 夹具包**而不是活槽（R3：会换主人的指针不配当夹具）。读不出来就退回固定种子随机粒。 */
let startParams = null, startLabel = '';
const c = loadChamp(W, START_PACK, HERE + '/..');
if (c && c.length === DIM) { startParams = Float64Array.from(c); startLabel = '夹具包 ' + START_PACK; }
if (!startParams) { P.setRng(T.mulberry32(SEED)); startParams = P.makePolicy(0.25); startLabel = 'makePolicy(0.25)'; }
startParams = Float64Array.from(startParams);
/* 每臂一条自己的随机流：同一 seed 两臂可配对（起点相同、预算相同，只差算子） */
function rngFor(s) { let x = (s >>> 0) || 1; return function () { x = (x + 0x6D2B79F5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = function (r) { const u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/* 评估口径两臂共用同一个 opps 构造函数（同一份对手 = E6 那条"与验收同场"的教训） */
function evalOne(params, gen, idx) {
  const opps = T.buildOpps(params, 0.05);
  const r = T.scoreMemberN(params, opps, GAMES, N, gen, idx, 0);
  return { fit: r.fit == null ? -1 : r.fit, first: r.firstRate == null ? 0 : r.firstRate, top2: r.top2Rate == null ? 0 : r.top2Rate };
}
const holdout = function (params) {   /* 终局读数：固定 idx/gen ⇒ 两臂同一把尺 */
  const opps = T.buildOpps(params, 0.05);
  const r = T.scoreMemberN(params, opps, HOLD, N, 999, 0, 0);
  return { fit: r.fit, first: r.firstRate, top2: r.top2Rate };
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
let best = startParams, bestFit = -Infinity, used = 0, curve = [];
const checkpoints = [0.1, 0.25, 0.5, 0.75, 1.0].map(function (f) { return f * EVALS; });

if (MODE === 'ga') {
  const tr = T.makeTrainer({ popSize: POP, gamesPerOpp: GAMES });
  /* 两臂必须**从同一粒起步**，否则比的不是算子而是起点。GA 侧用仓库自己的热启动 API
   * （`T.seedChampion` ⇒ 0 号位放种子粒、其余围绕它变异），不自己改种群内部结构。 */
  T.seedChampion(tr, startParams);
  const seededOk = tr.pop[0] && tr.pop[0].params.length === DIM;
  if (!seededOk) { console.error('⛔ GA 播种没落地 ⇒ 两臂起点不同，对比作废'); process.exit(2); }
  const gens = Math.max(1, Math.floor(EVALS / POP));
  if (T.setSeed) T.setSeed(SEED);
  for (let g = 0; g < gens; g++) {
    const st = T.step(tr);
    used += POP;
    if (st && st.best != null && st.best > bestFit) { bestFit = st.best; }
    while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); }
  }
  best = Float64Array.from(tr.champion);
} else {
  /* 对角 CEM：mean/σ 各 DIM 维；精英取 top ELITE 重拟合；σ 有地板（不做任何"看结果再调"的事后旋钮） */
  let mean = Float64Array.from(startParams);
  let sd = new Float64Array(DIM).fill(SIG0);
  const r = rngFor(SEED);
  const iters = Math.max(1, Math.floor(EVALS / POP));
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
    while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); }
  }
}
const ho = holdout(best);
const row = { mode: MODE, seed: SEED, evals: used, pop: POP, games: GAMES, n: N, elite: ELITE, sig0: SIG0,
  /* §E679 补（10-22）：回执里必须自带**桌形与终局读数局数** —— 批 D 的数当时只能从日志首行的打印抄，
   *   而"哪台尺 + 哪种启动"是读数可不可比的一部分（记忆：记下用哪台尺与哪种启动）。 */
  trainMode: TMODE, holdoutGames: HOLD,
  startFit: base.fit, inLoopBest: bestFit, holdoutFit: ho.fit, holdoutFirst: ho.first, holdoutTop2: ho.top2,
  curve: curve, secs: Number(((Date.now() - t0) / 1000).toFixed(1)), startLabel: startLabel };
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(P.pack(best)) + ';\n', 'utf8');
  row.wrote = OUT;
}
if (!QUIET) console.log(JSON.stringify(row));
else console.log('RESULT ' + JSON.stringify(row));
console.log('⚠ inLoopBest 是各臂**循环内部**的分（GA 走 shaped/内部择优，CEM 走原始 fit）⇒ 跨臂不可比；跨臂只比 holdoutFit / holdoutFirst（同一函数同一场）。');
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT + '.meta.json', JSON.stringify(row, null, 1), 'utf8'); }
