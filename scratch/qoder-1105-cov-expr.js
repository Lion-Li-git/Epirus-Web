new Promise(function(res){setTimeout(function(){
  var cv=document.getElementById("cv"), g=cv.getContext("2d"), W=cv.width, H=cv.height;
  var d=g.getImageData(0,0,W,H).data;
  var BGL=0.299*15+0.587*21+0.114*34;
  function dev(x,y){ if(x<0||y<0||x>=W||y>=H) return null; var o=(y*W+x)*4; return Math.abs((0.299*d[o]+0.587*d[o+1]+0.114*d[o+2])-BGL); }
  /* 径向剖面：以画布中心为原点，16 条射线，按半径分箱取均值（只用于描述"由内向外是否渐隐"） */
  var NB=12, acc=new Array(NB).fill(0), cnt=new Array(NB).fill(0);
  var RMAX=Math.min(W,H)*0.5;
  for(var a=0;a<16;a++){ var th=a*Math.PI/8;
    for(var r=2;r<RMAX;r+=2){ var x=Math.round(W/2+r*Math.cos(th)), y=Math.round(H/2+r*Math.sin(th));
      var v=dev(x,y); if(v===null) continue; var b=Math.min(NB-1,Math.floor(r/RMAX*NB)); acc[b]+=v; cnt[b]++; } }
  var prof=acc.map(function(s,i){ return cnt[i]? s/cnt[i] : 0; });
  var mx=Math.max.apply(null,prof);
  function cross(f){ for(var i=0;i<NB;i++) if(prof[i]<=mx*f) return (i/NB*RMAX).toFixed(0); return ">RMAX"; }
  var mono=0, steps=0; for(var i=1;i<NB;i++){ steps++; if(prof[i]<=prof[i-1]+1) mono++; }
  /* 云内空洞：中心 64% 区域里"干净格"的连片数（>6 格算大洞） */
  var gx=80,gy=40,m=[],j,i2,clean=0,t=0;
  for(j=0;j<gy;j++){ m[j]=[]; for(i2=0;i2<gx;i2++){ var px=Math.floor(W*(0.18+0.64*i2/(gx-1))), py=Math.floor(H*(0.18+0.64*j/(gy-1)));
    var dv=dev(px,py); m[j][i2]= (dv!==null&&dv>14)?1:0; if(!m[j][i2])clean++; t++; } }
  var seen=[]; for(j=0;j<gy;j++){ seen[j]=[]; for(i2=0;i2<gx;i2++) seen[j][i2]=0; }
  function flood(a2,b2){ var q=[[a2,b2]]; seen[b2][a2]=1; var c=0;
    while(q.length){ var p=q.pop(); c++; [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(v){ var ni=p[0]+v[0], nj=p[1]+v[1];
      if(ni>=0&&ni<gx&&nj>=0&&nj<gy&&!seen[nj][ni]&&m[nj][ni]===0){ seen[nj][ni]=1; q.push([ni,nj]); } }); } return c; }
  var isl=0,big=0; for(j=0;j<gy;j++)for(i2=0;i2<gx;i2++){ if(m[j][i2]===0&&!seen[j][i2]){ var s=flood(i2,j); isl++; if(s>6)big++; } }
  var allc=0,alln=0; for(var k=1;k<=1200;k++){ var ax=Math.floor(W*(((k*7919)%1199)/1199)), ay=Math.floor(H*(((k*104729)%1187)/1187));
    var av=dev(ax,ay); alln++; if(av!==null&&av<=14)allc++; }
  res(JSON.stringify({R50:cross(0.5),R10:cross(0.1),mono:mono+"/"+steps,cloudCleanPct:(100*clean/t).toFixed(0),bigIslands:big,cleanAllPct:(100*allc/alln).toFixed(0),prof:prof.map(function(v){return Math.round(v)})}));
},5200)})
