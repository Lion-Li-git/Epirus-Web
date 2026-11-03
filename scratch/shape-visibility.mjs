/* 上一张表只证明"跑得不抛"。**看得见的席数**要另测：
 * 逐席扰动（改 hp ⇒ 该席状态变了）看 logits 动不动。动 = 那一席进了输入；**逐位不动 = 这一席对这档根本不存在**。
 * 阳性对照 = 扰动第 1 号对手（v7 面第 1 槽），它必须动。 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
const N = 8;
const st = S.createState('multi', { next: () => 0.37 }, N);
st.rng = { next: () => 0.37 };
/* ⭐ 关键设计：让 p1..p4 是血量**最低的四席**（v7 面的四个对手槽按 hp 升序取），p5..p7 血量高 ⇒ 槽位集合冻住；
 *   扰动只动 ep、不动 hp ⇒ 不会把某席挤进/挤出槽位。于是"S1 看不见 p5..p7"这条才判得出来。 */
const HPS = [3, 1, 1, 1, 1, 3, 3, 3];
st.p.forEach((q, i) => { q.hp = HPS[i]; q.ep = 4 + (i % 3); });
const legal = Play.legalActions(st, 0);
const cands = P.candidatesFor(st, 0, T.econBase(st, 0, legal), { lockTarget: false });
function run(input, pidPerturb) {
  const A = installArch2(W, input === 'obs3' ? { mutMode: 'seg', input: 'obs3' } : { mutMode: 'seg' });
  const h = Float64Array.from(P.makePolicy(input === 'obs3' ? 0.25 : 0.25));
  const base = Array.from(P.forwardCands(st, 0, cands, h, { temp: 0.5 }).logits);
  const st2 = S.cloneState(st); st2.rng = { next: () => 0.37 };
  st2.p[pidPerturb].ep = 11;   /* **只动 ep**：血量保持 ⇒ v7 那四个对手槽的归属不变 ⇒ "看不见"才判得干净 */
  const alt = Array.from(P.forwardCands(st2, 0, cands, h, { temp: 0.5 }).logits);   /* 同一份权重、同一张候选表，只换那一席 */
  A.restore();
  let d = 0; for (let i = 0; i < base.length; i++) d = Math.max(d, Math.abs(base[i] - alt[i]));
  return d;
}
console.log('# 逐席扰动的最大 |Δlogit|（n=' + N + ' ‖ 候选 ' + cands.length + ' 枚 ‖ 扰动 p_k 的 hp:3→1 与 ep→11）');
console.log('| 扰动那一席 | S1（吃 v7 特征面） | S1o（吃 obs3） |');
console.log('| --- | --- | --- |');
for (let k = 1; k < N; k++) {
  const d1 = run('v7', k), d2 = run('obs3', k);
  console.log('| p' + k + (k === 1 ? '（阳性对照：第 1 槽）' : '') + ' | ' + (d1 < 1e-12 ? '**逐位不动 = 看不见**' : d1.toFixed(6)) + ' | ' + (d2 < 1e-12 ? '**逐位不动 = 看不见**' : d2.toFixed(6)) + ' |');
}
