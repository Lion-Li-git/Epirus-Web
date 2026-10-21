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
 *   ① 退化 CEM（`--degenerate=1` ⇒ std=0，所有样本同一粒）的 bestFit 必须**逐字等于**起点那粒自己的 fit
 *      ⇒ 证明这台尺读的是同一件事，而不是 CEM 在偷偷换评估；
 *   ② 起点分母必须报出来（seed 粒与随机粒各一次），否则"涨了多少"没有参照（记忆里那条"发臂前先量起点分母"）。
 *
 * 用法：node tools/probe-cem-arm.mjs --mode=ga|cem --evals=2000 [--pop=14] [--games=4] [--n=3]
 *        [--seed=7] [--elite=4] [--sig=0.2] [--degenerate=1] [--out=<pack 落点>] [--quiet]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp } from './audit-lib.mjs';

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

/* ===== ① 退化 CEM 自证：std=0 ⇒ 所有样本 = 起点粒 ⇒ bestFit 必须与起点逐字相同 ===== */
if (DEG) {
  const r = rngFor(SEED); const samples = [];
  for (let i = 0; i < POP; i++) samples.push(Float64Array.from(startParams));
  const scored = samples.map(function (p, i) { return evalOne(p, 0, i); });
  const best = Math.max.apply(null, scored.map(function (s) { return s.fit; }));
  console.log('退化 CEM（std=0，' + POP + ' 个全同的样本）bestFit=' + best.toFixed(6) + ' ‖ 起点单粒 fit=' + base.fit.toFixed(6));
  const same = Math.abs(best - base.fit) < 1e-12;
  console.log(same ? 'PASS 退化臂逐字等于起点 ⇒ 评估口径两臂同源' : 'FAIL 不相等 ⇒ 预算/评估不同源，两臂对比作废');
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
