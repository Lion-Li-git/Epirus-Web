/* play-mix.mjs —— §E600-B 的"当玩家"实打（一次性仪器，不进判据）
 *
 * 为什么要另起一台而不是直接用页面试：我用应用内浏览器点了 45 次，回合只走 2 拍 ——
 *   隐藏标签页把 timer/rAF 节流了（`visibilityState=hidden`），页面那条"逐回合播"的路根本推不动。
 *   ⇒ 判"页面实际给人看到什么"必须让 Chrome 真的在跑（`--headless=new` 有虚拟表面，与 `smoke`/`np-probe` 同一台法）。
 *
 * 它回答一个具体问题：**简单档掺了脚本席之后，玩家在实际对局里看得见那些低性价比卡吗**
 *   （避雷针 / 贴贴→天火 / 镜面反射 / 双枪射手 / 挑衅 / 净化 / 过载炮 / 金刚盾 / 藤甲 / 原型制御 …）。
 *   这些卡在高强度包里从不出现（`README` 的"从未出现的 15 张"那张表），而 `st:toolkit` 的存在理由就是把它们打出来。
 *
 * 用法：node docs/debug/play-mix.mjs [chrome路径] [端口] [--games=3] [--rounds=60] [--tier=lv:sparring]
 * 退出码：0 = 跑完并吐出读数 ‖ 2 = 起不来 / 页面没起来 / 下拉设不上 ‖ 3 = 看门狗到点 ‖
 *   7 = 有局的行数没对上页面自数的回合数（漏读）
 * ⚑ 这把尺自己错过的三次都在这里（都是"报给用户的数比真的窄"那一族）：
 *   ① 只在点击后扫 logbox、看到浮层就 break ⇒ 一局 20 回合只收到前 10 行；
 *   ② 卡名带落点（`枪→玩家4`）没摘掉就比 ⇒ 凡是带落点的低性价比卡一律不计（藤甲/双枪射手/全息屏障/过载炮
 *      明明在局里出现过）；③ 局末判定用"夺冠|胜利"去 match 文字，从来没命中 ⇒ 点击全打在已结束桌上。
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ARGV = process.argv.slice(2).filter(a => !/^--/.test(a));
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const CHROME = ARGV[0] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(ARGV[1] || 9777);
const GAMES = Number(flag('games', 3)), ROUNDS = Number(flag('rounds', 60)), TIER = flag('tier', 'lv:sparring');
/* 下拉里的字样（页面自己按 `DIFF_TIERS[].name` 生成）：简单 · 陪练 ‖ 普通（默认） ‖ 困难 · 冠军 */
const TIERLABEL = flag('tierlabel', TIER === 'lv:sparring' ? '简单' : TIER === 'lv:hard' ? '困难' : '普通');
const URL = 'file:///' + process.cwd().replace(/\\/g, '/') + '/index.html';
const udd = mkdtempSync(join(tmpdir(), 'playmix-'));
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=' + PORT, '--user-data-dir=' + udd, 'about:blank'], { stdio: 'ignore' });
const bye = code => {
  /* win32 上 `proc.kill()` 只打得掉 Chrome 的**主进程**，子进程会留着占 9777 端口 ⇒ 下一次跑到的是**上一台的残骸**。
   *   按 PID 打整棵树（`/T`），不按名字打 —— 按名字 `Get-Process chrome | Stop-Process` 那种会把用户自己的浏览器一起杀。 */
  if (process.platform === 'win32') { try { spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch (e) { } }
  try { proc.kill(); } catch (e) { }
  try { rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  process.exit(code);
};
process.on('exit', () => { try { proc.kill(); } catch (e) { } });
/* 看门狗按"要跑多少点击"算，不写死 300 秒：实测 8 局 × 250 上限这一档就要 5~7 分钟，
 *   写死的 300s 会在跑一半时把 Chrome 掐了（node 那头挂在没有超时的 promise 上，看着像"仪器自己坏了"）。 */
const BACKSTOP = Math.max(300000, GAMES * (ROUNDS * 150 + 5000) + 120000);
setTimeout(() => { console.log('⛔ 看门狗到点（' + Math.round(BACKSTOP / 1000) + 's）⇒ 掐 Chrome 退 3'); bye(3); }, BACKSTOP).unref();

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { }
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}
/* ⚠ 必须挑 type === 'page' 的那一条：`/json/list` 第一条常常是扩展的 background_page（实测这台就是），
 *   连到它上面 evaluate 会得到"body 长 0"，看起来像页面坏了，其实是仪器接错线。 */
const pages = await waitJson('http://127.0.0.1:' + PORT + '/json/list');
const pageT = pages && pages.find(p => p.type === 'page');
if (!pageT) { console.log('⛔ 起不到 Chrome 或没有 page 类型的 target（' + CHROME + '）'); bye(2); }
const ws = new WebSocket(pageT.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let mid = 0; const pending = {};
ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } });
const send = (method, params) => new Promise(res => { const id = ++mid; pending[id] = m => res(m.result || m.error); ws.send(JSON.stringify({ id, method, params: params || {} })); });
const evl = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result ? r.result.value : r; };
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: URL });
await new Promise(r => setTimeout(r, 2500));
/* 页面要解析 ~4.5 MB 的内联池 bundle（2.9 MB 的 3P 池 + 765 KB 的 2P 池），2.5 秒在这台机器上不够
 *   ⇒ 先等到控件真出现（最多 25 秒），别把"页面还没起来"读成"下拉找不到 = 产品坏了"。 */
const ready = await evl(`(async () => { const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 250; i++) {
    if (document.querySelectorAll('select').length >= 3 && document.querySelectorAll('#skillgrid button').length > 20) return 'ok';
    await sleep(100);
  }
  return '控件没出现：select=' + document.querySelectorAll('select').length +
    ' ‖ skill按钮=' + document.querySelectorAll('#skillgrid button').length +
    ' ‖ body文字长=' + (document.body ? document.body.innerText.length : 0); })()`);
console.log('页面就绪：' + ready);
if (String(ready) !== 'ok') {
  /* 红之前先把"到底打开的是什么"印出来：headless 的 /json/list 里第一条经常是 about:blank 或扩展页，
   *   拿它当被测页面就会得到"body 长 0"这种假病。 */
  const where = await evl('JSON.stringify({url: String(document.location), ready: document.readyState, title: document.title, html: (document.documentElement ? document.documentElement.outerHTML.length : 0)})');
  console.log('  当前 target 里是：' + where);
  console.log('  targets：' + JSON.stringify((pages || []).map(p => ({t: p.type, u: String(p.url).slice(0, 60)}))));
  console.log('⛔ 页面没起来，先看这个再说别的'); bye(2);
}

const PLAY = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const setSel = (label, want) => {
    const sels = [...document.querySelectorAll('select')];
    const txt = o => (o.textContent || o.text || '').trim();
    const s = sels.find(x => [...x.options].some(o => txt(o).indexOf(label) >= 0));
    if (!s) return '找不到下拉：' + label + '（select 共 ' + sels.length + ' 个 ‖ ' +
      sels.map(z => [...z.options].map(o => txt(o)).slice(0, 3).join('/')).join(' ‖ ') + '）';
    const o = [...s.options].find(x => txt(x).indexOf(label) >= 0);
    s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return null;
  };
  const btn = t => [...document.querySelectorAll('button')].find(b => b.textContent.trim().indexOf(t) === 0 && !b.disabled);
  const err = setSel('5 人'), err2 = setSel('${TIERLABEL}');
  if (err || err2) return { fatal: '下拉设不上: ' + [err, err2].filter(Boolean).join(' ‖ ') };
  const out = { games: [], seatLabels: [] };
  /* 一局打完的标志是结算浮层（ui.js 的 finish() 摘掉 #overlay-root 上的 hidden 类），
   *   不是任何一句日志文字 ⇒ 第一版拿"夺冠|胜利"去 match 整块 logbox，从来没命中过，
   *   于是每局剩下的几十次点击全打在已结束桌上（看着像"跑了 70 回合"，其实真回合只有 8~19）。
   *   ⚠ 这段字符串在模板字面量里面 ⇒ 注释里不许出现反引号（实测 SyntaxError）。 */
  const ovCard = () => { const r = document.getElementById('overlay-root');
    return (r && !r.classList.contains('hidden')) ? document.getElementById('overlay-card') : null; };
  for (let g = 0; g < ${GAMES}; g++) {
    const card0 = ovCard();
    if (card0) { const again = [...card0.querySelectorAll('button')].find(b => b.textContent.indexOf('再来一局') === 0);
      if (again) again.click(); }
    else { const nb = [...document.querySelectorAll('button')].find(b => b.textContent.includes('新对局')); if (nb) nb.click(); }
    await sleep(400);
    const box = document.getElementById('logbox');
    out.seatLabels.push((box && box.children && box.children[0]) ? box.children[0].textContent.trim().slice(0, 220) : '(没读到开局行)');
    const RL = new Set();
    /* ⚠ 扫 logbox 要**每点一次扫一遍、结束前再扫一遍**：页面是异步逐回合播的，最后那几行的回合行
     *   是在结算浮层已经出现之后才落进 logbox 的。第一版只在点击后扫、一看到浮层就 break ⇒
     *   实测 20 回合的局只收到前 10 行（漏掉一半，还看着像"这一档就是没什么广度"）。
     *   （logbox 自己没有截断：ui.js 里搜不到 removeChild/firstChild/slice(-) ⇒ 不是"窗口只留尾巴"。） */
    const sweep = () => { const b = document.getElementById('logbox'); if (!b) return;
      for (const c of b.children) { const t = c.textContent.trim(); if (t.indexOf('第 ') === 0 && t.indexOf('回合：') > 0) RL.add(t); } };
    let rounds = 0, over = null, realRounds = null;
    for (let i = 0; i < ${ROUNDS}; i++) {
      if (ovCard()) break;
      let pick = null;
      const gun = btn('枪'), sword = btn('激光剑'), ji = btn('ジ'), def = btn('防御');
      const r = Math.random();
      pick = (r < 0.45 && gun) ? gun : (r < 0.6 && sword) ? sword : (r < 0.75 && def) ? def : ji;
      if (!pick) break;
      pick.click(); rounds++;
      await sleep(120); sweep();
    }
    /* 收尾必须**等一拍再扫**：末几行的回合行是在结算浮层出现之后才落进 logbox 的
     *   （实测不等就漏 4/16 行，而漏掉的那几行正是最可能有低性价比卡的中后期）。 */
    await sleep(900); sweep();
    const c1 = ovCard();
    if (c1) over = c1.textContent.replace(/\\s+/g, ' ').trim().slice(0, 160);
    /* ⚑ logbox 这份在局末就是会少最后几行（实测 29 回合只留到 23，补扫也不回来）⇒
     *   改用页面自己的对局记录：ui.js 每回合 persistBattle() 把**整条 transcript** 写进
     *   localStorage 的 epirus.lastBattle，那份才是全的。logbox 那份留着对账。 */
    let ls = null; try { ls = localStorage.getItem('epirus.lastBattle'); } catch (e) { ls = null; }
    const TL = new Set();
    if (ls) for (const ln of String(ls).split('\\n')) { const t = ln.trim();
      if (t.indexOf('第 ') === 0 && t.indexOf('回合：') > 0) TL.add(t); }
    const useLs = !!ls && TL.size >= RL.size;
    const lines = useLs ? [...TL] : [...RL];
    /* 浮层那句"共进行 N 回合"是页面自己数的 ⇒ 拿它跟收到的行数对账。
     *   不相等 = 这把尺在漏读，漏读数不许当成"这一档广度就这样"报出去。 */
    const mm = over ? over.match(/共进行 (\\d+) 回合/) : null;
    realRounds = mm ? Number(mm[1]) : null;
    out.games.push({ rounds: rounds, over: over, realRounds: realRounds, src: useLs ? 'localStorage' : 'logbox',
      domLines: RL.size, missing: (realRounds === null ? -1 : realRounds - lines.length), roundLines: lines });
  }
  return out;
})()`;

const res = await evl(PLAY);
if (!res || res.fatal) { console.log('⛔ ' + (res && res.fatal)); bye(2); }

const LOW = ['避雷针', '贴贴', '天火', '镜面反射', '双枪射手', '挑衅', '净化', '过载炮', '金刚盾', '藤甲', '无极变速', '原型制御', '全息屏障', '激光眼', '电磁炮', '真正的落雷', '转移伤害', '地雷', '狙击枪', '坦克', '聚能环', '蓄能'];
/* ⚠ 日志里的动作名带落点（`枪→玩家4`、`过载炮→玩家1`），必须先摘掉 `→…` 再去比卡名。
 *   第一版没摘 ⇒ 凡是**带落点**的低性价比卡一律算成 0 种（藤甲 / 双枪射手 / 全息屏障 / 过载炮
 *   明明在局里出现过却没进读数），报给用户的广度比实际窄一半。 */
const base = s => String(s).replace(/→.*$/, '').trim();
const perSeat = {}, seenAll = new Set();
let totalLines = 0;
(res.games || []).forEach(g => {
  (g.roundLines || []).forEach(l => {
    totalLines++;
    l.replace(/玩家(\d)=【([^】]+)】/g, (_, pid, sk) => {
      perSeat[pid] = perSeat[pid] || {}; perSeat[pid][sk] = (perSeat[pid][sk] || 0) + 1; seenAll.add(base(sk)); return '';
    });
  });
});
console.log('实打 ' + (res.games || []).length + ' 局 · 回合行 ' + totalLines + ' 行（页面 = 真 Chrome · ' + URL + '）');
(res.seatLabels || []).forEach((s, i) => {
  const g = (res.games || [])[i] || {};
  const missTxt = (g.realRounds === null || g.realRounds === undefined) ? '(没结算浮层)'
    : (g.missing > 0 ? '⚠漏读 ' + g.missing + ' 行' : (g.missing < 0 ? '(没对上线数)' : '行数=页面自数 ✔'));
  console.log('  第 ' + (i + 1) + ' 局（页面自数 ' + g.realRounds + ' 回合 · 收到 ' + ((g.roundLines || []).length) +
    ' 行 · ' + missTxt + ' · 点击 ' + g.rounds + '）：' + s);
  console.log('      结算：' + (g.over || '(没读到结算浮层 ⇒ 这局是被 --rounds 上限掐断的)'));
});
console.log('\n各席出手种类数（不含ジ）与用到的低性价比卡：');
for (const pid of Object.keys(perSeat).sort()) {
  const t = perSeat[pid], noJi = Object.keys(t).map(base).filter(k => k !== 'ジ' && k !== '已淘汰');
  const uniq = [...new Set(noJi)];
  const low = uniq.filter(k => LOW.indexOf(k) >= 0);
  console.log('  玩家' + pid + '：种类 ' + String(uniq.length).padStart(2) + ' ‖ 低性价比卡 ' + low.length + ' 种 ' +
    (low.length ? '（' + low.join('、') + '）' : '') + ' ‖ 总出手 ' + Object.values(t).reduce((a, b) => a + b, 0));
}
const hitLow = LOW.filter(k => seenAll.has(k));
console.log('\n这一晚整桌出现过的低性价比卡：' + (hitLow.length ? hitLow.join('、') : '（一张都没有）'));
/* 按档分文件写：两档（掺脚本的简单 / 纯包的普通）要在同一份账里对比，
 *   都写同一个路径的话后一次会把前一次的原始行覆掉（第一版就是这么丢的数）。 */
const OUT = 'champion-map/_playmix-' + TIERLABEL + '.json';
writeFileSync(OUT, JSON.stringify(res, null, 1), 'utf8');
console.log('✔ 原始回合行已写 ' + OUT);
/* 只要有一局"收到的行数 ≠ 页面自己数的回合数"，这批读数就是漏的 ⇒ 红着退，别让人拿漏数去下结论。 */
const missed = (res.games || []).filter(g => (g.missing || 0) > 0);
if (missed.length) console.log('⛔ ' + missed.length + '/' + (res.games || []).length + ' 局漏读回合行 ⇒ 读数不可用');
bye(missed.length ? 7 : 0);
