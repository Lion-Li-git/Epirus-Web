/* 在 supfit 的真实调用形状下探一步梯度：grad 范数 / upstream 非零数 / act logits */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
import { layoutOf, tapeForward, tapeBackward, tailOf, dLogKeyP } from '../../tools/proto2/pg-lib.mjs';
import { readFileSync } from 'node:fs';
function readPack2(path) {
  const s = readFileSync(path, 'utf8');
  const m = s.match(/EPIRUS_CHAMPION_3P = (\{.*\});?\s*$/s) || s.match(/EPIRUS_CHAMPION_3P = (\{.*?\});/s);
  return m ? JSON.parse(m[1]) : null;
}
const UP = process.argv[2] || 'scratch/obs4/KDO5-seed.bak';
const W = sandbox();
const raw = readPack2(UP);
installArch2(W, Object.assign({ mutMode: 'seg' }, { input: raw.dims.input, gen: raw.dims.gen, keySplit: raw.dims.keySplit, seatH: raw.dims.seatH, actH: raw.dims.actH, hid: raw.dims.hid, hid2: raw.dims.hid2, skills: raw.skills }));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, B = W.EpirusBots;
const ly = layoutOf(P);
const pv = new Float64Array(P.paramCount());
pv.set(P.unpack(raw, true));
/* 采一个真 tape（教师开车） */
const Wv = sandbox();
const refParams = Float64Array.from((() => { const r = readPack2('js/bundled-champion-3p.js'); return r.a; })());
let cap = null;
function tchChooser(state, pid, legal) {
  if (!cap && legal && legal.length >= 2) {
    const econ = T.econBase(state, pid, legal);
    const cands = P.candidatesFor(state, pid, econ, { lockTarget: false }) || [];
    if (cands.length >= 2) {
      let best = -1e9, bi = 0;
      for (let i = 0; i < cands.length; i++) { let v = 0; try { v = Wv.EpirusPolicy.value(state, pid, cands[i].key, refParams, null, cands[i]); } catch (e) {} if (v > best) { best = v; bi = i; } }
      cap = { st: state, pid, cands, want: cands[bi] };
    }
  }
  return Wv.EpirusPolicy.chooseCandidates(state, pid, legal, refParams, { temp: 0.15 });
}
const st = S.createState('long', { next: T.mulberry32(4242) }, 5);
T.oneGameN([tchChooser, B.pickRandom, B.pickRandom, B.pickRandom, B.pickRandom], 77, 5, { mode: st.mode });
if (!cap) { console.log('没采到'); process.exit(1); }
const o = P.forwardCands(cap.st, cap.pid, cap.cands, pv, { wantTape: 1 });
const keys = o.tape.keys;
const TEMP = 0.5;
const t = tailOf(o.logits, keys, TEMP);
console.log('wantKey=' + cap.want.key + ' keys=' + [...keys].join(',') + ' kProb=' + JSON.stringify(t.kProb));
const u = dLogKeyP(cap.want.key, o.logits, keys, TEMP, t);
let nz = 0, unorm = 0;
for (let j = 0; j < u.length; j++) { if (u[j]) nz++; unorm += u[j] * u[j]; }
console.log('upstream 非零 ' + nz + '/' + u.length + ' ‖ |u|=' + Math.sqrt(unorm).toExponential(3));
for (let j = 0; j < u.length; j++) u[j] = -u[j];
const grad = new Float64Array(pv.length);
const a2 = tapeForward(o.tape, pv, ly);
tapeBackward(o.tape, pv, ly, a2, u, grad);
let gn = 0, gnz = 0;
for (let d = 0; d < grad.length; d++) { gn += grad[d] * grad[d]; if (grad[d]) gnz++; }
console.log('grad 非零 ' + gnz + '/' + grad.length + ' ‖ |grad|=' + Math.sqrt(gn).toExponential(3));
/* 激活画像：哪一层全灭 */
const L = ly.L;
const s1 = (arr) => arr.reduce((a, v) => a + Math.abs(v), 0);
console.log('|xin|=' + s1(a2.xin).toExponential(3) + ' ‖ |hctx|=' + s1(a2.hctx).toExponential(3) + ' ‖ |ae0|=' + s1(a2.aes[0]).toExponential(3) + ' ‖ |hc0|=' + s1(a2.hcs[0]).toExponential(3));
console.log('logits=' + [...a2.logits].map(v => v.toFixed(4)).join(',') + ' ‖ headBias=' + pv[ly.headOff + L.hid2]);
console.log('pooled5 |p|=' + s1(a2.pooled).toExponential(3) + ' ‖ es0 |e|=' + s1(a2.ebs5[0]).toExponential(3));
