
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7','Q-s47','DEF-s13']) {
  const d = DATA.find(x => x.id === id);
  console.log(id.padEnd(14) + ' x2=' + (+d.x2).toFixed(3) + ' y2=' + (+d.y2).toFixed(3) + ' fam=' + d.fam + ' ts=' + (d.ts || '-').slice(0, 10));
}
/* 地图视图 F 窗口内是否可见：算 F */
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const F = (d) => { let a = 0, w = 0; for (const n of [2,3,5,8]) { const v = d['P' + n]; if (v != null && isFinite(v)) { a += W[n] * v; w += W[n]; } } return w ? a / w + 0.10 * d.S : NaN; };
for (const id of ['CTRL2-Q-s7','Q-s47']) { const d = DATA.find(x => x.id === id); console.log(id + ' F=' + F(d).toFixed(3)); }
