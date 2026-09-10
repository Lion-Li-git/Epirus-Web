/* Epirus 页面冒烟测试：用 Chrome DevTools Protocol 驱动真实 UI。
 * 用法：node tools/smoke.mjs [chrome路径] [端口]
 * 产出：/tmp 下的 screenshot-battle.png / screenshot-train.png，收集 console/异常，
 *       并断言若干关键 UI 状态。
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* 位置参数：剔除 --flag（如 --max-ms=N），否则会被当成端口/chrome 路径 */
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });

const CHROME = ARGV[0] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(ARGV[1] || 9337);
const URL = 'file:///D:/code/Epirus-Web/index.html';

const udd = mkdtempSync(join(tmpdir(), 'epirus-cdp-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'about:blank'
], { stdio: 'ignore' });
/* --- 自限时 + 收尸（不再用 shell timeout 包 node：那样 node 被杀时
 * finally 不会执行 → 探针自己起的 headless Chrome 变成孤儿。
 * 现在由脚本自己计时，到点先杀 Chrome 进程树再退出。用 --max-ms=N 调。 --- */
const MAX_MS = Number((process.argv.find(function (a) { return /^--max-ms=/.test(a); }) || '').split('=')[1]) || 240000;
let __closed = false;
function __killTree() {
  if (__closed) return; __closed = true;
  try {
    if (process.platform === 'win32' && proc && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else if (proc) proc.kill('SIGKILL');
  } catch (e) { }
  // 一并删掉自己的临时 profile 目录（否则 %TEMP% 会积成堆）
  try { rmSync(udd, { recursive: true, force: true }); } catch (e) { }
}
const __watchdog = setTimeout(function () {
  console.error('[guard] 超时 ' + MAX_MS + 'ms，自杀并收尸 Chrome');
  __killTree(); process.exit(3);
}, MAX_MS);


const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('CDP endpoint not reachable: ' + url);
}

let errors = [];
let cdp;
async function main() {
  const ver = await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const tabs = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text || '';
      // 探测"未启动的训练服务"产生的是预期网络错误，不是 JS 异常
      if (t.indexOf('ERR_CONNECTION_REFUSED') < 0) errors.push('LOG: ' + t);
    }
  };
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails.exception?.description));
    return r.result?.result?.value;
  };
  const shot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  };
  cdp = { send, evalJS, shot };

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1600);

  const checks = [];
  const check = (name, cond) => { checks.push([name, !!cond]); console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); };

  // --- 对局页 ---
  check('对局页可见 & 技能按钮=30(28可用+2置灰)', await evalJS(`document.querySelectorAll('.skillbtn').length === 30`));
  check('多人专用技能置灰(≥2 disabled)', await evalJS(`document.querySelectorAll('.skillbtn:disabled').length >= 2`));
  check('双方 HP 显示 3', await evalJS(`[...document.querySelectorAll('.side .statbar .stat')].some(s=>s.textContent.includes('HP')&&s.textContent.includes('3'))`));

  // 打 4 个回合（稳健招，避免提前终局）
  const moves = ['ジ', '防御', 'ジ', '防御'];
  for (const mv of moves) {
    const okClick = await evalJS(`(()=>{const b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent===${JSON.stringify(mv)} && !x.disabled); if(!b) return false; b.click(); return true;})()`);
    check('点击出招:' + mv, okClick === true);
    await sleep(650);
  }
  check('日志有第 4 回合', await evalJS(`document.getElementById('logbox').textContent.includes('第 4 回合')`));
  check('界面无 over 覆盖层', await evalJS(`document.getElementById('overlay-root').classList.contains('hidden')`));
  await shot(join(tmpdir(), 'screenshot-battle.png'));
  console.log('screenshot-battle saved');

  // --- 训练场：远程 Node 服务流程 ---
  await evalJS(`document.getElementById('tab-train').click()`);
  await sleep(300);
  check('远程训练UI存在', await evalJS(`!!document.getElementById('tr-port') && !!document.getElementById('btn-train') && !!document.getElementById('btn-remote') && !!document.getElementById('tr-remote-gens')`));
  // 无服务时点击「开始训练」：应优雅提示"服务未启动/自动连接"，不抛 JS 错误
  await evalJS(`document.getElementById('tr-port').value=8799; document.getElementById('tr-remote-gens').value=3; document.getElementById('btn-train').click()`);
  await sleep(2500);
  const remoteHint = await evalJS(`document.getElementById('tr-remote').textContent`);
  console.log('remoteHint =', JSON.stringify(remoteHint));
  check('服务未启动提示', /服务未启动|自动|启动/.test(remoteHint));
  check('按钮未锁死', await evalJS(`!document.getElementById('btn-train').disabled`));
  await shot(join(tmpdir(), 'screenshot-train.png'));
  console.log('screenshot-train saved');

  console.log('\nJS errors:', errors.length ? errors : '(none)');
  console.log('SUMMARY:', checks.every(c => c[1]) && errors.length === 0 ? 'SMOKE OK' : 'SMOKE FAILED');
  process.exitCode = checks.every(c => c[1]) && errors.length === 0 ? 0 : 1;
}

main().catch(e => { console.error('SMOKE ERROR:', e); process.exitCode = 2; })
  .finally(async () => {
    try { proc.kill(); } catch (e) { /* ignore */ }
    await Promise.race([
      new Promise(res => proc.once('exit', res)),
      sleep(3000)
    ]);
    for (let i = 0; i < 5; i++) {
      try { rmSync(udd, { recursive: true, force: true }); break; }
      catch (e) { await sleep(400); }
    }
  });
