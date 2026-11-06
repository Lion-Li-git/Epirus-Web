/* D16 红了要问"该不该红"：这条对账量的是**我改 policy.js 之前/之后，v7 线上包打出来的每一手是否逐字相同**。
 * 旧树 = `git archive HEAD tools js` 解到 scratch/preDispatch（自带它那份 audit-lib，CORE 里没有 policy2.js）。
 * 原件：scratch/qoder-1030-v7-unchanged.mjs ‖ 用法：node scratch/qoder-1030-v7-unchanged.mjs */
import { sandbox as sandboxNew, loadChamp as loadNew } from '../tools/audit-lib.mjs';
import { sandbox as sandboxOld, loadChamp as loadOld } from './preDispatch/tools/audit-lib.mjs';

const PACK = 'js/bundled-champion-3p.js';
const A = sandboxOld(), B = sandboxNew();
const pa = loadOld(A, PACK, ''), pb = loadNew(B, PACK, '');
if (!pa || !pb) { console.error('⛔ 有一侧读不出线上 3P 包 ⇒ 这条对账没跑成（旧树 ' + !!pa + ' ‖ 新树 ' + !!pb + '）'); process.exit(8); }
console.log('params：旧 ' + pa.length + ' ‖ 新 ' + pb.length + ' ‖ 逐字相同 ' + (Array.from(pa).join() === Array.from(pb).join()));
console.log('装载差：旧树 EpirusPolicy2=' + (typeof A.EpirusPolicy2) + ' ‖ 新树=' + (typeof B.EpirusPolicy2));

function seq(W, p, seed, n) {
  const T = W.EpirusTrainer, Play = W.EpirusPlay;
  const sel = T.policyChooserN(p, 0.15);
  const cs = []; for (let i = 0; i < n; i++) cs.push(sel);
  const tr = [];
  const wrapped = cs.map((f) => (st, pid, legal) => {
    const a = f(st, pid, legal);
    tr.push(pid + ':' + a.key + '/' + (a.target == null ? '-' : a.target) + '/' + (a.bead || '-'));
    return a;
  });
  const st = W.EpirusState.createState('multi', { next: T.mulberry32(seed) }, n);
  st.rng = { next: T.mulberry32(seed) };
  Play.autoGameN(st, wrapped);
  return { tr, rounds: st.round, over: !!st.over };
}
let allSame = true, tot = 0;
for (const seed of [11, 22, 33]) for (const n of [2, 3, 5]) {
  const a = seq(A, pa, seed, n), b = seq(B, pb, seed, n);
  tot += a.tr.length;
  const same = a.tr.length === b.tr.length && a.tr.every((v, i) => v === b.tr[i]) && a.rounds === b.rounds && a.over === b.over;
  if (!same) {
    allSame = false;
    const i = a.tr.findIndex((v, j) => v !== b.tr[j]);
    console.log('  ✘ 分叉 seed=' + seed + ' n=' + n + ' 第 ' + i + ' 手：旧 ' + a.tr[i] + ' vs 新 ' + b.tr[i]);
  } else {
    console.log('  ✔ seed=' + seed + ' n=' + n + ' ⇒ ' + a.tr.length + ' 手逐手相同（回合 ' + a.rounds + ' ‖ over=' + a.over + '）');
  }
}
/* 再补一刀：直接比打分器本身（同一局面同一候选表 ⇒ logits 必须逐位） */
const S = B.EpirusState, P = B.EpirusPolicy, T = B.EpirusTrainer;
const st = S.createState('multi', { next: T.mulberry32(90210) }, 5);
st.rng = { next: T.mulberry32(90210) };
const cands = P.candidatesFor(st, 0, T.econBase(st, 0, B.EpirusPlay.legalActions(st, 0)), { lockTarget: false });
const fa = A.EpirusPolicy.forwardCands(st, 0, cands, pa, { temp: 0.15 });
const fb = P.forwardCands(st, 0, cands, pb, { temp: 0.15 });
const keyOf=(f)=>JSON.stringify({probs:Array.from(f.probs||[]), argmax:f.argmax, candKey:(f.cand&&f.cand.key)||null});
const bitSame = keyOf(fa) === keyOf(fb);
console.log('打分器逐位：候选 ' + cands.length + ' 枚 ‖ probs/argmax/cand ' + (bitSame ? '逐位相同 ✔' : '**不同 ✘**') + ' ‖ argmax ' + fa.argmax + ' / ' + fb.argmax + '（旧树返回形状键=' + Object.keys(fa).join(',') + '）');
console.log(allSame && bitSame ? ('⇒ v7 线上包在新旧两棵树上共 ' + tot + ' 手 + 一次打分**完全一致** ⇒ D16 的红是"文件变了"这一族的自动提醒，不是行为变了') : '⇒ 有差：D16 报的是真行为变化');
process.exit(allSame && bitSame ? 0 : 8);
