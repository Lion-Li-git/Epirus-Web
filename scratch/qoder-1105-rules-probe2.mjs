/* 取证第二遍（Qoder · 11-05）：大雷禁用到底禁几个回合（用菜单可见性判，不用 invalid 事件猜）
 * ‖ 相抵对照组换成真走 clashPass 的对子（大雷那条是"无效化"不是"相抵"，上一版把两件事混了）
 */
import { sandbox } from '../tools/audit-lib.mjs';
const W = sandbox();
const R = W.EpirusRules, SK = R.SK, S = W.EpirusState, X = W.EpirusResolve, Play = W.EpirusPlay;

function noJudge() { return { next: () => 0.9 }; }
function mk(mode, n) { const st = S.createState(mode, noJudge(), n); for (let i = 0; i < n; i++) st.p[i].ep = 12; return st; }
function pick(st, pid, key, opt) {           // 只登记动作，不结算
  st.events = []; X.startTurn(st); const a = S.attemptAction(st, pid, key, opt); return { cd: st.p[pid].cooldown[SK.SWORD] || 0, outcome: a && a.outcome, menu: (Play.legalActions(st, pid) || []).some((l) => l.key === SK.SWORD) };
}
function settle(st) { X.resolveActions(st); X.endTurn(st); return st.events.slice(); }

console.log('== 大雷禁用逐回合（2P · P0 大雷 P1，P1 当回合用激光剑） ==');
{
  const st = mk('standard', 2); st.p[0].hp = 6; st.p[1].hp = 6;
  st.events = []; X.startTurn(st);
  S.attemptAction(st, 0, SK.BIG_T, null); S.attemptAction(st, 1, SK.SWORD, null);
  const e0 = settle(st);
  const swordVoided = e0.some((e) => /void/.test(e.type) && e.pid === 1);
  console.log('  命中回合 r   ：cd(写)=? 结算后 cd=' + (st.p[1].cooldown[SK.SWORD] || 0) +
    ' ‖ 激光剑被无效化=' + swordVoided + ' ‖ ban 事件=' + JSON.stringify(e0.filter((e) => e.type === 'ban').map((e) => ({ turns: e.turns, skill: e.skill }))));
  for (let r = 1; r <= 5; r++) {
    const a = pick(st, 1, SK.SWORD, null);
    const hpBefore = st.p[0].hp;
    S.attemptAction(st, 0, SK.JI, null);
    const e = settle(st);
    console.log('  第 +' + r + ' 回合   ：决策时 cd=' + a.cd + ' ‖ 菜单里有激光剑=' + a.menu + ' ‖ attempt 结果=' + a.outcome +
      ' ‖ 这一手打出去了吗=' + (st.p[0].hp < hpBefore ? '打了' : '没打') + ' ‖ ban 事件=' + e.filter((x) => x.type === 'ban').length);
  }
  console.log('  文档口径：docs/RULES-NP.md:324「命中后禁用 3 个回合」‖ rules-panel.js:73「禁用 4 回合」‖ 对局日志(ui.js)「禁用 3 回合」');
}

console.log('\n== 相抵对照组（这一组才真走 clashPass） ==');
function clashCase(label, kA, kB, nPri) {
  const st = mk('multi', 3);
  st.events = []; X.startTurn(st);
  S.attemptAction(st, 0, kA, { target: 1, target2: 2 });
  S.attemptAction(st, 1, kB, { target: 0 });
  S.attemptAction(st, 2, SK.JI, null);
  const e = settle(st);
  const cl = e.filter((x) => /clash|抵消/.test(JSON.stringify(x))).length;
  console.log('  ' + label + '：pri ' + R.byKey[kA].pri + ' vs pri ' + R.byKey[kB].pri +
    ' ‖ 相抵事件=' + cl + ' ‖ P0 hp=' + st.p[0].hp + ' ‖ P1 hp=' + st.p[1].hp + '(相抵则两边都不掉血=6)');
}
clashCase('枪 vs 枪（都在 ATK_EFFECT，同层互指）  ', SK.GUN, SK.GUN);
clashCase('激光剑 vs 坦克（都在 ATK_EFFECT，同层）', SK.SWORD, SK.TANK);
clashCase('双枪 vs 激光剑（同层互指）                ', SK.DUAL_GUN, SK.SWORD);
clashCase('双枪(pri3) vs 枪(pri2)（高优先级该阻止低的）', SK.DUAL_GUN, SK.GUN);

console.log('\n== 狙击干扰对照 ==');
function snipeCase(label, kProt) {
  const st = mk('multi', 3);
  st.events = []; X.startTurn(st);
  S.attemptAction(st, 0, SK.SNIPE, { target: 1 });
  S.attemptAction(st, 1, kProt, kProt === SK.DUAL_GUN ? { target: 0, target2: 2 } : { target: 0 });
  S.attemptAction(st, 2, SK.JI, null);
  const e = settle(st);
  const inter = e.some((x) => x.type === 'void' && x.pid === 0);
  console.log('  ' + label + '：狙击被干扰=' + inter + ' ‖ P1 hp=' + st.p[1].hp + '(狙击成立则 -1=5) ‖ P0 hp=' + st.p[0].hp);
}
snipeCase('激光剑指狙击手（对照组）        ', SK.SWORD);
snipeCase('双枪指狙击手（该按枪的口径干扰）', SK.DUAL_GUN);
