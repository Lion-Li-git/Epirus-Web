
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js','js/train/trainer.js',
  'js/bundled-champion.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, P = sb.EpirusPolicy, R = sb.EpirusRules;
P.setRng(T.mulberry32(7919 + 13));
const CH = sb.EPIRUS_CHAMPION;
console.log('2P 槽包：v=' + CH.v + ' a=' + (CH.a && CH.a.length));
const params = P.unpack(CH);
console.log('unpack ->', params && params.length);
function sel(st, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(st, pid, base, params, 0.15);
}
const G = Number(process.env.G || 30);
const cands = [
  ['aggro','pickAggro'],['balanced','pickBalanced'],['beadburst','pickBeadBurst'],['mix','pickMix'],
  ['tankline','pickTankLine'],['heavyfire','pickHeavyFire'],['combocounter','pickComboCounter'],
  ['breakdef','pickBreakDef'],['defend','pickDefend'],['wall','pickWall'],['guardspam','pickGuardSpam'],
  ['reflectspam','pickReflectSpam'],['reflecttank','pickReflectTank'],['defreflectgun','pickDefReflectGun'],
  ['guardgun','pickGuardGun'],['protowall','pickProtoWall'],['reflectmix','pickReflectMix'],['whiff','pickWhiff'],
  ['random','pickRandom'],['farmer','pickFarmer'],['gunspam','pickGunSpam'],['gunfocus','pickGunFocus'],
  ['deepsaver','pickDeepSaver'],['killsecure','pickKillSecure'],['targeter','pickTargeter'],['snipeSpam','pickSnipeSpam'],
];
const out = [];
for (let i = 0; i < cands.length; i++) {
  const [nm, fn] = cands[i];
  if (typeof B[fn] !== 'function') { out.push([nm, null]); continue; }
  const r = T.correctedWinRate(sel, T.wrapBotN(B[fn]), G, 20260207 + i * 977);
  out.push([nm, r.wr]);
}
const inExam = new Set(['aggro','balanced','beadburst','mix','tankline','heavyfire','combocounter','breakdef','defend','wall','guardspam','reflectspam','reflecttank','defreflectgun','guardgun','protowall','reflectmix','whiff','random']);
for (const [nm, wr] of out) console.log((inExam.has(nm) ? '  [考卷] ' : '  [候选] ') + nm.padEnd(14) + (wr == null ? '  缺' : (wr * 100).toFixed(0).padStart(4) + '%'));
const scores = out.filter(x => inExam.has(x[0]) && x[1] != null).map(x => x[1]);
console.log('\n考卷 19 项均值 =', (scores.reduce((a, b) => a + b, 0) / scores.length * 100).toFixed(1) + '%');
