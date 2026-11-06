/* 公平口径复跑：冠军按**页面真实剂量**（temp 0.15 ‖ η 斜坡 0/0.05/0.1 ‖ epsK 5）对『攒钱+反弹』 */
import { readFileSync } from 'node:fs';
import { sandbox, ROOT, humanPrototypes, mulberry32 } from '../../tools/audit-lib.mjs';
import { join } from 'node:path';
const W = sandbox();
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
const T = W.EpirusTrainer, P = W.EpirusPolicy, Bots = W.EpirusBots;
const lines = readFileSync(join(ROOT,'champion-map/pool-members-2p.tsv'),'utf8').replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split('\n');
const ph = Object.fromEntries(lines[0].split('\t').map((x,i)=>[x,i]));
const hard = [];
for (const l of lines.slice(1)) { const c = l.split('\t'); if (!c[ph.id] || c[ph.tier] !== 'hard') continue;
  const src = readFileSync(join(ROOT, c[ph.path]),'utf8');
  let m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
  hard.push({ id: c[ph.id], params: P.unpack(JSON.parse(m[1]), true) }); }
const tier = Bots.DIFF_TIERS.find(t => t.id === 'lv:hard');
function pageCaliberChooser(params, N){
  return function(state, pid, legal){
    const eps = Bots.tierEpsAt(tier, N, state.round);
    return T.pickChampion(state, pid, legal.filter(l=>l.affordable), params, 0.15, eps, tier.epsK, tier.epsMode);
  };
}
const proto = humanPrototypes(Bots).find(p => p[2] === 'deepsaver+reflect');
const G = Number(process.argv[2] || 40);
let draws=0, rounds=0; const csk={}, psk={}; let champDmg=0, protoDmg=0, blocked=0, atk=0;
for (let g=0; g<G; g++) {
  const mem = hard[g % hard.length];
  const rng = mulberry32(880000 + g*37);
  const st = S.createState('standard', {next:rng}, 2);
  st.slotSalt = (880000+g)>>>0;
  const protoSeat = (g % 2 === 0) ? 0 : 1;
  const ch = pageCaliberChooser(mem.params, 2);
  const bot = T.wrapBotN(proto[1]);
  Play.autoGameN(st, protoSeat===0 ? [bot, ch] : [ch, bot]);
  rounds += st.round; if (st.winner==='draw') draws++;
  for (const e of st.events) {
    if (e.type==='action' && e.outcome==='ok') { const isCh=(e.pid!==protoSeat); const o=isCh?csk:psk; o[e.key]=(o[e.key]||0)+1; if(isCh&&R.ATK_EFFECT.indexOf(e.key)>=0) atk++; }
    if (e.type==='damage') { if (e.source===protoSeat) protoDmg+=e.amt; else if (e.source!=null) champDmg+=e.amt; }
    if (e.type==='blocked') blocked++;
  }
}
const f=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' x'+v).join(', ');
console.log('# 页面剂量复跑：' + G + ' 局 ‖ 平局 ' + draws + '/' + G + ' ‖ 均 ' + (rounds/G).toFixed(1) + ' 回合');
console.log('冠军: ' + f(csk) + '  ‖ 攻击类出手 ' + atk + ' 次，造成伤害 ' + champDmg.toFixed(1));
console.log('原型: ' + f(psk) + '  ‖ 造成伤害 ' + protoDmg.toFixed(1));
console.log('blocked 事件 ' + blocked);
