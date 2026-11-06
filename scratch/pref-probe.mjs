#!/usr/bin/env node
/* pref-probe.mjs — 「菜单修补的上限」：强制偏好 sword/snipe 或禁掉陷阱键，看混合桌夺1（DS · 11-04）
 * 条件：base ‖ prefSword20/30 ‖ prefSnipe20/30 ‖ banRing ‖ banHolo ‖ banBoth
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/night6/CB3-s13.js');
const GAMES = Math.max(20, Number(arg('games', 80)) || 80), N = Math.max(2, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const A = createArena2(W, { refParams: pv, temp: 0.15, stratified: true, stratCap: 2, stratMix: 0.5 });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const baseCh = T.policyChooserN(pv, 0.15, 0, 5, 'soft');
function mkc(prefKey, prefP, ban) {
  return (state, pid, legal) => {
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    if (ban) { const out = cs.filter((c) => ban.indexOf(c.key) < 0); if (out.length) return baseCh(state, pid, out.map((c) => ({ key: c.key, affordable: c.affordable !== false }))); }
    if (prefKey && prefP > 0 && state.rng.next() < prefP) {
      const hit = cs.find((c) => c.key === prefKey && c.affordable !== false);
      if (hit) return hit;
    }
    return baseCh(state, pid, legal);
  };
}
const conds = [['base', null, 0, null], ['sword20', 'sword', 0.2, null], ['sword30', 'sword', 0.3, null],
  ['snipe20', 'snipe', 0.2, null], ['snipe30', 'snipe', 0.3, null],
  ['banRing', null, 0, ['ring']], ['banHolo', null, 0, ['holo']], ['banBoth', null, 0, ['ring', 'holo']]];
for (const [name, k, p, ban] of conds) {
  const ch = mkc(k, p, ban);
  let win = 0;
  for (let g = 0; g < GAMES; g++) {
    const subs = [ch];
    for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
    const r = T.oneGameN(subs, 95000 + g * 977, N, { mode: MODE });
    if (r.winner === 0) win++;
  }
  console.log(name + ' ‖ 夺1 ' + (100 * win / GAMES).toFixed(1) + '%');
}
