import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../tools/cdp-boot.mjs';
import { extractJsonObject } from '../tools/audit-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pack = process.argv[2];
const players = Number(process.argv[3] || 5);
const maxRounds = Number(process.argv[4] || 30);
if (!pack) throw new Error('usage: node scratch/browser-candidate-test.mjs <pack> [players] [rounds]');
const raw = extractJsonObject(readFileSync(pack, 'utf8'), 'EPIRUS_CHAMPION_3P');
if (!raw) throw new Error('champion object not found');
const champ = JSON.stringify(JSON.parse(raw));
const boot = launchChrome({ port: 9348, tries: 80 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
(async () => {
  const page = (await boot.tabs()).find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
    return r.result?.result?.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/') });
  await sleep(1800);
  await evalJS(`localStorage.setItem('epirus.champion3p', ${JSON.stringify(champ)});`);
  await send('Page.navigate', { url: 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/') });
  await sleep(1800);
  await evalJS(`(()=>{const p=document.getElementById('sel-players');p.value='${players}';p.dispatchEvent(new Event('change'));const h=document.getElementById('sel-hp');h.value='3';h.dispatchEvent(new Event('change'));const d=document.getElementById('sel-diff');d.value='lv:hard';d.dispatchEvent(new Event('change'));document.getElementById('btn-newgame').click();return 1;})()`);
  await sleep(900);
  const names = ['枪', '激光剑', '坦克', '狙击枪', '电磁炮', '真正的落雷', '摄魂指法', '防御', 'ジ', '蓄能'];
  let rounds = 0;
  for (let i = 0; i < maxRounds * 3; i++) {
    if (await evalJS(`!document.getElementById('overlay-root').classList.contains('hidden')`)) break;
    if (await evalJS(`(()=>{const r=document.getElementById('modal-root');return r&&!r.classList.contains('hidden');})()`)) {
      await evalJS(`(()=>{const b=document.querySelector('#modal-card #mbtn');if(b)b.click();return 1;})()`);
      await sleep(250);
      continue;
    }
    const clicked = await evalJS(`(()=>{const bs=[...document.querySelectorAll('.skillbtn')].filter(b=>!b.disabled);const order=${JSON.stringify(names)};for(const n of order){const b=bs.find(x=>x.querySelector('.nm')?.textContent===n);if(b){b.click();return n;}}return '';})()`);
    if (!clicked) { await sleep(250); continue; }
    await sleep(650);
    const txt = String(await evalJS(`document.getElementById('logbox').textContent`) || '');
    const ms = [...txt.matchAll(/第 (\d+) 回合/g)].map((m) => Number(m[1]));
    rounds = Math.max(rounds, ...ms, 0);
  }
  const log = String(await evalJS(`document.getElementById('logbox').textContent`) || '');
  const result = {
    pack: pack.replace(/^.*[\\/]/, ''), players, rounds,
    damage: (log.match(/伤害/g) || []).length,
    laserEye: (log.match(/激光眼/g) || []).length,
    ring: (log.match(/聚能环/g) || []).length,
    over: await evalJS(`!document.getElementById('overlay-root').classList.contains('hidden')`),
    errors,
  };
  console.log(JSON.stringify(result));
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { if (ws) ws.close(); boot.killTree(); });
