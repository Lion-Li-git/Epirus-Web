#!/usr/bin/env node
/* capacity.mjs — S1o 的 top-1=0.0% 是**装不下**还是**没学好**？（千问 · 10-29 01:5x 重写第三版 · 任务 #140）
 *
 * ⚑ 前两版为什么作废（都记下来，别再犯）：
 *   a) **两档不同场**：`makePolicy` 从共用流里吃随机数，5258 与 6500 条参数吃掉的数量不同 ⇒ 抓到的根本不是一批局；
 *   b) 我"修"它的方式更糟：给每个夹具按 `(ix+1)*常数` 播种一条 **LCG**，而 LCG 的 k 步状态对种子是**线性**的
 *      ⇒ 相邻夹具的流彼此仿射相关 ⇒ 抽签在组间高度同构（现场证据：v7 的当选候选 57.3% 落在"位置 0"）。
 *   c) 第三版才看清：`T.buildOpps()` 自己带 `Math.random()` ⇒ **同一档跑两遍对手表都不一样**。
 *      ⇒ 唯一稳的做法是**标签只抓一次、且在装任何 2.0 档之前抓**，两档读同一份冻结标签。
 *
 * ✅ 本版构造性保证：抓取阶段只用 v7 原版 `P.candidatesFor / P.value`，与后面装哪档无关
 *    ⇒ 跨档比较的前提（同批组、同份标签）不是"我尽量对齐"，是**没有第二条路可走**。
 *
 * 四条读数：① φ 组内相对展幅 ‖ ② 容量上界（同批 in-sample，只当上界不当成绩）‖ ②b 留出半批 ‖ ③ 反事实（原始候选特征当 φ）
 * ⚑ 量程条款（10-29 01:5x 补，别把 ② 当容量读）：这一版**没有**打乱候选顺序，而 v7 的当选在候选表里是有位置的
 *   （实测落位置 0 占 ~49%）⇒ 岭回归在 ② 这条上会**塌成"永远选同一个位置"**，两档给出逐字相同的命中数
 *   （200 组时两档都是 11/200、留出都是 6/100）——那是同一个位置规则，不是两份相等的容量。
 *   ⇒ 要判"结构装不装得下"，用 `tools/proto2/rankfit.mjs`（逐组打乱 + 位置地板 + 目标自熵三条校准腿都在读数前面跑）；
 *     这个文件的 ③（原始候选特征的线性上限）与 ①（展幅）不受这条病影响，可以继续引。
 * 用法：node tools/proto2/capacity.mjs [--decisions=400] [--l2=0.01]
 */
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, layout } from './arch2.mjs';
import { parts as obs3Parts } from './obs3.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const NDEC = Math.max(60, Number(arg('decisions', 400)) || 400);
const L2 = Number(arg('l2', 0.01));
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState;
let v7 = loadChamp(W, 'js/bundled-champion-3p.js', '');
if (!v7) { console.error('⛔ v7 读不出'); process.exit(2); }
v7 = Float64Array.from(v7);

function mkStream(seedVal) {
  let a = seedVal >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/* ===== 第一段（与档无关）：走局 + 抓决策点 + 冻结标签 ===== */
let gseed = 20261029;
const grnd = () => { gseed = (gseed * 1664525 + 1013904223) >>> 0; return gseed / 4294967296; };
const POOL = T.buildOpps(v7, 0.05);            /* ⚑ 只建一次，两档共用同一张对手表 */
const fixtures = [];
function walk(sb, n) {
  const c = []; for (let p = 0; p < n; p++) c.push(T.policyChooserN(v7));
  const probe = (st, p, legal) => {
    if (fixtures.length < NDEC && legal && legal.length >= 2 && (p % n) === 0) {
      const cl = S.cloneState(st);
      cl.rng = { next: mkStream(fnv('fx' + fixtures.length + 'g' + sb + 'p' + p)) };   /* 独立流，不抽母局 */
      const cands = P.candidatesFor(cl, p, T.econBase(cl, p, legal), { lockTarget: false });
      if (cands && cands.length >= 2) {
        const raw = [], keep = [];
        for (let i = 0; i < cands.length; i++) {
          const cd = cands[i];
          const v = P.value(cl, p, cd.key, v7, null, cd);   /* ⚑ 第 5 形参 = 形状（`sh`），**不是 bead**；照 `probe-myopia-regret.mjs:354` 传 null，bead 走第 6 形参的 `cd` */
          if (Number.isFinite(v)) { raw.push(v); keep.push(i); }
        }
        if (keep.length >= 2) {
          const mu = raw.reduce((a, b) => a + b, 0) / raw.length;
          let rp = 0; for (let i = 1; i < raw.length; i++) if (raw[i] > raw[rp]) rp = i;
          fixtures.push({ state: cl, pid: p, cands, keep, tgt: raw.map((x) => x - mu), refPick: rp, keySig: cands.map((x) => x.key + '/' + (x.bead || '-')).join(',') });
        }
      }
    }
    return POOL[(p + 1) % POOL.length].sel(st, p, legal);
  };
  const cs = c.slice(); cs[0] = probe; T.oneGameN(cs, sb, n, { regen: 0, mode: 'multi' });
}
for (let g = 0; fixtures.length < NDEC && g < 900; g++) walk(90000 + g * 13, g % 2 ? 5 : 3);
let fp = 2166136261;
for (const fx of fixtures) { const s = fx.keySig + '|' + fx.refPick + '|' + fx.tgt.map((x) => x.toFixed(4)).join(','); for (let i = 0; i < s.length; i++) { fp ^= s.charCodeAt(i); fp = Math.imul(fp, 16777619) >>> 0; } }
fp = (fp >>> 0).toString(16);
const pos0 = fixtures.filter((f) => f.refPick === 0).length;
console.log('# 标签冻结于装档之前 ‖ 夹具 ' + fixtures.length + ' ‖ 指纹 ' + fp + '（两档共用，构造上不可能不同）');
console.log('  每组成员候选数中位 ' + fixtures.map((f) => f.keep.length).sort((a, b) => a - b)[Math.floor(fixtures.length / 2)] +
  ' ‖ v7 当选落在候选 0 位 ' + pos0 + '（' + (100 * pos0 / Math.max(1, fixtures.length)).toFixed(1) + '%）');

function ridge(X, y, l2) {
  const D = X[0].length, n = X.length;
  const A = Array.from({ length: D }, () => new Float64Array(D + 1));
  for (let i = 0; i < n; i++) for (let p = 0; p < D; p++) { A[p][D] += X[i][p] * y[i]; for (let q = 0; q < D; q++) A[p][q] += X[i][p] * X[i][q]; }
  for (let p = 0; p < D; p++) A[p][p] += l2 * n;
  for (let c = 0; c < D; c++) {
    let piv = c; for (let r = c + 1; r < D; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) continue;
    const t = A[c]; A[c] = A[piv]; A[piv] = t;
    const d = A[c][c]; for (let k = c; k <= D; k++) A[c][k] /= d;
    for (let r = 0; r < D; r++) { if (r === c) continue; const f = A[r][c]; if (!f) continue; for (let k = c; k <= D; k++) A[r][k] -= f * A[c][k]; }
  }
  const w = new Float64Array(D); for (let p = 0; p < D; p++) w[p] = A[p][D];
  return w;
}
/* top-1 在**留下候选表**的下标空间里算（混下标是上一版的错源之一） */
function top1(groups, score) {
  let hit = 0, tot = 0;
  for (const g of groups) {
    const mine = g.keep.map((ci, k) => score(g, k));
    let a = 0; for (let i = 1; i < mine.length; i++) if (mine[i] > mine[a]) a = i;
    if (a === g.refPick) hit++;
    tot++;
  }
  return { hit, tot, rate: tot ? hit / tot : 0 };
}

for (const INPUT of ['v7', 'obs3']) {
  if (P.__arch2) P.__arch2.restore();
  const A = installArch2(W, { mutMode: 'seg', input: INPUT === 'obs3' ? 'obs3' : undefined });
  const L = layout({ input: INPUT === 'obs3' ? 'obs3' : 'v7', skills: W.EpirusRules.skills.length });
  let ps = 777; const prng = () => { ps = (ps * 1664525 + 1013904223) >>> 0; return ps / 4294967296; };
  A.rngRef.r = prng;
  const params = Float64Array.from(P.makePolicy(0.25));
  const groups = [];
  for (const fx of fixtures) {
    const f2 = P.forwardCands(fx.state, fx.pid, fx.cands, params, { temp: 0.5, wantPhi: true });
    if (!f2.phi) continue;
    const phi = [], feat = [];
    for (const ci of fx.keep) {
      const row = new Float64Array(L.hid2 + 1);
      row.set(f2.phi.subarray(ci * L.hid2, (ci + 1) * L.hid2), 0); row[L.hid2] = 1;
      phi.push(row);
      const pr = obs3Parts(W, fx.state, fx.pid, fx.cands[ci]);    /* 两档共用同一份 obs3 候选特征 ⇒ ③ 是同一把尺 */
      const fr = new Float64Array(pr.base.length + pr.idOne.length + 1);
      fr.set(pr.base, 0); fr.set(pr.idOne, pr.base.length); fr[fr.length - 1] = 1;
      feat.push(fr);
    }
    const m = new Float64Array(L.hid2);
    for (const row of phi) for (let j = 0; j < L.hid2; j++) m[j] += row[j] / phi.length;
    let sp = 0, nm = 0;
    for (const row of phi) { let d = 0; for (let j = 0; j < L.hid2; j++) { const z = row[j] - m[j]; d += z * z; } sp += Math.sqrt(d); let t = 0; for (let j = 0; j < L.hid2; j++) t += row[j] * row[j]; nm += Math.sqrt(t); }
    groups.push({ keep: fx.keep, tgt: fx.tgt, refPick: fx.refPick, phi, feat, spread: sp / Math.max(1e-12, nm) });
  }
  const meanSpread = groups.reduce((a, g) => a + g.spread, 0) / Math.max(1, groups.length);
  const Xall = [], yall = [];
  for (const g of groups) for (let i = 0; i < g.keep.length; i++) { Xall.push(g.phi[i]); yall.push(g.tgt[i]); }
  const wIn = ridge(Xall, yall, L2);
  const inSample = top1(groups, (g, i) => { const r = g.phi[i]; let s = 0; for (let j = 0; j < r.length; j++) s += wIn[j] * r[j]; return s; });
  const cut = Math.floor(groups.length / 2);
  const Xtr = [], ytr = [];
  for (const g of groups.slice(0, cut)) for (let i = 0; i < g.keep.length; i++) { Xtr.push(g.phi[i]); ytr.push(g.tgt[i]); }
  const wTr = ridge(Xtr, ytr, L2);
  const holdout = top1(groups.slice(cut), (g, i) => { const r = g.phi[i]; let s = 0; for (let j = 0; j < r.length; j++) s += wTr[j] * r[j]; return s; });
  const Xf = [], yf = [];
  for (const g of groups.slice(0, cut)) for (let i = 0; i < g.keep.length; i++) { Xf.push(g.feat[i]); yf.push(g.tgt[i]); }
  const wF = ridge(Xf, yf, L2);
  const cf = top1(groups.slice(cut), (g, i) => { const r = g.feat[i]; let s = 0; for (let j = 0; j < r.length; j++) s += wF[j] * r[j]; return s; });
  /* ⑤ 同一条岭回归**改剂量**：l2 缩 100 倍 ⇒ 判"是不是正则把方向压死了"（第一版怀疑过这条） */
  const wLo = ridge(Xtr, ytr, L2 / 100);
  const cfLo = top1(groups.slice(cut), (g, i) => { const r = g.phi[i]; let s = 0; for (let j = 0; j < r.length; j++) s += wLo[j] * r[j]; return s; });
  console.log('# ' + (INPUT === 'obs3' ? 'S1o(obs3)' : 'S1(v7)') + ' ‖ 组 ' + groups.length + ' ‖ 参数宽 ' + (L.hid2 + 1) + ' ‖ 指纹同上一行（构造保证）');
  console.log('  ① φ 组内相对展幅 = ' + meanSpread.toFixed(4) + '  ‖ ≈0 ⇒ 候选身份没能穿过冻住的上游');
  console.log('  ② 容量上界（同批 in-sample top-1）= ' + (100 * inSample.rate).toFixed(1) + '%（' + inSample.hit + '/' + inSample.tot + '）');
  console.log('  ②b 留出半批（只用前半批拟合）= ' + (100 * holdout.rate).toFixed(1) + '%（' + holdout.hit + '/' + holdout.tot + '）');
  console.log('  ③ 反事实（原始候选特征当 φ，留出）= ' + (100 * cf.rate).toFixed(1) + '%（' + cf.hit + '/' + cf.tot + '）');
  console.log('  ⑤ l2 缩 100 倍后的留出 = ' + (100 * cfLo.rate).toFixed(1) + '%（判"正则压死方向"这条）');
}
console.log('⇒ 判读：② 低 ⇒ **结构装不下**（不是训练不够）；② 高而 ②b 低 ⇒ 是**泛化**；③ 高而 ② 低 ⇒ 锅在"上游冻结"，不在 obs3 有没有信息。');
