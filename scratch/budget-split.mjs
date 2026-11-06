/* 预算分解：6k 臂里"生成候选"与"冻结桌验证"各花多少局。只用已有 meta，不开新臂。 */
import fs from 'fs';
const rows = process.argv.slice(2);
const out = [];
for (const tag of rows) {
  let m;
  try { m = JSON.parse(fs.readFileSync('scratch/arms/' + tag + '.bak.meta.json', 'utf8')); } catch (e) { console.log('跳过 ' + tag + '：' + e.code); continue; }
  const a = m.arena || {};
  const fxG = m.fxGames || 8;
  const shapes = a.shapes || 11;
  const perVerify = Math.max(8, fxG) * shapes;
  const esa = a.esa || {};
  const screened = esa.screened != null ? esa.screened : null;
  const evals = m.evals;
  const genGames = evals * (m.games || 4);
  const loop = m.gamesActualLoop;
  const verifyGames = screened == null ? null : screened * perVerify;
  out.push({
    tag, pop: m.pop, games: m.games, evals, genGames, screened, perVerify, verifyGames,
    loop, other: loop == null || verifyGames == null ? null : loop - genGames - verifyGames,
    verifyShare: loop && verifyGames != null ? verifyGames / loop : null,
    strat: a.stratified ? 'mild/full' : 'avg', lex: a.lex != null ? JSON.stringify(a.lex) : (a.floors ? 'yes' : null),
    holdoutFit: m.holdoutFit, cur: a.cur,
  });
}
const pad = (s, n) => String(s == null ? '—' : s).padStart(n);
console.log('臂'.padEnd(12) + ' evals'.padStart(7) + ' 生成局'.padStart(8) + ' 预选次'.padStart(8) + ' 每次验证'.padStart(10) + ' 验证局'.padStart(9) + ' 循环总'.padStart(9) + ' 其他'.padStart(8) + ' 验证占比'.padStart(10));
for (const r of out) {
  console.log(r.tag.padEnd(12) + pad(r.evals, 7) + pad(r.genGames, 9) + pad(r.screened, 9) + pad(r.perVerify, 11) + pad(r.verifyGames, 10) + pad(r.loop, 10) + pad(r.other, 9) + pad(r.verifyShare == null ? null : (100 * r.verifyShare).toFixed(1) + '%', 11));
}
