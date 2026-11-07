
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
const T = sb.EpirusTrainer, B = sb.EpirusBots, P = sb.EpirusPolicy, R = sb.EpirusRules, S = sb.EpirusState, Play = sb.EpirusPlay;
P.setRng(T.mulberry32(7 * 7919 + 13));
const list = sb.EPIRUS_CHAMPION_POOL.members;
const m = list.find(x => /L5-1200/.test(x.id)) || list[0];
const params = P.unpack(m.pack);
console.log('member', m.id, 'params', params && params.length, 'dims', JSON.stringify(m.pack.dims || null), 'v', m.pack.v);
function sel(st, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(st, pid, base, params, 0.15);
}
for (const [nm, fn] of [['random', B.pickRandom], ['defend', B.pickDefend], ['aggro', B.pickAggro], ['gunspam', B.pickGunSpam]]) {
  const r = T.correctedWinRate(sel, T.wrapBotN(fn), 60, 660000);
  console.log(nm.padEnd(8), 'w/d/l =', r.w, r.d, r.l, ' wr=', (r.wr * 100).toFixed(0) + '%');
}
// 单局细看：champion(P0) vs defend
const st = S.createState('standard', { next: T.mulberry32(12345) });
st.slotSalt = 0;
const log = [];
Play.autoGame(st, sel, T.wrapBotN(B.pickDefend));
console.log('单局：winner=', st.winner, 'round=', st.round, 'hp=', st.p.map(p => p.hp).join('/'));
const cnt = {};
for (const e of st.events) if (e.type === 'damage') cnt[e.reason] = (cnt[e.reason] || 0) + e.amt;
console.log('伤害来源（amt 合计）：', JSON.stringify(cnt));
const acts = {};
for (const e of st.events) if (e.type === 'act' || e.type === 'action') acts[e.key] = (acts[e.key] || 0) + 1;
console.log('行动事件样例：', JSON.stringify(Object.entries(acts).slice(0, 10)));
