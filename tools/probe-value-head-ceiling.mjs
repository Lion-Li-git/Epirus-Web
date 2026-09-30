#!/usr/bin/env node
/* §E197 · **上限能学到几成**：用现有的 235 维特征拟合一个线性价值头，看它收掉多少 §E195/§E196 量出来的 regret
 *
 * 前面两节的形状是："一手完美根决策值 +23~28pt，而加深只买到一成到两成" ⇒ 用户手上现在的问题不是"有没有上限"，
 *   而是"**一个学得会的东西能兑现其中多少**"。这一节就是那一问的最便宜版本：
 *   **不加任何新维度、不改 `PACK_VERSION`**，只在**现役网络已经在算的那 235 维**（`featuresV7` 213 ‖ `actionFeatures` 22）
 *   上拟合一个线性 readout，用引擎模拟出的赢率当标签，然后**在另一批 seed 上**量它的 regret。
 *
 * 数据从哪来：`tools/probe-myopia-regret.mjs --dump=`（**同一台仪器的同一批标签**，不另写采集器 —— rollout 的算术只能有一份）。
 *   每行 = 一个采样决策的一个候选：`x`(235) ‖ `net`(现役打分) ‖ `win`/`hpTop`/`rounds`(同一份克隆、同 3 条随机流的模拟结局)。
 *   ⇒ **训练带 = seed 4100，测试带 = seed 21000**（不同批牌，不是同一批的两半）。
 *
 * 主判据（**分母必须说清**，这是本仓"比率有看不见的分母"那条陷阱的直接应用）：
 *   `regret(方案) = 组内 oracle 的 win − 方案选的那手的 win`（单位 pt，同一组同一批标签 ⇒ 配对）
 *   · `net`   = 现役网络 argmax（= §E195 的 `A0` 那一档）
 *   · `head`  = 线性价值头 argmax
 *   · `rand`  = 组内等可能挑一手 ⇒ **地板**（任何方案都不许低于它）
 *   **兑现率 capture = (regret(net) − regret(head)) / regret(net)**
 *     ⇒ 分母是"从现状到完美的那一段"（`regret(oracle) ≡ 0`，所以不需要再减它）；`rand` 只当**参照线**印出来，
 *       它回答的是另一问："现役网络在自己的短名单**内部**还分不分得出好坏"。
 *     （第一版我把分母写成 `regret(net) − regret(rand)`，而实测 `regret(net) < regret(rand)` ⇒ 分母是负数，
 *       capture 报出过 383% 这种荒值 —— 已改，且把这一段留在注释里当教训。）
 *
 * ⚠ 三条限制：
 *   1. 标签是**一手偏离 + 关档延续**的模拟赢率（§E195 的限制 1 原样继承）⇒ 学到的是"在这个延续策略下哪手更好"，不是全局最优。
 *   2. 特征就是现役那 235 维 ⇒ **本节的结论只适用于"值头能不能挂在现有输入上"**；要加新维度（§E179 那条贵路）不在此问。
 *   3. 同一局的多个决策共享后续 ⇒ 组间不独立；区间按"组"为单位算（一个决策=一个组），比按行算保守。
 *
 * 对照（三道，缺一不可）：
 *   · **地板** `rand` ⇒ 若 head ≈ rand，头就是没学到东西；
 *   · **标签置换** ⇒ 把训练带的 y 洗牌重拟合一次，capture 必须回落到 ~0（抓"泄漏/自证"那类假读数）；
 *   · **现役打分自己当特征**（`net` 那一列不参与 x）⇒ 报 `head` 与 `net` 的一致率，看头是"推翻了网络"还是"复刻了网络"。
 *
 * 只读 `docs/artifacts/e184-out/*.jsonl`（本机产物，不进 git）与 `js/**`，不改引擎、不加门、不动冠军槽。
 */
import { readFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['train', 'test', 'lambda', 'shuffle', 'groups'], 'probe-value-head-ceiling');
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const TRAIN = arg('train', 'docs/artifacts/e184-out/e197-rows-4100.jsonl');
const TEST = arg('test', 'docs/artifacts/e184-out/e197-rows-21000.jsonl');
const LAM = Number(arg('lambda', 1)) || 1;
const SHUF = argv.includes('--shuffle');
const MAXG = Number(arg('groups', 0)) || 0;

function load(p) {
  return readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}
const tr = load(TRAIN), te = load(TEST);
const DIM = tr[0].x.length;
if (te[0].x.length !== DIM) { console.error('⛔ 两批特征维度不一致（' + DIM + ' vs ' + te[0].x.length + '）⇒ 不是同一台仪器'); process.exit(2); }

/* 组 = 同一个决策（env#局#第几手）；跨批用 (seed) 天然分开 */
const keyOf = r => r.env + '#' + r.g + '#' + r.n;
function groupify(rows) {
  const m = new Map();
  for (const r of rows) { const k = keyOf(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  const out = [];
  for (const [k, v] of m) { if (v.length >= 2) { v.sort((a, b) => a.i - b.i); out.push({ k, rows: v }); } }
  return out;
}
const trG = groupify(tr), teG = groupify(te);

/* ---- 标准化（只在训练带上算统计量） ---- */
const mu = new Array(DIM).fill(0), sg = new Array(DIM).fill(0);
for (const r of tr) for (let j = 0; j < DIM; j++) mu[j] += r.x[j];
for (let j = 0; j < DIM; j++) mu[j] /= tr.length;
for (const r of tr) for (let j = 0; j < DIM; j++) sg[j] += (r.x[j] - mu[j]) * (r.x[j] - mu[j]);
for (let j = 0; j < DIM; j++) { sg[j] = Math.sqrt(sg[j] / Math.max(1, tr.length - 1)); if (!(sg[j] > 1e-9)) sg[j] = 1; }
const X = rows => rows.map(r => { const z = new Array(DIM + 1); for (let j = 0; j < DIM; j++) z[j] = (r.x[j] - mu[j]) / sg[j]; z[DIM] = 1; return z; });
const Y = (rows, label) => rows.map(r => label === 'win' ? r.win : r.hpTop);

/* ---- 岭回归：解 (ZᵀZ + λI) w = Zᵀy，高斯消元，维度 236 ---- */
function ridge(rows, label, shuffleSeed) {
  const Z = X(rows), y = Y(rows, label);
  let ys = y.slice();
  if (shuffleSeed) {                                    /* 标签置换对照：把 y 洗牌（用确定性流，不动对局随机源） */
    let s = shuffleSeed >>> 0;
    const rr = () => { s ^= s << 13; s >>>= 0; s ^= s << 17; s ^= s >>> 5; s >>>= 0; return s / 4294967296; };
    for (let i = ys.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); const t = ys[i]; ys[i] = ys[j]; ys[j] = t; }
  }
  const n = DIM + 1;
  const A = []; for (let i = 0; i < n; i++) A.push(new Array(n + 1).fill(0));
  for (let r = 0; r < Z.length; r++) {
    const z = Z[r];
    for (let i = 0; i < n; i++) { const zi = z[i]; if (!zi) continue;
      for (let j = i; j < n; j++) A[i][j] += zi * z[j];
      A[i][n] += zi * ys[r];
    }
  }
  for (let i = 0; i < n; i++) A[i][i] += (i === DIM ? 0 : LAM);   /* 偏置不惩罚 */
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) { A[i][j] = A[j][i]; }
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    const t = A[c]; A[c] = A[p]; A[p] = t;
    const d = A[c][c] || 1e-9;
    for (let j = c; j <= n; j++) A[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (!f) continue; for (let j = c; j <= n; j++) A[r][j] -= f * A[c][j]; }
  }
  return A.map(r => r[n]);
}
const score = (w, r) => { let s = 0; for (let j = 0; j < DIM; j++) s += w[j] * ((r.x[j] - mu[j]) / sg[j]); return s + w[DIM]; };

/* ---- 评估：每组的 regret（配对：同一组同一批标签） ---- */
function evalw(w, label) {
  const acc = { net: [], head: [], rand: [], oracle: [], agree: 0, n: 0 };
  const gs = MAXG ? teG.slice(0, MAXG) : teG;
  for (const gp of gs) {
    const rows = gp.rows;
    const orc = Math.max(...rows.map(r => r[label]));
    const netIdx = rows.reduce((b, r, i) => (r.net > rows[b].net ? i : b), 0);
    const headIdx = rows.reduce((b, r, i) => (score(w, r) > score(w, rows[b]) ? i : b), 0);
    const randIdx = (gp.k.length * 7 + rows.length) % rows.length;         /* 确定性"等可能一手"地板（不抽随机流） */
    acc.oracle.push(orc);
    acc.net.push(orc - rows[netIdx][label]);
    acc.head.push(orc - rows[headIdx][label]);
    acc.rand.push(orc - rows[randIdx][label]);
    acc.n++; if (headIdx === netIdx) acc.agree++;
  }
  return acc;
}
const mean = x => x.reduce((p, q) => p + q, 0) / Math.max(1, x.length);
const ci = x => { const m = mean(x); const s = Math.sqrt(x.reduce((p, q) => p + (q - m) * (q - m), 0) / Math.max(1, x.length - 1)); return 1.96 * s / Math.sqrt(Math.max(1, x.length)); };

const LABEL = 'win';
/* ⚠ **先看相关，再看比值**：`capture` 的分母是 `regret(net) − regret(rand)`，而这一项**可以塌到 0**
 *   （网络排序在组内如果对模拟结局毫无信息，net 与 rand 就同分）⇒ 那时候 capture 会变成任意大的数（smoke 就报出过 383%）。
 *   ⇒ 所以这里直接量"组内 网络分 与 模拟赢率 的相关"（以及头分的相关），比值只在分母够宽时才允许引。 */
function withinCorr(getScore) {
  const cs = [];
  const gs = MAXG ? teG.slice(0, MAXG) : teG;
  for (const gp of gs) {
    const rows = gp.rows; if (rows.length < 3) continue;
    const xs = rows.map(getScore), ys = rows.map(r => r[LABEL]);
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    if (sxx > 1e-12 && syy > 1e-12) cs.push(sxy / Math.sqrt(sxx * syy));
  }
  return { m: mean(cs), ci: ci(cs), n: cs.length };
}
const w = ridge(tr, LABEL, SHUF ? 20260930 : 0);
const r0 = evalw(w, LABEL);
const capNet = mean(r0.net), capHead = mean(r0.head), capRand = mean(r0.rand);
/* ⚠ **分母的定义在这里改过一次**（写下来是因为我第一版算错了）：
 *   第一版用 `regret(net) − regret(rand)` 当"可赢段"，但 `regret(oracle) ≡ 0`（oracle 就是组内取最大），
 *   而实测 `regret(net) < regret(rand)`（网络确实比"随便挑一手"好一点）⇒ 那个分母是**负数**，capture 会报出几百 %。
 *   ⇒ 正确的归一：**分母 = `regret(net)` 本身**（从现状到完美的那一段），`rand` 只作参照线印出来。 */
const capture = capNet > 1e-9 ? (capNet - capHead) / capNet : NaN;

console.log('# §E197 线性价值头能兑现上限的几成（训练 ' + tr.length + ' 行 / ' + trG.length + ' 组 ‖ 测试 ' + te.length + ' 行 / ' + teG.length + ' 组 ‖ λ=' + LAM + (SHUF ? ' ‖ **标签置换对照**' : '') + '）');
console.log('# 特征 = 现役那 235 维（`featuresV7` 213 ‖ `actionFeatures` 22）‖ 标签 = 同一台仪器模拟出的赢率（一手偏离 + 关档延续）');
console.log('# 分母说清：capture = (regret(net) − regret(head)) / (regret(net) − regret(rand))‖`rand` 是"组内等可能挑一手"的地板');
console.log('#   ⇒ 分母塌到 0 时 capture 不可引（会报出几百 %），所以下面先印**组内相关**\n');
const cNet = withinCorr(r => r.net), cHead = withinCorr(r => score(w, r)), cCost = withinCorr(r => (r.key === 'ji' ? 0 : 1));
console.log('| 组内相关（' + cNet.n + ' 组，均值 ±半宽） | 值 |');
console.log('|---|---|');
console.log('| 现役网络打分 ↔ 模拟赢率 | **' + cNet.m.toFixed(3) + ' ±' + cNet.ci.toFixed(3) + '** |');
console.log('| 线性价值头打分 ↔ 模拟赢率 | **' + cHead.m.toFixed(3) + ' ±' + cHead.ci.toFixed(3) + '**' + (SHUF ? '（置换遍，应≈0）' : '') + ' |');
console.log('| （参照）"是不是 0 费ジ" ↔ 模拟赢率 | ' + cCost.m.toFixed(3) + ' ±' + cCost.ci.toFixed(3) + ' |');

console.log('| 方案 | 组内平均 regret（pt） | 95% 半宽（按组） |');
console.log('|---|---|---|');
console.log('| 完美（oracle） | 0.00 | — |');
console.log('| 现役网络 argmax | **' + (100 * capNet).toFixed(2) + '** | ±' + (100 * ci(r0.net)).toFixed(2) + ' |');
console.log('| 线性价值头 argmax | **' + (100 * capHead).toFixed(2) + '** | ±' + (100 * ci(r0.head)).toFixed(2) + ' |');
console.log('| 随机挑一手（地板） | ' + (100 * capRand).toFixed(2) + ' | ±' + (100 * ci(r0.rand)).toFixed(2) + ' |');
console.log('\n· **兑现率 capture = (regret(net) − regret(head)) / regret(net) = ' + (isFinite(capture) ? (100 * capture).toFixed(1) + '%' : '不可引') + '**（0% = 头等于现役；100% = 头等于完美）');
console.log('  ․ 参照线：`regret(net) = ' + (100 * capNet).toFixed(2) + 'pt` ‖ `regret(rand) = ' + (100 * capRand).toFixed(2) + 'pt` ‖ 网络比"随便挑一手"好 **' + (100 * (capRand - capNet)).toFixed(2)
  + ' ±' + (100 * ci(r0.rand.map((v, i) => v - r0.net[i]))).toFixed(2) + 'pt**（这一段若落在噪声内，说明**网络在自己的短名单内部几乎没有判别力**，与上面那条相关 ≈0 同号）');
console.log('· 头与网络选同一手的比例 = ' + (100 * r0.agree / Math.max(1, r0.n)).toFixed(1) + '% ⇒ ' + (r0.agree / r0.n > 0.8 ? '头基本在**复刻**网络，没换信息' : r0.agree / r0.n < 0.35 ? '头与网络**经常分家**' : '头与网络部分重合'));
console.log('· 可赢的那一段（net − rand）= ' + (100 * (capNet - capRand)).toFixed(2) + 'pt ‖ 头拿回 ' + (100 * (capNet - capHead)).toFixed(2) + 'pt');
console.log('\n## 自检 / 对照');
if (SHUF) {
  console.log('· ⚠ 这一遍是**标签置换**遍（训练带 y 被洗牌）⇒ capture 应当回到 ~0 或为负；若仍然明显为正，说明拟合口子里有泄漏（本节结论不许引）。');
}
console.log('· 组数（测试带）' + r0.n + ' ‖ 每组候选数均值 ' + (te.length / Math.max(1, teG.length)).toFixed(1) + ' ⇒ oracle 是组内取最大，天然乐观，但三个方案共用同一批组 ⇒ 可比');
/* 网络 vs 地板：按组配对差（同一组的同一批标签），这才是"网络在短名单内部有没有判别力"的正确问法 */
const dFloor = r0.rand.map((v, i) => v - r0.net[i]);
const mFloor = mean(dFloor), cFloor = ci(dFloor);
console.log('· 配对差 `regret(rand) − regret(net)` = **' + (100 * mFloor).toFixed(2) + ' ±' + (100 * cFloor).toFixed(2) + 'pt** '
  + (mFloor > 0 && mFloor > cFloor ? '⇒ 网络确实比"随便挑一手"好（差超出噪声）' : mFloor <= 0 ? '⇒ 网络不比地板好 ⇒ **短名单内部的排序几乎没有信息**' : '⇒ 差在噪声内 ⇒ 说不上网络比地板好多少'));
const dHead = r0.net.map((v, i) => v - r0.head[i]);
console.log('· 配对差 `regret(net) − regret(head)` = **' + (100 * mean(dHead)).toFixed(2) + ' ±' + (100 * ci(dHead)).toFixed(2) + 'pt**（这就是头拿回的绝对量，比 capture 那个比值更该被引）');
/* 权重归因（**只做不依赖布局复制的那一层**：状态块 vs 动作块的分界 = `FEAT_S`，它是 policy.js 导出的单一来源。
 *   语义子块（对手席/关系/效果）的偏移我不在这里重算 —— 那份表在 `explain-champion-decision.mjs` 里，
 *   在这里再写一份就是本仓最怕的"同一算术两份"（D206/D207 存在的理由）。） */
const FS = DIM - 22;                              /* 动作块固定 22 维（`FEAT_A`）⇒ 状态块 = 235 − 22 = 213（= `FEAT_S`） */
let massState = 0, massAct = 0;
for (let j = 0; j < DIM - 1; j++) { const a = Math.abs(w[j]); if (j < FS) massState += a; else massAct += a; }
const top = [];
for (let j = 0; j < DIM - 1; j++) top.push([j, w[j]]);
top.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
console.log('\n· 权重归因（只按 `FEAT_S` 分状态块/动作块，不复制子块布局）：状态块占 |w| 质量 **' + (100 * massState / (massState + massAct)).toFixed(1) + '%** ‖ 动作块 **'
  + (100 * massAct / (massState + massAct)).toFixed(1) + '%**');
console.log('  ․ 前 10 大权重（维号:值）：' + top.slice(0, 10).map(t => t[0] + ':' + (t[1] >= 0 ? '+' : '') + t[1].toFixed(3)).join(' ‖ '));
console.log('  ․ 其中落在动作块（维号 ≥ ' + FS + '）的有 ' + top.slice(0, 10).filter(t => t[0] >= FS).length + '/10 个');
console.log('rc=0');
