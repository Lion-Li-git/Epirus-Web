/* 拥挤度（同族互杀）量具 —— 回答 §14e 那个悬着的问题：
 *   `v7l2c-82` 正向 45%（1 席打 4 席线上包）而反向"线上包 1 席打 4 席它"拿到 35%（> 20% 基线）。
 *   两种解释都能fit：① 它其实不强；② **4 份同一个包会互相挤压**（同族互杀），所以"4 席它"这个场本身就扣了它的分。
 *   ⇒ §9 早就把反向降格成"诊断"，但那是**机制猜测**，没量过。这个探针把它变成数：
 * **对手固定为 random（与"强不强"无关），只改同一个包的席位份数 k=1/2/4，看每席位胜率怎么掉。**
 *   拥挤指数 = 每席位(k=4) / 每席位(k=1)。=1 ⇒ 无互杀；越小 ⇒ 越依赖"队里只有一个我"。
 * ⚠ 读数口径：**每席位**胜率，不是合计 —— 合计必然随 k 上升，那没信息量。
 *   对手用 random 而不是线上包，是为了把"对手强度"和"同族拥挤"分开；
 *   代价是它量的是**纯拥挤**，不含"和强者同场时的挤压"，所以它是一个**下界式的诊断**，不是判据。
 * 用法：node tools/crowding.mjs [GAMES=80] [包...]（默认：线上包 + 今夜双方向都进短名单的那几个）
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const REPO = process.env.EPIRUS_REPO || './';
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/bundled-champion-3p.js']) {
  vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
}
const S = sb.window.EpirusState, Play = sb.window.EpirusPlay, T = sb.window.EpirusTrainer,
  P = sb.window.EpirusPolicy, B = sb.window.EpirusBots;
if (!B || typeof B.pickRandom !== 'function') throw new Error('拿不到 EpirusBots.pickRandom ⇒ 这个量具的对手就无从谈起，请检查 bots.js 的导出');
const argv = process.argv.slice(2);
const N = Number(argv[0] && /^\d+$/.test(argv[0]) ? argv.shift() : 80);
const FILES = argv.length ? argv : ['js/bundled-champion-3p.js', 'docs/artifacts/v7l2c-82.bak', 'docs/artifacts/v7l2c-103.bak',
  'docs/artifacts/v7l2f-101.bak', 'docs/artifacts/v7l2f-106.bak', 'docs/artifacts/v7l2s-82.bak', 'docs/artifacts/v7l2h-81.bak'];
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
/* 一场：k 席被测（座位连续、按局轮转起点以摊平座位效应），其余 random */
function run(me, k, mode, seed0, oppOverride) {
  let wins = 0, draws = 0;
  /* 对手可选是为了做**控制实验**：候选包在 k=1 打 random 时普遍 80~92%，而线上包只有 54~58% ——
   * 差得太大，必须先排除"random 太软 / 我这个装配把对手削弱了"这个解释 ⇒ `CROWD_OPP=balanced` 再量一遍。 */
  const OPP = (process.env.CROWD_OPP || 'random').toLowerCase();
  const BN = 'pick' + OPP.charAt(0).toUpperCase() + OPP.slice(1);
  const rnd = B[BN] ? ((st, pid, lg) => B[BN](st, pid, lg)) : (() => { throw new Error('EpirusBots 里没有 ' + BN); });
  for (let g = 0; g < N; g++) {
    const off = g % 5;
    const mine = []; for (let i = 0; i < k; i++) mine.push((off + i) % 5);
    const st = S.createState(mode, { next: mb(seed0 + g * 991) }, 5);
    st.slotSalt = h32(seed0 + g * 2246822519);
    const cs = []; for (let i = 0; i < 5; i++) cs.push(mine.indexOf(i) >= 0 ? me : (oppOverride || rnd));
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draws++; else if (mine.indexOf(st.winner) >= 0) wins++;
  }
  return { total: 100 * wins / N, perSeat: 100 * wins / N / k, draw: 100 * draws / N };
}
console.log(`=== 拥挤度（对手恒为 ${(process.env.CROWD_OPP || 'random').toLowerCase()} · ${N} 局轮座 · 每席位胜率）===`);
/* ⚠ 自检（`CROWD_SELFCHECK=1`）：对称装配下每席位胜率**必须**等于 (100 − 和棋率)/5，否则就是我这套轮座/装配自己漏的。
 * 加它的原因很直接：这一晚上我已经三次被"量具自己有偏"打过（不可信的 mid-game resume、
 * 环场读数的天花板、以及刚才那个把结论翻过来的 random 对手），新量具出厂前先跑一遍恒等式检查。
 *   ① 5 席全 random；② 5 席全线上包（镜像）—— 两种装配下 k=1/2/4 的每席位都该 ≈(100−和棋)/5。 */
if (process.env.CROWD_SELFCHECK === '1') {
  /* 恒等式不是 20% 而是 **(100 − 和棋率)/5** —— 我第一版把断言写成 20%，结果自检直接报红，
   * 红的是我的断言不是装配：全场 random 时和棋 35% ⇒ (100−35)/5 = 13.0，实测 13.8 ✔。
   * （这正是 §9 校准框里那条"公平份额≈15% 不是 20%"，我又忘了一遍 ⇒ 写进代码里才不会忘第三次。） */
  const fair = r => (100 - r.draw) / 5;
  const live = T.policyChooserN(load('js/bundled-champion-3p.js'), 0.15);
  const RND = (st, pid, lg) => B.pickRandom(st, pid, lg);
  console.log('\n  [自检 A] 全场 random：k=1/2/4 每席位都应 ≈(100−和棋)/5');
  for (const k of [1, 2, 4]) {
    const r = run(RND, k, 'multi', 5150, RND);
    console.log(`      k=${k}  每席位 ${r.perSeat.toFixed(1)}%  公平 ${(fair(r)).toFixed(1)}%  比值 ${(r.perSeat / fair(r)).toFixed(2)}  和棋 ${r.draw.toFixed(0)}%  ${Math.abs(r.perSeat - fair(r)) < 3 ? '✔ 对称' : '⛔ 装配有偏 ⇒ 本工具所有读数作废'}`);
  }
  console.log('  [自检 B] 全场线上包（镜像）：同样应 ≈(100−和棋)/5');
  for (const k of [1, 2, 4]) {
    const r = run(live, k, 'multi', 5150, live);
    console.log(`      k=${k}  每席位 ${r.perSeat.toFixed(1)}%  公平 ${(fair(r)).toFixed(1)}%  比值 ${(r.perSeat / fair(r)).toFixed(2)}  和棋 ${r.draw.toFixed(0)}%  ${Math.abs(r.perSeat - fair(r)) < 3 ? '✔ 对称' : '⛔ 座位漏进身份通道'}`);
  }
  console.log('');
}
console.log('  包                 k=1/席   k=2/席   k=4/席    拥挤指数(4÷1)  k=1和棋  k=1公平  **倍数(席÷公平)**');
for (const f of FILES) {
  let p; try { p = load(f); } catch (e) { console.log(`  跳过 ${f}: ${e.message}`); continue; }
  const me = T.policyChooserN(p, 0.15);
  const SD = Number(process.env.CROWD_SEED || 7777);
  const a = run(me, 1, 'multi', SD), b2 = run(me, 2, 'multi', SD), b4 = run(me, 4, 'multi', SD);
  const idx = b4.perSeat / (a.perSeat || 1);
  const fair1 = (100 - a.draw) / 5;
  console.log(`  ${f.split('/').pop().replace('.bak', '').replace('bundled-champion-3p.js', '线上包').padEnd(18)}${a.perSeat.toFixed(1).padStart(6)} ${b2.perSeat.toFixed(1).padStart(8)} ${b4.perSeat.toFixed(1).padStart(8)}        ${idx.toFixed(2)}         ${a.draw.toFixed(0)}%     ${fair1.toFixed(1)}%          ${(a.perSeat / fair1).toFixed(2)}x`);
}
console.log('\n  解读：指数 ≈1 ⇒ 加份数不摊薄（无同族互杀）；0.5 ⇒ 每加一份把自己摊掉一半。');
console.log('        ⇒ 若某候选指数很低，则它"反向场"的失分是**装配**造成的，不能读成"它不强"（反之亦然）。');
