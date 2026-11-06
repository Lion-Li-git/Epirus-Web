/* 实跑审计：哪些工具头的 sandbox 解得开 v:92（代 3）容器。
 * 病（11-03 查实）：`js/train/policy.js::unpack` 见 `o.v === 92` 就转交 `EpirusPolicy2`，
 *   而各工具自己抄了一份引擎清单 ⇒ 少抄 `js/train/policy2.js` 的那些，对**每一枚 gen-3 包**读不出权重；
 *   读不出之后**有的静默当"通过"**（`gate-drafts` exit 64 ⇒ promote 印「✅ 候选自己全过」），有的印"跳过"。
 * 这里不猜：按每份清单现装 sandbox，把一枚真 v:92 容器喂进去看解不解得开。
 * 用法：node scratch/audit-v92-loaders.mjs [--pack=<v:92 包>] [--dirs=tools,tools/gates,...] */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const REPO = process.cwd() + '/';
const PACK = (process.argv.find((a) => a.indexOf('--pack=') === 0) || '').slice(7)
  || 'scratch/night4/CB-s13.js';
const DIRS = ((process.argv.find((a) => a.indexOf('--dirs=') === 0) || '').slice(7)
  || 'tools,tools/gates,tools/proto2,champion-map,server,js/train').split(',');

if (!existsSync(REPO + PACK)) {
  console.error('⛔ 夹具包不存在：' + PACK + ' ⇒ 这是一台本地实跑（研究用），需要一枚真 v:92 包；干净克隆里没有（night4 未提交）');
  process.exit(2);
}
/* 夹具 = 从包里抠出容器（`window.EPIRUS_CHAMPION_3P = {…};`） */
const packTxt = readFileSync(REPO + PACK, 'utf8');
const m = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(packTxt);
if (!m) { console.error('⛔ 夹具里抠不出 EPIRUS_CHAMPION_3P 容器'); process.exit(2); }
const CONTAINER = JSON.parse(m[1].replace(/window\./g, ''));
if (CONTAINER.v !== 92) { console.error('⛔ 夹具不是 v:92（读到 v=' + CONTAINER.v + '）⇒ 本审计无意义'); process.exit(2); }

/* 参照组：一份**确定带 policy2** 的清单，证明"这枚容器本身解得开"（否则全表 0 是我夹具坏了，不是工具坏了） */
function tryUnpack(files) {
  const sb = { console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
  sb.window = sb; sb.globalThis = sb;
  try {
    for (const f of files) {
      const p = REPO + f;
      if (!existsSync(p)) return { err: '清单里有文件不存在: ' + f };
      vm.runInNewContext(readFileSync(p, 'utf8'), sb, { filename: f });
    }
    const P = sb.window.EpirusPolicy;
    if (!P) return { err: 'sandbox 里没有 EpirusPolicy' };
    let params = null, thrown = null;
    try { params = P.unpack(JSON.parse(JSON.stringify(CONTAINER)), true); } catch (e) { thrown = e.message; }
    const has2 = !!sb.window.EpirusPolicy2;
    return { has2, ok: !!(params && params.length), thrown, n: params ? params.length : null };
  } catch (e) { return { err: '装 sandbox 失败: ' + e.message }; }
}

const REF = ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/policy2.js', 'js/train/evo.js'];
const ref = tryUnpack(REF);
console.log('参照组（清单含 policy2）→ unpack ' + (ref.ok ? 'OK（' + ref.n + ' 参数）' : 'FAIL: ' + (ref.thrown || ref.err)) + ' ‖ EpirusPolicy2 在场=' + ref.has2);
if (!ref.ok) { console.error('⛔ 参照组自己就解不开 ⇒ 夹具或引擎坏了，本批读数作废'); process.exit(3); }
console.log('夹具 = ' + PACK + '（v:92 ‖ 参数 ' + ref.n + '）\n');

/* 每个工具：把它源码里那些"含 policy.js 的数组字面量"当作清单来实跑 */
const LIST_RE = /\[((?:\s*'[^\[\]]*'\s*,?)+)\]/g;
const rows = [];
for (const d of DIRS) {
  const abs = REPO + d;
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs)) {
    if (!/\.(mjs|js)$/.test(f)) continue;
    const rel = d + '/' + f;
    if (rel === 'scratch/audit-v92-loaders.mjs') continue;
    let txt; try { txt = readFileSync(REPO + rel, 'utf8'); } catch (e) { continue; }
    const lists = [];
    let mm;
    while ((mm = LIST_RE.exec(txt))) {
      const items = mm[1].match(/'([^']+)'/g);
      if (!items) continue;
      const files = items.map((s) => s.slice(1, -1));
      if (files.includes('js/train/policy.js')) lists.push(files);
    }
    if (!lists.length) continue;
    for (const files of lists) {
      const r = tryUnpack(files);
      rows.push({ rel, has2: files.includes('js/train/policy2.js'), r, n: files.length });
    }
  }
}
let bad = 0;
console.log('清单 | 含 policy2 | v:92 解得开？ | 参数数 | 报错');
for (const x of rows.sort((a, b) => (a.has2 === b.has2 ? a.rel.localeCompare(b.rel) : (a.has2 ? 1 : -1)))) {
  const verdict = x.r.err ? 'ERR ' + x.r.err : (x.r.ok ? '✔ 解得开' : '✘ 解不开（' + (x.r.thrown || '返回空') + '）');
  if (!x.r.ok) bad++;
  console.log(x.rel + ' | ' + (x.has2 ? '是' : '**否**') + ' | ' + verdict + ' | ' + (x.r.n || '—') + ' | ' + (x.r.thrown || x.r.err || ''));
}
console.log('\n共扫 ' + rows.length + ' 份引擎清单 ⇒ **解不开 v:92 的 ' + bad + ' 份**（这些工具对每一枚 gen-3 包都读不出权重）');
console.log('注：本审计只判"解不解得开"，不判该工具**该不该**支持 gen-3（2P 槽那类按设计只吃 v7 的，得点名后再定）。');
