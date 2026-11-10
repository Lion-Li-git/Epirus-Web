#!/usr/bin/env node
/* def-drain-trace.mjs — 防御/摄魂的"情境 × 菜单 × 被选"分层读数（DS · 2026-11-02）
 * 用户口径（11-02）：
 *   · 残血不防御是理性的（残血威胁低、打他浪费伤害）⇒ 不把"残血 0 防御"当缺陷；
 *   · 真正要的是：**多血（HP≥3）时被威胁要适度防御**；**残血（HP≤1）时要用摄魂**（1 伤 + 命中自愈 1，仅 HP≤1 可用）。
 * 本尺只读：逐决策记 HP 分层、上一手以来是否挨打（威胁）、候选里有没有防御族/摄魂（菜单）、选了什么。
 * 用法：node tools/proto2/def-drain-trace.mjs --pack=<包> --table=strat|train [--n=5] [--games=40] [--mode=multi] [--temp=0.15]
 * ⚠ 这是"行为读数"，不是强度判据；分母 0 一律写"读不出"。
 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', ''), TABLE = arg('table', 'strat'), GAMES = Math.max(5, Number(arg('games', 40)) || 40);
const MODE = arg('mode', 'multi'), N = Math.max(3, Number(arg('n', 5)) || 5), TEMP = Number(arg('temp', 0.15));

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots, R = W.EpirusRules;
const DEFENSE = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k].cat === R.CAT.DEFENSE));
const DRAIN = R.SK.DRAIN;

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) {
    try { const got = packCfgExit(raw, path); installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg)); return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v + ' ' + (raw.dims && raw.dims.input) }; } catch (e) { /* v7 容器走下面那条通路 */ }
  }
  const c7 = loadChamp(W, path, '.');
  if (!c7) { console.error('⛔ 读不出包：' + path); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7 ' + c7.length };
}
const { pp, label } = loadPack(PACK);

/* 分层计数：hp 档 × 是否挨过打 */
const STRATA = { '<=1': { n: 0, threat: 0, defMenu: 0, defPick: 0, defPickThreat: 0, drainMenu: 0, drainPick: 0, ep3: 0 },
  '2': { n: 0, threat: 0, defMenu: 0, defPick: 0, defPickThreat: 0, drainMenu: 0, drainPick: 0, ep3: 0 },
  '>=3': { n: 0, threat: 0, defMenu: 0, defPick: 0, defPickThreat: 0, drainMenu: 0, drainPick: 0, ep3: 0 } };
let evCursor = 0, lastHp = null;

function bucket(hp) { const h = hp | 0; return h <= 1 ? '<=1' : (h === 2 ? '2' : '>=3'); }

function focusWrap(inner, state, pid, legal) {
  const me = state.p[pid] || {};
  const hp = me.hp | 0;
  const evs = state.events || [];
  let threat = 0;
  if (lastHp !== null && lastHp <= hp) { /* 只在没回血时判"上一手以来是否挨打" */ }
  for (let i = evCursor; i < evs.length; i++) { const e = evs[i]; if (e && e.type === 'damage' && e.to === pid && e.amt > 0) threat = 1; }
  evCursor = evs.length;
  const keys = (legal || []).map((c) => (typeof c === 'string' ? c : c.key));
  const menuDef = keys.some((k) => DEFENSE.has(k));
  const menuDrain = keys.indexOf(DRAIN) >= 0;
  const picked = inner(state, pid, legal);
  const pk = (picked && typeof picked === 'object') ? (picked.key || '?') : String(picked);
  const st = STRATA[bucket(hp)];
  st.n++; st.threat += threat;
  if (hp <= 1 && (me.ep | 0) >= 3) st.ep3++;   /* 摄魂价格：HP≤1 且 ep≥3 才出得起 */
  if (menuDef) st.defMenu++;
  if (menuDef && DEFENSE.has(pk)) { st.defPick++; if (threat) st.defPickThreat++; }
  if (menuDrain) st.drainMenu++;
  if (menuDrain && pk === DRAIN) st.drainPick++;
  lastHp = hp;
  return picked;
}

const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');
const subs = [function (state, pid, legal) { return focusWrap(inner, state, pid, legal); }];
let rosterName = '';
if (TABLE === 'train') {
  const names = (arg('opp', 'targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver')).split(',').map((s) => s.trim()).filter(Boolean);
  const CNT = { targeter: B.pickTargeter, gunSpam: B.pickGunSpam, ringspam: B.pickRingSpam, protomine: B.pickProtoMine, deadlineburst: B.pickDeadlineBurst,
    earlypressure: B.pickEarlyPressure, heavyfire: B.pickHeavyFire, deepsaver: B.pickDeepSaver, guardSpam: B.pickGuardSpam, snipeSpam: B.pickSnipeSpam, reflectWall: B.pickReflectSpam };
  for (const nm of names) if (!CNT[nm]) { console.error('⛔ 不认的对手名 ' + nm); process.exit(2); }
  rosterName = names.join(',');
  for (let i = 1; i < N; i++) subs.push(CNT[names[(i - 1) % names.length]]);
} else {
  const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
  const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
  if (sh < 0) { console.error('⛔ 没有桌形 ' + N + ':' + MODE); process.exit(2); }
  rosterName = 'arena2 分层桌 · shape ' + N + ':' + MODE;
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    subs.push(e.sel);
  }
}

for (let k = 0; k < GAMES; k++) { evCursor = 0; lastHp = null; T.oneGameN(subs, 77000 + k * 977, N, { mode: MODE }); }

const pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—（分母 0）';
console.log('### 防御/摄魂分层 ‖ 包=' + PACK.split('/').pop() + ' ‖ 容器=' + label + ' ‖ 桌=' + TABLE + ' ‖ ' + MODE + ' ‖ ' + N + ' 人 ‖ ' + GAMES + ' 局');
console.log('对手：' + rosterName);
console.log('HP 档 | 决策 | 挨过打 | 防御菜单率 | 防御被选率 | 挨打时防御率 | 摄魂菜单率 | 摄魂被选率');
for (const b of ['<=1', '2', '>=3']) {
  const s = STRATA[b];
  console.log([b, s.n, s.threat, pct(s.defMenu, s.n), pct(s.defPick, s.n), pct(s.defPickThreat, s.threat), pct(s.drainMenu, s.n), pct(s.drainPick, s.n)].join(' | '));
}
const low = STRATA['<=1'];
console.log('摄魂（仅 HP≤1 可用）：菜单 ' + low.drainMenu + ' 次 ‖ 被选 ' + low.drainPick + ' 次 ⇒ ' + pct(low.drainPick, low.drainMenu) + '（分母=菜单）');
console.log('摄魂价格：HP≤1 且 ep≥3 的决策 ' + low.ep3 + '/' + low.n + ' = ' + pct(low.ep3, low.n) + '（出得起才谈选不选）');