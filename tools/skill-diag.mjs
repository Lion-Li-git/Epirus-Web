/* 技能分布诊断：分清「买不起」与「买得起也不选」
 * 用法：node tools/skill-diag.mjs [冠军文件=js/bundled-champion-3p.js] [局数=80]
 * 对同一冠军跑三种经济条件，比较技能分布与香农熵（有效技能数 = exp(H)）
 *   ① 原生（正常经济）           ② 只自己有钱（ep 补到 N）   ③ 全员有钱
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILE = process.argv[2] || 'js/bundled-champion-3p.js';
const GAMES = parseInt(process.argv[3] || '80', 10);
const N = 3, RICH = 6;

const sb = {
  console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
  parseInt, parseFloat, Float64Array, Date, window: {},
  localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } }
};
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(f, 'utf8'), sb, { filename: f });
}
vm.runInNewContext(readFileSync(FILE, 'utf8'), sb, { filename: FILE });
const W = sb.window, R = W.EpirusRules, T = W.EpirusTrainer, P = W.EpirusPolicy, S = W.EpirusState;
const champ = P.unpack(W.EPIRUS_CHAMPION_3P);
if (!champ) throw new Error('冠军解包失败');

/* 技能费用表（用真实 computeCost 在“资源充足”状态下探一次） */
function costOf(key) {
  const st = S.createState('multi', { next: T.mulberry32(1) }, N);
  for (let i = 0; i < N; i++) { st.p[i].ep = 99; st.p[i].elec = 3; st.p[i].boom = 3; }
  const c = S.computeCost(st, 0, key);
  return c && c.ok ? c.ep : null;
}

function measure(label, mode) {
  const use = {};
  let decisions = 0, maxEpSeen = 0;
  const inner = T.policyChooserN(champ, 0.15);
  const probe = function (state, pid, legal) {
    if (mode === 'self' && pid === 0) for (let i = 0; i < N; i++) state.p[i].ep = Math.max(state.p[i].ep, RICH);
    if (mode === 'all') for (let i = 0; i < N; i++) state.p[i].ep = Math.max(state.p[i].ep, RICH);
    if (pid === 0) { if (state.p[0].ep > maxEpSeen) maxEpSeen = state.p[0].ep; }
    const a = inner(state, pid, legal);
    if (pid === 0) { use[a.key] = (use[a.key] || 0) + 1; decisions++; }
    return a;
  };
  for (let g = 0; g < GAMES; g++) T.oneGameN([probe, probe, probe], 555001 + g * 977, N);
  // 香农熵（nats）与有效技能数
  let H = 0;
  for (const k in use) { const p = use[k] / decisions; H -= p * Math.log(p); }
  const eff = Math.exp(H);
  const keys = Object.keys(use).sort(function (x, y) { return use[y] - use[x]; });
  console.log('\n[' + label + ']  决策=' + decisions + '  最高 ep=' + maxEpSeen +
    '  用到 ' + keys.length + ' 种  熵 H=' + H.toFixed(2) + ' nats  有效技能数=' + eff.toFixed(2));
  console.log('  ' + keys.map(function (k) {
    return (R.byKey[k] ? R.byKey[k].name : k) + ' ' + (use[k] / decisions * 100).toFixed(1) + '%';
  }).join(' | '));
  return { keys: keys.length, eff: eff, use: use, decisions: decisions };
}

console.log('=== 技能分布诊断: ' + FILE + ' ===');
console.log('（有效技能数 = exp(熵)；1.0 = 只用一招，28 = 完全均匀）');
const r1 = measure('① 原生经济（正常对局）', 'none');
const r2 = measure('② 只自己有钱（ep 补到 ' + RICH + '）', 'self');
const r3 = measure('③ 全员有钱（ep 补到 ' + RICH + '）', 'all');

console.log('\n=== 结论判据 ===');
console.log('  ①有效技能数 ~1-2 且 ③仍 ~1-2  → 病因乙：买得起也不选（平衡性/偏好问题）');
console.log('  ①有效技能数 ~1-2 但 ③明显升高 → 病因甲：单纯买不起（经济深度问题）');
console.log('  综合: ①=' + r1.eff.toFixed(2) + '  ②=' + r2.eff.toFixed(2) + '  ③=' + r3.eff.toFixed(2));

console.log('\n=== 各技能费用与「全员有钱」下的使用率（看哪些是被费用挡住的）===');
const allKeys = (R.skills || []).map(function (d) { return d.key; });
for (const k of allKeys) {
  const c = costOf(k);
  const u = r3.use[k] || 0;
  const nm = R.byKey[k] ? R.byKey[k].name : k;
  console.log('  ' + nm.padEnd(10) + ' 费用=' + String(c == null ? '?' : c).padStart(2) +
    '  原生=' + String(((r1.use[k] || 0) / r1.decisions * 100).toFixed(1)).padStart(5) + '%' +
    '  有钱=' + String((u / r3.decisions * 100).toFixed(1)).padStart(5) + '%');
}
