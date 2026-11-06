import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js']) vm.runInNewContext(readFileSync(f,'utf8'), sb, { filename: f });
const R = sb.EpirusRules, S = sb.EpirusState, X = sb.EpirusResolve;
const st = S.createState('multi', {next:()=>0.9}, 3); st.round = 44;
st.p[0].chains = [1]; st.p[1].chains = [0];
X.startTurn(st); const b = st.p.map(p=>p.hp); X.endTurn(st);
console.log('收缩后 HP =', st.p.map(p=>p.hp).join(','), '（期望 2,2,2）');
console.log('连边 =', JSON.stringify(st.p.map(p=>p.chains)), '（期望 [[1],[0],[]] 不被消耗）');
// 回归：普通伤害仍要共享并消耗
const st2 = S.createState('multi', {next:()=>0.9}, 3); st2.p[0].chains=[1]; st2.p[1].chains=[0];
X.deliverDamage(st2, { amt:1, type:R.DMG.NORMAL, source:2, via:R.SK.GUN }, 0, {reason:'枪'});
console.log('普通枪伤后 HP =', st2.p.map(p=>p.hp).join(','), '（期望 2,2,3）‖ 连边 =', JSON.stringify(st2.p.map(p=>p.chains)));