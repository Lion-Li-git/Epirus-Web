import { readFileSync } from 'node:fs';
const rows = JSON.parse(readFileSync('C:/Users/14765/AppData/Local/Temp/epi-claim3.json','utf8'));
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const sd=a=>{const m=mean(a);return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/(a.length-1));};
const g={}; for(const r of rows){(g[(r.pool? 'pool':'single')+':'+r.mode]=g[(r.pool?'pool':'single')+':'+r.mode]||[]).push(r);}
for(const key of ['pool:multi','pool:long','single:multi','single:long']){const a=g[key]||[];const d1=a.map(x=>x.s-x.r),d2=a.map(x=>x.r-x.h);const m1=mean(d1),m2=mean(d2),se1=sd(d1)/Math.sqrt(a.length),se2=sd(d2)/Math.sqrt(a.length);console.log(key,'levels',mean(a.map(x=>x.s)).toFixed(2),mean(a.map(x=>x.r)).toFixed(2),mean(a.map(x=>x.h)).toFixed(2),'| d1',m1.toFixed(2),'se',se1.toFixed(2),'sep',Math.abs(m1)/se1>=2,'| d2',m2.toFixed(2),'se',se2.toFixed(2),'sep',se2>0&&Math.abs(m2)/se2>=2);}