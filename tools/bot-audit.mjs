/* 训练对手可玩性审计：逐个量强度 / 出招分布 / 局均回合，用于挑选给玩家的"风格"。
 * 用法：node tools/bot-audit.mjs [每档局数=40] [人数=3]
 * 判据：极端 = 出招种类极少（熵低）或回合数异常（拖/秒）；可玩 = 有主线技能但仍在用人话打牌。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const GAMES = parseInt(process.argv[2] || '40', 10);
const N = parseInt(process.argv[3] || '3', 10);
const sb={console,Math,JSON,Object,Array,Number,String,Error,Infinity,isNaN,parseInt,parseFloat,Float64Array,Date,window:{},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}};
sb.globalThis=sb;
for(const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js'])vm.runInNewContext(readFileSync(f,'utf8'),sb,{filename:f});
const W=sb.window,R=W.EpirusRules,B=W.EpirusBots,T=W.EpirusTrainer;
const FN={random:'pickRandom',balanced:'pickBalanced',aggro:'pickAggro',defend:'pickDefend',wall:'pickWall',antidef:'pickAntiDef',breakdef:'pickBreakDef',mix:'pickMix',reflectspam:'pickReflectSpam',guardspam:'pickGuardSpam',baguaspam:'pickBaguaSpam',combocounter:'pickComboCounter',farmer:'pickFarmer',tankline:'pickTankLine',heavyfire:'pickHeavyFire',guardgun:'pickGuardGun',protowall:'pickProtoWall',whiff:'pickWhiff',reflectmix:'pickReflectMix',reflecttank:'pickReflectTank',defreflectgun:'pickDefReflectGun'};
const rows=[];
for(const nm of Object.keys(FN)){
  const use={}; let dec=0, first=0, total=0, rd=0;
  const probe=(state,pid,legal)=>{
    const k=B[FN[nm]](state,pid,legal);
    if(pid===0){ const kk=(typeof k==='string')?k:k.key; use[kk]=(use[kk]||0)+1; dec++; }
    return k;
  };
  for(let g=0;g<GAMES;g++){
    const seat=g%N; const ch=[]; let oi=0;
    for(let pid=0;pid<N;pid++){ if(pid===seat) ch.push(probe); else { ch.push(T.wrapBotN(B[pid===((seat+1)%N)?'pickRandom':'pickBalanced'])); oi++; } }
    const r=T.oneGameN(ch,880001+g*977+total,N);
    if(T.rankOf(r.state,seat)===1) first++;
    rd+=r.rounds; total++;
  }
  let H=0; for(const k in use){const p=use[k]/dec;H-=p*Math.log(p);}
  const ks=Object.keys(use).sort((a,b)=>use[b]-use[a]);
  rows.push({nm, first:first/total, avgR:rd/total, eff:Math.exp(H), top:ks.slice(0,3).map(k=>(R.byKey[k]?R.byKey[k].name:k)+' '+(use[k]/dec*100).toFixed(0)+'%').join(' / ')});
}
rows.sort((a,b)=>b.first-a.first);
console.log('对手'.padEnd(16)+'1st'.padEnd(8)+'均回合'.padEnd(9)+'有效技能数'.padEnd(11)+'主线出招');
for(const r of rows){
  console.log(r.nm.padEnd(16)+(r.first*100).toFixed(0).padStart(3)+'%    '+r.avgR.toFixed(1).padStart(5)+'    '+r.eff.toFixed(2).padStart(6)+'      '+r.top);
}
