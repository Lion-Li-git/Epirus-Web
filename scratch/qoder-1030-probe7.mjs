/* 只读探针 7：2.0 前向的**权重可达性扫描**
   动机：`encode(p, x, inDim, outDim, biasOff, out)` 里权重下标是 `p[j*inDim + i]`，**没有加段偏移 seg.off**，
        而 bias 用的是 `p[biasOff + j]`（加了偏移）。⇒ 除第一段外，每一层的权重都从参数向量的**开头**读。
   判据：对每一个参数下标 +δ 扰动，看 logits 是否变化 ⇒ 拿到"真被读到的权重"全集，与段表并排。
   两条对照：① 同一把尺跑 S1（v7 输入面），看是不是同一条 bug；② 只改 qHead ⇒ logits 必须不动（那是设计如此，不能混进来当"死权"） */
import { sandbox } from '../tools/audit-lib.mjs';
import { install } from '../tools/proto2/arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules;
let seed = 99;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const st = S.createState('multi', { next: rng }, 5);
st.rng = { next: rng };
/* 让局面非平凡：中局一点，候选多一点 */
st.p[0].ep = 6; st.p[0].hp = 2; for (let i = 1; i < 5; i++) { st.p[i].hp = 3; st.p[i].ep = i; }
st.round = 5;

function scan(tag, opts, expectSegs) {
  const A = install(W, Object.assign({ mutMode: 'seg' }, opts));
  const L = A.L;
  const sg = {}; for (const s of L.seg) sg[s.name] = s;
  const cands = P.candidatesFor(st, 0, [{ key: R.SK.JI, affordable: true }, { key: 'gun', affordable: true, target: 1 }, { key: 'guard', affordable: true }], { lockTarget: false });
  const base0 = Float64Array.from(P.makePolicy(0.25));
  const lgOf = (p) => Array.from(P.forwardCands(st, 0, cands, p, { temp: 0.5 }).logits).join(',');
  const b0 = lgOf(base0);
  const alive = new Uint8Array(L.n);
  const d = 1e-6;
  for (let i = 0; i < L.n; i++) {
    const keep = base0[i]; base0[i] = keep + d;
    if (lgOf(base0) !== b0) alive[i] = 1;
    base0[i] = keep;
  }
  let nAlive = 0; for (let i = 0; i < L.n; i++) nAlive += alive[i];
  console.log('\n### ' + tag + ' ‖ n=' + L.n + ' ‖ 候选 ' + cands.length + ' ‖ 真被读到的权重 ' + nAlive + ' / ' + L.n +
    '（' + (100 * nAlive / L.n).toFixed(1) + '%）‖ 死权重 ' + (L.n - nAlive) + '（' + (100 * (1 - nAlive / L.n)).toFixed(1) + '%）');
  for (const s of L.seg) {
    let a = 0; for (let i = s.off; i < s.off + s.len; i++) a += alive[i];
    console.log('   ' + s.name.padEnd(11) + ' off=' + String(s.off).padStart(5) + ' len=' + String(s.len).padStart(5) +
      ' ⇒ 该段被读到 ' + a + '/' + s.len + '（' + (100 * a / s.len).toFixed(1) + '%）');
  }
  /* 首个不被读到的下标 + 最后被读到的下标 */
  let firstDead = -1, lastAlive = -1;
  for (let i = 0; i < L.n; i++) { if (!alive[i] && firstDead < 0) firstDead = i; if (alive[i]) lastAlive = i; }
  console.log('   首个死下标=' + firstDead + ' ‖ 最后一个活下标=' + lastAlive);
  A.restore();
  return { alive, L };
}

const r3 = scan('S1o（obs3 输入面，现役 2.0 档）', { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24 });
const r7 = scan('S1（v7 输入面，2.0 的另一档）', { seatH: 16, actH: 8, hid: 32, hid2: 24 });

/* 预测核对：S1o 里 ctx 层读到 j*ctxDim+i ⇒ 最大下标 hid*ctxDim-1；cand 层 ⇒ hid2*candIn-1；取最大者 */
{
  const L = r3.L; const sg = {}; for (const s of L.seg) sg[s.name] = s;
  const need = Math.max(L.hid * L.ctxDim, L.hid2 * L.candIn, L.actH * L.actIn, L.seatH * L.seatIn);
  console.log('\n预测：若权重一律从下标 0 读，则活权重应当是 0..' + (need - 1) + ' 加上 policyHead（' + sg.policyHead.off + '..' + (sg.policyHead.off + L.hid2) + '）');
  const predicted = new Uint8Array(L.n);
  for (let i = 0; i < need; i++) predicted[i] = 1;
  for (let j = 0; j <= L.hid2; j++) predicted[sg.policyHead.off + j] = 1;
  let diff = 0;
  for (let i = 0; i < L.n; i++) if (predicted[i] !== r3.alive[i]) diff++;
  console.log('与实测逐下标对账：不一致 ' + diff + ' 个下标' + (diff === 0 ? ' ⇒ 预测成立（层的权重确实没加段偏移）' : ''));
  if (diff) { let shown = 0; for (let i = 0; i < L.n && shown < 24; i++) if (predicted[i] !== r3.alive[i]) { console.log('   ✗ idx ' + i + ' 预测=' + predicted[i] + ' 实测=' + r3.alive[i]); shown++; } }
}
