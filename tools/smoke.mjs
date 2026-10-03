/* Epirus 页面冒烟测试：用 Chrome DevTools Protocol 驱动真实 UI。
 * 用法：node tools/smoke.mjs [chrome路径] [端口]
 * 产出：/tmp 下的 screenshot-battle.png / screenshot-train.png，收集 console/异常，
 *       并断言若干关键 UI 状态。
 */
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* 位置参数：剔除 --flag（如 --max-ms=N），否则会被当成端口/chrome 路径 */
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });

const CHROME = ARGV[0] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(ARGV[1] || 9337);
/* v1.5.310（DS 2026-10-01 复核）：URL 从**本文件位置**现算，与 battle-test/ui-probe 同款。
 * 原来硬编码 `file:///D:/code/Epirus-Web/index.html` ⇒ 换目录、换机器、上 CI 必红。
 * 同源硬编码还有两处：tools/np-probe.mjs、tools/remote-probe.mjs（同一轮一并修）。 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');

const udd = mkdtempSync(join(tmpdir(), 'epirus-cdp-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'about:blank'
], { stdio: 'ignore' });
/* --- 自限时 + 收尸（不再用 shell timeout 包 node：那样 node 被杀时
 * finally 不会执行 → 探针自己起的 headless Chrome 变成孤儿。
 * 现在由脚本自己计时，到点先杀 Chrome 进程树再退出。用 --max-ms=N 调。 --- */
const MAX_MS = Number((process.argv.find(function (a) { return /^--max-ms=/.test(a); }) || '').split('=')[1]) || 240000;
let __closed = false;
function __killTree() {
  if (__closed) return; __closed = true;
  try {
    if (process.platform === 'win32' && proc && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else if (proc) proc.kill('SIGKILL');
  } catch (e) { }
  // 一并删掉自己的临时 profile 目录（否则 %TEMP% 会积成堆）
  try { rmSync(udd, { recursive: true, force: true }); } catch (e) { }
}
const __watchdog = setTimeout(function () {
  console.error('[guard] 超时 ' + MAX_MS + 'ms，自杀并收尸 Chrome');
  __killTree(); process.exit(3);
}, MAX_MS);


const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('CDP endpoint not reachable: ' + url);
}

let errors = [];
let cdp;
async function main() {
  const ver = await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const tabs = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
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
      // 探测"未启动的训练服务"产生的是预期网络错误，不是 JS 异常
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
  await sleep(1600);

  const checks = [];
  const check = (name, cond) => { checks.push([name, !!cond]); console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); };

  // --- 对局页 ---
  check('对局页可见 & 技能按钮=30(28可用+2置灰)', await evalJS(`document.querySelectorAll('.skillbtn').length === 30`));
  check('多人专用技能置灰(≥2 disabled)', await evalJS(`document.querySelectorAll('.skillbtn:disabled').length >= 2`));
  check('双方 HP 显示 3', await evalJS(`[...document.querySelectorAll('.side .statbar .stat')].some(s=>s.textContent.includes('HP')&&s.textContent.includes('3'))`));

  // 打 4 个回合（稳健招，避免提前终局）
  const moves = ['ジ', '防御', 'ジ', '防御'];
  for (const mv of moves) {
    const okClick = await evalJS(`(()=>{const b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent===${JSON.stringify(mv)} && !x.disabled); if(!b) return false; b.click(); return true;})()`);
    check('点击出招:' + mv, okClick === true);
    await sleep(650);
  }
  check('日志有第 4 回合', await evalJS(`document.getElementById('logbox').textContent.includes('第 4 回合')`));
  check('界面无 over 覆盖层', await evalJS(`document.getElementById('overlay-root').classList.contains('hidden')`));
  await shot(join(tmpdir(), 'screenshot-battle.png'));
  console.log('screenshot-battle saved');

  // --- 训练场：远程 Node 服务流程 ---
  await evalJS(`document.getElementById('tab-train').click()`);
  await sleep(300);
  check('远程训练UI存在', await evalJS(`!!document.getElementById('tr-port') && !!document.getElementById('btn-train') && !!document.getElementById('btn-remote') && !!document.getElementById('tr-remote-gens')`));
  // 无服务时点击「开始训练」：应优雅提示"服务未启动/自动连接"，不抛 JS 错误
  await evalJS(`document.getElementById('tr-port').value=8799; document.getElementById('tr-remote-gens').value=3; document.getElementById('btn-train').click()`);
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
   *   \u21d2 \u5fc5\u987b\u9010\u8840\u91cf\u5224\uff0c\u5e76\u4e14**3~5 \u4eba\u90a3 9 \u683c\u8981\u5f53\u6b63\u5bf9\u7167**\uff08\u5426\u5219\u8fd9\u6761\u5224\u636e\u5728"\u6c38\u8fdc\u8bf4\u591a\u4eba\u6a21\u5f0f"\u7684\u574f\u5b9e\u73b0\u4e0a\u4e5f\u7eff\uff09\u3002 */
  await evalJS(`document.getElementById('tab-battle').click()`);
  await sleep(250);
  const sweep = await evalJS(`(function(){
    const R = window.EpirusRules, U = window.EpirusUI;
    const pl = document.getElementById('sel-players'), hpSel = document.getElementById('sel-hp');
    if (!pl || !hpSel || !U || !U.B) return { fatal: 'missing #sel-players / #sel-hp / EpirusUI' };
    const names = R.MULTI_ONLY.map(function (k) { return R.byKey[k].name; });
    const rows = [];
    for (const p of [2, 3, 4, 5]) for (const h of [3, 4, 5]) {
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
    check('12 \u79cd\uff08\u4eba\u6570 \u00d7 \u8840\u91cf\uff09\u7ec4\u5408\u5168\u90e8\u5efa\u5f97\u51fa\u5c40', rows.length === 12);
    check('\u6bcf\u683c\u7684\u4eba\u6570\u771f\u843d\u5230\u5ea7\u4f4d\u6570', rows.every(r => r.n === r.p));
    check('\u6bcf\u683c\u7684\u8840\u91cf\u771f\u843d\u5230 mode.hp \u4e0e\u6bcf\u4e2a\u5ea7\u4f4d\u7684\u521d\u59cb\u8840', rows.every(r => r.modeHp === r.h && r.initHp === new Array(r.p).fill(r.h).join('/')));
    const seen = {};
    rows.forEach(r => { seen[r.modeKey] = 1; });
    check('\uff08\u4eba\u6570 \u00d7 \u8840\u91cf\uff09\u6620\u5c04\u7684\u50cf\u6070\u597d\u76d6\u4f4f MODES \u5168\u90e8 key\uff08\u65e0\u5e7d\u7075\u3001\u65e0\u6ca1\u5165\u53e3\u7684\u6a21\u5f0f\uff09',
      sweep.modeKeys.every(k => seen[k]) && Object.keys(seen).length === sweep.modeKeys.length);
    check('2 \u4eba\u5c40\uff1a\u4e09\u5f20\u591a\u4eba\u4e13\u7528\u5361\u5168\u90e8\u6807\u6ce8\u4e3a\u300c\u591a\u4eba\u6a21\u5f0f\u300d\uff08\u7528\u6237\u70b9\u540d\u7684\u56de\u5f52\uff0c\u9010\u8840\u91cf\u5224\uff09',
      rows.filter(r => r.p === 2).every(r => r.cardCt === sweep.blockedText));
    check('\u6b63\u5bf9\u7167\uff1a3~5 \u4eba\u5c40\u90a3\u4e09\u5f20\u4e0d\u8bb8\u88ab\u5f53\u300c\u591a\u4eba\u4e13\u7528\u300d\u6321\u6389',
      rows.filter(r => r.p > 2).every(r => r.cardCt !== sweep.blockedText));
    console.log('  sweep 4 \u8840\u683c =', JSON.stringify(rows.filter(r => r.h === 4).map(r => r.p + '\u4eba\u2192' + r.modeKey + '(hp' + r.modeHp + ')')));
    console.log('  sweep 2 \u4eba\u683c =', JSON.stringify(rows.filter(r => r.p === 2).map(r => r.h + '\u8840\u2192' + r.modeKey + ' \u5361=' + r.cardCt)));
    await shot(join(tmpdir(), 'screenshot-multi4.png'));
  }
  await shot(join(tmpdir(), 'screenshot-long.png'));
  console.log('screenshot-long saved');

  /* --- v1.6.6 难度阶梯（用户指令 2「重新研究脚本难度…冠军作为底层但探索概率很高」）：
   * 判的是**下拉里点得到的东西，页面真的换得动**，不是表里写了什么（静态那半在 D227）。
   * 三件事只有真浏览器能证：① 每个档 id 都能选中且 `B.diff` 跟着变；② 换档时 `aiInfo()` 报的
   *   champ/style/兜底 身份与表一致（"档是假的"= 选了它却走了别的路）；
   *   ③ **人数=2 与人数=5 的档位列表一模一样**（阶梯不许按人数被裁短 —— 这正是"把 2 人并进多人"那一步的行为定义），
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
    check('冠军档报"是冠军"、风格档报"不是冠军"，且都不许落到兜底格（兜底=包没解开的信号）',
      lad.rows.every(r => r.fallback === false && r.champ === (r.kind === 'champ') && r.tier === r.id));
    check('档位列表不随人数被裁短（2 人 = 5 人，这就是"2 人并进同一条阶梯"的行为定义）',
      JSON.stringify(lad.at2.list) === JSON.stringify(lad.at5.list));
    check('表里每一档都在下拉里（少一档 = 页面把表裁了）',
      lad.tierIds.every(id => lad.at5.list.indexOf(id) >= 0));
    check('默认档在册且是 lv:regular（改默认档 = 改所有老用户的手感，属产品裁定）',
      lad.def === 'lv:regular' && lad.at5.list.indexOf(lad.def) >= 0);
    check('包随人数换：2 人那一格 aiInfo 报 2P、5 人那一格报 3P（§E286 的换包裁定在页面上看得见）',
      lad.at2.pack2 === '2P' && lad.at5.pack2 === '3P');
    /* 第一版这里真红过：去重比的是映射后的 `{v,t}` 列表（`.style` 恒 undefined）⇒
     *   「极限 · 读招」和「风格 · 读招反制」**同时**在册，玩家点是同一个脚本、以为选了两档。 */
    check('下拉里没有"同一个脚本占两格"（被阶梯认领的风格不许再以"风格"重复出现）',
      new Set(lad.at5.list).size === lad.at5.list.length &&
      lad.at5.list.length === lad.tierIds.length + lad.styleN - lad.claimed);
    console.log('  ladder rows =', JSON.stringify(lad.rows.map(r => r.id + ':' + (r.champ ? 'champ' : 'style') + ':' + r.src2)));
    console.log('  ladder 2人 =', JSON.stringify(lad.at2), ' 5人 =', JSON.stringify(lad.at5));
    await shot(join(tmpdir(), 'screenshot-ladder.png'));
  }

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
