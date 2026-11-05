#!/usr/bin/env node
/* behavior-8p.mjs — 8P multi 下的行为分布（给"为什么 8P 弱"用） */
import { sandbox, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/KDFULL400-s13.js');
const GAMES = Math.max(4, Number(arg('games', 12)) || 12), MODE = arg('mode', 'multi');
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
let pv = null, is2 = false;
try { const raw = readPack2(PACK); if (raw && raw.v === 92) { const got = packCfgExit(raw, PACK); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); pv = Float64Array.from(P.unpack(raw, true)); is2 = true; } } catch (e) {}
if (!pv) pv = Float64Array.from(loadChamp(W, PACK, '.'));
const A = createArena2(W, { refParams: pv, temp: 0.15 });
const sh = A.shapes.findIndex((s) => s.n === 8 && s.mode === MODE);
const ch = T.policyChooserN(pv, 0.15, 0, 1, 'soft');
const keys = {}; let n = 0, hp = 0, ep = 0, tgt = 0, tgtChg = 0, lastT = null;
const defKeys = new Set(['guard','reflect','bagua','holo','shift','jinshield','armor','proto','transfer','rod']);
for (let g = 0; g < GAMES; g++) {
  const seat0 = (state, pid, legal) => {
    const me = state.p[0]; n++; hp += me.hp; ep += me.ep;
    const a = ch(state, pid, legal) || { key: R.SK.JI };
    keys[a.key] = (keys[a.key] || 0) + 1;
    if (a.target != null) { if (lastT != null && a.target !== lastT) tgtChg++; tgt = a.target; lastT = a.target; }
    return a;
  };
  const subs = [seat0];
  for (let pid = 1; pid < 8; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length; let e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
  T.oneGameN(subs, 95000 + g * 977, 8, { mode: MODE });
}
const tot = Object.values(keys).reduce((a, b) => a + b, 0) || 1;
const d = [...defKeys].reduce((x, k) => x + (keys[k] || 0), 0);
const top = Object.entries(keys).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ':' + Math.round(100 * v / tot) + '%').join(' ');
console.log(PACK.split('/').pop() + ' [8P ' + MODE + '] ‖ n=' + n + ' ‖ 防御 ' + (100 * d / tot).toFixed(0) + '% ‖ ji ' + (100 * (keys.ji || 0) / tot).toFixed(0) + '% ‖ hp ' + (hp / Math.max(1, n)).toFixed(1) + ' ‖ ep ' + (ep / Math.max(1, n)).toFixed(1) + ' ‖ 换目标 ' + tgtChg + ' 次 ‖ ' + top);
