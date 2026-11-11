
import { readFileSync } from 'node:fs';
const rd=(f)=>{const l=readFileSync(f,'utf8').replace(/\r\n/g,'\n').trim().split('\n');const H=l[0].split('\t');return Object.fromEntries(l.slice(1).map(r=>{const c=r.split('\t');const o={};H.forEach((h,i)=>o[h]=c[i]);return [c[0],o];}));};
const W={2:0.15,3:0.25,5:0.45,8:0.15};
const x4=(r)=>{if(!r)return NaN;let a=0,w=0;for(const n of [2,3,5,8]){const v=r['x'+n];if(v!==''&&v!==undefined){a+=W[n]*+v;w+=W[n];}}return w?a/w:NaN;};
const A=rd('champion-map/exam4-page-1109.tsv'), AL=rd('champion-map/exam4-page-long-1109.tsv');
const B=rd('champion-map/exam4-B-page-1110.tsv'), BL=rd('champion-map/exam4-B-page-long-1110.tsv');
const ids=['MSB2-R1S1494663071','MSB2-R2S103437527','G5C-100','G5J-50','KDG-B-Q-s13','WSEL9-200'];
console.log('包'.padEnd(22)+'A短'.padStart(8)+'B短'.padStart(8)+'C短'.padStart(8)+'A长'.padStart(8)+'B长'.padStart(8)+'C长'.padStart(8));
for(const id of ids){const a=x4(A[id]),b=x4(B[id]),al=x4(AL[id]),bl=x4(BL[id]);if(!isFinite(a)&&!isFinite(b)){console.log(id+' 缺');continue;}
console.log(id.padEnd(22)+(isFinite(a)?a.toFixed(3):'—').padStart(8)+(isFinite(b)?b.toFixed(3):'—').padStart(8)+(((a+b)/2).toFixed(3)).padStart(8)+(isFinite(al)?al.toFixed(3):'—').padStart(8)+(isFinite(bl)?bl.toFixed(3):'—').padStart(8)+(((al+bl)/2).toFixed(3)).padStart(8));}
