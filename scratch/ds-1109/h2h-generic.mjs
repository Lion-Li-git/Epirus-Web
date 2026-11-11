
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer;
const A = { id: process.argv[3] || 'G5C-100', p: loadChamp(W, process.argv[2] || 'scratch/ds-1109/G5C-100.js') };
const OPP = [
  { id: 'Q-s47', p: loadChamp(W, 'docs/artifacts/e507-out/Q-s47.js') },
  { id: 'T8-s114', p: loadChamp(W, 'docs/artifacts/e528-out/T8-s114.js') },
];
const MODES = [[3, 'multi'], [5, 'long']];
const CFG = [{ N: 2, G: 40 }, { N: 3, G: 24 }];
function playOne(pA, pB, n, mode, dir, g) {
  const seed = 424242 + n * 100003 + g * 977 + (dir === 'A' ? 0 : 500000);
  const ch = [];
  for (let pid = 0; pid < n; pid++) { const pr = (pid === 0) ? (dir === 'A' ? pA : pB) : (dir === 'A' ? pB : pA); ch.push(T.policyChooserN(pr, 0.15)); }
  const r = T.oneGameN(ch, seed, n, { mode });
  return T.rankOf(r.state, 0, seed) === 1 ? 1 : 0;
}
for (const o of OPP) for (const [hp, mode] of MODES) for (const { N, G } of CFG) {
  let a = 0, b = 0;
  for (let g = 0; g < G; g++) { a += playOne(A.p, o.p, N, mode, 'A', g); b += playOne(A.p, o.p, N, mode, 'B', g); }
  const ex = (w) => (w / G - 1 / N) / (1 - 1 / N);
  console.log(A.id + ' vs ' + o.id + ' N' + N + ' hp' + hp + ' → 我方 ' + (100 * a / G).toFixed(0) + '% / 对手 ' + (100 * b / G).toFixed(0) + '%  (exA ' + ex(a).toFixed(2) + ' exB ' + ex(b).toFixed(2) + ')');
}
