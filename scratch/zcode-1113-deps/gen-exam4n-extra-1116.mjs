/* 生成 exam-4n-full 的 --extra 名单（仓库相对路径）——11-16 凌晨全库重跑用。
 * 坑：绝对路径过不了驱动里 join(ROOT, rel) 的存在性检查（Windows join 不重置盘符）⇒ 必须 relative。 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const lines = readFileSync('champion-map/data/registry.tsv', 'utf8').trim().split(/\r?\n/);
const h = lines[0].split('\t');
const iId = h.indexOf('pack_id'), iPath = h.indexOf('path'), iStatus = h.indexOf('status');
const out = ['arm\tproductRel'];
let n = 0, miss = 0;
for (const l of lines.slice(1)) {
  const c = l.split('\t');
  if (!c[iId] || !c[iPath]) continue;
  if (c[iStatus] && c[iStatus] !== 'active') continue;
  let p = c[iPath].replace(/\\/g, '/');
  const k = p.indexOf('Epirus-Web/');
  let rel = k >= 0 ? p.slice(k + 'Epirus-Web/'.length) : p;
  if (/^[A-Za-z]:/.test(rel)) { miss++; continue; }
  out.push(c[iId] + '\t' + rel);
  n++;
}
writeFileSync('champion-map/data/exam4n-rerun-1116-extra.tsv', out.join('\n'));
console.log('rows', n, 'skipped-abs', miss);
for (const w of ['OBS6E9', 'OBS6P4-S4000', 'OBS6-LH6', 'MSB15R-HITMIX']) {
  const row = out.find((l) => l.startsWith(w + '\t'));
  const rel = row ? row.split('\t')[1] : null;
  console.log(w, '→', rel, existsSync(rel) ? '✔' : '✘ 文件不存在');
}
