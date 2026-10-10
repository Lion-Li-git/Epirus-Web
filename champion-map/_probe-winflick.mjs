/* _probe-winflick.mjs —— 「把强度窗从**全范围**缩小的那一瞬间会闪一下」的逐帧读数（一次性诊断探针，不进门禁）。
 *
 * 为什么要探针而不是读代码：这条病是"某一帧画面上少了一层东西"，只有逐帧像素能作证。
 *   读代码只能告诉我"哪几步会清画布 / 哪几步要烘场"，判不了它们落在哪几帧。
 *
 * 它做四件事：
 *   ① 起一个 1600×900 的无头 Chrome（有真视口 ⇒ rAF 会跑；内置浏览器那个 hidden 页面 rAF 根本不回调，量不到帧）；
 *   ② 在页面里包住 fit0 / buildBitmap / draw / recomputeVIS / buildFamBar / paintWin 六个函数，记下各自动过哪几帧；
 *   ③ 装一个逐帧采样器：把画布缩到 400×225 读一次，记"墨像素数 / 平均亮度 / 颜色数 / 盒子高 / 位图在不在 / 邻域缓存格数"；
 *   ④ 在第 4 帧分别触发三种动作各跑一遍，对比帧序列：
 *        A 全范围 → 缩小（用户报的那一下） ‖ B 已经缩小 → 再缩小（应当不闪） ‖ C 缩小 → 全范围（反向）
 *
 * 用法：node champion-map/_probe-winflick.mjs [--hash=mode=tree] [--frames=20]
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const HASH = arg('hash', 'mode=tree');
const FRAMES = Number(arg('frames', 20));
const WIN = arg('win', '1600,900');
const PORT = Number(arg('port', '9381'));
const CHROME = [arg('chrome', ''),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!CHROME) { console.error('⛔ 没找到 Chrome/Edge'); process.exit(2); }
const URL = 'file:///' + join(HERE, 'index.html').replace(/\\/g, '/') + '#' + HASH;
const udd = mkdtempSync(join(tmpdir(), 'epirus-flick-'));
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
  } catch (e) { }
  try { rmSync(udd, { recursive: true, force: true }); } catch (e) { }
}
const wd = setTimeout(() => { console.error('⛔ 超时（150s）⇒ 收尸退出'); killTree(); process.exit(2); }, 150000);
wd.unref();

async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { } await sleep(200); }
  throw new Error('CDP 起不来: ' + url);
}

/* 页内：包住六个函数 + 逐帧采样 + 到第 FIRE 帧调用 window.__ACT()（由外面设好要做的动作） */
const HOOK = `(function(){
  if (window.__REC) return 'already';
  window.__REC = [];
  var W = 240, H = 135;
  window.__OFF = document.createElement('canvas'); window.__OFF.width = W; window.__OFF.height = H;
  window.__OC = window.__OFF.getContext('2d', { willReadFrequently: true });
  var od = window.draw;
  window.draw = function () {
    var t0 = performance.now();
    od.apply(this, arguments);
    var dur = performance.now() - t0;
    window.__OC.clearRect(0, 0, W, H); window.__OC.drawImage(cv, 0, 0, W, H);
    var d = window.__OC.getImageData(0, 0, W, H).data, i, k, hist = {};
    for (i = 0; i < d.length; i += 4) { k = (d[i] >> 3) + '_' + (d[i+1] >> 3) + '_' + (d[i+2] >> 3); hist[k] = (hist[k] || 0) + 1; }
    var bk = '', bc = -1; for (k in hist) if (hist[k] > bc) { bc = hist[k]; bk = k; }
    var bs = bk.split('_').map(function (x) { return (+x) * 8 + 4; });
    var ink = 0, soft = 0, sum = 0, dl, sq = 0;
    for (i = 0; i < d.length; i += 4) {
      if (d[i+3] <= 8) continue;
      dl = Math.abs(d[i]-bs[0]) + Math.abs(d[i+1]-bs[1]) + Math.abs(d[i+2]-bs[2]);
      sq += dl * dl;
      if (dl > 48) { ink++; sum += d[i] + d[i+1] + d[i+2]; } else if (dl > 6) soft++;
    }
    window.__REC.push({ t: Math.round(performance.now()), dur: +dur.toFixed(1),
      win: (+st.flo).toFixed(3) + '-' + (+st.fhi).toFixed(3), nvis: NVIS,
      FL: window.FL ? String(window.FL.vis) : '-', ink: ink, soft: soft,
      rms: Math.round(Math.sqrt(sq / Math.max(1, d.length / 4))), lum: Math.round(sum / Math.max(1, ink) / 3) });
  };
  return 'hooked';
})()`;

const DUMP = `window.__REC.map(function(r,i){ return i + '|' + r.t + '|dur=' + r.dur + '|win=' + r.win + '|nvis=' + r.nvis +
  '|ink=' + r.ink + '|晕=' + r.soft + '|rms=' + r.rms + '|lum=' + r.lum + '|FL=' + r.FL; }).join('\\n')`;

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
    if (r.result && r.result.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result && r.result.result && r.result.result.value; };
  const mouse = (type, x, y, btns) => send('Input.dispatchMouseEvent', { type, x, y, button: btns || 'none',
    buttons: btns === 'left' ? 1 : 0, clickCount: btns === 'left' ? 1 : 0 });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(3500);

  console.log('页内钩子：' + await evalJS(HOOK));
  const box = JSON.parse(await evalJS('JSON.stringify((function(){var b=WINAX.getBoundingClientRect();return {x:b.left,y:b.top,w:b.width,h:b.height};})())'));
  console.log('窗口轴盒子：' + JSON.stringify(box));
  if (box.w < 4 || box.h < 4) throw new Error('那根轴没尺寸（图例被重建过？）');
  const cx = Math.round(box.x + box.w / 2);
  await evalJS('window.setWin(0,1); window.__REC.length = 0;');
  await sleep(200);
  await evalJS('window.__REC.length = 0;');

  /* 取证用的三张图（写到仓外临时目录，别把 PNG 留在 docs/artifacts 里欠账）：
   *   s1 = 拖动前的稳态 ‖ s2 = **按下并拖一步之后立刻拍**（此时那 100~190ms 的重烘还没画完 ⇒ 抓的是"闪"的那一帧）
   *   s3 = 烘完之后 ‖ s4/s5 = 已经缩小过一轮之后的同样两步（对照：用户说"之后反倒流畅了"） */
  const SHOTDIR = arg('shots', '') || '';
  const shot = async (tag) => { if (!SHOTDIR) return;
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync, mkdirSync } = await import('node:fs');
    try { mkdirSync(SHOTDIR, { recursive: true }); } catch (e) { }
    writeFileSync(join(SHOTDIR, 'flick-' + tag + '.png'), Buffer.from(r.result.data, 'base64')); };

  /* 从**顶柄**（fhi=1，在 y=盒子顶）往下拖：第一段位移就是"从全范围开始缩小"的那一刻 */
  const STEPS = Number(arg('steps', 10)), DROP = Math.round(box.h * 0.35);
  await evalJS('window.__REC.length = 0;');
  await shot('0-before');
  await mouse('mousePressed', cx, Math.round(box.y + 1), 'left');
  await mouse('mouseMoved', cx, Math.round(box.y + 1 + Math.round(DROP / STEPS)), 'left');
  await shot('1-flash');                     /* 不 sleep：抢在那次重烘画完之前 */
  await sleep(500); await shot('2-settled');
  for (let i = 2; i <= STEPS; i++) {
    await mouse('mouseMoved', cx, Math.round(box.y + 1 + DROP * i / STEPS), 'left');
    await sleep(60);
  }
  await mouse('mouseReleased', cx, Math.round(box.y + 1 + DROP), 'left');
  await sleep(400);

  /* ===== `--field` 档：只出"地形像素的哈希"，用来对拍改前/改后是不是**同一张图** =====
   *   比"表相同"更强的证据是"画出来的东西相同"：FL.c 就是那张底图，逐字节哈希它。 */
  if (process.argv.includes('--field')) {
    const FH = `(function(){
      var out = [], cs = [[0,1],[0,0.90],[0.18,0.72],[0.35,0.65],[0.47,0.53],[0.05,0.30],[0.66,0.99]];
      function h32(s){ var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
      for (var t = 0; t < cs.length; t++) {
        st.flo = cs[t][0]; st.fhi = cs[t][1]; recomputeVIS(); FL = null; draw();
        var c = FL && FL.c, n = 0, hash = '无';
        if (c) { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          var bin = new Uint8Array(d.buffer, 0, d.length); var s = '', CH = 8192;
          for (var q = 0; q < bin.length; q += CH) s += String.fromCharCode.apply(null, bin.subarray(q, Math.min(bin.length, q + CH)));
          hash = h32(s) + '/' + bin.length; n = bin.length / 4; }
        out.push('窗口 ' + cs[t][0].toFixed(2) + '-' + cs[t][1].toFixed(2) + ' ‖ 可见 ' + NVIS +
          ' ‖ 快路格 ' + (VK ? (VK.nFast + '/' + VK.nSlow) : '-') + ' ‖ 底图 ' + n + ' 格 px ‖ shaF=' + hash);
      }
      return out.join('\\n');
    })()`;
    console.log(await evalJS(FH));
    killTree(); process.exit(0);
  }

  const dump1 = await evalJS(DUMP);
  console.log('\n【第一轮 从全范围开始拖】每一步 draw 的读数（ink=墨 晕=半透明 rms=与底色均方差）：');
  console.log(String(dump1 || '（一次 draw 都没跑）').replace(/\|/g, ' | ').split('\n').filter(Boolean)
    .map((l, i) => '  ' + l).join('\n'));
  /* 对照轮：**已经缩小过**之后再缩一小步，同样"立刻拍 + 烘完拍"两张 ⇒ 看用户那句"之后反倒流畅了"到底是什么 */
  const fhi = await evalJS('(+st.fhi).toFixed(4)');
  const yTop = Math.round(box.y + (1 - Number(fhi)) * box.h);
  await evalJS('window.__REC.length = 0;');
  await mouse('mousePressed', cx, yTop, 'left');
  await mouse('mouseMoved', cx, yTop + 8, 'left');
  await shot('3-flash2');
  await sleep(500); await shot('4-settled2');
  await mouse('mouseReleased', cx, yTop + 8, 'left');
  await sleep(300);

  const dump = await evalJS(DUMP);
  const rows = String(dump || '').split('\n').filter(Boolean).map(l => l.split('|'));
  console.log('\n每次 draw 的落帧（ink=墨px 晕=半透明px rms=与底色的均方差 lum=墨均值亮度）：');
  console.log(String(dump || '（一次 draw 都没跑）').replace(/\|/g, ' '));
  const num = (s, k) => { const m = new RegExp('^' + k + '=(-?[0-9.]+)$').exec(String(s)); return m ? +m[1] : NaN; };
  /* DUMP 的字段序：0=i 1=t 2=dur 3=win 4=nvis 5=ink 6=晕 7=rms 8=lum 9=FL */
  console.log('\n相邻两次 draw 之差（找"闪"= 一跳出去又跳回来）：');
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const di = num(b[5], 'ink') - num(a[5], 'ink'), ds = num(b[6], '晕') - num(a[6], '晕');
    const db = num(b[2], 'dur');
    let spike = '';
    if (i + 1 < rows.length) {
      const di2 = num(rows[i + 1][5], 'ink') - num(b[5], 'ink');
      if (Math.abs(di) > 1200 && Math.sign(di) !== Math.sign(di2) && Math.abs(di2) > 1200) spike = '  ★ 尖峰（墨跳出去又跳回来）';
    }
    if (db > 120) spike += '  ★ 这帧画得慢';
    console.log('  #' + i + ' ' + String(a[3]).replace('win=', '') + '→' + String(b[3]).replace('win=', '') +
      ' 墨 ' + (di >= 0 ? '+' : '') + di + ' ‖ 晕 ' + (ds >= 0 ? '+' : '') + ds +
      ' ‖ rms ' + num(a[7], 'rms') + '→' + num(b[7], 'rms') + ' ‖ dur ' + db + 'ms' + spike);
  }
  /* ===== 等价性实测：快路那张表必须与"独立写的一份暴力"**逐位相同**（idx 与 dst 都比） =====
   *   参考实现是这里另写的（排序取前 12），不复用 knnPut/visKNN 的循环 ⇒ 快路证明若哪天不成立，这里红。
   *   距离表达式必须一致（那是度量的定义，不是可以"独立"的东西）：dx=(格坐标差)·cs，dd=Math.sqrt(dx²+dy²)。 */
  const EQUIV = `(function(){
    var nb = NBK[FL.key]; if (!nb) return '没有邻域表（这一档没铺过势场？）';
    var out = [], sig0 = 0;
    var CS = [[0,1],[0,0.90],[0.18,0.72],[0.35,0.65],[0.47,0.53],[0.05,0.30]];
    for (var t = 0; t < CS.length; t++) {
      st.flo = CS[t][0]; st.fhi = CS[t][1]; recomputeVIS();
      var SH = new Uint8Array(N);
      for (var i = 0; i < N; i++) SH[i] = (VIS[i] && inWin(P[i])) ? 1 : 0;
      var T = visKNN(nb, 'equiv' + (++sig0), SH);
      var gx = nb.gx, gy = nb.gy, cells = gx * gy;
      var csx = (nb.x1-nb.x0)*nb.bx/(gx-1), csy = (nb.y1-nb.y0)*nb.byy/(gy-1);
      /* 存储本来就是 Float32Array ⇒ 参考值也要量化到同一把尺再比，否则比的是"存法"不是"算法" */
      var F32 = new Float32Array(1);
      var seen = 0, ncmp = 0, badi = 0, badd = 0, worst = 0;
      for (var s = 0; s < cells; s += 61) {
        var cgi = s % gx, cgj = (s / gx) | 0;
        var cand = [];
        for (var q = 0; q < N; q++) { if (!SH[q]) continue;
          var x = (P[q][nb.ax]-nb.x0)/(nb.x1-nb.x0)*(gx-1), y = (P[q][nb.by]-nb.y0)/(nb.y1-nb.y0)*(gy-1);
          var dx = (x-cgi)*csx, dy = (y-cgj)*csy; cand.push([Math.sqrt(dx*dx+dy*dy), q]); seen++; }
        cand.sort(function(a,b){ return a[0]-b[0] || a[1]-b[1]; });
        for (var u = 0; u < KF; u++) {
          var gi = u < cand.length ? cand[u][1] : -1, gd = u < cand.length ? cand[u][0] : 1e18;
          F32[0] = gd; gd = F32[0];
          var ti = T.idx[s*KF+u], td = T.dst[s*KF+u]; ncmp++;
          if (ti !== gi) badi++;
          else if (gi >= 0 && td !== gd) { badd++; if (Math.abs(td-gd) > worst) worst = Math.abs(td-gd); }
        }
      }
      out.push('窗口 ' + CS[t][0].toFixed(2) + '-' + CS[t][1].toFixed(2) + ' ‖ 可见 ' + T.n + '/' + N +
        ' ‖ 快路格 ' + T.nFast + '/' + cells + '（' + (T.nFast/cells*100).toFixed(1) + '%）‖ 抽 ' +
        Math.ceil(cells/61) + ' 格 × ' + KF + ' 名 = ' + ncmp + ' 项比对 ‖ idx 不同 ' + badi + ' ‖ dst 不同 ' + badd +
        (badd ? '（最大差 ' + worst.toExponential(2) + '）' : ''));
    }
    return out.join('\\n');
  })()`;
  console.log('\n===== 等价性（快路 vs 独立暴力，逐位比）=====');
  console.log(await evalJS(EQUIV));
  killTree();
}
main().catch(e => { console.error('⛔ ' + ((e && e.message) || e)); killTree(); process.exit(2); });
