
/* WSEL9-200 vs v7 冠军（Q-s47 / T8-s114）正面矩阵：N=2/3/5 × 3/4/5 血，两方向 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { writeFileSync } from 'node:fs';
const W = sandbox(); const T = W.EpirusTrainer;
const A = { id: 'WSEL9-200', p: loadChamp(W, 'docs/artifacts/night-adapt/WSEL9-200.js') };
const OPP = [
  { id: 'Q-s47', p: loadChamp(W, 'docs/artifacts/e507-out/Q-s47.js') },
  { id: 'T8-s114', p: loadChamp(W, 'docs/artifacts/e528-out/T8-s114.js') },
];
const MODES = [[3, 'multi'], [4, 'multi4'], [5, 'long']];
const CFG = [{ N: 2, G: 40 }, { N: 3, G: 24 }, { N: 5, G: 16 }];
function playOne(pA, pB, n, mode, dir, g) {
  const seed = 424242 + n * 100003 + g * 977 + (dir === 'A' ? 0 : 500000);
  const ch = [];
  for (let pid = 0; pid < n; pid++) { const pr = (pid === 0) ? (dir === 'A' ? pA : pB) : (dir === 'A' ? pB : pA); ch.push(T.policyChooserN(pr, 0.15)); }
  const r = T.oneGameN(ch, seed, n, { mode });
  return T.rankOf(r.state, 0, seed) === 1 ? 1 : 0;
}
const rows = [];
for (const o of OPP) for (const [hp, mode] of MODES) for (const { N, G } of CFG) {
  let a = 0, b = 0;
  for (let g = 0; g < G; g++) { a += playOne(A.p, o.p, N, mode, 'A', g); b += playOne(A.p, o.p, N, mode, 'B', g); }
  const ex = (w) => (w / G - 1 / N) / (1 - 1 / N);
  rows.push({ opp: o.id, N, hp, G, a, b, exA: ex(a), exB: ex(b) });
  console.error(A.id + ' vs ' + o.id + ' N' + N + ' hp' + hp + ' → 我方 ' + (100 * a / G).toFixed(0) + '% / 对手 ' + (100 * b / G).toFixed(0) + '%');
}
writeFileSync('scratch/ds-1109/h2h-wsel9.tsv', ['opp','N','hp','G','aFirst','bFirst','exA','exB'].join('\t') + '\n'
  + rows.map(r => [r.opp, r.N, r.hp, r.G, r.a, r.b, r.exA.toFixed(4), r.exB.toFixed(4)].join('\t')).join('\n') + '\n');
const by = {};
for (const r of rows) { const k = r.opp + '|N' + r.N + '|hp' + r.hp; by[k] = r; }
console.log('\n对手 N 血  我方excess  对手excess  我方胜率');
for (const k of Object.keys(by)) { const r = by[k];
  console.log(k.padEnd(20) + r.exA.toFixed(3).padStart(9) + r.exB.toFixed(3).padStart(11) + ('  ' + (100 * r.a / r.G).toFixed(0) + '%').padStart(10)); }
