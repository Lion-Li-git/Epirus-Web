/* 单技能包扫描：coords-view distinctKeys==1 的 14 枚，拉全轴读数与在库排名 */
import { readFileSync, writeFileSync } from 'node:fs';
const T = readFileSync('champion-map/data/build/coords-view.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map(l => l.split('\t'));
const H = T[0], ix = Object.fromEntries(H.map((x, i) => [x, i]));
const R = T.slice(1);
const g = (r, k) => r[ix[k]];
const NS = [2, 3, 5, 8];
const rank = (col, id, dir = 1) => { // dir=1 越大越好
  const vals = R.map(r => +g(r, col)).filter(v => Number.isFinite(v));
  const me = +g(R.find(r => g(r, 'id') === id), col);
  if (!Number.isFinite(me)) return '';
  const better = vals.filter(v => (dir ? v > me : v < me)).length;
  return `${better + 1}/${vals.length}`;
};
const rows = R.filter(r => +g(r, 'distinctKeys') === 1);
const out = [];
for (const r of rows) {
  const id = g(r, 'id');
  const o = { id, ver: g(r, 'ver'), S: g(r, 'S'), G: g(r, 'Geff').slice(0, 5) };
  for (const c of ['P2','P3','P5','P8','P2L','P3L','P5L','P8L','P2R','P3R','P5R','P8R','P2RL','P3RL','P5RL','P8RL','C2R','C5R','C2RL','C5RL','Hp5','H5','rounds','dmg','rwDmg','charges','waste','noThreatStance','fieldAAtk','heavy','holo','Geff','S','zeroRate'])
    o[c] = g(r, c);
  o.rkA5 = rank('P5', id, 1); o.rkA5L = rank('P5L', id, 1);
  o.rkB5 = rank('P5R', id, 1); o.rkB5L = rank('P5RL', id, 1);
  o.rkC2R = rank('C2R', id, 1);
  out.push(o);
}
console.log('单技能包 ' + out.length + ' 枚：');
const cols = ['id','ver','P5','rkA5','P5L','rkA5L','P5R','rkB5','P5RL','rkB5L','C2R','rkC2R','Hp5','rounds','dmg','rwDmg','charges','noThreatStance','fieldAAtk','zeroRate','waste'];
console.log(cols.join('\t'));
for (const o of out.sort((a, b) => (+b.P5R||-9) - (+a.P5R||-9))) console.log(cols.map(c => o[c]).join('\t'));
writeFileSync(new URL('./scan.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), ['id', ...Object.keys(out[0]).filter(k => k !== 'id')].join('\t') + '\n' + out.map(o => Object.values(o).join('\t')).join('\n'), 'utf8');
