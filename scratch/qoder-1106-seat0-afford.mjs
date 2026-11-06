/* qoder-1106-seat0-afford.mjs —— 真页面上「人类座这一手有没有攻击技可点」的分母账（11-06 夜）
 *
 * 为什么要它：battle-test 的修前读数（本地 14/14 ‖ CI 229/240 打不起攻击技）被"兜底不答蓄能弹窗"污染了，
 *   修后只剩"正常路径 11/21 次走兜底"这种**没有分母**的说法。这条尺把主语钉死：
 *   **决策点 = 页面轮到人类座、且在等它出手的那一手**；每一手都按 ui.js:288-321 那套判子现算
 *   （modeOk / cd / legalActions 的 affordable / MULTI_ONLY），不是读按钮文本、也不是引擎侧另装一桌。
 * 装配 = 页面自己那份（sel-players=5 · sel-hp=3 · sel-diff=lv:hard ⇒ 池抽与剂量都走 `js/pool-draw.js` + `DIFF_TIERS`），
 *   出招策略 = battle-test 驱动那一形（打得起点最便宜的攻击技；打不起就蓄能；再不行ジ）⇒ 量的是"这样一个玩家打得起吗"。
 * 跑法：node scratch/qoder-1106-seat0-afford.mjs --games=12
 * ⚠ 只读仪器：不进判据、不落产物；退出码 0=跑完并给出分母，2=没跑到任何决策点（宁可空手也不许假数）。 */
import { launchChrome } from '../tools/cdp-boot.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(dirname(fileURLToPath(import.meta.url))), '.');
const URL = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const GAMES = Number(flag('games', 12));
const DIFF = flag('diff', 'lv:hard');
const NPLAY = Number(flag('players', 5));
const HP = Number(flag('hp', 3));
const FALLBACK = flag('fallback', 'charge');   // charge = 与 battle-test 驱动同形 ‖ ji = 对照臂（只攒不打）
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* 与 ui.js:288-321 同一套判子（逐条对照写，不在这里发明第二份合法性）
 * ⚠ 这里数的是**全部 30 张**（带 cat），因为"攻击技"有两种主语、结论会分岔：
 *   · A = 规则表里 `cat==='attack'` 那 5 张（枪/激光剑/坦克/狙击枪/双枪射手，全按ジ计价）
 *   · B = battle-test 驱动点的那 7 张名（多电磁炮/激光眼/摄魂/真正的落雷这类**按珠**计价的牌）
 *   ⇒ 汇总里 A、B 各给一条，不许混着说。 */
const SAMPLE = `(() => {
  const R = window.EpirusRules, S = window.EpirusState, P = window.EpirusPlay;
  const st = window.EpirusUI.B.state; if (!st) return null;
  const lm = {}; for (const l of P.legalActions(st, 0)) lm[l.key] = l;
  const out = [];
  for (const s of R.skills) {
    const modeOk = S.canUseSkillInMode(st, s.key), cd = (st.p[0].cooldown[s.key] || 0), la = lm[s.key];
    const multiOnly = R.MULTI_ONLY.indexOf(s.key) >= 0 && !modeOk;
    const unaffordable = !multiOnly && modeOk && cd <= 0 && !st.over && (!la || !la.affordable);
    out.push({ n: s.name, cat: s.cat, cost: s.cost, cd: cd, ep: s.cost > 0 && st.p[0].ep < s.cost,
      disabled: !!(multiOnly || !modeOk || cd > 0 || st.over || unaffordable),
      why: (multiOnly ? '残局/模式不开放' : (!modeOk ? '模式不开放' : (cd > 0 ? '冷却中' : (!la ? '不在合法集' : (!la.affordable ? '买不起' : '可点')))))
    });
  }
  const me = st.p[0];
  return { round: st.round, hp: me.hp, ep: me.ep, elec: me.elec || 0, boom: me.boom || 0,
    alive: st.p.filter(p => p.hp > 0).length, skills: out };
})()`;
/* B 主语 = 与 battle-test 驱动同一份名单（那里点的是按钮文本） */
const DRIVER_ATK = ['枪', '激光剑', '坦克', '狙击枪', '电磁炮', '真正的落雷', '摄魂指法'];

const btnReady = "(() => [...document.querySelectorAll('.skillbtn')].some(x => !x.disabled))()";
const clickByName = (nm) => "(() => { const b = [...document.querySelectorAll('.skillbtn')]" +
  ".find(x => (x.querySelector('.nm') || {}).textContent === " + JSON.stringify(nm) + " && !x.disabled);" +
  " if (!b) return false; b.click(); return true; })()";
const ANSWER = "(() => { const r = document.getElementById('modal-root');" +
  " if (r && !r.classList.contains('hidden')) { const b = document.querySelector('#modal-card #mbtn'); if (b) { b.click(); return 1; } } return 0; })()";
const OVER = "(() => !document.getElementById('overlay-root').classList.contains('hidden'))()";

const ws_ = await (async () => {
  const BOOT = launchChrome({ port: 9357 });
  const tabs = await BOOT.tabs();
  const page = tabs.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
    /* 不许把求值异常咽掉（这条仪器自己刚刚就栽在这里：SAMPLE 抛异常 ⇒ 返回 undefined ⇒ 循环第 0 手就 break ⇒ 报"决策点 0"） */
    if (r.result && r.result.exceptionDetails) {
      const d = (r.result.exceptionDetails.exception || {}).description || r.result.exceptionDetails.text;
      console.error('⛔ 页面求值异常：' + String(d).slice(0, 300));
      return { __err: String(d) };
    }
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL }); await sleep(1600);
  await ev("(() => { try { localStorage.removeItem('epirus.champion3p'); localStorage.removeItem('epirus.champion'); } catch (e) {} return 1; })()");
  await send('Page.navigate', { url: URL }); await sleep(1600);
  return { BOOT, send, ev };
})();
const { BOOT, send, ev } = ws_;

await ev("(() => { const s = document.getElementById('sel-players'); s.value = '" + NPLAY + "'; s.dispatchEvent(new Event('change'));" +
  " const h = document.getElementById('sel-hp'); if (h) { h.value = '" + HP + "'; h.dispatchEvent(new Event('change')); }" +
  " const d = document.getElementById('sel-diff'); d.value = '" + DIFF + "'; d.dispatchEvent(new Event('change')); return 1; })()");

const rows = [];
let gamesDone = 0;
for (let g = 0; g < GAMES; g++) {
  await ev("(() => { window.EpirusUI.newGame(); return 1; })()");
  await sleep(500);
  if (process.argv.includes('--debug')) {
    console.log('  [诊断] 建局后 = ' + JSON.stringify(await ev("(() => { const B = window.EpirusUI.B;" +
      " return { state: !!B.state, round: B.state && B.state.round, n: B.state && B.state.p.length," +
      " diff: B.diff, btns: document.querySelectorAll('.skillbtn').length," +
      " enabled: [...document.querySelectorAll('.skillbtn')].filter(x => !x.disabled).length," +
      " overlay: !document.getElementById('overlay-root').classList.contains('hidden')," +
      " tabs: [...document.querySelectorAll('.tab,[data-tab]')].map(x => x.className + '|' + (x.dataset ? x.dataset.tab : '')) }; })()")));
    console.log('  [诊断] SAMPLE 第一手 = ' + JSON.stringify(await ev(SAMPLE)).slice(0, 700));
  }
  let steps = 0, seen = 0;
  while (steps++ < 220) {
    if (await ev(OVER)) break;
    let ready = false; const t0 = Date.now();
    while (Date.now() - t0 < 3500) { if (await ev(btnReady)) { ready = true; break; } await sleep(60); }
    if (!ready) break;
    const s = await ev(SAMPLE);
    if (!s || !s.skills) break;
    seen++;
    rows.push(s);
    /* 出招与 battle-test 驱动同一形：按那份名单的顺序点第一张可点的；都没有 ⇒ 蓄能（答弹窗）⇒ ジ
     *   ⚠ `--fallback=ji` 是对照臂：打不起时**只按ジ**（不花掉攒下的 1 ジ去蓄能）
     *     ⇒ 用来把"驱动策略"与"规则算术"分开：ジ 是全座唯一的常态收入，攒不攒得起来完全是政策问题。 */
    let acted = false;
    for (const nm of DRIVER_ATK) { if (await ev(clickByName(nm))) { await ev(ANSWER); acted = true; break; } }
    if (!acted && FALLBACK === 'charge') { if (!(await ev(clickByName('蓄能')))) await ev(clickByName('ジ')); await ev(ANSWER); }
    else if (!acted) { await ev(clickByName('ジ')); }
    await sleep(120);
  }
  if (await ev(OVER)) gamesDone++;
  console.log('  局 ' + (g + 1) + ' 决策点 ' + seen + ' ‖ 到终局=' + (await ev(OVER)));
}

/* ===== 汇总（两套主语各一条，别混着引用） ===== */
const canA = (r) => r.skills.some(s => s.cat === 'attack' && !s.disabled);
const canB = (r) => r.skills.some(s => DRIVER_ATK.indexOf(s.n) >= 0 && !s.disabled);
const bucket = { '1-3': [0, 0, 0], '4-8': [0, 0, 0], '9+': [0, 0, 0] };
const why = {};
const epHist = {};
let nA = 0, nB = 0, epYes = 0, nYes = 0, epNo = 0, nNo = 0, beadNo = 0;
for (const r of rows) {
  epHist[Math.min(4, r.ep)] = (epHist[Math.min(4, r.ep)] || 0) + 1;
  const can = canB(r);                       // 汇总的主分母走 B（驱动真正会点的那批），A 单独报比例
  if (canA(r)) nA++;
  if (can) { nYes++; epYes += r.ep; } else { nNo++; epNo += r.ep; beadNo += r.elec + r.boom; }
  if (canB(r)) nB++;
  const b = r.round <= 3 ? '1-3' : (r.round <= 8 ? '4-8' : '9+');
  bucket[b][0]++; if (canA(r)) bucket[b][1]++; if (canB(r)) bucket[b][2]++;
  for (const s of r.skills) {
    if (DRIVER_ATK.indexOf(s.n) < 0) continue;
    if (!s.disabled) continue;
    why[s.why] = (why[s.why] || 0) + 1;
  }
}
const pc = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '读不出（分母 0）';
console.log('\n==== 人类座（页面装配 · ' + NPLAY + ' 人 · ' + HP + ' 血 · ' + DIFF + '）攻击技可点性 ====');
console.log('决策点 = ' + rows.length + '（=' + gamesDone + '/' + GAMES + ' 局打到终局）');
console.log('主语 A（规则表 cat=attack 那 5 张，按ジ计价）：至少一张可点 ' + nA + '/' + rows.length + ' = ' + pc(nA, rows.length));
console.log('主语 B（battle-test 驱动那 7 张，含按珠的电磁炮/落雷/摄魂）：至少一张可点 ' + nB + '/' + rows.length + ' = ' + pc(nB, rows.length));
console.log('该手 ep 分布（>=4 合并）：' + Object.keys(epHist).sort().map(k => k + 'ジ ' + epHist[k] + ' 手（' + (100*epHist[k]/rows.length).toFixed(0) + '%）').join(' ‖ ') + ' ‖ 兜底臂=' + FALLBACK);
console.log('按回合分桶（A / B 可点占）：' + Object.keys(bucket).map(k => k + ' 回合 ' + bucket[k][1] + '/' + bucket[k][0] + ' ‖ ' + bucket[k][2] + '/' + bucket[k][0]).join(' ‖ '));
console.log('两组资源对照（主语 B 打得起 vs 打不起）：ep 均 ' + (epYes / Math.max(1, nYes)).toFixed(2) + ' vs ' + (epNo / Math.max(1, nNo)).toFixed(2) +
  ' ‖ 珠均 0 vs ' + (beadNo / Math.max(1, nNo)).toFixed(2));
console.log('打不起时逐张牌的原因（人次，只数 B 那 7 张）：' + (Object.entries(why).sort((a, b) => b[1] - a[1]).map(e => e[0] + ' ' + e[1]).join(' ‖ ') || '无'));
BOOT.killTree();
process.exit(rows.length ? 0 : 2);
