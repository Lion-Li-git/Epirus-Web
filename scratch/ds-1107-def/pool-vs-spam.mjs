
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb; sb.global = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js',
  'js/train/bots.js','js/train/policy.js','js/train/policy2.js','js/train/evo.js','js/train/trainer.js',
  'js/bundled-champion-pool.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, B = sb.EpirusBots, P = sb.EpirusPolicy, R = sb.EpirusRules;
P.setRng(T.mulberry32(7 * 7919 + 13));
const POOL = sb.EPIRUS_CHAMPION_POOL;
console.log('pool 形状:', Array.isArray(POOL) ? 'array ' + POOL.length : Object.keys(POOL).slice(0, 8).join(','));
const list = Array.isArray(POOL) ? POOL : (POOL.packs || POOL.members || []);
console.log('成员数', list.length, '首件键', list[0] && Object.keys(list[0]).join(','));
const G = Number(process.env.G || 120);
function sel(params) {
  return function (st, pid, legal) {
    const aff = legal.filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
    return T.pickChampion(st, pid, base, params, 0.15);
  };
}
const opps = [['纯枪压制', B.pickGunSpam], ['只防御', B.pickDefend], ['反弹', B.pickReflectSpam]];
console.log('member'.padEnd(22) + opps.map(o => o[0].padStart(10)).join(''));
for (const m of list.slice(0, 8)) {
  const raw = m.pack || m.champ || m;
  let params = null;
  try { params = P.unpack(raw); } catch (e) {}
  if (!params) { console.log((m.id || '?') + ' unpack null'); continue; }
  const s = sel(params);
  const vals = opps.map((o, i) => T.correctedWinRate(s, T.wrapBotN(o[1]), G, 660000 + i * 97).wr);
  console.log(String(m.id || m.name || '?').padEnd(22) + vals.map(v => (v * 100).toFixed(0).padStart(8) + '%').join(''));
}
