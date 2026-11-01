/* 第 2 题（千问交接件 §6.2）：DivK（distinctCast）vs kindN（同 raw）vs 有效种类 t=1%/2% —— 对 1st 的实测对照。
 * 数据全部现成：EFFKINDS-1101.json（120 局镜像档，castByKey 直方图）× poolprofile-1101.tsv（同一把尺 eval-5p 12 局/组合的 1st）。
 * DivK 的 fit 项 = 非ジ出手键数 = distinctCast（breadth2 口径不含 ji）⇒ 它的 ρ 就是"DivK 该不该换"的直接读数。 */
const fs = require('fs');
const eff = require('./EFFKINDS-1101.json');
// poolprofile: id tier 1st 种类 最大单键 环 大雷 炮 激光眼 小雷 过载炮 …
const prof = fs.readFileSync('poolprofile-1101.tsv', 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split('\t'));
const norm = s => s.replace(/\.bak$/, '').replace(/\.js$/, '').replace(/（.*?）/g, '').trim();
const ALIAS = { 'e78-out__G08-71': 'G15-71', 'e70-out__D02-31': 'K2', 'e124-out__blk0t40-s31': 'blk0t40-s31',
  'win-Ldemo': 'SHIPPED-Ldemo', 'win-R311': 'R311', 'sel80': 'seed80' };
const profById = new Map();
for (const c of prof) profById.set(norm(c[0]), c);
// EFFKINDS 行 → join
const rows = [];
const missed = [];
for (const r of eff.rows) {
  let id = norm(r.pack);
  id = ALIAS[id] || id;
  /* v7（锚·同尺同档） = 线上冠军 = 池成员 T8-s114（千问 §十六）；其余 v7* 开头的是池里另外 12 枚独立成员，不许并 */
  if (r.pack.indexOf('锚') >= 0) id = 'T8-s114';
  const p = profById.get(id);
  if (!p) { missed.push(r.pack); continue; }
  const lines = ['环', '大雷', '炮', '激光眼', '小雷', '过载炮'].map((_, i) => p[5 + i]).filter(v => v && v !== '—' && v !== '-').length;
  rows.push({
    id, cohort: r.container.startsWith('v7') ? 'pool' : 'gen3',
    first: parseFloat(p[2]), kindsCard: parseInt(p[3], 10),
    distinctCast: r.distinctCast, eff1: r.effKinds['1'], eff2: r.effKinds['2'], eff5: r.effKinds['5'],
    lines, maxCastShare: r.maxCastShare, landReadable: r.landReadable,
  });
}
console.log('joined rows:', rows.length, ' missed:', missed.join(','));
function spearman(xs, ys) {
  const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const rk = new Array(a.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const r = (i + j) / 2 + 1; for (let k = i; k <= j; k++) rk[idx[k][1]] = r; i = j + 1; } return rk; };
  const rx = rank(xs), ry = rank(ys), n = xs.length;
  const mx = rx.reduce((a, b) => a + b, 0) / n, my = ry.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = rx[i] - mx, dy = ry[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxy / Math.sqrt(sxx * syy);
}
for (const cohort of ['pool', 'gen3']) {
  const g = rows.filter(r => r.cohort === cohort);
  if (g.length < 4) { console.log(cohort, 'too few', g.length); continue; }
  const firsts = g.map(r => r.first);
  console.log('\n== ' + cohort + ' (n=' + g.length + ') ==  ρ vs 1st（SE≈1/√' + (g.length - 1) + '）');
  for (const [nm, get] of [
    ['distinctCast（=DivK 的分子）', r => r.distinctCast],
    ['kindsCard（eval-5p 出手种类）', r => r.kindsCard],
    ['effKinds t=1%', r => r.eff1],
    ['effKinds t=2%', r => r.eff2],
    ['长程线数（非—列）', r => r.lines],
    ['maxCastShare（集中度，预期负）', r => r.maxCastShare],
  ]) console.log('  ' + nm.padEnd(24) + ' ρ=' + spearman(firsts, g.map(get)).toFixed(3));
  // token-pad 缺口：distictCast − eff1
  const gap = g.map(r => r.distinctCast - r.eff1);
  console.log('  token-pad 缺口 distinctCast−eff1: min=' + Math.min(...gap) + ' 中位=' + gap.slice().sort((a, b) => a - b)[gap.length >> 1] + ' max=' + Math.max(...gap));
  console.log('  明细:');
  for (const r of g.slice().sort((a, b) => b.first - a.first))
    console.log('    ' + r.id.padEnd(24) + ' 1st=' + r.first.toFixed(1) + '% cast=' + r.distinctCast + ' eff1=' + r.eff1 + ' eff2=' + r.eff2 + ' lines=' + r.lines + ' maxCast=' + (r.maxCastShare * 100).toFixed(0) + '%');
}
