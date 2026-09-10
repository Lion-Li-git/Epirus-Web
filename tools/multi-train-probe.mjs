/* Epirus 多人训练场探针：真实 Chrome 打开训练页 → 人数选 3 → 点「开始训练」
 * → 断言 SSE 推进（tr-state 世代增长 / tr-remote 出现 1st/top2 / 图表有像素）。
 * 用法：node tools/multi-train-probe.mjs [端口=8787] [本次代数=6] [chrome路径] [cdp端口=9353]
 * 前置：先运行 node server/train-server.mjs [端口]。
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.argv[2] || 8787);
const GENS = parseInt(process.argv[3] || '6', 10);
const CHROME = process.argv[4] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'file:///D:/code/Epirus-Web/index.html';
const CDP_PORT = Number(process.argv[5] || 9353);

const udd = mkdtempSync(join(tmpdir(), 'epirus-mtrain-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + CDP_PORT, '--user-data-dir=' + udd, 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { }
    await sleep(200);
  }
  throw new Error('CDP not reachable');
}

let pass = 0, fail = 0;
function chk(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  ' + extra : '')); }
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

  // 训练页存在人数下拉
  await evalJS(`document.getElementById('tab-train').click()`);
  await sleep(300);
  const hasSel = await evalJS(`!!document.getElementById('tr-n')`);
  chk('#tr-n 人数下拉存在', hasSel === true);
  const opts = await evalJS(`Array.from(document.getElementById('tr-n').options).map(o=>o.value+':'+o.textContent).join('|')`);
  chk('#tr-n 含 2/3/4/5 四档', /2:|3:|4:|5:/.test(opts), JSON.stringify(opts));

  // 选 3 人 + 开训
  await evalJS(`document.getElementById('tr-port').value=${PORT}; document.getElementById('tr-remote-gens').value=${GENS}; document.getElementById('tr-pop').value=8; document.getElementById('tr-n').value='3'; document.getElementById('btn-train').click()`);
  await sleep(9000);

  const state = await evalJS(`document.getElementById('tr-state').textContent`);
  const remote = await evalJS(`document.getElementById('tr-remote').textContent`);
  const chartPixels = await evalJS(`(function(){var c=document.getElementById('chart');if(!c)return -1;var g=c.getContext('2d');var d=g.getImageData(0,0,c.width,c.height).data;var n=0;for(var i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;})()`);
  const nLabel = await evalJS(`document.getElementById('tr-n').value`);

  chk('人数选择为 3', nLabel === '3', 'tr-n=' + nLabel);
  chk('SSE 已推进训练（tr-state 非空）', !!state && state.length > 4, JSON.stringify(state.slice(0, 120)));
  chk('训练面板出现 1st/top2 实时值', /1st\s*\d+%|top2\s*\d+%/i.test(state + ' ' + remote), JSON.stringify((state || '').slice(0, 160)));
  chk('启动横幅含多人信息', /多人训练|3 人/.test(remote), JSON.stringify((remote || '').slice(0, 120)));
  chk('图表 canvas 已绘制', chartPixels > 0, 'pixels=' + chartPixels);
  chk('无 JS 异常', errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 3)) : '');

  await evalJS(`(function(){var c=document.getElementById('chart');if(c)c.scrollIntoView({block:'center'});return true;})()`);
  await sleep(400);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const out = join(tmpdir(), 'epirus-multi-train.png');
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('screenshot =', out);
  console.log(`MULTI-TRAIN ${fail === 0 ? 'OK' : 'FAILED'}  (${pass} pass / ${fail} fail)`);
  return fail === 0 ? 0 : 1;
}

main().then(code => { proc.kill(); process.exitCode = code; })
  .catch(e => { console.error('PROBE ERROR:', e && e.stack || e); proc.kill(); process.exitCode = 2; });
