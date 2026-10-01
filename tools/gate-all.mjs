#!/usr/bin/env node
/* gate-all.mjs —— 四道门禁一次跑完，只给一行总结论。
 *
 * 为什么要它：本仓的"当前状态"= np + spec + smoke + battle **四道在同一棵树上全绿**，
 * 而四条命令要分别手敲、而且 np 一条就 9.5 分钟 —— 于是实际发生的是"只跑了其中一两道，
 * 然后引用全绿的口径"。这里把顺序与判词固定下来，并且明写耗时预算。
 *
 *   node tools/gate-all.mjs          # spec + smoke + battle（约 1 分钟），不跑 np
 *   node tools/gate-all.mjs --np     # 加跑 np-test（约 10 分钟）
 * 退出码：0 全绿；7 有任意一道红（点名是哪道）。
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const rel = (x) => path.relative(ROOT, x).split(path.sep).join('/');
const jobs = [
  { name: 'spec', argv: ['node', 'tools/spec-run.mjs'], want: /通过 (\d+) \/ (\d+)/ },
  { name: 'smoke', argv: ['node', 'tools/smoke.mjs'], want: /SMOKE OK/ },
  { name: 'battle', argv: ['node', 'tools/battle-test.mjs'], want: /BATTLE OK/ },
];
if (process.argv.includes('--np')) {
  jobs.unshift({ name: 'np', argv: ['node', 'tools/np-test.mjs'], want: /通过 (\d+) \/ (\d+)/ });
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
const running = await Promise.all(jobs.map(launch));
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
/* 时刻一律取本机时钟并明写时区偏移 —— 本仓已四次把 UTC/推测时刻当成本地实测时刻。 */
function localStamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
console.log('门禁：' + out.map(o => o.name + ' ' + o.reading + '（' + o.sec + 's）').join(' · ') +
  (bad.length ? '' : '（同一棵树 ' + localStamp() + ' 本机时刻）'));
console.log(bad.length ? '⛔ 结论：**不是全绿** —— ' + bad.map(b => b.name).join('/') + ' 红'
  : '✔ 结论：**' + out.length + ' 道全绿**' + (out.length < 4 ? '（np 未跑，加 --np）' : ''));
process.exit(bad.length ? 7 : 0);
