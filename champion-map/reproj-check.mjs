#!/usr/bin/env node
/* reproj-check.mjs —— §E375：**要不要为新的 16 枚旧冠军重投影整张图**，这台先量代价再动手。
 *
 * 背景：`coords.tsv` 的 x2/y2/x3/y3/z3 出自 `ruler-figs.mjs` 的**带种子力导向**（从 PCA 起步、300 轮）。
 *   动一下点集 = 邻居图与每列的秩都变 ⇒ 整张图重新落位。用户 10-06 的原话是"当心维数低的点会不会过于离群
 *   导致地图可读性降低"，所以这里把两件事分开量：
 *     Q1 那 16 枚是不是离群到会压塌图？
 *     Q2 重投影本身把**已经验收过的** 901 枚推走多远？
 *   四臂并列才答得了 Q2 —— 只跑"加旧包"一臂会把"任何改动都会重画"错记成"旧包太离群"：
 *     A 控制组      = 在册输入原样重跑（必须逐枚复现 coords.tsv，否则 B−A 的差不属于那 16 枚）
 *     B 加旧包      = A + 16 枚旧槽位冠军
 *     C 加库内复制  = A + 16 枚"老点抄一份换 id"（N 同样 901→917，但一点不离群）
 *     D 删库内点    = A − 那 16 枚（连"加"都不是，只是动了一下点集）
 *   另有一条退路：**质心锚定**（coords.tsv 不动，只把新点放到它行为 15 近邻的加权质心上），
 *   自报精度用留一复核量。§E375d 还试过"钉住松弛"（新点受力、老点全钉死）：两头都比质心法差 ⇒ 已弃，不在这里重跑。
 *
 * 复核报警线（拿实测值立线，将来重跑劣于此线就 shout）：
 *   ① 控制组逐枚逐列必须与 coords.tsv 一致 ⇒ 不一致 = 输入或参数漂了，本台全部结论作废（exit 2）
 *   ② 并入后二维 recall@15 不得低于控制组 2pt、Spearman 不得低于 0.05
 *   ③ 新点落在页面视野框（0.5%/99.5% 截尾）外的比例 > 25% ⇒ "离群到顶框"要 shout
 *
 * 用法：node champion-map/reproj-check.mjs [--extra=champion-map/e370-ruler.tsv]
 *                                         [--out=docs/artifacts/e375-out] [--probe=30]
 * ⚠ 只写 `--out=` 里的工作文件，**不碰 champion-map/coords.tsv**（真并入是另一步：整条 attach-* 链要跟着跑）。
 * ⚠ 锚定那一段用的邻居距离是**秩→均匀**的欧氏距，与 ruler-figs 的"秩→正态得分"不是同一把（差一个逐列单调变换）。
 *   这里没有第三份正态得分实现：宁可换一把能一句话说清的尺，也不复制 12 行 Acklam 再让两处各改一半。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const OUTREL = String(arg('out', 'docs/artifacts/e375-out')).replace(/\\/g, '/');
const OUT = join(ROOT, OUTREL);
const EXTRA = String(arg('extra', 'champion-map/e370-ruler.tsv'));
const PROBE = Number(arg('probe', 30));
const BASE = String(arg('base', 'champion-map/ruler-all.tsv'));
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
const tb = l => { const h = l[0].split('\t'); return l.slice(1).map(c => { const o = {}; h.forEach((k, i) => { o[k] = c.split('\t')[i]; }); return o; }); };
const num = v => { const n = Number(v); return isFinite(n) && v !== '' && v != null ? n : NaN; };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.max(0, Math.min(s.length - 1, Math.floor(q * s.length)))]; };
const med = a => pct(a, .5);
const sd = a => { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const COORD = ['dmg', 'heavy', 'holo', 'zeroRate', 'drawRate', 'rounds', 'distinctKeys', 'seatSpread', 'rwDmg', 'charges',
  'waste', 'noThreatStance', 'fieldAAtk', 'fieldARounds'];
const NEIGH = 15, VIEWW = 1600, VIEWH = 650;   /* 页面画布默认尺寸（shot.mjs 的 1600×900 扣掉控制条约 250）*/

const dump = (f, rows) => { const p = join(OUT, f);
  writeFileSync(p, HEAD + '\n' + rows.map(r => COLS.map(c => r[c] === undefined ? '' : r[c]).join('\t')).join('\n') + '\n');
  return OUTREL + '/' + f; };
const baseL = rd(join(ROOT, BASE)), HEAD = baseL[0], COLS = HEAD.split('\t');
const base = tb(baseL);
const ex = tb(rd(join(ROOT, EXTRA)));
if (rd(join(ROOT, EXTRA))[0] !== HEAD) { console.error('⛔ --extra 表头与 ' + BASE + ' 不一致 ⇒ 不许并（列名错位是 §E307 那类静默病）'); process.exit(2); }
console.log('在册输入 ' + BASE + ' = ' + base.length + ' 枚 ‖ --extra ' + EXTRA + ' = ' + ex.length + ' 枚 ‖ 表头逐字一致 ✅');

function figs(ruler, tag) {
  const rel = OUTREL + '/rc-' + tag + '.tsv';
  const log = execFileSync('node', [join(ROOT, 'champion-map', 'ruler-figs.mjs'), '--ruler=' + ruler, '--coords=' + rel],
    { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
  /* ruler-figs 除了 --coords 还固定往自己目录甩四张静态图（champion-map/ 不在 gitignore 里）⇒ 逐臂收进 OUT，
   *   既不脏工作树，也不冒充"我没生成过东西"。*/
  for (const f of ['e287-ladder.svg', 'e287-map2.svg', 'e287-map3.svg', 'e287-figs.html']) {
    const p = join(HERE, f); if (!existsSync(p)) continue;
    try { renameSync(p, join(OUT, 'rc-' + tag + '-' + f)); } catch (e) { console.log('⚠ ' + f + ' 没挪走：' + e.message); } }
  const g = s => { const m = new RegExp(s).exec(log); return m ? Number(m[1]) : NaN; };
  return { R: tb(rd(join(ROOT, rel))),
    sp2: g('二维力导向：Spearman=([\\d.]+)'), rec2: g('二维力导向：Spearman=[\\d.]+ ‖ recall@15=([\\d.]+)%'),
    sp3: g('三维力导向：Spearman=([\\d.]+)'), rec3: g('三维力导向：Spearman=[\\d.]+ ‖ recall@15=([\\d.]+)%') };
}
/* 臂 C/D 动的那 16 枚 = 老库等间隔取样（与"加旧包"同样动 N，但**不离群**）*/
const pick = []; for (let i = 0; pick.length < ex.length && i < base.length; i += Math.floor(base.length / ex.length)) pick.push(base[i]);
const ctrl = pick.map((r, i) => Object.assign({}, r, { id: 'CTRL-' + String(i + 1).padStart(2, '0'), lineage: '' }));
const keep = base.filter(r => pick.indexOf(r) < 0);
const ctrlRel = dump('rc-ctrl16.tsv', ctrl), minusRel = dump('rc-minus16.tsv', keep);

const A = figs(BASE, 'A');
const B = figs(BASE + ',' + EXTRA, 'B');
const C = figs(BASE + ',' + ctrlRel, 'C');
const D = figs(minusRel, 'D');

/* ===== 判据①：控制组必须逐枚复现现役 coords.tsv ===== */
const co = tb(rd(join(ROOT, 'champion-map', 'coords.tsv')));
const MA = {}; for (const r of A.R) MA[r.id] = r;
let bad = 0, miss = 0;
for (const r of co) { const a = MA[r.id]; if (!a) { miss++; continue; }
  for (const c of ['x2', 'y2', 'x3', 'y3', 'z3', 'F']) if (Math.abs(num(a[c]) - num(r[c])) > 5e-6) bad++; }
console.log('\n判据① 控制组逐枚复现 coords.tsv（' + co.length + ' 枚 × 6 个几何列）：不一致 ' + bad + ' ‖ 对不上 ' + miss
  + (bad || miss ? ' ⇒ ⛔ 输入或参数漂了，下面全部作废' : '  ✅'));
if (bad || miss) process.exit(2);

/* ===== 页面那把视野框 ⇒ 数据单位换像素 ===== */
const view = R => { const xa = R.map(r => num(r.x2)), ya = R.map(r => num(r.y2));
  return { x0: pct(xa, .005), x1: pct(xa, .995), y0: pct(ya, .005), y1: pct(ya, .995) }; };
const PV = view(A.R), U = VIEWW / (PV.x1 - PV.x0) * 0.90;
const rk = v => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length); o.forEach((e, k) => { r[e[1]] = k; }); return r; };
const cr = (a, b) => { const x = rk(a), y = rk(b), n = x.length;
  return (n * x.reduce((s, v, i) => s + v * y[i], 0) - x.reduce((s, v) => s + v, 0) * y.reduce((s, v) => s + v, 0))
    / Math.sqrt(((n * x.reduce((s, v) => s + v * v, 0) - x.reduce((s, v) => s + v, 0) ** 2) || 1)
      * ((n * y.reduce((s, v) => s + v * v, 0) - y.reduce((s, v) => s + v, 0) ** 2) || 1)); };
function rndPairs(n, k, seed) { let a = seed >>> 0; const out = [];
  const rr = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < k; i++) { const p = Math.floor(rr() * n), q = Math.floor(rr() * n); if (p !== q) out.push([p, q]); } return out; }
const KA = knnMap(A.R);
function knnMap(R) { const x = R.map(r => num(r.x2)), y = R.map(r => num(r.y2)); const out = {};
  for (let i = 0; i < R.length; i++) { const a = R.map((_, j) => [Math.hypot(x[i] - x[j], y[i] - y[j]), R[j].id])
      .filter(e => e[1] !== R[i].id).sort((p, q) => p[0] - q[0]).slice(0, NEIGH).map(e => e[1]); out[R[i].id] = a; }
  return out; }

console.log('\n四臂并列（位移按控制组视野换成像素；重合率与 ρ 只在**同一批老点之间**算 ⇒ 排除新点占名额）');
console.log('  臂'.padEnd(4) + '枚数'.padEnd(7) + '二维 判据'.padEnd(20) + '三维 判据'.padEnd(14) + '老点位移中位'.padEnd(13) + 'p90'.padEnd(9) + '15近邻重合'.padEnd(11) + '点对距离ρ');
for (const [nm, R] of [['A 控制', A], ['B 加旧包', B], ['C 加库内复制', C], ['D 删 16 枚', D]]) {
  const old = R.R.filter(r => MA[r.id]);
  const d = old.map(r => Math.hypot(num(r.x2) - num(MA[r.id].x2), num(r.y2) - num(MA[r.id].y2)) * U);
  const KB = knnMap(old);
  let jac = 0; for (const r of old) { const s = new Set(KB[r.id]); jac += KA[r.id].filter(v => s.has(v)).length / NEIGH; }
  const PR = rndPairs(old.length, 20000, 5);
  const da = PR.map(([i, j]) => Math.hypot(num(old[i].x2) - num(old[j].x2), num(old[i].y2) - num(old[j].y2)));
  const db = PR.map(([i, j]) => Math.hypot(num(MA[old[i].id].x2) - num(MA[old[j].id].x2), num(MA[old[i].id].y2) - num(MA[old[j].id].y2)));
  console.log('  ' + nm.padEnd(12) + String(R.R.length).padEnd(9) +
    (R.rec2.toFixed(1) + '% ρ' + R.sp2.toFixed(3)).padEnd(22) + (R.rec3.toFixed(1) + '% ρ' + R.sp3.toFixed(3)).padEnd(16) +
    (med(d).toFixed(0) + 'px').padEnd(14) + (pct(d, .9).toFixed(0) + 'px').padEnd(10) +
    (100 * jac / old.length).toFixed(1) + '%'.padStart(6).padEnd(12) + cr(da, db).toFixed(3));
}
{ const PR = rndPairs(A.R.length, 20000, 5);
  const da = PR.map(([i, j]) => Math.hypot(num(A.R[i].x2) - num(A.R[j].x2), num(A.R[i].y2) - num(A.R[j].y2)));
  const db = PR.map(([i, j]) => Math.hypot(PV.x0 + ((i * 0.6180339887) % 1) * (PV.x1 - PV.x0) - (PV.x0 + ((j * 0.6180339887) % 1) * (PV.x1 - PV.x0)),
    PV.y0 + ((i * 0.7548776662) % 1) * (PV.y1 - PV.y0) - (PV.y0 + ((j * 0.7548776662) % 1) * (PV.y1 - PV.y0))));
  console.log('  随机撒点地板：点对距离 ρ = ' + cr(da, db).toFixed(3) + ' ⇒ 臂表里低于这个数就等于"重画 = 打乱"'); }
{ const dr = B.rec2 - A.rec2, ds = B.sp2 - A.sp2;
  console.log('  判据② 并入(B) 相对控制(A) 的二维判据**变化**：recall@15 ' + (dr >= 0 ? '+' : '') + dr.toFixed(1) + 'pt ‖ Spearman ' + (ds >= 0 ? '+' : '') + ds.toFixed(3)
    + ((-dr > 2 || -ds > 0.05) ? ' ⇒ ⚠ 超过报警线' : ' ✅ 未超线（劣化 >2pt 或 >0.05 才报警）')); }

/* ===== Q1 那 16 枚有多离群 ===== */
console.log('\nQ1 ' + ex.length + ' 枚旧包离群到什么程度（sd 一律按**老库**算，让它们自己撑尺 = 自证陷阱）');
{ const mu = {}, s2 = {}; for (const c of COORD) { const v = base.map(o => num(o[c])); mu[c] = v.reduce((s, x) => s + x, 0) / v.length; s2[c] = sd(v) || 1; }
  const z = r => Math.sqrt(COORD.reduce((s, c) => s + ((num(r[c]) - mu[c]) / s2[c]) ** 2, 0));
  /* ⚠ 行为值必须从**尺表**取，不能从 ruler-figs 的产物取：那台只落 13 个行为列（fieldARounds 不进图），
   *   从产物读会拿到 undefined ⇒ num()=NaN ⇒ 整条 σ 距离静默变 NaN（第一版就踩了这一下，一声不响）。*/
  const zl = base.map(z), zn = ex.map(z), zc = ctrl.map(z);
  console.log('  到全库质心的 14 维行为距（σ 数）：老库 中位 ' + med(zl).toFixed(2) + ' / p90 ' + pct(zl, .9).toFixed(2) + ' / 最大 ' + Math.max(...zl).toFixed(2)
    + ' ‖ 旧包 中位 ' + med(zn).toFixed(2) + ' / 最大 ' + Math.max(...zn).toFixed(2) + ' ‖ 库内复制 中位 ' + med(zc).toFixed(2));
  const n16 = B.R.filter(r => !MA[r.id]), inb = n16.filter(r => { const p = view(B.R);
    return num(r.x2) >= p.x0 && num(r.x2) <= p.x1 && num(r.y2) >= p.y0 && num(r.y2) <= p.y1; }).length;
  console.log('  判据③ 落在页面视野框内 ' + inb + '/' + n16.length + (100 * inb / n16.length < 75 ? ' ⇒ ⚠ 顶框的超过 25%' : ' ✅'));
  const F = A.R.map(r => num(r.F)), Fn = n16.map(r => num(r.F));
  console.log('  F（色带/柱高那把深度尺）：老库 ' + Math.min(...F).toFixed(3) + '…' + Math.max(...F).toFixed(3)
    + ' ‖ 旧包 ' + Math.min(...Fn).toFixed(3) + '…' + Math.max(...Fn).toFixed(3)
    + ' ⇒ 破不破老库下沿：' + (Math.min(...Fn) < Math.min(...F) ? '破（色带要重定标）' : '不破')); }

/* ===== 退路：质心锚定的自报精度 ===== */
console.log('\n退路 质心锚定（coords.tsv 一个像素不动，把新点放进行为 15 近邻的加权质心；核 = 秩均匀欧氏距）');
{ const P = base.concat(ex);
  const RANK = COORD.map(c => { const o = P.map((r, i) => [num(r[c]), i]).sort((a, b) => a[0] - b[0]); const out = new Array(P.length);
    for (let k = 0; k < o.length; k++) out[o[k][1]] = (k + 0.5) / P.length; return out; });
  const NEI = P.map((_, i) => P.map((__, j) => { let s = 0; for (let d = 0; d < RANK.length; d++) { const q = RANK[d][i] - RANK[d][j]; s += q * q; }
    return [Math.sqrt(s), j]; }).filter(e => e[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, NEIGH));
  const POS = {}; P.forEach((r, i) => { if (MA[r.id]) POS[i] = [num(MA[r.id].x2), num(MA[r.id].y2)]; });
  const hide = {}; const probe = [];
  for (let i = 0; probe.length < PROBE && i < base.length; i += Math.ceil(base.length / PROBE)) { probe.push(i); hide[i] = 1; }
  function place(i) { let sw = 0, ax = 0, ay = 0;
    for (const [d, j] of NEI[i]) { if (!POS[j] || hide[j]) continue; const w = 1 / (1 + d); sw += w; ax += w * POS[j][0]; ay += w * POS[j][1]; }
    return [ax / sw, ay / sw]; }
  const err = probe.map(i => { const m = place(i); return Math.hypot((m[0] - POS[i][0]) * U, (m[1] - POS[i][1]) * U); });
  const placed = probe.map(i => place(i)[0]), real = probe.map(i => POS[i][0]);
  const allx = base.map(r => num(MA[r.id].x2));
  console.log('  留一探针 ' + probe.length + ' 枚：落点误差 中位 ' + med(err).toFixed(0) + 'px ‖ p90 ' + pct(err, .9).toFixed(0) + 'px ‖ 最大 ' + Math.max(...err).toFixed(0) + 'px');
  console.log('  对照"整图重投影把老点推走"的量级：见上表臂 B 那一行（同一个视野换算）');
  console.log('  ⚠ 结构性偏差：质心是**凸组合** ⇒ 探针落点横轴 sd / 同批真值 sd = ' + (sd(placed) / sd(real)).toFixed(3)
    + '（探针真值 sd ' + sd(real).toFixed(3) + ' ‖ 全库 901 枚 ' + sd(allx).toFixed(3) + '）⇒ 锚定法系统性把点往云心里收，正好低估"离不离群"这一条');
  const PB = {}; for (const r of B.R) PB[r.id] = [num(r.x2), num(r.y2)];
  const bx = base.map((_, k) => POS[k][0]), by = base.map((_, k) => POS[k][1]);
  const rho = [];
  for (let i = base.length; i < P.length; i++) {
    const m = place(i), q = PB[P[i].id]; if (!q) continue;
    const da = base.map((_, k) => Math.hypot(m[0] - bx[k], m[1] - by[k]));
    const db = base.map((r, k) => Math.hypot(q[0] - PB[r.id][0], q[1] - PB[r.id][1]));
    rho.push(cr(da, db)); }
  console.log('  16 枚新点：锚定位置的"离 901 枚距离序" vs 重投影的同一条，ρ 中位 ' + med(rho).toFixed(3) + '（随机地板见上）'); }
