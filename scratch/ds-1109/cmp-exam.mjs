
import { readFileSync } from 'node:fs';
const rd = (f) => { const l = readFileSync(f,'utf8').replace(/\r\n/g,'\n').trim().split('\n'); const H=l[0].split('\t'); return l.slice(1).map(r=>Object.fromEntries(r.split('\t').map((v,i)=>[H[i],v]))); };
const W={2:0.15,3:0.25,5:0.45,8:0.15};
const x4 = (r) => { if(!r) return NaN; let a=0,w=0; for(const n of [2,3,5,8]){const v=r['x'+n]; if(v!=='' && v!==undefined){a+=W[n]*+v; w+=W[n];}} return w?a/w:NaN; };
const oldS = rd('champion-map/exam4-page-1107.tsv'), newS = rd('champion-map/exam4-page-1109.tsv');
const oldL = rd('champion-map/exam4-page-long-1107.tsv'), newL = rd('champion-map/exam4-page-long-1109.tsv');
const map = (arr) => Object.fromEntries(arr.map(r=>[r.id,r]));
const oS=map(oldS), nS=map(newS), oL=map(oldL), nL=map(newL);
const ids = Object.keys(nS);
const rows = ids.map(id=>({id, oldS:x4(oS[id]), newS:x4(nS[id]), oldL:x4(oL[id]), newL:x4(nL[id])})).filter(r=>isFinite(r.newS));
const d = rows.map(r=>r.newS-r.oldS).sort((a,b)=>a-b);
const q=(p)=>d[Math.floor(p*(d.length-1))];
console.log('短桌 X̄₄ 变化：n='+rows.length+' 中位 '+(q(0.5)).toFixed(3)+'  p10 '+q(0.1).toFixed(3)+'  p90 '+q(0.9).toFixed(3)+'  min '+d[0].toFixed(3)+'  max '+d[d.length-1].toFixed(3));
const dl = rows.map(r=>r.newL-r.oldL).sort((a,b)=>a-b);
console.log('长桌 X̄₄ 变化：中位 '+dl[Math.floor(dl.length/2)].toFixed(3)+'  min '+dl[0].toFixed(3)+'  max '+dl[dl.length-1].toFixed(3));
console.log('\n掉得最多的 8 枚（短桌）：');
for (const r of rows.slice().sort((a,b)=>(a.newS-a.oldS)-(b.newS-b.oldS)).slice(0,8)) console.log('  '+r.id.padEnd(18)+' '+r.oldS.toFixed(3)+' → '+r.newS.toFixed(3)+'  ('+(r.newS-r.oldS>=0?'+':'')+(r.newS-r.oldS).toFixed(3)+')  long '+r.oldL.toFixed(3)+' → '+r.newL.toFixed(3));
console.log('\n涨得最多的 5 枚：');
for (const r of rows.slice().sort((a,b)=>(b.newS-b.oldS)-(a.newS-a.oldS)).slice(0,5)) console.log('  '+r.id.padEnd(18)+' '+r.oldS.toFixed(3)+' → '+r.newS.toFixed(3)+'  (+'+(r.newS-r.oldS).toFixed(3)+')');
for (const id of ['G5C-100','G5J-50','G5F-100','G5I-50','WSEL9-200','KDG-B-Q-s13']) { const r=rows.find(x=>x.id===id); if(r) console.log('\n'+id+': 短 '+r.oldS.toFixed(3)+' → '+r.newS.toFixed(3)+' ‖ 长 '+r.oldL.toFixed(3)+' → '+r.newL.toFixed(3)); }
