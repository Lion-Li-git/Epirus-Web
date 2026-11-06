#!/usr/bin/env node
/* duel-5dead.mjs — 5 席但开场就 3 席阵亡（两枚满血）⇒ 行为更像真 2P 还是像 5P 残局？（DS · 11-05） */
import { sandbox, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/KDFULL400-s13.js');
const GAMES = Math.max(6, Number(arg('games', 20)) || 20), MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
const defKeys = new Set(['guard','reflect','bagua','holo','shift','jinshield','armor','proto','transfer','rod']);
let pv = null;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const A = createArena2(W, { refParams: pv, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const keys = {}; let n = 0, hp = 0, ep = 0;
const ch = T.policyChooserN(pv, 0.15, 0, 1, 'soft');
for (let g = 0; g < GAMES; g++) {
  const st = S.createState(MODE, { next: mulberry32(70000 + g * 977) }, 5, {});
  for (let i = 2; i < 5; i++) if (st.p[i]) { st.p[i].hp = 0; }
  const seat0 = (state, pid, legal) => {
    const me = state.p[0];
    n++; hp += me.hp; ep += me.ep;
    const a = ch(state, pid, legal) || { key: R.SK.JI };
    keys[a.key] = (keys[a.key] || 0) + 1; return a;
  };
  const subs = [seat0];
  for (let pid = 1; pid < 5; pid++) { const ri = (90000 * 7 + pid * 11 + g * 17 + 101) % A.roster.length; let e = A.roster[ri]; if (e.kind === 'random') e = A.roster[(ri + 1) % A.roster.length]; subs.push(e.sel); }
  Play.autoGameN(st, subs, undefined, undefined, undefined);
}
const tot = Object.values(keys).reduce((a, b) => a + b, 0) || 1;
const d = [...defKeys].reduce((x, k) => x + (keys[k] || 0), 0);
const long = (keys.charge || 0) + (keys.railgun || 0) + (keys.bigT || 0) + (keys.ring || 0) + (keys.cannon || 0);
const top = Object.entries(keys).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ':' + Math.round(100 * v / tot) + '%').join(' ');
console.log(PACK.split('/').pop() + ' [5席-3席开场死] ‖ n=' + n + ' ‖ 防御 ' + (100 * d / tot).toFixed(0) + '% ‖ ji ' + (100 * (keys.ji || 0) / tot).toFixed(0) + '% ‖ 长程 ' + (100 * long / tot).toFixed(0) + '% ‖ hp ' + (hp / Math.max(1, n)).toFixed(1) + ' ‖ ep ' + (ep / Math.max(1, n)).toFixed(1) + ' ‖ ' + top);
