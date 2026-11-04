#!/usr/bin/env node
/* logit-spread.mjs — 出生点的"分数跨度"：2.0@0.25 / 2.0@4 / v7@0.25（纯前向，不改状态）
 * 用法：node scratch/logit-spread.mjs
 */
import { sandbox, loadChamp, mulberry32 } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
const N = 5, MODE = 'long', G = 6;
function probe(face, scale) {
  const W = sandbox();
  const ref = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
  const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
  if (face === '2.0') installArch2(W, { input: 'obs3b', gen: 3, keySplit: true, mutMode: 'seg', inter: Number(process.env.EPIRUS_INTER || 0), tinter: Number(process.env.EPIRUS_TINTER || 0), keyHead: Number(process.env.EPIRUS_KEYHEAD || 0) });
  const pols = [1, 2, 3, 4].map((s) => P.makePolicy(scale, mulberry32(2000 + s)));
  const A = createArena2(W, { refParams: ref, temp: 0.15 });
  const sh = A.shapes.findIndex((x) => x.n === N && x.mode === MODE);
  const margins = pols.map(() => []); const keys = pols.map(() => ({}));
  for (let g = 0; g < G; g++) {
    const seat0 = (state, pid, legal) => {
      const cands = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      if (cands.length >= 2) {
        pols.forEach((pv, i) => {
          let vals;
          if (face === '2.0') { const r = P.forwardCands(state, pid, cands, pv, { temp: 1 }); vals = Array.from(r.logits); }
          else vals = cands.map((c) => P.value(state, pid, c.key, pv, null, c));
          const sorted = vals.slice().sort((a, b) => b - a);
          margins[i].push(sorted[0] - sorted[1]);
          const k = cands[vals.indexOf(sorted[0])].key; keys[i][k] = (keys[i][k] || 0) + 1;
        });
      }
      const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      const a = (face === '2.0') ? P.forwardCands(state, pid, cs, pols[0], { temp: 0.15 }).cand : null;
      if (a) return a;
      const j = cs.find((c) => c.key === R.SK.JI); return j || cs[0] || { key: R.SK.JI };
    };
    const subs = [seat0];
    for (let pid = 1; pid < N; pid++) { let ri = (91000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
    T.oneGameN(subs, 81000 + g * 977, N, { mode: MODE });
  }
  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const defs = keys.map((c) => { const tot = Object.values(c).reduce((x, y) => x + y, 0) || 1; const dk = ['guard','reflect','bagua','holo','shift','jinshield','armor','proto','transfer'].reduce((x, k) => x + (c[k] || 0), 0); return 100 * dk / tot; });
  console.log(face + ' @' + scale + ' ‖ 每粒 top1-top2 中位 ' + margins.map((m) => med(m).toFixed(3)).join(' / ') + ' ‖ 防御族份额 ' + defs.map((d) => d.toFixed(1) + '%').join(' / '));
  console.log('   top键: ' + keys.map((c) => Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => k + ':' + (100 * v / (Object.values(c).reduce((x, y) => x + y, 0) || 1)).toFixed(0) + '%').join(',')).join(' ‖ '));
}
probe('2.0', 0.25); probe('2.0', 4); probe('v7', 0.25);
