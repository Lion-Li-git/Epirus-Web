/* E23 · 「防御免费」是不是这棵树的根？（09-26 夜班 · Qoder · **只读 + 内存补丁，仓库一字不动**）
 *
 * 用户报的两条病（有钱就转防、维持很久；空蓄能）都在**训练侧**打过很多刀（击杀奖励/序列奖励/上桌/SEL_LAND）。
 * 本探针问的是另一个方向：`rules.js` 里防御族**费用 = 0 ep** ⇒ "维持防御"不要预算。
 *   若把它定价，病是消失、变弱，还是换来另一种塌缩？
 * 三档：`off`（对照，必须与不打补丁逐字相同）· `L1`（只罚同席**连续第 2 次起**的防御）· `L2`（每次防御都扣）
 * 两栏读数一起印，缺一栏就是不合格的读数：
 *   【病】攒钱者装配（1 席 hold + 4 席被评包 · 产品口径）：设防率 / `ep≥10` 桶 / 连防 / 局长 / 平局 / 攒钱者夺冠
 *   【强度】门的单一来源 `feasibilityOf` + `mirrorHealth` 的净兑现 + 破防场 `fieldRate`
 *
 * 用法：node tools/probe-guard-cost.mjs [--packs=a,b] [--games=60] [--cost=1] [--modes=off,L1,L2] [--feas-games=10]
 *       [--guardSeat=1]  ← 把 L1/L2 只作用在"被评包那 4 席"（默认 0 = 全桌，含替身 ⇒ 那是另一种对照）
 */
import { readFileSync, readdirSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';
import { feasibilityOf, selfPlay, reflectWall, aggressionProfile, seatSymmetry, densityProfile, chargeProfile, rejectUnknownFlags } from './audit-lib.mjs';
import { makeGuardCost, formatGuardCost, buildGuarded } from './guard-cost-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'cost', 'modes', 'feas-games', 'temp', 'eps', 'epsk', 'epsmode', 'seed', 'guardSeat', 'limit', 'every', 'quiet'], 'probe-guard-cost');

const MODES = arg('modes', 'off,L1,L2').split(',');
const COST = Number(arg('cost', 1));
const GAMES = Number(arg('games', 60));
const FEAS_G = Number(arg('feas-games', 10));
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');
const SEED0 = Number(arg('seed', 4100));
const GC_SEATS = arg('guardSeat', '0') === '0' ? null : [1, 2, 3, 4];   // 默认全桌；=1 时只收费给被评那 4 席
const EVERY = Number(arg('every', 0)), LIMIT = Number(arg('limit', 40));
const QUIET = arg('quiet', '') === '1';

let PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak,docs/artifacts/v7seat24-31.bak').split(',');
if (EVERY > 0) {
  PACKS = readdirSync('docs/artifacts').filter(function (f) { return /\.bak$/.test(f); }).sort()
    .filter(function (_, i) { return i % EVERY === 0; }).slice(0, LIMIT).map(function (f) { return 'docs/artifacts/' + f; });
}
const mul = function (a) { a >>>= 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

console.log('# 「防御免费」反事实（内存补丁 ⇒ 指纹不变）· ' + GAMES + ' 局/格 · 产品口径 ε=' + EPS + ' k=' + EPSK + ' ' + EPSMODE + ' · cost=' + COST + ' ep · 收费席=' + (GC_SEATS ? '只被评 4 席' : '全桌'));
console.log('# 形状：**事前**把"手里不够付"的防御卡从菜单里摘掉（与仓里已有的三道菜单闸同形：CHARGE_MIN_EP v1.5.82 / hasPurgeable v1.5.199 / 天火闸 v1.5.139），真选了再扣 ep');
console.log('# ⚠️ 三条边界：① **不改仓库** ⇒ 这是"如果防御要占预算"的反事实，不是产品定价方案（真要上须动 rules = 规则换代）；');
console.log('#          ② 摘到菜单空了会**退回原菜单**（不许造"无路可走"的假局）⇒ `dropped=0 且 epTaken=0` 就是空枪，读数作废；');
console.log('#          ③ 强度侧走 route ①（改 evo 源码）⇒ 内部调用点也生效；route ② 只包属性层会被 mirrorHealth 绕过（第一版就在这读了个假的"三档相同"）\n');

function assemble(pack, mode) {
  const ctx = build({ on: true, pack: pack, temp: TEMP, eps: EPS, epsK: EPSK, epsMode: EPSMODE });
  const sb = ctx.sb, R = sb.EpirusRules, S = sb.EpirusState, T = sb.EpirusTrainer, Play = sb.EpirusPlay, P = sb.EpirusPolicy;
  if (ctx.patched !== ctx.hardwired) { console.log('⛔ 口径搬运自检失败 ' + pack); process.exit(9); }
  const gc = makeGuardCost(R, S, { mode: mode, cost: COST });
  const params = P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
  if (!params) return null;
  const base = T.policyChooserN(params, TEMP, EPS, EPSK, EPSMODE);
  const guarded = gc.wrapOne(base);   // mode==='off' 时 gc.wrapOne 原样返回 ⇒ 对照组与"不打补丁"逐字相同
  const gcBase = function (s2, p2, lg, econ) {
    if (GC_SEATS && GC_SEATS.indexOf(p2) < 0) return base(s2, p2, lg, econ);
    return guarded(s2, p2, lg, econ);
  };
  const DEF = R.CAT.DEFENSE;
  const isDef = function (k) { const d = R.byKey[k]; return !!(d && d.cat === DEF); };
  let defTot = 0, defN = 0, hiDef = 0, hiN = 0, maxRun = 0, g3 = 0, g5 = 0, saverWin = 0, draw = 0;
  const rds = [];
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: mul(SEED0 + g * 7919) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    gc.resetGame(st);
    /* 替身 = `hold`（永远出ジ ⇒ 钱一路堆），与被评包看到的"那个攒钱的人"同一种装配 */
    const REC = [];
    const ch = [function (s2, p2) { return { key: R.SK.JI }; }];
    for (let i = 1; i < 5; i++) ch.push(function (s2, p2, lg, econ) {
      const pick = gcBase(s2, p2, lg, econ);
      REC.push({ rd: s2.round, pid: p2, ep0: s2.p[0] ? (s2.p[0].ep || 0) : 0, def: isDef(pick.key) });
      return pick;
    });
    Play.autoGameN(st, ch);
    rds.push(st.round);
    /* 设防率/分桶一律**在决策点记**（事件流里防御的成功与否不等价于"这一手是防御"）；连防按 (席, 回合) 严格相邻 */
    const runSeat = {}, lastRd = {}; let runThisGame = 0;
    for (const d of REC) {
      defN++; defTot += d.def ? 1 : 0;
      if (d.ep0 >= 10) { hiN++; hiDef += d.def ? 1 : 0; }
      if (d.def) { runSeat[d.pid] = (lastRd[d.pid] === d.rd - 1 ? (runSeat[d.pid] || 0) + 1 : 1); lastRd[d.pid] = d.rd; if (runSeat[d.pid] > maxRun) maxRun = runSeat[d.pid]; if (runSeat[d.pid] > runThisGame) runThisGame = runSeat[d.pid]; }
      else { runSeat[d.pid] = 0; lastRd[d.pid] = d.rd; }
    }
    if (runThisGame >= 3) g3++;
    if (runThisGame >= 5) g5++;
    if (st.winner === 0) saverWin++;
    if (st.winner === 'draw' || st.winner == null) draw++;
  }
  rds.sort(function (a, b) { return a - b; });
  return { def: defN ? 100 * defTot / defN : NaN, hi: hiN ? 100 * hiDef / hiN : NaN, run: maxRun, g3: 100 * g3 / GAMES, g5: 100 * g5 / GAMES, med: rds[rds.length >> 1], draw: 100 * draw / GAMES, saver: 100 * saverWin / GAMES, gc: gc.stat, den: defN };
}

function strength(pack, mode) {
  /* route ①：改 evo 源码让**内部调用点**（`mirrorHealth`/`selfPlay` 那一族）也走同一把尺。
   *   第一版只在属性层包（route ②）⇒ 门的三档读数逐字相同，差点被我读成"定价不影响强度"——其实是没打到。
   *   （`selfPlay` 只是 `W.EpirusTrainer.mirrorHealth` 的薄壳，内部调的是闭包里的 `policyChooserN`。） */
  const g = buildGuarded(build, pack, { mode: mode, cost: COST }, { on: false });
  const gc = g.gc, sb = g.ctx.sb, P = sb.EpirusPolicy;
  if (mode !== 'off' && g.ctx.mutated !== 1) {
    console.log('⛔ route ① 改写没生效（mutated=' + g.ctx.mutated + '）⇒ 强度侧三档必然相同，那是假象不是结论'); process.exit(9);
  }
  const params = P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
  if (!params) return null;
  let out = null;
  try {
    const sp = selfPlay(sb, params, 'multi', FEAS_G);
    const spL = selfPlay(sb, params, 'long', FEAS_G);
    const rw = reflectWall(sb, params, 'long', FEAS_G);
    const agg = aggressionProfile(sb, params, FEAS_G);
    const ss = seatSymmetry(sb, params, 'multi', Math.max(30, FEAS_G * 3));
    const dens = densityProfile(sb, params, 'long', FEAS_G);
    const chg = chargeProfile(sb, params, 'long', FEAS_G);
    const feas = feasibilityOf({ seat: ss, G: sp, G2: spL, G2name: 'long', wall: rw, aggr: agg,
      density: { dmgPerRound: dens.dmgPerRound, jiShare: dens.jiShare, gained: chg.gained, spentRate: chg.spentRate,
        expiredPerGame: chg.games ? chg.expired / chg.games : 0, zeroAtkRate: dens.zeroAtkRate, zeroDealtRate: dens.zeroDealtRate } });
    out = { feas: feas, passed: feas.ok ? 5 : (5 - (feas.fails || []).length), fails: feas.fails || [],
      g: sp.effSkills, land: sp.effSkillsLand, keys: sp.landedKeys || (sp.distinctKeys != null ? sp.distinctKeys : '?'),
      gLong: spL.effSkills, landLong: spL.effSkillsLand, draw: 100 * sp.drawRate, rounds: sp.rounds,
      ji: 100 * dens.jiShare, waste: chg.gained ? 100 * chg.expired / chg.gained : NaN,
      wallAtk: rw && rw.wallActiveDmgPerGame != null ? rw.wallActiveDmgPerGame : null, gc: gc.stat };
  } catch (e) {
    out = { err: e.message, gc: gc.stat, passed: null };
  }
  return out;
}

const rows = [];
for (const f of PACKS) {
  const nm = f.replace(/^.*[\/]/, '').replace(/\.(bak|js)$/, '');
  for (const m of MODES) {
    const a = assemble(f, m);
    if (!a) { console.log('⚠️ ' + nm + ' 解不出参数，跳过'); continue; }
    const s = strength(f, m);
    rows.push({ pack: nm, mode: m, a: a, s: s });
  }
  if (!QUIET) {
    console.log('## ' + nm);
    console.log('   档      扣费自证              设防率  ep≥10桶   连防  ≥3连%  局长 平局% 攒钱赢%  ‖ 门   G净兑现(种)  G(long) 按ジ% 珠浪费%  镜平局% 镜局长');
    for (const r of rows.filter(function (x) { return x.pack === nm; })) {
      const st = r.a.gc, s = r.s || {};
      console.log('   ' + r.mode.padEnd(6) + (st.mode === 'off' ? '对照（不扣）'.padEnd(16) + ('扣 0 次/看 ' + st.guards + ' 手').padEnd(9)
        : formatGuardCost(st).padEnd(25)) +
        r.a.def.toFixed(1).padStart(7) + '% ' + (isFinite(r.a.hi) ? r.a.hi.toFixed(1) : '—').padStart(7) + '% ' +
        String(r.a.run).padStart(5) + String(Math.round(r.a.g3)).padStart(7) + String(r.a.med).padStart(6) +
        String(Math.round(r.a.draw)).padStart(6) + String(Math.round(r.a.saver)).padStart(8) + '   ‖ ' +
        (s.passed != null ? s.passed + '/5' : '—').padStart(4) + ' ' +
        (s.land != null ? s.land.toFixed(2) + '(' + s.keys + ')' : '—').padStart(12) + ' ' +
        (s.gLong != null ? s.gLong.toFixed(2) : '—').padStart(7) + ' ' + (s.ji != null ? s.ji.toFixed(1) : '—').padStart(6) +
        ' ' + (s.waste != null && isFinite(s.waste) ? s.waste.toFixed(0) : '—').padStart(6) +
        '  ' + (s.draw != null ? s.draw.toFixed(0) : '—').padStart(6) + ' ' + (s.rounds != null ? s.rounds.toFixed(1) : '—').padStart(6));
      if (s.err) console.log('         ⚠️ 强度侧报错：' + s.err);
      else if (s.fails && s.fails.length) console.log('         门挂：' + s.fails.join(' / ').slice(0, 150));
    }
    /* "空枪"判的是**这一档到底有没有碰过地形**：只认 `dropped`（菜单被摘）与 `epTaken`（真扣到的钱），
     *   不认 `billed` —— `cost=99` 会把防御整条摘干净（实测 `dropped=5127 · billed=0`），那是补丁生效到顶的样子；
     *   反过来 `cost=0` 会"扣了但一分钱没拿走"（billed>0 而 epTaken=0），那才是真的没作用点。
     * ⇒ 判据与头注②逐字同一句话（之前代码比自己的规矩还严，把最强读数判成作废）。 */
    const noFire = rows.filter(function (x) {
      if (x.pack !== nm || x.mode === 'off') return false;
      const sg = (x.s && x.s.gc) ? x.s.gc : { dropped: 0, epTaken: 0 };
      return x.a.gc.dropped + x.a.gc.epTaken + sg.dropped + sg.epTaken === 0;
    });
    if (noFire.length) console.log('   ⛔ 空枪：' + noFire.map(function (x) { return x.mode; }).join('/') + ' 菜单一次没摘过、钱一次没扣过 ⇒ 这几行不许读成"防御定价没用"（同 D123 的规矩）');
    if (rows.filter(function (x) { return x.pack === nm; }).length === MODES.length) {
      const o = rows.filter(function (x) { return x.pack === nm; })[0], v = rows.filter(function (x) { return x.pack === nm; })[rows.filter(function (x) { return x.pack === nm; }).length - 1];
      console.log('   对照差：设防率 ' + o.a.def.toFixed(1) + '% → ' + v.a.def.toFixed(1) + '%（' + v.mode + '）· 连防 ' + o.a.run + ' → ' + v.a.run +
        ' · 局长 ' + o.a.med + ' → ' + v.a.med + ' · 净兑现 ' + (o.s && o.s.land != null ? o.s.land.toFixed(2) : '—') + ' → ' + (v.s && v.s.land != null ? v.s.land.toFixed(2) : '—'));
    }
    console.log('');
    rows.length = 0;
  }
}
if (QUIET && rows.length) {
  console.log('   包                        档    设防率  ep≥10  连防  局长  ‖ 门   净兑现  按ジ%  扣次');
  for (const r of rows) {
    const s = r.s || {};
    console.log('   ' + r.pack.slice(0, 22).padEnd(25) + r.mode.padEnd(5) + r.a.def.toFixed(1).padStart(6) + '% ' +
      (isFinite(r.a.hi) ? r.a.hi.toFixed(1) : '—').padStart(6) + '% ' + String(r.a.run).padStart(4) + String(r.a.med).padStart(6) +
      ' ‖ ' + (s.passed != null ? s.passed + '/5' : '—') + ' ' + (s.land != null ? s.land.toFixed(2) : '—') +
      ' ' + (s.ji != null ? s.ji.toFixed(1) : '—') + ' ' + (r.a.gc.billed + (s.gc ? s.gc.billed : 0)));
  }
}
