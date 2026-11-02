#!/usr/bin/env node
/* probe-def-drain-wiring.mjs — 验 DS 11-02 两条奖励的接线与"满血无人打"这条地基（qoder · 11-02 下午）
 * ① 合成事件：`countDefAdaptHits` 到底认哪些事件（引擎发的 `blocked` 带的是**中文牌名**，见 resolve.js:512-538）
 * ② 真实局：训练世界（8 只脚本对手）与考场（arena2 分层桌）里，被测席收到 blocked/reflect/transfer 各多少次、
 *    `by` 的取值分布 ⇒ 直接量"这根奖励实际看到的剂量"
 * ③ 血量下坠的形状：焦点席相邻两次决策之间的掉血是一次 1 点还是整块 ⇒ "HP≥3 挨打 0/232" 是产品事实还是档位口径
 * 只读，不改任何在册尺。用法：node scratch/probe-def-drain-wiring.mjs [--pack=...] [--games=30]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/DD-C-s13.js');
const GAMES = Math.max(5, Number(arg('games', 30)) || 30);
const N = 5, MODE = 'multi', TEMP = 0.15;

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots, R = W.EpirusRules;

/* ===== ① 合成事件 ===== */
console.log('### ① countDefAdaptHits 的合成夹具（引擎导出：T.countDefAdaptHits）');
const FIX = [
  ['blocked by=中文牌名「防御」（引擎真实发法）', [{ type: 'blocked', to: 0, by: '防御', amt: 1 }]],
  ['blocked by=英文键 guard（函数期望的形状）', [{ type: 'blocked', to: 0, by: 'guard', amt: 1 }]],
  ['blocked by=「八卦阵」', [{ type: 'blocked', to: 0, by: '八卦阵', amt: 1 }]],
  ['blocked by=「原型制御」', [{ type: 'blocked', to: 0, by: '原型制御', amt: 1 }]],
  ['reflect（反弹把伤反回去，to=持反弹的本席）', [{ type: 'reflect', to: 0, from: 2, amt: 1, by: 'reflect' }]],
  ['transfer（转移伤害，to=转移者本席）', [{ type: 'transfer', to: 0, from: 2, dest: 3, amt: 1 }]],
  ['heal reason=摄魂（countDrainHeals）', [{ type: 'heal', pid: 0, amt: 1, reason: '摄魂' }]],
];
if (typeof T.countDefAdaptHits !== 'function') { console.error('⛔ 引擎没导出 countDefAdaptHits ⇒ 本次探针无效'); process.exit(7); }
for (const [name, evs] of FIX) {
  const hits = T.countDefAdaptHits(evs, 0);
  const heals = T.countDrainHeals ? T.countDrainHeals(evs, 0) : -1;
  console.log('   ' + name.padEnd(42) + ' → 挡下计数 ' + hits + ' ‖ 摄魂回血计数 ' + heals);
}

/* ===== 载入被测包 ===== */
function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) {
    const got = packCfgExit(raw, path);
    installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
    return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v + ' ' + (raw.dims && raw.dims.input) };
  }
  const c7 = loadChamp(W, path, '.');
  if (!c7) { console.error('⛔ 读不出包：' + path); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7 长 ' + c7.length };
}
const { pp, label } = loadPack(PACK);

/* 每局的读数累加器 */
function newAcc() { return {
  byVals: {}, evTypes: {}, hpPath: [], maxHp: 0, deaths: 0, wins: 0, lowDec: 0, defMenuDec: 0, drainMenuDec: 0 }; }

function runTable(tag, subs, mkSubs) {
  const acc = newAcc();
  let lastHp = null;
  const focus = function (state, pid, legal) {
    const me = state.p[pid] || {};
    const hp = me.hp | 0;
    if (hp > acc.maxHp) acc.maxHp = hp;
    if (lastHp !== null && hp !== lastHp) acc.hpPath.push([lastHp, hp]);
    lastHp = hp;
    const keys = (legal || []).map((c) => (typeof c === 'string' ? c : c.key));
    if (hp <= 1) acc.lowDec++;
    if (keys.some((k) => (R.byKey[k] && R.byKey[k].cat === R.CAT.DEFENSE))) acc.defMenuDec++;
    if (keys.indexOf(R.SK.DRAIN) >= 0) acc.drainMenuDec++;
    return inner(state, pid, legal);
  };
  const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');
  for (let k = 0; k < GAMES; k++) {
    lastHp = null;
    const wrapped = [focus];
    const rest = mkSubs();
    for (const s of rest) wrapped.push(s);
    const r = T.oneGameN(wrapped, 77000 + k * 977, N, { mode: MODE });
    const evs = (r && r.state && r.state.events) || (r && r.events) || [];
    for (const e of evs) {
      acc.evTypes[e.type] = (acc.evTypes[e.type] || 0) + 1;
      if ((e.type === 'blocked' || e.type === 'reflect') && e.to === 0) {
        const key = e.type + ' by=' + String(e.by);
        acc.byVals[key] = (acc.byVals[key] || 0) + 1;
      }
      if (e.type === 'transfer' && e.to === 0) acc.byVals['transfer to=本席'] = (acc.byVals['transfer to=本席'] || 0) + 1;
    }
    if (r && r.winner === 0) acc.wins++;
    if (r && r.deaths && r.deaths[0]) acc.deaths++;
  }
  console.log('### ②/' + tag + ' ‖ 包=' + PACK.split('/').pop() + ' ‖ ' + label + ' ‖ ' + GAMES + ' 局 ‖ 焦点席（0 号）');
  console.log('   本席收到的防御性事件（by 取值分布）：' + (Object.keys(acc.byVals).length
    ? Object.entries(acc.byVals).map(([k, v]) => k + '×' + v).join(' ‖ ') : '一次都没有'));
  console.log('   全场事件类型计数（前 10）：' + Object.entries(acc.evTypes).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => k + ':' + v).join(' '));
  const drops = acc.hpPath.filter(([a, b]) => b < a);
  const byAmt = {};
  for (const [a, b] of drops) { const d = a - b; byAmt[d] = (byAmt[d] || 0) + 1; }
  const fromHigh = drops.filter(([a]) => a >= 3);
  const stillHigh = drops.filter(([, b]) => b >= 3);
  console.log('   掉血 ' + drops.length + ' 次 ‖ 单次掉血面额分布：' + Object.entries(byAmt).sort((x, y) => Number(x[0]) - Number(y[0])).map(([k, v]) => k + '点×' + v).join(' '));
  console.log('   掉血发生在 HP≥3 之前的：' + fromHigh.length + ' 次 ‖ 掉完之后仍停在 HP≥3 的：' + stillHigh.length + ' 次（DS 那条尺只看得见后者）');
  console.log('   最大血量 ' + acc.maxHp + ' ‖ HP≤1 的决策 ' + acc.lowDec + ' ‖ 防御进菜单的决策 ' + acc.defMenuDec + ' ‖ 摄魂进菜单的决策 ' + acc.drainMenuDec + '（菜单率 ' + (100 * acc.drainMenuDec / Math.max(1, acc.lowDec)).toFixed(0) + '% 相对残血决策）');
  return acc;
}

console.log();
const CNT = { targeter: B.pickTargeter, gunSpam: B.pickGunSpam, ringspam: B.pickRingSpam, protomine: B.pickProtoMine,
  deadlineburst: B.pickDeadlineBurst, earlypressure: B.pickEarlyPressure, heavyfire: B.pickHeavyFire, deepsaver: B.pickDeepSaver };
const NAMES = Object.keys(CNT);
runTable('a 训练世界（8 只脚本对手，与 12 臂同源）', null, () => NAMES.slice(0, N - 1).map((n) => CNT[n]));
console.log();
const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
const sh = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
runTable('b 考场（arena2 分层桌 · def-drain-trace 用的就是这张）', null, () => {
  const out = [];
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + 101) % A.roster.length, e = A.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
    out.push(e.sel);
  }
  return out;
});
