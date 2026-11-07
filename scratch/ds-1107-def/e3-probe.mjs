
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js','js/train/trainer.js',
  'js/bundled-champion.js','js/bundled-champion-pool-2p.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, P = sb.EpirusPolicy, R = sb.EpirusRules;
P.setRng(T.mulberry32(7919 + 13));
function packJsonOf(src, marker) { const i = src.indexOf(marker); if (i < 0) return null;
  const b = src.indexOf('{', i + marker.length); if (b < 0) return null;
  let d = 0, inStr = false, esc = false;
  for (let k = b; k < src.length; k++) { const c = src[k];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(b, k + 1); } }
  return null; }
const POOL = sb.EPIRUS_CHAMPION_POOL_2P.members;
const byId = Object.fromEntries(POOL.map(m => [String(m.id), m]));
function mk(params) { return function (st, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(st, pid, base, params, 0.15); }; }
/* E3 = 8 池席 + 6 脚本席 + 1 地板席 */
const POOL_SEATS = ['tb77-band1','tb43-band2','tb65-cand2','tb88-band1','tb21-cand2','SHIPPED-2P-2026-09-22','tb77-band2','3p-B5-10-31'];
const SCRIPT_SEATS = ['pickGunSpam','pickGunFocus','pickDeepSaver','pickSnipeSpam','pickGuardSpam','pickReflectTank'];
const FLOOR = ['pickRandom'];
const G = Number(process.env.G || 40);
const CAND = {
  'SHIPPED-2P-SLOT': P.unpack(sb.EPIRUS_CHAMPION),
};
for (const id of ['tb77-band1','tb65-cand2','tb21-cand2']) CAND[id] = P.unpack(byId[id].pack);
CAND['CTRL2-s13'] = P.unpack(JSON.parse(packJsonOf(readFileSync(join(ROOT,'docs/artifacts/CTRL2-s13-band2.bak'),'utf8'), 'window.EPIRUS_CHAMPION_3P =')));
console.log('席位数：池 ' + POOL_SEATS.length + ' + 脚本 ' + SCRIPT_SEATS.length + ' + 地板 1 = ' + (POOL_SEATS.length + SCRIPT_SEATS.length + 1) + '（' + G + ' 局/席）\n');
const rows = [];
for (const [nm, params] of Object.entries(CAND)) {
  if (!params) { console.log(nm + ' unpack 失败'); continue; }
  const s = mk(params);
  let poolW = 0, scW = 0, flW = 0;
  for (let i = 0; i < POOL_SEATS.length; i++) {
    const p = P.unpack(byId[POOL_SEATS[i]].pack);
    poolW += T.correctedWinRate(s, mk(p), G, 120000 + i * 211).wr;
  }
  for (let i = 0; i < SCRIPT_SEATS.length; i++) {
    scW += T.correctedWinRate(s, T.wrapBotN(B[SCRIPT_SEATS[i]]), G, 330000 + i * 173).wr;
  }
  flW = T.correctedWinRate(s, T.wrapBotN(B.pickRandom), G, 440000).wr;
  const poolAvg = poolW / POOL_SEATS.length, scAvg = scW / SCRIPT_SEATS.length;
  const total = (poolW + scW + flW) / (POOL_SEATS.length + SCRIPT_SEATS.length + 1);
  rows.push([nm, poolAvg, scAvg, flW, total]);
}
console.log('候选'.padEnd(18) + '对池(8)'.padStart(9) + '对脚本(6)'.padStart(10) + '对随机'.padStart(8) + 'E3 总分'.padStart(9));
for (const [nm, p, s, f, t] of rows) {
  console.log(nm.padEnd(18) + (p * 100).toFixed(0).padStart(8) + '%' + (s * 100).toFixed(0).padStart(9) + '%' + (f * 100).toFixed(0).padStart(7) + '%' + (t * 100).toFixed(1).padStart(8) + '%');
}