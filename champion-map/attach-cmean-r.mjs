#!/usr/bin/env node
/* C·R 页面级合成列族（F2 滚动夹具 · 2026-11-11）：C<n>R = (P<n> + P<n>R)/2，长程带 L。
 * A 轴 = P 族（脚本桌 v2，exam4-page-1109）‖ B 轴 = P·R 族（F2 滚动夹具 = MSB11-R2S306293884 +
 *   MSB10-R1S1149480262 + MSB8-charge-R1S1861674281 + Q-s47，champn=1；批表 champ 列在册）。
 * 与 attach-cmean.mjs（C=(A+PB)/2，旧固定夹具）同构：**新尺新列族**，旧 C/PB 族冻结不动。
 * 守卫：① 两侧齐才算测（一侧缺 ⇒ 留空 = 未测，不许拿单侧冒充综合）；② 幂等原位覆盖；
 *       ③ 八列一族（四格 × 短/长）——只合成 C2R 会让 X̄₄ 退化成单格，那不是四格卷。
 * 列序：已存在的列原位不动，缺的按 C2R C3R C5R C8R C2RL C3RL C5RL C8RL 追加在尾（全仓按列名取数）。
 * 用法：node champion-map/attach-cmean-r.mjs [--in=champion-map/coords-gen3-1105.tsv]
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const IN = arg('in', 'champion-map/coords-gen3-1105.tsv');
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));

const NS = [2, 3, 5, 8];
const NEWCR = [...NS.map((n) => 'C' + n + 'R'), ...NS.map((n) => 'C' + n + 'RL')];
const need = [...NS.map((n) => 'P' + n), ...NS.map((n) => 'P' + n + 'L'),
  ...NS.map((n) => 'P' + n + 'R'), ...NS.map((n) => 'P' + n + 'RL')];

const before = rd(IN);
const bh0 = Object.fromEntries(before[0].map((x, i) => [x, i]));
const missCol = need.filter((c) => bh0[c] === undefined);
if (missCol.length) {
  console.error('⛔ coords 缺输入列：' + missCol.join(',') +
    '\n   ⇒ 先把 F2 批跑齐（multi + long 一起，仓规）再 intake：' +
    '\n     node tools/exam-4n-full.mjs --out=exam4-F2-page-long-1111.tsv --mode=long …' +
    '\n     node scratch/qoder-1111-map/intake-obs5-plus.mjs');
  process.exit(2);
}
/* 牙①：历史在册的 C2R 必须逐字不变（公式与夜班那版同式，不许顺手改精度） */
const oldC2R = new Map();
if (bh0.C2R !== undefined) for (const r of before.slice(1)) {
  const v = r[bh0.C2R]; if (v !== '' && v !== undefined) oldC2R.set(r[0], v);
}

copyFileSync(IN, IN + '.bak-cmean-r');
const co = rd(IN);
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
/* 11-11 exam 批次戳守卫（attach-exam-stamp.mjs 写的六列）：
 *   ① B 夹具只能一种；② 不许有行来自旧 -obs5 夹具；③ 有 B 值的行必须有来源戳。
 *   没戳（旧表）不拦，但要印出来 —— 不能把“没标”当“同夹具”。 */
if (h.examBs !== undefined || h.examBl !== undefined || h.examFix !== undefined) {
  const fix = new Set(), bad = [], noSrc = [];
  for (const r of co.slice(1)) {
    const fb = r[h.examFix], bs = r[h.examBs], bl = r[h.examBl];
    if (fb) fix.add(fb);
    if (bs && /-obs5/.test(bs)) bad.push(r[0] + ' Bs=' + bs);
    if (bl && /-obs5/.test(bl)) bad.push(r[0] + ' Bl=' + bl);
    if (h.examBs !== undefined && r[h.P5R] !== undefined && r[h.P5R] !== '' && !bs) noSrc.push(r[0] + ' Bs');
    if (h.examBl !== undefined && r[h.P5RL] !== undefined && r[h.P5RL] !== '' && !bl) noSrc.push(r[0] + ' Bl');
  }
  if (fix.size > 1 || bad.length || noSrc.length) {
    console.error('⛔ exam 批次戳不一致：夹具 ' + fix.size + ' 种 ‖ 旧夹具 ' + bad.length + ' ‖ 缺来源 ' + noSrc.length +
      (bad.length ? '\n   ' + bad.slice(0, 5).join(' | ') : '') + (noSrc.length ? '\n   ' + noSrc.slice(0, 5).join(' | ') : ''));
    process.exit(2);
  }
  console.log('exam 批次戳 ✅ B 夹具唯一（' + [...fix][0] + '）‖ 旧夹具 0 ‖ 有值行来源齐全');
} else {
  console.log('⚠ exam 批次戳未在册（先跑 attach-exam-stamp.mjs；本次不拦，但 C 的来源无法对账）');
}
const appended = [];
for (const c of NEWCR) if (h[c] === undefined) { co[0].push(c); h[c] = co[0].length - 1; appended.push(c); }
for (const r of co) while (r.length < co[0].length) r.push('');

let filled = 0, oneSided = 0;
const cover = Object.fromEntries(NEWCR.map((c) => [c, 0]));
for (let r = 1; r < co.length; r++) {
  for (const c of NEWCR) {
    const L = c.endsWith('L') ? 'L' : '';
    const n = c.slice(1, c.length - 1 - L.length);
    const a = co[r][h['P' + n + L]], b = co[r][h['P' + n + 'R' + L]];
    const aOK = a !== '' && a !== undefined, bOK = b !== '' && b !== undefined;
    if (!aOK || !bOK) { co[r][h[c]] = ''; if (aOK !== bOK) oneSided++; continue; }
    co[r][h[c]] = String((+a + +b) / 2); filled++; cover[c]++;
  }
}
writeFileSync(IN, co.map((r) => r.join('\t')).join('\n') + '\n', 'utf8');

/* 牙①复核 */
const after = rd(IN);
const ah = Object.fromEntries(after[0].map((x, i) => [x, i]));
let drift = 0; const driftIds = [];
for (const r of after.slice(1)) {
  const o = oldC2R.get(r[0]); if (o === undefined) continue;
  if (r[ah.C2R] !== o) { drift++; if (driftIds.length < 5) driftIds.push(r[0] + ' ' + o + '→' + r[ah.C2R]); }
}
console.log((appended.length ? '追加列 ' + appended.join('/') + ' ‖ ' : '原位覆盖 ‖ ') + '填格 ' + filled + ' ‖ 单侧缺(留空=未测) ' + oneSided);
for (const c of NEWCR) console.log('  ' + c + ' 有值 ' + cover[c] + '/' + (co.length - 1));
console.log('历史 C2R 在册 ' + oldC2R.size + ' 枚 ‖ 复算后漂移 ' + drift + (drift ? ' ⛔ ' + driftIds.join(' ') : ' ✅ 逐字不变'));
console.log('备份 ' + IN + '.bak-cmean-r');
if (drift) process.exit(3);