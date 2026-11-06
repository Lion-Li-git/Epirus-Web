/* 在 oneGameN 的真实调用点里量：logits 是否有限、probs 是否归一、argmax 是哪来的 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install, readPack2 } from '../tools/proto2/arch2.mjs';
const nm = process.argv[2];
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2('scratch/arms/' + nm + '.bak');
const A = install(W, Object.assign({ mutMode: 'seg' }, raw.dims));
A.rngRef.r = T.mulberry32(4242);
const params = P.unpack(raw);
const real = P.forwardCands;
let n = 0;
P.forwardCands = function (state, pid, cands, p2, o) {
  const f = real.apply(null, arguments);
  if (pid === 0 && n < 3 && cands && cands.length > 1) {
    n++;
    const lg = Array.from(f.logits);
    const fin = lg.filter(Number.isFinite).length;
    const sum = Array.from(f.probs).reduce((a, b) => a + b, 0);
    console.log('   第 ' + n + ' 次：候选 ' + cands.length + ' ‖ 有限 logits ' + fin + '/' + lg.length +
      ' ‖ logits[0..2]=[' + lg.slice(0, 3).map((x) => Number(x).toFixed(4)).join(',') + ']' +
      ' ‖ probs 和=' + sum.toFixed(4) + ' ‖ argmax=' + f.argmax + '(' + (cands[f.argmax] || {}).key + ') ‖ cands[0]=' + cands[0].key +
      ' ‖ params 长度=' + (p2 && p2.length) + ' 是否本档=' + (p2 && p2.length === A.L.n));
  }
  return f;
};
const pk = T.policyChooserN(params, 0.15);
const ch = [];
for (let pid = 0; pid < 5; pid++) {
  if (pid === 0) { ch.push((s, p, legal) => pk(s, p, legal)); continue; }
  ch.push((s, p, legal) => { const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: null }) || []; const ji = cs.find((c) => c.key === 'ji'); return ji ? { key: ji.key } : { key: R.SK.JI }; });
}
console.log(nm + '：');
T.oneGameN(ch, 777, 5, { regen: 0, mode: 'multi' });
