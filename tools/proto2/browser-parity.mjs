#!/usr/bin/env node
/* browser-parity.mjs — **同一枚 2.0 包**在两条实现路上必须逐位相同（千问 · 10-30 晚，随 `js/train/policy2.js` 一起加）
 *
 * 为什么要有这条：浏览器侧那份（`js/train/policy2.js`）是从训练侧（`tools/proto2/{obs3,arch2}.mjs`）**移植**的。
 *   本仓的死法一直是"两份同构算术必漂移"（1584 死权重、跨文件宽度各写一遍、代 1 的段偏移…）。
 *   移植对不对不能靠我读一遍说"我照抄了"，只能靠**逐位对账**：同一批真局决策点 ⇒ logits/probs/argmax/Q(s) 全等。
 *
 * 判据（任何一条不过 ⇒ exit 8；每条都带"摘腿后变异"，防恒真）：
 *   P1 逐位相同：N 个真局决策点上，`policy2.forwardCands` 与 arch2 的 `P.forwardCands` 的 logits/probs/argmax/q **逐元素相等**。
 *   P2 有牙：把浏览器那份 params 动一个下标 ⇒ logits 必须变（不然 P1 可能是"两边都没算"）。
 *   P3 拒读：v7 包 / `dims.gen=1` / 段表被改 —— 三种都要**拒读并点名原因**，不许静默按新形状切。
 *   P4 v7 路径没被接走：装完 policy2 之后，v7 的 `P.checkPack/unpack/shapeOf/chooseCandidates` 对 v7 包仍给出与装档前一致的判定。
 *
 * 用法：node tools/proto2/browser-parity.mjs [--pack=scratch/arms/CEM48c-s7.bak] [--perShape=6]
 */
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install, packInstallCfg, readPack2, packCfgExit } from './arch2.mjs';
import { collectFixtures } from './head-health.mjs';

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, Play = W.EpirusPlay, S = W.EpirusState;
const P2 = W.EpirusPolicy2;
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/arms/CEM48c-s7.bak');
const PER = Math.max(1, Number(arg('perShape', 6)) || 6);

if (!P2 || typeof P2.forwardCands !== 'function') { console.error('⛔ 沙箱里没有 EpirusPolicy2 ⇒ `tools/audit-lib.mjs` 的 CORE 表没加 js/train/policy2.js'); process.exit(8); }

/* ---- P4 的"装档前"基线：先用**在册 v7 包**记一份判定，再装 2.0 ----
 * ⚑ v7 的 .bak/壳走 `loadChamp`（那是 v7 那条通路），**不要**用 `readPack2` 去啃它——
 *   本工具自己就见过一次：`readPack2` 对 v7 壳会返回 `v:7` 的对象或抛"不是 2.0 容器"，两种都不是我们要的判定。 */
const V7 = 'js/bundled-champion-3p.js';
const v7Params = loadChamp(W, V7, '');
if (!v7Params) { console.error('⛔ 读不出在册 v7 参照包（' + V7 + '）⇒ P4 这条没跑成，不许当通过'); process.exit(8); }
const before = { len: v7Params.length, legacy: P.shapeOf(v7Params).legacy };
/* 合成一枚 v7 形状的容器，只用来验"2.0 侧必须拒读" */
const v7Fake = { v: 7, a: new Array(P.paramCount()).fill(0), f: 213, fa: 22, h: 24 };

/* ---- 装 2.0（训练侧那条路）---- */
const raw = readPack2(PACK);
const got = packCfgExit(raw, PACK);
const cfg = got.cfg;
const A2 = install(W, cfg);
if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
const toolsP = P.unpack(raw, true);
if (!toolsP) { console.error('⛔ 训练侧读不出 ' + PACK); process.exit(8); }
const br = P2.unpack(raw, W);
if (!br) { console.error('⛔ 浏览器侧读不出同一枚包 ⇒ checkPack=' + JSON.stringify(P2.checkPack(raw, W)) + '（而训练侧 checkPack=' + JSON.stringify(P.checkPack(raw)) + '）'); process.exit(8); }

/* ---- 真局决策点 ---- */
const fx = collectFixtures(W, { perShape: PER, seed: 20261030 }).fixtures;
if (!fx.length) { console.error('⛔ 造不出真局决策点 ⇒ 这条对账没跑成，不许当通过'); process.exit(8); }

const TEMPS = [0.15, 0.5];
let cmpCells = 0, bad = [];
for (const t of TEMPS) {
  for (const f of fx) {
    const a = P.forwardCands(f.st, f.pid, f.cands, toolsP, { temp: t });
    const b = P2.forwardCands(W, f.st, f.pid, f.cands, br, { temp: t });
    cmpCells++;
    if (a.logits.length !== b.logits.length) { bad.push('候选数不同 ' + a.logits.length + ' vs ' + b.logits.length); continue; }
    for (let i = 0; i < a.logits.length; i++) {
      if (a.logits[i] !== b.logits[i]) { bad.push('logits[' + i + '] t=' + t + ' ‖ 训练侧 ' + a.logits[i] + ' vs 浏览器 ' + b.logits[i] + '（局 ' + f.shape + ' ‖ 候选 ' + f.cands[i].key + '）'); break; }
      if (a.probs[i] !== b.probs[i]) { bad.push('probs[' + i + '] t=' + t + ' 不同'); break; }
    }
    if (a.argmax !== b.argmax) bad.push('argmax 不同 t=' + t + '（' + a.argmax + ' vs ' + b.argmax + '）');
    if (a.q !== b.q) bad.push('Q(s) 不同 t=' + t + '（' + a.q + ' vs ' + b.q + '）');
    if (bad.length) break;
  }
  if (bad.length) break;
}
console.log('P1 逐位对账：' + cmpCells + ' 个决策点 × 2 个温度 ‖ logits/probs/argmax/Q(s) ' + (bad.length ? '有差 ⇒ 移植漂了' : '**逐位相同**'));
if (bad.length) { for (const x of bad.slice(0, 6)) console.log('   ✖ ' + x); process.exit(8); }

/* ---- P2 有牙：**逐段把整块权重区换成独立随机值** ⇒ 功能段必须动 logits，qHead 必须不动 ----
 * ⚑ 为什么不是"抽一个下标 +1"：单点扰动会被 ReLU 直接夹掉（pre-activation 还是负 ⇒ 那一维恒 0 ⇒ 输出逐位不变），
 *   于是"没变"既可能是"这段没接上"也可能是"这一维被夹了"—— 训练侧那条腿（selftest2 T18）当初就是靠**整段换**才判得动。
 *   这里与它同形，两边才谈得上"同一把尺"。 */
const F0 = fx[0];
const base0 = P2.forwardCands(W, F0.st, F0.pid, F0.cands, br, { temp: 0.15 });
const baseKey = Array.from(base0.logits).join(',');
let rs = 987654321;
const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return (rs / 4294967296 - 0.5) * 2; };
function swapSeg(name, scale) {
  const q = Float64Array.from(br); q.p2 = br.p2;
  const s = br.p2.seg.find((x) => x.name === name);
  for (let i = s.off; i < s.off + s.len; i++) q[i] = rnd() * (scale || 0.3);   // 整段（权重+bias）一起换 ⇒ 不会被单点被 ReLU 夹掉那种假阴
  return q;
}
const probe = [];
for (const s of br.p2.seg) {
  if (s.name === 'qHead') continue;                  // qHead 不参与组内排序是**结构承诺** ⇒ 它另列一条对照
  const b = P2.forwardCands(W, F0.st, F0.pid, F0.cands, swapSeg(s.name), { temp: 0.15 });
  probe.push({ seg: s.name, moved: Array.from(b.logits).join(',') !== baseKey });
}
const qq = swapSeg('qHead', 30);
const bq = P2.forwardCands(W, F0.st, F0.pid, F0.cands, qq, { temp: 0.15 });
const qDead = Array.from(bq.logits).join(',') === baseKey && bq.q !== base0.q;
console.log('P2 牙：逐段换权重区 ⇒ ' + probe.map((p) => p.seg + (p.moved ? '✔' : '✖')).join(' ‖ ') +
  ' ‖ qHead 对照（换整段 logits 不许变而 Q(s) 必须变）：' + (qDead ? '成立 ✔' : '**不成立**（logits ' + (Array.from(bq.logits).join(',') === baseKey ? '不变' : '变了！') + ' ‖ Q(s) ' + (bq.q !== base0.q ? '变了' : '没变') + '）'));
const deadSegs = probe.filter((p) => !p.moved);
if (deadSegs.length) { console.error('⛔ 这些段整块换掉都抽不动输出：' + deadSegs.map((d) => d.seg).join(', ') + ' ⇒ 浏览器侧那段没接上（或它的输入列在夹具里恒 0）'); process.exit(8); }
if (!qDead) { console.error('⛔ qHead 那条对照不过 ⇒ 两头分离没实现（logits 被 Q 头污染，或 Q 头根本没读）'); process.exit(8); }

/* ---- P3 拒读三例 ---- */
const v7chk = P2.checkPack(v7Fake, W);
const gen1 = JSON.parse(JSON.stringify(raw)); gen1.dims.gen = 1;                 // v 保持 91 ⇒ 只能被**代闸**拦（不能靠 version 蒙对）
const g1chk = P2.checkPack(gen1, W);
const v90 = JSON.parse(JSON.stringify(raw)); v90.v = 90;                          // 真·代 1 容器的 v ⇒ 版本闸
const v90chk = P2.checkPack(v90, W);
const segBad = JSON.parse(JSON.stringify(raw)); if (segBad.layout) segBad.layout.seg[2].off += 8;
const sBad = P2.checkPack(segBad, W);
const p3 = v7chk.ok === false && v7chk.reason === 'version' && g1chk.ok === false && g1chk.reason === 'gen' &&
  v90chk.ok === false && v90chk.reason === 'version' && sBad.ok === false && sBad.reason === 'seg';
console.log('P3 拒读：v7 容器 ⇒ ' + JSON.stringify(v7chk) + ' ‖ dims.gen=1(v 仍 91) ⇒ ' + JSON.stringify(g1chk) +
  ' ‖ v=90 ⇒ ' + JSON.stringify(v90chk) + ' ‖ 段表被改 ⇒ ' + JSON.stringify(sBad));
if (!p3) { console.error('⛔ P3 不过：有一种被接走了（尤其"段表对不上还照读"= 代 1 那一族病的浏览器版）'); process.exit(8); }

/* ---- P4 v7 路径没被接走 ---- */
const after = { len: v7Params.length, legacy: P.shapeOf(v7Params).legacy };
console.log('P4 v7 包在装 2.0 前/后的判定：' + JSON.stringify(before) + ' → ' + JSON.stringify(after) + (JSON.stringify(before) === JSON.stringify(after) ? ' ‖ 一致 ✔' : ' ‖ **变了**'));
if (JSON.stringify(before) !== JSON.stringify(after)) process.exit(8);
/* 真打一局：v7 参照包走游戏侧 chooser 时，2.0 的计数器一次都不许涨（selftest2 T14 的产品面对应物） */
const c0 = P.__arch2 ? P.__arch2.CNT.forwards : 0;
try {
  const sel = T.policyChooserN(v7Params, 0.001);
  const cs = []; for (let pid = 0; pid < 3; pid++) cs.push(sel);
  T.oneGameN(cs, 777, 3, { regen: 0, mode: 'multi' });
} catch (e) { console.error('⛔ v7 自对局抛错：' + String(e && e.message || e)); process.exit(8); }
const dF = (P.__arch2 ? P.__arch2.CNT.forwards : 0) - c0;
console.log('P4b 打一局 v7：2.0 forwardCands 涨 ' + dF + ' 次（必须 0）' + (dF === 0 ? ' ✔' : ' ⇒ **v7 被 2.0 接走了**'));
if (dF !== 0) process.exit(8);

/* ---- P5 游戏侧那台 chooser 打的必须是**这枚包**（两份独立沙箱，不许拿同一个进程自证）----
 * W1 = 纯 js/**（含 policy2 + `policy.js` 里的版本门控分派）；W2 = 沙箱 + `arch2.install`（训练侧那条覆盖式接入）。
 *   两边走**同一个 seed / 同一枚包 / 同一套 bots**，动作序列必须逐手相同。
 * ⚑ 为什么不能在本进程里比：`install` 已经把 `P.chooseCandidates` 覆盖成 arch2 的版本 ⇒
 *   拿它跟自己比是循环论证；只有另开一份没装 arch2 的沙箱，才量得到"浏览器分派"这条路。 */
function playSeq(Wx, params, seed, n) {
  const Tx = Wx.EpirusTrainer, Playx = Wx.EpirusPlay;
  const sel = Tx.policyChooserN(params, 0.15);
  const cs = []; for (let pid = 0; pid < n; pid++) cs.push(sel);
  const trace = [];
  const wrapped = cs.map((f) => (st, pid, legal) => { const a = f(st, pid, legal); trace.push(pid + ':' + a.key + '/' + (a.target == null ? '-' : a.target) + '/' + (a.bead || '-')); return a; });
  const st = Wx.EpirusState.createState('multi', { next: Wx.EpirusTrainer.mulberry32(seed) }, n);
  st.rng = { next: Wx.EpirusTrainer.mulberry32(seed) };
  try { Playx.autoGameN(st, wrapped); } catch (e) { return { err: String(e && e.message || e), trace }; }
  return { over: !!st.over, rounds: st.round, trace };
}
const Wb = sandbox();                                   // 第二份：只跑 js/**，**没有** arch2 的覆盖
const bp2 = Wb.EpirusPolicy.unpack(raw, false);         // 游戏侧的严格 unpack（应走 v:91 分派）
if (!bp2) { console.error('⛔ P5：浏览器侧 `P.unpack(v:91 包)` 读不出来 ⇒ 分派没生效（checkPack=' + JSON.stringify(Wb.EpirusPolicy.checkPack(raw)) + '）'); process.exit(8); }
if (!bp2.p2) { console.error('⛔ P5：读出来了但没有 2.0 布局标记 ⇒ 走的还是 v7 那张网'); process.exit(8); }
if (Wb.EpirusPolicy.shapeOf(bp2).legacy !== false) { console.error('⛔ P5：shapeOf 把这枚 2.0 张量判成 legacy ⇒ evo 会把它塞进 v7 打分器（坏了不红那一族）'); process.exit(8); }
const seqTools = playSeq(W, toolsP, 4242, 5);
const seqBrowse = playSeq(Wb, bp2, 4242, 5);
const sameSeq = !seqTools.err && !seqBrowse.err && seqTools.trace.length === seqBrowse.trace.length &&
  seqTools.trace.every((v, i) => v === seqBrowse.trace[i]);
console.log('P5 打一局（5 人 · seed 4242 · temp 0.15）：训练侧 ' + seqTools.trace.length + ' 手 ‖ 浏览器侧 ' + seqBrowse.trace.length +
  ' 手 ‖ 逐手' + (sameSeq ? '**相同** ✔（回合 ' + seqBrowse.rounds + ' ‖ over=' + seqBrowse.over + '）' : '**不同 ⇒ 用户玩到的不是这枚包**') +
  (seqTools.err ? ' ‖ 训练侧抛：' + seqTools.err : '') + (seqBrowse.err ? ' ‖ 浏览器侧抛：' + seqBrowse.err : ''));
if (!sameSeq) {
  for (let i = 0; i < Math.max(seqTools.trace.length, seqBrowse.trace.length); i++) {
    if (seqTools.trace[i] !== seqBrowse.trace[i]) { console.error('   第一处分叉在第 ' + i + ' 手：训练侧 ' + seqTools.trace[i] + ' vs 浏览器 ' + seqBrowse.trace[i]); break; }
  }
  process.exit(8);
}

/* ---- P6 产品侧的"别静默错切"守卫：`value`/`forward` 吃 2.0 张量必须当场抛，吃 v7 必须照旧 ----
 * 训练侧这句话由 `arch2.mjs:724` 说；**产品侧没有 arch2**，所以必须由 `policy.js` 自己说。
 * ⚑ 会走到这两条路的真实调用者：`evo.js` 信念搜索的 beam 截断（候选数 > `BELIEF_BEAM`）与 `BELIEF_TIE=1` 的平票裁决。
 *   今晚那次 myopia 跑（`--games=25`）没抛，是因为 TIE=0 且候选均值 11.5~36.4 没越过 beam ⇒ "没抛"不等于"没这条缝"。 */
{
  const st = Wb.EpirusState.createState('multi', { next: Wb.EpirusTrainer.mulberry32(31337) }, 5);
  st.rng = { next: Wb.EpirusTrainer.mulberry32(31337) };
  const legal = Wb.EpirusPlay.legalActions(st, 0);
  const k0 = (legal.find((l) => l.affordable) || legal[0]).key;
  const v7Params = loadChamp(Wb, 'js/bundled-champion-3p.js', '');
  if (!v7Params) { console.error('⛔ P6：读不出 v7 参照包 ⇒ 这一条没跑成'); process.exit(8); }
  const cand = { key: k0, target: null, target2: null, bead: null };
  let threwV = '', threwF = '';
  try { Wb.EpirusPolicy.value(st, 0, k0, bp2, null, cand); threwV = '没抛！读出 ' + Wb.EpirusPolicy.value(st, 0, k0, bp2, null, cand); }
  catch (e) { threwV = '抛了：' + String(e.message).slice(0, 22) + '…'; }
  try { Wb.EpirusPolicy.forward(st, 0, legal, bp2, {}); threwF = '没抛'; } catch (e) { threwF = '抛了 ✔'; }
  let v7ok = false, v7err = '';
  try { const vv = Wb.EpirusPolicy.value(st, 0, k0, v7Params, null, cand); v7ok = Number.isFinite(vv); } catch (e) { v7err = String(e && e.message || e).slice(0, 40); }
  console.log('P6 产品侧守卫：`value(2.0)` ⇒ ' + threwV + ' ‖ `forward(2.0)` ⇒ ' + threwF +
    ' ‖ `value(v7)` 仍给有限分=' + v7ok + (v7err ? '（抛了：' + v7err + '）' : ''));
  if (/^没抛/.test(threwV) || threwF !== '抛了 ✔' || !v7ok) { console.error('⛔ P6 不过：2.0 张量能被 v7 打分器静默切开，或 v7 那台被打坏'); process.exit(8); }
}

console.log('\n⇒ 浏览器侧与训练侧对同一枚 2.0 包**逐位同分**，且四种拒读都有牙。包=' + PACK + ' ‖ 观测面 dof=' + (raw.dims && raw.dims.dof) + ' ‖ 参数 ' + raw.a.length + ' 条');
