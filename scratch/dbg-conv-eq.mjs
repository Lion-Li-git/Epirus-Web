import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2 } from '../tools/proto2/arch2.mjs';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer;
const A = readPack2('scratch/arms/GD3-SWORD.bak');
const B = readPack2('scratch/arms/OC3C-GD3.bak');
installArch2(W, Object.assign({ mutMode: 'seg', gen: 3, input: 'obs3b' }, A.dims));
const pa = Float64Array.from(P.unpack(A, true));
installArch2(W, Object.assign({ mutMode: 'seg', gen: 3, input: 'obs3c' }, B.dims));
const pb = Float64Array.from(P.unpack(B, true));
function play(params) {
  const ch = T.policyChooserN(params, 0.15, 0, 5, 'soft');
  let w = 0, rounds = 0;
  for (let k = 0; k < 20; k++) {
    const r = T.oneGameN([ch, ch, ch, ch, ch], 98000 + k * 977, 5, { mode: 'long' });
    rounds += r.rounds || 0;
  }
  return rounds;
}
const ra = play(pa), rb = play(pb);
console.log('obs3b rounds total', ra, '| obs3c rounds total', rb, '| equal:', ra === rb);
