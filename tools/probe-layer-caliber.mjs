/* 把**整个评测层**一次性搬到产品口径，看五道门里有几条结论会变（09-25 凌晨 · Qoder · 只读）
 *
 * 为什么要有这个：DS 的 v1.5.152「产品代理栏」（门 D118）只覆盖**真桌出招份额**那一族；
 *   而 **座位极差 / 广度 G / 反弹墙 / 场A 场B / 密度** 这五道门的输入，至今只在 ε=0 上量过
 *   （`audit-lib.mjs` 9 处 + `evo.js` 4 处写死 `policyChooserN(params, 0.15)`）。
 *   E7 已经在座位那一栏抓到"两口径判定相反"（`probe-seat-caliber`），这里问的是**还有几栏会**。
 *
 * 怎么做（关键是**不改仓库一个字**）：
 *   ① `evo.js` 的 4 处写死：读源码后在**内存里**把 `policyChooserN(params, 0.15)` 换成带四个参数的版本再丢进 vm；
 *   ② `audit-lib.mjs` 的 9 处：它是 ESM、不进气泡，但它调的是 `W.EpirusTrainer.policyChooserN` ⇒ **装载后把沙箱里那个属性包一层**。
 *   ⇒ 两条路都只活在本进程的内存里，**规则指纹仍是 `ebdbff36`**（与 §B 改价反事实、`__t3pTestEconOverride` 同一族手法）。
 *
 * 用法：node tools/probe-layer-caliber.mjs [--packs=a,b] [--eps=0.2] [--epsk=5] [--epsmode=soft] [--temp=0.15]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { seatSymmetry, reflectWall, fieldRate, densityProfile, chargeProfile, aggressionProfile, feasibilityOf, FEAS_N_DEFAULTS as FN, rejectUnknownFlags } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
const PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak,docs/artifacts/cbs1s5-band1.bak,docs/artifacts/co1s8-band1.bak').split(',');
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');
const GAMES = Number(arg('games', 120));
const ENGINE = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js'];
const HARDWIRED = /policyChooserN\(params, 0\.15\)/g;

/* 写死处的**期望数量从源码现算**（不许冻结成常数 —— METHODOLOGY 52 刚为 75/62 那种常数记过一笔账） */
const EVO_SRC = readFileSync('js/train/evo.js', 'utf8');
const EVO_HARDWIRED = (EVO_SRC.match(HARDWIRED) || []).length;
const AL_HARDWIRED = (readFileSync('tools/audit-lib.mjs', 'utf8').match(HARDWIRED) || []).length;

export function build(caliber) {
  const sb = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date };
  sb.window = sb; sb.globalThis = sb;
  let patched = 0;
  for (const f of ENGINE.concat([caliber.pack])) {
    let src = readFileSync(f, 'utf8');
    if (f === 'js/train/evo.js' && caliber.on) {
      src = src.replace(HARDWIRED, function () { patched++; return 'policyChooserN(params, ' + TEMP + ', ' + caliber.eps + ', ' + caliber.epsK + ', ' + JSON.stringify(caliber.epsMode) + ')'; });
    }
    vm.runInNewContext(src, sb, { filename: f });
  }
  if (caliber.on) {
    /* ② audit-lib 走的这条路：它只传 `(params, 0.15)` ⇒ 在属性层把后三个参数补上（忽略它传的温度，与产品一致） */
    const T = sb.EpirusTrainer, orig = T.policyChooserN;
    T.policyChooserN = function (p) {
      sb.__viaWrapper++;
      return arguments.length >= 3 ? orig.apply(null, arguments) : orig(p, caliber.temp, caliber.eps, caliber.epsK, caliber.epsMode);
    };
    sb.__viaWrapper = 0;
  }
  return { sb: sb, patched: patched, hardwired: EVO_HARDWIRED, viaWrapper: sb.__viaWrapper || 0, caliberOn: !!caliber.on };
}

function measure(ctx, games) {
  const W = ctx.sb, P = W.EpirusPolicy;
  const params = P.unpack(ctx.packObj.champ, true) || P.unpack(ctx.packObj.champ2, true);
  if (!params) return null;
  const seat = seatSymmetry(W, params, 'multi', Math.max(FN.seat, games));
  const G = W.EpirusTrainer.mirrorHealth(params, Math.max(FN.games, games), 5, 'multi');
  const G2 = W.EpirusTrainer.mirrorHealth(params, Math.max(FN.games, games), 5, 'long');
  const wall = reflectWall(W, params, 'multi', Math.max(FN.games, games));
  const aggr = aggressionProfile(W, params, Math.max(FN.aggr, games));
  const dens = densityProfile(W, params, 'long', Math.max(FN.density, games));
  const chg = chargeProfile(W, params, 'long', Math.max(FN.charge, games));
  /* 「有人攒钱我就开始防御，而且一防就是很久」= 用户 09-24 实机报的那条病。用**已有的单一真源** `fieldRate('active')` 量：
   * 该场 1 席是"攒钱型人类替身"（只会出攻击卡或ジ ⇒ ep 单调涨），其余 4 席是被评包 ⇒ 读它的设防率与最长连设防。 */
  const money = fieldRate(W, params, 'active', 'multi', Math.max(FN.games, games));
  const feas = feasibilityOf({ seat: seat, G: G, G2: G2, G2name: 'long', wall: wall, aggr: aggr,
    density: { dmgPerRound: dens.dmgPerRound, jiShare: dens.jiShare, gained: chg.gained, spentRate: chg.spentRate,
      expiredPerGame: chg.games ? chg.expired / chg.games : 0, zeroAtkRate: dens.zeroAtkRate, zeroDealtRate: dens.zeroDealtRate } });
  return { seat: seat, G: G, G2: G2, wall: wall, aggr: aggr, dens: dens, chg: chg, money: money, feas: feas };
}
function runPack(f, caliber, games) {
  const ctx = build(Object.assign({ pack: f }, caliber));
  ctx.packObj = { champ: ctx.sb.EPIRUS_CHAMPION_3P, champ2: ctx.sb.EPIRUS_CHAMPION };
  const m = measure(ctx, games);
  return { ctx: ctx, m: m, viaWrapper: ctx.sb.__viaWrapper || 0 };
}

const pct = x => (100 * (x || 0)).toFixed(0) + '%';

/* 被 import 时**不跑 main**（与 `behavior-profile.mjs` 同规）—— 这样 `probe-breadth-flip.mjs` 能复用同一套搬运手法，
 * 而不会出现"第二份口径实现"（本仓规矩：同一规则只许写一遍）。 */
const IS_MAIN = !process.argv[1] || /probe-layer-caliber\.mjs$/.test(process.argv[1].replace(/\\/g, '/'));
if (IS_MAIN) main();
function main() {
  /* v1.5.236（仓规 v1.5.234）：守卫**只在作为主程序跑时生效** —— 本文件被别的探针 `import { build }` 时，
   *   调用方自己的 `--packs/--pair/--seeds…` 会在这里"看起来不认识"，那样就会把别人的工具打死。 */
  rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'temp', 'eps', 'epsk', 'epsmode'], 'probe-layer-caliber');
  console.log('# 五道门的输入：评测口径 ε=0  vs  产品口径 ε=' + EPS + ' k=' + EPSK + ' ' + EPSMODE + '（`ui.js:464`）');
  console.log('# 只读；口径靠"内存里改装载源码 + 包一层 `EpirusTrainer.policyChooserN`"实现 ⇒ 仓库一字未动、指纹不变。\n');
const summary = [];
let SELF = { patched: 0, wrapper: 0 };
for (const f of PACKS) {
  const champSrc = readFileSync(f, 'utf8');
  const name = f.replace(/^.*\//, '').replace(/\.bak$/, '').replace(/^bundled-champion-3p\.js$/, '现役 3p');
  let a, b;
  try {
    a = runPack(f, { on: false }, GAMES);
    b = runPack(f, { on: true, temp: TEMP, eps: EPS, epsK: EPSK, epsMode: EPSMODE }, GAMES);
  } catch (e) { console.log('⚠️ ' + name + ' 跑不动：' + e.message); continue; }
  if (!a.m || !b.m) { console.log('⚠️ ' + name + ' 解不出参数'); continue; }
  SELF.patched = b.ctx.patched; SELF.wrapper += b.viaWrapper;
  a = a.m; b = b.m;
  console.log('## ' + name);
  const row = function (label, va, vb, den) {
    console.log('   ' + label.padEnd(26) + ' ε=0 ' + String(va).padStart(9) + '   产品 ' + String(vb).padStart(9) +
      (den ? '   分母 ' + den : ''));
  };
  const flipped = (a.feas.ok !== b.feas.ok);
  const fa = a.feas.fails, fb = b.feas.fails;
  console.log('   五道门总结论：ε=0 ' + (a.feas.ok ? '✅ 全过' : '✗ ' + fa.join('；')) + '');
  console.log('           产品 ' + (b.feas.ok ? '✅ 全过' : '✗ ' + fb.join('；')) + (flipped ? '   ⚠️ **两口径结论相反**' : ''));
  /* 只在一栏里翻的项：把"哪一条 fail 是新出现的"点名，否则读者只知道"翻了"不知道翻在哪 */
  const onlyB = fb.filter(function (x) { return !fa.some(function (y) { return y.slice(0, 6) === x.slice(0, 6); }); });
  const onlyA = fa.filter(function (x) { return !fb.some(function (y) { return y.slice(0, 6) === x.slice(0, 6); }); });
  if (onlyB.length) console.log('     只在产品口径下红：' + onlyB.join('；') + (/\u5ea7\u4f4d/.test(onlyB.join(' ')) ? '\n     ⚠️ 座位栏**单次抽签**就可能翻结论（n=120 的 seed 间带宽见 `probe-seat-caliber`，实测 [5.0~24.0]）⇒ 这条只当"要去配重复次数核验"的信号，不当"它真偏座"。' : ''));
  if (onlyA.length) console.log('     只在 ε=0 下红：' + onlyA.join('；'));
  row('座位极差 pt（线随 n）', a.seat.spread.toFixed(1), b.seat.spread.toFixed(1),
    '判胜 ' + pct(a.seat.decisiveRate) + ' → ' + pct(b.seat.decisiveRate) + ' · verdict ' + a.seat.verdict + '→' + b.seat.verdict);
  row('G 有效技能数(multi)', a.G.effSkills.toFixed(2), b.G.effSkills.toFixed(2), '出手 ' + a.G.distinctKeys + '→' + b.G.distinctKeys + ' 种');
  row('G 有效技能数(long)', a.G2.effSkills.toFixed(2), b.G2.effSkills.toFixed(2), '门线同 3（v1.5.145 用户裁定两模式都判）');
  row('兑现 G(净兑现)', (a.G.effSkillsLand || 0).toFixed(2), (b.G.effSkillsLand || 0).toFixed(2),
    '落地 ' + (a.G.landedKeys || 0) + '→' + (b.G.landedKeys || 0) + ' 种 · 次数 ' + (a.G.landedTotal || 0) + '→' + (b.G.landedTotal || 0));
  row('反弹墙伤害/局', a.wall.dmgPerGame.toFixed(2), b.wall.dmgPerGame.toFixed(2), '零伤害局 ' + pct(a.wall.zeroDamageRate) + '→' + pct(b.wall.zeroDamageRate));
  row('场A 还手率', pct(a.aggr.fieldA && a.aggr.fieldA.atk), pct(b.aggr.fieldA && b.aggr.fieldA.atk), '');
  row('场B 清场/局', (a.aggr.fieldB && a.aggr.fieldB.clearedPerGame || 0).toFixed(2), (b.aggr.fieldB && b.aggr.fieldB.clearedPerGame || 0).toFixed(2), '');
  row('输出密度 每回合伤害', a.dens.dmgPerRound.toFixed(3), b.dens.dmgPerRound.toFixed(3), '按ジ ' + pct(a.dens.jiShare) + '→' + pct(b.dens.jiShare));
  row('蓄能 次/局', a.chg.chargesPerGame.toFixed(2), b.chg.chargesPerGame.toFixed(2), '珠浪费率 ' + pct(a.chg.wasteRate) + '→' + pct(b.chg.wasteRate));
  console.log('   ―― 以下是**门不看**的栏（用户 09-24 实机报的病在这儿）――');
  row('攒钱场 设防率', pct(a.money.stance), pct(b.money.stance), '局长 ' + a.money.rounds.toFixed(1) + '→' + b.money.rounds.toFixed(1) + ' 回合');
  row('  └ 最长连设防（回合）', String(a.money.maxStanceRun), String(b.money.maxStanceRun), '无威胁时设防率 ' + pct(a.money.noThreatStanceRate) + '→' + pct(b.money.noThreatStanceRate));
  summary.push({ name: name, flipped: flipped, aOk: a.feas.ok, bOk: b.feas.ok, onlyB: onlyB,
    seatDecA: a.seat.decisiveRate, seatDecB: b.seat.decisiveRate,
    dG: b.G.effSkills - a.G.effSkills, dLand: (b.G.effSkillsLand || 0) - (a.G.effSkillsLand || 0),
    dWall: b.wall.dmgPerGame - a.wall.dmgPerGame });
}
console.log('\n## 汇总');
/* 自检（不成立则整张表作废）：两条搬运的路都必须**真的被走过** —— 否则"两栏相同"会被读成"口径无关" */
console.log('   工具自检：`evo.js` 写死处实测 ' + EVO_HARDWIRED + ' 处 → 内存里替换了 ' + SELF.patched + ' 处；' +
  '`audit-lib` 写死处实测 ' + AL_HARDWIRED + ' 处 → 经包装调用 ' + SELF.wrapper + ' 次（必须 >0）');
if (SELF.patched !== EVO_HARDWIRED || SELF.wrapper <= 0) {
  console.log('⛔ 有一条路没生效 ⇒ 下面"两栏相同"的格子全是假的（测量没打开，不是行为没变）');
  process.exit(9);
}
for (const s of summary) {
  console.log('   ' + s.name.padEnd(18) + ' 结论' + (s.flipped ? ' **相反**' : ' 相同') +
    '（ε=0 ' + (s.aOk ? '过' : '挡') + ' / 产品 ' + (s.bOk ? '过' : '挡') + '）' +
    (s.flipped && s.onlyB.length ? ' ← ' + s.onlyB.join('；').slice(0, 46) : '') +
    ' · ΔG ' + (s.dG >= 0 ? '+' : '') + s.dG.toFixed(2) + ' · Δ净兑现 ' + (s.dLand >= 0 ? '+' : '') + s.dLand.toFixed(2) +
    ' · Δ墙 ' + (s.dWall >= 0 ? '+' : '') + s.dWall.toFixed(2) +
    ' · 座位判胜 ' + pct(s.seatDecA) + '→' + pct(s.seatDecB));
}
if (!summary.length) { console.log('⛔ 一格都没量到 ⇒ 非零退出'); process.exit(6); }
const nFlip = summary.filter(function (s) { return s.flipped; }).length;
console.log('   ⇒ ' + nFlip + '/' + summary.length + ' 粒包"换到产品口径过不过门"结论不同；' +
  '（若为 0 也不等于"口径无关"—— 单栏仍可能翻，见表）');

}
