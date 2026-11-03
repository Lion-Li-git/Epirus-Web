/* 产品侧地面真值：从用户的实机对局记录（`results/` 下嵌套的 `.txt`）里，按**席位**统计行动构成。
 *
 * 为什么需要（2026-09-21 用户 + 千问 §23 + DS 实测三方撞到同一件事）：
 *   · 千问实测：同一包（现役）长程 5 席自对局，**两套口径差 4 倍**（ε=0 电磁炮 3.87/局 vs ε0.2 soft 0.93/局）⇒
 *     "**产品行为由探索主导**"，而所有"这个包学会了 X"的证据都是 ε=0 量的 ⇒ 对玩家不成立。
 *   · DS 实测（`results/31` 五局）：AI 四席里**防御类占 ≈24%**、电磁炮 **0.2 次/局** —— 比任何模拟装配都更"防御多"。
 *   · ⇒ **模拟替代不了产品**：真人席在场上时，威胁结构与 ep 节奏都不一样 ⇒ 唯一的地面真值是**用户实际打的局**。
 * 本工具把"看日志"变成可复现读数，供"能力项两栏都达标才算数"（千问 DOING-1）里的**第三栏：真机栏**。
 *
 * 用法：node tools/log-behavior.mjs [目录或文件...] [--human=1] [--seats=2,3,4,5]
 *      （不给参数就取 `results/` 下**递归最新 5 个** `.txt` —— 沿用旧口径，历史读数才可比）
 * ⚠️ 只读：不写 results/，不改任何包。
 *
 * ⚠️ **口径变了（v1.5.312 · DS 交接件 §3 三处 + 千问复核挖出的第四处，逐条记在 `tools/log-reading.mjs` 头注）**：
 *   ① 能力项名单**从 `js/core/rules.js` 现取** —— 旧版这里是一张 **9 项手写正则**表，而真机数据里排**第 3 的激光剑（11.0%）
 *      与第 4 的聚能环（6.8%）压根不在表内 ⇒ 拿"能力项达标"去判，前三名的两席是**静默漏掉**的；
 *   ② **`已淘汰` 不再进分母**（它是座位死亡后的状态占位，不是出招；`results/test` 这批 12 局占原始计数 **14.2%**）
 *      ⇒ 任何"占 AI 出手 X%"整体变成旧读数的 1/(1−淘汰率) ≈ **高 16.6%**，**旧百分比不许与新读数并排引**；
 *   ③ 读取实现只有 `log-reading.mjs` 一份，与 `tools/log-census.mjs` 共用（门 **D216** 判"两栏在同一批文件上必须逐字相同"，
 *      并用手算夹具钉住四个广度量的算术 —— 只记录"应该有同一份"不算，必须跑）；
 *   ④ 桶=**精确卡名**（旧 `/枪(?!法)/` 把「狙击枪」也吃进"枪"那一行 ⇒ 同一手被两桶各计一次：这批"枪"真值 **13.2%**、
 *      旧表报 **16.4%**，虚高 **3.2pt**）。要恢复旧分桶就得再写一份表 ⇒ 那正是本仓"名单抄两遍"栽过的第四个同类坑。
 */
import { rejectUnknownFlags } from './audit-lib.mjs';
import { loadCardTable, seatList, collectFiles, census, breadth, defShare } from './log-reading.mjs';

rejectUnknownFlags(process.argv.slice(2), ['human', 'seats'], 'log-behavior');

const T = loadCardTable();
const ARGV = process.argv.slice(2);
const SEAT_ARG = seatList(ARGV);
const FILES = collectFiles(ARGV);
const C = census(FILES, SEAT_ARG, T);
const B = breadth(C.byCard, C.hands);
const D = defShare(C, T);

const perGame = function (n) { return (n / Math.max(1, C.games)).toFixed(2); };
const pct = function (n) { return (100 * n / Math.max(1, C.hands)).toFixed(1); };
console.log('=== 实机地面真值（AI 席 = ' + SEAT_ARG.join('/') + '）===');
console.log('· 分母：局 ' + C.games + ' ‖ 原始计数 ' + C.raw + ' ‖ 剔 `已淘汰` ' + C.elim +
  '（占原始 ' + (100 * C.elim / Math.max(1, C.raw)).toFixed(1) + '%）‖ **有效出手 ' + C.hands + '**');
for (const g of C.perGame) {
  const keys = Object.keys(g.byCard).sort(function (a, b) { return g.byCard[b] - g.byCard[a]; });
  console.log('  ' + g.file + '  (' + g.rounds + ' 回合 · ' + g.hands + ' 手)  ' +
    keys.map(function (k) { return k + '=' + g.byCard[k]; }).join(' · '));
}
console.log('\n=== ' + C.games + ' 局合计（均 ' + (C.roundsAll / Math.max(1, C.games)).toFixed(1) + ' 回合/局）===');
console.log('· **能力项**（卡名从 `js/core/rules.js` 现取 ‖ 桶=精确卡名 ‖ 分母已剔 `已淘汰`）');
console.log('  ' + B.rows.map(function (o) { return o.name + ' **' + perGame(o.n) + '**/局 = ' + pct(o.n) + '%'; }).join(' ‖ '));
console.log('· 防御类（' + T.defNames.join('/') + '）**' + perGame(D.def) + '**/局 · 占有效出手 ' + D.share.toFixed(1) + '%');
console.log('· 广度四量（DS 交接件 §2.2：**不许只报 G**）：种类 **' + B.kinds + '** ‖ 前 3 **' + B.top3.toFixed(1) +
  '%** ‖ H **' + B.H.toFixed(3) + '** ‖ **G=exp(H) ' + B.G.toFixed(2) + '**');
if (Object.keys(C.unknown).length) {
  console.log('· ⚠️ **表外 token ' + Object.keys(C.unknown).length + ' 种被单独计数**（规则表里没有这个名字 ⇒ 不是"没打"，是**读不出**）：' +
    Object.keys(C.unknown).sort(function (a, b) { return C.unknown[b] - C.unknown[a]; })
      .map(function (k) { return k + '=' + C.unknown[k]; }).join(' · '));
}
console.log('· 卡表 ' + T.names.length + ' 张里这批**一次都没出现**的 ' + C.zero.length + ' 张：' + C.zero.join(' / '));
console.log('\n读法：这一栏 = "真机栏"。千问 DOING-1 要的是"能力项**两栏**（ε=0 与浏览器口径）都达标才写进上线理由"；');
console.log('      模拟替代不了产品（真人席在场时威胁结构与 ep 节奏都不同）⇒ 真机栏应是**第三个**必看列。');
console.log('      完整分布 + 广度四量的另一份读数：`node tools/log-census.mjs <目录>`（同一实现，D216 钉两栏逐字相同）。');
