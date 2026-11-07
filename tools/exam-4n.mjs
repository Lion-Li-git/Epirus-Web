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
 * 用法: node tools/exam-4n.mjs [rounds=6] [seed=77000] <冠军文件> [--mode=multi] [--onlyN=2,3,5,8] [--dose=exam|page] [--eps-tier=lv:regular]
 * --dose=exam（缺省）：主体席 ε=0 贪心 —— 与旧卷的 exam 臂、与 `exam4-all-*.tsv` 那两批同口径（H 侧）。
 * --dose=page：主体席按**页面剂量**出手（`DIFF_TIERS` 那档的 ε/epsK/epsMode + 回合斜坡，默认 `lv:regular`）
 *   —— 这才是「玩家默认拿到的那个数」（Hp 侧）。斜坡形状走 `Bots.tierEps`，**不在这里再写一遍**（D153 只许一份）。
 * 输出: [冠军4N] h2=..% h3=..% h5=..% h8=..% x2=... x3=... x5=... x8=... n2=.. n3=.. n5=.. n8=.. sec=..
 *   （h 缺格子不会出现：planN 对每个 N 都有局；--onlyN 只用于调试，正式读数四格必须齐）
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { OPP_SPECS, EXAM_POOL } from '../server/opp-pool.mjs';
import { planN } from './exam-pool.mjs';
import { makeAsChooser } from './bot-chooser-lib.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const ARGV = process.argv.slice(2).filter((a) => !/^--/.test(a));
const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a);
  if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2];
}
rejectUnknownFlags(process.argv.slice(2), ['mode', 'onlyn', 'dose', 'eps-tier'], 'exam-4n');
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

/* 对手：EXAM_POOL 名字 → Bots 函数（EXAM_FN 已在 opp-pool 里做过"没登记就抛错"的守卫） */
const FN = {};
for (const o of OPP_SPECS) FN[o.name] = Bots[o.fn];
for (const e of EXAM_POOL) if (typeof FN[e.name] !== 'function') { console.error('⛔ EXAM_POOL 的 ' + e.name + ' 取不到函数'); process.exit(1); }

/* ===== 冠军包（v7 / 2.0 两种容器都走 P.unpack —— 与 eval-5p 全库同一条装包路） ===== */
const src = readFileSync(FILE, 'utf8');
const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
if (!mm) { console.error('未找到 EPIRUS_CHAMPION_3P: ' + FILE); process.exit(1); }
const params = P.unpack(JSON.parse(mm[1]), true);
if (!params) { console.error('冠军包不兼容: ' + JSON.stringify(P.checkPack(JSON.parse(mm[1])))); process.exit(1); }

/* ===== 主体席 chooser：考卷臂（ε=0）或页面剂量（DIFF_TIERS 那一档 + 回合斜坡） ===== */
function subjectSel() {
  if (DOSE === 'exam') return T.policyChooserN(params, 0.15);
  const tier = (Bots.DIFF_TIERS || []).find(function (x) { return x.id === EPS_TIER_ID; });
  if (!tier) { console.error('⛔ --eps-tier=' + EPS_TIER_ID + ' 不在 DIFF_TIERS（在册：' + (Bots.DIFF_TIERS || []).map(function (x) { return x.id; }).join(' ‖ ') + '）'); process.exit(2); }
  const mk = function (e) { return e > 0 ? T.policyChooserN(params, 0.15, e, tier.epsK, tier.epsMode) : T.policyChooserN(params, 0.15); };
  const byRound = { 1: mk(Bots.tierEps(tier, 1)), 2: mk(Bots.tierEps(tier, 2)), 3: mk(Bots.tierEps(tier, 3)) };
  return function (state, id, legal) { return byRound[Math.min(3, state.round)](state, id, legal); };
}
/* ===== 四格对局 ===== */
const out = {};
const SUBJ = subjectSel();
for (const n of NS) {
  const plan = planN(n, R, SEED);
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
      if (pid === seat) choosers.push(sel);
      else choosers.push(asChooser(FN[field[oi++]]));
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
const fmt = (k) => NS.map((n) => k + n + '=' + out[n][k === 'h' ? 'h' : 'x']).join(' ');
const fmtN = () => NS.map((n) => 'n' + n + '=' + out[n].G).join(' ');
console.log('[冠军4N] ' + fmt('h') + ' ' + fmt('x') + ' ' + fmtN() + ' sec=' + ((Date.now() - t0) / 1000).toFixed(1) + (MODE ? ' mode=' + MODE : '') + ' dose=' + DOSE + (DOSE === 'page' ? ':' + EPS_TIER_ID : ''));
for (const n of NS) {
  const o = out[n];
  console.error('  N=' + n + ': ' + o.first + '/' + o.G + ' 夺1 ‖ 各座 ' + o.seatFirst.map((f, i) => f + '/' + o.seatGames[i]).join(' ') + '');
}
