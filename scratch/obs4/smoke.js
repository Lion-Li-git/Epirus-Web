/* obs4 冒烟 v3：对局内捕获合法候选 → 前向/tape → 5P/8P/2P 都过一遍；抛错打单行栈 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';

const W = sandbox();
installArch2(W, { input: 'obs4', gen: 3, keySplit: 1, skills: W.EpirusRules.skills.length, seatH: 24, actH: 24, hid: 32, hid2: 24, mutMode: 'seg' });
const S = W.EpirusState, P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots;
console.log('skills=' + W.EpirusRules.skills.length + ' ‖ paramCount=' + P.paramCount());

const params = new Float64Array(P.paramCount());
const rr = T.mulberry32(7);
for (let i = 0; i < params.length; i++) params[i] = (rr() - 0.5) * 0.25;

const cap = { n: {} };
function fail(tag, e) {
  const st = String(e && e.stack || '').slice(0, 700).split('\n').join(' | ');
  console.error('⛔ [' + tag + '] ' + (e && e.message) + ' STACK: ' + st);
  process.exit(1);
}
function chooser(tag) {
  return function (state, pid, legal) {
    try {
      if (legal && legal.length >= 2 && (cap.n[state.n + 'P'] || { runs: 0 }).runs < 30) {
        const econ = T.econBase(state, pid, legal);
        const cands = P.candidatesFor(state, pid, econ, { lockTarget: false }) || [];
        if (cands.length >= 2) {
          const o = P.forwardCands(state, pid, cands, params, { wantTape: 1 });
          let sm = 0, nan = 0;
          for (let i = 0; i < o.probs.length; i++) sm += o.probs[i];
          for (let i = 0; i < o.logits.length; i++) if (!isFinite(o.logits[i])) nan++;
          const k = state.n + 'P';
          cap.n[k] = cap.n[k] || { runs: 0, sumErr: 0, nan: 0, xin: o.tape.xin.length };
          cap.n[k].runs++; cap.n[k].sumErr += Math.abs(sm - 1); cap.n[k].nan += nan;
        }
      }
    } catch (e) { fail(tag, e); }
    return P.chooseCandidates(state, pid, legal, params, { temp: 0.3 });
  };
}
function run(n, seed) {
  const st = S.createState('multi', { next: T.mulberry32(seed) }, n);
  const bots = [];
  for (let i = 0; i < n; i++) bots.push(i === 0 ? chooser(n + 'P') : B.pickRandom);
  T.oneGameN(bots, seed * 3 + 1, n, { mode: st.mode });
}
run(5, 4242); run(8, 9090); run(2, 2020);
for (const [k, v] of Object.entries(cap.n)) console.log(k + '：前向 ' + v.runs + ' 次 ‖ Σ|probs−1|=' + v.sumErr.toFixed(6) + ' ‖ NaN=' + v.nan + ' ‖ xin=' + v.xin + ' 维');
for (const k of ['5P', '8P', '2P']) {
  if (!cap.n[k] || cap.n[k].nan > 0 || cap.n[k].sumErr > 1e-4) { console.error('⛔ ' + k + ' 冒烟红'); process.exit(1); }
}
console.log('✅ obs4 冒烟全过（5P/8P/2P 无 NaN、probs 归一、xin=252 维）');
