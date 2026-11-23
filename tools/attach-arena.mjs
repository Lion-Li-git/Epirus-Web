#!/usr/bin/env node
/* attach-arena.mjs —— 把 arena-eval 的输出接进演化图数据层（readings / display / rulers / batches）
 * 用法：
 *   node tools/attach-arena.mjs --dose=exam|page [--dry]
 * 输入：champion-map/data/exam4n-arena[-page]-1118.tsv + arena-league[-page]-1118.tsv
 * 输出：readings/current.tsv 追加 b-arena-{pl,page}-1118 行；display.tsv 的 arS/arL/arR 列；
 *       rulers.tsv 设为 current（旧 arena 转 reference）；batches.tsv 补批行。
 * 口径：exam = ε=0；page = DIFF_TIERS lv:regular + 前 3 回合斜坡。两套文件不混表。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rejectUnknownFlags } from './audit-lib.mjs';

rejectUnknownFlags(process.argv.slice(2), ['dose', 'dry'], 'attach-arena');

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const DATA = join(ROOT, 'champion-map/data');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DRY = process.argv.includes('--dry');
const DOSE = String(arg('dose', 'page'));
if (DOSE !== 'exam' && DOSE !== 'page') { console.error('⛔ --dose 只认 exam/page'); process.exit(2); }
const SUF = DOSE === 'page' ? '-page' : '';
const RID = DOSE === 'page' ? 'b-arena-page-1118' : 'b-arena-pl-1118';
const BATCH = RID;
const TSV = join(DATA, 'exam4n-arena' + SUF + '-1118.tsv');
const N = { 2: 16, 3: 24, 5: 32, 8: 16 };

function lines(p) { return readFileSync(p, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n'); }
function table(p) {
  const L = lines(p);
  const h = L[0].split('\t');
  const ix = Object.fromEntries(h.map((c, i) => [c, i]));
  return { h, ix, rows: L.slice(1).map((l) => l.split('\t')) };
}
function writeTable(p, h, rows) { if (!DRY) writeFileSync(p, [h.join('\t')].concat(rows.map((r) => r.join('\t'))).join('\n') + '\n', 'utf8'); }

if (!existsSync(TSV)) { console.error('⛔ 缺 arena 输出：' + TSV); process.exit(2); }
const tsv = table(TSV);
const map = new Map(tsv.rows.map((r) => [r[0], r]));
console.log('arena 输出 ' + map.size + ' 枚（' + DOSE + '）');

/* 1) readings：先去重同 ruler 的旧行，再按 2/3/5/8 × short/long 追加 */
const rdP = join(DATA, 'readings/current.tsv');
const rd = table(rdP);
const kept = rd.rows.filter((r) => r[rd.ix.ruler_id] !== RID);
const add = [];
for (const [id, r] of map) {
  for (const [hor, pre] of [['short', 's'], ['long', 'l']]) {
    for (const c of [2, 3, 5, 8]) {
      const v = r[tsv.ix['x' + c + pre]];
      if (v === '' || v === undefined) continue;
      add.push([id, RID, String(c), hor, v, String(N[c]), BATCH, '']);
    }
  }
}
writeTable(rdP, rd.h, kept.concat(add));
console.log('readings 追加 ' + add.length + ' 行（旧 ' + rd.rows.length + ' → 新 ' + (kept.length + add.length) + '）');

/* 2) display：arS/arL/arR 列（页面剂量口径的汇总列） */
const dpP = join(DATA, 'display.tsv');
const dp = table(dpP);
let nAr = 0;
for (const r of dp.rows) {
  const a = map.get(r[0]);
  if (!a) continue;
  if (dp.ix.arS !== undefined) { r[dp.ix.arS] = a[tsv.ix.arS]; nAr++; }
  if (dp.ix.arL !== undefined) r[dp.ix.arL] = a[tsv.ix.arL];
  if (dp.ix.arR !== undefined) r[dp.ix.arR] = a[tsv.ix.arR];
}
writeTable(dpP, dp.h, dp.rows);
console.log('display arS/arL/arR 更新 ' + nAr + ' 行');

/* 3) rulers：新尺 current，旧 arena 转 reference */
const ruP = join(DATA, 'rulers.tsv');
const ru = table(ruP);
const rrows = ru.rows.filter((r) => r[ru.ix.ruler_id] !== RID);
for (const r of rrows) if (/^b-arena/.test(r[ru.ix.ruler_id]) && r[ru.ix.status] === 'current') r[ru.ix.status] = 'reference';
const note = DOSE === 'page'
  ? '2026-11-18 页面剂量重跑：24 锚联盟整桌按 DIFF_TIERS lv:regular（eps 0.1/epsK 5/soft + 前 3 回合斜坡）出手；与 exam 版同赛程同种子（176 局/包），可配对读 Δε'
  : '2026-11-18 升级：24 锚跨代多元联盟（v7/MSB/DEF/obs6/EQ-MX/obs6.5）× N=2/3/5/8 × multi+long 统一标定；Plackett-Luce 实力按对手强度归一化并折算超额夺1率，短长双程同尺（corr 5席桌战=0.628 / 1v1=0.533 / A_long=0.010）';
const label = DOSE === 'page' ? 'Arena 多人 Plackett-Luce · 页面剂量（lv:regular）' : 'Arena 多人 Plackett-Luce（24锚双桌统一·ε=0）';
const fixture = DOSE === 'page' ? 'ARENA24-PL-1118-PAGE' : 'ARENA24-PL-1118';
rrows.push([RID, 'B', label, 'current', 'excess', fixture, BATCH, '', note]);
writeTable(ruP, ru.h, rrows);
console.log('rulers：' + RID + ' → current');

/* 4) batches */
const baP = join(DATA, 'batches.tsv');
const ba = table(baP);
const brows = ba.rows.filter((r) => r[ba.ix.batch_id] !== BATCH);
brows.push([BATCH, RID, 'B', fixture, DOSE === 'page' ? '24锚多元联盟(multi+long统一·页面剂量)' : '24锚多元联盟(multi+long统一)', '1118',
  'champion-map/data/exam4n-arena' + SUF + '-1118.tsv', String(map.size), '2026-11-18',
  DOSE === 'page' ? '2026-11-18 Arena 页面剂量全库评估（980 枚 × 176 局，整桌 lv:regular 剂量）' : '2026-11-18 多人 Plackett-Luce Arena 全库评估（980 枚 × 176 局 × multi+long 双桌统一）']);
writeTable(baP, ba.h, brows);
console.log('batches：' + BATCH + ' 就位' + (DRY ? '（dry-run 未写盘）' : ''));
