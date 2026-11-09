/* 考卷换席的配对重测（判 DS 那句"差距 0.183→0.139"是真是噪声）
 * 设计：同一批 5 枚臂 · 同一 seed 序列 · 唯一变量 = 考卷池版本（v1=换席前 28 席 ‖ v2=现在）
 *      ⇒ 逐臂差值是配对的（common random numbers），比"两批各跑一次"的方差小一个量级。
 *      跑两个 seed 是为了躲开 11-09 在册那条教训：单 seed 的方向不许当结论（"两 seed 零反号不算方向"）。
 * 口径：--dose=page（页面剂量 lv:regular 斜坡）· rounds=100/格 · 与 DS 的 §十三.17/18 表同参。
 * X̄₄P = 0.15·x2 + 0.25·x3 + 0.45·x5 + 0.15·x8（excess 上加权，exam-4n 头注 §10.1 的口径）。
 * 用法：node scratch/qoder-1109-exam-ab.mjs [rounds=100] [jobs=5]
 */
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../tools/audit-lib.mjs';

const ROUNDS = Number(process.argv[2] || 100);
const JOBS = Math.max(1, Number(process.argv[3] || 5));
const PACKS = ['G5J-50', 'G5C-100', 'G5I-50', 'G5F-100', 'WSEL9-200'];
const SEED_N = Math.max(2, Number(process.argv[4] || 2));
const SEEDS = Array.from({ length: SEED_N }, (_, i) => 77000 + i);
const POOLS = ['v1', 'v2'];
const W = { x2: .15, x3: .25, x5: .45, x8: .15 };

function one(pack, pool, seed) {
  return new Promise((res) => {
    execFile(process.execPath, ['tools/exam-4n.mjs', String(ROUNDS), String(seed), 'scratch/ds-1109/' + pack + '.js',
      '--dose=page', '--expool=' + pool], { cwd: ROOT, maxBuffer: 8 << 20 }, (err, so, se) => {
      const m = String(so).match(/\[冠军4N\] (.*)/);
      if (!m) return res({ pack, pool, seed, err: '没有 [冠军4N] 行 ' + String(se || err).slice(0, 90) });
      const kv = {};
      for (const tok of m[1].split(/\s+/)) { const p = tok.split('='); if (p.length === 2) kv[p[0]] = p[1]; }
      let X = 0; for (const k of Object.keys(W)) X += W[k] * Number(kv[k]);
      res({ pack, pool, seed, kv, X, sec: kv.sec, stamp: kv.pool });
    });
  });
}

const jobs = [];
for (const seed of SEEDS) for (const pool of POOLS) for (const pack of PACKS) jobs.push({ pack, pool, seed });
const out = [];
let qi = 0;
async function worker() {
  while (qi < jobs.length) { const j = jobs[qi++]; out.push(await one(j.pack, j.pool, j.seed)); }
}
await Promise.all(Array.from({ length: JOBS }, worker));

const bad = out.filter(r => r.err);
if (bad.length) { console.error('⛔ ' + bad.length + ' 条跑挂：' + bad.map(b => b.pack + '/' + b.pool + '/' + b.seed + ' ' + b.err).join(' ‖ ')); process.exit(2); }
const get = (p, pool, seed) => out.find(r => r.pack === p && r.pool === pool && r.seed === seed);
const st = new Set(out.map(r => r.stamp));
console.log('# 池版本戳（必须各一枚，且 v1≠v2）：' + [...st].sort().join(' ‖ '));
console.log('# rounds=' + ROUNDS + '/格 · dose=page:lv:regular · seeds=' + SEEDS.join(',') + ' · X̄₄P 权重 15/25/45/15\n');
console.log('包'.padEnd(13) + 'seed   v1 X̄₄P   v2 X̄₄P   配对Δ(v2−v1)   v1 h5    v2 h5');
const rowsT = [];
for (const seed of SEEDS) for (const p of PACKS) {
  const a = get(p, 'v1', seed), b = get(p, 'v2', seed);
  rowsT.push({ seed, p, v1: a.X, v2: b.X, d: b.X - a.X });
  console.log(p.padEnd(13) + String(seed).padStart(6) + '   ' + (100 * a.X).toFixed(1).padStart(6) + '   ' + (100 * b.X).toFixed(1).padStart(6) +
    '   ' + (100 * (b.X - a.X)).toFixed(1).padStart(7) + 'pt   ' + a.kv.h5.padStart(6) + '  ' + b.kv.h5.padStart(6));
}
console.log('\n=== 差距（同 seed 同池内的 max−min）===');
const gaps = [];
for (const seed of SEEDS) for (const pool of POOLS) {
  const xs = PACKS.map(p => get(p, pool, seed).X);
  const g = Math.max(...xs) - Math.min(...xs);
  gaps.push({ seed, pool, g });
  console.log('  seed ' + seed + ' ' + pool + ' ⇒ 差距 ' + (100 * g).toFixed(1) + 'pt（最高 ' + PACKS[xs.indexOf(Math.max(...xs))] + ' ‖ 最低 ' + PACKS[xs.indexOf(Math.min(...xs))] + '）');
}
for (const seed of SEEDS) {
  const a = gaps.find(x => x.seed === seed && x.pool === 'v1').g, b = gaps.find(x => x.seed === seed && x.pool === 'v2').g;
  console.log('  ⇒ seed ' + seed + '：v1 ' + (100 * a).toFixed(1) + 'pt → v2 ' + (100 * b).toFixed(1) + 'pt ‖ 差距变化 ' + (100 * (b - a)).toFixed(1) + 'pt');
}
const dm = gaps.filter(g => g.pool === 'v2').map(g => g.g), g1 = gaps.filter(g => g.pool === 'v1').map(g => g.g);
console.log('  ' + SEED_N + ' 个 seed 的 v2−v1 差距变化：' + dm.map((x, i) => (100 * (x - g1[i])).toFixed(1) + 'pt').join(' ‖ ') +
  ' ⇒ 同向？' + (dm.every((x, i) => (x - g1[i]) < 0) ? '两 seed 都压缩' : (dm.some((x, i) => (x - g1[i]) < 0) ? '**两 seed 不一致 ⇒ 读不出压缩**' : '两 seed 都没压缩')));
console.log('\n=== 逐臂配对差（判"墙掉得最多"是否稳）===');
for (const p of PACKS) {
  const d = SEEDS.map(s => rowsT.find(r => r.p === p && r.seed === s).d);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  console.log('  ' + p.padEnd(13) + d.map(x => (100 * x).toFixed(1).padStart(6) + 'pt').join(' ') +
    ' ‖ 均值 ' + (100 * mean).toFixed(1) + 'pt ‖ 同号？' + (d.every(x => x < 0) ? SEED_N + '/' + SEED_N + ' 全负' : (d.filter(x => x < 0).length + '/' + SEED_N + ' 负')));
}
writeFileSync(join(ROOT, 'scratch/qoder-1109-exam-ab.tsv'),
  ['pack', 'seed', 'pool', 'X4P', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'stamp', 'sec'].join('\t') + '\n' +
  out.map(r => [r.pack, r.seed, r.pool, (100 * r.X).toFixed(2), r.kv.h2, r.kv.h3, r.kv.h5, r.kv.h8, r.kv.x2, r.kv.x3, r.kv.x5, r.kv.x8, r.stamp, r.sec].join('\t')).join('\n') + '\n');
console.log('\n# 表 → scratch/qoder-1109-exam-ab.tsv');
