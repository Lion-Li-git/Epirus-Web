/* §E166 探针：`resetBotMem()` 每局调一次，到底会让读数位移多少？
 * 背景：§E165 定位到 `bots.js:50` 的模块级 `__mem` 被四个脚本席共享，且只在"某个 bot 在 round===1 被问到"时重置
 *   ⇒ **跨局残留**会把下一局的第一手翻掉（实测同进程连跑 `G=1` 会 2-周期摆动）。
 *   `bots.js:51` 已定义、`:965` 已导出 `resetBotMem()` ⇒ 仪器侧"每局建局前调一次"是便宜的修法的**上半**。
 * 这条探针量的就是那上半值多少：**同一批牌**（同一个 seed 序列、同一个席位轮转），只差"每局是否重置 bot 记忆"。
 *   注意它量不到"局内四席共用一条记忆"那一半（那是 `__mem` 按席位分开才能修的），所以别把结果读成"修完了"。
 * 用法：node docs/artifacts/e166-botmem.mjs [--games=300] [--eps=0.2] [--epsmode=soft] [--belief=0,1]
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChamp } from '../../tools/audit-lib.mjs';
import { fieldProfile, conc, WIN } from '../../tools/behavior-profile.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const flag = (n, d) => { const h = process.argv.find(a => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const GAMES = Number(flag('games', 300));
const EPS = Number(flag('eps', 0.2));
const MODE = flag('epsmode', 'soft');
const SEED = Number(flag('seed', 4100));
const STEP = Number(flag('step', 997));          /* 与 fieldProfile 内部的步长一致 ⇒ 第 g 局的种子 = SEED + g·STEP */
const T = WIN.EpirusTrainer, B = WIN.EpirusBots, SK = WIN.EpirusRules.SK;
const params = loadChamp(WIN, 'js/bundled-champion-3p.js', ROOT);
if (typeof B.resetBotMem !== 'function') { console.error('⛔ bots.js 没导出 resetBotMem ⇒ 这条探针的整个前提没了，先去核对 :965 那行'); process.exit(1); }

/* 一臂 = 逐局单跑（G=1），按需在每局前重置 bot 记忆。席位轮转自己管（g % 5 由 fieldProfile 内部做，
   所以这里保持 seat 与"整批跑 G=GAMES"一致：每次 G=1 会把 seat 固定在 0 ⇒ 为了公平，两臂都用同一种 seat 形状，
   比较的只有"重置与否"这一件事。*/
function arm(belief, reset) {
  if (belief) { T.setBeliefSearch(1); T.setBeliefPly(1); T.setBeliefTarget(0); T.setBeliefTie(0); }
  else T.setBeliefSearch(0);
  const agg = { acts: 0, def: 0, atk: 0, ring: 0, ji: 0, tgtActs: 0, focus: 0, voided: 0, rounds: 0, wins: 0, decisive: 0, tgtGames: 0, tgtTopSum: 0, tgtKindSum: 0, keys: {} };
  for (let g = 0; g < GAMES; g++) {
    if (reset) B.resetBotMem();
    const t = fieldProfile(params, EPS, MODE, 1, SEED + g * STEP, 'mixed', 'multi');
    for (const k of ['acts', 'def', 'atk', 'ring', 'ji', 'tgtActs', 'focus', 'voided', 'rounds', 'wins', 'decisive', 'tgtGames', 'tgtTopSum', 'tgtKindSum']) agg[k] += t[k];
    for (const k in t.keys) agg.keys[k] = (agg.keys[k] || 0) + t.keys[k];
  }
  T.setBeliefSearch(0);
  return agg;
}
const line = (tag, a) => {
  const c = conc(a);
  return '  ' + tag.padEnd(22) + ' 胜率 ' + (100 * a.wins / GAMES).toFixed(2) + '%  集火(连段) ' + (a.tgtActs ? (100 * a.focus / a.tgtActs).toFixed(1) : '—') +
    '%  集中 ' + (c ? c.top.toFixed(1) : '—') + '%／' + (c ? c.kinds.toFixed(2) : '—') + '家  防御 ' + (100 * a.def / a.acts).toFixed(1) +
    '%  攻击 ' + (100 * a.atk / a.acts).toFixed(1) + '%  环 ' + (100 * a.ring / a.acts).toFixed(1) + '%  昏手 ' + (100 * a.voided / a.acts).toFixed(1) +
    '%  蓄能/局 ' + ((a.keys[SK.CHARGE] || 0) / GAMES).toFixed(2) + '  电磁炮/局 ' + ((a.keys[SK.RAILGUN] || 0) / GAMES).toFixed(2) + '  出手 ' + a.acts;
};
console.log('== §E166 每局是否 `resetBotMem()` 的对照（' + GAMES + ' 局 · 逐局单跑 · ε=' + EPS + ' ' + MODE + ' · mixed/multi · seed0=' + SEED + ' 步长 ' + STEP + '）==');
console.log('   ⚠ 两臂唯一的差别是"建局前要不要重置 bot 记忆"⇒ 这个差就是"仪器侧那一半修法"的位移量，不是修法的总代价');
for (const bel of [0, 1]) {
  const noReset = arm(bel, false), doReset = arm(bel, true);
  const label = bel ? '开档（belief=1）' : '关档（belief=0）';
  console.log(' -- ' + label + ' --');
  console.log(line('不重置（现状）', noReset));
  console.log(line('每局重置', doReset));
  console.log('   位移：胜率 ' + ((100 * doReset.wins / GAMES) - (100 * noReset.wins / GAMES)).toFixed(2) + 'pt ‖ 集火 ' +
    ((100 * doReset.focus / Math.max(1, doReset.tgtActs)) - (100 * noReset.focus / Math.max(1, noReset.tgtActs))).toFixed(2) + 'pt ‖ 防御 ' +
    ((100 * doReset.def / Math.max(1, doReset.acts)) - (100 * noReset.def / Math.max(1, noReset.acts))).toFixed(2) + 'pt ‖ 出手数 ' +
    (doReset.acts - noReset.acts) + '（' + ((100 * (doReset.acts - noReset.acts)) / noReset.acts).toFixed(1) + '%）');
}
console.log('\n  ⚠ 读法：位移≈0 ⇒ "每局重置"几乎免费（可以放心立进仪器与量具规矩）；位移大 ⇒ 这是一次真口径变更，历史读数要重跑。');
