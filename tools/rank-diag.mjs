/* Epirus 座位效应 / 平局诊断（v1.3.57）
 *
 * 用法: node tools/rank-diag.mjs [局数=600] [人数=5] [seed=91000] [冠军文件] [--mix=champ|rand|tankline]
 *        --field=same    全部座位用同一个 chooser（完全对称 ⇒ 用来**隔离**座位效应）
 *        --field=script  1 个主体座位 + (N-1) 个脚本，座位轮换（真实考卷场）
 *
 * 背景（v1.3.55 的 5 人局评测）：冠军各座位 1st 率 25.7/36.4/26.4/30.0/35.0%；
 * 对照 pickRandom 10.7/17.9/10.0/10.0/3.6% —— 弱主体的梯度更陡，像"平局由 pid 决定"。
 * 代码事实：`js/train/evo.js` 的 `rankOf` 比较器是 `alive → hp 降 → taken 升`，**没有 pid**，
 * 完全并列时落到 Array.prototype.sort 的稳定性 = 插入顺序 = **pid 升序**。
 * （引擎自己的 `checkOver` 是 pid 中性的：并列判 draw，`bestPid` 只在唯一最大时使用。）
 *
 * 关键设计：对**同一批对局**分别用四种名次规则算，差异只能来自名次规则本身：
 *   key3  = alive, hp 降, taken 升                （现状；末位并列 → pid 升序）
 *   key4  = key3 + dealt 降                       （候选修法一；dealt 需要 damage.source）
 *   joint = key4，**仍然并列者给相同（最好）名次**  （候选修法二；完全 pid 中性）
 *   rand  = 先按种子洗牌、再按 key3 稳定排序        （pid 中性对照；洗牌在排序**之前**，
 *                                                   这样并列元素的相对顺序是随机的，
 *                                                   而 key 的先后关系仍被严格遵守）
 * ⚠️ 上一版把 rand 写成"按 key3 分组、组内洗牌、组间按出现顺序拼"——组间顺序恰好是 pid 序，
 *    等于没消除偏置。这是本文件唯一的"对照必须自己也对"的教训。
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a);
  if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2];
}
const GAMES = Number(ARGV[0] || 600);
const N = Number(ARGV[1] || 5);
const SEED = Number(ARGV[2] || 91000);
const FILE = ARGV[3] || 'js/bundled-champion-3p.js';
const MIX = FLAG.mix || 'champ';
const FIELD = FLAG.field || 'same';

const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, P = W.EpirusPolicy, R = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots;

const src = readFileSync(FILE, 'utf8');
const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
const params = mm ? P.unpack(JSON.parse(mm[1]), true) : null;
if (MIX === 'champ' && !params) { console.error('冠军解包失败: ' + FILE); process.exit(1); }

const mk = {
  champ: function () { return T.policyChooserN(params, 0.15); },
  rand: function () { return Bots.pickRandom; },
  tankline: function () { return Bots.pickTankLine; },
  heavyfire: function () { return Bots.pickHeavyFire; },
  deepsaver: function () { return Bots.pickDeepSaver; }
};
const makeSubj = mk[MIX] || mk.champ;
/* 真实考卷场的 4 个脚本（与 eval-5p 的 core 池同源，含深经济对手） */
const FIELD_SCRIPTS = [['random', Bots.pickRandom], ['wall', Bots.pickWall], ['heavyfire', Bots.pickHeavyFire], ['deepsaver', Bots.pickDeepSaver]];
function asChooser(fn) {
  return function (state, pid, legal) {
    const k = fn(state, pid, legal);
    const key = (typeof k === 'string') ? k : (k && k.key);
    if (key == null) return { key: R.SK.JI, target: null, target2: null };
    const obj = (typeof k === 'object' && k) ? k : null;
    const t1 = (obj && obj.target != null) ? obj.target : T.pickTargetN(state, pid, key);
    const t2 = (obj && obj.target2 != null) ? obj.target2 : T.pickTarget2N(state, pid, key, t1);
    return { key: key, target: t1, target2: t2 };
  };
}

function rngOf(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, rnd) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

const NAMES = ['fixed', 'key3', 'key4', 'joint', 'rand'];
const stats = {};
for (const nm of NAMES) stats[nm] = { first: new Array(N).fill(0), rankSum: new Array(N).fill(0), games: new Array(N).fill(0) };
let idemFail = 0, permFail = 0;
let total = 0, tiedPlayers = 0, tieGroups = 0, tieResolvedByDealt = 0, tieStillTied = 0, drawGames = 0, capGames = 0;
const hpSum = new Array(N).fill(0), takenSum = new Array(N).fill(0), dealtSum = new Array(N).fill(0);
let top2 = { fixed: new Array(N).fill(0), key3: new Array(N).fill(0), key4: new Array(N).fill(0), joint: new Array(N).fill(0), rand: new Array(N).fill(0) };

for (let g = 0; g < GAMES; g++) {
  const seat = (FIELD === 'script') ? (g % N) : -1;
  const choosers = [];
  let fi = 0;
  /* ⚠️ 脚本槽位必须**随局旋转**：否则 FIELD_SCRIPTS[k] 总是被填进固定那几个座位，
   * "座位偏置"会和"哪个脚本坐在哪"混淆（v1.3.55 的 eval-5p 第一版就踩过这个）。 */
  const rot = (FIELD === 'script') ? (g % FIELD_SCRIPTS.length) : 0;
  const field = FIELD_SCRIPTS.slice(rot).concat(FIELD_SCRIPTS.slice(0, rot));
  for (let pid = 0; pid < N; pid++) {
    if (FIELD === 'script' && pid !== seat) { choosers.push(asChooser(field[fi % field.length][1])); fi++; }
    else choosers.push(makeSubj());
  }
  const r = T.oneGameN(choosers, SEED + g * 977, N);
  const st = r.state;
  const taken = new Array(N).fill(0), dealt = new Array(N).fill(0);
  for (const e of st.events) {
    if (e.type !== 'damage') continue;
    if (e.to != null) taken[e.to] += (e.amt || 0);
    if (e.source != null) dealt[e.source] += (e.amt || 0);
  }
  const recs = [];
  for (let i = 0; i < N; i++) {
    const hp = Math.max(0, st.p[i].hp);
    recs.push({ pid: i, alive: hp > 0 ? 1 : 0, hp: hp, taken: taken[i], dealt: dealt[i] });
    hpSum[i] += hp; takenSum[i] += taken[i]; dealtSum[i] += dealt[i];
  }
  const cmp3 = function (a, b) {
    if (a.alive !== b.alive) return b.alive - a.alive;
    if (Math.abs(b.hp - a.hp) > 1e-9) return b.hp - a.hp;
    if (a.taken !== b.taken) return a.taken - b.taken;
    return 0;
  };
  const cmp4 = function (a, b) { const c = cmp3(a, b); return c !== 0 ? c : (b.dealt - a.dealt); };

  const o3 = recs.slice().sort(cmp3);                       // 稳定 → 并列按 pid 升序（现状）
  const o4 = recs.slice().sort(cmp4);                       // 第 4 键 dealt
  const oR = shuffle(recs.slice(), rngOf(SEED + g * 104729 + 7)).sort(cmp3);  // 先洗牌再稳定排序

  /* joint：用 key4 分组，并列者取相同（最好）名次 */
  const oJ = o4;
  const jrank = new Array(N).fill(0);
  {
    let i = 0;
    while (i < oJ.length) {
      let j = i;
      while (j + 1 < oJ.length && cmp4(oJ[j], oJ[j + 1]) === 0) j++;
      for (let k = i; k <= j; k++) jrank[oJ[k].pid] = i + 1;
      i = j + 1;
    }
  }

  const assign = function (nm, order) {
    for (let k = 0; k < order.length; k++) {
      const pid = order[k].pid;
      stats[nm].rankSum[pid] += k + 1; stats[nm].games[pid]++;
      if (k === 0) stats[nm].first[pid]++;
      if (k < 2) top2[nm][pid]++;
    }
  };
  assign('key3', o3); assign('key4', o4); assign('rand', oR);
  /* fixed = **仓库里真正的 rankOf**（不是本文件的复刻）。必须对所有座位都问一遍，
   * 所以它必须幂等；顺便也验证了这一点（若两次结果不同，下面的断言会红）。 */
  {
    const r1 = [];
    for (let pid = 0; pid < N; pid++) r1.push(T.rankOf(st, pid, SEED + g * 977));
    const r2 = [];
    for (let pid = 0; pid < N; pid++) r2.push(T.rankOf(st, pid, SEED + g * 977));
    if (r1.join(',') !== r2.join(',')) idemFail++;
    const seen = {};
    for (let pid = 0; pid < N; pid++) seen[r1[pid]] = 1;
    if (Object.keys(seen).length !== N) permFail++;      // 必须是 1..N 的严格排列
    for (let pid = 0; pid < N; pid++) {
      const rk = r1[pid];
      stats.fixed.rankSum[pid] += rk; stats.fixed.games[pid]++;
      if (rk === 1) stats.fixed.first[pid]++;
      if (rk <= 2) top2.fixed[pid]++;
    }
  }
  for (let k = 0; k < oJ.length; k++) {
    const pid = oJ[k].pid;
    stats.joint.rankSum[pid] += jrank[pid]; stats.joint.games[pid]++;
    if (jrank[pid] === 1) stats.joint.first[pid]++;
    if (jrank[pid] <= 2) top2.joint[pid]++;
  }

  /* 平局统计 */
  const g3 = {};
  for (const r2 of recs) { const k = r2.alive + '|' + r2.hp + '|' + r2.taken; (g3[k] = g3[k] || []).push(r2); }
  for (const k of Object.keys(g3)) {
    const grp = g3[k];
    if (grp.length > 1) tiedPlayers += grp.length;
    if (grp.length <= 1) continue;
    tieGroups++;
    const sub = {};
    for (const r2 of grp) { const kk = r2.alive + '|' + r2.hp + '|' + r2.taken + '|' + r2.dealt; sub[kk] = (sub[kk] || 0) + 1; }
    if (Object.keys(sub).some(function (kk) { return sub[kk] > 1; })) tieStillTied++; else tieResolvedByDealt++;
  }
  if (st.round >= R.MAX_ROUNDS) capGames++;
  if (st.winner === 'draw') drawGames++;
  total++;
}

const pct = function (x, y) { return y ? (x / y * 100).toFixed(1) + '%' : '-'; };
console.log('=== 座位/平局诊断  n=' + N + '  局数=' + total + '  主体=' + MIX + '  场=' + (FIELD === 'same' ? '全同(对称,隔离用)' : '1主体+4脚本(座位轮换)') + ' ===');
console.log('打到回合上限=' + pct(capGames, total) + '  结束为 draw=' + pct(drawGames, total) +
  '  处于并列组的玩家=' + pct(tiedPlayers, total * N) + '  并列组=' + tieGroups +
  '（加 dealt 拆开 ' + pct(tieResolvedByDealt, tieGroups) + '，仍并列 ' + tieStillTied + '）');
console.log('各座位均值: 终局hp=' + hpSum.map(function (v) { return (v / total).toFixed(2); }).join('/') +
  '  承伤=' + takenSum.map(function (v) { return (v / total).toFixed(3); }).join('/') +
  '  输出=' + dealtSum.map(function (v) { return (v / total).toFixed(3); }).join('/') +
  '   ← 若"承伤"随 pid 递减，则低 pid 挨打更多（这是独立于名次规则的真实效应）');
console.log('');
console.log('--- 四种名次规则的各座位 1st 率 / 均名次（同一批对局）---');
for (const nm of NAMES) {
  const s = stats[nm];
  const label = nm === 'fixed' ? '★fixed 仓库真正的 rankOf(已修)' : nm === 'key3' ? 'key3 旧规则(并列→pid升序)' : nm === 'key4' ? 'key4 +dealt降序' : nm === 'joint' ? 'joint key4+并列同名次(完全中性)' : 'rand 先洗牌再排序(中性对照)';
  console.log('  ' + label.padEnd(30) +
    ' 1st: ' + s.first.map(function (v, i) { return 'P' + i + '=' + pct(v, s.games[i]); }).join(' ') +
    '  均名次: ' + s.rankSum.map(function (v, i) { return (s.games[i] ? v / s.games[i] : 0).toFixed(2); }).join('/'));
}
console.log('');
console.log('--- 极差（最大-最小 1st 率，pt）：越小 = 座位效应越弱 ---');
for (const nm of NAMES) {
  const s = stats[nm];
  const rates = s.first.map(function (v, i) { return s.games[i] ? v / s.games[i] : 0; });
  console.log('  ' + nm.padEnd(6) + ' 极差=' + ((Math.max.apply(null, rates) - Math.min.apply(null, rates)) * 100).toFixed(1) + 'pt');
}
console.log('  rankOf 幂等性检查（同局问 5 个座位两次，结果必须一致）: ' + (idemFail ? '✘ 失败 ' + idemFail + ' 局' : '✔ 全部一致'));
console.log('  rankOf 必须返回 1..N 的严格排列: ' + (permFail ? '✘ 失败 ' + permFail + ' 局' : '✔ 全部是严格排列'));
