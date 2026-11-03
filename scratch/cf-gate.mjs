#!/usr/bin/env node
/* cf-gate.mjs — 反事实（rollout）门控：值不值得防，用"继续打完这局"来判（DS · 11-03）
 * 每次 hp<=HP 的决策：克隆状态，分别强制 [原招] 与 [防御] 各跑 R 局（rollout 用同一套 chooser），
 *   比较被测席的胜率；若 防御胜率 - 原招胜率 >= MARGIN ⇒ 本回合改出防御。
 * 量：覆盖写次数/比例、裸 vs cf 门控的夺1、局长。
 * 用法：node scratch/cf-gate.mjs --pack=... [--games=60] [--hp=2] [--r=2] [--margin=0.12] [--table=mix]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js'), TABLE = arg('table', 'mix');
const GAMES = Math.max(10, Number(arg('games', 60)) || 60), N = Math.max(2, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long');
const R = Math.max(1, Number(arg('r', 2)) || 2), MARGIN = Number(arg('margin', 0.12)), HPMAX = Number(arg('hp', 2)), TEMP = 0.1;
const SD = Number(arg('sd', 0)) || 0;   /* >0 ⇒ 提前收缩：suddenDeath=SD */
const OPTS = SD > 0 ? { suddenDeath: SD } : undefined;
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, RULES = W.EpirusRules;
let pv = null;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
const A = createArena2(W, { refParams: pv, temp: TEMP, stratified: false });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const DEFK = new Set(['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'armor', 'proto', 'holo']);
function oppSel(g, pid) {
  if (TABLE === 'gun') return A.roster.find((e) => e.name === 'only:gun').sel;
  let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri];
  while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
  return e.sel;
}
function rollout(state, forced, seed) {
  const cl = S.cloneState(state);
  let used = false;
  const choosers = [];
  for (let pid = 0; pid < N; pid++) {
    if (pid === 0) choosers.push((st, p2, legal) => { if (!used) { used = true; return forced; } return ch(st, p2, legal); });
    else choosers.push(oppSel(0, pid));
  }
  try { Play.autoGameN(cl, choosers, undefined, undefined, undefined); } catch (e) { return 0; }
  const me = cl.p.find((q) => q.id === 0);
  if (cl.winner === 0) return 1;
  if (!me || me.hp <= 0) return 0;
  return 0.5 * (cl.p.filter((q) => q.hp > 0).length > 1 ? 0.5 : 1) * 0;   /* 非胜一律 0（保守） */
}
let dec = 0, over = 0, winBare = 0, winCF = 0, draws = 0;
for (let g = 0; g < GAMES; g++) {
  const subs = [function (st, pid, legal) {
    const me = st.p[0];
    let pick = ch(st, pid, legal);
    dec++;
    if (me && me.hp <= HPMAX) {
      const defs = legal.filter((l) => DEFK.has(l.key) && l.affordable !== false);
      if (defs.length && !(pick && DEFK.has(pick.key))) {
        const best = defs[0];
        let vA = 0, vD = 0;
        for (let r = 0; r < R; r++) { vA += rollout(st, pick, 5000 + g * 131 + r * 7); vD += rollout(st, best, 5000 + g * 131 + r * 7); }
        vA /= R; vD /= R;
        if (vD - vA >= MARGIN) { pick = best; over++; }
      }
    }
    return pick;
  }];
  for (let pid = 1; pid < N; pid++) subs.push(oppSel(g, pid));
  const r = T.oneGameN(subs, 92000 + g * 977, N, Object.assign({ mode: MODE }, OPTS || {}));
  if (r.winner === 0) winCF++; else if (r.winner == null || r.winner === 'draw') draws++;
}
/* 裸包对照 */
let winB = 0;
for (let g = 0; g < GAMES; g++) {
  const subs = [ch]; for (let pid = 1; pid < N; pid++) subs.push(oppSel(g, pid));
  const r = T.oneGameN(subs, 92000 + g * 977, N, Object.assign({ mode: MODE }, OPTS || {}));
  if (r.winner === 0) winB++;
}
console.log(PACK.split('/').pop() + ' [' + TABLE + '] ‖ 决策 ' + dec + ' ‖ 覆盖写 ' + over + '（' + (100 * over / Math.max(1, dec)).toFixed(2) + '%）‖ 裸夺1 ' + (100 * winB / GAMES).toFixed(1) + '% ‖ cf门控 ' + (100 * winCF / GAMES).toFixed(1) + '%');