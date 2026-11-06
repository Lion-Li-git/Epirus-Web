/* A2 盘点：烘焙页 DATA 里 fam 缺失（图例"家族？"）的节点名单（ZCode 11-06 夜） */
import { readFileSync } from 'node:fs';
const html = readFileSync('champion-map/index.html', 'utf8');
const at = html.indexOf('var DATA = [');
let i = html.indexOf('[', at), d = 0, inS = false, esc = false, raw = null;
for (let p = i; p < html.length; p++) {
  const c = html[p];
  if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
  if (c === '"') { inS = true; continue; }
  if (c === '[') d++;
  else if (c === ']') { d--; if (d === 0) { raw = html.slice(i, p + 1); break; } }
}
const nodes = JSON.parse(raw);
const nofam = nodes.filter(n => !n.fam);
console.log('总节点', nodes.length, '| 无 fam:', nofam.length);
for (const n of nofam) console.log(' ', n.id, '| ver=' + n.ver, '| pof=' + (n.pof || ''), '| path=' + (n.path || ''));
// 各 fam 计数（图例对照）
const byFam = {};
for (const n of nodes) byFam[n.fam || '?'] = (byFam[n.fam || '?'] || 0) + 1;
console.log('fam 分布:', JSON.stringify(byFam));
