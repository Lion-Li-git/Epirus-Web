/* G（有效技能数）阈值的标定（v1.5.71）。
 *
 * 病：五道门槛里的 `G >= 3` 最近把**所有**候选都挡了（v7tgt 臂 4/4 无产物、v17 臂 6/6 差座位或 G）。
 * 方法论铁律：阈值必须能把**已知好**与**已知坏**分开，否则先怀疑指标本身（E/F/holo/座位都踩过）。
 *
 * 用法：node tools/g-calib.mjs [包...]        # 默认给一批已知好/已知坏
 * 口径：`EpirusTrainer.mirrorHealth(params, games, 5, 'multi').effSkills` ——
 * 与训练落盘处 feasibility 用的是**同一个调用**（train-server.mjs），但样本量会影响读数，
 * 故同时报 n=20（champ-audit/screen-champ 用的）与 n=40（落盘处用的）。 */
import { sandbox, loadChamp } from './audit-lib.mjs';

const W = sandbox();
const DEF = [
  ['已知好·热启动种子', 'docs/artifacts/champion-5p-v1.3.58.bak'],
  ['已知好·线上包', 'js/bundled-champion-3p.js'],
  ['已知好·上一版线上(原生)', 'docs/artifacts/eco-34.bak'],
  ['已知好·上一版线上(v7嵌入)', 'docs/artifacts/eco-34-v7c.bak'],
  ['已知坏·G 坍缩(v17-146)', 'docs/artifacts/v17-146.bak'],
  ['偏座但 G 还行(v17-141)', 'docs/artifacts/v17-141.bak'],
  ['新候选(v7tgt-44)', 'docs/artifacts/v7tgt-44.bak']
];
const list = process.argv.slice(2).length
  ? process.argv.slice(2).map(function (f) { return [f, f]; })
  : DEF;
console.log('包'.padEnd(34) + 'G(n=20)  G(n=40)  种数(20/40)  回合(40)  平局率(40)');
for (const kv of list) {
  let p;
  try { p = loadChamp(W, kv[1]); } catch (e) { console.log(kv[0].padEnd(34) + '载入失败: ' + e.message); continue; }
  const a = W.EpirusTrainer.mirrorHealth(p, 20, 5, 'multi');
  const b = W.EpirusTrainer.mirrorHealth(p, 40, 5, 'multi');
  console.log(kv[0].padEnd(34) + String(a.effSkills.toFixed(2)).padEnd(8) + String(b.effSkills.toFixed(2)).padEnd(9) +
    (a.distinctKeys + '/' + b.distinctKeys).padEnd(13) + String(b.rounds.toFixed(1)).padEnd(10) +
    (b.drawRate * 100).toFixed(0) + '%');
}
console.log('\n判据：若"已知好"全 ≥3 且"已知坏"全 <3 ⇒ 阈值能分开（G 不是问题，是候选真的坍缩）；');
console.log('      若"已知好"也有 <3 ⇒ 阈值在正常情形下乱响（与 D13/D16 同类的假红，需重定标或换口径）。');
