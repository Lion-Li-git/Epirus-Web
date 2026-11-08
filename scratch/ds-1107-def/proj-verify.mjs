
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7','Q-s47','DEF-s13']) {
  const d = DATA.find(x => x.id === id);
  console.log(id.padEnd(14) + ' x2=' + (+d.x2).toFixed(3) + ' y2=' + (+d.y2).toFixed(3) + ' fam=' + d.fam + ' ts=' + (d.ts||'-').slice(0,10));
}
/* 新点与最近邻的二维距离（看它们是否落在行为相近的簇里） */
const near = (id) => {
  const a = DATA.find(x => x.id === id);
  return DATA.filter(d => d.id !== id).map(d => ({ id: d.id, dd: Math.hypot(d.x2 - a.x2, d.y2 - a.y2) }))
    .sort((p, q) => p.dd - q.dd).slice(0, 5).map(x => x.id + '(' + x.dd.toFixed(2) + ')').join(' ');
};
for (const id of ['CTRL2-Q-s7','CTRL2-Q-s13','ADAPT2-Q-s7']) console.log(id + ' 二维最近邻: ' + near(id));
