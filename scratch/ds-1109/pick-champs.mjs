
import { readFileSync } from 'node:fs';
const rd = (f) => readFileSync(f, 'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n').map(l=>l.split('\t'));
const co = rd('champion-map/coords-gen3-1105.tsv'); const H = co[0]; const h = Object.fromEntries(H.map((x,i)=>[x,i]));
const want = ['G5C-100','G5I-50','G5G-50','G5J-50','WSEL9-200','KDG-B-Q-s13','FOCUS-Q-s13','CLEAR-Q-s13','ADAPT2-Q-s7','KD-G2','STR-B-Q-s13','PASS2-Q-s13','WIDE2-200'];
const W={2:0.15,3:0.25,5:0.45,8:0.15};
const x4=(r)=>{let a=0,w=0;for(const n of [2,3,5,8]){const v=r[h['P'+n]];if(v!==''&&v!==undefined){a+=W[n]*+v;w+=W[n];}}return w?a/w:NaN;};
console.log('包'.padEnd(16)+'X̄₄短'.padStart(8)+'x8短'.padStart(8)+'h8短'.padStart(7)+'x8长'.padStart(8)+'h8长'.padStart(7)+'  短门 长门');
for (const id of want) {
  const r = co.slice(1).find(l => l[h.id] === id); if (!r) { console.log(id + ' 不在图上'); continue; }
  console.log(id.padEnd(16)+x4(r).toFixed(3).padStart(8)+(+(r[h.P8]||0)).toFixed(3).padStart(8)+(+(r[h.h8]||0)).toFixed(1).padStart(7)+(+(r[h.P8L]||0)).toFixed(3).padStart(8)+(+(r[h.h8L]||0)).toFixed(1).padStart(7)+'   '+(r[h.okShort]==='1'?'OK':'✘')+'   '+(r[h.okLong]==='1'?'OK':'✘'));
}
