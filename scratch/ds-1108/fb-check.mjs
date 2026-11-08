
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
const W = sandbox(); const T = W.EpirusTrainer, B = W.EpirusBots, Play = W.EpirusPlay, S = W.EpirusState;
const p = loadChamp(W, 'scratch/ds-1108/PASS2C-Q-s13.js');
const ch = T.policyChooserN(p, 0.15);
const st = S.createState('multi', { next: T.mulberry32(50000) }, 5);
Play.autoGameN(st, [(s, pid, legal) => ch(s, pid, legal), B.pickFarmer, B.pickFarmer, B.pickFarmer, B.pickFarmer]);
console.log('回合', st.round, 'winner', st.winner, 'HP', st.p.map(x => x.hp).join(','), 'alive', st.p.map(x => x.hp > 0 ? 1 : 0).join(','));
const dmg = st.events.filter(e => e.type === 'damage');
console.log('damage 事件', dmg.length, '样本', JSON.stringify(dmg.slice(0, 3)));
console.log('事件类型', JSON.stringify([...new Set(st.events.map(e => e.type))]));
