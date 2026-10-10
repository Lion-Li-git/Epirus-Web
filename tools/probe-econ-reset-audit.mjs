/* econ 族的两条"接线卫生"检查（09-28 夜班 §E65b · 门 D175 用）
 * ① **reset 完整性**（名单驱动）：`setEconomyReward({reset:true})` 的名单是手写的 ⇒ 每加一个键就可能漏一个键。
 *    本检查不抄名单：从单一来源 `server/econ-env.mjs` 的 `ECON_REWARD_KEYS` 反推**每个键**都要
 *    "下达哨兵 → reset → 必须回到出厂值"。漏一个就 `exit 7`（09-28 实测：`divW/divK/divRoleW/divForceGens/costlyW` 五个键全漏）。
 * ② **剂量与作用点**：给一个真包，量 `costlyUses`（贵卡计数，v1.5.265 起**不受权重门控**）与
 *    `costlyW` 开档前后的 `fit` ⇒ 这才允许写"这项在评分局里有没有剂量 / 到没到作用点"。
 *    ⚠ 判读规矩：剂量 >0 而 Δfit=0 **有两种解释**（`costlyBonus` 用的是**前缀和**，
 *    最后一局才出手 ⇒ 后面没有局可以加成；或线真断了）⇒ 本工具印 `未判定`，不许写成"结构性惰性"。
 * 用法：node tools/probe-econ-reset-audit.mjs [--pack=js/bundled-champion-3p.js] [--games=32] [--json=调用方给的路径]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { ECON_REWARD_KEYS } from '../server/econ-env.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';
rejectUnknownFlags(process.argv.slice(2), ['pack', 'games', 'json', 'w'], 'probe-econ-reset-audit');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const REPO = process.env.EPIRUS_REPO || './';
const PACK = flag('pack', 'js/bundled-champion-3p.js');
const GAMES = Number(flag('games', 32));
const W = Number(flag('w', 0.2));
const mk = () => {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map };
  sb.window = sb; sb.globalThis = sb;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
    'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
    vm.runInNewContext(readFileSync(REPO + f, 'utf8'), sb, { filename: f });
  }
  return sb;
};
/* 哨兵：每个键都取"明显不是出厂值"的数（布尔取 true）。 */
const SENT = {
  target: 9, cap: 9, divW: 0.5, divK: 7, divRoleW: 0.5, divCatW: 0.5, divForceGens: 5,
  wallFilter: true, wallGames: 5, hoardOnLeftover: true, convRatio: true, convOffense: true,
  hoardCapMult: 3, stockBonus: 0.5, blockW: 0.5, widthW: 0.5, bigcardW: 0.5, costlyW: 0.5,
  bigtChainW: 0.5, ringW: 0.5, s4W: 0.5, beadW: 0.5, fitTailW: 0.5, fitTailQ: 0.5, fitCal: true,
  /* v1.6.50（用户裁定 B）：闸的广度折进适应度那两个键也要有哨兵 ——
   *   这一段的检查是**名单驱动**的（从 `ECON_REWARD_KEYS` 反推），加了键却忘了给哨兵值，
   *   探针会印"下达 undefined 读回仍=…"。那不算漏但会盖住真话（本次实测就是这么印的）。 */
  fitGW: 0.5, fitGF: 5
};
/* 下达名 ≠ 读回名的两处（第一版把这两处误报成"setter 不吃键"，故显式映射并注释） */
const readKey = k => (k === 'target' ? 'targetOverride' : (k === 'cap' ? 'capOverride' : k));

const dflt = mk().window.EpirusTrainer.economyReward();
const sb2 = mk(); const T = sb2.window.EpirusTrainer;
const payload = {};
for (const k of ECON_REWARD_KEYS) if (SENT[k] !== undefined) payload[k] = SENT[k];
T.setEconomyReward(payload);
const on = T.economyReward();
T.setEconomyReward({ reset: true });
const after = T.economyReward();
const leak = [], notApplied = [];
for (const k of ECON_REWARD_KEYS) {
  const rk = readKey(k);
  if (JSON.stringify(after[rk]) !== JSON.stringify(dflt[rk]))
    leak.push(k + '（出厂=' + JSON.stringify(dflt[rk]) + ' → reset 后=' + JSON.stringify(after[rk]) + '）');
  if (JSON.stringify(on[rk]) === JSON.stringify(dflt[rk]))
    notApplied.push(k + '（下达 ' + JSON.stringify(SENT[k]) + ' 读回仍=' + JSON.stringify(on[rk]) + '）');
}
console.log('## ① reset 完整性（名单驱动，共 ' + ECON_REWARD_KEYS.length + ' 个键，本次下达 ' + Object.keys(payload).length + ' 个）');
console.log('   泄漏（reset 后没回出厂）：' + (leak.length ? '⛔ ' + leak.join(' · ') : '无 ✓'));
console.log('   下达了但读回没变：' + (notApplied.length ? '⚠ ' + notApplied.join(' · ') : '无 ✓'));

/* ② 剂量与作用点 */
const sb3 = mk(); const T3 = sb3.window.EpirusTrainer, Pol3 = sb3.window.EpirusPolicy;
const src = readFileSync(REPO + PACK, 'utf8');
let params;
const slot = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
if (slot) params = Pol3.unpack(JSON.parse(slot[1]), true);
else params = Pol3.loadAny(JSON.parse(src.slice(src.indexOf('{"v":'), src.lastIndexOf('}') + 1))).params;
const opps = T3.buildOpps(params, 0.05);
const SCORE = () => T3.scoreMemberN(params, opps, GAMES, 3, 1200, 5, 0);
const f0 = SCORE();
let fW = null;
try { T3.setEconomyReward({ costlyW: W }); fW = SCORE(); } finally { T3.setEconomyReward({ reset: true }); }
const fBack = SCORE();
const dose = f0.costlyUses, dFit = fW ? fW.fit - f0.fit : NaN;
console.log('\n## ② 剂量与作用点 · 包=' + PACK + ' · ' + GAMES + ' 局/个体');
console.log('   出厂 costlyUses(贵卡计数，不受权重门控)=' + dose + '  costlyPerGame=' + (f0.costlyPerGame || 0).toFixed(4) +
  '   大雷出手 chainCasts=' + f0.chainCasts);
console.log('   fit(W=0)=' + f0.fit.toFixed(6) + '  fit(W=' + W + ')=' + (fW ? fW.fit.toFixed(6) : '-') +
  '  Δfit=' + (isFinite(dFit) ? dFit.toFixed(6) : '-') + '  reset 后逐位回到出厂？' + (fBack.fit === f0.fit));
let verdict;
if (dose > 0 && isFinite(dFit) && dFit !== 0) verdict = '有剂量、到作用点 ✓（这项真咬）';
else if (dose === 0) verdict = '剂量为 0 ⇒ 才可以说"这个包在这个样本量下不打贵卡"（先加大 --games 再下结论）';
else verdict = '未判定：剂量>0 而 Δfit=0 —— `costlyBonus` 用**前缀和**，只在最后一局出手时 Δ 会是 0；也可能是线断 ⇒ 加 --games 复量，不许写成"结构性惰性"';
console.log('   判读：' + verdict);
if (flag('json')) writeFileSync(flag('json'), JSON.stringify({
  pack: PACK, games: GAMES, w: W, leak, notApplied, dose, chainCasts: f0.chainCasts,
  fit0: f0.fit, fitW: fW ? fW.fit : null, dFit, resetReversible: fBack.fit === f0.fit, verdict
}, null, 2));
if (leak.length || notApplied.length || fBack.fit !== f0.fit) {
  console.log('\n⛔ 有键泄漏/没接上/reset 不可逆 ⇒ 按失败处理'); process.exit(7);
}
console.log('\nOK ✓');
