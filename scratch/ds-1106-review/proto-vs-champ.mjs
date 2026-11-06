/* 独立复核：2P 桌「人类形状原型 vs 困难档冠军」的胜负 —— 直问“困难档对人到底难不难” */
import { readFileSync, existsSync } from 'node:fs';
import { sandbox, ROOT, humanPrototypes, mulberry32 } from '../../tools/audit-lib.mjs';
import { join } from 'node:path';
const W = sandbox();
const R = W.EpirusRules, S = W.EpirusState, X = W.EpirusResolve, Play = W.EpirusPlay;
const T = W.EpirusTrainer, P = W.EpirusPolicy, Bots = W.EpirusBots, PD = W.EpirusPoolDraw;

const PT = join(ROOT, 'champion-map/pool-members-2p.tsv');
const lines = readFileSync(PT,'utf8').replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split('\n');
const ph = Object.fromEntries(lines[0].split('\t').map((x,i)=>[x,i]));
const MEMBERS = [];
for (const l of lines.slice(1)) { const c = l.split('\t'); if (!c[ph.id]) continue;
  const src = readFileSync(join(ROOT, c[ph.path]),'utf8');
  let m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
  const params = m ? P.unpack(JSON.parse(m[1]), true) : null;
  MEMBERS.push({ id: c[ph.id], tier: c[ph.tier], params: params });
}
const byTier = {}; for (const m of MEMBERS) (byTier[m.tier]=byTier[m.tier]||[]).push(m);
console.log('# 2P 池 = ' + Object.keys(byTier).map(t=>t+' '+byTier[t].length).join(' ‖ '));

const PROTOS = humanPrototypes(Bots);
function champChooser(params){
  const base = T.policyChooserN(params, 0.15, 0, 5);
  return function(state,pid,legal){ return base(state,pid,legal); };
}
function botChooser(fn){ return T.wrapBotN(fn); }

function play(n0, n1, seed, opts){
  const rng = mulberry32(seed);
  const st = S.createState('standard', {next: rng}, 2, opts);
  st.slotSalt = seed>>>0;
  Play.autoGameN(st, [n0, n1]);
  return st;
}

const GAMES = Number(process.argv[2] || 160);
const tier = process.argv[3] || 'hard';
const CTRL = process.argv[4] === 'ctrl';
const pool = byTier[tier] || [];
if (!pool.length) { console.log('⛔ 该带没有成员：' + tier); process.exit(2); }
const rows = [];
if (CTRL) {
  // 对照：冠军 vs 冠军（同带不同枚），应当接近五五开
  const pool0 = byTier[tier] || [];
  let w=0,d=0,l=0,rr=0;
  for (let g=0; g<GAMES; g++) {
    const a = pool0[g % pool0.length], b = pool0[(g+1) % pool0.length];
    const rng = mulberry32(120000+g*11);
    const st = S.createState('standard', {next:rng}, 2);
    st.slotSalt = (120000+g)>>>0;
    Play.autoGameN(st, [champChooser(a.params), champChooser(b.params)]);
    rr += st.round;
    if (st.winner==='draw') d++; else if (st.winner===0) w++; else l++;
  }
  console.log('# 对照 ' + tier + ' 冠军 vs 冠军：' + 'W'+w+' D'+d+' L'+l + ' 均' + (rr/GAMES).toFixed(1) + '回合');
}
for (const [name, fn, id] of PROTOS) {
  let win=0, draw=0, lose=0, rounds=0;
  for (let g=0; g<GAMES; g++) {
    const seatIsProto0 = (g % 2 === 0);
    const mem = pool[g % pool.length];
    const rng = mulberry32(90000 + g*7 + tier.length);
    const st = S.createState('standard', {next: rng}, 2);
    st.slotSalt = (90000+g)>>>0;
    const ch = champChooser(mem.params);
    const bot = botChooser(fn);
    Play.autoGameN(st, seatIsProto0 ? [bot, ch] : [ch, bot]);
    const protoSeat = seatIsProto0 ? 0 : 1;
    rounds += st.round;
    if (st.winner === 'draw') draw++;
    else if (st.winner === protoSeat) win++; else lose++;
  }
  rows.push({ proto: name, win: win, draw: draw, lose: lose, wr: ((win + 0.5*draw)/GAMES*100).toFixed(1), avgR: (rounds/GAMES).toFixed(1) });
}
console.log('# 2P standard · 原型（人形脚本）× 困难带冠军池 · ' + GAMES + ' 局/行（座位交替）');
for (const r of rows) console.log([r.proto.padEnd(16,' '), 'W'+String(r.win).padStart(4), 'D'+String(r.draw).padStart(4), 'L'+String(r.lose).padStart(4), '得分率 '+r.wr+'%', '均' + r.avgR + '回合'].join(' | '));