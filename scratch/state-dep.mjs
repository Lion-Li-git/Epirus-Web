#!/usr/bin/env node
/* state-dep.mjs — 一枚包的"看局面换招"读数：主键份额 / 换招率 / 分数差（DS · 11-04）
 * 用法：node scratch/state-dep.mjs --pack=<a.js|a.bak> [--games=12] [--n=5] [--mode=long]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const GAMES = Math.max(4, Number(arg('games', 12)) || 12), N = Math.max(2, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null, is2 = false;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); is2 = true; } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const A = createArena2(W, { refParams: pv, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const counts = {}; let decisions = 0, switches = 0, prev = null; const margins = [];
for (let g = 0; g < GAMES; g++) {
  const seat0 = (state, pid, legal) => {
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    if (cs.length >= 2) {
      let vals;
      if (is2) vals = Array.from(P.forwardCands(state, pid, cs, pv, { temp: 1 }).logits);
      else vals = cs.map((c) => P.value(state, pid, c.key, pv, null, c));
      const order = vals.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
      const k = cs[order[0][1]].key;
      margins.push(order[0][0] - order[1][0]);
      counts[k] = (counts[k] || 0) + 1; decisions++;
      if (prev && prev !== k) switches++; prev = k;
    }
    const j = cs.find((c) => c.key === R.SK.JI); return j || cs[0] || { key: R.SK.JI };
  };
  const subs = [seat0];
  for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
  T.oneGameN(subs, 99000 + g * 977, N, { mode: MODE });
}
const tot = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ':' + (100 * v / tot).toFixed(0) + '%').join(',');
const maj = Math.max(...Object.values(counts)) / tot;
const med = margins.slice().sort((a, b) => a - b)[Math.floor(margins.length / 2)] || 0;
const defs = ['guard','reflect','bagua','holo','shift','jinshield','armor','proto','transfer'].reduce((x, k) => x + (counts[k] || 0), 0) / tot;
console.log(PACK.split('/').pop() + ' [' + (is2 ? '2.0' : 'v7') + '] ‖ 决策 ' + decisions + ' ‖ 主键份额 ' + (100 * maj).toFixed(0) + '% ‖ 换招率 ' + (100 * switches / Math.max(1, decisions - 1)).toFixed(0) + '% ‖ 防御族 ' + (100 * defs).toFixed(0) + '% ‖ 分差中位 ' + med.toFixed(3) + ' ‖ top: ' + top);
