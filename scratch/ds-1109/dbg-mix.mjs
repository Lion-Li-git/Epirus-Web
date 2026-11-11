
import { sandbox } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer; const B = W.EpirusBots;
const ch = [B.pickMixAttack, B.pickMixAttack, B.pickMixAttack, B.pickMixAttack, B.pickMixAttack];
const st = T.oneGameN(ch, 42, 5, { mode: 'multi' });
for (const ev of (st.state.events || [])) {
  if (ev.type === 'action' && ev.pid === 0) console.log('r' + (ev.round||'?') + ' key=' + ev.key + ' outcome=' + ev.outcome);
}
