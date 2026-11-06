#!/usr/bin/env node
/* def-acc.mjs — 防御准确率 vs 纯随机基线（DS · 2026-11-03）
 * 口径：每次决策记录「这一手是不是防御族」；下一回合看窗口内是否有攻击落到我方
 *   accuracy = P(被攻击 | 这一手防御)；chance = P(被攻击 | 任意一手)
 *   lift = accuracy/chance；binomial z = (p1-p0)/sqrt(p0(1-p0)/n1)
 * 附加：按 HP 档（<=1 / 2 / >=3）分列；防御族按卡型分列。
 * 用法：node scratch/def-acc.mjs --packs=a,b --games=200
 */
import { sandbox } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').map((s) => s.trim()).filter(Boolean);
const GAMES = Math.max(20, Number(arg('games', 200)) || 200);
const N = 5, MODE = arg('mode', 'long'), TEMP = 0.1;
const W = sandbox(); const P = W.EpirusPolicy, T = W.EpirusTrainer, R = W.EpirusRules;
const DEF = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k].cat === R.CAT.DEFENSE));

for (const path of PACKS) {
  const raw = readPack2(path); const got = packCfgExit(raw, path);
  installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pv = Float64Array.from(P.unpack(raw, true));
  const ch = T.policyChooserN(pv, TEMP, 0, N, 'soft');
  const A = createArena2(W, { refParams: pv, temp: TEMP, stratified: false });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  let dec = 0, atk = 0, def = 0, defAtk = 0, defBlk = 0, byDef = {}, byHp = { lo: [0, 0], mid: [0, 0], hi: [0, 0] };
  const base = { lo: [0, 0], mid: [0, 0], hi: [0, 0] };   /* 每档全决策的 [被攻击, 总数] */
  for (let g = 0; g < GAMES; g++) {
    let pend = null;
    const resolvePend = (state) => {
      if (!pend) return;
      const evs = (state.events || []).slice(pend.cursor);
      let hit = false, blocked = false;
      for (const e of evs) {
        if (!e || e.to !== 0) continue;
        if (e.type === 'damage') hit = true;
        if (e.type === 'blocked' || e.type === 'reflect' || e.type === 'transfer') { hit = true; blocked = true; }
      }
      dec++;
      const bn = pend.hp <= 1 ? 'lo' : (pend.hp === 2 ? 'mid' : 'hi');
      base[bn][0]++; if (hit) base[bn][1]++;
      if (hit) { atk++; if (pend.isDef) defAtk++; }
      if (pend.isDef && blocked) defBlk++;
      if (pend.isDef) {
        def++;
        byDef[pend.key] = byDef[pend.key] || [0, 0];
        byDef[pend.key][0]++; if (hit) byDef[pend.key][1]++;
        const band = pend.hp <= 1 ? 'lo' : (pend.hp === 2 ? 'mid' : 'hi');
        byHp[band][0]++; if (hit) byHp[band][1]++;
      }
      pend = null;
    };
    const focus = (state, pid, legal) => {
      resolvePend(state);
      const pick = ch(state, pid, legal);
      const k = (pick && typeof pick === 'object') ? (pick.key || '') : String(pick || '');
      pend = { cursor: (state.events || []).length, isDef: DEF.has(k), key: k, hp: state.p[0] ? state.p[0].hp : 3 };
      return pick;
    };
    const subs = [focus];
    for (let pid = 1; pid < N; pid++) { let ri = (90000 * 7 + pid * 11 + sh * 13 + g * 17 + 101) % A.roster.length, e = A.roster[ri]; while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; } subs.push(e.sel); }
    T.oneGameN(subs, 99000 + g * 977, N, { mode: MODE });
  }
  const p0 = atk / Math.max(1, dec), p1 = defAtk / Math.max(1, def), lift = p0 > 0 ? p1 / p0 : 0;
  const se = Math.sqrt(Math.max(1e-9, p0 * (1 - p0) / Math.max(1, def)));
  const z = (p1 - p0) / se;
  const f = (x, y) => y ? (100 * x / y).toFixed(1) + '%' : '—';
  const liftBand = (b) => { const [nd, hd] = byHp[b], [na, ha] = base[b]; if (!nd || !na) return '—'; const pD = hd / nd, pA = ha / na; return 'lift ' + (pA > 0 ? (pD / pA).toFixed(2) : '—') + ' (基准 ' + (100 * pA).toFixed(1) + '%)'; };
  const blk = defBlk / Math.max(1, def);
  console.log(path.split('/').pop() + ' ‖ 决策 ' + dec + ' ‖ 防御 ' + def + ' ‖ 攻击率 ' + (100 * p0).toFixed(1) + '% ‖ 防御时攻击率 ' + (100 * p1).toFixed(1) + '% (lift ' + lift.toFixed(2) + ', z=' + z.toFixed(2) + ') ‖ 真挡率 ' + (100 * blk).toFixed(1) + '%');
  console.log('   HP档: ≤1 ' + f(byHp.lo[1], byHp.lo[0]) + ' (n=' + byHp.lo[0] + ', ' + liftBand('lo') + ') ‖ =2 ' + f(byHp.mid[1], byHp.mid[0]) + ' (n=' + byHp.mid[0] + ', ' + liftBand('mid') + ') ‖ ≥3 ' + f(byHp.hi[1], byHp.hi[0]) + ' (n=' + byHp.hi[0] + ', ' + liftBand('hi') + ')');
  const ks = Object.keys(byDef).sort((a, b) => byDef[b][0] - byDef[a][0]).slice(0, 6);
  console.log('   卡型: ' + ks.map((k) => k + ' ' + f(byDef[k][1], byDef[k][0]) + '(n=' + byDef[k][0] + ')').join(' ‖ '));
}