#!/usr/bin/env node
/* rank-signal.mjs — 「组内排序到底学不学得出来」的直接实验（DS · 2026-10-28 晚）
 *
 * 问的问题与千问三把尺不同：§E819b 问「现役打分器有没有判别力」；本条问「这份输入里有没有可学的组内信号」——
 *   给同一份 235 维特征、同一批组内标签，换一个**线性头**去拟合，能不能比现役 net / 随机挑更好？
 *
 * 做法：读 probe-myopia-regret 的 dump（每行 = 候选：x(235) + label），组内中心化后拟岭回归，
 *   在**按组切分**的测试组上比 regret（越小越好）：线性头 ‖ 现役 net ‖ 随机，配对 bootstrap 给差值的 95% CI。
 *
 * 三种跑法：
 *   --train=A --test=B            单次切分（外部留出 seed）
 *   --folds=5（配合 --train/--test 任给或都给）  按组 K 折 CV（更多组进训练，方差更小）
 *   --topK=60                     先按 |相关| 选 topK 维再拟合（p>n 时的必要收缩）
 *
 * 三条款（引用必带）：
 *   · 这是**线性头**的上限，不是「任何模型都学不出」的证明；
 *   · 标签 = 「一手偏离 + 现有策略延续」的模拟赢率（继承 §E195 限制 1）；
 *   · 有效组数 < 100 或平均候选 < 2 ⇒ 判「读不出」（exit 2），不印「0 改善」。
 *
 * 用法：node tools/proto2/rank-signal.mjs --train=a.jsonl --test=b.jsonl [--arm=A0] [--label=win] [--l2=1] [--folds=5] [--topK=60] [--json]
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
function arg(k, d) { const f = argv.find((a) => a.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; }
const TRAIN = arg('train', ''), TEST = arg('test', '');
const ARM = arg('arm', ''), LABEL = arg('label', 'win');
const L2 = Number(arg('l2', 1.0));
const FOLDS = Math.max(0, Number(arg('folds', 0)) || 0);
const TOPK = Math.max(0, Number(arg('topK', 0)) || 0);
/* ===== 2026-10-29（千问）：`--hidden=N` ⇒ 加一个**带隐层的头** =====
 * 为什么必须加（DS 21:18 自己抓到、但后面还在用线性尺排版本）：同一个决策里所有候选的 state 维**逐字相同**
 *   ⇒ 组内中心化后它们的方差 0 ⇒ **线性头结构上读不到 state/历史/关系维**，任何"哪版表示更好"的线性读数
 *   只关于候选侧（含手搓交互）。要判 state 值多少钱，头必须能形成 state×action 交互 ⇒ 这里给一个确定性初始化的
 *   ReLU 小头（同一 `--seed` 逐位可复现）。判据形状：`--hidden` 开着时**同时**报 ridge 与 MLP 两行，
 *   两行差 = "交互"这一档值多少；MLP 的牙用现成的 `--selfcheck`（合成长度上必须显著好于随机）验。 */
const HIDDEN = Math.max(0, Number(arg('hidden', 0)) || 0);
const EPOCHS = Math.max(1, Number(arg('epochs', 25)) || 25);
const LR = Number(arg('lr', 0.05));
const SEEDH = Math.max(1, Number(arg('seed', 20261029)) || 20261029);
const MINGAP = Number(arg('minGap', 0));
const JSONOUT = argv.includes('--json');
const FLOOR = argv.includes('--floor');   /* 2026-10-29（千问）：诚实可达地板（disjoint 半流 + 并列取期望） */
if (!TRAIN && !TEST) { console.error('⛔ 至少给 --train= 或 --test='); process.exit(2); }

function loadRows(p) { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); }
const GKEY = (r) => [r.seed, r.env, r.g, r.n, r.round, r.pk].join('|');

function groupsOf(rows) {
  const g = new Map();
  for (const r of rows) { const k = GKEY(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
  let drop = 0;
  for (const [k, arr] of g) {
    const us = arr.map((r) => Number(r[LABEL]));
    if (arr.length < 2 || Math.max(...us) - Math.min(...us) < (MINGAP || 1e-9)) { g.delete(k); drop++; }
  }
  return { g, drop };
}

let rows = [];
if (TRAIN) rows = rows.concat(loadRows(TRAIN));
if (TEST) rows = rows.concat(loadRows(TEST));
if (ARM) rows = rows.filter((r) => r.arm === ARM);
if (!rows.length) { console.error('⛔ 过滤后没有行（检查 --arm=' + ARM + '）'); process.exit(2); }
const F = rows[0].x.length;
/* ===== 有牙自检（--selfcheck）：把标签换成「x 的已知线性函数 + 噪声」 =====
 * 若这台机器在自己的合成长度上都学不出来，那真实的「分不开」就是仪器坏了，不许当结论。 */
if (argv.includes('--selfcheck')) {
  const w0 = new Float64Array(F);
  let sh = 777;
  for (let j = 0; j < F; j++) { sh = (sh * 1103515245 + 12345) >>> 0; w0[j] = (sh / 4294967296 - 0.5) * 2 / Math.sqrt(F); }
  const g0 = new Map();
  for (const r of rows) { const k = GKEY(r); if (!g0.has(k)) g0.set(k, []); g0.get(k).push(r); }
  for (const arr of g0.values()) {
    const vals = arr.map((r) => { let s = 0; for (let j = 0; j < F; j++) s += w0[j] * r.x[j]; return s + 0.5 * (Math.random() - 0.5); });
    const mu = vals.reduce((a, b) => a + b, 0) / vals.length;
    arr.forEach((r, i) => { r[LABEL] = vals[i] - mu; });
  }
}
const G = groupsOf(rows);
if (G.g.size < 100) { console.error('⛔ 有效组数 ' + G.g.size + ' < 100 ⇒ 判「读不出」（不印 0 改善）'); process.exit(2); }

/* ===== 候选池同质性守卫（2026-10-28 实测抓到的坑）=====
 * 病：`probe-myopia-regret --dump` 的池是**按现役打分取 top-K** 的，开局 ep=0 时它能挑出的常常是
 *   一池子「费用 0 的防御招」（ji/guard/reflect/bagua）⇒ 235 维里组内只有 2 列在变（guard族 与 类别）。
 *   这种池子上「线性头与随机分不开」是**构造上必然**，不是「输入里没信号」⇒ 必须先拦，不许印判语。
 * 判据：组内平均变化列数 < 5 ⇒ 判「池子同质，回答不了排序问题」（exit 3；修法：--keep 放大或换采样口径）。 */
const sampleGroups = [...G.g.values()].slice(0, 120);
let varAcc = 0;
for (const arr of sampleGroups) {
  let v = 0;
  for (let j = 0; j < F; j++) {
    let seen = null, differs = false;
    for (const r of arr) { if (seen === null) seen = r.x[j]; else if (r.x[j] !== seen) { differs = true; break; } }
    if (differs) v++;
  }
  varAcc += v;
}
const meanVary = sampleGroups.length ? varAcc / sampleGroups.length : 0;
if (meanVary < 5) {
  console.error('⛔ 候选池同质：组内平均只有 ' + meanVary.toFixed(1) + ' / ' + F + ' 列在变（采样 ' + sampleGroups.length + ' 组）');
  console.error('   ⇒ 这种池子上「分不开」是构造上必然，回答不了「能不能学排序」。');
  console.error('   ⇒ 修法：重 dump 时 --keep 放大（如 --keep=40）或换采样口径，让候选真的不同。');
  process.exit(3);
}

function zstats(all) { const n = all.length; const mean = new Float64Array(F), sd = new Float64Array(F); for (const x of all) for (let j = 0; j < F; j++) mean[j] += x[j] / n; for (const x of all) for (let j = 0; j < F; j++) { const d = x[j] - mean[j]; sd[j] += (d * d) / n; } for (let j = 0; j < F; j++) sd[j] = Math.sqrt(sd[j]) || 1; return { mean, sd }; }
function fit(groupsArr, opts) {
  const rowsX = [], ys = [];
  for (const arr of groupsArr) {
    const us = arr.map((r) => Number(r[LABEL]));
    const mu = us.reduce((a, b) => a + b, 0) / us.length;
    arr.forEach((r, i) => { rowsX.push(r.x); ys.push(us[i] - mu); });
  }
  const { mean, sd } = zstats(rowsX);
  const n = rowsX.length;
  let idxs = Array.from({ length: F }, (_, j) => j);
  if (opts.topK && opts.topK < F) {
    const r = new Float64Array(F);
    const ym = ys.reduce((a, b) => a + b, 0) / n;
    for (let p = 0; p < F; p++) { let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const xv = (rowsX[i][p] - mean[p]) / sd[p]; sxy += xv * (ys[i] - ym); sxx += xv * xv; syy += (ys[i] - ym) * (ys[i] - ym); } r[p] = Math.abs(sxy) / Math.sqrt((sxx || 1) * (syy || 1)); }
    idxs = idxs.sort((a, b) => r[b] - r[a]).slice(0, opts.topK);
  }
  const P = idxs.length;
  const A = Array.from({ length: P }, () => new Float64Array(P));
  const b = new Float64Array(P);
  for (let i = 0; i < n; i++) { const z = new Float64Array(P); for (let q = 0; q < P; q++) z[q] = (rowsX[i][idxs[q]] - mean[idxs[q]]) / sd[idxs[q]]; const y = ys[i]; for (let p = 0; p < P; p++) { b[p] += z[p] * y; const zp = z[p]; const row = A[p]; for (let q = 0; q < P; q++) row[q] += zp * z[q]; } }
  for (let p = 0; p < P; p++) A[p][p] += L2;
  const aug = A.map((row, i) => { const r = new Float64Array(P + 1); r.set(row); r[P] = b[i]; return r; });
  for (let c = 0; c < P; c++) {
    let piv = c;
    for (let r = c + 1; r < P; r++) if (Math.abs(aug[r][c]) > Math.abs(aug[piv][c])) piv = r;
    if (Math.abs(aug[piv][c]) < 1e-12) continue;
    const tmp = aug[c]; aug[c] = aug[piv]; aug[piv] = tmp;
    const d = aug[c][c];
    for (let k = c; k <= P; k++) aug[c][k] /= d;
    for (let r = 0; r < P; r++) { if (r === c) continue; const f = aug[r][c]; if (!f) continue; for (let k = c; k <= P; k++) aug[r][k] -= f * aug[c][k]; }
  }
  const w = new Float64Array(P);
  for (let i = 0; i < P; i++) w[i] = aug[i][P];
  return { w, idxs, mean, sd };
}
const score = (m, r) => { let s = 0; for (let i = 0; i < m.w.length; i++) { const j = m.idxs[i]; s += m.w[i] * ((r.x[j] - m.mean[j]) / m.sd[j]); } return s; };

/* ===== 2026-10-29（千问）：带隐层的头（`--hidden=N`）=====
 * 只干一件事：让 state×action 的交互**进得来**。组内中心化后 state 段方差 0 ⇒ ridge 读不到它（文件头那条）。
 * 确定性初始化 + 确定性打乱（同一 `--seed` 逐位可复现）；mini 是逐样本在线 SGD，够快也够稳。 */
function fitMLP(groupsArr, H) {
  const X = [], ys = [];
  for (const arr of groupsArr) {
    const us = arr.map((r) => Number(r[LABEL]));
    const mu = us.reduce((a, b) => a + b, 0) / us.length;
    arr.forEach((r, i) => { X.push(r.x); ys.push(us[i] - mu); });
  }
  const { mean, sd } = zstats(X);
  const n = X.length;
  const Z = new Float64Array(n * F);
  for (let i = 0; i < n; i++) { const xi = X[i]; for (let j = 0; j < F; j++) Z[i * F + j] = (xi[j] - mean[j]) / sd[j]; }
  let s = SEEDH >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const W1 = new Float64Array(H * F), b1 = new Float64Array(H), W2 = new Float64Array(H);
  const sc1 = 1 / Math.sqrt(F), sc2 = 1 / Math.sqrt(H);
  for (let k = 0; k < H * F; k++) W1[k] = (rnd() - 0.5) * 2 * sc1;
  for (let h = 0; h < H; h++) { b1[h] = 0; W2[h] = (rnd() - 0.5) * 2 * sc2; }
  let b2 = 0;
  const order = new Int32Array(n); for (let i = 0; i < n; i++) order[i] = i;
  const act = new Float64Array(H);
  const reg = 1e-4;
  for (let ep = 0; ep < EPOCHS; ep++) {
    for (let i = n - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
    for (let q = 0; q < n; q++) {
      const i = order[q], row = i * F, y = ys[i];
      let out = b2;
      for (let h = 0; h < H; h++) {
        let a = b1[h]; const woff = h * F;
        for (let j = 0; j < F; j++) a += W1[woff + j] * Z[row + j];
        act[h] = a > 0 ? a : 0; out += W2[h] * act[h];
      }
      const err = out - y;
      for (let h = 0; h < H; h++) {
        const ga = err * W2[h] * (act[h] > 0 ? 1 : 0), woff = h * F;
        for (let j = 0; j < F; j++) W1[woff + j] -= LR * (ga * Z[row + j] + reg * W1[woff + j]);
        b1[h] -= LR * ga;
        W2[h] -= LR * (err * act[h] + reg * W2[h]);
      }
      b2 -= LR * err;
    }
  }
  return { mlp: true, H, W1, b1, W2, b2, mean, sd };
}
const scoreMLP = (m, x) => {
  let out = m.b2;
  for (let h = 0; h < m.H; h++) {
    let a = m.b1[h]; const woff = h * F;
    for (let j = 0; j < F; j++) a += m.W1[woff + j] * ((x[j] - m.mean[j]) / m.sd[j]);
    if (a > 0) out += m.W2[h] * a;
  }
  return out;
};
const mkModel = (gs) => (HIDDEN > 0 ? fitMLP(gs, HIDDEN) : fit(gs, { topK: TOPK }));
const scoreAny = (m, r) => (m.mlp ? scoreMLP(m, r.x) : score(m, r));

/* ===== 2026-10-29（千问）：`--floor` ⇒ **诚实版可达地板**（修 DS `--ceiling` 的两处偏）=====
 * DS 那版（保留可跑，标成旧口径）：**用 A 半流挑、在"全流"标签上评** ⇒ A ⊂ 全流 ⇒ 赢者诅咒，实测比干净口径乐观 4.2×。
 * 这一版三条都改：① 挑与评用**互不相交的半流**（A 挑 / B 评）；② 并列最大者按**期望**算（不是取下标最小——
 *   dump 的池是按现役 net 降序排的，取下标最小就等于"挑现役 net 的第一名"，实测那样有 ~47% 落在 index 0）；
 * ③ head/net（以及 MLP）也在**同一把 B 标签**上评 ⇒ 分母与分子同一尺度。
 * 打印的"兑现率"= (随机 − head) / (随机 − 地板)，全部 B 尺度。 */
function floorAudit(gs) {
  const out = { randB: [], floorB: [], headB: [], netB: [], mlpB: [], ties: [], idx0: 0, mono: 0, n: 0 };
  for (const arr of gs) {
    const m = arr[0].winS;
    if (!Array.isArray(m) || m.length < 4) continue;
    const half = m.length >> 1;
    const uA = arr.map((r) => { let a = 0; for (let i = 0; i < half; i++) a += Number(r.winS[i]); return a / half; });
    const uB = arr.map((r) => { let b = 0; for (let i = half; i < m.length; i++) b += Number(r.winS[i]); return b / (m.length - half); });
    const maxB = Math.max(...uB), meanB = uB.reduce((a, b) => a + b, 0) / uB.length;
    const topA = Math.max(...uA);
    const tied = uA.map((v, i) => (Math.abs(v - topA) < 1e-12 ? i : -1)).filter((i) => i >= 0);
    // 并列随机破的期望 regret（精确，不抽样）
    let exp = 0; for (const i of tied) exp += (maxB - uB[i]) / tied.length;
    out.randB.push(maxB - meanB); out.floorB.push(exp); out.ties.push(tied.length);
    if (tied[0] === 0) out.idx0++;
    let mono = true; for (let i = 1; i < arr.length; i++) if (arr[i].i < arr[i - 1].i) { mono = false; break; }
    if (mono) { let ok = true; for (let i = 1; i < arr.length; i++) if (arr[i].net > arr[i - 1].net + 1e-12) { ok = false; break; } if (ok) out.mono++; }
    out.n++;
  }
  return out;
}
function pick(arr, sc) { let best = -Infinity, at = 0; arr.forEach((r, i) => { const v = sc(r); if (v > best) { best = v; at = i; } }); return at; }
function regret(arr, at) { const us = arr.map((r) => Number(r[LABEL])); return Math.max(...us) - us[at]; }
function randRegret(arr) { const us = arr.map((r) => Number(r[LABEL])); const mu = us.reduce((a, b) => a + b, 0) / us.length; return Math.max(...us) - mu; }

/* ===== 标签噪声地板（--ceiling）：用 winS 的逐流 0/1，把流分成两半 =====
 * 做法：用 A 半挑一手、在 B 半上评 ⇒ 这是「即使完美知道 A 半，也会因为标签噪声吃到的 regret」。
 * 它给出一个**可达下限**：head 的 0.313 要跟这个地板比，而不是跟 0（oracle）比。
 * 缺 winS 的组整组跳过（旧 dump 没有逐流数组）。 */
if (argv.includes('--ceiling')) {
  const rows = [];
  for (const arr of G.g.values()) {
    const s0 = arr[0].winS;
    if (!Array.isArray(s0) || s0.length < 4) continue;
    const m = s0.length, half = Math.floor(m / 2);
    const uA = []; const uB = [];
    for (const r of arr) {
      const s = r.winS;
      let a = 0, b = 0;
      for (let i = 0; i < half; i++) a += Number(s[i]);
      for (let i = half; i < m; i++) b += Number(s[i]);
      uA.push(a / half); uB.push(b / (m - half));
    }
    const uFull = arr.map((r) => Number(r[LABEL]));
    const iA = uA.indexOf(Math.max(...uA));
    const iFull = uFull.indexOf(Math.max(...uFull));
    rows.push({ pickB: Math.max(...uB) - uB[iA], pickFull: Math.max(...uFull) - uFull[iA],
      pickFullOnFull: Math.max(...uFull) - uFull[iFull],
      randB: Math.max(...uB) - uB.reduce((x, y) => x + y, 0) / uB.length,
      randFull: Math.max(...uFull) - uFull.reduce((x, y) => x + y, 0) / uFull.length });
  }
  const meanOf2 = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const regB = rows.map((r) => r.pickB), randB = rows.map((r) => r.randB);
  console.log('标签噪声地板（' + rows.length + ' 组，每手 winS 分半）：');
  console.log('  用 A 半挑、在 B 半上评 = ' + meanOf2(regB).toFixed(3) + 'pt（这是**可达下限**：完美知道 A 半也躲不开的 regret）');
  console.log('  随机挑、在 B 半上评 = ' + meanOf2(randB).toFixed(3) + 'pt');
  console.log('  —— 同一把尺换成"全流标签"（与 head 的 regret 同口径）——');
  console.log('  用 A 半挑、在**全流**上评 = ' + meanOf2(rows.map((r) => r.pickFull)).toFixed(3) + 'pt（4 条流标签下的可达下限）');
  console.log('  用全流 oracle 挑（=同一标签的 oracle）= ' + meanOf2(rows.map((r) => r.pickFullOnFull)).toFixed(3) + 'pt（恒 0，自证）');
  console.log('  随机挑、在全流上评 = ' + meanOf2(rows.map((r) => r.randFull)).toFixed(3) + 'pt');
  console.log('  ⇒ 可学空间 = 随机 − 地板 = ' + (meanOf2(randB) - meanOf2(regB)).toFixed(3) + 'pt；head 的读数要与这条线比，不是与 0 比');
  process.exit(0);
}
const stats = { head: [], net: [], rand: [], mlp: [] };
/* `--floor` 那条腿的累加器（全部在**B 半流标签**上算 ⇒ 与地板同尺度） */
const fl = { randB: [], floorB: [], headB: [], netB: [], mlpB: [], ties: [], idx0: 0, mono: 0, n: 0 };
let usedGroups = 0, inSample = null;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const halfLabel = (arr, which) => {
  const m = arr[0].winS;
  if (!Array.isArray(m) || m.length < 4) return null;
  const half = m.length >> 1;
  return arr.map((r) => { let s = 0, k0 = 0, k1 = 0; if (which === 'A') { k0 = 0; k1 = half; } else { k0 = half; k1 = m.length; } for (let i = k0; i < k1; i++) s += Number(r.winS[i]); return s / (k1 - k0); });
};
/** 并列最大者取平均 regret（不抽样，直接算期望）——破"并列按下标最小挑 ⇒ 等于挑池里 net 第一名"那条偏 */
function regretTie(arr, scFn, u) {
  const sv = arr.map((r, i) => scFn(r, i));
  const top = Math.max(...sv);
  const tied = sv.map((v, i) => (Math.abs(v - top) < 1e-12 ? i : -1)).filter((i) => i >= 0);
  const mx = Math.max(...u);
  return { r: tied.reduce((a, i) => a + (mx - u[i]), 0) / tied.length, tied: tied.length };
}
function evalOneGroup(arr, m, mlp) {
  stats.head.push(regret(arr, pick(arr, (r) => scoreAny(m, r))));
  stats.net.push(regret(arr, pick(arr, (r) => Number(r.net))));
  stats.rand.push(randRegret(arr));
  if (mlp) stats.mlp.push(regret(arr, pick(arr, (r) => scoreMLP(mlp, r.x))));
  if (FLOOR) {
    const uA = halfLabel(arr, 'A'), uB = halfLabel(arr, 'B');
    if (uA && uB) {
      const maxB = Math.max(...uB), meanB = uB.reduce((a, b) => a + b, 0) / uB.length;
      const topA = Math.max(...uA);
      const tied = uA.map((v, i) => (Math.abs(v - topA) < 1e-12 ? i : -1)).filter((i) => i >= 0);
      fl.randB.push(maxB - meanB); fl.floorB.push(tied.reduce((a, i) => a + (maxB - uB[i]), 0) / tied.length);
      fl.headB.push(regretTie(arr, (r) => score(m, r), uB).r);
      fl.netB.push(regretTie(arr, (r) => Number(r.net), uB).r);
      if (mlp) fl.mlpB.push(regretTie(arr, (r) => scoreMLP(mlp, r.x), uB).r);
      fl.ties.push(tied.length); if (tied[0] === 0) fl.idx0++; fl.n++;
      let mono = true; for (let i = 1; i < arr.length; i++) if (arr[i].net > arr[i - 1].net + 1e-12) { mono = false; break; }
      if (mono) fl.mono++;
    }
  }
  usedGroups++;
}
if (FOLDS >= 2) {
  const buckets = Array.from({ length: FOLDS }, () => []);
  for (const [k, arr] of G.g) buckets[hashStr(k) % FOLDS].push(arr);
  for (let f = 0; f < FOLDS; f++) {
    const testG = buckets[f];
    const trainG = buckets.filter((_, i) => i !== f).flat();
    if (!testG.length || !trainG.length) continue;
    const m = fit(trainG, { topK: TOPK });
    const mlp = HIDDEN > 0 ? fitMLP(trainG, HIDDEN) : null;
    for (const arr of testG) evalOneGroup(arr, m, mlp);
    if (f === 0) { const tr = trainG.slice(0, 200); let s = 0; for (const arr of tr) s += regret(arr, pick(arr, (r) => score(m, r))); inSample = s / tr.length; }
  }
} else {
  const trArr = TRAIN ? [...groupsOf(loadRows(TRAIN).filter((r) => !ARM || r.arm === ARM)).g.values()] : [...G.g.values()];
  const teArr = TEST ? [...groupsOf(loadRows(TEST).filter((r) => !ARM || r.arm === ARM)).g.values()] : [...G.g.values()];
  const m = fit(trArr, { topK: TOPK });
  const mlp = HIDDEN > 0 ? fitMLP(trArr, HIDDEN) : null;
  let s = 0; for (const arr of trArr.slice(0, 200)) s += regret(arr, pick(arr, (r) => score(m, r))); inSample = s / Math.min(200, trArr.length);
  for (const arr of teArr) evalOneGroup(arr, m, mlp);
}
const meanOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
let seed = 987654321; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function boot(diff) { const B = []; for (let t = 0; t < 2000; t++) { let s = 0; for (let i = 0; i < diff.length; i++) s += diff[(rnd() * diff.length) | 0]; B.push(s / diff.length); } B.sort((a, b) => a - b); return { mean: meanOf(diff), lo: B[50], hi: B[1950] }; }
const dHead = stats.head.map((v, i) => v - stats.rand[i]);
const dNet = stats.net.map((v, i) => v - stats.rand[i]);
const dHeadNet = stats.head.map((v, i) => v - stats.net[i]);
const bHead = boot(dHead), bNet = boot(dNet), bHeadNet = boot(dHeadNet);
const dMlp = stats.mlp.length === stats.rand.length ? stats.mlp.map((v, i) => v - stats.rand[i]) : null;
const bMlp = dMlp ? boot(dMlp) : null;
const bMlpHead = (dMlp && stats.mlp.length === stats.head.length) ? boot(stats.mlp.map((v, i) => v - stats.head[i])) : null;
const out = { F, groups: usedGroups, folds: FOLDS, topK: TOPK, hidden: HIDDEN, mean: { head: meanOf(stats.head), net: meanOf(stats.net), rand: meanOf(stats.rand), mlp: stats.mlp.length ? meanOf(stats.mlp) : null }, inSample, headVsRand: bHead, netVsRand: bNet, mlpVsRand: bMlp, mlpVsHead: bMlpHead };
if (JSONOUT) { console.log(JSON.stringify(out)); process.exit(0); }
console.log('特征 ' + F + ' 维 ‖ 组 ' + usedGroups + (FOLDS >= 2 ? '（' + FOLDS + ' 折 CV）' : '（单次切分）') + (TOPK ? ' ‖ topK=' + TOPK : '') + ' ‖ 组内平均变化列 ' + meanVary.toFixed(1) + '/' + F + ' ‖ 训练侧 in-sample regret ≈ ' + inSample.toFixed(3) + 'pt（应明显低于随机，否则拟合器坏了）');
console.log('test 组平均 regret（越小越好，0 = 每手都挑到 oracle）：');
console.log('  线性头 = ' + out.mean.head.toFixed(3) + 'pt ‖ 现役 net = ' + out.mean.net.toFixed(3) + 'pt ‖ 随机 = ' + out.mean.rand.toFixed(3) + 'pt');
console.log('  线性头 − 随机 = ' + bHead.mean.toFixed(3) + 'pt  [95% ' + bHead.lo.toFixed(3) + ', ' + bHead.hi.toFixed(3) + ']');
console.log('  现役net − 随机 = ' + bNet.mean.toFixed(3) + 'pt  [95% ' + bNet.lo.toFixed(3) + ', ' + bNet.hi.toFixed(3) + ']');
console.log('  线性头 − 现役net = ' + bHeadNet.mean.toFixed(3) + 'pt  [95% ' + bHeadNet.lo.toFixed(3) + ', ' + bHeadNet.hi.toFixed(3) + ']（负 = 线性头更好）');
if (bMlp) {
  console.log('  ⭐ 隐层头（H=' + HIDDEN + ' ‖ epochs=' + EPOCHS + ' ‖ seed=' + SEEDH + '） = ' + out.mean.mlp.toFixed(3) + 'pt');
  console.log('     隐层头 − 随机 = ' + bMlp.mean.toFixed(3) + 'pt  [95% ' + bMlp.lo.toFixed(3) + ', ' + bMlp.hi.toFixed(3) + ']');
  console.log('     隐层头 − 线性头 = ' + bMlpHead.mean.toFixed(3) + 'pt  [95% ' + bMlpHead.lo.toFixed(3) + ', ' + bMlpHead.hi.toFixed(3) + ']（负 = 交互买得到东西；这行就是**state 维到底值多少钱**）');
  console.log('     ⚠ 线性头结构上读不到 state 段（同决策内 state 维逐字相同 ⇒ 组内中心化后方差 0）⇒ 只引线性那行判"哪版表示好"，判的是候选侧');
}
if (FLOOR && fl.n > 0) {
  const rB = meanOf(fl.randB), fB = meanOf(fl.floorB);
  console.log('');
  console.log('—— 诚实可达地板（' + fl.n + ' 组 ‖ 挑与评用**互不相交**的半流 ‖ 并列最大者取**期望**）——');
  console.log('  随机（B 评）= ' + rB.toFixed(3) + 'pt ‖ **地板**（A 半流挑、B 半流评）= ' + fB.toFixed(3) + 'pt ‖ 可学空间 = ' + (rB - fB).toFixed(3) + 'pt');
  console.log('  线性头（B 评）= ' + meanOf(fl.headB).toFixed(3) + 'pt ⇒ 兑现 ' + (100 * (rB - meanOf(fl.headB)) / Math.max(1e-9, rB - fB)).toFixed(1) + '% 的可学空间');
  console.log('  现役 net（B 评）= ' + meanOf(fl.netB).toFixed(3) + 'pt ⇒ 兑现 ' + (100 * (rB - meanOf(fl.netB)) / Math.max(1e-9, rB - fB)).toFixed(1) + '%');
  if (fl.mlpB.length) console.log('  隐层头（B 评）= ' + meanOf(fl.mlpB).toFixed(3) + 'pt ⇒ 兑现 ' + (100 * (rB - meanOf(fl.mlpB)) / Math.max(1e-9, rB - fB)).toFixed(1) + '%');
  console.log('  地板的并列审计：平均并列 ' + (fl.ties.reduce((a, b) => a + b, 0) / fl.ties.length).toFixed(2) + ' 个 ‖ 有并列的组 ' + fl.ties.filter((t) => t > 1).length + '/' + fl.n + ' ‖ 旧口径（取下标最小）会落在池里 net 第一名的比例 ' + (100 * fl.idx0 / fl.n).toFixed(1) + '%');
  console.log('  池按 net 降序的组：' + fl.mono + '/' + fl.n + '（这一列 = 组数时，"取下标最小"就等于"取现役 net 的第一名" ⇒ 旧地板是自反+跳槽双重偏）');
  console.log('  ⚑ 对照 DS 那版 `--ceiling`（A 挑、在**含 A 的全流**上评）：那条是**自反**口径，同一份数据上实测乐观 ~4× ⇒ 别把两版的数并排引');
}
if (bHead.hi < 0 && bNet.hi < 0) console.log('  ⇒ 两者都**显著好于随机**：这份输入里存在可学的组内信号（现役头已吃到一部分，线性头没吃到更多）');
else if (bMlp && bMlp.hi < 0 && bHead.hi >= 0) console.log('  ⭐ ⇒ **只有隐层头显著**：信号在 state×action 的交互里，线性尺（含 DS 那串 ladder）本来就量不到');
else if (bHead.hi < 0) console.log('  ⇒ **线性头显著好于随机**：输入里有可学信号（现役头没吃到）');
else if (bNet.hi < 0) console.log('  ⇒ 现役头显著好于随机、线性头不显著：信号存在但线性读法抓不到');
else console.log('  ⇒ 两者都与随机**分不开**：当前证据不支持「这份输入里能学出组内排序」');
