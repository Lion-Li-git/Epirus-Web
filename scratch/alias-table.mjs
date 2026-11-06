/* 一次性账：v7 那 22 维 `actionFeatures` 把 30 个技能键分成几格（同一局面、无目标候选）——
 * 这是"输入面分辨率"的架构级读数，喂给 CHAMPION-2.0-ARCH 那篇文档。obs3 的 210 维当对照。 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
import { encode as obs3Encode } from '../tools/proto2/obs3.mjs';
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
const POOL = (function () { const real = Math.random; try { Math.random = T.mulberry32(20261029); return T.buildOpps(v7, 0.05); } finally { Math.random = real; } })();
let cap = null;
const probe = (st, pid, legal) => { if (!cap && pid === 0 && st.round >= 6 && legal && legal.length) cap = { state: S.cloneState(st), pid, legal }; return POOL[0].sel(st, pid, legal); };
const choosers = []; for (let pid = 0; pid < 5; pid++) choosers.push(pid === 0 ? probe : POOL[(pid + 1) % 5].sel);
T.oneGameN(choosers, 1607, 5, { regen: 0, mode: 'multi' });
const st = cap.state, pid = cap.pid;
/* 不走候选表（它按经济筛掉一批），而是**直接问两个特征函数**：每个技能键一枚无目标假候选 */
const keys = R.skills.map((s) => s.key);
const fake = (k) => ({ key: k, target: null, target2: null, bead: null });
const g22 = {}, g210 = {};
for (const k of keys) {
  const c = fake(k);
  g22[Array.from(P.actionFeatures(st, pid, k, c)).map((x) => Number(x).toFixed(4)).join(',')] = (g22[Array.from(P.actionFeatures(st, pid, k, c)).map((x) => Number(x).toFixed(4)).join(',')] || []).concat(k);
  const e = obs3Encode(W, st, pid, c);
  g210[Array.from(e).map((x) => Number(x).toFixed(4)).join(',')] = (g210[Array.from(e).map((x) => Number(x).toFixed(4)).join(',')] || []).concat(k);
}
const cls = (o) => Object.values(o).filter((v) => v.length > 1).sort((a, b) => b.length - a.length);
const c22 = cls(g22), c210 = cls(g210);
console.log('# 30 个技能键（同一局面、无目标假候选）在两个输入面上的分辨率');
console.log('  v7 的 22 维 actionFeatures：' + keys.length + ' 键 → ' + Object.keys(g22).length + ' 格 ‖ 撞车组 ' + c22.length + ' 组');
c22.forEach((v) => console.log('     · ' + v.join(' ≡ ')));
console.log('  obs3 的 210 维逐候选编码：' + keys.length + ' 键 → ' + Object.keys(g210).length + ' 格 ‖ 撞车组 ' + c210.length + ' 组');
c210.forEach((v) => console.log('     · ' + v.join(' ≡ ')));
