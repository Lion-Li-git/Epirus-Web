#!/usr/bin/env node
/* composite-score.mjs — 综合加权成绩（DS · 2026-11-02）
 * 用户口径：5P 长程为主、8P 加一部分、3P 与各短程也考虑、2P 单独看兼容性。
 * 权重表写死在 WEIGHTS（改权重改这里，不许报数时临时挑）；2P 另报一格作兼容门。
 * 用法：node tools/proto2/composite-score.mjs --json=scratch/comp-x.json [--json=...] [--name=覆盖名]
 * 输入 = arena2 --json= 的产物（rows[].byShape[k].cleanScore/first）。
 */
import { readFileSync } from 'node:fs';

/* 11 个桌形（arena2 顺序）*/
const WEIGHTS = {
  '2:multi': 0.03, '2:multi4': 0.02, '2:long': 0.02,
  '3:multi': 0.04, '3:multi4': 0.03, '3:long': 0.03,
  '5:multi': 0.12, '5:multi4': 0.08, '5:long': 0.30,
  '8:multi': 0.20, '10:multi': 0.13,
};

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const JSONS = argv.filter((x) => x.startsWith('--json=')).map((x) => x.slice(7));
const NAME = arg('name', '');
const REF = process.argv.includes('--ref');   /* --ref：取 参照v7 行（v7 不是 2.0 容器，不能直接当 --pack 喂 arena2） */
if (process.argv.includes('--selftest')) { selftest(); process.exit(0); }
if (!JSONS.length) { console.error('用法：--json=<arena2 产物> [--json=…]'); process.exit(2); }

function sumW() { let s = 0; for (const k in WEIGHTS) s += WEIGHTS[k]; return s; }

function scoreRow(row) {
  let c = 0, f = 0, n = 0, missing = 0;
  for (const k in WEIGHTS) {
    const x = row.byShape && row.byShape[k];
    if (!x) { missing++; continue; }
    c += WEIGHTS[k] * x.cleanScore; f += WEIGHTS[k] * x.first; n += WEIGHTS[k];
  }
  return { clean: n > 0 ? c / n : 0, first: n > 0 ? f / n : 0, missing };
}
function cell(row, k, f) { const x = row.byShape && row.byShape[k]; return x ? x[f] : null; }
function group(row, keys, wsum, f) {
  let s = 0, n = 0;
  for (const k of keys) { const v = cell(row, k, f); if (v != null) { s += v * WEIGHTS[k]; n += WEIGHTS[k]; } }
  return n > 0 ? s / n : null;
}

function selftest() {
  const w = sumW();
  if (Math.abs(w - 1) > 1e-9) { console.error('⛔ 权重和=' + w + ' ≠ 1'); process.exit(1); }
  const one = { byShape: {} }; for (const k in WEIGHTS) one.byShape[k] = { cleanScore: 1, first: 1, games: 40 };
  const r1 = scoreRow(one);
  if (Math.abs(r1.clean - 1) > 1e-9 || Math.abs(r1.first - 1) > 1e-9) { console.error('⛔ 全 1 合成≠1'); process.exit(1); }
  const half = { byShape: {} }; for (const k in WEIGHTS) half.byShape[k] = { cleanScore: 0.5, first: 0.5, games: 40 };
  const r2 = scoreRow(half);
  if (Math.abs(r2.clean - 0.5) > 1e-9) { console.error('⛔ 全 0.5 合成≠0.5'); process.exit(1); }
  console.log('✔ selftest：权重和=1 ‖ 全 1→1 ‖ 全 0.5→0.5');
}
console.log('包 | 综合clean | 综合夺1 | 2P | 5P-long | 8P | 10P | 5P合计 | 3P合计 | 缺格 | 温度');
for (const p of JSONS) {
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const rows = (j.rows || []).filter((r) => REF ? /参照/.test(r.tag || '') : !/参照/.test(r.tag || ''));
  let best = null;
  for (const r of rows) { const s = scoreRow(r); if (!best || s.clean > best.s.clean) best = { r, s }; }
  if (!best) { console.log(p + ' | 无被测行'); continue; }
  const r = best.r;
  const name = NAME || p.replace(/^.*[\\/]/, '').replace(/^comp-/, '').replace(/\.json$/, '');
  const g = (k) => { const v = cell(r, k, 'cleanScore'); return v == null ? '-' : v.toFixed(3); };
  const n2 = group(r, ['2:multi', '2:multi4', '2:long'], 0.07, 'cleanScore');
  const n5 = group(r, ['5:multi', '5:multi4', '5:long'], 0.50, 'cleanScore');
  const n3 = group(r, ['3:multi', '3:multi4', '3:long'], 0.10, 'cleanScore');
  const fmt = (v) => v == null ? '-' : v.toFixed(3);
  console.log([name, best.s.clean.toFixed(3), best.s.first.toFixed(3), fmt(n2), g('5:long'), g('8:multi'), g('10:multi'), fmt(n5), fmt(n3), best.s.missing, r.temp].join(' | '));
}