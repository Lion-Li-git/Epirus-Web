/* Epirus 浏览器对战测试（v1.5.8）
 *
 * 为什么要有它：`smoke.mjs` 只验证"页面能开、按钮能点"，而**对战质量**（冠军在真浏览器里
 * 到底怎么打、UI 有没有正确跟着走、跑到终局会不会出 JS 错误）一直没人自动看过。
 * 千问体检与我的实验都在 **Node 沙箱**里量游戏；页面是另一条链路（UI 事件、渲染、localStorage
 * 缓存、`?v=` 戳），必须也真的跑一遍。
 *
 * 做法（不改页面代码）：
 *   1. 多人 5 人 + 难度选「冠军（最强）」⇒ AI 座用的就是 `js/bundled-champion-3p.js` 里的线上冠军；
 *   2. P0（人类座）一直出ジ"摆烂"，被淘汰后页面会走 `autoRunRest()`（观战）把剩下的 AI 自己打完；
 *   3. 全程收集 JS 错误、截图、日志文本，并对 UI 做不变量断言。
 *
 * 断言里最有价值的一条：**日志里必须出现「聚能环」**。
 * 线上冠军 long-33 的出手分布是 聚能环 42% / ジ 30% / 激光剑 13%（`eval-5p` 实测），
 * 而旧冠军（v1.3.58）根本不出环 ⇒ 这条能证明**页面真的在用新换上去的那个包**，
 * 而不是被 localStorage 或 `?v=` 缓存留在旧冠军上（那正是换冠军最容易静默失败的地方）。
 *
 * 用法：node tools/battle-test.mjs [chrome路径] [端口] [--players=5] [--max-ms=180000] [--out=docs/artifacts/battle-out]
 *
 * ⚠️ v1.5.18（第三方复核 §5-9）：`--out` 默认值从 `results` 改成 `docs/artifacts/battle-out`。
 * 原因是原默认会覆写 **git 跟踪**的 `results/battle-0{1,2,3,4}.png` ⇒ 一次"只读复核"照抄
 * 验收单里的命令就会把工作区弄脏（复核者实测踩到，还得 `git checkout --` 还原）。
 * 新目录已进 `.gitignore`。要看历史截图仍在 `results/`（它们不再被覆盖）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const flag = function (n, d) {
  const hit = process.argv.find(function (a) { return a.indexOf('--' + n + '=') === 0; });
  return hit ? hit.split('=')[1] : d;
};
const CHROME = ARGV[0] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(ARGV[1] || 9341);
const URL = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');
const PLAYERS = Number(flag('players', 5));
/* v1.5.35（第三方复核 §4-3）：本门的看门狗是**墙钟**，而长局对峙（60 回合上限）是分布的尾部
 * ⇒ 会概率性在"还没跑到终局"时被判超时（复核实测 5 次里 1 次 FAILED）。
 * 这里先把窗口放宽（180s → 300s）作为**止血**；
 * ⚠️ 真正的修法是**按状态等待**：在出招循环里轮询 `window.EpirusUI.B.state.over`，
 * 到终局（或回合上限）立即收尾，而不是靠固定墙钟 —— 见 METHODOLOGY「按状态等待，不按墙钟」。 */
const MAX_MS = Number(flag('max-ms', 300000));
/* v1.5.18：默认落点改到**未跟踪**目录（原先写 results/，会覆写 git 跟踪的历史截图）。 */
const OUT = join(ROOT, flag('out', 'docs/artifacts/battle-out'));

const udd = mkdtempSync(join(tmpdir(), 'epirus-battle-'));
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'about:blank'
], { stdio: 'ignore' });
let __closed = false;
function killTree() {
  if (__closed) return; __closed = true;
  try {
    if (process.platform === 'win32' && proc && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    else if (proc) proc.kill('SIGKILL');
  } catch (e) { /* ignore */ }
  try { rmSync(udd, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}
const watchdog = setTimeout(function () { console.error('[guard] 超时，收尸'); killTree(); process.exit(3); }, MAX_MS);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('CDP 端点不可达: ' + url);
}

const errors = [];
const checks = [];
const check = (name, cond, extra) => {
  checks.push([name, !!cond]);
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra != null ? '   [' + extra + ']' : ''));
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const tabs = await waitJson('http://127.0.0.1:' + PORT + '/json/list');
  const page = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + m.params.args.map((a) => a.value || a.description || '').join(' '));
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      const t = m.params.entry.text || '';
      if (t.indexOf('ERR_CONNECTION_REFUSED') < 0) errors.push('LOG: ' + t);
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval 失败: ' + JSON.stringify(r.result.exceptionDetails.exception?.description));
    return r.result?.result?.value;
  };
  const shot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    console.log('  截图 → ' + file);
  };
  const logText = () => evalJS(`document.getElementById('logbox').textContent`);
  const over = () => evalJS(`!document.getElementById('overlay-root').classList.contains('hidden')`);
  const click = (name) => evalJS(`(()=>{const b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent===${JSON.stringify(name)} && !x.disabled); if(!b) return false; b.click(); return true;})()`);

  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1600);

  /* ── 关键：先清掉 localStorage 里的冠军包再刷新 ──
   * 页面 `loadMultiChamp()` **优先读 `localStorage['epirus.champion3p']`**，没有才回退内置包
   * ⇒ 不清的话测的是"这台机器上次训练/导入留下的冠军"，而不是真正上线的那一个。
   * （v1.5.8 实测踩到：不清 localStorage 时跑出来的是旧 v1.3.58 的行为 —— 每局出 28 次全息屏障、
   * 残局互套盾打成 0 伤害僵局 —— 而当时 bundle 里装的其实是新冠军。） */
  const lsBefore = await evalJS(`(()=>{try{return localStorage.getItem('epirus.champion3p')?'有':'无'}catch(e){return 'ERR'}})()`);
  await evalJS(`try{localStorage.removeItem('epirus.champion3p');}catch(e){}`);
  await send('Page.navigate', { url: URL });
  await sleep(1600);
  const lsAfter = await evalJS(`(()=>{try{return localStorage.getItem('epirus.champion3p')?'有':'无'}catch(e){return 'ERR'}})()`);
  check('已清掉 localStorage 里的旧冠军包（否则测的不是上线包）', lsAfter === '无', '清前=' + lsBefore + ' 清后=' + lsAfter);

  /* ── 起局：5 人 + 难度=冠军（抽成函数，因为"用内置冠军"那段要起两次局）── */
  const setupBattle = async function () {
    await evalJS(`(()=>{const s=document.getElementById('sel-players'); s.value='${PLAYERS}'; s.dispatchEvent(new Event('change'));})()`);
    await sleep(400);
    const ms = await evalJS(`(()=>{const s=document.getElementById('sel-mode'); if(!s) return 'no-sel'; const o=[...s.options].find(x=>x.value==='multi'||x.value==='long'); if(!o) return 'no-opt'; s.value=o.value; s.dispatchEvent(new Event('change')); return o.value;})()`);
    await sleep(500);
    const ds = await evalJS(`(()=>{const s=document.getElementById('sel-diff'); s.value='champ'; s.dispatchEvent(new Event('change')); return s.value;})()`);
    await sleep(300);
    await evalJS(`document.getElementById('btn-newgame').click()`);
    await sleep(900);
    return { mode: ms, diff: ds };
  };
  const aiSource = async function () {
    const t = await logText();
    const m = /对手AI=([^·]*)/.exec(t);
    return m ? m[1].trim() : '';
  };

  /* ── 「用内置冠军」按钮的端到端验证（v1.5.10）──
   * 页面原本优先用 localStorage 里的冠军 ⇒ 换内置包对"曾自训/导入过"的用户无效（REVIEW §11.1）。
   * 这里模拟这种用户：① 把内置包原样塞进 localStorage；② 重载 ⇒ 日志「对手AI=」应显示"本机自训/导入"；
   * ③ 点「用内置冠军」⇒ localStorage 被清空、提示改回内置；④ 重开一局 ⇒ 显示"内置"。 */
  await evalJS(`(()=>{try{localStorage.setItem('epirus.champion3p', JSON.stringify(window.EPIRUS_CHAMPION_3P));}catch(e){}})()`);
  await send('Page.navigate', { url: URL });
  await sleep(1600);
  const planted = await evalJS(`(()=>{try{return !!localStorage.getItem('epirus.champion3p');}catch(e){return false;}})()`);
  check('能写入本机冠军（模拟老用户）', planted);
  await setupBattle();
  const srcLocal = await aiSource();
  check('页面确实优先用本机冠军（对手AI 标注"本机自训/导入"）', srcLocal.indexOf('本机') >= 0, '对手AI=' + srcLocal);
  const resetRes = await evalJS(`(()=>{const b=document.getElementById('btn-champ-reset'); if(!b) return 'no-btn'; b.click(); let ls=null; try{ls=localStorage.getItem('epirus.champion3p');}catch(e){ls='ERR';} return JSON.stringify({ls: ls, hint: document.getElementById('battle-hint').textContent});})()`);
  const rr = JSON.parse(resetRes === 'no-btn' ? '{"ls":"no-btn","hint":""}' : resetRes);
  check('「用内置冠军」按钮存在且可点', resetRes !== 'no-btn');
  check('点完按钮后 localStorage 里的本机冠军被清掉', rr.ls === null, 'localStorage=' + rr.ls);
  check('提示告知已改回内置冠军', /内置/.test(rr.hint || ''), '提示=' + rr.hint);
  await setupBattle();
  const srcBuiltin = await aiSource();
  check('重开后用的是内置冠军', srcBuiltin.indexOf('内置') >= 0, '对手AI=' + srcBuiltin);

  /* ── 正式对局：5 人 + 难度=冠军 ── */
  const setup = await setupBattle();
  const modeSet = setup.mode, diffSet = setup.diff;

  check('模式可设为多人/long', modeSet === 'multi' || modeSet === 'long', 'mode=' + modeSet);
  check('难度可设为 champ（线上冠军当对手）', diffSet === 'champ', 'diff=' + diffSet);
  check('冠军包已加载（页面侧 EPIRUS_CHAMPION_3P 存在）', await evalJS('typeof window.EPIRUS_CHAMPION_3P !== "undefined"'));
  /* v1.5.11：终局收缩参数入口（起扣回合 / 每回合扣血）—— 存在、可改、会持久化 */
  const sd = await evalJS(`(()=>{const a=document.getElementById('inp-sd'), b=document.getElementById('inp-sd-dmg'); return {a:!!a, b:!!b, v:a?a.value:null, d:b?b.value:null};})()`);
  check('终局收缩参数入口存在', sd.a && sd.b, '起扣=' + sd.v + ' 每回合=' + sd.d + ' 血');
  await evalJS(`(()=>{const a=document.getElementById('inp-sd'); a.value='120'; a.dispatchEvent(new Event('change'));})()`);
  const sdSaved = await evalJS(`(()=>{try{return (JSON.parse(localStorage.getItem('epirus.sudden')||'{}')||{}).suddenDeath;}catch(e){return 'ERR';}})()`);
  check('改参数会持久化到 localStorage', sdSaved === 120, '存的值=' + sdSaved);
  await evalJS(`(()=>{const a=document.getElementById('inp-sd'); a.value='100'; a.dispatchEvent(new Event('change'));})()`);
  await shot(join(OUT, 'battle-01-start.png'));

  /* ── P0 主动出招（**不再摆烂**）──
   * v1.5.8 教训：第一版让 P0 一直出ジ"摆烂"，结果人为造出"没人进攻"的退化局面，
   * 4 个冠军座就一起摆架势（引擎复现：伤害 3.0/局、10/10 平局、220 架势/局）——
   * 而 P0 随便打个什么（balanced/aggro 脚本）冠军立刻正常开打（13~14 伤害/局、0 平局）。
   * ⇒ 测试必须让人类座**真的进攻**，否则量的是退化均衡而不是对战质量。 */
  const ATK = ['枪', '激光剑', '坦克', '狙击枪', '电磁炮', '真正的落雷', '摄魂指法'];
  let rounds = 0, idle = 0;
  for (let i = 0; i < 80 && !(await over()); i++) {
    let acted = false;
    for (const nm of ATK) {
      if (!(await click(nm))) continue;
      await sleep(170);
      /* 攻击技指向别人 ⇒ 多人局会弹目标选择框（#modal-card #mbtn）；自指向技能直接落子 */
      await evalJS(`(()=>{const r=document.getElementById('modal-root'); if(r && !r.classList.contains('hidden')){const b=document.querySelector('#modal-card #mbtn'); if(b) b.click();}})()`);
      acted = true; break;
    }
    if (!acted) { if (!(await click('蓄能'))) await click('ジ'); idle++; }
    rounds++;
    await sleep(230);
  }
  const txt0 = await logText();
  const seatNames = (function () { const s = new Set(); const re = /玩家(\d)/g; let m; while ((m = re.exec(txt0))) s.add(m[1]); return s.size; })();
  check('日志里出现 ' + PLAYERS + ' 名玩家', seatNames >= PLAYERS, '出现 ' + seatNames + ' 名');
  await shot(join(OUT, 'battle-02-mid.png'));
  check('P0 能持续出招（真打，不是摆烂）', rounds > 0, '出招 ' + rounds + ' 回合，其中无攻击技可打 ' + idle + ' 回合');

  /* ── 等终局 ── */
  let ended = false;
  for (let i = 0; i < 120; i++) {
    if (await over()) { ended = true; break; }
    await sleep(400);
  }
  const txt = await logText();
  await shot(join(OUT, 'battle-03-end.png'));

  check('对局跑到终局（出现结果覆盖层）', ended);
  /* ⚠️ v1.5.8 加的三条"打架活跃度"断言（原来的考卷口径看不出"摆烂"）：
   * long-33 自对局 20/20 局零伤害、60 回合平局，但它在脚本对手考卷上还能拿 41~45% ⇒
   * 只看考卷分会把"熬到哨声"当成强度。这里直接量真对局的伤害与盾 spam。 */
  const dmgHits = (txt.match(/伤害/g) || []).length;
  const holoHits = (txt.match(/全息屏障/g) || []).length;
  const ringHits = (txt.match(/聚能环/g) || []).length;
  check('对局里有真实伤害（不是 0 伤害僵局）', dmgHits >= 5, '日志出现「伤害」' + dmgHits + ' 次');
  check('没有"互套盾"僵局（全息屏障施放不过量）', holoHits <= 12, '全息屏障出现 ' + holoHits + ' 次');
  console.log('  （参考）聚能环出现 ' + ringHits + ' 次；盾 ' + holoHits + ' 次；伤害 ' + dmgHits + ' 次');
  check('全程无 JS 错误', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : '0');

  /* ── 第二段：长程模式（5 血）也要过一遍 ──
   * 为什么：同一个 bundle 同时服务 multi 与 long，而 long 的回合上限高得多（140）——
   * 摆烂型冠军在长程里更难看（long-33 在 long 口径 57% 全是"熬"）。这里只做**有界**验证：
   * 跑固定回合数，断言"真的有人受伤 + 没有套盾 spam + 无 JS 错误"，不强求跑到终局。 */
  await evalJS(`document.getElementById('tab-battle').click()`);
  await sleep(250);
  await evalJS(`(()=>{const s=document.getElementById('sel-players'); s.value='3'; s.dispatchEvent(new Event('change'));})()`);
  await sleep(400);
  const m2 = await evalJS(`(()=>{const s=document.getElementById('sel-mode'); const o=[...s.options].find(x=>x.value==='long'); if(!o) return 'no-long'; s.value='long'; s.dispatchEvent(new Event('change')); return s.value;})()`);
  await sleep(400);
  await evalJS(`(()=>{const s=document.getElementById('sel-diff'); s.value='champ'; s.dispatchEvent(new Event('change'));})()`);
  await evalJS(`document.getElementById('btn-newgame').click()`);
  await sleep(800);
  check('长程模式可选并起局', m2 === 'long', 'mode=' + m2);
  check('长程局 HP=5', await evalJS(`[...document.querySelectorAll('.statbar .stat')].some(s=>s.textContent.includes('HP')&&s.textContent.includes('5'))`));
  const errBefore = errors.length;
  for (let i = 0; i < 25 && !(await over()); i++) {
    let acted = false;
    for (const nm of ATK) {
      if (!(await click(nm))) continue;
      await sleep(150);
      await evalJS(`(()=>{const r=document.getElementById('modal-root'); if(r && !r.classList.contains('hidden')){const b=document.querySelector('#modal-card #mbtn'); if(b) b.click();}})()`);
      acted = true; break;
    }
    if (!acted) { if (!(await click('蓄能'))) await click('ジ'); }
    await sleep(200);
  }
  const txtL = await logText();
  const dmgL = (txtL.match(/伤害/g) || []).length;
  const holoL = (txtL.match(/全息屏障/g) || []).length;
  await shot(join(OUT, 'battle-04-long.png'));
  check('长程局里有真实伤害', dmgL >= 3, '「伤害」' + dmgL + ' 次');
  check('长程局没有套盾 spam', holoL <= 12, '全息屏障 ' + holoL + ' 次');
  check('长程局无新增 JS 错误', errors.length === errBefore, errors.length - errBefore + ' 个新错误');

  console.log('\n=== 日志尾部（供人工核对）===');
  console.log(txt.slice(-1200));
  console.log('\nJS errors:', errors.length ? errors : '(none)');
  const ok = checks.every((c) => c[1]);
  console.log('SUMMARY:', ok ? 'BATTLE OK' : 'BATTLE FAILED');
  process.exitCode = ok ? 0 : 1;
}

main().catch((e) => { console.error('BATTLE ERROR:', e); process.exitCode = 2; })
  .finally(async () => {
    clearTimeout(watchdog);
    try { proc.kill(); } catch (e) { /* ignore */ }
    await Promise.race([new Promise((res) => proc.once('exit', res)), sleep(2500)]);
    killTree();
    process.exit(process.exitCode || 0);
  });
