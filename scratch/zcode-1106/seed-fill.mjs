/* A3a：把 2.0 行的 seed 列从**包内 META 实读**填齐（pack 文件 = 单一真源；幂等，已有非空值不动）。
 * ZCode 11-06 夜 · PLAN §A3。追记 45 口径"派生进合流器"——本脚本是同一派生的表侧落法，合流器重跑时照抄此判据。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const P = 'champion-map/coords-gen3-1105.tsv';
const co = readFileSync(P, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const h = Object.fromEntries(co[0].map((x, i) => [x, i]));
let filled = 0, kept = 0, miss = [];
for (let r = 1; r < co.length; r++) {
  const id = co[r][h.id];
  if (!id || co[r][h.ver] !== '2.0') continue;
  if ((co[r][h.seed] || '').trim()) { kept++; continue; }
  const p = co[r][h.path];
  if (!p || !existsSync(p)) { miss.push(id); continue; }
  const t = readFileSync(p, 'utf8');
  const mm = /window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(t);
  if (!mm) { miss.push(id); continue; }
  const j = JSON.parse(mm[1]);
  if (j.seed != null && j.seed !== '') { co[r][h.seed] = String(j.seed); filled++; } else miss.push(id);
}
writeFileSync(P, co.map(r => r.join('\t')).join('\n') + '\n');
console.log('seed 填充: 新填 ' + filled + ' ‖ 保留已有 ' + kept + ' ‖ META 无 seed 的 ' + miss.length + ' 枚' + (miss.length ? '：' + miss.slice(0, 10).join(' ') : ''));
