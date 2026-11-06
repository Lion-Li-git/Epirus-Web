import { sandbox } from '../tools/audit-lib.mjs';
import { install, readPack2 } from '../tools/proto2/arch2.mjs';
const nm = process.argv[2];
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2('scratch/arms/' + nm + '.bak');
const A = install(W, Object.assign({ mutMode: 'seg' }, raw.dims));
A.rngRef.r = T.mulberry32(4242);
const params = P.unpack(raw);
const sh = P.shapeOf(params);
console.log(nm + '：shapeOf(本包 params)=' + JSON.stringify(sh) + ' ‖ L.n=' + A.L.n);
const pk = T.policyChooserN(params, 0.15);
const ch = [];
let chooserCalls = 0;
for (let pid = 0; pid < 5; pid++) {
  if (pid === 0) { ch.push((s, p, legal) => { chooserCalls++; return pk(s, p, legal); }); continue; }
  ch.push((s, p, legal) => { const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: null }) || []; const ji = cs.find((c) => c.key === 'ji'); return ji ? { key: ji.key } : { key: R.SK.JI }; });
}
const f0 = A.CNT.forwards, c0 = A.CNT.cands;
const rm = T.oneGameN(ch, 777, 5, { regen: 0, mode: 'multi' });
console.log('   被测席被问 ' + chooserCalls + ' 次 ‖ 2.0 forwardCands 涨 ' + (A.CNT.forwards - f0) + ' ‖ 候选打分涨 ' + (A.CNT.cands - c0));
console.log('   winner=' + rm.winner + ' ‖ 回合 ' + rm.state.round + ' ‖ 被测席前 6 手=' + (rm.state.events || []).filter((e) => e.type === 'action' && e.pid === 0).slice(0, 6).map((e) => e.key).join(','));
