#!/usr/bin/env node
/* gate-par.mjs —— np-test 整轮的**并行跑法**（同一份 16 个部分，按部分并发跑）。
 *
 * 为什么要有它：CI 早就把 278 条门切成 16 个 job 并行（`.github/workflows/gates.yml` 的 `part` 矩阵），
 *   而本机只有串行入口 —— `gate-all.mjs` 只把 spec/smoke/battle/map 并发，np 那条腿仍是串行
 *   ⇒ **本机整轮反而比 CI 慢一倍多**。实测（2026-10-16 · 本机 18 核）：前 14 个部分
 *   **串行合计 283s**，8 并发只要 **75s**；剩下的是长尾 `train-runner` / `train-evo`
 *   （CI 实测 460s / 275s，两者占整轮 943s 的 78%），**那把墙钟压不下去** ——
 *   并行能做的是让其余 14 个部分从关键路径上整个消失。
 *
 * 与 np-test 的关系（**不抄第二份名单**）：部分清单、每部分门数、总数，全部现读
 *   `node tools/np-test.mjs --list-parts --json` ⇒ 加/删一个部分文件，本文件跟着变，不用改这里。
 *   ⚠ 本工具**不实现** `--group=`：那是 np-test 的**累计深度**语义（meta ⊂ ship ⊂ train/ui ⊂ probe ⊂ engine），
 *     在这里再实现一遍就是「同一个语义写两遍」—— 本仓最容易漂的一类病。分组跑请继续用 np-test。
 *
 * 用法：
 *   node tools/gate-par.mjs                     # 16 个部分全跑 = np-test 整轮的并行等价物
 *   node tools/gate-par.mjs --jobs=4            # 限并发（默认 8；18 核上留余量给 train-runner/train-evo 内部那套 worker 池）
 *   node tools/gate-par.mjs --part=train-evo    # 只跑指定部分（逗号分隔）⇒ 结论行**明标**不是整轮认证
 *   node tools/gate-par.mjs --dry-run           # 只印计划（部分/权重/顺序/并发），不真跑
 *   node tools/gate-par.mjs --self-test         # 只验跑器自己的牙口（并集守卫 + 聚合忠实）
 *   node tools/gate-par.mjs --timing=<file>     # 读/写实测耗时（下次「长的先起」用它排序；缺省用门数当权重）
 *   node tools/gate-par.mjs --json              # 末尾多印一行机器可读的汇总
 *   node tools/gate-par.mjs --no-recheck        # 关掉「红的部分单独复跑」（默认**开**，理由见下）
 *
 * ⚠ **本机 16 个部分共用同一棵工作树，CI 是 16 台机各一棵干净树** ⇒ 会写文件的腿可能互相撞车，
 *   产生**并发假红**。实测（2026-10-16 本机）：`train-evo` 的 D15 在 8 并发下红、单独复跑绿 ——
 *   它是「抢共享状态」，不是产品坏。所以本工具默认对任何红的部分**单独复跑一遍**：
 *   复跑绿 = 记成并发假红（响亮印出、**不计入结论**）；复跑仍红 = 真红。
 *   （想数「有几个部分在共享可变状态」，跑 `--no-recheck` 一眼就看出来。）
 * 退出码：0 全绿且并集 = 总数；1 有部分红或门数对不上；2 计划被判据拒（并集/重名/参数）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { rejectUnknownFlags } from './audit-lib.mjs';
import { gateBodyText, BOUNDARY, partFiles } from './gate-src.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['jobs', 'part', 'dry-run', 'self-test', 'timing', 'json', 'help', 'changed'], 'gate-par');

const DASH = '--';
function arg(name, dflt) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === DASH + name) return '1';
    if (a.indexOf(DASH + name + '=') === 0) return a.slice(name.length + 3);
  }
  return dflt;
}
function has(name) {
  for (let i = 0; i < argv.length; i++) if (argv[i] === DASH + name) return true;
  return false;
}

function sh(cmd, args) {
  return new Promise(function (res) {
    const p = spawn(cmd, args, { cwd: ROOT, windowsHide: true });
    let so = '', se = '';
    p.stdout.on('data', function (d) { so += d; });
    p.stderr.on('data', function (d) { se += d; });
    p.on('error', function (e) { res({ code: -1, so: so, se: se + String(e && e.message), sec: 0 }); });
    const t0 = Date.now();
    p.on('close', function (c) { res({ code: c, so: so, se: se, sec: (Date.now() - t0) / 1000 }); });
  });
}

/* ===== 计划与聚合：两件**可以独立验**的纯逻辑，自检就钉在这两件上 ===== */
function buildPlan(parts, total, requireAll) {
  if (!parts.length) return { ok: false, why: '一个部分都没有' };
  const seen = {};
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || !p.part) return { ok: false, why: '第 ' + i + ' 项没有部分名' };
    if (seen[p.part]) return { ok: false, why: '部分名重复：' + p.part + '（同一部分的门会被跑两遍，而并集看着仍然是满的）' };
    seen[p.part] = 1;
  }
  const sum = parts.reduce(function (s, p) { return s + (p.gates || 0); }, 0);
  /* ⚠ v1.7.71 修：并集守卫**只在没给 `--part=` 时**成立。
   *   原来它对任何清单都要求 Σ = total ⇒ 显式选子集**永远被拒**（exit 2）——
   *   于是 `--part=a,b` 这条本来能省掉整轮的选择**从来没生效过**，用的人（包括我）只能回去跑整轮。
   *   子集档要防的是另一件事：**选中的名字必须真的存在**（调用方在 :142-151 已按现读清单核过，认不出就 exit 2）
   *   与**不许重名**（下面那条，两档都管）。子集永远不该被当成整轮认证 —— 那由 `verdictOf` 的
   *   `results.length === allCount` 兜着（结论行会写「不是整轮认证」）。 */
  if (requireAll !== false && sum !== total) {
    return { ok: false, why: '并集守卫：Σ部分门数 = ' + sum + ' ≠ np-test 现读 total = ' + total
      + '（少跑的部分会**不吭声** —— 这正是 gate-parts-check.mjs 防的那个坏法）' };
  }
  return { ok: true, sum: sum, partial: requireAll === false };
}
function verdictOf(results, allCount, totalGates) {
  const red = results.filter(function (r) { return r.code !== 0; });
  const passes = results.reduce(function (s, r) { return s + (r.pass || 0); }, 0);
  const tots = results.reduce(function (s, r) { return s + (r.tot || 0); }, 0);
  const certified = red.length === 0 && results.length === allCount && tots === totalGates && passes === totalGates;
  const line = certified
    ? '整轮认证通过（' + results.length + '/' + allCount + ' 个部分绿 · 门 ' + passes + '/' + totalGates + '）'
    : (red.length ? '有 ' + red.length + ' 个部分红：' + red.map(function (r) { return r.part + '(exit ' + r.code + ')'; }).join(' ')
      : '**不是整轮认证**：跑了 ' + results.length + '/' + allCount + ' 个部分（门 ' + passes + '/' + totalGates + '）');
  return { certified: certified, line: line };
}

function selfTest() {
  let bad = 0;
  const cases = [
    ['全量清单 2+3=5', [{ part: 'a', gates: 2 }, { part: 'b', gates: 3 }], 5, true, true],
    ['全量清单少一个部分', [{ part: 'a', gates: 2 }], 5, false, true],
    ['全量清单门数多出来', [{ part: 'a', gates: 6 }], 5, false, true],
    ['部分名重复（两档都拒）', [{ part: 'a', gates: 2 }, { part: 'a', gates: 3 }], 5, false, true],
    ['空清单', [], 5, false, true],
    /* v1.7.71：显式子集（`--part=`）**不许**再被并集守卫拒 —— 这正是它以前从来没生效过的原因 */
    ['子集清单 1 个部分（--part=）', [{ part: 'a', gates: 2 }], 5, true, false],
    ['子集清单 2 个部分（--part=）', [{ part: 'a', gates: 2 }, { part: 'b', gates: 3 }], 5, true, false],
    ['子集清单空（--part= 给了空串）', [], 5, false, false]
  ];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const r = buildPlan(c[1], c[2], c[4]);
    if (!!r.ok !== c[3]) { bad++; console.log('✘ 自检「' + c[0] + '」：期望 ' + (c[3] ? '放行' : '拒') + '，实际 ' + (r.ok ? '放行' : '拒')); }
    else console.log('✔ 自检「' + c[0] + '」：' + (r.ok ? '放行' : '拒 · ' + r.why));
  }
  const g1 = verdictOf([{ part: 'a', code: 0, pass: 2, tot: 2 }, { part: 'b', code: 1, pass: 2, tot: 3 }], 2, 5);
  if (g1.certified) { bad++; console.log('✘ 自检「聚合忠实」：有一条红却报了整轮认证'); }
  else console.log('✔ 自检「聚合忠实」：有一条红 ⇒ ' + g1.line);
  const g2 = verdictOf([{ part: 'a', code: 0, pass: 2, tot: 2 }], 2, 5);
  if (g2.certified) { bad++; console.log('✘ 自检「缺部分不许认证」：只跑了 1/2 个部分却报了整轮认证'); }
  else console.log('✔ 自检「缺部分不许认证」：只跑 1/2 ⇒ ' + g2.line);
  const g3 = verdictOf([{ part: 'a', code: 0, pass: 2, tot: 2 }, { part: 'b', code: 0, pass: 3, tot: 3 }], 2, 5);
  if (!g3.certified) { bad++; console.log('✘ 自检「全绿必须认证」：两段全绿却不敢认证 ⇒ ' + g3.line); }
  else console.log('✔ 自检「全绿必须认证」：' + g3.line);
  console.log(bad ? ('✘ 自检：' + bad + ' 条牙口没长上') : '✔ 自检：跑器的并集守卫与聚合忠实都长着（5 个计划夹具 + 3 个聚合夹具）');
  process.exit(bad ? 1 : 0);
}

if (has('self-test')) selfTest();

/* ===== 现读清单（唯一真源 = np-test 的 --list-parts）===== */
const listRes = await sh(process.execPath, ['tools/np-test.mjs', '--list-parts', '--json']);
const m = listRes.so.match(/\{[\s\S]*\}/);
if (!m) {
  console.error('⛔ 读不到 `np-test --list-parts --json` 的清单（退出码 ' + listRes.code + '）⇒ 不猜，直接停：');
  console.error((listRes.se || listRes.so).slice(0, 400));
  process.exit(2);
}
const LIST = JSON.parse(m[0]);
const ALL = LIST.parts;
const TOTAL = LIST.total;

/* `--changed`（v1.7.72）：按工作区**实际改了哪些文件**选部分。
 *   判据是「反向查：这个路径被哪些部分的门体**引用**」（面取自 gate-src，与 gate-sentinel 同一口径），
 *   而不是抄 `gate-all.mjs` 的组表 —— 组是**累计深度**语义，只在 gate-all 那一份实现里，本工具不碰它。
 *   保守方向三条：① 改到「全体共享面」或引擎/UI 面 ⇒ 整轮；② 认不出的路径 ⇒ 整轮；③ 一处都查不到 ⇒ 整轮。
 *   ⚠ 静态引用 ≠ 数据流：门体 spawn 出去的工具读了什么，这里看不出来 ⇒ `--changed` 只是「**不会少跑**」的近似，
 *     要「整轮认证」这句话成立仍然得跑满 16 个部分（或交给 CI）。 */
const SHARED = ['tools/np-test.mjs', 'tools/gate-all.mjs', 'tools/gate-par.mjs', 'tools/gate-src.mjs',
  'tools/np-cache.mjs', 'tools/np-parallel.mjs', 'tools/spec-run.mjs', 'tools/gates/_ctx.mjs'];
const norm = function (p) { return String(p).replace(/\\\\/g, '/'); };
const base = function (p) { return norm(p).split('/').pop(); };
function changedPaths() {
  const out = new Set();
  const cmds = [['status', '--porcelain'], ['diff', '--name-only', 'HEAD']];
  for (let i = 0; i < cmds.length; i++) {
    const r = spawnSync('git', cmds[i], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 << 20 });
    if (r.status !== 0) return null;
    const ls = String(r.stdout || '').split('\n');
    for (let k = 0; k < ls.length; k++) {
      const t = ls[k].trim(); if (!t) continue;
      let f = t.length > 3 ? t.slice(3).trim() : t;
      if (f.indexOf(' -> ') >= 0) f = f.split(' -> ').pop().trim();
      out.add(norm(f));
    }
  }
  return Array.from(out);
}
function partsForChanged(paths) {
  const files = partFiles();
  const blocks = []; let cur = null;
  const body = gateBodyText().split('\n');
  for (let i = 0; i < body.length; i++) {
    if (body[i].indexOf(BOUNDARY) === 0) { cur = { f: base(body[i].slice(BOUNDARY.length).trim()), t: '' }; blocks.push(cur); }
    else if (cur) cur.t += body[i] + '\n';
  }
  const hit = new Set(); let hard = false;
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (SHARED.indexOf(p) >= 0 || /^(js|server|tests)\//.test(p) || p === 'index.html') { hard = true; break; }
    let any = false;
    for (let k = 0; k < blocks.length; k++) {
      if (blocks[k].t.indexOf(p) >= 0 || (p.indexOf('/') > 0 && blocks[k].t.indexOf(base(p)) >= 0)) { hit.add(blocks[k].f); any = true; }
    }
    if (!any) {
      if (/^(docs\/|CHANGELOG|README|\.github\/)/.test(p)) { hit.add('meta-repo.mjs'); hit.add('meta-lint.mjs'); }
      else { hard = true; break; }
    }
  }
  const nm = function (f) { return base(f).replace(/\.mjs$/, ''); };
  if (hard) return files.map(nm);
  const picked = files.map(nm).filter(function (f) { return hit.has(f + '.mjs'); });
  return picked.length ? picked : files.map(nm);
}
let only = arg('part', '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
if (argv.indexOf('--changed') >= 0) {
  const cp = changedPaths();
  if (cp === null) { console.error('⛔ --changed 认不出改动面（git 跑不动）⇒ 不猜，请手给 --part= 或跑整轮'); process.exit(2); }
  if (!cp.length) { console.error('⛔ --changed：工作区干净 ⇒ 没有改动面可判（要重跑全部就别给 --changed）'); process.exit(2); }
  const auto = partsForChanged(cp);
  console.error('ℹ️ --changed：工作区 ' + cp.length + ' 个路径 ⇒ 选 ' + auto.length + '/16 个部分：' + auto.join(' '));
  const merged = new Set(only.concat(auto));
  only = Array.from(merged);
}
let picked = ALL;
if (only.length) {
  const names = ALL.map(function (p) { return p.part; });
  const unknown = only.filter(function (n) { return names.indexOf(n) < 0; });
  if (unknown.length) {
    console.error('⛔ 不存在的部分：' + unknown.join(' ') + '（响亮失败，不静默按整轮跑）');
    console.error('   现读清单里的部分：' + names.join(' '));
    process.exit(2);
  }
  picked = ALL.filter(function (p) { return only.indexOf(p.part) >= 0; });
}

const plan = buildPlan(picked, TOTAL, only.length === 0);
if (!plan.ok) { console.error('⛔ 计划被判据拒：' + plan.why); process.exit(2); }

const timingFile = arg('timing', '');
let weights = {};
if (timingFile && existsSync(timingFile)) {
  try { weights = JSON.parse(readFileSync(timingFile, 'utf8')); } catch (e) { console.error('⚠ 读不动 --timing 文件（按门数排）：' + e.message); }
}
const jobsWanted = Math.max(1, parseInt(arg('jobs', '8'), 10) || 8);
const JOBS = Math.min(jobsWanted, picked.length);
const queue = picked.slice().sort(function (a, b) {
  const wa = weights[a.part] || a.gates, wb = weights[b.part] || b.gates;
  return wb - wa;
});

console.log('▶ 计划：' + picked.length + '/' + ALL.length + ' 个部分 | 并发 ' + JOBS + ' | 门 ' + plan.sum + '/' + TOTAL
  + ' | 排序权重 = ' + (Object.keys(weights).length ? '实测耗时(--timing)' : '门数（可用 --timing=<file> 换成实测）'));
console.log('  起跑顺序：' + queue.map(function (p) { return p.part; }).join(' '));
console.log('  本机：' + os.cpus().length + ' 核（并发上限 8 是给 train-runner/train-evo 内部的 worker 池留余量，不是核数限制）');
if (has('dry-run')) { console.log('（--dry-run ⇒ 不真跑）'); process.exit(0); }

/* ===== 真跑：按部分并发，每个部分 = 一个 np-test 子进程 ===== */
const t00 = Date.now();
const results = [];
let idx = 0;
async function worker() {
  while (idx < queue.length) {
    const p = queue[idx++];
    const r = await sh(process.execPath, ['tools/np-test.mjs', '--part=' + p.part]);
    const mm = r.so.match(/通过 (\d+) \/ (\d+)/);
    const fails = r.so.split('\n').filter(function (l) { return l.indexOf('✘') >= 0; }).slice(0, 6);
    const rec = { part: p.part, code: r.code, sec: +r.sec.toFixed(1), pass: mm ? +mm[1] : null, tot: mm ? +mm[2] : null, fails: fails };
    results.push(rec);
    console.log((r.code === 0 ? '✔ GREEN ' : '✘ RED   ') + p.part.padEnd(18) + (rec.sec.toFixed(1) + 's').padStart(9)
      + '  ' + (rec.pass === null ? '?' : rec.pass) + '/' + (rec.tot === null ? '?' : rec.tot));
    for (let i = 0; i < fails.length; i++) console.log('    ' + fails[i].trim());
    if (r.code !== 0 && !fails.length) console.log('    （该部分没印 ✘ 行，退出码 ' + r.code + ' ⇒ 大概率是跑崩了，请单独复跑 `node tools/np-test.mjs --part=' + p.part + '`）');
  }
}
await Promise.all(Array.from({ length: JOBS }, worker));

/* ===== 并发下的红，必须**单独复跑**过才敢叫红 ===== */
let recheckNote = '';
if (!has('no-recheck')) {
  const reds = results.filter(function (r) { return r.code !== 0; });
  let fake = 0;
  for (let i = 0; i < reds.length; i++) {
    const r = reds[i];
    console.log('⏳ 单独复跑（排除抢核与共享状态）：' + r.part + ' …');
    const r2 = await sh(process.execPath, ['tools/np-test.mjs', '--part=' + r.part]);
    if (r2.code === 0) {
      const mm2 = r2.so.match(/通过 (\d+) \/ (\d+)/);
      r.code = 0; r.wasRed = true; r.rechecked = 'green-alone'; r.fails = [];
      if (mm2) { r.pass = +mm2[1]; r.tot = +mm2[2]; }
      fake++;
      console.log('⚠ ' + r.part + '：**并发下的假红** —— 单独复跑 ' + r2.sec.toFixed(1) + 's 全绿');
      console.log('   ⇒ 它不是产品坏，而是这个部分与别的部分**共享了可变状态**（CI 上每部分一棵干净树，所以 CI 看不到）。');
    } else {
      r.rechecked = 'red-alone';
      console.log('✘ ' + r.part + '：单独复跑仍然红 ⇒ **真红**（退出码 ' + r2.code + '）');
    }
  }
  if (reds.length) recheckNote = '（红的部分已逐条单独复跑：真红 ' + (reds.length - fake) + ' ‖ 并发假红 ' + fake + '）';
}

const used = results.reduce(function (s, r) { return s + r.sec; }, 0).toFixed(1);
const wall = ((Date.now() - t00) / 1000).toFixed(1);
const v = verdictOf(results, ALL.length, TOTAL);
console.log('');
console.log('（墙钟 ' + wall + 's ‖ 各部分实测耗时合计 ' + used + 's —— 并行下含抢核膨胀，只作参考；真串行口径见 GATE-SHIFTS.md）');
console.log((v.certified ? '✔ 结论：**' : '✘ 结论：') + v.line + (v.certified ? '**' : '') + ' ' + recheckNote);
if (!v.certified && results.length !== ALL.length) {
  console.log('   （要认证就跑全 ' + ALL.length + ' 个部分：不带 --part 就是整轮）');
}

if (timingFile) {
  const merged = {};
  for (const k in weights) merged[k] = weights[k];
  for (let i = 0; i < results.length; i++) merged[results[i].part] = results[i].sec;
  try { writeFileSync(timingFile, JSON.stringify(merged, null, 1)); console.log('   ⏱ 实测耗时已写 ' + timingFile + '（下次按它排序）'); }
  catch (e) { console.log('   ⚠ 耗时写不进 ' + timingFile + '：' + e.message); }
}
if (has('json')) {
  console.log(JSON.stringify({ parts: results.length, all: ALL.length, total: TOTAL, wall: +wall, certified: v.certified, results: results.map(function (r) { return { part: r.part, code: r.code, sec: r.sec, pass: r.pass, tot: r.tot }; }) }));
}
process.exit(v.certified ? 0 : 1);