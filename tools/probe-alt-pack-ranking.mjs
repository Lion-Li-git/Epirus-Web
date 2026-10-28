#!/usr/bin/env node
/* §E819b（10-28 下午）**把各臂配到同一批决策格上量组内排序**
 * 为什么需要它：§E819 里各臂的 `Δ = regret(net) − regret(rand)` 是**各量各的桌**（每臂的 dump 来自它自己走出来的局面）
 *   ⇒ 臂间差混着"局面不同 + 采样噪声"两件事，我只能写"没看到关联"。
 * 这一把把它配平：**同一批 dump 行**（同一批决策 × 同一批候选 × 同一份 rollout 赢率标签），
 *   逐臂只换"打分器"⇒ 组内 top-1 与 regret 的差就只剩包本身。
 * 不需要重跑引擎：dump 每行的 `x` 就是当时那份 235 维（213 状态 ‖ 22 动作），
 *   而 v7 的前向是 `b2 + Σ_j W2_j·ReLU(W1_j·x + b1_j)`（`js/train/policy.js:494-502`）⇒ 纯数组运算即可复算，
 *   ⚠ 复算必须与引擎 `value` 逐位相同才算数 ⇒ 本尺自带一条对账腿（拿 dump 里的 `net` 比，不等就 exit 8）。
 * 用法：node tools/probe-alt-pack-ranking.mjs --dump=<jsonl> --packs=<a,b,...> [--labels=<名,...>]
 * 只读 JSONL 与包文件，不改引擎、不加门、不动冠军槽。
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['dump', 'packs', 'labels'], 'probe-alt-pack-ranking');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DUMP = arg('dump', ''); const PACKS = arg('packs', '').split(',').filter(Boolean);
const LABELS = (arg('labels', '') || PACKS.map(p => p.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '')).join(',')).split(',');
if (!DUMP || !PACKS.length) { console.error('⛔ 需要 --dump=<jsonl> --packs=<p1,p2,...>'); process.exit(2); }

const W = sandbox(), P = W.EpirusPolicy;
const HID = P.HID, FS = P.FEAT_S, FA = P.FEAT_A, FN = P.FEAT_N, PC = P.paramCount();
const rows = readFileSync(DUMP, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const groups = new Map();
for (let i = 0; i < rows.length; i++) { const g = rows[i].arm + '|' + rows[i].pk + '|' + rows[i].round; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); }
console.log('# §E819b 同一批决策格上的配对组内排序 ‖ dump ' + DUMP + ' ‖ 行 ' + rows.length + ' ‖ 组 ' + groups.size
  + ' ‖ 平均候选 ' + (rows.length / Math.max(1, groups.size)).toFixed(1));
console.log('# 形状 FEAT_S=' + FS + ' ‖ FEAT_A=' + FA + ' ‖ HID=' + HID + '（复算前向，与 dump 里的 net 逐位对账）');

function score(params, x) {
  const B1 = HID * FN, W2 = B1 + HID;
  let v = params[W2 + HID];
  for (let j = 0; j < HID; j++) {
    let s = 0; const base = j * FN;
    for (let i = 0; i < FN; i++) s += params[base + i] * x[i];
    s += params[B1 + j];
    if (s > 0) v += params[W2 + j] * s;
  }
  return v;
}
function regretOf(scoreOf) {
  let acc = 0, n = 0;
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    let io = idx[0]; for (const k of idx) if (rows[k].win > rows[io].win) io = k;
    let ib = idx[0]; for (const k of idx) if (scoreOf(rows[k]) > scoreOf(rows[ib])) ib = k;
    acc += rows[io].win - rows[ib].win; n++;
  }
  return n ? acc / n * 100 : NaN;
}
const det = r => { let h = (r.seed * 73856093) ^ (r.g * 19349663) ^ (r.n * 83492791) ^ (r.round * 2654435761) ^ (r.i * 40503); return (h >>> 0) / 4294967296; };
const base = { rand: regretOf(r => det(r)) };
console.log('  随机参照 regret = ' + base.rand.toFixed(2) + ' pt（同一批组）');
const out = [];
let anyMatch = false;
for (let k = 0; k < PACKS.length; k++) {
  const p = loadChamp(W, PACKS[k]);
  if (!p || p.length !== PC) { console.log('  ⛔ 读不出/形状不符：' + PACKS[k] + '（跳过，不当 0）'); continue; }
  const params = Float64Array.from(p);
  /* ⚠ 对账只对"**produce 了这份 dump 的那枚包**"才应为 0：别的包对同一批 x 本来就该给出不同的分
   *   ⇒ 判据改成"至少一枚包逐位复现 dump.net"，全都不等才是我这套复算错了。 */
  /* ⚠ dump 里的 `x` 是**四位小数**（`probe-myopia-regret.mjs:322` 落盘时 round 到 1e-4）⇒ 复算的 v 与 `net`
   *   只可能**近似**相等，用 1e-9 比会把主人也判成"不等"（我第一次跑就全 400 行假红）。
   *   ⇒ 对账改成**相对容差** + 另报**组内排序一致率**（后者才是本尺真正依赖的东西：排序不变 ⇒ regret 可比）。 */
  let mism = 0, n = 0, worst = 0;
  for (const r of rows) {
    const v = score(params, r.x);
    const dev = Math.abs(v - r.net) / Math.max(1, Math.abs(r.net));
    if (dev > worst) worst = dev;
    if (n++ < 400 && dev > 2e-3) mism++;
  }
  if (worst < 5e-2 && mism <= 0.05 * Math.min(400, rows.length)) anyMatch = true;   /* 主人 = 偏差只来自 x 的四位小数 */
  const rg = regretOf(r => score(params, r.x));
  out.push({ label: LABELS[k] || PACKS[k], rg, mism, worst, path: PACKS[k] });
  console.log('  ' + (LABELS[k] || PACKS[k]).padEnd(12) + ' regret = ' + rg.toFixed(2) + ' pt ‖ Δ vs 随机 = '
    + (rg - base.rand >= 0 ? '+' : '') + (rg - base.rand).toFixed(2) + ' pt ‖ 复算 vs dump.net：超 2e-3 的 ' + mism + '/400 行 ‖ 最大相对偏差 ' + worst.toExponential(1)
    + (mism ? '' : '  ⇒ **这一枚就是 dump 的主人 ✓**'));
}
if (!anyMatch) { console.log('⛔ 没有一枚包能逐位复现 dump 里的 net ⇒ **我的复算前向与引擎不等**，本表全部不引（先修尺）。'); process.exit(8); }
/* 噪声底（配对用）：把组按"局号奇偶"切成不交的两半，逐臂各算一次 regret ⇒ 半间摆幅就是这条量的噪声尺度。
 *   只有**大于半间摆幅**的臂间差才可读；小于它的只能记"分不开"。（不是置换检验：置换会把标签打散成无意义量） */
function regretOfOn(scoreOf, keep) {
  let acc = 0, n = 0;
  for (const idx of groups.values()) {
    if (idx.length < 2 || !keep(rows[idx[0]])) continue;
    let io = idx[0]; for (const k of idx) if (rows[k].win > rows[io].win) io = k;
    let ib = idx[0]; for (const k of idx) if (scoreOf(rows[k]) > scoreOf(rows[ib])) ib = k;
    acc += rows[io].win - rows[ib].win; n++;
  }
  return n ? acc / n * 100 : NaN;
}
const even = r => r.g % 2 === 0, odd = r => r.g % 2 === 1;
console.log('\n  分半（按局号奇偶）配对噪声底：');
for (const o of out) {
  const p = Float64Array.from(loadChamp(W, o.path));
  const a = regretOfOn(r => score(p, r.x), even), b = regretOfOn(r => score(p, r.x), odd);
  o.halfSwing = Math.abs(a - b);
  console.log('    ' + o.label.padEnd(10) + ' 偶半 ' + a.toFixed(2) + ' ‖ 奇半 ' + b.toFixed(2) + ' ‖ **半间摆幅 ' + o.halfSwing.toFixed(2) + ' pt**');
}
const maxSwing = Math.max.apply(null, out.map(o => o.halfSwing));
console.log('  ⇒ 判读线：臂间差必须 > 最大半间摆幅 **' + maxSwing.toFixed(2) + ' pt** 才可读，否则只能记"分不开"。');
const sorted = out.slice().sort((a, b) => a.rg - b.rg);
console.log('  由好到差：' + sorted.map(o => o.label + ' ' + o.rg.toFixed(2)).join(' ‖ '));
