/* §E667 取证器（真浏览器，不是沙箱）：导出的对局记录里那三行"本次的对手"到底写没写对。
 *
 * 要证的三件事（都是**改之前做不到**的）：
 *   ① 开局头部有 `对手=`，且**逐席**（池生效时 `玩家N=<成员id|脚本·名>`），席位与 `aiInfo().poolDraw.seats` 同序同值
 *      ⇒ 这条同时证明"回显与决策同源"：标签不是另抄一份派生。
 *   ② 中途换难度**不换局**（`#sel-diff` 那条 onchange 写明"对局中即时生效"）⇒ 头部要能看见换档后的逐席，
 *      而不是把两档拼的一局说成一档。
 *   ③ 非池档（风格档）时 `对手=` 落在 `aiInfo().source` 上，且**不许**同时印出重复的 `对手AI=` 行。
 *
 * 用法：node docs/research/archive/2026-10-20-export-opponents/export-opp-probe.mjs [--port=9351] [--chrome=<路径>]
 * 只读：不写盘、不改引擎状态（只在临时 profile 的 localStorage 里玩）。
 */
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from '../../../../tools/cdp-boot.mjs';
import { rejectUnknownFlags } from '../../../../tools/audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
rejectUnknownFlags(process.argv.slice(2), ['port', 'chrome', 'cdp-wait', 'save'], 'export-opp-probe');
const ARGV = process.argv.slice(2).filter(a => !/^--/.test(a));
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const PORT = Number(ARGV[0] || flag('port', 9351));
const URL = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');

const BOOT = launchChrome({ chrome: ARGV[1] || flag('chrome', undefined), port: PORT, tries: Number(flag('cdp-wait', 60)) });
const watchdog = setTimeout(() => { console.error('[guard] 超时，收尸'); BOOT.killTree(); process.exit(3); }, 180000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const checks = [];
const check = (name, cond, extra) => {
  checks.push([name, !!cond]);
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra != null ? '   [' + extra + ']' : ''));
};

async function main() {
  const tabs = await BOOT.tabs();
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  const errors = [];
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
  await send('Page.navigate', { url: URL });
  await sleep(2200);
  check('页面起来了且 EpirusUI 挂着 battleText()',
    await evalJS(`(()=>typeof window.EpirusUI?.battleText==='function')()`));

  const setSel = (id2, v) => evalJS(`(()=>{const s=document.getElementById('${id2}'); if(!s) return 'no-select'; s.value=${JSON.stringify(v)}; s.dispatchEvent(new Event('change')); return s.value;})()`);
  const click = name => evalJS(`(()=>{const b=[...document.querySelectorAll('.skillbtn')].find(x=>x.querySelector('.nm')?.textContent===${JSON.stringify(name)} && !x.disabled); if(!b) return false; b.click(); return true;})()`);
  const pickTarget = () => evalJS(`(()=>{const r=document.getElementById('modal-root'); if(r && !r.classList.contains('hidden')){const b=document.querySelector('#modal-card #mbtn'); if(b) b.click(); return 'clicked';} return 'none';})()`);
  const playRound = async () => {
    const before = await evalJS(`(()=>window.EpirusUI.B.transcript.length)()`);
    if (!(await click('蓄能')) && !(await click('ジ'))) return false;
    await sleep(250); await pickTarget();
    /* 按**状态**等，不按墙钟：transcript 多出一行 = 这一回合真的结算完（`pushTranscript` 在那条路上） */
    for (let g = 0; g < 60; g++) {
      await sleep(200);
      if (Number(await evalJS(`(()=>window.EpirusUI.B.transcript.length)()`)) > before) return true;
    }
    return false;
  };
  /* 头部 = 到第一条空行为止 */
  const head = () => evalJS(`(()=>{const t=window.EpirusUI.battleText(); return {head: t.slice(0, t.indexOf('\\n\\n')), rounds: window.EpirusUI.B.transcript.length};})()`);

  /* ── 档 1：五人桌（默认难度 = 池档，逐席标签该出现）── */
  await setSel('sel-players', '5'); await sleep(500);
  await evalJS(`document.getElementById('btn-newgame').click()`); await sleep(900);
  const diff1 = await evalJS(`(()=>window.EpirusUI.B.diff)()`);
  const drawn = await evalJS(`(()=>{const d=window.EpirusUI.aiInfo().poolDraw; if(!d) return 'NOPool';
    const st=(id)=>{const s=(window.EpirusBots.STYLES||[]).find(x=>x.id===id); return s?s.name:id;};
    return d.seats.map(s=>s.kind==='script'?('脚本·'+st(s.id)):s.id).join('|');})()`);
  await playRound(); await playRound(); await playRound();
  const h1 = await head();
  console.log('\n=== 档 1（5 人，难度=' + diff1 + '）导出的头部 ===\n' + h1.head + '\n--- transcript 行数=' + h1.rounds);
  const seatLine = (h1.head.match(/^对手=(.*)$/m) || [, ''])[1];
  check('① 头部有 对手= 这一行', /对手=/.test(h1.head));
  check('① 逐席：每个 AI 席位都以 "名字=" 出现一次', (() => {
    const names = ['玩家2', '玩家3', '玩家4', '玩家5'];
    return names.every(nm => seatLine.indexOf(nm + '=') >= 0);
  })(), seatLine);
  check('① 标签与实际决策同源（席位序列 = poolDraw.seats 的 id 序列）', (() => {
    if (drawn === 'NOPool') return true;                       /* 本机导入/池未生效时不判这条（档 3 会专门测） */
    const ids = drawn.split('|');
    return ids.every((x, i) => seatLine.indexOf(x) >= 0);
  })(), '池抽=' + drawn);

  /* ── 档 2：同一局中途换难度（换档不换局 ⇒ 必须留下"第 N 回合起改 …"）── */
  const opts = await evalJS(`(()=>[...document.getElementById('sel-diff').options].map(o=>o.value))()`);
  const other = opts.find(v => v !== diff1) || opts[1];
  await setSel('sel-diff', other); await sleep(400);
  await playRound(); await playRound();
  const h2 = await head();
  console.log('\n=== 中途换到 ' + other + ' 之后的头部 ===\n' + h2.head + '\n--- transcript 行数=' + h2.rounds);
  check('② 换档不换局：头部记了"中途换档="且带换档后的逐席', /中途换档=第 \d+ 回合起改 /.test(h2.head) && h2.head.lastIndexOf('中途换档=') < h2.head.length,
    (h2.head.match(/中途换档=(.*)$/m) || [, ''])[1]);
  check('② 换档之后仍在打（transcript 变长 ⇒ 头部描述的是这一局）', h2.rounds > h1.rounds, h1.rounds + '→' + h2.rounds);
  check('② 开局那格没被换档改写（对手= 仍是开局那一档）', seatLine && (h2.head.match(/^对手=(.*)$/m) || [, ''])[1] === seatLine);
  /* --save=<名字>：把这一局的**完整导出文本**落到本目录 ⇒ 拿现成的 log parser 吃一遍，证明新增行不砸既有解析
   * （`tools/parse-battle-log.mjs` 只认 `模式=` 与 `第 N 回合：`，`log-reading.mjs` 按行首分类） */
  if (flag('save', '')) {
    const full = await evalJS(`(()=>window.EpirusUI.battleText())()`);
    writeFileSync(join(HERE, String(flag('save'))), full, 'utf8');
    console.log('（已存完整导出文本：' + flag('save') + '，' + full.length + ' 字节）');
  }
  /* ⚠ 这三处必须带 `/m`：`.*` 不吃换行而 `$` 若无 m 就是"串尾" ⇒ 两条都捕成空串、`''===''` 会**假绿**
     *   （第一次跑就是这么绿过去的，捕到的 难度= 其实是空）。加非空断言，让这条真的有牙。
     * ⚠ 第二版又踩一次：`^难度=` 也捕不到 —— 这一格与 `模式=` **同一行**，行首不是它。改成不锚行首。 */
  const diffOf = (t) => (t.match(/难度=(.*)$/m) || [, ''])[1];
  const midTo = (t) => (t.match(/中途换档=第 \d+ 回合起改 ([^：]+)/) || [, ''])[1];
  check('② 难度= 也是开局快照（与 对手= 同档 ⇒ 头部不自相矛盾）',
    diffOf(h1.head) !== '' && diffOf(h1.head) === diffOf(h2.head) && diffOf(h2.head) !== midTo(h2.head),
    '难度=' + diffOf(h2.head) + ' ‖ 换到 ' + midTo(h2.head));

  /* ── 档 3：2 人桌（1 个 AI 席 ⇒ 标签不许写出第二席）── */
  await setSel('sel-players', '2'); await sleep(500);
  await setSel('sel-diff', diff1); await sleep(400);
  await evalJS(`document.getElementById('btn-newgame').click()`); await sleep(900);
  await playRound();
  const h3 = await head();
  console.log('\n=== 档 3（2 人）的头部 ===\n' + h3.head);
  check('③ 2 人桌只写一席（没有"玩家2"这种不存在的席位）', !/玩家2=/.test(h3.head) && /电脑=|对手=.*电脑/.test(h3.head),
    (h3.head.match(/^对手=(.*)$/m) || [, ''])[1]);

  /* ── 档 4：风格档（非池 ⇒ 对手= 落在 source，且不该再印重复的 对手AI=）── */
  const styleOpt = await evalJS(`(()=>{const s=document.getElementById('sel-diff'); const o=[...s.options].find(x=>/^st:/.test(x.value)); return o?o.value:'';})()`);
  if (!styleOpt) { console.log('（这一版页面没有 st: 开头的风格档 ⇒ 档 4 跳过）'); }
  else {
    await setSel('sel-players', '5'); await sleep(400);
    await setSel('sel-diff', styleOpt); await sleep(400);
    await evalJS(`document.getElementById('btn-newgame').click()`); await sleep(900);
    await playRound();
    const h4 = await head();
    console.log('\n=== 档 4（风格档 ' + styleOpt + '）的头部 ===\n' + h4.head);
    const src4 = await evalJS(`(()=>window.EpirusUI.aiInfo().source)()`);
    check('④ 风格档：对手= 用的就是 aiInfo().source（没有假装的逐席名单）',
      (h4.head.match(/^对手=(.*)$/m) || [, ''])[1] === src4, src4);
    check('④ 风格档不再重复印 对手AI= 行（source 只出现一次）',
      (h4.head.match(/对手AI=/g) || []).length === 0);
  }

  check('全程没有 JS 错误', errors.length === 0, errors.slice(0, 3).join(' ‖ '));
  const bad = checks.filter(c => !c[1]);
  console.log('\n合计 ' + checks.length + ' 条 ‖ FAIL ' + bad.length + ' 条');
  console.log(bad.length ? 'PROBE FAILED' : 'PROBE OK');
  BOOT.killTree(); clearTimeout(watchdog);
  process.exit(bad.length ? 1 : 0);
}
main().catch(e => { console.error('PROBE ERROR: ' + e.stack); BOOT.killTree(); clearTimeout(watchdog); process.exit(2); });
