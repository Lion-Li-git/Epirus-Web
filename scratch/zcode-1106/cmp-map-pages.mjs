/* 对比 HEAD 已提交页 vs 新烘页：节点集合、家族字段（11-07 晨 GD3-ALL 复活复盘） */
import { readFileSync } from 'node:fs';
function dataOf(f) {
  const t = readFileSync(f, 'utf8');
  const i = t.indexOf('var DATA = ');
  if (i < 0) throw new Error(f + ' 无 DATA');
  let depth = 0, j = t.indexOf('[', i);
  for (let k = j; k < t.length; k++) {
    if (t[k] === '[') depth++;
    else if (t[k] === ']') { depth--; if (depth === 0) { j = k + 1; break; } }
  }
  return JSON.parse(t.slice(t.indexOf('[', i), j));
}
const a = dataOf('scratch/zcode-1106/_head-index.html');   // HEAD 已提交页
const b = dataOf('champion-map/index.html');               // 新烘页
console.log('HEAD 节点', a.length, '‖ 新页节点', b.length);
const onlyA = a.filter(n => !b.some(x => x.id === n.id)).map(n => n.id);
const onlyB = b.filter(n => !a.some(x => x.id === n.id)).map(n => n.id);
console.log('HEAD 有而新页没有:', onlyA.join(',') || '(无)');
console.log('新页有而 HEAD 没有:', onlyB.join(',') || '(无)');
const f0 = a.filter(n => n.fam === undefined || n.fam === null || n.fam === '').length;
const f1 = b.filter(n => n.fam === undefined || n.fam === null || n.fam === '').length;
console.log('HEAD 无家族号:', f0, '‖ 新页 无家族号:', f1);
// 家族号分布对比
const dist = (rows) => { const m = {}; for (const n of rows) { const k = String(n.fam ?? ''); m[k] = (m[k] || 0) + 1; } return m; };
const da = dist(a), db = dist(b);
for (const k of new Set([...Object.keys(da), ...Object.keys(db)]).values())
  if (da[k] !== db[k]) console.log('家族 ' + (k === '' ? '(空)' : k) + ': HEAD=' + (da[k] || 0) + ' → 新页=' + (db[k] || 0));
