/* ============================================================================
 * routing-gain-lib.mjs —— "多包路由到底能吃到 oracle 上界的几成" 的**算式单一来源**（v1.5.288 · §E129）
 *
 * 为什么单独一个文件：本仓的门反复栽在"门里再写一份算法"（D122/D149/D161/D164 的教训）——
 * 探针本体改了、门还在验旧公式，绿的是门、错的是数。所以：
 *   `tools/probe-regime-identifiability.mjs` 负责**跑局取签名**，
 *   本文件负责**把 (rows, envs, picks, acc, placebo) 算成 best_single / realizable / oracle / R / 判读**。
 * 门（D193）直接喂**合成输入**覆盖每一条分支与两个退出码，不靠探针的输出措辞、也不依赖本机产物。
 * ==========================================================================*/

export const BRANCHES = {
  NO_EDGE: '⑤', NO_READING: '⑥', NO_SIGNAL: '①′', WORTH: '②', HALF: '③', NEEDS_NET: '④',
};

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

/** 量纲：`fit` 是训练目标（预注册的主口径），`win` 是同一批格子里的**夺冠率**（§E129 补的产品侧追问）。
 *  两者共用同一套签名与同一次分类 ⇒ 只有"打分用哪一列"不同。 */
export const METRICS = ['fit', 'win', 'noDiv'];
export function metricOrThrow(m) {
  const k = m || 'fit';
  if (METRICS.indexOf(k) < 0) throw new Error('不认识的量纲 `' + m + '`（可用：' + METRICS.join('/') + '）⇒ 拒绝拿拼错的键读出一列 undefined');
  return k;
}
const cellOf = (r, e, metric) => { const v = r && r.per && r.per[e] ? r.per[e][metric] : null; return typeof v === 'number' ? v : null; };

/** rows: [{pack, per:{env:{fit,win,…}}}] → 每个环境下该量纲最高的那粒包（并列取先出现的，稳定） */
export function bestInByEnv(rows, envs, metric) {
  const m = metricOrThrow(metric);
  const out = {};
  for (const e of envs) {
    let bp = null, bv = -Infinity;
    for (const r of rows) {
      const v = cellOf(r, e, m);
      if (v !== null && v > bv) { bv = v; bp = r.pack; }
    }
    if (bp) out[e] = bp;
  }
  return out;
}

/** 一粒包在**全部**参与打分的环境上都有读数时，才许当"一招鲜"候选（缺读数不许按均值蒙） */
export function bestSingleOf(rows, envs, metric) {
  const m = metricOrThrow(metric);
  let best = -Infinity, pack = null;
  for (const r of rows) {
    const vs = envs.map((e) => cellOf(r, e, m));
    if (vs.some((v) => v === null)) continue;
    const mv = mean(vs);
    if (mv > best) { best = mv; pack = r.pack; }
  }
  return { best: best, pack: pack };
}

/** picks: {env: 预测到的环境名} → 用"预测环境里最好的那粒包"在**真环境**上的读数求均值 */
export function realizableOf(rows, envs, bestIn, picks, metric) {
  const m = metricOrThrow(metric);
  const find = (p) => rows.find((x) => x.pack === p);
  const list = [];
  for (const e of envs) {
    const pe = picks[e];
    const pack = pe ? bestIn[pe] : null;
    const v = pack ? cellOf(find(pack), e, m) : null;
    if (v !== null) list.push(v);
  }
  return { value: mean(list), n: list.length };
}

export function chanceOf(nEnvs) { return 1 / Math.max(1, nEnvs); }

/** 签名有没有分辨力：**跟随机与 placebo 比**，不比绝对值（27 类时 13% 已经是有信息，见下面的规则缺陷记录） */
export function isInformative(acc, chance, placebo) {
  return isFinite(acc) && acc >= 2 * Math.max(chance, isFinite(placebo) ? placebo : 0, 1e-6);
}

/** 判读分支的**唯一决策函数**（门 D193 拿"屏幕上印出来的那几个数"重算一遍，比它印的分支符）：
 * 只要"印的分支"与"数的分支"不一致就得红 —— 这正是 §E129 那次两条判词互相打脸的形状。 */
export function branchOf({ gap, readingsOk, informative, R }) {
  if (!readingsOk) return BRANCHES.NO_READING;
  if (gap < 0.02) return BRANCHES.NO_EDGE;
  if (!informative) return BRANCHES.NO_SIGNAL;
  if (R >= 0.5) return BRANCHES.WORTH;
  if (R >= 0.2) return BRANCHES.HALF;
  return BRANCHES.NEEDS_NET;
}

/* ⚠ **预注册规则 ① 的推断缺陷**（§E129 · 看过 K=3 数据之后改的，改动如实标在这里，不回头洗）：
 * 原来写"准确率 < 25% ⇒ 签名不可辨 ⇒ 路由不可实现 ⇒ 改观测面是唯一路"，拿**绝对阈值**当"赚不到钱"的充分条件。
 * 但 27 个环境的随机基线只有 3.7% ⇒ 实测 13% 远高过随机与 placebo，而同一次运行的
 * `realizable > best_single` 说明钱**真的赚到了**（R=0.24）——两条判词在同一段代码里互相打脸。
 * 根因：fit 面是**平的**（很多环境的最佳包是同一粒）⇒ "认出环境名字"既不是路由赚钱的充分条件、也不是必要条件。
 * ⇒ 现在只用两把尺：`informative`（准确率 ≥ 2×max(随机, placebo)）判签名有没有分辨力，钱按 R 判。 */
export function routingReadings({ rows, envs, bestIn, picks, acc, placebo, metric }) {
  const m = metricOrThrow(metric);
  const oracle = mean(envs.map((e) => (bestIn[e] ? cellOf(rows.find((x) => x.pack === bestIn[e]), e, m) : NaN)));
  const bs = bestSingleOf(rows, envs, m);
  const rz = realizableOf(rows, envs, bestIn, picks, m);
  const gap = oracle - bs.best;
  const chance = chanceOf(envs.length);
  const informative = isInformative(acc, chance, placebo);
  const readingsOk = isFinite(oracle) && isFinite(bs.best) && isFinite(rz.value) && isFinite(acc) && envs.length > 0;
  const R = (readingsOk && gap >= 0.02) ? (rz.value - bs.best) / gap : null;
  const branch = branchOf({ gap, readingsOk, informative, R });
  const p = (x) => (100 * x).toFixed(0) + '%';
  let verdict;
  if (branch === BRANCHES.NO_READING) {
    verdict = '⑥ 读数不全（oracle/best_single/realizable/准确率 里至少一个没量到）⇒ **不出结论**';
  } else if (branch === BRANCHES.NO_EDGE) {
    verdict = '⑤ oracle 与 best_single 之差 < 0.02 ⇒ **上界本身不存在**，路由无意义（不必谈 R）';
  } else if (branch === BRANCHES.NO_SIGNAL) {
    verdict = '①′ 签名**没有分辨力**（准确率 ' + p(acc) + ' ＜ 2×max(随机 ' + p(chance) + '、placebo ' + p(placebo) + ')）'
      + ' ⇒ 所谓 realizable 只是"随便挑一粒"+别名共享，路由的收益不可信';
  } else if (branch === BRANCHES.WORTH) {
    verdict = '② 路由值得做，且**不必动指纹**（R=' + R.toFixed(2) + '、准确率 ' + p(acc) + ' > 随机 ' + p(chance) + '）';
  } else if (branch === BRANCHES.HALF) {
    verdict = '③ 半吊子收益（R=' + R.toFixed(2) + '、准确率 ' + p(acc) + '）⇒ 只报数，不推荐任何一侧';
  } else {
    verdict = '④ R=' + R.toFixed(2) + ' < 0.2 ⇒ oracle 那笔钱要靠网络内部条件化 ⇒ 支持改观测面';
  }
  return {
    bestSingle: bs.best, bestSinglePack: bs.pack, realizable: rz.value, realizableN: rz.n,
    oracle, gap, R, chance, informative, branch, verdict, metric: m,
  };
}

/** 矩阵能不能用来算上界：读不出包名 / 行数不足 / 环境数不足 ⇒ 返回**错误文本**（调用方负责 exit 2） */
export function matrixComplaint(rows, envs) {
  if (!Array.isArray(rows) || rows.length < 3) return '矩阵里可读出的包不足 3 粒（实测 ' + (rows ? rows.length : 0) + '）⇒ 上界无从算起';
  if (rows.some((r) => !r.pack)) return '有行的包名读不出（矩阵键变了？）⇒ 拒绝用无名行算上界';
  if (!Array.isArray(envs) || envs.length < 4) return '环境数不足 4（实测 ' + (envs ? envs.length : 0) + '）';
  return null;
}
