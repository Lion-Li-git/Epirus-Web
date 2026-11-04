#!/usr/bin/env node
/* night6-endgame-probe.mjs —— 「残局抑制率」探针（ZCode · 11-04 深夜，设计分析用）
 *
 * 用户命题：「残两三人/残血时再去攒大雷显然浪费」⇒ 理想冠军应当随**剩余回合视野**收缩长程投资。
 * 量法：同一包打两张 5P long 桌——满血开局 vs 残血开局（HP=2，局长天然缩短=短视野世界），
 *   数**长程键（蓄能/环/大雷/电磁炮）每回合出手份额**：
 *     抑制率 = 1 − 份额(残血) / 份额(满血)；
 *   抑制率高 = 懂时机（视野短就停投资）；≈0 = 瞎攒（用户说的浪费形状）。
 * ⚠ 口径：HP=2 桌本身回合少，长程链**客观上**更难兑现——所以这一格量的正是"包是否按视野理性收缩"，
 *   不是纯偏好。附印两桌的局长与每回合长程出手数，供交叉判读。
 * 用法: node scratch/night6-endgame-probe.mjs --packs=a.js,b.js [--games=120]
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FLAG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=(.*)$/i.exec(a); if (m) FLAG[m[1]] = m[2]; }
const GAMES = Number(FLAG.games || 120);
const PACKS = (FLAG.packs || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!PACKS.length) { console.error('⛔ 需要 --packs='); process.exit(64); }

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Float64Array, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
const { install, packCfgExit } = await import('../tools/proto2/arch2.mjs');
T.setBigTPush(0); T.setDrainPush(0); T.setCursePush(0); T.setSupportPrior(0);

function loadPack(p) {
  const src = readFileSync(p, 'utf8');
  const at = src.indexOf('EPIRUS_CHAMPION_3P ');
  if (at < 0) throw new Error('没有外壳: ' + p);
  let d = 0, inS = false, esc = false, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) { const c = src[k];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') { inS = true; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = k; break; } } }
  const raw = JSON.parse(src.slice(src.indexOf('{', at), end + 1));
  if (raw.v === 7 || (raw.a && raw.v == null)) return { params: Float64Array.from(raw.a), v7: true };
  const got = packCfgExit(raw, p);
  install(W, got.cfg);
  if (P.__arch2) P.__arch2.rngRef.r = T.mulberry32(4242);
  return { params: Float64Array.from(P.unpack(raw, true)), v7: false };
}

const LONG = new Set([R.SK.CHARGE, R.SK.RING, R.SK.BIG_T, R.SK.RAILGUN]);
const nameOf = (k) => { const c = (R.skills || []).find((s) => s.key === k); return c ? c.name : k; };

function probe(params, hpStart) {
  const ch = T.policyChooserN(Float64Array.from(params), 0);
  const sel = {}; let rounds = 0, longCasts = 0, acts = 0;
  for (let g = 0; g < GAMES; g++) {
    const st = W.EpirusState.createState('long', { next: T.mulberry32(77000 + g) }, 5);
    if (hpStart) for (const q of st.p) if (q && q.hp > 0) q.hp = Math.min(hpStart, (st.mode && st.mode.hp) || 5);
    const choosers = [function (state, pid, legal) {
      const a = ch(state, pid, legal);
      const k = (a && typeof a === 'object') ? (a.key || '') : String(a);
      sel[k] = (sel[k] || 0) + 1; acts++;
      if (LONG.has(k)) longCasts++;
      return a;
    }, W.EpirusBots.pickRandom, W.EpirusBots.pickRandom, W.EpirusBots.pickRandom, W.EpirusBots.pickRandom];
    W.EpirusPlay.autoGameN(st, choosers);
    rounds += st.round;
  }
  return { sel, rounds: rounds / GAMES, longPerRound: longCasts / GAMES, acts, longCasts };
}

console.log('长程键 = ' + [...LONG].map(nameOf).join('/') + ' ‖ ' + GAMES + ' 局/桌 ‖ 5P long ‖ ε=0 干预全关');
for (const p of PACKS) {
  const name = p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  let params;
  try { params = loadPack(p).params; } catch (e) { console.log('⛔ ' + name + ': ' + e.message); continue; }
  const full = probe(params, 0), low = probe(params, 2);
  const ratio = full.longPerRound > 0 ? low.longPerRound / full.longPerRound : NaN;
  const sup = isFinite(ratio) ? (1 - ratio) * 100 : NaN;
  console.log('== ' + name);
  console.log('   满血桌: 局长 ' + full.rounds.toFixed(1) + ' ‖ 长程出手 ' + full.longPerRound.toFixed(2) + '/局（' + (100 * full.longPerRound / (full.acts / GAMES)).toFixed(1) + '% 出手份额）');
  console.log('   残血桌: 局长 ' + low.rounds.toFixed(1) + ' ‖ 长程出手 ' + low.longPerRound.toFixed(2) + '/局（' + (100 * low.longPerRound / (low.acts / GAMES)).toFixed(1) + '% 出手份额）');
  console.log('   ⇒ 残局抑制率 = ' + (isFinite(sup) ? sup.toFixed(0) + '%' : 'NA') + '（份额比 ' + (isFinite(ratio) ? ratio.toFixed(2) : 'NA') + '）‖ ' + (isFinite(sup) && sup >= 50 ? '懂时机' : (isFinite(sup) && sup >= 20 ? '半懂' : '瞎攒')));
}
