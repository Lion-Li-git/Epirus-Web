/* §E576 判读相：哪一维真的对"人席"付账（预登记，跑前写死在这里）
 *
 * 背景（为什么这一步现在该做）：§E575 已经证明**换当选键救不了分辨率** —— 在"20 局 × 36 对"这套样本量下，
 *   名次族与行为族都分不开臂内 6 带。所以下一刀是**换候选集合的形状**（跨臂按行为格筛 3~5 枚，再上贵尺）。
 *   而"按哪几格筛"目前没有任何有数的依据：`charges` 当键两遍判死（p=0.32/0.2531），
 *   考卷 ↔ 出厂闸 ρ=0.217、↔ 广度 ρ=0.014，分数尺 ↔ 人席 ρ≈0（§E506）。
 *
 * 目标量（都是"越低越好"，因为印的是**人类那一席的夺冠率**）：
 *   `multi六格均值`、`long六格均值`、`最大格`
 * 自变量：coords 的 10 个行为维（dmg, heavy, holo, rounds, distinctKeys, charges, waste, noThreatStance, Geff, seatSpread）
 *   ＋ 3 个分数维（H, Hp, De）—— 分数维**只作对照**（已知与人席无关，用来验仪器没接错）。
 *
 * 判据（跑前写死，不许事后改口径）：
 *   (a) **现役锚点**：`SHIPPED-Ldemo` 这一批的 multi/long 六格均值与最大格必须与 §E506 记录的基线
 *       （multi 5.3 ‖ long 12.3 ‖ 最大格 28% = 只枪压制）对上（均值 ±1.5pt、最大格同一格）。
 *       对不上 ⇒ 这台量具换了口径，整表作废（§E312 那条：复刻仪器要搬代码，锚点要搬读数）。
 *   (b) **噪声地板由实测给**：同一枚包在两粒 seed（90210 / 90211）上的六格均值之差 ⇒ 取这批的中位与 p90。
 *       任何"某维与人席相关"的结论，其**效应量必须大于这条地板**才许写。
 *   (c) 一条维**入围**⟺ `|ρ| ≥ 0.5` 且 Holm 校正后 `p ≤ 0.05` 且 **multi 与 long 两口径同号**。
 *       三条缺一就不列进清单。方向也要写：ρ 为负 = 该维越高，人类那一席赢得越少 = 这枚包越"不怕人"。
 *   (d) **分辨率印在数旁边**：n 由实到样本给，双侧 5% 的 `|ρ|` 临界用同一套蒙特卡洛置换算出来（不拍脑袋）。
 *       n=25 时这个临界大约在 0.4 ⇒ `|ρ| ∈ [0.4, 0.5]` 那一档只能写"有感、未入围"。
 *   (e) **三条正对照**（造不出能红的判据就别写它）：
 *       ① 随机自变量列（固定种子打乱）⇒ Holm 后必须**全部不显著**；出了显著就是判据有洞。
 *       ② 分数维 Hp ⇒ 应当 ≈0（复现 §E506 的 −0.030/+0.041）。这次若 `|ρ| ≥ 0.5` 说明我把两把尺接串了。
 *       ③ 把目标量按已知答案倒造（令 target = 该自变量本身）⇒ ρ 必须 = ±1.000 且 p = 最小值。
 *   (f) **名单数 vs 落盘数**：roster 的枚数 × 2 口径必须等于 tsv 行数；两批 seed 的名单必须逐枚相同。
 *
 * ⚠ 诚实声明：判据落笔时，第一批两枚（Ldemo / K2）的 stdout 已经在屏幕上出现过 ——
 *   其中 Ldemo 的 long 最大格 28% 正是 (a) 要验的那个历史基线，**这是设计好的锚点复现，不是挑出来的读数**。
 *   其余 23 枚在判据写完之前没有读过任何一格。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const rd = p => { const L = readFileSync(p.indexOf(':') >= 0 || p[0] === '/' ? p : join(HERE, p), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/);
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map(l => l.split('\t')) }; };

const BEH = ['dmg', 'heavy', 'holo', 'rounds', 'distinctKeys', 'charges', 'waste', 'noThreatStance', 'Geff', 'seatSpread'];
const SCR = ['H', 'Hp', 'De'];
const TARGETS = ['multi六格均值', 'long六格均值', '最大格'];
const BASE_LDEMO = { multi: 5.3, long: 12.3, 最大格: 28, 格: '只枪压制' };   // §E506 那次同 seed 90210 的基线

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function ranks(x) { const idx = x.map((v, i) => i).sort((a, b) => x[a] - x[b]); const r = new Array(x.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && x[idx[j + 1]] === x[idx[i]]) j++;
    const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = avg; i = j + 1; } return r; }
function pear(a, b) { const ma = mean(a), mb = mean(b); let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return (da === 0 || db === 0) ? NaN : n / Math.sqrt(da * db); }
const sp = (x, y) => pear(ranks(x), ranks(y));
/* 蒙特卡洛置换 p（n=25 ⇒ 25! 不可枚举）。⚠ 尾数方向必须对（§E572 那次把累积分布当 p 印，结论直接反）：
 *   这里数的是 `|ρ_perm| ≥ |ρ_obs|`，并且带一条自查：完美同序的 p 必须 = 1/B 那种最小值。 */
function mcP(x, y, B, rng) { const obs = Math.abs(sp(x, y)); const ry = ranks(y); let hit = 0;
  for (let b = 0; b < B; b++) { const p = ry.slice(); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    if (Math.abs(pear(ranks(x), p)) >= obs - 1e-12) hit++; }
  return (hit + 1) / (B + 1); }
function holm(ps) { const idx = ps.map((v, i) => i).sort((a, b) => ps[a] - ps[b]); const m = ps.length; const adj = new Array(m);
  let run = 0; for (let k = 0; k < idx.length; k++) { const v = Math.max(run, (m - k) * ps[idx[k]]); run = v; adj[idx[k]] = Math.min(1, v); } return adj; }

const A = rd(arg('a', 'seat-2026-10-11-90210.tsv'));
const Bt = rd(arg('b', 'seat-2026-10-11-90211.tsv'));
const C = rd('coords.tsv');
const B_ = Number(arg('B', 20000));
const rng0 = () => { let s = 20261011 >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/* ---- (f) 名单与行数 ---- */
const idsOf = t => [...new Set(t.rows.map(r => r[t.h.id]))];
const ia = idsOf(A), ib = idsOf(Bt);
const 名单差 = ia.filter(x => ib.indexOf(x) < 0).concat(ib.filter(x => ia.indexOf(x) < 0));
console.log('# (f) 名单：A 批 ' + ia.length + ' 枚 ‖ B 批 ' + ib.length + ' 枚 ‖ 逐枚相同=' + (名单差.length === 0 && ia.length === ib.length) +
  (名单差.length ? ' ‖ 差集 ' + 名单差.join(',') : '') + ' ‖ 行数 A=' + A.rows.length + '（应 ' + ia.length * 2 + '）‖ B=' + Bt.rows.length);
if (名单差.length || A.rows.length !== ia.length * 2) { console.error('⛔ (f) 红 ⇒ 别判读'); process.exit(2); }

/* ---- 两批合并成一枚一行的人席读数 ---- */
const cellOf = (t, id, mode, col) => { const r = t.rows.filter(x => x[t.h.id] === id && x[t.h.mode] === mode)[0]; return r ? r[t.h[col]] : undefined; };
const P = [];
for (const id of ia) {
  const crow = C.rows.filter(r => r[C.h.id] === id)[0];
  if (!crow) { console.log('  ⚠ ' + id + ' 不在 coords ⇒ 无人席以外的维度读数，只进锚点/噪声，不进关联'); continue; }
  const g = k => Number(crow[C.h[k]]);
  const rec = { id: id, 行为: {}, 分数: {} };
  for (const k of BEH) rec.行为[k] = g(k);
  for (const k of SCR) rec.分数[k] = g(k);
  /* 三个目标量各自的 A 批（seed 90210）与 B 批（90211）读数；`最大格` 取 multi 口径（注册否决线看的就是 multi） */
  rec.multi_a = Number(cellOf(A, id, 'multi', 'multi六格均值')); rec.multi_b = Number(cellOf(Bt, id, 'multi', 'multi六格均值'));
  rec.long_a = Number(cellOf(A, id, 'long', 'long六格均值')); rec.long_b = Number(cellOf(Bt, id, 'long', 'long六格均值'));
  rec.最大格_a = Number(cellOf(A, id, 'multi', '最大格')); rec.最大格_b = Number(cellOf(Bt, id, 'multi', '最大格'));
  rec.最大格long_a = Number(cellOf(A, id, 'long', '最大格'));
  rec.锚_multimax = cellOf(A, id, 'multi', '最大格是谁'); rec.锚_longmax = cellOf(A, id, 'long', '最大格是谁');
  P.push(rec);
}

/* ---- (a) 现役锚点 ---- */
const L = P.filter(p => p.id === 'SHIPPED-Ldemo')[0] || P.filter(p => /bundled|Ldemo/.test(p.id))[0];
if (!L) { console.error('⛔ (a) 红：这一批里没有现役 ⇒ 没锚点，判读作废'); process.exit(2); }
/* §E506 那行基线说的是"最大格 28%（只枪压制 · long）"⇒ 锚点比的是 **long 口径的最大格**，不是 multi */
const 锚ok = Math.abs(L.multi_a - BASE_LDEMO.multi) <= 1.5 && Math.abs(L.long_a - BASE_LDEMO.long) <= 1.5 &&
  Math.abs(L.最大格long_a - BASE_LDEMO.最大格) <= 6 && L.锚_longmax === BASE_LDEMO.格;
console.log('# (a) 现役锚点：multi ' + L.multi_a + '（基线 ' + BASE_LDEMO.multi + '）‖ long ' + L.long_a + '（基线 ' + BASE_LDEMO.long +
  '）‖ long 最大格 ' + L.最大格long_a + ' 落在「' + L.锚_longmax + '」（基线 ' + BASE_LDEMO.最大格 + ' · ' + BASE_LDEMO.格 + '）‖ multi 最大格 ' + L.最大格_a + '（' + L.锚_multimax + '）⇒ ' +
  (锚ok ? '✅ 同一台仪器' : '⛔ 对不上 ⇒ 整表作废'));
if (!锚ok) process.exit(2);

/* ---- (b) 噪声地板 ---- */
const noiseFor = key => P.map(p => Math.abs(p[key + '_a'] - p[key + '_b'])).filter(v => isFinite(v)).sort((x, y) => x - y);
const NB = {}; for (const k of ['multi', 'long']) { const v = noiseFor(k); NB[k] = { p50: v[v.length >> 1], p90: v[Math.min(v.length - 1, Math.floor(0.9 * v.length))], n: v.length }; }
const rep = P.map(p => sp([p.multi_a, p.long_a], [p.multi_b, p.long_b]));
console.log('# (b) 两批同枚之差（100格/格的均值口径）：multi p50=' + NB.multi.p50 + ' p90=' + NB.multi.p90 +
  ' ‖ long p50=' + NB.long.p50 + ' p90=' + NB.long.p90 + ' ‖ n=' + NB.multi.n);
console.log('# (b) 附：两批之间的秩相关（仪器自己的复现性）中位 = ' + (rep.filter(v => isFinite(v)).sort((a, b) => a - b)[rep.length >> 1]).toFixed(3));

/* ---- (d) 分辨率 ---- */
const nS = P.length; const rr = []; const rngD = rng0();
for (let b = 0; b < 4000; b++) rr.push(Math.abs(sp([...Array(nS)].map(() => rngD()), [...Array(nS)].map(() => rngD()))));
rr.sort((a, b) => a - b);
console.log('# (d) n=' + nS + ' ‖ 双侧 5% 的 |ρ| 临界（蒙特卡洛 B=4000）≈ ' + rr[Math.floor(0.95 * rr.length)].toFixed(3) +
  ' ‖ 判据 (c) 的门槛是 0.5（写在跑前）');

/* ---- (c) 主筛查 ---- */
const DIMS = BEH.map(k => ['行为:' + k, k, 0]).concat(SCR.map(k => ['分数:' + k, k, 1]));
const tests = [];
for (const [label, k, isScore] of DIMS) {
  for (const t of [['multi', 'multi_a'], ['long', 'long_a']]) {
    const xs = [], ys = [];
    for (const p of P) { const x = (isScore ? p.分数[k] : p.行为[k]), y = p[t[1]]; if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); } }
    if (xs.length < 8) continue;
    tests.push({ 维: label, 口径: t[0], n: xs.length, rho: sp(xs, ys), p: mcP(xs, ys, B_, rng0()) });
  }
}
/* 同号判定：同一维两口径都要过 (c) 的三条 */
const adjAll = holm(tests.map(x => x.p));
for (let i = 0; i < tests.length; i++) tests[i].holm = adjAll[i];
const byDim = {};
for (const t of tests) (byDim[t.维] = byDim[t.维] || []).push(t);
console.log('\n===== §E576 哪一维对人席付账（目标 = 人类那一席的夺冠率，越低越好）=====');
console.log('维 | n | ρ(multi) p_holm | ρ(long) p_holm | 两口径同号 | 判');
const 清单 = [];
for (const dim in byDim) {
  const a = byDim[dim].filter(t => t.口径 === 'multi')[0], b = byDim[dim].filter(t => t.口径 === 'long')[0];
  if (!a || !b) continue;
  const same = isFinite(a.rho) && isFinite(b.rho) && Math.sign(a.rho) === Math.sign(b.rho);
  const pass = same && [a, b].every(t => Math.abs(t.rho) >= 0.5 && t.holm <= 0.05);
  const mid = Math.max(Math.abs(a.rho), Math.abs(b.rho)) >= 0.4;
  if (/^分数:/.test(dim)) console.log(dim + ' | ' + a.n + ' | ' + a.rho.toFixed(3) + ' p=' + a.holm.toFixed(3) + ' | ' + b.rho.toFixed(3) +
    ' p=' + b.holm.toFixed(3) + ' | ' + (same ? '同' : '异') + ' | 对照（(e)② 要求 ≈0，实测 |ρ|max=' + Math.max(Math.abs(a.rho), Math.abs(b.rho)).toFixed(3) +
    (Math.max(Math.abs(a.rho), Math.abs(b.rho)) >= 0.5 ? ' ⇒ ⛔ 接线可疑' : ' ⇒ ✅') + '）');
  else console.log(dim + ' | ' + a.n + ' | ' + a.rho.toFixed(3) + ' p=' + a.holm.toFixed(3) + ' | ' + b.rho.toFixed(3) + ' p=' + b.holm.toFixed(3) +
    ' | ' + (same ? '同' : '异') + ' | ' + (pass ? '入围' : mid ? '有感、未入围' : '不列'));
  if (pass) 清单.push(dim);
}
console.log('\n入围清单（判据 c 三条全过）：' + (清单.length ? 清单.join(' ‖ ') : '（空）'));

/* ---- (e) 三条正对照 ---- */
const rngC = rng0();
let 随机显著 = 0, 随机表 = [];
for (const t of ['multi_a', 'long_a']) {
  const xs = P.map(() => rngC()), ys = P.map(p => p[t]);
  const rho = sp(xs, ys), p = mcP(xs, ys, B_, rngC); 随机表.push(rho.toFixed(3) + '/p=' + p.toFixed(3));
  if (p <= 0.05) 随机显著++;
}
const idl = P.map(p => p.行为.dmg), per = sp(idl, P.map(p => p.行为.dmg));
/* 置换 p 函数自己的已知答案（§E572 那次"尾数写成累积分布"的教训的延续）：完美同序的 p 必须是尾数最小值。 */
const pPer = mcP(idl, P.map(p => p.行为.dmg), 2000, rng0());
console.log('# (e) ① 随机自变量列 ⇒ ' + 随机表.join(' ‖ ') + '（期望 ' + (2 * 0.05).toFixed(2) + ' 个显著/2 检验，实测 ' + 随机显著 + '）' +
  (随机显著 > 1 ? ' ⛔ 判据有洞' : ' ✅'));
console.log('# (e) ③ 自造完美（dmg 对 dmg）⇒ ρ 必须 = 1.000（实测 ' + per.toFixed(3) + '）‖ 同一列的置换 p 必须是尾数最小值（实测 ' +
  pPer.toFixed(5) + '，B=2000 ⇒ 期望 ≈0.0005）⇒ ' + (per === 1 && pPer <= 0.001 ? '✅' : '⛔ p 的尾数方向可疑，判读作废'));
process.exit(0);
