/* 只读探针 5：阶梯定位——logit 到底经不经我设的那一格 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install } from '../tools/proto2/arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules;
let seed = 7;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const A = install(W, { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24, mutMode: 'seg' });
const L = A.L;
const sg = {}; for (const s of L.seg) sg[s.name] = s;
const seatW = (j, i) => sg.seatEnc.off + j * L.seatIn + i;
const ctxW = (j, i) => sg.ctx.off + j * L.ctxDim + i;
const candW = (j, i) => sg.cand.off + j * L.candIn + i;
const headW = (j) => sg.policyHead.off + j;

const st = S.createState('multi', { next: rng }, 5);
st.rng = { next: rng };
st.p[0].hp = 1;
for (let i = 1; i < 5; i++) st.p[i].hp = 3;
const cands = P.candidatesFor(st, 0, [{ key: R.SK.JI, affordable: true }], { lockTarget: false });
const lg = (p) => Number(P.forwardCands(st, 0, cands, p, { temp: 0.5 }).logits[0]);
const Q = (nm, p) => console.log('  ' + nm.padEnd(52) + ' logit=' + lg(p).toFixed(4));

console.log('n=' + L.n + ' ‖ seatEnc@' + sg.seatEnc.off + ' actEnc@' + sg.actEnc.off + ' ctx@' + sg.ctx.off + ' cand@' + sg.cand.off + ' head@' + sg.policyHead.off + ' q@' + sg.qHead.off);
let p = new Float64Array(L.n); Q('全零 params', p);
p = new Float64Array(L.n); p[headW(0)] = 1; Q('只设 policyHead[0]（hc0 仍是 0）', p);
p = new Float64Array(L.n); p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('cand[0,0]+head（hctx0=0 ⇒ 该 0）', p);
p = new Float64Array(L.n); p[ctxW(0, 0)] = 1; p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('ctx[0,0]=G.n + cand + head', p);
p = new Float64Array(L.n); p[ctxW(0, 2)] = 1; p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('ctx[0,2]=G.modeHp(0.5) + cand + head', p);
p = new Float64Array(L.n); p[ctxW(0, 2)] = 2; p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('ctx[0,2]=2 ⇒ 应翻倍到 1.0', p);
p = new Float64Array(L.n); p[seatW(0, 0)] = 1; p[ctxW(0, 57)] = 1; p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('seat[0,0]+ctx[0,57]=mean[0]（理论 0.8667）', p);
p = new Float64Array(L.n); p[seatW(0, 0)] = 1; p[ctxW(0, 73)] = 1; p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('seat[0,0]+ctx[0,73]=mx[0]（理论 1.0）', p);
p = new Float64Array(L.n); p[ctxW(0, 55)] = 1; p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('ctx[0,55]=sums[0]（sumStickers=0）', p);
p = new Float64Array(L.n); p[ctxW(0, 56)] = 1; p[candW(0, 0)] = 1; p[headW(0)] = 1; Q('ctx[0,56]=sums[1]=seats/6（0.8333）', p);
A.restore();
