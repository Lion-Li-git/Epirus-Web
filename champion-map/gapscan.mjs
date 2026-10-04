/* gapscan.mjs —— §E307 之二：地图上还有没有"说得出方向、但没训到"的高地。
 *
 * 做法：在二维投影上铺格，每格用 **12 近邻的软化 IDW** 插值出 F；
 *   只保留"邻域真的密"的格（第 12 近邻 ≤ 全库第 12 近邻中位 × 1.5）⇒ 稀疏格外推不算（§E290：二维装不下这朵点云，
 *   插值会在没数据的地方造出没被任何一枚做到过的"阱"，那条教训反过来同样成立）。
 * 然后问两句：
 *   ① 有没有格的预测 F 高于全库实测最好值？（"图上说还有更好的"）
 *   ② 那些高地格离**已发货的冠军**有多远、方向是什么（把方向翻译成行为列的差，才算"可训练方向"）。
 * 用法：node champion-map/gapscan.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const T = Number((process.argv.find(a => a.startsWith('--T=')) || '--T=0.1').slice(4));
function tsv(f) { const L = readFileSync(join(HERE, f), 'utf8').trim().split('\n'), h = L[0].split('\t');
  return L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }); }
const co = tsv('coords.tsv'), lin = tsv('lineage.tsv'), LB = {};
for (const r of lin) LB[r.id] = r;
const P = co.map(r => ({ id: r.id, x: +r.x2, y: +r.y2, F: +r.H / 100 + T * (+r.S), H: +r.H, S: +r.S, rk: +r.rank,
  lin: r.lineage || '', fam: (LB[r.id] || {}).fam, beh: r }));
const N = P.length;

/* 每枚点的第 12 近邻距离 ⇒ 定"有数据的尺度" */
const d12 = P.map((p, i) => { const a = P.filter((_, j) => j !== i).map(q => Math.hypot(q.x - p.x, q.y - p.y)).sort((u, v) => u - v); return a[11]; });
const med = a => { const s = a.filter(isFinite).sort((x, y) => x - y); return s[s.length >> 1]; };
const D12 = med(d12), CUT = D12 * 1.5;
console.log('第 12 近邻距离中位 = ' + D12.toFixed(4) + ' 数据单位 ⇒ 只认第 12 近邻 ≤ ' + CUT.toFixed(4) + ' 的格');

const xs = P.map(p => p.x), ys = P.map(p => p.y);
const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
const NX = 150, NY = 150, cells = [];
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
  const X = x0 + (x1 - x0) * i / (NX - 1), Y = y0 + (y1 - y0) * j / (NY - 1);
  const ord = P.map((p, k) => [Math.hypot(p.x - X, p.y - Y), k]).sort((a, b) => a[0] - b[0]).slice(0, 12);
  if (ord[11][0] > CUT) continue;
  let num = 0, den = 0;
  for (const [dd, k] of ord) { const w = 1 / Math.pow(dd + D12, 2.5); num += w * P[k].F; den += w; }
  cells.push({ X, Y, F: num / den, far: ord[11][0], nb: ord.map(o => P[o[1]]) });
}
cells.sort((a, b) => b.F - a.F);
const bestPack = P.slice().sort((a, b) => b.F - a.F)[0];
const shipped = P.find(p => p.id === 'SHIPPED-Ldemo');
console.log('可估格 ' + cells.length + ' / ' + (NX * NY) + '  ‖ 实测最好 F = ' + bestPack.F.toFixed(4) + '（' + bestPack.id + '）‖ 线上包 ' + shipped.F.toFixed(4));
const above = cells.filter(c => c.F > bestPack.F);
console.log('预测 F 高于现存最好的格 = ' + above.length + ' 个（占可估格 ' + (above.length / cells.length * 100).toFixed(1) + '%）');

/* 高地 = 预测 F 的前 2%；看它们的家族构成与行为方向 */
const hi = cells.slice(0, Math.max(12, Math.round(cells.length * 0.02)));
const famCnt = {}; for (const c of hi) for (const p of c.nb) famCnt[(p.fam || '?')] = (famCnt[p.fam || '?'] || 0) + 1;
const topFams = Object.keys(famCnt).sort((a, b) => famCnt[b] - famCnt[a]).slice(0, 5);
console.log('\n高地格（前 ' + hi.length + ' 个）邻域里的家族构成：' + topFams.map(f => 'f' + f + '×' + famCnt[f]).join('  '));
console.log('  对照：全库邻域最常见的家族 = ' + Object.keys((() => { const m = {}; for (const p of P) m[p.fam || '?'] = (m[p.fam || '?'] || 0) + 1; return m; })())
  .sort((a, b) => P.filter(p => p.fam == b).length - P.filter(p => p.fam == a).length).slice(0, 5).map(f => 'f' + f).join(' '));
const bmed = (cols, key) => med(cols.map(c => c.nb.map(p => +p.beh[key])).flat().filter(isFinite));
const allmed = key => med(P.map(p => +p.beh[key]).filter(isFinite));
console.log('\n高地邻域 vs 全库（行为中位数，看"往哪走"）：');
for (const k of ['H', 'S', 'Geff', 'dmg', 'heavy', 'holo', 'distinctKeys', 'charges', 'seatSpread', 'fieldAAtk', 'rwDmg']) {
  const a = bmed(hi, k), b = allmed(k);
  if (!isFinite(a) || !isFinite(b)) { console.log('  ' + k.padEnd(13) + ' （无可比中位数）'); continue; }
  const sp = (Math.max(...P.map(p => +p.beh[k])) - Math.min(...P.map(p => +p.beh[k]))) || 1;
  console.log('  ' + k.padEnd(13) + ' 高地 ' + a.toFixed(3).padStart(9) + '  全库 ' + b.toFixed(3).padStart(9) +
    '  差 ' + ((a - b) / sp >= 0 ? '+' : '') + ((a - b) / sp).toFixed(2) + ' 个全库展宽' + (Math.abs((a - b) / sp) > 0.2 ? '  ★' : ''));
}
console.log('\n⚠ 这张表的正确用法：它只说"图上哪一带还没被采满"，不说"去那儿训就更强"。');
console.log('   插值格没有真值（§E290 已量过二维装不下这朵点云），所以任何据此开的臂都必须先做单自由度 A/B 才算数。');
