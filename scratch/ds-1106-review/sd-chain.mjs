/* 独立复核：终局收缩（环境伤）会不会被铁索连环共享 / 会不会触发藤甲火弱等 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js']) vm.runInNewContext(readFileSync('../../'+f,'utf8'), sb, { filename: f });
const R = sb.EpirusRules, S = sb.EpirusState, X = sb.EpirusResolve;
function mk(){ const st = S.createState('multi', {next:()=>0.9}, 3); st.round = 44; return st; }
// 场景：A 与 B 铁索相连；第 45 回合（收缩起点）全员 -1
const st = mk();
st.p[0].chains = [1]; st.p[1].chains = [0];
X.startTurn(st);
const before = st.p.map(p=>p.hp);
X.endTurn(st);
console.log('起始 HP =', before.join(','), '→ 收缩后 HP =', st.p.map(p=>p.hp).join(','));
console.log('铁索是否被这波环境伤共享 ⇒ A 掉', before[0]-st.p[0].hp, '点，B 掉', before[1]-st.p[1].hp, '点（B 若无共享应只掉 1）');
const dmg = st.events.filter(e=>e.type==='damage');
console.log('伤害事件：', dmg.map(e=>'P'+e.to+'-'+e.amt+'('+e.via+')').join(' '));
console.log('收缩后 chains =', JSON.stringify(st.p.map(p=>p.chains)));