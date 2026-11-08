
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
console.log('draw1 用 sh:', s.indexOf('var rr1 = (d.sh ? 5.8 : 2.6) * st.size;') >= 0);
console.log('tooltip 带 Δε:', s.indexOf('Δε(短)') >= 0);
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
const W = [0.15, 0.25, 0.45, 0.15], NS = [2,3,5,8];
const sc = (d, pref, L) => { let a = 0, w = 0; for (let k = 0; k < 4; k++) { const v = d[pref + NS[k] + L], n = d[(pref === 'P' ? 'm' : 'n') + NS[k] + L]; if (v != null && isFinite(v) && n) { a += W[k] * v; w += W[k]; } } return w ? a / w : null; };
let nz = 0, neg = 0, arr = [];
for (const d of DATA) { const p = sc(d, 'P', ''), x = sc(d, 'X', ''); if (p == null || x == null) continue; const de = p - x; arr.push(de); if (Math.abs(de) > 1e-9) nz++; if (de < 0) neg++; }
const q = (a, p) => { const b = a.slice().sort((u,v)=>u-v); return b[Math.floor((b.length-1)*p)]; };
console.log('Δε(短) 分布：n=' + arr.length + '  min=' + q(arr,0).toFixed(3) + ' med=' + q(arr,.5).toFixed(3) + ' max=' + q(arr,1).toFixed(3) + '  ≠0 的 ' + nz + ' 枚，负的 ' + neg + ' 枚');
for (const id of ['Q-s47','T-s111','T8-s114']) { const d = DATA.find(x => x.id === id); if (d) console.log('  ' + id + '  Δε(短)=' + (sc(d,'P','') - sc(d,'X','')).toFixed(3) + '  Δε(长)=' + (sc(d,'P','L') - sc(d,'X','L')).toFixed(3)); }
