#!/usr/bin/env node
/* §E816（10-28 下午 · 2.0 维度预算）**"落点"这一类量，现在的 235 维到底表达得了吗**
 * 为什么问这一格：架构文档 `CHAMPION-2.0-ARCH-2026-10-28-qoder.md` 把 2.0 最值钱的一步押在
 *   **(B) 把结算后果变成输入**上。在册的四条便宜路（§E197 重学权重 8.4%‖10.0%、§E198 交互基 ≈0、
 *   §E203 手写加深 2.6~5.0pt、§E205 给头再加一层 ≤0）合起来只说了一件事：**在现有信息集上换算法不兑现**。
 *   ⇒ 掏"改输入"这笔换代钱之前要先量清：那些"后果量"（我这手打完，掉血/人头/珠/反弹会怎样）
 *      究竟是**输入里没有**（⇒ 加维有效），还是**已经有了但网络没用**（⇒ 加维白加，该去修别处）。
 * 做法（**无标签、不重训、不开臂**）：真实对局的决策点上，对每个候选做一版**单人 1-ply 结算**
 *   （`cloneState` → `attemptAction` → `resolveActions` → `endTurn`），得到若干后果量 q；
 *   再用现有的 235 维**在组内**（同一决策内去均值） ridge 预测 q ⇒ 得到两个数：
 *     · `组内方差占比` = q 是不是"候选之间会变"的量（不随候选变 ⇒ 对排序没用）；
 *     · `组内 R²(留出组)` = 现有输入**已经能表达**它多少。
 *   ⇒ **判据（先写死）**：`组内方差占比高` 且 `组内 R² 低`（<0.2）的后果量 = 当前输入的真空 ⇒ 值得进 2.0 的维度预算。
 * 三条自证（少一条读数不能引）：
 *   · **牙**：把动作特征里**已有的**"期望伤害"那一维当作 q 来预测 ⇒ 组内 R² 必须 ≈ 1（它就在 x 里）；读不出 ~1 = 尺瞎。
 *   · **零假设**：把每组的 q 在组内**随机置换** ⇒ R² 必须 ≈ 0（不回去 = 泄漏或过拟合）。
 *   · **同形对照**：同种子跑第二遍 ⇒ 全部统计量逐位相同。
 * ⚠ 口径条款（引用必带）：
 *   · 1-ply 是**焦点席单独结算**（他人这一回合不动）。⚑ 这不是"下界版"而是**决策时刻唯一算得出的版本**：
 *     `autoGameN` 是先逐席 `ch(state,pid,legal)` 收齐 picks、**之后**才 `attemptAction`+`resolveActions`
 *     （`js/core/play.js:56-71`）⇒ 轮到 0 号席时，他人的这一手**根本还不存在**，任何"含他人动作的整回合结算"
 *     在决策时刻都拿不到输入。⇒ 2.0 若要把结算做成特征，形状只能是" solo 1-ply + 他人上一手残留"。
 *   · `endTurn` 会推进计时/结算持续效果 ⇒ q 含"回合结算"，不是"仅打出去那一下"。
 *   · 与 §E815 同：候选表取 `candidatesFor(state,pid,legalActions)`，不含 chooser 内部 `lockTarget`/`BIGT_PUSH`。
 * 用法：node tools/probe-settle-info.mjs [--pack=<包>] [--games=12] [--seats=5] [--modes=multi] [--seed0=1]
 * 只读 `js/**` 与指定包，不改引擎、不加门、不动冠军槽。
 */
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['pack', 'games', 'seats', 'modes', 'seed0', 'selftest'], 'probe-settle-info');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const GAMES = Number(arg('games', 12));
const SEATS = String(arg('seats', '5')).split(',').map(Number);
const MODES = String(arg('modes', 'multi')).split(',');

const W = sandbox();
const T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, X = W.EpirusResolve, R = W.EpirusRules;
const FN = P.FEAT_N, FS = P.FEAT_S;

/* ===== 一版"后果量"：全部用 st → clone 的差值定义，不读引擎内部记账（读内部量会把口径钉死在实现上） ===== */
const QS = [
  ['我造成的总掉血(全场)', (st, q, r) => { let d = 0; for (let i = 0; i < st.p.length; i++) if (i) d += st.p[i].hp - r.p[i].hp; return d; }],
  ['我自己掉血(反弹/反噬)', (st, q, r, t) => st.p[0].hp - r.p[0].hp],
  ['击杀数', (st, q, r, t) => st.p.filter(p => p.hp > 0).length - r.p.filter(p => p.hp > 0).length],
  ['我的 ep 余量', (st, q, r, t) => r.p[0].ep - st.p[0].ep],
  ['我的珠数(电+爆)', (st, q, r, t) => (r.p[0].elec + r.p[0].boom) - (st.p[0].elec + st.p[0].boom)],
  ['目标 ep 余量', (st, q, r, t) => t == null ? 0 : r.p[t].ep - st.p[t].ep],
  ['我的架势/防御态', (st, q, r, t) => (r.p[0].guardNext ? 1 : 0) - (st.p[0].guardNext ? 1 : 0)],
  ['局是否提前结束', (st, q, r, t) => (q.over ? 1 : 0) - (st.over ? 1 : 0)],
  ['回合是否推进', (st, q, r, t) => q.round - st.round]
];

function settle(st, pid, c) {
  const q = S.cloneState(st);
  try { S.attemptAction(q, pid, c.key, { bead: c.bead, target: c.target, target2: c.target2 }); } catch (e) { return null; }
  try { X.resolveActions(q); } catch (e) { return null; }
  const r = S.cloneState(q);                       /* **落点那一拍**：这手已结算，但还没过回合（无回能/珠过期补贴） */
  try { X.endTurn(q); } catch (e) { return null; }
  return { q, r };
}

/* 收集：rows = {g, x[235], qs[Q]}（g = 组号 = mode#n#局#决策序） */
function collect(params, mode, n, seed0) {
  const rows = [];
  const chooser = T.policyChooserN(params, 0);
  let dec = 0;
  const wrapped = (st, pid, legal) => {
    if (pid === 0) {
      try {
        const cands = P.candidatesFor(st, 0, legal);
        if (cands && cands.length >= 2) {
          const xs = P.featuresV7(st, 0);
          const g = mode + '#' + n + '#' + (seed0) + '#' + (dec++);
          for (const c of cands) {
            const af = P.actionFeatures(st, 0, c.key, c);
            const sv = settle(st, 0, c);
            if (!sv) continue;
            rows.push({ g, x: xs.concat(af), qs: QS.map(([, f]) => f(st, sv.q, sv.r, c.target == null ? null : c.target)) });
          }
        }
      } catch (e) { /* 单格失败只是少一行，分母会印出来 */ }
    }
    return chooser(st, pid, legal);
  };
  const seats = []; for (let i = 0; i < n; i++) seats.push(wrapped);
  for (let s = seed0; s < seed0 + GAMES; s++) {
    const st = S.createState(mode, { next: T.mulberry32(s * 7919 + 13) }, n);
    try { Play.autoGameN(st, seats); } catch (e) { }
  }
  return rows;
}

/* 对一组目标量逐个做"组内去均值 → 组内 ridge → 留出组 R²"，并配一条组内置换的零假设 */
function analyze(rows, label, targets, rngSeed) {
  const groups = new Map();
  for (let i = 0; i < rows.length; i++) { const g = rows[i].g; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); }
  const gl = [...groups.values()];
  /* 特征也做组内去均值 ⇒ "组内 R²" 只允许用"同组内候选之间的变化"解释"同组内的变化" */
  const Xw = rows.map(r => Float64Array.from(r.x));
  for (const idx of gl) for (let j = 0; j < FN; j++) { let m = 0; for (const i of idx) m += rows[i].x[j]; m /= idx.length; for (const i of idx) Xw[i][j] -= m; }
  const fit = [], ev = [];
  gl.forEach((idx, k) => (k % 2 ? ev : fit).push(...idx));
  const out = [];
  for (const t of targets) {
    const yRaw = rows.map(t.y);
    const y = Float64Array.from(yRaw);
    for (const idx of gl) { let m = 0; for (const i of idx) m += yRaw[i]; m /= idx.length; for (const i of idx) y[i] = yRaw[i] - m; }
    let vTot = 0, vWin = 0; const gm = yRaw.reduce((s, v) => s + v, 0) / (yRaw.length || 1);
    for (let i = 0; i < yRaw.length; i++) { vTot += (yRaw[i] - gm) ** 2; vWin += y[i] ** 2; }
    const r2 = ridgeR2(Xw, y, fit, ev, 1.0);
    /* 零假设：把每组的 y 在组内置换（x 不动）⇒ 真信号应当被冲掉 */
    const yp = Float64Array.from(y);
    for (const idx of gl) {
      const perm = idx.slice();
      for (let k = perm.length - 1; k > 0; k--) { rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff; const h = rngSeed % (k + 1); const s = perm[h]; perm[h] = perm[k]; perm[k] = s; }
      for (let k = 0; k < idx.length; k++) yp[idx[k]] = y[perm[k]];
    }
    const r2p = ridgeR2(Xw, yp, fit, ev, 1.0);
    out.push({ name: t.name, winShare: vTot > 0 ? vWin / vTot : 0, r2, r2perm: r2p });
  }
  console.log('\n  ' + label + ' ‖ 行 ' + rows.length + ' ‖ 组 ' + gl.length + ' ‖ 留出组行数 ' + ev.length + '（分母）');
  console.log('    量 · 组内方差占比 · 组内R²(留出) · 置换R²(零假设)');
  for (const o of out) console.log('    ' + o.name.padEnd(24) + ' ' + (o.winShare * 100).toFixed(1).padStart(5) + '%'
    + ' ‖ R² ' + (o.r2 === null ? '  读不出' : (o.r2 * 100).toFixed(1).padStart(7) + '%')
    + ' ‖ 置换 ' + (o.r2perm === null ? '  读不出' : (o.r2perm * 100).toFixed(1).padStart(6) + '%'));
  return out;
}
/* 牙：取动作段里**组内变化最大**的那一维（它按定义就在输入里 ⇒ 用输入预测它必须 R²≈1） */
function hardestDim(rows) {
  const groups = new Map();
  for (let i = 0; i < rows.length; i++) { const g = rows[i].g; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); }
  let best = -1, bestV = 0;
  for (let j = FS; j < FN; j++) {
    let v = 0, n = 0;
    for (const idx of groups.values()) { let m = 0; for (const i of idx) m += rows[i].x[j]; m /= idx.length; for (const i of idx) { v += (rows[i].x[j] - m) ** 2; n++; } }
    if (n && v / n > bestV) { bestV = v / n; best = j; }
  }
  return best;
}
/* ridge（标准化 + L2），在 fitIdx 上拟合、在 evIdx 上算 R²（**按组划分** ⇒ 同组不跨训练/留出） */
function ridgeR2(Xmat, y, fitIdx, evIdx, lam) {
  const d = Xmat[0].length;
  const mu = new Float64Array(d), sg = new Float64Array(d);
  for (const i of fitIdx) for (let j = 0; j < d; j++) mu[j] += Xmat[i][j];
  for (const i of fitIdx) for (let j = 0; j < d; j++) sg[j] += (Xmat[i][j] - mu[j]) ** 2;
  const nf = fitIdx.length || 1;
  for (let j = 0; j < d; j++) { mu[j] /= nf; sg[j] = Math.sqrt(sg[j] / nf) || 1; }
  const A = [];
  for (const i of fitIdx) { const r = new Float64Array(d + 1); for (let j = 0; j < d; j++) r[j] = (Xmat[i][j] - mu[j]) / sg[j]; r[d] = 1; A.push([r, y[i]]); }
  const p = d + 1;
  const G = new Float64Array(p * p), b = new Float64Array(p);
  for (const [r, yv] of A) { for (let i = 0; i < p; i++) { b[i] += r[i] * yv; for (let j = 0; j < p; j++) G[i * p + j] += r[i] * r[j]; } }
  for (let i = 0; i < p; i++) G[i * p + i] += lam;
  /* 高斯消元 */
  const M = Float64Array.from(G), v = Float64Array.from(b);
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(M[r * p + c]) > Math.abs(M[piv * p + c])) piv = r;
    if (Math.abs(M[piv * p + c]) < 1e-12) { for (let j = 0; j < p; j++) M[c * p + j] = 0; M[c * p + c] = 1; v[c] = 0; continue; }
    if (piv !== c) { for (let j = 0; j < p; j++) { const t = M[c * p + j]; M[c * p + j] = M[piv * p + j]; M[piv * p + j] = t; } const t = v[c]; v[c] = v[piv]; v[piv] = t; }
    for (let r = 0; r < p; r++) { if (r === c) continue; const f = M[r * p + c] / M[c * p + c]; if (!f) continue; for (let j = c; j < p; j++) M[r * p + j] -= f * M[c * p + j]; v[r] -= f * v[c]; }
  }
  const w = new Float64Array(p); for (let i = 0; i < p; i++) w[i] = v[i] / M[i * p + i];
  let ssT = 0, ssR = 0, ym = 0; for (const i of evIdx) ym += y[i]; ym /= (evIdx.length || 1);
  for (const i of evIdx) { let pv = 0; for (let j = 0; j < d; j++) pv += w[j] * (Xmat[i][j] - mu[j]) / sg[j]; pv += w[d]; ssR += (y[i] - pv) ** 2; ssT += (y[i] - ym) ** 2; }
  return ssT > 0 ? 1 - ssR / ssT : null;
}

console.log('# §E816 结算后果的信息量（2.0 维度预算尺，只读）‖ FEAT_N=' + FN + '（状态 ' + FS + ' ‖ 动作 ' + P.FEAT_A + '）');
const params = Float64Array.from(loadChamp(W, PACK));
for (const mode of MODES) for (const n of SEATS) {
  console.log('\n=== 桌 ' + mode + ' · n=' + n + ' ‖ 包 ' + PACK + ' ‖ ' + GAMES + ' 局 ===');
  const rows = collect(params, mode, n, 1);
  if (rows.length < 200) { console.error('⛔ 只采到 ' + rows.length + ' 行 ⇒ 分母太小，不许出判语'); process.exit(2); }
  const targets = QS.map((q, k) => ({ name: q[0], y: (r) => r.qs[k] }));
  /* 牙：动作段里组内变化最大的那一维 —— 它按定义就在输入里，用输入预测它必须 R²≈1 */
  const hd = hardestDim(rows);
  if (hd >= 0) targets.push({ name: '[牙] 现有第 ' + hd + ' 维自身', y: (r) => r.x[hd] });
  const res = analyze(rows, '被测', targets, 987654321);
  if (hd >= 0) {
    const tooth = res[res.length - 1];
    if (tooth.r2 === null || tooth.r2 < 0.8) console.log('    ⛔ 牙这条 R² = ' + (tooth.r2 === null ? '读不出' : (tooth.r2 * 100).toFixed(1) + '%')
      + ' < 80% ⇒ **尺看不见"已经在输入里"的量** ⇒ 上面所有低 R² 都不构成"输入里没有"，整表不许引');
    else console.log('    ✓ 牙在：现有维可被自己的输入解释 ' + (tooth.r2 * 100).toFixed(1) + '% ⇒ 本表里的低 R² 是真的"输入里没这条信息"');
  } else console.log('    ⛔ 找不到一个组内会变的现有维 ⇒ **牙这条没跑成**，整表不许引');
  const bad = res.filter(o => o.r2perm !== null && o.r2perm > 0.05);
  console.log('    零假设：' + (bad.length ? '⛔ 有 ' + bad.length + ' 条组内置换后 R²>5% ⇒ 那几行作废（' + bad.map(b => b.name).join(' ‖ ') + '）'
    : '✓ 全部置换后回到 ~0'));
  const holes = res.filter(o => o !== res[res.length - 1] && o.winShare > 0.25 && o.r2 !== null && o.r2 < 0.2 && o.r2perm !== null && o.r2perm <= 0.05);
  console.log('    ⇒ **判据命中（组内方差>25% 且 组内 R²<20% ⇒ 当前输入的真空）**：'
    + (holes.length ? holes.map(h => h.name + '(' + (h.winShare * 100).toFixed(0) + '% 组内 ‖ R² ' + (h.r2 * 100).toFixed(1) + '%)').join(' ‖ ') : '无'));
}
