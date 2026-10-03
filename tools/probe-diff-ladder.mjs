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
 *
 * ⚠ 引用它的读数必须带四样（§E272/第 45 条）：**装配（人数 × 血量）+ 用哪颗包 + 替身是模型不是真人 + 这是绝对电平不是配对差**。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sandbox, mulberry32, ROOT, extractJsonObject, rejectUnknownFlags } from './audit-lib.mjs';
import { loadPool, makeMimic } from './human-pool.mjs';
import { loadChampParams } from '../server/opp-champs.mjs';

/* 仓规（门 D218）：不认识的 `--` 旗标必须**响亮失败** —— 静默忽略会让"我以为控制住了这个变量"变成假读数。 */
rejectUnknownFlags(process.argv.slice(2), ['tiers', 'games', 'n', 'mode', 'pack', 'seed', 'tgt', 'extra',
  'quiet', 'machine', 'minGap', 'except', 'exceptMin'], 'probe-diff-ladder');

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
const params3p = loadChampParams(POOL, join(ROOT, 'js/bundled-champion-3p.js'));
let params2p = null;
try {
  const j2 = extractJsonObject(readFileSync(join(ROOT, 'js/bundled-champion.js'), 'utf8'), 'window.EPIRUS_CHAMPION', '_META');
  if (j2) params2p = POOL.unpack(JSON.parse(j2), true) || null;
} catch (e) { params2p = null; }

/* 档位 = `DIFF_TIERS` 本身（单一来源）。`--pack=` 只影响"用哪颗包"，不改档定义。 */
let LEVELS = (Bots.DIFF_TIERS || []).slice();
if (ONLY.length) LEVELS = LEVELS.filter(t => ONLY.indexOf(t.id) >= 0);
if (ONLY.length && !LEVELS.length) { console.error('⛔ --tiers 一个都没匹配上（在册：' + (Bots.DIFF_TIERS || []).map(t => t.id).join(',') + '）'); process.exit(2); }
/* 研究用的额外剂量行（不参与分级判定，只在标签上标 [extra]） */
String(flag('extra', '') || '').split(',').filter(Boolean).forEach(function (spec) {
  const p = spec.split(':');
  if (p.length < 2) return;
  LEVELS.push({
    id: 'x:' + spec, name: '[extra] ε=' + p[0] + '/k' + p[1] + (p[2] ? '/' + p[2] : ''),
    kind: 'champ', eps: Number(p[0]), epsK: Number(p[1]), epsMode: p[2] || 'soft', ramp: p[3] === 'ramp'
  });
});

function affordableFirst(legal) {
  const base = (legal || []).filter(l => l && l.affordable);
  return base.length ? base : [{ key: R.SK.JI, affordable: true }];
}
/* 2 人桌换包的理由见 `DIFF_TIERS` 上面那段（§E286 实测：3P 那颗在 1v1 上是分布外的，剂量梯还反号）。 */
function packFor(n) {
  if (PACK === '3p') return { p: params3p, tag: '3P' };
  if (PACK === '2p') return { p: params2p || params3p, tag: params2p ? '2P' : '3P(2P 槽缺失)' };
  if (n > 2) return { p: params3p, tag: '3P' };
  return { p: params2p || params3p, tag: params2p ? '2P' : '3P(2P 槽缺失)' };
}
const pk = packFor(N);
if (!pk.p) { console.error('⛔ 冠军包解不开（2P/3P 都不兼容）⇒ 这把尺没有所指'); process.exit(2); }
const humanPool = loadPool(W, 'human');   // 读一次文件（每局重读会把仪器自己变成 I/O 瓶颈）

function makeLevelChooser(L) {
  if (L.kind === 'style') {
    const st = (Bots.STYLES || []).find(x => x.id === L.style);
    if (!st) { console.error('⛔ 风格不在册: ' + L.style); process.exit(2); }
    const wrapped = T.wrapBigTPush(st.pick);
    return function (state, pid, legal) { return wrapped(state, pid, legal); };
  }
  return function (state, pid, legal) {
    /* 这条斜坡与 `ui.js` 那条**逐字同形**（D153 钉 ui.js 的那一份；这里改了不响门 ⇒ 两者一旦不一致，本工具的数就不再是页面的数，
     *   记在 METHODOLOGY 的"两根锚点必须一起看"那条下面）。 */
    const e = L.ramp ? (state.round <= 1 ? 0 : (state.round === 2 ? 0.1 : L.eps)) : L.eps;
    return T.pickChampion(state, pid, affordableFirst(legal), pk.p, 0.15, e, L.epsK, L.epsMode);
  };
}

const win = {}, rows = [];
const t0 = Date.now();
for (const L of LEVELS) win[L.id] = [];
for (const L of LEVELS) {
  const chooser = makeLevelChooser(L);
  let sumR = 0, bigT = 0, drain = 0, wins = 0;
  for (let g = 0; g < GAMES; g++) {
    const rng = mulberry32(SEED + g * 7919);
    const mrng = mulberry32(SEED + 555 + g * 104729);
    const st = S.createState(MODE, { next: rng }, N);
    st.slotSalt = (Math.floor(rng() * 4294967296)) >>> 0;
    const refSeat = g % N;
    const mimic = makeMimic(W, humanPool, TGT, mrng);
    const cs = [];
    for (let pid = 0; pid < N; pid++) cs.push(pid === refSeat ? mimic : chooser);
    Play.autoGameN(st, cs);
    win[L.id].push(st.winner === refSeat ? 1 : 0);
    if (st.winner === refSeat) wins++;
    sumR += st.round;
    for (const e of st.events) {
      if (e.type !== 'action' || e.outcome !== 'ok') continue;
      if (e.key === R.SK.BIG_T) bigT++; else if (e.key === R.SK.DRAIN) drain++;
    }
  }
  rows.push({ id: L.id, label: L.name, pct: 100 * wins / GAMES, avgR: sumR / GAMES, bigT: bigT / GAMES, drain: drain / GAMES });
}
function pairedDiff(a, b) {
  const A = win[a], B = win[b], d = [];
  const m = Math.min(A.length, B.length);
  for (let i = 0; i < m; i++) d.push(A[i] - B[i]);
  if (!m) return null;
  const mean = d.reduce((s, x) => s + x, 0) / m;
  let v = 0; for (const x of d) v += (x - mean) * (x - mean);
  const se = Math.sqrt(v / Math.max(1, m - 1) / m);
  return { m: 100 * mean, ci: 100 * 1.96 * se, n: m };
}

rows.sort((a, b) => a.pct - b.pct);
const head = '难度阶梯 · 1 席人类替身(' + TGT + ') vs ' + (N - 1) + ' 席同档 AI · n=' + N + ' · mode=' + MODE +
  ' · 包=' + pk.tag + ' · ' + GAMES + ' 局/档 · 同批种子（跨档逐局配对）· 上线档带大雷/摄魂注入 · 替身夺冠越低=越强';
if (QUIET) {
  /* --quiet 只印机器可读的一行（门用它做"阶梯确实分级"的判定，不靠措辞） */
  console.log(JSON.stringify({ n: N, mode: MODE, pack: pk.tag, games: GAMES, rows: rows.map(r => ({ id: r.id, pct: +r.pct.toFixed(2), avgR: +r.avgR.toFixed(1) })) }));
} else {
  console.log(head);
  const ref = (LEVELS.find(function (L) { return L.id === Bots.DIFF_DEFAULT; }) || {}).id || rows[0].id;
  for (const r of rows) {
    const pd = r.id !== ref ? pairedDiff(r.id, ref) : null;
    console.log('  ' + r.label.padEnd(24) + ' 替身夺冠 ' + r.pct.toFixed(1) + '%  · 局长 ' + r.avgR.toFixed(1) +
      ' 回合 · 大雷 ' + r.bigT.toFixed(2) + ' 张/桌 · 摄魂 ' + r.drain.toFixed(2) + ' 张/桌' +
      (pd ? '  · 与『' + ref + '』配对差 ' + (pd.m >= 0 ? '+' : '') + pd.m.toFixed(2) + ' ±' + pd.ci.toFixed(2) + 'pt' : '  ← 默认档'));
  }
  console.log('  耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
if (machine) {
  /* 分级判定（门用）：按"替身夺冠率"**从难到易**排开后，相邻档差必须 ≥ MIN_GAP，且默认档必须存在。
   * ⚠ 阈值是可谈判的，但**不许静默放宽**：改这里要连 CHANGELOG 一起改。
   * `--except=a>b`（逗号分隔多对）= **点名**某一对相邻档只要求"不许翻序"（差 ≥ `--exceptMin`，默认 0）。
   *   为什么需要这个口子：§E286 实测"贪心冠军 vs 默认档"在 5 人 3 血桌上只差 −1.53±2.36pt ⇒ 那一步**次序对、分不开**。
   *   与其把全局阈值压到 1.5 以下（那样入门/普通那一步也一起免检了），不如把松的地方写进名单、别处照旧严。 */
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
