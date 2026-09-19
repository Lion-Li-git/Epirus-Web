/* 环消融（配对反事实）—— 把"环这条线该不该继续投"从相关读数换成干预读数
 * 为什么现在才能做：夜里的包**一个环都不打**（53 个包 打环=0、环可负担 ≤0.07%），
 *   那时"环不载重"只有强制环场（旧包 ep≥16 窗口）一条证据。
 *   09-19 复测发现换包后线上包**自己开始打环**（multi 346 次/30 局、且全部实际执行）⇒
 *   第一次可以做**减法**：把它的环全换成 ジ，别的都不动，看两根轴掉多少。
 * 设计：同一 seed 序列、同一轮座、同一对手装配，两臂逐局配对；判据用符号翻转精确检验
 *   （d∈{+1,−1,0}，DP 枚举非零对的符号分配 ⇒ 不受 2^nz 溢出限制）。
 * ⚠ 两个自检：① 被换掉的出手数必须 >0，否则是空枪（夜里 0.00% 触发率的教训）；
 *   ② 两臂各用**各自新建**的 chooser —— policyChooserN 自带采样 rng，共用实例会让配对失效。
 * 用法：node tools/probe-ring-ablate.mjs [GAMES=120] [包...]（默认线上包）
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
const R = sb.window.EpirusRules, S = sb.window.EpirusState, Play = sb.window.EpirusPlay,
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, B = sb.window.EpirusBots, A = R.SK;
const argv = process.argv.slice(2);
const N = Number(argv[0] && /^\d+$/.test(argv[0]) ? argv.shift() : 120);
const FILES = argv.length ? argv : ['js/bundled-champion-3p.js'];
const SEED = Number(process.env.CROWD_SEED || 7777);
/* ABLATE_KEY=另一个技能名 ⇒ 本工具可当**任意单卡的消融**用，也用来做**阳性对照**
 *   （禁一张它高频使用的卡，必须看到明显掉分；否则"禁环没影响"这条读数是量具死了，不是环没用）。 */
const KEY = process.env.ABLATE_KEY || A.RING;
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
/* 一臂：k 席被测，返回逐局"我席是否获胜"(1/0) + 和棋数 + 该臂里环出手次数 */
function playGames(params, k, opp, ablate) {
  const me = T.policyChooserN(params, 0.15);
  let ring = 0, draw = 0;
  const w = [];
  for (let g = 0; g < N; g++) {
    const off = g % 5;
    const mine = []; for (let i = 0; i < k; i++) mine.push((off + i) % 5);
    const st = S.createState('multi', { next: mb(SEED + g * 991) }, 5);
    st.slotSalt = h32(SEED + g * 2246822519);
    const chooser = (s2, pid, lg) => {
      const r = me(s2, pid, lg);
      if (r && r.key === KEY) {
        ring++;
        if (ablate) { const ji = lg.find(x => x.key === A.JI); if (ji) return { key: A.JI }; }
      }
      return r;
    };
    const cs = []; for (let i = 0; i < 5; i++) cs.push(mine.indexOf(i) >= 0 ? chooser : opp);
    Play.autoGameN(st, cs);
    if (st.winner === 'draw') draw++;
    w.push(mine.indexOf(st.winner) >= 0 ? 1 : 0);
  }
  return { w, draw, ring };
}
/* 符号翻转精确检验：d_i = 基线−消融 ∈ {+1,0,−1}；H0 下非零对独立等概率翻号 */
function signFlip(b, a) {
  const d = b.map((x, i) => x - a[i]);
  const obs = d.reduce((s, x) => s + x, 0);
  const nz = d.filter(x => x !== 0).length;
  let dist = new Map([[0, 1]]);
  for (const x of d) {
    if (x === 0) continue;
    const next = new Map();
    for (const [s, c] of dist) for (const v of [x, -x]) next.set(s + v, (next.get(s + v) || 0) + c / 2);
    dist = next;
  }
  let tail = 0;
  for (const [s, c] of dist) if (Math.abs(s) >= Math.abs(obs) - 1e-9) tail += c;
  return { diff: 100 * obs / N, nz, p: tail };
}
console.log(`=== 消融「${KEY}」（同 seed 同轮座 · 只把 chooser 输出的这张卡换成 ジ · multi · ${N} 局/臂 · seed=${SEED}）===`);
for (const f of FILES) {
  let p; try { p = load(f); } catch (e) { console.log(`  跳过 ${f}: ${e.message}`); continue; }
  console.log(`\n  包：${f.split('/').pop()}`);
  for (const [nm, oppName] of [['V1 打乱局（对手 random）', 'pickRandom'], ['V2 打整局（对手 balanced）', 'pickBalanced'], ['V4 成群（4 席自家族 vs 1 balanced）', 'pickBalanced']]) {
    const opp = B[oppName];
    if (typeof opp !== 'function') throw new Error('EpirusBots 里没有 ' + oppName);
    const O = (st, pid, lg) => opp(st, pid, lg);
    const k = nm.startsWith('V4') ? 4 : 1;
    const b = playGames(p, k, O, false);
    const a = playGames(p, k, O, true);
    const sf = signFlip(b.w, a.w);
    const bw = 100 * b.w.reduce((x, y) => x + y, 0) / N / k, aw = 100 * a.w.reduce((x, y) => x + y, 0) / N / k;
    console.log(`  ${nm}`);
    console.log(`      基线 ${bw.toFixed(1)}%${k > 1 ? '/席' : ''}  →  消融 ${aw.toFixed(1)}${k > 1 ? '/席' : ''}   差 ${(aw - bw).toFixed(1)}pt   非零配对 ${sf.nz}/${N}   符号翻转 p = ${sf.p < 0.001 ? sf.p.toExponential(1) : sf.p.toFixed(3)}`);
    console.log(`      基线「${KEY}」出手 ${b.ring} 次 · 消融臂改判 ${a.ring} 次   和棋 基线 ${b.draw} / 消融 ${a.draw}`);
    if (a.ring === 0) console.log(`      ⛔ 空枪：这个装配里它本来就不出「${KEY}」⇒ 本行无信息，别读成"这张卡没用"`);
  }
}
console.log('\n  判据：三行差值同负且 p 小 ⇒ 环对这个包是**净贡献**（该继续投表征/训练）；');
console.log(`        差值 ≈0 或跨 0 ⇒ 它现在打环只是**中性习惯**，"环 = 强度来源"这句话不成立（夜里 §4 的方向反而被加强）。`);
