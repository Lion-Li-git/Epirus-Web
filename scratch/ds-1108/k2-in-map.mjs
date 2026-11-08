
import { readFileSync } from 'node:fs';
const s = readFileSync('champion-map/index.html', 'utf8');
const i = s.indexOf('var DATA = '), j = s.indexOf('; var OKSRCJ', i);
const DATA = JSON.parse(s.slice(i + 'var DATA = '.length, j));
const W = { 2: 0.15, 3: 0.25, 5: 0.45, 8: 0.15 };
const F = (d) => { let a = 0, w = 0; for (const n of [2,3,5,8]) if (d['P'+n] != null && isFinite(d['P'+n])) { a += W[n]*d['P'+n]; w += W[n]; } return w ? a/w + 0.10*d.S : NaN; };
const ranked = DATA.filter(d => isFinite(F(d))).sort((a,b) => F(b)-F(a));
const k = DATA.find(d => d.id === 'KD-K2');
console.log('KD-K2: fam=' + k.fam + ' ts=' + (k.ts||'').slice(0,10) + ' ver=' + k.ver + ' F=' + F(k).toFixed(3) + ' 名次 ' + (ranked.findIndex(d=>d.id==='KD-K2')+1) + '/' + ranked.length);
console.log('前 6: ' + ranked.slice(0,6).map(d=>d.id+' '+F(d).toFixed(3)).join(' ‖ '));
