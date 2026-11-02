#!/usr/bin/env node
/* offer-trace.mjs — 决策点上的**菜单（offered）vs 选择（chosen）**，用来分诊"某张桌子上打不出某一手"是
 *   **经济/引擎门没开**（那一手压根不在买得起的候选里）还是**策略不选**（在菜单里但 argmax 不给它）。
 *
 * 为什么另造一把：`longrange-offer.mjs` 的提供率是**夹具**（`lateFix` 的轮换键选择器 `R.skills[(round*5+pid*3+g)%K]`）
 *   ⇒ 11-01 实测四枚不同包读数一模一样 ⇒ 它不是包级读数（勘误钉在 PREREG-2026-11-01-BUCKET-RETRAIN §一）。
 *   本尺直接把引擎交给 chooser 的 `legal` 数组按 `affordable` 过滤（= `policy.js:candidatesFor` 的同一口径，
 *   v1.5.74 的"买不起不进候选表"），所以"菜单"就是网络真看到的那张表。
 *
 * 两个可分开的轴（镜像桌"退化成一维枪"的两个候选病因）：
 *   · 对手类型 `--field=mirror|scripts|rival`（`mirrorHealth` 是 5 席同包，产品桌是**逐席各抽一枚池成员 + 掺脚本**）
 *   · 探索剂量 `--eps=`（**线上进冠军席是 ε=0.2 · k=5 · soft**（`ui.js:722` 那段），而 `mirrorHealth` 走
 *     `trainChooser` ⇒ ε=0 纯 argmax；`ui.js:727` 自己记过"2 席长程镜像 ε=0 ⇒ 104 回合 0% 决胜"）
 *
 * 用法：node tools/proto2/offer-trace.mjs --pack=<bak|js> [--field=mirror] [--eps=0] [--games=30] [--n=5]
 *         [--mode=multi] [--temp=0.15] [--rival=<同代包>] [--keys=charge,ring,railgun,bigT,sword,gun] [--out=]
 * 口径：只统计**被测席**（mirror/rival 时 mirror 全席同包 ⇒ 全席都是被测）；分母（决策数/局数/回合数）一律打印。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', '');
const FIELD = arg('field', 'mirror');
const EPS = Number(arg('eps', 0));
const EPSK = Number(arg('epsK', 5));
const EPSMODE = arg('epsMode', 'soft');
const GAMES = Math.max(1, Number(arg('games', 30)) || 30);
const N = Math.max(2, Number(arg('n', 5)) || 5);
const MODE = arg('mode', 'multi');
const TEMP = Number(arg('temp', 0.15));
const RIVAL = arg('rival', '');
const KEYS = arg('keys', 'charge,ring,railgun,bigT,sword,gun').split(',').map((s) => s.trim()).filter(Boolean);
if (!PACK) { console.error('用法：--pack=<.bak|.js> [--field=mirror|scripts|rival] [--eps=]'); process.exit(2); }
if (FIELD === 'rival' && !RIVAL) { console.error('⛔ --field=rival 要配 --rival=<包>'); process.exit(2); }

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const SK = R.SK;
/* ⚑ 引擎注入档（11-02 补）：`BIGT_PUSH=12` 从 v1.5.333 起默认开，且它挂在 **`policyChooserN` 内部**（`evo.js:967`）
 *   ⇒ 本尺此前每一次"大雷在菜单 40 次、选了 39 次"都可能有引擎替它按的成分，不是包自己选的。
 *   纪律照 `skill-report`/`eval-5p`：**不设旗标 = 引擎默认档**（历史读数口径不动、不许悄悄改）；
 *   要干净读数显式 `--shipbigt=0`（+ `--shipdrain=0`），并打印**下达值 + 回读值**（覆盖式接入要自证真被调用）。 */
{
  const KN = [['shipbigt', 'setBigTPush', 'bigTPushOn'], ['shipdrain', 'setDrainPush', 'drainPushOn']];
  const got = [];
  for (const [flag, setter, getter] of KN) {
    const f = argv.find((x) => x.startsWith('--' + flag + '='));
    if (!f) continue;
    const v = f.slice(flag.length + 3);
    W.EpirusTrainer[setter](v);
    got.push(flag + '→下达 ' + v + ' ‖ 回读 ' + W.EpirusTrainer[getter]());
  }
  if (got.length) console.log('[注入档] ' + got.join(' ‖ '));
  else console.log('[注入档] ⚠ 未下达 ⇒ 走引擎默认档（大雷兑现 ' + W.EpirusTrainer.bigTPushOn() + ' = 每 12 个窗口强塞一次）');
}
const KEY_ALIAS = {
  charge: SK.CHARGE, ring: SK.RING, railgun: SK.RAILGUN, bigT: SK.BIG_T, sword: SK.SWORD, gun: SK.GUN,
  laserEye: SK.LASER_EYE, miniT: SK.MINI_T, cannon: SK.CANNON, ji: SK.JI, transfer: SK.TRANSFER
};
const WANT = KEYS.map((k) => { const v = KEY_ALIAS[k] || k; if (!v) { console.error('⛔ 不认的键名 ' + k); process.exit(2); } return { name: k, key: v }; });

function loadPack(p) {
  const raw0 = (() => { try { return readPack2(p); } catch (e) { return null; } })();
  if (raw0 && raw0.v !== 92) return { v7: loadChamp(W, p) };
  if (!raw0) { const c7 = loadChamp(W, p); return c7 ? { v7: c7 } : null; }
  const got = packCfgExit(raw0, p);
  const installed = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pp = Float64Array.from(P.unpack(raw0, true));
  installed.restore();
  return { params: pp, container: 'v:' + raw0.v + ' gen' + (raw0.dims && raw0.dims.gen) + ' ' + (raw0.dims && raw0.dims.input) + ' n=' + pp.length };
}
const self = loadPack(PACK);
if (!self || (!self.params && !self.v7)) { console.error('⛔ 读不出 ' + PACK); process.exit(7); }
let selfParams = self.v7 ? Float64Array.from(self.v7) : self.params;
const CONTAINER = self.v7 ? 'v7 ' + selfParams.length : self.container;

/* 被测席的 chooser：包一层，把"当时买得起的键集"与"最终选择"都记下来。 */
const RAW0 = { n: 0 };
function subjectChooser(installed) {
  const inner = T.policyChooserN(selfParams, TEMP, EPS, EPSK, EPSMODE);
  return function (state, pid, legal) {
    RAW0.n++;
    const aff = new Set(legal.filter((l) => l.affordable !== false).map((l) => l.key));
    const out = inner.apply(null, arguments);
    REC.dec++;
    const p = state.p[pid];
    REC.rounds.push(state.round);
    REC.epHistogram[p.ep] = (REC.epHistogram[p.ep] || 0) + 1;
    REC.beads[(p.elec > 0 ? 'e' : '') + (p.boom > 0 ? 'b' : '') || 'none'] = (REC.beads[(p.elec > 0 ? 'e' : '') + (p.boom > 0 ? 'b' : '') || 'none'] || 0) + 1;
    for (const w of WANT) {
      if (aff.has(w.key)) { REC.offered[w.name]++; if (out && out.key === w.key) REC.chosenWhenOffered[w.name]++; }
      else if (out && out.key === w.key) REC.chosenWhenNotOffered[w.name]++;   /* 应当恒 0：不是 0 就是接线错 */
    }
    if (out && out.key) REC.pickKeys[out.key] = (REC.pickKeys[out.key] || 0) + 1;
    return out;
  };
}
const REC = { dec: 0, rounds: [], epHistogram: {}, beads: {}, offered: {}, chosenWhenOffered: {}, chosenWhenNotOffered: {}, pickKeys: {} };
for (const w of WANT) { REC.offered[w.name] = 0; REC.chosenWhenOffered[w.name] = 0; REC.chosenWhenNotOffered[w.name] = 0; REC.chosenWhenNotOffered[w.name] = 0; }

/* 装代 3 容器（镜像/对局全程装着；v7 锚不装）
 * ⚑ 顺序有牙：**先**读 v7 参照束/建 arena2，**再**装 arch2——装着代 3 容器时 `P.unpack` 只认 v:92，
 *   `loadChamp` 会把线上冠军读成 null（breadth2 11-01 同一个坑，第二次踩）。 */
const REFP = self.v7 ? selfParams : Float64Array.from(loadChamp(W, 'js/bundled-champion-3p.js') || []);
if (!self.v7 && !REFP.length) { console.error('⛔ 读不出 v7 参照束（scripts 场要用它的对手表）'); process.exit(7); }
/* ⚑ 11-02 修：这一行此前只认 `'scripts'`，而上面的 FIELD 归一化根本不会产出 `'scripts'`（默认是 `'strat'`）
 *   ⇒ 脚本对手桌那条路**从来没被接通过**（`--field=strat` 当场 `Cannot read properties of null`，因为我一直用
 *   `--field=mirror`，这格没人踩到）。现在两种写法都认，缺桌形仍走下面那条响亮退出。 */
const SCR_ARENA = (FIELD === 'scripts' || FIELD === 'strat')
  ? createArena2(W, { refParams: REFP, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' })
  : null;
const SCR_SHAPE = SCR_ARENA ? SCR_ARENA.shapes.findIndex((s) => s.n === N && s.mode === MODE) : -1;
if (SCR_ARENA && SCR_SHAPE < 0) { console.error('⛔ 没有桌形 ' + N + ':' + MODE); process.exit(2); }
/* 对手包同样**必须在装 arch2 之前读**（装着代 3 容器时 v7 束读不出）。跨代对桌（gen3 被测 vs v7 对手）
 *   本尺**不做**：两套前向在同一个沙箱里会互相劫持，要的是双沙箱的桌 ⇒ 响亮拒，不给假读数。 */
const RIV_PRE = FIELD === 'rival' ? loadPack(RIVAL) : null;
if (FIELD === 'rival' && (!RIV_PRE || (!RIV_PRE.params && !RIV_PRE.v7))) { console.error('⛔ 读不出对手包 ' + RIVAL); process.exit(7); }

let cfgRestore = null;
if (!self.v7) {
  const got = packCfgExit(readPack2(PACK), PACK);
  cfgRestore = installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
}

const subs = [];
const subj = subjectChooser();
if (FIELD === 'mirror') for (let i = 0; i < N; i++) subs.push(subj);
else if (FIELD === 'rival') {
  const rp = RIV_PRE.v7 ? Float64Array.from(RIV_PRE.v7) : RIV_PRE.params;
  if (rp.length !== selfParams.length) {
    console.error('⛔ rival 参数长 ' + rp.length + ' ≠ 被测 ' + selfParams.length +
      ' ⇒ **跨代对桌不在本尺的能力里**（代 3 前向与 v7 前向共用一个沙箱会互相劫持，读数会是假的）');
    process.exit(7);
  }
  const rch = T.policyChooserN(rp, TEMP, EPS, EPSK, EPSMODE);
  subs.push(subj); for (let i = 1; i < N; i++) subs.push(rch);
} else {
  const A = SCR_ARENA;
  const shapeIdx = SCR_SHAPE;
  subs.push(subj);
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + shapeIdx * 13 + 101) % A.roster.length;
    let e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    subs.push(e.sel);
    subs[pid].__opp = e.name;
  }
}

const gamesOut = [];
/* 反事实旋钮（**只在 legal 之前动**——`play.js:46` 的注释指定了这类公平测量的唯一开口：
 *   珠类技能的门在 `computeCost` 里判，`legal` 是先算的 ⇒ 任何"在 chooser 里补珠"都太晚）。
 *   · --freeBead=elec|boom|both ：每回合开局给被测席 1 颗珠 ⇒ 验"炮/激光眼进不了菜单"是不是纯经济门
 *   · --freeEp=N ：每回合开局把被测席的 ep 抬到至少 N ⇒ 验"雷/环进不了菜单"是不是钱不够 */
const FREEBEAD = arg('freeBead', '');
const FREEEP = Number(arg('freeEp', 0));
if (FREEBEAD && ['elec', 'boom', 'both'].indexOf(FREEBEAD) < 0) { console.error('⛔ --freeBead 只认 elec|boom|both'); process.exit(2); }
const onRoundStart = (FREEBEAD || FREEEP > 0) ? function (state) {
  for (let pid = 0; pid < N; pid++) {
    if (FIELD !== 'mirror' && pid !== 0) continue;   /* 只给被测席开，对手不动 */
    const p = state.p[pid];
    if (!p || p.hp <= 0) continue;
    if (FREEBEAD === 'elec' || FREEBEAD === 'both') p.elec += 1;
    if (FREEBEAD === 'boom' || FREEBEAD === 'both') p.boom += 1;
    if (FREEEP > 0 && p.ep < FREEEP) p.ep = FREEEP;
  }
} : undefined;
for (let g = 0; g < GAMES; g++) {
  REC.rounds = [];
  const st = W.EpirusState.createState(MODE === 'long' ? 'long' : 'multi', { next: T.mulberry32(9000 + g) }, N);
  st.slotSalt = ((Math.imul(g + 3, 0x85ebca6b) ^ 0x27d4eb2f) >>> 0);
  if (W.EpirusPlay && W.EpirusPlay.autoGameN) W.EpirusPlay.autoGameN(st, subs, undefined, onRoundStart);
  else T.autoGameN(st, subs);
  gamesOut.push({ rounds: st.round, winner: st.winner, over: st.over, draw: st.winner === 'draw' || st.winner == null });
}

const roundsMean = gamesOut.reduce((a, x) => a + x.rounds, 0) / GAMES;
const drawRate = gamesOut.filter((x) => x.draw).length / GAMES;
const pct = (x) => (x == null ? '—' : (100 * x).toFixed(1) + '%');
const totalPick = Object.values(REC.pickKeys).reduce((a, b) => a + b, 0);
console.log('=== offer-trace ‖ ' + PACK.replace(/^.*[\\/]/, '') + '（' + CONTAINER + '） ‖ 场=' + FIELD +
  (FIELD === 'scripts' ? '（对手 ' + subs.slice(1).map((s) => s.__opp).join(',') + '）' : '') +
  ' ‖ ε=' + EPS + (EPS ? ' k=' + EPSK + ' ' + EPSMODE : '（纯 argmax=mirrorHealth 档）') + ' ‖ temp=' + TEMP + ' ‖ ' + GAMES + ' 局 n=' + N + ' ' + MODE +
  ' ‖ 反事实 ' + ((FREEBEAD ? '每回合开珠=' + FREEBEAD + ' ' : '') + (FREEEP > 0 ? '每回合 ep≥' + FREEEP : '') || '（不开，纯现状）'));
console.log('自证：chooser 被调 ' + RAW0.n + ' 次（被测席决策 ' + REC.dec + '）‖ 局均回合 ' + roundsMean.toFixed(1) + ' ‖ 决胜率 ' + pct(1 - drawRate));
console.log('决策点 ep 分带：' + Object.keys(REC.epHistogram).map((k) => Number(k)).sort((a, b) => a - b).slice(0, 12).map((k) => k + '→' + REC.epHistogram[k]).join(' ') +
  ' ‖ 手里有珠的决策占比 电/爆/双/无 = ' + ['e', 'b', 'eb', 'none'].map((k) => (REC.beads[k] || 0)).join('/'));
console.log('键'.padEnd(12) + '菜单里(次)'.padEnd(12) + '提供率'.padEnd(10) + '有而选(次)'.padEnd(12) + '给了就选'.padEnd(12) + '总选择'.padEnd(10) + '选择不该发生在菜单外');
for (const w of WANT) {
  const off = REC.offered[w.name], ch = REC.chosenWhenOffered[w.name];
  const tot = REC.pickKeys[w.key] || 0;
  console.log(w.name.padEnd(12) + String(off).padEnd(12) + pct(REC.dec ? off / REC.dec : null).padEnd(10) +
    String(ch).padEnd(12) + pct(off ? ch / off : null).padEnd(12) + String(tot).padEnd(10) +
    (REC.chosenWhenNotOffered[w.name] ? '⛔ ' + REC.chosenWhenNotOffered[w.name] + ' 次' : '0 ✔'));
}
const nonJi = Object.keys(REC.pickKeys).filter((k) => k !== SK.JI);
const nJi = REC.pickKeys[SK.JI] || 0;
const nTot = totalPick;
console.log('出手分布（全键，含ジ）：' + Object.keys(REC.pickKeys).sort((a, b) => REC.pickKeys[b] - REC.pickKeys[a]).slice(0, 10)
  .map((k) => (R.byKey[k] && R.byKey[k].name || k) + ' ' + pct(REC.pickKeys[k] / nTot)).join(' ‖ '));
console.log('非ジ出手种类=' + nonJi.length + ' ‖ 非ジ里最大单键份额 ' + pct(nonJi.length ? Math.max.apply(null, nonJi.map((k) => REC.pickKeys[k])) / nonJi.reduce((a, k) => a + REC.pickKeys[k], 0) : null) +
  ' ‖ ジ占比 ' + pct(nJi / nTot) + ' ‖ 分母 ' + nTot + ' 次出手 / ' + REC.dec + ' 个被测决策 / ' + GAMES + ' 局');
if (cfgRestore) cfgRestore.restore();
const row = { pack: PACK, container: CONTAINER, field: FIELD, eps: EPS, epsK: EPSK, epsMode: EPSMODE, temp: TEMP, games: GAMES, n: N, mode: MODE,
  dec: REC.dec, roundsMean: roundsMean, drawRate: drawRate, epHistogram: REC.epHistogram, beads: REC.beads,
  offered: REC.offered, chosenWhenOffered: REC.chosenWhenOffered, chosenWhenNotOffered: REC.chosenWhenNotOffered,
  pickKeys: REC.pickKeys, nonJiKinds: nonJi.length };
const OUT = arg('out', '');
if (OUT) writeFileSync(OUT, JSON.stringify({ ts: new Date().toISOString(), rows: [row] }, null, 2));
