#!/usr/bin/env node
/* §E817（10-28 下午 · 2.0 架构研究）**把"落点"喂进输入，到底多兑现几成上限**
 * 在册关系：§E197 量了"在现有 235 维上重学一个线性头"⇒ **净兑现 8.4% ‖ 10.0%**；§E198 量了"给那个头加动作×情景交互基"
 *   ⇒ **净增 +0.10±2.02 ‖ +0.17±2.11 = 零**；§E205 量了"给学出来的头再加一层搜索"⇒ ≤0。
 *   ⇒ 三条便宜路都关在"**信息集不变**"这一句上。§E816 找到几个"现有输入表达不出"的后果量（白防 / 终局手 / 反弹），
 *     本尺问的就是那一格：**把那几个量加进输入，兑现率动不动**。
 * 同一批标签：数据来自 `tools/probe-myopia-regret.mjs --dump= --dumpsx=`（**rollout 的算术只能有一份**，
 *   另起一台采集器两边的 regret 就不可比）。`--dumpsx` 那段只在旗标开着时执行 ⇒ 仪器默认输出逐字不变（已实测 diff）。
 * 主判据（照 §E197 **修过分母之后**的口径，分母符号的坑在 `probe-value-head-ceiling.mjs:16-20` 写得很清楚）：
 *   `regret(方案) = 组内 oracle 的 win − 方案挑那一手的 win`（同组同批标签 ⇒ 配对），
 *   `capture = (regret(net) − regret(head)) / regret(net)`。
 *   ⚠ **必须同时印"随机挑一手"的参照线**：`regret(oracle) ≡ 0`，而 `regret(net)` 可以小于 `regret(rand)`
 *     ⇒ 把分母写成 `regret(net) − regret(rand)` 会得出负分母、兑现率能报出 383%。
 *   ⚠ **必须减掉置换对照**（把 y 在组内打乱再拟合）⇒ 一个与结局无关的固定方向也能打败现役网络的组内排序
 *     （§E198 实测那条对照自己就有 +7.4%）。**只引"净兑现 = 真值 − 自己的置换对照"**。
 * 三条自证：① **join 完整性**（每行 x 都有对应 sx，键 = seed+arm+env+g+n+round+i ⇒ 重键必须为 0；
 *   ⚠ 不能用 `pk`：§E205 已经踩过"pk 不带 seed/round ⇒ 两带合池撞键"）；
 *   ② **置换对照回到 ~0**；③ **训练/留出是不同 seed**（4100 拟合 ‖ 21000 评估 ⇒ 不许同池自评）。
 * 用法：node tools/probe-settle-capture.mjs --train=<jsonl> --trainsx=<jsonl> --test=<jsonl> --testsx=<jsonl> [--lam=1]
 * 只读 JSONL，不改引擎、不加门、不动冠军槽。
 */
import { readFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['train', 'trainsx', 'test', 'testsx', 'lam'], 'probe-settle-capture');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const LAM = Number(arg('lam', 1));
const F = ['train', 'trainsx', 'test', 'testsx'];
for (const k of F) if (!arg(k, '')) { console.error('⛔ 缺 `--' + k + '=<jsonl>`'); process.exit(2); }
const load = p => readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const TX = load(arg('train')), TS = load(arg('trainsx')), EX = load(arg('test')), ES = load(arg('testsx'));

const key = r => [r.seed, r.arm, r.env, r.g, r.n, r.round, r.i].join('|');
const gkey = r => [r.seed, r.arm, r.env, r.g, r.n, r.round].join('|');
const sxOf = new Map();
for (const r of TS) { if (sxOf.has(key(r))) { console.error('⛔ 训练侧 sx 重键：' + key(r)); process.exit(2); } sxOf.set(key(r), r.sx); }
const esxOf = new Map();
for (const r of ES) { if (esxOf.has(key(r))) { console.error('⛔ 留出侧 sx 重键：' + key(r)); process.exit(2); } esxOf.set(key(r), r.sx); }
const TR = TX.filter(r => sxOf.has(key(r))), EV = EX.filter(r => esxOf.has(key(r)));
console.log('# §E817 把落点喂进输入，多兑现几成上限');
console.log('# 训练 x 行 ' + TX.length + ' ‖ 训练 sx 行 ' + TS.length + ' ‖ join 成功 ' + TR.length
  + (TR.length !== TX.length ? ' ⇒ ⛔ **有行没配上 sx，本表不许引**' : '（100% ✓）'));
console.log('# 留出 x 行 ' + EX.length + ' ‖ 留出 sx 行 ' + ES.length + ' ‖ join 成功 ' + EV.length
  + (EV.length !== EX.length ? ' ⇒ ⛔ 同上' : '（100% ✓）'));
if (TR.length !== TX.length || EV.length !== EX.length) process.exit(2);
const DIMX = TR[0].x.length, DIMS = sxOf.get(key(TR[0])).length;
console.log('# 特征：x = ' + DIMX + ' 维（现役 213 状态 ‖ 22 动作）‖ sx = ' + DIMS + ' 维（solo 1-ply 结算摘要）');

const vec = (r, mode) => mode === 'x' ? r.x : mode === 'sx' ? sxOf.get(key(r)) || esxOf.get(key(r)) : r.x.concat(sxOf.get(key(r)) || esxOf.get(key(r)));

/* 组内 ridge（标准化 + L2），返回 predict 函数 */
function fit(rows, mode, shuffleSeed) {
  const X = rows.map(r => Array.from(vec(r, mode))), Y = rows.map(r => r.win);
  const d = X[0].length, mu = new Float64Array(d), sg = new Float64Array(d);
  for (const x of X) for (let j = 0; j < d; j++) mu[j] += x[j];
  for (const x of X) for (let j = 0; j < d; j++) sg[j] += (x[j] - mu[j]) ** 2;
  for (let j = 0; j < d; j++) { mu[j] /= X.length; sg[j] = Math.sqrt(sg[j] / X.length) || 1; }
  const ys = Y.slice();
  if (shuffleSeed) {                                     /* 组内置换 y（零假设）：同一个决策内的标签互相打乱 */
    const by = new Map();
    rows.forEach((r, i) => { const g = gkey(r); if (!by.has(g)) by.set(g, []); by.get(g).push(i); });
    let s = shuffleSeed >>> 0;
    const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    for (const idx of by.values()) {
      for (let k = idx.length - 1; k > 0; k--) { const h = (rnd() * (k + 1)) | 0; const t = idx[h]; idx[h] = idx[k]; idx[k] = t; }
      const src = idx.map(i => Y[i]);
      for (let k = 0; k < idx.length; k++) ys[idx[k]] = src[(k + 1) % src.length];   /* 组内轮换 ⇒ 同组标签互相打乱、组间分布不变 */
    }
  }
  const G = new Float64Array((d + 1) * (d + 1)), b = new Float64Array(d + 1);
  for (let i = 0; i < X.length; i++) {
    const z = new Float64Array(d + 1);
    for (let j = 0; j < d; j++) z[j] = (X[i][j] - mu[j]) / sg[j];
    z[d] = 1;
    for (let a = 0; a <= d; a++) { b[a] += z[a] * ys[i]; for (let c = 0; c <= d; c++) G[a * (d + 1) + c] += z[a] * z[c]; }
  }
  for (let a = 0; a <= d; a++) G[a * (d + 1) + a] += LAM;
  const w = solve(G, b, d + 1);
  return r => { const v = vec(r, mode); let s2 = w[d]; for (let j = 0; j < d; j++) s2 += w[j] * (v[j] - mu[j]) / sg[j]; return s2; };
}
function solve(G, b, p) {
  const M = Float64Array.from(G), v = Float64Array.from(b);
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(M[r * p + c]) > Math.abs(M[piv * p + c])) piv = r;
    if (Math.abs(M[piv * p + c]) < 1e-12) continue;
    if (piv !== c) { for (let j = 0; j < p; j++) { const t = M[c * p + j]; M[c * p + j] = M[piv * p + j]; M[piv * p + j] = t; } const t = v[c]; v[c] = v[piv]; v[piv] = t; }
    for (let r = 0; r < p; r++) { if (r === c) continue; const f = M[r * p + c] / M[c * p + c]; if (!f) continue; for (let j = c; j < p; j++) M[r * p + j] -= f * M[c * p + j]; v[r] -= f * v[c]; }
  }
  const w = new Float64Array(p); for (let i = 0; i < p; i++) w[i] = v[i] / (M[i * p + i] || 1); return w;
}

/* 组内 regret（配对）：同一组同一批 rollout 标签 ⇒ 直接可比 */
function regret(rows, scoreOf) {
  const by = new Map();
  for (const r of rows) { const g = gkey(r); if (!by.has(g)) by.set(g, []); by.get(g).push(r); }
  let acc = 0, n = 0, candSum = 0, winSum = 0;
  for (const idx of by.values()) {
    if (idx.length < 2) continue;
    let io = 0, ib = 0, bw = -1, bs = -1e9;
    for (let k = 0; k < idx.length; k++) {
      if (idx[k].win > bw) { bw = idx[k].win; io = k; }
      const s = scoreOf(idx[k]);
      if (s > bs) { bs = s; ib = k; }
    }
    acc += bw - idx[ib].win; n++; candSum += idx.length; winSum += idx[io].win;
  }
  return n ? { regret: acc / n * 100, groups: n, candAvg: candSum / n, oracleWin: winSum / n * 100 } : { regret: NaN, groups: 0 };
}
const netScore = r => r.net;
const randScore = r => { let h = (r.seed * 73856093) ^ (r.g * 19349663) ^ (r.n * 83492791) ^ (r.round * 2654435761) ^ (r.i * 40503); h = (h >>> 0) / 4294967296; return h; };   /* 确定性、不抽任何流（§E191 同族纪律） */

console.log('\n## 参照线（分母健康检查）');
const rNet = regret(EV, netScore), rRand = regret(EV, randScore);
console.log('  现役 net 挑：regret = **' + rNet.regret.toFixed(2) + ' pt** ‖ 组 ' + rNet.groups + ' ‖ 平均候选 ' + rNet.candAvg.toFixed(1) + ' ‖ oracle 赢率 ' + rNet.oracleWin.toFixed(1) + '%');
console.log('  随机挑一手：regret = ' + rRand.regret.toFixed(2) + ' pt'
  + (rNet.regret > rRand.regret ? '（net 比随机好 ⇒ 分母为正 ✓）' : ' ⇒ ⚠ net 不比随机好，capture 的分母符号要先解释，本表只作观察'));
const fx = fit(TR, 'x'), fsx = fit(TR, 'sx'), fb = fit(TR, 'both');
const px = fit(TR, 'x', 991), psx = fit(TR, 'sx', 991), pb = fit(TR, 'both', 991);
const cases = [['head(x)  现役 235 维', fx, px], ['head(sx)  只喂结算摘要', fsx, psx], ['head(x+sx) 加进输入', fb, pb]];
console.log('\n## 兑现率（capture = (regret(net) − regret(head)) / regret(net)，**只引净兑现 = 真值 − 自己的置换对照**）');
for (const [nm, mdl, perm] of cases) {
  const a = regret(EV, mdl), z = regret(EV, perm);
  const cap = rNet.regret > 0 ? (rNet.regret - a.regret) / rNet.regret * 100 : NaN;
  const capZ = rNet.regret > 0 ? (rNet.regret - z.regret) / rNet.regret * 100 : NaN;
  console.log('  ' + nm.padEnd(24) + ' regret ' + a.regret.toFixed(2) + ' pt ‖ capture ' + (cap === 0 ? cap : Number(cap)).toFixed(1)
    + '% ‖ 置换对照 ' + Number(capZ).toFixed(1) + '% ‖ **净兑现 ' + (cap - capZ).toFixed(1) + '%**');
}
/* ⚑ **标签自己的天花板**（§E208 留 `winS` 逐流数组就是为这件事）：一台仪器的分辨率不够时，
 *   "A 比 B 多 1.2pt"这种话不能讲。⇒ 同一组内把逐流分前后两半各挑一次最优：
 *   两半挑到同一手的比例 = 这份标签把"哪手更好"定死了没有；再给 regret 差一个**配对标准误**。 */
function splitHalf(rows) {
  const by = new Map();
  for (const r of rows) { const g = gkey(r); if (!by.has(g)) by.set(g, []); by.get(g).push(r); }
  let agree = 0, n = 0, dSum = 0, dSq = 0, nd = 0;
  for (const idx of by.values()) {
    if (idx.length < 2 || !idx[0].winS || idx[0].winS.length < 4) continue;
    const H = idx[0].winS.length, mid = H / 2 | 0;
    const A = idx.map(r => { let s = 0; for (let k = 0; k < mid; k++) s += r.winS[k]; return s / mid; });
    const B = idx.map(r => { let s = 0; for (let k = mid; k < H; k++) s += r.winS[k]; return s / (H - mid); });
    const ia = A.indexOf(Math.max.apply(null, A));
    let ib = 0; for (let k = 0; k < B.length; k++) if (B[k] > B[ib]) ib = k;
    n++; if (ia === ib) agree++;
    /* 两半各自的"用前半标签挑 vs 用后半标签挑"的赢率差 = regret 估计的噪声尺度 */
    const w = idx.map(r => r.win);
    const d = Math.abs(w[ia] - w[ib]); dSum += d; dSq += d * d; nd++;
  }
  const mean = nd ? dSum / nd : NaN, se = nd ? Math.sqrt(Math.max(0, dSq / nd - mean * mean) / nd) : NaN;
  return { n, agree: n ? agree / n * 100 : NaN, meanGap: mean, se };
}
const sp = splitHalf(EV);
console.log('\n## 标签的分辨率（这条决定上面那些差能不能讲"大小"）');
console.log('  分半一致率（同一组前半流与后半流各挑一次，挑到同一手的比例）= **' + sp.agree.toFixed(1) + '%**（' + sp.n + ' 组）');
console.log('  两半各自挑最优的赢率差：均值 ' + sp.meanGap.toFixed(2) + ' pt ‖ **配对标准误 ±' + (2 * sp.se).toFixed(2) + ' pt**（95% 带）');
console.log('  ⇒ 上面"净兑现"之差小于这条 ± 带时，只能说**这台仪器量不出这一格**，不能说"落点没用"。');

console.log('  逐流只有 REP 条 ⇒ 组内相关被噪声衰减，"分不开"不等于"等于 0"（§E197 原话）。');
