/* 只读：obs3 的 endgame 维 vs 规则的终局点（收缩起点 / 回合上限），逐桌形统计出现率 */
import { sandbox } from '../tools/audit-lib.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const M = O3.blocks(R); const iEnd = M.findIndex((x) => x.name === 'endgame'), iR = M.findIndex((x) => x.name === 'round');
let seed = 2026;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function cancelOtherLocal(state, pid) { for (let i = state.events.length - 1; i >= 0; i--) { const e = state.events[i];
  if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0]; } return null; }
for (const shape of [{ n: 5, m: 'multi' }, { n: 5, m: 'multi4' }, { n: 5, m: 'long' }, { n: 3, m: 'long' }]) {
  const st = S.createState(shape.m, { next: rng }, shape.n); st.rng = { next: rng };
  const sdOn = (st.mode && st.mode.suddenDeath != null) ? st.mode.suddenDeath : R.SUDDEN_DEATH;
  const maxR = (st.mode && st.mode.maxRounds) || R.MAX_ROUNDS;
  let dec = 0, endOn = 0, shrinkOn = 0, both = 0, roundMax = 0;
  const ch = [];
  for (let pid = 0; pid < shape.n; pid++) {
    const sel = T.policyChooserN(Float64Array.from(P.makePolicy(0.25)), 0.15);
    ch.push((s, p, legal) => {
      const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
      if (cs.length) { const v = O3.encode(W, s, p, cs[0]); dec++; if (v[iEnd] > 0) endOn++; if (s.round >= sdOn) shrinkOn++; if (v[iEnd] > 0 && s.round >= sdOn) both++; roundMax = Math.max(roundMax, s.round); }
      return sel(s, p, legal);
    });
  }
  Play.autoGameN(st, ch);
  console.log('  ' + (shape.n + ':' + shape.m).padEnd(10) + ' 规则：收缩@' + sdOn + ' 上限@' + maxR +
    ' ‖ 决策 ' + dec + ' ‖ endgame=1 出现率 ' + (100 * endOn / Math.max(1, dec)).toFixed(1) + '%' +
    ' ‖ 真已收缩 ' + (100 * shrinkOn / Math.max(1, dec)).toFixed(1) + '% ‖ 两者同时 ' + (100 * both / Math.max(1, dec)).toFixed(1) + '%' +
    ' ‖ G.round 最大读数 ' + (roundMax / R.MAX_ROUNDS).toFixed(2) + '（分母只认 60）');
}
