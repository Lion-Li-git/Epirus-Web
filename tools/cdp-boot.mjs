/* cdp-boot.mjs —— 起一个 headless Chrome 并等它的 CDP 端口，**单一实现**（v1.7.5 · 10-13 夜班 S0）
 *
 * ## 为什么单独抽一台（不是洁癖，是这条红读不出成败）
 * 同一份"spawn Chrome + `waitJson`"在本仓抄了 **7 份**（`tools/smoke.mjs` ‖ `battle-test.mjs` ‖ `np-probe.mjs` ‖
 *   `remote-probe.mjs` ‖ `ui-probe.mjs` ‖ `champion-map/_probe-{pan,winflick,e330,legend}.mjs`），
 *   而每一份都用 `{ stdio: 'ignore' }` 起 Chrome ⇒ **Chrome 自己的报错被丢掉了**。
 *   后果（10-13 实测，用户贴的 CI 判词）：windows runner 上 `smoke` 报
 *   `CDP endpoint not reachable: http://127.0.0.1:9337/json/version`，而**同一把尺本机 10.7s 绿**
 *   ⇒ 三种可能（没装 Chrome / 起了但没绑上端口 / 绑得慢过等待预算）**在日志里长得一模一样**。
 *   本台的职责就是把这三者分开：解析到的路径、进程是否还活着、stderr 的最后若干行，全部打出来。
 *
 * ## 三条规矩（本仓栽过的形状）
 * ① **找不到可执行文件要响亮**：报出找过哪些路径，`exit 4`；不许退化成"CDP 连不上"那种指错方向的话。
 * ② **等待预算不许静默放宽**：默认仍是 60 × 200ms = 12s；要调就显式 `--cdp-wait=N`（次数），
 *    并且超时信息里必须带上"等了多久 ‖ Chrome 是否还活着 ‖ stderr 尾巴"。
 * ③ **收尸**：调用方 `killTree()` 或看门狗超时都要杀进程树 + 删临时 profile（原来 `smoke.mjs` 那段注释
 *    记的就是"node 被杀 ⇒ finally 不跑 ⇒ 孤儿 headless Chrome"）。
 *
 * 自检：`node tools/cdp-boot.mjs --self-test` —— 两格都是**手算得出来**的：
 *   ① 指向不存在的 exe ⇒ 必须报"找过这些路径"并给非零退出；
 *   ② 拿 `node` 当假 Chrome（它只会往 stderr 打一行字然后退出）⇒ 必须报"进程已退出"并把那行 stderr 打出来
 *      ⇒ 这一格证明"stderr 真的被接住了"，不是只写在注释里。
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CAND = process.platform === 'win32'
  ? [process.env.EPIRUS_CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'chrome.exe']
  : process.platform === 'darwin'
    ? [process.env.EPIRUS_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'google-chrome']
    : [process.env.EPIRUS_CHROME, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium', '/usr/bin/chromium-browser', 'chromium-browser'];

/** 解析 Chrome：显式参数 → EPIRUS_CHROME → 各平台标准位置 → PATH 里找。全落空返回 null（调用方负责响亮退出） */
export function resolveChrome(explicit) {
  const tried = [];
  for (const c of [explicit].concat(CAND)) {
    if (!c) continue;
    tried.push(c);
    if (existsSync(c)) return { path: c, tried };
    if (!/[\\/]/.test(c)) {                       // 裸名字：交给 PATH 找（win 上用 where，其余用 which）
      const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [c], { encoding: 'utf8' });
      const hit = (r.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
      if (hit && existsSync(hit)) return { path: hit, tried };
    }
  }
  return { path: null, tried };
}

/** 起 Chrome 并等 CDP。返回 { proc, port, udd, version, waitReady(), killTree(), stderrTail() } */
export function launchChrome(opt) {
  const o = opt || {};
  const port = Number(o.port || 9337);
  const res = resolveChrome(o.chrome);
  if (!res.path) {
    const e = new Error('环境里找不到 Chrome 可执行文件 ⇒ 这不是页面的问题，是这台仪器跑不了。找过：\n  ' +
      res.tried.join('\n  ') + '\n  （显式指定：`--<chrome路径>` 或设 `EPIRUS_CHROME=`）');
    e.code = 'NO_CHROME'; e.tried = res.tried; throw e;
  }
  const udd = mkdtempSync(join(tmpdir(), 'epirus-cdp-'));
  const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + port, '--user-data-dir=' + udd, 'about:blank'].concat(o.extraArgs || []);
  const proc = spawn(res.path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  /* stderr 收进环形缓冲：Chrome 起不来时那几行就是唯一现场（原来 stdio:'ignore' 把它整条丢了） */
  let err = '';
  if (proc.stderr) proc.stderr.on('data', d => { err = (err + String(d)).slice(-8000); });
  let spawnErr = null;
  proc.on('error', e => { spawnErr = e; });
  let alive = true;
  proc.on('exit', () => { alive = false; });
  const killTree = () => {
    try {
      if (process.platform === 'win32' && proc.pid) spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
      else proc.kill('SIGKILL');
    } catch (e) { }
    try { rmSync(udd, { recursive: true, force: true }); } catch (e) { }
  };
  const tail = () => err.split(/\r?\n/).filter(Boolean).slice(-12).join('\n  ');
  async function waitJson(url, tries) {
    const n = tries || 60;
    for (let i = 0; i < n; i++) {
      if (spawnErr) throw new Error('Chrome 进程报错：' + spawnErr.message + '\n  路径 = ' + res.path + '\n  stderr:\n  ' + tail());
      if (!alive && i > 2) throw new Error('Chrome 进程**已退出**（不是慢，是死了）⇒ 路径 = ' + res.path +
        '\n  退出前 stderr:\n  ' + tail());
      try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { }
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('CDP endpoint not reachable: ' + url + '\n  等了 ' + (n * 200 / 1000) + 's ‖ 路径 = ' + res.path +
      '\n  进程还活着 = ' + alive + ' ‖ spawn 错误 = ' + (spawnErr && spawnErr.message) + '\n  stderr 尾部:\n  ' + tail());
  }
  return {
    proc, port, udd, chromePath: res.path, killTree,
    version: () => waitJson(`http://127.0.0.1:${port}/json/version`, o.tries),
    tabs: () => waitJson(`http://127.0.0.1:${port}/json/list`, o.tries),
    waitJson
  };
}

/* ---------------- 自检 ---------------- */
async function selfTest() {
  const bad = [];
  /* ① 不存在的路径 ⇒ 必须响亮、并且把找过的位置说出来（负向：不许退化成"CDP 连不上"） */
  const before = process.argv;
  try {
    const r = resolveChrome('Z:/definitely-not-here/chrome-nope.exe');
    if (r.path && /chrome-nope/.test(r.path)) bad.push('① 不存在的路径被当成了有效 Chrome：' + r.path);
  } catch (e) { bad.push('① resolveChrome 抛了没定义的错：' + e.message); }
  /* ② 拿 node 当假 Chrome：它只往 stderr 打一行就退出 ⇒ 报错信息里必须出现那一行（证明 stderr 真被接住） */
  const fake = process.execPath;
  let got = '';
  try {
    const L = launchChrome({ chrome: fake, port: 9411, tries: 6 });
    /* node 不认 --headless=new 这些参数 ⇒ 会立刻报错退出；正好用来验"死了"那条分支 */
    await L.version();
    L.killTree();
    got = 'no-throw';
  } catch (e) { got = String(e.message); }
  if (got === 'no-throw') bad.push('② 假 Chrome（node 自己）居然"就绪"了 ⇒ 等待判据是假的');
  else if (!/已退出|报错|not reachable/.test(got)) bad.push('② 失败信息没说出进程状态：' + got.slice(0, 160));
  else if (!/stderr/.test(got)) bad.push('② 失败信息里没有 stderr 段 ⇒ stdio 还是被丢了：' + got.slice(0, 200));
  console.log(bad.length ? '✘ cdp-boot 自检红：\n  - ' + bad.join('\n  - ')
    : '✔ cdp-boot 自检过（① 找不到就报路径清单 ② 进程死了会说出来且带上 stderr）');
  process.exit(bad.length ? 2 : 0);
}
if (process.argv.includes('--self-test')) selfTest();
