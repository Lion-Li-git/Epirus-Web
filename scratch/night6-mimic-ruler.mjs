#!/usr/bin/env node
/* night6-mimic-ruler.mjs —— gen-3 的「人席替身」尺（ZCode · 11-04 凌晨）
 *
 * 背景：§四十三 证明 1st 率尺与直交尺在 gen-3 上不同序 ⇒ 部署难度序需要第三把尺 = v7 的「人类形状替身」
 * （`tools/human-pool.mjs` 的 makeMimic，56 局真人日志条件分布；probe-diff-ladder §E596 验带用的同一份，单源复用）。
 * 装配照抄 probe-diff-ladder：1 席替身 vs (N-1) 席同一带的 AI；**替身座位逐局轮转**（不恒占 0 号）。
 * 配对：各带同一批种子（局 rng 与替身 rng 各自同序）⇒ 跨带夺冠率差可配对读。
 * 输出：每带替身夺冠率 ± 二项 SE（n=局数）⇒ 部署难度序在替身尺下是否 hard < mid < soft。
 * ⚑ 11-04 晨班补：**默认落盘**（`--out=`，缺省 `scratch/night6/mimic-ruler.tsv`）。
 *   本夜 §四十四/§四十六 的读数只进了 stdout ⇒ 文档里的 24.0/16.8/6.4 没有原件可查，而它是待裁第 1 条
 *   （"分带先定尺"）的唯一输入 ⇒ 按在册规矩"跑臂必须有缺省落点"补上，重跑即成台账。
 */
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';
import { loadPool, makeMimic } from '../tools/human-pool.mjs';

const FLAG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=(.*)$/i.exec(a); if (m) FLAG[m[1]] = m[2]; }
const GAMES = Number(FLAG.games || 250);
const SEED = Number(FLAG.seed || 88000);
const OUT = FLAG.out || 'scratch/night6/mimic-ruler.tsv';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

function loadPackParams(p) {
  const src = readFileSync(p, 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
  if (at < 0) throw new Error('没有外壳: ' + p);
  let d = 0, inS = false, esc = false, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
  const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
  if (raw.v === 7 || (raw.a && raw.v == null)) return { params: Float64Array.from(raw.a), v7: true, cfg: null };
  const got = packCfgExit(raw, p);
  install(W, got.cfg);
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return { params: Float64Array.from(P.unpack(raw, true)), v7: false, cfg: got.cfg };
}
const BAND = {};
for (const l of readFileSync('scratch/night6/bands-final.tsv', 'utf8').split(/\r?\n/).filter(Boolean).slice(1)) { const c = l.split('\t'); BAND[c[0]] = c[1]; }
/* 三带（§三十一 的 7/7/7 排名切法） */
const T3 = {
  hard: ['L5-1200-s13', 'D1200-s13', 'DSTR4-s13', 'EFFG-s41', 'EFFG-s5', 'EFFG-s7', 'GD3ALL-G5-8p-s41'],
  mid: ['GD3ALL-PUSHON-s41', 'G5DEF-s41', 'GD3ALL-POPP-s17', 'GD3ALL-POPP-s41', 'GD3ALL-PUSHON-s13', 'D-b-hpseed-s13', 'D-a-s13'],
  soft: ['GD3ALL-PLAIN-s13', 'DDEF-s13', 'DSTR-s13', 'CB-s13', 'LE-s13', 'GD3ALL-G5-s13', 'GD3ALL-NGA2R-s41']
};
const NEWSTARS = ['HPG-s7', 'HPG-s41', 'HPG-s13', 'CB3-s7', 'CB3-s13'];
T3.newstars = NEWSTARS;
const PATH = {
  'L5-1200-s13': 'scratch/night5/', 'D1200-s13': 'scratch/night5/', 'EFFG-s41': 'scratch/night5/', 'EFFG-s5': 'scratch/night5/', 'EFFG-s7': 'scratch/night5/', 'G5DEF-s41': 'scratch/night5/',
  'DSTR4-s13': 'scratch/night4/', 'D-b-hpseed-s13': 'scratch/night4/', 'DDEF-s13': 'scratch/night4/', 'DSTR-s13': 'scratch/night4/', 'CB-s13': 'scratch/night4/', 'LE-s13': 'scratch/night4/', 'D-a-s13': 'scratch/night4/',
  'GD3ALL-G5-8p-s41': 'scratch/night3/', 'GD3ALL-PUSHON-s41': 'scratch/night3/', 'GD3ALL-POPP-s17': 'scratch/night3/', 'GD3ALL-POPP-s41': 'scratch/night3/', 'GD3ALL-PUSHON-s13': 'scratch/night3/', 'GD3ALL-PLAIN-s13': 'scratch/night3/', 'GD3ALL-G5-s13': 'scratch/night3/', 'GD3ALL-NGA2R-s41': 'scratch/night3/',
  'HPG-s7': 'scratch/night6/', 'HPG-s41': 'scratch/night6/', 'HPG-s13': 'scratch/night6/', 'CB3-s7': 'scratch/night6/', 'CB3-s13': 'scratch/night6/'
};

const pool = loadPool(W, 'human', undefined);   /* 与 probe-diff-ladder 同一份（56 局真人日志，§E155） */
console.log('替身池：' + pool.games + ' 局真人日志 · ' + pool.conds + ' 条件 · ' + pool.tot + ' 决策');
try { const d = OUT.split(/[\\/]/).slice(0, -1).join('/'); if (d) mkdirSync(d, { recursive: true }); } catch (eOut0) {}
if (!existsSync(OUT)) appendFileSync(OUT, ['mode', 'band', 'games', 'seed', 'members', 'mimicWins', 'mimicPct', 'se', 'mimicPool', 'ts'].join('\t') + '\n');

const NP = Number(FLAG.np || 5);   /* §G3：桌人数可调（2/3/5/8） */
for (const MODE of ['long', 'multi']) {
  const res = {};
  const BANDS = FLAG.band ? FLAG.band.split(',') : ['hard', 'mid', 'soft'];
  if (FLAG.hard && FLAG.soft) {
    /* §G3 双带混抽（11-05 晨 · 用户令：中带 = 同时从强弱两带抽，不是强带+脚本）：
     *   --hard=a,b --soft=c,d：AI 席（np-1 个）交替取强/弱带（偶席强、奇席弱），带内按局轮转。
     *   2P=1 席（强），3P=2 席（1强1弱），5P=4 席（2强2弱），8P=7 席（4强3弱）。 */
    const H = FLAG.hard.split(',').map(s => s.trim()).filter(Boolean);
    const Sf = FLAG.soft.split(',').map(s => s.trim()).filter(Boolean);
    const hCh = H.map(p => { const pk = loadPackParams(p); return T.policyChooserN(pk.params, 0); });
    const sCh = Sf.map(p => { const pk = loadPackParams(p); return T.policyChooserN(pk.params, 0); });
    let mw = 0;
    for (let g = 0; g < GAMES; g++) {
      const N = NP, mimicSeat = g % N;
      const st = W.EpirusState.createState(MODE, { next: T.mulberry32(SEED + g) }, N);
      const choosers = [];
      for (let pid = 0; pid < N; pid++) {
        if (pid === mimicSeat) { choosers.push(makeMimic(W, pool, 'next', T.mulberry32(SEED + 7919 + g))); continue; }
        const j = choosers.length;
        choosers.push((j % 2 === 0) ? hCh[(g + (j >> 1)) % H.length] : sCh[(g + (j >> 1)) % Sf.length]);
      }
      W.EpirusPlay.autoGameN(st, choosers);
      if (st.winner === mimicSeat) mw++;
    }
    const p = mw / GAMES, se = 100 * Math.sqrt(p * (1 - p) / GAMES);
    console.log('== 替身尺双带混抽 ‖ ' + NP + 'P ' + MODE + ' × ' + GAMES + ' ‖ 强 ' + H.length + ' / 弱 ' + Sf.length);
    console.log('   替身夺冠 ' + (100 * p).toFixed(1) + '% ± ' + se.toFixed(1));
    appendFileSync(OUT, [MODE, 'mix2band', GAMES, SEED, H.length + '+' + Sf.length, mw, (100 * p).toFixed(1), se.toFixed(1), pool.games + '局/' + pool.conds + '条件', new Date().toISOString()].join('\t') + '\n');
    continue;
  }
  if (FLAG.packs) {
    /* 直跑模式（11-04 深夜补）：--packs=a.js,b.js 当一个"带"，替身 vs 该组 AI×4，装配与其余参数逐字同正式档
     * 11-05 扩：token 支持 `script:<fn>`（脚本席，取 EpirusBots[fn]）⇒ 简单带掺脚本稀释阶梯可量 */
    const members = FLAG.packs.split(',').map((p) => p.trim()).filter(Boolean);
    const choosersCache = members.map((p) => {
      if (p.indexOf('script:') === 0) { const fn = p.slice(7); if (typeof W.EpirusBots[fn] !== 'function') throw new Error('没有脚本 ' + fn); return { bot: () => W.EpirusBots[fn] }; }
      const pk = loadPackParams(p); return { pack: () => T.policyChooserN(pk.params, 0) };
    });
    const chooserOf = (c) => c.bot ? c.bot() : c.pack();
    let mw = 0;
    for (let g = 0; g < GAMES; g++) {
      const N = NP, mimicSeat = g % N, aiIdx = (g * 4) % members.length;
      const st = W.EpirusState.createState(MODE, { next: T.mulberry32(SEED + g) }, N);
      const choosers = []; let k = 0;
      for (let pid = 0; pid < N; pid++) {
        if (pid === mimicSeat) choosers.push(makeMimic(W, pool, 'next', T.mulberry32(SEED + 7919 + g)));
        else choosers.push(chooserOf(choosersCache[(aiIdx + k++) % members.length]));
      }
      W.EpirusPlay.autoGameN(st, choosers);
      if (st.winner === mimicSeat) mw++;
    }
    const p = mw / GAMES, se = 100 * Math.sqrt(p * (1 - p) / GAMES);
    console.log('== 替身尺直跑 ‖ ' + NP + 'P ' + MODE + ' × ' + GAMES + ' ‖ packs=[' + members.join(',') + ']');
    console.log('   替身夺冠 ' + (100 * p).toFixed(1) + '% ± ' + se.toFixed(1));
    appendFileSync(OUT, [MODE, 'packs:' + members.length, GAMES, SEED, members.length, mw, (100 * p).toFixed(1), se.toFixed(1), pool.games + '局/' + pool.conds + '条件', new Date().toISOString()].join('\t') + '\n');
    continue;
  }
  for (const band of BANDS) {
    const members = T3[band];
    const choosersCache = members.map((m) => {
      const p = PATH[m] + m + '.js';
      const pk = loadPackParams(p);
      return T.policyChooserN(pk.params, 0);
    });
    let mw = 0;
    for (let g = 0; g < GAMES; g++) {
      const N = 5;
      const mimicSeat = g % N;                     /* 替身座位逐局轮转 */
      const aiIdx = (g * 4) % members.length;      /* 成员轮转，出场均等 */
      const st = W.EpirusState.createState(MODE, { next: T.mulberry32(SEED + g) }, N);
      const choosers = [];
      let k = 0;
      for (let pid = 0; pid < N; pid++) {
        if (pid === mimicSeat) choosers.push(makeMimic(W, pool, 'next', T.mulberry32(SEED + 7919 + g)));
        else choosers.push(choosersCache[(aiIdx + k++) % members.length]);
      }
      W.EpirusPlay.autoGameN(st, choosers);
      if (st.winner === mimicSeat) mw++;
    }
    const p = mw / GAMES, se = 100 * Math.sqrt(p * (1 - p) / GAMES);
    res[band] = { p: 100 * p, se, wins: mw };
  }
  console.log('== 替身尺 ‖ 5P ' + MODE + ' × ' + GAMES + ' 局/带（替身席轮转，配对种子）');
  for (const b of BANDS) console.log('   ' + b.padEnd(8) + ' 替身夺冠 ' + res[b].p.toFixed(1) + '% ± ' + res[b].se.toFixed(1));
  if (res.hard && res.mid && res.soft) {
    const d1 = res.soft.p - res.mid.p, s1 = Math.sqrt(res.soft.se ** 2 + res.mid.se ** 2);
    const d2 = res.mid.p - res.hard.p, s2 = Math.sqrt(res.mid.se ** 2 + res.hard.se ** 2);
    console.log('   序检验：soft−mid = ' + d1.toFixed(1) + 'pt/' + (d1 / s1).toFixed(1) + 'σ ‖ mid−hard = ' + d2.toFixed(1) + 'pt/' + (d2 / s2).toFixed(1) + 'σ ‖ 线：各 ≥2σ 才叫「替身尺下分得开」');
  }
  for (const b of BANDS) {
    appendFileSync(OUT, [MODE, b, GAMES, SEED, (T3[b] || []).length, res[b].wins,
      res[b].p.toFixed(1), res[b].se.toFixed(1), pool.games + '局/' + pool.conds + '条件', new Date().toISOString()].join('\t') + '\n');
  }
}
console.log('→ 读数已落 ' + OUT + '（列：mode band games seed 成员数 替身夺冠数 夺冠率% SE 替身池 时刻）');
