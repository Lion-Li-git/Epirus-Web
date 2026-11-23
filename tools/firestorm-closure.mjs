#!/usr/bin/env node
/* firestorm-closure.mjs —— 池成员"天火贴 / 爆 / 空爆"普查（2026-11-24 · Qoder 通宵班）
 *
 * 为什么要有：用户 11-23 夜裁定「**宁可不贴，也不要出现不闭环**」。仓里已有两处碰这一维：
 *   · `champion-map/build-skill-page.mjs:111` 算 detRate = firestormOk/curseOk（**只在页面行内显示**）
 *   · 同文件 :138 的告警 `curseOk>=3 && detRate<0.25` ⇒ 文案就叫"只贴不爆"（**不进任何门**）
 *   ⇒ 判据有词、有告警、**没有可复算的在册读数**，也没人按"局"看过闭环。本工具先把聚合这一维落成表。
 *
 * 数据来源（不重跑对局）：`champion-map/data/skill-report/<id>.json` 的 `stage1.curseStats`
 *   = {curseOk 贴出手, curseLanded 贴落地, firestormOk 引爆出手, firestormHits 引爆有目标}
 *   语义见 `js/core/resolve.js:1263`（贴，事件 type=curse）与 `:1268-1282`（爆，事件 type=firestorm，
 *   `n` = 本次吃掉的己方符咒数；**n=0 就是"出手而未爆"**）。
 *
 * ⚠ 口径边界（别把这张表当"局闭环率"）：detRate 是**次数比**，可以 >100%（一枚贴被多次引爆/换目标），
 *   它量的是"引爆这手用得够不够勤"，不量"贴过的局里有多少比例真闭环"。后者要在 stage1() 里按局记
 *   curseLatched&&detonated —— 那是另活，见 docs/research/STATUS-2026-11-24-night-qoder.md §四。
 *
 * 用法：node tools/firestorm-closure.mjs [--pool=champion-map/data/page/pool-members.tsv]
 *                                     [--out=champion-map/data/firestorm-closure-1124.tsv] [--quiet]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

if (process.argv[1] && process.argv[1].endsWith('firestorm-closure.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['pool', 'out', 'reports', 'quiet'], 'firestorm-closure');
}
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const QUIET = process.argv.includes('--quiet');
const say = (...a) => { if (!QUIET) console.log(...a); };
const POOL = arg('pool', 'champion-map/data/page/pool-members.tsv');
const OUT = arg('out', 'champion-map/data/firestorm-closure-1124.tsv');
const REPORT_DIR = arg('reports', 'champion-map/data/skill-report');
/* 页面告警那两条常量（build-skill-page.mjs:138）——本工具照抄阈值，但**只报不判**，判它的是门 */
const CURSE_FLOOR = 3, DET_BAD = 0.25;
/* 机会口径的两个阈值（先给保守值，等全池分布出来再定线；**别拿单枚的数当线**） */
const LOOP_FLOOR = 10, TAKE_BAD = 0.30;

const tsv = (f) => readFileSync(f, 'utf8').replace(/\r/g, '').trim().split('\n');
const P = tsv(POOL);
const ph = P[0].split('\t'), px = Object.fromEntries(ph.map((c, i) => [c, i]));
const rows = [];
const missing = [];
const fpSeen = {};
for (const l of P.slice(1)) {
  if (!l.trim()) continue;
  const c = l.split('\t');
  const id = c[px.id], tier = c[px.tier];
  if (!id) continue;
  const f = REPORT_DIR + '/' + id + '.json';
  if (!existsSync(f)) { missing.push(id); continue; }
  let j; try { j = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { missing.push(id + '(解析失败)'); continue; }
  const s1 = j.stage1 || {};
  const cs = s1.curseStats || null;
  const fp = j.rulesFingerprint || '?';
  fpSeen[fp] = (fpSeen[fp] || 0) + 1;
  if (!cs) { missing.push(id + '(无 curseStats)'); continue; }
  const detRate = cs.curseOk > 0 ? cs.firestormOk / cs.curseOk : null;
  const dudRate = cs.firestormOk > 0 ? (cs.firestormOk - cs.firestormHits) / cs.firestormOk : null;
  /* 机会口径（11-24 加）：R64 已把"无可引爆符咒"的天火挡在 legal 外 ⇒ legal 里出现就是"既能出也该出"。
   *   takeRate = 出手/机会，**这才是裁定要管的那个数**；聚合引爆率(detRate)会把"贴得比爆得多"误读成病。 */
  const legal = cs.fsLegalDecisions != null ? cs.fsLegalDecisions : null;
  const taken = cs.fsTakenWhenLegal != null ? cs.fsTakenWhenLegal : null;
  const takeRate = (legal && legal > 0) ? taken / legal : null;
  const onlyStick = !!(cs.curseOk >= CURSE_FLOOR && detRate !== null && detRate < DET_BAD);
  const noGrab = !!(legal >= LOOP_FLOOR && takeRate !== null && takeRate < TAKE_BAD);
  rows.push({
    id, tier, fp, measuredAt: (j.measuredAt || '').slice(0, 16),
    cells: s1.totalCells || 0, cover: Object.keys(s1.coverage || {}).filter((k) => (s1.coverage[k] || 0) > 0).length,
    stick: cs.curseOk, land: cs.curseLanded, boom: cs.firestormOk, hit: cs.firestormHits,
    detRate, dudRate, legal, taken, takeRate, noGrab,
    loop: (cs.stickGames > 0 ? cs.loopGames / cs.stickGames : null),
    onlyStick, neverTouched: cs.curseOk === 0 && cs.firestormOk === 0,
  });
}

rows.sort((a, b) => (a.detRate === null ? 1 : b.detRate === null ? -1 : a.detRate - b.detRate));
say('池表 ' + POOL + ' 成员 ' + (P.length - 1) + ' 枚 ‖ 有 stage1 读数 ' + rows.length + ' ‖ 无报告/无字段 ' + missing.length);
say('报告指纹分布（' + Object.keys(fpSeen).length + ' 种）：' + Object.entries(fpSeen).map(([k, v]) => k.slice(0, 8) + '=' + v).join(' ‖ '));
say('');
say('枚ID'.padEnd(22) + '带'.padEnd(6) + '贴手'.padStart(7) + '爆手'.padStart(7) + '引爆率'.padStart(9) +
  '机会'.padStart(7) + '出手'.padStart(7) + '抓手率'.padStart(9) + '局闭环'.padStart(9) + '  判读');
for (const r of rows) {
  say(r.id.padEnd(22) + r.tier.padEnd(6) + String(r.stick).padStart(7) + String(r.boom).padStart(7) +
    (r.detRate === null ? '  —' : (100 * r.detRate).toFixed(0) + '%').padStart(9) +
    (r.legal === null ? '  未量' : String(r.legal)).padStart(7) + (r.taken === null ? '  未量' : String(r.taken)).padStart(7) +
    (r.takeRate === null ? '   —' : (100 * r.takeRate).toFixed(0) + '%').padStart(9) +
    (r.loop === null ? '   —' : (100 * r.loop).toFixed(0) + '%').padStart(9) +
    '  ' + (r.noGrab ? '⚠ 有机会不抓手（机会≥' + LOOP_FLOOR + ' ∧ 抓手率<' + (100 * TAKE_BAD) + '%）'
      : r.legal === 0 ? '— 从没造出可引爆局面（要治的是贴的时机，不是闭环）'
        : r.neverTouched ? '— 从不碰这套（不贴也不爆，符合"宁可不贴"）'
          : r.onlyStick ? '△ 聚合率低但抓手率不差（贴得比爆得多）' : ''));
}

const touched = rows.filter((r) => r.stick >= CURSE_FLOOR && r.detRate !== null).map((r) => r.detRate);
touched.sort((a, b) => a - b);
const q = (p) => touched.length ? touched[Math.min(touched.length - 1, Math.floor(p * (touched.length - 1)))] : null;
const bad = rows.filter((r) => r.onlyStick);
say('');
say('=== 汇总（分母 = 贴手 ≥' + CURSE_FLOOR + ' 的 ' + touched.length + ' 枚，从不碰这套的不进分布）===');
if (touched.length) {
  say('引爆率分布：P10 ' + (100 * q(0.10)).toFixed(0) + '% ‖ P50 ' + (100 * q(0.50)).toFixed(0) + '% ‖ P90 ' + (100 * q(0.90)).toFixed(0) +
    '% ‖ min ' + (100 * touched[0]).toFixed(0) + '% ‖ max ' + (100 * touched[touched.length - 1]).toFixed(0) + '%');
}
say('只贴不爆 ' + bad.length + ' 枚' + (bad.length ? '：' + bad.map((r) => r.id + '(' + r.tier + ',' + (100 * r.detRate).toFixed(0) + '%)').join(' ‖ ') : '') +
  ' ‖ 从不碰 ' + rows.filter((r) => r.neverTouched).length + ' 枚 ‖ 缺报告 ' + (missing.length ? missing.join(',') : '无'));
const hard = rows.filter((r) => r.tier === 'hard'), soft = rows.filter((r) => r.tier === 'soft');
const med = (a) => { const v = a.filter((r) => r.detRate !== null && r.stick >= CURSE_FLOOR).map((r) => r.detRate).sort((x, y) => x - y); return v.length ? (100 * v[Math.floor((v.length - 1) / 2)]).toFixed(0) + '% (n=' + v.length + ')' : '无'; };
say('按带中位引爆率：hard ' + med(hard) + ' ‖ soft ' + med(soft));
/* 机会口径的汇总（11-24 加）：这条才是"宁可不贴也不要不闭环"该看的分母 */
const meas = rows.filter((r) => r.legal !== null);
if (meas.length) {
  const trs = meas.map((r) => r.takeRate).filter((v) => v !== null).sort((a, b) => a - b);
  const tq = (p) => trs.length ? (100 * trs[Math.min(trs.length - 1, Math.floor(p * (trs.length - 1)))]) : NaN;
  const zero = meas.filter((r) => r.legal === 0).length;
  say('=== 机会口径（分母 = 天火在 legal 里出现的决策数；R64 已过滤"无可引爆符咒"）===');
  say('  有量到的 ' + meas.length + ' 枚 ‖ 抓手率 P10 ' + tq(0.1).toFixed(0) + '% ‖ P50 ' + tq(0.5).toFixed(0) + '% ‖ P90 ' + tq(0.9).toFixed(0) + '% ‖ 从没造出机会的 ' + zero + ' 枚');
  const ng = rows.filter((r) => r.noGrab);
  say('  「有机会不抓手」（机会≥' + LOOP_FLOOR + ' ∧ 抓手率<' + (100 * TAKE_BAD) + '%）' + ng.length + ' 枚' +
    (ng.length ? '：' + ng.map((r) => r.id + '(' + r.tier + ',' + (100 * r.takeRate).toFixed(0) + '%,机会' + r.legal + ')').join(' ‖ ') : ''));
} else say('  ℹ 这批报告还没有"机会"这一维（Stage1 未重烘）⇒ 抓手率**读不出**，不是"0%"：要跑 node tools/pool-skill-report.mjs --stage=1 --all-pool --out=<目录>');
if (missing.length) say('⚠ 没读到的枚（不是"干净"，是没结论）：' + missing.join(' ‖ '));

const head = ['pack_id', 'tier', 'rulesFingerprint', 'measuredAt', 'cells', 'skillCover', 'curseOk', 'curseLanded', 'firestormOk', 'firestormHits', 'detRate', 'dudRate', 'fsLegalDecisions', 'fsTakenWhenLegal', 'takeRate', 'loopRate', 'noGrab', 'onlyStick', 'neverTouched'];
const out = [head.join('\t')];
for (const r of rows) out.push([r.id, r.tier, r.fp, r.measuredAt, r.cells, r.cover, r.stick, r.land, r.boom, r.hit,
  r.detRate === null ? '' : r.detRate.toFixed(6), r.dudRate === null ? '' : r.dudRate.toFixed(6),
  r.legal === null ? '' : r.legal, r.taken === null ? '' : r.taken,
  r.takeRate === null ? '' : r.takeRate.toFixed(6), r.loop === null ? '' : r.loop.toFixed(6),
  r.noGrab ? '1' : '0', r.onlyStick ? '1' : '0', r.neverTouched ? '1' : '0'].join('\t'));
writeFileSync(OUT, out.join('\n') + '\n');
say('已落盘：' + OUT + '（' + rows.length + ' 行 + 表头）');
