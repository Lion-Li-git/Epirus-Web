/* §E670 取证器（真浏览器）：谱系图「页面口径夺1率」这一档，两个桌形是不是同一套渲染方法。
 *
 * 背景（用户 10-20 裁定「两个模式显然要有相同的渲染方法」）：
 *   改之前 multi 档读 d.hp（= epsagg.tsv 的 page 列，那张表只有 121 行 ⇒ 692 枚画成灰），
 *   long 档却读全库的 d.hpl2 ⇒ 同一条图例在两档下说的不是同一件事，"长程档看着不一样"是假象。
 *   改法：hpNow 两档各读 coords 的 Hp / Hplong（都是全库 803 枚），灰/未测计数、图例、页头、卡片都跟着现算。
 *
 * 每条判据都挑**旧页面会红**的写法（全绿的空跑不算取证）：
 *   ① 两档的"没读数"枚数都 = 0（旧：multi 692）
 *   ② 页头那句报的实测枚数两档都 = 803（旧：multi 121）
 *   ③ 逐枚对账：当前档的取数 === coords 那一列，且没有任何一枚走 d.hp（旧：multi 大量走 d.hp）
 *   ④ 图例与页头都点名尺源（coords.Hp / coords.Hplong）——旧页面只写"实测 N 枚"
 *   ⑤ 渲染真的跟着桌形走：|Hp−Hplong| 最大的那枚，两档点色不同、且两档都不许是灰
 *   ⑥ Δε 那条腿的分母没被顺手改掉（epsagg 的配对值仍只服务 de ⇒ 灰 = 803−121）
 *
 * 用法：node docs/research/archive/2026-10-20-map-hptab/hp-tab-probe.mjs [--port=9363] [--chrome=<路径>]
 * 只读：只起无头 Chrome 读页面自己算出来的东西，不写盘、不改图。
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../../../../tools/cdp-boot.mjs';
import { rejectUnknownFlags } from '../../../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');   /* archive/<本目录> → 上四级 = 仓根 */
rejectUnknownFlags(process.argv.slice(2), ['port', 'chrome', 'cdp-wait'], 'hp-tab-probe');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const PORT = Number(flag('port', 9363));
const URLP = 'file:///' + join(ROOT, 'champion-map', 'index.html').replace(/\\/g, '/') + '#mode=map&color=hp';

const BOOT = launchChrome({ chrome: flag('chrome', undefined), port: PORT, tries: Number(flag('cdp-wait', 60)) });
const watchdog = setTimeout(() => { console.error('[guard] 超时，收尸'); BOOT.killTree(); process.exit(3); }, 240000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const checks = [];
function check(name, cond, extra) { checks.push([name, !!cond]); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra != null ? '   [' + extra + ']' : '')); }

async function main() {
  const tabs = await BOOT.tabs();
  const page = tabs.find(t => t.type === 'page');
  if (!page) { console.error('⛔ CDP 里第一条不是 page（扩展的 background_page 会占位）'); process.exit(2); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) return 'ERR:' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URLP });

  /* 轮询"控件真出现"，不用固定 sleep（这页要解析 1MB 内联 bundle） */
  let up = false;
  for (let g = 0; g < 50 && !up; g++) { up = await evalJS(`(()=>!!(document.getElementById('ftab')&&document.getElementById('color')&&typeof hpNow==='function'))()`); if (!up) await sleep(500); }
  check('页面起来了且 #ftab / #color / hpNow 都在（起不来 = 仪器跑不了，不是图坏了）', up === true, up);
  if (up !== true) { BOOT.killTree(); process.exit(2); }

  const setSel = (sel, v) => evalJS(`(()=>{const s=document.getElementById('${sel}'); if(!s) return 'no-select'; s.value=${JSON.stringify(v)}; s.dispatchEvent(new Event('change')); return s.value;})()`);
  /* 一次把当前档的读数全拿回来：只读页面自己的函数与 DOM 文本，不自己重算 */
  const snap = () => evalJS(`(()=>{
    const gray='#5a6478';
    let nGray=0, reads=[], notGray=0;
    for (let i=0;i<P.length;i++){ const v=hpNow(P[i]); reads.push(v); if(v===null||!isFinite(v)) nGray++; }
    const cols=P.map(d=>colOf(d));
    for (let i=0;i<cols.length;i++) if(cols[i]!==gray) notGray++;
    /* 逐枚对账：当前档取的那一列 = 哪一列 */
    const expect = st.ftab==='long' ? 'hpl2' : 'Hp';
    let mismatch=0, viaEpsagg=0;
    for (let i=0;i<P.length;i++){ const d=P[i];
      if (reads[i]!==(expect==='hpl2'?d.hpl2:d.Hp)) mismatch++;
      if (d.hp!==null && isFinite(d.hp) && reads[i]===d.hp && reads[i]!==(expect==='hpl2'?d.hpl2:d.Hp)) viaEpsagg++; }
    /* |Hp−Hplong| 最大的一枚（两档都必须有颜色，且颜色要变） */
    let bi=0, bd=-1; for (let i=0;i<P.length;i++){ const d=P[i];
      if (d.Hp===null||d.hpl2===null||!isFinite(d.Hp)||!isFinite(d.hpl2)) continue;
      const dd=Math.abs(d.Hp-d.hpl2); if (dd>bd){ bd=dd; bi=i; } }
    const epsHas=DATA.filter(d=>d.hp!==null&&isFinite(d.hp)).length;
    return { ftab: st.ftab, N: N, nGray: nGray, notGray: notGray, mismatch: mismatch, viaEpsagg: viaEpsagg,
      stat: document.getElementById('stat').textContent, legend: document.getElementById('legend').innerText.replace(/\\n/g,' ‖ '),
      big: { id: P[bi].id, Hp: P[bi].Hp, hpl2: P[bi].hpl2, diff: bd, col: cols[bi] }, epsHas: epsHas };
  })()`);

  await sleep(1500);
  const A = await snap();   /* 默认桌（hash 里 color=hp） */
  check('开局就在 color=hp 档（不然下面全是空跑）', String(A.stat || '').indexOf('页面口径夺1率') >= 0, A.ftab);

  const okGrayMulti = A.nGray === 0 && A.notGray === A.N;
  check('① 默认桌：这一档"没读数"= 0 枚 且 点色没有一个灰', okGrayMulti, '灰 ' + A.nGray + ' ‖ 非灰 ' + A.notGray + '/' + A.N + '（旧页面这里是 692 枚灰）');
  check('③ 默认桌逐枚取数 = coords.Hp（0 枚不相符）', A.mismatch === 0, '不相符 ' + A.mismatch + ' ‖ 走 epsagg 的 ' + A.viaEpsagg);
  check('④ 页头点名尺源（默认桌 → coords.Hp）', /页面口径夺1率（实测 803 枚 · 默认桌 Hp）/.test(A.stat), (A.stat.match(/页面口径夺1率（[^）]*）/) || ['没这句'])[0]);
  check('④ 图例点名尺源与灰的口径', /尺 = coords\.Hp/.test(A.legend) && /灰 = 没读数（0 枚/.test(A.legend), A.legend.slice(0, 120));

  check('换到长程桌（走真控件 #ftab，不是改 st）', (await setSel('ftab', 'long')) === 'long');
  await sleep(1500);
  const B = await snap();
  check('① 长程桌：这一档"没读数"= 0 枚 且 点色没有一个灰', B.nGray === 0 && B.notGray === B.N, '灰 ' + B.nGray + ' ‖ 非灰 ' + B.notGray + '/' + B.N);
  check('③ 长程桌逐枚取数 = coords.Hplong（0 枚不相符）', B.mismatch === 0, '不相符 ' + B.mismatch + ' ‖ 走 epsagg 的 ' + B.viaEpsagg);
  check('④ 页头点名尺源（长程桌 → 长程桌 Hplong）', /页面口径夺1率（实测 803 枚 · 长程桌 Hplong）/.test(B.stat), (B.stat.match(/页面口径夺1率（[^）]*）/) || ['没这句'])[0]);
  check('④ 图例点名尺源与灰的口径', /尺 = coords\.Hplong/.test(B.legend) && /灰 = 没读数（0 枚/.test(B.legend), B.legend.slice(0, 120));
  check('② 两档分母一致（同一套渲染方法的硬判据：都是 803）', A.N === B.N && A.nGray === B.nGray, 'multi 灰 ' + A.nGray + ' ‖ long 灰 ' + B.nGray);
  check('⑤ 渲染随桌形变：|Hp−Hplong| 最大那枚两档点色不同', A.big.id === B.big.id && A.big.col !== B.big.col,
    A.big.id + ' Hp ' + A.big.Hp + ' → ' + A.big.col + ' ‖ Hplong ' + B.big.hpl2 + ' → ' + B.big.col);

  check('切回默认桌', (await setSel('ftab', 'multi')) === 'multi');
  await sleep(1200);
  check('⑥ 换到 Δε 档', (await setSel('color', 'de')) === 'de');
  await sleep(1500);
  const C = await evalJS(`(()=>({stat: document.getElementById('stat').textContent,
    has: DATA.filter(d=>d.de!==null&&isFinite(d.de)).length, N: N}))()`);
  check('⑥ Δε 腿仍用 epsagg 那份配对值（分母 = 121，没被顺手换成全库）', C.has > 100 && C.has < 200, '实测 ' + C.has + '/' + C.N + ' ‖ 页头 ' + ((C.stat || '').match(/部署脆弱性 Δε（[^）]*）/g) || ['没这句']).join(' '));
  check('epsagg 那份"页面"列的覆盖面（就是旧默认桌读的东西）', A.epsHas > 0, '有值 ' + A.epsHas + '/' + A.N + ' ⇒ 旧页面 ' + (A.N - A.epsHas) + ' 枚画成灰');

  check('控制台无报错 / 无未捕获异常', errors.length === 0, errors.slice(0, 3).join(' ⏎ ') || '干净');
  const bad = checks.filter(c => !c[1]);
  console.log('\n断言：' + (checks.length - bad.length) + ' PASS ‖ ' + bad.length + ' FAIL');
  if (bad.length) console.log(bad.map(c => '  FAIL ' + c[0]).join('\n'));
  await send('Browser.close').catch(() => {}); BOOT.killTree();
  process.exit(bad.length ? 1 : 0);
}
main().catch(e => { console.error('⛔ ' + (e && e.stack || e)); BOOT.killTree(); process.exit(2); });
