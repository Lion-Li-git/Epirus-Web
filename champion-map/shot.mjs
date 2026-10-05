/* shot.mjs —— 无头复验查看器的两条腿：截图 + 页内断言（§E337）。
 *
 * 为什么要有这份工具（本仓踩过的形状）：查看器的病**几乎全都只在交互里现形**
 *   （悬停串行、点选后全暗、进 3D 变小），而"看着截图说改好了"证明不了这些。
 *   browser-use 那类受控标签常常没有视口（实测 canvas 1×1 ⇒ 布局数学整个是假的），
 *   所以判据只能是：**自己起一个有窗口的无头 Chrome**，要么截图给人看，要么让页面自己把断言写进 DOM。
 *
 * 用法：
 *   node champion-map/shot.mjs --hash=mode=tree&3d=1 --out=docs/artifacts/e337-out/tree-3d.png
 *   node champion-map/shot.mjs --hash=mode=tree&check=1 --dump            # 打印页内自检结果（不截图）
 *   退出码：0 = 断言全过（或没要断言）‖ 1 = 有 FAIL ‖ 2 = 浏览器没跑出结果（宁可红也不许假绿）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => existsSync(p));
if (!CHROME) { console.error('⛔ 没找到 Chrome/Edge ⇒ 无头复验跑不了（别改成"只看代码就算过"）'); process.exit(2); }

const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DUMP = process.argv.indexOf('--dump') >= 0;
const HASH = arg('hash', '');
const WIN = arg('win', '1600,900');
const BUDGET = arg('budget', '12000');
const PAGE = 'file:///' + join(HERE, 'index.html').replace(/\\/g, '/') + (HASH ? '#' + HASH : '');
const OUT = DUMP ? '' : resolve(arg('out', join(HERE, 'shot.png')));
if (!DUMP && !OUT) { console.error('⛔ 既没给 --out 也没给 --dump'); process.exit(2); }
if (!DUMP) { const d = dirname(OUT); if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

/* 每次独立 profile：并发跑两个无头 Chrome 会共用默认 profile 而互相掐死（本仓并发改造那节的教训）*/
const prof = join(ROOT, 'docs', 'artifacts', 'e337-out', 'chrome-profile');
if (existsSync(prof)) { try { rmSync(prof, { recursive: true, force: true }); } catch (e) { /* 上一份还在退出 ⇒ 换不到就用新的目录名 */ } }
const profile = prof + (DUMP ? '-d' : '-s');

const flags = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--window-size=' + WIN, '--user-data-dir=' + profile,
  '--virtual-time-budget=' + BUDGET, '--run-all-compositor-stages-before-draw'];
if (DUMP) flags.push('--dump-dom'); else flags.push('--screenshot=' + OUT);
flags.push(PAGE);

const r = spawnSync(CHROME, flags, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (r.error) { console.error('⛔ 起浏览器失败：' + r.error.message); process.exit(2); }

if (DUMP) {
  const html = r.stdout || '';
  const m = /<div id="selftest"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  if (!m) { console.error('⛔ 页面没落 #selftest ⇒ 断言根本没跑（这不是"通过"，是没跑）。hash=' + HASH); process.exit(2); }
  const txt = m[1].replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
  console.log(txt);
  /* 只数**逐条断言行**（行首 PASS/FAIL）。第一版顺手 grep 整段文本，把页眉那句"9 PASS / 2 FAIL"
   *   也算进来了 ⇒ 报出 10/3，一个谁都没跑过的数。计数也要有出处。 */
  const lines = txt.split('\n').map(s => s.trim());
  const fails = lines.filter(s => /^FAIL\b/.test(s));
  console.log('\n断言：' + lines.filter(s => /^PASS\b/.test(s)).length + ' PASS ‖ ' + fails.length + ' FAIL');
  if (fails.length) console.log(fails.map(s => '  ' + s).join('\n'));
  if (!lines.some(s => /^(PASS|FAIL)\b/.test(s))) { console.error('⛔ 一条断言都没跑（这不是全绿）'); process.exit(2); }
  process.exit(fails.length ? 1 : 0);
}
if (!existsSync(OUT)) { console.error('⛔ 截图没落盘（' + OUT + '）‖ stderr: ' + (r.stderr || '').slice(0, 300)); process.exit(2); }
console.log('已截 ' + OUT + '（' + WIN + ' ‖ hash=' + HASH + ' ‖ ' + statSync(OUT).size + ' 字节）');
