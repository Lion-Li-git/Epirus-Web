#!/usr/bin/env node
/* longrange-offer.mjs — 长程技能（大雷 / 电磁炮 / 聚能环 / 布雷 / 蓄能…）到底卡在哪一层（千问 · 10-30 晚）
 *
 * 触发：用户问"新包能不能更快地学会大雷、电磁炮、聚能环这些长程技能"。
 * §十六 已量到代 2 在 440 局/行的配对考卷上几乎**不出手**这三件套（大雷 0~7 ‖ 电磁炮 0 ‖ 聚能环 0，
 *   同场 v7 是 42~102 / 203~210 / 53~54）。但"不出手"有三种完全不同的病因，读数上同形：
 *     ① **菜单上就没有**（引擎 `candidatesFor` 的经济/前置条件把这些手筛掉了 ⇒ 训练无从选起）
 *     ② 在菜单里但**排在后面**（打分/信用分配问题 ⇒ 是训练的事）
 *     ③ 在菜单里且排第一也不选（采样温度/探索 ⇒ 是配方而非能力）
 *   不分清就会开错药（本仓那一族病：把"我没造出来"写成"世界没有"）。
 *
 * 做法：真局决策点上，对每枚被测包、每个目标技能，统计**提供率 / 名次分布 / 进前三率 / greedy 会选它的频率**。
 * 两棵沙箱各跑各的（v7 树与装了 arch2 的树），因为 2.0 张量喂进 v7 打分器会**当场抛**（那是设计，不是事故）。
 * ⚑ 参照条款：名次是**同一张候选表内**的名次；不同桌形/不同局的候选数不同 ⇒ 名次要除以候选数看相对位置，绝对名次不可横比。
 * 用法：node tools/proto2/longrange-offer.mjs [--perShape=8] [--keys=bigT,railgun,ring,mine,charge,cannon]
 */
import { sandbox, loadChamp } from '../audit-lib.mjs';
import { install, readPack2, packCfgExit } from './arch2.mjs';
import { collectFixtures } from './head-health.mjs';
import { rejectUnknownFlags } from '../audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['perShape', 'keys', 'packs', 'minRound'], 'longrange-offer');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const PER = Math.max(1, Number(arg('perShape', 8)) || 8);
const KEYS = String(arg('keys', 'bigT,miniT,railgun,ring,mine,charge,cannon,curse,holo')).split(',').filter(Boolean);
const MIN_ROUND = Number(arg('minRound', 0)) || 0;
const PACKS_20 = String(arg('packs', 'scratch/arms/CEM48c-s7.bak,scratch/arms/CEM48c-s11.bak,scratch/arms/CH3-CH2-s11-s7-s17.bak')).split(',').filter(Boolean);


/* 晚局夹具：`round >= minRound` 的决策点（开局那批珠/环/蓄能还没攒起来 ⇒ 长程手**压根不在菜单上**，
 * 拿它算提供率会把"引擎闸门"误读成"训练没学会"。这里从整局里按回合采，尽量铺到中后期。） */
function lateFix(W, per, minRound) {
  const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
  let seed = 20261030;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = [];
  for (const shape of [{ n: 3, m: 'multi' }, { n: 5, m: 'multi' }, { n: 5, m: 'long' }]) {
    let got = 0, g = 0;
    while (got < per && g < 40) {
      g++;
      const st = S.createState(shape.m, { next: rng }, shape.n);
      st.rng = { next: rng };
      const ch = [];
      for (let pid = 0; pid < shape.n; pid++) ch.push((s, p, legal) => {
        const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: false }) || [];
        if (cs.length > 1 && s.round >= minRound && got < per) {
          const q = S.cloneState(s); q.rng = { next: rng };
          out.push({ st: q, pid: p, cands: P.candidatesFor(q, p, T.econBase(q, p, legal), { lockTarget: false }) || [], shape: shape.n + ':' + shape.m });
          got++;
        }
        const k = R.skills[(s.round * 5 + p * 3 + g) % R.skills.length].key;
        const hit = cs.find((c) => c.key === k);
        if (hit) return { key: hit.key, target: hit.target == null ? null : hit.target, target2: hit.target2 == null ? null : hit.target2, bead: hit.bead || null };
        const ji = cs.find((c) => c.key === R.SK.JI); return ji ? { key: ji.key } : (cs[0] || { key: R.SK.JI });
      });
      try { Play.autoGameN(st, ch); } catch (e) { break; }
      if (got >= per) break;
    }
  }
  return out;
}
function run(label, W, params, is20) {
  const P = W.EpirusPolicy, R = W.EpirusRules;
  const fx = MIN_ROUND > 0 ? lateFix(W, PER, MIN_ROUND) : collectFixtures(W, { perShape: PER, seed: 20261030 }).fixtures;
  const T = W.EpirusTrainer;
  if (is20 && T.mulberry32) P.setRng(T.mulberry32(4242));
  const st = {}; for (const k of KEYS) st[k] = { offer: 0, top1: 0, top3: 0, rankSum: 0, n: 0, relSum: 0 };
  let decisions = 0, cSum = 0, basis = null;
  for (const f of fx) {
    if (!f.cands || f.cands.length < 2) continue;
    decisions++; cSum += f.cands.length;
    const fr = P.forwardCands(f.st, f.pid, f.cands, params, { temp: 0.001 });
    const hasL = !!(fr.logits && fr.logits.length);
    const logits = Array.from(hasL ? fr.logits : (fr.probs || []));
    if (!logits.length) { console.log('⚠ ' + label + '：前向没回 logits/probs ⇒ 这一路量不了'); return null; }
    if (basis === null) basis = hasL ? 'logits' : 'probs（v7 那台不回 logits ⇒ 这里的名次按采样用的那一格）';
    for (const k of KEYS) {
      const idxs = []; for (let i = 0; i < f.cands.length; i++) if (f.cands[i].key === k) idxs.push(i);
      const s = st[k]; s.n++;
      if (!idxs.length) continue;
      s.offer++;
      let bestRank = 1e9, bestRel = 1;
      for (const i of idxs) {
        let rank = 1;
        for (let j = 0; j < logits.length; j++) if (logits[j] > logits[i]) rank++;
        bestRank = Math.min(bestRank, rank);
        bestRel = Math.min(bestRel, rank / logits.length);
      }
      s.rankSum += bestRank; s.relSum += bestRel;
      if (bestRank === 1) s.top1++;
      if (bestRank <= 3) s.top3++;
    }
  }
  console.log('\n## ' + label + ' ‖ 真局决策点 ' + decisions + ' 个 ‖ 候选均值 ' + (cSum / Math.max(1, decisions)).toFixed(1) + ' 枚');
  // 名次基准在第一次前向后才知道，打印时补在段标题里
  console.log('   技能 ‖ 提供率(候选表里有) ‖ 提供时进前三 ‖ 提供时排第一 ‖ 最好名次均值 ‖ 相对位置(1=最好)');
  for (const k of KEYS) {
    const s = st[k];
    if (!s.n) { console.log('   ' + k + ' ‖ 本次没造出任何决策点'); continue; }
    console.log('   ' + k.padEnd(9) + ' ‖ ' + (100 * s.offer / s.n).toFixed(1) + '% (' + s.offer + '/' + s.n + ')' +
      ' ‖ ' + (s.offer ? (100 * s.top3 / s.offer).toFixed(1) + '%' : '-') +
      ' ‖ ' + (s.offer ? (100 * s.top1 / s.offer).toFixed(1) + '%' : '-') +
      ' ‖ ' + (s.offer ? (s.rankSum / s.offer).toFixed(2) : '-') +
      ' ‖ ' + (s.offer ? (s.relSum / s.offer).toFixed(3) : '-'));
  }
  return st;
}

/* ---- v7 那棵树（线上冠军）---- */
const W1 = sandbox();
const v7 = loadChamp(W1, 'js/bundled-champion-3p.js', '');
const A = run('v7 线上冠军（`js/bundled-champion-3p`）', W1, Float64Array.from(v7), false);

/* ---- 代 2 那棵树（装 arch2，逐枚包）---- */
const W2 = sandbox();
let first = null;
for (const p of PACKS_20) {
  let raw;
  try { raw = readPack2(p); } catch (e) { console.log('\n⚠ 读不出 ' + p + '：' + String(e.message).slice(0, 60)); continue; }
  const got = packCfgExit(raw, p);
  const A2 = install(W2, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pp = W2.EpirusPolicy.unpack(raw, true);
  if (!pp) { console.log('⚠ ' + p + ' unpack 不出 ⇒ 跳过'); A2.restore(); continue; }
  run('代 2 ‖ ' + p.replace(/^.*[\\/]/, '').replace('.bak', ''), W2, pp, true);
  A2.restore();
}
console.log('\n判读口径：①提供率=0 ⇒ 卡引擎经济闸门（与训练无关）；②提供率>0 而"排第一"≈0 ⇒ 打分/信用分配的事（训练的事）；' +
  '③"排第一"高但实战不出手 ⇒ 是采样温度/探索，不是能力。名次是**同表内**名次，绝对值不横比。');
