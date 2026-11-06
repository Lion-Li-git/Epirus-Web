/* 只读探针 4b：逐格读出 S1o 前向内部的 ctx 输入向量 xin（修掉 4a 的下标优先级错误）
   构造：seatEnc[0,0]=1（每席 e0=relu(hp/modeHp)）、ctx[0,i]=1（hctx0=relu(xin[i])）、
        cand[0,0]=1（hc0=relu(hctx0)）、policyHead[0]=1 ⇒ logit = max(0, xin[i]) */
import { sandbox } from '../tools/audit-lib.mjs';
import { install } from '../tools/proto2/arch2.mjs';
import * as O3 from '../tools/proto2/obs3.mjs';

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
const sc = O3.scene(W, st, 0);
const xinHand = [...sc.g, ...sc.priv, ...sc.seq, ...sc.sums];
const nameOf = (i) => {
  if (i < sc.g.length) return ['G.n', 'G.alive', 'G.modeHp', 'G.round', 'G.epRegen'][i];
  if (i < sc.g.length + sc.priv.length) return 'priv.' + (i - sc.g.length === 0 ? 'ownElec' : 'ownBoom');
  if (i < xinHand.length - sc.sums.length) return 'seq[' + (i - sc.g.length - sc.priv.length) + ']';
  if (i < xinHand.length) return 'sums[' + (i - (xinHand.length - sc.sums.length)) + ']';
  if (i < xinHand.length + L.seatH) return 'mean[' + (i - xinHand.length) + ']';
  return 'mx[' + (i - xinHand.length - L.seatH) + ']';
};

console.log('selfDim=' + L.selfDim + ' ctxDim=' + L.ctxDim + ' seatH=' + L.seatH + ' ‖ xinHand.length=' + xinHand.length);
let bad = 0;
const rows = [];
for (let i = 0; i < L.ctxDim; i++) {
  const p = new Float64Array(L.n);
  p[seatW(0, 0)] = 1;
  p[ctxW(0, i)] = 1;
  p[candW(0, 0)] = 1;
  p[headW(0)] = 1;
  const got = Number(P.forwardCands(st, 0, cands, p, { temp: 0.5 }).logits[0]);
  const hand = i < xinHand.length ? xinHand[i] : null;
  const expect = hand;
  const mism = hand !== null && Math.abs(hand - got) > 1e-9;
  if (mism) bad++;
  rows.push({ i, got, hand, mism, name: nameOf(i) });
}
for (const r of rows) {
  if (r.i < 8 || (r.i >= xinHand.length - 4 && r.i <= xinHand.length + 2) || r.mism) {
    console.log('  idx ' + String(r.i).padStart(2) + ' ' + r.name.padEnd(12) + ' 网络=' + r.got.toFixed(4) +
      (r.hand === null ? ' 手工=（池化段，见下）' : ' 手工=' + r.hand.toFixed(4)) + (r.mism ? '  ⚠️ 不一致' : ''));
  }
}
console.log('⇒ 平面向量那 57 格逐格对账：不一致 ' + bad + ' 格 / 57');

/* 池化段：只读 mean[0] 与 mx[0]，与"含自己 / 只算对手"两个理论值并排 */
const mean0 = (p2) => Number(P.forwardCands(st, 0, cands, p2, { temp: 0.5 }).logits[0]);
const pm = new Float64Array(L.n); pm[seatW(0, 0)] = 1; pm[ctxW(0, xinHand.length)] = 1; pm[candW(0, 0)] = 1; pm[headW(0)] = 1;
const px = new Float64Array(L.n); px[seatW(0, 0)] = 1; px[ctxW(0, xinHand.length + L.seatH)] = 1; px[candW(0, 0)] = 1; px[headW(0)] = 1;
const inclSelf = ((1 / 3) + 4) / 5, oppOnly = 4 / 4;
console.log('\n  网络 mean[0] = ' + mean0(pm).toFixed(4) + ' ‖ mx[0] = ' + mean0(px).toFixed(4));
console.log('  理论：全体含自己 = ' + inclSelf.toFixed(4) + ' ‖ 只算对手 = ' + oppOnly.toFixed(4) + ' ‖ 只算对手取最大 = 1.0000');
console.log('  obs3.encode 的 pool.mean.hp = ' + (O3.encode(W, st, 0, cands[0])[O3.blocks(R).findIndex((x) => x.name === 'pool.mean.hp')]).toFixed(4) +
    ' ‖ pool.max.hp = ' + (O3.encode(W, st, 0, cands[0])[O3.blocks(R).findIndex((x) => x.name === 'pool.max.hp')]).toFixed(4));
console.log('  ⇒ 网络的池化' + (Math.abs(mean0(pm) - inclSelf) < 1e-9 ? '【含自己】' : Math.abs(mean0(pm) - oppOnly) < 1e-9 ? '【只算对手】' : '【口径不明，见上两行】'));

/* 死席对照：杀一个对手 + 杀自己，看分母怎么变 */
const report = (tag) => {
  const a = mean0(pm), b = mean0(px);
  const alive = st.p.filter((q) => q.hp > 0).length;
  console.log('  ' + tag + ' 存活=' + alive + ' ⇒ 网络 mean[0]=' + a.toFixed(4) + ' ‖ mx[0]=' + b.toFixed(4) +
    ' ‖ encode pool.mean.hp=' + O3.encode(W, st, 0, cands[0])[O3.blocks(R).findIndex((x) => x.name === 'pool.mean.hp')].toFixed(4));
};
report('开局：');
st.p[4].hp = 0; report('杀对手 4：');
st.p[0].hp = 0; report('再杀自己：');
A.restore();
