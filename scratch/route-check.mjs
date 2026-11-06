import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2 } from '../tools/proto2/arch2.mjs';
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer;
const v7 = Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js', ''));
console.log('v7 长度', v7.length, '‖ 装档前 paramCount', P.paramCount(), '‖ shapeOf(v7)=', JSON.stringify(P.shapeOf(v7)));
const A = installArch2(W, { mutMode: 'seg' });
console.log('装 S1 后 paramCount', P.paramCount(), '‖ shapeOf(v7)=', JSON.stringify(P.shapeOf(v7)));
const POOL = T.buildOpps(v7, 0.05);
const before = A.CNT.forwards;
const sel = T.policyChooserN(v7, 0.001);
let games = 0;
for (let g = 0; g < 3; g++) { const cs = []; for (let pid = 0; pid < 3; pid++) cs.push(sel); T.oneGameN(cs, 555 + g, 3, { regen: 0, mode: 'multi' }); games++; }
console.log('⇒ 用 **v7 包** 走 ' + games + ' 局之后，2.0 的 forwardCands 被叫了 ' + (A.CNT.forwards - before) + ' 次（chooseCandidates ' + A.CNT.cands + ' 个候选打分）');
console.log(A.CNT.forwards - before > 0 ? '⛔ 确诊：装了 2.0 档之后，v7 的包被路由进 2.0 的 chooseCandidates/forwardCands ⇒ 按 5258/5650 的偏移切 5689 条权重' : '✔ v7 那条路没被接走');
