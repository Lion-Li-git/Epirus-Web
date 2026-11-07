
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
const T = sb.EpirusTrainer, B = sb.EpirusBots, S = sb.EpirusState, Play = sb.EpirusPlay, P = sb.EpirusPolicy, R = sb.EpirusRules;
P.setRng(T.mulberry32(7919 + 13));
const params = P.unpack(sb.EPIRUS_CHAMPION);
const champ = function (state, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(state, pid, base, params, 0.15);
};
function run(label, others, G) {
  let charged = 0, epb = 0, tot = 0, mirrorDmg = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState('multi', { next: T.mulberry32(44000 + g) }, 5);
    const mkM = (state, pid, legal) => {
      tot++;
      const opps = []; for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) opps.push(i);
      let c = 0; for (const i of opps) if (state.p[i].lastSkill === R.SK.CHARGE) c++;
      if (c) charged++; else epb++;
      return B.pickMirrorSpam(state, pid, legal);
    };
    const sels = [T.wrapBotN(champ), T.wrapBotN(mkM)].concat(others.map(fn => T.wrapBotN(fn)));
    Play.autoGameN(st, sels);
    for (const e of st.events) if (e.type === 'damage' && e.source === 1) mirrorDmg += (e.amt || 0);
  }
  console.log(label.padEnd(24) + ' 决策 ' + tot + ' ‖ 有蓄能可复制 ' + (charged / tot * 100).toFixed(1) + '% ‖ 每局镜面伤害 ' + (mirrorDmg / G).toFixed(2));
}
const G = 200;
run('冠军 + 3×random', [B.pickRandom, B.pickRandom, B.pickRandom], G);
run('冠军 + 2×deepSaver + 1 random', [B.pickDeepSaver, B.pickDeepSaver, B.pickRandom], G);
run('冠军 + 2×farmer + 1 random', [B.pickFarmer, B.pickFarmer, B.pickRandom], G);
run('冠军 + 2×deadlineburst + 1 random', [B.pickDeadlineBurst, B.pickDeadlineBurst, B.pickRandom], G);
run('冠军 + 2×earlypressure + 1 random', [B.pickEarlyPressure, B.pickEarlyPressure, B.pickRandom], G);