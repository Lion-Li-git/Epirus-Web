#!/usr/bin/env node
/* ============================================================================
 * probe-pool-frontier.mjs — 「池子前沿」量具（v1.5.249 · Qoder 09-26 下午）
 *
 * 它回答一个具体到能被裁定问完的问题：**"宽 + 珠经济闭环 + 抗克制"三样同时成立的包，
 * 在这个池子里到底有几粒？**（09-26 手工跑过：档案 881 类 → 宽 94 → 宽∩闭环里 G4 不劣于现役的 0 粒，
 * 见 `docs/RESEARCH-LOG-2026-09-26-qoder-night.md` §E42~E46）
 *
 * 三级（全部走真源量具，本工具自己不复算任何一维）：
 *   ① 宽   = `audit-lib.selfPlay` 的两模式 `effSkills`（线的单一来源 = `pick-best.COLLAPSE`… 不，线的数值在本工具参数里，
 *            默认取门禁同源：G≥3、净兑现 ≥ --land-line 默认 2.66=现役实测）
 *   ② 闭环 = `audit-lib.chargeProfile` 的 得珠 / 花珠率（默认 --bead-line 0.5、--gained-line 100）
 *   ③ 抗克 = **spawn 真源 `tools/gate-drafts.mjs`**（`GATE4_GAMES` 默认 300），解析它打进 stdout 的
 *            `G4[<名>/long|multi] … 最克「<脚本>」NN%` 标题行 —— 与 `promote-champion` 解析同一行，不另写一份算法
 *
 * 只读：一个字节都不写仓库（`--stage=1` 连子进程都不开）。样本单位 = **按权重哈希去重的等价类**（METHODOLOGY 62）。
 * ⚠️ 老维包（`FEAT_S ≠ 当前`）**只列不判**（09-26 实测：拿今天的引擎解老维包是另一种行为）。
 * ==========================================================================*/
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sandbox, selfPlay, chargeProfile, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
/* 等价类的定义 = 单一来源（与 probe-regime-fitness 共用） */
import { listArchiveFiles, collectClasses } from './archive-classes.mjs';
/* 三条判据的**单一来源**：门 D164 对同一个模块喂合成行（判据不许在门里再抄一份） */
import { isWide, isClosed, isRobust, frontierOf } from './pool-frontier-lib.mjs';

const FLAGS = ['every', 'limit', 'games', 'land-line', 'bead-line', 'gained-line', 'packs', 'stage', 'incumbent', 'g4-scope', 'g4-chunk', 'rows'];
rejectUnknownFlags(process.argv.slice(2), FLAGS, 'probe-pool-frontier');
const arg = (k, d) => { const m = new RegExp('^--' + k + '=(.*)$').exec(process.argv.find(a => a.startsWith('--' + k + '=')) || ''); return m ? m[1] : d; };

const EVERY = Math.max(1, Number(arg('every', 1)));
const LIMIT = Number(arg('limit', 0));            // 0 = 不分片（全量等价类）
const GAMES = Number(arg('games', 20));
const LAND = Number(arg('land-line', 2.66));      // 净兑现线（默认 = 现役实测值）
const BEAD = Number(arg('bead-line', 0.5));       // 花珠率线
const GAINED = Number(arg('gained-line', 100));   // 得珠线（40 局口径）
const STAGE = Number(arg('stage', 2));            // 1 = 只跑①②（不起子进程，秒级）；2 = 加③抗克
const LIST = arg('packs', '');
const INCUMBENT = arg('incumbent', 'js/bundled-champion-3p.js');

/* ---------- ① + ②：档案去重 + 宽/闭环 ---------- */
const W = sandbox();
/* 等价类的定义**不在这里** —— 与 probe-regime-fitness 共用 archive-classes（METHODOLOGY 62） */
const { classes: ALL_CLASSES, FEAT, counts } = collectClasses(W, listArchiveFiles(LIST), { every: EVERY, limit: LIMIT });
const classes = ALL_CLASSES;
function metricsOf(params) {
  const sm = selfPlay(W, params, 'multi', GAMES), sl = selfPlay(W, params, 'long', GAMES);
  const c = chargeProfile(W, params, 'long', 40);
  return { gMulti: sm.effSkills, gLong: sl.effSkills, landMulti: sm.effSkillsLand, landLong: sl.effSkillsLand,
    gained: c.gained, spentRate: c.spentRate || 0 };
}

console.log('# 池子前沿（' + (FEAT == null ? '?' : FEAT) + ' 维）· 文件 ' + counts.files + ' → 等价类 ' + counts.uniq +
  '（跳过：读不出 ' + counts.skip.read + ' · 无权重 ' + counts.skip.unpack + ' · 2P 壳 ' + counts.skip.twoP +
  ' · 老维包 ' + counts.skip.oldFeat + '）· 本次量 ' + classes.length + ' 类');

const rows = [];
for (const c of classes) {
  let m;
  try { m = metricsOf(c.params); } catch (e) { console.log('  ⚠ 量不出：' + c.file + ' —— ' + e.message); continue; }
  rows.push({ file: c.file, params: c.params, ...m, wide: isWide(m, LAND), closed: isClosed(m, BEAD, GAINED), robust: null });
}
/* ---------- 现役参照（同一把尺） ---------- */
const incParams = loadChamp(W, INCUMBENT);
if (!incParams) { console.error('⛔ 参照包读不出：' + INCUMBENT); process.exit(2); }
const incM = metricsOf(incParams);

/* ---------- ③：抗克 = spawn 真源 gate-drafts，解析它自己的标题行 ----------
 * ⚠️ 范围默认 = **宽∩闭环**（三合一的定义要求两样都成立 ⇒ 别的历史类不需要量）。
 *   第一版我写成"宽 ∪ 闭环"= 99 类，一个进程吃到 60 分钟被超时掐掉 ⇒ 抗克全空、
 *   而"三合一"照样印出 0 —— 那是**缺数据的假 0**。现在：范围收窄 + 分批 + 每批印进度 +
 *   **任一子批失败或"宽∩闭环"里有类没量到读数 ⇒ 响亮失败并非零退出**（见下面的 g4Unmeasured）。 */
const G4_SCOPE = arg('g4-scope', 'intersection');       // intersection（默认）| union | all（臂终评：每一粒都要最克数）
const CH = Number(arg('g4-chunk', 6));                  // 每批几类（~2-3 分钟/批）
/* 抗克范围只写**一次**：`needG4` 与"有没有漏量"的自查必须共用同一个谓词，否则 `--g4-scope=all`
 * 时漏量的那几十粒会被"宽∩闭环都有读数"糊过去（假 0 的第三种形状）。 */
const inG4Scope = r => G4_SCOPE === 'union' ? (r.wide || r.closed) : (G4_SCOPE === 'all' ? true : (r.wide && r.closed));
const needG4 = STAGE >= 2 ? rows.filter(inG4Scope).concat([{ file: INCUMBENT, params: incParams }]) : [];
function runG4Chunk(files) {
  const rr = spawnSync(process.execPath, ['tools/gate-drafts.mjs'].concat(files), { encoding: 'utf8', timeout: 1800000, maxBuffer: 1 << 25 });
  if (rr.status !== 0 && rr.status !== 1) { console.log('  ⛔ gate-drafts 这批异常退出 status=' + rr.status + '（被超时掐掉？）—— 不许把它当"没量到=不合格"'); return null; }
  const g = {};
  /* ⚠️ 标签必须与 `gate-drafts` 自己的打印**逐字同源**：它已经把路径与 `.bak` 剥掉
   *   （`f.replace(/^.*artifacts\//,'').replace(/\.bak$/,'')`），所以这里**不许**再要求标签里带扩展名 ——
   *   第一版我写成 `\.(bak|js)/` ⇒ 一行都匹不上，"抗克全空"被误读成"超时"（09-26 实测）。 */
  for (const ln of String(rr.stdout || '').split('\n')) {
    const m = /^\s*(PASS|FAIL)\s+G4\[(.+)\/(long|multi)\].*?最克「(.+?)」(\d+)%/.exec(ln);
    if (!m) continue;
    (g[m[2]] = g[m[2]] || {})[m[3]] = Number(m[5]);
    (g[m[2]] = g[m[2]] || {})[m[3] + 'S'] = m[4];
  }
  return g;
}
const G4ALL = {};
let chunksRun = 0, chunkFailed = 0;
if (needG4.length) {
  console.log('# 抗克（gate-drafts 真源 · N4=' + (process.env.GATE4_GAMES || 300) + '）范围 = ' + G4_SCOPE + ' ⇒ ' + needG4.length + ' 类，分 ' + Math.ceil(needG4.length / CH) + ' 批 × ' + CH);
  for (let i = 0; i < needG4.length; i += CH) {
    const files = needG4.slice(i, i + CH).map(r => (r.file.indexOf('/') === 0 || existsSync(r.file) ? r.file : 'docs/artifacts/' + r.file));
    const g = runG4Chunk(files);
    chunksRun++;
    if (!g) { chunkFailed++; continue; }
    for (const k of Object.keys(g)) for (const kk of Object.keys(g[k])) (G4ALL[k] = G4ALL[k] || {})[kk] = g[k][kk];
    console.log('  · 批 ' + chunksRun + '（累计 ' + Object.keys(G4ALL).length + ' 类有读数）' + new Date().toTimeString().slice(0, 8));
  }
}
/* 与 gate-drafts 的标签派生**同一行代码**：剥掉到 artifacts/ 的路径 + 剥掉 .bak（其余原样保留） */
function keyOf(f) { return f.replace(/^.*artifacts\//, '').replace(/\.bak$/, ''); }
for (const r of rows) {
  const hit = G4ALL[keyOf(r.file)];
  if (hit && Number.isFinite(hit.long) && Number.isFinite(hit.multi)) { r.g4 = { long: hit.long, multi: hit.multi, script: hit.longS }; }
}
/* 参照必须解析到，否则"抗克"会被悄悄换成绝对线 60 ⇒ 判据变了而输出长得一样（09-26 实测踩过：
 * gate-drafts 把线上槽打印成 `G4[线上包/…]` 而不是文件路径，所以我按路径查就查不到）。 */
function pickRef(g) {
  const cands = [keyOf(INCUMBENT), '线上包'];
  for (const k of cands) { const h = g[k]; if (h && Number.isFinite(h.long) && Number.isFinite(h.multi)) return h; }
  return null;
}
const incG4 = pickRef(G4ALL) || { long: NaN, multi: NaN };
const incRef = { long: incG4.long, multi: incG4.multi };
if (STAGE >= 2 && !(Number.isFinite(incRef.long) && Number.isFinite(incRef.multi))) {
  console.log('\n⛔ 参照（现役）的 G4 没解析到 ⇒ "抗克 = 两模式最克 ≤ 现役"这条判据**无法成立**；'
    + '本工具**不许**退回绝对线 60（那会把判据悄悄换掉而输出看不出来）⇒ 按失败处理');
  process.exitCode = 7;
}
for (const r of rows) if (r.g4 && Number.isFinite(incRef.long)) r.robust = isRobust(r.g4, incRef);

/* ---------- 汇总 ---------- */
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
console.log('\n## 参照：现役 ' + INCUMBENT + '  G ' + incM.gMulti.toFixed(2) + '/' + incM.gLong.toFixed(2) +
  ' · 净兑现 ' + incM.landMulti.toFixed(2) + '/' + incM.landLong.toFixed(2) + ' · 得珠 ' + incM.gained +
  ' · 花珠率 ' + incM.spentRate.toFixed(3) + (Number.isFinite(incRef.long) ? ' · 最克 ' + incRef.long + '/' + incRef.multi : ' · 最克 —'));
console.log('## 判据：宽 = 两模式 G≥3 且 净兑现≥' + LAND + ' ‖ 闭环 = 花珠率≥' + BEAD + ' 且 得珠≥' + GAINED + ' ‖ 抗克 = 两模式最克 ≤ 现役');
const fr = frontierOf(rows, incRef);
/* ⚠️ 假 0 的守门（09-26 实测被自己绊过一次：抗克整批被超时掐掉，"三合一"照样印 0）：
 * 只要**本次抗克范围内**有任一类的抗克没量到 ⇒ 响亮失败 + 非零退出（范围用 `inG4Scope`，与上面同一个谓词）。 */
const noG4 = STAGE >= 2 ? rows.filter(r => inG4Scope(r) && !r.g4).length : 0;
if (STAGE >= 2 && (noG4 > 0 || chunkFailed > 0)) {
  console.log('\n⛔ 抗克未量到 ' + (noG4 + chunkFailed) + ' 处（' + noG4 + ' 类在范围「' + G4_SCOPE + '」内无读数 · ' + chunkFailed + ' 批异常退出）'
    + ' ⇒ **"三合一 = ' + fr.three + '" 这个数不可信，本工具按失败处理**（不许把缺数据读成 0）');
  process.exitCode = 7;
}
console.log('\n## 前沿计数（n=' + fr.n + ' 个等价类）' + (STAGE >= 2 && (noG4 || chunkFailed) ? ' ⛔见上' : ''));
console.log('   宽 ' + fr.wide + ' · 闭环 ' + fr.closed + ' · **宽∩闭环 ' + fr.wideAndClosed + '** · **三合一(宽∩闭环∩抗克) ' + fr.three + '** · 只抗克不宽 ' + fr.robustNotWide);
console.log('   全池中位：得珠 ' + med(rows.map(r => r.gained)) + ' · 花珠率 ' + med(rows.map(r => r.spentRate)).toFixed(2) +
  ' · 花珠率恰好为 0 的 ' + rows.filter(r => r.spentRate === 0).length + ' 粒（' + (100 * rows.filter(r => r.spentRate === 0).length / Math.max(1, fr.n)).toFixed(0) + '%）');
if (STAGE >= 2) {
  const three = rows.filter(r => r.wide && r.closed && r.robust);
  if (three.length) { console.log('\n## 三合一名单：'); for (const r of three) console.log('   ★ ' + r.file + '  最克 ' + r.g4.long + '/' + r.g4.multi + '  G ' + r.gMulti.toFixed(2) + '/' + r.gLong.toFixed(2) + ' 花珠率 ' + r.spentRate.toFixed(2)); }
  const wc = rows.filter(r => r.wide && r.closed).sort((a, b) => ((a.g4 || {}).long || 999) - ((b.g4 || {}).long || 999));
  console.log('\n## 宽∩闭环 按抗克排序（最接近三合一的那几粒离现役多远）');
  for (const r of wc.slice(0, 10)) console.log('   ' + r.file.replace('docs/artifacts/', '').padEnd(30) + (r.g4 ? ' 最克 ' + String(r.g4.long).padStart(3) + '/' + String(r.g4.multi).padStart(3) + '  杀手 ' + (r.g4.script || '').slice(0, 12) : ' 最克 —') +
    '  G ' + r.gMulti.toFixed(2) + '/' + r.gLong.toFixed(2) + ' 得珠 ' + r.gained + ' 花珠率 ' + r.spentRate.toFixed(2));
}

/* ---------- `--rows`：结构化逐类读数（给臂终评吃） ----------
 * 为什么要它：终评的统计若靠**正则解析上面那些散文表格**，改一行印法结论就跟着变
 * （METHODOLOGY 76/80 的同族）。散文给人看，TSV 给判词用，两者同源同一次运行。 */
if (process.argv.includes('--rows')) {
  console.log('\n#ROWS\tfile\tgMulti\tgLong\tlandMulti\tlandLong\tgained\tspentRate\twide\tclosed\trobust\tg4long\tg4multi\tg4killer');
  for (const r of rows) console.log(['#ROWS', r.file, r.gMulti, r.gLong, r.landMulti, r.landLong, r.gained, r.spentRate,
    r.wide ? 1 : 0, r.closed ? 1 : 0, (r.robust === true ? 1 : (r.robust === false ? 0 : '')),
    r.g4 ? r.g4.long : '', r.g4 ? r.g4.multi : '', r.g4 ? (r.g4.script || '') : ''].join('\t'));
  console.log('#ROWS-INCUMBENT\t' + INCUMBENT + '\t' + [incM.gMulti, incM.gLong, incM.landMulti, incM.landLong, incM.gained, incM.spentRate,
    '', '', Number.isFinite(incRef.long) ? 1 : '', Number.isFinite(incRef.long) ? incG4.long : '', Number.isFinite(incRef.multi) ? incG4.multi : ''].join('\t'));
}
