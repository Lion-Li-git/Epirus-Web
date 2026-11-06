(function(){
  var old=VIS.slice(),oldN=NVIS,oldVK=VK,oldFL=FL,ids=[];for(var i=0;i<N;i++)if(inWin(P[i]))ids.push(i);
  var out=[];
  [1,2,12].forEach(function(k){VIS.fill(0);for(var j=0;j<k&&j<ids.length;j++)VIS[ids[j]]=1;NVIS=Math.min(k,ids.length);VK=null;FL=null;draw();var bad=0;for(var q=0;q<FL.px.length;q++)if(!isFinite(FL.px[q]))bad++;out.push({want:k,shown:FL.nShown,painted:FL.painted,oob:FL.oob,nonFinite:bad});});
  for(var z=0;z<N;z++)VIS[z]=old[z];NVIS=oldN;VK=oldVK;FL=oldFL;draw();return JSON.stringify(out);
})()