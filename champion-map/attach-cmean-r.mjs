#!/usr/bin/env node
/* C2R 页面级合成列（F2 滚动夹具版 · 2026-11-11 夜）：C2R = (P2 + P2R)/2
 * A 轴 = P 族（不变）‖ B 轴 = P·R 族（F2 夹具 = MSB11+MSB10+MSB8-charge+Q-s47，exam4-F2-page-1111，
 * 批表 champ 列在册）。仅 multi（long 批未跑，C2RL 留白天班）。
 * 守卫与 attach-cmean 同族：两侧齐才算测；幂等原位覆盖。
 * 用法：node champion-map/attach-cmean-r.mjs [--in=champion-map/coords-gen3-1105.tsv]
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const IN = arg('in', 'champion-map/coords-gen3-1105.tsv');
const rd = (f) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));

copyFileSync(IN, IN + '.bak-cmean-r');
const co = rd(IN), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
for (const c of ['P2', 'P2R']) if (h[c] === undefined) { console.error('⛔ coords 缺输入列 ' + c); process.exit(2); }
let hasC2R = h.C2R !== undefined;
if (!hasC2R) { co[0].push('C2R'); h.C2R = co[0].length - 1; }
let filled = 0, oneSided = 0;
for (let r = 1; r < co.length; r++) {
  const p = co[r][h.P2], b = co[r][h.P2R];
  if (p === '' || p === undefined || b === '' || b === undefined) { if (hasC2R) co[r][h.C2R] = ''; oneSided++; continue; }
  co[r][h.C2R] = ((+p) + (+b)) / 2;
  filled++;
}
/* 列序：C2R 追加在尾（不动既有列序 ⇒ 对 viewer 的列名取数无扰） */
writeFileSync(IN, co.map((r) => r.join('\t')).join('\n') + '\n', 'utf8');
console.log('C2R 合成：' + filled + ' 行填值 ‖ ' + oneSided + ' 行单侧缺（留空=未测）‖ 备份 ' + IN + '.bak-cmean-r');
