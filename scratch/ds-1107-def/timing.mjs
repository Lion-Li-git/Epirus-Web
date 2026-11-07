
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
const POOL = ['pickGunSpam','pickGuardSpam','pickDeepSaver','pickHeavyFire','pickSnipeSpam','pickMix','pickAggro','pickRandom','pickReflectTank','pickFarmer'];
function asBot(name) { return T.wrapBotN(B[name]); }
const G = 120;
for (const N of [2,3,5,8]) {
  const t0 = Date.now();
  let bad = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState(N <= 2 ? 'standard' : 'multi', { next: T.mulberry32(88000 + g) }, N);
    const sels = [];
    for (let i = 0; i < N; i++) sels.push(asBot(POOL[(g * 3 + i) % POOL.length]));
    try { Play.autoGameN(st, sels); } catch (e) { bad++; }
  }
  const ms = Date.now() - t0;
  console.log('N=' + N + '  ' + G + ' 局  ' + ms + ' ms  ⇒ 每局 ' + (ms / G).toFixed(2) + ' ms' + (bad ? '  异常 ' + bad : ''));
}
