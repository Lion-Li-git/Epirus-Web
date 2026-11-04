#!/usr/bin/env node
/* degen-check.mjs — "只用某招"的脚本在现役考卷上能不能乱杀（DS · 11-04）
 * 用途：判 skill-report 里"富裕强但实战 0 用"的 sword/snipe/proto 是真缺口还是退化策略。
 * 用法：node scratch/degen-check.mjs [--keys=sword,snipe,proto] [--games=100] [--n=5] [--mode=long]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const KEYS = String(arg('keys', 'sword,snipe,proto,railgun,gun')).split(',').filter(Boolean);
const GAMES = Math.max(20, Number(arg('games', 100)) || 100);
const N = Math.max(2, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const refParams = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const A = createArena2(W, { refParams, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
function onlyChooser(key) {
  return (state, pid, legal) => {
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    const hit = cs.find((c) => c.key === key && c.affordable !== false);
    if (hit) return hit;
    return cs.find((c) => c.key === R.SK.JI) || { key: R.SK.JI };
  };
}
for (const key of KEYS) {
  const sel = onlyChooser(key);
  let win = 0, draw = 0;
  for (let g = 0; g < GAMES; g++) {
    const subs = [sel];
    for (let pid = 1; pid < N; pid++) {
      let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri];
      while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
      subs.push(e.sel);
    }
    const r = T.oneGameN(subs, 93000 + g * 977, N, { mode: MODE });
    if (r.winner === 0) win++; else if (r.winner === 'draw' || r.winner == null) draw++;
  }
  console.log('only:' + key + ' ‖ 夺1 ' + (100 * win / GAMES).toFixed(1) + '% ‖ 平 ' + (100 * draw / GAMES).toFixed(1) + '%');
}
