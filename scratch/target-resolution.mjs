/* §十二 那条"仍没账"的补法：特征面（ae/obs3）分不开 ≠ 头分不开——目标身份走 `te`（席位嵌入）。
 * 所以真正要问的是：**只差目标的候选，头的输出分不分得开？只差 target2 的呢？**
 * 黑盒做法：同一决策的整张候选表按 (key,bead) 分组，组内只让 target / target2 变，看 logits 是否逐位相等。
 *   · 组内全等 ⇒ 那一路输入是**死的**（任何训练配方都救不了）
 *   · 组内有差 ⇒ 看得见（是否用得好是另一件事）
 * 四种粒各测一遍：随机起点(S1/S1o) ‖ B8(S1) ‖ R1(S1) ‖ N2(S1o)。 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, Play = W.EpirusPlay, S = W.EpirusState;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
function mulberry(sv) { let a = sv >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const POOL = (function () { const real = Math.random; try { Math.random = mulberry(20261029); return T.buildOpps(v7, 0.05); } finally { Math.random = real; } })();
function fix(seedVal, seat, minRound) {
  let cap = null;
  const probe = (st, pid, legal) => { if (!cap && pid === seat && st.round >= minRound && legal && legal.length) cap = { state: S.cloneState(st), pid, legal }; return POOL[0].sel(st, pid, legal); };
  const cs = []; for (let pid = 0; pid < 5; pid++) cs.push(pid === seat ? probe : POOL[(pid + 1) % 5].sel);
  T.oneGameN(cs, seedVal, 5, { regen: 0, mode: 'multi' });
  return cap;
}
const PACKS = [['随机起点 S1', null, {}], ['随机起点 S1o', null, { input: 'obs3' }],
  ['B8-fx (S1)', 'scratch/arms/B8-fx-S1.bak', null], ['R1-v7fix (S1)', 'scratch/arms/R1-v7fix-S1.bak', null],
  ['N2-fx (S1o)', 'scratch/arms/N2-fx-S1o.bak', null]];
const FIXES = [[1607, 0, 6], [2213, 1, 5], [3301, 2, 8]];
for (const [tag, path, cfgOverride] of PACKS) {
  let cfg = { mutMode: 'seg', ...(cfgOverride || {}) }, raw = null;
  if (path) { raw = JSON.parse(readFileSync(path, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, '')); cfg = { mutMode: 'seg', ...(raw.dims || {}) }; if ((raw.arch || 'S1') === 'S1o') cfg.input = 'obs3'; }
  const A = installArch2(W, cfg);
  const head = path ? Float64Array.from(P.unpack(raw, true)) : Float64Array.from(P.makePolicy(0.25));
  let grpT = 0, flatT = 0, grpT2 = 0, flatT2 = 0, ex = null;
  for (const [sd, seat, mr] of FIXES) {
    const fx = fix(sd, seat, mr); if (!fx) continue;
    const cands = P.candidatesFor(fx.state, fx.pid, T.econBase(fx.state, fx.pid, fx.legal), { lockTarget: false }) || [];
    const lg = Array.from(P.forwardCands(fx.state, fx.pid, cands, head, { temp: 0.001 }).logits);
    const gT = {}, gT2 = {};
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      if (c.target != null) { const k = c.key + '/' + (c.bead || '-') + '/t2=' + (c.target2 == null ? '-' : c.target2); (gT[k] || (gT[k] = [])).push(lg[i]); }
      if (c.target != null && c.target2 != null) { const k = c.key + '/' + (c.bead || '-') + '/t=' + c.target; (gT2[k] || (gT2[k] = [])).push(lg[i]); }
    }
    for (const v of Object.values(gT)) { grpT++; if (v.length > 1 && v.every((x) => Math.abs(x - v[0]) < 1e-12)) { flatT++; ex = ex || cands.length; } }
    for (const v of Object.values(gT2)) { grpT2++; if (v.length > 1 && v.every((x) => Math.abs(x - v[0]) < 1e-12)) flatT2++; }
  }
  console.log('  ' + tag.padEnd(16) + ' ‖ 只差**目标**的组：' + grpT + ' 组 ‖ 组内逐位全等 **' + flatT + '** 组（' + (100 * flatT / Math.max(1, grpT)).toFixed(1) + '%）'
    + ' ‖ 只差**第二目标**的组：' + grpT2 + ' 组 ‖ 全等 ' + flatT2 + ' 组（' + (100 * flatT2 / Math.max(1, grpT2)).toFixed(1) + '%）');
  A.restore();
}
