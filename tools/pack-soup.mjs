#!/usr/bin/env node
/* pack-soup.mjs —— n 路权重线性融合 + wid 试金（2026-11-20 深夜 · V3S2 重建战中的验证件升格）
 *
 * 为什么要有：pack-fuse.mjs 只做两路；谱系里大量融合产物是 n 路 soup（V3S2 六路 0.25/0.20/0.15/0.15/0.15/0.10）。
 *   本机是把「按 recipe 加权求和 + ×1e6 舍入 + widOf 对目标」固化成单一工具——V3S2 重建用它一发命中
 *   `669145027f8020ae`（舍入模式与 pack-fuse 同约定；--noround 可试无舍入变体，实测非命中路）。
 *
 * 用法：
 *   node tools/pack-soup.mjs --recipe=v2s0=0.25:docs/.../A.bak,sd=0.2:docs/.../B.bak,... \
 *        [--target-wid=669145027f8020ae] [--out=<产物.bak>] [--noround] [--meta-ts=<ts>] [--meta-tag=<tag>]
 *
 *   · --recipe  每项 `名=权重:路径`（逗号分隔，顺序无关，权重和不必为 1——工具不归一，照抄谱系 recipe 真值）。
 *   · --target-wid  给了就做 wid 试金（命中 exit 0，未命中 exit 2 且不落 --out）。
 *   · --out     给了就把融合产物按 3P 容器落盘（META 以第一个 source 为模板，删 hotstartFrom/up，
 *               写 soup.sources（名/权重/路径/wid/ts）——fix-v3s2-provenance-1116.mjs 的约定）。
 *   · 维度不齐/解析失败一律响亮 exit 2。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { widOf } from '../champion-map/pack-id.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';
if (process.argv[1] && process.argv[1].endsWith('pack-soup.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['recipe', 'target-wid', 'out', 'noround', 'meta-ts', 'meta-tag', 'meta-keep'], 'pack-soup');
}
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const NOROUND = process.argv.includes('--noround');
const RECIPE_ARG = arg('recipe', '');
const TARGET = arg('target-wid', '');
const OUT = arg('out', '');
if (!RECIPE_ARG) { console.error('⛔ 需要 --recipe=名=权重:路径,...'); process.exit(2); }
const packA = (p) => {
  const txt = readFileSync(p, 'utf8');
  const g = txt.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;\s*$/m) || txt.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/m);
  if (!g) { console.error('⛔ 解不出 EPIRUS_CHAMPION_3P：' + p); process.exit(2); }
  return { a: JSON.parse(g[1]).a, txt };
};
const entries = RECIPE_ARG.split(',').map((s) => {
  const m = s.match(/^(.+?)=([\d.]+):(.+)$/);
  if (!m) { console.error('⛔ --recipe 项格式错（要 名=权重:路径）：' + s); process.exit(2); }
  return { key: m[1], w: Number(m[2]), path: m[3] };
});
const sources = [];
let dim = 0;
const sum = [];
for (const e of entries) {
  const { a, txt } = packA(e.path);
  if (!dim) dim = a.length;
  if (a.length !== dim) { console.error('⛔ 维度不齐 ' + e.key + ' ' + a.length + ' vs ' + dim); process.exit(2); }
  for (let i = 0; i < dim; i++) sum[i] = (sum[i] || 0) + a[i] * e.w;
  sources.push({ key: e.key, w: e.w, path: e.path, wid: widOf(txt) });
}
sources.sort((a, b) => b.w - a.w);
const out = sum.map((v) => (NOROUND ? v : Math.round(v * 1e6) / 1e6));
const payload = 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify({ v: 92, arch: 'S1o', a: out }) + ';\n';
const wid = widOf(payload);
console.log('soup wid = ' + wid + '（' + dim + ' 维 × ' + entries.length + ' 路' + (NOROUND ? ' · 无舍入' : ' · ×1e6 舍入') + '）');
for (const s of sources) console.log('  ' + s.key.padEnd(6) + ' w=' + s.w + '  wid=' + s.wid.slice(0, 16) + '  ' + s.path);
if (TARGET) {
  if (wid !== TARGET) { console.error('✗ 未命中目标 ' + TARGET + ' ⇒ 不落 --out（换 recipe/源再试）'); process.exit(2); }
  console.log('✅ 命中目标 wid');
}
if (OUT) {
  /* 落盘：以第一个 source 的容器/META 为模板（3P 全量文件），替换 a、改写 META 的 soup/ts */
  const base = readFileSync(entries[0].path, 'utf8');
  const metaM = base.match(/EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;\s*\n/);
  const full = JSON.parse(base.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;\s*$/m)[1]);
  full.a = out;
  let meta = metaM ? JSON.parse(metaM[1]) : {};
  if (!process.argv.includes('--meta-keep')) { delete meta.hotstartFrom; delete meta.up; }
  meta.ts = arg('meta-ts', meta.ts || new Date().toISOString());
  meta.tag = arg('meta-tag', 'soup');
  meta.soup = { sources };
  writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(meta) + ';\nwindow.EPIRUS_CHAMPION_3P = ' + JSON.stringify(full) + ';\n');
  console.log('✔ 落盘 ' + OUT + '（wid 以 weight 数组为准，META 不参与）');
}
