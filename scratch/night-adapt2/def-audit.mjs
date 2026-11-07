/* 白防率审计（用户 11-08 晨令："重点是学会正确防御，测一下白防率"）
 *
 * 定义：防御出手（focus 席，key ∈ defense 类）后，窗口内**没有任何敌方指向我的伤害/格挡事件** = 白防。
 *   窗口 = 本回合剩余 + 下一回合（防御通常跨 2 回合；两档都报）。
 *   承击 = 窗口内有敌方→我 damage 或 blocked(to=我) 事件；其中有过 blocked = 防住了。
 * 回合归属：事件不带 round ⇒ 按焦点席决策序列分桶（seat0 每回合先手，两次决策之间 = 同一回合）。
 * 用法: node scratch/night-adapt2/def-audit.mjs  （games=200/包）
 */
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules, Play = W.EpirusPlay, B = W.EpirusBots;
const GAMES = Number(process.argv[2] || 200);
const DEF_KEYS = (R.SKILLS || R.skills || []).filter(s => s.cat === 'defense').map(s => s.key);
const CAT = k => { const s = (R.SKILLS || []).find(x => x.key === k); return s ? s.cat : null; };
const SCRIPTS = ['pickGunSpam', 'pickGuardSpam', 'pickDeepSaver', 'pickHeavyFire', 'pickMix', 'pickAggro', 'pickDeadlineBurst', 'pickEarlyPressure'];

async function audit(lab, f) {
  const p = loadChamp(W, f);
  let casts = 0, baiStrict = 0, baiLoose = 0, cheng = 0, fangzhu = 0, defKeysUsed = {};
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: T.mulberry32(30000 + g) }, 5);
    const focalActs = [];   /* {round, key} 决策时记 */
    const wrap = i => (state, pid, legal) => {
      const k = (i === 0) ? T.policyChooserN(p, 0.15)(state, pid, legal) : B[SCRIPTS[(g * 5 + i) % SCRIPTS.length]](state, pid, legal);
      if (i === 0) { const key = typeof k === 'string' ? k : (k && k.key); if (key) focalActs.push({ round: state.round, key }); }
      return k;
    };
    Play.autoGameN(st, [wrap(0), wrap(1), wrap(2), wrap(3), wrap(4)]);
    /* 事件分桶：焦点席第 k 次决策之前的事件属于"第 k 桶"（其决策所在回合），桶界 = 决策时刻 */
    const buckets = [];   /* buckets[b] = {dmgToMe, blockedMe} */
    let bi = 0;
    buckets.push({ dmg: 0, blk: 0 });
    for (const e of st.events) {
      if (e.type === 'action' && e.pid === 0) { bi++; buckets.push({ dmg: 0, blk: 0 }); continue; }
      const b = buckets[Math.min(bi, buckets.length - 1)];
      if (e.type === 'damage' && e.to === 0 && e.source !== 0) b.dmg++;
      if (e.type === 'blocked' && e.to === 0) b.blk++;
    }
    /* 每次防御出手：它的桶 = 它自己决策产生的那个桶（bi 在它自己 push 后的索引）。
     * 重新走一遍对齐：直接重扫，防御决策在 focalActs 里的序位 = 它决策时 buckets 已 push 的次数。 */
    let actIdx = 0;
    for (let k = 0; k < focalActs.length; k++) {
      const a = focalActs[k];
      if (!DEF_KEYS.includes(a.key)) continue;
      casts++; defKeysUsed[a.key] = (defKeysUsed[a.key] || 0) + 1;
      /* 找到这次防御决策对应的桶号：数它前面（含自己）的 focal 决策数 = 桶索引 */
      const myBucket = k;   /* focalActs 与 focal 决策一一对应 ⇒ 第 k 次决策的桶 = buckets[k+1]（自己 push 的那个） */
      const win1 = buckets[myBucket + 1] || { dmg: 0, blk: 0 };
      const win2 = buckets[myBucket + 2] || { dmg: 0, blk: 0 };
      const hit1 = (win1.dmg + win1.blk) > 0, hit2 = (win2.dmg + win2.blk) > 0;
      if (!hit1) baiStrict++;
      if (!hit1 && !hit2) baiLoose++;
      if (hit1 || hit2) { cheng++; if (win1.blk > 0 || win2.blk > 0) fangzhu++; }
    }
  }
  const pct = (a, b) => (b ? (a / b * 100).toFixed(1) + '%' : '—');
  console.log(lab.padEnd(18) + ' 防御出手 ' + String(casts).padStart(4)
    + ' ‖ 白防率 严格 ' + pct(baiStrict, casts) + ' / 跨两回合 ' + pct(baiLoose, casts)
    + ' ‖ 承击 ' + pct(cheng, casts) + '（防住 ' + pct(fangzhu, casts) + '）'
    + ' ‖ 键分布 ' + JSON.stringify(defKeysUsed));
}

for (const [lab, f] of [
  ['Q-s47(v7教师)', 'docs/artifacts/e507-out/Q-s47.js'],
  ['T8-s114(v7现役)', 'js/bundled-champion-3p.js'],
  ['KD-Qg(克隆种子)', 'scratch/night-adapt2/KD-Qg.bak'],
  ['CTRL2-Q(裸跑)', 'docs/artifacts/night-adapt/CTRL2-Q-s13.js'],
  ['ADAPT2-Q(课程+credit)', 'docs/artifacts/night-adapt/ADAPT2-Q-s13.js'],
]) {
  try { await audit(lab, f); } catch (e) { console.log(lab + ' 失败: ' + e.message.slice(0, 60)); }
}
process.exit(0);
