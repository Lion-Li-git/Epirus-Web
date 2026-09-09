/* Epirus 多人（3 人）页面探测：真实 Chrome 驱动 UI，验证人数选择/目标弹窗/回合推进/无 JS 异常。
 * 用法：node tools/np-probe.mjs [chrome路径] [端口]
 */
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.argv[2] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.argv[3] || 9351);
const URL = 'file:///D:/code/Epirus-Web/index.html';

const udd = mkdtempSync(join(tmpdir(), 'epirus-np-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('CDP endpoint not reachable: ' + url);
}

const errors = [];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? '  ✔ ' : '  ✘ ') + name + (detail ? '  [' + detail + ']' : ''));
}

async function main() {
  const tabs = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text || '';
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

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1800);

  // 切到 3 人
  await evalJS(`(function(){var s=document.getElementById('sel-players');s.value='3';s.dispatchEvent(new Event('change'));return 1;})()`);
  await sleep(500);

  const panels = await evalJS(`document.querySelectorAll('#side-1 .mpanel').length`);
  check('3 人：对手面板 2 个', panels === 2, 'mpanel=' + panels);
  const names = await evalJS(`Array.from(document.querySelectorAll('#side-0 h3,#side-1 .mpanel h3')).map(function(h){return h.textContent.trim();}).join('|')`);
  check('3 人：玩家名渲染', /玩家1/.test(names) && /玩家2/.test(names) && /玩家3/.test(names), names);
  const modeDisabled = await evalJS(`document.getElementById('sel-mode').disabled`);
  check('3 人：模式下拉被禁用（强制多人模式）', modeDisabled === true);
  const multiSkills = await evalJS(`(function(){var b=Array.from(document.querySelectorAll('#skillgrid button'));return b.filter(function(x){return !x.disabled;}).length;})()`);
  check('3 人：可用技能按钮 > 0', multiSkills > 0, '可用=' + multiSkills);

  // 打 8 回合
  let targetPicked = 0, picks = 0;
  for (let r = 0; r < 8; r++) {
    const over = await evalJS(`document.getElementById('overlay-root').classList.contains('hidden') === false`);
    if (over) break;
    const clicked = await evalJS(`(function(){
      var b=Array.from(document.querySelectorAll('#skillgrid button')).filter(function(x){return !x.disabled;});
      if(!b.length) return 0;
      var gun=b.find(function(x){return x.textContent.indexOf('\\u67aa')>=0;});
      (gun||b[0]).click(); return 1;
    })()`);
    if (!clicked) break;
    picks++;
    await sleep(120);
    // 目标弹窗（多人专用）
    const modalOpen = await evalJS(`document.getElementById('modal-root').classList.contains('hidden') === false`);
    if (modalOpen) {
      const btns = await evalJS(`document.querySelectorAll('#modal-root button').length`);
      if (btns > 0) { await evalJS(`document.querySelectorAll('#modal-root button')[0].click()`); targetPicked++; }
      await sleep(150);
    }
    await sleep(500);
  }

  const round = await evalJS(`(function(){var el=document.getElementById('logbox');return document.querySelectorAll('#logbox .rnd').length;})()`);
  check('3 人：回合日志推进', round >= 2, 'rnd 行=' + round);
  check('3 人：出招次数', picks >= 2, 'picks=' + picks);
  const hpShown = await evalJS(`Array.from(document.querySelectorAll('#side-0 .statbar b,#side-1 .mpanel .statbar b')).map(function(b){return b.textContent;}).join(',')`);
  check('3 人：HP/资源面板有内容', hpShown.length > 0, hpShown.slice(0, 60));

  // 目标选择弹窗是否触发过（枪=对敌技能，3 人应有 2 个目标）
  check('3 人：目标选择弹窗出现', targetPicked > 0, 'picked=' + targetPicked);

  mkdirSync('docs/artifacts', { recursive: true });
  await shot('docs/artifacts/np-3p-battle.png');

  // 5 人快测
  await evalJS(`(function(){var s=document.getElementById('sel-players');s.value='5';s.dispatchEvent(new Event('change'));return 1;})()`);
  await sleep(500);
  const p5 = await evalJS(`document.querySelectorAll('#side-1 .mpanel').length`);
  check('5 人：对手面板 4 个', p5 === 4, 'mpanel=' + p5);
  for (let r = 0; r < 3; r++) {
    await evalJS(`(function(){var b=Array.from(document.querySelectorAll('#skillgrid button')).filter(function(x){return !x.disabled;});if(b.length)b[0].click();return 1;})()`);
    await sleep(120);
    const mo = await evalJS(`document.getElementById('modal-root').classList.contains('hidden') === false`);
    if (mo) { await evalJS(`document.querySelectorAll('#modal-root button')[0].click()`); await sleep(150); }
    await sleep(500);
  }
  const log5 = await evalJS(`document.querySelectorAll('#logbox .rnd').length`);
  check('5 人：回合推进', log5 >= 1, 'rnd 行=' + log5);
  await shot('docs/artifacts/np-5p-battle.png');

  check('无 JS 异常', errors.length === 0, errors.slice(0, 3).join(' | '));

  const pass = results.filter(r => r.ok).length;
  console.log('\nNP PROBE: ' + (pass === results.length ? 'OK' : 'FAIL') + ' (' + pass + '/' + results.length + ')');
  console.log('JS errors: ' + (errors.length ? errors.join('\n') : '(none)'));
  try { proc.kill(); } catch (e) { /* ignore */ }
  process.exit(pass === results.length ? 0 : 1);
}

main().catch(e => { console.error('PROBE ERROR: ' + e.message); try { proc.kill(); } catch (x) { /* ignore */ } process.exit(1); });
