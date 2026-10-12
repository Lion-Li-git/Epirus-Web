#!/usr/bin/env node
/* build-pool-bundle.mjs —— 把池真源表派生成**浏览器读得动的那一份**（§E590 · 契约见 `docs/POOL-CONTRACT.md`）
 *
 * 为什么是内嵌 bundle 而不是运行时取包：游戏是**双击 index.html** 跑的（`server/train-server.mjs:3` 的注释原话），
 *   页面在 `file://` 上 ⇒ Chrome 不让 fetch 本地文件，而训练服务器不 serve 静态目录。
 *   ⇒ "运行时按 path 取包"在真实入口下不成立（我一开始选的就是这条错路，写在契约 §1）。
 *
 * 三条不可省的规矩：
 *   ① **每条成员重新算一遍 wid** 并与表里的 `wid` 相等 ⇒ 不等就 exit 2。
 *      这是防"名字对、包不对"：表与 bundle 是两次读盘，中间包被人换过（§E589 那 301 份拷贝）就会被这里逮住。
 *   ② **空表不许静默出货**：成员 0 枚 ⇒ exit 2（要显式 `--allow-empty` 才写空池 ⇒ 页面会走"池未生效"的降级）。
 *   ③ 输出文件头写明"由谁生成，不要手改"，与 `server/train-server.mjs` 的 `writeBundle` 同一句话风格。
 *
 * 用法：node tools/build-pool-bundle.mjs [--out=js/bundled-champion-pool.js] [--allow-empty] [--dry]
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { braceObj, widOfArr } from '../champion-map/pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
/* §E599（2P 池 · 用户 10-12「2p 每次只要一个对手就行了，池子不需要很大」）：
 *   加 `--table=` 与 `--key=` ⇒ 同一个构建器能出**第二份池**（2P），产物 `js/bundled-champion-pool-2p.js`。
 *   为什么必须参数化而不是抄一份：本仓为"同一条口径抄两遍"栽过多次（本文件头 ①②③ 三条都是那次教训）。
 *   ⚠ 2P 包的外壳是 `EPIRUS_CHAMPION`（3P 池成员是 `EPIRUS_CHAMPION_3P`）⇒ `--key=` 不是装饰，
 *     传错会**响亮**红在"解不出权重数组"上，不会静默出空池。 */
const absPath = p => (p.indexOf(':') >= 0 || p[0] === '/' || /^[A-Za-z]:[\/\\]/.test(p)) ? p : join(ROOT, p);
const MAP = absPath(arg('table', 'champion-map/pool-members.tsv'));
const KEY = arg('key', 'EPIRUS_CHAMPION_3P');
/* ⚠ 全局名也必须参数化 —— §E599 的血证：第一版这里硬编码 `EPIRUS_CHAMPION_POOL`，
 *   于是 2P 池 bundle 写的是 **3P 那个全局**，按 `index.html` 的加载顺序它把 3P 池（27 枚）**顶成了 7 枚 2P 包**，
 *   而页面侧 `EPIRUS_CHAMPION_POOL_2P` 根本不存在 ⇒ 5 人桌静默用错池、2P 池不生效。
 *   抓到它的是**真页面**（`tools/battle-test.mjs` 的 `[对手AI=…]` 标签），不是 code review。 */
const GLOBAL = arg('global', 'EPIRUS_CHAMPION_POOL');
const OUT = arg('out', 'js/bundled-champion-pool.js');

if (!existsSync(MAP)) { console.error('⛔ 真源表不在：' + MAP + '（先用 tools/pool-add.mjs 加成员）'); process.exit(2); }
const L = readFileSync(MAP, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
const h = Object.fromEntries(L[0].split('\t').map((x, i) => [x, i]));
for (const c of ['id', 'wid', 'path', 'tier', 'invited', 'promoteVerdict', 'seatKill']) {
  if (h[c] === undefined) { console.error('⛔ 真源表缺列 ' + c); process.exit(2); }
}
const rows = L.slice(1).map(l => l.split('\t')).filter(r => r.length > h.tier);
if (!rows.length && !process.argv.includes('--allow-empty')) {
  console.error('⛔ 池里 0 枚成员 ⇒ 不出货（空 bundle 会让页面静默退回单包，那是"看起来正常"的坏）。要真空池加 --allow-empty');
  process.exit(2);
}

const members = [];
let bytes = 0;
for (const r of rows) {
  const rel = r[h.path], abs = join(ROOT, rel);
  if (!existsSync(abs)) { console.error('⛔ 成员 ' + r[h.id] + ' 的包文件不在盘上：' + rel); process.exit(2); }
  const txt = readFileSync(abs, 'utf8');
  /* 取权重数组：`.bak`/`.js` 外壳里那一个赋值（`packArr` 的坑注释解释了为什么不能裸 indexOf 名字） */
  const KEYX = KEY;
  let o = null;
  for (let k = txt.indexOf(KEYX); k >= 0; k = txt.indexOf(KEYX, k + 1)) {
    if (!/^\s*=/.test(txt.slice(k + KEYX.length, k + KEYX.length + 4))) continue;
    const c = braceObj(txt, k); if (c && Array.isArray(c.a)) { o = c; break; }
  }
  if (!o) { console.error('⛔ ' + rel + ' 解不出权重数组 ⇒ 这一枚不许进池（缺行 ≠ 相等）'); process.exit(2); }
  const w = widOfArr(o.a);
  if (w !== r[h.wid]) { console.error('⛔ 名字对、包不对：' + r[h.id] + ' 表里 wid=' + r[h.wid] + ' 而文件算出 ' + w + '（' + rel + '）'); process.exit(2); }
  members.push({
    id: r[h.id], wid: w, tier: r[h.tier], invited: r[h.invited] === '1',
    promoteVerdict: r[h.promoteVerdict], seatKill: Number(r[h.seatKill]),
    pack: o,
  });
  bytes += statSync(abs).size;
}
const byTier = {};
for (const m of members) byTier[m.tier] = (byTier[m.tier] || 0) + 1;

const body = '/* Epirus 冠军池：由 tools/build-pool-bundle.mjs 生成（真源 ' + arg('table', 'champion-map/pool-members.tsv') + '）。不要手改。\n' +
  ' * 成员 ' + members.length + ' 枚 ' + JSON.stringify(byTier) + ' ‖ 源文件合计 ' + (bytes / 1024).toFixed(0) + ' KB ‖ 生成于 ' + new Date().toString() + '\n' +
  ' * 契约（装配语义 / 抽签 / 降级）见 docs/POOL-CONTRACT.md —— 本页与量具、门禁 D234 必须逐字对齐那份契约。 */\n' +
  '(function (global) {\n  \'use strict\';\n' +
  '  global.' + GLOBAL + ' = ' + JSON.stringify({ built: new Date().toString(), members: members }) + ';\n' +
  '})(typeof window !== \'undefined\' ? window : globalThis);\n';

console.log('== 生成池 bundle ==');
console.log('   成员 ' + members.length + ' 枚：' + JSON.stringify(byTier) + ' ‖ 每枚 wid 已逐条重算并核对 ✅');
for (const m of members) {
  console.log('   · ' + (m.id + '              ').slice(0, 15) + m.tier + ' · 体检 ' + m.promoteVerdict +
    ' · 人席否决 ' + (m.seatKill < 0 ? '没量过' : m.seatKill + ' 格') + (m.invited ? ' · 点名' : '') + ' · wid=' + m.wid.slice(0, 8));
}
const 不足 = Object.keys(byTier).filter(t => byTier[t] < 4);
if (不足.length) console.log('   ⚠ 这些档成员数 < 4 席 ⇒ 抽签必然出现重复（用户裁定②允许部分重复），组成里会出现同枚：' + 不足.join(' ‖ '));
/* 契约 §3.7：`== 4` 时"洗牌取前 4"= 全员上场 ⇒ **抽签不产生阵容变化**，只有席位排列在变。
 *   这一档看着"池在工作"（没有降级、没有全同），实际玩家每场遇到的是同一批包 —— 所以必须说出来。 */
const 刚好 = Object.keys(byTier).filter(t => byTier[t] === 4);
if (刚好.length) console.log('   ⚠ 这些档成员数 **正好等于 4 席** ⇒ 每枚每场都上场、阵容不会变（只有席位在换）：' + 刚好.join(' ‖ ') +
  ' ⇒ 要阵容多样性得补到 ≥5 枚（见 docs/POOL-CONTRACT.md §3.7）');
if (process.argv.includes('--dry')) { console.log('（--dry：没写文件）将写 ' + OUT + '，' + (body.length / 1024).toFixed(0) + ' KB'); process.exit(0); }
writeFileSync(join(ROOT, OUT), body);
console.log('✔ 已写 ' + OUT + '（' + (body.length / 1024).toFixed(0) + ' KB）');
console.log('   下一步：把这枚 bundle 作为 <script defer> 挂进 index.html（?v= 由 bumpChampionVersion 统一刷），并跑 `node tools/probe-pool.mjs`');
