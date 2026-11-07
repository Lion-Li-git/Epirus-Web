
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
const T = sb.EpirusTrainer, B = sb.EpirusBots, S = sb.EpirusState, Play = sb.EpirusPlay;
const st = S.createState('multi', { next: T.mulberry32(1) }, 5);
console.log('p[0] keys:', Object.keys(st.p[0]).join(','));
console.log('lastSkill 初值:', JSON.stringify(st.p[0].lastSkill), ' round:', st.round);
let n = 0;
const mk = (i) => (state, pid, legal) => {
  if (n < 6) console.log('  调用 pid=' + pid + ' round=' + state.round + ' lastSkill=' + JSON.stringify(state.p[pid].lastSkill) + ' ep=' + state.p[pid].ep);
  n++;
  return B.pickGunSpam(state, pid, legal);
};
Play.autoGameN(st, [mk(0), mk(1), mk(2), mk(3), mk(4)]);
console.log('结束后 p[0].lastSkill =', JSON.stringify(st.p[0].lastSkill), 'round=', st.round);
