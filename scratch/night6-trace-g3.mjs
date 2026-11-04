#!/usr/bin/env node
/* night6-trace-g3.mjs —— gen-3 包的逐回合对局记录（ZCode · 11-05 凌晨，设计分析「感受技能风格」用）
 * = champion-map/trace-game.mjs 的 arch2 私配沙盒版（v:92 包 loadChamp 解不开 ⇒ 同一打印逻辑换装载口）。
 * 混桌可用：arch2 的 chooseCandidates 有长度守卫 ⇒ v7 对手 params 走回原 v7 实现（与 PACK_OPP 同一机制）。
 * 用法: node scratch/night6-trace-g3.mjs --champ=<gen3包> [--field=<gen3包|v7>] [--games=2] [--mode=multi|long]
 *       [--max-round=16] [--out=<文件>]   field 缺省 = 4 × v7 线上包
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const CH = arg('champ', ''), FIELD = arg('field', 'v7'), MODE = arg('mode', 'multi');
const GAMES = Number(arg('games', 2)) || 2, SEED = Number(arg('seed', 77000));
const TEMP = 0.15, MAXR = Number(arg('max-round', 16));
if (!CH) { console.error('⛔ 需要 --champ='); process.exit(2); }

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const W = sb.window, R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, P = W.EpirusPolicy;
const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

function loadAny(p) {
  const src = readFileSync(join(ROOT, p), 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
  if (at < 0) throw new Error('没有 3P 外壳: ' + p);
  let d = 0, inS = false, esc = false, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
  const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
  if (raw.v === 7 || (raw.a && raw.v == null)) return Float64Array.from(raw.a);   /* v7 包：走原实现（长度守卫） */
  const got = packCfgExit(raw, p);
  install(W, got.cfg);
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return Float64Array.from(P.unpack(raw, true));
}
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const V7 = 'js/bundled-champion-3p.js';
const subjParams = loadAny(CH);
const oppParams = FIELD === 'v7' ? loadAny(V7) : loadAny(FIELD);
const subjCh = T.policyChooserN(subjParams, TEMP);
const oppCh = T.policyChooserN(oppParams, TEMP);
const nm = k => (R.byKey[k] ? R.byKey[k].name : k) + '(' + k + ')';
const cost = k => { const c = R.byKey[k] && R.byKey[k].cost; return c === undefined ? '?' : (c === null ? '珠' : c); };
const STANCE = { guard: 1, reflect: 1, bagua: 1, jinshield: 1, proto: 1 };

const lines = [];
lines.push('对局记录（gen-3 逐回合）· 受试 = ' + CH + ' ‖ 场 = 4 × ' + (FIELD === 'v7' ? 'v7 线上包' : FIELD) +
  ' ‖ ' + GAMES + ' 局 · 5P ' + MODE + ' · 温度 ' + TEMP + '（困难档）· seed 基 ' + SEED);
const hist = {};
for (let g = 0; g < GAMES; g++) {
  const seat = g % 5;
  const st = S.createState(MODE, { next: mulberry(SEED + g * 977) }, 5);
  const ch = []; for (let i = 0; i < 5; i++) ch.push(i === seat ? subjCh : oppCh);
  Play.autoGameN(st, ch);
  const H = hist[CH] || (hist[CH] = {});
  const out = []; let round = -1, seen = {}, dealt = {};
  for (const e of st.events) {
    if (e.type === 'action') {
      if (seen[e.pid] !== undefined) { seen = {}; round++; } else if (round < 0) round = 0;
      seen[e.pid] = true;
      if (e.pid === seat) H[e.key] = (H[e.key] || 0) + 1;
      out.push('  R' + String(round).padStart(2) + ' 席' + e.pid + (e.pid === seat ? '★' : ' ') + ' ' +
        (nm(e.key) + '        ').slice(0, 22) + ' 费' + cost(e.key) + '  ' + (e.outcome || ''));
    } else if (e.type === 'damage' && round <= MAXR) {
      dealt[e.source] = (dealt[e.source] || 0) + e.amt;
      out.push('        ↳ ' + (e.source !== undefined ? '席' + e.source : '?') + ' 的 ' + (e.via ? nm(e.via) : e.reason) + ' 打 席' + e.to + ' −' + e.amt);
    } else if (e.type === 'bead' && round <= MAXR) out.push('        ↳ 席' + e.pid + ' 得珠 ' + e.kind + ' ×' + e.delta);
    else if (e.type === 'ban' && round <= MAXR) out.push('        ↳ 席' + e.pid + ' 被禁 ' + e.skill + ' ' + e.turns + ' 回合（' + e.by + '）');
    else if (e.type === 'death') out.push('        ⚑ 席' + e.pid + ' 出局：' + e.reason + '（R' + (st.round || round) + '）');
    else if (e.type === 'cancel' && round <= MAXR) out.push('        ⚑ 相抵：席 ' + e.pids.join('/') + '（R' + e.round + '）');
  }
  lines.push('\n=== 第 ' + (g + 1) + ' 局（受试坐 ' + seat + ' 号位，' + MODE + '）===');
  lines.push(out.filter(l => +((l.match(/R\s*(\d+)/) || [0, 99])[1]) <= MAXR).join('\n'));
  lines.push('  终局：胜者 = ' + (st.winner === seat ? '★受试' : '席' + st.winner) + ' ‖ 回合 = ' + st.round + ' ‖ 血量 ' +
    st.p.map((p, i) => i + (p.hp <= 0 ? '†' : ':' + p.hp)).join(' ') + ' ‖ 受试造伤 ' + (dealt[seat] || 0));
}
lines.push('\n=== 出招构成（' + GAMES + ' 局合计，受试席）===');
for (const k in hist) {
  lines.push('    ' + Object.entries(hist[k]).sort((a, b) => b[1] - a[1]).map(([kk, n]) =>
    nm(kk) + '×' + n + (STANCE[kk] ? '[防]' : '')).join('  '));
}
const text = lines.join('\n');
if (arg('out')) writeFileSync(join(ROOT, arg('out')), text + '\n');
console.log(text);
