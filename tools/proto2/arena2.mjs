#!/usr/bin/env node
/* arena2.mjs — 2.0 的**扩表考卷**（研究用 · 千问 · 2026-10-29 夜，用户裁定"扩 arena 之后再训一批"）
 *
 * 为什么扩：旧 arena（ladder 16 格 = n∈{3,5} × 8 个旋转 × 20 只脚本 bot）上「只反弹」夺1 **65.3%**、
 *   参照包 v7 **40.4%** ⇒ 拿它当适应度会把"0 费后手 + 不还手"读成强（§E824 段 29 的三条机制）。
 *   只把人数/血量轴扩出去**不够**（10-29 实测：混合池上反射仍 56.0% > v7 40.3%）⇒ 必须同时扩**对手表**：
 *   把 30 枚单技能固定打法放进混合坐席，让"只一招"被自己的天敌（狙击/摄魂/剑/镜面）惩罚。
 *
 * 本尺的三条轴（全部同源、可指纹）：
 *   ① **对手表** = 20 只脚本 bot（`buildPoolSeeded`，与 profile2/ladder 同种子 20261029）+ 30 枚单技能固定打法
 *      + 均匀随机（地板）。每个非被测席按 (局号, 席位, 桌形) 确定性轮换 ⇒ 所有候选吃同一批对手。
 *   ② **桌形** = n∈{2,3,5,8,10} × multi(hp3)/multi4(hp4)/long(hp5) 的 11 格；n=8/10 只跑 multi（长程成本高）。
 *   ③ **货币** = 每局 `(wv − 1/n)/(1 − 1/n)`（wv：胜 1 / 平 0.5 / 负 0）⇒ 2P 与 10P 可比，平局不冒充失败；
 *      同时打印**原始夺1**（与 ladder 在册读数同定义）、平局率、干净胜（winner=我 且 hp>0）与单卡占比。
 *
 * ⚠ 与旧 ladder 的关系（别混着引）：
 *   · ladder 的 16 格是"8 个旋转 × 20 bot"的旧表；本尺的混合表**多了 30 枚固定打法**、桌形也换了。
 *   · `--legacy-check=` 会用**旧表原样**跑一条固定打法，作为"固定打法构造没漂"的出生证明
 *     （reflect 40 局/格 ≈ 66.6%，120 局/格 = 65.3%）。
 *   · 本尺的固定打法构造与 ladder **逐字同一路**（同一 `candidatesFor` + `econBase` + `lastCancelOther` 候选面）；
 *     ladder 那条是脚本、无法 import ⇒ 这里复制一份，用 legacy-check 而不是"看起来一样"来保。
 *
 * 用法：
 *   node tools/proto2/arena2.mjs --rungs=all --gamesPerShape=8 --legacy-check=40 --v7=1
 *   node tools/proto2/arena2.mjs --pack=scratch/arms/P2-A3-full-s7.bak --gamesPerShape=20
 *   node tools/proto2/arena2.mjs --pack=… --rungs=all --json=scratch/ARENA2.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { sandbox, loadChamp, buildPoolSeeded, poolFingerprint } from '../audit-lib.mjs';
import { install as installArch2 } from './arch2.mjs';

export const ARENA2_VERSION = 1;
export const POOL_SEED = 20261029;
export const TEMP_DEFAULT = 0.15;
export const REF_PACK = 'js/bundled-champion-3p.js';
/* 桌形：2–10 人（用户 2.0 目标里写明的范围）。n=8/10 只跑 multi —— long 140 回合 × 10 席的成本不划算，
 * 而 hp 轴在 2/3/5 人已经各有一格，缺的那两格不改变"一包跨人数/血量"的判据。 */
export const SHAPES = [
  { n: 2, mode: 'multi' }, { n: 2, mode: 'multi4' }, { n: 2, mode: 'long' },
  { n: 3, mode: 'multi' }, { n: 3, mode: 'multi4' }, { n: 3, mode: 'long' },
  { n: 5, mode: 'multi' }, { n: 5, mode: 'multi4' }, { n: 5, mode: 'long' },
  { n: 8, mode: 'multi' },
  { n: 10, mode: 'multi' },
];
const SALT = { loop: 101, frozen: 5077, hold: 90001 };

function mulberry32(a) {
  let x = a >>> 0;
  return function () { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* 与 ladder.mjs:98 逐字同一路（引擎它的 `{lockTarget: lastCancelOther}` 没导出）。改这里 = 换候选面 = 换尺。 */
function cancelOtherLocal(state, pid) {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) {
      return e.pids[0] === pid ? e.pids[1] : e.pids[0];
    }
  }
  return null;
}
function fixedChooser(P, T, R, keyVal) {
  return function (state, pid, legal) {
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
    if (!cs.length) return { key: R.SK.JI };
    for (const c of cs) {
      if (c.key === keyVal) return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
    }
    const ji = cs.filter((c) => c.key === R.SK.JI)[0] || cs[0];
    return { key: ji.key, target: ji.target == null ? null : ji.target, target2: null, bead: null };
  };
}
function randChooser(P, T, seed, jiKey) {
  const r = mulberry32(seed);
  return function (state, pid, legal) {
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: cancelOtherLocal(state, pid) }) || [];
    if (!cs.length) return { key: jiKey };
    const c = cs[Math.floor(r() * cs.length)];
    return { key: c.key, target: c.target == null ? null : c.target, target2: c.target2 == null ? null : c.target2, bead: c.bead || null };
  };
}

export function createArena2(W, opts) {
  const o = opts || {};
  const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
  if (!o.refParams) throw new Error('createArena2: 需要 refParams（v7 参照，必须在 installArch2 **之前**读出）');
  const ref = Float64Array.from(o.refParams);
  const poolSeed = o.poolSeed == null ? POOL_SEED : Number(o.poolSeed);
  const pool = buildPoolSeeded(T, ref, poolSeed);
  const poolFp = poolFingerprint(pool);
  const roster = [];
  for (const x of pool) roster.push({ name: x.name, kind: 'bot', sel: x.sel });
  for (const s of R.skills) roster.push({ name: 'only:' + s.key, kind: 'fixed', sel: fixedChooser(P, T, R, s.key) });
  roster.push({ name: 'random', kind: 'random', sel: null });
  const shapes = (o.shapes && o.shapes.length ? o.shapes : SHAPES).slice();
  const temp = o.temp == null ? TEMP_DEFAULT : Number(o.temp);
  if (!(temp > 0)) throw new Error('createArena2: temp 要正数（收到 ' + o.temp + '）');
  /* `highN=`（10-29 夜）：**高人数课程**。只改**训练环**的桌形抽样权重（n≥8 每格重复 highN 次），
   *   终局/冻结验证仍用**均匀的 11 格**（读数口径不能被课程改掉）。用来判 8P/10P 的弱是"训练里见得少"还是"表示/池化不行"。 */
  const highNW = Math.max(1, Math.floor(Number(o.highN) || 1));
  const loopShapes = [];
  for (let i = 0; i < shapes.length; i++) {
    const reps = (shapes[i].n >= 8 ? highNW : 1);
    for (let k = 0; k < reps; k++) loopShapes.push({ idx: i, n: shapes[i].n, mode: shapes[i].mode });
  }
  /* `stratified=1`（DS P1）：每局非被测席**优先塞捕食者**（bigT/reflect/snipe/guard 轮换），
   *   剩余席位再走 roster 轮换 ⇒ 同一条单技能不能靠"51 项里天敌只占 1 席"刷平均分。
   *   座位不够时（n=2/3）按 gameSeq 轮换捕食者，跨局覆盖。名单来自 battery 的实测对位，不靠猜。 */
  const stratified = !!o.stratified;
  const PREDATORS = ['bigT', 'reflect', 'snipe', 'guard'].filter((k) => R.skills.some((s) => s.key === k));
  if (stratified && !PREDATORS.length) throw new Error('createArena2: stratified=1 但捕食者键一个都不存在');
  /* 减毒（10-29 深夜）：满编分层场每局塞 min(席位,4) 个捕食者 ⇒ v7 干净净胜被打到 −0.003（机会线），
   *   场比被测对象还强、"进步"会被场强掩盖。`stratCap` 限每局捕食者数、`stratMix` 限多少比例的局用分层场
   *   （其余局退回平均场）⇒ 天敌仍每局/隔局在场，但不再一局四只。 */
  const stratCap = Math.max(1, Math.floor(Number(o.stratCap) || PREDATORS.length));
  const stratMix = Math.min(1, Math.max(0, o.stratMix == null ? 1 : Number(o.stratMix)));
  const fp = ['arena2.v' + ARENA2_VERSION, 'pool=' + poolFp, 'poolSeed=' + poolSeed,
    'shapes=' + shapes.map((s) => s.n + ':' + s.mode).join(','),
    'roster=' + roster.map((r) => r.name).join(','),
    highNW > 1 ? 'highN=' + highNW + '（仅训练环）' : 'highN=1',
    stratified ? 'stratified=' + PREDATORS.join('+') + '~cap' + stratCap + '~mix' + stratMix : 'stratified=0'].join('|');
  const fixedByKey = {};
  for (const r of roster) if (r.kind === 'fixed') fixedByKey[r.name.slice(5)] = r.sel;
  const fixed = (k) => fixedByKey[k];

  function playOne(sel, shapeIdx, gameSeq, salt) {
    const shape = shapes[shapeIdx];
    const n = shape.n;
    const seed = ((salt + gameSeq * 104729 + shapeIdx * 7919 + n * 97) >>> 0) || 1;
    const seat = gameSeq % n;
    const choosers = new Array(n), classes = new Array(n);
    choosers[seat] = sel; classes[seat] = '@me';
    const oppPids = [];
    for (let pid = 0; pid < n; pid++) if (pid !== seat) oppPids.push(pid);
    const stratHere = stratified && ((gameSeq * 2654435761 ^ shapeIdx * 40503 ^ (salt | 0)) >>> 0) % 1000 < Math.round(stratMix * 1000);
    const predN = stratHere ? Math.min(oppPids.length, stratCap) : 0;
    const predStart = gameSeq % Math.max(1, PREDATORS.length);
    for (let pi = 0; pi < oppPids.length; pi++) {
      const pid = oppPids[pi];
      let e;
      if (pi < predN) {
        const k = PREDATORS[(predStart + pi) % PREDATORS.length];
        e = { name: 'only:' + k, kind: 'fixed', sel: fixedByKey[k] };
      } else {
        const ri = (gameSeq * 7 + pid * 11 + shapeIdx * 13 + salt) % roster.length;
        e = roster[ri];
      }
      choosers[pid] = e.kind === 'random' ? randChooser(P, T, (seed ^ (pid * 2654435761)) >>> 0, R.SK.JI) : e.sel;
      classes[pid] = e.name;
    }
    const rm = T.oneGameN(choosers, seed, n, { regen: 0, mode: shape.mode });
    const st = rm.state;
    const hp = st.p[seat] ? Math.max(0, st.p[seat].hp) : 0;
    const win = rm.winner === seat;
    const draw = rm.winner === 'draw';
    const wv = win ? 1 : (draw ? 0.5 : 0);
    const scoreNet = (wv - 1 / n) / (1 - 1 / n);
    /* 干净胜货币（10-29 夜 (a) 臂）：只有 winner=我 **且 hp>0** 才算那一局的"胜"，平局/死者胜都按 0 记。
     * 动因：段 29 的 65.3% 里有一截是"hp≤0 仍判胜"；净胜把死者胜算赢 ⇒ 换这一档看它还值多少。 */
    const scoreClean = (((win && hp > 0) ? 1 : 0) - 1 / n) / (1 - 1 / n);
    let ahead = 0;
    for (let i = 0; i < n; i++) {
      if (i === seat) continue;
      const h = st.p[i] ? Math.max(0, st.p[i].hp) : 0;
      if (h > hp + 1e-9 || (Math.abs(h - hp) < 1e-9 && rm.dmg[i] > rm.dmg[seat])) ahead++;
    }
    const cat = {};
    let acts = 0;
    for (const e of (st.events || [])) if (e.type === 'action' && e.pid === seat) { acts++; cat[e.key] = (cat[e.key] || 0) + 1; }
    return {
      shape: shape.n + ':' + shape.mode, n, mode: shape.mode,
      win, draw, clean: win && hp > 0, top2: ahead <= 1,
      scoreNet, scoreClean, hp, rounds: rm.rounds || 0, acts, cat, classes,
    };
  }

  function emptyAgg() {
    return { games: 0, win: 0, draw: 0, clean: 0, top2: 0, scoreSum: 0, cleanScoreSum: 0, rounds: 0, acts: 0, cat: {}, byShape: {}, byClass: {} };
  }
  function addRow(agg, r) {
    agg.games++; agg.win += r.win ? 1 : 0; agg.draw += r.draw ? 1 : 0; agg.clean += r.clean ? 1 : 0;
    agg.top2 += r.top2 ? 1 : 0; agg.scoreSum += r.scoreNet; agg.cleanScoreSum += r.scoreClean; agg.rounds += r.rounds; agg.acts += r.acts;
    for (const k in r.cat) agg.cat[k] = (agg.cat[k] || 0) + r.cat[k];
    const sh = agg.byShape[r.shape] || (agg.byShape[r.shape] = { w: 0, g: 0, draw: 0, scoreSum: 0, cleanScoreSum: 0 });
    sh.g++; sh.w += r.win ? 1 : 0; sh.draw += r.draw ? 1 : 0; sh.scoreSum += r.scoreNet; sh.cleanScoreSum += r.scoreClean;
    for (const c of r.classes) {
      const x = agg.byClass[c] || (agg.byClass[c] = { w: 0, g: 0, draw: 0 });
      x.g++; x.w += r.win ? 1 : 0; x.draw += r.draw ? 1 : 0;
    }
  }
  function finish(agg) {
    const g = Math.max(1, agg.games);
    let mx = 0, key = null, nonji = 0;
    for (const k in agg.cat) { if (k !== R.SK.JI) { nonji += agg.cat[k]; if (agg.cat[k] > mx) { mx = agg.cat[k]; key = k; } } }
    const byShape = {};
    for (const k in agg.byShape) { const x = agg.byShape[k]; byShape[k] = { games: x.g, first: x.w / x.g, draw: x.draw / x.g, score: x.scoreSum / x.g, cleanScore: x.cleanScoreSum / x.g }; }
    const byClass = {};
    for (const k in agg.byClass) { const x = agg.byClass[k]; byClass[k] = { games: x.g, first: x.w / x.g, draw: x.draw / x.g }; }
    return {
      games: agg.games, first: agg.win / g, draw: agg.draw / g, clean: agg.clean / g, top2: agg.top2 / g,
      score: agg.scoreSum / g, cleanScore: agg.cleanScoreSum / g, rounds: agg.rounds / g, acts: agg.acts / g,
      maxCard: key == null ? null : { key, share: mx / Math.max(1, nonji), nonji },
      cat: agg.cat, byShape, byClass,
    };
  }
  function evalChooser(sel, cfg) {
    const c = cfg || {};
    const phase = c.phase || 'loop';
    const agg = emptyAgg();
    if (phase === 'loop') {
      const games = Math.max(1, c.games | 0);
      const gen = c.gen | 0;
      for (let g = 0; g < games; g++) {
        const gameSeq = gen * games + g;
        const slot = loopShapes[gameSeq % loopShapes.length];
        addRow(agg, playOne(sel, slot.idx, gameSeq, SALT.loop));
      }
    } else if (phase === 'holdout' || phase === 'frozen') {
      const per = Math.max(1, c.gamesPerShape | 0);
      const base = phase === 'holdout' ? 100000 : 200000;
      const salt = phase === 'holdout' ? SALT.hold : SALT.frozen;
      for (let s = 0; s < shapes.length; s++) for (let g = 0; g < per; g++) addRow(agg, playOne(sel, s, base + s * 1000 + g, salt));
    } else throw new Error('evalChooser: phase 只认 loop|holdout|frozen（收到 ' + phase + '）');
    const out = finish(agg);
    out.cur = c.cur === 'clean' ? 'clean' : 'net';
    if (out.cur === 'clean') out.score = out.cleanScore;
    return out;
  }
  function evalParams(params, cfg) {
    const t = (cfg && cfg.temp != null) ? Number(cfg.temp) : temp;
    return evalChooser(T.policyChooserN(params, t), cfg);
  }
  /* 接线自证：一局里 2.0 的 forwardCands 与 chooseCandidates 必须真被叫到（"没崩"不等于"接上了"）。 */
  function verifyWired(params, cfg) {
    const A = P.__arch2;
    if (!A) return { ok: false, reason: '没有 installArch2（不是 2.0 包）' };
    const before = A.CNT.forwards;
    let cc = 0;
    const realCC = P.chooseCandidates;
    P.chooseCandidates = function () { cc++; return realCC.apply(this, arguments); };
    let r = null;
    try { r = playOne(T.policyChooserN(params, (cfg && cfg.temp != null) ? Number(cfg.temp) : temp), 0, 7, SALT.loop); }
    finally { P.chooseCandidates = realCC; }
    const d = A.CNT.forwards - before;
    return { ok: d > 0 && cc > 0, forwards: d, chooseCandidatesCalls: cc, score: r && r.scoreNet };
  }
  /* 出生证明：用**旧 ladder 原样**（旧 20 项对手表 + 8 旋转 × n∈{3,5}）跑一条固定打法。
   * 40 局/格 在册 ≈66.6%、120 局/格 = 65.3% —— 对不上就说明构造漂了，本尺的数不许引用。 */
  function legacyCheck(sel, games) {
    const styles = ['breakdef', 'wall', 'tankline', 'guardgun', 'protowall', 'reflectmix', 'beadburst', 'aggro'];
    const cells = [];
    for (const n of [3, 5]) for (const nm of styles) { const idx = pool.findIndex((o) => o.name === nm); if (idx >= 0) cells.push({ n, nm, idx }); }
    let w = 0, g = 0;
    for (const cell of cells) for (let i = 0; i < games; i++) {
      const seed = 1000 + cell.n * 97 + cell.idx + i * 7919;
      const seat = i % cell.n;
      const ch = [];
      for (let pid = 0; pid < cell.n; pid++) ch.push(pid === seat ? sel : pool[(cell.idx + 1 + pid) % pool.length].sel);
      const rm = T.oneGameN(ch, seed, cell.n, { regen: 0, mode: 'multi' });
      if (rm.winner === seat) w++;
      g++;
    }
    return { win: 100 * w / Math.max(1, g), games: g, cells: cells.length };
  }
  return {
    version: ARENA2_VERSION, fp, temp, pool, poolFp, roster, shapes, poolSeed, highN: highNW, loopShapes, stratified, predators: PREDATORS, stratCap, stratMix,
    fixed, evalChooser, evalParams, verifyWired, legacyCheck,
    chooserOf: (params, t) => T.policyChooserN(params, t == null ? temp : t),
    rosterNames: () => roster.map((r) => r.name),
  };
}

/* ===================== CLI ===================== */
function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const PACK = arg('pack', '');
  const RUN_V7 = arg('v7', '') === '1';
  const RUNGS = arg('rungs', 'none');
  const GPS = Math.max(2, Number(arg('gamesPerShape', 8)) || 8);
  const TEMP = Number(arg('temp', TEMP_DEFAULT));
  /* `--temps=0.001,0.02,0.05,...`：**温度标定**（10-29 夜）。v7 的 softmax 饱和、几乎不随 temp 动；
   *   2.0 的头 logits 尺度小、最佳温度依包而异（COMBO-s11 在 0.05，COMBO-s7 在 0.15）。
   *   ⇒ 每枚包必须按**自己的最佳温度**报读数，否则"同一名义 temp"不是同一个熵。 */
  const TEMPS = String(arg('temps', '')).split(',').map(Number).filter((x) => x > 0);
  const LEGACY = Math.max(0, Number(arg('legacy-check', 0)) || 0);
  const POOLSEED = Number(arg('poolSeed', POOL_SEED));
  const STRAT_ARG = String(arg('strat', ''));
  const STRAT = STRAT_ARG === '1' || STRAT_ARG === 'full' || STRAT_ARG === 'mild';
  const STRAT_CAP = arg('stratCap', STRAT_ARG === 'mild' ? '2' : '');
  const STRAT_MIX = arg('stratMix', STRAT_ARG === 'mild' ? '0.5' : '');
  const JSON_OUT = arg('json', '');
  const REF = arg('ref', REF_PACK);
  if (!(TEMP > 0)) { console.error('⛔ --temp 要正数'); process.exit(2); }
  if (RUNGS !== 'none' && RUNGS !== 'all') { console.error('⛔ --rungs 只认 all|none'); process.exit(2); }

  const W = sandbox();
  const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
  const ref = loadChamp(W, REF, '');
  if (!ref) { console.error('⛔ 参照包读不出（' + REF + '）⇒ 对手表无法固定'); process.exit(2); }
  const refParams = Float64Array.from(ref);
  if (typeof T.setBigTPush === 'function') T.setBigTPush(12);
  const A = createArena2(W, { refParams, temp: TEMP, poolSeed: POOLSEED, stratified: STRAT, stratCap: STRAT_CAP || undefined, stratMix: STRAT_MIX || undefined });
  console.log('# arena2 扩表考卷 ‖ 指纹 ' + A.fp + ' ‖ 桌形 ' + A.shapes.length + '（' + A.shapes.map((s) => s.n + ':' + s.mode).join(',') + '）' +
    ' ‖ 对手表 ' + A.roster.length + ' 项（' + A.pool.length + ' 脚本 bot + ' + (A.roster.length - A.pool.length - 1) + ' 单技能 + 均匀随机）' +
    (A.stratified ? ' ‖ **分层场**（' + A.predators.join('/') + ' · 每局 ≤' + A.stratCap + ' 只 · ' + (100 * A.stratMix).toFixed(0) + '% 的局用分层场）' : '') +
    ' ‖ 每格 ' + GPS + ' 局 ‖ ' + (TEMPS.length ? '温度扫描 ' + TEMPS.join('/') : 'temp=' + TEMP));

  if (LEGACY) {
    const r = A.legacyCheck(A.fixed('reflect'), LEGACY);
    console.log('[出生证明] 旧 ladder 16 格 × ' + LEGACY + ' 局/格：只反弹 夺1 ' + r.win.toFixed(1) + '%（在册 40 局/格 ≈66.6 ‖ 120 局/格 65.3）' +
      ' ‖ 局 ' + r.games + ' ⇒ ' + (Math.abs(r.win - 66.6) <= 3 ? '✔ 构造没漂' : '⚠ 偏离在册 >3pt：先查构造，别引用本尺'));
    if (Math.abs(r.win - 66.6) > 6) process.exit(3);
  }

  let packParams = null, packArch = null;
  if (PACK) {
    let raw;
    try { raw = JSON.parse(readFileSync(PACK, 'utf8').replace(/^[^{]*/, '').replace(/;?\s*$/, '')); }
    catch (e) { console.error('⛔ 读不到/解不开 ' + PACK + '：' + String(e && e.message || e)); process.exit(2); }
    if (raw.v !== 90) { console.error('⛔ ' + PACK + ' 不是 2.0 容器（v=' + raw.v + '）'); process.exit(2); }
    packArch = raw.arch || 'S1';
    const cfg = { mutMode: 'seg', ...(raw.dims || {}) };
    if (packArch === 'S1o') cfg.input = 'obs3';
    installArch2(W, cfg);
    if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
    packParams = Float64Array.from(P.unpack(raw, true));
    if (!packParams || packParams.length !== P.paramCount()) { console.error('⛔ 包形状不对：' + (packParams && packParams.length) + ' vs ' + P.paramCount()); process.exit(7); }
    const w = A.verifyWired(packParams);
    if (!w.ok) { console.error('⛔ 2.0 接线没生效：' + JSON.stringify(w)); process.exit(7); }
    console.log('[接线自证] forwardCands +' + w.forwards + ' ‖ chooseCandidates ' + w.chooseCandidatesCalls + ' 次 ‖ 校准局净胜 ' + Number(w.score).toFixed(3));
  }

  const rows = [];
  const packTag = '2.0包 ' + PACK.replace(/^.*[\\/]/, '');
  if (TEMPS.length) {
    /* 温度扫描：只跑被测包与 v7（阶梯不吃温度 ⇒ 与 --rungs=all 互斥，避免 30×N 行放大成本） */
    if (RUNGS === 'all') { console.error('⛔ --temps 与 --rungs=all 不同时用（阶梯是固定打法，不吃温度）'); process.exit(2); }
    for (const t of TEMPS) {
      if (RUN_V7) rows.push({ tag: '参照v7 t=' + t, temp: t, ...A.evalParams(refParams, { phase: 'holdout', gamesPerShape: GPS, temp: t }) });
      if (packParams) rows.push({ tag: packTag + ' t=' + t, temp: t, arch: packArch, ...A.evalParams(packParams, { phase: 'holdout', gamesPerShape: GPS, temp: t }) });
    }
  } else {
    if (RUN_V7) rows.push({ tag: '参照v7', ...A.evalParams(refParams, { phase: 'holdout', gamesPerShape: GPS, temp: TEMP }) });
    if (packParams) rows.push({ tag: packTag, arch: packArch, ...A.evalParams(packParams, { phase: 'holdout', gamesPerShape: GPS, temp: TEMP }) });
    if (RUNGS === 'all') {
      for (const s of R.skills) rows.push({ tag: 'only:' + s.key, key: s.key, ...A.evalChooser(A.fixed(s.key), { phase: 'holdout', gamesPerShape: GPS }) });
    }
  }
  const pct = (x) => (100 * x).toFixed(1) + '%';
  for (const r of rows) {
    console.log('· ' + String(r.tag).padEnd(26) + ' ‖ 夺1 ' + pct(r.first) + ' ‖ 净胜 ' + r.score.toFixed(3) + ' ‖ 干净净胜 ' + r.cleanScore.toFixed(3) + ' ‖ 平局 ' + pct(r.draw) +
      ' ‖ 干净胜 ' + pct(r.clean) + ' ‖ 前2 ' + pct(r.top2) + ' ‖ 单卡 ' + (r.maxCard ? r.maxCard.key + ' ' + (100 * r.maxCard.share).toFixed(1) + '%（非ジ ' + r.maxCard.nonji + ' 手）' : '—'));
    if (!TEMPS.length && r.tag.indexOf('2.0包') === 0) {
      console.log('   逐桌形夺1：' + Object.keys(r.byShape).map((k) => k + ' ' + pct(r.byShape[k].first)).join(' ‖ '));
    }
  }
  if (TEMPS.length && packParams) {
    const ps = rows.filter((r) => r.tag.indexOf(packTag) === 0);
    const vs = rows.filter((r) => r.tag.indexOf('参照v7') === 0);
    const bn = ps.slice().sort((a, b) => b.score - a.score)[0];
    const bc = ps.slice().sort((a, b) => b.cleanScore - a.cleanScore)[0];
    /* P5（DS 10-29 夜）：**温度留出**——在 2P+3P 上选温度，在 5P/8P/10P 上评。
     * 全桌形最佳温度是"选温 + 评价同一批桌"的乐观值，不能单独当结论（§十二 实测差 0.103）。 */
    const shapeN = (k) => parseInt(k.split(':')[0], 10);
    const meanClean = (r, pred) => { let s = 0, c = 0; for (const k in r.byShape) if (pred(shapeN(k))) { s += r.byShape[k].cleanScore; c++; } return c ? s / c : NaN; };
    const lowN = (r) => meanClean(r, (n) => n <= 3);
    const highN = (r) => meanClean(r, (n) => n >= 5);
    const bl = ps.slice().sort((a, b) => lowN(b) - lowN(a))[0];
    const vlc = vs.length ? vs.slice().sort((a, b) => lowN(b) - lowN(a))[0] : null;
    console.log('\n⇒ 被测包最佳温度：按净胜 **t=' + bn.temp + '**（' + bn.score.toFixed(3) + ' / 夺1 ' + pct(bn.first) + '）‖ 按干净净胜 **t=' + bc.temp + '**（' + bc.cleanScore.toFixed(3) + ' / 夺1 ' + pct(bc.first) + '）');
    console.log('   **温度留出**（2P+3P 选温 → 5P/8P/10P 评价）：选温 t=' + bl.temp + '，留出高 n 干净净胜 **' + highN(bl).toFixed(3) + '**' +
      (vlc ? ' ‖ v7 同规则：选温 t=' + vlc.temp + '，留出 ' + highN(vlc).toFixed(3) + ' ⇒ 差 ' + (highN(bl) - highN(vlc)).toFixed(3) : ''));
    if (RUN_V7) {
      const vc = vs.slice().sort((a, b) => b.cleanScore - a.cleanScore)[0];
      console.log('   参照 v7 最佳干净净胜 ' + vc.cleanScore.toFixed(3) + '（t=' + vc.temp + '）⇒ 全桌形差距 ' + (bc.cleanScore - vc.cleanScore).toFixed(3) + '（**这是选温乐观值**）');
    }
  }
  const rungs = rows.filter((r) => r.tag.indexOf('only:') === 0).sort((a, b) => b.first - a.first);
  if (rungs.length) {
    console.log('\n⇒ 单技能阶梯（夺1 前 8）：' + rungs.slice(0, 8).map((r) => r.key + ' ' + pct(r.first)).join('  ‖  '));
    console.log('   末 3：' + rungs.slice(-3).map((r) => r.key + ' ' + pct(r.first)).join('  ‖  '));
    const v7 = rows.filter((r) => r.tag === '参照v7')[0];
    if (v7) {
      const top = rungs[0];
      console.log('   ⇒ 参照 v7 ' + pct(v7.first) + ' ‖ 最高固定打法 ' + top.key + ' ' + pct(top.first) + ' ⇒ ' +
        (top.first >= v7.first ? '⛔ 仍不能当强度尺（退化打法在参照之上）' : '✔ 固定打法在参照之下（本尺可判）'));
    }
  }
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ tool: 'tools/proto2/arena2.mjs', fp: A.fp, temp: TEMP, temps: TEMPS.length ? TEMPS : null, gamesPerShape: GPS, poolSeed: POOLSEED, rows }, null, 1) + '\n');
    console.log('\n✔ 已写 ' + JSON_OUT);
  }
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
