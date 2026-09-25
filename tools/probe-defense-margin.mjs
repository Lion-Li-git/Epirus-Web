/* E24 · 这只包的"防御"是**深吸引子**还是**贴零的边缘胜出**？（09-26 夜班 · Qoder · 只读 + 内存特征掩码）
 *
 * 为什么问这个：E23 证明"1ep 定价"能稳定断掉连防（9/15）且几乎不花强度 ⇒ 但**为什么**这只包偏好防御还没回答。
 * 三种可能的修法对应三种因：地形（价格）/ 特征（它看得见什么）/ 奖励（它学了什么）。
 *   · 若防御相对最优攻击卡的**分差普遍贴零** ⇒ 行为是刀锋（ε/种子/口径一动就翻）⇒ 该修的是"别让它靠边缘优势吃桌"；
 *   · 若分差很大 ⇒ 深吸引子，只能改地形或重训；
 *   · **掩码实验**（`EpirusPolicy.setFeatMask`，仓里现成的对外面）：把某块特征恒置 0，看设防率/连防塌不塌
 *     ⇒ 塌 = 那块特征在撑这个行为（例如"对手 ep/珠"那类收入侧特征，或 T 关系块"上一手指向谁"）。
 *
 * 用法：node tools/probe-defense-margin.mjs [--packs=...] [--games=60] [--ablate=1] [--eps=0.2]
 */
import { readFileSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
rejectUnknownFlags(process.argv.slice(2), ['packs', 'games', 'temp', 'eps', 'epsk', 'epsmode', 'seed', 'ablate'], 'probe-defense-margin');
const PACKS = arg('packs', 'js/bundled-champion-3p.js,docs/artifacts/cbs1s2-band2.bak,docs/artifacts/v7seat24-31.bak').split(',');
const GAMES = Number(arg('games', 60));
const TEMP = Number(arg('temp', 0.15)), EPS = Number(arg('eps', 0.2)), EPSK = Number(arg('epsk', 5)), EPSMODE = arg('epsmode', 'soft');
const SEED0 = Number(arg('seed', 4100));
const ABLATE = arg('ablate', '1') === '1';
const mul = function (a) { a >>>= 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/* 掩码键的真实语义（`js/train/policy.js`：`MASK.bead`→394 行的电珠/大雷两维；`MASK.target`→405 行"目标侧动作特征"6 维；
 *   `MASK.effects`→292 行 B 持续效果快照；`MASK.rel`→279 行 **T 关系块"上一手谁对谁"**）
 * ⚠️ 我第一版把 `target` 与 `rel` 的名字写反了（照 key 名猜的），跑完对源码才发现 ⇒ 名字一律按源码行注释写。 */
const MASKS = [['全开（对照）', null], ['去掉 bead（电珠/大雷两维）', 'target,effects,rel'],
  ['去掉 target（目标侧动作特征 6 维）', 'bead,effects,rel'], ['去掉 effects（B 持续效果快照）', 'bead,target,rel'],
  ['去掉 rel（T 关系块：上一手谁对谁）', 'bead,target,effects'], ['只剩 bead', 'bead'], ['只剩 target', 'target'], ['只剩 effects', 'effects'], ['只剩 rel', 'rel']];

/* 一次装配：mask=null 表示全开；返回 {def 率, 连防, 局长, 分差样本} */
function run(pack, maskSpec, wantMargins) {
  const ctx = build({ on: true, pack: pack, temp: TEMP, eps: EPS, epsK: EPSK, epsMode: EPSMODE });
  const sb = ctx.sb, R = sb.EpirusRules, S = sb.EpirusState, T = sb.EpirusTrainer, Play = sb.EpirusPlay, P = sb.EpirusPolicy;
  if (ctx.patched !== ctx.hardwired) { console.log('⛔ 口径搬运自检失败'); process.exit(9); }
  if (P.setFeatMask) P.setFeatMask(maskSpec || undefined);
  const params = P.unpack(sb.EPIRUS_CHAMPION_3P, true) || P.unpack(sb.EPIRUS_CHAMPION, true);
  if (!params) return null;
  const sh = P.shapeOf ? P.shapeOf(params) : null;
  const base = T.policyChooserN(params, TEMP, EPS, EPSK, EPSMODE);
  const DEF = R.CAT.DEFENSE;
  const isDef = function (k) { const d = R.byKey[k]; return !!(d && d.cat === DEF); };
  const MG = [];
  let defN = 0, defTot = 0, hiN = 0, hiDef = 0, maxRun = 0, g3 = 0;
  const rds = [];
  for (let g = 0; g < GAMES; g++) {
    const st = S.createState('multi', { next: mul(SEED0 + g * 7919) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const REC = [];
    const ch = [function () { return { key: R.SK.JI }; }];
    for (let i = 1; i < 5; i++) ch.push(function (s2, p2, lg, econ) {
      const pick = base(s2, p2, lg, econ);
      REC.push({ rd: s2.round, pid: p2, ep0: s2.p[0] ? (s2.p[0].ep || 0) : 0, def: isDef(pick.key) });
      if (wantMargins && P.candidatesFor && P.value && lg && lg.length) {
        const cands = P.candidatesFor(s2, p2, lg) || [];
        let dv = -1e9, av = -1e9;
        for (const c of cands) {
          let v; try { v = P.value(s2, p2, c.key, params, sh, c); } catch (e) { v = NaN; }
          if (!isFinite(v)) continue;
          if (isDef(c.key)) { if (v > dv) dv = v; } else if (v > av) av = v;
        }
        if (dv > -1e8 && av > -1e8) MG.push({ m: dv - av, chosen: isDef(pick.key), ep: s2.p[0] ? (s2.p[0].ep || 0) : 0, rd: s2.round });
      }
      return pick;
    });
    Play.autoGameN(st, ch);
    rds.push(st.round);
    const runSeat = {}, lastRd = {}; let runGame = 0;
    for (const d of REC) {
      defN++; defTot += d.def ? 1 : 0;
      if (d.ep0 >= 5) { hiN++; hiDef += d.def ? 1 : 0; }
      if (d.def) { runSeat[d.pid] = (lastRd[d.pid] === d.rd - 1 ? (runSeat[d.pid] || 0) + 1 : 1); lastRd[d.pid] = d.rd; if (runSeat[d.pid] > maxRun) maxRun = runSeat[d.pid]; if (runSeat[d.pid] > runGame) runGame = runSeat[d.pid]; }
      else { runSeat[d.pid] = 0; lastRd[d.pid] = d.rd; }
    }
    if (runGame >= 3) g3++;
  }
  if (P.setFeatMask) P.setFeatMask();
  rds.sort(function (a, b) { return a - b; });
  return { def: defN ? 100 * defTot / defN : NaN, hi: hiN ? 100 * hiDef / hiN : NaN, run: maxRun, g3: 100 * g3 / GAMES, len: rds[rds.length >> 1], mg: MG, n: defN };
}

console.log('# 防御是"深吸引子"还是"边缘胜出"（' + GAMES + ' 局 · 1 席攒钱替身 + 4 席被评包 · 产品口径 ε=' + EPS + ' ' + EPSMODE + ' · 内存特征掩码，仓库一字未动）');
console.log('# 分差 = max(防御卡 value) − max(非防御卡 value)，在同一批合法候选上算 ⇒ 与 ε 抽样无关的"偏好"量\n');
for (const f of PACKS) {
  const nm = f.replace(/^.*[\/]/, '').replace(/\.(bak|js)$/, '');
  const a = run(f, null, true);
  if (!a) { console.log('⚠️ ' + nm + ' 解不出参数'); continue; }
  console.log('## ' + nm + ' · 设防率 ' + a.def.toFixed(1) + '% · 连防 ' + a.run + ' · 局长 ' + a.len + ' · 有防御可比的决策 n=' + a.mg.length);
  const ms = a.mg.map(x => x.m).sort((x, y) => x - y);
  const q = p => ms.length ? ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] : NaN;
  const within = t => ms.filter(x => Math.abs(x) <= t).length;
  console.log('   分差分布：p10 ' + q(.10).toFixed(2) + ' · 中位 ' + q(.50).toFixed(2) + ' · p90 ' + q(.90).toFixed(2) +
    ' · |Δ|≤0.1 占 ' + (100 * within(0.1) / ms.length).toFixed(1) + '% · ≤0.5 占 ' + (100 * within(0.5) / ms.length).toFixed(1) + '% · ≤2 占 ' + (100 * within(2) / ms.length).toFixed(1) + '%');
  const chose = a.mg.filter(x => x.chosen);
  const negButChose = chose.filter(x => x.m < 0).length;
  console.log('   实际选了防御的 ' + chose.length + ' 次里：防御本来就是 argmax 的 ' + (100 * (chose.length - negButChose) / Math.max(1, chose.length)).toFixed(1) +
    '% · **靠探索才选上的（分差<0）' + (100 * negButChose / Math.max(1, chose.length)).toFixed(1) + '%**');
  const byEp = [0, 3, 6, 10].map(lo => { const s = a.mg.filter(x => x.ep >= lo); const t = s.filter(x => x.m > 0); return 'ep≥' + lo + ':' + (s.length ? (100 * t.length / s.length).toFixed(0) + '%(n' + s.length + ')' : '—'); }).join(' · ');
  console.log('   防御占优的比例随对手 ep：' + byEp);
  if (ABLATE) {
    console.log('   特征掩码（同一装配重跑，看哪块特征在撑这个行为）：');
    for (const [label, spec] of MASKS) {
      const r = run(f, spec, false);
      if (!r) continue;
      console.log('      ' + label.padEnd(20) + '设防率 ' + r.def.toFixed(1).padStart(5) + '%  连防 ' + String(r.run).padStart(3) + '  局长 ' + String(r.len).padStart(3) +
        '  ≥3连 ' + Math.round(r.g3) + '%   ' + (spec === null ? '（对照）' : 'Δ设防率 ' + (r.def - a.def >= 0 ? '+' : '') + (r.def - a.def).toFixed(1) + 'pt'));
    }
  }
  console.log('');
}
