#!/usr/bin/env node
/* duel-behavior.mjs — 1v1 时包会不会自动切换到"残局习惯"（DS · 11-05）
 * 同一枚包跑 2P 与 5P；5P 里单独切出"只剩 2 席"的终局决策，与真 2P 比行为分布。
 * 用法：node scratch/duel-behavior.mjs --pack=scratch/ga-arms/KDFULL400-s13.js [--games=20] [--mode=long]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/KDFULL400-s13.js');
const GAMES = Math.max(6, Number(arg('games', 20)) || 20), MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const defKeys = new Set(['guard','reflect','bagua','holo','shift','jinshield','armor','proto','transfer','rod']);
const atkKeys = new Set(['gun','sword','snipe','tank','dualGun','bigT','miniT','railgun','cannon','firestorm','curse','laserEye','drain']);
let pv = null, is2 = false;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); is2 = true; } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const A = createArena2(W, { refParams: pv, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const stats = { '2P': { n: 0, keys: {}, hp: 0, ep: 0, dmg: 0 }, '5P-end': { n: 0, keys: {}, hp: 0, ep: 0, dmg: 0 }, '5P-all': { n: 0, keys: {}, hp: 0, ep: 0, dmg: 0 } };
function run(nSeats, tag, splitEnd) {
  const sh = A.shapes.findIndex((s) => s.n === nSeats && s.mode === MODE);
  const ch = T.policyChooserN(pv, 0.15, 0, 1, 'soft');
  for (let g = 0; g < GAMES; g++) {
    const seat0 = (state, pid, legal) => {
      const me = state.p[0];
      const alive = state.p.filter((p) => p.hp > 0).length;
      const which = splitEnd && alive <= 2 ? '5P-end' : tag;
      const st = stats[which];
      if (st) { st.n++; st.hp += me.hp; st.ep += me.ep; }
      const a = ch(state, pid, legal);
      if (st && a) st.keys[a.key] = (st.keys[a.key] || 0) + 1;
      return a || { key: R.SK.JI };
    };
    const subs = [seat0];
    for (let pid = 1; pid < nSeats; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length; let e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
    T.oneGameN(subs, 97000 + g * 977, nSeats, { mode: MODE });
  }
}
run(2, '2P', false);
run(5, '5P-all', true);
const def = Object.entries(stats).map(([k, s]) => {
  const tot = Object.values(s.keys).reduce((a, b) => a + b, 0) || 1;
  const d = [...defKeys].reduce((x, kk) => x + (s.keys[kk] || 0), 0);
  const at = [...atkKeys].reduce((x, kk) => x + (s.keys[kk] || 0), 0);
  const ji = s.keys.ji || 0;
  const long = (s.keys.charge || 0) + (s.keys.railgun || 0) + (s.keys.bigT || 0) + (s.keys.ring || 0) + (s.keys.cannon || 0);
  const top = Object.entries(s.keys).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([kk, v]) => kk + ':' + Math.round(100 * v / tot) + '%').join(' ');
  return k + ' ‖ n=' + s.n + ' ‖ 防御 ' + (100 * d / tot).toFixed(0) + '% ‖ 攻击 ' + (100 * at / tot).toFixed(0) + '% ‖ ji ' + (100 * ji / tot).toFixed(0) + '% ‖ 长程 ' + (100 * long / tot).toFixed(0) + '% ‖ hp ' + (s.hp / Math.max(1, s.n)).toFixed(1) + ' ‖ ep ' + (s.ep / Math.max(1, s.n)).toFixed(1) + ' ‖ ' + top;
});
console.log(PACK.split('/').pop() + ' [' + (is2 ? '2.0' : 'v7') + ', ' + MODE + ']');
for (const l of def) console.log('  ' + l);
