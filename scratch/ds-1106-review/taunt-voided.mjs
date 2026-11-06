/* 独立复核：被无效化的一手算不算「挑衅履约」？（两回合版） */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js']) vm.runInNewContext(readFileSync('../../'+f,'utf8'), sb, { filename: f });
const R = sb.EpirusRules, S = sb.EpirusState, X = sb.EpirusResolve;
const st = S.createState('multi', {next:()=>0.9}, 3);
X.startTurn(st);
st.p[0].ep = 5; st.p[1].ep = 5; st.p[2].ep = 5;
S.attemptAction(st, 0, R.SK.TAUNT, { target: 1 });
S.attemptAction(st, 1, R.SK.JI, {});
S.attemptAction(st, 2, R.SK.JI, {});
X.resolveActions(st); X.endTurn(st);
console.log('第1回合末 tauntActive(P1) =', st.p[1].tauntActive, '‖ 挑主名单 =', JSON.stringify(st.p[1].tauntBy));
X.startTurn(st);
st.p[1].ep = 5; st.p[2].ep = 5;
S.attemptAction(st, 1, R.SK.GUN, { target: 0 });     // P1 履约：打挑主
S.attemptAction(st, 2, R.SK.MINI_T, { target: 1 });  // P2 把小雷打在 P1 身上 ⇒ 枪被作废
S.attemptAction(st, 0, R.SK.JI, {});
X.resolveActions(st);
console.log('作废事件 =', JSON.stringify(st.events.filter(e=>e.type==='voided')));
const hpBefore = st.p[1].hp;
X.endTurn(st);
const tc = st.events.filter(e=>e.type==='tauntCheck');
console.log('挑衅检查 =', JSON.stringify(tc), '‖ P1 HP', hpBefore, '→', st.p[1].hp);
console.log('结论 = 被打断的一枪' + ((tc[0]&&tc[0].ok) ? '仍算履约（不扣血）' : '不算履约（−1 血）'));
