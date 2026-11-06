/* 39 枚 2.0 点的"起点身份"覆盖率（Qoder · 11-05）—— 用表里自带的 path 列，不猜文件名
 * 目的：回答"训练侧还要不要修"。分三类点名：meta 有 hotstartFrom / 只有 recipe.env.EPIRUS_SEEDPACK / 两个都没有。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const L = readFileSync(join(ROOT, 'champion-map/coords-view-20.tsv'), 'utf8').replace(/\r/g, '').trim().split('\n');
const h = L[0].split('\t'); const iP = h.indexOf('path'), iI = h.indexOf('id');
let has = 0, envOnly = 0, none = 0, missingFile = 0;
const det = { envOnly: [], none: [], missingFile: [] };
for (const l of L.slice(1)) {
  const c = l.split('\t'); const id = c[iI], p = c[iP];
  if (!p) { none++; det.none.push(id + '(表里没 path)'); continue; }
  const fp = join(ROOT, p);
  if (!existsSync(fp)) { missingFile++; det.missingFile.push(id + ' → ' + p); continue; }
  const t = readFileSync(fp, 'utf8');
  if (/"hotstartFrom":"[0-9a-f]{16}"/.test(t)) { has++; continue; }
  const m = /"EPIRUS_SEEDPACK"\s*:\s*"([^"]+)"/.exec(t);
  if (m) { envOnly++; det.envOnly.push(id + ' → 只有路径 ' + m[1]); }
  else { none++; det.none.push(id + ' → ' + p); }
}
console.log('== 39 枚 2.0 点的起点身份盘点（按 coords-view-20.tsv 的 path 列逐枚读产物）==');
console.log('   meta 带 hotstartFrom（16 位 wid）：' + has);
console.log('   只有 recipe.env.EPIRUS_SEEDPACK（路径，不是身份）：' + envOnly);
console.log('   两个都没有 / 表里没 path：' + none);
console.log('   path 指向的文件不在盘上：' + missingFile);
for (const k of ['envOnly', 'none', 'missingFile']) if (det[k].length) console.log('   ' + k + '：' + det[k].slice(0, 12).join(' ‖ '));
