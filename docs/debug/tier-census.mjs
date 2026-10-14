#!/usr/bin/env node
/* tier-census.mjs —— **档位装配下的出手谱普查**（研究量具，不进判据，**只读**）
 *
 * 为什么要它（用户 10-14 的纠正）：README 的「已知限制 ①」原来拿**单枚成员**的实机目录（K2 / D4a / …）
 *   当"冠军怎么打"，用户一句话点破两件事：
 *     ① **读招那种风格脚本不在池子里**，把它写进池子的分析是串口径；
 *     ② **单独个体 ≠ 池子**：池是按席位逐局随机抽的，同一枚成员和"它跟谁凑到一桌"表现不一样
 *        ⇒ 要报的必须是**档位装配**下的读数，而且要**多抽几个随机排列组合**。
 *   现成的尺各自缺一角：`probe-pool` 量的是**强度**（人类席夺冠率）与五格压力账，**不出出手谱**；
 *   `usage-probe` / `breadth-probe` / `skill-report` 的装配是"同包镜像 / 1 冠军席 + 4 脚本席" —— 正是用户说的"单独个体"。
 *   ⇒ 另起一把，装回**产品那一份**抽签。
 *
 * 装配真源（一条都不许在这里重写）：
 *   · 档位定义 = `js/train/bots.js` 的 `DIFF_TIERS`（含每档剂量四元组与 `pool` 带）；
 *   · 逐席抽签 = `js/pool-draw.js` 的 `compose` / `scriptSeats`（页面与 `D234` 用的是同一份）；
 *   · 对局循环 = `tools/v2v4-lib.mjs` 的 `duelAssembly`（`chooserFor` 逐席换包、`onGame` 把 `st` 递出来）；
 *   · 人类席 = `tools/audit-lib.mjs` 的 `humanPrototypes`（与 `probe-pool` 同一组）。
 *   ⇒ 本文件**没有第二份引擎、也没有第二份抽签**。
 *
 * 口径（引用读数时必须带上）：
 *   · 5 人桌 · 每局 1 席人类形状原型（轮座）+ 4 席**按该档的带逐席抽**（允许重复、禁四席全同，与页面同）；
 *   · **每局一个新盐**（`duelAssembly` 里 `st.slotSalt = h32(seed0 + g×2246822519)`）⇒ "多抽几个随机排列组合"
 *     就是多跑几局 / 多给几枚 seed / 多换几个原型 —— 不是把同一份组成重复算；
 *   · 出手只数 `type==='action' && outcome==='ok'`（`js/core/state.js:231`；与 `usage-probe`/`log-behavior` 同一判据），
 *     **分母 = 4 个 AI 席的全部成功出手**（含 ジ），**人类那一席不计**；
 *   · 卡名一律从 `EpirusRules.skills` 现取；防御类按 `R.byKey[k].cat==='defense'` 归类，**不硬编码卡名单**；
 *   · 剂量：吃该档表里的 `eps/epsK/epsMode`，**逐回合斜坡（`ramp`）按起手剂量算**（与 `probe-pool` 同一条已知边界）。
 *
 * 用法：node docs/debug/tier-census.mjs [--tiers=lv:sparring,lv:regular,lv:hard] [--games=20]
 *         [--seeds=90210,90211,90212] [--protos=3] [--mode=multi] [--members=champion-map/pool-members.tsv]
 *         [--n=5]        ← §E624：桌大小（默认 5；**n=2 自动换 2P 那张原生池表**，除非显式给了 --members=）
 *       node docs/debug/tier-census.mjs --self-test
 * 退出码：0 = 跑完 ‖ 2 = 输入不齐 / 自检不过（宁可红也不许假绿）‖ 7 = 有成员读不出包
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, rejectUnknownFlags, humanPrototypes } from '../../tools/audit-lib.mjs';
import { duelAssembly } from '../../tools/v2v4-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['tiers', 'games', 'seeds', 'protos', 'mode', 'members', 'n', 'self-test'], 'tier-census');

const G = Math.max(1, Number(flag('games', 20)) || 20);
const PROTOS = Math.max(1, Number(flag('protos', 3)) || 3);
const MODE = flag('mode', 'multi');
/* §E624（10-15）：**桌大小**。以前这把尺只有 5 席循环 ⇒ 2 人桌（v1.7.29 起真的走池了）从头到尾没有一条档位级出手谱读数，
 *   而 README §① 那条"2 人桌那 7 枚还没有对应尺"就是这么来的。补法是在**唯一那份**对局循环（`duelAssembly`）上加一维，
 *   不另写第二台引擎。默认 5 ⇒ 在册的 n=5 读数逐字不变（回归验过：同参数新旧两跑的输出 `diff` 为空）。
 *   ⚠ **换人数 = 换分布**：n=2 只有 1 个 AI 席 ⇒ 分母、"全同"概念、掺席可行性都跟着变（下面各处按 `AI` 走，不写死 4）。 */
const N = Math.max(2, Number(flag('n', 5)) || 5);
const AI = N - 1;
const TABLE = flag('members', '') || (N > 2 ? 'champion-map/pool-members.tsv' : 'champion-map/pool-members-2p.tsv');
const SEEDS = String(flag('seeds', '90210,90211,90212')).split(',').map(Number).filter(x => !Number.isNaN(x));
const TIERS = String(flag('tiers', 'lv:sparring,lv:regular,lv:hard')).split(',').filter(Boolean);

const W = sandbox();
const PD = W.EpirusPoolDraw, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer,
      R = W.EpirusRules, B = W.EpirusBots;
if (!PD || typeof PD.compose !== 'function') { console.error('⛔ `js/pool-draw.js` 没进 sandbox 的 CORE 名单'); process.exit(2); }
if (!T || typeof T.policyChooserN !== 'function') { console.error('⛔ `js/train/evo.js` 的 policyChooserN 取不到'); process.exit(2); }

/* ===== 出手谱账（唯一一处口径；自检与正式跑共用它，免得"量的是另一个东西"） ===== */
function newCensus() { return { games: 0, rounds: 0, byKey: Object.create(null), packActs: 0, scriptActs: 0, kindSeen: Object.create(null) }; }
function tally(cen, st, seat, kindOfPid) {
  cen.games++; cen.rounds += Number(st.round) || 0;
  for (const e of (st.events || [])) {
    if (!e || e.type !== 'action' || e.outcome !== 'ok') continue;      /* 判据：成功出手 */
    const pid = Number(e.pid);
    if (pid === seat) continue;                                        /* 人类那一席不计 */
    cen.byKey[e.key] = (cen.byKey[e.key] || 0) + 1;
    const k = (kindOfPid && kindOfPid[pid]) || 'pack';
    cen.kindSeen[k] = (cen.kindSeen[k] || 0) + 1;
    if (k === 'script') cen.scriptActs++; else cen.packActs++;
  }
}
function spectrum(cen) {
  const keys = Object.keys(cen.byKey).sort((a, b) => cen.byKey[b] - cen.byKey[a]);
  const total = keys.reduce((a, k) => a + cen.byKey[k], 0);
  const defSet = new Set((R.skills || []).filter(s => s.cat === 'defense').map(s => s.key));
  let def = 0, H = 0;
  for (const k of keys) {
    if (defSet.has(k)) def += cen.byKey[k];
    const p = cen.byKey[k] / total;
    if (p > 0) H -= p * Math.log(p);
  }
  const top3 = keys.slice(0, 3).reduce((a, k) => a + cen.byKey[k], 0);
  const nameOf = k => (R.byKey[k] && R.byKey[k].name) || k;
  return {
    total, keys, nameOf,
    distinct: keys.length,                       /* 种类（含 ジ，与 log-behavior 的"能力项"同一算法） */
    top3Share: total ? top3 / total : 0,
    H, G: Math.exp(H),
    defShare: total ? def / total : 0,
    shareOf: k => (total ? cen.byKey[k] / total : 0),
    perGame: k => (cen.games ? cen.byKey[k] / cen.games : 0)
  };
}

/* ===== 自检：两格都是**手算得出来**的，钉的是"计数器接对了事件"（不是"某档读数是几"） =====
 * ⚠ 第一版这里用的是引擎风格（`B.pickFarmer`）并断言"全ジ" —— **跑出来是 [ji,charge] 就红了**。
 *   红得对：`pickFarmer` 是"只攒不打"，它本来就会用**蓄能**攒珠 ⇒ 错的是我的断言，不是接线。
 *   ⇒ 自检只能用**合成选择器**（期望值能一眼算出来），不许拿引擎风格当基准。 */
function selfTest() {
  const params = loadChamp(W, 'js/bundled-champion.js');
  if (!params) { console.error('⛔ 自检起不来：读不出 js/bundled-champion.js'); process.exit(2); }
  const onlyJi = function (s, p, lg) { return { key: R.SK.JI, target: null }; };
  const gunFirst = function (s, p, lg) {
    const g = (lg || []).find(x => x.key === R.SK.GUN && x.affordable);
    return g ? { key: R.SK.GUN, target: T.pickTargetN(s, p, R.SK.GUN) } : { key: R.SK.JI, target: null };
  };
  const run = function (pick, games) {
    const cen = newCensus();
    const kindOfPid = {}; for (let i = 0; i < 5; i++) kindOfPid[i] = 'pack';
    duelAssembly({ S: S, Play: Play, T: T, R: R }, params,
      { games: games, mode: 'multi', seed0: 4242, scripted: pick, chooserFor: function (pid) { return pick; },
        onGame: function (st, seat) { tally(cen, st, seat, kindOfPid); } });
    return spectrum(cen);
  };
  const ji = run(onlyJi, 2), gun = run(gunFirst, 2);
  const bad = [];
  if (!(ji.total > 0)) bad.push('① 全ジ装配一手都没数到（events 字段接错线 ⇒ 最像"跑通了"的坏）');
  if (ji.keys.length !== 1 || ji.keys[0] !== R.SK.JI) bad.push('① 全ジ装配的出手谱必须恰好只有 ジ，实测 [' + ji.keys.join(',') + ']');
  if (Math.abs(ji.G - 1) > 1e-9) bad.push('① 全ジ装配的 G 必须恰好 1（H=0），实测 ' + ji.G.toFixed(4));
  if (Math.abs(ji.defShare) > 1e-9) bad.push('① 全ジ装配的防御类占比必须恰好 0，实测 ' + ji.defShare);
  if (Math.abs(ji.top3Share - 1) > 1e-9) bad.push('① 全ジ装配的前 3 占比必须恰好 1，实测 ' + ji.top3Share);
  if (!(gun.total > 0)) bad.push('② 枪优先装配一手都没数到');
  if (gun.keys.indexOf(R.SK.GUN) < 0) bad.push('② 枪优先装配必须出现 枪，实测 [' + gun.keys.join(',') + ']');
  if (gun.distinct < 2) bad.push('② 枪优先装配的种类必须 ≥2（枪 + ジ），实测 ' + gun.distinct);
  if (!(gun.shareOf(R.SK.GUN) > 0 && gun.shareOf(R.SK.GUN) < 1)) bad.push('② 枪的占比必须落在 (0,1)，实测 ' + gun.shareOf(R.SK.GUN));
  if (bad.length) { bad.forEach(b => console.error('✘ ' + b)); console.error('⇒ 自检不过：本文件与引擎之间断线了，读数作废'); process.exit(2); }
  console.log('✔ 自检通过（全ジ：' + ji.total + ' 手 / 种类 ' + ji.distinct + ' / G ' + ji.G.toFixed(2) + ' / 防御 0' +
    ' ‖ 枪优先：' + gun.total + ' 手 / 种类 ' + gun.distinct + ' / 枪占 ' + (100 * gun.shareOf(R.SK.GUN)).toFixed(1) + '% / G ' + gun.G.toFixed(2) + '）');
  process.exit(0);
}
if (process.argv.includes('--self-test')) selfTest();

/* ===== 正式：读池真源 ===== */
const PT = join(ROOT, TABLE);
if (!existsSync(PT)) { console.error('⛔ 池真源表不在：' + TABLE + '（先跑 tools/pool-add.mjs）'); process.exit(2); }
const L = readFileSync(PT, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
for (const c of ['id', 'wid', 'path', 'tier']) if (h[c] === undefined) { console.error('⛔ 表缺列 ' + c); process.exit(2); }
const allRows = L.slice(1).map(l => l.split('\t'));

const tiers = (B.DIFF_TIERS || []);
const picked = TIERS.map(id => tiers.find(t => t && t.id === id));
const unknown = TIERS.filter((id, i) => !picked[i]);
if (unknown.length) { console.error('⛔ --tiers 里有 DIFF_TIERS 不认的档：' + unknown.join(',') + '（在册：' + tiers.map(t => t.id).join(',') + '）'); process.exit(2); }
if (SEEDS.length < 1) { console.error('⛔ --seeds 一枚都解析不出'); process.exit(2); }

console.log('# 档位装配普查（1 席人类形状 + ' + AI + ' 席**按该档的带逐席抽** · 每局一个新盐 ⇒ 每局一个新排列组合）');
console.log('# 口径：**' + N + ' 人桌** · ' + MODE + ' · ' + G + ' 局/格 × seed ' + SEEDS.join('/') + ' × 前 ' + PROTOS + ' 个人类原型 · 出手只数 action/ok · 分母=' + AI + ' 个 AI 席（含ジ）');
console.log('# 池真源表 = ' + TABLE + (N > 2 ? '（多人桌那张）' : '（2 人桌那张原生池，§E599 ⇒ 不是把 3P 搬到 1v1）'));
console.log('# 剂量：吃各档表值（ramp 按起手剂量算 —— 与 probe-pool 同一条已知边界）');
console.log('# 抽签/对局循环：`js/pool-draw.js` + `tools/v2v4-lib.mjs` 的 duelAssembly（无第二份实现）\n');

const PROTOSET = humanPrototypes(B).slice(0, PROTOS);
const out = [];
for (const t of picked) {
  /* §E609：以前这里直接 `allRows.filter(r => r[h.tier] === t.pool)` ⇒ 拆带之后 `lv:regular.pool` 指的 `mid` 是**空带**，
   *   于是这一档被上面那句"只有 0 枚 ⇒ 不量"整档跳过 —— 不撒谎，但**普查表里从此没有普通档**。
   *   推导改走与页面/量具同一份 `rosterFor`：该按带加权就按带加权，该走退路就把退路印出来。 */
  const byId = {}; for (const r of allRows) byId[r[h.id]] = r;
  const RR = PD.rosterFor(allRows.map(r => ({ id: r[h.id], wid: r[h.wid], tier: r[h.tier] })), t);
  const bandW = RR.bandW;
  const rows = RR.members.map(m => byId[m.id]).filter(Boolean);
  const bandTxt = bandW ? ('两带加权 ' + Object.keys(bandW).filter(x => x !== 'else').join('/')) : t.pool;
  if (RR.note) console.log('## ' + t.id + '：' + RR.note + '\n');
  if (!rows.length) { console.log('## ' + t.id + '（带 ' + bandTxt + '）：**0 枚** ⇒ ' + N + ' 人桌这张表里没有可抽的成员，不量（不是 0 分，是没量）\n'); continue; }
  if (rows.length < 2 && AI > 1) { console.log('## ' + t.id + '（带 ' + bandTxt + '）：只有 ' + rows.length + ' 枚 ⇒ ' + AI + ' 席必然全同，**不量**（用户裁定不许全同）\n'); continue; }
  const PARAMS = {}, CHOOSERS = {}; const bad = [];
  for (const r of rows) {
    let p = null;
    try { p = loadChamp(W, r[h.path]); } catch (e) { p = null; }
    if (!p) { bad.push(r[h.id]); continue; }
    PARAMS[r[h.id]] = p;
    CHOOSERS[r[h.id]] = T.policyChooserN(p, 0.15, t.eps, t.epsK, t.epsMode);
  }
  if (bad.length) { console.error('⛔ ' + t.id + ' 有 ' + bad.length + ' 枚读不出包：' + bad.join(' ‖ ') + ' ⇒ 按失败处理'); process.exit(7); }
  /* ⚠ `tier` 必须带上：`compose` 的按带加权靠 `byTier(members, 带名)` 分名单，少了这一列混抽会直接判成"权重带全空" */
  const lite = rows.filter(r => PARAMS[r[h.id]]).map(r => ({ id: r[h.id], wid: r[h.wid], tier: r[h.tier] }));
  let MIX = null, SCRIPTS = {};
  if (t.scriptMix) {
    MIX = PD.scriptSeats(t, AI, B.STYLES || []);
    if (MIX && MIX.seats > 0) for (const sid of MIX.ids) {
      const st = (B.STYLES || []).find(x => x.id === sid);
      if (!st) { console.error('⛔ scriptMix 里的风格 ' + sid + ' 不在 STYLES'); process.exit(7); }
      SCRIPTS[sid] = T.wrapBigTPush ? T.wrapBigTPush(st.pick) : st.pick;
    }
  }
  const cen = newCensus();
  let miss = 0, allSame = 0, comps = new Set();
  const firstParams = PARAMS[lite[0].id];
  for (const proto of PROTOSET) for (const seed of SEEDS) {
    let curState = null, cur = null;
    const chooserFor = function (pid, st) {
      if (st !== curState) {
        curState = st;
        const comp = PD.compose(lite, AI, PD.rng((st.slotSalt >>> 0) || 1), (MIX && MIX.seats) ? MIX : null, bandW);
        cur = { comp: comp, byPid: {}, kind: {}, order: 0 };
        comps.add(comp.seats.map(s => s.id).join('+'));
        if (comp.allSame) allSame++;
      }
      if (!(pid in cur.byPid)) {
        const m = cur.comp.seats[cur.order++];
        cur.byPid[pid] = m;
        cur.kind[pid] = (m && m.kind === 'script') ? 'script' : 'pack';
      }
      const m = cur.byPid[pid];
      if (!m) { miss++; return null; }
      if (m.kind === 'script') return SCRIPTS[m.id] || null;
      return CHOOSERS[m.id];
    };
    const kindRef = function () { return cur ? cur.kind : null; };
    duelAssembly({ S: S, Play: Play, T: T, R: R }, firstParams,
      { games: G, mode: MODE, seed0: seed, n: N, scripted: proto[1], chooserFor: chooserFor,
        onGame: function (st, seat) { tally(cen, st, seat, kindRef()); } });
  }
  const sp = spectrum(cen);
  console.log('## ' + t.id + '（带 ' + bandTxt + ' · ' + lite.length + ' 枚' +
    (MIX && MIX.seats ? ' ‖ 掺脚本席 ' + MIX.seats + ' 席：' + MIX.ids.join(' ‖ ') : ' ‖ 不掺脚本席') + '）');
  console.log('   局 ' + cen.games + ' ‖ 均 ' + (cen.rounds / Math.max(1, cen.games)).toFixed(1) + ' 回合/局 ‖ **AI 席有效出手 ' + sp.total +
    '**（' + (sp.total / Math.max(1, cen.games)).toFixed(1) + '/局）‖ 出现过的种类 **' + sp.distinct + '**');
  console.log('   前 3 占 **' + (100 * sp.top3Share).toFixed(1) + '%** ‖ H ' + sp.H.toFixed(3) + ' ‖ **G=exp(H) ' + sp.G.toFixed(2) +
    '** ‖ 防御类占 **' + (100 * sp.defShare).toFixed(1) + '%**' +
    (MIX && MIX.seats ? ' ‖ 脚本席出手占 ' + (100 * cen.scriptActs / Math.max(1, sp.total)).toFixed(1) + '%' : ''));
  console.log('   出手谱（占 AI 席有效出手的比例，后括号 = 次/局）：');
  console.log('     ' + sp.keys.map(k => sp.nameOf(k) + ' ' + (100 * sp.shareOf(k)).toFixed(1) + '%(' + sp.perGame(k).toFixed(2) + ')').join(' · '));
  const never = (R.skills || []).map(s => s.key).filter(k => !sp.keys.includes(k));
  console.log('   卡表 ' + (R.skills || []).length + ' 张里这一档**一次都没出现**的 ' + never.length + ' 张：' + never.map(k => sp.nameOf(k)).join(' · '));
  console.log('   ⚑ 这 ' + cen.games + ' 场里出现 ' + comps.size + ' 种不同组成 ‖ ' +
    (AI > 1 ? 'AI 席全同 ' + allSame + ' 局' : '只有 1 个 AI 席 ⇒ "全同"这一判据不适用（不计数）') + ' ‖ 漏席 ' + miss + ' 次' + (miss ? ' ⇒ **组成漏席，本行数不可引用**' : '') + '\n');
  out.push({ tier: t.id, n: N, band: bandTxt, members: lite.length, mix: MIX ? MIX.seats : 0, games: cen.games,
    roundsPerGame: +(cen.rounds / Math.max(1, cen.games)).toFixed(1), actions: sp.total,
    distinct: sp.distinct, top3: +(100 * sp.top3Share).toFixed(1), G: +sp.G.toFixed(2), defShare: +(100 * sp.defShare).toFixed(1),
    comps: comps.size, allSame: AI > 1 ? allSame : 'n/a', miss: miss,
    byKey: sp.keys.map(k => [k, cen.byKey[k]]) });
}
console.log('# 机器可读（给门与以后的自己核对用）：');
console.log(JSON.stringify({ mode: MODE, n: N, aiSeats: AI, table: TABLE, games: G, seeds: SEEDS, protos: PROTOSET.map(p => p[0]), rows: out }));
