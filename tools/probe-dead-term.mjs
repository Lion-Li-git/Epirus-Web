/* 「死项筛子」（v1.5.275 · qoder 09-28 §E96/§E98/§E99）—— 判"某根收益项有没有作用"的常驻量具
 * 为什么要有它：今晚我拿"关掉后产物逐位相同"就写了"可证死项"，**下一个实验（换桌数）把那句话推翻了**（§E99）。
 *   这把尺的设计目标就是**禁止那种过度声称**，所以它一次给出三层，缺一不可：
 *   ① 单位级 on/off：同一 params/seed/对手组，把该根权重整根置 0，比 `fit` 是否逐位变（先自证可复现，末了自证复位）；
 *   ② 前置条件：按**真·训练桌形状**（1 席被测 + 其余席池内脚本，与 `evo.js:1476` 同构）数"这项要奖励的行为出现过几局"；
 *   ③ 阳性对照：把**一定会做该行为的脚本**塞进对手组 ⇒ 该项必须开始改 `fit`；
 *      ⇒ ①不变 + ③变 = "**稀有但活着**"；①不变 + ③也不变 = 这根**够不到作用点**（该查接线，不该查权重）。
 * ⚠ 输出只允许支持"在这(包, 桌数, 对手组)下发声/不发声"。**不许**据此写"这项可以摘"——
 *   §E99 的教训是：摘不摘要有**换桌数/换预算的臂级复现**，而且出厂权重的取舍归用户裁。
 * 用法：node tools/probe-dead-term.mjs [--key=ringW] [--pack=js/bundled-champion-3p.js] [--games=8] [--tn=3,5] [--rounds=40] [--json]
 */
import { sandbox, rejectUnknownFlags, loadChamp } from './audit-lib.mjs';
rejectUnknownFlags(process.argv.slice(2), ['key', 'pack', 'games', 'tn', 'rounds', 'json'], 'probe-dead-term');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const KEY = String(flag('key', 'ringW'));
const PACK = String(flag('pack', 'js/bundled-champion-3p.js'));
const GAMES = Number(flag('games', 8));
const ROUNDS = Number(flag('rounds', 40));
const TNS = String(flag('tn', '3,5')).split(',').map(Number).filter(function (n) { return n >= 2 && n <= 5; });
const JSON_OUT = process.argv.includes('--json');
if (!(GAMES >= 4)) { console.error('⛔ --games 必须 ≥4（更少时"有没有发声"全是抽样噪声）'); process.exit(7); }
if (!(ROUNDS >= 5)) { console.error('⛔ --rounds 必须 ≥5'); process.exit(7); }
if (!TNS.length) { console.error('⛔ --tn 只认 2~5（人数，逗号分隔）'); process.exit(7); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots;
const params = loadChamp(W, PACK);
if (!params) { console.error('⛔ 读不出冠军包 ' + PACK); process.exit(7); }

/* 每根要判的杠杆 = (setter, getter, 该项奖励的行为, 能造出该行为的对照脚本)。
 * ⚠ 只认引擎导出面上真有 setter/getter 的根；**不许写"读不到就跳过"的兜底**（那正是本仓最怕的形状）。 */
const ROOTS = {
  ringW: { set: T.setRingReward, get: function () { return T.ringReward().w; },
    act: R.SK.RING, witness: B.pickRingSpam, witnessName: 'ringspam', label: '打断开环者' },
  pressW: { set: T.setPressReward, get: function () { return T.pressReward().w; },
    act: null, witness: null, label: '压制回合' },
  pierceW: { set: T.setPierceReward, get: function () { return T.pierceReward().w; },
    act: null, witness: null, label: '穿防命中' },
  tgtW: { set: T.setTargetReward, get: function () { return T.targetReward().w; },
    act: null, witness: B.pickTargeter, witnessName: 'targeter', label: '瞄威胁者' },
  clearW: { set: T.setClearReward, get: function () { return T.clearReward().w; },
    act: null, witness: null, label: '清场' },
  beadW: { set: T.setBeadReward, get: function () { return T.beadReward().w; },
    act: null, witness: null, label: '珠闭环（花掉才记分）' }
};
const rt = ROOTS[KEY];
if (!rt) {
  console.error('⛔ 这把尺只钉了这些根：' + Object.keys(ROOTS).join(' / ') +
    '（要加新根必须同时给 setter/getter，**不许加"探测不到就跳过"的路径**）');
  process.exit(7);
}
if (typeof rt.set !== 'function' || typeof rt.get !== 'function') {
  console.error('⛔ `EpirusTrainer` 里没有 ' + KEY + ' 的 setter/getter ⇒ 这根判不了（拒绝把它读成"没作用"）');
  process.exit(7);
}
const POOL = [B.pickRandom, B.pickAggro, B.pickDefend, B.pickBalanced, B.pickAntiDef, B.pickBreakDef, B.pickWall, B.pickMix, B.pickFarmer];
const POOL_NAMES = ['random', 'aggro', 'defend', 'balanced', 'antidef', 'breakdef', 'wall', 'mix', 'farmer'];
const GEN = function (a) {
  let s = a | 0;
  return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const W0 = rt.get();
/* ⚠ **预热是必须的，不是仪式**：实测 `pickMix` 在**首次**调用后仍带着模块级记忆 ⇒
 *   同参数连打三次是 `0.637 / 0.5505 / 0.5505`（其余 8 个池内脚本三次逐位相同）。
 *   也就是说：**不预热就没法判"这根权重关掉的差异是真效应还是记忆"** —— 而 `mix` 正在训练池里（`train-3p.mjs:989`）。 */
const scoreFit = function (sel, on) {
  T.scoreMemberN(params, [{ name: 'x', sel: sel }, { name: 'y', sel: sel }], GAMES, 3, 600, 41, 0);   // 预热，丢弃
  rt.set(on ? W0 : 0);
  const f = T.scoreMemberN(params, [{ name: 'x', sel: sel }, { name: 'y', sel: sel }], GAMES, 3, 600, 41, 0).fit;
  rt.set(W0);
  return f;
};

/* ① 可复现自证：**九个池子每个都测**（早期版本只测 2 个，正好避开 `mix`，于是把记忆当成效应报了出去） */
let selfBad = 0;
for (const sel of POOL) if (scoreFit(sel, true) !== scoreFit(sel, true)) selfBad++;
if (selfBad) { console.error('⛔ 预热之后仍有 ' + selfBad + '/9 个对手组不可复现 ⇒ 这把尺的①不可用（先修可复现性，别再往下读）'); process.exit(7); }

const rows = POOL.map(function (sel, i) {
  const on = scoreFit(sel, true), off = scoreFit(sel, false);
  return { script: POOL_NAMES[i], on: on, off: off, changed: on !== off, d: Math.abs(on - off) };
});
const silent = rows.filter(function (r) { return !r.changed; }).length;

/* ② 前置条件：真·训练桌形状（被测席 = 该包，其余席都是池内脚本）⇒ 数"别的座做过该行为"的局数 */
let pre = null;
if (rt.act) {
  const ch = T.policyChooserN(params, 0.15);
  let casts = 0, gamesWithActor = 0, tot = 0;
  for (const n of TNS) for (let gi = 0; gi < ROUNDS; gi++) {
    const seat = gi % n, cs = [];
    for (let pid = 0; pid < n; pid++) {
      if (pid === seat) cs.push(function (s2, p2, lg) { return ch(s2, p2, lg); });
      else cs.push(function (s2, p2, lg) { return POOL[7](s2, p2, lg); });   // 其余席填 `mix`：今晚实测唯一会打环的池内脚本
    }
    const st = S.createState('multi', { next: GEN(7 + gi * 997 + n * 31) }, n);
    Play.autoGameN(st, cs);
    tot++;
    let c = 0;
    for (const e of (st.events || [])) if (e.type === 'action' && e.outcome === 'ok' && e.key === rt.act && e.pid !== seat) c++;
    casts += c; if (c) gamesWithActor++;
  }
  pre = { tot: tot, casts: casts, gamesWithActor: gamesWithActor, otherSeat: POOL_NAMES[7] };
}

/* ③ 阳性对照：对手组换成"一定会做该行为"的脚本 ⇒ fit 必须开始变 */
let pos = null;
if (rt.witness) {
  const on = scoreFit(rt.witness, true), off = scoreFit(rt.witness, false);
  pos = { changed: on !== off, d: Math.abs(on - off), on: on, name: rt.witnessName };
}

/* ④ 复位自证 */
const restored = rt.get() === W0;

const verdict = (function () {
  if (W0 === 0) return '**出厂就是 0 ⇒ ①里"关掉不变"的每一行都是恒真（0→0 必然不变），没有任何信息量**';
  if (!restored) return '⛔ 复位失败 ⇒ 上面全部不可信';
  if (silent === rows.length) return pos && pos.changed
    ? '**稀有但活着**：常见对手组上从不发声，可一旦桌上有该行为就大声发声 ⇒ "摘掉零风险"这句话**不成立**（要复现桌数/预算）'
    : '**够不到作用点**：连阳性对照都不改 fit ⇒ 该查的是接线/作用点，不是权重';
  return '**会发声**（' + (rows.length - silent) + '/' + rows.length + ' 组对手改变 fit）⇒ 谈不上死项';
})();

if (JSON_OUT) {
  console.log(JSON.stringify({ key: KEY, label: rt.label, w0: W0, rows: rows, pre: pre, positive: pos, restored: restored, verdict: verdict }));
  if (!restored) process.exit(7);
} else {
  console.log('# 死项筛子 · ' + KEY + '（' + rt.label + '）· 出厂权重 ' + W0 + ' · 包 ' + PACK + ' · 每样本 ' + GAMES + ' 局');
  console.log('① 单位级（逐组对手关掉该根后 fit 变不变）：变的行 ' + (rows.length - silent) + '/' + rows.length);
  for (const r of rows) console.log('   ' + r.script.padEnd(9) + (r.changed ? '变 Δfit=' + r.d.toFixed(4) : '不变') + '   fit=' + r.on.toFixed(4));
  if (pre) console.log('② 前置条件（1 席被测 + 其余席 ' + pre.otherSeat + '，N∈{' + TNS.join(',') + '} × ' + ROUNDS + ' 局）：别的座施放 ' +
    rt.act + ' ' + pre.casts + ' 次，有该行为的局 ' + pre.gamesWithActor + '/' + pre.tot +
    ' ⇒ 响一次的频率：' + (pre.gamesWithActor ? '约每 ' + (pre.tot / pre.gamesWithActor).toFixed(0) + ' 局' : '**这 ' + pre.tot + ' 局里一次都没出现**（要更大轮数才能定量级）'));
  if (pos) console.log('③ 阳性对照（对手组换成 ' + pos.name + '）：关掉该根后 fit ' + (pos.changed ? '变 Δ=' + pos.d.toFixed(4) : '**仍不变**'));
  console.log('④ 复位自证：' + (restored ? '通过 ✓' : '**失败**') + ' ⇒ 判读：' + verdict);
  console.log('   （这把尺**不支持**"可以摘某根权重"的结论；摘不摘要臂级换桌复现，且出厂权重归用户裁。）');
  if (!restored) process.exit(7);
}
