#!/usr/bin/env node
/* proto2 蒸馏产物 → 3P 冠军壳（ZCode · 11-13 凌晨）：给只有 `window.EPIRUS_CHAMPION_3P = {...}` 一行的
 *   supfit-gd 产物补上 `EPIRUS_CHAMPION_3P_META = {...}` 行（provenance 从 .meta.json 取），
 *   让 `tools/promote-champion.mjs --dry` 能读。权重逐字节不动（同一粒 ⇒ 走 declareCopy 登记，不制造未登记重复）。
 * 用法：node scratch/zcode-1113-deps/proto2-to-3p-shell.mjs <src.bak>
 * 产物：<同目录>/<名>-3p.bak
 */
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { declareCopy } from '../../champion-map/pack-guard.mjs';

const SRC = process.argv[2];
if (!SRC) { console.error('用法: node scratch/zcode-1113-deps/proto2-to-3p-shell.mjs <src.bak>'); process.exit(2); }
const text = readFileSync(SRC, 'utf8');
if (/EPIRUS_CHAMPION_3P_META/.test(text)) { console.log('已有 META 行，无需转换：' + SRC); process.exit(0); }
if (!/window\.EPIRUS_CHAMPION_3P\s*=\s*\{/.test(text)) { console.error('⛔ 源里没有 EPIRUS_CHAMPION_3P 权重行'); process.exit(4); }

let meta = {};
try { meta = JSON.parse(readFileSync(SRC + '.meta.json', 'utf8')); } catch (e) { console.error('⚠ .meta.json 读不到，META 只写最小 provenance'); }
const outMeta = {
  tool: meta.tool || 'proto2-distill',
  tag: meta.tag || basename(SRC).replace(/\.(bak|js)$/, ''),
  parent: meta.parent || null,
  seed: meta.seed ?? null,
  lr: meta.lr ?? null,
  steps: meta.steps ?? null,
  groups: meta.groups ?? null,
  teacher: meta.teacher || null,
  shapeBal: meta.shapeBal ?? null,
  rareOnly: meta.rareOnly || null,
  rareFrac: meta.rareFrac ?? null,
  labelByKey: (meta.label && meta.label.byKey) || null,
  supfitHoldout: (meta.supfitGd && meta.supfitGd.rounds && meta.supfitGd.rounds[0] && meta.supfitGd.rounds[0].holdout) || null,
  note: 'proto2 蒸馏产物转 3P 冠军壳（只补 META 行，权重逐字节不动）· 2026-11-13',
};
const out = 'window.EPIRUS_CHAMPION_3P_META = ' + JSON.stringify(outMeta) + ';\n' + text;
const dest = join(dirname(SRC), basename(SRC).replace(/\.(bak|js)$/, '') + '-3p.bak');
const r = declareCopy({ root: process.cwd(), dest, text: out, tool: 'proto2-to-3p-shell',
  why: 'GD6 蒸馏产物转 3P 冠军壳（promote 体测前置；同一粒权重，壳不同）' });
console.log('[' + r.note + ']');
console.log('产物 → ' + dest);
