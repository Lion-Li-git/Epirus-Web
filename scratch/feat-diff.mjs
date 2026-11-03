/* 上一张表说 S1 对 p5..p7 也有反应 ⇒ 那就必须分清：是**逐席编码**看见了，还是只通过**全局聚合**碰了一下。
 * 做法：直接 diff v7 自己那份 `P.features(state,pid,FEAT_S)`（213 维），把"哪些维变了"报出来，
 *   再对照 `arch2` 的切片常量（base 63 ‖ 对手槽 4×10 ‖ 历史 4+4×4 ‖ T 5×4 ‖ B 5×14）。 */
import { sandbox } from '../tools/audit-lib.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState;
const BASE = 63, OPP_BLK = 10, OPP_SLOTS = 4, HIST_ME = 4, T_BLK = 4, B_BLK = 14, PLAYER_SLOTS = 5;
const OFF_OPP = BASE, OFF_HIST_T = OFF_OPP + OPP_SLOTS * OPP_BLK + HIST_ME + OPP_SLOTS * 4, OFF_T = OFF_HIST_T, OFF_B = OFF_T + PLAYER_SLOTS * T_BLK;
function zoneOf(i) {
  if (i < BASE) return 'base(局面 63)';
  if (i < OFF_OPP + OPP_SLOTS * OPP_BLK) return '对手槽 ' + Math.floor((i - OFF_OPP) / OPP_BLK);
  if (i < OFF_HIST_T) return '历史块';
  if (i < OFF_B) return 'T 槽 ' + Math.floor((i - OFF_T) / T_BLK);
  if (i < OFF_B + PLAYER_SLOTS * B_BLK) return 'B 槽 ' + Math.floor((i - OFF_B) / B_BLK);
  return '尾段(超出切片)';
}
const N = 8;
const st = S.createState('multi', { next: () => 0.37 }, N);
st.rng = { next: () => 0.37 };
const HPS = [3, 1, 1, 1, 1, 3, 3, 3];
st.p.forEach((q, i) => { q.hp = HPS[i]; q.ep = 4 + (i % 3); });
const f0 = Array.from(P.features(st, 0, P.FEAT_S));
console.log('# FEAT_S 长度 = ' + f0.length + ' ‖ 切片算出来的宽度 = ' + (OFF_B + PLAYER_SLOTS * B_BLK));
for (let k = 1; k < N; k++) {
  const st2 = S.cloneState(st); st2.rng = { next: () => 0.37 };
  st2.p[k].ep = 11;
  const f1 = Array.from(P.features(st2, 0, P.FEAT_S));
  const diff = [];
  for (let i = 0; i < Math.max(f0.length, f1.length); i++) if (Math.abs((f0[i] || 0) - (f1[i] || 0)) > 1e-12) diff.push(i + '@' + zoneOf(i));
  const slots = (P.oppSlots(st2, 0) || []).join(',');
  console.log('  扰动 p' + k + ' 的 ep→11 ‖ 变了 ' + diff.length + ' 维 [' + diff.slice(0, 8).join(' ') + (diff.length > 8 ? ' …' : '') + '] ‖ 该桌 oppSlots 序=' + slots);
}
