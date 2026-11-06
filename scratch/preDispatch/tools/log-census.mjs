/* `tools/log-census.mjs` —— **真机栏的清点单**（DS 交接件 §3.3：那四量以前是一次性 Python 脚本，跑完就没了）
 *
 * 它回答一个很具体的问题：**冠军在真人玩家面前，到底会打几张卡、打得多不均、哪些卡一次都没打过。**
 * 只给一个"广度 G"是不够的（§2.2 立这条的直接起因：G 从 5.94 掉到 3.56，其中相当一部分是用户 09-29 裁定过的方向
 * —— v1.5.304 把 ε 探索池里的防御键剔掉 ⇒ 防御族从 ~24% 掉到 ~0；把"按裁定收窄"读成"回归"就会去修一个已经改好的东西）。
 * ⇒ 所以四个量一起印：**① 每一项的出现率（带分母）② 前 3 占比 ③ 出现的种数 ④ G=exp(Shannon 熵)**，
 *   并另列**表外 token**（读不出）与**一次都没出现的卡**（没学会）——这两条都是"分母之外的证据"，混进四量里就会互相冒充。
 *
 * 用法：node tools/log-census.mjs [目录或文件...] [--human=1] [--seats=2,3,4,5] [--json]
 *      （不给参数 = `results/` 下递归最新 5 个 `.txt`，与 `log-behavior.mjs` 同口径）
 * ⚠️ 只读：不写 results/、不改任何包。读取实现与 `log-behavior.mjs` **同一份**（`tools/log-reading.mjs`；
 *    门 **D216** 用夹具跑两个入口，断言"局数 / 有效手 / 逐项计数 / 四个广度量"逐字相同 —— 两份实现必漂移是本仓的老病）。
 */
import { rejectUnknownFlags } from './audit-lib.mjs';
import { loadCardTable, seatList, collectFiles, census, breadth, defShare } from './log-reading.mjs';

rejectUnknownFlags(process.argv.slice(2), ['human', 'seats', 'json'], 'log-census');

const T = loadCardTable();
const ARGV = process.argv.slice(2);
const WANT_ARGS = ARGV.filter(function (a) { return a.indexOf('--') !== 0; });
const SEATS = seatList(ARGV);
const FILES = collectFiles(ARGV);
const C = census(FILES, SEATS, T);
const B = breadth(C.byCard, C.hands);
const D = defShare(C, T);
const JSON_OUT = ARGV.indexOf('--json') >= 0;

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({
    seats: SEATS, files: FILES.length, games: C.games, raw: C.raw, elim: C.elim, hands: C.hands,
    kinds: B.kinds, top3: B.top3, H: B.H, G: B.G,
    defense: { names: T.defNames, n: D.def, share: D.share },
    dist: B.rows.map(function (o) { return { card: o.name, n: o.n, pct: 100 * o.n / C.hands }; }),
    unknown: C.unknown, never: C.zero, cardTableSize: T.names.length
  }) + '\n');
} else {
  console.log('# 真机栏清点单（`tools/log-census.mjs`）');
  console.log('# 口径：逐回合行 `玩家N=【行动】` ‖ AI 席 = ' + SEATS.join('/') + '（真人席已剔除）‖ 分母**剔 `已淘汰`**' +
    '（那是座位死亡后的状态占位，不是出招）‖ 卡名从 `js/core/rules.js` 现取、桶=**精确卡名**（不写第二份名单）');
  console.log('# 样本：' + C.games + ' 局 / ' + FILES.length + ' 个文件 ‖ 原始计数 ' + C.raw + ' ‖ `已淘汰` ' + C.elim +
    '（' + (100 * C.elim / Math.max(1, C.raw)).toFixed(1) + '%）‖ **有效出手 ' + C.hands + '** ‖ 均 ' +
    (C.roundsAll / Math.max(1, C.games)).toFixed(1) + ' 回合/局');
  console.log('# 复跑命令：node tools/log-census.mjs ' +
    (WANT_ARGS.length ? WANT_ARGS.join(' ') : '（无参数 = results/ 下递归最新 5 个 .txt）') + ' [--seats=' + SEATS.join(',') + ']');
  console.log('\n## ① 每一项出现率（带分母 = 有效出手 ' + C.hands + '）');
  for (const o of B.rows) {
    console.log('  ' + o.name.padEnd(6) + ' ' + String(o.n).padStart(4) + ' 手 ‖ ' +
      (100 * o.n / Math.max(1, C.hands)).toFixed(1) + '% ‖ ' + (o.n / Math.max(1, C.games)).toFixed(2) + '/局');
  }
  console.log('\n## ②③④ 广度四量（**四个一起说，不许只报 G**）');
  console.log('  前 3 占比 **' + B.top3.toFixed(1) + '%** ‖ 出现的种数 **' + B.kinds + '**（卡表共 ' + T.names.length + ' 张）' +
    ' ‖ Shannon 熵 H **' + B.H.toFixed(3) + '** ‖ **G = exp(H) = ' + B.G.toFixed(2) + '**（= "等效在用的卡数"）');
  console.log('  防御类合计 ' + D.def + ' 手 = **' + D.share.toFixed(1) + '%**（成员：' + T.defNames.join('/') + '）');
  console.log('\n## ⑤ 分母之外的两条证据（不许混进四量）');
  console.log('  · **一次都没出现**的卡 ' + C.zero.length + ' 张：' + (C.zero.length ? C.zero.join(' / ') : '（无）'));
  if (Object.keys(C.unknown).length) {
    console.log('  · ⚠️ **表外 token ' + Object.keys(C.unknown).length + ' 种 = 读不出，不是没打**（规则表里没这个名字；卡改名或日志格式变了会走这里）：' +
      Object.keys(C.unknown).sort(function (a, b) { return C.unknown[b] - C.unknown[a]; })
        .map(function (k) { return k + '=' + C.unknown[k]; }).join(' · '));
  } else {
    console.log('  · 表外 token：**0**（每一条 AI 出手都落进了卡表的某个精确卡名）');
  }
  console.log('\n读法：这一栏只是**三栏之一**（另两栏 = ε=0 仪器栏 `tools/behavior-profile.mjs` / 浏览器栏 `tools/np-probe.mjs`）。');
  console.log('      三栏已知会不一致、而且常常不一致 ⇒ **只报一栏等于没报**（DS 交接件 §2.1）。');
  console.log('      报"广度变了"之前，必须同时说明**这一项是不是用户裁定过的方向**（§2.2 的例子：v1.5.304 剔 ε 防御键 ⇒ 防御族下跌是预期）。');
}
