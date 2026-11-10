import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
import { layoutOf, tapeForward } from '../../tools/proto2/pg-lib.mjs';
const W = sandbox();
installArch2(W, { input: 'obs5', gen: 3, keySplit: 1, skills: W.EpirusRules.skills.length, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
const S = W.EpirusState, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
const params = new Float64Array(P.paramCount());
const rr = T.mulberry32(7);
for (let i = 0; i < params.length; i++) params[i] = (rr() - 0.5) * 0.25;
let cap = null;
function chooser(state, pid, legal) {
  if (!cap && legal && legal.length >= 2) {
    const econ = T.econBase(state, pid, legal);
    const cands = P.candidatesFor(state, pid, econ, { lockTarget: false }) || [];
    if (cands.length >= 2) cap = { state, pid, cands, o: P.forwardCands(state, pid, cands, params, { wantTape: 1 }) };
  }
  return P.chooseCandidates(state, pid, legal, params, { temp: 0.3 });
}
const st = S.createState('multi', { next: T.mulberry32(4242) }, 5);
T.oneGameN([chooser, B.pickRandom, B.pickRandom, B.pickRandom, B.pickRandom], 77, 5, { mode: st.mode });
const { o, cands, pid } = cap;
const ly = layoutOf(P);
const a2 = tapeForward(o.tape, params, ly);
console.log('cands=' + cands.length);
for (let i = 0; i < cands.length; i++) {
  const d = Math.abs(a2.logits[i] - o.logits[i]);
  if (d > 1e-9) console.log('logit[' + i + '] Δ=' + d.toExponential(3) + ' key=' + cands[i].key + ' t1=' + cands[i].target + ' t2=' + cands[i].target2);
}
console.log('aes[0] 一致? (afs 抄 tape ⇒ 必一致)');
const L = ly.L;
const at = L.seg.find(s => s.name === 'attn');
console.log('段表: ' + L.seg.map(s => s.name + '@' + s.off + '+' + s.len).join(' | '));
