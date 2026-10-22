#!/usr/bin/env node
/* page-chrome.mjs —— 真 Chrome 读页面运行时状态的最小探针（2026-10-22 DS · §E677 后续）
 *   用途：给 ui-contract 的文本门做行为试点 —— 打开 index.html，等 EpirusTrainer 就绪，
 *   求值调用方给的表达式（--expr=...），把结果打到 stdout 的 `RESULT <json>` 行。
 *   退出码：0 成功；2 求值失败/超时；4 找不到 Chrome（响亮，不冒充页面红）。
 *   实现复用 tools/cdp-boot.mjs 的 resolveChrome/launchChrome；CDP 客户端与 tools/ui-probe.mjs 同形。
 */
import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChrome } from './cdp-boot.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = process.argv.slice(2);
const expr = (A.find(function (a) { return a.indexOf('--expr=') === 0; }) || '').slice(7);
const urlArg = (A.find(function (a) { return a.indexOf('--url=') === 0; }) || '').slice(6);
const url = urlArg || ('file:///' + join(ROOT, 'index.html').replace(/\\/g, '/'));
if (!expr) { console.error('⛔ 缺 --expr=...'); process.exit(2); }
const RES = resolveChrome(process.env.EPIRUS_CHROME || undefined);
const CHROME = RES && RES.path;
if (!CHROME) { console.error('⛔ 找不到 Chrome（可用 EPIRUS_CHROME 指定）;找过 ' + (RES ? RES.tried.join(' | ') : '?')); process.exit(4); }
const port = 9300 + Math.floor(Math.random() * 200);
const udd = mkdtempSync(join(tmpdir(), 'epirus-page-'));
const proc = spawn(CHROME, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=' + port, '--user-data-dir=' + udd, 'about:blank'], { stdio: 'ignore' });
let closed = false;
function killTree() { if (closed) return; closed = true; try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill('SIGKILL'); } catch (e) {} try { rmSync(udd, { recursive: true, force: true }); } catch (e) {} }
process.on('exit', killTree);
async function waitJson(p, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch('http://127.0.0.1:' + p + '/json/list'); if (r.ok) return await r.json(); } catch (e) {} await new Promise(function (r) { setTimeout(r, 150); }); } return null; }
let target = null;
for (let i = 0; i < 80 && !target; i++) { const list = await waitJson(port, 300); if (list) target = list.find(function (t) { return t.type === 'page'; }); if (!target) await new Promise(function (r) { setTimeout(r, 150); }); }
if (!target) { console.error('⛔ CDP 端口没起来（chrome=' + CHROME + '）'); killTree(); process.exit(2); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener('message', function (ev) { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
function send(method, params) { return new Promise(function (res) { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: method, params: params || {} })); }); }
await new Promise(function (res, rej) { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: url });
const wrapped = 'new Promise(function(r){var t=setInterval(function(){if(document.readyState==="complete"){clearInterval(t);try{r(' + expr + ');}catch(e){r({error:String(e)});}}},80);setTimeout(function(){clearInterval(t);r({timeout:true});},15000);})';
const out = await send('Runtime.evaluate', { expression: wrapped, awaitPromise: true, returnByValue: true });
if (process.env.EPIRUS_DEBUG_CDP) console.log('RAW ' + JSON.stringify(out).slice(0, 500));
const val = out && out.result && out.result.result ? out.result.result.value : undefined;
console.log('RESULT ' + JSON.stringify(val === undefined ? null : val));
killTree();
process.exit(val && val.timeout ? 2 : 0);
