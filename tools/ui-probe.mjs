/* tools/ui-probe.mjs —— UI 缺陷的**行为守门探针**（第八轮复核 §5；修复见 v1.5.80）
 *
 * 复核 §5 在真页面上报告的三条，我用本探针逐条复现过（修复前的读数记在 CHANGELOG v1.5.80）：
 *   ① 目标弹窗开着时：提示仍写"请出招"；点别的技能会**静默替换**；点自指向技能会**立即落子**（误触白扔一回合）
 *   ② 结算期间（`B.locked`）点击**静默丢弃**：无排队、无反馈
 *   ③ 日志连续"ジ不足·未发动" ⇒ 建议按"状态泄漏（pending-target 未清）"查
 *      —— 实测在当前构建**不可复现**：格子早已把买不起的置灰，10+ 回合按座归因 = `{}`。
 *
 * 本文件断言的是**修复后的正确行为**（PASS = 正确）。它只读、不改仓库文件
 *（截图落 `docs/artifacts/ui-out/`，已 gitignore）。需要 Chrome ⇒ 不进 np-test，作为独立探针跑。
 *
 * 用法：node tools/ui-probe.mjs [chrome路径] [端口]
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const CHROME = ARGV[0] || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(ARGV[1] || 9351);
const URL = 'file:///' + join(ROOT, 'index.html').replace(/\\/g, '/');
const OUT = join(ROOT, 'docs/artifacts/ui-out');

const udd = mkdtempSync(join(tmpdir(), 'epirus-uiprobe-'));
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
const watchdog = setTimeout(function () { console.error('[guard] 超时，收尸'); killTree(); process.exit(3); }, 300000);

const sleep = (ms) => new Promise(function (r) { setTimeout(r, ms); });
async function waitJson(url, tries) {
  for (let i = 0; i < (tries || 60); i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('CDP endpoint unreachable: ' + url);
}

const errors = [];
const checks = [];
const check = function (name, cond, extra) {
  checks.push([name, !!cond]);
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra != null ? '   [' + extra + ']' : ''));
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const tabs = await waitJson('http://127.0.0.1:' + PORT + '/json/list');
  const page = tabs.find(function (t) { return t.type === 'page'; });
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(function (res, rej) { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = function (ev) {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails && m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description || m.params.exceptionDetails.text));
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE: ' + m.params.args.map(function (a) { return a.value || a.description || ''; }).join(' '));
  };
  const send = function (method, params) {
    return new Promise(function (res) { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: method, params: params || {} })); });
  };
  const evalJS = async function (expr) {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result && r.result.result && r.result.result.value;
  };
  const shot = async function (file) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    console.log('  shot -> ' + file);
  };
  const hintText = function () { return evalJS('document.getElementById("battle-hint").textContent'); };
  const logText = function () { return evalJS('document.getElementById("logbox").textContent'); };
  const modalOpen = function () { return evalJS('!document.getElementById("modal-root").classList.contains("hidden")'); };
  const modalText = function () { return evalJS('document.getElementById("modal-card").textContent'); };
  const roundNow = function () { return evalJS('window.EpirusUI.B.state.round'); };
  const locked = function () { return evalJS('window.EpirusUI.B.locked'); };
  const clickSkill = function (name) {
    return evalJS('(function(){var b=[].slice.call(document.querySelectorAll(".skillbtn")).filter(function(x){var n=x.querySelector(".nm"); return n && n.textContent===' + JSON.stringify(name) + ';}); if(!b.length) return "no-btn"; if(b[0].disabled) return "disabled"; b[0].click(); return "clicked";})()');
  };
  const clickModalOption = function (i) {
    return evalJS('(function(){var b=document.querySelectorAll("#modal-card #mbtn"); if(!b.length) return "no-option"; b[' + i + '].click(); return "clicked";})()');
  };
  const pressEsc = function () {
    return evalJS('(function(){document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); return true;})()');
  };
  const waitUnlock = async function () { for (let i = 0; i < 16 && (await locked()); i++) await sleep(150); await sleep(120); };
  const cancelIfModal = async function () { if (await modalOpen()) await clickModalOption(999); await sleep(120); };
  const waitAffordable = async function (name, maxRounds) {
    for (let r = 0; r < (maxRounds || 8); r++) {
      await waitUnlock();
      await cancelIfModal();
      await waitUnlock();
      const res = await clickSkill(name);
      if (res === 'clicked') return true;
      await clickSkill('ジ');
      await sleep(650);
    }
    return false;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: URL });
  await sleep(1500);
  await evalJS('try{localStorage.removeItem("epirus.champion3p");}catch(e){}');
  await send('Page.navigate', { url: URL });
  await sleep(1500);

  await evalJS('(function(){var s=document.getElementById("sel-players"); s.value="5"; s.dispatchEvent(new Event("change"));})()');
  await sleep(300);
  /* v1.6.5：页面没有「模式」下拉了 —— 人数与血量是两根正交轴，这里显式选 3 血并回读真建出来的模式键 */
  await evalJS('(function(){var s=document.getElementById("sel-hp"); if(s){s.value="3"; s.dispatchEvent(new Event("change"));} return 1;})()');
  await sleep(400);
  console.log('  5 人 · 3 血 → 模式键 =', await evalJS('(function(){var g=window.EpirusUI.B.state; return g.modeKey + "(hp" + g.mode.hp + ",n" + g.p.length + ")";})()'));
  await evalJS('(function(){var s=document.getElementById("sel-diff"); s.value="lv:hard"; s.dispatchEvent(new Event("change"));})()');
  await sleep(200);
  await evalJS('document.getElementById("btn-newgame").click()');
  await sleep(900);
  check('起局成功（页面进入对局）', (await evalJS('!!window.EpirusUI')) === true);

  /* ═══ ① 目标弹窗：提示 / 改主意 / 自指向误触 / Esc 取消 ═══ */
  console.log('\n① 目标弹窗');
  const afforded = await waitAffordable('激光剑', 8);
  check('前置：攒够ジ后"激光剑"可点', afforded, 'afforded=' + afforded);
  if (afforded) {
    const mOpen = await modalOpen();
    const hintWhenModal = await hintText();
    check('①-甲 弹窗开着时提示是"请选择目标"（不再误写"请出招"）',
      mOpen && hintWhenModal.indexOf('选择目标') >= 0 && hintWhenModal.indexOf('请出招') < 0, 'hint="' + hintWhenModal + '"');
    check('①-甲2 弹窗里提供「取消」出口', (await modalText()).indexOf('取消') >= 0, 'modal="' + (await modalText()).slice(0, 60) + '"');
    await shot(join(OUT, 'uipro-1a-target-modal.png'));

    const titleA = await modalText();
    const alt = (await clickSkill('坦克')) === 'clicked' ? '坦克' : ((await clickSkill('枪')) === 'clicked' ? '枪' : null);
    await sleep(250);
    const titleB = await modalText();
    const logAfterSwitch = await logText();
    check('①-乙 弹窗开着时改点别的技能：明确留痕（日志出现"已放弃"）而不是静默替换',
      !!alt && (await modalOpen()) && titleB !== titleA && logAfterSwitch.indexOf('已放弃') >= 0, 'alt=' + alt);
    await shot(join(OUT, 'uipro-1b-modal-replaced.png'));

    /* Esc 取消：弹窗关闭、给出提示、**且不消耗回合** */
    const rp = await roundNow();
    await pressEsc();
    await sleep(250);
    const hintAfterEsc = await hintText();
    const rq = await roundNow();
    check('①-丙 Esc 能取消目标选择：弹窗关闭 + 提示"已取消" + **不消耗回合**',
      !(await modalOpen()) && hintAfterEsc.indexOf('已取消') >= 0 && rq === rp, 'round ' + rp + '→' + rq + ' hint="' + hintAfterEsc + '"');
    await shot(join(OUT, 'uipro-1c-esc-cancel.png'));

    /* 重新开弹窗后点自指向技能（ジ）：必须先取消留痕、再落子 */
    const afforded2 = await waitAffordable('激光剑', 6);
    if (afforded2) {
      const r2 = await roundNow();
      const jres = await clickSkill('ジ');
      await sleep(320);
      const r3 = await roundNow();
      const logAfterSelf = await logText();
      check('①-丁 弹窗开着时点自指向技能：先留痕（"已放弃"）再落子（玩家不会莫名白扔一回合）',
        jres === 'clicked' && r3 !== r2 && logAfterSelf.indexOf('已放弃') >= 0, 'round ' + r2 + '→' + r3);
      await shot(join(OUT, 'uipro-1d-selftarget.png'));
      await waitUnlock();
    }
  }

  /* ═══ ①-补：目标弹窗跨局残留必须连旧回调一起失效 ═══ */
  console.log('\n①-补 跨局弹窗');
  await evalJS('(function(){var p=document.getElementById("sel-players");p.value="3";p.dispatchEvent(new Event("change"));var d=document.getElementById("sel-diff");d.value="lv:hard";d.dispatchEvent(new Event("change"));document.getElementById("btn-newgame").click();return 1;})()');
  for (let i = 0; i < 50 && !(await evalJS('window.EpirusUI.B.packsReady')); i++) await sleep(100);
  await evalJS('(function(){window.EpirusUI.B.state.p[0].ep=2;window.EpirusUI.refresh();return 1;})()');
  await clickSkill('激光剑');
  await evalJS('(function(){var b=document.querySelectorAll("#modal-card #mbtn");if(b.length)b[0].focus();document.getElementById("btn-newgame").click();return 1;})()');
  await sleep(250);
  await evalJS('(function(){var p=document.getElementById("sel-players");p.value="2";p.dispatchEvent(new Event("change"));return 1;})()');
  for (let i = 0; i < 50 && !(await evalJS('window.EpirusUI.B.packsReady')); i++) await sleep(100);
  const stale = JSON.parse(await evalJS('(function(){var B=window.EpirusUI.B,c=document.getElementById("modal-card"),a=document.activeElement;return JSON.stringify({open:!document.getElementById("modal-root").classList.contains("hidden"),picking:B.picking,text:c.textContent,focusInside:!!(a&&c.contains(a)),round:B.state.round,locked:B.locked});})()'));
  check('①-补-甲 新局关闭旧弹窗、清空 picking/旧回调并移走弹窗焦点',
    !stale.open && stale.picking === null && stale.text === '' && !stale.focusInside && stale.round === 0 && !stale.locked,
    JSON.stringify(stale));
  check('①-补-乙 旧目标按钮已物理移除，不能再跨局落子', (await clickModalOption(1)) === 'no-option');

  console.log('\n①-补2 池加载挂起后切脚本档');
  await evalJS('window.__poolEnsure0=window.EpirusPoolLoader.ensure;window.EpirusPoolLoader.ensure=function(){return new Promise(function(){});}');
  await evalJS('(function(){var d=document.getElementById("sel-diff");d.value="lv:hard";d.dispatchEvent(new Event("change"));document.getElementById("btn-newgame").click();return 1;})()');
  await sleep(250);
  const hungBefore = await evalJS('JSON.stringify({ready:window.EpirusUI.B.packsReady,disabled:[].every.call(document.querySelectorAll(".skillbtn"),function(b){return b.disabled;})})');
  await evalJS('(function(){var d=document.getElementById("sel-diff");d.value="st:aggro";d.dispatchEvent(new Event("change"));return 1;})()');
  await sleep(250);
  const hungAfter = await evalJS('JSON.stringify({ready:window.EpirusUI.B.packsReady,ji:[].filter.call(document.querySelectorAll(".skillbtn"),function(b){return b.querySelector(".nm")&&b.querySelector(".nm").textContent==="ジ";})[0].disabled})');
  check('①-补2 切脚本档作废旧加载并恢复出招', JSON.parse(hungAfter).ready === true && JSON.parse(hungAfter).ji === false,
    'before=' + hungBefore + ' after=' + hungAfter);
  await evalJS('window.EpirusPoolLoader.ensure=window.__poolEnsure0;delete window.__poolEnsure0;');
  await clickSkill('ジ');
  await waitUnlock();

  /* ═══ ② 结算期间的点击：必须有反馈、且不排队 ═══ */
  console.log('\n② 结算期间的点击');
  for (let i = 0; i < 20 && (await locked()); i++) await sleep(120);
  await cancelIfModal();
  await waitUnlock();
  const beforeActions = await evalJS('(function(){var es=window.EpirusUI.B.state.events||[]; return es.filter(function(e){return e.type==="action"&&e.pid===0;}).length;})()');
  const rFirst = await clickSkill('ジ');
  await sleep(60);
  const lk = await locked();
  const hintDuring = await hintText();
  const second = await clickSkill('ジ');
  await sleep(60);
  const hintAfter = await hintText();
  console.log('   结算中：locked=' + lk + ' 第一下=' + rFirst + ' 途中再点=' + second);
  check('②-甲 结算期间点击给出**明确反馈**（提示改变，不再是静默丢弃）',
    lk === true && second === 'clicked' && hintAfter !== hintDuring, 'before="' + hintDuring + '" after="' + hintAfter + '"');
  await shot(join(OUT, 'uipro-2-locked-click.png'));
  await waitUnlock(); await sleep(900);
  const afterActions = await evalJS('(function(){var es=window.EpirusUI.B.state.events||[]; return es.filter(function(e){return e.type==="action"&&e.pid===0;}).length;})()');
  check('②-乙 被丢的那一下**没有排队补执行**（只落一手，不会出现"迟到的动作"）',
    (afterActions - beforeActions) <= 1, 'actions +' + (afterActions - beforeActions));

  /* ═══ ③ "ジ不足·未发动" 是否在真人座可复现 ═══ */
  console.log('\n③ "ジ不足·未发动"');
  for (let i = 0; i < 10; i++) {
    await cancelIfModal();
    await clickSkill('ジ');
    await sleep(500);
  }
  const insuffByPid = await evalJS('(function(){var es=window.EpirusUI.B.state.events||[]; var c={}; for(var i=0;i<es.length;i++){var e=es[i]; if(e.type==="action"&&e.outcome==="insufficient"){c[e.pid]=(c[e.pid]||0)+1;}} return JSON.stringify(c);})()');
  console.log('   insufficient 按座 = ' + insuffByPid);
  check('③ 真人座（pid 0）不产生"ジ不足·未发动"（格子已把买不起的置灰 ⇒ §5-③ 在当前构建不可复现）',
    insuffByPid === '{}' || !/"0":/.test(insuffByPid), 'byPid=' + insuffByPid);
  await shot(join(OUT, 'uipro-3-insufficient.png'));

  console.log('\n④ 收缩伤害独立保存');
  const sdSaved = JSON.parse(await evalJS('(function(){localStorage.removeItem("epirus.sudden");var on=document.getElementById("inp-sd"),dm=document.getElementById("inp-sd-dmg");on.value="";dm.value="2";dm.dispatchEvent(new Event("change"));document.getElementById("btn-newgame").click();var B=window.EpirusUI.B;return JSON.stringify({stored:JSON.parse(localStorage.getItem("epirus.sudden")),dmg:B.state.mode.suddenDeathDmg,onset:B.state.mode.suddenDeath,baseOnset:window.EpirusRules.MODES[B.modeKey].suddenDeath});})()'));
  check('④ 起扣回合留空时，单独修改伤害仍持久化并生效',
    sdSaved.stored.suddenDeathDmg === 2 && sdSaved.dmg === 2 && sdSaved.onset === sdSaved.baseOnset,
    JSON.stringify(sdSaved));

  console.log('\n⑤ 局中导入冠军后导出记录');
  await evalJS('(function(){var d=document.getElementById("sel-diff");d.value="lv:hard";d.dispatchEvent(new Event("change"));document.getElementById("btn-newgame").click();return 1;})()');
  for (let i = 0; i < 50 && !(await evalJS('window.EpirusUI.B.packsReady')); i++) await sleep(100);
  await clickSkill('ジ');
  await waitUnlock();
  await evalJS('window.alert=function(){}');
  await evalJS('(function(){var shell="window.EPIRUS_CHAMPION_3P="+JSON.stringify(window.EPIRUS_CHAMPION_3P)+";";var dt=new DataTransfer();dt.items.add(new File([shell],"local-test.bak",{type:"text/plain"}));var f=document.getElementById("file-import");f.files=dt.files;f.dispatchEvent(new Event("change"));return 1;})()');
  let imported = false;
  for (let i = 0; i < 50 && !imported; i++) { imported = await evalJS('!!localStorage.getItem("epirus.champion3p")'); if (!imported) await sleep(100); }
  await sleep(150);
  const afterImport = await evalJS('JSON.stringify({actual:window.EpirusUI.aiInfo().source,text:window.EpirusUI.battleText()})');
  const imp = JSON.parse(afterImport);
  check('⑤ 导入后导出追加换包记录，不再把实际本机包记成开局池成员',
    imported && imp.actual.indexOf('本机') >= 0 && imp.text.indexOf('中途换档=') >= 0 && imp.text.indexOf('本机冠军包') >= 0,
    'actual=' + imp.actual.slice(0, 80));

  console.log('\n⑥ 页内日志摘要与展开布局');
  await evalJS('document.getElementById("btn-champ-reset").click()');
  await sleep(200);
  await evalJS('(function(){var p=document.getElementById("sel-players");p.value="8";p.dispatchEvent(new Event("change"));var d=document.getElementById("sel-diff");d.value="lv:regular";d.dispatchEvent(new Event("change"));document.getElementById("btn-newgame").click();return 1;})()');
  for (let i = 0; i < 50 && !(await evalJS('window.EpirusUI.B.packsReady')); i++) await sleep(100);
  await clickSkill('ジ');
  await waitUnlock();
  const collapsed = JSON.parse(await evalJS('(function(){var d=document.getElementById("logdock"),b=d.getBoundingClientRect(),sk=document.getElementById("skillgrid").getBoundingClientRect(),side=document.getElementById("side-1").getBoundingClientRect(),a=document.getElementById("logsum-actions"),e=document.getElementById("logsum-events");return JSON.stringify({h:b.height,pos:getComputedStyle(d).position,top:b.top,skillOverlap:Math.max(0,sk.bottom-b.top),sideOverlap:Math.max(0,side.bottom-b.top),summary:getComputedStyle(document.getElementById("logsummary")).display,full:getComputedStyle(document.getElementById("logbox")).display,chips:a.querySelectorAll(".logsum-act").length,wrapA:getComputedStyle(a).flexWrap,wrapE:getComputedStyle(e).flexWrap,scrollA:a.scrollWidth<=a.clientWidth+1,scrollE:e.scrollWidth<=e.clientWidth+1,actions:a.textContent,events:e.textContent,fullText:document.getElementById("logbox").textContent});})()'));
  check('⑥-甲 收起态回到页面原位（非底部fixed），不遮挡战场且8人动作条完整自动换行',
    collapsed.pos === 'static' && collapsed.skillOverlap === 0 && collapsed.sideOverlap === 0 &&
      collapsed.summary !== 'none' && collapsed.full === 'none' && collapsed.chips === 8 &&
      collapsed.wrapA === 'wrap' && collapsed.scrollA && collapsed.fullText.length > 0,
    JSON.stringify({ h: collapsed.h, pos: collapsed.pos, overlap: [collapsed.skillOverlap, collapsed.sideOverlap], chips: collapsed.chips }));
  check('⑥-乙 特殊事件条自动换行无横向滚动条，且不重复面板已展示的EP/伤害/死亡/普通架势',
    collapsed.wrapE === 'wrap' && collapsed.scrollE && !/🔋|💥|☠|摆出【|完成蓄能|消耗 1 .*珠/.test(collapsed.events),
    JSON.stringify({ wrap: collapsed.wrapE, noHScroll: collapsed.scrollE, events: collapsed.events.slice(0, 140) }));
  await shot(join(OUT, 'uipro-6-log-summary-collapsed.png'));
  await evalJS('document.getElementById("btn-logdock").click()');
  await sleep(250);
  const expanded = JSON.parse(await evalJS('(function(){var d=document.getElementById("logdock"),b=d.getBoundingClientRect(),sk=document.getElementById("skillgrid").getBoundingClientRect(),side=document.getElementById("side-1").getBoundingClientRect(),lb=document.getElementById("logbox");return JSON.stringify({pos:getComputedStyle(d).position,top:b.top,width:b.width,skillOverlap:Math.max(0,sk.bottom-b.top),sideOverlap:Math.max(0,side.bottom-b.top),summary:getComputedStyle(document.getElementById("logsummary")).display,full:getComputedStyle(lb).display,h:lb.clientHeight,atBottom:lb.scrollHeight-lb.scrollTop-lb.clientHeight<5});})()'));
  check('⑥-丙 展开保持在原位整行面板，不覆盖技能栏且高度不超过320px',
    expanded.pos === 'static' && expanded.skillOverlap === 0 && expanded.sideOverlap === 0 && expanded.summary === 'none' &&
      expanded.full !== 'none' && expanded.h <= 320 && expanded.h >= 200 && expanded.atBottom,
    JSON.stringify(expanded));
  await shot(join(OUT, 'uipro-6-log-summary.png'));
  await evalJS('document.getElementById("btn-logdock").click()');
  await sleep(150);
  check('⑥-丁 收起后保留原位摘要并隐藏完整日志', await evalJS('getComputedStyle(document.getElementById("logdock")).position') === 'static' &&
    await evalJS('getComputedStyle(document.getElementById("logsummary")).display') !== 'none' &&
    await evalJS('getComputedStyle(document.getElementById("logbox")).display') === 'none');

  console.log('\n⑦ 密集事件回合应力');
  await clickSkill('ジ');
  await waitUnlock();
  await evalJS(`(function(){
    var B=window.EpirusUI.B, ev=[], guards=['防御','反弹','藤甲','八卦阵','金刚盾','原型制控'];
    if(!B.transcript.length) return false;
    for(var to=0;to<8;to++) for(var gi=0;gi<guards.length;gi++) ev.push({type:'blocked',to:to,by:guards[gi]});
    for(var n=1;n<=40;n++) ev.push({type:'firestorm',pid:n%8,n:n});
    B.transcript[0].events=ev;
    document.getElementById('btn-undo').click();
    return true;
  })()`);
  await sleep(250);
  const storm = JSON.parse(await evalJS('(function(){var a=document.getElementById("logsum-actions"),e=document.getElementById("logsum-events"),d=document.getElementById("logdock");return JSON.stringify({actions:a.querySelectorAll(".logsum-act").length,events:e.querySelectorAll(".logsum-event").length,wrapA:getComputedStyle(a).flexWrap,wrapE:getComputedStyle(e).flexWrap,scrollA:a.scrollWidth<=a.clientWidth+1,scrollE:e.scrollWidth<=e.clientWidth+1,h:d.getBoundingClientRect().height,pos:getComputedStyle(d).position});})()'));
  check('⑦ 88 条特殊事件自动换行且无横向滚动，8 人动作条仍完整',
    storm.actions === 8 && storm.events === 88 && storm.wrapA === 'wrap' && storm.wrapE === 'wrap' && storm.scrollA && storm.scrollE && storm.pos === 'static',
    JSON.stringify(storm));
  await evalJS('document.getElementById("logdock").scrollIntoView({block:"start"})');
  await sleep(100);
  await shot(join(OUT, 'uipro-7-log-summary-stress.png'));

  console.log('\nJS errors: ' + (errors.length ? errors.join(' | ') : '(none)'));
  const fail = checks.filter(function (c) { return !c[1]; }).length;
  console.log('UI 探针：' + (checks.length - fail) + ' / ' + checks.length + (fail ? '  （有 FAIL ⇒ 需要修）' : '  （全过）'));
  return fail;
}

main().then(function (fail) { clearTimeout(watchdog); killTree(); process.exit(fail ? 1 : 0); })
  .catch(function (e) { console.error('探针异常: ' + (e && e.stack || e)); clearTimeout(watchdog); killTree(); process.exit(2); });
