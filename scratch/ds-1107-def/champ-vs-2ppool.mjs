
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
const T = sb.EpirusTrainer, P = sb.EpirusPolicy, R = sb.EpirusRules;
P.setRng(T.mulberry32(7919 + 13));
const POOL = sb.EPIRUS_CHAMPION_POOL_2P;
console.log('2P 池键:', Object.keys(POOL).join(','));
const members = POOL.members || POOL.packs || [];
console.log('成员数:', members.length);
const champ = P.unpack(sb.EPIRUS_CHAMPION);
function mk(params) {
  return function (st, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    return T.pickChampion(st, pid, base, params, 0.15);
  };
}
const G = Number(process.env.G || 100);
const sel = mk(champ);
let tot = 0, n = 0;
for (const m of members) {
  const p = m.pack || m;
  let params = null;
  try { params = P.unpack(p); } catch (e) {}
  if (!params) { console.log(String(m.id).padEnd(20) + '  unpack 失败'); continue; }
  const r = T.correctedWinRate(sel, mk(params), G, 910000 + n * 37);
  const wdl = r.w + '/' + r.d + '/' + r.l;
  console.log(String(m.id || m.name).padEnd(20) + (m.tier || '?').padEnd(6) + (r.wr * 100).toFixed(0).padStart(4) + '%   ' + wdl);
  tot += r.wr; n++;
}
console.log('\n2P 槽包 vs 2P 池 均值 =', n ? (tot / n * 100).toFixed(1) + '%' : 'n/a', '（n=' + n + '）');
