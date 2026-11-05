#!/usr/bin/env node
/* duel-strength.mjs — 2P 胜率（对 roster 轮换），给"少量 2P 训练"做前后对照 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/KDFULL400-s13.js');
const GAMES = Math.max(20, Number(arg('games', 60)) || 60), MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null, is2 = false;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); is2 = true; } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const A = createArena2(W, { refParams: pv, temp: 0.15 });
const sh = A.shapes.findIndex((s) => s.n === 2 && s.mode === MODE);
const ch = T.policyChooserN(pv, 0.15, 0, 1, 'soft');
const OPP = arg('opp', '');
const W2 = sandbox();
const chOpp = OPP === 'v7' ? W2.EpirusTrainer.policyChooserN(Float64Array.from(loadChamp(W2, 'js/bundled-champion-3p.js', '')), 0.15, 0, 1, 'soft') : null;
let win = 0, draw = 0;
for (let g = 0; g < GAMES; g++) {
  let ri = (90000 * 7 + 11 + sh * 13 + g * 17 + 101) % A.roster.length; let e = A.roster[ri];
  while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
  const oppSel = chOpp || e.sel;
  const r = T.oneGameN([ch, oppSel], 96000 + g * 977, 2, { mode: MODE });
  if (r.winner === 0) win++; else if (r.winner == null || r.winner === 'draw') draw++;
}
console.log(PACK.split('/').pop() + ' [2P ' + MODE + (OPP === 'v7' ? ' vs v7' : '') + '] ‖ 胜 ' + (100 * win / GAMES).toFixed(1) + '% ‖ 平 ' + (100 * draw / GAMES).toFixed(1) + '% ‖ n=' + GAMES);