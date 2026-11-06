/* 只读探针 9：把"永不读"的下标集合算出来并实测核对（ logits 与 Q(s) 两头都查）
   解析：encode() 权重下标 = j*inDim + i（没有 seg.off）⇒ 各层实际读 [0, rows*inDim)
        bias 仍按 seg.off 读 ⇒ 活下标 = [0, maxRowsInDim) ∪ 各段 bias 区 ∪ policyHead ∪ qHead */
import { sandbox } from '../tools/audit-lib.mjs';
import { install } from '../tools/proto2/arch2.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay, T = W.EpirusTrainer;
let seed = 5150;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function analyze(tag, opts) {
  const A = install(W, Object.assign({ mutMode: 'seg' }, opts));
  const L = A.L; const sg = {}; for (const s of L.seg) sg[s.name] = s;
  const rowsRead = { seatEnc: L.seatH * L.seatIn, actEnc: L.actH * L.actIn, ctx: L.hid * L.ctxDim, cand: L.hid2 * L.candIn };
  const wUpTo = Math.max(...Object.values(rowsRead));
  const alive = new Uint8Array(L.n);
  for (let i = 0; i < wUpTo; i++) alive[i] = 1;
  for (const nm of ['seatEnc', 'actEnc', 'ctx', 'cand']) {
    const b = sg[nm].off + rowsRead[nm];
    const blen = { seatEnc: L.seatH, actEnc: L.actH, ctx: L.hid, cand: L.hid2 }[nm];
    for (let j = 0; j < blen; j++) alive[b + j] = 1;
  }
  for (let j = 0; j <= L.hid2; j++) alive[sg.policyHead.off + j] = 1;
  for (let j = 0; j <= L.hid; j++) alive[sg.qHead.off + j] = 1;
  /* 交互头是**显式加段偏移**读的（arch2 里唯一写对偏移的一段）⇒ 它的下标算活 */
  if (L.interK > 0 && sg.inter) for (let i = sg.inter.off; i < sg.inter.off + L.interK * L.interStride; i++) alive[i] = 1;
  const never = [];
  for (let i = 0; i < L.n; i++) if (!alive[i]) never.push(i);
  console.log('\n### ' + tag + ' ‖ 声明参数 ' + L.n + ' ‖ 解析：任何前向都不会读的下标 ' + never.length + ' 个（' + (100 * never.length / L.n).toFixed(1) + '%）');
  console.log('   各层"从下标 0 起"读到的范围：' + Object.entries(rowsRead).map(([k, v]) => k + '→[0,' + v + ')').join(' ‖ '));
  console.log('   声明段表（功能层真实位置应当是）：' + L.seg.map((s) => s.name + '@' + s.off + '+' + s.len).join(' ‖ '));
  /* 实测核对：取 never 集合的若干代表 + 连续区间的和，扰动后 logits 与 q 都不许动 */
  const st = S.createState('long', { next: rng }, 5); st.rng = { next: rng };
  st.round = 9;
  for (let i = 0; i < 5; i++) { st.p[i].hp = (i % 3) + 1; st.p[i].ep = i; st.p[i].stickers = [{ age: 1 }, { age: 2 }]; st.p[i].mineTurns = i % 3; st.p[i].tauntActive = i % 2 === 0; }
  const legal = Play.legalActions(st, 0);
  const cands = P.candidatesFor(st, 0, T.econBase(st, 0, legal), { lockTarget: false });
  const p = Float64Array.from(P.makePolicy(0.25));
  const snap = () => { const f = P.forwardCands(st, 0, cands, p, { temp: 0.5 }); return Array.from(f.logits).map((x) => x.toFixed(12)).join(',') + '|' + f.q.toFixed(12); };
  const before = snap();
  let touched = 0;
  const sample = never.filter((_, k) => k % Math.max(1, Math.floor(never.length / 40)) === 0).slice(0, 40);
  for (const i of sample) { const keep = p[i]; p[i] = keep + 7.5; if (snap() !== before) touched++; p[i] = keep; }
  /* 整段一次性灌大：最狠的变异（若真有人读，输出必然炸） */
  const keepAll = Float64Array.from(p);
  for (const i of never) p[i] = 999;
  const afterBulk = snap(); const bulkChanged = afterBulk !== before;
  for (let i = 0; i < L.n; i++) p[i] = keepAll[i];
  /* 阳性对照：动 [0, wUpTo) 里的一格，必须变（否则这条扫描本身是瞎的） */
  const keepX = p[3000 < L.n ? 100 : 100]; p[100] = keepX + 7.5; const posChanged = snap() !== before; p[100] = keepX;
  console.log('   实测：抽 ' + sample.length + ' 个 never 下标各 +7.5 ⇒ 输出变化 ' + touched + ' 次（应为 0）');
  console.log('   实测：把 ' + never.length + ' 个 never 下标全灌成 999 ⇒ 输出' + (bulkChanged ? '变了 ⚠️（解析不成立，需重看）' : '逐位不变 ✔'));
  console.log('   阳性对照：动下标 100 ⇒ 输出' + (posChanged ? '变了 ✔（说明这把尺看得见）' : '没变 ⚠️ 尺是瞎的'));
  A.restore();
  return { never: never.length, n: L.n };
}
analyze('S1o（obs3 输入面）', { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24 });
analyze('S1（v7 输入面）', { seatH: 16, actH: 8, hid: 32, hid2: 24 });
analyze('S1o + 交互头 inter=4（ZCode 10-30 加的那段）', { input: 'obs3', seatH: 16, actH: 8, hid: 32, hid2: 24, inter: 4 });
