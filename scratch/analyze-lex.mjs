/* P0-2 判据判定（预登记三条，HANDOFF §四）：从 eval40-v2 JSON 出报告表
 * 报告值 = CLI 40 局/桌形 + 每包最佳温度（按 cleanScore） + 同一次扫描里 v7 的相邻行 */
import { readFileSync } from 'node:fs';

const PACKS = ['LEX-s7', 'LEX-s11', 'LEX-s13', 'MILD2-s7'];
const REF_TOTAL = 0.211, REF_TOTAL_LINE = REF_TOTAL - 0.02;
const out = [];
let v7Best = null;
for (const p of PACKS) {
  const j = JSON.parse(readFileSync(`scratch/${p}-eval40-v2.json`, 'utf8'));
  const v7rows = j.rows.filter((r) => r.tag.indexOf('参照v7') === 0);
  const pkrows = j.rows.filter((r) => r.tag.indexOf('2.0包') === 0);
  const v7b = v7rows.slice().sort((a, b) => b.cleanScore - a.cleanScore)[0];
  const pkb = pkrows.slice().sort((a, b) => b.cleanScore - a.cleanScore)[0];
  if (!v7Best || v7b.cleanScore > v7Best.cleanScore) v7Best = { ...v7b, pack: p };
  out.push({ p, temps: pkrows.map((r) => r.temp), v7b, pkb, v7rows, pkrows });
}
console.log('=== 报告口径：CLI 40 局/桌形 × 11 格 ‖ strat=mild ‖ temps 0.05/0.1/0.15 ‖ 每包取 cleanScore 最佳温度 ===\n');
console.log('参照 v7（同扫相邻行，各扫描里最高）: 夺1 ' + (100 * v7Best.first).toFixed(1) + '% 干净净胜 ' + v7Best.cleanScore.toFixed(3) + ' （t=' + v7Best.temp + '，来自 ' + v7Best.pack + ' 的扫描）');
if (v7Best.byShape) console.log('  v7 逐格 cleanScore: ' + Object.keys(v7Best.byShape).map((k) => k + ' ' + v7Best.byShape[k].cleanScore.toFixed(3)).join(' ‖ '));
console.log('');
for (const { p, pkb, v7b, pkrows } of out) {
  console.log('— ' + p + '：最佳 t=' + pkb.temp + ' 夺1 ' + (100 * pkb.first).toFixed(1) + '% 干净净胜 ' + pkb.cleanScore.toFixed(3) +
    ' ‖ 单卡 ' + (pkb.maxCard ? pkb.maxCard.key + ' ' + (100 * pkb.maxCard.share).toFixed(1) + '%' : '—') +
    ' ‖ 平局 ' + (100 * pkb.draw).toFixed(1) + '% ‖ （各温度 cleanScore: ' + pkrows.map((r) => 't' + r.temp + '=' + r.cleanScore.toFixed(3)).join(' ') + '）');
  const bs = pkb.byShape, vs = v7b.byShape;
  const cells810 = ['8:multi', '10:multi'];
  const c1 = cells810.map((k) => ({ k, v: bs[k].cleanScore, ref: vs[k].cleanScore, ok: bs[k].cleanScore >= vs[k].cleanScore - 0.03 }));
  console.log('   判据① 8P/10P 每格 ≥ v7−3pt: ' + c1.map((x) => x.k + ' ' + x.v.toFixed(3) + ' vs v7 ' + x.ref.toFixed(3) + (x.ok ? ' ✔' : ' ✘')).join(' ‖ '));
  const c2 = pkb.cleanScore >= REF_TOTAL_LINE;
  console.log('   判据② 总干净胜 ≥ 0.211−2pt=0.191: ' + pkb.cleanScore.toFixed(3) + (c2 ? ' ✔' : ' ✘'));
  const lows = Object.keys(bs).filter((k) => bs[k].cleanScore < vs[k].cleanScore - 0.03);
  console.log('   （附：全部 11 格里低于 v7−3pt 的格 = ' + (lows.length ? lows.join(',') : '无') + '）');
}
const mins = out.map((x) => x.pkb.cleanScore);
const c3 = Math.min(...mins) >= (v7Best.cleanScore >= 0.10 ? 0.10 : v7Best.cleanScore);
console.log('\n判据③ 3 种子最小值 ≥ v7 同场: min(LEX 三种子) = ' + Math.min(out.filter((x) => x.p.startsWith('LEX')).map((x) => x.pkb.cleanScore)).toFixed(3) +
  ' ‖ v7 同场参照 ' + v7Best.cleanScore.toFixed(3) + ' ⇒ ' + (Math.min(...out.filter((x) => x.p.startsWith('LEX')).map((x) => x.pkb.cleanScore)) >= Math.min(0.10, v7Best.cleanScore) ? '✔' : '✘'));
