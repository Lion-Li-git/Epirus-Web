/* 防御族"看不看得到"探针（§22 E3 我自己来收掉的那一半）
 * 起因：`champ-audit` 报 `v7l2o-93`/`v7l2f-106` 的 **D 长程反弹墙 = 0%**、`f-106` **珠浪费 100%**，
 *   而现役包也有 80%。两种成因的修法完全不同：
 *     (A) **候选表里就没出现** ⇒ 生成器 / `econBase` 门槛的结构问题；
 *     (B) 出现了但概率极低、从不被选中 ⇒ **训练/目标函数**问题。
 *   ⚠ 顺带一个先验：防御族卡（`GUARD_FAMILY`）**费用是 0 ep**（`rules.js:54~58`）
 *     ⇒ "攒不到钱所以出不了防御"这个解释**不成立**，所以这个探针才有意义（否则直接归因给经济就结了）。
 * 用法：node tools/probe-defense-visible.mjs [GAMES=30] [包...]（默认：线上包 + 今夜几个极端样本）
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
  T = sb.window.EpirusTrainer, P = sb.window.EpirusPolicy, A = R.SK;
const argv = process.argv.slice(2);
const N = Number(argv[0] && /^\d+$/.test(argv[0]) ? argv.shift() : 30);
const FILES = argv.length ? argv : ['js/bundled-champion-3p.js', 'docs/artifacts/v7l2f-106.bak',
  'docs/artifacts/v7l2o-93.bak', 'docs/artifacts/v7l2c-103.bak', 'docs/artifacts/v7l2s-91.bak'];
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function load(f) {
  const src = readFileSync(REPO + f, 'utf8');
  if (f.includes('bundled')) { const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src); return P.unpack(JSON.parse(m[1]), true); }
  return P.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
}
const GFAM = R.GUARD_FAMILY || [A.GUARD, A.REFLECT, A.BAGUA, A.SHIFT, A.JINSHIELD];
console.log(`=== 防御族可见性（${N} 局 5 席自对局 · 逐决策统计 seat0 · 防御卡费用=0 ep）===`);
console.log('  包                 决策数   候选表含防御%   含防御时 p(防御)均值   argmax=防御%   (对照)出手数/局');
for (const f of FILES) {
  let params; try { params = load(f); } catch (e) { console.log(`  跳过 ${f}: ${e.message}`); continue; }
  const inner = T.policyChooserN(params, 0.15);
  let dec = 0, inCand = 0, pSum = 0, argDef = 0, casts = 0;
  const cs = []; for (let i = 0; i < 5; i++) cs.push(function (st, pid, lg) {
    if (pid !== 0) return inner(st, pid, lg);
    dec++;
    const aff = lg.filter(l => l.affordable);
    const cands = P.candidatesFor(st, 0, T.econBase(st, 0, aff), {});
    const has = cands.filter(c => GFAM.indexOf(c.key) >= 0);
    if (has.length) {
      inCand++;
      const fw = P.forwardCands(st, 0, cands, params, { temp: 0.15 });
      let best = 0, bi = -1;
      for (let j = 0; j < cands.length; j++) {
        const isD = GFAM.indexOf(cands[j].key) >= 0;
        if (isD && fw.probs[j] > best) best = fw.probs[j];
        if (isD && fw.probs[j] >= Math.max(...fw.probs)) bi = j;
      }
      pSum += best;
      if (bi >= 0) argDef++;
    }
    const r = inner(st, pid, lg); if (r) casts++;
    return r;
  });
  for (let g = 0; g < N; g++) {
    const st = S.createState('multi', { next: mb(3131 + g * 977) }, 5);
    st.slotSalt = h32(3131 + g * 2246822519);
    Play.autoGameN(st, cs);
  }
  const nm = f.split('/').pop().replace('.bak', '').replace('bundled-champion-3p.js', '线上包');
  console.log(`  ${nm.padEnd(18)}${String(dec).padStart(7)} ${(100 * inCand / dec).toFixed(1).padStart(12)}% ${(pSum / Math.max(1, inCand)).toFixed(3).padStart(18)} ${(100 * argDef / Math.max(1, inCand)).toFixed(1).padStart(16)}%   ${(casts / N).toFixed(1).padStart(6)}`);
}
console.log('\n  判读：`候选表含防御%` 低 ⇒ 成因 (A) 结构（生成器/econBase 把防御挡在门外）；');
console.log('        该列高而 `argmax=防御%` 低 ⇒ 成因 (B) 策略（网络看见了但不选）⇒ 那是目标函数的事，不是候选表的事。');
