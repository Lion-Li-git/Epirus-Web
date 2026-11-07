/* 2.0 池 vs 全库：P/X 双剂量四格卷读数盘点（2026-11-07 夜 · 支撑今晚计划）
 * 读 pool-members.tsv（池真源 23 枚）+ coords-gen3-1105.tsv（P/X 族 + ver/kin）
 * 输出：池均值/中位 vs 全库 vs 2.0 批（ver=2.0）vs v7 批，分桌形分人数
 */
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
const poolIds = new Set(rd('champion-map/pool-members.tsv').slice(1).map(r => r[0]).filter(Boolean));
const W = [0.15, 0.25, 0.45, 0.15], NS = [2, 3, 5, 8];
const score = (r, fam, L) => { let s = 0, w = 0; for (let i = 0; i < 4; i++) { const v = +r[h[fam + NS[i] + L]]; if (isFinite(v) && r[h[fam + NS[i] + L]] !== '') { s += W[i] * v; w += W[i]; } } return w ? s / w : null; };
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? (b[Math.floor((b.length - 1) / 2)] + b[Math.ceil((b.length - 1) / 2)]) / 2 : NaN; };
const rows = co.slice(1).filter(r => r[h.id]).map(r => ({
  id: r[h.id], ver: r[h.ver], kin: r[h.kin], lin: r[h.lineage],
  pool: poolIds.has(r[h.id]),
  P: score(r, 'P', ''), XL: score(r, 'P', 'L'), Xe: score(r, 'X', ''), XeL: score(r, 'X', 'L'),
  Pn: NS.map(n => { const v = +r[h['P' + n]]; return isFinite(v) ? v : null; }),
  PnL: NS.map(n => { const v = +r[h['P' + n + 'L']]; return isFinite(v) ? v : null; }),
}));
const group = (name, g) => {
  const f = (k) => g.map(r => r[k]).filter(v => v !== null);
  const perN = (arr) => NS.map((n, i) => med(arr.map(r => r[i]).filter(v => v !== null)).toFixed(3)).join('/');
  console.log(name.padEnd(14) + ' n=' + String(g.length).padStart(3)
    + ' ‖ P̄₄短 均 ' + (med(f('P')) ?? NaN).toFixed(3) + ' 中位 ' + (med(f('P')) ?? NaN).toFixed(3)
    + ' ‖ P̄₄长 ' + (med(f('XL')) ?? NaN).toFixed(3)
    + ' ‖ 考卷X̄₄短 ' + (med(f('Xe')) ?? NaN).toFixed(3) + ' ‖ 考卷长 ' + (med(f('XeL')) ?? NaN).toFixed(3));
  console.log('    '.padEnd(14) + '    按人数 P 短(2/3/5/8)=' + perN(g.map(r => r.Pn)) + '  P 长=' + perN(g.map(r => r.PnL)));
};
console.log('== X̄₄（页面剂量 P 族 · 权重 15/25/45/15）分组盘点 ==');
group('池 23 枚', rows.filter(r => r.pool));
group('2.0 批(ver=2.0)', rows.filter(r => r.ver === '2.0'));
group('代3臂产物', rows.filter(r => r.kin === '代3臂产物'));
group('v7/1.8 旧批', rows.filter(r => r.ver !== '2.0' && !r.pool));
group('全库 884', rows);
/* 池成员的排名分位 */
const byP = rows.slice().sort((a, b) => b.P - a.P);
const rk = new Map(byP.map((r, i) => [r.id, i + 1]));
const N = rows.length;
const poolRanks = rows.filter(r => r.pool).map(r => rk.get(r.id)).sort((a, b) => a - b);
console.log('\n== 池 23 枚在 P̄₄短 全库名次（1=最好）==');
console.log('名次: ' + poolRanks.join(' '));
console.log('前 10%: ' + poolRanks.filter(x => x <= N * 0.1).length + ' 枚 ‖ 前 1/3: ' + poolRanks.filter(x => x <= N / 3).length + ' 枚 ‖ 后 1/3: ' + poolRanks.filter(x => x > N * 2 / 3).length + ' 枚');
const byPL = rows.slice().sort((a, b) => (b.XL ?? -9) - (a.XL ?? -9));
const rkL = new Map(byPL.map((r, i) => [r.id, i + 1]));
const poolRanksL = rows.filter(r => r.pool).map(r => rkL.get(r.id)).sort((a, b) => a - b);
console.log('长桌名次: ' + poolRanksL.join(' '));
/* 2P 缺口细看：池 vs 全库的 X2/X2L 分布 */
const pool2 = rows.filter(r => r.pool).map(r => r.Pn[0]).filter(v => v !== null);
const lib2 = rows.map(r => r.Pn[0]).filter(v => v !== null);
console.log('\n== 2P 短程 X2 ==');
console.log('池: 均 ' + (pool2.reduce((a, b) => a + b, 0) / pool2.length).toFixed(3) + ' 中位 ' + med(pool2).toFixed(3) + ' ‖ 全库中位 ' + med(lib2).toFixed(3) + ' ‖ 池里 X2<0 的 ' + pool2.filter(v => v < 0).length + '/' + pool2.length + ' 枚');
