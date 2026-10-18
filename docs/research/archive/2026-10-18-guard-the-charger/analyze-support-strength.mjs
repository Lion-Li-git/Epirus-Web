/* §E647 分析器 · 档 2 强度非劣的配对读数
 * 输入 = `support-strength-E647*.txt`（每行 `ROW pack=… seed=… mode=… --support=N 1st=…`），
 * 输出 = **按 (pack, mode) 分层**的配对差（同 seed 同座位才配对）+ `audit-lib.pairedStats` 的 SE 与 t + 符号计数。
 * 为什么分层：multi 与 long 是两张不同的桌（局长 29 拍 vs 51 拍），跨桌平均会把"桌形"混进"效应"里 ⇒ 每层单独一句。
 * 用法：`node docs/research/archive/2026-10-18-guard-the-charger/analyze-support-strength.mjs <文件1> [文件2 …]`
 * ⚑ 判读规矩（METHODOLOGY 122）：n<2 不许当 SE=0；均值/SE < 2 只许写"方向一致、幅度判不动"。 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const { pairedStats, fmtPaired } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const FILES = process.argv.slice(2).filter(function (f) { return f.indexOf('--') !== 0; });
if (!FILES.length) { console.error('用法: node analyze-support-strength.mjs <E647 文件…>'); process.exit(2); }

const rows = [];
for (const f of FILES) {
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    if (line.indexOf('ROW ') !== 0) continue;
    const seed = Number((line.match(/seed=(\d+)/) || [])[1]);
    const mode = (line.match(/mode=(\w+)/) || [])[1];
    const pack = (line.match(/pack=(\S+)/) || [])[1] || 'v7beadseed-82.bak';
    const k = Number((line.match(/--support=(\d)/) || [])[1]);
    const first = Number((line.match(/1st=([\d.]+)%/) || [])[1]);
    if (!mode || isNaN(seed) || isNaN(first) || isNaN(k)) { console.error('⛔ 解析不了的一行（不许静默丢掉分母）：' + line); process.exit(3); }
    rows.push({ pack, mode, seed, k, first });
  }
}
const layers = {};
/* ⚑ 重复键检查（本班真实事故）：我在旧作业没确认判活的情况下把同一份输出重发了一次，
 *   结果两个作业往同一个文件追加 ⇒ 43 行 / 24 个唯一键。`eval-5p` 同 seed 同参数是**确定性**的，
 *   所以重复行数值一致、可以安全去重；但这件事必须由程序认定，不许我事后"看着一样"就放过：
 *   同键不同值 ⇒ 要么不 deterministic、要么两条命令并非同参 ⇒ 立刻拒，不许挑一条用。 */
const seen = {};
for (const r of rows) {
  const key = r.pack + '|' + r.mode + '|' + r.seed + '|k' + r.k;
  if (seen[key] !== undefined && seen[key] !== r.first) {
    console.error('⛔ 同一个键出现两个不同读数：' + key + ' ⇒ ' + seen[key] + ' ↔ ' + r.first + '（不是重复，是不同值 ⇒ 这批不可用，查两条命令的参数差在哪）');
    process.exit(4);
  }
  seen[key] = r.first;
}
const dup = rows.length - Object.keys(seen).length;
console.log('   （去重：' + rows.length + ' 行 → ' + Object.keys(seen).length + ' 个唯一键，重复 ' + dup + ' 行且**逐值相同**' + (dup ? ' ⇒ 典型原因是同一个批被并发跑了两遍，见本文件头注' : '') + '）');
for (const r of rows) {
  const key = r.pack + ' · ' + r.mode;
  layers[key] = layers[key] || {};
  layers[key][r.seed] = layers[key][r.seed] || {};
  layers[key][r.seed][r.k] = r.first;
}

let cells = 0, badCells = 0;
console.log('# §E647 配对读数（同 pack 同 mode 内，按 seed 配对；单位 pt = 1st 率的百分点）');
for (const key of Object.keys(layers).sort()) {
  const ds = [], pos = [];
  for (const seed of Object.keys(layers[key])) {
    const c = layers[key][seed];
    if (c[0] === undefined || c[2] === undefined) { console.error('  ⛔ ' + key + ' seed=' + seed + ' 缺一档 ⇒ 该 seed 不进配对（分母减一）'); badCells++; continue; }
    ds.push(c[2] - c[0]); pos.push(seed + ':' + (c[2] - c[0] >= 0 ? '+' : '−'));
  }
  cells += ds.length;
  const st = pairedStats(ds);
  console.log('\n## ' + key + ' ‖ 配对 n=' + ds.length);
  console.log('   逐对差：' + ds.map(function (d) { return (d >= 0 ? '+' : '') + d.toFixed(1); }).join(' ‖ ') + '   （' + pos.join(' ') + '）');
  console.log('   ' + fmtPaired(key + ' 档2−档0', ds));   /* 签名是 (label, diffs, unit)，不是 (st) —— 传错会印成 [object Object] */
  if (st.se !== null) {
    const q = function (p) { const s = ds.slice().sort(function (a, b) { return a - b; }); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };
    console.log('   分布（ds<2 只报中位，分位数是装饰）：中位 ' + q(0.5).toFixed(2) + 'pt' + (ds.length >= 5 ? ' ‖ 最小 ' + q(0) + ' ‖ 最大 ' + q(1) : ''));
  }
}
console.log('\n合计配对格 ' + cells + ' ‖ 缺档 ' + badCells + ' ‖ 起点数（pack）= ' + new Set(rows.map(r => r.pack)).size + '（**普适性要 ≥2 个独立起点**）');
