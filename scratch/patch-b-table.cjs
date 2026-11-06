const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');
const anchor = "  laserBank: { name: 'cnt:laserBank', sel: Bots.pickLaserBank }";
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
const add = anchor + `,

  /* ---- 11-01（ZCode · PREREG-2026-11-01-LONGSHORT b 部分）：RICH 压力席进 GA 训练桌（**加法，默认关**）----
   *   名单与 server/opp-pool.mjs 的 OPP_SPECS 同源同名（fn 逐字同引用）；不点 EPIRUS_COUNTER_OPPS 时一条行为不变
   *   （回归腿：v7 1 代小跑逐代轨迹逐字同）。RICH-13 的 6 个压力源 + 产品 7 里原生表没有的 heavyfire/deepsaver。
   *   gunspam 与表里既有 gunSpam 是同一函数（OPP_SPECS 的 fn 名），两个键只是别名，别重复加席。 */
  heavyfire: { name: 'cnt:heavyfire', sel: Bots.pickHeavyFire },
  deepsaver: { name: 'cnt:deepsaver', sel: Bots.pickDeepSaver },
  protomine: { name: 'cnt:protomine', sel: Bots.pickProtoMine },
  ringspam: { name: 'cnt:ringspam', sel: Bots.pickRingSpam },
  targeter: { name: 'cnt:targeter', sel: Bots.pickTargeter },
  deadlineburst: { name: 'cnt:deadlineburst', sel: Bots.pickDeadlineBurst },
  earlypressure: { name: 'cnt:earlypressure', sel: Bots.pickEarlyPressure }`;
s = s.replace(anchor, add);
fs.writeFileSync('tools/train-3p.mjs', s);
console.log('b-table wired');
