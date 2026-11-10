
import { readFileSync, writeFileSync } from 'node:fs';
const rd=(f)=>{const l=readFileSync(f,'utf8').replace(/\r\n/g,'\n').trim().split('\n');const H=l[0].split('\t');return l.slice(1).map(r=>{const c=r.split('\t');const o={};H.forEach((h,i)=>o[h]=c[i]);return o;});};
const W={2:0.15,3:0.25,5:0.45,8:0.15};
const x4=(r)=>{if(!r)return NaN;let a=0,w=0;for(const n of [2,3,5,8]){const v=r['x'+n];if(v!==''&&v!==undefined){a+=W[n]*+v;w+=W[n];}}return w?a/w:NaN;};
const B=rd('champion-map/exam4-B-page-1110.tsv');
const rows=B.map(r=>({id:r.id, b:x4(r)})).filter(r=>isFinite(r.b)).sort((x,y)=>y.b-x.b);
const pick=[]; for (const t of [0,1,2]) { const seg=rows.slice(Math.floor(t*rows.length/3), Math.floor((t+1)*rows.length/3)); for (let i=0;i<10;i++) pick.push(seg[Math.floor(i*seg.length/10)].id); }
writeFileSync('champion-map/only-v3sample.tsv', pick.join('\n')+'\n');
console.log('样本 '+pick.length+' 枚（B 分高/中/低各 10）：'+pick.slice(0,6).join(' ')+' …');
