/* 只读探针 8：A/B 判决——cand 层的权重到底从 `cand.off + j*candIn + i` 读，还是从 `j*candIn + i` 读（没加段偏移）
   构造：只让 hctx[5] > 0，再把 p[cand.off + 5]（= 正确布局下 cand 行0 列5）设成 1000。
     H-A（漏段偏移）：这一格根本不被读 ⇒ logit 不变
     H-B（段偏移生效）：hc[0] = relu(1000 * hctx[5]) ⇒ logit 巨幅跳变
   同时反向：把 p[5]（= H-A 下 cand 行0 列5 的真实位置）设 1000 ⇒ H-A 才该跳，H-B 不该跳 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install } from '../tools/proto2/arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules;
let seed = 99;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const A = install(W, { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24, mutMode: 'seg' });
const L = A.L; const sg = {}; for (const s of L.seg) sg[s.name] = s;
const st = S.createState('multi', { next: rng }, 5); st.rng = { next: rng };
st.p[0].hp = 1; for (let i = 1; i < 5; i++) st.p[i].hp = 3;
const cands = P.candidatesFor(st, 0, [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
const head = sg.policyHead.off;
const lg = (p) => Number(P.forwardCands(st, 0, cands, p, { temp: 0.5 }).logits[0]);

/* 让 xin[0] (=G.n=0.8333) 进到 hctx[5]：H-A 下 ctx 行 5 读 p[5*ctxDim .. 5*ctxDim+ctxDim-1] = p[445..533]
   H-B 下 ctx 行 5 读 p[ctx.off + 5*ctxDim .. ] = p[1405..1493] ⇒ 两种都设上，看谁能把 logit 抬起来 */
const mk = (extra) => { const p = new Float64Array(L.n); p[head] = 1; for (const k of extra) p[k.i] = k.v; return p; };
const both = [{ i: 5 * L.ctxDim + 0, v: 1 }, { i: sg.ctx.off + 5 * L.ctxDim + 0, v: 1 }];   // 两个可能的 ctx 行5 列0
const cases = [
  ['空白（只 head）', mk([])],
  ['只接通 ctx 行5（两个候选位置都设）', mk(both)],
  ['+ p[cand.off+5]=1000（H-B 该跳）', mk(both.concat([{ i: sg.cand.off + 0 * L.candIn + 5, v: 1000 }]))],
  ['+ p[0*L.candIn+5]=1000 即 p[5]（H-A 该跳）', mk(both.concat([{ i: 0 * L.candIn + 5, v: 1000 }]))],
  ['+ p[cand 段中别处 +5]=1000（两处都该无影响）', mk(both.concat([{ i: sg.cand.off + 900, v: 1000 }]))],
];
for (const [nm, p] of cases) console.log('  ' + nm.padEnd(46) + ' logit = ' + lg(p).toFixed(4));
console.log('\n  cand.off=' + sg.cand.off + ' candIn=' + L.candIn + ' ctx.off=' + sg.ctx.off + ' ctxDim=' + L.ctxDim);
console.log('  读法 A（漏段偏移）⇒ cand 行0列5 = p[' + (0 * L.candIn + 5) + '] ‖ 读法 B（正确）⇒ p[' + (sg.cand.off + 5) + ']');
/* 第三条独立证据：cand 段的 bias 在两种读法下位置相同（bias 是显式加偏移的）⇒ 设 bias 应当两种都跳 */
const pBias = mk(both.concat([{ i: sg.cand.off + L.hid2 * L.candIn + 0, v: 3.5 }]));
console.log('  独立对照：cand 行0 的 bias p[' + (sg.cand.off + L.hid2 * L.candIn) + ']=3.5 ⇒ logit=' + lg(pBias).toFixed(4) + '（bias 加了偏移 ⇒ 该跳）');
A.restore();
