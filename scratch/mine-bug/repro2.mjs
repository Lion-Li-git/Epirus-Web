/* 地雷同回合被击杀不触发——复现 v2（严谨版）
 * P0：能埋雷就埋（legal 里有 mine 就选），否则攒珠（ji）。P1：每回合枪→P0。
 * 预期事件链（按 N20①）：mineArm → 枪伤害落身 → mine(direct) 波及 P1。
 * 当前实现：若埋雷同回合的伤害把 P0 打死 ⇒ mineResolveAll 的 hp>0 守卫把 pending 丢弃 ⇒ 无 mine 事件。
 * 判据：存在「同一回合既有 mineArm（或此前 armed 未触发）又有 death(pid=0) 且该回合无 mine 事件」。
 */
import { sandbox } from '../../tools/audit-lib.mjs';

const W = sandbox();
const S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
const st = S.createState('multi', { next: T.mulberry32(12345) }, 2);
const chooser0 = (state, pid, legal) => (legal.find(x => x.key === 'mine') ? legal.find(x => x.key === 'mine') : legal.find(x => x.key === 'ji')) || legal[0];
const chooser1 = (state, pid, legal) => {
  const g = legal.find(x => x.key === 'gun' && x.pid === undefined) || legal.find(x => x.key === 'gun');
  return g || legal[0];
};
Play.autoGameN(st, [chooser0, chooser1]);

let armedSince = null;
console.log('== 事件时序 ==');
for (const e of st.events) {
  const tag = { mineArm: '💣埋雷', mine: '💥雷炸', damage: '伤害', death: '☠死亡', die: '☠死亡', expire: '雷过期' }[e.type] || e.type;
  const who = e.pid !== undefined ? 'P' + e.pid : (e.from !== undefined ? '雷主P' + JSON.stringify(e.from) : '');
  const extra = e.type === 'damage' ? ' to=P' + e.to + ' amt=' + e.amt + ' via=' + e.via : (e.type === 'mineArm' || e.type === 'mine' ? ' round=' + e.round : '');
  if (['mineArm', 'mine', 'death', 'die', 'expire'].includes(e.type) || (e.type === 'damage' && e.to === 0))
    console.log('  r' + e.round + ' ' + tag + ' ' + who + extra);
  if (e.type === 'mineArm') armedSince = e.round;
  if (e.type === 'mine') armedSince = null;
}
const deathRound = (st.events.find(e => (e.type === 'death' || e.type === 'die') && (e.pid === 0 || e.who === 0)) || {}).round;
const mineRounds = st.events.filter(e => e.type === 'mine').map(e => e.round);
console.log('== 判定 ==');
console.log('埋雷回合=' + armedSince + ' ‖ P0 死亡回合=' + deathRound + ' ‖ mine 触发回合=' + (mineRounds.join(',') || '无') + ' ‖ 终局 hp P0=' + st.p[0].hp + ' P1=' + st.p[1].hp);
const bug = armedSince !== null && deathRound !== undefined && !mineRounds.includes(deathRound);
console.log(bug
  ? '⛔ 复现成立：armed 的雷在雷主被击杀的同一回合没有触发（N20① 按文义应当炸：伤害已落到持有者身上）'
  : '⚠ 本局没有复现到同回合击杀场景（换种子/调预算再试）');
