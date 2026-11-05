/* 表级差异核对（Qoder · 11-05）：挂列前后逐格比，按列聚合、按"是不是 2.0 那 39 枚"分组。
 * 用途：证明 attach 只改了 okShort/failsShort/okLong/failsLong，没有把 1.8 侧已有的列冲掉。
 */
import { readFileSync } from 'node:fs';
const [a, b, idsFile] = process.argv.slice(2);
const rd = (f) => { const L = readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trim().split('\n'); const h = L[0].split('\t');
  const rows = L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }); return { h, rows }; };
const A = rd(a), B = rd(b);
const ids = new Set(readFileSync(idsFile, 'utf8').replace(/\r/g, '').trim().split('\n').filter(Boolean));
const H = A.h.filter(k => B.h.includes(k)).concat(B.h.filter(k => !A.h.includes(k)));
const iA = {}, iB = {}; A.rows.forEach(r => iA[r.id] = r); B.rows.forEach(r => iB[r.id] = r);
const cols = {};
for (const id of Object.keys(iB)) {
  const ra = iA[id], rb = iB[id];
  if (!ra) { cols['(新增行)'] = (cols['(新增行)'] || 0) + 1; continue; }
  for (const k of H) if (String(ra[k]) !== String(rb[k])) {
    const key = k + (ids.has(id) ? '（2.0 的 39 枚）' : '（其它行）');
    cols[key] = (cols[key] || 0) + 1;
  }
}
console.log('行数：前 ' + A.rows.length + ' → 后 ' + B.rows.length + ' ‖ 列数：前 ' + A.h.length + ' → 后 ' + B.h.length);
const keys = Object.keys(cols).sort();
if (!keys.length) console.log('  没有任何格发生变化');
for (const k of keys) console.log('  改动 ' + k + '：' + cols[k] + ' 格');
/* 只许这四个列名 + 2.0 那批行出现 */
const allowed = /^(okShort|failsShort|okLong|failsLong)（2\.0 的 39 枚）$/;
const bad = keys.filter(k => !allowed.test(k));
if (bad.length) { console.log('⛔ 出现了不该有的改动：' + bad.join(' ‖ ')); process.exit(1); }
console.log('✔ 只动了 okShort/failsShort/okLong/failsLong，且只落在 2.0 那 39 枚上');
