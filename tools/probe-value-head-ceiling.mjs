#!/usr/bin/env node
/* §E197/§E198 · **上限能学到几成**：只用现役那 235 维拟合价值头，看它兑现 §E195/§E196 那个 +23~28pt 的多少
 *
 * 为什么问这一格：§E195/§E196 给了上限（一手完美根决策 = 全程 +23~28pt），但上限是**拿着真未来挑出来的**，
 *   不等于学得会。掏换代钱之前要知道的是："**一个不带未来的、只看现有特征的评分函数，能兑现几成**"。
 *   ⇒ 最便宜的一版：**不加新维度、不改 `PACK_VERSION`**，只在网络已经在算的 235 维上做岭回归（§E197 = flat）；
 *   ⇒ 再问一层（§E198）：把"动作 × 情景"的**交互基**加进去能不能多兑现 —— 这直接区分
 *      "剩下那八成要**隐层/交互**"还是"要**更远的视界**"。
 *
 * 数据：`tools/probe-myopia-regret.mjs --dump=`（**同一台仪器的同一批标签**，不另写采集器 —— rollout 的算术只能有一份）。
 *   每行 = 一个采样决策的一个候选：`x`(213 状态 ⊕ 22 动作) ‖ `net`(现役打分) ‖ `win`(同 3 条随机流的模拟赢率)。
 *   ⇒ **训练带与测试带是不同批 seed**（4100 拟合 → 21000 留出，`--train/--test` 可对调复跑）。
 *
 * 主判据（**分母的符号要先验** —— 这里踩过一次）：
 *   `regret(方案) = 组内 oracle 的 win − 方案选的那手的 win`（同组同批标签 ⇒ 配对）
 *   **capture = (regret(net) − regret(head)) / regret(net)**
 *   ⚠ 第一版我把分母写成 `regret(net) − regret(rand)`，而 `regret(oracle) ≡ 0` 且实测 `regret(net) < regret(rand)`
 *     ⇒ 那个分母是**负数**，capture 报出过 383%。⇒ 分母只能是被比较基线自己的 regret；`rand` 只当参照线印出来。
 *
 * ★ **一条结构性事实，比兑现率更要紧**（§E197 判读 3）：状态那 213 维**在同一个决策内对所有候选是同一个向量**
 *   ⇒ 排候选时**整体抵消** ⇒ flat 模型的组内判别力**只能**来自动作那 22 维 ⇒ 它学到的必然是
 *   "哪类卡普遍划算"这种**无情景先验**，而不是"这个局面该出这张"。⇒ 所以要专门跑 `--inter` 那一档才知道情景值多少钱。
 *
 * 对照（同遍输出，杜绝挑数）：flat / **flat 标签置换** / inter / **inter 标签置换**。置换遍必须回到 ~0，否则读数全废。
 * ★ **但"置换对照回到 0"只是必要条件，不是充分条件**：换向遍里 flat 的置换对照自己就有 **+7.4%**（与真值 17.5% 差不到一倍）。
 *   机制：一个**与结局无关的固定动作权重方向**也能打败现役网络的组内排序 —— 因为网络那侧的相关本来就是 0（甚至 −0.009）。
 *   ⇒ 所以主表下面还有一张**净兑现**表：`真值 − 自己的置换对照`（**同组配对**，三重配对：inter 与 flat 各自先减零假设再互减）。
 *   ⇒ 未减零假设时我把 inter 判成"帮倒忙"；减完两遍都是"净增在噪声内"。**这是一个判据被自己的对照改掉的具体例子。**
 * ⚠ 限制：标签是"一手偏离 + 关档延续"的模拟赢率（继承 §E195 限制 1）；比较范围只在 dump 的 top-8 短名单**内部**；
 *   标签只带 3 条随机流 ⇒ 组内相关被噪声衰减，"分不开"不等于"等于 0"。
 *
 * 只读 `docs/artifacts/e184-out/*.jsonl`（本机产物，不进 git）与 `js/**`，不改引擎、不加门、不动冠军槽。
 */
import { readFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['train', 'test', 'lambda', 'inter', 'groups', 'depth', 'qhead', 'mlp', 'mlp-ep', 'mlp-lr', 'fitprobe'], 'probe-value-head-ceiling');
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const TRAIN = arg('train', 'docs/artifacts/e184-out/e197-rows-4100.jsonl');
const TEST = arg('test', 'docs/artifacts/e184-out/e197-rows-21000.jsonl');
const LAM = Number(arg('lambda', 1)) || 1;
const INTER_N = Math.max(0, Number(arg('inter', 6)) || 0);
const MAXG = Number(arg('groups', 0)) || 0;

function load(p) { return readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); }
/* ⚠ `--dump --depth2` 现在会同时落 `lvl:1`（根决策 × 候选）与 `lvl:2`（第二手那一层）两种行。
 *   主分析是**组内排序**问题，只看根行；`lvl:2` 行没有 `env/g/n` 三字段 ⇒ 若混进来会被 `keyOf` 归成同一个
 *   "undefined#undefined#undefined" 的巨组、**静默把结果算错**（不是报错）。⇒ 在读入处就按层筛掉。
 *   旧 dump（没有 `lvl` 字段）全部当 lvl:1 ⇒ §E197/§E198 的复跑逐字不变。 */
const only1 = a => a.filter(r => (r.lvl == null ? 1 : r.lvl) === 1);
const trRaw = load(TRAIN), teRaw = load(TEST);
const L2ROWS = trRaw.concat(teRaw).filter(r => r.lvl === 2);
const tr = only1(trRaw), te = only1(teRaw);
const DIM = tr[0].x.length;
if (te[0].x.length !== DIM) { console.error('⛔ 两批特征维度不一致 ⇒ 不是同一台仪器'); process.exit(2); }
const FS = DIM - 22;                                    /* 状态块 = `FEAT_S`(213)，动作块 = `FEAT_A`(22) */

/* 组 = 同一个决策（环境#局#第几手）。组内候选共享同一个状态向量。 */
const keyOf = r => r.env + '#' + r.g + '#' + r.n;
function groupify(rows) {
  const m = new Map();
  for (const r of rows) { const k = keyOf(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  const out = [];
  for (const [k, v] of m) if (v.length >= 2) { v.sort((a, b) => a.i - b.i); out.push({ k, rows: v }); }
  return out;
}
const trG = groupify(tr), teAll = groupify(te);
const gs = MAXG ? teAll.slice(0, MAXG) : teAll;

/* ---- 标准化统计量只在训练带上算 ---- */
const mu = new Array(DIM).fill(0), sg = new Array(DIM).fill(1);
for (const r of tr) for (let j = 0; j < DIM; j++) mu[j] += r.x[j];
for (let j = 0; j < DIM; j++) mu[j] /= tr.length;
for (const r of tr) for (let j = 0; j < DIM; j++) sg[j] += (r.x[j] - mu[j]) * (r.x[j] - mu[j]);
for (let j = 0; j < DIM; j++) { const s = Math.sqrt(sg[j] / Math.max(1, tr.length - 1)); sg[j] = s > 1e-9 ? s : 1; }
const nz = (r, j) => (r.x[j] - mu[j]) / sg[j];

/* ---- 岭回归求解（维度 n = 基维 + 偏置；最后一维不惩罚） ---- */
function solve(Z, yRaw, n, shuffleSeed) {
  const y = yRaw.slice();
  if (shuffleSeed) {
    let s = shuffleSeed >>> 0;
    const rr = () => { s ^= s << 13; s >>>= 0; s ^= s << 17; s ^= s >>> 5; s >>>= 0; return s / 4294967296; };
    for (let i = y.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); const t = y[i]; y[i] = y[j]; y[j] = t; }
  }
  const A = []; for (let i = 0; i < n; i++) A.push(new Array(n + 1).fill(0));
  for (let r = 0; r < Z.length; r++) {
    const z = Z[r];
    for (let i = 0; i < n; i++) { const zi = z[i]; if (!zi) continue;
      for (let j = i; j < n; j++) A[i][j] += zi * z[j];
      A[i][n] += zi * y[r];
    }
  }
  for (let i = 0; i < n - 1; i++) A[i][i] += LAM;
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i];
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    const t = A[c]; A[c] = A[p]; A[p] = t;
    const d = A[c][c] || 1e-9;
    for (let j = c; j <= n; j++) A[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (!f) continue; for (let j = c; j <= n; j++) A[r][j] -= f * A[c][j]; }
  }
  return A.map(r => r[n]);
}

/* ---- 两档基 ---- */
const mkFlat = r => { const z = new Array(DIM + 1); for (let j = 0; j < DIM; j++) z[j] = nz(r, j); z[DIM] = 1; return z; };
const flatDim = DIM + 1;
function topStateDims(w, k) {
  const idx = []; for (let j = 0; j < FS; j++) idx.push([j, Math.abs(w[j])]);
  idx.sort((a, b) => b[1] - a[1]);
  return idx.slice(0, k).map(t => t[0]);
}
function mkInterOf(sdim) {
  return function (r) {
    const a = []; for (let j = FS; j < DIM; j++) a.push(nz(r, j));
    const z = a.slice();
    for (let j = 0; j < a.length; j++) for (const s of sdim) z.push(a[j] * nz(r, s));
    z.push(1);
    return z;
  };
}
const interDim = 22 + 22 * INTER_N + 1;
const scorer = (mk, w) => r => { const z = mk(r); let s = 0; for (let i = 0; i < w.length; i++) s += z[i] * w[i]; return s; };

/* ---- 留出评估：三把尺（net / head / rand 地板），全部**同组配对** ---- */
function evalSc(sc) {
  const netG = [], headG = [], randG = [], gainG = [];
  let agree = 0, n = 0;
  for (const gp of gs) {
    const rr = gp.rows;
    const orc = Math.max(...rr.map(x => x.win));
    const netIdx = rr.reduce((b, x, i) => (x.net > rr[b].net ? i : b), 0);
    const headIdx = rr.reduce((b, x, i) => (sc(x) > sc(rr[b]) ? i : b), 0);
    const randIdx = (gp.k.length * 7 + rr.length) % rr.length;
    const nr = orc - rr[netIdx].win, hr = orc - rr[headIdx].win;
    netG.push(nr); headG.push(hr); randG.push(orc - rr[randIdx].win); gainG.push(nr - hr);
    n++; if (headIdx === netIdx) agree++;
  }
  return { netG, headG, randG, gainG, agree, n };
}
function evalHead(mk, w) { return evalSc(scorer(mk, w)); }
function withinCorr(f) {
  const cs = [];
  for (const gp of gs) {
    const rr = gp.rows; if (rr.length < 3) continue;
    const xs = rr.map(f), ys = rr.map(r => r.win);
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    if (sxx > 1e-12 && syy > 1e-12) cs.push(sxy / Math.sqrt(sxx * syy));
  }
  return { m: mean(cs), ci: ci(cs), n: cs.length };
}
const mean = x => x.reduce((p, q) => p + q, 0) / Math.max(1, x.length);
function ci(x) { const m = mean(x); const s = Math.sqrt(x.reduce((p, q) => p + (q - m) * (q - m), 0) / Math.max(1, x.length - 1)); return 1.96 * s / Math.sqrt(Math.max(1, x.length)); }

/* ---- 拟合：flat（真标签 + 置换）与 inter（真标签 + 置换），**同遍输出** ---- */
const yWin = tr.map(r => r.win);
const wFlat = solve(tr.map(mkFlat), yWin, flatDim, 0);
const wFlatS = solve(tr.map(mkFlat), yWin, flatDim, 20260930);
const sdim = topStateDims(wFlat, INTER_N);
const mkInter = mkInterOf(sdim);
const wInt = INTER_N ? solve(tr.map(mkInter), yWin, interDim, 0) : null;
const wIntS = INTER_N ? solve(tr.map(mkInter), yWin, interDim, 20260930) : null;

const eFlat = evalHead(mkFlat, wFlat), eFlatS = evalHead(mkFlat, wFlatS);
const eInt = wInt ? evalHead(mkInter, wInt) : null, eIntS = wIntS ? evalHead(mkInter, wIntS) : null;
const capNet = mean(eFlat.netG), capRand = mean(eFlat.randG);

/* ===== §E208 · `--mlp=H`：**换代那一格的第一试** —— 剩下那八成到底是"头的形状"还是"特征/标签" =====
 * 为什么这一格现在做：夜里四条便宜路全实测关掉（手写价 / 重学打分 12~22% / 加深臂 2.6~5.0pt / 给学出来的头再加一层搜索 ≈0）。
 *   其中"重学打分"只试了**线性**与**显式二阶交互基**两种形状（§E197/§E198）。⇒ 要把"换代"这笔钱判给
 *   "把落点算准（结算函数）"，必须先排掉第三种可能：**隐层**（能自己学出 动作×情景 的交互，不用我手挑 top-K 状态维）。
 *   若 MLP 也只兑现 ≈0 ⇒ 限制在**特征 + 标签**这一侧，形状不是瓶颈 ⇒ 换代那一格才真的只剩"算准落点"一条。
 *   若不是 ⇒ 换代的第一件东西应该是"打分头换成带隐层的头"，那是**便宜得多**的一格（不改 PACK 形状以外的东西？不，改 ⇒ 要重训重发包，仍比改结算便宜）。
 * 口径与 §E197/§E198 **一字不动**：同一批 dump、同一套标准化、同一套组内配对 regret、同一遍里跑**标签置换对照**。
 *   ⇒ 唯一动的自由度 = 头的形状（线性/二阶基 → 一个 tanh 隐层）。*/
const MLP_H = Math.max(0, Number(arg('mlp', 0)) || 0);
let eMlp = null, eMlpS = null, mlpDiag = '', scMlpR = null, scMlpP = null;
if (MLP_H) {
  const X = tr.map(r => { const z = new Float64Array(DIM); for (let j = 0; j < DIM; j++) z[j] = nz(r, j); return z; });
  const lcg = seed => { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s << 17; s ^= s >>> 5; s >>>= 0; return s / 4294967296; }; };
  const ini = lcg(MLP_H * 7919 + 104729);
  const W1i = Array.from({ length: DIM }, () => Array.from({ length: MLP_H }, () => (ini() - 0.5) * 0.5));
  const W2i = Array.from({ length: MLP_H }, () => (ini() - 0.5) * 0.5);
  const b1i = new Array(MLP_H).fill(0), b2i = [0];
  const ybar = mean(yWin);
  const clone = () => ({ W1: W1i.map(r => r.slice()), W2: W2i.slice(), b1: b1i.slice(), b2: b2i.slice() });
  const EPOCH = Math.max(1, Number(arg('mlp-ep', 60)) || 60), BATCH = 256, LR = Number(arg('mlp-lr', 0.08)) || 0.08, MOM = 0.85, WD = 1e-5;
  /* ★ 一次前向 + 反向，真标签与置换标签走**同一个函数**（同初始化、同超参、同打乱序列 ⇒ 唯一自由度 = 标签是否被打乱） */
  function train(Yc) {
    const { W1, W2, b1, b2 } = clone();
    const shuf = lcg(MLP_H * 7919 + 104729);                   /* 与初始化同种子 ⇒ 每次 train() 的打乱序列一致 */
    const order = X.map((_, i) => i);
    const v1 = W1.map(r => r.map(() => 0)), v2 = W2.map(() => 0), vb1 = b1.map(() => 0), vb2 = b2.map(() => 0);
    let mse = NaN;
    for (let ep = 0; ep < EPOCH; ep++) {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(shuf() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
      for (let bi = 0; bi < order.length; bi += BATCH) {
        const end = Math.min(order.length, bi + BATCH), m = end - bi;
        const g1 = W1.map(r => new Float64Array(MLP_H)), g2 = new Float64Array(MLP_H), gb1 = new Float64Array(MLP_H), gb2 = [0];
        let sq = 0;
        for (let t = bi; t < end; t++) {
          const z = X[order[t]];
          const h = new Float64Array(MLP_H);
          for (let k = 0; k < MLP_H; k++) { let a = b1[k]; for (let j = 0; j < DIM; j++) a += z[j] * W1[j][k]; h[k] = Math.tanh(a); }
          let o = b2[0]; for (let k = 0; k < MLP_H; k++) o += h[k] * W2[k];
          const err = o - Yc[order[t]]; sq += err * err;
          for (let k = 0; k < MLP_H; k++) {
            const d = err * (1 - h[k] * h[k]);
            gb1[k] += d; for (let j = 0; j < DIM; j++) g1[j][k] += z[j] * d;
            g2[k] += h[k] * err;
          }
          gb2[0] += err;
        }
        for (let j = 0; j < DIM; j++) for (let k = 0; k < MLP_H; k++) { v1[j][k] = MOM * v1[j][k] + LR * (g1[j][k] / m + WD * W1[j][k]); W1[j][k] -= v1[j][k]; }
        for (let k = 0; k < MLP_H; k++) { v2[k] = MOM * v2[k] + LR * (g2[k] / m + WD * W2[k]); W2[k] -= v2[k]; vb1[k] = MOM * vb1[k] + LR * (gb1[k] / m); b1[k] -= vb1[k]; }
        vb2[0] = MOM * vb2[0] + LR * (gb2[0] / m); b2[0] -= vb2[0];
        mse = sq / m;
      }
      if (!Number.isFinite(mse)) break;
    }
    return { W1, W2, b1, b2, mse };
  }
  const mksc = M => r => { const z = new Float64Array(DIM); for (let j = 0; j < DIM; j++) z[j] = nz(r, j); let s = M.b2[0] + ybar; for (let k = 0; k < MLP_H; k++) { let a = M.b1[k]; for (let j = 0; j < DIM; j++) a += z[j] * M.W1[j][k]; s += Math.tanh(a) * M.W2[k]; } return s; };
  const Mr = train(yWin.map(v => v - ybar));
  const YS = yWin.slice();
  { const rr = lcg(20260930); for (let i = YS.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); const t = YS[i]; YS[i] = YS[j]; YS[j] = t; } }
  const Mp = train(YS.map(v => v - ybar));
  eMlp = evalSc(mksc(Mr)); eMlpS = evalSc(mksc(Mp));
  scMlpR = mksc(Mr); scMlpP = mksc(Mp);
  /* ⚠ **必须先排除"没训好"这一种解释**：MLP 的净增 ≈0 有两种成因 —— 形状真的没用 / 我自己没优化到位。
   *   分法 = 同遍印 **拟合质量**（train 与留出上的 R²，对 `win` 这一连续标签）。若 MLP 在样本内明明比 flat 拟合得好、
   *   留出兑现却不涨 ⇒ 是"标签里没有那个结构"；若连样本内都追不上 flat ⇒ 是我的优化器/超参的问题，读数作废。
   *   （R² 是**校准**度量，与 regret（组内排序）不同物 ⇒ 只用作"训没训动"的诊断，不当结论引。）*/
  const r2 = (sc, rows) => { const my = mean(rows.map(r => r.win)); let sse = 0, sst = 0; for (const r of rows) { const e = sc(r) - r.win; sse += e * e; sst += (r.win - my) ** 2; } return 1 - sse / sst; };
  mlpDiag = '训练 ' + X.length + ' 行 ‖ 隐层 ' + MLP_H + ' ‖ ' + EPOCH + ' 轮 × batch ' + BATCH + ' ‖ 末轮训练 MSE（中心化）= ' + Mr.mse.toExponential(2)
    + '\n#   拟合质量 R²（**只作"训没训动"的诊断，不作结论**）：MLP 训练集 ' + r2(scMlpR, tr).toFixed(3) + ' ‖ MLP 留出 ' + r2(scMlpR, te).toFixed(3)
    + ' ‖ flat 训练集 ' + r2(scorer(mkFlat, wFlat), tr).toFixed(3) + ' ‖ flat 留出 ' + r2(scorer(mkFlat, wFlat), te).toFixed(3)
    + (r2(scMlpR, tr) > r2(scorer(mkFlat, wFlat), tr) + 0.02
      ? ' ⇒ MLP **样本内确实更会拟合**（比 flat 高），而留出兑现不涨 ⇒ 病在"标签里没有那个结构"，不是"没训动"'
      : ' ⇒ ⚠ MLP 在样本内也没明显超过 flat ⇒ **不能排除优化不到位**，本节的"形状不是瓶颈"要打折（先调 lr/轮数再重跑）')
    + '\n#   两遍（真/置换）从**同一初始化、同一打乱序列、同一超参**出发 ⇒ 唯一自由度 = 标签有没有被打乱。定种子 ⇒ 同 flag 逐字可复现。';
}

console.log('# §E197/§E198 价值头能兑现上限的几成（训练 ' + tr.length + ' 行 / ' + trG.length + ' 组 → **留出** ' + te.length + ' 行 / ' + gs.length + ' 组 ‖ λ=' + LAM + ' ‖ 交互基 dim=' + INTER_N + '）');
console.log('# 特征 = 现役那 ' + DIM + ' 维（状态 ' + FS + ' ‖ 动作 22）‖ 标签 = §E195 同一台仪器模拟出的赢率（一手偏离 + 关档延续）');
console.log('# capture = (regret(net) − regret(head)) / regret(net)‖分母是被比较基线自己（第一版误用 net−rand，符号为负，报出过 383%）');
console.log('# ⚠ 状态维在同一决策内对所有候选**相同** ⇒ 组内排序时抵消 ⇒ flat 的组内判别力只可能来自动作那 22 维'
  + (MLP_H ? '\n# §E208 `--mlp=' + MLP_H + '`：' + mlpDiag : '\n# （`--mlp=0` ⇒ 本节形状照旧 = flat/inter 两档，与 §E197/§E198 出厂读数逐字相同）') + '\n');
console.log('| 模型 | regret(head) | **regret(net) − regret(head)** | 兑现率 | 组内相关 head↔win | 与网络同手 |');
console.log('|---|---|---|---|---|---|');
const row = (nm, e, c) => '| ' + nm + ' | ' + (100 * mean(e.headG)).toFixed(2) + ' | **' + (100 * mean(e.gainG)).toFixed(2) + ' ±' + (100 * ci(e.gainG)).toFixed(2) + '** | **'
  + (100 * mean(e.gainG) / capNet).toFixed(1) + '%** | ' + c.m.toFixed(3) + ' ±' + c.ci.toFixed(3) + ' | ' + (100 * e.agree / e.n).toFixed(1) + '% |';
console.log(row('flat（235 维线性）', eFlat, withinCorr(scorer(mkFlat, wFlat))));
console.log(row('flat · **标签置换对照**', eFlatS, withinCorr(scorer(mkFlat, wFlatS))));
if (eInt) {
  console.log(row('inter（动作 22 ⊕ 动作×状态 top' + INTER_N + ' = ' + (interDim - 1) + ' 维基）', eInt, withinCorr(scorer(mkInter, wInt))));
  console.log(row('inter · **标签置换对照**', eIntS, withinCorr(scorer(mkInter, wIntS))));
}
if (eMlp) {
  console.log(row('**MLP（同 235 维 ⊕ 一个 tanh 隐层 ' + MLP_H + '）§E208**', eMlp, withinCorr(scMlpR)));
  console.log(row('MLP · **标签置换对照**', eMlpS, withinCorr(scMlpP)));
}
/* ★ **净兑现 = 同组配对减掉自己那条置换对照**。为什么必须减（换向遍教我的）：
 *   "随机但固定的一支动作权重"本身就能打败现役网络的组内排序 —— 当网络那侧的相关是 −0.009（=0）时，
 *   一个与结局无关的随机方向反而"更好"。⇒ 不减掉这个零假设，`capture` 会把"网络比随机差一点"错记成"头学到了东西"。
 *   （换向遍里 flat 的置换对照 = +7.4%，与真值的 17.5% 差不到一倍 ⇒ 不减就是自证。） */
const netGain = (e, eS) => { const d = e.gainG.map((v, i) => v - eS.gainG[i]); return { m: mean(d), ci: ci(d) }; };
const cFlat = netGain(eFlat, eFlatS);
const cInt = eInt ? netGain(eInt, eIntS) : null;
console.log('\n| **净兑现（同组配对减掉自己的置换对照）** | pt | 兑现率 |');
console.log('|---|---|---|');
console.log('| flat | **' + (100 * cFlat.m).toFixed(2) + ' ±' + (100 * cFlat.ci).toFixed(2) + '** | **' + (100 * cFlat.m / capNet).toFixed(1) + '%** |');
if (cInt) console.log('| inter | ' + (100 * cInt.m).toFixed(2) + ' ±' + (100 * cInt.ci).toFixed(2) + ' | ' + (100 * cInt.m / capNet).toFixed(1) + '% |');
if (eMlp) {
  const cMlp = netGain(eMlp, eMlpS);
  console.log('| **MLP（隐层 ' + MLP_H + '）§E208** | ' + (100 * cMlp.m).toFixed(2) + ' ±' + (100 * cMlp.ci).toFixed(2) + ' | '
    + (capNet > cFlat.ci ? (100 * cMlp.m / capNet).toFixed(1) + '%' : '⚠ 分母 regret(net) 不显著 ⇒ **不印比例**（§E197 那条"分母先验符号/显著性"）') + ' |');
}
if (cInt) {
  const dd = eInt.gainG.map((v, i) => (v - eIntS.gainG[i]) - (eFlat.gainG[i] - eFlatS.gainG[i]));
  console.log('\n· **inter 净增 = ' + (100 * mean(dd)).toFixed(2) + ' ±' + (100 * ci(dd)).toFixed(2) + 'pt**（同组三重配对：inter − flat，两边都先减掉各自的置换对照）');
  console.log('  读法：' + (mean(dd) > ci(dd) && mean(dd) > 0 ? '情景 × 动作**确实多兑现** ⇒ 剩下那八成需要带交互/隐层的头'
    : mean(dd) < -ci(dd) ? 'inter 净增为负 ⇒ 交互基在留出上**帮倒忙**（过拟合方向），不是"情景没用"'
      : '**净增在噪声内 ⇒ 这批特征 + 这个样本量下，"情景 × 动作"没买到东西** ⇒ 剩下那八成不在"把动作打分打得更好"上'));
}
if (eMlp) {
  const dm = eMlp.gainG.map((v, i) => (v - eMlpS.gainG[i]) - (eFlat.gainG[i] - eFlatS.gainG[i]));
  const dmM = mean(dm), dmCi = ci(dm);
  console.log('\n· ⭐ **MLP 净增（相对 flat，同组三重配对）= ' + (100 * dmM).toFixed(2) + ' ±' + (100 * dmCi).toFixed(2) + 'pt**'
    + ' ‖ 这就是"**隐层**这一枚钥匙值多少钱"的读数（§E198 只试了显式二阶基，那一版净增 ≈0）');
  console.log('  读法：' + (dmM > dmCi && dmM > 0
    ? '**这一向隐层买到了东西**（⚠ **单方向的一读数不算结论** ⇒ 必须换向重跑、两向同号、且同容量才许写"隐层值钱"；否则一次 2σ 只是 8 次比较里的 5% 假阳性）'
    : dmM < -dmCi ? '这一向隐层**帮倒忙**（同样要换向复量才能定性，见上一条）'
      : '**净增在噪声内 ⇒ 这一向"形状"不是瓶颈**（线性 / 显式二阶 / 一个 tanh 隐层都兑现不了那八成）'));
  console.log('  ⚠ 多重比较提醒：这一格在**同一批留出组**上被打印/比较了 2 容量 × 2 换向 × 2 批标签 = 8 次 ⇒ 单看一次的 ±CI 会把 5% 的假阳性当效果。');
}
console.log('\n| 参照 | 值 |');
console.log('|---|---|');
console.log('| 完美（oracle） | regret ≡ 0.00 |');
console.log('| 现役网络 argmax | regret = **' + (100 * capNet).toFixed(2) + ' ±' + (100 * ci(eFlat.netG)).toFixed(2) + '** |');
console.log('| 随机挑一手（地板） | regret = ' + (100 * capRand).toFixed(2) + ' ‖ 网络比地板好 ' + (100 * (capRand - capNet)).toFixed(2) + ' ±' + (100 * ci(eFlat.randG.map((v, i) => v - eFlat.netG[i]))).toFixed(2) + 'pt |');
console.log('| 组内相关：网络分 ↔ win | ' + withinCorr(r => r.net).m.toFixed(3) + ' ±' + withinCorr(r => r.net).ci.toFixed(3) + ' |');

if (eInt) console.log('· inter 选中的状态维（按 flat |w| 取前 ' + INTER_N + '）：' + sdim.join(' ‖ '));

/* ===== §E208 · `--fitprobe=1`：把"剩下那八成"拆成**两块可分辨的钱** =====
 * MLP 净增 ≈0 有两种成因，必须分开，否则会把结论写错：
 *   (A) **状态里根本没有"该出哪张要看局面"这回事** ⇒ 换任何头、加任何视界都没用，换代该省钱；
 *   (B) 有，但**这批标签（3 条流）太噪 ⇒ 学不出来** ⇒ 换代要买的是"**更多标签流 / 更准的落点**"，不是新形状。
 * 分辨法 = 在**留出组**上算一个不需要泛化的上界：
 *   · **无情景最优先验**（context-free best）：先在**训练带**上给每个"动作身份"统计平均赢率，
 *     留出组里永远选"该组候选中先验最高的那张" ⇒ 它的 regret 就是"**只靠哪类卡普遍划算**"能到的地板；
 *   · 与 **真 oracle（拿着留出组自己的赢率挑）** 的差 = **状态依赖那一池**（任何头最多值这么多）；
 *   · 与 **flat 头实际兑现** 的差 = "**无情景先验这一池已被线性头吃掉的份额**"。
 * ⇒ 若"状态依赖池"≈0 ⇒ (A)；若它很大而 MLP 拿不到 ⇒ (B)。
 * ⚠ 动作身份 = 那 22 维动作块的**卡身份**（`actId`：取 one-hot 里 1 的下标；同一张卡在不同局里同一身份）。 */
if (Number(arg('fitprobe', 0)) === 1) {
  /* 动作块 22 维 = **14 张语义指纹 + 2 珠 + 6 目标**（`policy.js:373 actionFeatures`）⇒ **没有卡的一热编码**，
   *   所以"动作身份"只能取那 14 维的**量化签名**（`cardSig`）。
   *   ⚠ 第一版这里写的是"取 22 维 argmax 当下标"，实测把 8572 行只压成 **2 个身份**（#0 n=78 ‖ #1 n=8494）
   *     ⇒ 那条"无情景先验"其实是**一个常数策略**，于是它 ≈ regret(net)、"状态依赖池"虚报成 99.8%、
   *     比值印出 5100%。⇒ 现改成 14 维签名，并把"分母接近 0 就不许印比值"写成守卫。 */
  const cardSig = r => { let s = ''; for (let j = FS; j < FS + 14; j++) s += (Math.round(r.x[j] * 100) / 100) + ','; return s; };
  const prior = {}, pcnt = {};
  for (const r of tr) { const a = cardSig(r); (prior[a] = prior[a] || []).push(r.win); pcnt[a] = (pcnt[a] || 0) + 1; }
  const pm = {}; for (const a in prior) pm[a] = mean(prior[a]);
  const ids = Object.keys(pm).sort((a, b) => pm[b] - pm[a]);
  console.log('\n## `--fitprobe` · 状态依赖那一池有多大（留出 ' + gs.length + ' 组）');
  /* ⭐ 先证明 §E197 那条"结构性事实"在这份 dump 里**仍然成立**：状态块在同一决策内对所有候选逐位相同。
   *   它要是破了（比如某个状态特征其实跟着候选变），那"flat 的组内判别力只来自动作 22 维"整条推论就作废，
   *   下面所有池子划分也跟着作废 ⇒ 所以这是**前置检查**，不是脚注。 */
  let maxSpread = 0, spreadAt = -1, nViol = 0;
  for (const gp of teAll) { const rr = gp.rows; for (let j = 0; j < FS; j++) { let lo = Infinity, hi = -Infinity; for (const x of rr) { if (x.x[j] < lo) lo = x.x[j]; if (x.x[j] > hi) hi = x.x[j]; } if (hi - lo > maxSpread) { maxSpread = hi - lo; spreadAt = j; } if (hi - lo > 1e-9) nViol++; } }
  console.log('· 前置检查：**状态块组内是否恒定** = ' + (maxSpread === 0 ? '✔ 逐位相同（' + FS + ' 维 × ' + teAll.length + ' 组，最大跨度 0）'
    : '⛔ **不恒定** ⇒ 最大跨度 ' + maxSpread + '（状态维 #' + spreadAt + '），违规"组×维"格子数 ' + nViol + ' ⇒ §E197 那条"状态维在组内抵消"在这份 dump 上不成立 ⇒ 本节池子划分**作废**，先查采集器'));
  if (maxSpread !== 0) { console.log('· ⚠ 已按"不恒定"处理：下面两池的划分不再有意义。'); }
  console.log('· 训练带里**动作签名（14 维指纹）的种类数** = ' + ids.length + '（样本 ≥200 的签名 ' + ids.filter(a => pcnt[a] >= 200).length + ' 个）'
    + ' ‖ 平均赢率最高 3 个签名的 n = ' + ids.slice(0, 3).map(a => pcnt[a]).join(' ‖ '));
  const cfG = [], netG2 = [], flatG2 = [];
  let samePick = 0;
  const flatSc = scorer(mkFlat, wFlat);
  for (const gp of gs) {
    const rr = gp.rows;
    const orc = Math.max(...rr.map(x => x.win));
    const pick = f => rr.reduce((b, x, i) => (f(x) > f(rr[b]) ? i : b), 0);
    const orcIdx = pick(x => x.win);
    const cfIdx = pick(x => pm[cardSig(x)] ?? -9);
    cfG.push(orc - rr[cfIdx].win); netG2.push(orc - rr[pick(x => x.net)].win);
    flatG2.push(orc - rr[pick(flatSc)].win);
    if (cfIdx === orcIdx) samePick++;
  }
  const cap2 = mean(netG2), statePool = mean(cfG) / cap2;
  console.log('| 池子划分（同一批留出组，单位 pt = 赢率百分点） | regret | 相对 `regret(net)` |');
  console.log('|---|---|---|');
  console.log('| 现役网络 argmax | ' + (100 * cap2).toFixed(2) + ' ±' + (100 * ci(netG2)).toFixed(2) + ' | 100% |');
  console.log('| **无情景最优先验**（只靠"哪类卡普遍划算"的地板） | ' + (100 * mean(cfG)).toFixed(2) + ' ±' + (100 * ci(cfG)).toFixed(2)
    + ' | 还剩 **' + (100 * statePool).toFixed(1) + '%** ⇒ 这一份就是**状态依赖池**（任何头最多值这么多） |');
  const cfPool = netG2.map((v, i) => v - cfG[i]);
  const cfPoolM = mean(cfPool), cfPoolCi = ci(cfPool);
  console.log('| flat 线性头实际 | ' + (100 * mean(flatG2)).toFixed(2) + ' ±' + (100 * ci(flatG2)).toFixed(2) + ' | '
    + (cfPoolM > cfPoolCi ? '无情景池 = ' + (100 * cfPoolM).toFixed(2) + ' ±' + (100 * cfPoolCi).toFixed(2) + 'pt ⇒ 线性头兑现 ' + (100 * (cap2 - mean(flatG2)) / cfPoolM).toFixed(0) + '% of 它'
      : '⚠ **无情景池（分母）= ' + (100 * cfPoolM).toFixed(2) + ' ±' + (100 * cfPoolCi).toFixed(2) + 'pt 未超 0 ⇒ 不印这个比值**（§E197 那条"分母先验符号与显著性"；上一版就是在这里印出过 5100%）') + ' |');
  console.log('· 无情景先验**恰好挑中**留出组内真最优的比例 = ' + (100 * samePick / gs.length).toFixed(1) + '%'
    + ' ‖ 组内候选均值 ' + (te.length / Math.max(1, teAll.length)).toFixed(1) + ' ‖ ⚠ 这个比例不是从 0 起跳的（候选少时瞎猜也有基数），只当形状感');
  const mlpNet = eMlp ? (mean(eMlp.gainG) - mean(eMlpS.gainG)) : NaN;
  const mlpNetCi = eMlp ? ci(eMlp.gainG.map((v, i) => (v - eMlpS.gainG[i]) - (eFlat.gainG[i] - eFlatS.gainG[i]))) : NaN;

  /* ===== §E208 · **标签自己的分辨率**（split-half）：先把"学不会"与"标签没定义"分开，才有资格判 (A)/(B) =====
   * 每个候选的 `win` 是 `r` 条流上的 0/1 均值 ⇒ 同组里两手的真差可能远小于这条均值的噪声。
   * 分半法：把一条格的 `r` 条流按奇偶分成两半，各半**独立**挑一次组内最优 ⇒
   *   · 两半挑到**同一手**的比例高 ⇒ "哪手更好"被标签定死了 ⇒ 头拿不到就是**特征/形状**的问题（走 (A)/(C)）；
   *   · 低 ⇒ 标签根本没把排序定死 ⇒ 任何头都在拟合噪声（走 (B)，先加流/加局，别谈换代）。
   * 参照线：瞎猜的同手率 = Σ 1/k（按组），它**不是 0**（组小就高）⇒ 必须并排印。 */
  if (te.length && te[0].winS && Array.isArray(te[0].winS)) {
    let same = 0, tot = 0, floor = 0, rLen = 0;
    for (const gp of gs) {
      const rr = gp.rows, k = rr.length; if (k < 2) continue;
      const half = (rows, even) => { let bi = 0, bv = -1; for (let i = 0; i < rows.length; i++) { const a = rows[i].winS; let s = 0, c = 0; for (let t = 0; t < a.length; t++) { if ((t % 2 === 0) === even) { s += a[t]; c++; } } const v = c ? s / c : -1; if (v > bv) { bv = v; bi = i; } } return bi; };
      if (half(rr, true) === half(rr, false)) same++;
      tot++; floor += 1 / k; rLen += rr[0].winS.length;
    }
    console.log('\n· **标签分辨率（split-half，同组前后半流各挑最优）**：同手率 **' + (100 * same / tot).toFixed(1) + '%**（' + tot + ' 组）'
      + ' ‖ 瞎猜参照 Σ(1/k)/组 = ' + (100 * floor / tot).toFixed(1) + '% ‖ 每格流数 = ' + (rLen / tot).toFixed(0));
    console.log('  读法：' + (same / tot > floor / tot + 0.35
      ? '远高于参照 ⇒ **标签把"哪手更好"基本定死了** ⇒ 三种形状还拿不到 ⇒ 病在**特征/落点函数**，不在标签噪声（⇒ 换代该买"把落点算准"）'
      : same / tot > floor / tot + 0.15
        ? '只比参照高一点 ⇒ **标签仍在半噪声状态** ⇒ 现在判"形状没用"要打折：先加流/加局把同手率抬上去再谈'
        : '≈ 参照 ⇒ **标签根本没把排序定死** ⇒ 任何头都在拟合噪声 ⇒ 换代那一格先别开，先把标签做准（这与"把落点算准"是同一句话）'));
  } else {
    console.log('\n· **标签分辨率**：这份 dump 没有 `winS`（逐流数组）⇒ 无法判 split-half 同手率 ⇒ 上面 (A)/(B) 的判读**降格为未判**。');
  }
  console.log('  ⚠ 判读：状态依赖池占 **' + (100 * statePool).toFixed(0) + '%**' + (eMlp ? ' ‖ MLP 净增 ' + (100 * mlpNet).toFixed(2) + ' ±' + (100 * mlpNetCi).toFixed(2) + 'pt' : ''));
  if (statePool < 0.15) console.log('    ⇒ **状态依赖这一池本来就小** ⇒ 三种形状都拿不到是应该的 ⇒ 结论 (A)：换代不必买"更会排手的头"。');
  else if (eMlp && !(mlpNet > mlpNetCi)) console.log('    ⇒ **这一池不小（' + (100 * statePool).toFixed(0) + '%），但线性 / 显式二阶 / 一个 tanh 隐层三种形状都拿不到**'
    + ' ⇒ 结论 **(B)**：换代要买的是"**更多标签流 / 把落点算准**"，**不是新形状**。');
  else console.log('    ⇒ 这一池不小，且形状档还不够多 ⇒ (A)/(B) 未判，先补容量再说话。');
}
/* ⚠ 这里原来还有一段"inter 相对 flat 的增量"（**未减置换对照**）与一条按它下的判语 —— 已删。
 *   未减零假设的增量在换向遍里会把 inter 判成"帮倒忙"，而减掉之后两遍都是"净增在噪声内"。
 *   ⇒ 判语只能建立在上面那张"净兑现"表上（同组三重配对）。 */
let ms = 0, ma = 0;
for (let j = 0; j < DIM; j++) { const a = Math.abs(wFlat[j]); if (j < FS) ms += a; else ma += a; }
const top = []; for (let j = 0; j < DIM; j++) top.push([j, wFlat[j]]);
top.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
console.log('\n· flat 权重归因（只按 `FEAT_S` 分两块，子块布局在 `explain-champion-decision.mjs`，这里不复制第二份）：|w| 质量 状态块 **'
  + (100 * ms / (ms + ma)).toFixed(1) + '%** ‖ 动作块 **' + (100 * ma / (ms + ma)).toFixed(1) + '%**'
  + ' ‖ 前 10 大权重里落在动作块的只有 ' + top.slice(0, 10).filter(t => t[0] >= FS).length + '/10');
console.log('\n## 自检');
console.log('· 评估组数 ' + gs.length + ' ‖ 每组候选均值 ' + (te.length / Math.max(1, teAll.length)).toFixed(1) + ' ‖ 模型 4 个（真/置换 × flat/inter）同遍输出');
/* ⚠ 这条守卫改过一次：第一版写的是"置换对照必须 ≈ 0，否则判泄漏"，并用 `|控制| > 1.5×|真值|` 当阈值 ⇒
 *   在 B 向（控制 = +2.44 ±2.05）它照样打 ✔，**等于一条永远不会红的同义反复**。
 *   换向跑完才看清：控制非零**不是泄漏**，而是"网络的组内排序低于一个随机固定先验"的表现 —— 处理办法是**减掉它**，
 *   而不是要求它为零。⇒ 现在的判据：控制显著非零 ⇒ 点名并指向"净兑现"表；真值不显著于控制 ⇒ 判"头没学到东西"。 */
const ctlA = { g: eFlatS.gainG, nm: 'flat 置换' }, ctlB = eIntS ? { g: eIntS.gainG, nm: 'inter 置换' } : null;
for (const c of [ctlA, ctlB]) {
  if (!c) continue;
  const m = 100 * mean(c.g), w = 100 * ci(c.g);
  console.log('· 对照 ' + c.nm + ' = ' + m.toFixed(2) + ' ±' + w.toFixed(2) + 'pt '
    + (Math.abs(m) > w ? '⇒ **对照本身非零**：这不是泄漏，而是"网络的组内排序低于一个随机固定先验"；⇒ 只许引上面那张**净兑现**表' : '⇒ ≈ 0（该遍网络排序不优于随机先验）'));
}
const dReal = eFlat.gainG.map((v, i) => v - eFlatS.gainG[i]);
console.log('· flat 净兑现是否显著于 0：**' + (100 * mean(dReal)).toFixed(2) + ' ±' + (100 * ci(dReal)).toFixed(2) + 'pt**'
  + (Math.abs(mean(dReal)) <= ci(dReal) ? ' ⇒ ⚠ 不显著 ⇒ "线性头学到了东西"这句在本遍**不成立**（两遍合看才是结论）' : ''));

/* ===== §E205 · `--depth=1`：两手上限里那 +7~13pt，**学不学得来** =====
 * 问的不是"把这一手排得更准"（那是 §E197/§E198，已答"只值一到两成"），而是：**学一个状态价值函数 V(s)，
 *   让决策时能"往后看一手再估一次"** ⇒ 这才是换代那一格真正要买的零件。
 * 数据：`probe-myopia-regret --dump --depth2` 落的 `lvl:2` 行 = "焦点席走完 a1、再走 a2 之后那个状态"的 235 维 + 真赢率标签。
 * ⚠ 这次的评估**不是组内排序**（§E197 的病：状态维在组内恒定 ⇒ 抵消）。这里比较的是**不同状态之间**的 V，
 *   所以状态块本身就是要学的东西 —— 两问不冲突，是同一台仪器的两个不同估计对象。
 * 评估口径（关键）：所有候选策略都只用 `lvl:1` 的**根标签**（"打这一手、之后照旧打完"的真赢率）来结算，
 *   所以四条线是可比的：`现役 top1` / `V 一手(均值版)` / `V 两手(取 max 版)` / `oracle 两手`。
 *   ⇒ 报的是"这个 chooser 会挑到哪一手，那一手实际值多少"，不是"V 估得准不准"。
 * ⚠ 划分：按**局**（`env#g`）切两半，不是一行一切 —— 同一局的决策彼此相关（§E163 同族的"分组泄漏"）。
 * ⚠ 只纳入"该根决策的**每个** a1 都有第二手行"的组（否则 max 与均值不可比）；纳入率会印出来。 */
if (Number(arg('depth', 0)) === 1 || Number(arg('depth', 0)) === 2) {
  /* ⚠ 同一只文件当 train 和 test 用（`--depth=1` 那种"按局切两半"的用法）时**不能 concat 两遍**：
   *   那会把每一行喂给岭回归两次 ⇒ 有效 λ 减半（第一次跑就中了这个，印出来的 "lvl:2 行 26422" 是文件里 13211 行的两倍）。 */
  const same = TRAIN === TEST;
  const L1 = same ? tr : tr.concat(te);
  const L2 = same ? L2ROWS.slice(0, L2ROWS.length / 2) : L2ROWS;
  if (!L2.length) { console.log('\n⛔ `--depth=1` 需要 `--dump` 里带 `lvl:2` 的行（`probe-myopia-regret --depth2 --dump=`）⇒ 本节没法跑'); process.exit(3); }
  /* ⚠⚠ **键必须带 seed**：dump 里的 `pk` 是 `env#game#第几个决策(#候选序号)`，而 **两个 seed 带的 (env,g,n) 会重号**
   *   ⇒ 直接把两只文件合起来（合池/跨带那两种用法）会把"4100 那一局"和"21000 那一局"的同一个格子**并成一组**，
   *   候选与标签互相穿插 —— 症状很好认：合并后根决策数 = 966 而不是 784 + 699 = 1483。
   *   （§E197 的老路数没这个病，因为它是 train/test **分开** groupify 的。） */
  const KP = r => r.seed + '#' + r.pk;
  const byPk = new Map(); for (const r of L1) { const k = KP(r) + '#' + r.i; if (!byPk.has(k)) byPk.set(k, r); }
  const p2 = new Map(); for (const r of L2) { const k = KP(r); if (!p2.has(k)) p2.set(k, []); p2.get(k).push(r); }   /* ⚠ `lvl:2` 的 `pk` **已经带上了候选序号 i**（根行的 pk 没带）⇒ 这里不能再 `+'#'+r.i` */
  const roots = new Map(); for (const r of L1) { const k = KP(r); if (!roots.has(k)) roots.set(k, []); roots.get(k).push(r); }
  const games = new Set(); for (const r of L1) games.add(r.seed + '#' + r.env + '#' + r.g);
  const gl = [...games].sort(); const half = new Set(gl.filter((_, ix) => ix % 2 === 0));
  const seedOfRoot = new Map(); for (const r of L1) if (!seedOfRoot.has(KP(r))) seedOfRoot.set(KP(r), r.seed);
  const seedTrain = trRaw.length ? trRaw[0].seed : null;
  /* `--depth=1`：**同一批里按局切两半**（训练/测试同 seed 带，但不同局 ⇒ 检验"会不会学到状态→赢率的映射"，不检验跨带迁移）
   * `--depth=2`：**跨 seed 带迁移**（train=4100 那批、test=21000 那批 ⇒ 与 §E197 同样的"换一批桌子还成不成立"这一问） */
  const XFER = Number(arg('depth', 0)) === 2;
  const isTrain = k => XFER ? (seedOfRoot.get(k) === seedTrain) : half.has(k.split('#').slice(0, 3).join('#'));
  const usable = [...roots.keys()].filter(k => roots.get(k).every(r1 => p2.has(KP(r1) + '#' + r1.i)));
  const trPk = usable.filter(isTrain), tePk = usable.filter(k => !isTrain(k));
  const D2 = Number(arg('qhead', 0)) ? 235 : 235 - 22;  /* ⚠ 默认 **状态块 213**：同一 i 的四条 `lvl:2` 行**共享同一个 st2**（那是"该出第二手的那个状态"），
   *   只有动作那 22 维不同 ⇒ 纯状态 V 对四个 j 给出**逐字相同的分** ⇒ "max vs 均值"那个对比是**恒等的**（第一版就中这个招：印出"100% 的组挑到同一手"，
   *   我差一点把它读成"深度对 V 没用" —— 那其实是构造的必然）。⇒ 要让这组对比有意义，必须 `--qhead=1`（用状态 ⊕ 动作 = Q(s,a)）。 */
  const pool = []; for (const k of trPk) for (const r1 of roots.get(k)) for (const q of p2.get(KP(r1) + '#' + r1.i)) pool.push(q);
  const mu2 = new Array(D2).fill(0), sg2 = new Array(D2).fill(1);
  for (const r of pool) for (let j = 0; j < D2; j++) mu2[j] += r.x[j];
  for (let j = 0; j < D2; j++) mu2[j] /= Math.max(1, pool.length);
  for (const r of pool) for (let j = 0; j < D2; j++) sg2[j] += (r.x[j] - mu2[j]) ** 2;
  for (let j = 0; j < D2; j++) sg2[j] = Math.sqrt(sg2[j] / Math.max(1, pool.length)) || 1;
  const mkV = r => { const z = new Array(D2 + 1); for (let j = 0; j < D2; j++) z[j] = (r.x[j] - mu2[j]) / sg2[j]; z[D2] = 1; return z; };
  const yV = pool.map(r => r.win);
  const wV = solve(pool.map(mkV), yV, D2 + 1, 0);
  const wVperm = solve(pool.map(mkV), yV, D2 + 1, 20261001);   /* 置换对照交给 `solve` 内部那个 Fisher–Yates（与 §E197 同一条路），别再自己 reverse 一遍 —— 两次打乱会把"控制"变成"另一个随机" */
  const V = w => q => { const z = mkV(q); let s = 0; for (let i2 = 0; i2 < z.length; i2++) s += z[i2] * w[i2]; return s; };
  const scoreRoots = (w, mode) => {
    const out = { win: [], or2: [], netPick: [], pick: [] };
    for (const k of tePk) {
      const rs = roots.get(k);
      const vOf = rs.map(r1 => { const rows = p2.get(KP(r1) + '#' + r1.i).map(V(w));
        return mode === 'max' ? Math.max.apply(null, rows) : rows.reduce((a, b) => a + b, 0) / rows.length; });
      const tru = rs.map(r1 => p2.get(KP(r1) + '#' + r1.i).reduce((a, b) => Math.max(a, b.win), 0));
      let bi = 0, bo = 0; for (let i2 = 1; i2 < rs.length; i2++) { if (vOf[i2] > vOf[bi]) bi = i2; if (tru[i2] > tru[bo]) bo = i2; }
      out.win.push(rs[bi].win); out.or2.push(rs[bo].win); out.netPick.push(rs[0].win); out.pick.push(rs[bi].i);   /* rs[0] = 网络 top1（§E203 已证 ≈ 臂实际那手） */
    }
    return out;
  };
  const sMax = scoreRoots(wV, 'max'), sMean = scoreRoots(wV, 'mean'), sPerm = scoreRoots(wVperm, 'max');
  const m1 = x => 100 * mean(x), w1 = x => 100 * ci(x);
  const net = sMax.netPick;
  console.log('\n## §E205 两手上限里那 +7~13pt，学一个 V(s)' + (Number(arg('qhead', 0)) ? '/Q(s,a)' : '（纯状态 ⇒ **对第二手恒等**，见代码注释）') + ' 能兑现几成（`lvl:2` 行 ' + L2.length + ' ‖ 特征维 ' + D2 + ' ‖ 训练 ' + trPk.length + ' 组 / 测试 ' + tePk.length + ' 组 ‖ **划分方式：' + (XFER ? '跨 seed 带迁移（train=' + seedTrain + '）' : '同带按局切两半') + '**）');
  console.log('· 可评估覆盖率：' + usable.length + '/' + roots.size + ' 个根决策 = **' + (100 * usable.length / roots.size).toFixed(1) + '%**（要求每个 a1 都有第二手行 ⇒ 覆盖率低会**低估**这条路的可评估范围）');
  console.log('| 选 a1 的办法 | 实际赢率（根标签） | 与"网络 top1"的配对差 |');
  const lines = [['网络 top1（≈现役）', net], ['V 一手（对 j 取均值）', sMean.win], ['V 两手（对 j 取 max）', sMax.win],
    ['oracle 两手（真未来）', sMax.or2], ['置换对照的 V 两手', sPerm.win]];
  for (const [nm, arr] of lines) {
    const d = arr.map((v, ix) => v - net[ix]);
    console.log('| ' + nm + ' | ' + m1(arr).toFixed(2) + '% | ' + (nm.startsWith('网络') ? '—（基线）' : m1(d).toFixed(2) + ' ±' + w1(d).toFixed(2) + 'pt') + ' |');
  }
  const gapO = mean(sMax.or2) - mean(net), gapV = mean(sMax.win) - mean(net), gapP = mean(sPerm.win) - mean(net);
  const gapOCi = ci(sMax.or2.map((v, ix) => v - net[ix]));
  /* ⚠ 分母要验两件事，缺一条就不许引比例（§E197 那条 383% 的老病的完整版）：
   *   ① 符号：`oracle − 网络` ≤ 0 ⇒ 两个负数相除是假百分比；
   *   ② **显著性**：分母 ≤ 它自己的 95% 半宽 ⇒ 比例可以在 0~∞ 之间随便飘（实测第一遍就印出过 175%）。 */
  if (!(gapO > 0)) {
    console.log('\n⚠ **本节的比例不许引**：分母 `oracle 两手 − 网络 top1` = ' + (100 * gapO).toFixed(2) + 'pt **≤ 0** ⇒ 这批组里"真未来的两手选择"并没有比"网络的 top1"更好，'
      + '任何"兑现几成"都是两个负数相除的假数。⇒ 只引上面那张表的**绝对差**，并说明"这批评估组里 oracle 没有正的可兑现空间"（这本身也是一条读数）。');
  } else if (!(gapO > gapOCi)) {
    console.log('\n⚠ **兑现率这个比例不许引**：分母 = +' + (100 * gapO).toFixed(2) + 'pt，它自己的 95% 半宽 = ±' + (100 * gapOCi).toFixed(2) + 'pt ⇒ **分母不显著**。');
    console.log('  ⇒ 但这同时是一条**实质读数**：在"只用根标签结算"的口径里，"按真未来挑第一手"相对"网络 top1"只值 +' + (100 * gapO).toFixed(2) + 'pt（±' + (100 * gapOCi).toFixed(2) + '）。'
      + '\n  ⇒ 与 §E203 的"两手 oracle 值 +7~13pt"**不矛盾、差得很远**：那里的 Δ 是"**连第二手也替它挑好**"，而这里第二手交回给包 ⇒ **差出来的那一块就是"第二手本身要打好"**，不是"多算一层就白拿"。');
  } else {
    console.log('· **兑现率 =（V 两手 − 网络）/（oracle 两手 − 网络）= ' + (100 * gapV / gapO).toFixed(1) + '%**（oracle 那格 = +' + (100 * gapO).toFixed(2) + 'pt，V 那格 = +' + (100 * gapV).toFixed(2) + 'pt）');
    const denomN = gapO - gapP;
    console.log('· 置换对照 = +' + (100 * gapP).toFixed(2) + 'pt ⇒ **净兑现 = +' + (100 * (gapV - gapP)).toFixed(2) + 'pt，净兑现率 = ' + (100 * (gapV - gapP) / denomN).toFixed(1) + '%**'
      + (Math.abs(gapP) > 1.5 * Math.abs(gapV) ? ' ‖ ⚠ 对照比真值还大 ⇒ 这条**先按"没学到"处理**' : '') + '（对照非零时只许引这一行）');
  }
  const agree = sMax.pick.filter((v, ix) => v === sMean.pick[ix]).length / Math.max(1, sMax.pick.length);
  if (!Number(arg('qhead', 0))) {
    console.log('· （这一行**不是读数**：纯状态 V 对同一 i 的四条第二手行给出逐字相同的分 ⇒ max 与均值恒等，"100% 同手"是构造的必然，**不许读成"深度对 V 没用"**。要测那一问必须 `--qhead=1`。）');
  } else {
    console.log('· **同一手的选择**：Q 两手（对 j 取 max）与 Q 一手（对 j 取均值）在 **' + (100 * agree).toFixed(1) + '%** 的组里挑到**同一个 a1**'
      + (agree > 0.9 ? ' ⇒ **"往后多看一手"几乎完全没有改变根选择** ⇒ 那份增益不来自深度（这条现在**有资格**这样读，因为模型看得见动作维）。' : '（两版选择有明显差别 ⇒ 深度那一层在模型里确实起作用了）'));
  }
  console.log('· 只看不两手：V 一手（均值版）= +' + (100 * (mean(sMean.win) - mean(net))).toFixed(2) + 'pt ⇒ 若"两手版"明显高于"一手版"，说明**V 的价值在于它能喂给更深的搜索**，不只是给当前这手换个分。');
  console.log('  ⚠ 三条边界：① 标签来自**同一把尺的模拟**（关档延续），不是对局真值；② `V` 在这里是**线性状态价值头**（§E198 已证"动作 × 情景"的交互基买不到东西，但那是**组内排序**问题；这里是比较不同状态，是它没测过的面）；③ 只用了一半的局做训练 ⇒ 数据量是 1/2，"没学到"里可能混着"数据不够"。');
}
console.log('rc=0');
