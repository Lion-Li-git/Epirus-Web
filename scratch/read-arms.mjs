/* 读数汇总器（第十四段专用）：**所有数字都从原件日志里读**，不许我手抄。
 * 用法：node scratch/read-arms.mjs          ⇒ 列今夜全部臂（R / AB-pre / N / V 波 A1x / B1x）
 *      node scratch/read-arms.mjs --only=A  ⇒ 只列 V 波 A 批
 * 输入原件：scratch/<arm>.log（rankfit） ‖ scratch/P-<arm>-t0.001.log（profile2）——两者都可能是 PowerShell 的 UTF-16LE。
 * 出处口径：Δ夺1 = profile2 的"Δ夺1( vs 随机)"；线 = 同行"合并 SE ≈ x ⇒ |Δ| < y 只能写分不开（本轮过线/不过线）；
 *           组内读数 = rankfit 的"当选粒 ‖ **留出**"那一行；中位候选数 = rankfit 末行"每组成员候选数中位 N"。 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
const DIR = 'D:/code/Epirus-Web/scratch/';
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';

function txt(f) {
  const b = readFileSync(DIR + f);
  if (b[0] === 0xFF && b[1] === 0xFE) return b.toString('utf16le');
  return b.toString('utf8');
}
function lines(f) { return txt(f).split(/\r?\n/).filter((x) => x.trim()); }
const num = (s, re) => { const m = s.match(re); return m ? Number(m[1]) : NaN; };

/* 臂名 → rankfit 原件 / profile2 原件 */
const ARMS = [
  ['AB-pre', 'ABpre.log', 'P-ABpre-t0.001.log', 'v7 蒸馏', '**修好前**（单变量对照）'],
  ['R1', 'R1.log', 'P-R1-t0.001.log', 'v7 蒸馏', '修好后'],
  ['R8', 'R8.log', 'P-R8-t0.001.log', 'v7 蒸馏', '修好后'],
  ['R9', 'R9.log', 'P-R9-t0.001.log', 'v7 蒸馏', '修好后'],
];
for (const s of [10, 11, 12, 13, 14]) ARMS.push(['A' + s, 'A' + s + '.log', 'P-A' + s + '-t0.001.log', 'v7 蒸馏', '修好后 · V 波']);
for (const s of [7]) ARMS.push(['N1', 'N1.log', 'P-N1-fx-S1-t0.001.log', 'rollout 赢率', '§E824 夹具']);
for (const s of [8, 9, 10, 11, 12]) ARMS.push(['B' + s, 'B' + s + '.log', 'P-B' + s + '-t0.001.log', 'rollout 赢率', '§E824 夹具 · V 波']);
ARMS.push(['N2', 'N2.log', 'P-N2-fx-S1o-t0.001.log', 'rollout 赢率', '§E824 夹具 ‖ **S1o 档（对照粒不同，不并排）**']);

const rows = [];
for (const [name, fitF, profF, cur, note] of ARMS) {
  if (only && !name.startsWith(only)) continue;
  if (!existsSync(DIR + profF)) continue;
  const L = lines(profF);
  const agg = L.find((l) => /汇总 16 格/.test(l)) || '';
  const gate = L.find((l) => /本轮/.test(l)) || '';
  const r = {
    name, cur, note,
    win: num(agg, /夺1 ([\d.]+)% vs/), rand: num(agg, /vs 随机 ([\d.]+)%/), ref: num(agg, /vs 参照 ([\d.]+)%/),
    dWin: num(agg, /Δ夺1\( vs 随机\) (-?[\d.]+)pt/),
    se: num(gate, /合并 SE ≈ ([\d.]+)pt/), line: /不过线/.test(gate) ? '分不开' : (/过线/.test(gate) ? (num(agg, /Δ夺1\( vs 随机\) (-?[\d.]+)pt/) > 0 ? '过线(正)' : '过线(负)') : '?'),
  };
  if (existsSync(DIR + fitF)) {
    const F = lines(fitF);
    const ho = F.find((l) => /当选粒 ‖ \*\*留出\*\*/.test(l)) || '';
    const med = F.find((l) => /每组成员候选数中位/.test(l)) || '';
    const hdr = F.find((l) => /货币=/.test(l)) || '';
    r.top1 = num(ho, /top-1=([\d.]+)%/); r.hitVal = num(ho, /同分 ([\d.]+)%/); r.pair = num(ho, /配对序=([\d.]+)%/); r.ce = num(ho, /CE=([\d.]+)/);
    r.med = num(med, /中位 (\d+)/); r.drops = num(hdr, /被丢掉的动作候选 (\d+) 枚/);
  }
  rows.push(r);
}
console.log('| 臂 | 货币 / 条件 | Δ夺1 vs 随机起点 | SE | 判 | 夺1%（随机 %、参照 %） | 留出 top-1（同分） | 配对序 | CE | 中位候选 | 标签面掉枚 |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of rows) {
  const f = (v, d) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  console.log('| ' + r.name + ' | ' + r.cur + ' ‖ ' + r.note + ' | **' + f(r.dWin, 2) + 'pt** | ' + f(r.se, 2) + ' | ' + r.line
    + ' | ' + f(r.win, 1) + '（' + f(r.rand, 1) + '、' + f(r.ref, 1) + '） | ' + f(r.top1, 1) + '（' + f(r.hitVal, 1) + '） | ' + f(r.pair, 1)
    + ' | ' + f(r.ce, 3) + ' | ' + (Number.isFinite(r.med) ? r.med : '—') + ' | ' + (Number.isFinite(r.drops) ? r.drops : '—') + ' |');
}
/* 按货币分组：均值/标准差/中位（种子分布才是判据，单枚不是） */
const by = {};
for (const r of rows) if (Number.isFinite(r.dWin)) (by[r.cur + ' ‖ ' + r.note] = by[r.cur + ' ‖ ' + r.note] || []).push(r.dWin);
console.log('\n**种子分布**（Δ夺1）：');
for (const k in by) {
  const v = by[k].slice().sort((a, b) => a - b);
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1)) : NaN;
  const med = v[Math.floor(v.length / 2)];
  console.log('- ' + k + ' ‖ n=' + v.length + ' ‖ 均值 ' + m.toFixed(2) + 'pt ‖ 中位 ' + med.toFixed(2) + ' ‖ 种子间 SD ' + sd.toFixed(2)
    + ' ‖ 均值的 SE ' + (sd / Math.sqrt(v.length)).toFixed(2) + ' ‖ 逐枚 [' + v.map((x) => x.toFixed(1)).join(' ') + ']');
}
/* 合并口径：蒸馏"修好后"= R1/R8/R9 + A10–A14（n=8）‖ rollout S1 = N1 + B8–B12（n=6）
 *   ——分开两组是必要的，因为上面那行"V 波"只数了 A/B 各 5 枚，会把同一货币的 8 枚种子读成 5 枚。 */
const COMBO = {
  'v7 蒸馏 ‖ 修好后（R1/R8/R9 + A10–A14，n=8）': ['R1', 'R8', 'R9', 'A10', 'A11', 'A12', 'A13', 'A14'],
  'rollout 赢率 ‖ §E824 夹具 S1 档（N1 + B8–B12，n=6）': ['N1', 'B8', 'B9', 'B10', 'B11', 'B12'],
};
console.log('\n**合并两组（今夜最后一次的口径）**：');
for (const lab in COMBO) {
  const v = COMBO[lab].map((n) => (rows.filter((r) => r.name === n)[0] || {}).dWin).filter((x) => Number.isFinite(x));
  if (!v.length) { console.log('- ' + lab + ' ‖ 一枚都没落盘'); continue; }
  v.sort((a, b) => a - b);
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1)) : NaN;
  console.log('- ' + lab + ' ‖ n=' + v.length + ' ‖ 均值 ' + m.toFixed(2) + 'pt ‖ 中位 ' + v[Math.floor(v.length / 2)].toFixed(2)
    + ' ‖ 种子间 SD ' + sd.toFixed(2) + ' ‖ 均值的 SE ' + (sd / Math.sqrt(v.length)).toFixed(2)
    + ' ‖ 95% 带 ≈ [' + (m - 2 * sd / Math.sqrt(v.length)).toFixed(1) + ', ' + (m + 2 * sd / Math.sqrt(v.length)).toFixed(1) + ']'
    + ' ‖ 逐枚 [' + v.map((x) => x.toFixed(1)).join(' ') + ']');
}
/* 逐种子配对（只在两批共用同一组 seed 时才有意义） */
const get = (n) => rows.filter((r) => r.name === n)[0];
const pairs = [['R8', 'B8'], ['R9', 'B9'], ['A10', 'B10'], ['A11', 'B11'], ['A12', 'B12']];
const diffs = pairs.map(([a, b]) => [a + '−' + b, get(a), get(b)]).filter(([, a, b]) => a && b && Number.isFinite(a.dWin) && Number.isFinite(b.dWin));
if (diffs.length) {
  console.log('\n**逐种子配对**（同起点只差货币 ⇒ 把"起点"这一项消掉）：');
  for (const [lab, a, b] of diffs) console.log('- ' + lab + ' = ' + (a.dWin - b.dWin).toFixed(2) + 'pt（' + a.dWin.toFixed(2) + ' ‖ ' + b.dWin.toFixed(2) + '）');
  const ds = diffs.map(([, a, b]) => a.dWin - b.dWin);
  const m = ds.reduce((x, y) => x + y, 0) / ds.length;
  const sd = ds.length > 1 ? Math.sqrt(ds.reduce((x, y) => x + (y - m) * (y - m), 0) / (ds.length - 1)) : NaN;
  console.log('- 配对差均值 ' + m.toFixed(2) + 'pt ‖ n=' + ds.length + ' ‖ SD ' + sd.toFixed(2) + ' ‖ SE ' + (sd / Math.sqrt(ds.length)).toFixed(2));
}
