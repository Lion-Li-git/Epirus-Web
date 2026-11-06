(function(){
  var nb=NBK[FL.key], TB=FL.nShown===N?nb:VK, cells=nb.gx*nb.gy;
  var W=new Float64Array(cells), TT=new Float64Array(cells), FD=new Float64Array(cells), AL=new Float64Array(cells), D1=new Float64Array(cells);
  var keys=new Array(cells), colorLo=0,colorHi=0,fadeLo=0,fadeHi=0;
  function pct(a,p){if(!a.length)return null;var b=a.slice().sort(function(x,y){return x-y});return b[Math.floor((b.length-1)*p)]}
  function stats(a){return {n:a.length,mean:a.length?a.reduce(function(x,y){return x+y},0)/a.length:null,p50:pct(a,.5),p90:pct(a,.9),p99:pct(a,.99)}}
  for(var i=0;i<cells;i++){
    var b=i*KF,w=0,fs=0,ids=[];
    for(var u=0;u<KF;u++){var p=TB.idx[b+u];if(p<0)break;ids.push(p);var ww=1/Math.pow(Math.max(TB.dst[b+u],1e-6),KEXP);w+=ww;fs+=ww*Fv(P[p])}
    W[i]=w;D1[i]=TB.dst[b];TT[i]=fCol(fs/w);
    var f=(Math.log(w)-Math.log(COV_LO))/(Math.log(COV_HI)-Math.log(COV_LO));f=Math.max(0,Math.min(1,f));FD[i]=f;
    var gi=i%nb.gx,gj=(i/nb.gx)|0,edge=Math.min(1,Math.min(gi,nb.gx-1-gi,gj,nb.gy-1-gj)/EDGEK);
    AL[i]=(0.92-0.5*TT[i])*f*edge;
    if(TT[i]<=0)colorLo++;if(TT[i]>=1)colorHi++;if(f<=0)fadeLo++;if(f>=1)fadeHi++;
    keys[i]=ids.sort(function(x,y){return x-y}).join(',');
  }
  var distGroups=[],cuts=[0,.25,.5,1,2,4,8,Infinity];
  for(var c=0;c<cuts.length-1;c++){
    var aa=[],ff=[],tt=[];
    for(var j=0;j<cells;j++){var r=D1[j]/nb.d12m;if(r>=cuts[c]&&r<cuts[c+1]){aa.push(AL[j]);ff.push(FD[j]);tt.push(TT[j])}}
    distGroups.push({d1OverD12m:[cuts[c],cuts[c+1]],n:aa.length,alpha:stats(aa),fade:stats(ff),color:stats(tt)});
  }
  var controlled=[];
  for(var lo=0;lo<1;lo+=.2){
    var ac=[];
    for(var k=0;k<cells;k++)if(FD[k]>=.4&&FD[k]<=.6&&TT[k]>=lo&&TT[k]<lo+.2)ac.push(AL[k]);
    controlled.push({tt:[lo,lo+.2],alpha:stats(ac)});
  }
  var seam={same:[],changed:[],sameFade:[],changedFade:[]},changedN=0,totalN=0,examples=[];
  function edgeStat(a,b){
    var dt=Math.abs(TT[a]-TT[b]),df=Math.abs(FD[a]-FD[b]),ch=keys[a]!==keys[b];totalN++;if(ch)changedN++;
    (ch?seam.changed:seam.same).push(dt);(ch?seam.changedFade:seam.sameFade).push(df);
    if(examples.length<12&&dt>.08)examples.push({a:a,b:b,dtt:dt,dfade:df,changed:ch,tta:TT[a],ttb:TT[b],fa:FD[a],fb:FD[b]});
  }
  for(var y=0;y<nb.gy;y++)for(var x=0;x<nb.gx;x++){var q=y*nb.gx+x;if(x+1<nb.gx)edgeStat(q,q+1);if(y+1<nb.gy)edgeStat(q,q+nb.gx)}
  return JSON.stringify({
    page:location.pathname.split('/').pop(),N:N,grid:[nb.gx,nb.gy],d12m:nb.d12m,lo:COV_LO,hi:COV_HI,
    plateau:{fadeZeroPct:100*fadeLo/cells,fadeOnePct:100*fadeHi/cells,colorBluePct:100*colorLo/cells,colorRedPct:100*colorHi/cells,colorEitherPct:100*(colorLo+colorHi)/cells},
    alphaFormula:{blueAtFade1:.92,grayAtFade1:.67,redAtFade1:.42,redVsBlue:.42/.92},
    distGroups:distGroups,controlledMidFade:controlled,
    seams:{changedPct:100*changedN/totalN,colorSame:stats(seam.same),colorChanged:stats(seam.changed),fadeSame:stats(seam.sameFade),fadeChanged:stats(seam.changedFade),examples:examples}
  });
})()