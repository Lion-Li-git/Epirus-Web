
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
const T = sb.EpirusTrainer, B = sb.EpirusBots, S = sb.EpirusState, Play = sb.EpirusPlay, R = sb.EpirusRules;
for (const nm of ['pickDeepSaver','pickGunSpam']) {
  const st = S.createState('multi', { next: T.mulberry32(5) }, 5);
  const seen = [];
  const mk = () => (state, pid, legal) => { const k = B[nm](state, pid, legal); if (pid === 0) seen.push(typeof k === 'string' ? k : k && k.key); return k; };
  Play.autoGameN(st, [mk(), mk(), mk(), mk(), mk()]);
  const c = {}; for (const k of seen) c[k] = (c[k] || 0) + 1;
  console.log(nm, ' 一号位出手分布:', JSON.stringify(c), ' 终局 lastSkill=', JSON.stringify(st.p[0].lastSkill));
}
