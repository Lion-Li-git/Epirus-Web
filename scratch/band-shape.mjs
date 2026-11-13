import fs from 'node:fs';
const L=fs.readFileSync('champion-map/data/display.tsv','utf8').replace(/\r\n/g,'\n').split('\n');const H=L[0].split('\t');const ix=k=>H.indexOf(k);
const rows=L.slice(1).map(l=>l.split('\t'));
function vals(k){return rows.map(r=>{const x=r[ix(k)];return x===''||x==null?NaN:Number(x)}).filter(Number.isFinite).sort((a,b)=>a-b);}
function q(a,p){return a[Math.max(0,Math.min(a.length-1,Math.floor((a.length-1)*p)))];}
for(const k of ['C2R','C3R','C5R','C8R']){
 const a=vals(k);const n=a.length;const q1=q(a,.25),q3=q(a,.75),iqr=q3-q1;const med=q(a,.5);
 const mad=q(a.map(x=>Math.abs(x-med)).sort((x,y)=>x-y),.5)*1.4826;
 const dom=[[.02,.98],[.01,.99],[.005,.995],[.05,.95]];
 console.log('\n'+k,'n='+n,'min='+a[0].toFixed(3),'p.5='+q(a,.005).toFixed(3),'p1='+q(a,.01).toFixed(3),'p2='+q(a,.02).toFixed(3),'p5='+q(a,.05).toFixed(3),'med='+med.toFixed(3),'p95='+q(a,.95).toFixed(3),'p98='+q(a,.98).toFixed(3),'p99='+q(a,.99).toFixed(3),'p99.5='+q(a,.995).toFixed(3),'max='+a[n-1].toFixed(3));
 console.log('  IQR',q1.toFixed(3),q3.toFixed(3),'fences',(q1-1.5*iqr).toFixed(3),(q3+1.5*iqr).toFixed(3),'MAD',mad.toFixed(3),'med3MAD',(med-3*mad).toFixed(3),(med+3*mad).toFixed(3));
 for(const [l,u] of dom) console.log('  trim',l,u,'nClip',a.filter(x=>x<q(a,l)||x>q(a,u)).length,'width',(q(a,u)-q(a,l)).toFixed(3));
 console.log('  Tukey clip',a.filter(x=>x<q1-1.5*iqr||x>q3+1.5*iqr).length,'med3MAD clip',a.filter(x=>x<med-3*mad||x>med+3*mad).length);
}
// largest gaps near tails for C2R/C5R
for(const k of ['C2R','C5R']){const a=vals(k);let gaps=[];for(let i=1;i<a.length;i++)gaps.push({i,g:a[i]-a[i-1],lo:a[i-1],hi:a[i]});gaps.sort((x,y)=>y.g-x.g);console.log('\ngaps '+k,gaps.slice(0,8).map(x=>x.i+'/'+a.length+' '+x.lo.toFixed(3)+'→'+x.hi.toFixed(3)+' ('+x.g.toFixed(3)+')').join(' | '));}
