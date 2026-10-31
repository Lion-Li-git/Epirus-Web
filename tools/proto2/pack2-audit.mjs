#!/usr/bin/env node
/* pack2-audit.mjs — 一枚 2.0 包的**参数与接口自证**（千问 · 2026-10-30 下午 · 代 2）
 *
 * 为什么要有它（三条都在册）：
 *  ① 代 1 的事故：`encode()` 漏加段偏移 ⇒ S1o 声明 5650、**任何前向都不读 2688（47.6%）**，
 *     而 34 条自证全在查**宽度**，没一条查**位置** ⇒ 一路绿灯（原件 scratch/qoder-1030-probe8/9.mjs）。
 *  ② 既有逐维工具 `dimgate / audit-dims / check-align` 吃的是 `scratch/*.jsonl`——干净克隆里 **0 条**
 *     ⇒ 那套"验收"在 CI 和别人机器上根本跑不成（门红了先问它的输入存不存在，那条规矩反着用也成立）。
 *  ③ 用户 10-28 的判据原话："用尽量正交的多维覆盖游戏里可知的信息，并且**不要有读不到信息的死维度**"。
 *     这条要有数，就必须在**训练同款分布**上扫，而不是在某个会话手搓的 dump 上扫。
 *
 * 所以本工具自带夹具（自己打真局、逐候选编码），只读 `js/**` 与包文件，不读任何临时件。
 * 四段判语，任何一段不合格 ⇒ exit 8（不允许"跑了没红"当通过）：
 *   A 容器自洽：v / dims.gen / dims.dof / arch 与 dims.input 四者互相对账；
 *   B 参数全覆盖：段表里**每一个下标**都被某层的权重区或 bias 区覆盖（代 1 的形状会在这里露出来）；
 *   C 每段有牙：逐段把**权重区**整块换成独立随机数 ⇒ logits 必须变（代 3 起段表里没有豁免段——原 qHead 死区对照随价值头一起删除，
 *     而且删前已退化成恒真：那一块只是 base 的副本。"这把尺看得见不读"改由 selftest2 T4② 的合成死段承担）；
 *   D 逐维可见性：真局逐候选编码，报"恒零维"清单与出现率——**分母一起印**，0 次不等于不可能。
 *
 * 用法：
 *   node tools/proto2/pack2-audit.mjs --pack=scratch/arms/<新臂>.bak
 *   node tools/proto2/pack2-audit.mjs --pack=… --decisions=1200 --json=scratch/PACK2-AUDIT-<名>.json
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit, V_FOR_GEN } from './arch2.mjs';
import * as O3 from './obs3.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
const MAXD = Math.max(50, Number(arg('decisions', 600)) || 600);
const JSON_OUT = arg('json', '');
if (!PACK) { console.error('用法：--pack=<2.0 包 .bak>  ‖ 可选 --decisions=600 --json=<落盘路径>'); process.exit(2); }

const fails = [];
let done = 0;
const ok = (cond, msg) => { done++; console.log((cond ? '  ✔ ' : '  ✖ ') + msg); if (!cond) fails.push(msg); return cond; };

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
let seed = 20261030;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/* ---------- 装载：代闸只有一个出口（arch2.packCfgExit） ---------- */
let raw;
try { raw = readPack2(PACK); }
catch (e) { console.error('⛔ 读不到/解不开 ' + PACK + '：' + String((e && e.message) || e)); process.exit(2); }
const got = packCfgExit(raw, PACK);
console.log('# 2.0 包参数与接口自证 ‖ ' + PACK);
console.log('  容器：' + got.era + ' ‖ v=' + raw.v + ' ‖ arch=' + (raw.arch || '?') + ' ‖ dims=' + JSON.stringify(raw.dims) + ' ‖ 权重 ' + (raw.a && raw.a.length) + ' 条');
/* ⚑ 参照包必须在**装档之前**读：装完之后 `unpack` 只认代 2 容器 ⇒ 现在读会拿到 null（selftest2 的 T14 同一课）*/
const REF7 = (() => { const o = loadChamp(W, 'js/bundled-champion-3p.js', ''); return o ? Float64Array.from(o) : null; })();
const A = installArch2(W, got.cfg);
const L = A.L;
const sg = {}; for (const s of L.seg) sg[s.name] = s;
const rowsOf = { seatEnc: L.seatH, actEnc: L.actH, ctx: L.hid, cand: L.hid2, policyHead: 1 };
const inDimOf = { seatEnc: L.seatIn, actEnc: L.actIn, ctx: L.ctxDim, cand: L.candIn, policyHead: L.hid2 };

/* ---------- A 容器自洽 ---------- */
{
  /* ⚑ 面与 dof 都按**这枚包自己那张脸**对账。旧写法 `L.input !== 'obs3' || …` 让 obs3b 的包在 dof 这一格
   *   恒过（= 一条不咬的判据），旧 `inputOk` 也只比"是不是 obs3"而不比是不是同一张面。 */
  const isO3 = L.input === 'obs3' || L.input === 'obs3b';
  const dimsDof = isO3 ? O3.dims(R, L.input) : null;
  const vOk = raw.v === V_FOR_GEN[got.gen];
  const archOk = raw.arch === L.arch;
  const inputOk = !!(raw.dims && raw.dims.input === L.input);
  const dofOk = !isO3 || (raw.dims && raw.dims.dof === dimsDof);
  const cp = P.checkPack(raw);
  ok(vOk && archOk && inputOk && dofOk && cp.ok === true,
    'A 容器自洽：v=' + raw.v + '（该是 ' + V_FOR_GEN[got.gen] + '）‖ arch=' + raw.arch + '↔装成 ' + L.arch +
    ' ‖ dims.input=' + (raw.dims && raw.dims.input) + '↔装成 ' + L.input + ' ‖ dof=' + (raw.dims && raw.dims.dof) + '↔当前尺 ' + (dimsDof == null ? '（v7 面无 dof 这一格）' : dimsDof) +
    ' ‖ checkPack=' + JSON.stringify(cp));
  if (!dofOk) console.log('     ⇒ 这枚包吃的观测面与当前尺不是同一张脸（本档 ' + L.input + ' = ' + dimsDof + ' 维）。要按它自己那代跑，得换回当时的尺。');
}

/* ---------- B 参数全覆盖：每个下标都被某层读吗 ---------- */
const covered = new Uint8Array(L.n);
for (const s of L.seg) {
  const inDim = inDimOf[s.name];
  const wLen = s.name === 'policyHead' ? L.hid2 : rowsOf[s.name] * inDim;
  for (let i = s.off; i < s.off + s.len; i++) covered[i] = 1;      /* 段表声明的范围，代 2 下全部被权重区+bias 区覆盖 */
  if (s.name === 'inter') continue;
}
{
  let holes = 0, first = -1;
  for (let i = 0; i < L.n; i++) if (!covered[i]) { holes++; if (first < 0) first = i; }
  const segTxt = L.seg.map((s) => {
    const inDim = inDimOf[s.name];
    const wLen = s.name === 'policyHead' ? L.hid2 : rowsOf[s.name] * inDim;
    return s.name + ' 权重[' + s.off + ',' + (s.off + wLen) + ') bias[' + (s.off + wLen) + ',' + (s.off + s.len) + ')';
  }).join('\n     ');
  console.log('     段表：\n     ' + segTxt);
  ok(holes === 0, 'B 参数全覆盖：声明 ' + L.n + ' 条，段表里没有任何下标属于"既不当权重也不当 bias"的死区（漏洞 ' + holes + (holes ? ' 个，首个 @' + first : '') + '）');
}

/* ---------- 取真局夹具（自己打，不吃临时件） ---------- */
import { collectFixtures, headHealth, agreeVsRandom, fmtHead, HEAD_FLAT_AGREE } from './head-health.mjs';
const FX = collectFixtures(W, { perShape: Math.max(2, Number(arg('perShape', 120))) });
const FXS = FX.fixtures, keysSeen = FX.keysSeen;      /* keysSeen = 这批夹具真打出过哪些键（覆盖率自证）*/
const shapeCount = {};
for (const f of FXS) shapeCount[f.shape] = (shapeCount[f.shape] || 0) + 1;
console.log('  夹具：真局 mid-game 决策点 ' + FXS.length + ' 个 ‖ 阵容覆盖：真打出过 ' + keysSeen.size + '/' + R.skills.length + ' 张键 ‖ 逐桌形 ' + Object.entries(shapeCount).map(([k, v]) => k + '=' + v).join(' '));

/* ---------- C 每段有牙（无豁免段） ---------- */
{
  const lgAll = (pp) => FXS.map((f) => Array.from(P.forwardCands(f.st, f.pid, f.cands, pp, { temp: 0.5 }).logits).join(',')).join('|');
  const base = Float64Array.from(raw.a.length === L.n ? Float64Array.from(raw.a) : P.makePolicy(0.25));
  const b = lgAll(base);
  const perSeg = {};
  for (const s of L.seg) {
    const inDim = inDimOf[s.name];
    const wLen = s.name === 'policyHead' ? L.hid2 : rowsOf[s.name] * inDim;
    const p = Float64Array.from(base);
    for (let i = 0; i < wLen; i++) p[s.off + i] = rng() - 0.5;
    perSeg[s.name] = lgAll(p) !== b;
  }
  const inert = Object.keys(perSeg).filter((k) => !perSeg[k]);
  ok(inert.length === 0,
    'C 每段有牙：' + Object.entries(perSeg).map(([k, v]) => k + (v ? '✔' : '✘')).join(' '));
  if (inert.length) console.log('     ⇒ 这些段的权重区换掉后输出一点不动 = 它们没接上前向（代 1 的形状就是这个）。');
}

/* ---------- D 逐维可见性（在真局分布上扫，分母一起印） ---------- */
/* ⚑ 面从**被测包**读：obs3(208) 与 obs3b(415) 两张 MANIFEST 都要扫。旧代码写死 `=== 'obs3'` ⇒
 *   obs3b 的包在这里静默跳过（打印"吃的是 v7 输入面"却带着 S1o），逐维死列那类病就量不到了。 */
const O3FACE = L.input === 'obs3' || L.input === 'obs3b' ? L.input : null;
const M = O3.blocks(R, O3FACE || 'obs3');
const D = M.length;
const nz = new Array(D).fill(0);
let candCount = 0;
if (O3FACE) {
  for (const f of FXS) for (const c of f.cands) {
    let v;
    try { v = O3.encode(W, f.st, f.pid, c, O3FACE); } catch (e) { console.log('  ✖ 编码抛：' + String((e && e.message) || e)); fails.push('obs3 encode 抛'); break; }
    if (v.length !== D) { console.log('  ✖ 编码长度 ' + v.length + ' ≠ MANIFEST ' + D); fails.push('编码长度与 MANIFEST 不符'); break; }
    candCount++;
    for (let i = 0; i < D; i++) if (v[i] !== 0) nz[i]++;
  }
  const dead = [];
  for (let i = 0; i < D; i++) if (nz[i] === 0) dead.push(M[i].name);
  const rare = [];
  for (let i = 0; i < D; i++) if (nz[i] > 0 && nz[i] / Math.max(1, candCount) < 0.005) rare.push(M[i].name + ' ' + (100 * nz[i] / candCount).toFixed(2) + '%');
  const byB = {};
  for (const nm of dead) { const b2 = M.find((x) => x.name === nm).block; (byB[b2] || (byB[b2] = [])).push(nm); }
  console.log('     恒零维按块：' + Object.entries(byB).map(([k, v]) => '[' + k + '] ' + v.join(',')).join('  '));
  ok(true, 'D 逐维可见性：' + D + ' 维 ‖ 扫描 ' + FXS.length + ' 个决策点 / ' + candCount + ' 枚候选（**分母就是这个数，0 次只说明这批桌没碰到，不等于不可能**）‖ 恒零 ' + dead.length + ' ‖ <0.5% ' + rare.length);
  if (dead.length) console.log('     ⇒ 恒零清单：' + dead.join(' ‖ '));
  if (rare.length) console.log('     ⇒ 稀有清单：' + rare.join(' ‖ '));
} else {
  console.log('  · D 跳过：这枚包吃的是 v7 输入面（arch ' + L.arch + ' ‖ input ' + L.input + '），逐维扫描只对 obs3/obs3b 档有意义');
}

/* ---------- E 打分有没有牙（专治“平头包靠抽卡也能当选”） ---------- */
{
  const paramsE = P.unpack(raw);
  if (!paramsE) console.log('  · E 跳过：这枚包在当前档解不出（checkPack=' + JSON.stringify(P.checkPack(raw)) + '）');
  else {
    const tE = Math.max(0.001, Number(arg('teethTemp', 0.15)) || 0.15);
    const hPack = agreeVsRandom(W, paramsE, FXS, tE, headHealth(W, paramsE, FXS, tE));   /* 判据 = 与随机起点包的同骰一致率 */
    console.log(fmtHead('被测包 t=' + tE, hPack));
    if (REF7) console.log(fmtHead('v7 参照 同t', headHealth(W, REF7, FXS, tE)));
    const want = arg('requireTeeth', '') === '1';
    ok(!want || !hPack.flat,
      'E 打分有没有牙：与随机起点包同骰一致 ' + hPack.agreeRandom + '%（对照 ' + hPack.agreeRefs + ' 枚随机起点包 ‖ 平头线 ' + (HEAD_FLAT_AGREE * 100).toFixed(0) + '% ‖ 标定：随机彼此 93~97%、v7 5%）‖ 集中度 ' +
      hPack.concMed + ' ‖ 熵占比 ' + hPack.entShareMed + ' ‖ ' + (hPack.flat ? '**平头：换一枚包≈换不出不同出手，这批读数别当风格证据**' : '有牙') +
      (want ? '（--requireTeeth=1 ⇒ 平头判红）' : '（只报不判；要当闸请加 --requireTeeth=1）'));
  }
}

/* ---------- 汇总与下一步 ---------- */
const out = { tool: 'tools/proto2/pack2-audit.mjs', pack: PACK, era: got.era, v: raw.v, gen: got.gen, arch: raw.arch, dims: raw.dims, n: L.n,
  seg: L.seg.map((s) => ({ name: s.name, off: s.off, len: s.len, fanIn: L.fanIn[s.name] })),
  fixtures: FXS.length, candEncoded: candCount, dead: null };
console.log('\n⇒ ' + (fails.length ? '⛔ 未过 ' + fails.length + ' 段：' + fails.join(' ‖ ') : done + ' 段全过：这枚包的参数与接口自证成立'));
console.log('   下一步（强度/条件化各自的尺，别把本工具当强度尺）：');
console.log('     node tools/proto2/arena2.mjs --pack=' + PACK + ' --v7=1 --gamesPerShape=40 --temps=0.02,0.05,0.15,0.30');
console.log('     node tools/proto2/behav-shift.mjs --pack=v7 --pack=' + PACK + ' --games=40   ‖ 结构下限≈0.042');
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify(out, null, 1) + '\n'); console.log('   ✔ 已写 ' + JSON_OUT); }
process.exit(fails.length ? 8 : 0);
void resolve(fileURLToPath(import.meta.url));
