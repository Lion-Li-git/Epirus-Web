import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState;
let v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const ARM = 'scratch/arms/202610281705-distill-S1o.bak';
const A = installArch2(W, { mutMode: 'seg', input: 'obs3' });
const mineP = Float64Array.from(loadChamp(W, ARM, ''));
let seed = 20261029; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const POOL = T.buildOpps(v7, 0.05); const fixtures = [];
function walk(sb, n) { const c = []; for (let p = 0; p < n; p++) c.push(T.policyChooserN(v7));
  const probe = (s, p, legal) => { if (fixtures.length < 120 && legal && legal.length >= 2 && (p % n) === 0) { const cl = S.cloneState(s); cl.rng = { next: rnd }; fixtures.push({ state: cl, pid: p, legal }); } return POOL[(p + 1) % POOL.length].sel(s, p, legal); };
  const cs = c.slice(); cs[0] = probe; T.oneGameN(cs, sb, n, { regen: 0, mode: 'multi' }); }
for (let g = 0; fixtures.length < 120 && g < 90; g++) walk(90000 + g * 13, g % 2 ? 5 : 3);
const k0 = {}, kPick = {}; let shown = 0;
for (const fx of fixtures) {
  const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false });
  if (!cands || cands.length < 2) continue;
  const lg = P.forwardCands(fx.state, fx.pid, cands, mineP, { temp: 0.5 }).logits;
  const rv = cands.map((c) => P.value(fx.state, fx.pid, c.key, v7, c.bead || null, c));
  let b = 0, a = 0; for (let i = 1; i < rv.length; i++) if (rv[i] > rv[b]) b = i;
  for (let i = 1; i < lg.length; i++) if (lg[i] > lg[a]) a = i;
  k0[cands[0].key] = (k0[cands[0].key] || 0) + 1;
  kPick[b] = (kPick['' + cands[b].key] || 0) + 1;
  if (b === 0 && shown < 4) { shown++;
    console.log('组 ' + shown + ' 候选数=' + cands.length + ' v7当选位=0 key=' + cands[0].key);
    console.log('  位置 key            v7值      我的logit   我的名次');
    const ord = lg.map((v, i) => i).sort((p, q) => lg[q] - lg[p]);
    for (const i of ord.slice(0, 6)) console.log('  ' + String(i).padStart(3) + ' ' + (cands[i].key + '/' + (cands[i].bead || '-')).padEnd(16) + String(rv[i].toFixed(3)).padStart(8) + String(lg[i].toFixed(3)).padStart(11) + String(ord.indexOf(i) + 1).padStart(8));
  }
}
console.log('# cands[0].key 分布：' + Object.entries(k0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v).join(' '));
console.log('# v7 当选 key 分布：' + Object.entries(kPick).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ':' + v).join(' '));
