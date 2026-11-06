(function(){
  var nb=NBK[FL.key],cells=nb.gx*nb.gy,FV=new Float64Array(N),rows=[];
  for(var p=0;p<N;p++)FV[p]=Fv(P[p]);
  var bR=parseInt(st.bg.slice(1,3),16),bG=parseInt(st.bg.slice(3,5),16),bB=parseInt(st.bg.slice(5,7),16),bgL=.2126*bR+.7152*bG+.0722*bB;
  function mean(a){return a.length?a.reduce(function(x,y){return x+y},0)/a.length:null}
  function pct(a,p){if(!a.length)return null;var b=a.slice().sort(function(x,y){return x-y});return b[Math.floor((b.length-1)*p)]}
  function stat(a){return {mean:mean(a),p50:pct(a,.5)}}
  for(var i=0;i<cells;i++){
    var b=i*KF,w=0,sw2=0,fs=0,fs2=0;
    for(var u=0;u<KF;u++){var pi=nb.idx[b+u];if(pi<0)break;var ww=1/Math.pow(Math.max(nb.dst[b+u],1e-6),KEXP);w+=ww;sw2+=ww*ww;fs+=ww*FV[pi];fs2+=ww*FV[pi]*FV[pi]}
    var fav=fs/w,tt=fCol(fav),fade=Math.max(0,Math.min(1,(Math.log(w)-Math.log(COV_LO))/(Math.log(COV_HI)-Math.log(COV_LO)))),rgb=rampRGB(tt),a=(.92-.5*tt)*fade;
    var r=bR+(rgb[0]-bR)*a,g=bG+(rgb[1]-bG)*a,bb=bB+(rgb[2]-bB)*a;
    rows.push({w:w,ess:w*w/sw2,sd:Math.sqrt(Math.max(0,fs2/w-fav*fav)),tt:tt,fade:fade,a:a,chroma:Math.max.apply(null,rgb)-Math.min.apply(null,rgb),dev:Math.sqrt((r-bR)*(r-bR)+(g-bG)*(g-bG)+(bb-bB)*(bb-bB)),lumDev:Math.abs(.2126*r+.7152*g+.0722*bb-bgL)});
  }
  var sorted=rows.map(function(r){return r.w}).sort(function(a,b){return a-b}),out=[];
  for(var d=0;d<10;d++){
    var lo=sorted[Math.floor(cells*d/10)],hi=sorted[Math.min(cells-1,Math.floor(cells*(d+1)/10))],q=rows.filter(function(r){return r.w>=lo&&(d===9?r.w<=hi:r.w<hi)}),nearGray=q.filter(function(r){return Math.abs(r.tt-.5)<.1}).length;
    out.push({densityDecile:d,n:q.length,ess:stat(q.map(function(r){return r.ess})),neighborFSd:stat(q.map(function(r){return r.sd})),tt:stat(q.map(function(r){return r.tt})),nearGrayPct:100*nearGray/q.length,fade:stat(q.map(function(r){return r.fade})),alpha:stat(q.map(function(r){return r.a})),sourceChroma:stat(q.map(function(r){return r.chroma})),finalDeviation:stat(q.map(function(r){return r.dev})),finalLumDeviation:stat(q.map(function(r){return r.lumDev}))});
  }
  return JSON.stringify({page:location.pathname.split('/').pop(),N:N,deciles:out});
})()