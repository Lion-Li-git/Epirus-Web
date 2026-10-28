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
const MINGAP = Number(arg('minGap', 0));
const JSONOUT = argv.includes('--json');
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
function pick(arr, sc) { let best = -Infinity, at = 0; arr.forEach((r, i) => { const v = sc(r); if (v > best) { best = v; at = i; } }); return at; }
function regret(arr, at) { const us = arr.map((r) => Number(r[LABEL])); return Math.max(...us) - us[at]; }
function randRegret(arr) { const us = arr.map((r) => Number(r[LABEL])); const mu = us.reduce((a, b) => a + b, 0) / us.length; return Math.max(...us) - mu; }

const stats = { head: [], net: [], rand: [] };
let usedGroups = 0, inSample = null;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
if (FOLDS >= 2) {
  const buckets = Array.from({ length: FOLDS }, () => []);
  for (const [k, arr] of G.g) buckets[hashStr(k) % FOLDS].push(arr);
  for (let f = 0; f < FOLDS; f++) {
    const testG = buckets[f];
    const trainG = buckets.filter((_, i) => i !== f).flat();
    if (!testG.length || !trainG.length) continue;
    const m = fit(trainG, { topK: TOPK });
    for (const arr of testG) { stats.head.push(regret(arr, pick(arr, (r) => score(m, r)))); stats.net.push(regret(arr, pick(arr, (r) => Number(r.net)))); stats.rand.push(randRegret(arr)); usedGroups++; }
    if (f === 0) { const tr = trainG.slice(0, 200); let s = 0; for (const arr of tr) s += regret(arr, pick(arr, (r) => score(m, r))); inSample = s / tr.length; }
  }
} else {
  const trArr = TRAIN ? [...groupsOf(loadRows(TRAIN).filter((r) => !ARM || r.arm === ARM)).g.values()] : [...G.g.values()];
  const teArr = TEST ? [...groupsOf(loadRows(TEST).filter((r) => !ARM || r.arm === ARM)).g.values()] : [...G.g.values()];
  const m = fit(trArr, { topK: TOPK });
  let s = 0; for (const arr of trArr.slice(0, 200)) s += regret(arr, pick(arr, (r) => score(m, r))); inSample = s / Math.min(200, trArr.length);
  for (const arr of teArr) { stats.head.push(regret(arr, pick(arr, (r) => score(m, r)))); stats.net.push(regret(arr, pick(arr, (r) => Number(r.net)))); stats.rand.push(randRegret(arr)); usedGroups++; }
}
const meanOf = (a) => a.reduce((x, y) => x + y, 0) / a.length;
let seed = 987654321; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function boot(diff) { const B = []; for (let t = 0; t < 2000; t++) { let s = 0; for (let i = 0; i < diff.length; i++) s += diff[(rnd() * diff.length) | 0]; B.push(s / diff.length); } B.sort((a, b) => a - b); return { mean: meanOf(diff), lo: B[50], hi: B[1950] }; }
const dHead = stats.head.map((v, i) => v - stats.rand[i]);
const dNet = stats.net.map((v, i) => v - stats.rand[i]);
const dHeadNet = stats.head.map((v, i) => v - stats.net[i]);
const bHead = boot(dHead), bNet = boot(dNet), bHeadNet = boot(dHeadNet);
const out = { F, groups: usedGroups, folds: FOLDS, topK: TOPK, mean: { head: meanOf(stats.head), net: meanOf(stats.net), rand: meanOf(stats.rand) }, inSample, headVsRand: bHead, netVsRand: bNet };
if (JSONOUT) { console.log(JSON.stringify(out)); process.exit(0); }
console.log('特征 ' + F + ' 维 ‖ 组 ' + usedGroups + (FOLDS >= 2 ? '（' + FOLDS + ' 折 CV）' : '（单次切分）') + (TOPK ? ' ‖ topK=' + TOPK : '') + ' ‖ 组内平均变化列 ' + meanVary.toFixed(1) + '/' + F + ' ‖ 训练侧 in-sample regret ≈ ' + inSample.toFixed(3) + 'pt（应明显低于随机，否则拟合器坏了）');
console.log('test 组平均 regret（越小越好，0 = 每手都挑到 oracle）：');
console.log('  线性头 = ' + out.mean.head.toFixed(3) + 'pt ‖ 现役 net = ' + out.mean.net.toFixed(3) + 'pt ‖ 随机 = ' + out.mean.rand.toFixed(3) + 'pt');
console.log('  线性头 − 随机 = ' + bHead.mean.toFixed(3) + 'pt  [95% ' + bHead.lo.toFixed(3) + ', ' + bHead.hi.toFixed(3) + ']');
console.log('  现役net − 随机 = ' + bNet.mean.toFixed(3) + 'pt  [95% ' + bNet.lo.toFixed(3) + ', ' + bNet.hi.toFixed(3) + ']');
console.log('  线性头 − 现役net = ' + bHeadNet.mean.toFixed(3) + 'pt  [95% ' + bHeadNet.lo.toFixed(3) + ', ' + bHeadNet.hi.toFixed(3) + ']（负 = 线性头更好）');
if (bHead.hi < 0 && bNet.hi < 0) console.log('  ⇒ 两者都**显著好于随机**：这份输入里存在可学的组内信号（现役头已吃到一部分，线性头没吃到更多）');
else if (bHead.hi < 0) console.log('  ⇒ **线性头显著好于随机**：输入里有可学信号（现役头没吃到）');
else if (bNet.hi < 0) console.log('  ⇒ 现役头显著好于随机、线性头不显著：信号存在但线性读法抓不到');
else console.log('  ⇒ 两者都与随机**分不开**：当前证据不支持「这份输入里能学出组内排序」');
