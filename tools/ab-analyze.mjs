/* 多 seed 配对 A/B 的分析器（把 runner 日志里的"逐臂读数"块算成配对统计）
 *
 * 用法: node tools/ab-analyze.mjs <runner日志> [臂名A] [臂名B]
 *   默认 A=p12 B=p13（本项目的"12 对手 vs 13 对手"实验）。
 *
 * 为什么单独成工具：
 *   · 会话里已经三次因为"n=1 就下结论"出错（v1.3.12 收回 WR_TOL、v1.4.1 轮询归因、v1.4.9 想换冠军），
 *     所以把"逐 seed 差分 + 均值/sd/符号/t"固化成脚本，避免又靠眼睛看均值。
 *   · 路径坑：node 在 Windows 上把 `/tmp/x` 解析成 `D:\tmp\x`（不是 Git Bash 的
 *     `C:\Users\<user>\AppData\Local\Temp`）⇒ 本工具**只接受显式传入的路径**，
 *     传 /tmp 下的文件请用 `$(cygpath -w /tmp/xxx)`。
 */
import { readFileSync } from 'node:fs';

const ARGV = process.argv.slice(2);
const path = ARGV[0];
if (!path) { console.error('用法: node tools/ab-analyze.mjs <runner日志> [臂A=p12] [臂B=p13]'); process.exit(1); }
const A = ARGV[1] || 'p12';
const B = ARGV[2] || 'p13';

const lines = readFileSync(path, 'utf8').split('\n');
const rows = [];
for (const l of lines) {
  /* 形如: "  31     p12   0.3863    1st=37.2% ... top2=57.9% 1st=100.0%" */
  const m = /^\s+(\d+)\s+(\S+)\s+([\d.]+)\s+1st=([\d.]+)%.*top2=([\d.]+)%.*\s1st=([\d.]+)%\s*$/.exec(l);
  if (m) rows.push({ seed: +m[1], pool: m[2], self: +m[3], std: +m[4], top2: +m[5], wall: +m[6] });
}
if (!rows.length) { console.error('没解析到"逐臂读数"块 —— 实验可能还没跑完。'); process.exit(1); }
const get = (s, p) => rows.find(r => r.seed === s && r.pool === p);
const seeds = [...new Set(rows.map(r => r.seed))].sort();
const pairs = seeds.filter(s => get(s, A) && get(s, B));
if (pairs.length < 2) { console.error('配对数不足（' + pairs.length + '），无法做配对统计。'); process.exit(1); }

const metrics = [
  ['训练自评(×100)', r => r.self * 100],
  ['标准考卷 1st', r => r.std],
  ['反弹墙 1st', r => r.wall]
];
const stat = f => {
  const d = pairs.map(s => f(get(s, B)) - f(get(s, A)));
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (d.length - 1));
  const se = sd / Math.sqrt(d.length);
  const t = se > 0 ? mean / se : 0;
  /* 符号检验（双侧）的粗略临界：n=6 时 6/6 或 0/6 才 p<0.05 */
  return { d, mean, sd, se, t, pos: d.filter(x => x > 0).length, neg: d.filter(x => x < 0).length, n: d.length };
};

console.log('\n=== 配对逐 seed 差分（' + B + ' − ' + A + '）===');
console.log('  seed  |  自评Δ   | 标准考卷Δ | 反弹墙Δ  |  (' + A + ' → ' + B + ')');
for (const s of pairs) {
  const a = get(s, A), b = get(s, B);
  console.log('  ' + String(s).padEnd(6) + '| ' + ((b.self - a.self) * 100).toFixed(2).padStart(7) + '  | ' +
    (b.std - a.std).toFixed(1).padStart(8) + 'pt | ' + (b.wall - a.wall).toFixed(1).padStart(6) + 'pt |  ' +
    '标准 ' + a.std.toFixed(1) + '→' + b.std.toFixed(1) + ' / 墙 ' + a.wall.toFixed(1) + '→' + b.wall.toFixed(1));
}
console.log('\n=== 配对统计（n=' + pairs.length + '）===');
for (const [nm, f] of metrics) {
  const s = stat(f);
  console.log('  ' + nm.padEnd(14) + ' 均值Δ=' + (s.mean >= 0 ? '+' : '') + s.mean.toFixed(2) +
    '  sd=' + s.sd.toFixed(2) + '  se=' + s.se.toFixed(2) + '  t=' + s.t.toFixed(2) +
    '  符号 ' + s.pos + '正/' + s.neg + '负   ' +
    (Math.abs(s.t) >= 2.57 ? '（p<0.05 显著）' : Math.abs(s.t) >= 1.48 ? '（p<0.2 边缘）' : '（不显著）'));
}
const avg = (p, f) => { const a = pairs.map(s => f(get(s, p))); return a.reduce((x, y) => x + y, 0) / a.length; };
console.log('\n=== 两臂平均 ===');
for (const [nm, f] of metrics) {
  console.log('  ' + nm.padEnd(14) + '  ' + A + '=' + avg(A, f).toFixed(2) + '   ' + B + '=' + avg(B, f).toFixed(2));
}
const spread = (p, f) => { const a = pairs.map(s => f(get(s, p))); return Math.max(...a) - Math.min(...a); };
console.log('\n=== 单跑极差（判"n=1 能不能读"的尺子）===');
for (const [nm, f] of metrics) {
  console.log('  ' + nm.padEnd(14) + '  ' + A + ' 极差=' + spread(A, f).toFixed(1) + '   ' + B + ' 极差=' + spread(B, f).toFixed(1));
}
