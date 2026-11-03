/* tools/probe-diff-ladder.mjs —— 难度阶梯量具（§E286 · v1.6.6 · 只读，不写产物、不阻断）
 *
 * 一问：页面那五档难度（`js/train/bots.js` 的 `DIFF_TIERS`）**真的分级吗**？序在"人数 × 血量"这张格子上会不会翻？
 *
 * 装配（唯一一把尺，全档共用）：**1 席人类形状替身 vs (N-1) 席同一档 AI**，替身的座位逐局轮转（不恒占 0 号座）。
 *   替身 = `tools/human-pool.mjs` 的 `makeMimic`（§E155/§E157/§E168 共用的那一份：56 局真人日志的条件分布，
 *          ⚠ 粗模型，"人类这种打法"的代理，不是真人）
 *   AI 席 = 与页面**同一处调用**：`Trainer.pickChampion(state, pid, legal, params, temp=0.15, eps, epsK, epsMode)`，
 *          剂量四元组直接来自 `DIFF_TIERS`（本工具**不抄第二份表**）；风格档走 `ui.js` 那一行的
 *          `Trainer.wrapBigTPush(style.pick)` ⇒ 上线档的大雷/摄魂注入也在场。
 *   对局循环 = 引擎的 `Play.autoGameN`（珠启发式与页面同口径）。
 * 配对：所有档用**同一批种子**（局 rng 与替身 rng 各自同序）⇒ 跨档的夺冠率差是逐局配对的，一并印 95% CI。
 *
 * 用法：node tools/probe-diff-ladder.mjs [--tiers=lv:hard,lv:regular] [--games=1500] [--n=5] [--mode=multi]
 *       [--pack=auto|2p|3p] [--seed=77000] [--tgt=rand|next] [--extra=eps:epsK:mode,...] [--quiet]
 *       [--machine=1 --minGap=2 --except=lv:hard>lv:regular]   （门用的判定档，判据见文件末尾）
 *   `--pack=auto`（默认）= 按页面规则选包（人数=2 ⇒ 2P 那颗；≥3 ⇒ 3P 那颗），所以量的是**玩家真会遇到的那一颗**。
 *   `--extra=` 是给研究用的额外剂量行（不参与"阶梯分级"的判定），格式 `eps:epsK:mode`，逗号分隔多组。
 *   §E610/611 三个**研究视图**旗标（都只在进程内生效、都不落盘，表头必须印 `# ⚑` 或 `# 掺席 =` 自证）：
 *     `--pooltier=<带>` 把所有档钉在同一批成员（连带关掉按带加权与掺席）‖
 *     `--mixseats=<N>` 把声明了 `scriptMix` 的那档盖成 N 席脚本（`0` = 回到 S10 之前那台机器，做闭合检查用）‖
 *     `--epsover=<id>><值>` 覆盖某档的常数 ε（分隔符是 `>` 不是 `=` —— `flag()` 用 `split('=')[1]`，值里带 `=` 会被截断，
 *       10-15 冒烟实测过；`ramp:true` 的档直接拒绝，因为它的 ε 由 `tierEps` 按回合给）。
 *     ⚠ 用这三个旗标量出来的读数**不是产品口径**，不许进在册账（`sigOf` 也不覆盖它们 —— 那正是设计：账只绑产品形状）。
 *
 * ⚠ 引用它的读数必须带四样（§E272/第 45 条）：**装配（人数 × 血量）+ 用哪颗包 + 替身是模型不是真人 + 这是绝对电平不是配对差**。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { sandbox, mulberry32, ROOT, extractJsonObject, rejectUnknownFlags, loadChamp } from './audit-lib.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';
import { loadChampParams } from '../server/opp-champs.mjs';

/* 仓规（门 D218）：不认识的 `--` 旗标必须**响亮失败** —— 静默忽略会让"我以为控制住了这个变量"变成假读数。 */
rejectUnknownFlags(process.argv.slice(2), ['tiers', 'games', 'n', 'mode', 'pack', 'seed', 'tgt', 'extra',
  'quiet', 'machine', 'minGap', 'except', 'exceptMin', 'pool', 'pooltier', 'pairs', 'banddef',
  'mixseats', 'mixids', 'mixadd', 'epsover', 'livedose', 'breakbank', 'breakfirst'], 'probe-diff-ladder');

const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const GAMES = Math.max(1, Number(flag('games', 1500)) || 1500);
const N = Math.max(2, Number(flag('n', 5)) || 5);
const MODE = flag('mode', 'multi');
const SEED = Number(flag('seed', 77000));
const TGT = flag('tgt', 'rand');
const PACK = flag('pack', 'auto');
const ONLY = (flag('tiers', '') || '').split(',').filter(Boolean);
const QUIET = process.argv.includes('--quiet');
const machine = (flag('machine', '0') || '0') === '1';

const W = sandbox(ROOT);
const R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, Bots = W.EpirusBots, T = W.EpirusTrainer;
const POOL = W.EpirusPolicy;
const BREAK_BANK = Number(flag('breakbank', '5'));
if (Bots.setBreakBank) Bots.setBreakBank(BREAK_BANK);
if (Bots.setBreakFirst) Bots.setBreakFirst(flag('breakfirst', '1') !== '0');
const params3p = loadChampParams(POOL, join(ROOT, 'js/bundled-champion-3p.js'));
/* §E588（千问 10-11）：`--pack=<相对路径>` —— 让这把尺能指到**钉住的某一枚**。
 *   理由与 `duel-run --ref=` 同一件事：`auto` 指的是活槽，而活槽会换主人 ⇒
 *   v1.6.62 换包之后"相邻难度档分不开"到底是**阶梯的剂量坏了**还是**新包把电平压平了**，只有能点名才判得出来。 */
const paramsCustom = (PACK !== 'auto' && PACK !== '2p' && PACK !== '3p')
  ? (function () {
      const f = isAbsolute(PACK) ? PACK : join(ROOT, PACK);
      if (!existsSync(f)) { console.error('⛔ --pack=' + PACK + ' 不在盘上（`auto|2p|3p` 之外的值一律当**路径**处理）'); process.exit(2); }
      /* §E677：这里原来走 `opp-champs.loadChampParams` —— 它**只认 3P 外壳**（缺 EPIRUS_CHAMPION_3P 就抛），
       *   于是 2P 池那 9 枚（2P 外壳 / .bak）一把都量不了。改用 `audit-lib.loadChamp`：它 v1.5.171 起就是
       *   双格式（3P 外壳缺席才退回 2P 外壳，且避开 _META），与 `champ-audit` 同一个读取口。
       *   ⚑ 只改**这把尺**，不动 `server/opp-champs.mjs` —— 那条路是训练侧 `champ:` 对手的入口，
       *   放宽它等于让以前被拒的 2P 格式包能上训练桌，那是另一件事（要用户点名）。 */
      const pc = loadChamp(W, f);
      if (!pc) { console.error('⛔ --pack=' + PACK + ' 两种外壳都解不开（既不是 EPIRUS_CHAMPION_3P 也不是 EPIRUS_CHAMPION）⇒ 拒绝，不许静默换包'); process.exit(2); }
      return pc;
    })()
  : null;
let params2p = null;
try {
  const j2 = extractJsonObject(readFileSync(join(ROOT, 'js/bundled-champion.js'), 'utf8'), 'window.EPIRUS_CHAMPION', '_META');
  if (j2) params2p = POOL.unpack(JSON.parse(j2), true) || null;
} catch (e) { params2p = null; }

/* 档位 = `DIFF_TIERS` 本身（单一来源）。`--pack=` 只影响"用哪颗包"，不改档定义。 */
let LEVELS = (Bots.DIFF_TIERS || []).slice();
if (ONLY.length) LEVELS = LEVELS.filter(t => ONLY.indexOf(t.id) >= 0);
if (ONLY.length && !LEVELS.length) { console.error('⛔ --tiers 一个都没匹配上（在册：' + (Bots.DIFF_TIERS || []).map(t => t.id).join(',') + '）'); process.exit(2); }
/* §E611 研究旗标 `--epsover=<id>><值>[;<id>><值>…]`：**不落盘**地量一档的剂量（与 `--banddef=` 同族，只在这把尺的进程里生效）。
 *   为什么要它而不是改 `bots.js`：改源码做变异会同时踩两条现成的线（`D153` 钉斜坡字面 ‖ `D227`②c 钉默认档口径），
 *   而且 10-12 那条"变异实验不许与同机批量并发"的账还在（那次把 113/121 臂记废）。⇒ 剂量这种"给待裁附数据"的量法应该在量具侧。
 *   ⚠ 分隔符用 `>`（照 `--except=a>b` 那一条的既有做法），**不用 `=`**：量具的 `flag()` 是 `split('=')[1]`，
 *   值里再带 `=` 会被截成半截（10-15 冒烟实测：`--epsover=lv:sparring=0.5` 只拿到 `lv:sparring` ⇒ 当场按"形状不对"拒绝，没有静默跑错）。
 *   ⚠ 这是**研究视图**：印在表头，读数不许当成产品口径引用；`ramp:true` 的档不适用（它的 ε 由 `tierEps` 按回合给，常数覆盖没有所指 ⇒ 响亮拒绝）。 */
const EPSON = {};
String(flag('epsover', '') || '').split(';').filter(Boolean).forEach(function (kv) {
  const i = kv.indexOf('>'); if (i < 1) { console.error('⛔ --epsover 的形状是 <档id>><值>（分号分隔多个），收到：' + kv); process.exit(2); }
  const id = kv.slice(0, i).trim(), v = Number(kv.slice(i + 1));
  if (!isFinite(v) || v < 0 || v > 1) { console.error('⛔ --epsover 的值必须是 0~1 的常数 ε，收到：' + kv); process.exit(2); }
  EPSON[id] = v;
});
if (Object.keys(EPSON).length) {
  LEVELS = LEVELS.map(function (t) {
    if (EPSON[t.id] === undefined) return t;
    if (t.ramp) { console.error('⛔ --epsover 不能覆盖 ' + t.id + '：它是 `ramp:true`（ε 由 `tierEps` 按回合给），常数覆盖没有所指'); process.exit(2); }
    const c = Object.assign({}, t); c.eps = EPSON[t.id]; return c;   /* 浅拷贝 ⇒ 绝不改到 `Bots.DIFF_TIERS` 本体 */
  });
  console.log('# ⚑ 研究视图 --epsover = ' + Object.keys(EPSON).map(k => k + '→ε' + EPSON[k]).join(' ‖ ') + '（产品档位表没动；读数别当产品口径引用）');
}
/* 研究用的额外剂量行（不参与分级判定，只在标签上标 [extra]） */
String(flag('extra', '') || '').split(',').filter(Boolean).forEach(function (spec) {
  const p = spec.split(':');
  if (p.length < 2) return;
  LEVELS.push({
    id: 'x:' + spec, name: '[extra] ε=' + p[0] + '/k' + p[1] + (p[2] ? '/' + p[2] : '') + (p[3] === 'ramp' ? '+回合斜坡' : ''),
    kind: 'champ', eps: Number(p[0]), epsK: Number(p[1]), epsMode: p[2] || 'soft', ramp: p[3] === 'ramp'
  });
});

function affordableFirst(legal) {
  const base = (legal || []).filter(l => l && l.affordable);
  return base.length ? base : [{ key: R.SK.JI, affordable: true }];
}
/* 2 人桌换包的理由见 `DIFF_TIERS` 上面那段（§E286 实测：3P 那颗在 1v1 上是分布外的，剂量梯还反号）。 */
function packFor(n) {
  if (paramsCustom) return { p: paramsCustom, tag: PACK.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, '') };
  if (PACK === '3p') return { p: params3p, tag: '3P' };
  if (PACK === '2p') return { p: params2p || params3p, tag: params2p ? '2P' : '3P(2P 槽缺失)' };
  if (n > 2) return { p: params3p, tag: '3P' };
  return { p: params2p || params3p, tag: params2p ? '2P' : '3P(2P 槽缺失)' };
}
const pk = packFor(N);
if (!pk.p) { console.error('⛔ 冠军包解不开（2P/3P 都不兼容）⇒ 这把尺没有所指'); process.exit(2); }
const humanPool = loadPool(W, 'human');   // 读一次文件（每局重读会把仪器自己变成 I/O 瓶颈）

function makeScriptChooser(styleId) {
  /* §E610：这一席是档声明的**脚本席**（`DIFF_TIERS[].scriptMix`，§E600-B 起简单档有 2 席）。
   *   口径照 `js/ui/ui.js:442-446` + `:720`：给脚本自己的 `pick`，并与风格档同一条 `wrapBigTPush` 包一层（上线档的大雷/摄魂注入也在场）。
   *   原来量具**根本没有这条路**：`compose(..., null, ...)` 把掺席硬关掉，于是每个 AI 席都领一枚包 ⇒
   *   简单档量的是"四席全池包"，不是产品那张"两席软带 + 两席脚本"（v1.7.22 之后查明，见本日志 S10）。 */
  const st = (Bots.STYLES || []).find(x => x.id === styleId);
  if (!st) { console.error('⛔ 脚本席的风格不在册: ' + styleId + ' ⇒ 量具不许自己退回单包（产品侧会退回并说出来，那是另一件事）'); process.exit(2); }
  const wrapped = T.wrapBigTPush(st.pick);
  return function (state, pid, legal) { return wrapped(state, pid, legal); };
}

function makeLevelChooser(L, p) {
  if (L.kind === 'style') {
    const st = (Bots.STYLES || []).find(x => x.id === L.style);
    if (!st) { console.error('⛔ 风格不在册: ' + L.style); process.exit(2); }
    const wrapped = T.wrapBigTPush(st.pick);
    return function (state, pid, legal) { return wrapped(state, pid, legal); };
  }
  return function (state, pid, legal) {
    /* ★ 斜坡的字面值**不在这里**，在 `js/train/bots.js` 的 `tierEps(tier, round)` —— 本工具与页面共用那一份。
     *   原来这里抄了一份，而 D153 只钉 ui.js 那份（下面的旧注释写的正是"这里改了不响门"），
     *   10-12 下午顶点 0.2→0.1 之后就真的漂了：页面是 0/0.05/0.1，这份还是 0/0.1/0.1 ⇒ b5ceab1 的在册账量的是不存在的剂量。
     * ★ §E625：这里改成走 `tierEpsAt`（带人数）—— 原来这把尺在 2 人桌上直接吃 `tier.eps`，
     *   而产品那里吃的是 `tier.eps2`（简单 0.5 ‖ 困难 0）⇒ 它量的是**产品不喂的那份剂量**。同一族病，同一处治。 */
    let e = Bots.tierEpsAt(L, state.p.length, state.round);
    /* §E679 研究旋钮（10-22 夜·千问）：只在**这把尺**里生效，产品与出厂路径一字不动。
     *   `--livedose=behind:<a>` ⇒ 按"这一席现在的血量份额"放大剂量：e' = clamp(e*(1+a*need), 0, 1)。
     *   为什么值得单开一格：`tierEpsAt` 在册只条件在（档, 人数, 回合），从没条件在局面量上。
     *   机制回执必须可见：DOSE 累计每次实际生效的 e，随读数打印均值 —— 两组均值一样就是条件化没落地。 */
    if (!DOSE[L.id]) DOSE[L.id] = { sum: 0, n: 0 };
    if (LIVE_DOSE) {
      const me = state.p[pid];
      const alive = state.p.filter(function (q) { return q.hp > 0; });
      const best = alive.length ? Math.max.apply(null, alive.map(function (q) { return q.hp; })) : 1;
      const need = best > 0 ? Math.max(0, Math.min(1, 1 - (me ? me.hp : 0) / best)) : 0;
      e = Math.max(0, Math.min(1, e * (1 + LIVE_DOSE.a * need)));
    }
    DOSE[L.id].sum += e; DOSE[L.id].n++;
    return T.pickChampion(state, pid, affordableFirst(legal), p, 0.15, e, L.epsK, L.epsMode);
  };
}
/* ===== §E590 `--pool=1`：让这把尺指到**池形态的产品**上 =====
 *   为什么要加这一档（不是"再给旧门加腿"）：v1.6.63 起 ≥3 人桌的四个 AI 席**逐席各抽一枚**，
 *   而默认态这把尺给所有 AI 席喂的是同一颗 `pk.p` ⇒ 它量的是"剂量阶梯"在一种已经不存在的装配上的表现。
 *   台账 `docs/GATE-SHIFTS.md` §十九 把 `D227`④ 的"主语漂移"登记成等裁，这一档就是裁之前先把数拿到手。
 *   口径：组成 = `js/pool-draw.js` 的 `compose(该档成员, N-1, rng(state.slotSalt))` —— **与页面同一份实现、同一个盐**
 *   （`st.slotSalt` 由本工具自己的 rng 逐局给，同 seed 同局序 ⇒ 跨档仍是逐局配对的，配对性质没丢）。
 *   风格档（`lv:hunter`）按契约 §3 **不带包**，两种模式下行为一致。 */
/* §E679 研究旋钮：`--livedose=behind:<a>`（不传 = 关 ⇒ 行为与旧版逐位相同）‖ DOSE = 机制回执的累计器 */
const LIVE_DOSE = (function () {
  const v = flag('livedose', ''); if (!v) return null;
  const m = /^(behind):([0-9.]+)$/.exec(v);
  if (!m) { console.error('⛔ --livedose 只认 behind:<a>（实测 ' + v + '）'); process.exit(64); }
  return { kind: m[1], a: Number(m[2]) };
})();
const DOSE = {};
const USE_POOL = (flag('pool', '0') || '0') === '1';
const POOL_TIER = (flag('pooltier', '') || '').trim();   /* 非空 = 把所有档钉在**同一批池成员**上 ⇒ 档间只剩剂量差 */
const PD = W.EpirusPoolDraw;
const POOL_BY_TIER = {}, MEMBER_P = {};
/* §E609 全表（= 各带并起来的那份），**必须在 --banddef 覆盖之后**重算：
 *   先算好再覆盖会让 `rosterFor` 看到的是旧形状 ⇒ 临时视图被静默忽略（昨天"banddef 没生效却量成现表"的反方向同款）。 */
let ALL_POOL_M = [];
const MIX_OF = {};   /* §E610 档 → 掺席（`scriptSeats` 的产出）；单包/钉成员模式下是空的 ⇒ compose 不盖席 */
const LADDER_NOTED = {};
if (POOL_TIER && !USE_POOL) { console.error('⛔ --pooltier= 只在 --pool=1 下有意义（单包装配没有"档到池"的映射可钉）'); process.exit(2); }
if (USE_POOL) {
  if (!PD || typeof PD.compose !== 'function') { console.error('⛔ js/pool-draw.js 没进 sandbox 的 CORE 名单 ⇒ 池模式没有抽签实现，只能退回单包'); process.exit(2); }
  const PT = join(ROOT, N > 2 ? 'champion-map/pool-members.tsv' : 'champion-map/pool-members-2p.tsv');
  /* §E609：`--n=2 --pool=1` 以前**根本走不到这里**（下面那句装配判定写死 N>2）⇒ 2 人桌的三档从来没有一条池装配读数。
   *   补上之后按人数选表：2 人桌用的是 2P 原生那份（`pool-members-2p.tsv`，§E599 的裁定），不是把 3P 池搬过去。 */
  if (!existsSync(PT)) { console.error('⛔ 池真源表不在：' + PT + '（先跑 tools/pool-add.mjs）'); process.exit(2); }
  console.log('# 池真源表 = ' + (N > 2 ? 'champion-map/pool-members.tsv（多人桌）' : 'champion-map/pool-members-2p.tsv（2 人桌，§E599 那份原生池）'));
  const PL = readFileSync(PT, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  const ph = Object.fromEntries(PL[0].split('\t').map((x, i) => [x, i]));
  /* §E609 解包：多人包的全局名是 `EPIRUS_CHAMPION_3P`，2P 原生那份是 `EPIRUS_CHAMPION`（`loadChampParams` 只认前者
   *   ⇒ 直接拿它读 2P 的 .bak 会"全部解不开"，而那看起来像池坏了、其实是量具不认形状）。
   *   两种都走 `EpirusPolicy.unpack(obj, true)` —— 与页面 `ui.js:loadPoolOf` 同一个入口、同一个 allowLegacy。 */
  function loadPoolPack(file) {
    const src = readFileSync(file, 'utf8');
    let m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
    if (!m) m = src.match(/window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/);
    return m ? POOL.unpack(JSON.parse(m[1]), true) : null;
  }
  for (const l of PL.slice(1)) { const c = l.split('\t'); if (!c[ph.id]) continue;
    const tier = c[ph.tier];
    let p = null;
    try { p = loadPoolPack(join(ROOT, c[ph.path])); } catch (e) { p = null; }
    if (!p) { console.error('⛔ 池成员 ' + c[ph.id] + ' 的包解不开（' + c[ph.path] + '）⇒ 按失败处理，不许少一席继续量'); process.exit(7); }
    MEMBER_P[c[ph.id]] = p;
    (POOL_BY_TIER[tier] = POOL_BY_TIER[tier] || []).push({ id: c[ph.id], wid: c[ph.wid], tier: tier });
  }
  console.log('# 装配 = **池形态**（逐席不同枚，真源 ' + (N > 2 ? 'champion-map/pool-members.tsv' : 'champion-map/pool-members-2p.tsv') + '）：' +
    Object.keys(POOL_BY_TIER).map(t => t + ' ' + POOL_BY_TIER[t].length + ' 枚').join(' ‖ '));
  /* §E595 `--banddef="A:id1,id2;B:id3,..."`：**不落盘**地量一种分带。
   *   ⚠ 分隔符是 `:` 不是 `=`（这句 10-15 才订正 —— 原来这里写的是 `A=id1,id2`，而本文件的 `flag()` 是 `split('=')[1]`，
   *   值里再带 `=` 会被截断；下面的解析用的就是 `indexOf(':')`）。形状写错不会静默跑错：`ids` 为空 ⇒ 当场"带是空的"退出 2。
   *   为什么要它：搜分带时每一次评估都要量"这一带组出来的桌有多硬"，而改真源表再改回来 = 把没验过的划分
   *   在盘上留一分钟（还会被 `D234` 的 bundle 一致腿咬）。名单里的 id 必须已在池表里（要解得出包）。
   *   ⚠ 这是**量具的临时视图**，不是产品口径：要用它选出的划分上线，得把 tier 写回 `pool-members.tsv` 并重烘 bundle。 */
  const BANDDEF = (flag('banddef', '') || '').trim();
  if (BANDDEF) {
    const ALL_M = {};
    for (const t of Object.keys(POOL_BY_TIER)) for (const m of POOL_BY_TIER[t]) ALL_M[m.id] = m;
    const NB = {};
    for (const seg of BANDDEF.split(';')) { if (!seg.trim()) continue;
      const ci = seg.indexOf(':'); const nm = (ci < 0 ? seg : seg.slice(0, ci)).trim();
      const ids = (ci < 0 ? '' : seg.slice(ci + 1)).split(',').map(x => x.trim()).filter(Boolean);
      const bad = ids.filter(i => !ALL_M[i]);
      if (bad.length) { console.error('⛔ --banddef 的 `' + nm + '` 带里这几个 id 不在池表（解不出包）：' + bad.join(',')); process.exit(2); }
      if (!ids.length) { console.error('⛔ --banddef 的 `' + nm + '` 带是空的'); process.exit(2); }
      NB[nm] = ids.map(i => ({ id: i, wid: ALL_M[i].wid, tier: nm })); }
    /* ⚠ **整张换掉**，不是逐带合并（10-15 冒烟实测抓到的：原来那句 `for (k of NB) POOL_BY_TIER[k] = NB[k]` 留着没声明的 `mid` 带 ⇒
     *   拿 `--banddef` 量"拆带"时 `rosterFor` 照旧走 `else:'mid'` 退路，而表头印的是 `hard 4 ‖ soft 3` ⇒
     *   "我在量两带混抽"与"其实量的是退路"这两件事同屏出现（那跑的全表数是 **10 枚** = 声明的 7 + 残留的 3，一眼就该报警）。
     *   拆带这种划分必须能把旧带**拿掉**才量得到 ⇒ 整张替换；同时要求名单覆盖表里每一枚，否则未声明的成员会静默消失。 */
    const placed = {}; for (const t of Object.keys(NB)) for (const m of NB[t]) placed[m.id] = true;
    const left = Object.keys(ALL_M).filter(i => !placed[i]);
    if (left.length) { console.error('⛔ --banddef 没给这几枚分带：' + left.join(',') +
      ' ⇒ 未声明的成员会静默消失（要么分给某个带，要么把整张表分完）'); process.exit(2); }
    for (const k of Object.keys(POOL_BY_TIER)) delete POOL_BY_TIER[k];
    for (const k of Object.keys(NB)) POOL_BY_TIER[k] = NB[k];
    console.log('# --banddef 生效（临时视图，表没动 ‖ 旧带整张替换 ⇒ 全表 ' + Object.keys(placed).length + ' 枚）：' +
      Object.keys(NB).map(t => t + ' ' + NB[t].length + ' 枚').join(' ‖ '));
  }
  /* §E609 全表重算（banddef 之后）+ **把每一档实际走哪条抽法说出来**：
   *   这一行就是昨天那条教训的正面版本 —— 不看它，"我以为在量临时视图/混抽"和"其实量的是别的"长得一模一样。 */
  ALL_POOL_M = [];
  for (const t of Object.keys(POOL_BY_TIER)) for (const m of POOL_BY_TIER[t]) ALL_POOL_M.push(m);
  console.log('# 抽法推导 = rosterFor(全表 ' + ALL_POOL_M.length + ' 枚)' + (POOL_TIER ? ' ‖ 但 --pooltier=' + POOL_TIER + ' 把所有档钉在同一批成员上 ⇒ 加权关掉' : '') + '：' +
    LEVELS.filter(l => l.kind === 'champ').map(l0 => { const R0 = PD.rosterFor(ALL_POOL_M, l0);
      return l0.id + '=' + (POOL_TIER ? '钉在 ' + POOL_TIER : (R0.bandW ? '按带加权 ' + Object.keys(R0.bandW).filter(x => x !== 'else').join('/')
        : (R0.note ? '退路→' + l0.pool + '(' + R0.members.length + ' 枚)' : '单带 ' + l0.pool + '(' + R0.members.length + ' 枚)'))); }).join(' ‖ '));
  /* §E610：**掺席必须进装配**。档声明的 `scriptMix`（§E600-B 起简单档有 2 席启发式脚本）原来在这把尺里完全不存在 ——
   *   `compose(..., null, ...)` 把第 4 参硬关掉，于是简单档量的是"四席全池包"，而玩家点到的桌是"两席软带 + 两席脚本"。
   *   推导仍然只有 `js/pool-draw.js` 的 `scriptSeats` 这一份（页面 `ui.js:422` 调的是同一个函数），这里不抄第二套掺席规则。
   *   ⚠ `--pooltier=` 那条研究口径下**一并关掉并说出来**：它本来就把按带加权关掉、要的是"档间只剩剂量差"，
   *   而掺席是档的第二根轴不是带 ⇒ 留着它那句"只剩剂量"就成了假话（这与 §E609 那次"banddef 没生效却量成现表"是同一族自证）。 */
  if (POOL_TIER) {
    console.log('# 掺席 = **关掉**（--pooltier=' + POOL_TIER + ' 钉成员时一并关，否则"档间只剩剂量差"这句不成立）');
  } else {
    for (const lm of LEVELS) {
      const mx = (typeof PD.scriptSeats === 'function') ? PD.scriptSeats(lm, N - 1, Bots.STYLES) : null;
      if (mx && mx.seats) MIX_OF[lm.id] = mx;
      if (mx && mx.note) console.log('#   掺席降级 ' + lm.id + '：' + mx.note);
    }
    /* 10-21 研究旗标 --mixadd=<档id>><席数>><id1,id2>：给**本来不掺席**的档临时加一份 scriptMix（研究视图）。
     *   用途 = 量「杂货铺进普通档」要几席/什么权重；产品档位表不动。席数会被 (N-1)-1 与 ids 长度封顶（与产品 scriptSeats 同 caps）。 */
    const MA = flag('mixadd', '');
    if (MA !== '') {
      const parts = MA.split('>');
      if (parts.length !== 3) { console.error('⛔ --mixadd 的形状是 <档id>><席数>><id1,id2>，收到：' + MA); process.exit(2); }
      const tid = parts[0].trim(), spec = parts[1].trim();
      if (!LEVELS.some(l => l.id === tid && l.kind === 'champ')) { console.error('⛔ --mixadd 的档不在册或不是冠军档：' + tid); process.exit(2); }
      /* 第二段：整数 = 固定席数；`p0.8:2` = 概率掺（这一桌有 0.8 概率整组掺 2 席）。
       *   `p` 后面可跟 `:seats`（缺省 1）。不能写 `p=0.8`：flag() 是 split('=')[1]，值里的 = 会被截断（同 --epsover 的坑）。 */
      const sp = spec.split(':');
      const isP = sp[0].charAt(0) === 'p' && sp[0].length > 1;
      const want = Number(isP ? sp[0].slice(1) : spec);
      const pSeats = isP ? Math.max(1, Number(sp[1] || 1)) : 0;
      if (!isFinite(want) || want < 0 || (isP && want > 1) || (isP && !Number.isInteger(pSeats))) { console.error('⛔ --mixadd 的第二段要么是非负整数席数、要么是 p0~1[:席数]，收到：' + spec); process.exit(2); }
      const ids = parts[2].split(',').filter(Boolean);
      const known = {}; (Bots.STYLES || []).forEach(s => { known[s.id] = 1; });
      const badId = ids.filter(x => !known[x]);
      if (!ids.length || badId.length) { console.error('⛔ --mixadd 里有不认识的风格 id：' + (badId.join(',') || '(空)') + '（在册：' + Object.keys(known).join(' ') + '）'); process.exit(2); }
      if (isP) {
        if (want > 0) MIX_OF[tid] = { p: want, seats: pSeats, min: 1, ids: ids };
        else delete MIX_OF[tid];   /* p0 = 显式关掉这一档的脚本席（覆盖产品配置） */
        console.log('# ⚑ 研究视图 --mixadd = ' + tid + '→p=' + want + '/s' + pSeats + '[' + ids.join(',') + ']（产品档位表没动；这一臂不是产品口径）');
      } else {
        const eff = Math.min(want, (N - 1) - 1, ids.length);
        if (eff > 0) MIX_OF[tid] = { seats: eff, ids: ids };
        else delete MIX_OF[tid];
        console.log('# ⚑ 研究视图 --mixadd = ' + tid + '→' + eff + ' 席[' + ids.join(',') + ']（产品档位表没动；这一臂不是产品口径）');
      }
    }
    /* §E611 研究旗标 `--mixseats=<N>`：把声明了 `scriptMix` 的那档**盖成 N 席**（同 `--banddef` 那族"不落盘量一种形状"）。
     *   `N=0` 就是"S10 之前那台机器"⇒ 用来做**闭合检查**：这一臂若复现 `recheck/` 那批（简单 17.66 ‖ 20.27），
     *   才证明"台阶塌掉是那两席脚本造成的"这句因果；不复现就说明还有别的层不一样，S10 的结论要降级为"未闭合"。 */
    /* §E612 研究旗标 `--mixids=<a,b>`：把掺进来的那几席**换成指定的风格**（待裁 #27 的选项①"换脚本"需要这条）。
     *   认不出来的 id 当场拒绝（产品的 `scriptSeats` 会"跳过并说出来"，但那是产品口径；研究臂里静默跳过会量成一桌别的东西）。 */
    const MI = flag('mixids', '');
    if (MI !== '') {
      const ids = MI.split(',').filter(Boolean);
      const known = {}; (Bots.STYLES || []).forEach(s => { known[s.id] = 1; });
      const bad = ids.filter(x => !known[x]);
      if (!ids.length || bad.length) { console.error('⛔ --mixids 里有不认识的风格 id：' + (bad.join(',') || '(空)') +
        '（在册：' + Object.keys(known).join(' ') + '）⇒ 拒绝，不许静默跳过后量成一桌别的东西'); process.exit(2); }
      for (const k of Object.keys(MIX_OF)) { MIX_OF[k] = Object.assign({}, MIX_OF[k]); MIX_OF[k].ids = ids; }
      console.log('# ⚑ 研究视图 --mixids = ' + ids.join('+') + '（产品档位表没动；这一臂不是产品口径）');
    }
    const MS = flag('mixseats', '');
    if (MS !== '') {
      const want = Number(MS);
      if (!isFinite(want) || want < 0) { console.error('⛔ --mixseats 必须是非负整数，收到：' + MS); process.exit(2); }
      for (const k of Object.keys(MIX_OF)) {
        if (want === 0) { delete MIX_OF[k]; continue; }
        const ids = MIX_OF[k].ids;
        MIX_OF[k] = { seats: Math.min(want, (N - 1) - 1), ids: ids };
      }
      console.log('# ⚑ 研究视图 --mixseats = ' + want + '（产品档位表没动；这一臂不是产品口径）');
    }
    console.log('# 掺席 = ' + LEVELS.filter(l1 => l1.kind === 'champ')
      .map(l1 => { const m = MIX_OF[l1.id]; return l1.id + '=' + (m ? (typeof m.p === 'number' ? ('p=' + m.p + '[' + m.ids.join(',') + ']') : (m.seats + ' 席[' + m.ids.join(',') + ']')) : '0 席'); }).join(' ‖ ') +
      '（与页面 `scriptSeats` 同一份推导；2 人桌只有 1 席 AI ⇒ 必然是 0 席）');
  }
}

const win = {}, rows = [];
const t0 = Date.now();
for (const L of LEVELS) win[L.id] = [];
for (const L of LEVELS) {
  const chooser = makeLevelChooser(L, pk.p);
  let sumR = 0, bigT = 0, drain = 0, wins = 0;
  for (let g = 0; g < GAMES; g++) {
    const rng = mulberry32(SEED + g * 7919);
    const mrng = mulberry32(SEED + 555 + g * 104729);
    const st = S.createState(MODE, { next: rng }, N);
    st.slotSalt = (Math.floor(rng() * 4294967296)) >>> 0;
    const refSeat = g % N;
    const mimic = makeMimic(W, humanPool, TGT, mrng);
    /* 池形态：每局按 `state.slotSalt` 抽一次组成（与页面同一份 `compose`），AI 席按 pid 升序领第 0..n-1 枚 ——
     *   这条顺序与 `js/pool-draw.js` 末尾那句"席位号按升序领"以及 `ui.js` 的 `champForSeat` 同源，不许在这儿另排一次。 */
    let comp = null, seatK = 0;
    if (USE_POOL && L.kind !== 'style') {
      /* §E609：去掉原来那句 `&& N > 2` —— 它把"2 人桌的池装配"整条路关掉了，于是产品卖给 2 人桌的三档
         从来没有一条池装配读数（当时 `docs/debug/tier-census.mjs` 也是 5 席循环 ⇒ 两把尺都是盲区）。
         ⚑ §E624（10-15）把另一侧也补上了：`tier-census --n=2` 现在走**同一份** `duelAssembly`（那里加了默认的 `n` 维）
         ⇒ "台阶分不分得开"与"这一档实际在打什么谱"两条读数在 2 人桌上都第一次存在。
         现在 2 人桌走 `pool-members-2p.tsv`，只有 1 席 AI ⇒ "全同"在那儿是数学必然而不是降级
         （产品侧 `ui.js` 早就是 `d.allSame && !plan.two` 才警告，这里跟它同一个口径）。
         `--pooltier=` 仍可用：把所有档钉在**同一批池成员**上 ⇒ 档间只剩剂量差，剂量阶梯本身被单独量到
         （不钉时档差混着"抽哪一批包"，见 docs/GATE-SHIFTS.md §十九 那句主语漂移）。 */
      const mem = POOL_TIER ? (POOL_BY_TIER[POOL_TIER] || []) : PD.rosterFor(ALL_POOL_M, L).members;
      const bandW = POOL_TIER ? null : PD.rosterFor(ALL_POOL_M, L).bandW;
      const need = N > 2 ? 2 : 1;
      if (mem.length < need) { console.error('⛔ 档 ' + L.id + ' 的池只有 ' + mem.length + ' 枚（这一桌要至少 ' + need + ' 枚）' +
        ' ⇒ ' + (need > 1 ? '抽签在数学上必然全同（契约 §3）' : '池是空的') + ' ⇒ 这一档还没成型，别拿池模式量它'); process.exit(2); }
      comp = PD.compose(mem, N - 1, PD.rng(st.slotSalt >>> 0), MIX_OF[L.id], bandW);
      if (comp.allSame && N - 1 > 1) { console.error('⛔ 池模式抽出四席全同（' + L.id + ' · salt=' + st.slotSalt + '）⇒ 违反裁定③，本行读数作废'); process.exit(2); }
    }
    const cs = [];
    for (let pid = 0; pid < N; pid++) {
      if (pid === refSeat) { cs.push(mimic); continue; }
      if (comp) { const s = comp.seats[seatK++]; cs.push(s.kind === 'script' ? makeScriptChooser(s.id) : makeLevelChooser(L, MEMBER_P[s.id])); }
      else cs.push(chooser);
    }
    Play.autoGameN(st, cs);
    win[L.id].push(st.winner === refSeat ? 1 : 0);
    if (st.winner === refSeat) wins++;
    sumR += st.round;
    for (const e of st.events) {
      if (e.type !== 'action' || e.outcome !== 'ok') continue;
      if (e.key === R.SK.BIG_T) bigT++; else if (e.key === R.SK.DRAIN) drain++;
    }
  }
  const dz = DOSE[L.id] && DOSE[L.id].n ? DOSE[L.id].sum / DOSE[L.id].n : null;
  rows.push({ id: L.id, label: L.name, pct: 100 * wins / GAMES, avgR: sumR / GAMES, bigT: bigT / GAMES, drain: drain / GAMES, dose: dz, doseN: DOSE[L.id] ? DOSE[L.id].n : 0 });
}
function pairedDiff(a, b) {
  const A = win[a], B = win[b], d = [];
  const m = Math.min(A.length, B.length);
  for (let i = 0; i < m; i++) d.push(A[i] - B[i]);
  if (!m) return null;
  const mean = d.reduce((s, x) => s + x, 0) / m;
  let v = 0; for (const x of d) v += (x - mean) * (x - mean);
  const se = Math.sqrt(v / Math.max(1, m - 1) / m);
  /* ⚠ `ci` 是 **95% 区间 = 1.96σ**，不是 1σ。10-12 有过一次把 `±ci` 当 1σ 去除差 ⇒ 把 t 值系统性压低 1.96 倍
   *   （"入门/普通 0.9σ"其实是 2.6σ）。这里把 se 一起带出去，打印处两个都印，别让下一个人再猜。 */
  return { m: 100 * mean, ci: 100 * 1.96 * se, se: 100 * se, n: m };
}

rows.sort((a, b) => a.pct - b.pct);
const head = '难度阶梯 · 1 席人类替身(' + TGT + ') vs ' + (N - 1) + ' 席同档 AI · n=' + N + ' · mode=' + MODE +
  ' · 包=' + pk.tag + ' · ' + GAMES + ' 局/档 · 同批种子（跨档逐局配对）· 上线档带大雷/摄魂注入 · 替身夺冠越低=越强';
if (QUIET) {
  /* --quiet 只印机器可读的一行（门用它做"阶梯确实分级"的判定，不靠措辞） */
  console.log(JSON.stringify({ n: N, mode: MODE, pack: pk.tag, games: GAMES, rows: rows.map(r => ({ id: r.id, pct: +r.pct.toFixed(2), avgR: +r.avgR.toFixed(1), dose: r.dose == null ? null : +r.dose.toFixed(4), doseN: r.doseN })) }));
} else {
  console.log(head);
  const ref = (LEVELS.find(function (L) { return L.id === Bots.DIFF_DEFAULT; }) || {}).id || rows[0].id;
  for (const r of rows) {
    const pd = r.id !== ref ? pairedDiff(r.id, ref) : null;
    console.log('  ' + r.label.padEnd(24) + ' 替身夺冠 ' + r.pct.toFixed(1) + '%  · 局长 ' + r.avgR.toFixed(1) +
      ' 回合 · 大雷 ' + r.bigT.toFixed(2) + ' 张/桌 · 摄魂 ' + r.drain.toFixed(2) + ' 张/桌' +
      (pd ? '  · 与『' + ref + '』配对差 ' + (pd.m >= 0 ? '+' : '') + pd.m.toFixed(2) +
        ' ±' + pd.ci.toFixed(2) + 'pt（95%CI ⇒ 1σ=' + pd.se.toFixed(2) + ' ‖ ' + (Math.abs(pd.m) / pd.se).toFixed(1) + 'σ）' : '  ← 默认档'));
  }
  console.log('  耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  /* `--pairs=1`：**相邻档两两配对差**（`D227`④ 原句要的是"两两分得开"，而上面那段只报"对『普通』"的差 ⇒
   *   拿"对基准 +8.8"去说"与上一档 +4.4"是另一件事）。逐局胜负向量本来就在手里（同批种子 ⇒ 第 i 局对第 i 局），
   *   所以这里不需要重跑，只是把 `pairedDiff` 换一对参数再算一次。
   *   判"分不分得开"用 **|差| ≥ 2×CI95/1.96**（即 95% 区间不跨 0），并且**同时印出次序**：
   *   次序翻（弱档反而更难）比"分不开"更值得响。 */
  if ((flag('pairs', '0') || '0') === '1') {
    const asc2 = rows.slice().sort((a, b) => a.pct - b.pct);
    console.log('  相邻档两两配对差（按夺冠率从难到易排；正 = 后一档更容易被打赢）：');
    for (let i = 1; i < asc2.length; i++) {
      const pd2 = pairedDiff(asc2[i].id, asc2[i - 1].id);
      if (!pd2) { console.log('    ' + asc2[i - 1].label + ' → ' + asc2[i].label + ' 算不出（胜负向量长度不一致？）'); continue; }
      const se = pd2.se;
      console.log('    ' + (asc2[i - 1].label + '                    ').slice(0, 22) + '→ ' +
        (asc2[i].label + '                  ').slice(0, 20) + ' ' + (pd2.m >= 0 ? '+' : '') + pd2.m.toFixed(2) +
        ' ±' + se.toFixed(2) + 'pt（1σ ‖ 95%CI ±' + pd2.ci.toFixed(2) + '） ⇒ ' + (Math.abs(pd2.m) < 2 * se ? '**分不开**' : (pd2.m > 0 ? '分得开（' + (Math.abs(pd2.m) / se).toFixed(1) + 'σ）' : '**次序翻了**')) +
        ' ‖ 局长 ' + asc2[i - 1].avgR.toFixed(1) + ' → ' + asc2[i].avgR.toFixed(1) + ' 回合');
    }
  }
  /* `--pairs=all`：**全部 C(n,2) 对**都算一遍（同样免费 —— 逐局胜负向量本来就在手里）。
   *   为什么需要这一档（§E595，10-12）：`--pairs=1` 配的是"**实测名次**上相邻"的那几对，而 `D227`④ 的在册账要的是
   *   "**档位表声明序**上相邻"的那几对。10-12 把池收成两带之后，三档共用 `soft` 带 ⇒ 实测名次第一次和声明序分开，
   *   `--pairs=1` 就产不出那几对 ⇒ 门红在"没记账"上，而真实情况是"这把尺没法用相邻档的名次记账"。
   *   逐对全算 = 两种口径都拿得到，且不用多跑一场。 */
  if ((flag('pairs', '0') || '0') === 'all') {
    const asc3 = rows.slice().sort((a, b) => a.pct - b.pct);
    console.log('  全部配对差（from = 更低夺冠率那一档 = 对人类更难；正 = to 更容易被打赢）：');
    for (let i = 0; i < asc3.length; i++) for (let j = i + 1; j < asc3.length; j++) {
      const a = asc3[i], b = asc3[j], pd3 = pairedDiff(b.id, a.id);
      if (!pd3) { console.log('    ' + a.id + '→' + b.id + ' 算不出'); continue; }
      console.log('    ' + (a.id + '                ').slice(0, 16) + '→ ' + (b.id + '            ').slice(0, 14) +
        ' ' + (pd3.m >= 0 ? '+' : '') + pd3.m.toFixed(2) + ' ±' + pd3.se.toFixed(2) + 'pt ⇒ ' +
        (Math.abs(pd3.m) < 2 * pd3.se ? '分不开' : (pd3.m > 0 ? '分得开（' + (Math.abs(pd3.m) / pd3.se).toFixed(1) + 'σ）' : '次序翻了')));
    }
  }
}
if (machine) {
  /* 分级判定（门用）：按"替身夺冠率"**从难到易**排开后，相邻档差必须 ≥ MIN_GAP，且默认档必须存在。
   * ⚠ 阈值是可谈判的，但**不许静默放宽**：改这里要连 CHANGELOG 一起改。
   * `--except=a>b`（逗号分隔多对）= **点名**某一对相邻档只要求"不许翻序"（差 ≥ `--exceptMin`，默认 0）。
   *   为什么需要这个口子：§E286 实测"贪心冠军 vs 默认档"在 5 人 3 血桌上只差 −1.53±2.36pt ⇒ 那一步**次序对、分不开**。
   *   与其把全局阈值压到 1.5 以下（那样入门/普通那一步也一起免检了），不如把松的地方写进名单、别处照旧严。
   *   ⚠ **§E609 之后这个口子没有任何在用的名单**：上面那句"分不开"是单次 1500 局的读数，同一对差重测到 8 seed×1000 是 8.36σ ⇒ 撤标。
   *   默认 `EXCEPT = []`（不给旗标就一条都不豁免），门也不读这个旗标（`grep -n except tools/gates/train-chooser.mjs` 为空）
   *   ⇒ 它是**手动重测时才带的一次性口子**，不是藏在门里的永久豁免 —— 别把它当成配置。 */
  const MIN_GAP = Number(flag('minGap', 1.5));
  const EXCEPT_MIN = Number(flag('exceptMin', 0));
  const EXCEPT = String(flag('except', '') || '').split(',').filter(Boolean);
  const errs = [];
  const asc = rows.slice().sort((a, b) => a.pct - b.pct);
  const excepted = [];
  for (let i = 1; i < asc.length; i++) {
    const gap = asc[i].pct - asc[i - 1].pct;
    const key = asc[i - 1].id + '>' + asc[i].id;
    if (EXCEPT.indexOf(key) >= 0) {
      if (gap < EXCEPT_MIN) errs.push(key + ' 点名放行仍翻序（差 ' + gap.toFixed(2) + 'pt < ' + EXCEPT_MIN + '）');
      else excepted.push(key + '=' + gap.toFixed(2));
      continue;
    }
    if (gap < MIN_GAP) errs.push(asc[i - 1].id + '→' + asc[i].id + ' 只差 ' + gap.toFixed(2) + 'pt < ' + MIN_GAP);
  }
  console.log(JSON.stringify({
    ok: errs.length === 0, minGap: MIN_GAP, excepted: excepted, gaps: errs,
    rows: asc.map(r => ({ id: r.id, pct: +r.pct.toFixed(2) }))
  }));
  process.exit(errs.length ? 1 : 0);
}
