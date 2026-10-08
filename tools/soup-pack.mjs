#!/usr/bin/env node
/* ============================================================================
 * soup-pack.mjs —— 把**同维度**的冠军包按权重逐位取加权平均（§E477，用户 10-08 下午提的"直接融合取平均"）
 *
 * 为什么这件事值得单独试，而不是"再换一根训练旋钮"：
 *   本班刚量到训练臂的**臂间噪声地板**（METHODOLOGY 104）：同一配方只换训练 seed，
 *   考卷就差 4.44pt、人席均值差 12.8pt ⇒ 任何 <5pt 的臂间效应都被"这一臂选出的是哪一粒当选者"吃掉。
 *   而**融合是现有包上的确定性函数**：没有新的训练流、没有换当选者 ⇒
 *   评价分辨率就是配对考卷的 ±1.1pt（`eval-5p --dump-per`），正好是我们关心的 1~3pt 那一档。
 *
 * 三条前置事实（都在代码里查过，不是假设）：
 *   ① 网络形状 `v7`：`a.length = HID·N + HID + HID + 1 = 24·235 + 24 + 24 + 1 = 5689`
 *      （`js/train/policy.js` 的 `value()` 偏移：W1=0, B1=HID·N, W2=B1+HID, B2=W2+HID）；
 *   ② 仓里的 GA 只会**逐基因二选一**（`policy.js:480` 的 `crossover`），**从不产生中间值**
 *      ⇒ 算术平均不是"已有机制的别名"，它是一条 GA 结构上做不到的新路；
 *   ③ 神经元身份在热启动谱系里不会被置换（没有 permutation 操作）⇒ 逐位对齐有意义，
 *      但**跨血统能不能平均**是经验问题 ⇒ 本工具只负责造，判读交给两把尺。
 *
 * 规矩（本仓交过学费的几条，逐条实现）：
 *   · **不写 `js/**`**：产物一律显式 `--out=`，缺省落在 `docs/artifacts/soup-out/`；
 *   · 形状/维度/规则指纹不一致 ⇒ **拒绝**（`--force-fp` 才放行，且把放行事实写进产物 meta）；
 *   · 不认识的 `--flag` 一律 `exit 64`（仓规 v1.5.234）；
 *   · 产物 meta 必须记**每一粒来源的路径 + wid + ts + 权重**，否则第二天没人知道这粒是怎么来的。
 *
 * 用法：
 *   node tools/soup-pack.mjs --packs=a.js,b.js[,c.js] [--w=0.5,0.5[,0]] --out=docs/artifacts/soup-out/soup-ab.js
 *   node tools/soup-pack.mjs --self-test
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, extractJsonObject, parseMetaTolerant } from '../tools/audit-lib.mjs';   /* 读包只走这一份（`loadChamp` 同源的解析器） */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const KNOWN = ['packs', 'w', 'out', 'force-fp', 'copy-cols', 'self-test'];
const bad = process.argv.slice(2).filter(a => a.startsWith('--') && !KNOWN.some(k => a.startsWith('--' + k + '=') || a === '--' + k));
if (bad.length) { console.error('[soup] ⛔ 不认识的参数：' + bad.join(' ') + '（认的只有 ' + KNOWN.join('/') + '）'); process.exit(64); }

/* ============================ 纯函数：融合本体 ============================ */
/** 逐位加权平均。ws 会被归一化；长度不符就抛错（不静默截断）。 */
export function mix(arrays, ws) {
  const n = arrays.length;
  if (!n) throw new Error('mix: 没有输入');
  const L = arrays[0].length;
  for (const a of arrays) if (a.length !== L) throw new Error('mix: 长度不一致 ' + a.length + ' vs ' + L);
  let w = (ws && ws.length === n) ? ws.slice() : new Array(n).fill(1);
  w = w.map(Number);
  if (w.some(x => !isFinite(x) || x < 0)) throw new Error('mix: 权重里有非有限/负数：' + w.join(','));
  const s = w.reduce((a, b) => a + b, 0);
  if (!(s > 0)) throw new Error('mix: 权重和为 0');
  w = w.map(x => x / s);
  const out = new Float64Array(L);
  for (let i = 0; i < L; i++) { let v = 0; for (let k = 0; k < n; k++) v += w[k] * arrays[k][i]; out[i] = v; }
  return { params: out, w };
}

/* ===== §E498 外科复制：**只换动作段里指定的那几列**，其余保持 base 原样（不做平均） =====
 * 为什么要有这一条（用户问"融合为什么让盾变多"，查出来的机理）：
 *   v7 的动作**不是"每张卡一个头"** —— `policy.js:actionFeatures` 把动作编码成 22 个**语义列**
 *   （0 可负担余量 · 1 可施展 · **2 相对费用** · **3 攻击向** · **4 防御向** · 5 雷系 · **6 期望伤害** ·
 *    7 穿防 · 8 穿反 · 9 穿转移 · 10 类别 · 11 目标=敌 · 12 目标=己 · 13 持续 · 14/15 珠型 · 16..21 目标特征）。
 *   ⇒ 平均两个父母时，这些列是**整族一起动**的：`防御向=1` 那一列一改，所有防御卡一起被抬/被压，
 *     而防御卡 0~1 ジ、几乎永远合法 ⇒ 平手期它先赢 ⇒ 这就是"融合出防御吸引子"的通道（§E497 实测八粒防御全部上升）。
 *   所以能"外科"的对象是**列**，不是卡。复制列 = 把 donor 对这一族语义的取舍整块搬进 base，不产生新的中间值。
 * 布局（`policy.js:value`）：W1 从 0 起、行主序 `HID × FEAT_N`，第 j 个隐单元的第 i 个动作列在 `j*FEAT_N + FEAT_S + i`。 */
export function copyCols(base, donor, cols, sh) {
  const HID = sh.HID, FS = sh.FEAT_S, FN = sh.FEAT_N, FA = sh.FEAT_A;
  const need = HID * FN + HID + HID + 1;
  if (base.length !== need || donor.length !== need) throw new Error('copyCols: 长度不是这份形状（' + base.length + '/' + donor.length + ' 需 ' + need + '）');
  const cs = Array.from(new Set(cols.map(Number)));
  if (!cs.length) throw new Error('copyCols: 没给列号');
  if (cs.some(c => !Number.isInteger(c) || c < 0 || c >= FA)) throw new Error('copyCols: 列号必须是 0..' + (FA - 1) + ' 的整数，收到 ' + cs.join(','));
  const out = new Float64Array(base);
  let changed = 0;
  for (let j = 0; j < HID; j++) for (const c of cs) {
    const at = j * FN + FS + c;
    if (out[at] !== donor[at]) changed++;
    out[at] = donor[at];
  }
  return { params: out, cols: cs, changed };
}

/* ============================ self-test（合成数据，秒级） ============================ */
if (process.argv.indexOf('--self-test') >= 0) {
  let fails = 0;
  /* 比对带 1e-9 容差：融合是浮点求和，**结合顺序**就能差 1 ulp（写死 `14/3` 当期望值会红在最后一位上）。 */
  const eq = (name, got, want) => {
    const g = Array.from(got), wk = Array.from(want);
    const ok = g.length === wk.length && g.every((x, i) => Math.abs(x - wk[i]) < 1e-9);
    if (!ok) fails++;
    console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  got=' + JSON.stringify(g) + ' want=' + JSON.stringify(wk)));
  };
  const A = [0, 1, 2, 3], B = [10, 10, 10, 10], C = [1, 1, 1, 1];
  eq('等权平均', mix([A, B]).params.slice(), [5, 5.5, 6, 6.5]);
  eq('加权 1:3', mix([A, B], [1, 3]).params.slice(), [7.5, 7.75, 8, 8.25]);
  eq('权重自动归一（2:6 与 1:3 同）', mix([A, B], [2, 6]).params.slice(), [7.5, 7.75, 8, 8.25]);
  eq('三粒等权', mix([A, B, C]).params.slice(), [(0 + 10 + 1) / 3, (1 + 10 + 1) / 3, (2 + 10 + 1) / 3, (3 + 10 + 1) / 3]);
  eq('零权重那一粒不参与（0,1,1）', mix([A, B, C], [0, 1, 1]).params.slice(), [5.5, 5.5, 5.5, 5.5]);
  let threw = 0;
  try { mix([A, [1, 2]]); } catch (e) { threw++; }
  try { mix([A, B], [1, -1]); } catch (e) { threw++; }
  try { mix([A, B], [0, 0]); } catch (e) { threw++; }
  const eqN = (name, got, want) => { const ok = got === want; if (!ok) fails++; console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  got=' + got + ' want=' + want)); };
  eqN('长度不符/负权/零权 都抛错（3 条）', threw, 3);
  /* ===== §E498 copyCols 的手算期望（合成一份小形状：HID=2 · FEAT_S=3 · FEAT_A=2 ⇒ FEAT_N=5 · len=15） =====
   *   布局 `j*FEAT_N + FEAT_S + c` ⇒ 列 0 落在 3 与 8；列 1 落在 4 与 9。其余（状态段 0..2、偏置、W2、B2）必须**一个都不动**。 */
  const SH = { HID: 2, FEAT_S: 3, FEAT_A: 2, FEAT_N: 5 };
  const Z = new Array(15).fill(0), S7 = new Array(15).fill(7);
  const c0 = copyCols(Z, S7, [0], SH);
  eq('copyCols 只动指定列（列 0 ⇒ 位置 3 与 8）', c0.params.slice(), [0, 0, 0, 7, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0]);
  eqN('copyCols 报"改了几格"（2 个隐单元 × 1 列 = 2）', c0.changed, 2);
  const c2 = copyCols(Z, S7, [0, 1], SH);
  eqN('两列 ⇒ 4 格', c2.changed, 4);
  eq('列 1 落在位置 4 与 9', [c2.params[4], c2.params[9]], [7, 7]);
  let ct = 0;
  try { copyCols(Z, S7, [2], SH); } catch (e) { ct++; }                 // FEAT_A=2 ⇒ 列号上限是 1
  try { copyCols(Z, S7, [-1], SH); } catch (e) { ct++; }
  try { copyCols(Z, S7, [], SH); } catch (e) { ct++; }
  try { copyCols(Z, S7.slice(0, 9), [0], SH); } catch (e) { ct++; }     // 长度不是这份形状
  eqN('越界/负数/空列/长度不符 都抛错（4 条）', ct, 4);
  /* 幂等：同一批列复制两次，结果必须与一次相同（这条挡的是"复制时顺手做了平均"）*/
  const c1b = copyCols(c0.params, S7, [0], SH);
  eq('重复复制同一批列必须幂等', c1b.params.slice(), c0.params.slice());
  console.log(fails ? '⛔ self-test ' + fails + ' 条红' : '✔ self-test 全绿');
  process.exit(fails ? 1 : 0);
}

/* ============================ 装载 ============================ */
const PACKS = String(arg('packs', '')).split(',').map(s => s.trim()).filter(Boolean);
if (PACKS.length < 2) { console.error('[soup] ⛔ --packs 至少要两粒（逗号分隔路径）'); process.exit(64); }
const OUT = arg('out', 'docs/artifacts/soup-out/soup-out.js');
const WS = arg('w', '') ? String(arg('w')).split(',').map(Number) : null;
if (WS && (WS.length !== PACKS.length || WS.some(x => !isFinite(x) || x < 0))) {
  console.error('[soup] ⛔ --w 个数要和 --packs 一致且非负：packs=' + PACKS.length + ' w=' + JSON.stringify(WS)); process.exit(64);
}

const W = sandbox();
const P = W.EpirusPolicy, R = W.EpirusRules;
const { widOf } = await import('../champion-map/pack-id.mjs');

const src = [];
for (const f of PACKS) {
  const abs = f.startsWith('/') || /^[a-zA-Z]:/.test(f) ? f : join(ROOT, f);
  if (!existsSync(abs)) { console.error('[soup] ⛔ 找不到包：' + f); process.exit(2); }
  const txt = readFileSync(abs, 'utf8');
  const is3p = /window\.EPIRUS_CHAMPION_3P\b/.test(txt);
  const raw = extractJsonObject(txt, is3p ? 'window.EPIRUS_CHAMPION_3P' : 'window.EPIRUS_CHAMPION', '_META');
  let obj = null;
  /* `extractJsonObject` 返回的是**字符串**（它只负责配平括号），解析这一步归调用方 —— 上一版当成对象用，
   * 于是所有包都报"认不出外壳"（本仓"读侧口径"同族病，红测一次就现形）。 */
  if (raw) { try { obj = JSON.parse(raw); } catch (e) { obj = null; } }
  if (!obj || !Array.isArray(obj.a)) { console.error('[soup] ⛔ 认不出冠军外壳：' + f); process.exit(2); }
  if (!is3p) { console.error('[soup] ⛔ 这是 2P 包，与多人包不同桌：' + f); process.exit(2); }
  /* META 走 `parseMetaTolerant`：线上那颗 bundle 的 META 里有**裸键名**（`audit-lib` 头注记的那处手改缺陷），
   * 严格 `JSON.parse` 在**线上槽**上必崩 ⇒ 用容错版，但它会响亮报告补了什么，不静默。 */
  let meta = {};
  const mraw = extractJsonObject(txt, 'window.EPIRUS_CHAMPION_3P_META');
  /* ⚠ `parseMetaTolerant` 返回的是 `{meta, repaired}` 而不是 meta 本身 —— 第一版直接当对象用，
   *   于是 `rulesFingerprint` 恒为 undefined ⇒ **指纹守卫是惰性的**（门 D231 ⑥ 拿合成夹具当场抓到）。 */
  if (mraw) { try { const pr = parseMetaTolerant(mraw, f); meta = (pr && pr.meta) || {}; } catch (e) { console.log('[soup] ⚠ ' + f + ' 的 META 解析不了（' + e.message + '）⇒ 规则指纹按缺失处理'); } }
  src.push({ file: f, abs, pack: obj, params: P.unpack(obj, true), wid: widOf(txt), meta });
}

/* 形状一致是"能逐位平均"的前提；规则指纹一致是"平均完还在同一个世界里"的前提。 */
const s0 = src[0];
for (const s of src.slice(1)) {
  if (s.pack.a.length !== s0.pack.a.length || s.pack.f !== s0.pack.f || s.pack.fa !== s0.pack.fa || s.pack.h !== s0.pack.h || s.pack.v !== s0.pack.v) {
    console.error('[soup] ⛔ 形状不同，逐位平均无意义：' + s0.file + ' ' + JSON.stringify({ v: s0.pack.v, len: s0.pack.a.length, f: s0.pack.f, fa: s0.pack.fa, h: s0.pack.h }) +
      ' vs ' + s.file + ' ' + JSON.stringify({ v: s.pack.v, len: s.pack.a.length, f: s.pack.f, fa: s.pack.fa, h: s.pack.h }));
    process.exit(3);
  }
}
/* ⚠ 实测：`train-3p` 的臂产物 meta 里**没有** `rulesFingerprint`（只有线上槽那颗有 ⇒ 本班 6 枚臂产物全缺）。
 * 所以"指纹一致"这件事对臂产物是**没有可比对象**，不是"验过一致" ⇒ 缺指纹必须自己喊，
 * 否则这条守卫会伪装成"通过"（本仓"回显生效值"那条规矩）。 */
const FP_MISSING = src.filter(s => !s.meta.rulesFingerprint).map(s => s.file);
if (FP_MISSING.length) {
  console.log('[soup] ⚠ 规则指纹守卫**这一趟没有效力**：' + FP_MISSING.length + ' 粒来源的 meta 里没有 `rulesFingerprint`（' + FP_MISSING.join(' ') + '）' +
    '\n       ⇒ 只核了形状（`v/f/fa/h` + 长度）。跨规则版本融合的风险这次由使用方自己承担（产物 meta 里记着 `fpMissing`）。');
}
/* 只比**有指纹的那些**：臂产物普遍缺这个字段，把"缺"当成一个值会比出假冲突（现役 + 任意臂 ⇒ 一定"不一致"），
 * 也会把"两边都没核"读成"一致"。缺的那部分由上面那条响亮警告负责。 */
const FP_PRESENT = Array.from(new Set(src.map(s => s.meta.rulesFingerprint).filter(Boolean)));
let fpForced = false;
if (FP_PRESENT.length > 1) {
  if (arg('force-fp', '') !== '1') {
    console.error('[soup] ⛔ 规则指纹不一致（' + FP_PRESENT.join(' vs ') + '）⇒ 这些包不在同一个规则世界里，平均出来的东西没有任何一版引擎能解释。' +
      '\n       确实要强行融合就加 --force-fp=1（会把"放行"写进产物 meta）。');
    process.exit(4);
  }
  fpForced = true;
  console.log('[soup] ⚠ 规则指纹不一致但 --force-fp=1 放行：' + FP_PRESENT.join(' vs '));
}

/* ============================ 融合 + 落盘 ============================ */
/* §E498 两种模式：默认是**加权平均**；给了 `--copy-cols=` 就是**外科复制**（base = 第一粒，donor = 第二粒，
 *   只把指定的动作语义列从 donor 搬进 base，其余逐位保持 base）⇒ 与 --w 互斥，且只接受两粒。 */
const COPY = arg('copy-cols', '') ? String(arg('copy-cols')).split(',').map(s => s.trim()).filter(x => x !== '').map(Number) : null;
const sh0 = { HID: src[0].pack.h, FEAT_S: src[0].pack.f, FEAT_A: src[0].pack.fa, FEAT_N: src[0].pack.f + src[0].pack.fa };
let params, w, MODE, changed = 0;
if (COPY) {
  if (src.length !== 2) { console.error('[soup] ⛔ --copy-cols 只吃两粒（第一粒 = base，第二粒 = donor），实测 ' + src.length + ' 粒'); process.exit(64); }
  if (WS) { console.error('[soup] ⛔ --copy-cols 与 --w 互斥：复制不做平均（混着给会两头都不像，且没人能复算）'); process.exit(64); }
  let r; try { r = copyCols(src[0].params, src[1].params, COPY, sh0); }
  catch (e) { console.error('[soup] ⛔ copyCols 拒了：' + (e && e.message) + '（这份形状 HID=' + sh0.HID + ' FEAT_S=' + sh0.FEAT_S + ' FEAT_A=' + sh0.FEAT_A + '）'); process.exit(3); }
  params = r.params; w = [1, 0]; MODE = 'copy-cols'; changed = r.changed;
  console.log('[soup] 外科复制模式 ‖ base=' + src[0].file + ' ‖ donor=' + src[1].file + ' ‖ 列 ' + r.cols.join(',') +
    ' ‖ 改了 ' + changed + ' 格（= ' + sh0.HID + ' 个隐单元 × ' + r.cols.length + ' 列 的上限内）');
} else {
  const m = mix(src.map(s => s.params), WS); params = m.params; w = m.w; MODE = 'mean';
}
const pack = P.pack(params);
const meta = {
  generatedBy: 'tools/soup-pack.mjs',
  soup: {
    mode: MODE, cols: MODE === 'copy-cols' ? COPY.filter((x, i) => COPY.indexOf(x) === i) : null, changed,
    weights: w.map(x => Number(x.toFixed(6))),
    sources: src.map(s => ({ file: s.file, wid: s.wid, ts: s.meta.ts || null, arm: s.meta.arm || s.meta.nameSeed || null, rulesFingerprint: s.meta.rulesFingerprint || null })),
    forceFp: fpForced,
    fpMissing: FP_MISSING,
    fpPresent: FP_PRESENT,
    /** 线性连接自证：平均完与每一粒来源的逐位相对距离（0=完全相同）。
     *  跨血统的包如果离得很远，说明它们本来就不在一个盆地 —— 读数要带着这个数去解释。 */
    l2ToSource: src.map(s => {
      let n = 0, d = 0;
      for (let i = 0; i < params.length; i++) { const x = params[i] - s.params[i]; d += x * x; n += s.params[i] * s.params[i]; }
      return Number((Math.sqrt(d) / (Math.sqrt(n) || 1)).toFixed(4));
    })
  },
  rulesFingerprint: s0.meta.rulesFingerprint || null,
  ts: new Date().toISOString()
};
/* 绝对路径要认 Windows 的 `C:\…` 与 `C:/…` 两种写法（门 D231 ⑥ 抓到第一版只认 `/`，
 * 于是 `--out=C:\Temp\x.js` 被拼成 `D:\code\Epirus-Web\C:\Temp\x.js` ⇒ mkdir ENOENT）。 */
const isAbs = p => /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\');
const outAbs = isAbs(OUT) ? OUT : join(ROOT, OUT);
const outDir = dirname(outAbs);
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(outAbs,
  '/* Epirus 多人冠军 · 权重融合（由 tools/soup-pack.mjs 生成，只读数据，不要手改） */\n' +
  'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\n' +
  'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(pack) + ';\n');

console.log('[soup] ' + (MODE === 'copy-cols' ? '模式 = 外科复制列（不是平均）' : '来源 ' + src.length + ' 粒 · 权重 ' + w.map(x => x.toFixed(3)).join(' : ')));
src.forEach((s, i) => console.log('   w=' + w[i].toFixed(3) + '  ' + s.wid + '  ' + s.file + (s.meta.arm ? '  arm=' + s.meta.arm : '')));
console.log('[soup] 与每粒来源的逐位相对距离：' + meta.soup.l2ToSource.join('  '));
console.log('[soup] ✔ 已写 ' + outAbs + '   （形状 v' + pack.v + ' · len=' + pack.a.length + ' · f=' + pack.f + ' · fa=' + pack.fa + ' · h=' + pack.h + '）');
