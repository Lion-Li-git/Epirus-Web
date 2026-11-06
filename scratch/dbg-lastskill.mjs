import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2('scratch/ga-arms/L5-D4a-s13.js'); const got = packCfgExit(raw, 'x'); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
const pp = Float64Array.from(P.unpack(raw, true));
const inner = T.policyChooserN(pp, 0.15, 0, 5, 'soft');
const A = createArena2(W, { refParams: pp, temp: 0.15, stratified: false });
const sh = A.shapes.findIndex((s) => s.n === 5 && s.mode === 'long');
const gun = A.roster.find((e) => e.name === 'only:gun');
let round = 0;
const focus = (state, pid, legal) => {
  round++;
  if (round <= 6) console.log('R' + (state.round | 0) + ' lastSkills=' + state.p.map((p, i) => i === pid ? 'me' : (p.lastSkill || '-')).join(',') + ' hp=' + state.p.map(p => p.hp).join(','));
  return inner(state, pid, legal);
};
const r = T.oneGameN([focus, gun.sel, gun.sel, gun.sel, gun.sel], 98000, 5, { mode: 'long' });
console.log('winner', r.winner, 'rounds', r.rounds);
