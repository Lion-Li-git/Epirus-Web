/* 独立复核：页面 sdOpts() 把 suddenDeath 覆盖成 100 之后，multi/multi4 的收缩是否还活着 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js']) vm.runInNewContext(readFileSync(f,'utf8'), sb, { filename: f });
const R = sb.EpirusRules, S = sb.EpirusState, X = sb.EpirusResolve, Play = sb.EpirusPlay;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const DEFKEYS = [R.SK.PROTO, R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.JINSHIELD, R.SK.JI];
function defChooser(){ return function(state,pid,legal){ for(const k of DEFKEYS){ const l=legal.find(x=>x.key===k&&x.affordable); if(l) return {key:k}; } return {key:R.SK.JI}; }; }
function mixChooser(rng){ return function(state,pid,legal){ const aff=legal.filter(x=>x.affordable); if(!aff.length) return {key:R.SK.JI};
  // 一半概率攻击、一半概率防御（模拟“有人打有人不打”）
  const atk = aff.filter(x=>R.ATK_EFFECT.indexOf(x.key)>=0);
  const dfn = aff.filter(x=>R.GUARD_FAMILY.indexOf(x.key)>=0);
  const pickFrom = (rng()<0.5 && atk.length) ? atk : (dfn.length?dfn:aff);
  const pick = pickFrom[Math.floor(rng()*pickFrom.length)];
  const opps = S.opponentsOf(state,pid); const t = opps.length? opps[Math.floor(rng()*opps.length)] : null;
  return {key: pick.key, target: (R.byKey[pick.key].target==='self'? null : t)}; }; }

function arm(modeKey, n, usePageOpts, games, chooserFactory, seed0){
  let draws=0, rounds=0, sdC=0, capEnd=0, wipeEnd=0;
  for(let g=0; g<games; g++){
    const rng = mulberry32(seed0+g*17);
    const opts = usePageOpts ? { suddenDeath: 100, suddenDeathDmg: 1 } : undefined;
    const st = S.createState(modeKey, {next: rng}, n, opts);
    st.slotSalt = (seed0*13+g)>>>0;
    const ch = chooserFactory(rng); const chs=[]; for(let i=0;i<n;i++) chs.push(ch);
    Play.autoGameN(st, chs);
    rounds += st.round;
    if (st.winner === 'draw') draws++;
    if (st.events.some(e=>e.type==='hidden'&&e.name==='终局收缩')) sdC++;
    if (st.round >= ((st.mode.maxRounds)||R.MAX_ROUNDS)) capEnd++;
  }
  return { modeKey, n, page: usePageOpts, games, avgRounds:(rounds/games).toFixed(1), draws, sd: sdC, roundCap: capEnd };
}
const rows=[];
for(const [mk,n] of [['multi',5],['multi4',5],['long',5],['multi',2],['standard',2]]){
  for(const page of [false,true]){
    rows.push(arm(mk,n,page,120,mixChooser,777));
    rows.push(arm(mk,n,page,120,()=>defChooser(),888));
  }
}
for(const r of rows) console.log([r.modeKey+'/'+r.n+'p', r.page?'页面sd=100':'引擎默认', 'avgR='+r.avgRounds, 'draw='+r.draws+'/120', 'sd触发='+r.sd, '撞回合上限='+r.roundCap].join(' | '));
console.log('--- 模式自带 suddenDeath ---');
for(const k of Object.keys(R.MODES)) console.log(k, 'sd=', R.MODES[k].suddenDeath, 'maxRounds=', R.MODES[k].maxRounds||R.MAX_ROUNDS);
