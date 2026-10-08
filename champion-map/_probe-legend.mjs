/* _probe-legend.mjs —— 每一档"颜色"下图例框到底浪费了多少空间的逐节点读数（§E441 排版普查）。
 *
 * 为什么不能靠看截图：图例是 DOM（不是画布），"空一块"有三种完全不同的成因 ——
 *   ① 色条写死 150px 高而文字更短 ⇒ 文字那列下面空；
 *   ② 容器 maxWidth 260px 把长句折行 ⇒ 右边参差不齐地空；
 *   ③ 两列布局里某一列没对齐（`marginLeft:auto` 只贴了右列，左列高度不参与）。
 *   截图上三者长得一模一样，只有量每个子节点的矩形才分得开。
 * 用法：node champion-map/_probe-legend.mjs [--hash=mode=map] [--win=1600,900]
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const HASH = arg('hash', 'mode=map');
const WIN = arg('win', '1600,900');
const PORT = Number(arg('port', '9381'));
const MODES = arg('modes', 'fam,seed,F,rel,gl,pm,duel,hp,de,sc,champ').split(',');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x:86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
if (!CHROME) { console.error('⛔ 没找到 Chrome/Edge'); process.exit(2); }
const URL = 'file:///' + join(HERE, 'index.html').replace(/\\/g, '/') + '#' + HASH;
const udd = mkdtempSync(join(tmpdir(), 'epirus-lg-'));
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
const wd = setTimeout(() => { console.error('⛔ 超时'); killTree(); process.exit(2); }, 180000);
wd.unref();
async function waitJson(url, tries = 40) {
  for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { } await sleep(200); }
  throw new Error('CDP 起不来');
}
const READ = `(function(){
  var lg=document.getElementById('legend'); if(!lg) return {err:'没有 #legend'};
  var r=lg.getBoundingClientRect();
  var kids=[], maxB=0, maxR=0;
  for(var i=0;i<lg.children.length;i++){ var el=lg.children[i], b=el.getBoundingClientRect();
    var chB=0, chS=[];
    for(var j=0;j<el.children.length;j++){ var c2=el.children[j], b2=c2.getBoundingClientRect();
      if(b2.bottom-b.top>chB) chB=b2.bottom-b.top; chS.push(c2.tagName.toLowerCase()+'['+Math.round(b2.height)+']'); }
    var bb={t:Math.round(b.top-r.top), l:Math.round(b.left-r.left), w:Math.round(b.width), h:Math.round(b.height),
      /* content = 这一格里**真有内容**占到哪儿。flex 默认 align-items:stretch 会把矮的那列拉满整行高，
         所以光看 h 会把"空着 90px"读成"占满"—— 这就是普查必须先分清的那件事。 */
      content:Math.round(el.children.length?chB:(el.scrollHeight||0)), kidsStr:chS.join(' '),
      tag:el.tagName.toLowerCase()+(el.tagName==='CANVAS'?'['+el.style.width+'x'+el.style.height+']':''),
      txt:(el.textContent||'').replace(/\\s+/g,' ').slice(0,26)};
    kids.push(bb); if(b.bottom-r.top>maxB)maxB=b.bottom-r.top; if(b.right-r.left>maxR)maxR=b.right-r.left; }
  /* 文字实际占的列：把非 canvas 的孩子按 top 排，取最右边缘与最高底 */
  return {w:Math.round(r.width), h:Math.round(r.height), usedH:Math.round(maxB), usedW:Math.round(maxR),
    cs:{maxWidth:getComputedStyle(lg).maxWidth, lineH:getComputedStyle(lg).lineHeight,
        disp:getComputedStyle(lg).display, flex:getComputedStyle(lg).flexDirection},
    color:st.color, kids:kids,
    /* §E441 顺带查**溢出**：家族那条按钮带如果一行摆不下又被 overflow 裁掉，最后几枚按钮就点不到 ——
       量 scrollWidth 与 clientWidth 的差，比看截图可靠（截图上它只是"看起来还好"）。 */
    fam:(function(){ var f=document.getElementById('fam'); if(!f) return null;
      var cs=getComputedStyle(f), kids2=f.children.length, lastRight=0;
      for(var q=0;q<f.children.length;q++){ var b2=f.children[q].getBoundingClientRect();
        if(b2.right>f.getBoundingClientRect().left && b2.right>lastRight) lastRight=b2.right; }
      return {n:kids2, sw:f.scrollWidth, cw:f.clientWidth, over:f.scrollWidth-f.clientWidth,
        wrap:cs.flexWrap, ovf:cs.overflowX, lastVisible:Math.round(lastRight-f.getBoundingClientRect().left)}; })()};
})()`;
/* §E441 顺带一条**全页溢出普查**：家族带那条（27 个按钮溢出 782px 被 overflow-x:auto 藏着）证明
 *   "看不见的浪费"和"看不见的内容"是同一件事 —— 截图上它俩都长得像"还好"。
 *   这里对 body 里每个元素量 scrollWidth vs clientWidth，凡是"内容比可视区宽"又**没有横向滚动条可见**的都点名。 */
const OVERFLOW = `(function(){
  var out=[], all=document.querySelectorAll('body *');
  for(var i=0;i<all.length;i++){ var el=all[i];
    var ow=el.scrollWidth-el.clientWidth, oh=el.scrollHeight-el.clientHeight;
    if(ow<=4 && oh<=4) continue;
    var cs=getComputedStyle(el);
    var id=el.id?'#'+el.id:(el.className&&typeof el.className==='string'?'.'+el.className.split(' ')[0]:el.tagName.toLowerCase());
    out.push({id:id, ow:ow, oh:oh, cw:el.clientWidth, sw:el.scrollWidth, ovfX:cs.overflowX, wrap:cs.flexWrap||'—', ws:cs.whiteSpace}); }
  out.sort(function(a,b){ return (b.ow+b.oh)-(a.ow+a.oh); });
  return out.slice(0,14);
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
    if (r.result?.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(3500);
  console.log('档'.padEnd(7) + '框宽×框高'.padEnd(13) + '文字用高'.padEnd(11) + '空(高)'.padEnd(9) + '空(宽)'.padEnd(9) + '子节点（tag ‖ 上偏移 高 ‖ 文本）');
  for (const m of MODES) {
    await evalJS(`(function(){ st.color=${JSON.stringify(m)}; document.getElementById('color').value=${JSON.stringify(m)}; draw(); return 1;})()`);
    await sleep(260);
    const a = await evalJS(READ);
    if (!a || a.err) { console.log(m + ' → ' + (a && a.err ? a.err : '读不到')); continue; }
    console.log(m.padEnd(7) + (a.w + '×' + a.h).padEnd(12) + String(a.usedH).padEnd(12) +
      String(a.h - a.usedH).padEnd(9) + String(a.w - a.usedW).padEnd(9) +
      a.kids.map(k => k.tag + '@' + k.t + ' h' + k.h + '/内容' + k.content + '{' + k.kidsStr + '}' + (k.txt ? ' "' + k.txt + '"' : '')).join(' ‖ '));
    if (a.fam) console.log('        └ 家族带 #fam：' + a.fam.n + ' 个按钮 ‖ 内容宽 ' + a.fam.sw + ' vs 可视 ' + a.fam.cw +
      ' ⇒ 溢出 ' + a.fam.over + (a.fam.over > 0 ? ' ⚠ 最后几个点不到' : '（没溢出）') +
      ' ‖ flex-wrap=' + a.fam.wrap + ' overflow-x=' + a.fam.ovf);
  }
  const ov = await evalJS(OVERFLOW);
  console.log('\n【全页溢出普查】内容宽 > 可视宽（或高）的元素 —— 前 ' + ov.length + ' 条，按溢出量排');
  for (const o of ov) console.log('  ' + (o.id + '                    ').slice(0, 20) + '横向 +' + o.ow + 'px（内容 ' + o.sw + ' / 可视 ' + o.cw +
    '）‖ 纵向 +' + o.oh + 'px ‖ overflow-x=' + o.ovfX + ' ‖ flex-wrap=' + o.wrap + ' ‖ white-space=' + o.ws);
  killTree(); ws.close();
}
main().catch(e => { console.error('⛔ ' + e.message); killTree(); process.exit(2); });
