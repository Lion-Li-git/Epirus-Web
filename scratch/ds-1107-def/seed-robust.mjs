
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
  const j = packJsonOf(src, 'window.EPIRUS_CHAMPION_3P =');
  return P.unpack(JSON.parse(j)); }
function sel(params) { return function (st, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(st, pid, base, params, 0.15); }; }
const OFF = ['aggro','balanced','breakdef','combocounter','mix','tankline','heavyfire','whiff','beadburst'];
const DEFG = ['wall','reflectspam','guardspam','baguaspam','reflecttank','defreflectgun'];
const FN = { aggro:'pickAggro', balanced:'pickBalanced', breakdef:'pickBreakDef', combocounter:'pickComboCounter',
  mix:'pickMix', tankline:'pickTankLine', heavyfire:'pickHeavyFire', whiff:'pickWhiff', beadburst:'pickBeadBurst',
  wall:'pickWall', reflectspam:'pickReflectSpam', guardspam:'pickGuardSpam', baguaspam:'pickBaguaSpam',
  reflecttank:'pickReflectTank', defreflectgun:'pickDefReflectGun' };
const ARMS = ['CTRL2-s13-band2','DEF-s13-band2','DEF-s15-band2','DEF-s16-band2'];
const SEEDS = [20260207, 777001];
const G = 25;
console.log('arm'.padEnd(18) + 'OFF(9)'.padStart(9) + 'DEF(6)'.padStart(9) + '枪压制'.padStart(9) + '  (2 seed × ' + G + ' 局/基准)');
for (const a of ARMS) {
  const params = load('docs/artifacts/' + a + '.bak');
  const s = sel(params);
  const mean = (ks, sb0, i0) => ks.reduce((acc, k, i) => acc + T.correctedWinRate(s, T.wrapBotN(B[FN[k]]), G, sb0 + (i0 + i) * 97).wr, 0) / ks.length;
  const offs = SEEDS.map(sb0 => mean(OFF, sb0, 0));
  const defs = SEEDS.map(sb0 => mean(DEFG, sb0, 20));
  const guns = SEEDS.map(sb0 => T.correctedWinRate(s, T.wrapBotN(B.pickGunSpam), 100, sb0).wr);
  console.log(a.padEnd(18) + (offs.map(v => (v * 100).toFixed(0)).join('/')).padStart(9)
    + (defs.map(v => (v * 100).toFixed(0)).join('/')).padStart(9)
    + (guns.map(v => (v * 100).toFixed(0)).join('/')).padStart(9));
}
