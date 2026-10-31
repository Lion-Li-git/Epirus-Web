#!/usr/bin/env node
/* chain-price.mjs — 「两跳前置链」在这张考卷里**值不值钱**（千问 · 10-30 夜 · 用户问"新包能不能更快学会大雷/电磁炮/聚能环"）
 *
 * 为什么先做这一步而不是直接训练：长程技能"不出手"有三种病因（§十六/§十七 的 ①菜单没有 ②排在后面 ③温度），
 *   但**三者都默认了一件事**：这门技能对目标是有价值的。在册的 `ladder --sweep=keys` 只价过**单键**
 *   （`only:railgun` 0.2% ‖ `only:charge` 0.2% ‖ `v7` 40.4%，同批 16 格×120 局），
 *   而单键阶梯**天然价不出链**：电磁炮要先有电珠、电珠要靠蓄能、蓄能只活到下一回合 ⇒
 *   两个零件各自 0.2% 不代表它们叠起来还是 0.2%。"要不要为长程付机器时间"必须先有**叠起来的价**。
 *
 * 三条判据（都在**同一批局号**上，与臂的终局冻结桌同盐同序）：
 *   · 链的价 = `chain:*` 的夺1 − max(`only:railgun`, `only:charge`) ⇒ 显著为正说明**目标真为规划深度付账**；
 *   · 链 vs `only:gun`（1 ジ 一步打到） ⇒ 若"立刻打一枪"稳定压过"攒两拍再打"，这张考卷的**最优解是短视的**，
 *     那么包不出手长程手就是理性取舍，不是缺陷（在册规矩：弱点必须是目标在乎的缺口）；
 *   · `railgun 出手/局` 对 `chain:*` 就是**链完成次数/局**（引擎只在有电珠时才把电磁炮放进候选表 ⇒
 *     脚本自己不会凭空有珠，能开炮 = 上一拍蓄能真活到了这一拍）。
 *
 * ⚑ 同批自证：本工具逐局走 `A.playOne(..., 5077)`（frozen 盐），跑完拿它的**聚合**去对 `A.evalChooser(phase:'frozen')`
 *   同一行的夺1；两者不一致就说明我抄错了局号/盐 ⇒ 当场 exit 8，不印任何判读（"我在测那张考卷"不能靠相信）。
 * ⚑ 装配：`arena2.v2` + `stratified=cap2~mix0.5`（mild，= 现役臂 meta 里的 `arena.fp` 同一套），
 *   参照包 v7 必须在 `installArch2` **之前**读出（`createArena2` 的硬条款）。
 *
 * 用法：node tools/proto2/chain-price.mjs [--gamesPerShape=6] [--packs=a.bak,b.bak] [--keys=railgun,charge,ring,bigT]
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, mulberry32, rejectUnknownFlags } from '../audit-lib.mjs';
import { install, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { makeScripts } from './chain-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['gamesPerShape', 'packs', 'keys', 'temp', 'quiet', 'strat', 'phase'], 'chain-price');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GPS = Math.max(1, Number(arg('gamesPerShape', 6)) || 6);
const TEMP = Number(arg('temp', 0.15)) || 0.15;
const KEYS = String(arg('keys', 'railgun,charge,ring,bigT,gun,guard,miniT')).split(',').filter(Boolean);
/* `--strat=0|full|mild`（默认 mild = 现役 obs3 臂的卷）：臂的 `arena.fp` 里写着它当时是哪张场，
 *   拿这尺横比必须**先把场对**——obs3b 那条 OB3S 链是在 `stratified=false` 上训的（39.5% 夺1），
 *   在 mild 上同一枚包我量到 23.9%，差的不是包，是考卷。
 * `--phase=frozen|holdout`：局号批次（frozen=200000+s*1000+g 盐 5077 ‖ holdout=100000+… 盐 90001）
 *   ⇒ 想复现臂 meta 里的 `holdoutFirst` 就切 holdout。 */
const STRAT = String(arg('strat', 'mild'));
const PHASE = String(arg('phase', 'frozen'));
if (['0', 'full', 'mild'].indexOf(STRAT) < 0) { console.error('⛔ --strat 只认 0|full|mild（收到 ' + STRAT + '）'); process.exit(2); }
if (['frozen', 'holdout'].indexOf(PHASE) < 0) { console.error('⛔ --phase 只认 frozen|holdout（收到 ' + PHASE + '）'); process.exit(2); }
const STRAT_ON = STRAT !== '0';
const STRAT_CAP = STRAT === 'mild' ? 2 : undefined;
const STRAT_MIX = STRAT === 'mild' ? 0.5 : undefined;
const SALT = PHASE === 'frozen' ? 5077 : 90001;
const BASE = PHASE === 'frozen' ? 200000 : 100000;
const PACKS = String(arg('packs', 'scratch/arms/CEM48-s7.bak,scratch/arms/CH2-s7-s7.bak,scratch/arms/CEM48c-s7.bak,scratch/arms/CH3-CH2-s11-s7-s17.bak')).split(',').filter(Boolean);


/* ===== 窗口普查：在冠军席**每一次决策**上记"链的窗口有没有开过"（分母先于结论）=====
 * 判据字段与在册 `evo.js chainKeysOf`（v1.5.149-night 那条"在链上"的定义）用**同一批真字段**：
 *   `me.elec`（持电珠）‖ `me.lastSkill === CHARGE`（上一手是蓄能）⇒ 不另立一套"链"的口径。
 * ⚑ 这层是**只读**的：重算候选表不写状态、不吃 `state.rng` ⇒ 由 `同批自证` 那条腿当场验（不一致就 exit 8）。 */
function withCensus(W, sel, rec) {
  const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
  return function (state, pid, legal) {
    const me = state.p[pid];
    let cs = [];
    try { cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || []; } catch (e) { cs = []; }
    rec.decisions++;
    const has = (k) => cs.some((c) => c && c.key === k);
    if (me.elec > 0) rec.elecBead++;
    if (me.ep >= 2) rec.epGe2++;
    if (me.elec > 0 && me.ep >= 2) rec.fireWindow++;
    if (has(R.SK.RAILGUN)) rec.railgunOffered++;
    if (has(R.SK.CHARGE)) rec.chargeOffered++;
    if (has(R.SK.BIG_T)) rec.bigTOffered++;
    if (has(R.SK.RING)) rec.ringOffered++;
    if (me.lastSkill === R.SK.CHARGE) { rec.afterCharge++; if (me.elec > 0) rec.afterChargeBead++; if (me.elec > 0 && me.ep >= 2) rec.afterChargeWindow++; }
    if (me.ringStreak >= 2) rec.ringStreak2++;
    const pick = sel(state, pid, legal);
    /* ⚑ 键内自由度（10-31 午后补）：`policy.js:680` 给「蓄能」**两枚同键候选**（bead='elec'/'boom'），
     *   两级 softmax 的键层用 bestOf（取键内最大 logit）⇒ **只训键级似然时，蓄哪种珠完全不受约束**。
     *   电珠才是电磁炮的门票（`state.js` RAILGUN 需 p.elec≥1），且珠只活一回合（resolve.js:1296 R9'）
     *   ⇒ 这一列直接分清"没学会等"与"学会了等、但蓄错了珠"。 */
    const pk = pick && typeof pick === 'object' ? pick : (typeof pick === 'string' ? { key: pick } : null);
    if (pk && pk.key === R.SK.CHARGE) {
      if (pk.bead === 'elec') rec.chargeElec++; else if (pk.bead === 'boom') rec.chargeBoom++; else rec.chargeNoBead++;
      rec.chargeAtEp[Math.min(9, me.ep | 0)]++;   /* 蓄前 ep：教师只在 ep≥3 蓄 ⇒ 这张直方图直接读出"会不会在快饿的时候花本钱包" */
    }
    return pick;
  };
}
function newCensus() {
  return { decisions: 0, elecBead: 0, epGe2: 0, fireWindow: 0, railgunOffered: 0, chargeOffered: 0, bigTOffered: 0, ringOffered: 0, afterCharge: 0, afterChargeBead: 0, afterChargeWindow: 0, ringStreak2: 0, chargeElec: 0, chargeBoom: 0, chargeNoBead: 0, chargeAtEp: new Array(10).fill(0) };
}

/* ===== 逐局跑一行：返回聚合 + 逐技能出手/共现 +  conditional 胜负 ===== */
function rowRun(A, W, label, sel) {
  const census = newCensus();
  sel = withCensus(W, sel, census);
  const shapes = A.shapes, nS = shapes.length;
  const catSum = {}, perGame = [];
  let acts = 0, rounds = 0, win = 0, clean = 0, firstSum = 0;
  for (let s = 0; s < nS; s++) {
    for (let g = 0; g < GPS; g++) {
      const r = A.playOne(sel, s, BASE + s * 1000 + g, SALT);
      perGame.push({ shape: r.shape, win: r.win, acts: r.acts, cat: r.cat });
      acts += r.acts; rounds += r.rounds; win += r.win ? 1 : 0; clean += r.clean ? 1 : 0; firstSum += r.scoreFirst;
      for (const k in r.cat) catSum[k] = (catSum[k] || 0) + r.cat[k];
    }
  }
  const G = Math.max(1, perGame.length);
  /* conditional 价：出过这一手的局 vs 没出过的局，夺1 差多少（**观察量，有位置混杂**：
   *   能出大雷的局本来就更富 ⇒ 这个差是"上界式提示"，不是因果，别当因果印）。 */
  const cond = {};
  for (const k of KEYS) {
    let a = 0, ag = 0, b = 0, bg = 0;
    for (const pg of perGame) {
      if ((pg.cat[k] || 0) > 0) { ag++; if (pg.win) a++; } else { bg++; if (pg.win) b++; }
    }
    cond[k] = { castGames: ag, winWithCast: ag ? a / ag : null, winWithout: bg ? b / bg : null };
  }
  const out = {
    label, games: G, first: win / G, clean: clean / G, firstScore: firstSum / G,
    actsPerGame: acts / G, roundsPerGame: rounds / G,
    per: {}, chainPair: {},
  };
  for (const k of KEYS) out.per[k] = { castPerGame: (catSum[k] || 0) / G, gamesWith: perGame.filter((p) => (p.cat[k] || 0) > 0).length };
  const both = perGame.filter((p) => (p.cat.charge || 0) > 0 && (p.cat.railgun || 0) > 0).length;
  out.chainPair = { gamesWithChargeAndRail: both, ofChargeGames: out.per.charge.gamesWith ? both / out.per.charge.gamesWith : null };
  out.cond = cond;
  out.census = census;
  /* 分层胜率（在册规矩：均值会吞掉桌形 —— 链在 2 席与 10 席完全可能反号，必须一起报）*/
  const byShape = {};
  for (const pg of perGame) { const x = byShape[pg.shape] || (byShape[pg.shape] = { g: 0, w: 0 }); x.g++; if (pg.win) x.w++; }
  out.byShape = byShape;
  return out;
}

/* ===== 主流程 ===== */
const W = sandbox(ROOT);
const v7 = loadChamp(W, 'js/bundled-champion-3p.js', '');
const refParams = Float64Array.from(v7);

const A = createArena2(W, { refParams, temp: TEMP, highN: 1, stratified: STRAT_ON, stratCap: STRAT_CAP, stratMix: STRAT_MIX });
console.log('# chain-price ‖ 装配指纹 ' + A.fp.split('|').slice(0, 1).join('') + ' ‖ ' + A.fp.match(/stratified=[^|]+/)[0] + ' ‖ temp=' + A.temp + ' ‖ 场=' + STRAT + ' ‖ 批次=' + PHASE + (PHASE === 'frozen' ? '（臂的终局冻结桌）' : '（臂的 holdout，可与 meta 的 holdoutFirst 对表）'));
console.log('   ‖ 桌形 ' + A.shapes.length + ' × ' + GPS + ' 局 = ' + (A.shapes.length * GPS) + ' 局/行 ‖ 参照包 v7（线上冠军）');

const S = makeScripts(W);
const lines = [];
lines.push(rowRun(A, W, '只开枪（短视对照）', S.onlyGun.sel));
lines.push(rowRun(A, W, '只开电磁炮（零件）', S.onlyRail.sel));
lines.push(rowRun(A, W, '只蓄能（零件）', S.onlyCharge.sel));
lines.push(rowRun(A, W, '天真链：见炮就开，否则蓄', S.chain.sel));
lines.push(rowRun(A, W, '天真链+环：见炮就开，否则蓄/环', S.chainRing.sel));
lines.push(rowRun(A, W, '攒大雷：纯攒(续免费环)→落雷', S.saveBigT.sel));
lines.push(rowRun(A, W, '均匀乱选（无计划基线）', S.uniform.sel));
lines.push(rowRun(A, W, '攒够链：见炮就开·无珠且ep≥3才蓄', S.chainSave.sel));
lines.push(rowRun(A, W, '攒够链+环：炮→蓄→环', S.chainSaveRing.sel));
lines.push(rowRun(A, W, '参照包 v7', A.chooserOf(refParams, TEMP)));

/* —— 同批自证：逐局聚合必须等于 arena2 自己的 frozen 读数 —— */
const idx = (t) => lines.findIndex((r) => r.label.indexOf(t) === 0);
const g = (t) => { const i = idx(t); if (i < 0) { console.error('⛔ 找不到行「' + t + '」⇒ 行标签漂了，判据不印。'); process.exit(9); } return lines[i]; };
const chkScript = A.evalChooser(S.chain.sel, { phase: PHASE, gamesPerShape: GPS, cur: 'first' });
const chkV7 = A.evalParams(refParams, { phase: PHASE, gamesPerShape: GPS, cur: 'first' });
const d1 = Math.abs(chkScript.firstScore - g('天真链：').firstScore);
const d2 = Math.abs(chkV7.firstScore - g('参照包 v7').firstScore);
console.log('\n[同批自证] 逐局 vs `evalChooser(frozen)`：链行差 ' + d1.toExponential(2) + ' ‖ v7 行差 ' + d2.toExponential(2) +
  ' ‖ 局数 ' + chkScript.games + '/' + g('天真链：').games);
if (d1 > 1e-12 || d2 > 1e-12 || chkScript.games !== g('天真链：').games) {
  console.error('⛔ 我抄的局号与 arena2 的冻结桌不是同一批 ⇒ 本工具所有读数作废，不印判读。');
  process.exit(8);
}

/* —— 2.0 包：装 arch2，逐枚（接线自证走 arena2 自己的 verifyWired）—— */
const W2 = sandbox(ROOT);
let installed = null;
for (const p of PACKS) {
  let raw;
  try { raw = readPack2(p); } catch (e) { console.log('\n⚠ 读不出 ' + p + '：' + String(e && e.message).slice(0, 70)); continue; }
  const got = packCfgExit(raw, p);
  if (installed) installed.restore();
  installed = install(W2, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pp = W2.EpirusPolicy.unpack(raw, true);
  if (!pp) { console.log('\n⚠ ' + p + '：unpack 不出 ⇒ 跳过'); installed.restore(); installed = null; continue; }
  const A2 = createArena2(W2, { refParams: refParams, temp: TEMP, highN: 1, stratified: STRAT_ON, stratCap: STRAT_CAP, stratMix: STRAT_MIX });
  const w = A2.verifyWired(pp, { temp: TEMP });
  if (!w.ok) { console.error('⛔ ' + p + ' 接线没生效（forwardCands +' + w.forwards + ' ‖ chooseCandidates ' + w.chooseCandidatesCalls + '）⇒ 这一行不能印'); process.exit(7); }
  lines.push(rowRun(A2, W2, '代 2 ‖ ' + p.replace(/^.*[\\/]/, '').replace('.bak', ''), A2.chooserOf(pp, TEMP)));
  lines[lines.length - 1].wired = '+' + w.forwards + '/' + w.chooseCandidatesCalls;
}
if (installed) installed.restore();

/* ===== 打印 ===== */
console.log('\n## 行读数（**胜率** = 赢家是不是我（与在册阶梯同口径）；**净分** = 按桌形归一的 `scoreFirst`，跨桌形可比）');
console.log('行 ‖ 局 ‖ 胜率 ‖ 净分 ‖ 干净胜 ‖ 出手/局 ‖ 局长 ‖ ' + KEYS.map((k) => k + '/局').join(' ‖ '));
for (const r of lines) {
  console.log(r.label.padEnd(24) + ' ‖ ' + r.games + ' ‖ ' + (100 * r.first).toFixed(1) + '% ‖ ' + (100 * r.firstScore).toFixed(1) + '% ‖ ' + (100 * r.clean).toFixed(1) + '%' +
    ' ‖ ' + r.actsPerGame.toFixed(2) + ' ‖ ' + r.roundsPerGame.toFixed(1) +
    ' ‖ ' + KEYS.map((k) => (r.per[k].castPerGame).toFixed(2) + '(' + r.per[k].gamesWith + ')').join(' ‖ '));
}
console.log('\n（括号里 = 出过手/至少出过一次这种手的**局数**，分母 = ' + lines[0].games + ' 局）');

console.log('\n## 链的窗口普查（冠军席**每一次决策**上的分母；口径与 `evo.js chainKeysOf` 同字段：`me.elec` ‖ `me.lastSkill===charge`）');
console.log('行 ‖ 决策 ‖ 持电珠 ‖ ep≥2 ‖ **开火窗=珠+2ジ** ‖ 炮进表 ‖ 蓄进表 ‖ 大雷进表 ‖ 环进表 ‖ 上手蓄能→这拍还有珠 ‖ **蓄的珠=电/爆/无** ‖ 蓄→下一拍成窗 ‖ 蓄前ep 2/3/4/≥5');
for (const r of lines) {
  const c = r.census;
  const ce = c.chargeAtEp;
  console.log(r.label.padEnd(26) + ' ‖ ' + c.decisions + ' ‖ ' + (100 * c.elecBead / Math.max(1, c.decisions)).toFixed(1) + '%' +
    ' ‖ ' + (100 * c.epGe2 / Math.max(1, c.decisions)).toFixed(1) + '% ‖ ' + c.fireWindow + '(' + (100 * c.fireWindow / Math.max(1, c.decisions)).toFixed(1) + '%)' +
    ' ‖ ' + c.railgunOffered + ' ‖ ' + c.chargeOffered + ' ‖ ' + c.bigTOffered + ' ‖ ' + c.ringOffered +
    ' ‖ ' + c.afterChargeBead + '/' + c.afterCharge +
    ' ‖ ' + c.chargeElec + '/' + c.chargeBoom + '/' + c.chargeNoBead +
    ' ‖ ' + c.afterChargeWindow + '/' + c.afterChargeBead +
    ' ‖ ' + (ce[2] || 0) + '/' + (ce[3] || 0) + '/' + (ce[4] || 0) + '/' + ce.slice(5).reduce((x, y) => x + y, 0));
}

const shapeKeys = Object.keys(lines[0].byShape);
console.log('\n## 分桌形胜率（每格 ' + GPS + ' 局；均值会吞掉桌形 ⇒ 链在 2 席与 10 席可能反号，逐格一起报）');
console.log('行 ‖ ' + shapeKeys.map((k) => k.padStart(7)).join(''));
for (const r of lines) {
  console.log(r.label.padEnd(26) + ' ‖ ' + shapeKeys.map((k) => {
    const x = r.byShape[k]; return x ? ((100 * x.w / x.g).toFixed(0) + '%').padStart(7) : '      -';
  }).join(''));
}

const naive = g('天真链：'), chain = g('攒够链：'), chainRing = g('攒够链+环'), naiveRing = g('天真链+环');
const rail = g('只开电磁炮'), charge = g('只蓄能'), gun = g('只开枪'), v7r = g('参照包 v7');
const parts = Math.max(rail.firstScore, charge.firstScore);
console.log('\n## 三条判据（单位 = 净分 pt，跨桌形归一；零件地板 = max(只开炮, 只蓄能) = ' + (100 * parts).toFixed(1) + '%）');
console.log('① **链的价**：攒够链 − 零件 ' + ((100 * (chain.firstScore - parts)).toFixed(1)) +
  'pt ‖ 攒够链+环 − 零件 ' + ((100 * (chainRing.firstScore - parts)).toFixed(1)) +
  'pt ‖（天真链 ' + ((100 * (naive.firstScore - parts)).toFixed(1)) + 'pt ‖ 天真链+环 ' + ((100 * (naiveRing.firstScore - parts)).toFixed(1)) +
  'pt —— 这两条留作"脚本自己不会经济"的证据，不拿来定价）');
console.log('② **短视对照** = 攒够链 − 只开枪：' + ((100 * (chain.firstScore - gun.firstScore)).toFixed(1)) +
  'pt ‖ 攒够链+环 − 只开枪：' + ((100 * (chainRing.firstScore - gun.firstScore)).toFixed(1)) +
  'pt ‖ 只开枪 − v7：' + ((100 * (gun.firstScore - v7r.firstScore)).toFixed(1)) + 'pt');
console.log('③ **链完成/局**（电磁炮出手数；脚本侧 = 上一拍蓄真活到这一拍才可能响）：攒够链 ' + chain.per.railgun.castPerGame.toFixed(2) +
  ' ‖ 攒够链+环 ' + chainRing.per.railgun.castPerGame.toFixed(2) + ' ‖ 天真链 ' + naive.per.railgun.castPerGame.toFixed(2) +
  ' ‖ 只开炮（零件）' + rail.per.railgun.castPerGame.toFixed(2) + ' ‖ v7 ' + v7r.per.railgun.castPerGame.toFixed(2) +
  '（' + v7r.per.railgun.gamesWith + ' 局）');
console.log('   v7 长程三件套同批出手/局：炮 ' + v7r.per.railgun.castPerGame.toFixed(2) + ' ‖ 大雷 ' +
  v7r.per.bigT.castPerGame.toFixed(2) + ' ‖ 环 ' + v7r.per.ring.castPerGame.toFixed(2) + ' ‖ 蓄 ' + v7r.per.charge.castPerGame.toFixed(2));
console.log('\n## 逐包「出过长程手的那局 vs 没出的那局」夺1 差（⚠观察量、有位置混杂，不是因果）');
console.log('行 ‖ ' + KEYS.map((k) => k + '(出/没出 局数)').join(' ‖ '));
for (const r of lines.filter((x) => x.label.indexOf('代 2') === 0 || x.label.indexOf('参照包') === 0)) {
  console.log(r.label.padEnd(24) + ' ‖ ' + KEYS.map((k) => {
    const c = r.cond[k];
    if (!c.winWithCast && !c.winWithout) return '-';
    return (c.winWithCast == null ? '—' : (100 * c.winWithCast).toFixed(0) + '%') + '/' + (c.winWithout == null ? '—' : (100 * c.winWithout).toFixed(0) + '%') +
      '(' + c.castGames + ')';
  }).join(' ‖ '));
}
console.log('\n判读口径：①为正 ⇒ 目标真为"多攒一拍再打"付账 ⇒ 长程是**目标在乎的缺口**，值得投机器时间；' +
  '①≈0 且 ②为负 ⇒ 这张考卷的最优解是短视的 ⇒ 包不出手长程手属**理性取舍**，训练侧该改的是考卷不是包。' +
  '分母小（每行 ' + lines[0].games + ' 局）时 1~3pt 的差读不出，先看在册 SE≈7.5pt/88 局那条线。');
