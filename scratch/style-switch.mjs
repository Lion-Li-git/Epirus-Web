#!/usr/bin/env node
/* style-switch.mjs — "风格检测 → 切换专精包"演示（DS · 2026-11-02 晚，用户「按桌型切换也是适应性」）
 * 检测器：每个决策看存活对手的 lastSkill，若 ≥60% 是同一风格键（默认 gun）且回合 ≥2 ⇒ 切专精包，否则用基础包。
 * 用法：node scratch/style-switch.mjs --base=... --spec=... --table=gun4|mixed --games=120
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const BASE = arg('base', 'scratch/ga-arms/L5-D4a-s13.js');
const SPEC = arg('spec', 'scratch/ga-arms/STG-gun-s13.js');
const STYLE = arg('style', 'gun'), TABLE = arg('table', 'gun4');
const GAMES = Math.max(20, Number(arg('games', 120)) || 120);
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

const base = loadPack(BASE), spec = loadPack(SPEC);

function runGame(seed, gIdx, mode) {
  const cb = T.policyChooserN(base.pp, TEMP, 0, 5, 'soft');
  const cs = T.policyChooserN(spec.pp, TEMP, 0, 5, 'soft');
  let usedSpec = 0, decisions = 0, hands = 0, eff = 0, white = 0, pending = null, locked = null, vote = 0, seen = 0;
  const classify = (state) => {
    if (!pending) return;
    const win = (state.events || []).slice(pending.cursor);
    let block = false, hit = false;
    for (const e of win) { if (!e || e.to !== 0) continue; if (e.type === 'blocked' || e.type === 'reflect') block = true; if (e.type === 'damage') hit = true; }
    if (pending.isDef) { hands++; if (block) eff++; else if (!hit) white++; }
    pending = null;
  };
  const focus = (state, pid, legal) => {
    classify(state);
    decisions++;
    let styleN = 0, alive = 0;
    for (let i = 0; i < state.p.length; i++) {
      if (i === pid) continue; const o = state.p[i]; if (!o || o.hp <= 0) continue;
      alive++; if (o.lastSkill === STYLE) styleN++;
    }
    /* 桌级检测：第 2~5 回合投票，第 5 回合**定一次**整局不换（逐回合切换会把两套节奏搅烂）。 */
    if (locked === null && alive > 0) {
      if ((state.round | 0) >= 2) { seen++; if (styleN >= Math.ceil(0.6 * alive)) vote++; }
      if ((state.round | 0) >= 5) locked = seen > 0 && vote * 2 >= seen;
    }
    if (locked === null) locked = false;
    const useSpec = mode === 'spec' || (mode === 'switch' && locked === true);
    if (useSpec) usedSpec++;
    const pick = (useSpec ? cs : cb)(state, pid, legal);
    const kk = pick && (pick.key || pick);
    pending = { cursor: (state.events || []).length, isDef: DEF.has(kk) };
    return pick;
  };
  const A = createArena2(W, { refParams: base.pp, temp: TEMP, stratified: false });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const subs = [focus];
  if (TABLE === 'gun4') {
    const g = A.roster.find((e) => e.name === 'only:' + STYLE);
    for (let i = 0; i < 4; i++) subs.push(g.sel);
  } else {
    for (let pid = 1; pid < N; pid++) {
      let ri = (90000 * 7 + pid * 11 + sh * 13 + gIdx * 17 + 101) % A.roster.length, e = A.roster[ri];
      while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
      subs.push(e.sel);
    }
  }
  const r = T.oneGameN(subs, seed, N, { mode: MODE, onPicks: undefined });
  classify(r.state);
  return { win: r.winner === 0 ? 1 : 0, usedSpec, decisions, hands, eff, white };
}

for (const mode of ['base', 'spec', 'switch']) {
  let win = 0, used = 0, dec = 0, hands = 0, eff = 0, white = 0;
  for (let k = 0; k < GAMES; k++) {
    const g = runGame(98000 + k * 977, k, mode);
    win += g.win; used += g.usedSpec; dec += g.decisions; hands += g.hands; eff += g.eff; white += g.white;
  }
  console.log(TABLE + ' ‖ ' + mode + ' ‖ 夺1 ' + (100 * win / GAMES).toFixed(1) + '% ‖ 专精使用 ' + (100 * used / Math.max(1, dec)).toFixed(0) + '% 决策 ‖ 防御 ' + (hands / GAMES).toFixed(1) + ' 手/局、有效 ' + (100 * eff / Math.max(1, hands)).toFixed(1) + '%、白防 ' + (100 * white / Math.max(1, hands)).toFixed(1) + '%');
}