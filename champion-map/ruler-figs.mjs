/* §E291 三张图：**一维阶梯 + 二维（力导向）+ 三维（两视角）**，尺全部现测（§E290 的 e287-ruler-s*.tsv）
 *
 * 为什么是这三张（`e287-fit.mjs` 实测出来的，不是审美选择）：
 *   dims=2  力导向 force：Spearman 0.701 ‖ recall@15 **16.3%**（随机地板 2.0%）‖ 超额 R² 平均 0.122 ‖ 能反推 5/14 列
 *   dims=3  力导向 force：Spearman 0.768 ‖ recall@15 **29.1%**           ‖ 超额 R² 平均 0.257 ‖ 能反推 **10/14 列**
 *   ⇒ 第三根空间轴**把图上能装下的行为特征数翻倍**；而深度 F 已经用颜色表达了，所以第三根轴是"免费"的（用户的判断，实测站住）。
 *   ⚠ pls（有监督：让轴去最大协方差 [H,S]）在这套判据下**全面垫底且 2D/3D 数字一模一样 ⇒ 我的 NIPALS 是坏的**，
 *     它的负结果**不采信**、也不写进任何结论（"监督投影没用"这句话我没资格说）。
 *
 * 产物：`e287-ladder.svg`（一维阶梯）‖ `e287-map2.svg`（二维地图）‖ `e287-map3.svg`（三维·正视图+侧视图）‖ `e287-figs.html`（三张并排 + 判据表）
 * 用法：node docs/artifacts/e287-out/e287-figs.mjs [--T=0.1] [--neigh=15] [--epochs=300]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const T = Number(arg('T', 0.1)), NEIGH = Number(arg('neigh', 15)), EPOCH = Number(arg('epochs', 300));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => { const n = Number(v); return isFinite(n) && v !== '' && v != null ? n : NaN; };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const nz = col => { const mu = mean(col), sd = Math.sqrt(mean(col.map(x => (x - mu) ** 2))) || 1; return col.map(x => (x - mu) / sd); };

/* ===== 尺 ===== */
/* §E328：`--ruler=` 可以指任意多张现测尺表（逗号分隔，相对本目录或仓库根都行）。
 *   默认仍是 §E290 那三片 —— **不改默认是为了"重跑就复现今天的图"**；补子代时显式把新六片加进来。
 *   `--coords=` 同理：默认写自己目录下的 e287-coords.tsv，只有明确指到 champion-map/coords.tsv 才动现役图。 */
const files = String(arg('ruler', 'e287-ruler-s1.tsv,e287-ruler-s2.tsv,e287-ruler-s3.tsv')).split(',')
  .map(f => f.trim()).filter(Boolean)
  .map(f => (f.indexOf('/') < 0 ? join(HERE, f) : (existsSync(join(ROOT, f)) ? join(ROOT, f) : join(HERE, f))))
  .filter(existsSync);
if (!files.length) { console.error('⛔ 现测尺一张都没读到 ⇒ 先跑 ruler-measure.mjs（--ruler= 收到：' + arg('ruler', '') + '）'); process.exit(2); }
console.error('现测尺 ' + files.length + ' 张：' + files.map(f => f.slice(ROOT.length + 1).replace(/\\/g, '/')).join(' ‖ '));
const seen = new Set(), raw = [];
/* ⚠ 两处都不能省：① CRLF 归一 —— 原来直接 split，末列的**表头键**会带上 `\r`（'lineage\r'），
 *   于是 `o.lineage` 恒为 undefined，"历代上槽冠军 15 枚"那句其实是把 183 枚读成了没身份（今天靠 attach-kin
 *   再清一次才凑对，两件坏事撞成同一个结果 = 侥幸）；② 不许 `.trim()` 整份文件 —— 末行的行尾空单元格会被
 *   连着制表符一起削掉，那一行就少几列（§E375 加进来的 16 枚正好排在末尾）。只剥行尾换行。 */
for (const p of files) { const t = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n'), h = t[0].split('\t');
  for (const l of t.slice(1)) { const c = l.split('\t'); const o = {}; h.forEach((k, i) => { o[k] = c[i]; }); if (!o.id || seen.has(o.id)) continue; seen.add(o.id); raw.push(o); } }
const COORD = ['dmg', 'heavy', 'holo', 'zeroRate', 'drawRate', 'rounds', 'distinctKeys', 'seatSpread', 'rwDmg', 'charges',
  'waste', 'noThreatStance', 'fieldAAtk', 'fieldARounds'];
const pts = raw.filter(r => isFinite(num(r.H)) && isFinite(num(r.S)) && COORD.every(c => isFinite(num(r[c]))));
const N = pts.length;
const F = pts.map(p => num(p.H) / 100 + T * num(p.S));
const order = F.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
const rank = new Array(N); order.forEach((e, k) => { rank[e[1]] = k + 1; });
console.log('现测尺 ' + N + ' 枚（历代上槽冠军 ' + pts.filter(p => p.lineage).length + ' 枚）‖ T=' + T);

/* ===== 稳健度量 + 高维距离 + kNN 图 ===== */
function normalScores(col) { const o = col.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); const out = new Array(col.length);
  const q = p => { const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -0.322396458041136499, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.78469570904146256e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754446890778718e+00];
    const r0 = p - 0.5, rr = p * r0;
    if (p < 0.02425) { const s = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * s + c[1]) * s + c[2]) * s + c[3]) * s + c[4]) * s + c[5]) / ((((d[0] * s + d[1]) * s + d[2]) * s + d[3]) * s + 1); }
    if (p <= 0.97575) return (((((a[0] * rr + a[1]) * rr + a[2]) * rr + a[3]) * rr + a[4]) * rr + a[5]) * r0 / (((((b[0] * rr + b[1]) * rr + b[2]) * rr + b[3]) * rr + b[4]) * rr + 1);
    const s = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * s + c[1]) * s + c[2]) * s + c[3]) * s + c[4]) * s + c[5]) / ((((d[0] * s + d[1]) * s + d[2]) * s + d[3]) * s + 1); };
  for (let k = 0; k < o.length; k++) out[o[k][1]] = q((k + 0.5) / o.length);
  return out; }
const SC = COORD.map(k => normalScores(pts.map(p => num(p[k]))));
const Z = pts.map((p, i) => SC.map(c => c[i]));
const D = COORD.length;
const HD = new Float64Array(N * N);
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { let s = 0; for (let d = 0; d < D; d++) { const q = Z[i][d] - Z[j][d]; s += q * q; } HD[i * N + j] = HD[j * N + i] = Math.sqrt(s); }
const kNei = [];
for (let i = 0; i < N; i++) { const a = []; for (let j = 0; j < N; j++) if (j !== i) a.push([HD[i * N + j], j]); a.sort((x, y) => x[0] - y[0]); kNei.push(a.slice(0, NEIGH)); }

/* ===== 力导向布局（与 e287-fit.mjs 同一套参数：**从 PCA 起步**，否则实测会退化成 Spearman 0.49 < PCA 0.66）===== */
function gram(S) { const M = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = i; j < N; j++) { let s = 0; for (let d = 0; d < S[0].length; d++) s += S[i][d] * S[j][d];
    M[i * N + j] = M[j * N + i] = s / (N - 1); } return M; }
function topVecs(M, n, seed) { const rnd = mulberry(seed); const out = []; const basis = [];
  for (let e = 0; e < n; e++) {
    let v = new Float64Array(N); for (let i = 0; i < N; i++) v[i] = rnd() - 0.5;
    const orth = () => { for (const b of basis) { let d = 0; for (let i = 0; i < N; i++) d += b[i] * v[i]; for (let i = 0; i < N; i++) v[i] -= d * b[i]; }
      let nn = 0; for (let i = 0; i < N; i++) nn += v[i] * v[i]; nn = Math.sqrt(nn) || 1; for (let i = 0; i < N; i++) v[i] /= nn; };
    orth();
    for (let it = 0; it < 500; it++) { const w = new Float64Array(N);
      for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += M[i * N + j] * v[j]; w[i] = s; }
      let nw = 0; for (let i = 0; i < N; i++) nw += w[i] * w[i]; nw = Math.sqrt(nw) || 1;
      for (let i = 0; i < N; i++) v[i] = w[i] / nw; orth(); }
    basis.push(v); out.push(v); }
  return out; }
const PCAV = topVecs(gram(Z), 3, 7);
function force(nd) {
  const rnd = mulberry(2026);
  /* 边集与 e287-fit.mjs **逐字相同**（有向 + 互近邻保留）⇒ 两处判据数字可比；
   *   换成无向去重会让引力少一半，同一套超参下 Spearman 从 0.70 掉到 0.50 —— 这条敏感性记在日志里。 */
  const edges = [];
  for (let i = 0; i < N; i++) for (const [d, j] of kNei[i]) if (j > i || kNei[j].some(e => e[1] === i)) edges.push([i, j, 1 / (1 + d)]);
  const P = []; for (let i = 0; i < N; i++) { const a = []; for (let d = 0; d < nd; d++) a.push(PCAV[d][i]); P.push(a); }
  const dist = (i, j) => { let s = 0; for (let a = 0; a < nd; a++) s += (P[i][a] - P[j][a]) ** 2; return Math.sqrt(s) || 1e-9; };
  const scale = 1, kRep = scale * scale / N;
  let temp = 0.1 * scale;
  for (let it = 0; it < EPOCH; it++) {
    const g = P.map(() => new Array(nd).fill(0));
    for (let a = 0; a < 400; a++) {
      const i = Math.floor(rnd() * N), j = Math.floor(rnd() * N); if (i === j) continue;
      const d = dist(i, j), f = kRep / d * 30 / N;
      for (let e = 0; e < nd; e++) { const u = (P[i][e] - P[j][e]) / d * f; g[i][e] += u; g[j][e] -= u; } }
    for (const [i, j, w] of edges) {
      const d = dist(i, j), f = d * d * w / (scale / 4);
      for (let e = 0; e < nd; e++) { const u = (P[i][e] - P[j][e]) / d * f; g[i][e] -= u; g[j][e] += u; } }
    for (let i = 0; i < N; i++) { let n = 0; for (let e = 0; e < nd; e++) n += g[i][e] * g[i][e]; n = Math.sqrt(n) || 1;
      const lim = Math.min(n, temp) / n; for (let e = 0; e < nd; e++) P[i][e] += g[i][e] * lim; }
    temp *= 0.985;
  }
  return P;   /* 归一化在下面统一做 */
}
const P2 = (() => { const raw2 = force(2); const A = raw2.map(p => p[0]), B = raw2.map(p => p[1]); return raw2.map((p, i) => [A[i], B[i]]); })();
const P3 = (() => { const raw3 = force(3); return raw3; })();
for (const a of [0, 1]) { const col = nz(P2.map(p => p[a])); P2.forEach((p, i) => { p[a] = col[i]; }); }
for (let a = 0; a < 3; a++) { const col = nz(P3.map(p => p[a])); P3.forEach((p, i) => { p[a] = col[i]; }); }

/* ===== 判据（与 e287-fit.mjs 同一套定义）===== */
function evaluate(P, nd) {
  const rnd = mulberry(99); const pairs = [];
  for (let t = 0; t < 40000; t++) { const i = Math.floor(rnd() * N), j = Math.floor(rnd() * N); if (i !== j) pairs.push([i, j]); }
  const rk = v => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); o.forEach((e, k) => { r[e[1]] = k; }); return r; };
  const cr = (A, B) => { const ma = mean(A), mb = mean(B); let xy = 0, xx = 0, yy = 0;
    for (let i = 0; i < A.length; i++) { xy += (A[i] - ma) * (B[i] - mb); xx += (A[i] - ma) ** 2; yy += (B[i] - mb) ** 2; } return xy / (Math.sqrt(xx * yy) || 1); };
  const d2 = pairs.map(([i, j]) => { let s = 0; for (let a = 0; a < nd; a++) s += (P[i][a] - P[j][a]) ** 2; return Math.sqrt(s); });
  const dh = pairs.map(([i, j]) => HD[i * N + j]);
  let hit = 0; const knn2 = [];
  for (let i = 0; i < N; i++) { const lo = []; for (let j = 0; j < N; j++) { if (j === i) continue; let s = 0; for (let a = 0; a < nd; a++) s += (P[i][a] - P[j][a]) ** 2; lo.push([Math.sqrt(s), j]); }
    lo.sort((x, y) => x[0] - y[0]); knn2.push(lo.slice(0, NEIGH).map(e => e[1]));
    const want = new Set(kNei[i].map(e => e[1])); for (const j of knn2[i]) if (want.has(j)) hit++; }
  const cols = COORD.concat(['H', 'S']);
  const vals = {}; for (const c of cols) vals[c] = pts.map(p => c === 'H' ? num(p.H) / 100 : c === 'S' ? num(p.S) : num(p[c]));
  const rec = {};
  for (const c of cols) { const y = vals[c], ybar = mean(y); let ss = 0; for (const v of y) ss += (v - ybar) ** 2; let pred = 0;
    for (let i = 0; i < N; i++) { let sw = 0, sv = 0;
      for (const j of knn2[i]) { const w = 1 / (1 + Math.hypot(...P[i].map((x, a) => x - P[j][a]))); sw += w; sv += w * y[j]; }
      pred += (y[i] - sv / sw) ** 2; }
    rec[c] = 1 - pred / (ss || 1); }
  return { sp: cr(rk(d2), rk(dh)), recall: 100 * hit / (N * NEIGH), rec,
    ex: COORD.map(c => rec[c]), r2H: rec.H, r2S: rec.S };
}
const R2 = evaluate(P2, 2), R3 = evaluate(P3, 3);
const RND = evaluate(pts.map(() => { const rnd = mulberry(Math.floor(Math.random() * 1e9)); return [rnd(), rnd()]; }), 2);
console.log('二维力导向：Spearman=' + R2.sp.toFixed(3) + ' ‖ recall@' + NEIGH + '=' + R2.recall.toFixed(1) + '% ‖ 能反推 ' +
  R2.ex.filter(x => x > 0.1).length + '/' + D + ' 列（超额 R² 平均 ' + mean(R2.ex).toFixed(3) + '）‖ 反推 H 的 R²=' + R2.r2H.toFixed(2));
console.log('三维力导向：Spearman=' + R3.sp.toFixed(3) + ' ‖ recall@' + NEIGH + '=' + R3.recall.toFixed(1) + '% ‖ 能反推 ' +
  R3.ex.filter(x => x > 0.1).length + '/' + D + ' 列（超额 R² 平均 ' + mean(R3.ex).toFixed(3) + '）‖ 反推 H 的 R²=' + R3.r2H.toFixed(2));

/* ===== 颜色：F 归一后同一把色标 ===== */
const fmin = Math.min.apply(null, F), fmax = Math.max.apply(null, F);
const colmap = t => 'rgb(' + Math.round(24 + 214 * t) + ',' + Math.round(150 - 96 * t) + ',' + Math.round(196 - 140 * t) + ')';
const ft = i => (F[i] - fmin) / (fmax - fmin || 1);
const U = F.map(v => fmax - v);
const umax = Math.max.apply(null, U);
const SEEDS = (() => { const c = {}; pts.forEach(p => { const k = p.seed || '(无)'; c[k] = (c[k] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]); })();
const PALETTE = ['#f2c94c', '#6fc7ea', '#f28c6b', '#b28df2', '#5fd6a4'];
const SC2 = {}; SEEDS.forEach((k, i) => { SC2[k] = PALETTE[i]; });
const shipI = pts.findIndex(p => p.id === 'SHIPPED-Ldemo');
const title = t => '<text x="14" y="22" fill="#dce6f5" font-size="13" font-family="system-ui,sans-serif">' + esc(t) + '</text>';
const cb = (x, y, h, lab) => { let o = '<defs><linearGradient id="cbg" x1="0" y1="1" x2="0" y2="0">' +
  [0, .25, .5, .75, 1].map(t => '<stop offset="' + (t * 100) + '%" stop-color="' + colmap(t) + '"/>').join('') + '</linearGradient></defs>' +
  '<rect x="' + x + '" y="' + y + '" width="14" height="' + h + '" fill="url(#cbg)" stroke="#8ea2c0"/>';
  for (let i = 0; i <= 4; i++) { const v = fmin + (fmax - fmin) * i / 4, yy = y + h - h * i / 4;
    o += '<text x="' + (x + 18) + '" y="' + (yy + 3.5).toFixed(1) + '" font-size="9" fill="#c9d5e8">' + v.toFixed(2) + '</text>'; }
  return o + '<text x="' + x + '" y="' + (y - 6) + '" font-size="9.5" fill="#c9d5e8">' + esc(lab) + '</text>'; };

/* ===== 图 1：左 = H × S 散点（F 是这两根的函数 ⇒ 这一栏对"势"**无损**，等值线就是对角线）
 *            右 = F 的一维带（点按名次排 + 抖动 ⇒ 718 个点全部可数，只给冠军和首尾打标签）
 *   ⚠ 第一版做成"每枚一行 + 每行写 id"⇒ 718 行只有 0.74px，标签糊成一片（渲出来才发现）。 */
function ladder() {
  const W = 1180, H = 620, PAD = 46, GAP = 74;
  const pw = (W - 2 * PAD - GAP) / 2;
  const hMin = Math.min.apply(null, pts.map(p => num(p.H))), hMax = Math.max.apply(null, pts.map(p => num(p.H)));
  const sMin = 0, sMax = Math.max.apply(null, pts.map(p => num(p.S))) * 1.04;
  const hx = v => PAD + pw * (v - hMin) / (hMax - hMin), hy = v => H - PAD - 26 - (H - 2 * PAD - 46) * (v - sMin) / (sMax - sMin);
  const rnd = mulberry(7);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" font-family="system-ui,sans-serif">' +
    '<rect width="' + W + '" height="' + H + '" fill="#0f1522"/>' +
    title('§E291 一维阶梯（现测尺 · T=' + T + '）‖ 左：H × S —— F = H + T·S 在这一栏是无损的，等值线就是对角线 ‖ 右：F 排序带（718 个点全部可数）') +
    '<text x="' + PAD + '" y="' + (PAD - 18) + '" font-size="11" fill="#dce6f5">轴1 = H（考卷夺 1 率 %）· 轴2 = S = ln G_eff（技能广度熵）</text>';
  /* F 等值线：F = H/100 + T·S，而**横轴画的是百分数** ⇒ 画布上 S = (g − x/100)/T。
   *   第一版按 H 的小数单位算 ⇒ 算出来的 S 全是几百，整条线跑到画布外，"等值线就是对角线"这句话当时是空的。 */
  for (let g = Math.ceil(fmin * 20) / 20; g <= fmax; g += 0.05) {
    const seg = [];
    for (let k = 0; k <= 40; k++) { const x = hMin + (hMax - hMin) * k / 40, sv = (g - x / 100) / T;
      if (sv >= sMin && sv <= sMax) seg.push([hx(x), hy(sv)]); }
    if (seg.length < 2) continue;
    s += '<polyline points="' + seg.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') +
      '" fill="none" stroke="#33415c" stroke-width="1" stroke-dasharray="3 4"/>' +
      '<text x="' + (seg[seg.length - 1][0] + 3).toFixed(1) + '" y="' + seg[seg.length - 1][1].toFixed(1) + '" font-size="8" fill="#6d7f9c">' + g.toFixed(2) + '</text>';
  }
  for (let i = 0; i < N; i++) { const isC = !!pts[i].lineage;
    s += '<circle cx="' + hx(num(pts[i].H)).toFixed(1) + '" cy="' + hy(num(pts[i].S)).toFixed(1) + '" r="' + (isC ? 5.6 : 2.9) +
      '" fill="' + (isC ? (SC2[pts[i].seed] || '#e6edf7') : colmap(ft(i))) + '" fill-opacity="' + (isC ? 1 : 0.72).toFixed(2) + '"' +
      (isC ? ' stroke="#ffffff" stroke-width="1.4"' : '') + '><title>' + esc(pts[i].id + (pts[i].lineage ? ' 【' + pts[i].lineage + '】' : '') +
        ' · H=' + num(pts[i].H).toFixed(1) + '% · G_eff=' + num(pts[i].Geff).toFixed(2) + ' · S=' + num(pts[i].S).toFixed(2) + ' · F=' + F[i].toFixed(3) + ' 名次 ' + rank[i]) + '</title></circle>'; }
  for (let i = 0; i < N; i++) if (pts[i].lineage) s += '<text x="' + (hx(num(pts[i].H)) + 7).toFixed(1) + '" y="' + (hy(num(pts[i].S)) - 6).toFixed(1) +
    '" font-size="9.5" fill="#ffffff">' + esc((i === shipI ? '★' : '') + pts[i].id) + '</text>';
  s += '<line x1="' + PAD + '" y1="' + (H - PAD - 26) + '" x2="' + (PAD + pw) + '" y2="' + (H - PAD - 26) + '" stroke="#8ea2c0"/>' +
    '<line x1="' + PAD + '" y1="' + (PAD - 10) + '" x2="' + PAD + '" y2="' + (H - PAD - 26) + '" stroke="#8ea2c0"/>';
  for (let k = 0; k <= 4; k++) { const v = hMin + (hMax - hMin) * k / 4, w = sMax * k / 4;
    s += '<text x="' + hx(v).toFixed(1) + '" y="' + (H - PAD - 12) + '" font-size="9" fill="#9fb0cc" text-anchor="middle">' + v.toFixed(0) + '%</text>' +
      '<text x="' + (PAD - 6) + '" y="' + hy(w).toFixed(1) + '" font-size="9" fill="#9fb0cc" text-anchor="end">' + w.toFixed(1) + '</text>'; }
  /* 右栏：F 一维带 */
  const ox = PAD + pw + GAP + 30, band = H - 2 * PAD - 46;
  const fy = i => PAD + 16 + band * (rank[i] - 1) / (N - 1);
  const fx = i => ox + 120 + (pw - 170) * ft(i);
  s += '<text x="' + ox + '" y="' + (PAD - 18) + '" font-size="11" fill="#dce6f5">名次（1 = 最好）× F</text>';
  for (let i = 0; i < N; i++) { const isC = !!pts[i].lineage;
    s += '<circle cx="' + fx(i).toFixed(1) + '" cy="' + (fy(i) + (rnd() - 0.5) * 5).toFixed(1) + '" r="' + (isC ? 5 : 2.6) +
      '" fill="' + (isC ? (SC2[pts[i].seed] || '#e6edf7') : colmap(ft(i))) + '" fill-opacity="' + (isC ? 1 : 0.75).toFixed(2) + '"' + (isC ? ' stroke="#ffffff" stroke-width="1.3"' : '') + '/>'; }
  const mark = new Set(pts.map((p, i) => p.lineage ? i : -1).filter(v => v >= 0));
  [0, 1, 2, N - 3, N - 2, N - 1].forEach(r => { mark.add(order[r][1]); });
  for (const i of mark) s += '<text x="' + (ox + 4) + '" y="' + (fy(i) + 3).toFixed(1) + '" font-size="8.6" fill="' + (pts[i].lineage ? '#ffffff' : '#7f8ea8') +
    '" text-anchor="start">' + esc(rank[i] + ' ' + (i === shipI ? '★' : '') + pts[i].id) + '</text>';
  for (let k = 0; k <= 4; k++) { const r = Math.round(k * (N - 1) / 4);
    s += '<text x="' + (ox - 6) + '" y="' + (fy(r) + 3).toFixed(1) + '" font-size="9" fill="#6d7f9c" text-anchor="end">' + (r + 1) + '</text>'; }
  return s + cb(W - PAD - 40, PAD, H - 2 * PAD - 40, 'F') + '</svg>';
}

/* ===== 图 2：二维地图（力导向）===== */
function map2() {
  const W = 980, H = 700, PAD = 56, CBR = 88;
  const xs = P2.map(p => p[0]), ys = P2.map(p => p[1]);
  const pc = (v, q) => { const a = v.slice().sort((x, y) => x - y); return a[Math.max(0, Math.min(a.length - 1, Math.floor(q * a.length)))]; };
  let x0 = pc(xs, 0.004), x1 = pc(xs, 0.996), y0 = pc(ys, 0.004), y1 = pc(ys, 0.996);
  const sx = v => PAD + (W - 2 * PAD - CBR) * (v - x0) / (x1 - x0), sy = v => H - PAD - (H - 2 * PAD) * (v - y0) / (y1 - y0);
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" font-family="system-ui,sans-serif">' +
    '<rect width="' + W + '" height="' + H + '" fill="#0f1522"/>' +
    title('§E291 二维地图 · 力导向布局（kNN=' + NEIGH + ' · ' + EPOCH + ' 轮）‖ 颜色 = F（深度）· 位置 = 行为相似性') +
    '<text x="14" y="40" fill="#9fb0cc" font-size="10.5">' + esc('判据实测：Spearman(图上距, 14 维行为距) = ' + R2.sp.toFixed(2) + ' · recall@' + NEIGH + ' = ' +
      R2.recall.toFixed(0) + '%（随机地板 ' + RND.recall.toFixed(0) + '%）· 能从位置反推出的行为列 = ' + R2.ex.filter(x => x > 0.1).length + '/' + D) + '</text>' +
    '<text x="14" y="55" fill="#9fb0cc" font-size="10.5">' + esc('白描边大点 = 历代上槽冠军（★=当前线上 Ldemo）· 色相 = 训练 seed 家族 · 这张图不承诺"往某处进化"') + '</text>';
  const shade = hex => { const n = parseInt(hex.slice(1), 16); return 'rgb(' + Math.round(((n >> 16) & 255) * .38) + ',' + Math.round(((n >> 8) & 255) * .38) + ',' + Math.round((n & 255) * .38) + ')'; };
  for (let i = 0; i < N; i++) {
    const isC = !!pts[i].lineage;
    const base = SC2[pts[i].seed] || '#8fa0b8';
    s += '<circle cx="' + sx(Math.max(x0, Math.min(x1, xs[i]))).toFixed(1) + '" cy="' + sy(Math.max(y0, Math.min(y1, ys[i]))).toFixed(1) +
      '" r="' + (isC ? 6 : 3.2) + '" fill="' + (isC ? base : shade(base)) + '" fill-opacity="' + (0.55 + 0.45 * ft(i)).toFixed(2) + '"' +
      (isC ? ' stroke="#ffffff" stroke-width="1.5"' : '') + '><title>' + esc(pts[i].id + (pts[i].lineage ? ' 【' + pts[i].lineage + '】' : '') +
        ' · H=' + num(pts[i].H).toFixed(1) + '% · G_eff=' + num(pts[i].Geff).toFixed(2) + ' · F=' + F[i].toFixed(3) + ' 名次 ' + rank[i] + '/' + N +
        ' · 伤害/局=' + num(pts[i].dmg).toFixed(1) + ' · 回合=' + num(pts[i].rounds).toFixed(1) + ' · 座位极差=' + num(pts[i].seatSpread).toFixed(0) + 'pt') + '</title></circle>';
  }
  for (let i = 0; i < N; i++) if (pts[i].lineage) s += '<text x="' + (sx(Math.max(x0, Math.min(x1, xs[i]))) + 8).toFixed(1) + '" y="' + (sy(Math.max(y0, Math.min(y1, ys[i]))) - 7).toFixed(1) +
    '" font-size="10" fill="#ffffff" font-weight="bold">' + esc((i === shipI ? '★' : '') + pts[i].id) + '</text>';
  s += '<text x="' + (PAD + 4) + '" y="' + (PAD - 8) + '" font-size="9.5" fill="#9fb0cc">↑ 轴 2</text><text x="' + (W - PAD - CBR) + '" y="' + (H - PAD - 6) +
    '" font-size="9.5" fill="#9fb0cc" text-anchor="end">轴 1 →</text>';
  return s + cb(W - PAD - 42, PAD, H - 2 * PAD, 'F（颜色 = 势阱深度）') + '</svg>';
}

/* ===== 图 3：三维（正视图 + 侧视图并排，共用颜色 = F）===== */
function map3() {
  const W = 1180, H = 560, PAD = 52, GAP = 96;
  const pw = (W - 2 * PAD - GAP - 80) / 2;
  const A = [0, 1], B = [0, 2];
  const pc = (v, q) => { const a = v.slice().sort((x, y) => x - y); return a[Math.max(0, Math.min(a.length - 1, Math.floor(q * a.length)))]; };
  const mk = (dims, ox, lab) => {
    const xs = P3.map(p => p[dims[0]]), ys = P3.map(p => p[dims[1]]);
    const x0 = pc(xs, 0.004), x1 = pc(xs, 0.996), y0 = pc(ys, 0.004), y1 = pc(ys, 0.996);
    const sx = v => ox + pw * (v - x0) / (x1 - x0), sy = v => H - PAD - (H - 2 * PAD - 30) * (v - y0) / (y1 - y0);
    let o = '<text x="' + ox + '" y="' + (PAD - 16) + '" font-size="11" fill="#dce6f5">' + esc(lab) + '</text>' +
      '<rect x="' + ox + '" y="' + PAD + '" width="' + pw + '" height="' + (H - 2 * PAD - 30) + '" fill="#131a29" fill-opacity="0.5" stroke="#2c3a52"/>';
    for (let i = 0; i < N; i++) { const isC = !!pts[i].lineage; const base = SC2[pts[i].seed] || '#8fa0b8';
      o += '<circle cx="' + sx(Math.max(x0, Math.min(x1, xs[i]))).toFixed(1) + '" cy="' + sy(Math.max(y0, Math.min(y1, ys[i]))).toFixed(1) +
        '" r="' + (isC ? 5.6 : 2.9) + '" fill="' + (isC ? base : colmap(ft(i))) + '" fill-opacity="0.9"' + (isC ? ' stroke="#ffffff" stroke-width="1.4"' : '') + '/>'; }
    for (let i = 0; i < N; i++) if (pts[i].lineage) o += '<text x="' + (sx(Math.max(x0, Math.min(x1, xs[i]))) + 7).toFixed(1) + '" y="' + (sy(Math.max(y0, Math.min(y1, ys[i]))) - 6).toFixed(1) +
      '" font-size="9.5" fill="#ffffff">' + esc((i === shipI ? '★' : '') + pts[i].id) + '</text>';
    return o; };
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" font-family="system-ui,sans-serif">' +
    '<rect width="' + W + '" height="' + H + '" fill="#0f1522"/>' +
    title('§E291 三维尝试 · 三根空间轴都是行为坐标，颜色 = F（深度）‖ 两视图（轴1-轴2 / 轴1-轴3）') +
    '<text x="14" y="40" fill="#9fb0cc" font-size="10.5">' + esc('第三根轴是"免费"的（深度已经用颜色表达）⇒ 实测能把行为特征的反推数从 ' +
      R2.ex.filter(x => x > 0.1).length + '/14 抬到 ' + R3.ex.filter(x => x > 0.1).length + '/14，recall@' + NEIGH + ' 从 ' + R2.recall.toFixed(0) + '% 到 ' + R3.recall.toFixed(0) + '%') + '</text>' +
    mk(A, PAD, '正视图：轴1 × 轴2') + mk(B, PAD + pw + GAP, '侧视图：轴1 × 轴3（这两张合起来才等于三维）') +
    cb(W - PAD - 40, PAD, H - 2 * PAD - 30, 'F') + '</svg>';
  return s;
}

writeFileSync(join(HERE, 'e287-ladder.svg'), ladder());
writeFileSync(join(HERE, 'e287-map2.svg'), map2());
writeFileSync(join(HERE, 'e287-map3.svg'), map3());
const tbl = ['方法', '维', 'Spearman', 'recall@' + NEIGH, '反推列数(超额>0.1)', '反推 H 的 R²'].join('\t');
writeFileSync(join(HERE, 'e287-figs.html'),
  '<!doctype html><meta charset="utf-8"><title>§E291 一维阶梯 + 二维 + 三维（现测尺）</title>' +
  '<body style="margin:0;background:#0f1522;color:#dce6f5;font-family:system-ui,sans-serif">' +
  '<div style="padding:14px 18px;font-size:13px">§E291 · 尺 = 每枚包现测（考卷 1050 局 · seed 77000 ‖ 镜像自对局 G_eff）‖ ' +
  '三张图共用同一批力导向坐标，只是看它的维度不同</div>' +
  '<div style="padding:0 18px 10px;font-size:12px;color:#9fb0cc">判据表（同一套定义，见 e287-fit.mjs）：<pre style="color:#dce6f5;font-size:12px">' +
  esc([tbl,
    ['力导向', 2, R2.sp.toFixed(3), R2.recall.toFixed(1) + '%', R2.ex.filter(x => x > 0.1).length + '/' + D, R2.r2H.toFixed(2)].join(' ‖ '),
    ['力导向', 3, R3.sp.toFixed(3), R3.recall.toFixed(1) + '%', R3.ex.filter(x => x > 0.1).length + '/' + D, R3.r2H.toFixed(2)].join(' ‖ '),
    ['随机排点（地板）', 2, RND.sp.toFixed(3), RND.recall.toFixed(1) + '%', '—', '—'].join(' ‖ ')].join('\n')) + '</pre></div>' +
  '<div style="padding:0 18px">' + ladder() + '</div>' +
  '<div style="padding:0 18px">' + map2() + '</div>' +
  '<div style="padding:0 18px">' + map3() + '</div>' +
  '<div style="padding:6px 18px 26px;font-size:11px;color:#9fb0cc;max-width:1180px">' +
  esc('读法：一维阶梯回答"谁强谁弱、强在 H 还是广在 S"（零遮挡）；二维地图回答"谁和谁行为相似"（颜色给深度）；' +
      '三维两视图把行为特征的反推数翻倍。三张都**不承诺**"往某个方向进化"—— 那条判据在 §E289 的配对决斗里没能立住。') + '</div></body>');
/* 坐标落盘（给 e287-viewer.mjs 用 ⇒ 交互页与静态图共用**同一批坐标**，不重算、不漂移）。
 * ⚠ §E307 修过一个静默错位：表头写的是字面量数组、值写的是 `COORD.map(...)`，两份清单顺序不同
 *   ⇒ 从第 4 列起 9 个行为列贴错名字（`rounds`↔`zeroRate`、`seatSpread`↔`distinctKeys`、`charges`←`rwDmg`…），
 *   而 `num()` 把缺列变成 NaN、`toFixed` 又把它写成 0，所以**一声不响**。现在表头与值同用一个 `BEH` 数组。 */
const BEH = ['dmg', 'heavy', 'holo', 'rounds', 'drawRate', 'zeroRate', 'seatSpread', 'distinctKeys', 'charges',
  'waste', 'noThreatStance', 'fieldAAtk', 'rwDmg'];
const COORDS_OUT = arg('coords', '') ? (arg('coords').indexOf('/') < 0 ? join(HERE, arg('coords')) : join(ROOT, arg('coords'))) : join(HERE, 'e287-coords.tsv');
writeFileSync(COORDS_OUT,
  ['id', 'lineage', 'seed', 'H', 'S', 'Geff', 'F', 'rank', 'x2', 'y2', 'x3', 'y3', 'z3'].concat(BEH)
    .join('\t') + '\n' +
  pts.map((p, i) => [p.id, p.lineage || '', p.seed || '', num(p.H).toFixed(2), num(p.S).toFixed(4), num(p.Geff).toFixed(3), F[i].toFixed(5), rank[i],
    P2[i][0].toFixed(5), P2[i][1].toFixed(5), P3[i][0].toFixed(5), P3[i][1].toFixed(5), P3[i][2].toFixed(5)].concat(
    BEH.map(c => num(p[c]).toFixed(4))).join('\t')).join('\n') + '\n');
console.log('已写 e287-ladder.svg ‖ e287-map2.svg ‖ e287-map3.svg ‖ e287-figs.html ‖ e287-coords.tsv');
