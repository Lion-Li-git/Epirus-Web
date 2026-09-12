/* Epirus 「风格考卷」配对汇总（v1.5.2）
 *
 * 用法：node tools/style-exam-cmp.mjs <目录> [armA=ms2-p12] [armB=mix]
 *   读目录里所有 `se-<arm>-<seed>.json`（tools/style-exam.mjs 的 --json 产物），
 *   按 seed 配对，逐场输出：两臂均值 / 均值Δ / sd / t / 符号（几正几负）。
 *
 * 为什么单独一个工具：`docs/artifacts/ring2-run*.log` 那套（ab-analyze）是给 eval-5p 的
 * 单指标配对用的；风格考卷有**多个场**（每风格一场 + 混合场 + 脚本对照场），
 * 需要的是"每场各自配对"——所以口径与输出格式对齐 ab-analyze，但按场分组。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const DIR = ARGV[0] || 'docs/artifacts';
const ARM_A = ARGV[1] || 'ms2-p12';
const ARM_B = ARGV[2] || 'mix';

function load(arm) {
  const out = new Map();
  for (const f of readdirSync(DIR)) {
    const m = /^se-(.+)-(\d+)\.json$/.exec(f);
    if (!m || m[1] !== arm) continue;
    try {
      const d = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      out.set(Number(m[2]), d);
    } catch (e) { /* 忽略坏文件 */ }
  }
  return out;
}
const A = load(ARM_A), B = load(ARM_B);
if (!A.size || !B.size) {
  console.error('缺 JSON：' + ARM_A + ' 有 ' + A.size + ' 份，' + ARM_B + ' 有 ' + B.size + ' 份（目录 ' + DIR + '）');
  process.exit(1);
}
const seeds = Array.from(A.keys()).filter(function (s) { return B.has(s); }).sort(function (x, y) { return x - y; });
if (!seeds.length) { console.error('两臂没有共同 seed'); process.exit(1); }

function mean(xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; }
function sd(xs) { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (xs.length - 1)); }

const labels = A.get(seeds[0]).rows.map(function (r) { return r.label; });
console.log('=== 风格考卷配对对比（' + ARM_B + ' − ' + ARM_A + '，n=' + seeds.length + ' 个 seed：' + seeds.join(',') + '）===');
console.log('  ' + (A.get(seeds[0]).label || ARM_A) + '   vs   ' + (B.get(seeds[0]).label || ARM_B));
console.log('');
console.log('  场                        ' + ARM_A.padStart(9) + '  ' + ARM_B.padStart(9) + '   均值Δ      sd      t    符号');
for (const lb of labels) {
  const va = [], vb = [];
  for (const s of seeds) {
    const ra = A.get(s).rows.find(function (r) { return r.label === lb; });
    const rb = B.get(s).rows.find(function (r) { return r.label === lb; });
    if (!ra || !rb) continue;
    va.push(ra.firstRate * 100); vb.push(rb.firstRate * 100);
  }
  if (!va.length) continue;
  const d = vb.map(function (v, i) { return v - va[i]; });
  const md = mean(d), sdd = sd(d), se = sdd / Math.sqrt(d.length), t = se ? md / se : 0;
  const pos = d.filter(function (x) { return x > 0.05; }).length, neg = d.filter(function (x) { return x < -0.05; }).length;
  console.log('  ' + lb.padEnd(22) + mean(va).toFixed(1).padStart(9) + '%' + mean(vb).toFixed(1).padStart(9) + '%' +
    (md >= 0 ? '+' : '') + md.toFixed(1).padStart(8) + sdd.toFixed(1).padStart(8) + t.toFixed(2).padStart(7) +
    '   ' + pos + '正/' + neg + '负');
}
/* 汇总：风格场平均（不含脚本对照场）+ 混合场 */
function fieldMean(d, dropScript) {
  return mean(d.rows.filter(function (r) { return !dropScript || r.label !== '脚本对照场'; }).map(function (r) { return r.firstRate * 100; }));
}
const sa = [], sb = [], ma = [], mb = [];
for (const s of seeds) {
  sa.push(fieldMean(A.get(s), true)); sb.push(fieldMean(B.get(s), true));
  const ra = A.get(s).rows.find(function (r) { return r.label === '混合风格场'; });
  const rb = B.get(s).rows.find(function (r) { return r.label === '混合风格场'; });
  ma.push(ra.firstRate * 100); mb.push(rb.firstRate * 100);
}
function pairLine(va, vb, label) {
  const d = vb.map(function (v, i) { return v - va[i]; });
  const md = mean(d), sdd = sd(d), se = sdd / Math.sqrt(d.length), t = se ? md / se : 0;
  const pos = d.filter(function (x) { return x > 0.05; }).length, neg = d.filter(function (x) { return x < -0.05; }).length;
  console.log('  ' + label.padEnd(22) + mean(va).toFixed(1).padStart(9) + '%' + mean(vb).toFixed(1).padStart(9) + '%' +
    (md > 0 ? '+' : '') + md.toFixed(1).padStart(8) + sdd.toFixed(1).padStart(8) + t.toFixed(2).padStart(7) +
    '   ' + pos + '正/' + neg + '负');
}
console.log('');
console.log('  —— 汇总 ——');
pairLine(sa, sb, '风格场平均(6场)');
pairLine(ma, mb, '混合风格场');
const ka = [], kb = [];
for (const s of seeds) {
  ka.push(A.get(s).rows.find(function (r) { return r.label === '脚本对照场'; }).firstRate * 100);
  kb.push(B.get(s).rows.find(function (r) { return r.label === '脚本对照场'; }).firstRate * 100);
}
pairLine(ka, kb, '脚本对照场');
