/* "同价同优先的两张盾里，网络为什么稳定选送盾" —— 表示层分解（不训练、只读同一枚包的打分）
 * 分解的是三件事：
 *   A. proto 的分数（`target:'self'` ⇒ 动作段的目标块恒零）
 *   B. holo 在"每个存活对手一个候选"里取 max 的分数（目标块带 6 维真值）
 *   C. 把目标块整块抹零（`setFeatMask('bead,effects,rel')`，形状与参数一字不变）后两张牌各自的分数
 * ⇒ 若 B−A > 0 而 C 里 holo 不再赢 proto，那"爱送盾"就不是偏好，而是**只有送盾这一枚看得见目标**。
 * 口径：mirror 桌（5 座同一包）真打出来的决策态，只分析 0 号席，前 CAP 个决策。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
/* ROOT 自解析（10-18 归仓时改）：本文件在 docs/research/archive/<本轮>/ 下 ⇒ 往上 4 级是仓根；`WT=` 可覆盖。 */
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../../../../..');
const imp = (p) => import(pathToFileURL(ROOT + '/' + p).href);
const { sandbox, loadChamp } = await imp('tools/audit-lib.mjs');
const { duelAssembly } = await imp('tools/v2v4-lib.mjs');
const W = sandbox(ROOT);
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules, P = W.EpirusPolicy;
const G = Number(process.argv[2] || 60);
const CAP = Number(process.argv[3] || 4000);
const params = loadChamp(W, 'docs/artifacts/v7beadseed-82.bak', ROOT);
if (!params) { console.error('⛔ 包读不出'); process.exit(7); }
const sh = P.shapeOf(params);
const inner = T.policyChooserN(params, 0.15);
const ST = { dec: 0, ana: 0, both: 0, holoWinAll: 0, protoWinAll: 0, otherAff: 0,
  winnerHist: {}, otherKey: {}, protoRank: [], gapAll: [], gapZero: [], opt: [],
  holoWinsWithTgt: [], holoWinsBoth: [], holoWinsNeither: [],
  protoIsMax: 0, protoStrictWin: 0, protoAlias: {}, dump: [], grpN: {}, grpEq: {}, freeN: {}, freeEq: {} };
const q = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };

function analyze(state, pid, legal) {
  ST.dec++;
  if (ST.ana >= CAP) return;
  const aff = legal.filter(l => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  const keys = base.map(l => l.key);
  if (keys.indexOf(R.SK.HOLO) < 0 || keys.indexOf(R.SK.PROTO) < 0) return;   // 两张都买得起才有可比性
  ST.ana++; ST.both++;
  const cands = P.candidatesFor(state, pid, base, { lockTarget: null });
  const sc = (c) => P.value(state, pid, c.key, params, sh, c);
  const holos = cands.filter(c => c.key === R.SK.HOLO);
  const protos = cands.filter(c => c.key === R.SK.PROTO);
  if (!holos.length || !protos.length) { ST.otherAff++; return; }
  let sH = -1e9, sP = -1e9;
  for (const c of holos) { const v = sc(c); if (v > sH) sH = v; }
  for (const c of protos) { const v = sc(c); if (v > sP) sP = v; }
  /* 干净的反事实：`{key:holo, target:null}` 走 actionFeatures 里那条 `tid==null` 的零块分支
     ⇒ 这是"同一张牌、拿掉目标证据"的**精确**分数（不是全局掩码，全局掩码会连枪/剑的目标块一起抹掉） */
  const sH0 = P.value(state, pid, R.SK.HOLO, params, sh, { key: R.SK.HOLO, target: null, target2: null, bead: null });
  const sP0 = P.value(state, pid, R.SK.PROTO, params, sh, { key: R.SK.PROTO, target: null, target2: null, bead: null });
  let sO = -1e9, oKey = '';
  for (const c of cands) { if (c.key === R.SK.HOLO || c.key === R.SK.PROTO) continue; const v = sc(c); if (v > sO) { sO = v; oKey = c.key; } }
  const allScores = cands.map(sc);
  const maxV = Math.max.apply(null, allScores);
  const firstMaxIdx = allScores.indexOf(maxV);          // `forwardCands` 的 argmax 并列时取第一个下标（policy.js:600 自己警告过）
  const bestKey = cands[firstMaxIdx].key;
  const protoIdx = cands.findIndex(c => c.key === R.SK.PROTO);
  if (sP >= maxV - 1e-12) {                              // proto 就是最高分（含并列）
    ST.protoIsMax++;
    const a = P.actionFeatures(state, pid, R.SK.PROTO, cands[protoIdx]);
    const b = P.actionFeatures(state, pid, cands[firstMaxIdx].key, cands[firstMaxIdx]);
    let same = a.length === b.length;
    if (same) for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-12) { same = false; break; }
    if (same) ST.protoAlias[firstMaxIdx] = (ST.protoAlias[firstMaxIdx] || 0) + 1;
    else ST.protoStrictWin++;
    if (ST.dump.length < 4) ST.dump.push('proto#idx=' + protoIdx + ' 分数=' + sP.toFixed(2) + ' ‖ 首个最高=' + cands[firstMaxIdx].key + '#idx=' + firstMaxIdx + ' 分数=' + maxV.toFixed(2) + ' ‖ 动作向量逐位相同=' + same + ' ‖ 候选表=' + cands.map(c => c.key).join(','));
  }
  ST.winnerHist[bestKey] = (ST.winnerHist[bestKey] || 0) + 1;
  if (bestKey === R.SK.HOLO) ST.holoWinAll++; else if (bestKey === R.SK.PROTO) ST.protoWinAll++;
  ST.protoRank.push(allScores.slice().sort((a, b) => b - a).indexOf(sP) + 1);
  ST.gapAll.push(sH - sP);
  ST.gapZero.push(sH0 - sP0);                       // 两张都没有目标证据时，纯"身份位"谁高
  ST.opt.push(sH - sH0);                            // 目标块给 holo 的加分（期权价值）
  ST.holoWinsWithTgt.push(sH > sO && sO > sH0 ? 1 : 0);   // 只有带目标时才赢过第三方 ⇒ 送盾是被目标证据抬起来的
  ST.holoWinsBoth.push(sH > sO && sH0 > sO ? 1 : 0);
  ST.holoWinsNeither.push(sH <= sO ? 1 : 0);
  ST.otherKey[oKey] = (ST.otherKey[oKey] || 0) + 1;
  /* 别名组的分数是否**逐位相等**（相等 ⇒ 技能层 softmax 只能均分，温度也救不了；不等 ⇒ 才是真正的偏好） */
  const grp = ['shift', 'jinshield', 'proto'];
  const gs = {};
  for (const c of cands) { if (grp.indexOf(c.key) >= 0 && !(c.key in gs)) gs[c.key] = sc(c); }
  const gv = Object.values(gs);
  if (gv.length >= 2) { ST.grpN[gv.length] = (ST.grpN[gv.length] || 0) + 1; if (Math.max.apply(null, gv) - Math.min.apply(null, gv) < 1e-12) ST.grpEq[gv.length] = (ST.grpEq[gv.length] || 0) + 1; }
  const free = ['guard', 'reflect', 'bagua'];
  const fs = {};
  for (const c of cands) { if (free.indexOf(c.key) >= 0 && !(c.key in fs)) fs[c.key] = sc(c); }
  const fv = Object.values(fs);
  if (fv.length >= 2) { ST.freeN[fv.length] = (ST.freeN[fv.length] || 0) + 1; if (Math.max.apply(null, fv) - Math.min.apply(null, fv) < 1e-12) ST.freeEq[fv.length] = (ST.freeEq[fv.length] || 0) + 1; }
}

duelAssembly({ S, Play, T, R }, params, { games: G, mode: 'multi', seed0: 90210, n: 5, scripted: 'champ',
  chooserFor: (pid) => (pid === 0 ? function (st, p2, legal) { analyze(st, p2, legal); return inner(st, p2, legal); } : null) });

const f = (x) => (isFinite(x) ? x.toFixed(3) : '—');
const pc = (a) => (100 * a / ST.ana).toFixed(1) + '%';
console.log('## 表示层分解 ‖ 5 座同一枚 v7beadseed-82 ‖ 决策 ' + ST.dec + ' ‖ 两张盾同时买得起 ' + ST.ana + '（候选枚举近似：没接 lockTarget）');
if (!ST.ana) { console.log('⛔ 一张都没同时买得起 ⇒ 无可比样本（读不出，不是"没有偏好"）'); process.exit(2); }
console.log('  （`candidatesFor`：holo 每个存活对手一条且带目标块 6 维真值 ‖ proto 只有一条、走 else 分支 ⇒ 目标块全零）');
console.log('  分数差 holo(取各目标最大) − proto：中位 **' + f(q(ST.gapAll, 0.5)) + '** ‖ P10 ' + f(q(ST.gapAll, 0.1)) + ' ‖ P90 ' + f(q(ST.gapAll, 0.9)) + ' ‖ 均值 ' + f(ST.gapAll.reduce((a, b) => a + b, 0) / ST.gapAll.length));
const sm = (a) => (100 * a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(1) + '%';
console.log('  同一张 holo **拿掉目标证据**（`target:null` 走零块分支，精确反事实、不是全局掩码）− proto：中位 **' + f(q(ST.gapZero, 0.5)) + '** ‖ P10 ' + f(q(ST.gapZero, 0.1)) + ' ‖ P90 ' + f(q(ST.gapZero, 0.9)) + '（两张都零块时只差身份位）');
console.log('  目标块给 holo 的加分（带目标 max − 零块）：中位 ' + f(q(ST.opt, 0.5)) + ' ‖ P90 ' + f(q(ST.opt, 0.9)) + ' ‖ 为负的决策 ' + ST.opt.filter(x => x < 0).length + '/' + ST.opt.length);
console.log('  proto 在全表的名次：中位 ' + f(q(ST.protoRank, 0.5)) + ' ‖ 名次=1（含并列）' + ST.protoRank.filter(x => x === 1).length + ' 次（= ' + pc(ST.protoRank.filter(x => x === 1).length) + '）');
console.log('  **proto 别名检查**：proto 拿到全表最高分（含并列）的决策 ' + ST.protoIsMax + ' 次，其中**严格唯一最高**只有 ' + ST.protoStrictWin + ' 次' +
  ' ‖ 与排在前面的候选**动作向量逐位相同**而被 argmax 让位的：' + Object.entries(ST.protoAlias).map(([i, v]) => 'cand#' + i + ' ' + v + '次').join(' ‖ ') + '（并列取第一个下标 = policy.js:600 那条警告）');
ST.dump.forEach(d => console.log('    样本：' + d));
console.log('  全表 argmax 落点：holo ' + pc(ST.holoWinAll) + ' ‖ proto ' + pc(ST.protoWinAll) + '（greedy 口径；实际取样用 temp=0.15，见下面别名组那一行）');
console.log('  **别名组的分数是否逐位相等**（相等 ⇒ 技能层 softmax 只能均分，温度救不了）：1 费自盾组 shift/金刚盾/原型制御 同组出现 ' +
  JSON.stringify(ST.grpN) + ' ‖ 其中分数完全相等 ' + JSON.stringify(ST.grpEq));
console.log('  0 费自盾组 guard/reflect/八卦阵 同组出现 ' + JSON.stringify(ST.freeN) + ' ‖ 完全相等 ' + JSON.stringify(ST.freeEq));
console.log('  holo 赢下全表的成因：只有靠目标证据才赢（零块版本会输给第三方）' + sm(ST.holoWinsWithTgt) + ' ‖ 有无目标证据都赢 ' + sm(ST.holoWinsBoth) + ' ‖ 带目标也赢不了 ' + sm(ST.holoWinsNeither));
const wh = Object.entries(ST.winnerHist).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => k + ' ' + pc(v));
console.log('  压住 proto 的那些赢家（argmax 直方图，前 8）：' + wh.join(' ‖ '));
