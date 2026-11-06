/* P0-1 验收腿 1/2（腿 3 = 重跑标定 CLI，另行跑）：
 *   腿1 同一行连评两次 JSON 全等；腿2 holdout 20 局/桌形 = 40 局循环里同 (shape,g) 局逐局全等 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const W = sandbox();
W.EpirusTrainer.setBigTPush(12);
const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
const refParams = Float64Array.from(ref);
const A = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const T = W.EpirusTrainer;
console.log('指纹: ' + A.fp);
let ok = true;

/* 腿1 */
const r1 = A.evalParams(refParams, { phase: 'holdout', gamesPerShape: 40, temp: 0.15 });
const r2 = A.evalParams(refParams, { phase: 'holdout', gamesPerShape: 40, temp: 0.15 });
const j1 = JSON.stringify(r1), j2 = JSON.stringify(r2);
console.log('腿1 同行两次 JSON 全等: ' + (j1 === j2 ? 'PASS' : 'FAIL'));
console.log('  v7@v2尺: 夺1 ' + (100 * r1.first).toFixed(1) + '% 净胜 ' + r1.score.toFixed(3) + ' 干净净胜 ' + r1.cleanScore.toFixed(3) + ' 平局 ' + (100 * r1.draw).toFixed(1) + '%');
ok = ok && j1 === j2;

/* 腿2 */
const perGame = (per) => {
  const ch = T.policyChooserN(refParams, 0.15);
  const rows = {};
  for (let s = 0; s < A.shapes.length; s++) for (let g = 0; g < per; g++) rows[s + ':' + g] = A.playOne(ch, s, 100000 + s * 1000 + g, 90001);
  return rows;
};
const pg20 = perGame(20), pg40 = perGame(40);
let bad = 0;
for (let s = 0; s < A.shapes.length; s++) for (let g = 0; g < 20; g++) {
  if (JSON.stringify(pg20[s + ':' + g]) !== JSON.stringify(pg40[s + ':' + g])) { bad++; if (bad <= 5) console.log('  不等: shape' + s + ' g' + g); }
}
console.log('腿2 逐局嵌套（20循环 ⊂ 40循环，' + (A.shapes.length * 20) + ' 局全比）: ' + (bad === 0 ? 'PASS' : 'FAIL ' + bad + ' 局'));
/* 聚合核对：evalChooser(20循环) 的 byShape 必须等于用逐局结果重算的聚合（同一代码路径的自证） */
const r20 = A.evalParams(refParams, { phase: 'holdout', gamesPerShape: 20, temp: 0.15 });
let aggBad2 = 0;
for (let s = 0; s < A.shapes.length; s++) {
  let w = 0, d = 0, net = 0, cl = 0;
  for (let g = 0; g < 20; g++) { const r = pg20[s + ':' + g]; w += r.win ? 1 : 0; d += r.draw ? 1 : 0; net += r.scoreNet; cl += r.scoreClean; }
  const key = A.shapes[s].n + ':' + A.shapes[s].mode;
  const got = r20.byShape[key];
  const exp = { games: 20, first: w / 20, draw: d / 20, score: net / 20, cleanScore: cl / 20 };
  const eq = ['games', 'first', 'draw', 'score', 'cleanScore'].every((k) => Math.abs(got[k] - exp[k]) < 1e-12);
  if (!eq) { aggBad2++; console.log('  20循环聚合不等 @' + key + ': evalChooser ' + JSON.stringify(got) + ' vs 重算 ' + JSON.stringify(exp)); }
}
console.log('   20循环 byShape 聚合核对: ' + (aggBad2 === 0 ? 'PASS' : 'FAIL ' + aggBad2));
ok = ok && bad === 0 && aggBad2 === 0;
process.exit(ok ? 0 : 1);
