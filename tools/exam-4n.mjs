#!/usr/bin/env node
/* 四格考卷仪器（v2.0.4 · 2026-11-07 · 用户令"并发开跑全图的新考卷"）
 *
 * 把 DS 的四人数加权卷提案（PROPOSAL-2026-11-07-exam-v3-ds.md §10）接上对局：
 *   一枚包在 N=2/3/5/8 各打 planN(N, R, seed) 排出的局（对手 = EXAM_POOL 28 席，每局 (N−1) 个互不相同），
 *   读数 = **夺1率**（rankOf 并列算第一，与 eval-5p 同口径）⇒ H2/H3/H5/H8，
 *   归一 = excess = (p − 1/N)/(1 − 1/N)（§10.1：跨 N 不许直接平均，页面权重加在 excess 上）⇒ X2/X3/X5/X8。
 *
 * 对局核心**逐字沿用 eval-5p**（同一台引擎、同一种 chooser 包装）：
 *   · 冠军 chooser = T.policyChooserN(params, 0.15)（考卷臂 ε=0，与 eps-full 的 exam 臂同口径）；
 *   · 对手 chooser = asChooser(Bots[fn])（bot-chooser-lib 包装，EXAM_FN 查名，查不到响亮报错）；
 *   · 每局 T.oneGameN(choosers, seed, N) + T.rankOf(r.state, seat, seed)（平局种子 = 局种子，pid 中性）；
 *   · 冠军座位 = 局序号 % N（轮转），对手槽位相对座位再旋转（eval-5p 656 行的"座位率 × 脚本强度"解耦教训）。
 * 桌形 = 引擎默认 multi（3 血短程）；四格卷考的是**人数轴**，桌形固定才可跨包比较。
 *
 * 用法: node tools/exam-4n.mjs [rounds=6] [seed=77000] <冠军文件> [--mode=multi] [--onlyn=2,3,5,8] [--dose=exam|page] [--eps-tier=lv:regular] [--expool=v1|v2|v3] [--plan=v3]
 *   ⚠ 旗标名**只认小写**（`rejectUnknownFlags` 的名单是全小写，而 :40 的解析把大写原名存进 `FLAG`）⇒ 写 `--onlyN` 会被当场拒（不是静默忽略，但文档原来的写法确实骗过一次）。
 * --expool=v2（缺省）= 现行 28 席；`v1` = 11-09 `469dfdb1` 换席前那张卷 ⇒ **历史 X̄₄ 可复算**；
 *   `v3` = v2 的 28 席 + 第 29 席 `cautious`（ econ 轴），配 `--plan=v3` 才是"每局按 attack/pierce/defense/econ 各抽一席"的分层桌形
 *   ⇒ 单给 `--expool=v3` 而 `--plan` 仍是缺省时，多出的那席只是按老规则被抽到，**不是**那张分层卷（两件事要一起给）。
 *   读数行上的 `pool=<版本>#<sha8>` 戳只钉"坐的是哪 28/29 个脚本"，抽席规则另由 `plan` 说明 ⇒ 三者任换其一都换尺。
 *   为什么必须有：换席动的是默认表、没有旗标也没有戳，而 `POOL-CONTRACT §1` 明写"EXAM_POOL 一个不动"
 *   ⇒ 那之后同一条命令算出来的 X̄₄ 与图上 900+ 枚历史读数不是同一把尺，收据上却一模一样。
 * --dose=exam（缺省）：主体席 ε=0 贪心 —— 与旧卷的 exam 臂、与 `exam4-all-*.tsv` 那两批同口径（H 侧）。
 * --dose=page：主体席按**页面剂量**出手（`DIFF_TIERS` 那档的 ε/epsK/epsMode + 回合斜坡，默认 `lv:regular`）
 *   —— 这才是「玩家默认拿到的那个数」（Hp 侧）。斜坡形状走 `Bots.tierEps`，**不在这里再写一遍**（D153 只许一份）。
 * 输出: [冠军4N] h2=..% h3=..% h5=..% h8=..% x2=... x3=... x5=... x8=... n2=.. n3=.. n5=.. n8=.. sec=..
 *   （h 缺格子不会出现：planN 对每个 N 都有局；--onlyN 只用于调试，正式读数四格必须齐）
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { OPP_SPECS, examPool } from '../training/server/opp-pool.mjs';
import { createHash } from 'node:crypto';
import { planN, planN3 } from './exam-pool.mjs';
import { makeAsChooser } from './bot-chooser-lib.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const ARGV = process.argv.slice(2).filter((a) => !/^--/.test(a));
const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a);
  if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2];
}
rejectUnknownFlags(process.argv.slice(2), ['mode', 'onlyn', 'dose', 'eps-tier', 'champ', 'champn', 'exam', 'expool', 'plan'], 'exam-4n');
const R = Number(ARGV[0] || 6);
if (!(Number.isInteger(R) && R >= 1)) { console.error('⛔ rounds 必须是正整数，收到 `' + ARGV[0] + '`'); process.exit(2); }
const SEED = Number(ARGV[1] || 77000);
const FILE = ARGV[2];
if (!FILE) { console.error('用法: node tools/exam-4n.mjs [rounds=6] [seed=77000] <冠军文件>'); process.exit(2); }
const NS = (FLAG.onlyn ? String(FLAG.onlyn).split(',').map(Number) : [2, 3, 5, 8]);
for (const n of NS) if (![2, 3, 5, 8].includes(n)) { console.error('⛔ --onlyN 只认 2/3/5/8，收到 ' + n); process.exit(2); }
const MODE = FLAG.mode || '';   // 缺省 = 引擎默认桌 multi；传了就透传（两批不许混：mode 写进输出行）
const DOSE = FLAG.dose || 'exam';
if (DOSE !== 'exam' && DOSE !== 'page') { console.error('⛔ --dose 只认 exam/page，收到 ' + DOSE); process.exit(2); }
/* 考卷池版本（11-09 晚补 · Qoder）：`469dfdb1` 把 28 席里两席就地换名 ⇒ 在册条款「EXAM_POOL 一个不动」被破，
 *   而输出里没有池版本，此后任何 X̄₄ 与图上 900+ 枚历史读数不是同一把尺却看不出来。
 *   默认 `v2`（= 现在的池 ⇒ 既有调用逐字不变）；`v1` 复算换席前那张卷。**两版不许混进一张表**：戳写进输出行。 */
const POOL_VERSION = FLAG.expool || 'v2';
let POOL;
try { POOL = examPool(POOL_VERSION); } catch (e) { console.error('⛔ ' + e.message); process.exit(2); }
const POOL_STAMP = POOL_VERSION + '#' + createHash('sha1')
  .update(POOL.map(function (e) { return e.name + ':' + e.axis + ':' + e.minN; }).join(',')).digest('hex').slice(0, 8);
/* 11-09 用户裁 A：**exam-v2 = 冠军席考卷**。`--champ=Q-s47,T8-s114` 把每局的第一个对手席换成
 *   一枚**冻结的冠军包**（自适应、会集火会破防），其余仍是 EXAM_POOL 脚本 ⇒ 反射墙再也farm不到。
 *   缺省空 ⇒ 与 v1 逐位相同（历史读数可复现）。N=2 时隔局换冠军（否则就变成纯 1v1）。 */
const CHAMP_IDS = String(FLAG.champ || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const CHAMP_N = Math.max(0, Number(FLAG.champn || 1) | 0);   // 每局冠军席数（≤N−1；缺省 1）
/* B/both 轴没显式给 --champ 时用**在册 2.0 夹具**（用户 11-09：v7 跨人数泛用性差 ⇒ 冠军席必须用 2.0 强包）。 */
if (!CHAMP_IDS.length && /^(B|BOTH)$/i.test(String(FLAG.exam || ''))) CHAMP_IDS.push('KDG-B-Q-s13', 'FOCUS-Q-s13', 'Q-s47');
/* 11-09 用户裁（方案 1，混合夹具）：B 轴 = **2.0 主力两枚 + 1 枚反墙锚**。
 *   为什么必须留 Q-s47：实测 2.0 池里没有任何包压得住反射墙（G5C 在 2.0 冠军桌上 2P 0.935 / 3P 0.502），
 *   只有 v7 的 Q-s47 能把 G5C 压到 3P 17%。⇒ Q-s47 是**临时锚**，等 2.0 造出反墙强包就替换（在册理由见 RESULTS §十三.18）。 */
/* 11-11 夜（用户令"找代表重测 B 轴"）：夹具登记表补 2.0 现役强包——旧夹具三锚是 11-09 的天花板，
 *   obs5 时代的新冠军不在里面 ⇒ 图上 PB 靠"打旧天王"刷分。新夹具用 --champ= 显式点名（在册 id 才能用）。 */
const CHAMP_PATHS = { 'Q-s47': 'docs/artifacts/e507-out/Q-s47.js', 'T8-s114': 'docs/artifacts/e528-out/T8-s114.js', 'KDG-B-Q-s13': 'docs/artifacts/night-adapt/KDG-B-Q-s13.js', 'FOCUS-Q-s13': 'docs/artifacts/night-adapt/FOCUS-Q-s13.js', 'WSEL9-200': 'docs/artifacts/night-adapt/WSEL9-200.js',
  'MSB2-R1S1494663071': 'docs/artifacts/night-adapt/MSB2-R1S1494663071.js', 'MSB2-R2S103437527': 'docs/artifacts/night-adapt/MSB2-R2S103437527.js',
  'OBS5-F-s13': 'docs/artifacts/night-adapt/OBS5-F-s13.js', 'OBS5-F-s41': 'docs/artifacts/night-adapt/OBS5-F-s41.js',
  /* 11-11 深夜：C 尺换代链的新冠军入册（MSB6-R2S501866988 C 0.1049 / MSB8-charge C 0.1383 / 前任 S916R2B 0.0668） */
  'S916R2B-R1S685223462': 'docs/artifacts/night-adapt/S916R2B-R1S685223462.js',
  'MSB6-R2S501866988': 'docs/artifacts/night-adapt/MSB6-R2S501866988.js', 'MSB8-charge-R1S1861674281': 'docs/artifacts/night-adapt/MSB8-charge-R1S1861674281.js',
  'MSB10-R1S1149480262': 'docs/artifacts/night-adapt/MSB10-R1S1149480262.js', 'MSB8-bagua-R1S88974978': 'docs/artifacts/night-adapt/MSB8-bagua-R1S88974978.js' };
const EPS_TIER_ID = FLAG['eps-tier'] || 'lv:regular';   // = Bots.DIFF_DEFAULT（沙箱还没装，且它将来挪了 subjectSel 会响亮报错）
const t0 = Date.now();

/* ===== 沙箱与引擎（与 eval-5p 同一份装载清单） ===== */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
const W = sb.window, P = W.EpirusPolicy, S = W.EpirusState, R0 = W.EpirusRules, T = W.EpirusTrainer, Bots = W.EpirusBots;
const asChooser = makeAsChooser({ T, R: R0 });

/* 对手：考卷池名字 → Bots 函数（EXAM_FN 已在 opp-pool 里做过"没登记就抛错"的守卫；v1 的两席同样在 OPP_SPECS 里） */
const FN = {};
for (const o of OPP_SPECS) FN[o.name] = Bots[o.fn];
for (const e of POOL) if (typeof FN[e.name] !== 'function') { console.error('⛔ 考卷池 ' + POOL_STAMP + ' 的 ' + e.name + ' 取不到函数'); process.exit(1); }

/* ===== 冠军包（v7 / 2.0 两种容器都走 P.unpack —— 与 eval-5p 全库同一条装包路） ===== */
const src = readFileSync(FILE, 'utf8');
const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
if (!mm) { console.error('未找到 EPIRUS_CHAMPION_3P: ' + FILE); process.exit(1); }
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('冠军包不兼容: ' + JSON.stringify(P.checkPack(JSON.parse(mm[1])))); process.exit(1); }

/* ===== exam-v2：冠军席（冻结夹具 · 用户 11-09 裁 A）=====
 * 每局把**第一个对手席**换成 champion（自适应），其余仍是脚本 ⇒ 反射墙再也不能靠「脚本互相消耗」farm。
 * N=2 时隔局换（否则 N=2 变成纯 1v1）；缺省 --champ 空 ⇒ 与 v1 逐位相同。 */
const CHAMP_CHOOSERS = CHAMP_IDS.map(function (id) {
  const p2 = CHAMP_PATHS[id];
  if (!p2) { console.error('⛔ --champ 里有不认识的 id：' + id + '（在册：' + Object.keys(CHAMP_PATHS).join(',') + '）'); process.exit(2); }
  const s2 = readFileSync(p2, 'utf8');
  const m2 = s2.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m2) { console.error('⛔ 冠军席包读不出 EPIRUS_CHAMPION_3P：' + p2); process.exit(2); }
  const par2 = P.unpack(JSON.parse(m2[1]), true);
  if (!par2) { console.error('⛔ 冠军席包不兼容：' + p2 + ' ⇒ ' + JSON.stringify(P.checkPack(JSON.parse(m2[1])))); process.exit(2); }
  return T.policyChooserN(par2, 0.15);
});

/* ===== 主体席 chooser：考卷臂（ε=0）或页面剂量（DIFF_TIERS 那一档 + 回合斜坡） ===== */
function subjectSel() {
  if (DOSE === 'exam') return T.policyChooserN(params, 0.15);
  const tier = (Bots.DIFF_TIERS || []).find(function (x) { return x.id === EPS_TIER_ID; });
  if (!tier) { console.error('⛔ --eps-tier=' + EPS_TIER_ID + ' 不在 DIFF_TIERS（在册：' + (Bots.DIFF_TIERS || []).map(function (x) { return x.id; }).join(' ‖ ') + '）'); process.exit(2); }
  const mk = function (e) { return e > 0 ? T.policyChooserN(params, 0.15, e, tier.epsK, tier.epsMode) : T.policyChooserN(params, 0.15); };
  const byRound = { 1: mk(Bots.tierEps(tier, 1)), 2: mk(Bots.tierEps(tier, 2)), 3: mk(Bots.tierEps(tier, 3)) };
  return function (state, id, legal) { return byRound[Math.min(3, state.round)](state, id, legal); };
}
/* ===== 四格对局：按「轴」跑 ===== 
 *   A 轴 = 脚本桌（champN=0，与 v1 逐位相同）‖ B 轴 = 冠军桌（champN=N−1，对手席全换冠军）。
 *   --exam=A|B|both；both 先跑 A 再跑 B，[冠军4N] 仍是 A（旧解析器不受影响），B 用 [冠军4N-B]，组合分用 [冠军4N-v2]。 */
if (CHAMP_CHOOSERS.length) console.error('[exam-v2] 冠军席 = ' + CHAMP_IDS.join(','));
const SUBJ = subjectSel();
function evalAxis(champN) {
const out = {};
for (const n of NS) {
  const plan = (FLAG.plan === 'v3') ? planN3(n, R, SEED, POOL) : planN(n, R, SEED, POOL);
  let first = 0;
  const seatFirst = new Array(n).fill(0), seatGames = new Array(n).fill(0);
  for (let j = 0; j < plan.length; j++) {
    const seat = j % n;
    const rot = j % (n - 1);
    const field = plan[j].seats.slice(rot).concat(plan[j].seats.slice(0, rot));   // 对手槽相对座位旋转（解耦座位率×脚本强度）
    const choosers = [];
    let oi = 0;
    const sel = SUBJ;                                                            // 考卷臂(ε=0) 或 页面剂量；见 subjectSel()
    for (let pid = 0; pid < n; pid++) {
      if (pid === seat) { choosers.push(sel); continue; }
      /* exam-v2：第一个对手席是冠军（自适应）；其余是脚本。N=2 时隔局换冠军。 */
      const champSlot = CHAMP_CHOOSERS.length > 0 && oi < Math.min(champN, n - 1);
      choosers.push(champSlot ? CHAMP_CHOOSERS[(j + oi) % CHAMP_CHOOSERS.length] : asChooser(FN[field[oi]]));
      oi++;
    }
    const gseed = SEED + n * 1000003 + j * 977;
    const r = T.oneGameN(choosers, gseed, n, MODE ? { mode: MODE } : undefined);
    const rank = T.rankOf(r.state, seat, gseed);
    if (rank === 1) { first++; seatFirst[seat]++; }
    seatGames[seat]++;
  }
  const G = plan.length;
  const h = first / G * 100;
  const x = (first / G - 1 / n) / (1 - 1 / n);
  out[n] = { h: h.toFixed(2), x: x.toFixed(4), G, first, seatFirst, seatGames };
}
return out;
}
const AXIS = String(FLAG.exam || 'A').toUpperCase();
if (AXIS !== 'A' && AXIS !== 'B' && AXIS !== 'BOTH') { console.error('⛔ --exam 只认 A/B/both，收到 ' + FLAG.exam); process.exit(2); }
if ((AXIS === 'B' || AXIS === 'BOTH') && !CHAMP_CHOOSERS.length) { console.error('⛔ --exam=' + AXIS + ' 需要 --champ=<ids>'); process.exit(2); }
function emit(prefix, o) {
  const fmt = (k) => NS.map((n) => k + n + '=' + o[n][k === 'h' ? 'h' : 'x']).join(' ');
  const fmtN = () => NS.map((n) => 'n' + n + '=' + o[n].G).join(' ');
  console.log(prefix + ' ' + fmt('h') + ' ' + fmt('x') + ' ' + fmtN() + ' sec=' + ((Date.now() - t0) / 1000).toFixed(1) + (MODE ? ' mode=' + MODE : '') + ' dose=' + DOSE + (DOSE === 'page' ? ':' + EPS_TIER_ID : '') +
    ' pool=' + POOL_STAMP + ' K=' + POOL.length +
    /* 11-10（千问）：同一张池可以配两种抽席规则、也可以配带不带冠军席 ⇒ **只钉池的那枚戳不足以判"是不是同一把尺"**
     *   （v3 分层卷与 v2 老规则同池 ⇒ 戳逐字相同）。把会换尺的另两维一并印出来，批量器与表都能按它筛。 */
    ' plan=' + (FLAG.plan || 'v2') + ' champ=' + (CHAMP_IDS.length ? CHAMP_IDS.join('+') + 'x' + CHAMP_N : '0'));   // ← 考卷版本戳：两版池的读数不许混进同一张表（11-09 换席事故的直接补丁）
  for (const n of NS) { const q = o[n]; console.error('  N=' + n + ': ' + q.first + '/' + q.G + ' 夺1 ‖ 各座 ' + q.seatFirst.map((f, i) => f + '/' + q.seatGames[i]).join(' ') + ''); }
}
if (AXIS === 'A') emit('[冠军4N]', evalAxis(0));
else if (AXIS === 'B') emit('[冠军4N-B]', evalAxis(Number.MAX_SAFE_INTEGER));
else {
  const a = evalAxis(0), b = evalAxis(Number.MAX_SAFE_INTEGER);
  emit('[冠军4N]', a); emit('[冠军4N-B]', b);
  const mix = {}; for (const n of NS) mix[n] = { h: ((+a[n].h + +b[n].h) / 2).toFixed(2), x: ((+a[n].x + +b[n].x) / 2).toFixed(4), G: a[n].G };
  emit('[冠军4N-v2]', mix);
}
