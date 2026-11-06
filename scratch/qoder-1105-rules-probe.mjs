/* 规则口径取证（Qoder · 11-05）——地雷 / 大雷禁用 / 双枪攻击效果
 * 用产品沙箱（tools/audit-lib.sandbox ⇒ 与页面同一份 js/core/**），照 tests/spec.js 那套驱动形状打回合。
 * 只读，不改任何文件。
 */
import { sandbox } from '../tools/audit-lib.mjs';

const W = sandbox();
const R = W.EpirusRules, SK = R.SK, S = W.EpirusState, X = W.EpirusResolve, Rr = W.EpirusRules;
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

function noJudge() { return { next: function () { return 0.9; } }; }   // 判定恒败（与 spec.js 同口径）
function mk(mode, n) { const st = S.createState(mode, noJudge(), n); for (let i = 0; i < n; i++) st.p[i].ep = 12; return st; }
function round(st, picks) {                       // picks[pid] = [key, opt] 或 null(=ジ)
  st.events = [];
  X.startTurn(st);
  for (let pid = 0; pid < st.n; pid++) {
    const p = picks[pid];
    S.attemptAction(st, pid, p ? p[0] : SK.JI, p ? p[1] : null);
  }
  X.resolveActions(st);
  X.endTurn(st);
  return st.events.slice();
}
const evs = (ev, type) => ev.filter((e) => e.type === type).length;
const has = (ev, pred) => ev.some(pred);
function line(k, v) { console.log('  ' + k + ' = ' + v); }

console.log('== 0. 卡片口径（真源 rules.js 的表） ==');
for (const key of ['gun', 'sword', 'tank', 'snipe', 'dualGun', 'mirror', 'guard', 'proto', 'bigT']) {
  const d = Rr.byKey[key]; if (!d) continue;
  console.log('   ' + (key + '        ').slice(0, 10) + '费用 ' + d.cost + ' ‖ 优先级 ' + d.pri + ' ‖ 类别 ' + d.cat +
    ' ‖ 在 ATK_EFFECT=' + (Rr.ATK_EFFECT.indexOf(key) >= 0) + ' ‖ 在 MINE_TRIGGER=' + '见 resolve 内');
}

console.log('\n== A. 地雷：两种读法各测一遍 ==');
console.log('   读法①(用户/文档 R39)：防御与原型**挡不住触发**，也挡不住雷炸出来的火');
console.log('   读法②(代码注释)：伤害必须真落地才挂雷，雷是反击');
{ /* A1 埋雷方本回合用防御，对面开枪 */
  const st = mk('standard', 2); st.p[1].mineArmed = true;
  const ev = round(st, [[SK.GUN, null], [SK.GUARD, null]]);
  console.log(' A1 2P 埋雷者摆【防御】+ 对面开枪 ⇒ 被防御=' + evs(ev, 'blocked') +
    ' ‖ 开枪者 hp=' + st.p[0].hp + '(雷炸则 2) ‖ 埋雷者 hp=' + st.p[1].hp + ' ‖ 雷还 armed=' + st.p[1].mineArmed);
}
{ /* A2 埋雷方用原型制御 */
  const st = mk('standard', 2); st.p[1].mineArmed = true;
  const ev = round(st, [[SK.GUN, null], [SK.PROTO, null]]);
  console.log(' A2 2P 埋雷者摆【原型制御】+ 对面开枪 ⇒ 被挡=' + evs(ev, 'blocked') +
    ' ‖ 开枪者 hp=' + st.p[0].hp + '(雷炸则 2)');
}
{ /* A3 雷炸出来的火，第三方摆防御挡不挡得住（3P） */
  const st = mk('multi', 3); st.p[1].mineArmed = true;
  const ev = round(st, [[SK.GUN, { target: 1 }], [SK.JI, null], [SK.GUARD, null]]);
  console.log(' A3 3P P0 枪中埋雷者 P1 ⇒ 雷炸；P2 摆【防御】 ⇒ P2 hp=' + st.p[2].hp +
    '(挡得住=3 ‖ 挡不住=2) ‖ mine 事件=' + evs(ev, 'mine') + evs(ev, 'mineTrigger') + ' ‖ P2 被挡=' +
    has(ev, (e) => e.type === 'blocked' && e.to === 2));
}
{ /* A4 第三方摆原型制御 */
  const st = mk('multi', 3); st.p[1].mineArmed = true;
  const ev = round(st, [[SK.GUN, { target: 1 }], [SK.JI, null], [SK.PROTO, null]]);
  console.log(' A4 同上但 P2 摆【原型制御】 ⇒ P2 hp=' + st.p[2].hp + '(雷火按口径不该被挡)');
}
{ /* A5 狙击不触发雷（两份文档都这么写） */
  const st = mk('standard', 2); st.p[1].mineArmed = true;
  const ev = round(st, [[SK.SNIPE, null], [SK.JI, null]]);
  console.log(' A5 2P 对面【狙击】埋雷者 ⇒ 狙击手 hp=' + st.p[0].hp + '(不触发=3) ‖ 雷还 armed=' + st.p[1].mineArmed);
}
{ /* A6 被反弹的伤害算不算"受到攻击" */
  const st = mk('standard', 2); st.p[1].mineArmed = true;
  const ev = round(st, [[SK.GUN, null], [SK.REFLECT, null]]);
  console.log(' A6 2P 埋雷者用【反弹】+ 对面开枪 ⇒ 反弹=' + evs(ev, 'reflect') +
    ' ‖ 开枪者 hp=' + st.p[0].hp + '(反弹回来 1 点；雷再炸会 -2) ‖ 埋雷者 hp=' + st.p[1].hp);
}
{ /* A7 大雷能不能触发雷（MINE_TRIGGER 含 bigT） */
  const st = mk('standard', 2); st.p[1].mineArmed = true;
  const ev = round(st, [[SK.BIG_T, null], [SK.JI, null]]);
  console.log(' A7 2P 对面【大雷】打埋雷者 ⇒ 开枪者 hp=' + st.p[0].hp + '(3-2电=1；雷再炸=-1 火=0)');
}

console.log('\n== B. 大雷禁用：到底禁几回合、当回合计不计入 ==');
{
  const st = mk('standard', 2);
  st.p[0].hp = 5; st.p[1].hp = 5;
  const r0 = round(st, [[SK.BIG_T, null], [SK.SWORD, null]]);   // P0 大雷打 P1；P1 当回合用激光剑
  const cd = st.p[1].cooldown && st.p[1].cooldown[SK.SWORD];
  const disEv = r0.filter((e) => /disable|cooldown|禁/i.test(JSON.stringify(e)));
  console.log(' B0 命中当回合：P1 cooldown[SWORD]=' + cd + ' ‖ 相关事件=' + JSON.stringify(disEv.map((e) => ({ t: e.type, k: e.key, turns: e.turns }))).slice(0, 160));
  const seq = [];
  for (let r = 1; r <= 5; r++) {
    st.events = []; X.startTurn(st);
    const a = S.attemptAction(st, 1, SK.SWORD, null);
    const rec = { ep: st.p[1].ep, outcome: a && a.outcome, eff: st.actions && st.actions[1] && st.actions[1].effect };
    st.p[0].ep = 12; st.p[1].ep = 12;
    X.resolveActions(st); X.endTurn(st);
    const rej = has(st.events, (e) => e.type === 'invalid' && e.pid === 1);
    seq.push('第+' + r + '回合:' + (rej ? '被拒' : '可用') + '(cd=' + (st.p[1].cooldown[SK.SWORD] || 0) + ')');
  }
  console.log(' B1 之后逐回合再出【激光剑】 ⇒ ' + seq.join(' ‖ '));
  console.log('    文档 RULES-NP.md:324 写"禁用 3 个回合" ‖ rules-panel.js:73 写"禁用 4 回合" ‖ ui.js 日志写"禁用 3 回合"');
}
{
  /* 防御族豁免还在不在：P1 当回合用防御，被大雷打 */
  const st = mk('standard', 2); st.p[0].hp = 5; st.p[1].hp = 5;
  const e = round(st, [[SK.BIG_T, null], [SK.GUARD, null]]);
  console.log(' B2 目标当回合用【防御】 ⇒ P1 hp=' + st.p[1].hp + '(挡住=5) ‖ cooldown[GUARD]=' + (st.p[1].cooldown[SK.GUARD] || 0));
}

console.log('\n== C. 双枪：该不该进 ATK_EFFECT（当前=没进） ==');
{
  /* C1 狙击干扰：3P，P0 狙击 P1，P1 双枪指着 P0 和 P2 ⇒ 按原始规则狙击应无效 */
  const st = mk('multi', 3);
  const e = round(st, [[SK.SNIPE, { target: 1 }], [SK.DUAL_GUN, { target: 0, target2: 2 }], [SK.JI, null]]);
  console.log(' C1 P0【狙击】P1，P1【双枪】打 P0+P2 ⇒ 狙击被干扰=' + has(e, (x) => x.type === 'void' && /干扰/.test(JSON.stringify(x))) +
    ' ‖ P0 hp=' + st.p[0].hp + '(狙击无效则吃双枪 1 点=11，狙击成立则 11-2=…)' +
    ' ‖ P1 hp=' + st.p[1].hp + '(狙击命中则 11-1) ‖ P2 hp=' + st.p[2].hp);
}
{
  /* C2 同优先级相抵：双枪(pri3) 与 激光剑(pri3) 互为目标 ⇒ 按"相同优先级攻击相抵"应双双无效 */
  const st = mk('multi', 3);
  const e = round(st, [[SK.DUAL_GUN, { target: 1, target2: 2 }], [SK.SWORD, { target: 0 }], [SK.JI, null]]);
  console.log(' C2 P0【双枪 pri' + Rr.byKey[SK.DUAL_GUN].pri + '】↔ P1【激光剑 pri' + Rr.byKey[SK.SWORD].pri + '】互为目标 ⇒ 相抵=' +
    has(e, (x) => x.type === 'clash') + ' ‖ P0 hp=' + st.p[0].hp + ' ‖ P1 hp=' + st.p[1].hp + '(相抵则都 11)');
}
{
  /* C3 高优先级阻止低优先级：大雷(pri4) 该阻止 枪(pri2) —— 对照组，证明这条路本身在工作的 */
  const st = mk('multi', 3);
  const e = round(st, [[SK.BIG_T, { target: 1 }], [SK.GUN, { target: 0 }], [SK.JI, null]]);
  console.log(' C3 对照：P0【大雷 pri4】↔ P1【枪 pri2】互指 ⇒ 低优先级被阻止=' +
    has(e, (x) => /block|阻止|void/.test(JSON.stringify(x))) + ' ‖ P0 hp=' + st.p[0].hp + ' ‖ P1 hp=' + st.p[1].hp);
}
console.log('\n⇒ 本脚本只读；判据解释见回报。');
