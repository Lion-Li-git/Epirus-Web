#!/usr/bin/env node
/* counterfactual-value.mjs — "满血摆防 / 残血摄魂"到底值不值钱：反事实强制定量（qoder · 11-02 下午）
 * 动因：DS 的 12 臂把"满血无人打"当地基，但那格是被**打完之后的血量**分档分出来的（5P multi 上限 HP=3 ⇒
 *   满血挨一下必然掉出 ≥3 档）。本尺不猜，直接在同一个决策点上**强行换那一手**，用同一批局种配对：
 *     native    ＝ 原生选择
 *     def@3     ＝ 满血（HP=上限）时，只要防御族在菜单里就出防御（优先 0 费的「防御」）
 *     def@2     ＝ HP=2 时同上（DS 那把尺把"满血挨打"全记在这格里）
 *     drain@1   ＝ HP≤1 且摄魂合法且出得起（ep≥3）时，强行摄魂
 * 读的是**能力/价值**，不是成绩：桌形与局种两侧一致，只在第一处分叉之前严格配对。
 * 用法：node scratch/counterfactual-value.mjs [--pack=...] [--games=40] [--worlds=train,strat,onlygun]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const PACK = arg('pack', 'scratch/ga-arms/DD-C-s13.js');
const GAMES = Math.max(10, Number(arg('games', 40)) || 40);
const N = Math.max(3, Number(arg('n', 5)) || 5), MODE = arg('mode', 'multi'), TEMP = 0.15;
const WORLDS = (arg('worlds', 'train,strat,onlygun')).split(',').map((s) => s.trim()).filter(Boolean);

const W = sandbox();
const P = W.EpirusPolicy, T = W.EpirusTrainer, B = W.EpirusBots, R = W.EpirusRules;
const DEFENSE = Object.keys(R.byKey).filter((k) => R.byKey[k] && R.byKey[k].cat === R.CAT.DEFENSE);
const DEFSET = new Set(DEFENSE);
const DRAIN = R.SK.DRAIN, GUARD = R.SK.GUARD;
const DRAIN_COST = R.byKey[DRAIN].cost;

function loadPack(path) {
  const raw = (() => { try { return readPack2(path); } catch (e) { return null; } })();
  if (raw && raw.v !== 7) {
    const got = packCfgExit(raw, path);
    installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg));
    return { pp: Float64Array.from(P.unpack(raw, true)), label: 'v:' + raw.v };
  }
  const c7 = loadChamp(W, path, '.');
  if (!c7) { console.error('⛔ 读不出包：' + path); process.exit(7); }
  return { pp: Float64Array.from(c7), label: 'v7' };
}
const { pp, label } = loadPack(PACK);
const inner = T.policyChooserN(pp, TEMP, 0, 5, 'soft');

/* 反事实覆盖器：命中条件就换成目标键，否则走原生 */
function makeFocus(rule, st) {
  return function (state, pid, legal) {
    const me = state.p[pid] || {};
    const hp = me.hp | 0;
    if (hp > st.maxHp) st.maxHp = hp;
    /* "上一手挨过打"：上个决策到现在的窗口里有落在我身上的 damage。
     * ⚠ 与 DS 的 def-drain-trace 用同一个检测，但那一版把这条挨打记在**打完之后的血量档**里
     *   （5P multi 上限 HP=3 ⇒ 满血挨一下必然掉到 2 档），所以它的"≥3 档挨打 0/232"是口径产物。 */
    const evs = state.events || [];
    let threat = 0;
    if (st.cursor !== undefined) {
      for (let i = st.cursor; i < evs.length; i++) { const e = evs[i]; if (e && e.type === 'damage' && e.to === pid && (e.amt | 0) > 0) threat = 1; }
      if (threat) st.threatDec++;
      /* ⚠ 不能用 `hp === 满 && threat` 数"满血被点"：一挨打就离开满血档，那一格**按构造恒 0**
       *   （DS 的 def-drain-trace 的 `HP≥3 挨打 0/232` 就是这个构造零，不是"没人打"）。
       *   正确的读法是**血路过渡**：上一次决策时还在满血、这次已经掉下来了。 */
      if (threat && st.lastHp !== undefined && st.lastHp === st.maxHp && hp < st.lastHp) st.pokedFull++;
      if (threat && st.lastHp !== undefined && hp < st.lastHp) st.hpDropThreat++;
    }
    st.cursor = evs.length;
    st.lastHp = hp;
    const keys = (legal || []).map((c) => (typeof c === 'string' ? c : c.key));
    let want = null;
    if (rule.kind === 'def' && hp === rule.hp && (!rule.cond || threat)) {
      st.elig++;
      /* 剂量：每 period 次"满血且防御在菜单里"的决策只强出一次 ⇒ 剂量 = 1/period（确定性，不吃 Math.random） */
      const period = rule.period || 1;
      if (st.elig % period !== 0) { /* 这一格不放药 */ }
      else if (keys.indexOf(GUARD) >= 0) want = GUARD;
      else { const alt = keys.find((k) => DEFSET.has(k)); if (alt) want = alt; }
    } else if (rule.kind === 'drain' && hp <= rule.hp) {
      if (keys.indexOf(DRAIN) >= 0 && (me.ep | 0) >= DRAIN_COST) {
        st.elig++;
        const period = rule.period || 1;
        if (st.elig % period === 0) want = DRAIN;
      }
    }
    if (want !== null) {
      st.fired++;
      if (rule.kind === 'def') st.defPlays++;
      if (rule.kind === 'drain') st.drainPlays++;
      const obj = (legal || []).find((c) => (typeof c === 'string' ? c : c.key) === want);
      return obj === undefined ? want : obj;
    }
    if (rule.kind === 'menu' && hp === rule.hp && keys.indexOf(GUARD) >= 0) st.legalOnly++;
    st.decisions++;
    const picked = inner(state, pid, legal);
    const pk = (picked && typeof picked === 'object') ? (picked.key || '?') : String(picked);
    if (DEFSET.has(pk)) st.defPlays++;
    if (pk === DRAIN) st.drainPlays++;
    return picked;
  };
}

/* 三种世界的对手席 */
const A = createArena2(W, { refParams: pp, temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
const shIdx = A.shapes.findIndex((s) => s.n === N && s.mode === MODE);
const CNT = [B.pickTargeter, B.pickGunSpam, B.pickRingSpam, B.pickProtoMine];
function roster(world) {
  if (world === 'train') return CNT;
  if (world === 'strat') {
    const out = [];
    for (let pid = 1; pid < N; pid++) {
      let ri = (90000 * 7 + pid * 11 + shIdx * 13 + 101) % A.roster.length, e = A.roster[ri];
      while (e.kind === 'random') { ri = (ri + 1) % A.roster.length; e = A.roster[ri]; }
      out.push(e.sel);
    }
    return out;
  }
  if (world === 'onlygun') {
    const gun = A.roster.find((e) => e.name === 'only:gun');
    if (!gun) { console.error('⛔ arena2 名单里没有 only:gun'); process.exit(7); }
    return Array.from({ length: N - 1 }, () => gun.sel);
  }
  console.error('⛔ 不认的世界 ' + world); process.exit(2);
}

const RULES = [
  { name: 'native', rule: { kind: 'menu', hp: -99 } },
  { name: 'def@满血 剂量 1/1', rule: { kind: 'def', hp: 3, period: 1 } },
  { name: 'def@满血 剂量 1/2', rule: { kind: 'def', hp: 3, period: 2 } },
  { name: 'def@满血 剂量 1/4', rule: { kind: 'def', hp: 3, period: 4 } },
  { name: 'def@满血 剂量 1/8', rule: { kind: 'def', hp: 3, period: 8 } },
  { name: 'def@HP-1 剂量 1/1', rule: { kind: 'def', hp: 2, period: 1 } },
  { name: 'def@HP-1∧刚挨打', rule: { kind: 'def', hp: 2, period: 1, cond: true } },
  { name: 'drain@≤1 剂量 1/1', rule: { kind: 'drain', hp: 1, period: 1 } },
  { name: 'drain@≤1 剂量 1/2', rule: { kind: 'drain', hp: 1, period: 2 } },
];

console.log('### 反事实强制定量 ‖ 包=' + PACK.split('/').pop() + ' ‖ ' + label + ' ‖ ' + N + ' 人 ' + MODE + ' ‖ ' + GAMES + ' 局/格 ‖ t=' + TEMP);
console.log('世界 | 档 | 夺1% | 局均回合 | 终局HP | 出该手/局 | 防御手/局 | 摄魂手/局 | 挨打决策/满血挨打');
for (const world of WORLDS) {
  /* 满血到底是几：先用 native 探一次上限（5P multi 上限 = 3） */
  const probe = { fired: 0, elig: 0, defPlays: 0, drainPlays: 0, decisions: 0, legalOnly: 0, threatDec: 0, pokedFull: 0, hpDropThreat: 0, maxHp: 0 };
  const base = runCell(world, RULES[0].rule, probe);
  const FULL = probe.maxHp;
  const side = '（挨打决策 ' + (probe.threatDec / GAMES).toFixed(2) + ' ‖ 其中从满血被打下来 ' + (probe.pokedFull / GAMES).toFixed(2) + ' ‖ 本局总决策 ' + (probe.decisions / GAMES).toFixed(1) + '）';
  console.log([world, 'native(满血=' + FULL + ')', fmtPct(base.win / GAMES), (base.rounds / GAMES).toFixed(1), (base.hp / GAMES).toFixed(2), '0.00', (probe.defPlays / GAMES).toFixed(2), (probe.drainPlays / GAMES).toFixed(2), side].join(' | '));
  for (const rl of RULES.slice(1)) {
    const rule = Object.assign({}, rl.rule);
    if (rule.kind === 'def' && rule.hp === 3) rule.hp = FULL;
    const st = { fired: 0, elig: 0, defPlays: 0, drainPlays: 0, decisions: 0, legalOnly: 0, threatDec: 0, pokedFull: 0, hpDropThreat: 0, maxHp: FULL };
    const g = runCell(world, rule, st);
    console.log([world, rl.name, fmtPct(g.win / GAMES), (g.rounds / GAMES).toFixed(1), (g.hp / GAMES).toFixed(2),
      (st.fired / GAMES).toFixed(2), (st.defPlays / GAMES).toFixed(2), (st.drainPlays / GAMES).toFixed(2),
      '（挨打决策 ' + (st.threatDec / GAMES).toFixed(2) + ' ‖ 其中从满血被打下来 ' + (st.pokedFull / GAMES).toFixed(2) + ' ‖ 本局总决策 ' + (st.decisions / GAMES).toFixed(1) + '）'].join(' | '));
  }
}
console.log('注：Δ夺1 只在**第一处分叉之前**严格配对；触发手/局=0 的格是"没打出去"，不是"打了没用"（阳性对照看 def@3 那两格）。');

function runCell(world, rule, st) {
  const opp = roster(world);
  let win = 0, rounds = 0, hp = 0;
  for (let k = 0; k < GAMES; k++) {
    st.cursor = undefined; st.lastHp = undefined;
    const subs = [makeFocus(rule, st)];
    for (const o of opp) subs.push(o);
    const r = T.oneGameN(subs, 77000 + k * 977, N, { mode: MODE });
    if (r.winner === 0) win++;
    rounds += r.rounds || 0;
    hp += (r.state && r.state.p && r.state.p[0] && r.state.p[0].hp > 0) ? r.state.p[0].hp : 0;
  }
  return { win, rounds, hp };
}
function fmtPct(x) { return (100 * x).toFixed(1) + '%'; }
