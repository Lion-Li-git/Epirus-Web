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
/* v1.5.132：V1/V2/V4 的装配抽到**单一来源** `tools/v2v4-lib.mjs`（探针与 `np-test D105` 共用一份实现）。 */
import { ASSEMBLIES, playAssembly, rates } from './v2v4-lib.mjs';
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
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
/* 装配与播种都在 `tools/v2v4-lib.mjs`（单一来源）；这里只准备一个 deps 包。 */
const D = { S: S, Play: Play, T: T, R: R, B: B };
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
  for (const asm of ASSEMBLIES) {
    const opp = B[asm.opp];
    if (typeof opp !== 'function') throw new Error('EpirusBots 里没有 ' + asm.opp);
    const k = asm.k, nm = asm.key + ' ' + asm.name;
    const opt = { k: k, opp: opp, games: N, seed: SEED, countKey: KEY };
    const b = playAssembly(D, p, Object.assign({}, opt, { ablate: false }));
    const a = playAssembly(D, p, Object.assign({}, opt, { ablate: true }));
    const sf = signFlip(b.w, a.w);
    const bw = rates(b.w, k), aw = rates(a.w, k);
    console.log(`  ${nm}`);
    console.log(`      基线 ${bw.toFixed(1)}%${k > 1 ? '/席' : ''}  →  消融 ${aw.toFixed(1)}${k > 1 ? '/席' : ''}   差 ${(aw - bw).toFixed(1)}pt   非零配对 ${sf.nz}/${N}   符号翻转 p = ${sf.p < 0.001 ? sf.p.toExponential(1) : sf.p.toFixed(3)}`);
    console.log(`      基线「${KEY}」出手 ${b.keyUses} 次 · 消融臂改判 ${a.keyUses} 次   和棋 基线 ${b.draw} / 消融 ${a.draw}`);
    if (a.keyUses === 0) console.log(`      ⛔ 空枪：这个装配里它本来就不出「${KEY}」⇒ 本行无信息，别读成"这张卡没用"`);
  }
}
console.log('\n  判据：三行差值同负且 p 小 ⇒ 环对这个包是**净贡献**（该继续投表征/训练）；');
console.log(`        差值 ≈0 或跨 0 ⇒ 它现在打环只是**中性习惯**，"环 = 强度来源"这句话不成立（夜里 §4 的方向反而被加强）。`);
