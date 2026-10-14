#!/usr/bin/env node
/* §E312 壳的"阈值该定在哪"离线扫描
 *
 * 为什么要离线跑：查看器里那个壳的默认阈值 / 收缩强度，本来是我截图一张一张试出来的（慢且看不见全貌）。
 * 而场的算法只需要 coords.tsv 的三列显示坐标 + feas 的 ok ⇒ 可以完全离线复算，
 * 于是"默认值"这件事从"看着顺眼"变成"有一张表"。
 *
 * 与查看器逐字同口径的地方（改了这边要改那边）：
 *   ax = x3 ‖ by = y3 ‖ cz = (z3 − zmin)/(zmax − zmin) × zBase，**三处 min/max 都是 0.5%/99.5% 截尾分位**，
 *   zBase = 0.26 × span（span = 截尾后的 max(x 跨, y 跨)）—— 见 viewer.mjs:880~903
 *   **F = Hp/100 + T·S（§E314 起是线上口径）**；σ = 第 6 近邻距离的中位（按显示度量）；核 = 高斯，支撑 R = 2.6σ
 *   场 = (ESS·p̂ + M0·p0)/(ESS + M0)，ESS = (Σw)²/Σw²，p0 = 全库过线率
 *
 * 用法：node champion-map/iso-sweep.mjs [--zfrac=0.26] [--T=0.10]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const rd = (f) => readFileSync(join(HERE, f), 'utf8').trim().split('\n').map((l) => l.split('\t'));

const CO = rd('coords.tsv'); const ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const OK = {};
for (const f of ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv']) {
  const L = rd(f); const hd = Object.fromEntries(L[0].map((h, i) => [h, i]));
  for (const r of L.slice(1)) if (r[hd.id]) OK[r[hd.id]] = r[hd.ok] === '1' ? 1 : (r[hd.ok] === '0' ? 0 : null);
}
const rows = CO.slice(1).filter((r) => r[ch.id] && isFinite(+r[ch.x3]));
const N = rows.length;
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };

/* ===== §E608 第四处不同源：**判定本身** =====
 *   上面那三张 feas 表给的是 732 有判定 / 150 过线，而页面烘焙时**现跑同一道闸**（`feasibilityOf`）得到 794 / 170
 *   ⇒ 空间对上了、门对上了、M0 对上了，绝对枚数还是差一截，差的就是这一层。
 *   `--ok=page`（默认：读得到烘焙页就用它的标签）⇒ 这台量具才真是页面那行"壳内 194 ‖ 真过线 103"的复算器；
 *   `--ok=feas` 回到旧形状（§E605 那批历史数就是它量的 ⇒ 别拿它的绝对数去对页面）。
 *   ⚠ 选了 page 就**整份换过去**，不许一半 feas 一半 page（混源比换源更难查）。 */
const OKMODE = (arg('ok', 'page') || 'page').toLowerCase();
if (OKMODE !== 'page' && OKMODE !== 'feas') { console.error('⛔ --ok 只认 page|feas（给了 ' + OKMODE + '）'); process.exit(2); }
let okSrc = 'feas-s1..s3 三表（§E605 那批历史数的口径）';
if (OKMODE === 'page') {
  let D = null;
  try { const s = readFileSync(join(HERE, 'index.html'), 'utf8');
    const m = s.match(/var DATA = (\[[\s\S]*?\]); var OKSRCJ/); if (m) D = JSON.parse(m[1]); } catch (e) { D = null; }
  if (D) { const OKP = {}; for (const d of D) if (d.id) OKP[d.id] = (d.ok === 1 ? 1 : (d.ok === 0 ? 0 : null));
    for (const k of Object.keys(OK)) delete OK[k];
    for (const k of Object.keys(OKP)) OK[k] = OKP[k];
    okSrc = '烘焙页 champion-map/index.html 的 DATA[].ok（与页面上那行读数同一份判定）';
  } else console.error('⚠ --ok=page 但读不到/解不出 champion-map/index.html 的 var DATA ⇒ 退回 feas 三表（先跑 node champion-map/viewer.mjs）');
}
console.log('# 判定源 = ' + okSrc + ' ‖ 换源用 --ok=feas');
/* 显示度量必须与查看器**逐字同式**（viewer.mjs:880~903）。这里曾经错过一次：
 *   旧写法用全 min/max + zBase = 0.62×max(spanX,spanY)，而页面用的是 **0.5%/99.5% 截尾** 的 span、
 *   zBase = 0.26×span ⇒ 两边走的是不同的第三轴比例，σ 和整张阈值表都不是同一台仪器量出来的
 *   （症状：页面报"留一 27 枚里 3 枚"，表上却是 37 枚里 9 枚）。改完这一处才对得上。*/
/* §E608 第三处、也是最大的一处口径分家：**壳画在哪个空间里**。
 *   `viewer.mjs:386` 在 t-SNE 面板上把 `P[i].x3/y3/z3` 这三个**字段名**填的是**投影坐标 `xt3/yt3/zt3`**
 *   （`PROJTSNE && r.xt3` 那一支）⇒ 页面上那只壳、以及它的 σ=**0.105**，量的是**投影空间**；
 *   而本文件（和 DS 那份一次性复刻）一直读的是 `x3/y3/z3` = **行为轴**空间，σ=**0.1927**。
 *   t-SNE 是非线性嵌入 ⇒ 这不是"同一张云差个比例尺"，是**两张不同的云**（所以页面 194 枚、这台 70 枚，两个数都没算错，问的不是同一件事）。
 *   默认 `auto` = 跟着页面走（有 xt3 就用 xt3），要量行为轴那一张就 `--axes=behavior`。 */
const AXES = (arg('axes', 'auto') || 'auto').toLowerCase();
const HAS_T3 = ['xt3', 'yt3', 'zt3'].every((k) => ch[k] !== undefined) &&
  rows.some((r) => String(r[ch.xt3] === undefined ? '' : r[ch.xt3]).trim() !== '');
const useTsne = AXES === 'auto' ? HAS_T3 : (AXES === 'tsne' ? true : (AXES === 'behavior' ? false : null));
if (useTsne === null) { console.error('⛔ --axes 只认 auto|tsne|behavior（给了 ' + AXES + '）'); process.exit(2); }
if (AXES === 'tsne' && !HAS_T3) { console.error('⛔ --axes=tsne 但表里没有 xt3/yt3/zt3 列 ⇒ 这张面板不是 t-SNE 投影'); process.exit(2); }
const q = (arr, p) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.max(0, Math.min(s.length - 1, Math.floor(s.length * p)))]; };
const colOf = (main, tsn) => useTsne ? rows.map((r) => +(r[ch[tsn]] === undefined || String(r[ch[tsn]]).trim() === '' ? r[ch[main]] : r[ch[tsn]]))
  : rows.map((r) => +r[ch[main]]);
const x3 = colOf('x3', 'xt3'), y3 = colOf('y3', 'yt3'), z3 = colOf('z3', 'zt3');
const spaceTxt = useTsne ? 'xt3/yt3/zt3（投影 t-SNE，与页面同一张云）' : 'x3/y3/z3（三维行为轴）';
const span = Math.max(q(x3, .995) - q(x3, .005), q(y3, .995) - q(y3, .005)) || 1;
const zmin0 = q(z3, .005), zspan = (q(z3, .995) - zmin0) || 1;
const zBase = Number(arg('zfrac', 0.26)) * span;
const A = x3, B = y3, C = z3.map((z) => (z - zmin0) / zspan * zBase);
console.log('# 空间 = ' + spaceTxt + ' ‖ span=' + span.toFixed(3) + ' ‖ zBase=' + zBase.toFixed(3) +
  (useTsne ? '' : ' ‖  页面在 t-SNE 面板上用的是投影坐标 ⇒ 这一档只能当"行为轴那一张云"的对照'));
const V = rows.map((r) => OK[r[ch.id]]);
const nHas = V.filter((v) => v === 0 || v === 1).length, nOk = V.filter((v) => v === 1).length;
const p0 = nOk / nHas;

/* σ：第 6 近邻（显示度量）的中位 */
const nn = [];
for (let i = 0; i < N; i++) {
  const h = [];
  for (let j = 0; j < N; j++) { if (j === i) continue;
    const dx = A[i] - A[j], dy = B[i] - B[j], dz = C[i] - C[j], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (h.length < 6) { h.push(d); h.sort((a2, b2) => a2 - b2); } else if (d < h[5]) { h[5] = d; h.sort((a2, b2) => a2 - b2); } }
  nn.push(h[5]);
}
nn.sort((a, b) => a - b);
const sig = nn[Math.floor(nn.length * .5)];
const R = 2.6 * sig, s2 = 2 * sig * sig;
console.log('样本 ' + N + ' 枚（有判定 ' + nHas + ' ‖ 过线 ' + nOk + ' ⇒ 底率 ' + (100 * p0).toFixed(1) + '%）');
console.log('σ = 第 6 近邻中位 = ' + sig.toFixed(1) + ' 显示单位 ‖ 支撑 R = ' + R.toFixed(1));

/* 粗哈希（与查看器同形）*/
const lo = [Math.min(...A) - R, Math.min(...B) - R, Math.min(...C) - R];
const buckets = {};
for (let i = 0; i < N; i++) {
  const key = Math.floor((A[i] - lo[0]) / R) + ',' + Math.floor((B[i] - lo[1]) / R) + ',' + Math.floor((C[i] - lo[2]) / R);
  (buckets[key] || (buckets[key] = [])).push(i);
}
function at(X, Y, Z, self) {
  const bi = Math.floor((X - lo[0]) / R), bj = Math.floor((Y - lo[1]) / R), bk = Math.floor((Z - lo[2]) / R);
  let num = 0, den = 0, den2 = 0;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
    const arr = buckets[(bi + di) + ',' + (bj + dj) + ',' + (bk + dk)]; if (!arr) continue;
    for (const m of arr) { if (m === self) continue; const v = V[m]; if (v !== 0 && v !== 1) continue;
      const ex = X - A[m], ey = Y - B[m], ez = Z - C[m], dd = ex * ex + ey * ey + ez * ez;
      if (dd > R * R) continue; const gv = Math.exp(-dd / s2); den += gv; den2 += gv * gv; num += gv * v; } }
  return { den, num, den2 };
}
function shrink(o, M0) { /* E401：与页面同步 —— 没证据 = 0，向 0 收缩（旧版向 p0 收缩 ⇒ 阈值 ≤ p0 时整片虚空变壳内）*/
  if (o.den <= 1e-6) return 0; const ess = o.den * o.den / (o.den2 || 1e-9); return (ess * (o.num / o.den)) / (ess + M0); }

/* 每枚的"含自己"与"留一"场值先算一次（阈值扫描只是在同一批值上换比较线）*/
const withSelf = [], loo = [];
for (let i = 0; i < N; i++) { const o = at(A[i], B[i], C[i], -1), o2 = at(A[i], B[i], C[i], i);
  withSelf.push(o); loo.push(o2); }

/* ===== §E608（千问 10-15）：这台量具原来**没有密度门** =====
 *   页面画壳跑的是 `min(1,(den/DREF)²)`（`viewer.mjs` 的 `gfield`，E400/E401），而这里全文一道门都没有
 *   ⇒ 本文件头注自己警告过的那句"表与页面不是同一台仪器，挑出来的默认值白挑"**在这台仪器自己身上应验了**：
 *   在册的 `isoT=0.30`（ok）与 `0.67`（pot）是在**不带门**的场里挑的。
 *   现在默认与页面同式（门开），要复现历史那批数就 `--nogate`（那是"另一台仪器"，不许再拿来定默认值）。 */
const GATEON = !process.argv.includes('--nogate');
const _den = loo.map((o) => o.den).filter((d) => d > 0).sort((x, y) => x - y);
const DMED = _den.length ? _den[_den.length >> 1] : 1;
const DREF = 0.6 * DMED;
const gateOf = (den) => (GATEON && DREF > 0 ? Math.min(1, (den / DREF) * (den / DREF)) : 1);
const gfield = (o, M0) => shrink(o, M0) * gateOf(o.den);
console.log('# 密度门 = ' + (GATEON ? '开（与页面同式：DREF = 0.6 × 中位核质量 = ' + DREF.toFixed(3) + '）'
  : '**关**（--nogate ⇒ 与页面不同场，这一档只能当历史对照，不许拿来定默认值）'));
let nOkAll = 0; for (const v of V) if (v === 1) nOkAll++;

for (const M0 of [2, 3, 5, 8]) {
  const ws = withSelf.map((o) => gfield(o, M0)), ls = loo.map((o) => gfield(o, M0));
  const peak = Math.max(...ws);
  let line = 'M0=' + String(M0).padEnd(2) + ' 峰值(含自己) ' + (100 * peak).toFixed(0) + '%  留一峰值 ' +
    (100 * Math.max(...ls)).toFixed(0) + '%   ';
  for (const t of [0.25, 0.3, 0.35, 0.4, 0.5]) {
    let ins = 0, cov = 0, insL = 0, covL = 0;
    for (let i = 0; i < N; i++) { if (V[i] !== 0 && V[i] !== 1) continue;
      if (ws[i] >= t) { ins++; if (V[i] === 1) cov++; }
      if (ls[i] >= t) { insL++; if (V[i] === 1) covL++; } }
    /* §E608：两个方向分开数（与页面那行读数同一套名字）—— 只看"壳内/真过线"就看不出这只壳错在哪一侧 */
    line += ' @' + (100 * t).toFixed(0) + '%: 壳内 ' + ins + '/' + cov + '（误包 ' + (ins - cov) + ' ‖ 漏画 ' + (nOkAll - cov) + '）‖留一 ' + insL + '/' + covL;
  }
  console.log(line);
}
console.log('\n读法：壳内 K/N = "被这层壳圈进 N 枚、其中 K 枚真过线" ‖ 误包 = 圈进来的未过线枚 ‖ 漏画 = 过线却没被圈进的枚数（分母 = 全库过线 ' + nOkAll + '）。');
console.log('含自己是循环的（一枚会把自己那格抬上去），留一才是"它不是靠自己被圈进来"的读数 ⇒');
console.log('默认阈值要挑在**留一那一列还有东西**的最高档，否则壳只是把点自己照亮。');

/* ===== 第二个场：势（F）归一化 =====
 * 为什么要单独扫：查看器里 isoT 是**两个场共用的一根线**，而这两个场的量纲完全不同 ——
 *   'ok' 场：值 ∈ {0,1}，先验 p0 = 全库过线率 15.7%，收缩后峰值 ~49% ⇒ 30% 是个有意义的刻度；
 *   'pot' 场：值 = (F−Fmin)/span ∈ [0,1]，先验 p0 = 全库均值 ≈ 0.59，峰值 ≈ 0.69
 *            ⇒ 阈值 45% **低于均值**，于是"壳内 712/718 枚、纯度 = 底率"= 圈了个寂寞（截图里就是这个）。
 * 所以 pot 场的默认线必须落在 [均值, 峰值] 这一段里，而这一段只有 0.59~0.69 这么窄 ⇒ 拿表定，别拿眼睛定。
 * 副产物：圈进多少枚 = 这层壳的作用面；纯度 = 它比底率(15.7%)富集了多少倍。*/
/* §E314：势的定义换了尺 ⇒ 这里必须跟着换（用户裁定把整张图换成线上口径 ⇒ 查看器 Fv 从 H/100 改成 Hp/100）。
 *   不跟着改就又是 §E312 那条病的第二次：表与页面不是同一台仪器，挑出来的默认值白挑。
 *   实测换尺后 pot 场先验 59% → 63%、峰值 68% → 70% ⇒ 旧默认 64% 离均值只剩 1pt，壳圈进 338 枚、纯度 31%→23%。
 *   与查看器同式：F = Hp/100 + T·S，T = 出厂默认（= 查看器 st.T 的初值，这里不另存常数副本）。*/
const Tv = Number(arg('T', 0.10));
const FP = rows.map((r) => (+r[ch.Hp]) / 100 + Tv * (+r[ch.S]));
const fmin = Math.min(...FP), fmax = Math.max(...FP), fspan = fmax - fmin;
const V2 = FP.map((f) => (f - fmin) / fspan);
const p0b = V2.reduce((s, v) => s + v, 0) / N;
/* 核的分子换成 V2（势）而不是 V（过线 0/1），先验换成均值 ⇒ 与查看器 field='pot' 同形*/
function atV(X, Y, Z, self) {
  const bi = Math.floor((X - lo[0]) / R), bj = Math.floor((Y - lo[1]) / R), bk = Math.floor((Z - lo[2]) / R);
  let num = 0, den = 0, den2 = 0;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) {
    const arr = buckets[(bi + di) + ',' + (bj + dj) + ',' + (bk + dk)]; if (!arr) continue;
    for (const m of arr) { if (m === self) continue; const v = V[m]; if (v !== 0 && v !== 1) continue;
      const ex = X - A[m], ey = Y - B[m], ez = Z - C[m], dd = ex * ex + ey * ey + ez * ez;
      if (dd > R * R) continue; const gv = Math.exp(-dd / s2); den += gv; den2 += gv * gv; num += gv * V2[m]; } }
  return { den, num, den2 };
}
/* §E608 第二处口径分家：这一支原来是**向先验 p0b 收缩**（E401 之前的形状），而页面现在两个场都走"没证据 = 0"
 *   （`viewer.mjs` 里只有一个 `shrink`，'ok'/'pot' 的差别只在喂进去的值），M0 也是页面 `DM0 = 2` 而不是这里写死的 5
 *   ⇒ 上面那句"与查看器同步"是假的，在册的 pot 默认线 **0.67 就是这台走旧形状的仪器挑的**。
 *   现在默认与页面同式；`--legacy-pot` 保留旧形状只作历史对照，`--potM0=` 可以扫别的档。 */
const POT_M0 = Number(arg('potM0', 2)) || 2;
const LEGP = process.argv.includes('--legacy-pot');
function shrink2(o, M0) { if (o.den <= 1e-6) return LEGP ? p0b : 0; const ess = o.den * o.den / (o.den2 || 1e-9);
  const p = ess * (o.num / o.den);
  return LEGP ? (p + M0 * p0b) / (ess + M0) : p / (ess + M0); }
const w2 = [], l2 = [];
for (let i = 0; i < N; i++) { const ow = atV(A[i], B[i], C[i], -1), ol = atV(A[i], B[i], C[i], i);
  w2.push(shrink2(ow, POT_M0) * gateOf(ow.den)); l2.push(shrink2(ol, POT_M0) * gateOf(ol.den)); }
console.log('\npot 场（M0=' + POT_M0 + ' ‖ 形状 = ' + (LEGP ? '**旧**：向先验 p0 收缩（--legacy-pot，与页面不同）' : '与页面同式：向 0 收缩') + '）：均值(=先验) ' + (100 * p0b).toFixed(0) +
  '% ‖ 峰值(含自己) ' + (100 * Math.max(...w2)).toFixed(0) + '% ‖ 留一峰值 ' + (100 * Math.max(...l2)).toFixed(0) + '%');
for (const t of [0.63, 0.64, 0.65, 0.655, 0.66, 0.67, 0.68]) {
  let ins = 0, cov = 0, insL = 0, covL = 0;
  for (let i = 0; i < N; i++) { if (V[i] !== 0 && V[i] !== 1) continue;
    if (w2[i] >= t) { ins++; if (V[i] === 1) cov++; }
    if (l2[i] >= t) { insL++; if (V[i] === 1) covL++; } }
  console.log(' @' + (100 * t).toFixed(0) + '%: 壳内 ' + cov + '/' + ins + ' 过线 = ' + (100 * cov / (ins || 1)).toFixed(0) +
    '% ‖留一 ' + covL + '/' + insL + ' = ' + (100 * covL / (insL || 1)).toFixed(0) + '%（底率 ' + (100 * p0).toFixed(1) + '%）');
}

