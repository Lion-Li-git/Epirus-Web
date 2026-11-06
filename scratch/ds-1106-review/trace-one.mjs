/* 独立复核：抽一局『攒钱+反弹 vs 困难冠军』的平局，打印双方出手谱 */
import { readFileSync } from 'node:fs';
import { sandbox, ROOT, humanPrototypes, mulberry32 } from '../../tools/audit-lib.mjs';
import { join } from 'node:path';
const W = sandbox();
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
const T = W.EpirusTrainer, P = W.EpirusPolicy, Bots = W.EpirusBots;
const lines = readFileSync(join(ROOT,'champion-map/pool-members-2p.tsv'),'utf8').replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split('\n');
const ph = Object.fromEntries(lines[0].split('\t').map((x,i)=>[x,i]));
let mem = null;
for (const l of lines.slice(1)) { const c = l.split('\t'); if (!c[ph.id] || c[ph.tier] !== 'hard') continue;
  const src = readFileSync(join(ROOT, c[ph.path]),'utf8');
  let m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
  mem = { id: c[ph.id], params: P.unpack(JSON.parse(m[1]), true) }; break; }
const proto = humanPrototypes(Bots).find(p => p[2] === 'deepsaver+reflect');
const rng = mulberry32(555001);
const st = S.createState('standard', {next:rng}, 2);
st.slotSalt = 555001;
Play.autoGameN(st, [T.wrapBotN(proto[1]), T.policyChooserN(mem.params, 0.15, 0, 5)]);
console.log('# 冠军包 = ' + mem.id + ' ‖ winner = ' + st.winner + ' ‖ round = ' + st.round);
console.log('# 终局 HP = ' + st.p.map(p=>p.hp).join(' / ') + ' ‖ 终局 EP = ' + st.p.map(p=>p.ep).join(' / '));
const cnt = [[],[]];
for (const e of st.events) if (e.type === 'action' && e.outcome === 'ok') cnt[e.pid].push(e.key);
for (let i=0;i<2;i++){ const m2={}; for(const k of cnt[i]) m2[k]=(m2[k]||0)+1;
  console.log((i===0?'原型座':'冠军座') + ' 出手 ' + cnt[i].length + ' 次：' + Object.entries(m2).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+'x'+v).join(' ')); }
// 最后 8 回合逐手
const acts = st.events.filter(e=>e.type==='action'&&e.outcome==='ok');
console.log('# 末 10 手：' + acts.slice(-10).map(e=>'P'+e.pid+':'+e.key).join(' → '));
const dmg = st.events.filter(e=>e.type==='damage');
console.log('# 伤害事件 ' + dmg.length + ' 条：' + dmg.map(e=>'P'+e.to+'-'+e.amt+'('+e.via+')').slice(-14).join(' '));
