/* 地雷同回合被击杀不触发——复现脚本
 * 场景：2 人局，P0 每回合埋雷，P1 每回合枪→P0（1 伤）。
 *   R1: P0 hp3→2，雷炸（P1 hp3→2）—— ✓ 正常
 *   R2: P0 hp2→1，雷炸（P1 hp2→1）—— ✓ 正常
 *   R3: P0 hp1→0 死亡，雷【应炸】（N20①：被非狙攻击且伤害落身 ⇒ 全场其他存活角色各 1）—— 当前实现：不炸
 * 预期（按规则书）：R3 有 mine 事件、P1 hp 0（同归于尽）；当前：R3 无 mine 事件、P1 hp 1。
 */
import { sandbox } from '../../tools/audit-lib.mjs';

const W = sandbox();
const S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
const st = S.createState('multi', { next: T.mulberry32(12345) }, 2);
const chooser0 = () => 'mine';
const chooser1 = (state, pid, legal) => {
  const c = legal.find(x => (x.key === 'gun'));
  return c || legal[0];
};
Play.autoGameN(st, [chooser0, chooser1]);
const mineEvents = st.events.filter(e => e.type === 'mine');
const deaths = st.events.filter(e => e.type === 'death' || (e.type === 'die'));
console.log('回合数=' + st.round + ' ‖ mine 事件 ' + mineEvents.length + ' 个（回合=' + mineEvents.map(e => e.round).join(',') + '）');
for (const e of mineEvents) console.log('  mine: round=' + e.round + ' kind=' + e.kind + ' from=' + JSON.stringify(e.from));
console.log('终局 hp：P0=' + st.p[0].hp + ' P1=' + st.p[1].hp + '（按规则书应为 0/0：R3 的雷要炸掉 P1 最后 1 血）');
const r3mine = mineEvents.some(e => e.round === 3);
console.log(r3mine ? '✅ R3 的雷触发了（无 bug？）' : '⛔ R3 的雷没触发——复现成功：雷主同回合被击杀 ⇒ pending 被丢弃（resolve.js mineResolveAll 的 hp>0 守卫）');
