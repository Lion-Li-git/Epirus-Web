#!/usr/bin/env node
/* gate-all.mjs —— 四道门禁一次跑完，只给一行总结论。
 *
 * 为什么要它：本仓的"当前状态"= np + spec + smoke + battle **四道在同一棵树上全绿**，
 * 而四条命令要分别手敲、而且 np 一条就 9.5 分钟 —— 于是实际发生的是"只跑了其中一两道，
 * 然后引用全绿的口径"。这里把顺序与判词固定下来，并且明写耗时预算。
 *
 *   node tools/gate-all.mjs          # spec + smoke + battle（约 1 分钟），不跑 np
 *   node tools/gate-all.mjs --np     # 加跑 np-test（约 10 分钟）= **认证那一遍**（四道全绿才算）
 *   node tools/gate-all.mjs --np --group=meta    # §E335 只跑那一组（np 侧 15 条 ≈ 9 秒）
 *   node tools/gate-all.mjs --np --no-browser    # §E355 **CI 阻断档的形状**：np 整轮 + spec，摘掉浏览器那两道
 * 退出码：0 全绿；7 有任意一道红（点名是哪道）。
 * ⚠ 带 `--group=` 的那一遍**不是认证**：np 只跑了分组里的门，总结论行会显式标出来（同 `--only` 的规矩）。
 * ⚠ 带 `--no-browser` 的那遍**也不是"四道全绿"**：总结论会点名"本轮缺 smoke/battle"。
 *   它存在的理由 = 那两道要在 **CI 里跑**（本机每班次都跑，因为只要 45 秒），
 *   而 GitHub 的 runner 上它们是观察档（10-01 转阻断后 3 跑 2 红、根因未定 ⇒ 红不能阻断提交）。
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const rel = (x) => path.relative(ROOT, x).split(path.sep).join('/');
const ALL_JOBS = [
  { name: 'spec', argv: ['node', 'tools/spec-run.mjs'], want: /通过 (\d+) \/ (\d+)/ },
  { name: 'smoke', argv: ['node', 'tools/smoke.mjs'], want: /SMOKE OK/ },
  { name: 'battle', argv: ['node', 'tools/battle-test.mjs'], want: /BATTLE OK/ },
];
/* §E355：`--no-browser` ⇒ 只留能在 ubuntu runner 上稳定判的那两道（spec + np）。
 * 判据用**名字**过滤而不是下标：jobs 以后加一道不会静默少摘/多摘。 */
const NO_BROWSER = process.argv.includes('--no-browser');
const jobs = NO_BROWSER ? ALL_JOBS.filter(function (j) { return j.name !== 'smoke' && j.name !== 'battle'; }) : ALL_JOBS.slice();
const GRPA0 = (process.argv.find(a => a.startsWith('--group=')) || '').slice(8);
let GRPA = GRPA0;
/* ===== §E341 `--auto`：按"这棵树改了什么"推断该跑哪一组（用户 ⑥「门禁重新规划一下」）=====
 * 三条设计：
 *   ① **保守**：认不出来的路径一律算 engine（= 整轮）⇒ 它只会多跑，不会少跑；
 *   ② 推断出来的是**分组** ⇒ 总结论照样标"不是整轮认证"，`--auto` 不能拿来冒充认证；
 *   ③ 打印每张票的来路（哪个文件被判成哪一组），不然"为什么只跑 15 道"会变成下一次考古。 */
if (process.argv.includes('--auto')) {
  const RANK = { meta: 1, ship: 2, train: 3, ui: 4, probe: 4, engine: 5 };
  const cls = (p) => {
    if (/^(tools\/(np-test|gate-all|np-cache|spec-run)\.mjs$|tests\/|js\/core\/|server\/|index\.html$)/.test(p)) return 'engine';
    if (/^(js\/ui\/|tools\/(smoke|battle-test)\.mjs$)/.test(p)) return 'ui';
    if (/^js\/train\/|^js\/bundled|^tools\/(train-3p|train-best|eval-5p|style-exam|promote-champion|ring2-run|human-pool|pool-frontier-lib|probe-|analyze-|keep-artifact)/.test(p)) return 'train';
    if (/^docs\/(METHODOLOGY|RULES-2P|RULES-NP)\.md$|^docs\/artifacts\/(e129-out\/matrix\.json|train-3p-out\.js|e161-ply\.mjs|e168-style-human\.mjs|e169-beadprice\.mjs|\.training-live\.sha1)$/.test(p)) return 'ship';
    return 'meta';   // docs/ 其余、champion-map/、results/ 等：门的读取面上没有 ⇒ 只跑仓库纪律那一组
  };
  const changed = new Set();
  for (const a of ['status --porcelain', 'diff --name-only HEAD']) {
    let o = '';
    try {
      const { execSync } = await import('node:child_process');
      o = execSync('git ' + a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 << 20 });
    } catch (e) { console.error('⛔ --auto 认不出改动面（git ' + a + ' 跑不动：' + e.message.split('\n')[0] + '）⇒ 不猜，请手给 --group= 或整轮'); process.exit(2); }
    for (const line of o.split('\n')) {
      if (!line.trim()) continue;
      let p = line.length > 3 ? line.slice(3) : line;
      const ar = p.indexOf(' -> '); if (ar >= 0) p = p.slice(ar + 4);          // R  旧 -> 新
      p = p.trim().replace(/^"|"$/g, '');
      if (p) changed.add(rel(p));
    }
  }
  if (!changed.size) { console.log('--auto：工作区干净 ⇒ 无改动可判，按 meta 跑一遍仓库纪律'); GRPA = GRPA || 'meta'; }
  else {
    const by = {};
    for (const p of changed) { const g = cls(p); (by[g] = by[g] || []).push(p); }
    let top = 'meta';
    for (const g of Object.keys(by)) if (RANK[g] > RANK[top]) top = g;
    console.log('--auto 判据（改动 ' + changed.size + ' 个路径）：');
    for (const g of Object.keys(by).sort((x, y) => RANK[y] - RANK[x]))
      console.log('  ' + g.padEnd(7) + by[g].length + ' 个 ‖ ' + by[g].slice(0, 4).join(' ') + (by[g].length > 4 ? ' …' : ''));
    GRPA = top === 'engine' ? '' : top;
    console.log('--auto ⇒ np 跑 ' + (GRPA ? '--group=' + GRPA : '**整轮**（engine 面 ⇒ 不分组）') +
      '；⚠ 分组那一遍**不是认证**');
  }
}
if (process.argv.includes('--np') || process.argv.includes('--auto')) {
  jobs.unshift({ name: GRPA ? 'np/' + GRPA : 'np', argv: ['node', 'tools/np-test.mjs'].concat(GRPA ? ['--group=' + GRPA] : []),
    want: /通过 (\d+) \/ (\d+)/ });
}

/* ===== 10-01 19:3x（千问 §E214）：四道**并发起跑**，判词与顺序一字不改 =====
 * ⚠ 这笔改动**没占版本号**（本仓惯例：`probe/perf(tool)` 类提交不 bump，版本与门由 DS 合并时定）⇒ 别去找"v1.5.310"。
 * 为什么要改：`NP_TIME=1` 实测 np 热跑 **315.9 秒**（门内合计 315.9、门槛外 0.1）‖ spec 0.3 + smoke 12.3 + battle 31.3
 *   ≈ **44 秒**，而这 44 秒以前是**排在 np 后面串行等的** —— 18 核机器上四道彼此独立（各起自己的沙箱，不共享进程），
 *   串行纯粹是 `spawnSync` 写法的顺出，不是判据要求（同族判例：D176 在 v1.5.281 已经把内部那批 60 代臂并发了）。
 * ⇒ 现在一起起跑、**按原顺序判定与打印**（判词逻辑、退出码、失败落盘全部保持）。
 * ⚠ 三条必须写清的行为差异：
 *   ① 四道同跑 ⇒ 单道秒数会比串行时**略大**（抢核），所以总结论里那道 `（xxx s）` 不再与串行历史数字直接可比；
 *   ② 输出上限从 `maxBuffer: 64MB`（超了 ENOBUFS 直接判红）换成"超过就**停止记录**"⇒ 判词可能因尾部缺失而报"无判词"，
 *      这是**保守方向**（宁可假红不要假绿），且真实输出约 200KB，离上限三个数量级；
 *   ③ `setEncoding('utf8')` 必须有：不设置则跨 chunk 的中文字节会被拼坏 ⇒ `want: /通过 (\d+)\/(\d+)/` 可能读不到（**假红**）。 */
function launch(j) {
  return new Promise(function (resolve) {
    const t0 = Date.now();
    console.log('▶ 起跑 ' + j.name + ' …');            // 进度立刻可见（以前全缓存到结束才印，像挂死了）
    const p = spawn(j.argv[0], j.argv.slice(1), { cwd: ROOT });
    let so = '', se = '', over = false;
    const CAP = 64 << 20;
    p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8');
    p.stdout.on('data', function (d) { if (over) return; so += d; if (so.length > CAP) { so = so.slice(0, CAP); over = true; } });
    p.stderr.on('data', function (d) { if (over) return; se += d; if (se.length > CAP) { se = se.slice(0, CAP); over = true; } });
    p.on('error', function (e) { se += '\n spawn 失败：' + e.message; resolve({ j, status: -1, stdout: so, stderr: se, sec: ((Date.now() - t0) / 1000).toFixed(1), over }); });
    p.on('close', function (code) { resolve({ j, status: code, stdout: so, stderr: se, sec: ((Date.now() - t0) / 1000).toFixed(1), over }); });
  });
}
/* §E355b（10-06 实测）：**页面那两道排到重活之后**，判据/顺序/退出码一字不动。
 * 起因：本版第一次整轮跑出 `np 274/274 ‖ spec 52/52 ‖ smoke OK ‖ battle 无判词(174.9s)`，
 *   而单独跑 `node tools/battle-test.mjs` 是 `BATTLE OK`、约 35 秒 ⇒ **红的是并发，不是代码**：
 *   np 冷跑会把 18 核吃满，而 smoke/battle 是**基于固定 sleep 与"等结果覆盖层"的时间判据**（导航后 1600ms、点击后 650ms…），
 *   被抢核之后那些等待成倍不够 ⇒ 超时假红。这与 CI 上 windows `browser` 档"转阻断后 3 跑 2 红、两次都只跑 43 秒"是同一族形状。
 * ⇒ 分两波：`spec + np`（都不依赖真实时间，随便抢核）并发起，跑完再起 `smoke/battle`；
 *   代价 = 整轮多约 45 秒（np 本来就 8~16 分钟），换来的是"四道全绿"这句话**可复现**。
 * ⚠ 这不修 CI 的 windows 观察档（那里只跑这两道、本来就没有抢核），也不改变任何一道门的判词。 */
const isBrowserGate = function (j) { return j.name === 'smoke' || j.name === 'battle'; };
const heavy = jobs.filter(function (j) { return !isBrowserGate(j); });
const light = jobs.filter(isBrowserGate);
const byName = new Map();
for (const r of await Promise.all(heavy.map(launch))) byName.set(r.j.name, r);
if (light.length) {
  console.log('‖ 页面那两道（smoke/battle）等重活跑完再起 —— §E355b：它们的时间判据扛不住 np 抢核');
  for (const r of await Promise.all(light.map(launch))) byName.set(r.j.name, r);
}
const running = jobs.map(function (j) { return byName.get(j.name); });
const out = [];
for (let ji = 0; ji < jobs.length; ji++) {
  const j = jobs[ji];
  const r = running[ji];
  const sec = r.sec;
  const full = String(r.stdout || '') + '\n' + String(r.stderr || '') + (r.over ? '\n⚠ 输出超 64MB，后面的没记录（保守：可能因此读不到判词）' : '');
  const tail = full.split('\n').slice(-40).join('\n');
  const m = j.want.exec(tail);
  /* 带捕获组的判词（`通过 n / n`）比两个数字；不带捕获组的（smoke/battle）只判"匹配到没有"。
   * 早先版本对后者取 `m[1]===m[2]` ⇒ 两边都是 undefined ⇒ NaN!==NaN ⇒ **全绿也报红**。 */
  const counted = m && m[1] !== undefined;
  const pass = r.status === 0 && !!m && (!counted || Number(m[1]) === Number(m[2]));
  const reading = counted ? (m[1] + '/' + m[2]) : (m ? 'OK' : '无判词');
  out.push({ name: j.name, pass, reading, sec });
  if (!pass) {
    /* v1.5.286 修自己的缺陷：以前只留尾部 40 行 ⇒ **np 234/236 时第二道红被藏住**，
     * 只能靠再跑一遍全量才知道是哪条。现在**完整输出落文件**并点名路径。
     * ⚠ 这段刚落笔时**漏了 `writeFileSync` 的 import**：外面的 `try/catch` 把 ReferenceError 吞了 ⇒
     *   屏幕上照样打印"完整输出：<路径>"，而那个文件根本没写出来 ⇒ 又是一条"假凭证"（同 §E121 那族）。
     *   ⇒ import 补上，且**写失败要在判词里明说**，不许继续指一个不存在的文件。 */
    const dump = path.join(ROOT, 'docs', 'artifacts', 'gate-fail-' + j.name + '.txt');
    let dumpNote = '';
    try { writeFileSync(dump, full); } catch (e) { dumpNote = '（⚠ 落盘失败：' + e.message + ' ⇒ 只有下面的尾部）'; }
    console.error('⛔ ' + j.name + ' 红（exit=' + r.status + '）· 完整输出：' + (dumpNote ? dumpNote : rel(dump)));
    try {
      const lines = full.split('\n').filter(l => /^\s*✘/.test(l));
      if (lines.length) console.error('   失败的门（共 ' + lines.length + ' 条）：\n' + lines.map(l => '   ' + l.trim().slice(0, 150)).join('\n'));
    } catch (e) { /* 解析失败就只给文件路径 */ }
    console.error(tail.split('\n').slice(-8).join('\n'));
  }
}
const bad = out.filter(o => !o.pass);
/* §E355：**本轮缺哪几道**由跑没跑决定，不再靠 `out.length < 4` 反推成"np 未跑"那种可能说假话的固定说法
 *   （加了 `--no-browser` 之后"少的那道"完全可能不是 np —— 一个数字撑不起一句判词）。
 *   np 那道在分组时名字是 `np/<组>`，取斜杠前那一段再比。 */
const ranNames = out.map(function (o) { return o.name.split('/')[0]; });
const MISSING = ['np', 'spec', 'smoke', 'battle'].filter(function (n) { return ranNames.indexOf(n) < 0; });
const missNote = MISSING.length ? '（本轮缺：' + MISSING.join(' ') + ' ⇒ **不是四道全绿**'
  + (MISSING.indexOf('np') >= 0 ? '，加 --np' : '') + (NO_BROWSER && MISSING.indexOf('smoke') >= 0 ? '，--no-browser 摘掉的浏览器两档见 CI 观察档' : '') + '）' : '';
/* 时刻一律取本机时钟并明写时区偏移 —— 本仓已四次把 UTC/推测时刻当成本地实测时刻。 */
function localStamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
console.log('门禁：' + out.map(o => o.name + ' ' + o.reading + '（' + o.sec + 's）').join(' · ') +
  (bad.length ? '' : '（同一棵树 ' + localStamp() + ' 本机时刻' + (GRPA ? '‖ §E335 分组 ' + GRPA + '：**不是整轮认证**）' : '）')));
console.log(bad.length ? '⛔ 结论：**不是全绿** —— ' + bad.map(b => b.name).join('/') + ' 红' + missNote
  : '✔ 结论：**' + out.length + ' 道全绿**' + missNote
    + (GRPA ? ' ‖ 但 np 只跑了 `--group=' + GRPA + '` 那一组 ⇒ 这一遍**不许当认证引用**（认证 = 不带 --group 的整轮）。' : ''));
process.exit(bad.length ? 7 : 0);
