/* §E673 同区域高分辨率对照图：同一台无头 Chrome、同一个相机，两种法律各截一块，2× 放大。
 * 为什么要它：单张全图 1600×900 里一条线只有 1px 宽，"有些线更暗 / 一根线沿程不均"这种差别**在那个分辨率下量不出来也看不出来**
 *   （用户 10-20 下午：「不然我看你这个低分辨率的单个视角也看不出来」）。
 * 截两块：① 扇根（页面自己报的最密那一格 ±40px）—— 看"板"；② 一段孤立线（探针里 d≤8 的点）—— 看单线亮度。
 * 用法：node docs/research/archive/2026-10-20-edge-log/edge-ab-shots.mjs [--port=9395] [--out=<目录>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../../../../tools/cdp-boot.mjs';
import { rejectUnknownFlags } from '../../../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['port', 'chrome', 'cdp-wait', 'out'], 'edge-ab-shots');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const OUT = flag('out', '/tmp/epirus-map-1020');
try { mkdirSync(OUT, { recursive: true }); } catch (E0) {}
const PORT = Number(flag('port', 9395));
const PAGE = 'file:///' + join(ROOT, 'champion-map', 'index.html').replace(/\\/g, '/');
const BOOT = launchChrome({ chrome: flag('chrome', undefined), port: PORT, tries: Number(flag('cdp-wait', 60)),
  extraArgs: ['--window-size=1600,900', '--force-device-scale-factor=1'] });
const watchdog = setTimeout(() => { console.error('[guard] 超时，收尸'); BOOT.killTree(); process.exit(3); }, 240000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 把相机钉成页内判据用的那一态，然后交回两个取样点的 CSS 坐标：扇根中心 + 一段孤立线的中点 */
const WHERE = `(()=>{
  st.mode='tree'; st.elev=0; st.yaw=FLAT.yaw; st.pit=FLAT.pit; st.tX=0; st.tY=0; st.tKx=1; st.tKy=1;
  st.edges='all'; st.color='fam'; st.labels='off'; NOPTS=0; ELOG=1; recomputeVIS();
  EPROBE = 0; draw();                                   /* 先画一帧拿 EDGR.n（探针是在 stroke 循环里收的）*/
  EPROBE = Math.max(1, Math.round(EDGR.n / 24)); draw(); EPROBE = 0;
  var dpr = devicePixelRatio, hub = EDGR.hub, sp = null;
  for (var e=0;e<EDGR.probe.length && !sp;e++){ var p=EDGR.probe[e].pts;
    for (var u=0;u<p.length;u+=3){ if (p[u+2]<=8 && p[u]>120 && p[u+1]>120 && p[u]<cv.width-120 && p[u+1]<cv.height-120) { sp=[p[u],p[u+1],p[u+2],EDGR.probe[e].id]; break; } } }
  return { dpr: dpr, hubn: EDGR.hubn,
    hub: hub ? [hub[0]/dpr, hub[1]/dpr] : null,
    sp: sp ? [sp[0]/dpr, sp[1]/dpr, sp[2], sp[3]] : null,
    css: [cv.width/dpr, cv.height/dpr] };
})()`;

async function main() {
  const tabs = await BOOT.tabs();
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    return r.result?.exceptionDetails ? ('ERR:' + r.result.exceptionDetails.text) : r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  const W = 420, H = 300, SCALE = 2;
  for (const law of ['attr', 'log']) {
    await send('Page.navigate', { url: 'about:blank' }); await sleep(250);
    await send('Page.navigate', { url: PAGE + '#mode=tree&edges=all&elaw=' + law });
    for (let i = 0; i < 40; i++) { if (await evalJS(`(()=>typeof EDGR==='object'&&typeof FLAT==='object')()`)) break; await sleep(400); }
    await sleep(1200);
    const w = await evalJS(WHERE);
    if (!w || w.hub === null) { console.log('⛔ ' + law + ' 拿不到扇根坐标：' + JSON.stringify(w)); continue; }
    console.log(law + '：画布 CSS ' + w.css[0].toFixed(0) + '×' + w.css[1].toFixed(0) + ' ‖ 最密那格压 ' + w.hubn + ' 条 ‖ 孤立取样 ' + (w.sp ? w.sp[3] + '（d=' + w.sp[2] + '）' : '没找到'));
    const shots = [['hub', w.hub], ['sparse', w.sp]];
    for (const [nm, c] of shots) {
      if (!c) continue;
      const x = Math.max(0, Math.min(w.css[0] - W, c[0] - W / 2)), y = Math.max(0, Math.min(w.css[1] - H, c[1] - H / 2));
      const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: W, height: H, scale: SCALE } });
      const b64 = r.result && r.result.data; if (!b64) { console.log('  ⛔ 截图没数据 ' + nm); continue; }
      const f = join(OUT, 'edge-' + law + '-' + nm + '.png');
      writeFileSync(f, Buffer.from(b64, 'base64'));
      console.log('  写了 ' + f + '（' + (W * SCALE) + '×' + (H * SCALE) + ' ‖ 中心 ' + Math.round(c[0]) + ',' + Math.round(c[1]) + '）');
    }
  }
  await send('Browser.close').catch(() => {}); BOOT.killTree();
  console.log('\n对照看法：同一块区域、同一台相机、只有法律不同。edge-attr-hub.png ↔ edge-log-hub.png 看扇根那块板；'
    + 'edge-attr-sparse.png ↔ edge-log-sparse.png 看单根线的亮度是否被别的边拖累。');
  process.exit(0);
}
main().catch(e => { console.error('⛔ ' + (e && e.stack || e)); BOOT.killTree(); process.exit(2); });
