
import { readFileSync, writeFileSync } from 'node:fs';
let s = readFileSync('champion-map/index.html', 'utf8');
const probe = '<' + 'script>setTimeout(function(){try{var out=[];for(var i=0;i<N;i++){var d=P[i];if(d.id==="CTRL2-Q-s7"||d.id==="CTRL2-Q-s13"||d.id==="ADAPT2-Q-s7"){out.push(d.id+" vis="+VIS[i]+" scr="+JSON.stringify(scr[i])+" x2="+d.x2+" y2="+d.y2);}}document.title="P:"+out.join(" | ")+" mode="+st.mode+" batch="+st.batch;}catch(e){document.title="ERR "+e.message;}},1500);<' + '/script>';
s = s.replace('</body>', probe + '</body>');
writeFileSync('scratch/ds-1107-def/probe2.html', s);
console.log('ok');
