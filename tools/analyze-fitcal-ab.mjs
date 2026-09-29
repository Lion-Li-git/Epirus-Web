#!/usr/bin/node
/* ============================================================================
 * analyze-fitcal-ab.mjs —— §E146 的判读器：`EPIRUS_FIT_CAL`（fit 胜率项口径对齐）六臂 A/B
 *
 * 预注册在 `docs/RESEARCH-LOG-2026-09-28-qoder.md` §E146（13:58 写死，早于任何臂落盘）。本文件只做两件被写死的事：
 *   **H1（主判据 · 该不该换手）** = `cal1 − cal0` 在 **5P 产品考卷**上的**逐桌子配对**夺冠率差（`--every=7` 的确定性格点抽样
 *     ⇒ 同 seed 两臂面对逐位相同的桌子），按 seed 各出一遍 + 合并一遍；三 seed 必须同号（反巧合条款 ①）。
 *   **H2（与头号目标相关 · 换手会不会更"专才"）** = 每臂在 **33 个原型环境**上的夺冠率剖面：
 *     ① 极差 `max − min`（越大越偏科）② 逐环境配对的 `cal1 − cal0` ③ 最差环境。
 *     ⚠ 判"更专才"只看 ①，不看 `oracle − best_single`（那是"存在专才"，属环境侧、不属本臂）。
 *
 * ⚠ 三条口径红线（都是本仓交过学费的地方，写在这里而不是等门来抓）：
 *   1) **两臂的 `bestFit` 数值不可比** —— 开了对齐就是把整把尺换掉（§E146 第 2 节）。本文件**不接受** fit 类输入，只吃夺冠计数。
 *   2) 配对成立的前提是"同一批桌子"：这里对**逐行名字序列**做硬校验，不一致直接 exit 5（不是警告）
 *      —— §E136 那套 `analyze-swap-gain` 的规矩搬过来；`pickRandom` 对照行也必须**逐字相同**（§E139 的配对自检）。
 *   3) 配对算式一律走 `tools/routing-gain-lib.mjs` 的 `pairedDiff`（**别在这里再写一份 SE**，门 D193/D198 的同族教训）。
 *
 * 用法：
 *   node tools/analyze-fitcal-ab.mjs --dir=docs/artifacts/e146-out --seeds=7,31,77 [--prefix=cal] [--z=1.96] [--rule=on]
 *     H1 读 `<dir>/calK-sS.tsv`（`eval-5p --dump-per` 的逐桌子账）
 *     H2 读 `<dir>/calK-sS.env.tsv`（`probe-5p-envfit --out` 的逐环境账）—— 缺文件只降级 H2，不动 H1
 * ==========================================================================*/
import { readFileSync, existsSync } from 'node:fs';
import { pairedDiff } from './routing-gain-lib.mjs';
/* 仓规 v1.5.234：不认识的 `--` 参数必须**响亮失败**（exit 64）。
 * 对这把尺尤其重要：`--envdir` 打错会被当成"没给"⇒ 静默走默认目录，读到的可能不是同一批产物；
 * 而 `--seeds` 打错会退回默认三档 ⇒ 报出来的"三 seed 同号"其实不是我指定的那三档。 */
import { rejectUnknownFlags } from './audit-lib.mjs';

const arg = (k, d) => { const m = process.argv.find(a => a.startsWith('--' + k + '=')); return m ? m.slice(k.length + 3) : d; };
rejectUnknownFlags(process.argv.slice(2), ['dir', 'envdir', 'seeds', 'prefix', 'z', 'rule'], 'analyze-fitcal-ab');
const DIR = arg('dir', 'docs/artifacts/e146-out');
/* H2 的逐环境账单独一个目录：`analyze-5p-envfit.mjs` 是"把目录里所有 .tsv 当包"的，
 *   与 H1 的 `--dump-per` 账（同扩展名、不同格式）**混在一个目录里就会互相读错**。 */
const ENVDIR = arg('envdir', DIR + '/env');
const SEEDS = String(arg('seeds', '7,31,77')).split(',').map(Number);
const PREFIX = arg('prefix', 'cal');
const Z = Number(arg('z', 1.96));
const RULE = arg('rule', 'on');
if (!existsSync(DIR)) { console.error('目录不存在: ' + DIR); process.exit(2); }
for (const s of SEEDS) if (!Number.isFinite(s)) { console.error('--seeds 里有非数字: ' + arg('seeds', '')); process.exit(2); }
if (!(SEEDS.length >= 1)) { console.error('--seeds 至少一个（零个 ⇒ 一条配对都没有，不许当"分不出"）'); process.exit(2); }

const bad = (msg) => { console.error('⛔ ' + msg + '\n⇒ 配对不成立就不是"读数接近 0"，而是**这批产物不能比** —— 拒绝出判据。'); process.exit(5); };

/* ---------- 读 eval-5p 的逐桌子落盘（`--dump-per`）---------- */
function readPer(p) {
  const txt = readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.length);
  const head = {}; let hdrCols = null; const rows = [];
  for (const l of txt) {
    if (l[0] === '#') {
      if (/^#arm\t/.test(l)) hdrCols = l.slice(1).split('\t');
      else { const i = l.indexOf('='); if (i > 0) head[l.slice(1, i)] = l.slice(i + 1); }
      continue;
    }
    const c = l.split('\t');
    const o = {}; hdrCols.forEach((k, i) => { o[k] = c[i]; });
    rows.push(o);
  }
  if (!hdrCols) bad(p + ' 里没有 `#arm  idx  names  games  first  strict` 表头（落盘格式变了？）');
  const pick = (arm) => rows.filter(r => r.arm === arm).map(r => ({
    idx: Number(r.idx), names: r.names, games: Number(r.games), first: Number(r.first), strict: Number(r.strict)
  }));
  return { head: head, subject: pick('subject'), ctrl: pick('ctrl') };
}

function rates(a) { return a.map(r => (r.games > 0 ? r.first / r.games : NaN)); }
const pct = x => (100 * x).toFixed(2) + '%';
const pt = x => (100 * x).toFixed(2) + 'pt';
/* ⚠ helper 必须**声明在使用之前**：第一版把 `const mean = …` 写在 H2 里使用点之后 ⇒ ESM 里是 TDZ，
 *   结果是 H1 全部印完、才在 H2 第一行炸 —— **崩在成品报告中间比不跑更坏**（前半截读数会被抄走而后半截根本没有）。
 *   现在这行提到顶部，并在末尾留了一条"自检跑一遍"的注释。 */
const mean = function (a) { return a.reduce((x, y) => x + y, 0) / a.length; };

/* ---------- H1 ---------- */
console.log('# §E146 判读 · 预注册见 RESEARCH-LOG §E146（H1 主判据 = 产品考卷配对夺冠率差；三 seed 必须同号）');
const perSeed = [];
const pooledA = [], pooledB = [];
for (const s of SEEDS) {
  const f0 = DIR + '/' + PREFIX + '0-s' + s + '.tsv', f1 = DIR + '/' + PREFIX + '1-s' + s + '.tsv';
  if (!existsSync(f0) || !existsSync(f1)) { console.error('缺臂产物：' + (existsSync(f0) ? '' : f0) + ' ' + (existsSync(f1) ? '' : f1)); process.exit(2); }
  const a = readPer(f0), b = readPer(f1);
  /* 硬校验 ①：同一批桌子（逐行组合名序列 + 每行局数 + 评测 seed/every/games 都要一致） */
  if (a.subject.length !== b.subject.length) bad('seed=' + s + ' 两臂行数不同（' + a.subject.length + ' vs ' + b.subject.length + '）');
  for (let i = 0; i < a.subject.length; i++) {
    if (a.subject[i].names !== b.subject[i].names) bad('seed=' + s + ' 第 ' + i + ' 张桌子组合不同：`' + a.subject[i].names + '` vs `' + b.subject[i].names + '`');
    if (a.subject[i].games !== b.subject[i].games) bad('seed=' + s + ' 第 ' + i + ' 张桌子局数不同（' + a.subject[i].games + ' vs ' + b.subject[i].games + '）');
  }
  for (const k of ['seed', 'every', 'games', 'n', 'pool']) {
    if (String(a.head[k]) !== String(b.head[k])) bad('seed=' + s + ' 头部 `#' + k + '` 不同（' + a.head[k] + ' vs ' + b.head[k] + '）⇒ 两臂不是同一张考卷');
  }
  if (a.head.file === b.head.file) bad('seed=' + s + ' 两臂的 `#file` 相同（' + a.head.file + '）⇒ 把同一粒包当两臂比了，多半是命名串了');
  /* 硬校验 ②：pickRandom 对照必须逐字相同（§E139 的配对成立证据；不同 = 桌子或 rng 流漂了） */
  if (JSON.stringify(a.ctrl) !== JSON.stringify(b.ctrl)) {
    let diffAt = -1; for (let i = 0; i < Math.min(a.ctrl.length, b.ctrl.length); i++) if (a.ctrl[i].first !== b.ctrl[i].first) { diffAt = i; break; }
    bad('seed=' + s + ' pickRandom 对照行不一致（首个不同在第 ' + diffAt + ' 桌）⇒ 配对不成立');
  }
  const d = pairedDiff(rates(b.subject), rates(a.subject), Z);
  if (!d) bad('seed=' + s + ' 配对样本不足（n<2）');
  const mean0 = rates(a.subject).reduce((x, y) => x + y, 0) / a.subject.length;
  const mean1 = rates(b.subject).reduce((x, y) => x + y, 0) / b.subject.length;
  perSeed.push({ s, d, mean0, mean1, tables: a.subject.length, ctrlWin: rates(a.ctrl).reduce((x, y) => x + y, 0) / a.ctrl.length });
  pooledA.push(...rates(b.subject)); pooledB.push(...rates(a.subject));
}
console.log('\n## H1 · 产品考卷（5P，`--every=7` 确定性格点 ⇒ 同 seed 同桌子）');
for (const r of perSeed) {
  console.log('  seed=' + r.s + '（' + r.tables + ' 桌 × 配对）：cal0 ' + pct(r.mean0) + ' ‖ cal1 ' + pct(r.mean1) +
    ' ⇒ **配对差 ' + pt(r.d.m) + ' [' + pt(r.d.lo) + ', ' + pt(r.d.hi) + ']**  n=' + r.d.n +
    ' ‖ cal1 更好/持平/更差 = ' + r.d.better + '/' + r.d.tie + '/' + r.d.worse +
    ' ‖ pickRandom 基线 ' + pct(r.ctrlWin));
}
const pooled = pairedDiff(pooledA, pooledB, Z);
const signs = perSeed.map(r => Math.sign(r.d.m));
const sameSign = signs.every(x => x === signs[0] && x !== 0);
console.log('  合并（三对差值进同一个样本池，桌子按 seed 重复；沿用 §E140 的合并口径）：**' + pt(pooled.m) +
  ' [' + pt(pooled.lo) + ', ' + pt(pooled.hi) + ']**  n=' + pooled.n);
console.log('  反巧合条款①（三 seed 同号）：**' + (sameSign ? '通过（同号 ' + (signs[0] > 0 ? '正' : '负') + '）**' : '**不通过 ⇒ 判"不稳"，不许取对自己有利的那一侧**') + '（逐 seed 符号 ' + signs.join('/') + '）');
if (RULE === 'on') {
  const cross = pooled.lo <= 0 && pooled.hi >= 0;
  console.log('  ⇒ H1 判读：' + (cross
    ? '合并区间**跨 0** ⇒ 判"分不出"（按 §E146 第 6 节，最多只允许再补一批 seed，且不许多扫剂量）'
    : (pooled.m > 0 ? '合并区间在 0 之上' + (sameSign ? '且三 seed 同号 ⇒ 判"值得换手"' : '但 seed 不同号 ⇒ 仍判不稳') : '合并区间在 0 之下' + (sameSign ? '且三 seed 同号 ⇒ 判"别换手"' : '但 seed 不同号 ⇒ 仍判不稳'))));
}

/* ---------- H2 ---------- */
console.log('\n## H2 · 环境剖面（专才度只看**每臂自己的极差**；构造 `#mix` 从产物头读，两臂必须相同）');
const prof = [];
for (const s of SEEDS) {
  const f0 = ENVDIR + '/' + PREFIX + '0-s' + s + '.tsv', f1 = ENVDIR + '/' + PREFIX + '1-s' + s + '.tsv';
  if (!existsSync(f0) || !existsSync(f1)) { console.log('  seed=' + s + '：缺逐环境账（' + (existsSync(f0) ? '' : f0) + ' ' + (existsSync(f1) ? '' : f1) + '）⇒ H2 这一档降级为"未量"（不影响 H1）'); continue; }
  const A = readEnv(f0), B = readEnv(f1);
  if (String(A.head.mix) !== String(B.head.mix)) bad('seed=' + s + ' 两臂的 `#mix` 不同（' + A.head.mix + ' vs ' + B.head.mix + '）⇒ 一桌几席原型都不一样，不是同一种环境');
  if (A.envs.join('|') !== B.envs.join('|')) bad('seed=' + s + ' H2 两臂的环境名单/顺序不同 ⇒ 逐环境配对不成立');
  const va = A.envs.map(e => A.byEnv[e]), vb = B.envs.map(e => B.byEnv[e]);
  const spreadA = Math.max(...va) - Math.min(...va), spreadB = Math.max(...vb) - Math.min(...vb);
  const dd = pairedDiff(vb, va, Z);
  prof.push({ s, meanA: mean(va), meanB: mean(vb), spreadA, spreadB, d: dd, worstA: minEnv(A), worstB: minEnv(B), nEnv: A.envs.length });
  console.log('  seed=' + s + '（' + A.envs.length + ' 个环境 · mix=' + A.head.mix + '）：cal0 均 ' + pct(mean(va)) + ' 极差 ' + pt(spreadA) +
    ' ‖ cal1 均 ' + pct(mean(vb)) + ' 极差 ' + pt(spreadB) + ' ⇒ **极差之差 ' + pt(spreadB - spreadA) + '**' +
    '（判"更专才"要它 > 0）‖ 逐环境配对差 ' + pt(dd.m) + ' [' + pt(dd.lo) + ', ' + pt(dd.hi) + ']');
  console.log('     最差环境：cal0 `' + A.envs[va.indexOf(Math.min(...va))] + '` ' + pct(Math.min(...va)) +
    ' ‖ cal1 `' + B.envs[vb.indexOf(Math.min(...vb))] + '` ' + pct(Math.min(...vb)));
}
if (prof.length) {
  const spA = prof.map(p => p.spreadA), spB = prof.map(p => p.spreadB);
  const bigger = prof.filter(p => p.spreadB > p.spreadA).length;
  console.log('  ⇒ H2 判读：极差 cal0 平均 ' + pt(mean(spA)) + ' ‖ cal1 平均 ' + pt(mean(spB)) +
    ' ⇒ **' + (mean(spB) > mean(spA) ? 'cal1 更偏科（但偏科 ≠ 更好，兑现要靠赛前选人）' : 'cal1 没有更偏科') + '**；逐 seed ' + bigger + '/' + prof.length + ' 支变大');
} else console.log('  （没有任何一档 H2 产物 ⇒ 专才度这半边没量到，不许用 H1 代替它）');

function readEnv(p) {
  const txt = readFileSync(p, 'utf8').split(/\r?\n/).filter(l => l.length);
  const head = {}; const order = []; const byEnv = {}; const games = {};
  for (const l of txt) {
    if (l[0] === '#') { const i = l.indexOf('='); if (i > 0 && !/\t/.test(l)) head[l.slice(1, i)] = l.slice(i + 1); continue; }
    const c = l.split('\t');
    const env = c[0], seed = c[1], g = Number(c[3]), first = Number(c[4]);
    if (!(env in byEnv)) { byEnv[env] = 0; games[env] = 0; order.push(env); }
    byEnv[env] += first; games[env] += g;      // 同环境跨 seed 档合并（先求和再相除，避免等权平均）
  }
  for (const e of order) byEnv[e] = games[e] ? byEnv[e] / games[e] : NaN;
  if (order.length < 10) bad(p + ' 只读出 ' + order.length + ' 个环境（<10 ⇒ 剖面不是 §E142 那张名单，拒算极差）');
  return { envs: order, byEnv: byEnv, head: head, games: games };
}
function minEnv(A) { const es = A.envs; let b = es[0]; for (const e of es) if (A.byEnv[e] < A.byEnv[b]) b = e; return b; }
console.log('\n# 交叉核对建议：`node tools/analyze-5p-envfit.mjs --dir=' + DIR + ' --rule=off` 算这 6 粒之间的 oracle−best_single（那是"存在专才"，不是"本臂更专才"）。');
