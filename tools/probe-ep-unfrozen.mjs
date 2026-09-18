/* L1 的字面验证（objective ③ 那句"抬 ep 编码上限 ⇒ 16/20/30/40 是否不再逐位相同"）
 * ⚠ **不落盘改任何代码**：`js/train/policy.js` 在磁盘上**一个字节都不动**（它在规则指纹覆盖范围内，
 *   改了指纹就变 ⇒ D16 会把在位包的成绩账判过期；而"抬编码上限"本身是换代级改动，不该由我半夜单方面做）。
 *   这里的做法是：把 policy.js 的**源码字符串在内存里**换掉 6 个 ep 编码点，喂给一个**新的 vm 沙盒**去执行。
 *   ⇒ 磁盘上的仓库、指纹、np-test、线上包全部不受影响；变的只是这个探针自己的沙盒。
 * 三个变体：`original`（原样，作对照）· `linear40`（把 12 换成 40）· `log40`（提案 A：log1p 压缩）。
 * 每个变体量两件事：
 *   ① **逐位相同**：同一快照只改 ep ∈ {12,16,20,30,40,60} ⇒ `featuresV7` 产出几个**不同向量**；
 *   ② **解冻之后有没有东西可解锁**：同一批快照上网络的概率向量/argmax 动不动 ⇒
 *      ① 是表征层的恒等式，② 才是"现役包的权重里有没有 ep 条件性"的实测（§12 已给出一半答案：全条阶梯都是平的）。
 * 用法：node tools/probe-ep-unfrozen.mjs [NSNAP=12]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const FILES = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js'];
/* 改点凭据：`js/train/policy.js` 里这 6 处（2026-09-19 实测存在的原文，逐字匹配 ⇒ 找不到就抛错，不许静默漏改） */
const SITES = [
  ['Math.min(me.ep, 12) / 12', e => 'Math.min(me.ep, ' + e + ') / ' + e],
  ['Math.min(agg.maxEp, 12) / 12', e => 'Math.min(agg.maxEp, ' + e + ') / ' + e],
  ['Math.max(-1, Math.min(1, (me.ep - agg.maxEp) / 12))', e => 'Math.max(-1, Math.min(1, (me.ep - agg.maxEp) / ' + e + '))'],
  ['Math.min(op.ep, 12) / 12', e => 'Math.min(op.ep, ' + e + ') / ' + e],
  ['Math.max(-1, Math.min(1, (p.ep - c) / 12))', e => 'Math.max(-1, Math.min(1, (p.ep - c) / ' + e + '))'],
  ['Math.min(t.ep, 12) / 12', e => 'Math.min(t.ep, ' + e + ') / ' + e],
];
const LOG_SITES = [
  ['Math.min(me.ep, 12) / 12', '(Math.log1p(Math.max(0, me.ep)) / Math.log1p(40))'],
  ['Math.min(agg.maxEp, 12) / 12', '(Math.log1p(Math.max(0, agg.maxEp)) / Math.log1p(40))'],
  ['Math.max(-1, Math.min(1, (me.ep - agg.maxEp) / 12))', 'Math.max(-1, Math.min(1, (Math.log1p(Math.max(0, me.ep)) - Math.log1p(Math.max(0, agg.maxEp))) / Math.log1p(40)))'],
  ['Math.min(op.ep, 12) / 12', '(Math.log1p(Math.max(0, op.ep)) / Math.log1p(40))'],
  ['Math.max(-1, Math.min(1, (p.ep - c) / 12))', 'Math.max(-1, Math.min(1, (Math.log1p(Math.max(0, p.ep)) - Math.log1p(Math.max(0, c))) / Math.log1p(40)))'],
  ['Math.min(t.ep, 12) / 12', '(Math.log1p(Math.max(0, t.ep)) / Math.log1p(40))'],
];
function patchPolicy(src, variant) {
  if (variant === 'original') return src;
  let n = 0;
  for (const [oldStr, rep] of (variant === 'linear40' ? SITES.map(x => [x[0], x[1](40)]) : LOG_SITES)) {
    if (src.indexOf(oldStr) < 0) throw new Error('改点在 policy.js 里不存在 ⇒ 该文件已改版，本探针的行号需重新核对：' + oldStr);
    src = src.split(oldStr).join(rep); n++;
  }
  if (n !== 6) throw new Error('只替换了 ' + n + '/6 处 ⇒ 结果不可信');
  return src;
}
function build(variant) {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
  sb.window = sb; sb.globalThis = sb;
  for (const f of FILES) {
    let src = readFileSync(REPO + f, 'utf8');
    if (f.indexOf('policy.js') >= 0) src = patchPolicy(src, variant);
    vm.runInNewContext(src, sb, { filename: f + '#' + variant });
  }
  return sb;
}
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
const NSNAP = Number(process.argv[2] || 12);
const LAD = [12, 16, 20, 30, 40, 60];
const sig = v => Array.prototype.map.call(v, x => x.toFixed(6)).join('|');
console.log(`=== 抬 ep 编码上限的内存实验（磁盘上的 policy.js 未改；快照 = 各变体自己的 ${NSNAP} 个中局面 × ep ${LAD.join('/')}）===`);
for (const variant of ['original', 'linear40', 'log40']) {
  const sb = build(variant);
  const S = sb.window.EpirusState, Play = sb.window.EpirusPlay, T = sb.window.EpirusTrainer,
    P = sb.window.EpirusPolicy, R = sb.window.EpirusRules, A = R.SK;
  const FN = P.featuresV7 || P.features;
  const LIVE = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
  const inner = T.policyChooserN(LIVE, 0.15);
  const snaps = [];
  for (let g = 0; g < 400 && snaps.length < NSNAP; g++) {
    let pg = 0;
    const cs = []; for (let i = 0; i < 5; i++) cs.push(function (st, pid, lg) {
      if (pid === 0 && st.round >= 8 && st.p[0].hp >= 2 && pg < 1) { snaps.push(S.cloneState(st)); pg++; }
      return inner(st, pid, lg);
    });
    const st = S.createState('multi', { next: mb(4242 + g * 977) }, 5);
    st.slotSalt = h32(4242 + g * 2246822519);
    Play.autoGameN(st, cs);
  }
  let vecSets = 0, vecTot = 0, probSets = 0, probTot = 0, argSame = 0, argTot = 0;
  for (const s0 of snaps) {
    const seenV = new Set(), seenP = new Set(); let baseArg = null;
    for (const e of LAD) {
      const st = S.cloneState(s0); st.p[0].ep = e; if (st.p[0].ringStreak != null) st.p[0].ringStreak = 0;
      vecTot++; seenV.add(sig(FN(st, 0)));
      const lg = Play.legalActions(st, 0).filter(l => l.affordable);
      if (!lg.length) continue;
      const cands = P.candidatesFor(st, 0, T.econBase(st, 0, lg), {});
      const fw = P.forwardCands(st, 0, cands, LIVE, { temp: 0.15 });
      probTot++; seenP.add(Array.prototype.map.call(fw.probs, x => x.toFixed(6)).join('|'));
      let bk = null, bv = -1;
      for (let i = 0; i < cands.length; i++) if (fw.probs[i] > bv) { bv = fw.probs[i]; bk = cands[i].key; }
      if (e === 16) baseArg = bk; else if (baseArg !== null) { argTot++; if (bk === baseArg) argSame++; }
    }
    vecSets += seenV.size; probSets += seenP.size;
  }
  console.log(`  ${variant.padEnd(9)} 快照 ${snaps.length} · 输入 ${vecTot} 个 → **每快照平均只有 ${(vecSets / snaps.length).toFixed(2)}/${LAD.length} 个不同状态向量** · 不同概率向量 ${(probSets / snaps.length).toFixed(2)}/${LAD.length} · argmax 与 ep=16 一致的比例 ${(100 * argSame / Math.max(1, argTot)).toFixed(0)}%`);
}
console.log('\n  判读：`original` 那行应是 **1/6**（ep≥16 全部塌成同一个向量）⇒ 冻结属实；');
console.log('        两个变体若拿到 6/6 而 **argmax 与 ep=16 相同的比例仍然很高** ⇒ 解冻只是"给了输入"，');
console.log('        现役权重里没有被 ep 条件化过的东西 ⇒ 抬上限的收益只可能来自**重训**（§2 的换代代价、§12 的实测）。');
