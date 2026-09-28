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
import { spawnSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const jobs = [
  { name: 'spec', argv: ['node', 'tools/spec-run.mjs'], want: /通过 (\d+) \/ (\d+)/ },
  { name: 'smoke', argv: ['node', 'tools/smoke.mjs'], want: /SMOKE OK/ },
  { name: 'battle', argv: ['node', 'tools/battle-test.mjs'], want: /BATTLE OK/ },
];
if (process.argv.includes('--np')) {
  jobs.unshift({ name: 'np', argv: ['node', 'tools/np-test.mjs'], want: /通过 (\d+) \/ (\d+)/ });
}

const out = [];
for (const j of jobs) {
  const t0 = Date.now();
  const r = spawnSync(j.argv[0], j.argv.slice(1), { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  const tail = String(r.stdout || '').split('\n').slice(-40).join('\n') + String(r.stderr || '').split('\n').slice(-6).join('\n');
  const m = j.want.exec(tail);
  /* 带捕获组的判词（`通过 n / n`）比两个数字；不带捕获组的（smoke/battle）只判"匹配到没有"。
   * 早先版本对后者取 `m[1]===m[2]` ⇒ 两边都是 undefined ⇒ NaN!==NaN ⇒ **全绿也报红**。 */
  const counted = m && m[1] !== undefined;
  const pass = r.status === 0 && !!m && (!counted || Number(m[1]) === Number(m[2]));
  const reading = counted ? (m[1] + '/' + m[2]) : (m ? 'OK' : '无判词');
  out.push({ name: j.name, pass, reading, sec });
  if (!pass) {
    console.error('⛔ ' + j.name + ' 红（exit=' + r.status + '）。尾部输出：');
    console.error(tail.split('\n').slice(-14).join('\n'));
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
