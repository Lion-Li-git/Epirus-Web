import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const PACK = process.argv[2] || 'js/bundled-champion-3p.js';
const N = Number(process.argv[3] || 5), MODE = process.argv[4] || 'long', GAMES = Number(process.argv[5] || 100);
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } } catch (e) {}
if (!pv) pv = Float64Array.from(W.EpirusAudit ? [] : []);
if (!pv || !pv.length) pv = Float64Array.from((await import('../tools/audit-lib.mjs')).loadChamp(W, PACK, '.'));
const ch = T.policyChooserN(pv, 0.1, 0, N, 'soft');
const A = createArena2(W, { refParams: pv, temp: 0.1, stratified: false });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
let timeout = 0, elim = 0, allDead = 0, wins = 0, rounds = 0;
const maxR = (R.MODES[MODE] && R.MODES[MODE].maxRounds) || R.MAX_ROUNDS;
for (let g = 0; g < GAMES; g++) {
  const subs = [ch];
  for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
  const r = T.oneGameN(subs, 91000 + g * 977, N, { mode: MODE });
  rounds += r.rounds || 0;
  const alive = r.state.p.filter((q) => q.hp > 0).length;
  if (alive === 0) allDead++; else if (alive === 1) elim++; else timeout++;
  if (r.winner === 0) wins++;
}
console.log(PACK.split('/').pop() + ' [' + N + 'P ' + MODE + ' maxR=' + maxR + '] 局数 ' + GAMES + ' ‖ 淘汰 ' + elim + '（' + (100 * elim / GAMES).toFixed(0) + '%）‖ 全灭 ' + allDead + '（' + (100 * allDead / GAMES).toFixed(0) + '%）‖ 超时算血 ' + timeout + '（' + (100 * timeout / GAMES).toFixed(0) + '%）‖ 平均局长 ' + (rounds / GAMES).toFixed(0) + ' ‖ 被测夺1 ' + (100 * wins / GAMES).toFixed(0) + '%');
