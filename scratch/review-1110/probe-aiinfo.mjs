
import { launchChrome } from '../../tools/cdp-boot.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const URL = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');
const BOOT = launchChrome({ port: 9451, tries: 60 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  await BOOT.version();
  const tabs = await BOOT.tabs();
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(2500);
  const expr = "(function(){const U=window.EpirusUI;if(!U)return 'NO UI';const sel=document.getElementById('sel-diff'),pl=document.getElementById('sel-players'),ng=document.getElementById('btn-newgame');pl.value='2';pl.dispatchEvent(new Event('change'));ng.click();const out=[];for(const d of ['lv:sparring','lv:regular','lv:hard']){sel.value=d;sel.dispatchEvent(new Event('change'));ng.click();const i=U.aiInfo();out.push({d:d,src:i.source,from:i.from,seats:i.poolDraw&&i.poolDraw.seats});}return JSON.stringify(out);})()";
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  console.log(JSON.stringify(r.result && r.result.result && r.result.result.value));
} finally { BOOT.killTree(); }
