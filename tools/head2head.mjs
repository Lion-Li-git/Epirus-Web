/* 头对头：今夜产物 vs 线上包（1 席被测 · 4 席对手 · 轮座 · 同 seed 同盐，正反两向都跑）
 * 为什么要它：`targeter` 场上 +27.5pt 的那只（`v7l2f-81`，82.3% 出手在防御族）**是不是真的更强**？
 *   专用场的读数只能说明"它在那种对手面前活得久"，说明不了"人和它打更带劲/它更能打"。
 *   头对头是唯一能一句话回答"要不要换包"的量具（而且**不换包**，这只是给判断用的证据）。
 * 两向都跑是因为**座位会漏进身份通道**（历史上一整族 L7 事故都是这个形状）：
 *   正向 = 被测占 1 席打 4 席线上包；反向 = 被测占 4 席打 1 席线上包。两向不对称就要单独报出来。
 * 用法：node tools/head2head.mjs [GAMES=80] [包...]（默认线上包 + 今夜各臂一个 seed）
 */
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const S = sb.window.EpirusState, Play = sb.window.EpirusPlay, T = sb.window.EpirusTrainer,
  P = sb.window.EpirusPolicy, R = sb.window.EpirusRules;
const argv = process.argv.slice(2);
const N = Number(argv[0] && /^\d+$/.test(argv[0]) ? argv.shift() : 80);
/* 默认扫**全部**今夜产物 + 昨夜两臂 + 上一版线上包的旧产物 ⇒ 头对头是判据第一条，
 * 就不该逼人手工点名文件（漏一个 seed 就又是一次"样本里少一格"）。 */
const ART = 'docs/artifacts';
const auto = readdirSync(ART).filter(f => /^(v7l2[a-z]?|v7ring[AB]1|v7new5_005|v7seat24)-\d+\.bak$/.test(f)).sort().map(f => ART + '/' + f);
const FILES = argv.length ? argv : auto;
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
const ch = p => T.policyChooserN(p, 0.15);
const LIVE = ch(load('js/bundled-champion-3p.js'));
function duel(major, minor, mode, seed0) {
  let win = 0, draw = 0, taken = 0, dealt = 0;
  for (let g = 0; g < N; g++) {
    const seat = g % 5;
    const st = S.createState(mode, { next: mb(seed0 + g * 991) }, 5);
    st.slotSalt = h32(seed0 + g * 2246822519);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(i === seat ? major : minor);
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draw++; else if (st.winner === seat) win++;
    for (const e of st.events) { if (e.type === 'damage' && e.to === seat) taken += e.amt || 1; if (e.type === 'damage' && e.source === seat) dealt += e.amt || 1; }
  }
  return { win: 100 * win / N, draw: 100 * draw / N, taken: taken / N, dealt: dealt / N };
}
console.log(`=== 头对头（${N} 局轮座 · 同 seed 同盐 · 基线 20%；正向=被测 1 席，反向=被测 4 席）===`);
for (const f of FILES) {
  if (f.includes('bundled')) continue;
  let p; try { p = load(f); } catch (e) { console.log(`  跳过 ${f}: ${e.message}`); continue; }
  const me = ch(p);
  for (const mode of ['multi', 'long']) {
    const a = duel(me, LIVE, mode, 314159);     // 被测 1 席 vs 线上包 4 席
    const b = duel(LIVE, me, mode, 314159);     // 线上包 1 席 vs 被测 4 席
    console.log(`  ${f.split('/').pop().replace('.bak', '').padEnd(14)} [${mode}]  被测1席 ${a.win.toFixed(1)}%(和${a.draw.toFixed(0)}) 承${a.taken.toFixed(1)}  被测4席(线上包1席打它) ${b.win.toFixed(1)}%(和${b.draw.toFixed(0)}) 承${b.taken.toFixed(1)}`
      + `  ⇒ 反向：线上包 1 席打 4 席它时只剩 ${b.win.toFixed(1)}%（基线 20% ⇒ 越低说明它越强）`);
  }
}
