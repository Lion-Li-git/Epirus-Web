
import { readFileSync } from 'node:fs';
const rd=(f)=>{const l=readFileSync(f,'utf8').replace(/\r\n/g,'\n').trim().split('\n');const H=l[0].split('\t');return Object.fromEntries(l.slice(1).map(r=>{const c=r.split('\t');const o={};H.forEach((h,i)=>o[h]=c[i]);return [c[0],o];}));};
const W={2:0.15,3:0.25,5:0.45,8:0.15};
const x4=(r)=>{if(!r)return NaN;let a=0,w=0;for(const n of [2,3,5,8]){const v=r['x'+n];if(v!==''&&v!==undefined){a+=W[n]*+v;w+=W[n];}}return w?a/w:NaN;};
const A2=rd('champion-map/exam4-page-1109.tsv'), V3=rd('champion-map/exam4-v3sample.tsv'), B=rd('champion-map/exam4-B-page-1110.tsv'), H=rd('champion-map/h2h-q47-sample.tsv');
const ids=Object.keys(H);
function sp(xs, ys){const n=xs.length;const rk=(a)=>{const idx=a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]);const r=new Array(n);for(let i=0;i<n;i++)r[idx[i][1]]=i;return r;};
 const rx=rk(xs), ry=rk(ys);let s=0;for(let i=0;i<n;i++)s+=(rx[i]-ry[i])**2;return 1-6*s/(n*(n*n-1));}
const rows=ids.map(id=>({id,a2:x4(A2[id]),a3:x4(V3[id]),b:x4(B[id]),h:+H[id].h2h})).filter(r=>isFinite(r.a3)&&isFinite(r.a2));
console.log('n='+rows.length);
console.log('Spearman(A_v2, h2h对Q-s47) = '+sp(rows.map(r=>r.a2), rows.map(r=>r.h)).toFixed(3));
console.log('Spearman(A_v3, h2h对Q-s47) = '+sp(rows.map(r=>r.a3), rows.map(r=>r.h)).toFixed(3));
const withB=rows.filter(r=>isFinite(r.b));
console.log('（含 B 轴的子集 n='+withB.length+'：A_v2 vs B '+sp(withB.map(r=>r.a2),withB.map(r=>r.b)).toFixed(3)+' ‖ A_v3 vs B '+sp(withB.map(r=>r.a3),withB.map(r=>r.b)).toFixed(3)+'）');
console.log('\n逐枚（A_v2 / A_v3 / h2h）：');
for(const r of rows.sort((x,y)=>y.h-x.h)) console.log('  '+r.id.padEnd(18)+r.a2.toFixed(3).padStart(7)+r.a3.toFixed(3).padStart(8)+r.h.toFixed(3).padStart(8));
