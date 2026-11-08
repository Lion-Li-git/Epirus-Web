/* 过线能力/阻断频谱 + 技能覆盖率（PLAN-2026-11-07 夜 · ZCode）——纯表读数
 * ① 12 条线（全腿短程/长程闸）谁的失败原因最高频（11-06 B1 欠的账）
 * ② 技能/行为覆盖 vs X̄₄：窄包（distinctKeys 低）是不是普遍弱、池/2.0 批窄不窄
 */
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv');
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
const W = [0.15, 0.25, 0.45, 0.15], NS = [2, 3, 5, 8];
const x4 = (r, fam) => { let s = 0, w = 0; for (let i = 0; i < 4; i++) { const v = +r[h[fam + NS[i]]]; if (isFinite(v) && r[h[fam + NS[i]]] !== '') { s += W[i] * v; w += W[i]; } } return w ? s / w : null; };
const poolIds = new Set(rd('champion-map/pool-members.tsv').slice(1).map(r => r[0]).filter(Boolean));
const rows = co.slice(1).filter(r => r[h.id]).map(r => ({
  id: r[h.id], pool: poolIds.has(r[h.id]), ver: r[h.ver],
  P: x4(r, 'P'), okS: r[h.okShort], okL: r[h.okLong], fS: r[h.failsShort] || '', fL: r[h.failsLong] || '',
  dk: +r[h.distinctKeys], chg: +r[h.charges], waste: +r[h.waste], nts: +r[h.noThreatStance], rw: +r[h.rwDmg],
}));

/* ===== ① 阻断频谱：失败原因归并计数 =====
 * 失败串形状："G 1.94 < 3；场A 还手 16.8% < 20%；场B 清场 0.00 < 0.3/局" —— 分号/；分隔，每条一个原因 */
const norm = (s) => s.trim();
const bucket = (s) => {
  if (/G \d/.test(s)) return 'G 线（强度分）';
  if (/还手/.test(s)) return '场A 还手率';
  if (/清场/.test(s)) return '场B 清场';
  if (/反弹墙/.test(s)) return '反弹墙伤害';
  if (/座位偏座|座位/.test(s)) return '座位广度';
  if (/珠经济|珠/.test(s)) return '珠经济';
  if (/蓄能|charge/.test(s)) return '蓄能';
  return norm(s).slice(0, 18);
};
const spec = { S: {}, L: {} }, grp = { S: {}, L: {} };
for (const r of rows) {
  for (const [tag, ok, f] of [['S', r.okS, r.fS], ['L', r.okL, r.fL]]) {
    if (ok === '1' || !f) continue;
    for (const piece of f.split(/[；;]/)) {
      if (!piece.trim()) continue;
      const b = bucket(piece);
      spec[tag][b] = (spec[tag][b] || 0) + 1;
      if (r.pool) grp[tag][b] = (grp[tag][b] || 0) + 1;
    }
  }
}
const show = (tag) => {
  const total = Object.values(spec[tag]).reduce((a, b) => a + b, 0);
  console.log('\n== ' + (tag === 'S' ? '短程' : '长程') + '闸阻断频谱（失败原因 × 条数，全库）==');
  for (const [b, c] of Object.entries(spec[tag]).sort((x, y) => y[1] - x[1]).slice(0, 10))
    console.log('  ' + b.padEnd(14) + String(c).padStart(5) + '  (' + (c / total * 100).toFixed(0) + '%)  ‖ 池成员占 ' + (grp[tag][b] || 0));
};
show('S'); show('L');
const nFailS = rows.filter(r => r.okS === '0').length, nFailL = rows.filter(r => r.okL === '0').length;
const poolFailS = rows.filter(r => r.pool && r.okS === '0').length, poolFailL = rows.filter(r => r.pool && r.okL === '0').length;
console.log('\n过线面：短程不过 ' + nFailS + '/' + rows.length + '（池 ' + poolFailS + '/23）‖ 长程不过 ' + nFailL + '/' + rows.length + '（池 ' + poolFailL + '/23）');

/* ===== ② 技能覆盖 vs X̄₄ ===== */
const med = (a) => { const b = a.filter(v => isFinite(v)).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
console.log('\n== 窄包 vs 宽包（distinctKeys 分桶 → P̄₄短 中位）==');
const withDk = rows.filter(r => isFinite(r.dk) && r.P !== null);
const buckets = [[0, 3, 'dk≤3'], [4, 5, 'dk 4-5'], [6, 7, 'dk 6-7'], [8, 99, 'dk≥8']];
for (const [lo, hi, lab] of buckets) {
  const g = withDk.filter(r => r.dk >= lo && r.dk <= hi);
  if (g.length) console.log('  ' + lab.padEnd(8) + ' n=' + String(g.length).padStart(4) + '  P̄₄短中位 ' + med(g.map(r => r.P)).toFixed(3) + '  ‖ 池 ' + g.filter(r => r.pool).length);
}
console.log('\n池 23 枚 distinctKeys: ' + rows.filter(r => r.pool).map(r => r.dk).sort((a, b) => a - b).join(','));
console.log('全库 distinctKeys 中位 ' + med(withDk.map(r => r.dk)) + ' ‖ P̄₄前20 的 dk: ' +
  rows.slice().sort((a, b) => b.P - a.P).slice(0, 20).map(r => r.dk).sort((a, b) => a - b).join(','));
/* 蓄能/浪费/无威胁站桩 这三个"坏行为"列与 X̄₄ 的秩相关（粗 Spearman） */
const rho = (xs, ys) => {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(p => isFinite(p[0]) && isFinite(p[1]));
  const rk = (a) => { const s = a.slice().sort((p, q) => p - q); return a.map(v => s.indexOf(v)); };
  const rx = rk(pairs.map(p => p[0])), ry = rk(pairs.map(p => p[1]));
  const n = pairs.length, d2 = rx.reduce((acc, v, i) => acc + (v - ry[i]) ** 2, 0);
  return 1 - 6 * d2 / (n * (n * n - 1));
};
console.log('\n秩相关（全库）：dk~P̄₄ ' + rho(withDk.map(r => r.dk), withDk.map(r => r.P)).toFixed(3) +
  ' ‖ charges~P̄₄ ' + rho(rows.map(r => r.chg), rows.map(r => r.P)).toFixed(3) +
  ' ‖ waste~P̄₄ ' + rho(rows.map(r => r.waste), rows.map(r => r.P)).toFixed(3) +
  ' ‖ noThreat~P̄₄ ' + rho(rows.map(r => r.nts), rows.map(r => r.P)).toFixed(3));
