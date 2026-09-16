/* 候选**槽位数**对采样概率的影响（v1.5.72；起因：用户问"为什么冠军爱用全息屏障却从不用原型制御、
 * 以及没 ji 却用蓄能 —— 是不是你原始输入带来的偏好？"）。
 *
 * 机制断言（先写下、再验）：
 *   `chooseCandidates`（js/train/policy.js:644-647）是在**候选条目**上做 softmax 采样，
 *   而不是在**技能**上 ⇒ 同一个技能的不同目标/珠类型是**互相竞争的独立选项** ⇒
 *   条数多的技能被系统性放大：
 *     枪/狙击/坦克/激光剑（enemy）＝ 每个存活对手 1 条（最多 4）
 *     全息屏障（other）＝ 最多 4 条        ⇐ 与原型制御同费用同效果，但槽位 4:1
 *     原型制御 / 聚能环 / 防御 / 反弹（self）＝ 1 条
 *     蓄能（self, 两种珠）＝ **2 条**
 *
 * 判据（可反证）：若 `probMax[全息] ≈ probMax[原型制御]` 而 `probSum[全息] ≈ 4 × probSum[原型制御]`，
 * 则"偏好"来自**槽位数**而不是网络学到的价值 ⇒ 是输入/枚举侧的结构性偏差。
 *
 * 用法：node tools/probe-candslot.mjs [包] [局数] [目标回合]
 */
import { sandbox, loadChamp } from './audit-lib.mjs';

const W = sandbox();
const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const file = process.argv[2] || 'js/bundled-champion-3p.js';
const G = Number(process.argv[3] || 12);
const TR = Number(process.argv[4] || 8);
const params = loadChamp(W, file);
const probeSeat = 0;

const entry = {}, probSum = {}, probMax = {}, seen = {};
let samples = 0;
const chargeEp = {};            // 选中蓄能时的 ep 分布
const chargeCandEp = {};        // 蓄能出现在候选里时的 ep 分布（含未被选中）

for (let g = 0; g < G; g++) {
  const st = S.createState('long', { next: T.mulberry32(4500 + g) }, 5);
  st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
  const base = T.policyChooserN(params, 0.15);
  let hit = false;
  const wrap = function (state, pid, legal) {
    if (pid === probeSeat && state.round === (TR + (g % 4)) && !hit) {
      hit = true;
      const cands = P.candidatesFor(state, pid, legal, {});
      const f = P.forwardCands(state, pid, cands, params, { temp: 0.15 });
      const ep = state.p[pid].ep;
      samples++;
      for (let i = 0; i < cands.length; i++) {
        const k = cands[i].key;
        entry[k] = (entry[k] || 0) + 1;
        probSum[k] = (probSum[k] || 0) + f.probs[i];
        if (!(k in probMax) || f.probs[i] > probMax[k]) probMax[k] = f.probs[i];
        if (k === R.SK.CHARGE) chargeCandEp[ep] = (chargeCandEp[ep] || 0) + 1;
      }
      const pick = P.chooseCandidates(state, pid, cands, params, { temp: 0.15 });
      seen[pick.key] = (seen[pick.key] || 0) + 1;
      if (pick.key === R.SK.CHARGE) chargeEp[ep] = (chargeEp[ep] || 0) + 1;
    }
    return base(state, pid, legal);
  };
  Play.autoGameN(st, [wrap, base, base, base, base]);
}

const keys = Object.keys(entry);
const avg = function (o, k) { return o[k] ? o[k] / samples : 0; };
keys.sort(function (a, b) { return avg(probSum, b) - avg(probSum, a); });
console.log('== 候选槽位 vs 采样概率：' + file + '（' + samples + ' 个中期决策，目标回合≈' + TR + '）==');
console.log('技能'.padEnd(14) + '槽位数/决策  聚合概率(该技能被选中)  单条最高概率');
for (const k of keys) {
  console.log(String(k).padEnd(14) + String((entry[k] / samples).toFixed(2)).padEnd(14) +
    (avg(probSum, k) * 100).toFixed(1).padStart(8) + '%' + '            ' + (probMax[k] * 100).toFixed(1) + '%');
}
console.log('\n实际采样命中（' + G + ' 次决策）：' + JSON.stringify(seen));
console.log('选中蓄能时的 ep 分布：' + JSON.stringify(chargeEp) + '（蓄能花费 1 ジ）');
console.log('蓄能出现在候选里时的 ep 分布：' + JSON.stringify(chargeCandEp));
console.log('\n珠子消费技能的费用：电磁炮(railgun)=' + JSON.stringify(R.byKey[R.SK.RAILGUN].cost) +
  ' 天火(firestorm)=' + JSON.stringify(R.byKey[R.SK.FIRESTORM].cost) +
  '  ⇒ 若在 ep=1 时蓄能，下回合**必然凑不出**这两张卡 ⇒ 珠子必定过期。');
