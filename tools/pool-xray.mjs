#!/usr/bin/env node
/* pool-xray.mjs —— 池 X 光：全成员的 强度(arenaB) × 覆盖(120 格 ≥3 命中) 一览 + 按带聚合（2026-11-19 深夜分带重切的量具升格）
 *
 * 用法：
 *   node tools/pool-xray.mjs                    # 全池扫描（skill-report JSON 有货的才出覆盖列）
 *   node tools/pool-xray.mjs --cov-th=3         # 「跨环境会用」的格命中阈值（默认 3）
 * 数据源：pool-members.tsv（带/名册）‖ arena-noise-floor-1118.tsv（arenaB）‖ data/skill-report/<id>.json（coverage）。
 * 判读纪律：arenaB 极差随批数增大，中位/单粒要分开读（POOL-CONTRACT §5.2）；coverage 随 fixtures.tsv（现役 fx-pool1126a）口径，
 *   夹具换代后旧 JSON 不与新 JSON 混表（AGENTS 8）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';
if (process.argv[1] && process.argv[1].endsWith('pool-xray.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['cov-th', 'ledger'], 'pool-xray');
}
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const COV_TH = Number(arg('cov-th', 3));
const rd = (p) => readFileSync(p, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const pm = rd('champion-map/data/page/pool-members.tsv');
const h = Object.fromEntries(pm[0].map((c, i) => [c, i]));
const fl = rd('champion-map/data/arena-noise-floor-1118.tsv');
const fh = Object.fromEntries(fl[0].map((c, i) => [c, i]));
const B = new Map(fl.slice(1).map(r => [r[fh.pack_id], Number(r[fh.arenaB])]));
const rows = pm.slice(1).map(r => ({ id: r[h.id], tier: r[h.tier] }));
const out = [];
for (const r of rows) {
  let cov = null, union = -1, used = [];
  const p = `champion-map/data/skill-report/${r.id}.json`;
  if (existsSync(p)) {
    const d = JSON.parse(readFileSync(p, 'utf8'));
    cov = d.stage1.coverage || {};
    union = d.stage1.unionN;
    used = Object.keys(cov).filter(k => (cov[k] || 0) >= COV_TH);
  }
  out.push({ ...r, B: B.get(r.id), union, covN: used.length, used: used.sort().join(','), hasData: !!cov });
}
out.sort((a, b) => (b.B ?? -9999) - (a.B ?? -9999));
console.log('id'.padEnd(20), '带  ', 'arenaB', '   并集', '覆盖≥' + COV_TH, '  覆盖技能清单（前 12）');
for (const r of out) console.log(
  r.id.padEnd(20), r.tier.padEnd(4), String(r.B ?? '没量').slice(0, 9).padEnd(9), String(r.union).padEnd(5),
  String(r.covN).padEnd(8), r.hasData ? r.used.slice(0, 12) : '（skill-report 无此枚）');
for (const tier of ['hard', 'mid', 'soft']) {
  const band = out.filter(r => r.tier === tier);
  if (!band.length) { console.log(`\n[${tier}] 空`); continue; }
  const Bs = band.map(r => r.B).filter(v => v !== undefined).sort((a, b) => a - b);
  const uni = {};
  for (const r of band) for (const k of (r.used || '').split(',').filter(Boolean)) uni[k] = (uni[k] || 0) + 1;
  const med = Bs.length ? Bs[Math.floor(Bs.length / 2)] : null;
  console.log(`\n[${tier}] ${band.length} 枚 ‖ arenaB 中位 ${med === null ? '没量' : med.toFixed(1)} ‖ 带内覆盖并集 ${Object.keys(uni).length} 技`);
  console.log('   并集明细：' + Object.entries(uni).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + '×' + n).join(' '));
}
