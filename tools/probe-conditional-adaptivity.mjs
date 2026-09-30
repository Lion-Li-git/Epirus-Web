#!/usr/bin/env node
/* §E184 · "剥掉对局长度"的适应性尺 —— 回答 §E183 留下的空缺：AI 到底会不会**读对手行为**？
 *
 * 为什么要另造一把：§E183 否掉了"跨环境成对 JS"（它量的是对局怎么结束，不是打法变没变：
 *   12 个环境里关档臂众数卡只换 1 种，JS 却"涨"了 27%）。
 * 这把尺的做法是**只在数字状态相同的地方比**：
 *   桶 = 我血档 × 我 ep 档 × 最强对手血档   （把"局面/数值"钉住）
 *   标签 = 对手上一手的类别（攻/防/攒/无）  （唯一允许变的自由量）
 * ⇒ 同一桶内不同标签的出手分布**只有**在"读了行为"时才会分岔。
 *
 * 三枚对照（METHODOLOGY §88 的规矩：尺要先证明自己认得出它声称能认的东西）：
 *   NC  桶内把标签打乱（同一批决策、同一个分布）   ⇒ 必须 ≈0
 *   PX  脚本臂：**只看对手上一手**出牌              ⇒ 必须明显最高（否则尺瞎）
 *   PX2 脚本臂：**只看数字桶**出牌、碰都不碰标签    ⇒ 必须 ≈0（这条专挡 §E183 那种假绿）
 *
 * 只读 `js/**`，不改任何东西、不加门、不动冠军包。
 */
import { sandbox, mulberry32, loadChamp } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';

const argv = process.argv.slice(2);
function arg(k, d) { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); }
const GAMES = Math.max(4, Number(arg('games', 15)) || 15);
const BANDS = arg('band', 'all') === 'all' ? [1, 2] : [Number(arg('band', 1))];
const SEED = { 1: 4100, 2: 21000 };
const FINE = argv.includes('--fine');                     // 细标签（拼上"在滚环/持珠"）：只在粗标签已有信号时另跑
const W = sandbox(), R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const { pool: POOL } = poolFromSpecs(B, OPP_SPECS);
const ENV_PICK = ['random', 'balanced', 'aggro', 'defend', 'wall', 'antidef', 'breakdef', 'mix', 'farmer', 'tankline', 'heavyfire', 'ringspam'];
const ENVS = ENV_PICK.map(n => { const p = POOL.find(q => q.name === n); if (!p) { console.error('⛔ 环境 `' + n + '` 不在原型池'); process.exit(2); } return p; });
const SK = R.SK, CAT = R.CAT, byKey = R.byKey;
/* `PX3` 用：环境名 → 一张固定卡（**环境身份在对局内并不可观测** ⇒ 这一臂是"量程顶"，不是候选策略）*/
let CUR_ENV = '';
const CARD_OF = {};
(function () {
  const order = [SK.JI, SK.GUARD, SK.REFLECT, SK.BAGUA, SK.RING, SK.CHARGE, SK.SWORD, SK.TANK, SK.GUN, SK.MINE, SK.SHIFT, SK.SNIPE];
  ENV_PICK.forEach((n, i) => { CARD_OF[n] = order[i % order.length]; });
})();
if (!byKey || !byKey[SK.JI] || !byKey[SK.JI].cat) { console.error('⛔ `EpirusRules.byKey[k].cat` 拿不到 ⇒ 行为标签无从定义（尺的承重墙塌了）'); process.exit(2); }

/* ---- 行为标签：对手"最近一次落地的那一手"是哪一类 ----
 * ⚠ 第一版把"在滚环/持珠"也拼进标签（`defense+环+珠` 那种）⇒ 标签 10 余种、每格十几手，
 *   MIN_CELL 一过滤就把**最有信息量的 `attack` 格全丢了**（`PX` 明明按"对手攻→我防"出牌，
 *   却被判 0.0958 < 自己的零假设 0.2965）。⇒ 标签先粗成 5 类，细标签留 `--fine` 另跑。 */
function labelOf(state, pid) {
  let cat = 'none';
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i];
    if (e.type === 'action' && e.outcome === 'ok' && e.pid !== pid) { cat = (byKey[e.key] && byKey[e.key].cat) || 'other'; break; }
  }
  if (!FINE) return (cat === CAT.SPECIAL) ? 'other' : cat;
  let ring = false, bead = false;
  for (let p = 0; p < state.p.length; p++) if (p !== pid && state.p[p].hp > 0) { if (state.p[p].ringStreak > 0) ring = true; if ((state.p[p].elec || 0) + (state.p[p].boom || 0) > 0) bead = true; }
  return cat + (ring ? '+环' : '') + (bead ? '+珠' : '');
}
/* ⚠ 桶必须**不比对照臂的判据更粗**：第一版 ep 分档是 `e0/e12/e35/e6+`，而 `PX2` 的规则用 `ep>=1 / >=3 / >=6`
 *   ⇒ 同一个 `e12` 桶里 ep=1 买不起坦克、ep=2 买得起 ⇒ 它的选择在桶内**并不恒定**，
 *     于是"号称只看数值"的负对照漏出 MI=0.0113（p 已到可判最小值）——**这不是尺坏了，是负对照没做到 blindness**。
 *   ⇒ 桶改成**逐位精确**（血 1/2/3/4+、ep 0..6+），负对照在桶内就真的恒定；判据也不再要求"=0"，
 *     而是**按量程校准**：`PX2` 的 MI 必须 ≤ `PX` 的 15%（尺的"数值冒充"漏读要远小于它声称能读的量）。 */
const hband = (v) => (v <= 0 ? '死' : v >= 4 ? 'h4+' : 'h' + v);
const eband = (v) => (v >= 6 ? 'e6+' : 'e' + v);
function bucketOf(state, pid) {
  const me = state.p[pid];
  let oh = -1;
  for (let p = 0; p < state.p.length; p++) if (p !== pid && state.p[p].hp > 0) oh = Math.max(oh, state.p[p].hp);
  return hband(me.hp) + '|' + eband(me.ep) + '|' + (oh < 0 ? '-' : hband(oh));
}
const coarse = (b) => b.split('|').slice(0, 2).join('|');

/* ---- 臂 ---- */
function aff(legal, k) { const l = legal.find(x => x.key === k); return l && l.affordable ? k : null; }
const ARMS = {
  A0: { name: '关档（现役出厂形状）', mk: () => T.policyChooserN(params, 0.15) },
  /* 信念档一律走这个工厂：**五个旋钮每次全部显式赋值**（漏一个就把上一臂的档带进来），
   *  且模块档 `setBeliefSearch(0)` 恒关 ⇒ 只有焦点席走实例级工厂（§E183 的教训）。 */
  ...Object.fromEntries([
    ['B1', [1, 0, 0, 0, 0, '开 1 席 ply1 tie0']],
    ['B2', [2, 0, 0, 0, 0, '开 1 席 ply2 tie0']],
    ['C1', [1, 1, 0, 0, 0, 'ply1 · 改目标（减均值→减最强）']],
    ['D1', [1, 0, 0, 0, 1, 'ply1 · 环价 1（给"链条活着"定价）']],
    ['E1', [1, 0, 0, 1, 0, 'ply1 · 珠价 1（给"带进下回合的珠"定价）']],
    ['F1', [1, 1, 0, 0, 1, 'ply1 · 改目标 + 环价 1']],
  ].map(([k, v]) => [k, { name: v[5], mk: () => {
    T.setBeliefPly(v[0]); T.setBeliefTarget(v[1]); T.setBeliefTie(v[2]); T.setBeliefBead(v[3]); T.setBeliefRingPrice(v[4]);
    T.setBeliefSearch(0); return T.policyChooserBelief(params, 0.15);
  } }])) ,
  /* PX 正对照：只照"对手上一手"出牌（防→坦克破防、攻→防御、滚环→小雷砸、其余→按ジ）*/
  PX: { name: '正对照：只看对手上一手', mk: () => function (state, pid, legal) {
      const L = (legal || []).filter(l => l.affordable); if (!L.length) return null;
      const has = (k) => L.some(l => l.key === k); let pick = null;
      const cat = labelOf(state, pid).split('+')[0];
      if (L.some(l => l.key === SK.MINE && state.p.some((q, i) => i !== pid && q.hp > 0 && q.ringStreak > 0))) pick = SK.MINE;
      else if (cat === CAT.DEFENSE && has(SK.TANK)) pick = SK.TANK;
      else if (cat === CAT.ATTACK && has(SK.GUARD)) pick = SK.GUARD;
      else if (cat === CAT.ENERGY && has(SK.SWORD)) pick = SK.SWORD;
      else pick = SK.JI;
      return L.find(l => l.key === pick) || L[0];
    } },
  /* PX2 负对照：只看数字桶出牌，**碰都不碰标签** ⇒ 同桶内分布恒定 ⇒ BRS 必须为 0 */
  'PX2': { name: '负对照：只看数字状态', mk: () => function (state, pid, legal) {
      const L = (legal || []).filter(l => l.affordable); if (!L.length) return null;
      const me = state.p[pid]; let pick;
      /* ⚠ 阈值必须落在本游戏的真实刻度上（起手 hp=3、ep 常 0~6）。第一版写的是 `me.hp <= 3` 优先 ⇒ 恒真
       *   ⇒ `PX2` 退化成"永远防御"，一个**常数策略**当负对照是没用的（常数当然 MI=0）。
       *   现在它**强依赖数字桶**（血 1/2/3、ep 0/1-2/3-5/6+ 各出一张不同的卡）却**一个字都不读标签**
       *   ⇒ 它才是"会读数值、不会读人"的那一端，MI(动作;标签|桶) 必须是 0。 */
      if (me.hp <= 1) pick = SK.GUARD;
      else if (me.ep >= 6) pick = SK.RING;
      else if (me.ep >= 3) pick = SK.SWORD;
      else if (me.ep >= 1) pick = SK.TANK;
      else pick = SK.JI;
      /* 兜底也必须**落在桶内恒定**：`|| L[0]` 让"哪张卡恰好排在 legal 第一位"变成第二个漏口
       *   （legal 顺序随状态变 ⇒ 又与标签相关）。ジ成本 0、恒可出 ⇒ 用它当唯一兜底。 */
      return L.find(l => l.key === pick) || L.find(l => l.key === SK.JI) || L[0];
    } },
  /* PX3 上界锚：**每个环境固定一张不同的卡**（真实 AI 永远不该这样，但它给出"多策略"这把尺的量程顶）。
   *   ⚠ 为什么必须有它：`PX`（只看对手一手、完全不理会哪个环境）在"跨环境 MI"上也拿 0.27 ≈ 关档臂的 0.25
   *     —— 因为环境会经由**对手行为分布**间接改变它的出手。⇒ 没有量程顶，"0.25" 这个数没法解释。 */
  PX3: { name: '上界锚：每个环境固定一张卡', mk: () => function (state, pid, legal) {
      const L = (legal || []).filter(l => l.affordable); if (!L.length) return null;
      const want = CARD_OF[CUR_ENV] || SK.JI;
      return L.find(l => l.key === want) || L[0];
    } },
};
const ARMWANT = (arg('arms', '') || Object.keys(ARMS).join(',')).split(',').filter(k => ARMS[k]);

/* ---- 一局：只记录**被测席**的决策三元组 ----
 * `--n=5` 是产品形状（§E182 的教训：归因读数是装配的函数 ⇒ 同一把尺必须在两种桌上都跑一遍才许引）：
 *   0 席 = 人类形状代表（`makeMimic`，与收益表/难度表同一份采样器）‖ 1 席 = 被测臂（焦点席）‖
 *   2、3 席 = 该环境的原型（保住"环境"这个因子）‖ 4 席 = 关档冠军（现役出厂那一只，不动）。
 *   ⚠ 开档臂在 5 人桌上仍**只开焦点席**：模块档恒关，走实例级工厂（§E183 里我第一版把模块档打开，
 *     结果"开 1 席"实际四席全开 ⇒ 整列读数量的不是那一臂）。 */
const TABLE = Number(arg('n', 3)) === 5 ? 5 : 3;
const HB = TABLE === 5 ? loadPool(W, 'human') : null;
function playOne(armKey, env, g, seedBase, out) {
  CUR_ENV = env.name;                                              // 只给 `PX3`（量程顶）用
  const rnd = mulberry32(seedBase + g * 7919);
  const st = S.createState('multi', { next: rnd }, TABLE);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const base = ARMS[armKey].mk();
  const FOCUS = TABLE === 5 ? 1 : 0;
  let acts = 0;
  const rec = function (state, pid, legal) {
    if (pid !== FOCUS) return base(state, pid, legal);
    const r = base(state, pid, legal);
    if (r) { out.push({ b: bucketOf(state, pid), l: labelOf(state, pid), a: r.key, e: env.name }); acts++; }
    return r;
  };
  const chs = [];
  if (TABLE === 5) {
    const mimic = makeMimic(W, HB, 'rand', function () { return st.rng.next(); });
    chs.push(mimic, rec, env.sel, env.sel, T.policyChooserN(params, 0.15));
  } else {
    chs.push(rec, env.sel, env.sel);
  }
  Play.autoGameN(st, chs, undefined, undefined);
  return st;
}
/* ---- JS 散度（开方），与 §E183 同一算子 ---- */
function jsD(p, q) {
  const ks = new Set([...Object.keys(p), ...Object.keys(q)]); let tp = 0, tq = 0;
  for (const k of Object.keys(p)) tp += p[k]; for (const k of Object.keys(q)) tq += q[k];
  if (!tp || !tq) return 0;
  let s = 0;
  for (const k of ks) { const a = p[k] / tp, b = q[k] / tq, m = (a + b) / 2; const kl = (x) => (x > 0 && m > 0 ? x * Math.log(x / m) : 0); s += 0.5 * (kl(a) + kl(b)); }
  return Math.sqrt(s);
}
const norm = (m) => { let t = 0; for (const k in m) t += m[k]; const o = {}; if (t) for (const k in m) o[k] = m[k] / t; return o; };

/** 尺：**条件互信息** `MI(动作 ; 标签 | 数字桶)`（比特）。
 *   = H(动作|桶) − H(动作|桶,标签) —— "知道了对手刚干了什么，还能再消掉我出手里多少不确定性"。
 *   为什么不用"格内两两 JS 求平均"（第一版）：那个算子对**近确定性**的策略会**反向**——
 *   `PX` 明明 11.5% 的决策按标签换了整张卡，却因为
 *     ① 稀有标签（`attack`）过不了 MIN_CELL 门 ⇒ 有信息的那一对根本没进平均；
 *     ② 其余格全是同一张ジ ⇒ 观测 JS=0，而**打乱标签反而把混合分布搅出差别** ⇒ 零分布(0.31) > 观测(0.11)。
 *   ⇒ 自检当场把这条报成"尺认不出真读了行为的臂"，改算子。**教训同族：见 §E183 的 JS 多样性。**
 *   MI 的好处：稀有但强的对比按频率自然计入；确定性策略 MI 恰好=0（`PX2` 该得 0）；
 *   小样本偏差由**同一批数据上的置换零分布**扣掉 ⇒ 报 `excess = MI − MI_置换均值`。 */
const H = (cnts) => { let t = 0; for (const k in cnts) t += cnts[k]; if (t <= 0) return 0; let h = 0; for (const k in cnts) { const p = cnts[k] / t; if (p > 0) h -= p * Math.log2(p); } return h; };
function mi(dec, getB, getKey, relabel) {
  const B = {};
  for (const d of dec) {
    const b0 = getB(d), k = relabel ? relabel.get(d) : getKey(d);
    let b = B[b0]; if (!b) b = B[b0] = { n: 0, a: {}, by: {} };
    b.n++; b.a[d.a] = (b.a[d.a] || 0) + 1;
    const by = b.by[k] = b.by[k] || {}; by[d.a] = (by[d.a] || 0) + 1;
  }
  const N = dec.length; let hAb = 0, hABK = 0, nb = 0, ncell = 0;
  for (const x in B) {
    const bb = B[x]; nb++; hAb += (bb.n / N) * H(bb.a);
    for (const k in bb.by) { const c = bb.by[k]; let t = 0; for (const a in c) t += c[a]; ncell++; hABK += (t / N) * H(c); }
  }
  /* `hA` = 钉住桶之后**还剩**的动作不确定性（比特）。MI ≤ hA ⇒ 跨臂比 MI 绝对值会被"策略本身有多花"混掉：
   *   一个几乎不换招的臂天花板就低。所以除 MI 外再报 `MI/hA` = "**它的不确定性里有多少是读来的**"。 */
  return { mi: Math.max(0, hAb - hABK), hA: hAb, buckets: nb, cells: ncell, n: N };
}
/** 桶内重贴自由量（标签 / 环境名）⇒ 同一批 (桶,动作) 的真实绑定被切断 = **自己那批格子**的零分布 */
function permMap(dec, getB, getVal, seed) {
  const rnd = mulberry32(seed); const m = new Map(); const byB = {};
  dec.forEach((d, i) => (byB[getB(d)] = byB[getB(d)] || []).push(i));
  for (const b in byB) {
    const idx = byB[b].slice();
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    idx.forEach((si, k) => m.set(dec[byB[b][k]], getVal(dec[si])));
  }
  return m;
}
function permNull(dec, obs, reps, getB, getVal) {
  const vals = []; let ge = 0;
  for (let r = 0; r < reps; r++) {
    const v = mi(dec, getB, getVal, permMap(dec, getB, getVal, 90001 + r * 7919)).mi;
    vals.push(v); if (v >= obs - 1e-12) ge++;
  }
  vals.sort((a, b) => a - b);
  return { med: vals[vals.length >> 1], mean: vals.reduce((a, x) => a + x, 0) / vals.length, hi: vals[vals.length - 1], p: (1 + ge) / (reps + 1) };
}
/* "多策略"用同一个算子：把自由量从"对手上一手"换成"环境名"（桶用粗一档：我血 × 我 ep）
 *   ⇒ `MI(动作 ; 环境 | 数字桶)`，不再需要第二套代码去证明它是同一把尺。 */
const getLB = (d) => d.b, getEB = (d) => coarse(d.b);
const getLAB = (d) => d.l, getENV = (d) => d.e;
/** 旧的那把废尺（§E183）：不分桶，直接对整局分布比 —— 留着是为了**并排印出差别** */
function marginalEnvScore(dec) {
  const byE = {};
  for (const d of dec) (byE[d.e] = byE[d.e] || {})[d.a] = (byE[d.e][d.a] || 0) + 1;
  const names = Object.keys(byE); let s = 0, n = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) { s += jsD(norm(byE[names[i]]), norm(byE[names[j]])); n++; }
  return n ? Math.sqrt(s / n) : NaN;
}

const RES = {};for (const band of BANDS) {
  RES[band] = {};
  for (const k of ARMWANT) {
    const dec = [];
    for (const env of ENVS) for (let g = 0; g < GAMES; g++) playOne(k, env, g, SEED[band], dec);
    RES[band][k] = { dec };
    process.stdout.write('|');
  }
}
process.stdout.write('\n');

console.log('# §E184 读行为尺 `MI(动作;对手上一手|数字桶)`（桶 = 我血×我ep×最强对手血；血刻度实测 3/2/1）· ' + GAMES + ' 局/环境 × ' + ENVS.length + ' 环境 · 臂 ' + ARMWANT.join('/')
  + '\n#   桌形 = ' + (TABLE === 5 ? '**产品形状 N=5**（0 席人类形状 makeMimic ‖ 1 席被测焦点 ‖ 2/3 席该环境原型 ‖ 4 席关档冠军）' : 'N=3（0 席被测 ‖ 1/2 席该环境原型）')
  + ' ‖ §E182 的教训：归因读数是装配的函数 ⇒ 同一把尺两种桌都跑过才许并排引');
/* ⚠ 置换次数决定**可达到的最小 p**：`p_min = 1/(REPS+1)`。第一版默认 15 ⇒ p_min=0.0625，
 *   于是"p ≤ 0.05"这条判据**任何臂都过不了**（把三个真读了行为的臂全判成 ⛔）。
 *   ⇒ 默认拉到 99，并把 p_min 一起印出来，别让下一个人再踩。 */
const REPS = Math.max(19, Number(arg('perms', 99)) || 99);
const PMIN = 1 / (REPS + 1);
for (const band of BANDS) {
  const rows = [];
  for (const k of ARMWANT) {
    const dec = RES[band][k].dec;
    const m = mi(dec, getLB, getLAB);
    const n = permNull(dec, m.mi, REPS, getLB, getLAB);
    const e = mi(dec, getEB, getENV);
    const en = permNull(dec, e.mi, REPS, getEB, getENV);
    /* **余下那部分**：把对手上一手也钉进桶里 ⇒ 环境敏感里"不是跟着对手走"的那一块
     *   （`PX` 理论上应该 ≈0，它一个字都不看环境名 ⇒ 这也是一道自检）*/
    const er = mi(dec, (d) => coarse(d.b) + '|' + d.l, getENV);
    const ern = permNull(dec, er.mi, REPS, (d) => coarse(d.b) + '|' + d.l, getENV);
    rows.push({ k, name: ARMS[k].name, mi: m.mi, frac: m.hA > 1e-9 ? m.mi / m.hA : 0, med: n.med, p: n.p, buckets: m.buckets, cells: m.cells, n: m.n,
      miEnv: e.mi, envFrac: e.hA > 1e-9 ? e.mi / e.hA : 0, envMed: en.med, envP: en.p, miRes: er.mi, resMed: ern.med, resP: ern.p, divOld: marginalEnvScore(dec) });
  }
  console.log('\n## 带 ' + band + '（seed ' + SEED[band] + '）· 标签=' + (FINE ? '细（含滚环/持珠）' : '粗（对手上一手类别）') + ' · 置换 ' + REPS + ' 次（可判到的最小 p=' + PMIN.toFixed(3) + '）· 单位=比特');
  /* 判列只陈述事实（超没超出**自己的**零分布）；"该不该超出"由自检按各对照臂的预期去判 ⇒
   *   免得负对照行上的 ⛔ 被读成"这臂坏了"（它落零内恰恰是我们想要的）。
   * `占其不确定性` = MI / H(动作|桶)：跨臂比 MI 绝对值会被"这臂本身有多爱换招"混掉 ⇒ 这列才是同尺可比的那一列 */
  const verdict = (v, med, p) => (p <= 0.05 ? '✔超出' + (med > 1e-6 ? ' ' + (v / med).toFixed(1) + '×' : '') : '· 落零内');
  console.log('**① 读对手行为**');
  console.log('| 臂 | `MI(A;一手\|桶)` | 占其不确定性 | 零分布 | p | 判 | 桶/格/手 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of rows)
    console.log('| `' + r.k + '` ' + r.name + ' | ' + r.mi.toFixed(4) + ' | **' + (100 * r.frac).toFixed(1) + '%** | ' + r.med.toFixed(4) + ' | ' + r.p.toFixed(3) + ' | ' + verdict(r.mi, r.med, r.p) + ' | ' + r.buckets + '/' + r.cells + '/' + r.n + ' |');
  console.log('\n**② 随环境换策略**（第三列 = 把对手上一手也钉住后**还剩**多少 ⇒ 不是"跟着对手走"的那部分）');
  console.log('| 臂 | `MI(A;环境\|桶)` | 占其不确定性 | 判 | **扣掉一手后** | 判 | 旧尺(不分桶，已废) |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of rows)
    console.log('| `' + r.k + '` ' + r.name + ' | ' + r.miEnv.toFixed(4) + ' | **' + (100 * r.envFrac).toFixed(1) + '%** | ' + verdict(r.miEnv, r.envMed, r.envP)
      + ' | ' + r.miRes.toFixed(4) + ' | ' + verdict(r.miRes, r.resMed, r.resP) + ' | ' + r.divOld.toFixed(4) + ' |');
  /* 标签边际 = 对比度心跳：一个标签吃掉 90% ⇒ 这张桌根本没给"读行为"留对子 */
  const dec0 = RES[band][ARMWANT[0]].dec, lab = {};
  for (const d of dec0) lab[d.l] = (lab[d.l] || 0) + 1;
  const tot = dec0.length, top = Object.entries(lab).sort((a, b) => b[1] - a[1]);
  console.log('> 标签边际（' + ARMWANT[0] + ' · 共 ' + tot + ' 手）：' + top.slice(0, 8).map(([k, v]) => '`' + k + '` ' + (100 * v / tot).toFixed(1) + '%').join(' ‖ ')
    + (top.length && top[0][1] / tot > 0.85 ? ' ⇒ ⚠ 对比度不足，本节读数不许外推' : ' ⇒ 对比度可用'));
  /* 每臂"标签→众数卡"：可读的那一版 */
  console.log('\n| 臂 | ' + top.slice(0, 6).map(([k]) => '`' + k + '` 众数卡(占比)').join(' | ') + ' |');
  console.log('|---|' + top.slice(0, 6).map(() => '---|').join(''));
  for (const k of ARMWANT) {
    const byL = {};
    for (const d of RES[band][k].dec) (byL[d.l] = byL[d.l] || {})[d.a] = ((byL[d.l] || {})[d.a] || 0) + 1;
    console.log('| `' + k + '` | ' + top.slice(0, 6).map(([lk]) => {
      const m = byL[lk] || {}; const ks = Object.entries(m).sort((a, b) => b[1] - a[1]); const t = ks.reduce((a, x) => a + x[1], 0);
      return ks.length ? ks[0][0] + ' (' + (100 * ks[0][1] / t).toFixed(0) + '%)' : '—';
    }).join(' | ') + ' |');
  }
}
/* ---- 自检：不过就 exit 3（尺要能**同时**认得出"读了"和"没读"，且排序不能反）---- */
let bad = [];
for (const band of BANDS) {
  const stat = (k) => { const dec = RES[band][k].dec; const v = mi(dec, getLB, getLAB); const n = permNull(dec, v.mi, REPS, getLB, getLAB); return { mi: v.mi, med: n.med, p: n.p }; };
  const cache = {}; const g = (k) => (cache[k] = cache[k] || stat(k));
  if (ARMWANT.includes('PX2')) {
    const s = g('PX2');
    /* 判据按**量程**校准，不是"必须 =0"：负对照漏出一点点是**桶把状态带粗了**的必然结果，
     *  真正要问的是"漏的那点够不够冒充信号" ⇒ 要求它 ≤ 正对照的 15%。 */
    const ref = ARMWANT.includes('PX') ? g('PX').mi : null;
    const a0 = ARMWANT.includes('A0') ? g('A0').mi : null;
    if (ref !== null && s.mi > 0.15 * ref) {
      const eats = a0 !== null ? '，且已吃掉关档臂信号的 ' + (100 * s.mi / a0).toFixed(0) + '%' : '';
      bad.push('带' + band + '：负对照 `PX2`(只看数值) MI=' + s.mi.toFixed(4) + ' = 量程(' + ref.toFixed(4) + ')的 ' + (100 * s.mi / ref).toFixed(0) + '% > 15% ⇒ "数值冒充行为"的漏够大' + eats + ' ⇒ 先把桶改细再读表');
    } else if (ref !== null) console.log('  （负对照 `PX2` 漏读 ' + (100 * s.mi / ref).toFixed(1) + '% 量程 ⇒ 数值冒充的天花板在这一档）');
  }
  if (ARMWANT.includes('PX')) {
    const s = g('PX');
    if (s.p > 0.05) bad.push('带' + band + '：正对照 `PX`（照"对手上一手"出牌的脚本）MI=' + s.mi.toFixed(4) + ' 落在自己零分布(' + s.med.toFixed(4) + ')内 p=' + s.p.toFixed(3) + ' ⇒ 尺**认不出真读了行为的臂**，本节所有读数作废');
    if (ARMWANT.includes('A0') && !(s.mi > g('A0').mi)) bad.push('带' + band + '：正对照 `PX`(' + s.mi.toFixed(4) + ') 不高于关档臂(' + g('A0').mi.toFixed(4) + ') ⇒ 排序反了，尺不可信');
  }
  if (!isFinite(g('A0').mi)) bad.push('带' + band + '：A0 的 MI 非有限（决策样本没进桶 ⇒ 先看桶刻度，别加局数）');
  /* 分解与量程顶的两道额外自检 */
  const RESID_B = (d) => coarse(d.b) + '|' + d.l;
  if (ARMWANT.includes('PX')) {
    const dec = RES[band].PX.dec; const v = mi(dec, RESID_B, getENV).mi;
    if (v > 0.05) bad.push('带' + band + '：`PX`（一个字都不读环境名）在"扣掉对手一手"之后还剩环境敏感 MI=' + v.toFixed(4) + ' ⇒ 分解项在漏，"扣掉一手后"那一列不可读');
  }
  if (ARMWANT.includes('PX3') && ARMWANT.includes('A0')) {
    const a = mi(RES[band].PX3.dec, getEB, getENV).mi, b0 = mi(RES[band].A0.dec, getEB, getENV).mi;
    if (!(a > b0)) bad.push('带' + band + '：量程顶 `PX3`（每环境固定一张卡）env-MI=' + a.toFixed(4) + ' 不高于关档臂(' + b0.toFixed(4) + ') ⇒ 尺已饱和，"随环境"那一列分不开真假');
  }
}
console.log('\n## 自检');
console.log(bad.length ? '⛔ ' + bad.join('\n⛔ ') : '✔ 全过：负对照 `PX2` 的漏 < 15% 量程、正对照 `PX` 超出自己零分布且高于关档臂、`PX` 在"扣掉一手后"归零（分解不漏）、桶有覆盖');
if (bad.length) process.exit(3);
