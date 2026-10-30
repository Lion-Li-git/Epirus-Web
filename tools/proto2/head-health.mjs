/* head-health.mjs — “打分有没有牙”的公共量具（千问 · 10-30 傍晚）
 *
 * 为什么要有这一格（今天撞出来的）：2.0 的输出头可以在**几乎不区分候选**的状态下被当选并出数。
 *   实测：代 2 短臂（300 局）在同一批真局状态上，逐候选 logits 的极差只有 0.017 / 0.026
 *   ——而一枚**随机初始化**的代 2 包是 0.0008；采样温度是 0.15 ⇒ softmax 在 39–83 枚候选上近似均匀，
 *   于是“换一枚包打出的对局记录逐字相同”（判决实验：`scratch/qoder-1030-cntprobe.mjs` / `tieprobe.mjs`）。
 *   这条与在册那族病同形：**调用了前向 ≠ 前向有信息**（“覆盖式接入要自证真被调用”的下一层）。
 *
 * 量什么（都从 `EpirusPolicy.forwardCands` 的真实输出算，不另写一台打分器）：
 *   · `spread` = 每个决策点上 max(logits) − min(logits)（同一温度下，极差越大越挑得动）
 *   · `odds`   = exp(spread / temp) = **最好那枚与最差那枚的概率比**（把“极差”换算成采样真的能看见的倍数）
 *   · `entShare` = 候选 probs 的熵 / log(候选数)（1.000 = 均匀抽卡）
 *   · `flat`   = odds < 1.5 ⇒ 判“平头”（阈值写在这一处，别在调用方各写一遍）
 *
 * 夹具：`collectFixtures` 自己打真局（逐桌形配额 + 卡表全集轮换阵容），**不读任何临时件** ⇒ 干净克隆跑得动。
 *   ⚑ 分母必须逐桌形给：第一版按“编码数封顶”采样 ⇒ 116 个假死维；第二版按“每决策 4 枚候选” ⇒ 53 个。 */
import { sandbox } from '../audit-lib.mjs';

/* 判据只在这一处定义：**同一串骰子下，与“随机起点包”打同一手的比率**（`agreeRandom`）。
 *   标定（10-30 傍晚，60 个真局决策点 × t=0.15，原件 `scratch/qoder-1030-headcalib2.mjs`）：
 *     随机起点彼此 93% / 97% / 93%（这是“没有信息”的底，注意它不是 0 —— 近似均匀的分布对同一串骰子给同一手）
 *     代 2 短臂彼此 65~85% ‖ 短臂 vs 随机 70~82% ‖ evals=8 的未训臂 vs 随机包 **100%**（它其实就是那枚随机粒）
 *     v7 vs 随机/短臂 **5%**（完全分离）
 *   ⇒ 平头线取 **60%**：夹在“随机底 93%±4”与“v7 5%”之间，且离两边都有余量。
 *   ⚑ 为什么不用 argmax 分歧率（我第一版的想法）：**标定直接否掉**——随机起点彼此就有 43~100% 的 argmax 分歧，
 *     比“训练 vs 未训练”的差还大 ⇒ 那把尺没有分离力（原件 `scratch/qoder-1030-headcalib.mjs`）。
 *   ⚑ 为什么也不用“集中度 max(p)×K”当判据：它是相对量、没有跨架构的绝对阈（v7=27~53、短臂≈2~2.8，
 *     但“2.8 算不算平头”我定不出有依据的数）⇒ 只当**并报的刻度**，判据交给 agreeRandom。 */
export const HEAD_FLAT_AGREE = 0.60;
export const HEAD_FLAT_CONC = 1.5;      /* 只用于把 conc 一起报出来时的注释，不参与判定 */
export const HEAD_RND_SEEDS = [11, 22, 33];

/** 真局 mid-game 决策点（含全体候选表）；返回 {fixtures, keysSeen} */
export function collectFixtures(W, opts) {
  const o = opts || {};
  const perShape = Math.max(1, Number(o.perShape) || 8);
  const shapes = o.shapes || [{ n: 2, m: 'multi' }, { n: 3, m: 'long' }, { n: 5, m: 'multi' }, { n: 5, m: 'long' }, { n: 8, m: 'multi' }, { n: 10, m: 'multi' }];
  const P = W.EpirusPolicy, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
  let seed = Number(o.seed) || 20261030;
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const keys = R.skills.map((s) => s.key);
  const cancelOtherLocal = (state, pid) => {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const e = state.events[i];
      if (e.type === 'cancel' && e.round === state.round - 1 && e.pids && e.pids.indexOf(pid) >= 0) return e.pids[0] === pid ? e.pids[1] : e.pids[0];
    }
    return null;
  };
  const fixtures = []; const keysSeen = new Set(); const perShapeGot = {};
  for (const shape of shapes) {
    const tag = shape.n + ':' + shape.m;
    perShapeGot[tag] = 0;
    for (let g = 0; g < 14 && perShapeGot[tag] < perShape; g++) {
      const st = S.createState(shape.m, { next: rng }, shape.n);
      st.rng = { next: rng };
      const ch = [];
      for (let pid = 0; pid < shape.n; pid++) {
        ch.push((s, p, legal) => {
          const cs = P.candidatesFor(s, p, T.econBase(s, p, legal), { lockTarget: cancelOtherLocal(s, p) }) || [];
          if (cs.length > 1 && s.round >= 3 && perShapeGot[tag] < perShape) {
            const q = S.cloneState(s); q.rng = { next: rng };
            fixtures.push({ st: q, pid: p, cands: P.candidatesFor(q, p, T.econBase(q, p, legal), { lockTarget: cancelOtherLocal(q, p) }) || [], shape: tag });
            perShapeGot[tag]++;
          }
          const want = keys[(s.round * 3 + p * 7 + g) % keys.length];
          const hit = cs.find((c) => c.key === want);
          if (hit) { keysSeen.add(want); return { key: hit.key, target: hit.target == null ? null : hit.target, target2: hit.target2 == null ? null : hit.target2, bead: hit.bead || null }; }
          const ji = cs.find((c) => c.key === R.SK.JI); return ji ? { key: ji.key } : (cs[0] || { key: R.SK.JI });
        });
      }
      try { Play.autoGameN(st, ch); } catch (e) { /* 造不出就换下一局 */ }
    }
  }
  return { fixtures, keysSeen, perShapeGot };
}

/** 在给定状态集上量这枚 params 的打分健康度 */
export function headHealth(W, params, fixtures, temp) {
  const P = W.EpirusPolicy;
  const t = Number(temp) > 0 ? Number(temp) : 0.15;
  const spreads = [], entShares = [], concs = [], cands = [];
  let tieArgmax = 0;
  for (const f of fixtures) {
    let fr;
    try { fr = P.forwardCands(f.st, f.pid, f.cands, params, { temp: t }); } catch (e) { continue; }
    const pr = Array.from(fr.probs || []);
    if (!pr.length) continue;
    const lg = Array.from(fr.logits || []);
    cands.push(pr.length);
    if (lg.length) spreads.push(Math.max(...lg) - Math.min(...lg));
    const ps = pr.filter((x) => Number.isFinite(x) && x > 0);
    const H = ps.reduce((a, q) => a - q * Math.log(q), 0);
    entShares.push(pr.length > 1 ? H / Math.log(pr.length) : 1);
    /* 集中度：max(p) × K ⇒ 1.0 = 完全均匀（包在这一决策点上没说话），越大越挑得动 */
    concs.push(Math.max(...pr) * pr.length);
    if (lg.length) { const best = Math.max(...lg); if (lg.filter((x) => Math.abs(x - best) < 1e-12).length > 1) tieArgmax++; }
  }
  const med = (a) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const spread = spreads.length ? med(spreads) : NaN;
  const ent = med(entShares), conc = med(concs);
  return {
    states: concs.length, temp: t, candMed: med(cands),
    concMed: Number(conc.toFixed(3)), entShareMed: Number(ent.toFixed(4)),
    spreadMed: Number.isFinite(spread) ? Number(spread.toFixed(4)) : null,
    odds: Number.isFinite(spread) ? Number(Math.exp(spread / t).toFixed(2)) : null,
    tieArgmax, agreeRandom: null, flat: false,
  };
}

/** 判据主量：同一串固定骰子下，这枚 params 与 n 枚**随机起点包**打出同一手的比率
 *  ⚑ 会临时借道 `makePolicy` ⇒ **必须把 rngRef 的流还回去**（不然“量一下”本身会改掉臂的随机流） */
export function agreeVsRandom(W, params, fixtures, temp, head, opts) {
  const o = opts || {};
  const P = W.EpirusPolicy;
  const t = Number(temp) > 0 ? Number(temp) : 0.15;
  const A = P.__arch2;
  if (!A || !head) return Object.assign({}, head, { flat: false });
  const keepRng = A.rngRef.r;
  const T = W.EpirusTrainer;
  const dice = fixtures.map((f, i) => { let x = (i * 7919 + 13) >>> 0; x = (x * 1664525 + 1013904223) >>> 0; return (x / 4294967296) * 0.999999; });
  const seqOf = (pp) => fixtures.map((f, i) => {
    let fr; try { fr = P.forwardCands(f.st, f.pid, f.cands, pp, { temp: t }); } catch (e) { return 'ERR'; }
    const pr = Array.from(fr.probs || []); let acc = 0;
    for (let k = 0; k < pr.length; k++) { acc += pr[k]; if (dice[i] < acc) return f.cands[k].key + '/' + (f.cands[k].target == null ? '-' : f.cands[k].target); }
    return 'LAST';
  });
  const mine = seqOf(params);
  const rates = [];
  for (const sd of (o.seeds || HEAD_RND_SEEDS)) {
    A.rngRef.r = T.mulberry32 ? T.mulberry32(sd) : keepRng;
    let rp = null; try { rp = Float64Array.from(P.makePolicy(0.25)); } catch (e) { rp = null; }
    if (!rp) continue;
    const other = seqOf(rp); let same = 0;
    for (let i = 0; i < mine.length; i++) if (mine[i] === other[i]) same++;
    rates.push(mine.length ? same / mine.length : 0);
  }
  A.rngRef.r = keepRng;                      /* 还流：量的动作不许改变被量对象的后续随机 */
  const agree = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
  return Object.assign({}, head, {
    agreeRandom: agree == null ? null : Number((100 * agree).toFixed(1)),
    agreeRefs: rates.length,
    flat: agree != null && agree >= HEAD_FLAT_AGREE,
  });
}

export function fmtHead(nm, h) {
  if (!h || !h.states) return '  · ' + nm + ' ⇒ 没量到（状态数为 0）';
  return '  · ' + nm.padEnd(18) + ' 决策点 ' + String(h.states).padStart(3) + ' ‖ 候选中位 ' + h.candMed +
    ' ‖ **集中度 max(p)×K = ' + h.concMed.toFixed(2) + '**（1.00 = 完全均匀） ‖ 熵占比 ' + h.entShareMed.toFixed(3) +
    (h.spreadMed == null ? '' : ' ‖ logit 极差 ' + h.spreadMed.toFixed(4) + '（概率比 ' + h.odds + '× @t=' + h.temp + '）') +
    ' ‖ argmax 并列 ' + h.tieArgmax +
    (h.agreeRandom == null ? '' : '\n     同一串骰子下与随机起点包打同一手：**' + h.agreeRandom + '%**（平头线 ' + (HEAD_FLAT_AGREE * 100).toFixed(0) + '%，随机彼此实测 93~97% ‖ v7 实测 5%）') +
    ' ⇒ **' + (h.flat ? '平头：这批读数别当风格证据' : '有牙') + '**';
}
void sandbox;
