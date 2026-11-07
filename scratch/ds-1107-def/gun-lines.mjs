
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, P = sb.EpirusPolicy, R = sb.EpirusRules;
P.setRng(T.mulberry32(7 * 7919 + 13));
function packJsonOf(src, marker) { const i = src.indexOf(marker); if (i < 0) return null;
  const b = src.indexOf('{', i + marker.length); if (b < 0) return null;
  let d = 0, inStr = false, esc = false;
  for (let k = b; k < src.length; k++) { const c = src[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(b, k + 1); } }
  return null; }
function load(file) { const src = readFileSync(join(ROOT, file), 'utf8');
  return P.unpack(JSON.parse(packJsonOf(src, 'window.EPIRUS_CHAMPION_3P ='))); }
function sel(params) { return function (st, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(st, pid, base, params, 0.15); }; }
const ARMS = ['CTRL2-s13-band2','DEF-s13-band2','DEF-s15-band2','DEF-s16-band2'];
console.log('arm'.padEnd(18) + 'pickGunSpam'.padStart(13) + 'pickGunFocus'.padStart(14) + '   (2 seed × 150 局)');
for (const a of ARMS) {
  const s = sel(load('docs/artifacts/' + a + '.bak'));
  const g1 = [20260207, 777001].map(sd => T.correctedWinRate(s, T.wrapBotN(B.pickGunSpam), 150, sd).wr);
  const g2 = [20260207, 777001].map(sd => T.correctedWinRate(s, T.wrapBotN(B.pickGunFocus), 150, sd).wr);
  console.log(a.padEnd(18) + g1.map(v => (v * 100).toFixed(0)).join('/').padStart(13) + g2.map(v => (v * 100).toFixed(0)).join('/').padStart(14));
}
// 两族互相比一下：谁更狠
const gg = T.correctedWinRate(T.wrapBotN(B.pickGunSpam), T.wrapBotN(B.pickGunFocus), 200, 4242);
console.log('\nGunSpam vs GunFocus（200 局）=', (gg.wr * 100).toFixed(0) + '%');
