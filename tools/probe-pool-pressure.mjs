/* 训练池的"压迫度"盘点（v1.5.116 · 第三方复核者）
 * 为什么要它：今夜我的结论是"龟是被**低压迫训练场**奖励出来的"（裸胜率项推的，不是新 shaping 推的）。
 *   这句话的前提是"池子里大多数对手确实不施压"—— 我还没测过，所以它现在只是**推断**。
 *   这个脚本把它变成读数：对池里每个脚本，量它自己的
 *     ① 造成伤害/回合（主动压迫）  ② 它活到第几回合  ③ 它的防御族出手占比（"只挨不打"型？）
 *     ④ **它给对手留多少活路**：4 席它 + 1 席 pickRandom 时，那个随机席的胜率（越高 ⇒ 越不压迫）
 *   第 ④ 项是关键：一个"看起来在打"其实不打人的脚本，①会低而④会高。
 * 用法：node tools/probe-pool-pressure.mjs [GAMES=30] [池名=E|E17|A|C]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, B = sb.window.EpirusBots, A = R.SK;
const N = Number(process.argv[2] || 30);
const POOL_KEY = (process.argv[3] || 'E17').toUpperCase();
const NAMES = {
  E17: 'random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver,ringspam,reflectspam,guardspam,targeter,gunspam',
  E: 'random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver,ringspam,reflectspam,guardspam,targeter',
  HIGH: 'aggro,aggro,heavyfire,heavyfire,gunspam,gunspam,targeter,targeter,combocounter,breakdef,snipespam,mineSpam'.toLowerCase(),
}[POOL_KEY] || POOL_KEY;
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
const BOT = { random: B.pickRandom, balanced: B.pickBalanced, aggro: B.pickAggro, defend: B.pickDefend, wall: B.pickWall,
  antidef: B.pickAntiDef, breakdef: B.pickBreakDef, mix: B.pickMix, farmer: B.pickFarmer, tankline: B.pickTankLine,
  heavyfire: B.pickHeavyFire, deepsaver: B.pickDeepSaver, ringspam: B.pickRingSpam, reflectspam: B.pickReflectSpam,
  guardspam: B.pickGuardSpam, targeter: B.pickTargeter, gunspam: B.pickGunSpam, snipespam: B.pickSnipeSpam,
  minespam: B.pickMineSpam, combocounter: B.pickComboCounter };
const rows = [];
for (const name of NAMES.split(',')) {
  const sel = BOT[name.trim().toLowerCase()];
  if (!sel) { rows.push({ name, err: '不在表里' }); continue; }
  let dealt = 0, rnd = 0, alive = 0, def = 0, dec = 0, randWin = 0, scriptWin = 0;
  for (let g = 0; g < N; g++) {
    /* 构造：0~3 席 = 被测脚本的四个分身，4 席 = pickRandom。
     * 为什么这样摆：要量的两件事都只在"有旁观者"时才看得见 ——
     *   ① 它主动压多少人（0~3 席打出的伤害）；② **它给一个纯随机席留多少活路**（4 席夺冠率）。
     *   一个"看着在打其实不打人"的脚本，①低而④高 —— 这正是要抓的那一类。 */
    const st = S.createState('multi', { next: mb(5150 + g * 991) }, 5);
    st.slotSalt = h32(5150 + g * 2246822519);
    const cs = [];
    for (let i = 0; i < 4; i++) cs.push(T.wrapBotN(function (s2, pid, lg) {
      const r = sel(s2, pid, lg); const k = (typeof r === 'string' ? { key: r } : r).key;
      dec++; if (R.GUARD_FAMILY.indexOf(k) >= 0) def++; return r;
    }));
    cs.push(T.wrapBotN(B.pickRandom));
    Play.autoGameN(st, cs);
    rnd += st.round;
    for (let i = 0; i < 4; i++) if (st.p[i].hp > 0) alive++;
    for (const e of st.events) if (e.type === 'damage' && e.source != null && e.source < 4) dealt += e.amt || 1;
    if (st.winner === 4) randWin++;
    if (st.winner !== 'draw' && st.winner < 4) scriptWin++;
  }
  rows.push({ name: name.trim(), dealt: dealt / N, def: 100 * def / Math.max(1, dec), rounds: rnd / N,
    survive: 100 * alive / (N * 4), randomSeatWins: 100 * randWin / N, scriptWin: 100 * scriptWin / N });
}
rows.sort((a, b) => (a.dealt || 0) - (b.dealt || 0));
console.log(`=== 池 ${POOL_KEY} 的压迫度盘点（${N} 局 multi · 每脚本 4 席 + 1 席 pickRandom）===`);
console.log('  脚本           造成伤害/回合   防御族出手%   存活率%   平均回合   随机席夺冠%（越高=越不压迫）');
console.log('  （构造：0~3 席 = 该脚本四个分身，4 席 = pickRandom；随机席夺冠率高 = 这个脚本不杀人）');
for (const r of rows) {
  if (r.err) { console.log(`  ${r.name.padEnd(14)} ${r.err}`); continue; }
  console.log(`  ${r.name.padEnd(14)} ${r.dealt.toFixed(2).padStart(6)}          ${r.def.toFixed(1).padStart(5)}      ${r.survive.toFixed(1).padStart(5)}    ${r.rounds.toFixed(1).padStart(5)}      ${r.randomSeatWins.toFixed(1)}%  （脚本方 ${(r.scriptWin).toFixed(1)}%）`);
}
const passive = rows.filter(r => !r.err && r.dealt < 1.0);
console.log(`\n  ⇒ 造成伤害/回合 < 1.0 的"低压迫脚本" = ${passive.length} / ${rows.filter(r => !r.err).length}`
  + `：${passive.map(r => r.name).join(', ')}`);
console.log('  （这就是"龟为什么能赢"的环境前提：池子里大半对手不打人 ⇒ 活着本身就是策略）');
