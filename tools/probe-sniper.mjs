/* 狙击场探针的独立入口（v1.5.71，第五轮复核 §4-2）。
 *
 * 用法：node tools/probe-sniper.mjs [冠军包] [局数]        # 默认 js/bundled-champion-3p.js 60 局
 *
 * 报两个口径：
 *   mixed（1 席狙击 + 3 席只攒不还手）：**靶向率** = 冠军的落地攻击里命中狙击席的比例。
 *     均匀乱打 = 25%（4 席里 1 席），所以 ≥40% 才能叫"会瞄威胁"（阈值待多包标定）。
 *   wall（4 席狙击）：只量生存/胜率（4 打 1 极难）—— ⚠️ **它没有靶向判别力**（人人都是狙击手，
 *     比例恒 ~1），这正是我上一轮 `ringWallProbe` 犯过的错，写在这里防止重犯。
 *
 * ⚠️ 口径限制：`action` 事件不带目标 ⇒ 只能按**伤害事件**归因（`damage.to` + `damage.source`）
 * ⇒ 只统计**命中**的，被挡掉/被无效的尝试不计 ⇒ 靶向率是**下界**。 */
import { sandbox, loadChamp, sniperField } from './audit-lib.mjs';

const W = sandbox();
const file = process.argv[2] || 'js/bundled-champion-3p.js';
const G = Number(process.argv[3] || 60);
const params = loadChamp(W, file);
console.log('== 狙击场探针：' + file + '（' + G + ' 局/口径，长程）==');

const mix = sniperField(W, params, 'long', G, 'mixed');
console.log('mixed（1 狙击 + 3 被动）：自身伤害 = ' + mix.dmgPerGame.toFixed(2) + '/局（出手 ' + mix.attacksPerGame.toFixed(2) +
  '/局）· 平均打过 ' + mix.spreadAvg.toFixed(2) + ' 个人 · 靶向率 = ' +
  (mix.aimedAtSniperRate == null ? 'n/a' : (mix.aimedAtSniperRate * 100).toFixed(1) + '%') +
  '（均匀乱打 25%）· 命中狙击 ' + mix.hitsOnSniper + ' 次 / 其他 ' + mix.hitsOnOthers + ' 次' +
  ' · 被狙击手打 ' + mix.takenFromSniperPerGame.toFixed(2) + '/局' +
  ' · 存活 ' + (mix.survivalRate * 100).toFixed(0) + '% · 胜率 ' + (mix.winRate * 100).toFixed(0) +
  '% · 回合 ' + mix.rounds.toFixed(1) + ' · 打过的人数分布 ' + JSON.stringify(mix.targetSpreadHist));

const wall = sniperField(W, params, 'long', G, 'wall');
console.log('wall（4 狙击）：攻击 ' + wall.attacksTotal + ' 次 · 存活 ' + (wall.survivalRate * 100).toFixed(0) +
  '% · 胜率 ' + (wall.winRate * 100).toFixed(0) + '% · 回合 ' + wall.rounds.toFixed(1) +
  '（⚠️ 此口径无靶向判别力）');
