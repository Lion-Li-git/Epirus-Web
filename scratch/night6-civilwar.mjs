#!/usr/bin/env node
/* night6-civilwar.mjs —— 风格内战：五风格包同桌（ZCode · 11-05 凌晨，对局感受用）
 * 蓄爆 CB3 / 防御 D-a / 换招 KDFULL / 泛用 HPG / 雷手 G5-8p，5P multi，轮转座位 × 20 局。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay;
const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

function loadPack(p) {
  const src = readFileSync(join(ROOT, p), 'utf8');
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
  return T.policyChooserN(Float64Array.from(P.unpack(raw, true)), 0.15);
}

const NAMES = ['蓄爆CB3', '防御D-a', '换招KDFULL', '泛用HPG', '雷手G5-8p'];
const PATHS = ['scratch/night6/CB3-s13.js', 'scratch/night4/D-a-s13.js', 'scratch/ga-arms/KDFULL400-s13.js', 'scratch/night6/HPG-s7.js', 'scratch/night3/GD3ALL-G5-8p-s41.js'];
const chs = PATHS.map(loadPack);
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const wins = {}, dealt = {};
NAMES.forEach(n => { wins[n] = 0; dealt[n] = 0; });
const G = 20;
for (let g = 0; g < G; g++) {
  /* 座位轮转：第 g 局把名单左移 g 位，消座位差 */
  const st = S.createState('multi', { next: mulberry(88000 + g * 131) }, 5);
  const chsR = chs.map((c, i) => chs[(i + g) % 5]);
  const namesR = NAMES.map((n, i) => NAMES[(i + g) % 5]);
  const before = st.events ? 0 : 0;
  Play.autoGameN(st, chsR);
  if (st.winner != null && st.winner >= 0) wins[namesR[st.winner]]++;
  for (const e of (st.events || [])) if (e.type === 'damage' && e.source != null && namesR[e.source]) dealt[namesR[e.source]] += e.amt;
}
console.log('风格内战 5P multi × ' + G + ' 局（座位轮转）：');
console.log(NAMES.map(n => n + '：' + wins[n] + ' 胜（造伤 ' + Math.round(dealt[n]) + '）').join(' ‖ '));
