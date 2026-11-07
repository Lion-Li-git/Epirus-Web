
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
function leader(state, pid) {
  const o = []; for (let i = 0; i < state.p.length; i++) if (i !== pid && state.p[i].hp > 0) o.push(i);
  if (!o.length) return null;
  let mx = -Infinity; for (const i of o) if (state.p[i].hp > mx) mx = state.p[i].hp;
  const cand = o.filter(i => Math.abs(state.p[i].hp - mx) < 1e-9);
  return cand[Math.floor((state.rng && state.rng.next ? state.rng.next() : 0) * cand.length)];
}
/* 变体：镜面够不着时打枪（现在是纯 ji） */
function mirrorGunFallback(state, pid, legal) {
  const bk = {}; for (const l of legal) bk[l.key] = l;
  if (!(bk[R.SK.MIRROR] && bk[R.SK.MIRROR].affordable)) {
    if (bk[R.SK.GUN] && bk[R.SK.GUN].affordable) { const t = leader(state, pid); if (t != null) return { key: R.SK.GUN, target: t }; }
    return { key: R.SK.JI, target: null };
  }
  return B.pickMirrorSpam(state, pid, legal);
}
function bench(fn, G) {
  let w = 0, dm = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState('multi', { next: T.mulberry32(88000 + g) }, 5);
    Play.autoGameN(st, [T.wrapBotN(fn), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom), T.wrapBotN(B.pickRandom)]);
    if (T.rankOf(st, 0, 88000 + g) === 1) w++;
    for (const e of st.events) if (e.type === 'damage' && e.source === 0) dm += (e.amt || 0);
  }
  return { first: w / G, dmg: dm / G };
}
const G = 500;
for (const [nm, fn] of [['镜面(现版)', B.pickMirrorSpam], ['镜面+枪兜底', mirrorGunFallback], ['枪线对照', B.pickGunSpam]]) {
  const r = bench(fn, G);
  console.log(nm.padEnd(14) + ' 夺1率 ' + (r.first * 100).toFixed(1) + '%   伤害/局 ' + r.dmg.toFixed(2));
}
