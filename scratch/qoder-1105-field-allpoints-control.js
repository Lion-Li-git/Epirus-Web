(function(){
  var nb=NBK[FL.key],cells=nb.gx*nb.gy,FV=new Float64Array(N),XS=new Float64Array(N),YS=new Float64Array(N);
  for(var p=0;p<N;p++){FV[p]=Fv(P[p]);XS[p]=P[p][nb.ax];YS[p]=P[p][nb.by]}
  var TA=new Float64Array(cells),FA=new Float64Array(cells),TO=new Float64Array(cells),FO=new Float64Array(cells),keys=new Array(cells);
  for(var i=0;i<cells;i++){
    var gi=i%nb.gx,gj=(i/nb.gx)|0,X=nb.x0+(nb.x1-nb.x0)*gi/(nb.gx-1),Y=nb.y0+(nb.y1-nb.y0)*gj/(nb.gy-1);
    var w=0,fs=0;
    for(var j=0;j<N;j++){var dx=(XS[j]-X)*nb.bx,dy=(YS[j]-Y)*nb.byy,d2=Math.max(dx*dx+dy*dy,1e-12),ww=1/(d2*d2*Math.sqrt(d2));w+=ww;fs+=ww*FV[j]}
    TA[i]=fCol(fs/w);FA[i]=Math.max(0,Math.min(1,(Math.log(w)-Math.log(COV_LO))/(Math.log(COV_HI)-Math.log(COV_LO))));
    var b=i*KF,wo=0,fso=0,ids=[];
    for(var u=0;u<KF;u++){var pi=nb.idx[b+u];if(pi<0)break;ids.push(pi);var dd=Math.max(nb.dst[b+u],1e-6),www=1/Math.pow(dd,KEXP);wo+=www;fso+=www*FV[pi]}
    TO[i]=fCol(fso/wo);FO[i]=Math.max(0,Math.min(1,(Math.log(wo)-Math.log(COV_LO))/(Math.log(COV_HI)-Math.log(COV_LO))));keys[i]=ids.sort(function(a,b){return a-b}).join(',');
  }
  function pct(a,p){if(!a.length)return null;var b=a.slice().sort(function(x,y){return x-y});return b[Math.floor((b.length-1)*p)]}
  function stats(a){return {n:a.length,mean:a.length?a.reduce(function(x,y){return x+y},0)/a.length:null,p90:pct(a,.9),p99:pct(a,.99)}}
  var s={oldSame:[],oldChanged:[],allSame:[],allChanged:[],oldFadeSame:[],oldFadeChanged:[],allFadeSame:[],allFadeChanged:[],oldAll:[],newAll:[]};
  function edge(a,b){var ch=keys[a]!==keys[b],dto=Math.abs(TO[a]-TO[b]),dta=Math.abs(TA[a]-TA[b]),dfo=Math.abs(FO[a]-FO[b]),dfa=Math.abs(FA[a]-FA[b]);
    (ch?s.oldChanged:s.oldSame).push(dto);(ch?s.allChanged:s.allSame).push(dta);(ch?s.oldFadeChanged:s.oldFadeSame).push(dfo);(ch?s.allFadeChanged:s.allFadeSame).push(dfa);s.oldAll.push(dto);s.newAll.push(dta)}
  for(var y=0;y<nb.gy;y++)for(var x=0;x<nb.gx;x++){var q=y*nb.gx+x;if(x+1<nb.gx)edge(q,q+1);if(y+1<nb.gy)edge(q,q+nb.gx)}
  var cur={oldSame:[],oldChanged:[],allSame:[],allChanged:[],oldFadeSame:[],oldFadeChanged:[],allFadeSame:[],allFadeChanged:[]};
  function triple(a,b,c){var ch=keys[a]!==keys[b]||keys[b]!==keys[c],co=Math.abs(TO[a]-2*TO[b]+TO[c]),ca=Math.abs(TA[a]-2*TA[b]+TA[c]),fo=Math.abs(FO[a]-2*FO[b]+FO[c]),fa=Math.abs(FA[a]-2*FA[b]+FA[c]);
    (ch?cur.oldChanged:cur.oldSame).push(co);(ch?cur.allChanged:cur.allSame).push(ca);(ch?cur.oldFadeChanged:cur.oldFadeSame).push(fo);(ch?cur.allFadeChanged:cur.allFadeSame).push(fa)}
  for(var yy=1;yy<nb.gy-1;yy++)for(var xx=1;xx<nb.gx-1;xx++){var z=yy*nb.gx+xx;triple(z-1,z,z+1);triple(z-nb.gx,z,z+nb.gx)}
  return JSON.stringify({page:location.pathname.split('/').pop(),N:N,cells:cells,
    color:{k12Same:stats(s.oldSame),allSame:stats(s.allSame),k12Changed:stats(s.oldChanged),allChanged:stats(s.allChanged),k12All:stats(s.oldAll),allAll:stats(s.newAll)},
    fade:{k12Same:stats(s.oldFadeSame),allSame:stats(s.allFadeSame),k12Changed:stats(s.oldFadeChanged),allChanged:stats(s.allFadeChanged)},
    curvature:{k12Same:stats(cur.oldSame),allSame:stats(cur.allSame),k12Changed:stats(cur.oldChanged),allChanged:stats(cur.allChanged),fadeK12Same:stats(cur.oldFadeSame),fadeAllSame:stats(cur.allFadeSame),fadeK12Changed:stats(cur.oldFadeChanged),fadeAllChanged:stats(cur.allFadeChanged)}});
})()