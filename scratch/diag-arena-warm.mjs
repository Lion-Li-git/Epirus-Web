import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const W = sandbox(); W.EpirusTrainer.setBigTPush(12);
const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
const refParams = Float64Array.from(ref);
const show = (tag, r) => console.log(tag, 'raw', (100 * r.first).toFixed(1), 'cleanNet', r.cleanScore.toFixed(3), 'nonji', r.maxCard && r.maxCard.nonji);
for (const warm of [1, 2, 4]) {
  const A = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
  A.evalParams(refParams, { phase: 'holdout', gamesPerShape: warm, temp: 0.15 });
  show('warm=' + warm, A.evalParams(refParams, { phase: 'holdout', gamesPerShape: 40, temp: 0.15 }));
}
