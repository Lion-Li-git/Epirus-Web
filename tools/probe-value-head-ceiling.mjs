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
rejectUnknownFlags(argv, ['train', 'test', 'lambda', 'inter', 'groups', 'depth', 'qhead'], 'probe-value-head-ceiling');
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
