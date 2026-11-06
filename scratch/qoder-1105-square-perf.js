(function(){
  var nb=NBK[FL.key],out={initial:{grid:[nb.gx,nb.gy],cells:FL.cells,bitmapBuilds:(window.__covdbg||[]).length,nbKeys:Object.keys(NBK).length}};
  var oldNB=buildNB,oldBM=buildBitmap,nnb=0,nbm=0;
  buildNB=function(){nnb++;return oldNB.apply(this,arguments)};buildBitmap=function(){nbm++;return oldBM.apply(this,arguments)};
  var t=performance.now();FL=null;draw();out.bitmapOnly={ms:performance.now()-t,nbCalls:nnb,bmCalls:nbm};
  var bg=st.bg;t=performance.now();setBg('#05070d');draw();out.bgChange={ms:performance.now()-t,nbCalls:nnb,bmCalls:nbm,nbKeys:Object.keys(NBK).length};
  setBg(bg);draw();
  t=performance.now();NBK={};VK=null;FL=null;draw();out.fullRebuild={ms:performance.now()-t,nbCalls:nnb,bmCalls:nbm};
  buildNB=oldNB;buildBitmap=oldBM;
  var xa=P.map(function(d){return d.x2}),ya=P.map(function(d){return d.y2}),x0=Math.min.apply(null,xa),x1=Math.max.apply(null,xa),y0=Math.min.apply(null,ya),y1=Math.max.apply(null,ya),w=cv.width,h=cv.height;
  var bx=w/(PV.x1-PV.x0)*.9,by=h/(PV.y1-PV.y0)*.86,st0=Math.min(bx,by),sf=Math.min(w/(x1-x0)*.9,h/(y1-y0)*.86);
  function proposal(s){var side=Math.max((x1-x0)*s,(y1-y0)*s)*1.7,g=Math.round(side/4);return {scale:s,pointSpan:[(x1-x0)*s,(y1-y0)*s],fieldSide:side,grid:[g,g],cells:g*g}}
  out.coordinates={canvas:[w,h],trimmedPV:PV,fullRange:[x1-x0,y1-y0],currentScale:[bx,by],uniformTrimmed:proposal(st0),uniformAllPoints:proposal(sf)};
  return JSON.stringify(out);
})()