
import { readFileSync } from 'node:fs';
const rd=(f)=>{const l=readFileSync(f,'utf8').replace(/\r\n/g,'\n').trim().split('\n');const H=l[0].split('\t');return Object.fromEntries(l.slice(1).map(r=>{const c=r.split('\t');const o={};H.forEach((h,i)=>o[h]=c[i]);return [c[0],o];}));};
const W={2:0.15,3:0.25,5:0.45,8:0.15};
const x4=(r)=>{if(!r)return NaN;let a=0,w=0;for(const n of [2,3,5,8]){const v=r['x'+n];if(v!==''&&v!==undefined){a+=W[n]*+v;w+=W[n];}}return w?a/w:NaN;};
const A=rd('champion-map/exam4-page-1109.tsv'), AL=rd('champion-map/exam4-page-long-1109.tsv');
const B=rd('champion-map/exam4-B-page-1110.tsv'), BL=rd('champion-map/exam4-B-page-long-1110.tsv');
const ids=[...new Set([...Object.keys(A),...Object.keys(B)])];
const rows=ids.map(id=>{const a=x4(A[id]),b=x4(B[id]),al=x4(AL[id]),bl=x4(BL[id]);return {id,a,b,al,bl,c:(a+b)/2,cl:(al+bl)/2};}).filter(r=>isFinite(r.c));
rows.sort((x,y)=>y.c-x.c);
console.log('C 短桌 top10：');
for(const r of rows.slice(0,10)) console.log('  '+r.id.padEnd(22)+' A '+r.a.toFixed(3)+'  B '+r.b.toFixed(3)+'  C '+r.c.toFixed(3));
const q=(p)=>{const s=rows.map(r=>r.c).sort((a,b)=>a-b);return s[Math.floor(p*(s.length-1))];};
console.log('\nC 分布：max '+rows[0].c.toFixed(3)+'  p99 '+q(0.99).toFixed(3)+'  p90 '+q(0.9).toFixed(3)+'  中位 '+q(0.5).toFixed(3)+'  n='+rows.length);
console.log('top1 与 top2 差：'+(rows[0].c-rows[1].c).toFixed(3)+'；top1 与 p99 差：'+(rows[0].c-q(0.99)).toFixed(3));
const byA=rows.slice().sort((x,y)=>y.a-x.a);
console.log('\nA 轴 top5：'+byA.slice(0,5).map(r=>r.id+'('+r.a.toFixed(2)+')').join(' '));
console.log('B 轴 top5：'+rows.slice().sort((x,y)=>y.b-x.b).slice(0,5).map(r=>r.id+'('+r.b.toFixed(2)+')').join(' '));
