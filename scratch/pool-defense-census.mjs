/* pool-defense-census.mjs — 旧 v7 冠军池 30 枚成员"防御用得多少 / 准不准"逐枚普查（qoder · 11-02 午后）
 * 动因（用户）：「适当准确的防御；完全不防御也缺可玩性。旧 v7 池里有很多包防御用得很多，你看一下。」
 *   ⇒ 这条不是把 §十三 推翻，而是给它加一台对照：**旧池里"爱防"的那几枚，防得准不准、赢不赢**。
 * 口径（三处都写清，别拿一个数当"防御占比"）：
 *   - `防/全部出手`＝防御族手数 ÷ 全部出手（含 ジ）
 *   - `防/非ジ出手`＝防御族手数 ÷ 非ジ出手（在册 `GATE2-s13` 那片"凑数区 20~22%"用的是这类口径）
 *   - 防御族**按引擎 `cat` 现取**（`R.byKey[k].cat === R.CAT.DEFENSE`），不硬写名单
 *   - 质量用**在册单一来源** `tools/defense-quality.mjs` 的 `classifyDefenseWindow`（有效/半有效/白防），
 *     窗口 = 本决策之后到下一次本决策之前的事件；`准确率`＝(有效+半)÷防御手数
 * 用法：node scratch/pool-defense-census.mjs [--games=30] [--world=both|exam|arms] [--limit=0]
 */
import { sandbox } from '../tools/audit-lib.mjs';
import { createArena2 } from '../tools/proto2/arena2.mjs';
import { classifyDefenseWindow, defenseQuality } from '../tools/defense-quality.mjs';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const GAMES = Math.max(10, Number(arg('games', 30)) || 30);
const WORLD = arg('world', 'both');
const LIMIT = Number(arg('limit', 0)) || 0;
const TEMP = Number(arg('temp', 0.15));

const W = sandbox();
const T = W.EpirusTrainer, B = W.EpirusBots, R = W.EpirusRules;
const DEFSET = new Set(Object.keys(R.byKey).filter((k) => R.byKey[k] && R.byKey[k].cat === R.CAT.DEFENSE));

/* 池子权重从**装配本体**读（`champion-map/pool-members.tsv` 的 path 指向 docs/artifacts，那层不进 git） */
const raw = readFileSync('js/bundled-champion-pool.js', 'utf8');
const KEY = 'global.EPIRUS_CHAMPION_POOL = ';
const beg = raw.indexOf(KEY);
const end = raw.indexOf('\n', beg);
const semi = raw.lastIndexOf(';', end);
let POOL;
try { POOL = JSON.parse(raw.slice(beg + KEY.length, semi)); }
catch (e) { console.error('⛔ 池子装配解析失败（长度 ' + (semi - beg - KEY.length) + '）：' + e.message.slice(0, 120)); process.exit(7); }
const MEM0 = (LIMIT ? POOL.members.slice(0, LIMIT) : POOL.members);

/* `--packs=a,b`：改测外部包（与池子**同一把尺、同一份 runOne**，这样"旧池 vs 代 3"是并排的数）。
 * ⚠ 代次不能混在一个进程里量：装 arch2 会覆盖容器的语义 ⇒ v7 的读数就会是假的（11-01 那条病）。
 *   ⇒ 这批里只要有一枚 2.0 容器就整批拒跑，除非全是 2.0。 */
let MEM = MEM0;
const EXTRAS = (arg('packs', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (EXTRAS.length) {
  const { readPack2, packCfgExit, install: installArch2 } = await import('./../tools/proto2/arch2.mjs');
  const { loadChamp } = await import('./../tools/audit-lib.mjs');
  const P = W.EpirusPolicy;
  const out = [];
  let gen2 = 0, gen7 = 0;
  for (const p of EXTRAS) {
    const rr = (() => { try { return readPack2(p); } catch (e) { return null; } })();
    if (rr && rr.v !== 7) { gen2++; out.push({ id: p.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''), tier: 'v:' + rr.v, _raw: rr, _path: p }); }
    else { const c7 = loadChamp(W, p, '.'); if (!c7) { console.error('⛔ 读不出 ' + p); process.exit(7); } gen7++; out.push({ id: p.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''), tier: 'v7', _v7: Float64Array.from(c7) }); }
  }
  if (gen2 && gen7) { console.error('⛔ 这批里混了 ' + gen2 + ' 枚 2.0 容器与 ' + gen7 + ' 枚 v7 ⇒ 一个进程里量不准（装 arch2 会改容器语义）。分两次跑。'); process.exit(7); }
  for (const o of out) o.pack = o._v7 ? { v: 7, a: Array.from(o._v7) } : (() => { installArch2(W, Object.assign({ mutMode: 'seg' }, packCfgExit(o._raw, o._path).cfg)); return { v: o._raw.v, a: Array.from(P.unpack(o._raw, true)) }; })();
  MEM = out;
  console.log('### 外部包模式 ‖ ' + MEM.length + ' 枚 ‖ 容器 ' + MEM.map((m) => m.tier).join(','));
}
console.log('### ' + (EXTRAS.length ? '外部包防御普查' : '旧池防御普查') + ' ‖ 池子总 ' + POOL.members.length + ' 枚 ‖ 本次 ' + MEM.length + ' 枚 ‖ 每枚 ' + GAMES + ' 局/世界 ‖ t=' + TEMP + ' ‖ 容器 v' + (POOL.members[0].pack.v));

const AG = ['targeter', 'gunSpam', 'heavyfire', 'earlypressure', 'deadlineburst', 'aggro', 'antidef', 'breakdef'];
const POOL17 = [['random', B.pickRandom], ['balanced', B.pickBalanced], ['aggro', B.pickAggro], ['defend', B.pickDefend],
  ['wall', B.pickWall], ['antidef', B.pickAntiDef], ['breakdef', B.pickBreakDef], ['mix', B.pickMix], ['farmer', B.pickFarmer],
  ['targeter', B.pickTargeter], ['gunSpam', B.pickGunSpam], ['ringspam', B.pickRingSpam], ['protomine', B.pickProtoMine],
  ['deadlineburst', B.pickDeadlineBurst], ['earlypressure', B.pickEarlyPressure], ['heavyfire', B.pickHeavyFire], ['deepsaver', B.pickDeepSaver]
].filter((x) => typeof x[1] === 'function').map((x) => x[1]);
const AGLIST = AG.map((n) => ({ targeter: B.pickTargeter, gunSpam: B.pickGunSpam, heavyfire: B.pickHeavyFire, earlypressure: B.pickEarlyPressure, deadlineburst: B.pickDeadlineBurst, aggro: B.pickAggro, antidef: B.pickAntiDef, breakdef: B.pickBreakDef }[n])).filter(Boolean);

const ARENA = createArena2(W, { refParams: Float64Array.from(MEM[0].pack.a), temp: TEMP, stratified: true, stratCap: '2', stratMix: '0.5' });
function examOpps(N) {
  const sh = ARENA.shapes.findIndex((s) => s.n === N && s.mode === 'multi');
  const out = [];
  for (let pid = 1; pid < N; pid++) {
    let ri = (90000 * 7 + pid * 11 + sh * 13 + 101) % ARENA.roster.length, e = ARENA.roster[ri];
    while (e.kind === 'random') { ri = (ri + 1) % ARENA.roster.length; e = ARENA.roster[ri]; }
    out.push(e.sel);
  }
  return out;
}
function armsOpps(N, k) {
  const out = [];
  for (let s = 1; s < N; s++) out.push(POOL17[(k + s) % POOL17.length]);
  return out;
}
function aggroOpps(N, k) {
  const out = [];
  for (let s = 1; s < N; s++) out.push(AGLIST[(k + s) % AGLIST.length]);
  return out;
}

function runOne(params, world, N) {
  const acc = { acts: 0, ji: 0, def: 0, blocks: 0, averted: 0, dealt: 0, taken: 0, wins: 0, rounds: 0,
    eff: 0, part: 0, idle: 0, defWhenThreat: 0, threatDec: 0, dec: 0, lowDec: 0, lowDef: 0 };
  const inner = T.policyChooserN(params, TEMP, 0, 5, 'soft');
  let cursor, lastThreat, pend;
  const focus = function (state, pid, legal) {
    const evs = state.events || [];
    let threat = 0;
    if (cursor !== undefined) for (let i = cursor; i < evs.length; i++) { const e = evs[i]; if (e && e.type === 'damage' && e.to === pid && (e.amt | 0) > 0) threat = 1; }
    cursor = evs.length; lastThreat = threat;
    if (threat) acc.threatDec++;
    /* 上一手防御的质量结算（窗口 = 那次决策之后的事件） */
    if (pend) { const c = classifyDefenseWindow(evs.slice(pend.cur), R, pid); acc[c] = (acc[c] || 0) + 1; if (c !== 'idle') acc.eff2 = 1; pend = null; }
    acc.dec++;
    const me = state.p[pid] || {};
    if ((me.hp | 0) <= 1) { acc.lowDec++; }
    const picked = inner(state, pid, legal);
    const pk = (picked && typeof picked === 'object') ? (picked.key || '') : String(picked);
    acc.acts++;
    if (pk === R.SK.JI) acc.ji++;
    if (DEFSET.has(pk)) {
      acc.def++; if (threat) acc.defWhenThreat++;
      if ((me.hp | 0) <= 1) acc.lowDef++;
      pend = { cur: evs.length };
    }
    return picked;
  };
  for (let k = 0; k < GAMES; k++) {
    cursor = undefined; pend = null;
    const subs = [focus];
    for (const o of (world === 'exam' ? examOpps(N) : world === 'arms' ? armsOpps(N, k) : aggroOpps(N, k))) subs.push(o);
    const r = T.oneGameN(subs, 77000 + k * 977, N, { mode: 'multi' });
    if (r.winner === 0) acc.wins++;
    acc.rounds += r.rounds || 0;
    for (const e of (r.state && r.state.events) || []) {
      if (e.type === 'blocked' && e.to === 0) { acc.blocks++; acc.averted += (e.amt | 0); }
      else if (e.type === 'damage' && e.source === 0) acc.dealt += (e.amt | 0);
      else if (e.type === 'damage' && e.to === 0) acc.taken += (e.amt | 0);
    }
  }
  return acc;
}

const q = (a) => { const n = a.def || 0; return n ? (((a.eff || 0) + (a.part || 0)) / n * 100).toFixed(0) + '%' : '—'; };
const rows = [];
for (const m of MEM) {
  const p = Float64Array.from(m.pack.a);
  const worlds = WORLD === 'both' ? [['exam', 5], ['arms', 3]] : [[WORLD, WORLD === 'exam' ? 5 : 3]];
  const r = { id: m.id, tier: m.tier, };
  for (const [w, N] of worlds) r[w] = runOne(p, w, N);
  rows.push(r);
}
const per = (x, k) => (x[k] / GAMES).toFixed(2);
const share = (x, den) => (den ? (100 * x.def / den).toFixed(1) + '%' : '—');
console.log('\n#### 考卷桌（5 人 · arena2 分层桌）');
console.log('| 成员 | 档 | 防/全部出手 | 防/非ジ出手 | 防御手/局 | 挡下/局 | 免伤/局 | 准确率(有效+半) | 挨打时防御/局 | 夺1% |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows.sort((a, b) => b.exam.def / b.exam.acts - a.exam.def / a.exam.acts)) {
  const x = r.exam;
  console.log('| ' + r.id + ' | ' + r.tier + ' | ' + share(x, x.acts) + ' | ' + share(x, x.acts - x.ji) + ' | ' + per(x, 'def') + ' | ' + per(x, 'blocks') + ' | ' + per(x, 'averted') + ' | ' + q(x) + ' | ' + per(x, 'defWhenThreat') + ' | ' + (100 * x.wins / GAMES).toFixed(1) + '% |');
}
console.log('\n#### 训练桌（3 人 · 17 型池 = 臂住的那个分布）');
console.log('| 成员 | 档 | 防/全部出手 | 防/非ジ出手 | 防御手/局 | 挡下/局 | 免伤/局 | 准确率 | 残血防御手/局 | 夺1% |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows.sort((a, b) => b.arms.def / b.arms.acts - a.arms.def / a.arms.acts)) {
  const x = r.arms;
  console.log('| ' + r.id + ' | ' + r.tier + ' | ' + share(x, x.acts) + ' | ' + share(x, x.acts - x.ji) + ' | ' + per(x, 'def') + ' | ' + per(x, 'blocks') + ' | ' + per(x, 'averted') + ' | ' + q(x) + ' | ' + per(x, 'lowDef') + ' | ' + (100 * x.wins / GAMES).toFixed(1) + '% |');
}
const nDef = rows.filter((r) => r.exam.def / Math.max(1, r.exam.acts) > 0.05).length;
const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
console.log('\n小结：考卷桌上防御占全部出手 >5% 的成员 **是 ' + nDef + ' / ' + rows.length + ' 枚**' +
  ' ‖ 中位份额 ' + (100 * med(rows.map((r) => r.exam.def / Math.max(1, r.exam.acts)))).toFixed(1) + '%' +
  ' ‖ 最凶 ' + (100 * Math.max(...rows.map((r) => r.exam.def / Math.max(1, r.exam.acts)))).toFixed(1) + '%');
console.log('（准确率 = 有效+半有效 ÷ 防御手数，来自在册 `defense-quality.mjs`；"挡下/局" 是本席成功挡住别人的次数。）');
