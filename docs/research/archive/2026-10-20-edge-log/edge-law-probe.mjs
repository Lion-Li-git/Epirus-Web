/* §E673 取证器（真浏览器）：谱系图线条叠加的**三个量**，两种法律各量一遍。
 *
 * 用户 10-20 下午点的两个症状 + 一个代价：
 *   ① 线间不均：有些线就是比另一些暗（旧法律把"局部密度"压进**每条线的属性** ⇒ 一条长线蹭到扇根就整条陪葬）
 *   ② 线内不均：同一根长线沿程亮度不同（旧法律沿线取 5 格做渐变，而 createLinearGradient 按**弦**铺色 ⇒ 弯边对不齐）
 *   ③ 扇根那块板：把 ①② 修掉之后，密处会不会又糊成一块（这正是 §E467 当初要压的东西）
 *
 * 量法：只数**线自己的墨** —— 同一帧分别取"边开着"与"边关掉"两张图，逐点相减（底下那层地板自己有明暗，
 *   不减掉就会把地板的亮度当成线的亮度；与页内那条"三帧互比"同一手法）。
 *   采样点来自页面自己的探针（EDGR.probe：每条边沿曲线 40 个点，每点带"它那一格压了几条边"），
 *   所以"孤立段"（d≤2）与"埋在堆里"（d>32）能分开算 —— 混在一起算就分不出①和③。
 *
 * 用法：node docs/research/archive/2026-10-20-edge-log/edge-law-probe.mjs [--port=9389]
 * 只读：只在无头 Chrome 里改 st 与两个全局开关并重画，不写任何文件。
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../../../../tools/cdp-boot.mjs';
import { rejectUnknownFlags } from '../../../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['port', 'chrome', 'cdp-wait'], 'edge-law-probe');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const PORT = Number(flag('port', 9389));
const PAGE = 'file:///' + join(ROOT, 'champion-map', 'index.html').replace(/\\/g, '/');
const BOOT = launchChrome({ chrome: flag('chrome', undefined), port: PORT, tries: Number(flag('cdp-wait', 60)),
  /* 窗口尺寸必须钉住：默认 800×600 会把画布压成 756×102，那时**每一格**都压着 >32 条边 ⇒ "孤立段"这一桶恒空，
   *   ①  两条根本没法算（我第一版就是这么空转过一次）。与页检 shot.mjs 用同一档 1600×900。 */
  extraArgs: ['--window-size=1600,900', '--force-device-scale-factor=1'] });
const watchdog = setTimeout(() => { console.error('[guard] 超时，收尸'); BOOT.killTree(); process.exit(3); }, 300000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 一次量完一种法律：开边取一帧、关边取一帧、逐点相减，然后按 d 分桶报数 */
const MEASURE = `(()=>{
  function frame(edgesOn){
    st.mode='tree'; st.elev=0; st.yaw=FLAT.yaw; st.pit=FLAT.pit; st.tX=0; st.tY=0; st.tKx=1; st.tKy=1;
    st.color='fam'; st.labels='off'; st.edges = edgesOn ? 'all' : 'off';
    NOPTS = 0; recomputeVIS(); draw();
    var im = g.getImageData(0, 0, cv.width, cv.height);
    return im.data;
  }
  /* 先正常画一帧把 EDGR.n 拿到，再设探针步长（探针是在 stroke 循环里收的）*/
  st.mode='tree'; st.edges='all'; NOPTS=0; recomputeVIS(); ELOG=1; EPROBE=0; draw();
  EPROBE = Math.max(1, Math.round(EDGR.n / 24));
  var on = frame(true), probe = EDGR.probe.slice();
  /* 计数器要在**开边那一帧**之后立刻抄走：关边那一帧会把 EDGR 重置成 0（我第一版把 0 当成了读数）*/
  var STAT = { n: EDGR.n, hubn: EDGR.hubn, segs: EDGR.segs, inked: EDGR.inked, pr: probe.length };
  EPROBE = 0; var off = frame(false);
  var W = cv.width, H = cv.height;
  function ink(px, x, y){ var xi=Math.round(x), yi=Math.round(y); if (xi<0||yi<0||xi>=W||yi>=H) return null;
    var o=(yi*W+xi)*4; return 0.2126*px[o]+0.7152*px[o+1]+0.0722*px[o+2]; }
  var rows=[], rawOn=[], rawOff=[];
  for (var e=0;e<probe.length;e++){ var pts=probe[e].pts, all=[];
    for (var u=0;u<pts.length;u+=3){ var a=ink(on,pts[u],pts[u+1]), b=ink(off,pts[u],pts[u+1]), d=pts[u+2];
      if (a===null||b===null) continue; rawOn.push(a); rawOff.push(b); all.push([d,a-b]); }
    rows.push(all); }
  function q(arr,p){ return arr.length ? arr[Math.min(arr.length-1, Math.floor(arr.length*p))] : NaN; }
  function srt(a){ return a.slice().sort(function(x,y){return x-y;}); }
  /* 剂量-反应分桶：d = 页面自己那个 22px 纸面格里压了几条边。
   *   ⚑ 为什么不用"d≤2"当"孤立段"：1576×598 上 805 条边时，920 个采样点里 d≤2 只有 24 个、
   *   而且只落在**一条边**上 ⇒ 那种分母下 ①② 根本读不出（我第一版就是这么空转的）。 */
  var B = [[0,8],[9,32],[33,128],[129,1e9]].map(function(r){ return { lo:r[0], hi:r[1], v:[] }; });
  var perEdge = {};   /* eid → { d: [], v: [] } 逐点存，稍后按"这条边最疏的那一桶"算沿程极差 */
  for (var r=0;r<rows.length;r++) for (var k=0;k<rows[r].length;k++){
    var d2=rows[r][k][0], v=rows[r][k][1];
    for (var bi=0;bi<B.length;bi++) if (d2>=B[bi].lo && d2<=B[bi].hi) B[bi].v.push(v);
  }
  for (var e=0;e<probe.length;e++){ var pts2=probe[e].pts, arr=[];
    for (var u2=0;u2<pts2.length;u2+=3){ var a2=ink(on,pts2[u2],pts2[u2+1]), b2=ink(off,pts2[u2],pts2[u2+1]);
      if (a2===null||b2===null) continue; arr.push([pts2[u2+2], a2-b2]); }
    perEdge[e] = arr; }
  var out2 = { buckets: B.map(function(o6){ var s=srt(o6.v);
      return { lo:o6.lo, hi:o6.hi, n:s.length, p10:q(s,.10), p50:q(s,.5), p90:q(s,.90) }; }) };
  /* ② 线内：每条边只看它**最疏那一桶**（d≤8 优先，退到 d≤32），要求该桶 ≥4 个点才算 */
  var spr8 = [], spr32 = [], med8 = [];
  for (var e3=0;e3<probe.length;e3++){ var iso=srt(perEdge[e3].filter(function(z){return z[0]<=8;}).map(function(z){return z[1];}));
    var mid=srt(perEdge[e3].filter(function(z){return z[0]<=32;}).map(function(z){return z[1];}));
    if (iso.length>=4){ spr8.push(iso[iso.length-1]-iso[0]); med8.push(iso[iso.length>>1]); }
    else if (mid.length>=4) spr32.push(mid[mid.length-1]-mid[0]); }
  out2.spread_d8 = { edges: spr8.length, med: q(srt(spr8),.5), worst: spr8.length?Math.max.apply(null,spr8):NaN, p90: q(srt(spr8),.90) };
  out2.spread_d32_fallback = { edges: spr32.length, med: q(srt(spr32),.5) };
  out2.lineMed_d8 = { edges: med8.length, p10: q(srt(med8),.10), p50: q(srt(med8),.5), p90: q(srt(med8),.90) };
  /* 每个桶里"有几个不同的边贡献点"—— 只有点数没有边数，就会把 2 条边的散布当成"线间不均"（我第一版差点这么报）*/
  out2.buckets.forEach(function(o7, i7){ var ids={}; for (var e9=0;e9<probe.length;e9++){
      for (var k9=0;k9<rows[e9].length;k9++){ var dd=rows[e9][k9][0]; if (dd>=o7.lo && dd<=o7.hi) ids[e9]=1; } }
    o7.edges = Object.keys(ids).length; });
  /* 每帧代价：新法律多一次 getImageData + 一遍 94 万格的表查询，卡不卡要量，不能感觉 */
  var T0 = performance.now(); for (var t9 = 0; t9 < 3; t9++) { st.edges='all'; draw(); } var T1 = performance.now();
  out2.frameMs = (T1 - T0) / 3;
  out2.canvas = [cv.width, cv.height];
  out2.law = st.elaw; out2.pts = rows.reduce(function(s2,r2){ return s2 + r2.length; }, 0);
  out2.stat = STAT; out2.rawOn = q(srt(rawOn),.5); out2.rawOff = q(srt(rawOff),.5);
  return out2;
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
  await send('Page.navigate', { url: PAGE + '#mode=tree&edges=all&elaw=attr' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { up = await evalJS(`(()=>typeof draw==='function'&&typeof EDGR==='object')()`); if (!up) await sleep(400); }
  console.log('页面起来了：' + up + ' ‖ 画布 ' + JSON.stringify(await evalJS(`(()=>[cv.width,cv.height])()`)));
  const f3 = (v) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(1) : '—';
  const bk = (r, i) => r.buckets[i];
  const out = [];
  for (const law of ['attr', 'log']) {
    await evalJS(`(()=>{ st.elaw=${JSON.stringify(law)}; return st.elaw; })()`);
    const r = await evalJS(MEASURE);
    if (!r || r.__err || !r.stat) { console.log('  ⛔ ' + law + '：' + (r && (r.__err || '没拿到读数'))); continue; }
    out.push([law, r]);
    const S = r.stat;
    console.log('\n=== 法律 ' + law + ' ===');
    console.log('  分母：全图 ' + S.n + ' 条边（落笔 ' + S.segs + ' 次）‖ 探针边 ' + Math.round(r.pts / 40) + ' 条 ‖ 采样点 ' + r.pts +
      ' ‖ 最密那格压 ' + S.hubn + ' 条 ‖ 累加器涂到 ' + S.inked + ' 格（attr 档恒 0 = 不走累加器）');
    console.log('  自检：采样点亮度中位 开边 ' + f3(r.rawOn) + ' vs 关边 ' + f3(r.rawOff) +
      (Math.abs(r.rawOn - r.rawOff) < 1 ? '   ⛔ 两者相等 ⇒ 边根本没画上去，下面全是空转' : ''));
    console.log('  剂量-反应（Δ墨 = 开边 − 关边；按"这条边当时那一格压了几条"分桶，满量程 255）');
    const LBL = ['d 0–8', 'd 9–32', 'd 33–128', 'd >128'];
    for (let i = 0; i < r.buckets.length; i++) { const b = bk(r, i);
      console.log('    ' + LBL[i].padEnd(9) + ' 点 ' + String(b.n).padStart(4) + '（来自 ' + String(b.edges).padStart(2) + ' 条边）   P10 ' + f3(b.p10) + ' ‖ 中位 ' + f3(b.p50) + ' ‖ P90 ' + f3(b.p90) + '   带宽 ' + f3(b.p90 - b.p10)); }
    console.log('  每帧代价（同一状态连画 3 帧取均值，画布 ' + r.canvas[0] + '×' + r.canvas[1] + '）：' + f3(r.frameMs) + ' ms');
    const sp = r.spread_d8, lm = r.lineMed_d8;
    console.log('  ② 线内沿程极差（只看 d≤8 那一桶、且该桶 ≥4 个点的边）：边数 ' + sp.edges +
      ' ‖ 中位 ' + f3(sp.med) + ' ‖ P90 ' + f3(sp.p90) + ' ‖ 最差 ' + f3(sp.worst) +
      (sp.edges < 6 ? '   ⚠ 分母 <6 条边 ⇒ 这一格**读不出**，不许引用（退到 d≤32 也只有 ' + r.spread_d32_fallback.edges + ' 条）' : ''));
    console.log('  ① 线间（同桶 d≤8 里每条边的中位 Δ墨）：边数 ' + lm.edges + ' ‖ P10 ' + f3(lm.p10) + ' ‖ 中位 ' + f3(lm.p50) + ' ‖ P90 ' + f3(lm.p90) +
      (lm.edges < 6 ? '   ⚠ 同上，分母不足' : ''));
  }
  if (out.length === 2) {
    const a = out[0][1], b = out[1][1];
    console.log('\n=== 两种法律的差（attr → log）===');
    console.log('  疏处（d≤8 中位 Δ墨）    ' + f3(a.buckets[0].p50) + ' → ' + f3(b.buckets[0].p50) + '   （目标：持平，别让单线变淡）');
    console.log('  堆里（d>128 中位 Δ墨）  ' + f3(a.buckets[3].p50) + ' → ' + f3(b.buckets[3].p50) + '   （这块必然变深：累加只会变深，旧法律是靠压暗单线换的）');
    console.log('  ② 线内极差（d≤8 中位）  ' + f3(a.spread_d8.med) + ' → ' + f3(b.spread_d8.med) + '   （分母 ' + a.spread_d8.edges + ' → ' + b.spread_d8.edges + ' 条边）');
    console.log('  ① 线间带宽（P90−P10）   ' + f3(a.lineMed_d8.p90 - a.lineMed_d8.p10) + ' → ' + f3(b.lineMed_d8.p90 - b.lineMed_d8.p10));
  }
  if (errors.length) console.log('\n⚠ 页面异常：' + errors.slice(0, 3).join(' ⏎ '));
  await send('Browser.close').catch(() => {}); BOOT.killTree();
  process.exit(out.length === 2 ? 0 : 1);
}
main().catch(e => { console.error('⛔ ' + (e && e.stack || e)); BOOT.killTree(); process.exit(2); });
