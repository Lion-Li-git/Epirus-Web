/* 独立复核：跨配置不变量模糊测试（DS · 2026-11-06 夜。只读引擎，不改仓库）
 * 玩法：每个 (mode,n) 跑 G 局随机合法策略；检查不变量。
 * 另跑一档『全员只防御/攒钱』测拖延与平局。 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js']) vm.runInNewContext(readFileSync(f,'utf8'), sb, { filename: f });
const R = sb.EpirusRules, S = sb.EpirusState, X = sb.EpirusResolve, Play = sb.EpirusPlay;

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const CONF = [
  ['standard',2],['multi',2],['multi4',2],['long',2],
  ['multi',3],['multi4',3],['long',3],
  ['multi',4],['multi4',4],['long',4],
  ['multi',5],['multi4',5],['long',5],
  ['multi',6],['multi',7],['multi',8],['long',8],['multi4',8]
];

function mkRand(seed){ const r = mulberry32(seed); return { next: r }; }

// 随机合法策略：从 legal 里挑可负担的；目标随机；双目标技能给两个不同对手
function randChooser(rng, mode) {
  return function (state, pid, legal) {
    const aff = legal.filter(function(x){return x.affordable;});
    if (!aff.length) return { key: R.SK.JI };
    const pick = aff[Math.floor(rng()*aff.length)];
    const def = R.byKey[pick.key];
    let t = null, t2 = null;
    if (def.target !== 'self') {
      const opps = S.opponentsOf(state, pid);
      if (opps.length) t = opps[Math.floor(rng()*opps.length)];
    }
    if (def.target2) {
      const opps = S.opponentsOf(state, pid).filter(function(o){return o!==t;});
      if (opps.length) t2 = opps[Math.floor(rng()*opps.length)];
    }
    let bead = null;
    if (pick.key === R.SK.CHARGE) bead = rng() < 0.5 ? 'elec' : 'boom';
    return { key: pick.key, target: t, target2: t2, bead: bead };
  };
}

// 纯防御策略：只出 防御/反弹/八卦阵/原型制御/金刚盾/ジ/蓄能（能出就出防御，否则ジ）
const DEFKEYS = [R.SK.PROTO, R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.JINSHIELD];
function defChooser() {
  return function (state, pid, legal) {
    for (const k of DEFKEYS) { const l = legal.find(function(x){return x.key===k && x.affordable;}); if (l) return { key: k }; }
    return { key: R.SK.JI };
  };
}

function check(state, cfg, mode) {
  const bad = [];
  for (let i=0;i<state.p.length;i++) {
    const p = state.p[i];
    if (!isFinite(p.hp)) bad.push('hp NaN pid'+i);
    if (p.ep < 0) bad.push('ep<0 pid'+i+' ep='+p.ep);
    if (p.elec < 0 || p.elec > 1) bad.push('elec oob pid'+i+' '+p.elec);
    if (p.boom < 0 || p.boom > 1) bad.push('boom oob pid'+i+' '+p.boom);
    if (p.hp > mode.hp + 2) bad.push('hp over max pid'+i+' '+p.hp);
    const cd = p.cooldown || {};
    for (const k of Object.keys(cd)) if (cd[k] < 0 || cd[k] > 4) bad.push('cooldown oob '+k+'='+cd[k]);
    if (p.ringStreak < 0) bad.push('ringStreak<0');
    if (p.mineTurns < 0 || p.mineTurns > 3) bad.push('mineTurns oob '+p.mineTurns);
    if (p.cannonCount < 0 || p.cannonCount > 3) bad.push('cannonCount oob '+p.cannonCount);
  }
  if (state.round > ((state.mode && state.mode.maxRounds) || R.MAX_ROUNDS) + 1) bad.push('round over cap '+state.round);
  for (const e of state.events) {
    if (e.type === 'action' && e.outcome === 'ok') {
      const pp = state.p[e.pid];
      if (!pp) bad.push('action unknown pid');
    }
    if (e.type === 'death') { const pp = state.p[e.pid]; if (pp && pp.hp > 0 && !pp.reviveNext) bad.push('death while hp>0 pid'+e.pid); }
  }
  return bad;
}

function runOne(modeKey, n, g, policy, seedBase) {
  const mode = R.MODES[modeKey];
  const st = S.createState(modeKey, mkRand(seedBase+g), n);
  st.slotSalt = (seedBase*31+g)>>>0;
  const rng = mulberry32(seedBase*7+g*13);
  const ch = policy(rng, mode);
  const chs = []; for (let i=0;i<n;i++) chs.push(ch);
  let err = null;
  try { Play.autoGameN(st, chs, null, null, null); } catch (e) { err = e && e.message; }
  return { st: st, err: err };
}

const G = Number(process.argv[2] || 200);
const POL = (process.argv[3] === 'def') ? function(){ return defChooser(); } : randChooser;
const rows = [];
for (const [modeKey, n] of CONF) {
  if (!R.MODES[modeKey]) { rows.push({cfg:modeKey+'/'+n, note:'mode 不存在'}); continue; }
  const mode = R.MODES[modeKey];
  let errs = {}, bads = {}, rounds = 0, draws = 0, sd = 0, dur = 0;
  for (let g=0; g<G; g++) {
    const t0 = process.hrtime.bigint();
    const res = runOne(modeKey, n, g, POL, 1000+ (modeKey.length*97+n*7));
    dur += Number(process.hrtime.bigint()-t0)/1e6;
    if (res.err) { errs[res.err] = (errs[res.err]||0)+1; continue; }
    const b = check(res.st, modeKey, mode);
    for (const x of b) bads[x.replace(/[0-9]+/g,'#')] = (bads[x.replace(/[0-9]+/g,'#')]||0)+1;
    rounds += res.st.round;
    if (res.st.winner === 'draw') draws++;
    if (res.st.events.some(function(e){return e.type==='hidden'&&e.name==='终局收缩';})) sd++;
  }
  rows.push({ cfg: modeKey+'/'+n+'p', games: G, err: Object.keys(errs).length?errs:'-', inv: Object.keys(bads).length?bads:'-', avgRounds: (rounds/G).toFixed(1), draws: draws, suddenDeath: sd, msPerGame: (dur/G).toFixed(1) });
}
console.log(JSON.stringify(rows, null, 1));