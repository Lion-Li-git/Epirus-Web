#!/usr/bin/env node
/* 四人数考卷池的**确定性均衡排程**（v2.0.3 · 2026-11-07 · 用户提案）
 *
 * 要解决的问题（用户原话）：「抽取对手时优先抽没测过的对手，跑一定数目时保证每个对手都测过，
 *   且局面比较多样、平均成绩稳定」。
 *
 * 为什么**不做**自适应抽样：边跑边按计数挑 ⇒ 同一个包两次会跑出不同的组合 ⇒ 违反本仓
 *   「读数逐位可复现」的硬规矩（同一 seed 必须逐位相同）。这里用等价的**确定性**做法：
 *   ① 把池按固定 seed 洗一次牌；② 每局取连续 (N−1) 个席位，指针循环推进。
 *   ⇒ 每个对手出现次数最多差 1（这就是「覆盖优先」的可复现实现），组合也随洗牌分散。
 *
 * 为什么池是 28：`N−1` 对 N=2/3/5/8 分别是 1/2/4/7 ⇒ K 必须是 28 的倍数，
 *   这样「一整轮 = 每个对手恰好一次」：28 / 14 / 7 / 4 局。
 *   每格局数 `G_N = ceil(R·K/(N−1))`（R = 轮数）。
 *
 * 用法：
 *   node tools/exam-pool.mjs --check                 # 打印 4 个 N 的局数/覆盖分布（不跑对局）
 *   node tools/exam-pool.mjs --check --rounds=10 --json
 *   代码里：`planN(n, rounds, seed)` → [{seats:[名字,…]}, …]；`seatsFor(n)` → 该人数的合法席。
 */
import { EXAM_POOL } from '../server/opp-pool.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';

/* 池里该人数可用的席（minN 过滤；2 人局拿掉镜面/双枪这类要 ≥3 人的线）。 */
export function seatsFor(n) {
  return EXAM_POOL.filter(function (e) { return e.minN <= n; }).map(function (e) { return e.name; });
}

export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/* 一个 N 的排程：返回 G_N 局，每局 (N−1) 个**互不相同**的对手名。 */
export function planN(n, rounds, seed) {
  if (!(Number.isInteger(n) && n >= 2 && n <= 8)) throw new Error('planN: n 必须是 2..8（收到 ' + n + '）');
  const R = Number(rounds);
  if (!(Number.isInteger(R) && R >= 1)) throw new Error('planN: rounds 必须是正整数（收到 ' + rounds + '）');
  const seats = seatsFor(n);
  const per = n - 1;
  if (seats.length < per) throw new Error('planN: N=' + n + ' 需要 ' + per + ' 个不同对手，池里只有 ' + seats.length);
  const K = seats.length;
  const order = shuffled(seats, mulberry32((seed >>> 0) ^ Math.imul(n, 7919) ^ 0x5bd1e995));
  const games = Math.ceil(R * K / per);
  const out = [];
  let p = 0;
  for (let g = 0; g < games; g++) {
    const draw = [];
    for (let j = 0; j < per; j++) { draw.push(order[p % K]); p++; }
    out.push({ n: n, seats: draw });
  }
  return out;
}

/* 覆盖统计（每个名字出现几次）—— 自检用：max−min 必须 ≤ 1。 */
export function coverageOf(plan) {
  const cnt = {};
  for (const g of plan) for (const s of g.seats) cnt[s] = (cnt[s] || 0) + 1;
  const vals = Object.values(cnt);
  return { counts: cnt, min: Math.min.apply(null, vals), max: Math.max.apply(null, vals), names: Object.keys(cnt).length };
}

/* ---------- CLI ---------- */
if (process.argv[1] && /exam-pool\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) {
  /* 仓规：不认识的 `--` 参数必须响亮失败（静默忽略 = 假读数）。 */
  rejectUnknownFlags(process.argv.slice(2), ['n', 'rounds', 'seed', 'json', 'check'], 'exam-pool');
  const arg = function (k, d) { const a = process.argv.find(function (x) { return x.indexOf('--' + k + '=') === 0; }); return a ? a.split('=')[1] : d; };
  const rounds = Number(arg('rounds', 6));
  const seed = Number(arg('seed', 77000));
  const json = process.argv.includes('--json');
  const NS = [2, 3, 5, 8];
  const rows = NS.map(function (n) {
    const plan = planN(n, rounds, seed);
    const cov = coverageOf(plan);
    return { n: n, seats: seatsFor(n).length, games: plan.length, perGame: n - 1, min: cov.min, max: cov.max };
  });
  if (json) { console.log(JSON.stringify({ rounds: rounds, seed: seed, rows: rows }, null, 2)); process.exit(0); }
  console.log('四人数考卷排程（R=' + rounds + ' 轮 · seed=' + seed + ' · 池 ' + EXAM_POOL.length + ' 席）');
  console.log('  N   可用席  每局对手   局数   每席最少   最多');
  for (const r of rows) {
    console.log('  ' + String(r.n).padEnd(3) + String(r.seats).padStart(6) + String(r.perGame).padStart(9)
      + String(r.games).padStart(7) + String(r.min).padStart(10) + String(r.max).padStart(7));
  }
  const bad = rows.filter(function (r) { return r.max - r.min > 1; });
  console.log(bad.length ? '⛔ 覆盖不均（max−min > 1）：' + bad.map(function (r) { return 'N=' + r.n; }).join(',')
    : '✔ 覆盖均衡：每个 N 的每席出现次数最多差 1（这是「先测没测过的」的可复现等价物）');
  const MS = { 2: 0.47, 3: 0.66, 5: 0.87, 8: 1.47 };   // 本机实测（11-07）
  const totalMs = rows.reduce(function (a, r) { return a + r.games * MS[r.n]; }, 0);
  console.log('⏱ 成本（实测 0.47/0.66/0.87/1.47 ms/局）：合计 ' + rows.reduce(function (a, r) { return a + r.games; }, 0)
    + ' 局 ≈ ' + totalMs.toFixed(0) + ' ms / 包（全库 718 枚 ≈ ' + (totalMs * 718 / 60000).toFixed(1) + ' 分钟，单线程）');
  /* 自检三条：① 同一 seed 逐位相同 ② 每局对手互不相同 ③ N=2 不含多人专用席 */
  const a1 = JSON.stringify(planN(5, rounds, seed)), a2 = JSON.stringify(planN(5, rounds, seed));
  const dup = planN(5, rounds, seed).some(function (g) { return new Set(g.seats).size !== g.seats.length; });
  const m2 = planN(2, rounds, seed).some(function (g) { return g.seats.indexOf('mirrorspam') >= 0 || g.seats.indexOf('dualspam') >= 0; });
  console.log((a1 === a2 ? '✔ 同一 seed 逐位相同' : '⛔ 同一 seed 两次不同（可复现性坏了）')
    + ' ‖ ' + (dup ? '⛔ 同一局里出现重复对手' : '✔ 每局对手互不相同')
    + ' ‖ ' + (m2 ? '⛔ N=2 里出现了多人专用席' : '✔ N=2 不含镜面/双枪'));
}