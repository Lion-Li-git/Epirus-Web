#!/usr/bin/env node
/* ============================================================================
 * probe-target-ties.mjs —— **复核 §E180「意外之二」/ DS §1 的平票读数**（§E181 · 第三方独立跑一遍）
 *
 * 为什么要另开一台：DS 把他的第⑤节加在我的仪器里，我得独立复算一遍他的三个关键断言
 *   ① 平票率的分母是不是真的独立了（他第一版拿 `tie.dec` 当分母 ⇒ 恒 100%）；
 *   ② "平票目标属性一样 111 / 不一样 0" —— 他只读了 `hp/ep` 两列 ⇒ 我要验的是**整条动作段**逐位；
 *   ③ 他那行"反转候选列表后第一名换人 100%"到底测的是什么。
 *
 * ⚠ 本机**自己踩过两个坑，都记在这里**：
 *   ① 第一版我用 `P.value(state,pid,key,params,null)` 打分 —— 少了第 6 个形参 `cand`
 *     ⇒ `actionFeatures` 里 `tid=null` ⇒ **目标那 7 列整块填零** ⇒ 我数出 263 个"平票"（真值的两倍多），
 *       因为同一张卡打谁都同分。这是"传了没人读"那一族：**打分函数少传一个形参不报错，只静默看不见目标。**
 *     ⇒ 所以本机的自检**不是**"传 cand vs 不传"（那不传时是同一个数减自己 ⇒ 恒等于 0 ⇒ 同义反复、
 *       看着像自检其实什么都验不了），而是**"本机的 argmax 是否等于出厂那只手的 pick"**：
 *       只有两者同源，我数的平票集合才是真的比较集合。
 *   ② "反转候选列表后第一名换人 100%"这一行（DS 的第⑤节）测的是**排好序再 `reverse()[0]`**
 *     = 取**最低分**那个 ⇒ 只要有 ≥2 个候选就恒成立，与平票无关。本机改用真反事实
 *     （倒转**枚举顺序**再稳定排序取 argmax），并同时印出**它为什么必然是 100%**（平票组大小 + 组内位置分布），
 *     免得一个同义反复被读成一条发现。
 *
 * 用法：node tools/probe-target-ties.mjs [--games=30] [--seed=77000] [--n=3] [--json=…]
 * ==========================================================================*/
import { writeFileSync } from 'node:fs';
import { sandbox, rejectUnknownFlags, mulberry32, loadChamp } from './audit-lib.mjs';
import { poolFromSpecs } from './regime-panel.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
rejectUnknownFlags(process.argv.slice(2), ['games', 'seed', 'n', 'json', 'quiet']);
const GAMES = Math.max(1, Number(arg('games', 30)) || 30);
const N = Math.max(2, Number(arg('n', 3)) || 3);
const SEED0 = Number(arg('seed', 77000)) || 77000;
const QUIET = process.argv.indexOf('--quiet') >= 0;

const W = sandbox(), P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, B = W.EpirusBots;
const params = (function () { const p = loadChamp(W, 'js/bundled-champion-3p.js'); return p && p.params ? p.params : p; })();
const sel = T.policyChooserN(params, 0.15);
const { pool } = poolFromSpecs(B, OPP_SPECS);
const FA = P.FEAT_A, FS = P.FEAT_S;

/* ---- 自检：本机的"逐候选打分"必须与**出厂那条打分路径**给出同一个第一名 ----
 * 为什么不是"传 cand vs 不传"那种对比：不传时同一个数减它自己恒等于 0 ⇒ **同义反复**，
 *   看着像自检、其实什么都验不了（本仓"给自己打勾的自检"那一族，§E134 的窗口自检同形）。
 *   真正要问的是：**我数的平票集合，是不是出厂那只手真的在比较的集合？**
 *   ⇒ 用一个温度趋零的确定性 chooser 走同一批决策，比"它的 pick"与"我的 argmax"。 */
const pickRef = T.policyChooserN(params, 1e-6);
function shippedAgreement() {
  let n = 0, agree = 0, mismatch = [];
  const tieAgree = { skipped: 0 };
  for (let g = 0; g < Math.min(6, GAMES); g++) {
    const st = S.createState('multi', { next: mulberry32(SEED0 + g * 7919) }, N);
    st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
    const opp = pool[g % pool.length].sel;
    const probe = function (state, pid, legal) {
      if (pid === 0) {
        const aff = (legal || []).filter(l => l.affordable);
        const base = aff.length ? aff : [{ key: 'ji', affordable: true }];
        let eb = base, cands = [];
        try { eb = T.econBase(state, pid, base) || base; } catch (e) { eb = base; }
        try { cands = P.candidatesFor(state, pid, eb, {}); } catch (e) { cands = []; }
        const r = pickRef(state, pid, legal);
        /* ⚠ 这条自检第一版写错了（**判据错位**那一族）：它要求"我的 argmax == 出厂的 pick"覆盖**全部**决策，
         *   可平票决策上出厂本来就在两个同分候选之间采样 ⇒ 永远对不齐（实测 90.2% 被我判成 ⛔）。
         *   正确的分母 = **第一名唯一**的那些决策；平票那部分本来就允许不同 ⇒ 单独计数、不参与判定。 */
        let tops = 0;
        if (cands.length > 1) {
          let bv = -Infinity;
          for (const c of cands) { const v = P.value(state, pid, c.key, params, null, c); if (v > bv) bv = v; }
          for (const c of cands) if (Math.abs(P.value(state, pid, c.key, params, null, c) - bv) <= 1e-12) tops++;
          if (tops === 1) {
            n++;
            let bs = null; bv = -Infinity;
            for (const c of cands) {
              const v = P.value(state, pid, c.key, params, null, c);
              if (v > bv) { bv = v; bs = c.key + '@' + (c.target == null ? '-' : c.target); }
            }
            const rs = r ? (r.key + '@' + (r.target == null ? '-' : r.target)) : null;
            if (rs === bs) agree++; else if (mismatch.length < 3) mismatch.push('第' + (g + 1) + '局 r' + state.round + '：出厂 `' + rs + '` ‖ 本机 `' + bs + '`');
          } else tieAgree.skipped++;
        }
        return r;
      }
      return opp(state, pid, legal);
    };
    const chs = [probe]; for (let i = 1; i < N; i++) chs.push(opp);
    Play.autoGameN(st, chs.slice(0, N), undefined, () => {});
  }
  return { ok: n > 20 && agree / n >= 0.98, n, agree, skippedTie: tieAgree.skipped, rate: agree / Math.max(1, n), mismatch };
}

const tie = { decisions: 0, n: 0, afAllSame: 0, afSomeDiff: 0, pairs: 0, pairsAfSame: 0, pairsAfDiff: 0, hpEpSame: 0, hpEpDiff: 0, sameAttrsButAfDiff: 0, pickInTied: 0 };
const tieSizes = {}, pickPos = {}, wide = {}, firstTargets = {}, byRound = { 'r1-2': 0, 'r3-5': 0, 'r6+': 0 };
const examples = [];
for (let g = 0; g < GAMES; g++) {
  const st = S.createState('multi', { next: mulberry32(SEED0 + g * 7919) }, N);
  st.slotSalt = (Math.imul(g + 5, 0x9e3779b1) ^ 0x5f3759df) >>> 0;
  const opp = pool[g % pool.length].sel;
  let firstSeen = false;
  const mine = function (state, pid, legal) {
    if (pid !== 0) return opp(state, pid, legal);
    tie.decisions++;
    const aff = (legal || []).filter(l => l.affordable);
    const base = aff.length ? aff : [{ key: 'ji', affordable: true }];
    let eb = base, cands = [];
    try { eb = T.econBase(state, pid, base) || base; } catch (e) { eb = base; }
    try { cands = P.candidatesFor(state, pid, eb, {}); } catch (e) { cands = []; }
    if (!cands.length) for (const l of eb) cands.push({ key: l.key, target: null, bead: null });
    const sc = cands.map(c => ({ c, sig: c.key + '@' + (c.target == null ? '-' : c.target),
      v: P.value(state, pid, c.key, params, null, c), af: P.actionFeatures(state, pid, c.key, c) }));
    const best = Math.max.apply(null, sc.map(s2 => s2.v));
    const idx = []; sc.forEach((s2, i) => { if (Math.abs(s2.v - best) <= 1e-12) idx.push(i); });
    const picked = sel(state, pid, legal);
    const pickSig = picked ? (picked.key + '@' + (picked.target == null ? '-' : picked.target)) : null;
    if (picked && picked.target != null && !firstSeen) { firstSeen = true; firstTargets[String(picked.target)] = (firstTargets[String(picked.target)] || 0) + 1; }
    const diffT = idx.length > 1 && idx.some(i => String(sc[i].c.target) !== String(sc[idx[0]].c.target));
    if (idx.length > 1 && diffT) {
      tie.n++;
      const rd = state.round; byRound[rd <= 2 ? 'r1-2' : rd <= 5 ? 'r3-5' : 'r6+']++;
      tieSizes[String(idx.length)] = (tieSizes[String(idx.length)] || 0) + 1;
      /* 出厂那只手在这一堆同分候选里选了第几个（0 = 枚举顺序第一个）⇒ 这才是"顺序 vs 采样"的证据 */
      const posOf = idx.findIndex(i => sc[i].sig === pickSig);
      if (posOf >= 0) { tie.pickInTied++; pickPos[String(Math.min(posOf, 4))] = (pickPos[String(Math.min(posOf, 4))] || 0) + 1; }
      /* **正确的**反事实：倒转**枚举顺序**再取 argmax（稳定排序 ⇒ 平票组内部次序翻转）。
       * ⚠ 这条对任何平票**必然**成立 ⇒ 它不是证据、是同义反复（DS 那一行印 100% 的真原因见 §E181③）。
       *   所以我把它连同"平票组大小"一起印，让读者看见它为什么必然。 */
      const revTop = sc.slice().reverse().sort((a, b2) => b2.v - a.v)[0];
      const fwdTop = sc.slice().sort((a, b2) => b2.v - a.v)[0];
      const revFlips = !!(revTop && fwdTop && revTop.sig !== fwdTop.sig);
      tie['rev' + (revFlips ? 'Flip' : 'Same')] = (tie['rev' + (revFlips ? 'Flip' : 'Same')] || 0) + 1;
      let pairs = 0, same = 0, diff = 0;
      for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) {
        const A = sc[idx[a]], C = sc[idx[b]];
        if (A.c.key !== C.c.key || String(A.c.target) === String(C.c.target)) continue;
        pairs++; tie.pairs++;
        const dl = []; for (let k = 0; k < A.af.length; k++) if (Math.abs((A.af[k] || 0) - (C.af[k] || 0)) > 1e-12) dl.push(k);
        const ta = state.p[A.c.target], tc = state.p[C.c.target];
        const he = !!(ta && tc && ta.hp === tc.hp && ta.ep === tc.ep);
        if (he) tie.hpEpSame++; else tie.hpEpDiff++;
        if (dl.length === 0) { same++; tie.pairsAfSame++; }
        else {
          diff++; tie.pairsAfDiff++; if (he) tie.sameAttrsButAfDiff++;
          for (const k of dl) wide[k] = (wide[k] || 0) + 1;
          if (examples.length < 6) examples.push({ g, round: rd, key: A.c.key, t1: A.c.target, t2: C.c.target, diffDims: dl, attrs: [ta && (ta.hp + '/' + ta.ep), tc && (tc.hp + '/' + tc.ep)], score: sc[idx[a]].v });
        }
      }
      if (pairs) { if (diff === 0) tie.afAllSame++; else tie.afSomeDiff++; }
    }
    return picked;
  };
  const chs = [mine]; for (let i = 1; i < N; i++) chs.push(opp);
  Play.autoGameN(st, chs.slice(0, N), undefined, () => {});
  if (!QUIET) process.stdout.write('.');
}
if (!QUIET) process.stdout.write('\n');

const ag = shippedAgreement();
console.log('# §E181 独立复核平票读数（' + GAMES + ' 局 · N=' + N + ' · seed=' + SEED0 + ' · 对手 = 原型池轮转）');
console.log('| 自检 | 实测 | 判定 |');
console.log('|---|---|---|');
console.log('| 本机逐候选打分 == **出厂那只手的 pick**（分母 = **第一名唯一**的决策） | 一致 ' + ag.agree + '/' + ag.n + '（' + (100 * (ag.rate || 0)).toFixed(1) + '%）‖ 平票决策 ' + ag.skippedTie + ' 个**不参与这条判定**（出厂在两个同分候选间采样，本来就该不同）' + (ag.mismatch.length ? ' ‖ 例：' + ag.mismatch.join(' ; ') : '') + ' | ' + (ag.ok ? '✔ 我数的候选集合就是出厂在比的那个集合' : '⛔ 集合不同源 ⇒ 下面所有平票统计都要打问号') + ' |');
console.log('\n## 平票本体');
console.log('| 量 | 实测 |');
console.log('|---|---|');
console.log('| 决策数（分母，独立计数） | ' + tie.decisions + ' |');
console.log('| 平票决策（同分且目标不同） | **' + (100 * tie.n / Math.max(1, tie.decisions)).toFixed(1) + '%**（' + tie.n + '/' + tie.decisions + '） |');
console.log('| 按回合分桶 | r1-2 ' + byRound['r1-2'] + ' · r3-5 ' + byRound['r3-5'] + ' · r6+ ' + byRound['r6+'] + ' |');
console.log('| 平票组大小（同分候选个数分布） | ' + Object.keys(tieSizes).sort((a, b2) => Number(a) - Number(b2)).map(k => k + ' 个:' + tieSizes[k]).join(' ‖ ') + ' |');
console.log('| 出厂那一手在平票组里选**第几个**（0 = 枚举第一个） | ' + Object.keys(pickPos).sort().map(k => '第' + k + ':' + pickPos[k]).join(' ‖ ') + '（共 ' + tie.pickInTied + '/' + tie.n + ' 落在组内） |');
console.log('| 倒转**枚举顺序**后 argmax 换人 | ' + (tie.revFlip || 0) + '/' + ((tie.revFlip || 0) + (tie.revSame || 0)) + ' ⇒ **必然如此 = 同义反复，不是证据**（§E181③：稳定排序下任何平票组倒序都会换人） |');
console.log('| 平票**对**数（同卡·不同目标） | ' + tie.pairs + ' |');
console.log('| └ 整条动作段（' + FA + ' 列）逐位相同 | **' + tie.pairsAfSame + '** |');
console.log('| └ 动作段**有差**却同分 | **' + tie.pairsAfDiff + '**（其中 hp/ep 也相同 ' + tie.sameAttrsButAfDiff + '） |');
console.log('| **反证本机自己的错**：平票对里 af 有差的有几条 | ' + tie.pairsAfDiff + '（第一版我少传 `cand` ⇒ 同卡打谁都同分，那种假平票的 af **必然有差**；此处 0 = 每个平票都是"两席动作段逐位相同"） |');
console.log('| └ 差异出现在哪几列（频次） | ' + JSON.stringify(wide) + ' |');
console.log('| 只看 hp/ep：相同 / 不同 | ' + tie.hpEpSame + ' / ' + tie.hpEpDiff + ' |');
console.log('| 决策级：所有平票对都 af 逐位同 / 至少一对有差 | ' + tie.afAllSame + ' / ' + tie.afSomeDiff + ' |');
console.log('| 首手目标分布 | ' + Object.keys(firstTargets).sort((a, b2) => firstTargets[b2] - firstTargets[a]).map(k => '席' + k + ' ' + firstTargets[k]).join(' · ') + ' |');
if (examples.length) console.log('\n平票但动作段有差的例子（说明**同分 ≠ 同特征** ⇒ 差异列被权重抵消或该列零权重）：\n  ' + examples.map(e => '第' + (e.g + 1) + '局 r' + e.round + ' `' + e.key + '@' + e.t1 + '` vs `@' + e.t2 + '` 差列 [' + e.diffDims.join(',') + '] 属性 ' + e.attrs.join(' | ') + ' 分 ' + e.score.toFixed(3)).join('\n  '));
if (arg('json', '')) writeFileSync(arg('json'), JSON.stringify({ meta: { games: GAMES, n: N, seed0: SEED0, FA, FS }, agreement: ag, tie, tieSizes, pickPos, wide, examples, firstTargets, byRound }, null, 1));
