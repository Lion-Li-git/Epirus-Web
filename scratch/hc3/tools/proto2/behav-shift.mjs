#!/usr/bin/env node
/* behav-shift.mjs — **跨 N 行为位移尺**（ZCode · 10-30 晨 · 容量文档建议 6 的落地）
 *
 * 为什么必须有它：2.0 的第二目标是"换桌形换打法"（用户裁定"跨人数本身也是适应性的一环"），
 *   但在册的全部尺都在量强度——"打法该不该随 N 变"从来没被读过数。行为族表（matrix2 / 测试 A）
 *   证明现有 2.0 包的族跨 N 几乎不动，而 v7 的状态置零换手率随 N 上升（§E815：3P 14.2% → 5P 64.0%）
 *   ⇒ "位移"这一格现在是 2.0 与 v7 唯一可能反超的地方，也是"条件化"唯一的行为级读数。
 *
 * 量什么：同一枚包在 n∈{2,3,5,8,10}（multi/hp3）各打 G 局（对手表/桌形/盐 = arena2 holdout 同源，
 *   骑在 `A.playOne` 上 ⇒ 与 CLI 读数同一批对手），逐 N 累计**冠军自己的出招键直方图**，然后：
 *   · TV(a,b) = ½·Σ_k |p_a(k) − p_b(k)|（全键分布的 total variation，0 = 完全同分布）；
 *   · `shift` = 全对均 TV；`shiftTo3` = 对 n=3 基线的均 TV（产品最常用的桌形）；
 *   · 族版（e/a/d/s）并列打印，与测试 A 的口径连续。
 *
 * 三条参照（判读时并排看，别只看自己）：
 *   · `only:gun` / `only:reflect` 固定打法 = **结构下限**（选择器不随局面变，残差只来自候选面随 N 的合法集变化）；
 *   · v7 = 在册唯一"内部随 N 换读数"的包（§E815），它的位移是"会条件化"的活样本；
 *   · 2.0 现役系 = 测试 A 已证"族不动"，全键版是否也冻住是本尺第一次读。
 *
 * 用法：node tools/proto2/behav-shift.mjs --pack=<v7 包路径或 'v7'> [--pack=…可重复] [--games=40] [--temp=0.15] [--json=<out>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const PACKS = [];
for (const a of argv) if (a.startsWith('--pack=')) PACKS.push(a.slice(7));
if (!PACKS.length) { console.error('⛔ 至少一个 --pack=（v7 用 --pack=v7）'); process.exit(2); }
const G = Math.max(4, Number(arg('games', 40)) || 40);
const TEMP = Number(arg('temp', 0.15)) || 0.15;
const JSON_OUT = arg('json', '');
const SHAPES_WANT = [0, 3, 6, 9, 10];                    /* arena2 SHAPES 里 multi/hp3 的五个：n=2,3,5,8,10 */

const W = sandbox();
W.EpirusTrainer.setBigTPush(12);
const ref = loadChamp(W, 'js/bundled-champion-3p.js', '');
const refParams = Float64Array.from(ref);
const A = createArena2(W, { refParams, temp: TEMP, stratified: true, stratCap: 2, stratMix: 0.5 });
const R = W.EpirusRules;
const KEYS = R.skills.map((s) => s.key);
const FAMILY = (k) => { const c = R.byKey[k] && R.byKey[k].cat; return c === R.CAT.DEFENSE ? 'd' : (k === R.SK.RING || k === R.SK.CHARGE) ? 's' : (k === R.SK.JI) ? 'e' : 'a'; };

/* 每个"被测对象"独立 sandbox 安装（2.0 包互不覆盖） */
function ctxFor(packPath) {
  if (packPath === 'v7') return { params: refParams, tag: 'v7' };
  const raw = readPack2(packPath);
  const got = packCfgExit(raw, packPath);   /* 代闸：代 1 的产物不许在新尺上出数 */
  const cfg = got.cfg;
    installArch2(W, cfg);
  return { params: Float64Array.from(W.EpirusPolicy.unpack(raw, true)), tag: packPath.replace(/^.*[\\/]/, '').replace(/\.bak$/, '') };
}
/* 固定打法的下限参照走 arena2 自己的 fixed()（同一构造，不另写一份） */
function ctxForFixed(key) { return { sel: A.fixed(key), tag: 'only:' + key, fixed: true }; }

function profileOf(ctx) {
  const perN = {};
  const sel = ctx.fixed ? ctx.sel : A.chooserOf(ctx.params, TEMP);
  for (const si of SHAPES_WANT) {
    const shape = A.shapes[si];
    const cat = {};
    for (let g = 0; g < G; g++) {
      const r = A.playOne(sel, si, 100000 + si * 1000 + g, 90001);
      for (const k in r.cat) cat[k] = (cat[k] || 0) + r.cat[k];
    }
    const tot = Object.values(cat).reduce((a, b) => a + b, 0) || 1;
    perN[shape.n] = { tot, hist: cat };
  }
  return perN;
}
const tv = (a, b) => { let s = 0; const ks = new Set([...Object.keys(a), ...Object.keys(b)]); for (const k of ks) s += Math.abs((a[k] || 0) - (b[k] || 0)); return s / 2; };

const out = [];
for (const spec of PACKS) {
  const ctx = spec.startsWith('only:') ? ctxForFixed(spec.slice(5)) : ctxFor(spec);
  /* 确定性自证：同一对象连跑两遍必须同直方图（对手表/盐同源 ⇒ 不等就是状态泄漏回归） */
  const p1 = profileOf(ctx), p2 = profileOf(ctx);
  let det = true;
  for (const n in p1) {
    if (JSON.stringify(p1[n].hist) !== JSON.stringify(p2[n].hist)) { det = false; break; }
  }
  const ns = Object.keys(p1).map(Number).sort((a, b) => a - b);
  const probs = {};
  for (const n of ns) { const q = {}; for (const k in p1[n].hist) q[k] = p1[n].hist[k] / p1[n].tot; probs[n] = q; }
  const pairs = [];
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) pairs.push({ a: ns[i], b: ns[j], tv: tv(probs[ns[i]], probs[ns[j]]) });
  const shift = pairs.reduce((s, p) => s + p.tv, 0) / pairs.length;
  const shiftTo3 = ns.includes(3) ? pairs.filter((p) => p.a === 3 || p.b === 3).reduce((s, p) => s + p.tv, 0) / (ns.length - 1) : NaN;
  /* 族版：全键折成 e/a/d/s 再算同一组 TV（与测试 A 的口径连续） */
  const fam = {};
  for (const n of ns) { const q = { e: 0, a: 0, d: 0, s: 0 }; for (const k in probs[n]) q[FAMILY(k)] += probs[n][k]; fam[n] = q; }
  const famPairs = [];
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    let s = 0; for (const k of ['e', 'a', 'd', 's']) s += Math.abs(fam[ns[i]][k] - fam[ns[j]][k]);
    famPairs.push({ a: ns[i], b: ns[j], tv: s / 2 });
  }
  const famShift = famPairs.reduce((s, p) => s + p.tv, 0) / famPairs.length;
  out.push({ tag: ctx.tag, det, shift, shiftTo3, famShift, pairs, ns: ns.join(','), totActs: ns.map((n) => p1[n].tot).join(',') });
  console.log('· ' + ctx.tag.padEnd(22) + ' ‖ 确定性 ' + (det ? '✔' : '⛔ 泄漏回归') + ' ‖ **跨 N 位移(全键) ' + shift.toFixed(3) + '** ‖ 对 n=3 基线 ' + shiftTo3.toFixed(3) + ' ‖ 族版 ' + famShift.toFixed(3) +
    ' ‖ 逐对: ' + pairs.map((p) => p.a + '-' + p.b + ' ' + p.tv.toFixed(2)).join(' '));
}
if (out.length >= 2) {
  const floor = Math.min(...out.map((o) => o.shift));
  console.log('\n⇒ 结构下限（固定打法）= ' + floor.toFixed(3) + ' ‖ 判读：包的位移显著高于下限才算"打法随 N 变"；' +
    'v7 的读数是"会条件化"的活样本（§E815 的换手率随 N 升）。族版口径与测试 A 连续（2.0 现役系族版 ≈ 冻结）。');
}
if (JSON_OUT) { writeFileSync(JSON_OUT, JSON.stringify({ tool: 'tools/proto2/behav-shift.mjs', games: G, temp: TEMP, shapes: 'multi hp3: n=2,3,5,8,10', rows: out }, null, 1) + '\n'); console.log('✔ 已写 ' + JSON_OUT); }
