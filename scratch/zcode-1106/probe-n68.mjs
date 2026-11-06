/* 6-8P 开放验证(ZCode 11-06 夜):产品同一条路(EPIRUS_CHAMPION_POOL.members → rosterFor → compose
 * → P.unpack → policyChooserN → autoGameN)打 6/7/8 人 × multi/long;
 * 8P 长短考试:各 400 局,比局长/收缩/决胜。 */
import { readFileSync } from 'node:fs';
global.window = global;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/policy.js','js/train/policy2.js','js/train/bots.js','js/train/evo.js','js/train/trainer.js','js/champion-pack.js','js/pool-draw.js','js/bundled-champion-pool.js']) {
  eval(readFileSync(f, 'utf8'));
}
const S = global.EpirusState, Play = global.EpirusPlay, P = global.EpirusPolicy, D = global.EpirusPoolDraw;
const T = global.EpirusTrainer, Bots = global.EpirusBots;
if (!global.EPIRUS_CHAMPION_POOL || !global.EPIRUS_CHAMPION_POOL.members) { console.error('池 bundle 没载入'); process.exit(1); }
const ALLMEM = global.EPIRUS_CHAMPION_POOL.members;
const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const tier = Bots.DIFF_TIERS.find(t => t.id === 'lv:regular');
const paramCache = {};
const paramsOf = (id) => {
  if (!paramCache[id]) {
    const m = ALLMEM.find(x => x.id === id);
    if (!m) return null;
    try { paramCache[id] = P.unpack(m.pack, true); } catch (e) { paramCache[id] = null; }
  }
  return paramCache[id];
};
const modeForHp = { 3: 'multi', 5: 'long' };
const summary = {};
for (const n of [6, 7, 8]) {
  for (const hp of [3, 5]) {
    const modeKey = modeForHp[hp];
    const games = 400;
    let rounds = 0, decided = 0, sdFired = 0, maxR = 0, aliveEnd = 0, dmgEnd = 0;
    for (let g = 0; g < games; g++) {
      const seed = 70000 + n * 1000 + hp * 100 + g;
      const st = S.createState(modeKey, { next: mulberry32(seed) }, n);
      st.slotSalt = (Math.imul(seed, 2654435761)) >>> 0;
      const R = D.rosterFor(ALLMEM, tier);
      const draw = D.compose(R.members, n - 1, D.rng(st.slotSalt), null, R.bandW);
      const choosers = [];
      for (let pid = 0; pid < n; pid++) {
        const seat = draw.seats[(pid === 0 ? 0 : pid - 1) % draw.seats.length];
        const prm = seat && seat.id ? paramsOf(seat.id) : null;
        choosers.push(prm ? T.policyChooserN(prm, 0.15, 0.1, 5, 'soft') : ((s, p2, legal) => 'ji'));
      }
      Play.autoGameN(st, choosers);
      rounds += st.round; maxR = Math.max(maxR, st.round);
      if (st.winner !== 'draw') decided++; else aliveEnd++;
      if (st.round >= 45) sdFired++;
    }
    summary[n + 'P·' + modeKey] = { games, 均回合: +(rounds / games).toFixed(1), 最长: maxR, 决胜率: +(decided / games * 100).toFixed(1) + '%', 平局: +(aliveEnd / games * 100).toFixed(1) + '%', 过45回合: +(sdFired / games * 100).toFixed(1) + '%' };
  }
}
console.log(JSON.stringify(summary, null, 1));
