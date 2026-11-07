
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js','js/bundled-champion.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, S = sb.EpirusState, Play = sb.EpirusPlay, P = sb.EpirusPolicy;
P.setRng(T.mulberry32(7919 + 13));
const params = P.unpack(sb.EPIRUS_CHAMPION);
const champ = function (state, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: sb.EpirusRules.SK.JI, affordable: true }];
  return T.pickChampion(state, pid, base, params, 0.15);
};
/* 作为「主攒席」时，冠军能不能把它清掉？看回合数与平局率 */
function run(seatFn, label, G) {
  let rounds = 0, draws = 0, wins = 0, kills = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState('multi', { next: T.mulberry32(66000 + g) }, 5);
    Play.autoGameN(st, [T.wrapBotN(champ), T.wrapBotN(seatFn), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom)]);
    rounds += st.round;
    if (st.winner === 'draw' || st.winner == null) draws++;
    else if (st.winner === 0) wins++;
    if (st.p[1].hp <= 0) kills++;
  }
  console.log(label.padEnd(16) + ' 均 ' + (rounds / G).toFixed(1) + ' 回合 ‖ 冠军夺1 ' + (wins / G * 100).toFixed(0) + '% ‖ 平局 ' + (draws / G * 100).toFixed(0) + '% ‖ 攒钱席被杀 ' + (kills / G * 100).toFixed(0) + '%');
}
const G = 300;
run(B.pickMirrorSpam, '镜面(主攒席)', G);
run(B.pickDeepSaver, '深经济', G);
run(B.pickFarmer, 'farmer(已剔)', G);
run(B.pickGunSpam, '枪线对照', G);