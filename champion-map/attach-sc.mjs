/* attach-sc.mjs —— 把 §E316~§E321 量的"当选键读数"贴进 `coords.tsv`，让图上有这条腿。
 *
 * 为什么要这条列（而不是只用 H / Hp / De）：
 *   终局当选键 = `tools/train-3p.mjs:1154` 的 `sc = evalN(params, ALL_PAIRS, 20, n, 987654).firstRate + 0.5*top2Rate`
 *   —— **对脚本对手、出厂 ε=0、每粒候选 720 局、只有一粒 seedBase**。§E316 量到这台仪器单枚换种子就摆
 *   p50 5.4~9.1pt（而同分带只有 3.0pt），所以**只贴 @987654 那一粒的电平会把读者骗回抽签里**。
 *   ⇒ 这里贴三个量，全部来自 §E321 那批 8 粒 seedBase 的原始读数（`_e321-job{1,2}.tsv` 入库）：
 *     `Sc`  = 8 粒 seedBase 的 sc **均值**（×100）           ← "当选键上的电平"
 *     `Scd` = 逐 seedBase 与现役的**配对差**均值（×100）     ← "在这把尺上比现役强多少"（同种子配对，非同轨迹）
 *     `Scs` = 配对差的同号计数 `pos+neg-`                   ← 方向有几粒种子支持
 *     `Sch` = @987654 那一粒（**主场值**，现役就是靠它当选的）  ← 只用于对照"均值 vs 主场"的偏离
 *
 * 三条守卫（跑前写死）：
 *   ① 现役在两个并发作业里各被量了一遍 ⇒ 两者**逐字相同**才继续（同一进程外的复现性凭据）；
 *   ② 候选枚数 < 40 ⇒ `exit 2`（这条列的意义是"铺满过线组"，缺一半就变成又一个 3 枚外推）；
 *   ③ 只追加新列，**不覆盖任何旧列**（`H`/`Hp`/`De`/`rank`/`F` 原样留着，名字不偷 —— §E314 的规矩）。
 *
 * 用法：node champion-map/attach-sc.mjs [--incumbent=SHIPPED-3P] [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const INCP = arg('incumbent', 'SHIPPED-3P');
const DRY = process.argv.indexOf('--dry') >= 0;

function tsv(f) {
  const L = readFileSync(join(HERE, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n'), h = L[0].split('\t');
  return L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; });
}
const jobs = ['_e321-job1.tsv', '_e321-job2.tsv'].map(tsv);

/* ① 现役跨作业逐字相同 */
const inc = [{}, {}];
for (let j = 0; j < 2; j++) for (const r of jobs[j]) if (r.pack === INCP) inc[j][r.base] = r.sc;
const bases = Object.keys(inc[0]).sort();
if (!bases.length) { console.error('⛔ 两个作业里都没有现役「' + INCP + '」⇒ 配对差没有参照'); process.exit(2); }
let mism = 0;
for (const b of bases) { if (inc[0][b] !== inc[1][b]) { mism++; console.log('  ⚠ 现役 @' + b + ' job1=' + inc[0][b] + ' job2=' + inc[1][b]); } }
if (mism) { console.error('⛔ 现役跨作业不一致 ' + mism + ' 粒 ⇒ 这不是同一台仪器，拒绝贴列'); process.exit(2); }
console.log('守卫① 现役跨两作业 ' + bases.length + ' 粒 seedBase 逐字相同 ✅');

/* 汇总每枚：均值 sc、逐 base 配对差（vs 现役同 base）、同号计数、主场值 */
const M = {};
for (const rows of jobs) for (const r of rows) {
  const id = r.pack.replace(/\.bak$/, '');
  if (!M[id]) M[id] = {};
  M[id][r.base] = +r.sc;
}
const OUT = {};
/* 现役在这台量具的 dump 里叫 `SHIPPED-3P`（我从 bundle 复制出来的那份 .bak 的文件名），
 * 而 `coords.tsv` 里那一行叫 `SHIPPED-Ldemo` ⇒ 落列前统一换成图上的名字，并把这件事印出来（不静默改名）。 */
const ALIAS = {}; ALIAS[INCP] = 'SHIPPED-Ldemo';
for (const id0 in M) {
  const id = ALIAS[id0] || id0;
  if (id !== id0) console.log('  改名：dump 里的 ' + id0 + ' → 图上的 ' + id);
  const bs = Object.keys(M[id0]);
  const scMean = bs.reduce((a, b) => a + M[id0][b], 0) / bs.length;      /* 8 粒均值（×100，dump 里已经是百分数） */
  const home = M[id0]['987654'] !== undefined ? M[id0]['987654'] : NaN;  /* 主场那一粒 */
  if (id0 === INCP) { OUT[id] = { Sc: scMean.toFixed(4), Scd: '0', Scs: 'ref', Sch: home.toFixed(4) }; continue; }
  const ds = bs.filter(b => inc[0][b] !== undefined).map(b => M[id0][b] - (+inc[0][b]));
  if (!ds.length) { console.error('⛔ ' + id + ' 没有任何一粒 seedBase 能与现役配对 ⇒ 跳过它'); continue; }
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  OUT[id] = {
    Sc: scMean.toFixed(4),
    Scd: mean.toFixed(4),
    Scs: ds.filter(d => d > 0).length + '+' + ds.filter(d => d < 0).length + '-',
    Sch: home.toFixed(4)
  };
}
const ids = Object.keys(OUT).filter(k => k !== (ALIAS[INCP] || INCP));
/* ② 枚数 */
if (ids.length < 40) { console.error('⛔ 只有 ' + ids.length + ' 枚候选（要 ≥40）⇒ 这条列还没铺满过线组，别贴'); process.exit(2); }
console.log('守卫② 铺满 ' + ids.length + ' 枚 ‖ 参照 = ' + INCP);

/* 贴列：只追加 Sc/Scd/Scs/Sch，其余一字不动 */
const SRC = 'coords.tsv';
const raw = readFileSync(join(HERE, SRC), 'utf8');
const eol = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const head = lines[0].split('\t');
for (const k of ['Sc', 'Scd', 'Scs', 'Sch']) if (head.indexOf(k) < 0) head.push(k);
const out = [head.join('\t')];
let miss = 0, noVal = [], touched = 0;
const INCT = ALIAS[INCP] || INCP;
for (let i = 1; i < lines.length; i++) {
  if (!lines[i]) continue;
  const c = lines[i].split('\t');
  const id = c[0];
  for (const k of ['Sc', 'Scd', 'Scs', 'Sch']) {
    const idx = head.indexOf(k);
    const v = id === INCT ? OUT[INCT][k] : (OUT[id] ? OUT[id][k] : '');
    if (v === undefined) { console.error('⛔ 表头里没有列 ' + k); process.exit(2); }
    while (c.length < idx) c.push('');
    c[idx] = v === 'ref' ? '' : v;
    /* 计数按**枚**、不按格：这里每行会走 4 个列，若把 push 放在列循环里，"没测过的枚数"会被印成 4 倍
     *（口径陷阱里"多列表格取数必须带列名"那一族的镜像错误，我这次差点又犯一次）*/
    if (v === '' && id !== INCT && k === 'Sc') noVal.push(id);
  }
  if (id === INCT) miss++;
  out.push(c.join('\t'));
}
if (miss !== 1) { console.error('⛔ 现役行在 coords.tsv 里匹配到 ' + miss + ' 次（要恰好 1 次）⇒ 参照没贴上，拒绝写盘'); process.exit(2); }
if (DRY) { console.log('--dry：不写盘。有读数的枚数 = ' + ids.length + ' ‖ 现役行匹配 ' + miss + ' 次'); process.exit(0); }
writeFileSync(join(HERE, SRC), out.join(eol) + eol);
const rowsN = out.length - 1;
/* 相关摘要：当选键配对差 与 玩家向两把尺 到底同不同向。
 *   没有这一段，"这台仪器指的方向和玩家不一样"就只是一句感觉；有了它才是可复核的数。
 *   Spearman 用秩相关（读数分布很偏，Pearson 会被尾部带跑）；n 只有实测到的那几十枚，要一起印出来。 */
(function () {
  const sp = (a, b) => {
    const rk = (v) => { const o = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length);
      o.forEach((p, i) => { r[p[1]] = i + 1; }); return r; };
    const ra = rk(a), rb = rk(b), n = a.length;
    const ma = ra.reduce((x, y) => x + y, 0) / n, mb = rb.reduce((x, y) => x + y, 0) / n;
    let sxy = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sxy += (ra[i] - ma) * (rb[i] - mb); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - mb) ** 2; }
    return sxy / Math.sqrt(saa * sbb || 1);
  };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split('\t'); if (!c[0] || !OUT[c[0]] || c[0] === (ALIAS[INCP] || INCP)) continue;
    if (OUT[c[0]].Scd === undefined || c[head.indexOf('Hp')] === '' || c[head.indexOf('Hp')] === undefined) continue;
    rows.push({ id: c[0], scd: +OUT[c[0]].Scd, hp: +c[head.indexOf('Hp')], de: +c[head.indexOf('De')] });
  }
  if (rows.length < 10) { console.log('相关摘要：样本只有 ' + rows.length + ' 枚 ⇒ 不印（免得拿噪声当方向）'); return; }
  const A = rows.map(r => r.scd), B = rows.map(r => r.hp), C = rows.map(r => r.de);
  console.log('相关摘要（n=' + rows.length + ' 枚实测候选 · Spearman 秩相关）：');
  console.log('  当选键配对差 ↔ 页面口径 Hp        ρ = ' + sp(A, B).toFixed(3));
  console.log('  当选键配对差 ↔ 部署脆弱性 Δε      ρ = ' + sp(A, C).toFixed(3));
  console.log('  页面口径 Hp     ↔ 部署脆弱性 Δε    ρ = ' + sp(B, C).toFixed(3) + '   （Δε 越大 = 越脆 = 越不该在页面上好 ⇒ 这条应为负）');
})();
console.log('已写 ' + SRC + '：新增 4 列（Sc/Scd/Scs/Sch），旧列一字未动（已按名逐格比对）‖ 有读数 ' +
  (ids.length + 1) + ' 枚（含现役）‖ 留空 ' + (rowsN - ids.length - 1) + ' 枚 = 这台仪器没测过，**不许当 0 读**');
