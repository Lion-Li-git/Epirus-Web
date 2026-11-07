
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, S = sb.EpirusState, R = sb.EpirusRules, Play = sb.EpirusPlay;
console.log('新脚本已导出：', typeof B.pickMirrorSpam, typeof B.pickDualSpam);
const LEGAL = (keys) => keys.map(k => ({ key: k, affordable: true, cost: 0 }));

/* ① 镜面：刚蓄能优先于 ep 最多 */
let st = S.createState('multi', { next: T.mulberry32(11) }, 5);
st.p[0].hp = 3; st.p[1].hp = 3; st.p[2].hp = 3; st.p[3].hp = 3; st.p[4].hp = 3;
st.p[1].lastSkill = R.SK.CHARGE; st.p[1].ep = 2;      // 刚蓄能
st.p[3].ep = 7;                                       // ep 最多但没蓄能
st.p[4].hp = 5;                                       // 血最多
let pick = B.pickMirrorSpam(st, 0, LEGAL([R.SK.MIRROR, R.SK.JI]));
console.log('镜面-有蓄能：key=' + pick.key + ' 输入对手=' + pick.target + '（期望 1） 输出=' + pick.target2 + '（期望 4=血最多）');

/* ② 镜面：没人蓄能 ⇒ ep 最多 */
st.p[1].lastSkill = R.SK.GUN;
pick = B.pickMirrorSpam(st, 0, LEGAL([R.SK.MIRROR, R.SK.JI]));
console.log('镜面-无蓄能：输入对手=' + pick.target + '（期望 3=ep 最多） 输出=' + pick.target2 + '（期望 4）');

/* ③ 镜面：只剩 1 个对手 ⇒ 退回 ジ */
const st2 = S.createState('multi', { next: T.mulberry32(12) }, 5);
st2.p[1].hp = 0; st2.p[2].hp = 0; st2.p[3].hp = 0;
pick = B.pickMirrorSpam(st2, 0, LEGAL([R.SK.MIRROR, R.SK.JI]));
console.log('镜面-只剩 1 对手：key=' + pick.key + '（期望 ji）');

/* ④ 双枪：打血最高的两个 */
st.p[1].hp = 3; st.p[2].hp = 5; st.p[3].hp = 1; st.p[4].hp = 4;
pick = B.pickDualSpam(st, 0, LEGAL([R.SK.DUAL_GUN, R.SK.GUN, R.SK.JI]));
console.log('双枪：t1=' + pick.target + ' t2=' + pick.target2 + '（期望 {2,4}）');

/* ⑤ 实战：5P 里这条脚本能打几成（作为 1 席 vs 4 个随机） */
function firstRates(botName, N, G) {
  const wins = new Array(N).fill(0);
  for (let g = 0; g < G; g++) {
    const s = S.createState('multi', { next: T.mulberry32(77000 + g) }, N);
    const sels = [];
    for (let i = 0; i < N; i++) sels.push(i === 0 ? T.wrapBotN(B[botName]) : T.wrapBotN(B.pickRandom));
    Play.autoGameN(s, sels);
    if (T.rankOf(s, 0, 77000 + g) === 1) wins[0]++;
  }
  return wins[0] / G;
}
for (const nm of ['pickMirrorSpam', 'pickDualSpam', 'pickRandom', 'pickGunSpam', 'pickReflectSpam']) {
  const G = 300;
  const r5 = firstRates(nm, 5, G);
  console.log(nm.padEnd(16) + ' 5P 一号位 vs 4×random 夺1率 = ' + (r5 * 100).toFixed(1) + '%');
}