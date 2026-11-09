/* 从 scratch/qoder-1109-exam-ab.tsv（50 行 = 5 枚 × 2 池 × 5 seed）重算汇总。
 * 为什么要重算：跑单 qoder-1109-exam-ab.mjs 的打印段只取前两个 seed、且把"5 个 seed"写成了"两 seed"
 *   ⇒ 汇报文字与自己的数据不符。这里不改数据，只把该说的三件事说全：
 *   ① 逐臂配对差的符号一致性（5 个 seed 全量）
 *   ② 差距（max−min）的配对变化 + 它在同一池内的 seed 间摆动（= 这根尺子的分辨率地板）
 *   ③ v1 与 v2 的排序相关性（判"换席到底有没有换人"）
 */
import { readFileSync } from 'node:fs';
const rows = readFileSync('scratch/qoder-1109-exam-ab.tsv', 'utf8').replace(/\r/g, '').trim().split('\n');
const H = rows[0].split('\t');
const R = rows.slice(1).map(l => Object.fromEntries(l.split('\t').map((v, i) => [H[i], v])));
const PACKS = [...new Set(R.map(r => r.pack))];
const SEEDS = [...new Set(R.map(r => Number(r.seed)))].sort();
const POOLS = ['v1', 'v2'];
const g = (p, pool, seed) => R.find(r => r.pack === p && r.pool === pool && Number(r.seed) === seed);
/* ⚠ 表里的 X4P 列**已经是百分数**（跑单写盘时乘过 100）⇒ 这里只换算成 pt 差，别再乘一次。
 *   （第一版就是因为重复乘 100，把 -2.1pt 印成 -205pt。） */
const X = (p, pool, seed) => Number(g(p, pool, seed).X4P);
console.log('行数 ' + R.length + ' ‖ 池戳 ' + [...new Set(R.map(r => r.pool))].join(' ‖ ') + ' ‖ seeds ' + SEEDS.join(','));

console.log('\n=== ① 逐臂配对差 Δ = X̄₄P(v2) − X̄₄P(v1)，单位 pt，五个 seed 全量 ===');
for (const p of PACKS) {
  const d = SEEDS.map(s => X(p, 'v2', s) - X(p, 'v1', s));
  const m = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (d.length - 1));
  const same = d.every(x => x < 0) ? '5/5 全负' : (d.filter(x => x < 0).length + '/5 负');
  console.log('  ' + p.padEnd(12) + d.map(x => (x >= 0 ? '+' : '') + x.toFixed(1)).join(' ').padEnd(38) +
    ' 均值 ' + m.toFixed(1) + 'pt ‖ sd ' + sd.toFixed(1) + ' ‖ ' + same);
}

console.log('\n=== ② 差距（同 seed 同池内 max−min）===');
const gap = (pool, seed) => { const xs = PACKS.map(p => X(p, pool, seed)); return Math.max(...xs) - Math.min(...xs); };
const changes = [];
const gapSd = {};
for (const pool of POOLS) {
  const gs = SEEDS.map(s => gap(pool, s));
  const m = gs.reduce((a, b) => a + b, 0) / gs.length;
  const sd = Math.sqrt(gs.reduce((a, b) => a + (b - m) ** 2, 0) / (gs.length - 1));
  gapSd[pool] = sd;
  console.log('  ' + pool + '：差距 ' + gs.map(x => x.toFixed(1)).join(' ') + ' ‖ 均值 ' + m.toFixed(1) + 'pt ‖ **seed 间 sd ' + sd.toFixed(1) + 'pt**（这就是这根尺的地板）');
}
for (const s of SEEDS) changes.push(gap('v2', s) - gap('v1', s));
{
  const m = changes.reduce((a, b) => a + b, 0) / changes.length;
  const sd = Math.sqrt(changes.reduce((a, b) => a + (b - m) ** 2, 0) / (changes.length - 1));
  const se = sd / Math.sqrt(changes.length);
  console.log('  配对差距变化 ' + changes.map(x => x.toFixed(1)).join(' ') +
    ' ⇒ 均值 ' + m.toFixed(1) + 'pt ‖ se ' + se.toFixed(1) + ' ‖ t=' + (m / se).toFixed(2) +
    ' ‖ 符号 ' + changes.filter(x => x < 0).length + '/' + changes.length + ' 为负');
  console.log('  ⚠ 对照：不配对时，单 seed 读到的"差距"本身带 sd v1=' + gapSd.v1.toFixed(1) + ' / v2=' + gapSd.v2.toFixed(1) +
    'pt（DS 引用的 4.4pt 落在这个摆动里）⇒ 单 seed 看差距没意义；配对之后 t=' + (m / se).toFixed(2) + '，' +
    (Math.abs(m / se) > 3 ? '压缩这件事算立住' : '还不够立住'));
}

console.log('\n=== ③ 排序变了吗（v1 与 v2 同一 seed 内的名次）===');
const rankOf = (pool, seed) => { const s = PACKS.map(p => [p, Number(g(p, pool, seed).X4P)]).sort((a, b) => b[1] - a[1]); const m = {}; s.forEach((x, i) => m[x[0]] = i + 1); return m; };
for (const s of SEEDS) {
  const a = rankOf('v1', s), b = rankOf('v2', s);
  const moved = PACKS.filter(p => a[p] !== b[p]).map(p => p + '(' + a[p] + '→' + b[p] + ')');
  const d2 = PACKS.reduce((acc, p) => acc + (a[p] - b[p]) ** 2, 0);
  console.log('  seed ' + s + ' ‖ v1 序 ' + PACKS.slice().sort((x, y) => a[x] - a[y]).join('>') +
    '\n            v2 序 ' + PACKS.slice().sort((x, y) => b[x] - b[y]).join('>') +
    '\n            换位 ' + (moved.length ? moved.join(' ') : '无') + ' ‖ Spearman ρ=' + (1 - 6 * d2 / (5 * 24)).toFixed(2));
}
console.log('\n  ⇒ 若各 seed 的 ρ 都在 0.9 以上、换位只发生在相邻名次：换席**没有改变谁排前面**，只整体压低了分数与差距。');
