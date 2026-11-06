#!/usr/bin/env node
/* gate-eval.mjs — 逻辑门（非作弊）跨包评估（DS · 2026-11-02 晚）
 * 用法：node scratch/gate-eval.mjs --model=scratch/arms/def-gate.json --packs=a,b --games=240
 * 输出：每包 native vs gate 的配对 Δ、防御手/局、有效/白防。
 */
import { readFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
import { wrapWithGate } from '../tools/proto2/def-gate.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const MODEL = JSON.parse(readFileSync(arg('model', 'scratch/arms/def-gate.json'), 'utf8'));
const PACKS = String(arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const GAMES = Math.max(40, Number(arg('games', 240)) || 240);
const STRAT = arg('strat', '1') === '1';   /* 1 = 原 strat 弱名单（4 席固定）；0 = 全 roster（更强） */
const N = 5, MODE = 'long', TEMP = 0.15;
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const DEF = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k].cat === R.CAT.DEFENSE));

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) { const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v }; }
  const c7 = loadChamp(W, path, '.'); if (!c7) { console.error('⛔ 读不出 ' + path); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7' };
}

function run(pack, gated, seedBase, gIdx) {
  const inner = T.policyChooserN(pack.pp, TEMP, 0, 5, 'soft');
  const chooser = gated ? wrapWithGate(MODEL, inner) : inner;
  let pending = null; const def = { hands: 0, eff: 0, white: 0, wins: 0 };
  const classify = (state) => {
    if (!pending) return;
    const evs = state.events || []; const win = evs.slice(pending.cursor);
    let block = false, hit = false;
    for (const e of win) { if (!e || e.to !== 0) continue; if (e.type === 'blocked' || e.type === 'reflect') block = true; if (e.type === 'damage') hit = true; }
    if (pending.isDef) { def.hands++; if (block) def.eff++; else if (!hit) def.white++; }
    pending = null;
  };
  const focus = (state, pid, legal) => {
    classify(state);
    const pick = chooser(state, pid, legal);
    const k = pick && (pick.key || pick);
    pending = { cursor: (state.events || []).length, isDef: DEF.has(k) };
    return pick;
  };
  const A = createArena2(W, { refParams: pack.pp, temp: TEMP, stratified: STRAT, stratCap: STRAT ? '2' : undefined, stratMix: STRAT ? 0.5 : undefined });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const subs = [focus];
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + gIdx * 17 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    subs.push(e.sel);
  }
  const r = T.oneGameN(subs, seedBase, N, { mode: MODE });
  classify(r.state);
  def.wins = r.winner === 0 ? 1 : 0;
  def.rounds = r.rounds || 0;
  return def;
}

for (const path of PACKS) {
  const pack = loadPack(path);
  const diffs = []; let wN = 0, wG = 0, hands = 0, eff = 0, white = 0;
  for (let k = 0; k < GAMES; k++) {
    const base = 98000 + k * 977;   /* 与训练种子（77000+k*977）错开，避免训练集泄漏 */
    const a = run(pack, false, base, k), b = run(pack, true, base, k);
    wN += a.wins; wG += b.wins; diffs.push(b.wins - a.wins);
    hands += b.hands; eff += b.eff; white += b.white;
  }
  const mean = diffs.reduce((s, v) => s + v, 0) / GAMES;
  const sd = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / Math.max(1, GAMES - 1));
  const se = sd / Math.sqrt(GAMES);
  console.log(path.split('/').pop() + ' (' + pack.label + ') ‖ native ' + (100 * wN / GAMES).toFixed(1) + '% ‖ gate ' + (100 * wG / GAMES).toFixed(1) + '% ‖ Δ ' + (100 * mean).toFixed(1) + '±' + (100 * se).toFixed(1) + 'pt (t=' + (se > 0 ? mean / se : 0).toFixed(2) + ') ‖ 防御 ' + (hands / GAMES).toFixed(1) + ' 手/局、有效 ' + (100 * eff / Math.max(1, hands)).toFixed(1) + '%、白防 ' + (100 * white / Math.max(1, hands)).toFixed(1) + '%');
}