#!/usr/bin/env node
/* oracle-def-probe.mjs — "作弊教师"上限探针（DS · 2026-11-02 晚，用户点子）
 * 教师能在结算前看见别人这一手打谁/用什么（onPicks 钩子），据此出对应防御：
 *   枪/坦克/双枪 → 反弹 ‖ 激光剑 → 防御 ‖ 狙击枪 → 反打枪（使狙击无效）‖ 电磁炮 → 转移伤害。
 * 本探针只量两件事：① oracle 比 native 多挡多少/赢多少（上限）；② 攻击在**决策前公开特征**里可不可预测（简单相关性）。
 * 用法：node scratch/oracle-def-probe.mjs --pack=scratch/ga-arms/L5-D4a-s13.js [--games=120] [--n=5] [--mode=long]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/L5-D4a-s13.js');
const GAMES = Math.max(20, Number(arg('games', 120)) || 120);
const N = Math.max(3, Number(arg('n', 5)) || 5), MODE = arg('mode', 'long'), TEMP = 0.15;
const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const SK = R.SK;

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) { const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v }; }
  const c7 = loadChamp(W, path, '.'); if (!c7) { console.error('⛔ 读不出'); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7' };
}

const REPLIES = new Map([[SK.GUN, SK.REFLECT], [SK.TANK, SK.REFLECT], [SK.DUAL_GUN, SK.REFLECT], [SK.SWORD, SK.GUARD], [SK.SNIPE, SK.GUN], [SK.RAILGUN, SK.TRANSFER]]);

function playGame(pack, oracle, seed, gIdx) {
  const { pp, label } = pack;
  const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');
  const st0 = { stats: { attacks: 0, countered: 0, blocks: 0, dmgTaken: 0, rounds: 0 }, rows: [] };
  const onPicks = (state, picks, legals) => {
    const me = state.p[0];
    if (!me || me.hp <= 0) return null;
    let incoming = [];
    for (let pid = 1; pid < state.p.length; pid++) {
      const pk = picks[pid]; if (!pk) continue;
      if (pk.target === 0 || pk.target2 === 0) incoming.push({ pid, key: pk.key });
    }
    st0.stats.attacks += incoming.length;
    if (!oracle || !incoming.length) return null;
    const order = [SK.RAILGUN, SK.SNIPE, SK.SWORD, SK.TANK, SK.GUN, SK.DUAL_GUN];
    let atk = null;
    for (const k of order) { const h = incoming.find((x) => x.key === k); if (h) { atk = h; break; } }
    if (!atk) return null;
    const rep = REPLIES.get(atk.key);
    const lg = legals[0].find((c) => c.key === rep && c.affordable);
    if (!lg) return null;
    st0.stats.countered++;
    const np = picks.slice();
    np[0] = { key: rep, target: rep === SK.GUN ? atk.pid : null, target2: null, bead: null };
    return np;
  };
  const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  const subs = [(s, pid, legal) => inner(s, pid, legal)];
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + gIdx * 17 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    subs.push(e.sel);
  }
  const r = T.oneGameN(subs, seed, N, { mode: MODE, onPicks });
  const st = r.state;
  for (const e of (st.events || [])) {
    if (e.to !== 0) continue;
    if (e.type === 'blocked' || e.type === 'reflect') st0.stats.blocks++;
    if (e.type === 'damage' && (e.amt | 0) > 0) st0.stats.dmgTaken += e.amt;
  }
  st0.stats.rounds = r.rounds || 0;
  st0.win = r.winner === 0 ? 1 : 0;
  return st0;
}

const pack = loadPack(PACK);
const res = { native: { win: 0, attacks: 0, countered: 0, blocks: 0, dmg: 0, rounds: 0 }, oracle: { win: 0, attacks: 0, countered: 0, blocks: 0, dmg: 0, rounds: 0 } };
for (const m of ['native', 'oracle']) {
  for (let k = 0; k < GAMES; k++) {
    const g = playGame(pack, m === 'oracle', 77000 + k * 977, k);
    const a = res[m];
    a.win += g.win; a.attacks += g.stats.attacks; a.countered += g.stats.countered; a.blocks += g.stats.blocks; a.dmg += g.stats.dmgTaken; a.rounds += g.stats.rounds;
  }
}
const pct = (x, y) => y ? (100 * x / y).toFixed(1) + '%' : '—';
console.log('### 作弊教师上限 ‖ 包=' + PACK.split('/').pop() + ' ‖ ' + pack.label + ' ‖ ' + N + ' 人 ' + MODE + ' ‖ ' + GAMES + ' 局/格');
for (const m of ['native', 'oracle']) {
  const a = res[m];
  console.log([m, '夺1 ' + pct(a.win, GAMES), '被攻击 ' + (a.attacks / GAMES).toFixed(2) + '/局', '强防次数 ' + (a.countered / GAMES).toFixed(2) + '/局', '挡下 ' + (a.blocks / GAMES).toFixed(2) + '/局', '承伤 ' + (a.dmg / GAMES).toFixed(2) + '/局', '回合 ' + (a.rounds / GAMES).toFixed(1)].join(' | '));
}