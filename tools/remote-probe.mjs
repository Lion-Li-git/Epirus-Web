/* Epirus 远程训练实时曲线探针：连接运行中的 Node 训练服务，抓"训练中图表"截图，
 * 验证远程 SSE 事件能推进 remoteHistory 并 drawChart（y 轴自适应，最优分可>1）。
 * 用法：node tools/remote-probe.mjs [端口=8787] [本次代数=6] [chrome路径]
 * 前置：先运行 node server/train-server.mjs [端口]（或双击 tools/start-train-server.cmd）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* 位置参数：剔除 --flag（如 --max-ms=N），否则会被当成端口/chrome 路径 */
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });

const PORT = Number(ARGV[0] || 8787);
const GENS = parseInt(ARGV[1] || '6', 10);
const CHROME = ARGV[2] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///D:/code/Epirus-Web/index.html';
const CDP_PORT = Number(ARGV[3] || 9349);

const udd = mkdtempSync(join(tmpdir(), 'epirus-remote-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + udd, 'about:blank'
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
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(200);
  }
  throw new Error('CDP not reachable');
}

async function main() {
  await waitJson(`http://127.0.0.1:${CDP_PORT}/json/version`);
  const tabs = await waitJson(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); let errors = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || 'exc');
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console:' + m.params.args.map(a => a.value || '').join(' '));
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails.exception?.description)); return r.result?.result?.value; };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1500);
  await evalJS(`document.getElementById('tab-train').click()`);
  await sleep(300);
  await evalJS(`document.getElementById('tr-port').value=${PORT}; document.getElementById('tr-remote-gens').value=${GENS}; document.getElementById('tr-pop').value=6; document.getElementById('btn-train').click()`);
  // 等待若干 gen 事件推进 remoteHistory 并 drawChart
  await sleep(8000);
  const state = await evalJS(`document.getElementById('tr-state').textContent`);
  const seedsStatus = await evalJS(`document.getElementById('tr-seeds-status') ? document.getElementById('tr-seeds-status').textContent : ''`);
  const remote = await evalJS(`document.getElementById('tr-remote').textContent`);
  // 图表 canvas 应有像素（非空）
  const chartPixels = await evalJS(`(function(){var c=document.getElementById('chart');if(!c)return -1;var g=c.getContext('2d');var d=g.getImageData(0,0,c.width,c.height).data;var n=0;for(var i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;})()`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = join(tmpdir(), 'screenshot-remote-chart.png');
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  // 额外把图表滚入视野截一张（用于视觉确认 y 轴自适应曲线）
  await evalJS(`(function(){var c=document.getElementById('chart');if(c)c.scrollIntoView({block:'center'});return true;})()`);
  await sleep(400);
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const out2 = join(tmpdir(), 'screenshot-remote-chart2.png');
  writeFileSync(out2, Buffer.from(shot2.result.data, 'base64'));
  console.log('saved', out);
  console.log('state =', JSON.stringify(state));
  console.log('seedsStatus =', JSON.stringify(seedsStatus));
  console.log('remote =', JSON.stringify(remote));
  console.log('chart painted pixels =', chartPixels, chartPixels > 0 ? '(PASS)' : '(FAIL)');
  console.log('JS errors =', errors.length ? errors : '(none)');
  console.log('saved', out, 'and', out2);
  const ok = chartPixels > 0 && errors.length === 0;
  console.log(ok ? 'REMOTE CHART OK' : 'REMOTE CHART FAILED');
  return ok ? 0 : 1;
}

main().then(function (code) { clearTimeout(__watchdog); __killTree(); process.exitCode = code; })
  .catch(function (e) { clearTimeout(__watchdog); console.error('PROBE ERROR:', e && e.stack || e); __killTree(); process.exitCode = 2; });
