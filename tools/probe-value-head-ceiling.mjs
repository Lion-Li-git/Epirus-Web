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
rejectUnknownFlags(argv, ['train', 'test', 'lambda', 'inter', 'groups'], 'probe-value-head-ceiling');
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const TRAIN = arg('train', 'docs/artifacts/e184-out/e197-rows-4100.jsonl');
const TEST = arg('test', 'docs/artifacts/e184-out/e197-rows-21000.jsonl');
const LAM = Number(arg('lambda', 1)) || 1;
const INTER_N = Math.max(0, Number(arg('inter', 6)) || 0);
const MAXG = Number(arg('groups', 0)) || 0;

function load(p) { return readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); }
const tr = load(TRAIN), te = load(TEST);
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
function evalHead(mk, w) {
  const sc = scorer(mk, w);
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

console.log('# §E197/§E198 价值头能兑现上限的几成（训练 ' + tr.length + ' 行 / ' + trG.length + ' 组 → **留出** ' + te.length + ' 行 / ' + gs.length + ' 组 ‖ λ=' + LAM + ' ‖ 交互基 dim=' + INTER_N + '）');
console.log('# 特征 = 现役那 ' + DIM + ' 维（状态 ' + FS + ' ‖ 动作 22）‖ 标签 = §E195 同一台仪器模拟出的赢率（一手偏离 + 关档延续）');
console.log('# capture = (regret(net) − regret(head)) / regret(net)‖分母是被比较基线自己（第一版误用 net−rand，符号为负，报出过 383%）');
console.log('# ⚠ 状态维在同一决策内对所有候选**相同** ⇒ 组内排序时抵消 ⇒ flat 的组内判别力只可能来自动作那 22 维\n');
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
if (cInt) {
  const dd = eInt.gainG.map((v, i) => (v - eIntS.gainG[i]) - (eFlat.gainG[i] - eFlatS.gainG[i]));
  console.log('\n· **inter 净增 = ' + (100 * mean(dd)).toFixed(2) + ' ±' + (100 * ci(dd)).toFixed(2) + 'pt**（同组三重配对：inter − flat，两边都先减掉各自的置换对照）');
  console.log('  读法：' + (mean(dd) > ci(dd) && mean(dd) > 0 ? '情景 × 动作**确实多兑现** ⇒ 剩下那八成需要带交互/隐层的头'
    : mean(dd) < -ci(dd) ? 'inter 净增为负 ⇒ 交互基在留出上**帮倒忙**（过拟合方向），不是"情景没用"'
      : '**净增在噪声内 ⇒ 这批特征 + 这个样本量下，"情景 × 动作"没买到东西** ⇒ 剩下那八成不在"把动作打分打得更好"上'));
}

console.log('\n| 参照 | 值 |');
console.log('|---|---|');
console.log('| 完美（oracle） | regret ≡ 0.00 |');
console.log('| 现役网络 argmax | regret = **' + (100 * capNet).toFixed(2) + ' ±' + (100 * ci(eFlat.netG)).toFixed(2) + '** |');
console.log('| 随机挑一手（地板） | regret = ' + (100 * capRand).toFixed(2) + ' ‖ 网络比地板好 ' + (100 * (capRand - capNet)).toFixed(2) + ' ±' + (100 * ci(eFlat.randG.map((v, i) => v - eFlat.netG[i]))).toFixed(2) + 'pt |');
console.log('| 组内相关：网络分 ↔ win | ' + withinCorr(r => r.net).m.toFixed(3) + ' ±' + withinCorr(r => r.net).ci.toFixed(3) + ' |');

if (eInt) console.log('· inter 选中的状态维（按 flat |w| 取前 ' + INTER_N + '）：' + sdim.join(' ‖ '));
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
console.log('rc=0');
