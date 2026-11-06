#!/usr/bin/env node
/* def-ban.mjs — 对照研究：旧 v7 的"防御"到底是赢因还是装饰（DS · 2026-11-02 晚）
 * 做法：同一张 5P 考卷桌、同一批种子，比较 native vs **禁止防御**（把防御族从 legal 里删掉再让包自己选）。
 * 若旧包 ban 后胜率不降（或反升）⇒ 它的防御是"无害的习惯/装饰"，不是胜因；若降 ⇒ 防御真在帮忙。
 * 用法：node scratch/def-ban.mjs --packs=a,b,c --games=120 --n=5 [--world=strat]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACKS = (arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const GAMES = Math.max(20, Number(arg('games', 120)) || 120);
const N = Math.max(3, Number(arg('n', 5)) || 5), MODE = arg('mode', 'multi'), TEMP = 0.15;
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const DEFSET = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k].cat === R.CAT.DEFENSE));

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) { const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v }; }
  const c7 = loadChamp(W, path, '.'); if (!c7) { console.error('⛔ 读不出 ' + path); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7' };
}

function runOne(path, ban) {
  const { pp, label } = loadPack(path);
  const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');
  let defPicks = 0, bansFired = 0, decisions = 0;
  const focus = (state, pid, legal) => {
    decisions++;
    const picked = inner(state, pid, legal);
    const pk = (picked && typeof picked === 'object') ? (picked.key || '?') : String(picked);
    if (DEFSET.has(pk)) defPicks++;
    if (!ban || !DEFSET.has(pk)) return picked;
    const alt = (legal || []).filter((c) => !DEFSET.has((typeof c === 'string' ? c : c.key)));
    if (!alt.length) return picked;
    bansFired++;
    return inner(state, pid, alt);
  };
  const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const subs = [focus];
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    subs.push(e.sel);
  }
  let win = 0, rounds = 0;
  for (let k = 0; k < GAMES; k++) {
    const r = T.oneGameN(subs, 77000 + k * 977, N, { mode: MODE });
    if (r.winner === 0) win++;
    rounds += r.rounds || 0;
  }
  return { label, win: 100 * win / GAMES, rounds: rounds / GAMES, defRate: 100 * defPicks / Math.max(1, decisions), bans: bansFired };
}

console.log('包 | 容器 | native夺1 | ban防御夺1 | Δ | native防御率 | ban触发/局');
for (const p of PACKS) {
  const a = runOne(p, false), b = runOne(p, true);
  console.log([p.split('/').pop(), a.label, a.win.toFixed(1), b.win.toFixed(1), (b.win - a.win).toFixed(1), a.defRate.toFixed(1) + '%', (b.bans / GAMES).toFixed(2)].join(' | '));
}
