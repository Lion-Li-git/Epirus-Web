#!/usr/bin/env node
/* night6-mimic-2band.mjs —— 两带定案版（bands-final.tsv）的替身尺读数
 * 装配同 night6-mimic-ruler：1 替身席轮转 vs 同带 AI×4；带 = 两带定案（hard 11 / soft 10）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { loadPool, makeMimic } from '../tools/human-pool.mjs';

const G = 250, SEED = 88001;
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy;
const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);
const pool = loadPool(W, 'human');

function loadPack(p) {
  const src = readFileSync(p, 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
  let d = 0, inS = false, esc = false, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
  const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
  const got = packCfgExit(raw, p);
  install(W, got.cfg);
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return T.policyChooserN(Float64Array.from(P.unpack(raw, true)), 0);
}

const HARD = ['L5-1200-s13', 'D1200-s13', 'DSTR4-s13', 'EFFG-s41', 'EFFG-s5', 'EFFG-s7', 'GD3ALL-G5-8p-s41', 'GD3ALL-PUSHON-s41', 'GD3ALL-POPP-s17', 'GD3ALL-POPP-s41'];
const SOFT = ['G5DEF-s41', 'GD3ALL-PUSHON-s13', 'D-b-hpseed-s13', 'D-a-s13', 'GD3ALL-PLAIN-s13', 'DDEF-s13', 'DSTR-s13', 'CB-s13', 'LE-s13', 'GD3ALL-G5-s13', 'GD3ALL-NGA2R-s41'];
const P2 = {
  'L5-1200-s13': 'scratch/night5/', 'D1200-s13': 'scratch/night5/', 'EFFG-s41': 'scratch/night5/', 'EFFG-s5': 'scratch/night5/', 'EFFG-s7': 'scratch/night5/', 'G5DEF-s41': 'scratch/night5/',
  'DSTR4-s13': 'scratch/night4/', 'D-b-hpseed-s13': 'scratch/night4/', 'DDEF-s13': 'scratch/night4/', 'DSTR-s13': 'scratch/night4/', 'CB-s13': 'scratch/night4/', 'LE-s13': 'scratch/night4/', 'D-a-s13': 'scratch/night4/',
  'GD3ALL-G5-8p-s41': 'scratch/night3/', 'GD3ALL-PUSHON-s41': 'scratch/night3/', 'GD3ALL-POPP-s17': 'scratch/night3/', 'GD3ALL-POPP-s41': 'scratch/night3/', 'GD3ALL-PUSHON-s13': 'scratch/night3/', 'GD3ALL-PLAIN-s13': 'scratch/night3/', 'GD3ALL-G5-s13': 'scratch/night3/', 'GD3ALL-NGA2R-s41': 'scratch/night3/'
};
const BANDS = { hard: HARD, soft: SOFT };
const cache = {};
for (const b in BANDS) cache[b] = BANDS[b].map((m) => loadPack(P2[m] + m + '.js'));

for (const MODE of ['long', 'multi']) {
  const res = {};
  for (const b in BANDS) {
    const list = BANDS[b], cc = cache[b];
    let mw = 0;
    for (let g = 0; g < G; g++) {
      const N = 5, ms = g % N, ai = (g * 4) % list.length;
      const st = W.EpirusState.createState(MODE, { next: T.mulberry32(SEED + g) }, N);
      const ch = []; let k = 0;
      for (let pid = 0; pid < N; pid++) {
        if (pid === ms) ch.push(makeMimic(W, pool, 'next', T.mulberry32(SEED + 7919 + g)));
        else ch.push(cc[(ai + k++) % list.length]);
      }
      W.EpirusPlay.autoGameN(st, ch);
      if (st.winner === ms) mw++;
    }
    res[b] = { p: 100 * mw / G, se: 100 * Math.sqrt((mw / G) * (1 - mw / G) / G) };
  }
  const d = res.soft.p - res.hard.p, sd = Math.sqrt(res.soft.se ** 2 + res.hard.se ** 2);
  console.log('两带定案替身尺 ‖ 5P ' + MODE + ' × ' + G + '：hard ' + res.hard.p.toFixed(1) + '% ± ' + res.hard.se.toFixed(1) + ' ‖ soft ' + res.soft.p.toFixed(1) + '% ± ' + res.soft.se.toFixed(1) + ' ‖ soft−hard = ' + d.toFixed(1) + 'pt/' + (d / sd).toFixed(1) + 'σ');
}
