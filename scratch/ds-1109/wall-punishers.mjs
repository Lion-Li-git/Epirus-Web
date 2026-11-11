
/* 挑 2.0 冠军夹具：谁能惩罚反射墙（G5C），且 8P 不弱 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer;
const WALL = loadChamp(W, 'scratch/ds-1109/G5C-100.js');
const CAND = [
  ['KDG-B-Q-s13', 'docs/artifacts/night-adapt/KDG-B-Q-s13.js'],
  ['FOCUS-Q-s13', 'docs/artifacts/night-adapt/FOCUS-Q-s13.js'],
  ['G5J-50', 'scratch/ds-1109/G5J-50.js'],
  ['G5I-50', 'scratch/ds-1109/G5I-50.js'],
  ['CLEAR-Q-s13', 'docs/artifacts/night-adapt/CLEAR-Q-s13.js'],
  ['ADAPT2-Q-s7', 'scratch/night-adapt2/ADAPT2-Q-s7.bak'],
];
function playOne(pA, pB, n, mode, dir, g) {
  const seed = 777000 + n * 100003 + g * 977 + (dir === 'A' ? 0 : 500000);
  const ch = []; for (let pid = 0; pid < n; pid++) { const pr = (pid === 0) ? (dir === 'A' ? pA : pB) : (dir === 'A' ? pB : pA); ch.push(T.policyChooserN(pr, 0.15)); }
  const r = T.oneGameN(ch, seed, n, { mode });
  return T.rankOf(r.state, 0, seed) === 1 ? 1 : 0;
}
for (const [id, path] of CAND) {
  const p = loadChamp(W, path); if (!p) { console.log(id + ' 读不出'); continue; }
  const out = [];
  for (const n of [3, 5]) {
    const G = 24; let a = 0, b = 0;
    for (let g = 0; g < G; g++) { a += playOne(p, WALL, n, 'multi', 'A', g); b += playOne(p, WALL, n, 'multi', 'B', g); }
    out.push('N' + n + ' 候选 ' + (100 * a / G).toFixed(0) + '% / 墙 ' + (100 * b / G).toFixed(0) + '%');
  }
  console.log(id.padEnd(14) + out.join('  ‖  '));
}
