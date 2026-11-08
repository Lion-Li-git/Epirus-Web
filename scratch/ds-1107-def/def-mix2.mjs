
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay, B = W.EpirusBots;
const scripts = ['pickGunSpam','pickGuardSpam','pickDeepSaver','pickHeavyFire','pickMix','pickAggro','pickDeadlineBurst','pickEarlyPressure'];
const CAT = (key) => { const s = (R.skills || []).find(x => x.key === key); return s ? s.cat : null; };
const files = process.argv.slice(2);
for (const f of files) {
  const p = loadChamp(W, f);
  const mix = {}; let def = 0, games = 200;
  for (let g = 0; g < games; g++) {
    const st = S.createState('multi', { next: T.mulberry32(90000 + g) }, 5);
    let picks = {};
    const wrap = (i) => (state, pid, legal) => {
      const k = (i === 0) ? T.policyChooserN(p, 0.15)(state, pid, legal) : B[scripts[(g * 5 + i) % scripts.length]](state, pid, legal);
      if (i === 0) { const key = typeof k === 'string' ? k : (k && k.key); if (key) picks[state.round] = key; }
      return k;
    };
    Play.autoGameN(st, [wrap(0), wrap(1), wrap(2), wrap(3), wrap(4)]);
    for (const rd of Object.keys(picks)) { const key = picks[rd]; if (CAT(key) === 'defense') { def++; mix[key] = (mix[key] || 0) + 1; } }
  }
  const tot = Object.values(mix).reduce((a, b) => a + b, 0);
  console.log(f.split('/').pop().replace('.bak', '').padEnd(16) + ' 防御/局 ' + (def / games).toFixed(2) + '  分布 ' + JSON.stringify(mix) + '  占比 ' + Object.entries(mix).map(([k, v]) => k + ':' + (v / (tot || 1) * 100).toFixed(0) + '%').join(' '));
}
