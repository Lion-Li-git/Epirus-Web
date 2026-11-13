import fs from 'node:fs';
const rd=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n').replace(/\n+$/,'').split('\n').map(l=>l.split('\t'));
const D=rd('champion-map/data/display.tsv'),H=D[0],ix=k=>H.indexOf(k),dm=new Map(D.slice(1).map(r=>[r[ix('id')],r]));
const P=rd('champion-map/data/page/pool-members.tsv'),PH=P[0];console.log('pool header',PH.join(','));
const pi=k=>PH.indexOf(k);const hard=P.slice(1).filter(r=>(r[pi('tier')]||r[pi('band')]||r[pi('pool')])==='hard');console.log('hard rows',hard.length,hard.map(r=>r[pi('id')]||r[pi('pack')]||r[0]));
const ids=hard.map(r=>r[pi('id')]||r[pi('pack')]||r[0]);
for(const col of ['C5R','C2R','P5R','P2R']){
 const a=D.slice(1).map(r=>r[ix(col)]).filter(x=>x!==''&&x!=null).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
 const vals=ids.map(id=>{const r=dm.get(id);return r?Number(r[ix(col)]):NaN}).filter(Number.isFinite);
 if(!vals.length)continue;const m=vals.reduce((s,x)=>s+x,0)/vals.length;const below=a.filter(x=>x<m).length;console.log(col,'mean hard',m.toFixed(4),'pct',(100*below/a.length).toFixed(1),'n',vals.length,'min/max',a[0].toFixed(3),a[a.length-1].toFixed(3),'med',a[a.length>>1].toFixed(3));
}
// F for default C5R + .1*S, plus mean of F
const a=[];for(const r of D.slice(1)){const v=+r[ix('C5R')],s=+r[ix('S')];if(isFinite(v)&&isFinite(s))a.push(v+.1*s);}a.sort((x,y)=>x-y);
const fvals=ids.map(id=>{const r=dm.get(id);return r?+r[ix('C5R')]+.1*(+r[ix('S')]):NaN}).filter(Number.isFinite);const fm=fvals.reduce((s,x)=>s+x,0)/fvals.length;console.log('F(C5R+.1S) hard mean',fm.toFixed(4),'pct',(100*a.filter(x=>x<fm).length/a.length).toFixed(1),'median',a[a.length>>1].toFixed(4),'min/max',a[0].toFixed(4),a[a.length-1].toFixed(4));
