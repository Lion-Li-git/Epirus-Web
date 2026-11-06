#!/usr/bin/env node
/* key-price.mjs — 一个键在指定世界里的边际价值（DS · 11-04）
 * 做法：同一批局号，跑 baseline vs 禁用该键（chooser 在合法里挑非该键的最高分）⇒ Δ夺1。
 * 世界：mixed（arena2 现役 roster）‖ course（把一个对手席换成 only:guard 龟席）。
 * 用法：node scratch/key-price.mjs --pack=... --keys=drain,taunt --games=120 [--n=5] [--mode=long]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/night6/CB3-s13.js');
const KEYS = String(arg('keys', 'drain,taunt')).split(',').filter(Boolean);
const GAMES = Math.max(20, Number(arg('games', 120)) || 120);
const N = Math.max(2, Number(arg('n', 5)) || 5);
const MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const A = createArena2(W, { refParams: pv, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const turtle = A.roster.find((e) => e.name === 'only:guard');
function chooser(ban) {
  const base = T.policyChooserN(pv, 0.15, 0, 5, 'soft');
  if (!ban) return base;
  return (state, pid, legal) => {
    const lg = legal.filter((l) => l.affordable !== false);
    const out = lg.filter((l) => l.key !== ban);
    if (!out.length) return base(state, pid, legal);
    const pick = base(state, pid, out);
    if (pick && pick.key !== ban) return pick;
    return out[0];
  };
}
function run(world, ban) {
  let win = 0;
  for (let g = 0; g < GAMES; g++) {
    const ch = chooser(ban);
    const subs = [ch];
    for (let pid = 1; pid < N; pid++) {
      if (world === 'course' && pid === 1) { subs.push(turtle.sel); continue; }
      let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri];
      while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
      subs.push(e.sel);
    }
    const r = T.oneGameN(subs, 91000 + g * 977, N, { mode: MODE });
    if (r.winner === 0) win++;
  }
  return 100 * win / GAMES;
}
for (const world of ['mixed', 'course']) {
  const b = run(world, null);
  const line = [];
  for (const k of KEYS) { const v = run(world, k); line.push(k + ': ' + b.toFixed(1) + '→' + v.toFixed(1) + '（Δ' + (b - v).toFixed(1) + '）'); }
  console.log(PACK.split('/').pop() + ' [' + world + '] 基线夺1 ' + b.toFixed(1) + '% ‖ ' + line.join(' ‖ '));
}
