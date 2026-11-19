#!/usr/bin/env node
/* anchor-recover.mjs —— 缺失权重对账恢复：扫仓外源（隔离区/worktree/temp），按 wid 对回缺失清单（2026-11-20 深夜升格）
 *
 * 用法：
 *   node tools/anchor-recover.mjs                 # 报告模式：源里有多少枚能对上缺失清单
 *   node tools/anchor-recover.mjs --do            # 实恢复：拷回台账原路径并 wid 复验
 *   node tools/anchor-recover.mjs --ledger=docs/ARTIFACT-LOSS-1119.tsv --sources=D:/x,Q://y --do
 *
 * 身份判定：wid（权重数组 sha1）逐位相同才算同一枚——路径/META.ts 都不算数（本仓铁律：身份按权重）。
 * 已知边界（11-19 夜实测）：wid 目标来自 lineage-g3.tsv（188 行里仅部分带 wid）——覆盖不到的缺失枚
 *   需要先补 wid 账（registry 只有 sha256，文件没了就没法算；这也是「恢复件必须当天入 git」的原因）。
 * 实战战绩：V3S2 六路融合重建一发命中 669145027f8020ae（scratch/v3s2-build.mjs → tools/pack-soup.mjs）。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { widOf } from '../champion-map/pack-id.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';
if (process.argv[1] && process.argv[1].endsWith('anchor-recover.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['do', 'ledger', 'sources', 'wids', 'dry'], 'anchor-recover');
}
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const DO = process.argv.includes('--do');
const LEDGER = arg('ledger', 'docs/ARTIFACT-LOSS-1119.tsv');
const SOURCES = arg('sources', 'D:/code/Epirus-Web-artifacts-quarantine,D:/code/Epirus-Web-tables-quarantine,D:/code/wt-repro-1114,D:/code/wt-repro-1115,D:/code/wt-repro-1115v3,D:/code/wt-repro-1118pm').split(',');
const L = readFileSync(LEDGER, 'utf8').replace(/\r/g, '').split('\n');
const lh = L[0].split('\t');
const lix = Object.fromEntries(lh.map((c, i) => [c, i]));
const missing = L.slice(1).filter(Boolean).map(l => l.split('\t')).filter(r => r[lix.state] === 'missing');
console.log('台账 missing ' + missing.length + ' 条（' + LEDGER + '）');

/* wid 目标：--wids=<id=wid,...> 优先，否则 lineage-g3.tsv 的 wid 列 */
const wids = new Map();
const warg = arg('wids', '');
if (warg) for (const kv of warg.split(',')) { const [id, w] = kv.split('='); if (id && w) wids.set(id, w); }
else {
  for (const lp of ['champion-map/data/page/lineage-g3.tsv']) {
    if (!existsSync(lp)) continue;
    const t = readFileSync(lp, 'utf8').replace(/\r/g, '').split('\n');
    const h = Object.fromEntries(t[0].replace(/^\ufeff/, '').split('\t').map((c, i) => [c, i]));
    for (const r of t.slice(1).filter(Boolean)) {
      const c = r.split('\t');
      if (c[h.id] && c[h.wid] && !wids.has(c[h.id])) wids.set(c[h.id], c[h.wid]);
    }
  }
}
console.log('wid 目标 ' + wids.size + ' 条（--wids= 可补充；缺失枚没有 wid 目标就无法验证身份）');

/* 扫源：wid → 首个源文件 */
const wid2src = new Map();
let scanned = 0;
const walk = (dir) => {
  let ents;
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(bak|js)$/.test(e.name)) continue;
    scanned++;
    let w;
    try { w = widOf(readFileSync(p, 'utf8')); } catch { continue; }
    if (w && !wid2src.has(w)) wid2src.set(w, p);
  }
};
for (const s of SOURCES) walk(s.trim());
console.log('源文件 ' + scanned + ' ‖ 唯一 wid ' + wid2src.size);

const hits = [], noWid = [], noSrc = [];
for (const r of missing) {
  const id = r[lix.id], path = r[lix.path];
  const w = wids.get(id);
  if (!w) { noWid.push(id); continue; }
  const src = wid2src.get(w);
  if (!src) { noSrc.push(id); continue; }
  hits.push({ id, path, src, wid: w });
}
console.log('\n可恢复 ' + hits.length + ' ‖ 无 wid 目标 ' + noWid.length + ' ‖ 无源 ' + noSrc.length);
for (const h of hits.slice(0, 40)) console.log('  ✓ ' + h.id + ' ← ' + h.src.replace(/\\/g, '/'));
if (DO) {
  let ok = 0, fail = 0;
  for (const h of hits) {
    try {
      const dst = join(process.cwd(), h.path);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(h.src, dst);
      if (widOf(readFileSync(dst, 'utf8')) !== h.wid) { console.error('  ⛔ 复验不符 ' + h.id); fail++; continue; }
      ok++;
    } catch (e) { console.error('  ⛔ ' + h.id + ': ' + e.message); fail++; }
  }
  console.log('落盘 ' + ok + ' ‖ 失败 ' + fail + ' ⇒ 记得 git add -f + registry/台账刷新（恢复件不入 git = 下次清理再丢）');
}
