#!/usr/bin/env node
/* night6-h2h.mjs —— 带间直交系列（ZCode · 11-04 凌晨，分带的强度差主判据）
 *
 * 用法: node scratch/night6-h2h.mjs --label=强vs弱 --mode=long --games=400 --seed=91000 --a=a1.js,a2.js --b=b1.js,b2.js
 *
 * 协议（预注册，写死）：
 *   - 每局 4 个包席 = 2 枚强带 + 2 枚弱带；成员按轮转取（每枚出场均等），A/B 落座随机洗牌（消座位差）；
 *   - --mode=long ⇒ 5P long，第 5 席 = pickRandom 陪席；--mode=multi4 ⇒ 4P multi 4 血，无陪席；
 *   - 记"胜者属于哪带"⇒ A 份额 p̂ ± 二项 SE；判线 = 偏离 50% ≥4pt 且 ≥2σ（v7 §E596 ④d 地板同源）。
 *   - ε=0、干预全关（T.setBigTPush(0) 等，与 coverage-gate 同口径）。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FLAG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=(.*)$/i.exec(a); if (m) FLAG[m[1]] = m[2]; }
const LABEL = FLAG.label || 'A vs B';
const MODE = FLAG.mode || 'long';
const GAMES = Number(FLAG.games || 400);
const SEED = Number(FLAG.seed || 91000);
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const AP = list(FLAG.a), BP = list(FLAG.b);
if (!AP.length || !BP.length) { console.error('⛔ 需要 --a= 与 --b=（逗号分隔包路径）'); process.exit(64); }

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
  if (at < 0) throw new Error('没有 EPIRUS_CHAMPION_3P 外壳: ' + p);
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

function loadAll(paths) {
  const out = [], cfgs = [];
  for (const p of paths) {
    const pk = loadPackParams(p);
    out.push({ name: p.split(/[\\/]/).pop().replace(/\.js$/, ''), chooser: T.policyChooserN(pk.params, 0), v7: pk.v7 });
    if (!pk.v7) cfgs.push({ p, cfg: JSON.stringify(pk.cfg) });
  }
  /* 同构守卫：install(W,cfg) 是共享世界 ⇒ 混架构同场会静默串线（后载的盖先载的）。不同 cfg 必须响亮失败。 */
  const shapes = [...new Set(cfgs.map((c) => c.cfg))];
  if (shapes.length > 1) { console.error('⛔ 混架构同场：' + cfgs.map((c) => c.p).join(' vs ') + ' ⇒ install 串线，拒绝开打'); process.exit(65); }
  return out;
}
const A = loadAll(AP), B = loadAll(BP);
const NP = MODE === 'long' ? 5 : 4;
const MODE_NAME = MODE === 'long' ? 'long' : 'multi4';

let aWin = 0, decided = 0;
for (let g = 0; g < GAMES; g++) {
  const rng = T.mulberry32(SEED + g * 7919);
  const am = [A[(g * 2) % A.length], A[(g * 2 + 1) % A.length]];
  const bm = [B[(g * 2) % B.length], B[(g * 2 + 1) % B.length]];
  const seats = [{ s: 'A', c: am[0].chooser }, { s: 'A', c: am[1].chooser }, { s: 'B', c: bm[0].chooser }, { s: 'B', c: bm[1].chooser }];
  /* 洗牌前 4 席（Fisher-Yates，用本局 rng） */
  for (let i = 3; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = seats[i]; seats[i] = seats[j]; seats[j] = t; }
  const st = W.EpirusState.createState(MODE_NAME, { next: T.mulberry32(SEED + g) }, NP);
  const choosers = [];
  for (let pid = 0; pid < NP; pid++) {
    if (pid < 4) choosers.push(seats[pid].c);
    else choosers.push(W.EpirusBots.pickRandom);
  }
  W.EpirusPlay.autoGameN(st, choosers);
  if (st.winner != null && st.winner >= 0 && st.winner < 4) { decided++; if (seats[st.winner].s === 'A') aWin++; }
}
const p = decided ? aWin / decided : NaN;
const seP = decided ? 100 * Math.sqrt(p * (1 - p) / decided) : NaN;
const dev = decided ? 100 * p - 50 : NaN;
const sig = decided ? Math.abs(dev) / seP : NaN;
console.log('== ' + LABEL + ' ‖ ' + MODE + ' × ' + GAMES + ' 局（判定 ' + decided + '）');
console.log('   A=[' + A.map((m) => m.name).join(',') + ']');
console.log('   B=[' + B.map((m) => m.name).join(',') + ']');
console.log('   A 带胜份额 ' + (100 * p).toFixed(1) + '% ± ' + seP.toFixed(1) + ' ⇒ 偏离均势 ' + dev.toFixed(1) + 'pt ‖ ' + sig.toFixed(1) + 'σ ‖ ' + (Math.abs(dev) >= 4 && sig >= 2 ? '✔ 分得开' : '✘ 判不分（线：≥4pt 且 ≥2σ）'));
