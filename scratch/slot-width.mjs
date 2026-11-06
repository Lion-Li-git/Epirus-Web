/* "obs2 只写 2 个对手槽"这句不能靠读 MANIFEST 就下结论（今天就是这么错过 PLAYER_SLOTS 的）。
 * 直接量：n=6，**只动某一席的 ep**（血量与排序冻住），数两份编码各变了多少维、变在哪一块。 */
import { sandbox } from '../tools/audit-lib.mjs';
import { encode as enc2, MANIFEST as m2 } from '../tools/proto2/obs2.mjs';
import { encode as enc3, blocks as b3 } from '../tools/proto2/obs3.mjs';
import { encode as encC3 } from '../tools/proto2/obs3.mjs';
const W = sandbox(); const S = W.EpirusState, R = W.EpirusRules;
const N = 6;
const st = S.createState('multi', { next: () => 0.37 }, N); st.rng = { next: () => 0.37 };
const HPS = [3, 1, 1, 2, 2, 2];                     /* 冻住 hp 排序 ⇒ 扰动不会把谁挤进/挤出槽位 */
st.p.forEach((q, i) => { q.hp = HPS[i]; q.ep = 4; });
const mnames2 = m2, mnames3 = b3(R);
const c = { key: 'gun', target: 1, target2: null, bead: null };
const f2 = Array.from(enc2(W, st, 0, c)), f3 = Array.from(enc3(W, st, 0, c));
const zone = (ms, i) => { const r = ms.find((x) => x.i === i); return r ? r.block + '.' + r.name : '#' + i; };
console.log('# obs2 ' + f2.length + ' 维 ‖ obs3 ' + f3.length + ' 维 ‖ n=' + N + '，候选固定为 `gun → p1`');
for (let k = 1; k < N; k++) {
  const st2 = S.cloneState(st); st2.rng = { next: () => 0.37 }; st2.p[k].ep = 11;
  const g2 = Array.from(enc2(W, st2, 0, c)), g3 = Array.from(enc3(W, st2, 0, c));
  const d2 = [], d3 = [];
  for (let i = 0; i < f2.length; i++) if (Math.abs(f2[i] - g2[i]) > 1e-12) d2.push(zone(mnames2, i));
  for (let i = 0; i < f3.length; i++) if (Math.abs(f3[i] - g3[i]) > 1e-12) d3.push(zone(mnames3, i));
  console.log('  动 p' + k + ' 的 ep→11 ‖ obs2 变 ' + String(d2.length).padStart(2) + ' 维 [' + d2.slice(0, 6).join(',') + ']' + (d2.length === 0 ? '  ⛔ **这一席在 obs2 里根本不存在**' : '')
    + '\n            ‖ obs3 变 ' + String(d3.length).padStart(2) + ' 维 [' + d3.slice(0, 6).join(',') + ']');
}
