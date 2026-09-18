/* L1 的**表征层**验证（v1.5.116 · 第三方复核者 · 只读：不改 policy.js、不重训、不影响在跑的臂）
 * 要回答的问题：把 `min(ep,12)/12` 抬上去，网络**才可能**区分"16 点"与"40 点"吗？值不值得付一次换代代价？
 * 三层测量（都不需要训练）：
 *   M1 **注入性**：把三个编码各自在 ep 阶梯 2…60 上求值，数"有几个不同输出"（单标量层面直接看夹没夹住）；
 *   M2 **整条状态向量的可区分度**：真实中局面 + 只改 ep，数 `featuresV7` 产出几个**不同向量**（旧编码下的实测塌缩）；
 *   M3 **定位改点**：哪些下标随 ep 变化（自己席位那一段 vs 对手段），给 ds 精确的 patch 位置。
 * ⚠ 只测"能不能表示"，**不测胜率**：旧包权重是在旧编码下学的 ⇒ 换编码后概率无意义（要意义必须重训）。
 * 用法：node tools/probe-ep-encoding.mjs [快照数=20]
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
function mb(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function h32(n) { let x = (n + 0x9e3779b9) >>> 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return (x ^ (x >>> 16)) >>> 0; }
function loadBak(f) { const t = readFileSync(REPO + f, 'utf8'); return P.loadAny(JSON.parse(t.slice(t.indexOf('{"v":'), t.lastIndexOf('}') + 1))).params; }
const NSNAP = Number(process.argv[2] || 20);
const LIVE = P.unpack(sb.window.EPIRUS_CHAMPION_3P);
const ARM = loadBak('docs/artifacts/v7ringA1-82.bak');
const LAD = [2, 3, 4, 5, 6, 8, 10, 12, 13, 14, 16, 20, 24, 30, 40, 60];
const FN = P.featuresV7 || P.features;

/* ---------- M1 注入性（纯标量，最容易看懂）---------- */
const ENC = {
  '现状 min(ep,12)/12': e => Math.min(e, 12) / 12,
  '现状·可负担余量 (ep−c)/12 夹[-1,1]（c=1）': e => Math.max(-1, Math.min(1, (e - 1) / 12)),
  '现状·可负担余量（c=4 大件）': e => Math.max(-1, Math.min(1, (e - 4) / 12)),
  '提案A log1p(ep)/log1p(60)': e => Math.log1p(Math.min(e, 60)) / Math.log1p(60),
  '提案B √ep/√60': e => Math.sqrt(Math.min(e, 60)) / Math.sqrt(60),
  '提案C 两段：≤12 线性 + >12 压缩到 1.6': e => e <= 12 ? e / 12 : Math.min(1.6, 1 + Math.log1p(e - 12) / Math.log1p(48) * 0.6),
};
console.log('=== M1 编码注入性：阶梯 ' + LAD.join('/') + ' 上能产生几个不同值（共 ' + LAD.length + ' 档）===');
for (const [k, f] of Object.entries(ENC)) {
  const vals = LAD.map(f);
  const d = new Set(vals.map(x => x.toFixed(9))).size;
  const tail = vals.slice(LAD.indexOf(16));
  const dt = new Set(tail.map(x => x.toFixed(9))).size;
  console.log(`  ${k.padEnd(40)} 全阶梯 ${String(d).padStart(2)}/${LAD.length} 个不同值 · **ep≥16 那段 ${dt}/${tail.length}**`
    + (dt === 1 ? '  ⇐ 完全塌缩（16/20/24/30/40/60 同一个输入）' : ''));
}
/* ---------- M2/M3 真实快照上的整向量可区分度 + 定位 ---------- */
function snapsOf(params, n) {
  const inner = T.policyChooserN(params, 0.15); const out = [];
  const cs = []; for (let i = 0; i < 5; i++) cs.push(function (s2, pid, lg) {
    if (pid === 0 && s2.actions.every(a => a == null) && out.length < n && s2.round >= 6) out.push(S.cloneState(s2));
    return inner(s2, pid, lg);
  });
  for (let g = 0; g < 300 && out.length < n; g++) {
    const st = S.createState('multi', { next: mb(3141 + g * 977) }, 5);
    st.slotSalt = h32(3141 + g * 2246822519);
    Play.autoGameN(st, cs);
  }
  return out;
}
const sig = v => Array.prototype.map.call(v, x => x.toFixed(6)).join('|');
for (const [label, params] of [['arm A v7ringA1-82', ARM], ['线上包 v7new5_005-31', LIVE]]) {
  const sn = snapsOf(params, NSNAP);
  let tot = 0, dis = 0; const chg = {}; const chgHi = {};
  for (const st0 of sn) {
    const seen = new Set();
    const v12 = (() => { const x = S.cloneState(st0); x.p[0].ep = 12; x.p[0].ringStreak = 0; return FN(x, 0); })();
    for (const e of LAD) {
      const x = S.cloneState(st0); x.p[0].ep = e; x.p[0].ringStreak = 0;
      const v = FN(x, 0); seen.add(sig(v));
      for (let i = 0; i < v.length; i++) {
        if (Math.abs(v[i] - v12[i]) > 1e-12) (i < 60 ? chg : chgHi)[i] = (chg[i] || chgHi[i] || 0) + 1;
      }
    }
    tot += LAD.length; dis += seen.size;
  }
  const lo = Object.keys(chg).map(Number).sort((a, b) => a - b);
  const hi = Object.keys(chgHi).map(Number).sort((a, b) => a - b);
  console.log(`\n=== M2 ${label}：${sn.length} 个真实中局面 × ${LAD.length} 档 ep ===`);
  console.log(`  旧编码下只产生 ${dis} 个**不同**的状态向量（${LAD.length * sn.length} 输入 ⇒ 可区分度 ${(100 * dis / (LAD.length * sn.length)).toFixed(0)}%）`);
  console.log(`  M3 随 ep 变化的下标：低段(自己席位) [${lo.join(',')}] · 高段(对手/聚合/旗标) [${hi.slice(0, 24).join(',')}${hi.length > 24 ? ' …' : ''}]`);
  console.log(`     ⇒ 要抬的就这几维：${lo.map(i => `${i}(=min(ep,12)/12 族)`).join(' ')} 加上高段里同样的 ${hi.length} 维对手镜像`);
}
console.log('\n结论口径：M1 说明**夹住是编码本身造成的**（与权重无关）；M2 说明它在真实状态上确实塌缩；');
console.log('M3 给出精确改点。三者都不需要训练 ⇒ 可以先拿这三条去决定"要不要付换代的代价"。');
