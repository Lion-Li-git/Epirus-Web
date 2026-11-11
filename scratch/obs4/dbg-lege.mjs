/* 腿 E 定位：arch2 tape vs policy2 tape，第一处分歧在哪个字段 */
import { sandbox } from '../../tools/audit-lib.mjs';
import { install as installArch2 } from '../../tools/proto2/arch2.mjs';
import { readFileSync } from 'node:fs';
function readPack2(path) {
  const s = readFileSync(path, 'utf8');
  const m = s.match(/EPIRUS_CHAMPION_3P = (\{.*\});?\s*$/s) || s.match(/EPIRUS_CHAMPION_3P = (\{.*?\});/s);
  return m ? JSON.parse(m[1]) : null;
}
const W = sandbox();
const raw = readPack2('scratch/obs4/mini-obs4.js');
installArch2(W, { input: raw.dims.input, gen: raw.dims.gen, keySplit: raw.dims.keySplit, seatH: raw.dims.seatH, actH: raw.dims.actH, hid: raw.dims.hid, hid2: raw.dims.hid2, skills: raw.skills, mutMode: 'seg' });
const P = W.EpirusPolicy, P2 = W.EpirusPolicy2, S = W.EpirusState, T = W.EpirusTrainer, B = W.EpirusBots;
console.log('P2 存在?', !!P2);
const params = new Float64Array(P.paramCount());
const up = P.unpack(raw, true); params.set(up);
const container = P.pack(params, W);
const p2 = P2.unpack(container, W);
console.log('p2 读出?', !!p2, '长度', p2 && p2.length);
/* 造一个决策点 */
let cap = null;
function chooser(state, pid, legal) {
  if (!cap && legal && legal.length >= 2) {
    const econ = T.econBase(state, pid, legal);
    const cands = P.candidatesFor(state, pid, econ, { lockTarget: false }) || [];
    if (cands.length >= 2) cap = { st: state, pid, cands };
  }
  return P.chooseCandidates(state, pid, legal, params, { temp: 0.3 });
}
const st = S.createState('multi', { next: T.mulberry32(4242) }, 5);
T.oneGameN([chooser, B.pickRandom, B.pickRandom, B.pickRandom, B.pickRandom], 77, 5, { mode: st.mode });
const { st: stt, pid, cands } = cap;
const fa = P.forwardCands(stt, pid, cands, params, { temp: 0.15, wantTape: 1 });
const fb = P2.forwardCands(W, stt, pid, cands, p2, { temp: 0.15, wantTape: 1 });
console.log('xin len', fa.tape.xin.length, fb.tape.xin.length, 'svs', fa.tape.svs.length, fb.tape.svs.length, 'afs', fa.tape.afs.length, fb.tape.afs.length);
let bad = 0, first = '';
for (let j = 0; j < Math.max(fa.tape.xin.length, fb.tape.xin.length); j++) {
  if (fa.tape.xin[j] !== fb.tape.xin[j]) { bad++; if (!first) first = 'xin[' + j + '] A=' + fa.tape.xin[j] + ' B=' + fb.tape.xin[j]; }
}
console.log('xin 分歧 ' + bad + ' 处 ‖ ' + first);
for (let s = 0; s < Math.min(fa.tape.svs.length, fb.tape.svs.length); s++) {
  if (fa.tape.svs[s].id !== fb.tape.svs[s].id) { console.log('svs[' + s + '] id A=' + fa.tape.svs[s].id + ' B=' + fb.tape.svs[s].id); break; }
  let sb = 0;
  for (let j = 0; j < fa.tape.svs[s].sv.length; j++) if (fa.tape.svs[s].sv[j] !== fb.tape.svs[s].sv[j]) sb++;
  if (sb) { console.log('svs[' + s + '] sv 分歧 ' + sb + '/' + fa.tape.svs[s].sv.length + ' 维 ‖ A[0..3]=' + [...fa.tape.svs[s].sv.slice(0, 4)] + ' B[0..3]=' + [...fb.tape.svs[s].sv.slice(0, 4)]); break; }
}
/* 补：svs[0] 哪一维分歧 */
for (let s = 0; s < fa.tape.svs.length; s++) {
  for (let j = 0; j < fa.tape.svs[s].sv.length; j++) {
    if (fa.tape.svs[s].sv[j] !== fb.tape.svs[s].sv[j]) {
      const lbl = j < 29 ? 'public[' + j + ']' : j < 34 ? 'rel[' + (j - 29) + ']' : 'isSelf';
      console.log('seat id=' + fa.tape.svs[s].id + ' 分歧维 ' + j + ' (' + lbl + ') A=' + fa.tape.svs[s].sv[j] + ' B=' + fb.tape.svs[s].sv[j]);
    }
  }
}
