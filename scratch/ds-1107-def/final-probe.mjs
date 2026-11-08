
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
console.log('1D 圈用 isShipped:', s.indexOf('if (isShipped(d) && al > 0.5)') >= 0);
console.log('1D 柱用 isShipped:', s.indexOf('if (isShipped(d) || st.hi[gk(d)])') >= 0);
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
const ids = new Set(), dup = [];
for (const d of DATA) { if (ids.has(d.id)) dup.push(d.id); ids.add(d.id); }
console.log('重复 id:', dup.length ? dup.slice(0,5).join(',') : '无');
const shipped = DATA.filter(d => d.sh || d.lin === '历代上槽');
const linAny = DATA.filter(d => d.lin);
console.log('d.lin 非空 ' + linAny.length + ' 枚 → isShipped ' + shipped.length + ' 枚（少掉的 ' + (linAny.length - shipped.length) + ' 枚是「代3臂产物」）');
