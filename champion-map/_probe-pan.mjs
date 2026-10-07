/* _probe-pan.mjs —— 谱系图（mode=tree）"谁跟手、谁不跟手、谁被抹掉"的像素级读数。
 *   一次性诊断探针，不进门禁、不改代码：它只做三件事
 *     ① 起一个有尺寸的无头 Chrome，打开 champion-map/index.html#mode=tree（平面态）；
 *     ② 在真浏览器里派一次**真左键拖动**（Input.dispatchMouseEvent），把图往左推 --drag 个 CSS 像素；
 *     ③ 拖动前后各读一次画布像素，报四类东西各自的位移：
 *        数据点（scr[] 的屏幕坐标）‖ 日期分度线（画布列剖面的峰）‖ 左栏文字（x<padL 的墨像素集合）
 *        ‖ 落到左栏底下的那些点（按它自己那一档的颜色判"画布上到底有没有它"）。
 *   为什么不能只看代码：本仓的病几乎全在交互里现形（shot.mjs 头注同一句教训），
 *   而"某个元素读的是哪一个坐标函数"这件事，只有像素能作证。
 * 用法：node champion-map/_probe-pan.mjs [--drag=150] [--hash=mode=tree] [--win=1600,900]
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const DRAG = Number(arg('drag', '150'));
const HASH = arg('hash', 'mode=tree');
const WIN = arg('win', '1600,900');
const PORT = Number(arg('port', '9377'));
const CHROME = [arg('chrome', ''),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!CHROME) { console.error('⛔ 没找到 Chrome/Edge'); process.exit(2); }
const URL = 'file:///' + join(HERE, 'index.html').replace(/\\/g, '/') + '#' + HASH;
const udd = mkdtempSync(join(tmpdir(), 'epirus-pan-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--force-device-scale-factor=1', '--remote-debugging-port=' + PORT,
  '--window-size=' + WIN, '--user-data-dir=' + udd, 'about:blank'], { stdio: 'ignore' });
let closed = false;
function killTree() {
  if (closed) return; closed = true;
  try {
    if (process.platform === 'win32' && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else proc.kill('SIGKILL');
  } catch (e) { /* 已经死了 */ }
  try { rmSync(udd, { recursive: true, force: true }); } catch (e) { }
}
const wd = setTimeout(() => { console.error('⛔ 超时（120s）⇒ 收尸退出'); killTree(); process.exit(2); }, 120000);
wd.unref();   /* 看门狗不许反过来把事件循环钉住（否则跑完也要 120 秒才退出） */

async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { } await sleep(200); }
  throw new Error('CDP 起不来: ' + url);
}

/* ---- 页内读一次：列剖面 + 点位置 + 左栏底下那批点的可见性 ---- */
const READ = `(function(){
  var W=cv.width,H=cv.height,padL=TPAD.l,y0=Math.round(TPAD.t),y1=H-70;
  var img=g.getImageData(0,0,W,H).data;
  /* 底色 = 全画布众数颜色（抽样 20000 个点），墨 = 与底色差得远的像素 */
  var hist={},i,k;
  for(i=0;i<20000;i++){var x=(Math.random()*W)|0,y=(Math.random()*H)|0,p=(y*W+x)*4;
    k=img[p]+','+img[p+1]+','+img[p+2]; hist[k]=(hist[k]||0)+1;}
  var bgk='0,0,0',bgc=-1; for(k in hist) if(hist[k]>bgc){bgc=hist[k];bgk=k;}
  var bg=bgk.split(',').map(Number);
  function far(p){var d=Math.abs(img[p]-bg[0])+Math.abs(img[p+1]-bg[1])+Math.abs(img[p+2]-bg[2]);return d>60;}
  /* 列剖面：每列在 [y0,y1) 之间的墨像素数（隔 2 行采一次，够稳） */
  var prof=new Array(W).fill(0);
  for(x=0;x<W;x++){var c=0;for(y=y0;y<y1;y+=2){if(far((y*W+x)*4))c++;} prof[x]=c;}
  /* 数据点：屏幕坐标（scr 是画完之后的那一份） */
  var pts=[]; for(i=0;i<N;i++){ if(!VIS[i]||!scr[i]) continue; pts.push([P[i].id,scr[i][0],scr[i][1]]); }
  /* 左栏底下那批点：中心像素是不是它自己那档的颜色？（期望色 = 页面自己的 colOf） */
  function parseRGB(s){ s=(''+s).trim();
    if(s[0]==='#'){var h=s.length===4?('#'+s[1]+s[1]+s[2]+s[2]+s[3]+s[3]):s;
      return [parseInt(h.substr(1,2),16),parseInt(h.substr(3,2),16),parseInt(h.substr(5,2),16)];}
    var m=/([\\d.]+)[^\\d.]+([\\d.]+)[^\\d.]+([\\d.]+)/.exec(s); return m?[+m[1],+m[2],+m[3]]:null; }
  var under=[],invis=0;
  for(i=0;i<N;i++){ if(!VIS[i]||!scr[i]) continue; var sx=scr[i][0],sy=scr[i][1];
    if(sx>padL-4||sx<2||sy<2||sy>H-2) continue;
    var exp=parseRGB(colOf(P[i])), rr=Math.max(2,dotR(P[i],st.tKx));
    var best=1e9,n=0;
    for(var dx=-2;dx<=2;dx++)for(var dy=-2;dy<=2;dy++){
      var px=Math.round(sx+dx*rr/2),py=Math.round(sy+dy*rr/2);
      if(px<0||py<0||px>=W||py>=H) continue; var q=(py*W+px)*4; n++;
      if(exp){var d=Math.abs(img[q]-exp[0])+Math.abs(img[q+1]-exp[1])+Math.abs(img[q+2]-exp[2]); if(d<best)best=d;}
    }
    /* 期望色是半透明叠出来的，阈值放宽到 150；再拿"与底色一样"作为兜底判据 */
    var shown = exp ? (best<150) : true;
    if(!shown) invis++;
    under.push({id:P[i].id,x:+sx.toFixed(1),y:+sy.toFixed(1),d:+best.toFixed(0),shown:shown}); }
  var sum=function(a,b){var s=0;for(var t=a;t<b;t++)s+=prof[t];return s;};
  return {W:W,H:H,padL:padL,bg:bgk,st:{tKx:st.tKx,tKy:st.tKy,tX:st.tX,tY:st.tY,elev:st.elev,mode:st.mode},
    prof:prof, pts:pts, under:under, invis:invis,
    inkLeft:sum(0,Math.max(0,padL-8)), inkData:sum(padL+16,W-30)};
})()`;

async function main() {
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const tabs = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result?.result?.value; };
  const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync, mkdirSync } = await import('node:fs'); try { mkdirSync(dirname(file), { recursive: true }); } catch (e) { }
    writeFileSync(file, Buffer.from(r.result.data, 'base64')); };
  const SHOTS = process.argv.indexOf('--shots') >= 0;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(3000);

  const a = await evalJS(READ);
  if (!a || !a.prof) throw new Error('页面没起来或读不到画布（hash=' + HASH + '）');
  if (SHOTS) await shot(join(ROOT, 'docs', 'artifacts', 'e378-out', 'pan-01-before.png'));
  const rect = await evalJS('JSON.stringify(cv.getBoundingClientRect())').then(s => JSON.parse(s));
  const y0 = Math.round(rect.top + rect.height * 0.5);
  const x0 = Math.round(rect.left + (a.padL + 200) * (rect.width / a.W));
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
  for (let s = 1; s <= 6; s++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 - Math.round(DRAG * s / 6), y: y0, button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 - DRAG, y: y0, button: 'left' });
  await sleep(500);
  const b = await evalJS(READ);
  if (SHOTS) await shot(join(ROOT, 'docs', 'artifacts', 'e378-out', 'pan-01-after-drag.png'));

  /* ---- 附加读数：往回平移到起点，再滚轮缩小到 --tkx，看"数据区缩小后右侧空出来多少" ---- */
  let z = null;
  if (arg('tkx', '') !== '') {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + DRAG, y: y0, button: 'left' });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x0 + DRAG, y: y0, button: 'left' });
    for (let s = 0; s < 40; s++) {
      const cur = await evalJS('st.tKx');
      if (cur <= Number(arg('tkx', '0.55')) + 0.02) break;
      await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: x0, y: y0, deltaX: 0, deltaY: 100 });
    }
    await sleep(400);
    z = await evalJS(`(function(){var m=0,minx=1e9,maxx=-1e9;
      for(var i=0;i<N;i++){ if(!VIS[i]||!scr[i]) continue;
        if(scr[i][0]<TPAD.l-4)m++;
        if(scr[i][0]<minx)minx=scr[i][0]; if(scr[i][0]>maxx)maxx=scr[i][0]; }
      return {tKx:st.tKx,tX:st.tX,tY:st.tY,ptsUnderLeft:m,minx:Math.round(minx),maxx:Math.round(maxx),
        W:cv.width,padL:TPAD.l, names:document.querySelectorAll('#fambar button').length};})()`);
    if (SHOTS) await shot(join(ROOT, 'docs', 'artifacts', 'e378-out', 'pan-02-zoomout.png'));
  }

  /* ---- 读数 1：数据点真的动了多少 ---- */
  const idx = new Map(b.pts.map(p => [p[0], p]));
  let dxs = [];
  for (const p of a.pts) { const q = idx.get(p[0]); if (q) dxs.push(q[1] - p[1]); }
  dxs.sort((x, y) => x - y);
  const med = dxs.length ? dxs[dxs.length >> 1] : NaN;

  /* ---- 读数 2：日期分度线（画布列剖面的峰）---- */
  const peaks = (prof, lo, hi) => { const out = [];
    for (let x = lo + 2; x < hi - 2; x++) if (prof[x] > 12 && prof[x] >= prof[x - 1] && prof[x] >= prof[x + 1] && prof[x] > prof[x - 2] && prof[x] > prof[x + 2]) out.push(x);
    return out; };
  const pk = (prof) => peaks(prof, Math.round(a.padL + 16), prof.length - 40);
  const pa = pk(a.prof), pb = pk(b.prof);
  let lineShift = NaN;
  if (pa.length && pb.length) { /* 用最近匹配的中位差 */
    const ds = pa.map(x => { let best = 1e9; for (const y of pb) if (Math.abs(y - x) < best) best = y - x; return best; }).sort((x, y) => x - y);
    lineShift = ds[ds.length >> 1];
  }

  /* ---- 读数 3：左栏文字像素集合（位移 = 剖面互相关）---- */
  const cut = (prof, lo, hi) => prof.slice(lo, hi);
  const shiftBy = (A, B, maxS) => { let bestS = 0, bestE = Infinity;
    for (let s = -maxS; s <= maxS; s++) { let e = 0;
      for (let x = 0; x < A.length; x++) { const j = x + s; if (j < 0 || j >= B.length) continue; e += Math.abs(A[x] - B[j]); }
      if (e < bestE) { bestE = e; bestS = s; } }
    return [bestS, bestE]; };
  const L = cut(a.prof, 0, Math.max(40, Math.round(a.padL - 8)));
  const L2 = cut(b.prof, 0, Math.max(40, Math.round(b.padL - 8)));
  const [sL] = shiftBy(L, L2, Math.abs(DRAG) + 20);
  /* 数据区（分度线 + 点混在一起）的互相关位移：分度线是周期的，只靠峰会有混叠，所以两个读数都留 */
  const Dlo = Math.round(a.padL + 16);
  const [sD] = shiftBy(cut(a.prof, Dlo, a.W - 40), cut(b.prof, Dlo, b.W - 40), Math.abs(DRAG) + 30);

  console.log('窗口 ' + a.W + '×' + a.H + ' ‖ padL=' + a.padL + ' ‖ 拖动 ' + (-DRAG) + ' CSS px');
  console.log('st 前:', JSON.stringify(a.st), '\nst 后:', JSON.stringify(b.st));
  console.log('\n【读数 1 数据点】可见 ' + a.pts.length + ' 枚，逐枚屏幕位移中位 = ' + med.toFixed(1) + ' px（拖了 ' + (-DRAG) + '）');
  console.log('【读数 2 日期分度线】前 ' + pa.length + ' 根 / 后 ' + pb.length + ' 根 ‖ 峰位移中位 = ' + lineShift + ' px ‖ 数据区剖面互相关 = ' + sD + ' px');
  console.log('【读数 3 左栏（x<padL-8）】墨像素合计 前 ' + a.inkLeft + ' → 后 ' + b.inkLeft + ' ‖ 剖面位移 = ' + sL + ' px');
  console.log('【读数 4 数据区墨像素】前 ' + a.inkData + ' → 后 ' + b.inkData);
  console.log('【读数 5 落到左栏底下的点】共 ' + b.under.length + ' 枚，画布上**读不出它自己那档颜色**的 ' + b.invis + ' 枚');
  if (b.under.length) console.log('  样本（前 8 枚）: ' + b.under.slice(0, 8).map(u => u.id + '@' + u.x + ',' + u.y + ' d=' + u.d + (u.shown ? ' 看得见' : ' ✗看不见')).join('\n                  '));
  if (z) console.log('【读数 6 缩小到 tKx=' + z.tKx.toFixed(2) + '】数据横跨度 ' + z.minx + '…' + z.maxx +
    '（画布宽 ' + z.W + '，分界 ' + z.padL + '）‖ 右侧空出 ' + (z.W - z.maxx) + ' px ‖ 滑进左栏的点 ' + z.ptsUnderLeft + ' 枚');
  /* ---- 附加读数 7：把某根原生滑杆推到端点，截图给人看"两端的空隙"（用户 10-07 那张 T 的截图）----
   *   --slider=T:0 与 --slider=T:0.3 各跑一次，两张图对看就知道轨道画到哪儿、滑块走到哪儿。 */
  const SL = arg('slider', '');
  if (SL) { const sid = SL.split(':')[0], sval = SL.split(':')[1];
    const geo = await evalJS(`(function(){var e=document.getElementById(${JSON.stringify(sid)});
      e.value=${Number(sval)}; e.dispatchEvent(new Event('input',{bubbles:true}));
      var r=e.getBoundingClientRect(); return {min:+e.min,max:+e.max,step:+e.step,val:+e.value,
        cssW:+r.width.toFixed(1),cssH:+r.height.toFixed(1),
        cs:getComputedStyle(e).paddingLeft+' / '+getComputedStyle(e).paddingRight};})()`);
    console.log('【读数 7 滑杆 ' + sid + '】' + JSON.stringify(geo));
    if (SHOTS) await shot(join(ROOT, 'docs', 'artifacts', 'e378-out', 'slider-' + sid + '-' + sval + '.png'));
  }
  killTree(); ws.close();
}
main().catch(e => { console.error('⛔ ' + e.message); killTree(); process.exit(2); });
