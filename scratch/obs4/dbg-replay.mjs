/* 定位重放差异：forward 的 TP.xin vs 重放的 a2.xin，找第一处分歧 */
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
let first = -1, maxd = 0;
for (let i = 0; i < o.tape.xin.length; i++) { const d = Math.abs(a2.xin[i] - o.tape.xin[i]); if (d > 1e-12 && first < 0) first = i; if (d > maxd) maxd = d; }
console.log('xin 首个分歧 @' + first + '（60=池化区开始）maxΔ=' + maxd.toExponential(3));
console.log('svs 数=' + o.tape.svs.length + ' ids=' + o.tape.svs.map(s => s.id).join(','));
console.log('前向 pooled[0..4]=' + [...o.tape.xin.slice(60, 64)].map(v => v.toFixed(4)).join(','));
console.log('重放 pooled[0..4]=' + [...a2.xin.slice(60, 64)].map(v => v.toFixed(4)).join(','));
