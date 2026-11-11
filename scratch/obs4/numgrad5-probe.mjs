/* 数值梯度误差画像：3 种子 × 2 步长 × 40 位，看误差是 O(EPS²)（纯差分噪声）还是平台（解析真 bug） */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
import { layoutOf, tapeForward, tapeBackward } from '../../tools/proto2/pg-lib.mjs';
const W = sandbox();
installArch2(W, { input: 'obs5', gen: 3, keySplit: 1, skills: W.EpirusRules.skills.length, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
const S = W.EpirusState, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
function capTape(seed) {
  const params = new Float64Array(P.paramCount());
  const rr = T.mulberry32(seed);
  for (let i = 0; i < params.length; i++) params[i] = (rr() - 0.5) * 0.25;
  let cap = null;
  function chooser(state, pid, legal) {
    if (!cap && legal && legal.length >= 2) {
      const econ = T.econBase(state, pid, legal);
      const cands = P.candidatesFor(state, pid, econ, { lockTarget: false }) || [];
      if (cands.length >= 2) cap = { o: P.forwardCands(state, pid, cands, params, { wantTape: 1 }) };
    }
    return P.chooseCandidates(state, pid, legal, params, { temp: 0.3 });
  }
  const st = S.createState('multi', { next: T.mulberry32(seed) }, 5);
  T.oneGameN([chooser, B.pickRandom, B.pickRandom, B.pickRandom, B.pickRandom], seed * 3 + 1, 5, { mode: st.mode });
  return { params, tape: cap.o.tape };
}
for (const seed of [7, 101, 2027]) {
  const { params, tape } = capTape(seed);
  const ly = layoutOf(P);
  const a2 = tapeForward(tape, params, ly);
  const rr = T.mulberry32(seed + 1);
  const upstream = new Float64Array(tape.afs.length);
  for (let i = 0; i < upstream.length; i++) upstream[i] = (rr() - 0.5) * 2;
  const g = new Float64Array(params.length);
  tapeBackward(tape, params, ly, a2, upstream, g);
  for (const EPS of [1e-6, 1e-5]) {
    let worst = 0, wi = -1, med = [];
    for (let trial = 0; trial < 40; trial++) {
      const idx = Math.floor(rr() * params.length);
      const old = params[idx];
      params[idx] = old + EPS;
      const lp = tapeForward(tape, params, ly);
      params[idx] = old - EPS;
      const lm = tapeForward(tape, params, ly);
      params[idx] = old;
      let num = 0;
      for (let i = 0; i < upstream.length; i++) num += upstream[i] * (lp.logits[i] - lm.logits[i]);
      num /= 2 * EPS;
      const rel = Math.abs(num - g[idx]) / Math.max(1e-8, Math.abs(num) + Math.abs(g[idx]));
      med.push(rel);
      if (rel > worst) { worst = rel; wi = idx; }
    }
    med.sort((a, b) => a - b);
    console.log('seed=' + seed + ' EPS=' + EPS.toExponential(0) + '：中位 ' + med[20].toExponential(2) + ' ‖ p90 ' + med[35].toExponential(2) + ' ‖ 最差 ' + worst.toExponential(2) + ' @' + wi);
  }
}
