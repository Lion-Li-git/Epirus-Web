
/* 墙的真实弱点画像：G5C vs 各类脚本（2P/3P），看它对「耐心型/穿透型」是不是输 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { EXAM_FN } from '../../server/opp-pool.mjs';
const W = sandbox(); const T = W.EpirusTrainer; const B = W.EpirusBots;
const SUBJ = { id: 'G5C-100', p: null };
import { loadChamp } from '../../tools/audit-lib.mjs';
SUBJ.p = loadChamp(W, 'scratch/ds-1109/G5C-100.js');
function playOne(pA, fnB, n, dir, g) {
  const seed = 555000 + n * 100003 + g * 977 + (dir === 'A' ? 0 : 500000);
  const ch = [];
  for (let pid = 0; pid < n; pid++) {
    const isA = (pid === 0) === (dir === 'A');
    ch.push(isA ? T.policyChooserN(pA, 0.15) : fnB);
  }
  const r = T.oneGameN(ch, seed, n, { mode: 'multi' });
  return T.rankOf(r.state, 0, seed) === 1 ? 1 : 0;
}
const names = ['gunspam','snipespam','antidef','deepsaver','ringspam','guardspam','reflectspam','farmer'];
for (const nm of names) {
  const fnName = EXAM_FN[nm];
  const fn = fnName ? B[fnName] : (nm === 'farmer' ? B.pickFarmer : null);
  if (typeof fn !== 'function') { console.log(nm + ' 缺'); continue; }
  const out = [];
  for (const n of [2, 3, 5]) {
    const G = 20; let a = 0;
    for (let g = 0; g < G; g++) a += playOne(SUBJ.p, fn, n, 'A', g);
    out.push('N' + n + ' ' + (100 * a / G).toFixed(0) + '%');
  }
  console.log(('vs ' + nm).padEnd(16) + out.join('  ‖  '));
}
