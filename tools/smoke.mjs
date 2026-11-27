/* Epirus 页面冒烟测试：用 Chrome DevTools Protocol 驱动真实 UI。
 * 用法：node tools/smoke.mjs [chrome路径] [端口]
 * 产出：/tmp 下的 screenshot-battle.png / screenshot-train.png，收集 console/异常，
 *       并断言若干关键 UI 状态。
 */
import { writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/* 起 Chrome / 等 CDP 的**唯一**实现（v1.7.5 S0） */
import { launchChrome } from './cdp-boot.mjs';

/* 位置参数：剔除 --flag（如 --max-ms=N），否则会被当成端口/chrome 路径 */
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });

/* v1.7.5：这里原来写死 `C:\Program Files\Google\...` 当默认值 ⇒ 换平台/换镜像就变成"CDP 连不上"的假象。
 *   现在不传就是"让 cdp-boot 按平台找"，找不到会报出它找过哪些路径。 */
const PORT = Number(ARGV[1] || 9337);
const CDP_TRIES = Number((process.argv.find(function (a) { return /^--cdp-wait=/.test(a); }) || '').split('=')[1]) || 60;
/* v1.5.310（DS 2026-10-01 复核）：URL 从**本文件位置**现算，与 battle-test/ui-probe 同款。
 * 原来硬编码 `file:///D:/code/Epirus-Web/index.html` ⇒ 换目录、换机器、上 CI 必红。
 * 同源硬编码还有两处：tools/np-probe.mjs、tools/remote-probe.mjs（同一轮一并修）。 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');

/* v1.7.5（10-13 夜班 S0）：起 Chrome 与等 CDP 搬到 `tools/cdp-boot.mjs` 那**一份**实现。
 * 病（用户 10-13 贴的 CI 判词）：windows runner 上这条红只说 "CDP endpoint not reachable"，
 *   而原来 `{ stdio: 'ignore' }` 把 Chrome 自己的报错整条丢了 ⇒ "没装 Chrome / 起了但死了 / 绑端口慢过预算"
 *   三种可能在日志里长得一模一样（同一把尺本机 10.7s 绿）。现在：路径、进程死活、stderr 尾巴都要打出来。 */
let BOOT;
try {
  BOOT = launchChrome({ chrome: ARGV[0], port: PORT, tries: CDP_TRIES });
} catch (e) {
  console.error('SMOKE 起不来 Chrome：' + e.message);
  process.exit(e.code === 'NO_CHROME' ? 4 : 2);
}
const proc = BOOT.proc, udd = BOOT.udd;
/* --- 自限时 + 收尸由脚本负责：退出时统一关闭探针启动的 headless Chrome。
 * 现在由脚本自己计时，到点先杀 Chrome 进程树再退出。用 --max-ms=N 调。 --- */
const MAX_MS = Number((process.argv.find(function (a) { return /^--max-ms=/.test(a); }) || '').split('=')[1]) || 240000;
let __closed = false;
function __killTree() {
  if (__closed) return; __closed = true;
  BOOT.killTree();   // 进程树 + 临时 profile 都在 cdp-boot 里收（原来这两件事在本文件与各探针里各抄一份）
}
const __watchdog = setTimeout(function () {
  console.error('[guard] 超时 ' + MAX_MS + 'ms，自杀并收尸 Chrome');
  __killTree(); process.exit(3);
}, MAX_MS);


const sleep = ms => new Promise(r => setTimeout(r, ms));
/* v1.7.5：这里的 `waitJson`（以及它那句不带现场的重试循环）已搬到 `tools/cdp-boot.mjs` 一份实现。 */

let errors = [];
let cdp;
async function main() {
  const ver = await BOOT.version();
  const tabs = await BOOT.tabs();
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '));
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text || '';
      // 训练服务未启动的连接拒绝单独分类
      if (t.indexOf('ERR_CONNECTION_REFUSED') < 0) errors.push('LOG: ' + t);
    }
  };
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails.exception?.description));
    return r.result?.result?.value;
  };
  const shot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  };
  cdp = { send, evalJS, shot, ws };   // ws 要暴露出来：否则它挂住事件循环，脚本在 SUMMARY 之后不退出

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: URL });
  /* ===== v1.6.52：把"写死等待"改成"轮询到就绪"（修 CI 上那条观察档 flaky）=====
   * 病（2026-10-10 实测）：这里原来是 `await sleep(1600)`，紧接着就断言 DOM。
   *   本机跑是 `SUMMARY: SMOKE OK`，而 CI 上**同一批页面代码两笔绿两笔红**（6864093 红 / 我两笔绿 / 7023bff 又红）
   *   ⇒ 纯等待竞态：页面初始化（解包冠军包 + 渲染 30 个技能钮 + 开新局）一旦超过 1.6 秒，第一段就整片红 ——
   *   实测症状正是「对局页可见 & 技能按钮=30」/「多人专用技能置灰(≥2 disabled)」/
   *   「双方 HP 显示 3」/「点击出招:ジ」一起 FAIL，而「点击出招:防御」有时 PASS（= 初始化到一半）。
   * 改法：**先轮询到"30 个技能钮都渲染出来"再往下走**，上限 15 秒（就绪即刻返回 ⇒ 正常路径不拖慢）。
   *   超时后下面的 `check` 照样判 FAIL；等待只给页面初始化留出时间。
   * 点招前先等按钮可点，日志出现第 4 回合后再读状态；
   *   ② 第四回合的日志（原来靠 4×650ms 攒出来，慢机器上不够）。 */
  const waitFor = async (expr, desc, timeoutMs) => {
    const t0 = Date.now(), cap = timeoutMs || 15000;
    for (;;) {
      let v = false;
      try { v = await evalJS(expr); } catch (e) { v = false; }
      if (v) return true;
      if (Date.now() - t0 > cap) { console.log('⚠ 等待超时（' + desc + '，' + cap + 'ms）—— 下面照常判'); return false; }
      await sleep(120);
    }
  };
  await waitFor(`document.querySelectorAll('.skillbtn').length === 30`, '技能钮渲染完成（30 个）', 15000);
  await sleep(150);   // 给 disabled / HP 那一帧落定

  const checks = [];
  const check = (name, cond) => { checks.push([name, !!cond]); console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); };

  // --- 对局页 ---
  check('对局页可见 & 技能按钮=30', await evalJS(`document.querySelectorAll('.skillbtn').length === 30`));
  check('多人专用技能置灰(≥2 disabled)', await evalJS(`document.querySelectorAll('.skillbtn:disabled').length >= 2`));
  check('双方 HP 显示 3', await evalJS(`[...document.querySelectorAll('.side .statbar .stat')].some(s=>s.textContent.includes('HP')&&s.textContent.includes('3'))`));

  // 四回合交互夹具：先确认默认 3 血，再抬高双方生命，让随机 AI 稳定陪跑四回合
  check('四回合夹具生命已设为 99', await evalJS(`(()=>{const st=EpirusUI.B.state;if(!st||st.over)return false;for(const p of st.p)p.hp=99;EpirusUI.refresh();return st.p.every(p=>p.hp===99)&&!st.over;})()`));
  const moves = ['ジ', '防御', 'ジ', '防御'];
  for (const mv of moves) {
    /* v1.6.52：点之前先等这个按钮可点（同族的等待竞态，见上面 waitFor 的说明）。 */
    await waitFor(`(()=>{const b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent===${JSON.stringify(mv)} && !x.disabled); return !!b;})()`, '按钮可点:' + mv, 8000);
    const okClick = await evalJS(`(()=>{const b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent===${JSON.stringify(mv)} && !x.disabled); if(!b) return false; b.click(); return true;})()`);
    check('点击出招:' + mv, okClick === true);
    await sleep(650);
  }
  await waitFor(`document.getElementById('logbox').textContent.includes('第 4 回合')`, '日志出现第 4 回合', 8000);
  check('日志有第 4 回合', await evalJS(`document.getElementById('logbox').textContent.includes('第 4 回合')`));
  check('四回合后仍处于对局中', await evalJS(`!EpirusUI.B.state.over && document.getElementById('overlay-root').classList.contains('hidden')`));
  await shot(join(tmpdir(), 'screenshot-battle.png'));
  console.log('screenshot-battle saved');

  // --- 对局区导入绑定 + 2.0 训练场：远程 Node 服务流程 ---
  check('导入冠军包控件在位且已绑定点击事件', await evalJS(`!!document.getElementById('btn-import') && !!document.getElementById('file-import') && typeof document.getElementById('btn-import').onclick === 'function'`));
  await evalJS(`document.getElementById('tab-train').click()`);
  await sleep(300);
  check('2.0 训练场 UI 在位', await evalJS(`!!document.getElementById('tr-port') && !!document.getElementById('tr-token') && !!document.getElementById('tr-mode') && !!document.getElementById('tr-up') && !!document.getElementById('btn-train') && !!document.getElementById('btn-remote') && !!document.getElementById('tr-remote-gens')`));
  await evalJS(`document.getElementById('tr-port').value=8799; document.getElementById('tr-token').value='smoke-token'; document.getElementById('tr-remote-gens').value=1000; document.getElementById('btn-train').click()`);
  await sleep(2500);
  const remoteHint = await evalJS(`document.getElementById('tr-remote').textContent`);
  console.log('remoteHint =', JSON.stringify(remoteHint));
  check('服务未启动提示', /服务未启动|自动|启动/.test(remoteHint));
  check('按钮未锁死', await evalJS(`!document.getElementById('btn-train').disabled`));
  await shot(join(tmpdir(), 'screenshot-train.png'));
  console.log('screenshot-train saved');

  /* --- v1.6.5\uff08\u7528\u6237\u88c1\u5b9a\u300c\u628a 2 \u4eba\u5408\u5e76\u8fdb\u591a\u4eba\uff0c\u53d8\u6210\u9009\u4eba\u6570 \u00d7 3\u8840/5\u8840\u6b63\u4ea4\uff1b4 \u8840\u4e5f\u53ef\u4ee5\u4e0a\u300d\uff09\uff1a
   * \u628a **12 \u79cd\u7ec4\u5408**\u5728\u771f\u9875\u9762\u91cc\u5168\u8fc7\u4e00\u904d\uff0c\u5224\u7684\u662f\u884c\u4e3a\u800c\u4e0d\u662f\u6587\u672c
   * \uff08\u9759\u6001\u90a3\u534a\u5728 `np-test` D28/D226\uff0c\u4f1a\u88ab\u91cd\u6784\u67b6\u7a7a\uff1b\u8fd9\u4e00\u534a\u8981\u771f\u8d77\u6d4f\u89c8\u5668\u624d\u80fd\u8bc1\u660e"\u9009 4 \u8840\u5efa\u51fa\u6765\u7684\u5c40\u771f\u7684\u662f 4 \u8840"\uff09\u3002
   * \u26a0 \u7528\u6237\u70b9\u540d\u8981\u590d\u6d4b\u7684\u90a3\u6761 = **\u4eba\u6570\u5230 2 \u65f6\u4e09\u5f20\u591a\u4eba\u4e13\u7528\u6280\u80fd\u81ea\u52a8\u5c4f\u853d**\uff1a\u65e7\u7248\u5b83\u7531 `standard` \u7684\u5361\u8868\u6321\u7740\uff0c
   *   \u73b0\u5728 2 \u4eba\u4e5f\u80fd\u5f00 4/5 \u8840\uff08\u90a3\u91cc\u7684\u5361\u8868\u662f AVAILABLE_MULTI\uff09\uff0c\u552f\u4e00\u8fd8\u6321\u7740\u5b83\u7684\u662f `canUseSkillInMode` \u91cc"\u5b58\u6d3b\u4eba\u6570 \u22642"\u90a3\u4e00\u652f
   *   \u21d2 \u5fc5\u987b\u9010\u8840\u91cf\u5224\uff0c\u5e76\u4e14**3~8 \u4eba\u90a3 9 \u683c\u8981\u5f53\u6b63\u5bf9\u7167**\uff08\u5426\u5219\u8fd9\u6761\u5224\u636e\u5728"\u6c38\u8fdc\u8bf4\u591a\u4eba\u6a21\u5f0f"\u7684\u574f\u5b9e\u73b0\u4e0a\u4e5f\u7eff\uff09\u3002 */
  await evalJS(`document.getElementById('tab-battle').click()`);
  await sleep(250);
  const sweep = await evalJS(`(function(){
    const R = window.EpirusRules, U = window.EpirusUI;
    const pl = document.getElementById('sel-players'), hpSel = document.getElementById('sel-hp');
    if (!pl || !hpSel || !U || !U.B) return { fatal: 'missing #sel-players / #sel-hp / EpirusUI' };
    const names = R.MULTI_ONLY.map(function (k) { return R.byKey[k].name; });
    const rows = [];
    for (const p of [2, 3, 4, 5, 6, 7, 8]) for (const h of [3, 4, 5]) {
      pl.value = String(p); pl.dispatchEvent(new Event('change'));
      hpSel.value = String(h); hpSel.dispatchEvent(new Event('change'));
      const st = U.B.state;
      const ct = {};
      document.querySelectorAll('#skillgrid button').forEach(function (b) {
        const nm = b.querySelector('.nm');
        if (nm && names.indexOf(nm.textContent) >= 0) ct[nm.textContent] = { c: (b.querySelector('.ct') || {}).textContent, d: !!b.disabled };
      });
      rows.push({
        p: p, h: h, modeKey: st.modeKey, modeHp: st.mode.hp, n: st.p.length,
        initHp: st.p.map(function (x) { return x.hp; }).join('/'),
        cardCt: names.map(function (x) { return ct[x] ? ct[x].c : '(\u7f3a\u5361)'; }).join('|'),
        cardDis: names.map(function (x) { return ct[x] ? (ct[x].d ? 1 : 0) : 'x'; }).join('')
      });
    }
    return { rows: rows, modeKeys: Object.keys(R.MODES), blockedText: '\u591a\u4eba\u6a21\u5f0f|\u591a\u4eba\u6a21\u5f0f|\u591a\u4eba\u6a21\u5f0f' };
  })()`);
  if (sweep.fatal) {
    check('12 \u683c\u7ec4\u5408\u626b\u63cf\u53ef\u8dd1', false);
    console.log('  sweep fatal =', sweep.fatal);
  } else {
    const rows = sweep.rows;
    check('21 \u79cd\uff08\u4eba\u6570 \u00d7 \u8840\u91cf\uff09\u7ec4\u5408\u5168\u90e8\u5efa\u5f97\u51fa\u5c40', rows.length === 21);
    check('\u6bcf\u683c\u7684\u4eba\u6570\u771f\u843d\u5230\u5ea7\u4f4d\u6570', rows.every(r => r.n === r.p));
    check('\u6bcf\u683c\u7684\u8840\u91cf\u771f\u843d\u5230 mode.hp \u4e0e\u6bcf\u4e2a\u5ea7\u4f4d\u7684\u521d\u59cb\u8840', rows.every(r => r.modeHp === r.h && r.initHp === new Array(r.p).fill(r.h).join('/')));
    const seen = {};
    rows.forEach(r => { seen[r.modeKey] = 1; });
    check('\uff08\u4eba\u6570 \u00d7 \u8840\u91cf\uff09\u6620\u5c04\u7684\u50cf\u6070\u597d\u76d6\u4f4f MODES \u5168\u90e8 key',
      sweep.modeKeys.every(k => seen[k]) && Object.keys(seen).length === sweep.modeKeys.length);
    check('2 \u4eba\u5c40\uff1a\u4e09\u5f20\u591a\u4eba\u4e13\u7528\u5361\u5168\u90e8\u6807\u6ce8\u4e3a\u300c\u591a\u4eba\u6a21\u5f0f\u300d\uff08\u7528\u6237\u70b9\u540d\u7684\u56de\u5f52\uff0c\u9010\u8840\u91cf\u5224\uff09',
      rows.filter(r => r.p === 2).every(r => r.cardCt === sweep.blockedText));
    check('\u6b63\u5bf9\u7167\uff1a3~8 \u4eba\u5c40\u90a3\u4e09\u5f20\u4fdd\u6301\u53ef\u7528',
      rows.filter(r => r.p > 2).every(r => r.cardCt !== sweep.blockedText));
    console.log('  sweep 4 \u8840\u683c =', JSON.stringify(rows.filter(r => r.h === 4).map(r => r.p + '\u4eba\u2192' + r.modeKey + '(hp' + r.modeHp + ')')));
    console.log('  sweep 2 \u4eba\u683c =', JSON.stringify(rows.filter(r => r.p === 2).map(r => r.h + '\u8840\u2192' + r.modeKey + ' \u5361=' + r.cardCt)));
    await shot(join(tmpdir(), 'screenshot-multi4.png'));
  }
  await shot(join(tmpdir(), 'screenshot-long.png'));
  console.log('screenshot-long saved');

  await evalJS(`(()=>{const p=document.getElementById('sel-players'),h=document.getElementById('sel-hp'),d=document.getElementById('sel-diff');p.value='8';p.dispatchEvent(new Event('change'));h.value='5';h.dispatchEvent(new Event('change'));d.value='lv:hard';d.dispatchEvent(new Event('change'));document.getElementById('btn-newgame').click();const U=window.EpirusUI;for(const q of U.B.state.p)q.hp=99;U.refresh();window.__smoke8Before=U.B.state.round;})()`);
  await waitFor(`[...document.querySelectorAll('.skillbtn')].some(b=>b.querySelector('.nm')?.textContent==='ジ'&&!b.disabled)`, '8人局技能就绪', 15000);
  for (let i = 0; i < 3; i++) {
    await evalJS(`(()=>{const b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent==='ジ'&&!x.disabled);if(!b)return false;b.click();return true;})()`);
    await sleep(500);
  }
  await waitFor(`window.EpirusUI.B.state.round > window.__smoke8Before`, '8人局回合推进', 8000);
  check('8人5血局能真实推进回合', await evalJS(`window.EpirusUI.B.state.round > window.__smoke8Before && !window.EpirusUI.B.state.over`));

  const undoMem = await evalJS(`(()=>{const U=window.EpirusUI,B=U.B,Bots=window.EpirusBots,S=window.EpirusState,R=window.EpirusRules,Play=window.EpirusPlay;Bots.resetBotMem();const original=Bots.snapshotBotMem();B.locked=false;B.state.over=false;B.undoUsed=false;B.roundStartSnapshot=S.cloneState(B.state);B.roundStartRngState=B.state.rng.next.getState();B.roundStartBotMem=Bots.snapshotBotMem();B.transcript=[{round:B.state.round,line:'fixture',human:'',ai:'',lines:[],parts:[],events:[]}];const fake=S.cloneState(B.state);fake.round=Math.max(2,fake.round);fake.p[0].hp=1;for(let i=1;i<fake.p.length;i++)fake.p[i].hp=99;fake.p[0].lastSkill=R.SK.GUARD;Bots.pickBalanced(fake,1,Play.legalActions(fake,1));const mutated=Bots.snapshotBotMem();document.getElementById('btn-undo').click();const restored=Bots.snapshotBotMem();return {original:original,mutated:mutated,restored:restored,same:JSON.stringify(original)===JSON.stringify(restored)};})()`);
  check('悔棋恢复脚本AI跨回合记忆', undoMem && undoMem.mutated.oppMightDefend === true && undoMem.same === true);

  const queuedDiff = await evalJS(`(()=>{const U=window.EpirusUI,b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent==='ジ'&&!x.disabled);if(!b)return null;b.click();const s=document.getElementById('sel-diff');s.value='lv:sparring';s.dispatchEvent(new Event('change'));return {before:U.B.diff,pending:U.B.pendingDiff,select:s.value,resolving:U.B.resolvePending};})()`);
  check('结算中切档排队且不污染当前回合', queuedDiff && queuedDiff.before === 'lv:hard' && queuedDiff.pending === 'lv:sparring' && queuedDiff.select === 'lv:hard' && queuedDiff.resolving === true);
  await waitFor(`window.EpirusUI.B.pendingDiff === null && !window.EpirusUI.B.resolvePending`, '排队难度切换落地', 15000);
  check('结算后自动应用排队难度', await evalJS(`window.EpirusUI.B.diff === 'lv:sparring'`));

  /* --- v1.6.6 难度阶梯（用户指令 2「重新研究脚本难度…冠军作为底层但探索概率很高」）：
   * 验证下拉选项与页面状态联动（静态契约由 D227 负责）。
   * 三件事只有真浏览器能证：① 每个档 id 都能选中且 `B.diff` 跟着变；② 换档时 `aiInfo()` 报的
   *   champ/style/兜底 身份与表一致（"档是假的"= 选了它却走了别的路）；
   *   ③ **人数=2 与人数=5 的档位列表一模一样**，2 人与多人共用同一难度阶梯。
   *   而 `aiInfo()` 报的**包**必须一个 2P 一个 3P（§E286 的换包裁定要能在页面上看见）。 */
  const lad = await evalJS(`(function(){
    const U = window.EpirusUI, Bots = window.EpirusBots;
    if (!U || !Bots || !Bots.DIFF_TIERS) return { fatal: 'missing EpirusUI / EpirusBots.DIFF_TIERS' };
    const sel = document.getElementById('sel-diff'), pl = document.getElementById('sel-players');
    const ng = document.getElementById('btn-newgame');
    if (!sel || !pl || !ng) return { fatal: 'missing #sel-diff / #sel-players / #btn-newgame' };
    const tiers = Bots.DIFF_TIERS.map(function (t) { return { id: t.id, kind: t.kind }; });
    const rows = [];
    for (const t of tiers) {
      sel.value = t.id; sel.dispatchEvent(new Event('change'));
      ng.click();
      const info = U.aiInfo();
      rows.push({ id: t.id, kind: t.kind, picked: U.B.diff, tierId: (U.tierOf(U.B.diff) || {}).id || null,
        src2: String(info.source).slice(0, 2), champ: !!info.champ, fallback: !!info.fallback, tier: info.tier || null });
    }
    const optsAt = function (n) {
      sel.value = Bots.DIFF_DEFAULT; sel.dispatchEvent(new Event('change'));   // 必须先回到冠军档：风格档的 aiInfo 不报包（它不吃包）
      pl.value = String(n); pl.dispatchEvent(new Event('change')); ng.click();
      return { list: Array.prototype.map.call(sel.options, function (o) { return o.value; }),
        pack2: String(U.aiInfo().source).slice(0, 2), tier: U.B.diff };
    };
    const at2 = optsAt(2), at5 = optsAt(5);
    const claimed = (Bots.STYLES || []).filter(function (s) {
      return (Bots.DIFF_TIERS || []).some(function (t) { return t.kind === 'style' && t.style === s.id; });
    }).length;
    return { fatal: null, rows: rows, at2: at2, at5: at5, tierIds: tiers.map(function (t) { return t.id; }),
      def: Bots.DIFF_DEFAULT, styleN: (Bots.STYLES || []).length, claimed: claimed };
  })()`);
  if (lad.fatal) {
    check('难度阶梯扫描可跑', false);
    console.log('  ladder fatal =', lad.fatal);
  } else {
    check('每个难度档都点得动，且 B.diff / tierOf 跟着变成那一档',
      lad.rows.every(r => r.picked === r.id && r.tierId === r.id));
    check('冠军档与风格档各自报出正确身份，并保持池装配',
      lad.rows.every(r => r.fallback === false && r.champ === (r.kind === 'champ') && r.tier === r.id));
    check('档位列表不随人数被裁短（2 人 = 5 人，这就是"2 人并进同一条阶梯"的行为定义）',
      JSON.stringify(lad.at2.list) === JSON.stringify(lad.at5.list));
    check('表里每一档都在下拉里（少一档 = 页面把表裁了）',
      lad.tierIds.every(id => lad.at5.list.indexOf(id) >= 0));
    check('默认档在册且是 lv:regular（改默认档 = 改所有老用户的手感，属产品裁定）',
      lad.def === 'lv:regular' && lad.at5.list.indexOf(lad.def) >= 0);
    /* 2P 与多人桌共用统一池；验证两格都由池供给，并保持本机包与单包回退关闭。 */
    check('统一池：2 人与多人两格同走池供给，本机包与单包回退关闭',
      lad.at2.pack2.indexOf('池') === 0 && lad.at5.pack2.indexOf('池') === 0);
    /* 风格档去重按映射后的 `{v,t}` 列表比较，确保每个脚本只占一个可选席位。 */
    check('下拉里每个脚本只占一个席位',
      new Set(lad.at5.list).size === lad.at5.list.length &&
      lad.at5.list.length === lad.tierIds.length + lad.styleN - lad.claimed);
    console.log('  ladder rows =', JSON.stringify(lad.rows.map(r => r.id + ':' + (r.champ ? 'champ' : 'style') + ':' + r.src2)));
    console.log('  ladder 2人 =', JSON.stringify(lad.at2), ' 5人 =', JSON.stringify(lad.at5));
    await shot(join(tmpdir(), 'screenshot-ladder.png'));
  }

  const saveFailure = await evalJS(`(()=>{const C=window.EpirusChampion,P=window.EpirusPolicy,orig=Storage.prototype.setItem;let result;try{Storage.prototype.setItem=function(){throw new Error('quota');};result=C.store.save(P.unpack(window.EPIRUS_CHAMPION));}finally{Storage.prototype.setItem=orig;}return result===false;})()`);
  check('本地冠军保存失败会返回失败而不是假成功', saveFailure === true);

  const staleConnections = await evalJS(`(async()=>{const origFetch=window.fetch,resolvers=[];let postCount=0;document.getElementById('tr-token').value='smoke-token';window.fetch=function(url,opts){if(opts&&opts.method==='POST')postCount++;return new Promise(function(resolve){resolvers.push(resolve);});};try{const btn=document.getElementById('btn-train');btn.click();btn.click();resolvers[1]({ok:true});await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));resolvers[0]({ok:true});await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));document.getElementById('btn-stop').click();return postCount;}finally{window.fetch=origFetch;}})()`);
  check('旧训练探测晚到不会重连并覆盖新会话', staleConnections === 1);

  const guardBadge = await evalJS(`(()=>{const U=window.EpirusUI,p=U.B.state.p[0],oldNext=p.guardNext,oldRound=U.B.roundStarted;try{p.guardNext=true;U.B.roundStarted=false;U.refresh();return document.getElementById('side-0').textContent.includes('无极变速');}finally{p.guardNext=oldNext;U.B.roundStarted=oldRound;U.refresh();}})()`);
  check('下一回合无极变速徽章读取 guardNext', guardBadge === true);

  const sessionPriority = await evalJS(`(async()=>{const U=window.EpirusUI,P=window.EpirusPolicy,origFetch=window.fetch,origSet=Storage.prototype.setItem;const members=window.EPIRUS_CHAMPION_POOL.members,oldPack=members[0].pack,fresh=window.EPIRUS_CHAMPION_3P;let calls=0;try{localStorage.setItem('epirus.champion3p',JSON.stringify(oldPack));document.getElementById('tr-token').value='smoke-token';window.fetch=function(url,opts){calls++;if(calls===1)return Promise.resolve({ok:true});const payload='data: '+JSON.stringify({type:'done',secs:0,champ:fresh,out:'scratch/arms/ui-train-latest.bak'})+'\\n\\n';return Promise.resolve(new Response(payload,{status:200}));};Storage.prototype.setItem=function(k,v){if(k==='epirus.champion3p')throw new Error('quota');return origSet.call(this,k,v);};document.getElementById('btn-train').click();for(let i=0;i<30;i++)await new Promise(r=>setTimeout(r,10));const expected=P.loadGame(fresh),actual=U.champForCount(5).params;return JSON.stringify(actual)===JSON.stringify(expected);}finally{window.fetch=origFetch;Storage.prototype.setItem=origSet;try{localStorage.removeItem('epirus.champion3p');}catch(e){}}})()`);
  check('session 新多人包在本地持久化失败时仍优先于旧包', sessionPriority === true);

  console.log('\nJS errors:', errors.length ? errors : '(none)');
  console.log('SUMMARY:', checks.every(c => c[1]) && errors.length === 0 ? 'SMOKE OK' : 'SMOKE FAILED');
  process.exitCode = checks.every(c => c[1]) && errors.length === 0 ? 0 : 1;
}

main().catch(e => { console.error('SMOKE ERROR:', e); process.exitCode = 2; })
  .finally(async () => {
    /* 成功路径也必须清掉看门狗并关掉 CDP 连接 —— 否则事件循环不空、脚本不退出，
     * 看门狗到点强制 process.exit(3)，于是"SMOKE OK"却返回失败码（会让交付门禁误判）。 */
    clearTimeout(__watchdog);
    try { if (cdp && cdp.ws) cdp.ws.close(); } catch (e) { /* ignore */ }
    try { proc.kill(); } catch (e) { /* ignore */ }
    await Promise.race([
      new Promise(res => proc.once('exit', res)),
      sleep(3000)
    ]);
    for (let i = 0; i < 5; i++) {
      try { rmSync(udd, { recursive: true, force: true }); break; }
      catch (e) { await sleep(400); }
    }
  });
