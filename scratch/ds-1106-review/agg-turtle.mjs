/* 独立复核：40 局「攒钱+反弹」vs 困难带冠军 —— 冠军出招谱 + 实际造成伤害 */
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
const proto = humanPrototypes(Bots).find(p => p[2] === 'deepsaver+reflect');
const G = 40;
const champSkills = {}, protoSkills = {};
let rounds = 0, champDmg = 0, protoDmg = 0, blocked = 0, champAtk = 0, draws = 0;
for (let g=0; g<G; g++) {
  const mem = hard[g % hard.length];
  const rng = mulberry32(730000 + g*29);
  const st = S.createState('standard', {next:rng}, 2);
  st.slotSalt = (730000+g)>>>0;
  const protoSeat = (g % 2 === 0) ? 0 : 1;
  const ch = T.policyChooserN(mem.params, 0.15, 0, 5);
  const bot = T.wrapBotN(proto[1]);
  Play.autoGameN(st, protoSeat===0 ? [bot, ch] : [ch, bot]);
  rounds += st.round;
  if (st.winner === 'draw') draws++;
  for (const e of st.events) {
    if (e.type === 'action' && e.outcome === 'ok') {
      const isCh = (e.pid !== protoSeat);
      const tgt = isCh ? champSkills : protoSkills;
      tgt[e.key] = (tgt[e.key]||0)+1;
      if (isCh && R.ATK_EFFECT.indexOf(e.key) >= 0) champAtk++;
    }
    if (e.type === 'damage') {
      if (e.source === protoSeat) protoDmg += e.amt;
      else if (e.source != null) champDmg += e.amt;
    }
    if (e.type === 'blocked') blocked++;
  }
}
function fmt(o){ return Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' x'+v).join(', '); }
console.log('# ' + G + ' 局（座位交替）‖ 平局 ' + draws + '/' + G + ' ‖ 均 ' + (rounds/G).toFixed(1) + ' 回合');
console.log('冠军出招谱: ' + fmt(champSkills));
console.log('  其中攻击类出手 ' + champAtk + ' 次，真正造成伤害 ' + champDmg.toFixed(1) + ' 点（每局 ' + (champDmg/G).toFixed(2) + '）');
console.log('原型出招谱: ' + fmt(protoSkills));
console.log('  原型对冠军造成 ' + protoDmg.toFixed(1) + ' 点（每局 ' + (protoDmg/G).toFixed(2) + '）');
console.log('blocked 事件总数 ' + blocked + '（每局 ' + (blocked/G).toFixed(1) + '）');
