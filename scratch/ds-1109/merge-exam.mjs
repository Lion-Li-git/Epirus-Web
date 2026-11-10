
import { readFileSync, writeFileSync } from 'node:fs';
const rd=(f)=>{const l=readFileSync(f,'utf8').replace(/\r\n/g,'\n').trim().split('\n');const H=l[0].split('\t');return {H, rows:l.slice(1).map(r=>r.split('\t'))};};
function merge(main, miss, out) {
  const a=rd(main), b=rd(miss);
  const have=new Set(a.rows.map(r=>r[0]));
  const add=b.rows.filter(r=>!have.has(r[0]));
  const all=a.rows.concat(add).sort((x,y)=>x[0]<y[0]?-1:x[0]>y[0]?1:0);
  writeFileSync(out, a.H.join('\t')+'\n'+all.map(r=>r.join('\t')).join('\n')+'\n');
  console.log(out+' ⇒ '+all.length+' 行（补 '+add.length+'）');
}
merge('champion-map/exam4-page-1109.tsv','champion-map/exam4-page-1109-missing.tsv','champion-map/exam4-page-1109.tsv');
merge('champion-map/exam4-page-long-1109.tsv','champion-map/exam4-page-long-1109-missing.tsv','champion-map/exam4-page-long-1109.tsv');
