/* §E672 取证器（真浏览器）：底图（地形/壳）吃的是哪一列？色带定标的又是哪一列？
 *
 * 用户 10-20 下午的三张图（颜色=家族，所以看到的红蓝**全是底图那一层**）：
 *   ① 长程档整体"偏灰蓝"比默认档多得多；
 *   ② 长程档把 F窗口拉到**偏低**一段 ⇒ 红明显多；
 *   ③ 拉到**偏高**一段 ⇒ 整张全蓝、一个红都没有。
 * 这三条同一个解释就够：**底图的 IDW 硬编码读 `Hp`（默认桌那一列），而色带 `colBand()` 读的是当前档的 `Fv`**
 *   ⇒ 长程档里"被上色的数"与"定标的尺"不是同一把；窗口一收窄，整套场值整体跑到带外 ⇒ 被钳到色端（②③）。
 * 顺带量第二条：`Fv(long)` 直接回表里烘死的 `Flong`（实测 = Hplong/100 + **0.10**·S，误差 ≤5e-5）
 *   ⇒ 长程档那根 T 滑杆**不动 F**，而默认档动。
 *
 * 用法：node docs/research/archive/2026-10-20-map-terrain/terrain-probe.mjs [--port=9371]
 * 只读：只起无头 Chrome 读页面自己算出来的东西（改 st.T 之后会还原）。
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../../../../tools/cdp-boot.mjs';
import { rejectUnknownFlags } from '../../../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['port', 'chrome', 'cdp-wait', 'page'], 'terrain-probe');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const PORT = Number(flag('port', 9371));
/* ⚑ 对照"改之前"用 `--page=<另一份自包含页>`，**不要覆盖在册的 champion-map/index.html**
 *   （上一节我就是靠 cp 还原副本，把一次假红带进了 D234⑩c）。这份页无外部依赖，放哪都能开。 */
const PAGE = flag('page', '') ? ('file:///' + resolve(flag('page', '')).replace(/\\/g, '/'))
  : ('file:///' + join(ROOT, 'champion-map', 'index.html').replace(/\\/g, '/'));

const BOOT = launchChrome({ chrome: flag('chrome', undefined), port: PORT, tries: Number(flag('cdp-wait', 60)) });
const watchdog = setTimeout(() => { console.error('[guard] 超时，收尸'); BOOT.killTree(); process.exit(3); }, 240000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const CASES = [
  ['multi 全范围', 'mode=map&ftab=multi'],
  ['long  全范围', 'mode=map&ftab=long'],
  ['multi 低窗 0.143–0.653', 'mode=map&ftab=multi&flo=0.143&fhi=0.653'],
  ['long  低窗 0.143–0.653', 'mode=map&ftab=long&flo=0.143&fhi=0.653'],
  ['multi 高窗 0.715–0.887', 'mode=map&ftab=multi&flo=0.715&fhi=0.887'],
  ['long  高窗 0.715–0.887', 'mode=map&ftab=long&flo=0.715&fhi=0.887'],
];

/* 页面里跑这一段：**直接读烘出来的地板位图 FL.px**（不是照代码复算 ⇒ 复算的话修复前后读出来一样，看不见效果）。
 *   地板格按 R/B 谁大分侧；再读页面自己的两个计数器 FL.painted ‖ FL.oob（场值跑到"可见点 F 区间"之外的格数，
 *   §E381 那条自证 —— 它只在**收窄窗口**时才有牙，出厂全范围态恒 0，所以四个标准视图一直量不到这个病）。 */
const SNAP = `(()=>{
  const vis = P.filter(d => inWin(d));
  let blue=0, red=0, at0=0, at1=0; const ts=[];
  for (const d of vis) { const t = fCol(Fv(d)); ts.push(t);
    if (t < 0.5) blue++; else red++; if (t <= 1e-9) at0++; if (t >= 1-1e-9) at1++; }
  ts.sort((a,b)=>a-b);
  const pts = { n: vis.length, blue: +(100*blue/vis.length).toFixed(1), red: +(100*red/vis.length).toFixed(1),
                med: +ts[ts.length>>1].toFixed(3), atFloor: at0, atCeil: at1 };
  const bd = colBand();
  const o = { tab: st.ftab, flo: +st.flo.toFixed(3), fhi: +st.fhi.toFixed(3), T: st.T, points: pts,
    band: bd ? { lo:+bd.lo.toFixed(4), med:+bd.med.toFixed(4), hi:+bd.hi.toFixed(4), n: bd.n, mode: bd.mode } : null };
  if (!FL || !FL.px) { o.floor = null; return o; }
  const px = FL.px; let fb=0, fr=0, fn=0, tot=0;
  for (let i = 0; i < px.length; i += 4) { const R=px[i], G=px[i+1], B=px[i+2]; tot++;
    if (Math.abs(R-B) < 6) { fn++; continue; } if (B > R) fb++; else fr++; }
  o.floor = { cells: tot, colored: tot-fn, blue: +(100*fb/(tot-fn)).toFixed(1), red: +(100*fr/(tot-fn)).toFixed(1),
              painted: FL.painted, oob: FL.oob, sigTab: FL.tab, sigVis: FL.vis };
  return o;
})()`;

async function main() {
  const tabs = await BOOT.tabs();
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) return { __err: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
    return r.result?.result?.value;
  };
  await send('Runtime.enable'); await send('Page.enable');

  /* ⚠ 换 fragment **不会重载文档**（hash 只在装载时解析一次，viewer.mjs:4483 自己写着）⇒
   *   必须先 goto about:blank 再回目标 URL，否则六行量的都是同一份默认态（我第一版就空转过一次）。*/
  async function goto(hash) {
    await send('Page.navigate', { url: 'about:blank' }); await sleep(250);
    await send('Page.navigate', { url: PAGE + '#' + hash });
    for (let g = 0; g < 40; g++) { if (await evalJS(`(()=>typeof fCol==='function'&&typeof colBand==='function')()`)) return true; await sleep(400); }
    return false;
  }

  console.log('档 / 窗口                 色带 = 当前档 Fv 的 [lo, med, hi]   地板位图（页面自己烘的那张）        点色（同一把尺）');
  for (const [name, hash] of CASES) {
    if (!await goto(hash + '&check=0')) { console.log('  ⛔ ' + name + ' 页面没起来（仪器跑不了，不是图坏了）'); continue; }
    await sleep(900);
    const s = await evalJS(SNAP);
    if (!s || s.__err) { console.log('  ⛔ ' + name + ' 读不到：' + (s && s.__err)); continue; }
    const wantTab = /ftab=(\w+)/.exec(hash); const wantWin = /flo=([\d.]+)/.exec(hash), wantHi = /fhi=([\d.]+)/.exec(hash);
    const b = s.band || {}, f = s.floor;
    console.log('  ' + name.padEnd(24) +
      ('[' + (b.lo ?? '?') + ', ' + (b.med ?? '?') + ', ' + (b.hi ?? '?') + '] ' + b.n + ' 枚/' + b.mode).padEnd(32) +
      (f ? ('地板格 蓝 ' + String(f.blue).padStart(5) + '% ‖ 红 ' + String(f.red).padStart(5) + '% ‖ oob ' + String(f.oob).padStart(5) + '/' + f.painted).padEnd(52)
         : '（FL 还没烘出来）'.padEnd(52)) +
      ('点色 蓝 ' + String(s.points.blue).padStart(5) + '% ‖ 红 ' + String(s.points.red).padStart(5) + '% ‖ 钳蓝 ' + String(s.points.atFloor).padStart(3) + ' ‖ 钳红 ' + String(s.points.atCeil).padStart(3)));
    if (f && f.sigTab !== s.tab) console.log('     ⚠ 位图是 ' + f.sigTab + ' 档烘的而当前 st.ftab=' + s.tab + ' ⇒ 缓存没作废，这一行不算数');
    if (f && String(f.sigVis).indexOf(s.flo.toFixed(3) + ',' + s.fhi.toFixed(3)) < 0)
      console.log('     ⚠ 位图的窗口签名（' + f.sigVis + '）与当前 flo/fhi 不符 ⇒ 拿的是上一态的地板，这一行不算数');
    if (wantTab && s.tab !== wantTab[1]) console.log('     ⚠ 桌形没生效（st.ftab=' + s.tab + '）⇒ 这一行不算数');
    if (Math.abs(s.flo - (wantWin ? Number(wantWin[1]) : 0)) > 2e-3 || Math.abs(s.fhi - (wantHi ? Number(wantHi[1]) : 1)) > 2e-3)
      console.log('     ⚠ 窗口没生效（读到 flo=' + s.flo + ' fhi=' + s.fhi + '）⇒ 这一行不算数');
  }

  /* 第二条：T 滑杆在两档下动不动 F（一次 evaluate 内做完，免得把数组跨进程传） */
  const TTEST = `(()=>{const tab=st.ftab, a=Fv(P[0]), ids=P.slice(0,400).map(d=>Fv(d));
    st.T=0.50; FSRT.key=''; _FR.k=''; _EPR.k=''; _SCR.k=''; recalcRank();
    const b=Fv(P[0]), ids2=P.slice(0,400).map(d=>Fv(d)); let ch=0;
    for(let i=0;i<ids.length;i++) if(Math.abs(ids[i]-ids2[i])>1e-9) ch++;
    st.T=0.10; FSRT.key=''; _FR.k=''; _EPR.k=''; _SCR.k=''; recalcRank();
    return {tab, a, b, moved: ch, of: ids.length};})()`;
  await goto('mode=map&ftab=long'); await sleep(1400);
  const t1 = await evalJS(TTEST);
  await goto('mode=map&ftab=multi'); await sleep(1400);
  const t2 = await evalJS(TTEST);
  console.log('\nT 滑杆（0.10 → 0.50）改不改 F：');
  for (const t of [t2, t1]) console.log('  ' + String(t.tab).padEnd(6) + ' 前 400 枚里 F 变了的：' + t.moved + '/' + t.of +
    '   ‖ 例：F[0] ' + (t.a ?? 0).toFixed(4) + ' → ' + (t.b ?? 0).toFixed(4));
  console.log('\n读法：长程档那一行若 moved=0 ⇒ 头号尺根本不跟 T 走（烘死的 Flong = Hplong/100 + 0.10·S），而默认档跟 ⇒ 两档不是同一套渲染方法。');
  if (errors.length) console.log('⚠ 页面异常：' + errors.slice(0, 3).join(' ⏎ '));
  await send('Browser.close').catch(() => {}); BOOT.killTree();
  process.exit(0);
}
main().catch(e => { console.error('⛔ ' + (e && e.stack || e)); BOOT.killTree(); process.exit(2); });
