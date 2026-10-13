/* curse-landing.mjs —— 贴贴到底**落没落上身**（挡成率 + 谁挡的 + 活符咒历史最大值）
 * 为什么单开一台：CARD-VALUE §8 的 P4 门槛要看"活符咒"，而那件事被防御挡掉的比例只有事件层看得见。
 * 用法：node docs/debug/curse-landing.mjs：贴贴到底**落没落上身**（引爆凑不满 3 枚的两个候选原因：被防御挡 / 过期） */
import { sandbox } from '../../tools/audit-lib.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const W = sandbox(ROOT);
const S = W.EpirusState, P = W.EpirusPlay, BT = W.EpirusBots, R = W.EpirusRules, SK = R.SK;
const rndOf = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const style = BT.STYLES.find(s => s.id === 'st:toolkit');
let curseOk = 0, blocked = 0, maxLive = 0, fire = 0, rounds = 0, games = 0;
const blockBy = {};
for (let g = 0; g < 40; g++) {
  const st = S.createState('multi', { next: rndOf(20261013 + g) }, 5);
  st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
  const wrapped = (state, pid, legal) => {
    let live = 0;
    for (let i = 0; i < state.p.length; i++) { if (i === pid) continue;
      const s = state.p[i].stickers || [];
      for (const x of s) if (x.owner === pid && x.age <= 3) live++; }
    if (live > maxLive) maxLive = live;
    const r = style.pick(state, pid, legal);
    return r;
  };
  const ch = []; for (let i = 0; i < 5; i++) ch.push(wrapped);
  P.autoGameN(st, ch);
  games++; rounds += st.round;
  for (const e of st.events) {
    if (e.type === 'action' && e.outcome === 'ok' && e.key === SK.CURSE) curseOk++;
    if (e.type === 'curseBlock') { blocked++; blockBy[e.by] = (blockBy[e.by] || 0) + 1; }
    if (e.type === 'action' && e.outcome === 'ok' && e.key === SK.FIRESTORM) fire++;
  }
}
console.log(games + ' 局 × 5 席 · 局长 ' + (rounds / games).toFixed(1) + ' 回合');
console.log('贴贴**落地**（outcome ok）：' + curseOk + ' 次 ‖ 被挡（curseBlock）：' + blocked + ' 次 ‖ 挡成率 ' +
  (curseOk + blocked ? (blocked / (curseOk + blocked) * 100).toFixed(1) : '-') + '%');
console.log('一席身上"我的活符咒"历史最大值：' + maxLive + ' 枚 ‖ 天火落地 ' + fire + ' 次');
console.log('是被哪种防御挡的：' + Object.entries(blockBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => (R.byKey[k] ? R.byKey[k].name : k) + '×' + v).join(' ‖ '));
