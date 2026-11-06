(function(){
  var nb=NBK[FL.key],cells=nb.gx*nb.gy,FV=new Float64Array(N),names=['old','t1','t2','t4'],TT=names.map(function(){return new Float64Array(cells)}),WS=names.map(function(){return new Float64Array(cells)}),keys=new Array(cells),rows=[];
  for(var p=0;p<N;p++)FV[p]=Fv(P[p]);
  for(var i=0;i<cells;i++){
    var b=i*KF,d12=Math.max(nb.dst[b+KF-1],1e-6),cnt=0,w=[0,0,0,0],fs=[0,0,0,0],ids=[];
    for(var u=0;u<KF;u++){var pi=nb.idx[b+u];if(pi<0)break;cnt++;ids.push(pi);var d=Math.max(nb.dst[b+u],1e-6),bw=1/Math.pow(d,KEXP),r=Math.min(1,d/d12),r2=r*r,t=[1,1-r2,(1-r2)*(1-r2),1-r2*r2];
      for(var v=0;v<4;v++){var ww=bw*t[v];w[v]+=ww;fs[v]+=ww*FV[pi]}}
    for(var z=0;z<4;z++){WS[z][i]=w[z];TT[z][i]=fCol(fs[z]/w[z])}
    keys[i]=ids.sort(function(a,b){return a-b}).join(',');rows.push({w:w[0],w1:w[1],w2:w[2],w4:w[3]});
  }
  function pct(a,p){if(!a.length)return null;var b=a.slice().sort(function(x,y){return x-y});return b[Math.floor((b.length-1)*p)]}
  function mean(a){return a.length?a.reduce(function(x,y){return x+y},0)/a.length:null}
  var sorted=rows.map(function(r){return r.w}).sort(function(a,b){return a-b}),groups=[];
  for(var dec=6;dec<10;dec++){
    var lo=sorted[Math.floor(cells*dec/10)],hi=sorted[Math.min(cells-1,Math.floor(cells*(dec+1)/10))],idx=[];for(var j=0;j<cells;j++)if(rows[j].w>=lo&&(dec===9?rows[j].w<=hi:rows[j].w<hi))idx.push(j);
    var q={decile:dec,n:idx.length,ratio1:mean(idx.map(function(i){return rows[i].w1/rows[i].w})),ratio2:mean(idx.map(function(i){return rows[i].w2/rows[i].w})),ratio4:mean(idx.map(function(i){return rows[i].w4/rows[i].w})),variants:{}};
    for(var v=0;v<4;v++){var tt=idx.map(function(i){return TT[v][i]});q.variants[names[v]]={nearGrayPct:100*tt.filter(function(x){return Math.abs(x-.5)<.1}).length/tt.length,chroma:mean(tt.map(function(x){var c=rampRGB(x);return Math.max.apply(null,c)-Math.min.apply(null,c)}))}}
    groups.push(q);
  }
  var curvature={};for(var n=0;n<4;n++)curvature[names[n]]={same:[],changed:[]};
  function triple(a,b,c){var ch=keys[a]!==keys[b]||keys[b]!==keys[c];for(var v=0;v<4;v++)curvature[names[v]][ch?'changed':'same'].push(Math.abs(TT[v][a]-2*TT[v][b]+TT[v][c]))}
  for(var y=1;y<nb.gy-1;y++)for(var x=1;x<nb.gx-1;x++){var i2=y*nb.gx+x;triple(i2-1,i2,i2+1);triple(i2-nb.gx,i2,i2+nb.gx)}
  var curOut={};for(var m=0;m<4;m++)curOut[names[m]]={same:{mean:mean(curvature[names[m]].same),p99:pct(curvature[names[m]].same,.99)},changed:{mean:mean(curvature[names[m]].changed),p99:pct(curvature[names[m]].changed,.99)}};
  var ratios=rows.map(function(r){return r.w2/r.w}),scale=pct(ratios,.5),coverage={scale2Median:scale,groups:[]};
  for(var g=6;g<10;g++){var lo2=sorted[Math.floor(cells*g/10)],hi2=sorted[Math.min(cells-1,Math.floor(cells*(g+1)/10))],ii=[];for(var h=0;h<cells;h++)if(rows[h].w>=lo2&&(g===9?rows[h].w<=hi2:rows[h].w<hi2))ii.push(h);
    coverage.groups.push({decile:g,oldFade:mean(ii.map(function(i){return rows[i].w/(rows[i].w+window.__covBase.kcov)})),t2Raw:mean(ii.map(function(i){return rows[i].w2/(rows[i].w2+window.__covBase.kcov)})),t2Scaled:mean(ii.map(function(i){return rows[i].w2/(rows[i].w2+window.__covBase.kcov*scale)}))});}
  return JSON.stringify({page:location.pathname.split('/').pop(),N:N,groups:groups,curvature:curOut,coverage:coverage});
})()