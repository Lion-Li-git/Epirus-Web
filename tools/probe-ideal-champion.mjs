/* 理想冠军规格的**逐条量具**（v1.5.204 · 只读，不训练、不落盘）
 *
 * 用户 2026-09-24 与千问分析出的「理想冠军」7 条 —— 规格与逐条读数记在 docs/METHODOLOGY.md 第 46 条。
 * 本工具把每一条变成**能在现役包上直接读出来的数**，免得"理想"停在一张表上。
 *
 * 用法：node tools/probe-ideal-champion.mjs [--pack=js/bundled-champion-3p.js] [--games=200] [--mode=multi]
 *
 * 口径：
 *   1 会为大招攒钱   = **大雷原生出手/局**（镜场 + 脚本池两处；不注入任何补贴/示范）
 *   2 按姿态换线     = 同一包在 def 场与 nodef 场的 **1st 差**（pt）
 *   3 会清场不是拖平 = 破防场（4 席只防御不还手）**受评席 1st 与平局率**
 *   4 ≥2 回合序列   = 每局"第 t 回合蓄能(电珠) → 第 t+1 回合电磁炮"的完成率（珠只保留到下一回合）
 *   5 座位无偏       = seatSymmetry 的极差 vs **该 n 的零分布 p99 线**（v1.5.202 新口径）
 *   6 广度当约束     = 出手 G 与**净兑现 G**、**打上血的不同卡数**
 *   7 不要的两条     = ① 有多少张"能造成伤害的卡"从未被挡过；② 镜像场设防率
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { seatSymmetry } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const GAMES = Number(arg('games', 200));
const MODE = arg('mode', 'multi');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', PACK]) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const R = sb.EpirusRules, S = sb.EpirusState, T = sb.EpirusTrainer, B = sb.EpirusBots, Pol = sb.EpirusPolicy, Play = sb.EpirusPlay;
const live = Pol.unpack(sb.EPIRUS_CHAMPION_3P, true) || Pol.unpack(sb.EPIRUS_CHAMPION, true);
if (!live) { console.log('✗ 读不出包：' + PACK); process.exit(1); }

function mulberry32(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = x => (100 * x).toFixed(1) + '%';
const f2 = x => (x == null ? 'n/a' : x.toFixed(2));
const GUARD_FAMILY = [R.SK.GUARD, R.SK.REFLECT, R.SK.BAGUA, R.SK.JINSHIELD, R.SK.ARMOR, R.SK.PROTO, R.SK.HOLO];

/* 一个场地：受评席 = g%5，其余 4 席由 makeOpp 给；逐决策记录**受评席**的出招（带回合号） */
function runField(name, games, makeOpp, seedBase) {
  const D = { name: name, games: games, first: 0, draw: 0, alive: 0, dec: 0 };
  const bigT = { n: 0 }, railgun = { n: 0 }, charge = { n: 0 }, defDec = { n: 0 }, allDec = { n: 0 };
  const usage = {};
  let seqGames = 0, seqTotal = 0;
  const dmgVia = new Set(), blockedVia = new Set();
  for (let g = 0; g < games; g++) {
    const seat = g % 5;
    const st = S.createState(MODE, { next: mulberry32(seedBase + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const log = [];
    const ch = [];
    for (let i = 0; i < 5; i++) {
      if (i !== seat) { ch.push(makeOpp(i, seedBase + g)); continue; }
      const inner = T.policyChooserN(live, 0.15);
      ch.push(function (state, pid, legal) {
        const a = inner(state, pid, legal);
        log.push({ round: state.round, key: a && a.key });
        return a;
      });
    }
    Play.autoGameN(st, ch);
    for (const d of log) {
      allDec.n++;
      if (d.key === R.SK.BIG_T) bigT.n++;
      if (d.key === R.SK.RAILGUN) railgun.n++;
      if (d.key === R.SK.CHARGE) charge.n++;
      if (GUARD_FAMILY.indexOf(d.key) >= 0) defDec.n++;
      if (d.key) usage[d.key] = (usage[d.key] || 0) + 1;
    }
    /* 序列：第 t 回合蓄能 → 第 t+1 回合电磁炮 */
    let seq = 0;
    for (let i = 0; i < log.length; i++) {
      if (log[i].key !== R.SK.CHARGE) continue;
      for (let j = i + 1; j < log.length; j++) {
        if (log[j].round === log[i].round + 1 && log[j].key === R.SK.RAILGUN) { seq++; break; }
        if (log[j].round > log[i].round + 1) break;
      }
    }
    if (seq) seqGames++;
    seqTotal += seq;
    for (const e of st.events) {
      if (e.type === 'damage' && e.via) dmgVia.add(e.via);
      if (e.type === 'blocked' && e.via) blockedVia.add(e.via);
    }
    if (st.winner === 'draw' || st.winner == null) D.draw++; else { D.dec++; if (st.winner === seat) D.first++; }
    if (st.p[seat] && st.p[seat].hp > 0) D.alive++;
  }
  D.firstRate = D.dec ? D.first / D.dec : 0;
  D.firstAll = D.first / games;
  D.drawRate = D.draw / games;
  D.aliveRate = D.alive / games;
  D.bigTPerGame = bigT.n / games;
  D.railgunPerGame = railgun.n / games;
  D.chargePerGame = charge.n / games;
  D.defRate = allDec.n ? defDec.n / allDec.n : 0;
  D.seqPerGame = seqTotal / games;
  D.seqGameRate = seqGames / games;
  D.allDec = allDec.n; D.defDecN = defDec.n; D.usage = usage;
  D.dmgVia = dmgVia; D.blockedVia = blockedVia;
  return D;
}

const guardOpp = function () { return function (s2, p2, lg) { return B.pickGuardSpam(s2, p2, lg); }; };
const gunOpp = function () { return function (s2, p2, lg) { return B.pickGunSpam(s2, p2, lg); }; };
const balOpp = function () { return function (s2, p2, lg) { return B.pickBalanced(s2, p2, lg); }; };
const defOpp = function () { return function (s2, p2, lg) { return B.pickDefend(s2, p2, lg); }; };

console.log('=== 理想冠军规格 · 现役包实测（' + PACK + ' · ' + MODE + ' · 每场 ' + GAMES + ' 局）===\n');
const mirror = runField('镜像(5 席同包)', GAMES, function () { const inner = T.policyChooserN(live, 0.15); return inner; }, 31000);
const pool = runField('脚本池(gun+balanced)', GAMES, gunOpp, 32000);
const nodef = runField('不防场(4×只枪)', GAMES, gunOpp, 33000);
const def = runField('会防场(4×防御)', GAMES, guardOpp, 34000);
const wall = runField('破防场(4×只防御不还手)', Math.min(GAMES, 120), guardOpp, 35000);
/* v1.5.204：原来的"会防场"用 4×pickDefend ⇒ 实测 **100% 平局**（谁都打不死谁）⇒ 1st 不可判。
 * 补一个**能分出胜负**的会防场：2 席防御 + 2 席只枪。*/ 
const defMix = runField('会防场(2 防御 + 2 只枪)', GAMES, function (i) { return (i % 2) ? gunOpp : defOpp; }, 36000);

console.log('【1】会为大招攒钱（跨期选择）—— 阈值：原生 大雷 ≥0.15 次/局');
for (const d of [mirror, pool, nodef, def]) console.log('   ' + d.name.padEnd(22) + ' 大雷 ' + f2(d.bigTPerGame) + ' 次/局   电磁炮 ' + f2(d.railgunPerGame) + '   蓄能 ' + f2(d.chargePerGame));

console.log('\n【2】按对手姿态换线 —— 阈值：def 场与 nodef 场 1st 差 ≤5pt');
console.log('   def 场（4×纯防御，实测 100% 平局 ⇒ **不可判**）1st 名义 = ' + pct(def.firstRate) + '（判胜 ' + def.dec + '/' + def.games + '）');
console.log('   nodef 场 1st = ' + pct(nodef.firstRate) + '（判胜 ' + nodef.dec + '/' + nodef.games + '）');
console.log('   **会防场(2 防御 + 2 只枪)** 1st = ' + pct(defMix.firstRate) + '（判胜 ' + defMix.dec + '/' + defMix.games + '）');
console.log('   出招份额（受评席）—— 只枪场 → 会防场(2 防 2 枪)：');
{
  const ks = new Set([...Object.keys(nodef.usage), ...Object.keys(defMix.usage)]);
  const rows = [];
  for (const k of ks) { const a = (nodef.usage[k] || 0) / nodef.allDec, b = (defMix.usage[k] || 0) / defMix.allDec; rows.push([R.byKey[k] ? R.byKey[k].name : k, a, b, b - a]); }
  rows.sort(function (x, y) { return Math.abs(y[3]) - Math.abs(x[3]); });
  for (const r of rows.slice(0, 7)) console.log('     ' + String(r[0]).padEnd(8) + ' 只枪场 ' + pct(r[1]).padStart(7) + '  会防场 ' + pct(r[2]).padStart(7) + '   Δ ' + (r[3] >= 0 ? '+' : '') + (100 * r[3]).toFixed(1) + 'pt');
}
console.log('   ⇒ 位移越大越像"按姿态换线"；全 0 位移 = 对姿态无反应');

console.log('\n【3】会清场，不是拖平 —— 阈值：破防场 受评席 ≥50% 胜');
console.log('   破防场 受评席 1st = ' + pct(wall.firstRate) + '  平局率 = ' + pct(wall.drawRate) + '  终场存活 = ' + pct(wall.aliveRate) + '（' + wall.games + ' 局）');

console.log('\n【4】能完成 ≥2 回合序列（蓄能[电珠] → 下一回合电磁炮）—— 阈值：>0.5 次/局');
for (const d of [mirror, pool, nodef]) console.log('   ' + d.name.padEnd(22) + ' 完成率 ' + f2(d.seqPerGame) + ' 次/局（有序列的局占比 ' + pct(d.seqGameRate) + '）');

console.log('\n【5】座位无偏 —— 阈值：极差 ≤10pt（仓里 v1.5.202 起改用"该 n 的零分布 p99"作线）');
for (const n of [100, 400]) {
  const r = seatSymmetry(sb, live, MODE, n);
  console.log('   n=' + String(n).padStart(3) + '  各座 ' + r.pct.map(x => x.toFixed(1)).join('/') + '  极差 ' + r.spread.toFixed(1) + 'pt  仓线 ' + r.spreadLine.toFixed(1) + 'pt  ⇒ ' + r.verdict + (r.spread <= 10 ? '（≤10pt ✓）' : '（>10pt ✗ 按理想规格）'));
}

console.log('\n【6】广度当约束不当目标 —— 阈值：净兑现 G≥3 且 ≥4 种打上血');
{
  const mh = T.mirrorHealth(live, 400, 5, MODE);
  const lk = Object.keys(mh.landByKey || {}).filter(function (k) { return !/[\u4e00-\u9fa5]/.test(k) && ['headshot', 'dream', 'chain', 'counter', 'taunt'].indexOf(k) < 0; });
  console.log('   出手 G = ' + f2(mh.effSkills) + '（出手卡 ' + mh.distinctKeys + ' 种）');
  console.log('   净兑现 G = ' + f2(mh.effSkillsLand) + '（打上血的卡 ' + (mh.landedKeys != null ? mh.landedKeys : lk.length) + ' 种 · 落地次数 ' + mh.landedTotal + '）');
  console.log('   ⇒ ' + (mh.effSkillsLand >= 3 && (mh.landedKeys || lk.length) >= 4 ? '达标' : '未达标（净兑现 ' + f2(mh.effSkillsLand) + ' < 3 或种类 < 4）'));
}

console.log('\n【7】不要的两条');
{
  const all = [mirror, pool, nodef, def, wall];
  const dmg = new Set(); const blk = new Set();
  for (const d of all) { for (const k of d.dmgVia) dmg.add(k); for (const k of d.blockedVia) blk.add(k); }
  const canon = Array.from(dmg).filter(function (k) { return !/[\u4e00-\u9fa5]/.test(k) && ['headshot', 'dream', 'chain', 'counter', 'taunt'].indexOf(k) < 0; });
  const never = canon.filter(function (k) { return !blk.has(k); });
  console.log('   ① 在这些场地里造成过伤害的卡 ' + canon.length + ' 张，其中**从未被挡过**的 ' + never.length + ' 张');
  console.log('      （被挡过的只有：' + (Array.from(blk).filter(k => !/[\u4e00-\u9fa5]/.test(k)).join(', ') || '无') + '）');
  console.log('      从未被挡：' + never.join(', '));
  console.log('   ② 镜像场设防率 = ' + pct(mirror.defRate) + '（' + mirror.allDec + ' 次决策，其中防御类 ' + mirror.defDecN + ' 次）—— "逼防"若不存在则应为 0%');
  console.log('      其余场地设防率：不防场 ' + pct(nodef.defRate) + ' · 会防场 ' + pct(def.defRate) + ' · 破防场 ' + pct(wall.defRate));
}
