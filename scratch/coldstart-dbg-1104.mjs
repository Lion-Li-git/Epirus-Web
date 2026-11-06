/* 建尺调试（一次性）：同一状态上把 父/变异子/另一随机粒 三者的 argmax 并排列出来，
   验证 flip 的单调性与 flipRand=0 到底是尺错还是真读数。 */
const { fieldProfile, WIN } = await import('../tools/behavior-profile.mjs').then(m => m.default || m);
const { mulberry32 } = await import('../tools/audit-lib.mjs');
const GEN = process.argv[2] || '2';
if (GEN === '2') {
  const { readFileSync } = await import('node:fs');
  const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
  const raw = JSON.parse(/window\.EPIRUS_CHAMPION_3P = (\{[\s\S]*?\});/.exec(readFileSync('scratch/ga-arms/CB13.js', 'utf8'))[1]);
  install(WIN, packCfgExit(raw, 'cb13').cfg);
}
const P = WIN.EpirusPolicy, S = WIN.EpirusState, T = WIN.EpirusTrainer, Play = WIN.EpirusPlay, B = WIN.EpirusBots, R = WIN.EpirusRules;
const SCR = [B.pickBalanced, B.pickAggro, B.pickDefend, B.pickMix, B.pickFarmer];
const SEED0 = 55000;
function argmax(params, state, pid, legal) {
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  const cands = P.candidatesFor(state, pid, base);
  if (!cands || !cands.length) return { key: null, n: 0 };
  const f = P.forwardCands(state, pid, cands, params, { temp: 0.6 });
  return { key: f && f.cand ? f.cand.key : null, n: cands.length, hasCand: !!(f && f.cand), probs: f && f.probs ? Array.from(f.probs).slice(0, 4).map(x => x.toFixed(3)) : null,
    keys: cands.slice(0, 4).map(c => c.key) };
}
const a = Float64Array.from(P.makePolicy(0.25));
const m18 = Float64Array.from(P.mutatePolicy(a, 0.18));
const m06 = Float64Array.from(P.mutatePolicy(a, 0.06));
const b = Float64Array.from(P.makePolicy(0.25));
console.log('路径=gen' + GEN + ' paramCount=' + P.paramCount() + ' ‖ ‖a‖=' + Math.hypot(...a).toFixed(2) + ' ‖b‖=' + Math.hypot(...b).toFixed(2) +
  ' ‖ 父子距离/‖a‖=' + (100 * Math.hypot(...m18.map((x, i) => x - a[i])) / Math.hypot(...a)).toFixed(1) + '% ‖ a↔b 距离/‖a‖=' +
  (100 * Math.hypot(...b.map((x, i) => x - a[i])) / Math.hypot(...a)).toFixed(1) + '%');
const st = S.createState('multi', { next: mulberry32(SEED0) }, 5);
st.slotSalt = SEED0 >>> 0;
let n = 0;
const cs = [];
for (let i = 0; i < 5; i++) {
  if (i !== 0) { cs.push(T.wrapBotN(SCR[i])); continue; }
  cs.push((state, pid, legal) => {
    n++;
    if (n <= 10) {
      const A = argmax(a, state, pid, legal), C = argmax(m18, state, pid, legal), D = argmax(m06, state, pid, legal), E = argmax(b, state, pid, legal);
      console.log('#' + n + ' ep=' + (state.p[pid].ep || 0) + ' a=' + A.key + ' | m.18=' + C.key + ' | m.06=' + D.key + ' | 另一随机=' + E.key +
        ' ‖ 候选数=' + A.n + ' ‖ 前4键=' + (A.keys || []).join(',') + ' ‖ probs=' + (A.probs || []).join('/'));
    }
    return { key: A.key, target: null, target2: null, bead: null };
  });
}
Play.autoGameN(st, cs);
console.log('总决策=' + n);
