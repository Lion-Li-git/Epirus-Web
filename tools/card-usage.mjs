#!/usr/bin/env node
/* card-usage.mjs —— 每枚包的**按卡出手谱**（同一把尺，供池内/对 v7 横比 · 11-08 立）
 *
 * 为什么要有它（用户 11-08：「光看过线和强度那和 v7 就没差了。2.0 包要全方位优于 v7 包」）：
 *   现有的尺都只看「结果」（X̄₄、12 线门）或只看「防御一类」（behavior-profile 的 defShare），
 *   没有一把尺把**用了哪几张卡、各占多少**摊平 —— 于是「2.0 只会两三招」这件事一直只在小圈子里口口相传。
 *   实测（11-08）：v7 三枚用 9~11 张卡、防御三件（guard/reflect/bagua）全开；池里 17 枚中位 6 张、八卦 0/17。
 *
 * 口径（与 usage-probe 的镜像装配一致，但输出逐卡而不是聚合）：
 *   **5 席全是被测包自己**（镜像自对局）、ε=0 贪心、默认 multi 桌、60 局；
 *   只数 type==='action' && outcome==='ok' 的出手（与 aggressionProfile 同判据）；防御类按 cat==='defense' 归类，
 *   **不硬编码卡名单**。输出「用卡数」= 占比 ≥0.5% 的卡有几张。
 *
 * 用法：node tools/card-usage.mjs --packs=a.js,b.bak [--games=60] [--mode=multi|long] [--out=x.tsv]
 * 退出码：0 = 跑完 ‖ 2 = 读不出包/参数不齐
 */
import { writeFileSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags, cardUsageProfile } from './audit-lib.mjs';

rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'mode', 'out', 'eps'], 'card-usage');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PACKS = String(arg('packs', '')).split(',').map(s => s.trim()).filter(Boolean);
const GAMES = Number(arg('games', 60));
const MODE = arg('mode', 'multi');
const OUT = arg('out', '');
if (!PACKS.length) { console.error('用法：node tools/card-usage.mjs --packs=a.js,b.bak [--games=60] [--mode=multi|long] [--out=x.tsv]'); process.exit(2); }

const W = sandbox();
/* 引擎句柄与"打一局→数逐卡"都在 `audit-lib.cardUsageProfile` 里（11-09 抽出，训练侧 SEL_CARDS 共用同一把尺）
 * ⇒ 本文件只负责选包、打印、落表，不再自带第二份计数算术。 */
const rows = [];
for (const f of PACKS) {
  const params = loadChamp(W, f);
  if (!params) { console.error('⛔ 读不出包：' + f); process.exit(2); }
  /* 11-09：对局循环搬进 `audit-lib.cardUsageProfile` ⇒ 这把 CLI 与训练侧的 `EPIRUS_SEL_CARDS` 用的是**同一把尺**
   * （同种子序列、同不设 slotSalt、同阈值）。原来在这儿自己写一遍的后果是：同一枚包在两处读出 8 张 / 9 张，
   * 差的正是压在 ≥0.5% 线上的 `bigT 0.51%` ⇒ 地板不能建在两个分母上。 */
  const u = cardUsageProfile(W, params, { games: GAMES, mode: MODE });
  const acts = u.acts, pct = u.pct, keys = u.keys, defShare = u.defShare;
  const id = f.replace(/^.*\//, '').replace(/\.(bak|js)$/, '');
  rows.push({ id, path: f, acts, keys, pct, defShare, distinct: keys.length });
  console.log(id.padEnd(14) + ' 出手 ' + String(acts).padStart(6) + ' 用卡 ' + String(keys.length).padStart(2) + ' 防御占比 ' + defShare.toFixed(0) + '%  ' + keys.slice(0, 8).map(k => k + ' ' + pct[k].toFixed(0) + '%').join(' '));
}
if (OUT) {
  const allKeys = [...new Set(rows.flatMap(r => r.keys))];
  const norm = OUT.indexOf('/') >= 0 ? OUT : OUT;
  writeFileSync(norm, ['id','path','acts','distinct','defShare', ...allKeys].join('\t') + '\n'
    + rows.map(r => [r.id, r.path, r.acts, r.distinct, r.defShare.toFixed(1), ...allKeys.map(k => (r.pct[k] || 0).toFixed(2))].join('\t')).join('\n') + '\n');
  console.log('写 ' + norm + '（卡 ' + allKeys.length + ' 张）');
}
