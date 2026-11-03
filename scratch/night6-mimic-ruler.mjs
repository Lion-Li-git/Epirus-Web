#!/usr/bin/env node
/* night6-mimic-ruler.mjs —— gen-3 的「人席替身」尺（ZCode · 11-04 凌晨）
 *
 * 背景：§四十三 证明 1st 率尺与直交尺在 gen-3 上不同序 ⇒ 部署难度序需要第三把尺 = v7 的「人类形状替身」
 * （`tools/human-pool.mjs` 的 makeMimic，56 局真人日志条件分布；probe-diff-ladder §E596 验带用的同一份，单源复用）。
 * 装配照抄 probe-diff-ladder：1 席替身 vs (N-1) 席同一带的 AI；**替身座位逐局轮转**（不恒占 0 号）。
 * 配对：各带同一批种子（局 rng 与替身 rng 各自同序）⇒ 跨带夺冠率差可配对读。
 * 输出：每带替身夺冠率 ± 二项 SE（n=局数）⇒ 部署难度序在替身尺下是否 hard < mid < soft。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadPool, makeMimic } from '../tools/human-pool.mjs';

const FLAG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=(.*)$/i.exec(a); if (m) FLAG[m[1]] = m[2]; }
const GAMES = Number(FLAG.games || 250);
const SEED = Number(FLAG.seed || 88000);

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

for (const MODE of ['long', 'multi']) {
  const res = {};
  const BANDS = FLAG.band ? FLAG.band.split(',') : ['hard', 'mid', 'soft'];
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
    res[band] = { p: 100 * p, se };
  }
  console.log('== 替身尺 ‖ 5P ' + MODE + ' × ' + GAMES + ' 局/带（替身席轮转，配对种子）');
  for (const b of BANDS) console.log('   ' + b.padEnd(8) + ' 替身夺冠 ' + res[b].p.toFixed(1) + '% ± ' + res[b].se.toFixed(1));
  if (res.hard && res.mid && res.soft) {
    const d1 = res.soft.p - res.mid.p, s1 = Math.sqrt(res.soft.se ** 2 + res.mid.se ** 2);
    const d2 = res.mid.p - res.hard.p, s2 = Math.sqrt(res.mid.se ** 2 + res.hard.se ** 2);
    console.log('   序检验：soft−mid = ' + d1.toFixed(1) + 'pt/' + (d1 / s1).toFixed(1) + 'σ ‖ mid−hard = ' + d2.toFixed(1) + 'pt/' + (d2 / s2).toFixed(1) + 'σ ‖ 线：各 ≥2σ 才叫「替身尺下分得开」');
  }
}
