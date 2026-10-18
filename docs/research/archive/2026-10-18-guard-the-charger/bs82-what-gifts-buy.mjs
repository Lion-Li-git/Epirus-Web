/* v7beadseed-82 的送盾到底在赌什么：mirror 桌上逐手送盾去查
 *   ① 送盾那一回合，目标吃到的"可挡伤害合计"是否 ≥3 ⇒ 原型制御反伤是否触发（resolve.js:268 protoReflectAll）
 *   ② 触发了 ⇒ 反伤打到谁身上（送盾者相对受益 = 打到第三方）
 *   ③ 送盾的对象是不是"本回合被集火的那席"（选择性），还是无差别
 * 口径：与体检同源（同一枚包、`policyChooserN(params,0.15)`、5 座同包、seed0=90210）。只读数，不改引擎、不加门。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
/* ROOT 自解析（10-18 归仓时改）：本文件在 docs/research/archive/<本轮>/ 下 ⇒ 往上 4 级是仓根；`WT=` 可覆盖。 */
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const imp = (p) => import(pathToFileURL(ROOT + '/' + p).href);
const { sandbox, loadChamp } = await imp('tools/audit-lib.mjs');
const { duelAssembly } = await imp('tools/v2v4-lib.mjs');
const W = sandbox(ROOT);
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const G = Number(process.argv[2] || 300);
const MODE = process.argv[3] || 'multi';
const params = loadChamp(W, 'docs/artifacts/v7beadseed-82.bak', ROOT);
if (!params) { console.error('⛔ 包读不出'); process.exit(7); }

const STAT = { games: 0, gift: 0, fired: 0, reflDmg: 0, reflHitThirdParty: 0,
  tgtAddressed: 0, tgtMostAttacked: 0, tied: 0, blockedSumBuckets: {} };

let RS = [], prevEv = 0, lastSt = null;
const onTurn = function (st) {
  if (st !== lastSt) { prevEv = 0; lastSt = st; RS = []; }
  const evLen = (st.events || []).length;
  const acts = [];
  for (let i = 0; i < st.p.length; i++) {
    const a = st.actions ? st.actions[i] : null;
    if (a && a.key) acts.push({ pid: i, key: a.key, target: a.target != null ? Number(a.target) : null, voided: !!a.voided });
  }
  RS.push({ rd: st.round, s: prevEv, e: evLen, acts });
  prevEv = evLen;
};
const onGame = function (st) {
  STAT.games++;
  const ev = st.events || [];
  for (const w of RS) {
    const gift = w.acts.filter(a => a.key === R.SK.HOLO && a.target != null && !a.voided);
    if (!gift.length) continue;
    /* 这一回合每一席吃到的"可挡伤害"（blocked 且 by=原型制御）与它被攻击的次数 */
    const atk = {};
    for (let i = w.s; i < w.e; i++) {
      const e = ev[i]; if (!e) continue;
      if (e.type === 'blocked' && e.to != null) {
        if (e.by === '原型制御') atk[e.to] = (atk[e.to] || 0) + 1;
      }
      if (e.type === 'damage' && e.to != null && e.source != null && e.source !== e.to) atk[e.to] = (atk[e.to] || 0) + 1;
    }
    let kMax = -1, nMax = -1, tie = 0;
    for (const k in atk) { if (atk[k] > nMax) { nMax = atk[k]; kMax = Number(k); tie = 1; } else if (atk[k] === nMax) tie++; }
    /* 只留"窗口内"的量（决策时刻的场面选择性交给 support-probe，它有决策时快照与在册同口径的点名率）
     * ⚠ 反伤的门槛只数**原型制御挡住的那一份**（`protoNote` 只累计进 proto 持有者，地雷与转伤一律豁免）
     *   ⇒ 把别的盾（防御/藤甲/反弹/八卦/金刚）也算进来会高估触发率。 */
    const protoSum = {};
    for (let i = w.s; i < w.e; i++) {
      const e = ev[i];
      if (e && e.type === 'blocked' && e.by === '原型制御') protoSum[e.to] = (protoSum[e.to] || 0) + (e.amt || 0);
    }
    for (const g of gift) {
      STAT.gift++;
      const sum = protoSum[g.target] || 0;
      if ((atk[g.target] || 0) > 0) STAT.tgtAddressed++;
      const b = sum >= 6 ? '>=6' : sum >= 3 ? '3-5' : sum >= 1 ? '1-2' : '0';
      STAT.blockedSumBuckets[b] = (STAT.blockedSumBuckets[b] || 0) + 1;
      if (sum >= 3) STAT.fired++;
      if (g.target === kMax && tie === 1) STAT.tgtMostAttacked++;
    }
    if (tie > 1) STAT.tied++;
  }
  for (const e of ev) {
    if (e.type === 'reflect' && e.by === 'proto') { STAT.reflDmg += (e.amt || 0); STAT.reflHitThirdParty++; }
  }
};

duelAssembly({ S, Play, T, R }, params, { games: G, mode: MODE, seed0: 90210, n: 5, scripted: 'champ', onTurn, onGame });

console.log('## mirror 桌 5×v7beadseed-82 ‖ mode=' + MODE + ' ‖ 局 ' + STAT.games + '（seed0=90210，ε 与体检同源）');
console.log('  送盾手数 ' + STAT.gift + '（' + (STAT.gift / STAT.games).toFixed(2) + '/局）');
const pc = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '—');
console.log('  送盾那回合目标的"可挡伤害合计"分档：' + JSON.stringify(STAT.blockedSumBuckets));
console.log('  ⇒ 反伤触发（合计≥3）' + STAT.fired + ' 次 = ' + pc(STAT.fired, STAT.gift) + ' 的送盾');
console.log('  反伤事件 ' + STAT.reflHitThirdParty + ' 次，反伤总量 ' + STAT.reflDmg.toFixed(1) + '（每局 ' + (STAT.reflDmg / STAT.games).toFixed(2) + '）');
console.log('  送盾那回合**目标真被招呼过** ' + STAT.tgtAddressed + '/' + STAT.gift + ' = ' + pc(STAT.tgtAddressed, STAT.gift) + '（其余是窗内根本没人来 = 白给）');
console.log('  送盾给"本回合被攻击最多的那席" ' + STAT.tgtMostAttacked + '/' + STAT.gift + ' = ' + pc(STAT.tgtMostAttacked, STAT.gift) + '（无差别点名的话约 20~25%，另有 ' + STAT.tied + ' 个回合是并列无法判）');
