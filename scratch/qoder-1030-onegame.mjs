/* 单进程一枚包：走 game-record 的同一条路，印被测席前 8 手 + 结果 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install, readPack2 } from '../tools/proto2/arch2.mjs';
const nm = process.argv[2];
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const raw = readPack2('scratch/arms/' + nm + '.bak');
const A = install(W, Object.assign({ mutMode: 'seg' }, raw.dims));
A.rngRef.r = T.mulberry32(4242);
const params = P.unpack(raw);
const pk = T.policyChooserN(params, 0.15);
const seen = [];
const ch = [];
for (let pid = 0; pid < 5; pid++) {
  if (pid === 0) { ch.push((s, p, legal) => { const a = pk(s, p, legal); seen.push(a.key); return a; }); continue; }
  ch.push((s, p, legal) => { const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: null }) || []; const ji = cs.find((c) => c.key === 'ji'); return ji ? { key: ji.key } : { key: R.SK.JI }; });
}
const rm = T.oneGameN(ch, 777, 5, { regen: 0, mode: 'multi' });
const applied = (rm.state.actions || []).map((a) => a ? a.key : '-').join(',');
const focusEvents = (rm.state.events || []).filter((e) => e.type === 'action' && e.pid === 0).map((e) => e.key).slice(0, 8).join(',');
console.log(nm + ' ‖ params=' + (params && params.length) + ' ‖ 我的 chooser 看到前 8 手=' + seen.slice(0, 8).join(','));
console.log('   引擎实际记到 pid0 的前 8 手=' + focusEvents + ' ‖ 终局 ' + rm.state.round + ' 回合 winner=' + rm.winner);
