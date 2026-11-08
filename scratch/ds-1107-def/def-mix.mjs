
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay, B = W.EpirusBots;
const pQ = loadChamp(W, 'docs/artifacts/e507-out/Q-s47.js');
const scripts = ['pickGunSpam','pickGuardSpam','pickDeepSaver','pickHeavyFire','pickMix','pickAggro','pickDeadlineBurst','pickEarlyPressure'];
const defKeys = {}; let defTotal = 0, atkAfterDef = 0, defRounds = 0, incoming = 0, blocked = 0;
const perGame = [];
for (let g = 0; g < 200; g++) {
  const st = S.createState('multi', { next: T.mulberry32(90000 + g) }, 5);
  const picks = {};
  const wrap = (i) => (state, pid, legal) => {
    const k = (i === 0) ? T.policyChooserN(pQ, 0.15)(state, pid, legal) : B[scripts[(g * 5 + i) % scripts.length]](state, pid, legal);
    const key = typeof k === 'string' ? k : (k && k.key);
    if (i === 0 && key) { picks[state.round] = key; if (R.skills && R.skills[0]) {} }
    return k;
  };
  Play.autoGameN(st, [wrap(0), wrap(1), wrap(2), wrap(3), wrap(4)]);
  /* 统计：Q 的防御出手（cat=defense）与当回合受到的伤害 */
  const catOf = (key) => { const s = (R.SKILLS || R.skills || []).find(x => x.key === key); return s ? s.cat : null; };
  for (const rd of Object.keys(picks)) {
    const key = picks[rd];
    if (catOf(key) !== 'defense') continue;
    defTotal++; defKeys[key] = (defKeys[key] || 0) + 1;
  }
}
console.log('防御出手总数 ' + defTotal + ' 分布 ' + JSON.stringify(defKeys));