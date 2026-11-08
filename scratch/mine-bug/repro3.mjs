/* 地雷同回合被击杀不触发——复现 v3（确定性注入版）
 * 2 人局。开局注入：P0 hp=1、mineArmed=true、mineTurns=3、mineRound=1（等价于"上一手刚埋的活雷"）。
 * P0 只攒钱；P1 能双枪就双枪（同回合两段枪伤），否则攒珠。
 * 预期（N20① 文义）：第一段枪伤害落到 armed 持有者身上 ⇒ 雷炸 ⇒ P1 受 1（hp3→2）。
 * 当前实现：两段伤害结完才统一引爆 ⇒ 此时 P0 已死 ⇒ hp>0 守卫丢 pending ⇒ 无 mine 事件，P1 hp3。
 */
import { sandbox } from '../../tools/audit-lib.mjs';

const W = sandbox();
const S = W.EpirusState, T = W.EpirusTrainer, Play = W.EpirusPlay;
const st = S.createState('multi', { next: T.mulberry32(12345) }, 2);
st.p[0].hp = 1;
st.p[0].mineArmed = true;
st.p[0].mineTurns = 3;
st.p[0].mineRound = 1;
const chooser0 = (state, pid, legal) => legal.find(x => x.key === 'ji') || legal[0];
const chooser1 = (state, pid, legal) => legal.find(x => x.key === 'dualGun') || legal.find(x => x.key === 'ji') || legal[0];
Play.autoGameN(st, [chooser0, chooser1]);

console.log('== 事件时序 ==');
let sawArm = false;
for (const e of st.events) {
  if (e.type === 'mineArm') sawArm = true;
  const tag = { mineArm: '💣埋雷', mine: '💥雷炸', death: '☠死亡', die: '☠死亡', mineExpire: '雷过期' }[e.type];
  if (tag) console.log('  ' + tag + ' pid=' + (e.pid ?? JSON.stringify(e.from)));
  if (e.type === 'damage') console.log('  💥伤害 to=P' + e.to + ' amt=' + e.amt + ' via=' + e.via + (e.reason ? '(' + e.reason + ')' : ''));
}
console.log('== 判定 ==');
console.log('终局 hp：P0=' + st.p[0].hp + ' P1=' + st.p[1].hp);
const mineFired = st.events.some(e => e.type === 'mine');
console.log(!mineFired && st.p[0].hp <= 0
  ? '⛔ 复现成立：armed 雷 + 同回合被击杀 ⇒ 雷没炸（N20① 文义应炸：P1 应 -1 血 = hp2）'
  : mineFired ? '✅ 雷炸了（P1 应为 hp2）：' + st.p[1].hp : '⚠ 场景没走到（P1 没能在雷过期前打出双枪）');
