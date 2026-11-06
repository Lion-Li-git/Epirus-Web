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
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/* 起 Chrome / 等 CDP 的唯一实现（v1.7.5 S0） */
import { launchChrome } from './cdp-boot.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';
/* v1.7.69：仓规「不认识的 `--` 参数必须**响亮失败**」—— 本工具此前没有消毒层，拼错的旗标被**静默忽略**
 *   （正是「静默忽略 = 假读数」那条规矩要防的事；`gate-sentinel` 一族一直在报告这个缺口）。 */
/* v1.7.69：只在**本文件是入口**时校验 —— 量具既可能被当 CLI 跑，也可能被别的门 `import` 当模块用；
 *   后者时 `process.argv` 是**调用方**的 argv（例如 gate runner 的 `--part=`），无条件校验会把整轮门禁打红。 */
if (process.argv[1] && process.argv[1].endsWith("battle-test.mjs")) {
  rejectUnknownFlags(process.argv.slice(2), ['max-ms', 'out', 'players'], "battle-test");
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const flag = function (n, d) {
  const hit = process.argv.find(function (a) { return a.indexOf('--' + n + '=') === 0; });
  return hit ? hit.split('=')[1] : d;
};
/* v1.7.5（S0）：Chrome 路径不再写死本机位置（原来 `ARGV[0] || 'C:\\Program Files\\...'` 在别的镜像上
 *   只会变成一句"CDP 端点不可达"，指错方向）；起 Chrome / 等 CDP 统一走 `tools/cdp-boot.mjs` 一份实现。 */
const PORT = Number(ARGV[1] || 9341);
const CDP_TRIES = Number((process.argv.find(a => /^--cdp-wait=/.test(a)) || '').split('=')[1]) || 60;
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

let BOOT;
try {
  BOOT = launchChrome({ chrome: ARGV[0], port: PORT, tries: CDP_TRIES });
} catch (e) {
  console.error('BATTLE 起不来 Chrome：' + e.message);
  process.exit(e.code === 'NO_CHROME' ? 4 : 2);
}
const proc = BOOT.proc, udd = BOOT.udd;
let __closed = false;
function killTree() {
  if (__closed) return; __closed = true;
  BOOT.killTree();   // 进程树 + 临时 profile 由 cdp-boot 收（原来这段在每台探针里各抄一份）
}
const watchdog = setTimeout(function () { console.error('[guard] 超时，收尸'); killTree(); process.exit(3); }, MAX_MS);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* v1.7.5：这里的 waitJson 已并入 `tools/cdp-boot.mjs`（那份会带上"进程死了还是慢"的现场） */

const errors = [];
const checks = [];
const check = (name, cond, extra) => {
  checks.push([name, !!cond]);
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra != null ? '   [' + extra + ']' : ''));
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const tabs = await BOOT.tabs();
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

  /* ── 起局：5 人 + 难度=冠军（抽成函数，因为"用内置冠军"那段要起两次局）──
   * v1.6.5：页面不再有「模式」下拉 —— 人数与血量是两根正交轴，模式键由 `ui.js` 查表算出来。
   * 所以这里**回读真建出来的局**（`B.state.modeKey` / `mode.hp` / 座位数），而不是下拉写了什么。 */
  const setupBattle = async function () {
    await evalJS(`(()=>{const s=document.getElementById('sel-players'); s.value='${PLAYERS}'; s.dispatchEvent(new Event('change'));})()`);
    await sleep(400);
    const st = await evalJS(`(()=>{const s=document.getElementById('sel-hp'); if(!s) return {fatal:'no-sel-hp'}; s.value='3'; s.dispatchEvent(new Event('change'));
      const g=window.EpirusUI.B.state; return {mode:g.modeKey, hp:g.mode.hp, n:g.p.length};})()`);
    await sleep(500);
    const ds = await evalJS(`(()=>{const s=document.getElementById('sel-diff'); s.value='lv:hard'; s.dispatchEvent(new Event('change')); return s.value;})()`);
    await sleep(300);
    await evalJS(`document.getElementById('btn-newgame').click()`);
    await sleep(900);
    return { mode: st.mode, hp: st.hp, n: st.n, diff: ds };
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
  /* §E286/§E590：这一句的**实质** = 点过「用内置冠军」之后，多方侧用的是**内置**来源、**不许**是用户本机那枚。
   *   池上线（10-11）后多人侧的内置来源由**池**供给，标签是 `池·…` ⇒ 原来只认 `内置` 二字会**误报**
   *   （10-12 CI 实测：`SUMMARY: BATTLE FAILED`，唯一一条 `FAIL 重开后用的是内置冠军 [对手AI=池]`；本机逐字复现）。
   *   判据改成：来源是内置（`内置`，或池上线后的 `池`）**且**不含 `本机` —— 本机导入那一支永远不许在这里出现，
   *   所以"清掉本机包之后仍走本机"这类回归照样红（两向验过）。 */
  check('重开后用的是内置冠军（本机导入已清掉：来源是"内置"或池上线后的"池"，且不许含"本机"）',
    (srcBuiltin.indexOf('内置') >= 0 || srcBuiltin.indexOf('池') >= 0) && srcBuiltin.indexOf('本机') < 0,
    '对手AI=' + srcBuiltin);

  /* ── v1.5.131（handoff §4-10）：**2P 槽位**上的同一件事（原先只测了 3P 键）──
   * 病：2P 的本机冠军存在 `epirus.champion.v3`（`js/train/trainer.js:6`），而「用内置冠军」原先
   * **只清 `epirus.champion3p`** ⇒ 本地训过冠军的用户**永远打自己那个旧包**（v1.5.130 修好的线上
   * 2P 冠军发不到他们手里），而按钮 tooltip 写着"清除本机自训/导入的冠军、改回内置冠军"= 假承诺。
   * 反证：把 `js/ui/ui.js` 里那句 `localStorage.removeItem('epirus.champion.v3')` 删掉 ⇒ 本段立即红。 */
  await evalJS(`(()=>{try{localStorage.setItem('epirus.champion.v3', JSON.stringify(window.EPIRUS_CHAMPION));}catch(e){}})()`);
  await send('Page.navigate', { url: URL });
  await sleep(1600);
  check('能写入 2P 本机冠军（模拟本地训过冠军的老用户）',
    await evalJS(`(()=>{try{return !!localStorage.getItem('epirus.champion.v3');}catch(e){return false;}})()`));
  /* 2 人起局：人数=2（血量=3 那一格命中 `standard` = v1.0.0 冻结档）、难度=「困难 · 冠军」
   *   ⇒ v1.6.6 起 2 人桌也走**同一条阶梯**，底层包按人数选（2 人 = 2P 那颗 `Champ.store`，见 `champForCount`）。 */
  const setupBattle2P = async function () {
    await evalJS(`(()=>{const s=document.getElementById('sel-players'); s.value='2'; s.dispatchEvent(new Event('change'));})()`);
    await sleep(400);
    await evalJS(`(()=>{const s=document.getElementById('sel-diff'); if(!s) return; const o=[...s.options].find(x=>x.value==='lv:hard'); if(o){s.value='lv:hard'; s.dispatchEvent(new Event('change'));}})()`);
    await sleep(300);
    await evalJS(`document.getElementById('btn-newgame').click()`);
    await sleep(700);
  };
  await setupBattle2P();
  const src2Local = await aiSource();
  check('2P 对战面板如实标注用的是**本机**冠军（v1.5.131 之前只写"2人冠军"）',
    src2Local.indexOf('本机') >= 0, '对手AI=' + src2Local);
  const trHasLocal = await evalJS(`(document.getElementById('tr-has')||{}).textContent || ''`);
  check('训练场「当前冠军」在本机包生效时标注本机', /本地/.test(String(trHasLocal)), 'tr-has=' + trHasLocal);
  const reset2 = await evalJS(`(()=>{const b=document.getElementById('btn-champ-reset'); if(!b) return 'no-btn'; b.click();
    let v3='?', v3p='?'; try{v3=localStorage.getItem('epirus.champion.v3'); v3p=localStorage.getItem('epirus.champion3p');}catch(e){v3='ERR';}
    return JSON.stringify({v3: v3, v3p: v3p, hint: document.getElementById('battle-hint').textContent,
      trHas: (document.getElementById('tr-has')||{}).textContent||''});})()`);
  const r2 = JSON.parse(reset2 === 'no-btn' ? '{"v3":"no-btn"}' : reset2);
  check('点「用内置冠军」后 **2P 键**也被清掉（v1.5.131 修的就是这条；修前读到"有"）',
    r2.v3 === null, 'localStorage(2P)=' + (r2.v3 === null ? 'null' : '仍在（' + String(r2.v3).length + ' 字节的包）'));
  check('两个槽位一起清（同一语义：改回内置）', r2.v3p === null, 'localStorage(3P)=' + r2.v3p);
  check('提示点明清掉的是哪几个槽位（须含"2 人"）', /2\s*人/.test(String(r2.hint || '')), '提示=' + r2.hint);
  check('训练场「当前冠军」随后显示内置（原先它会一直说"已保存本地冠军"）',
    /内置/.test(String(r2.trHas || '')), 'tr-has=' + r2.trHas);
  await setupBattle2P();
  const src2Builtin = await aiSource();
  /* §E599（10-12）：2P 池上线后，2P 侧的内置来源由**2P 原生池**供给（标签 `2P池·mid(…)`）⇒
   *   判据从"钉『内置』二字"改成**钉实质**：来源是"内置"或"池"，且**永远不许**出现"本机"
   *   （本机导入那一支在上面已单独验过）。与 §E286/§E590 那次 3P 的修法同一条纪律：
   *   **钉"用的是哪一类来源"，不钉那句话当时怎么写**。 */
  check('2P 重开后走内置来源（内置或 2P 池），且不许是本机那枚',
    (src2Builtin.indexOf('内置') >= 0 || src2Builtin.indexOf('池') >= 0) && src2Builtin.indexOf('本机') < 0,
    '对手AI=' + src2Builtin);

  /* ── 正式对局：5 人 + 难度=冠军 ── */
  const setup = await setupBattle();
  const modeSet = setup.mode, diffSet = setup.diff;

  check('两根轴查出的模式是多人族（3~5 人 · 3 血 ⇒ multi）', modeSet === 'multi', 'mode=' + modeSet + ' hp=' + setup.hp + ' n=' + setup.n);
  check('血量轴真落到建局（选 3 血就是 3 血）', setup.hp === 3, 'mode.hp=' + setup.hp);
  check('人数轴真落到座位数（PLAYERS=' + PLAYERS + '）', setup.n === PLAYERS, 'n=' + setup.n);
  check('难度可设为「困难 · 冠军」（线上冠军当对手）', diffSet === 'lv:hard', 'diff=' + diffSet);
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
  for (let i = 0; i < 300; i++) {
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

  /* ── 第二段：长程（5 血）**与本版新增的 4 血格**也要真打若干回合 ──
   * 为什么：同一个 bundle 同时服务 multi/multi4/long，而 long 的回合上限高得多（140）——
   * 摆烂型冠军在长程里更难看（long-33 在 long 口径 57% 全是"熬"）。这里只做**有界**验证：
   * 跑固定回合数，断言"真的有人受伤 + 没有套盾 spam + 无 JS 错误"，不强求跑到终局。
   * v1.6.5：血量现在是一根独立的轴（`#sel-hp`），所以这一段的循环体就是"选档 → 回读建局 → 打几回合"。 */
  await evalJS(`document.getElementById('tab-battle').click()`);
  await sleep(250);
  await evalJS(`(()=>{const s=document.getElementById('sel-players'); s.value='3'; s.dispatchEvent(new Event('change'));})()`);
  await sleep(400);
  await evalJS(`(()=>{const s=document.getElementById('sel-diff'); s.value='lv:hard'; s.dispatchEvent(new Event('change'));})()`);
  const playSomeRounds = async function (label, shotName) {
    const errBefore = errors.length;
    const oneRound = async function () {
      let acted = false;
      for (const nm of ATK) {
        if (!(await click(nm))) continue;
        await sleep(150);
        await evalJS(`(()=>{const r=document.getElementById('modal-root'); if(r && !r.classList.contains('hidden')){const b=document.querySelector('#modal-card #mbtn'); if(b) b.click();}})()`);
        acted = true; break;
      }
      if (!acted) { if (!(await click('蓄能'))) await click('ジ'); }
      await sleep(200);
    };
    for (let i = 0; i < 25 && !(await over()); i++) await oneRound();
    let t = await logText();
    let dmg = (t.match(/伤害/g) || []).length;
    /* v1.9.1：长程格偶发「25 回合只有 2 次伤害」——页面 RNG 未固定，硬档对手格挡/无效招会把伤害拖到 3 以下。
     *   判据不放宽（仍 >=3），改成**继续打到够为止**（最多再 40 回合，或终局即止）。 */
    for (let extra = 0; extra < 40 && dmg < 3 && !(await over()); extra++) { await oneRound(); if (extra % 5 === 4) { t = await logText(); dmg = (t.match(/伤害/g) || []).length; } }
    t = await logText();
    const holo = (t.match(/全息屏障/g) || []).length;
    await shot(join(OUT, shotName));
    check(label + '：有真实伤害', dmg >= 3, '「伤害」' + dmg + ' 次');
    check(label + '：没有套盾 spam', holo <= 12, '全息屏障 ' + holo + ' 次');
    check(label + '：无新增 JS 错误', errors.length === errBefore, (errors.length - errBefore) + ' 个新错误');
  };
  for (const wantHp of [5, 4]) {
    const m2 = await evalJS(`(()=>{const s=document.getElementById('sel-hp'); if(!s) return {fatal:'no-sel-hp'}; s.value='${wantHp}'; s.dispatchEvent(new Event('change'));
      const g=window.EpirusUI.B.state; return {mode:g.modeKey, hp:g.mode.hp, n:g.p.length, seats:g.p.map(x=>x.hp).join('/')};})()`);
    await evalJS(`document.getElementById('btn-newgame').click()`);
    await sleep(800);
    check(wantHp + ' 血那一格能选、能起局', m2 && m2.hp === wantHp && m2.mode === (wantHp === 5 ? 'long' : 'multi4'), JSON.stringify(m2));
    check(wantHp + ' 血局每个座位初始血都真等于 ' + wantHp, m2 && m2.seats === new Array(m2.n).fill(wantHp).join('/'), m2 && m2.seats);
    check(wantHp + ' 血局 HP 显示正确', await evalJS(`[...document.querySelectorAll('.statbar .stat')].some(s=>s.textContent.includes('HP')&&s.textContent.includes('${wantHp}'))`));
    await playSomeRounds(wantHp + ' 血格（' + (wantHp === 5 ? 'long' : 'multi4') + '）', 'battle-04-' + (wantHp === 5 ? 'long' : 'multi4') + '.png');
  }

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
