
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const t = rd('champion-map/coords-projcols.tsv');
const h = Object.fromEntries(t[0].map((x, i) => [x, i]));
const pool = new Set(['L5-1200-s13','D1200-s13','DSTR4-s13','EFFG-s41','EFFG-s5','EFFG-s7','GD3ALL-G5-8p-s41','GD3ALL-PUSHON-s41','GD3ALL-POPP-s17','GD3ALL-POPP-s41','G5DEF-s41','GD3ALL-PUSHON-s13','D-b-hpseed-s13','D-a-s13','GD3ALL-PLAIN-s13','DDEF-s13','DSTR-s13','LE-s13','GD3ALL-G5-s13','DEF-s13','DEF-s16','COMBO-s13','DEF-s15']);
const rows = t.slice(1).map(r => ({ id: r[h.id], v: Object.fromEntries(['P2','P3','P5','P8','P2L','P3L','P5L','P8L'].map(k => [k, r[h[k]] === '' ? NaN : +r[h[k]]])) }));
const pct = (arr, v) => { const s = arr.filter(isFinite).sort((a,b)=>a-b); return s.filter(x => x <= v).length / s.length; };
for (const k of ['P2','P3','P5','P8','P2L','P3L','P5L','P8L']) {
  const all = rows.map(r => r.v[k]);
  const pm = rows.filter(r => pool.has(r.id)).map(r => r.v[k]);
  const q = rows.find(r => r.id === 'Q-s47').v[k], u = rows.find(r => r.id === 'U-s205').v[k];
  console.log(k.padEnd(4) + ' Q=' + q.toFixed(3) + '(p' + (pct(all,q)*100).toFixed(0) + ')  U=' + u.toFixed(3) + '(p' + (pct(all,u)*100).toFixed(0) + ')  全库中位=' + all.filter(isFinite).sort((a,b)=>a-b)[Math.floor(all.filter(isFinite).length/2)].toFixed(3) + '  池均值=' + (pm.reduce((a,b)=>a+b,0)/pm.length).toFixed(3));
}
