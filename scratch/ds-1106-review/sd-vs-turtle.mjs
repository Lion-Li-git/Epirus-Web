/* 独立复核：同一个「攒钱+反弹」原型 vs 困难带冠军 —— 换 终局收缩口径 看胜负怎么变 */
import { readFileSync } from 'node:fs';
import { sandbox, ROOT, humanPrototypes, mulberry32 } from '../../tools/audit-lib.mjs';
import { join } from 'node:path';
const W = sandbox();
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay;
const T = W.EpirusTrainer, P = W.EpirusPolicy, Bots = W.EpirusBots;
const PT = join(ROOT, 'champion-map/pool-members-2p.tsv');
const lines = readFileSync(PT,'utf8').replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split('\n');
const ph = Object.fromEntries(lines[0].split('\t').map((x,i)=>[x,i]));
const byTier = {};
for (const l of lines.slice(1)) { const c = l.split('\t'); if (!c[ph.id]) continue;
  const src = readFileSync(join(ROOT, c[ph.path]),'utf8');
  let m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
  const params = m ? P.unpack(JSON.parse(m[1]), true) : null;
  (byTier[c[ph.tier]] = byTier[c[ph.tier]] || []).push({ id: c[ph.id], params: params });
}
const PROTOS = humanPrototypes(Bots);
const target = PROTOS.find(p => p[2] === 'deepsaver+reflect');
const [, fn] = target;
function run(modeKey, opts, games, seed0) {
  const pool = byTier.hard;
  let win=0, draw=0, lose=0, rounds=0;
  for (let g=0; g<games; g++) {
    const mem = pool[g % pool.length];
    const rng = mulberry32(seed0 + g*13);
    const st = S.createState(modeKey, {next: rng}, 2, opts);
    st.slotSalt = (seed0+g)>>>0;
    const ch = T.policyChooserN(mem.params, 0.15, 0, 5);
    const bot = T.wrapBotN(fn);
    const protoSeat = (g % 2 === 0) ? 0 : 1;
    Play.autoGameN(st, protoSeat===0 ? [bot, ch] : [ch, bot]);
    rounds += st.round;
    if (st.winner === 'draw') draw++; else if (st.winner === protoSeat) win++; else lose++;
  }
  return { modeKey, sd: (opts && opts.suddenDeath != null) ? opts.suddenDeath : ('模式默认(' + ((R.MODES[modeKey].suddenDeath!=null)?R.MODES[modeKey].suddenDeath:(R.SUDDEN_DEATH)) + ')'),
    win, draw, lose, avgR: (rounds/games).toFixed(1), protoScore: (100*(win+0.5*draw)/games).toFixed(1) };
}
const rows = [
  run('standard', undefined, 100, 5000),
  run('standard', {suddenDeath:100, suddenDeathDmg:1}, 100, 5000),
  run('multi', undefined, 100, 5000),
  run('multi', {suddenDeath:100, suddenDeathDmg:1}, 100, 5000),
  run('multi', {suddenDeath:45, suddenDeathDmg:1}, 100, 5000),
];
console.log('# 「攒钱+反弹」原型（人形脚本）vs 困难带 5 枚冠军 · 每格 100 局 · 座位交替');
for (const r of rows) console.log([r.modeKey.padEnd(9,' '), 'sd='+String(r.sd).padEnd(12,' '), '原型 W'+r.win+' D'+r.draw+' L'+r.lose, '得分率 '+r.protoScore+'%', '均'+r.avgR+'回合'].join(' | '));
