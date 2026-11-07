
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
const cnt = {}, dmgBy = {};
let mirrorRounds = 0, rounds = 0;
const sel = (st, pid, legal) => {
  const k = B.pickMirrorSpam(st, pid, legal);
  if (pid === 0) { cnt[k.key] = (cnt[k.key] || 0) + 1; if (k.key === R.SK.MIRROR) mirrorRounds++; }
  return k;
};
for (let g = 0; g < 300; g++) {
  const s = S.createState('multi', { next: T.mulberry32(55000 + g) }, 5);
  const sels = [T.wrapBotN(sel), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom)];
  Play.autoGameN(s, sels);
  rounds += s.round;
  for (const e of s.events) if (e.type === 'damage' && e.source === 0) dmgBy[e.via || e.reason] = (dmgBy[e.via || e.reason] || 0) + (e.amt || 0);
}
console.log('出手分布：', JSON.stringify(cnt));
console.log('镜面出手 ' + mirrorRounds + ' 次 / ' + rounds + ' 回合');
console.log('它造成的伤害（按 via）：', JSON.stringify(dmgBy));
