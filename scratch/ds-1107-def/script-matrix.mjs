
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
const T = sb.EpirusTrainer, B = sb.EpirusBots, P = sb.EpirusPolicy;
P.setRng(T.mulberry32(7 * 7919 + 13));
const G = 200;
const names = ['pickGunSpam','pickDefend','pickGuardSpam','pickReflectSpam','pickAggro','pickBalanced','pickBaiGu','pickDeepSaver','pickFarmer','pickHeavyFire'];
const rows = [];
for (const a of names) for (const b of names) {
  if (!B[a] || !B[b]) continue;
  const r = T.correctedWinRate(T.wrapBotN(B[a]), T.wrapBotN(B[b]), G, 900000 + a.length * 7 + b.length * 13);
  rows.push([a.replace('pick',''), b.replace('pick',''), r.wr]);
}
const hdr = ['A\\B'].concat(names.map(n => n.replace('pick','').slice(0,7).padStart(8)));
console.log(hdr.join(''));
for (const a of names) {
  const line = [a.replace('pick','').padEnd(12)];
  for (const b of names) {
    const hit = rows.find(r => r[0] === a.replace('pick','') && r[1] === b.replace('pick',''));
    line.push(hit ? (hit[2] * 100).toFixed(0).padStart(7) + '%' : '       —');
  }
  console.log(line.join(''));
}
