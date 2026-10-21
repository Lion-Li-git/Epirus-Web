import { spawn } from 'node:child_process';
const ps=[0.6,0.7,0.8];const tasks=[];
for(const p of ps) tasks.push({p});
const out=[];let next=0;
function runOne(t){return new Promise(res=>{const args=['tools/probe-diff-ladder.mjs','--machine=1','--quiet','--games=1200','--n=5','--mode=multi','--pool=1','--mixadd=lv:sparring>p'+t.p+':2>st:toolkit,st:mix'];const ch=spawn(process.execPath,args,{cwd:'D:/code/Epirus-Web'});let txt='';ch.stdout.on('data',d=>txt+=d);ch.stderr.on('data',d=>txt+=d);ch.on('close',()=>{const m=txt.match(/^\{.*\}$/m);let o=null;try{o=JSON.parse(m[0]);}catch(e){}out.push({p:t.p,rows:o&&o.rows});res();});});}
function worker(){if(next>=tasks.length)return Promise.resolve();const t=tasks[next++];return runOne(t).then(worker);}
Promise.all([worker(),worker()]).then(()=>{console.log(JSON.stringify(out));process.exit(0);});