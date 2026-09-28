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
  NO_EDGE: '⑤', NO_READING: '⑥', INCONSISTENT: '⑥′', NO_SIGNAL: '①′', WORTH: '②', HALF: '③', NEEDS_NET: '④',
  /* ⓪ = §E131 的**反退化条款**：开了弃权闸却几乎谁都不换 ⇒ "增益 ≈ 0 且不跨 0"会被读成"路由做成了"，
   *    那是**同义反复**（弃权版 = 一招鲜），不是结果。这条判"没有结论"。 */
  DEGENERATE: '⓪',
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

/** picks: {env: 预测到的环境名} → 用"预测环境里最好的那粒包"在**真环境**上的读数求均值。
 *  `fallbackPack`（§E131 的弃权闸）：某环境**没预测**或**被判定弃权**时，不改用邻居的包，而是**保持这一粒**。
 *  ⚠ **`fallbackPack` 是必须的**（v1.5.289 修的一处算式错）：早先没有预测的环境被**整条跳过**，
 *    于是 `realizable` 是"有票的那几个环境"的均值，而 `oracle`/`best_single` 是**全部**环境的均值 ⇒ 分母不是同一批，
 *    `R` 会冲出 1（§E131 修完并列判歧义之后实测 R=2.81 —— 那不是我算对了，是两套均值在比大小）。
 *    现在统一成"路由器在**每个**参与打分的环境上实际打的那一粒" ⇒ `realizable ≤ oracle` 由构造保证，R 才有意义。 */
export function realizableOf(rows, envs, bestIn, picks, metric, fallbackPack) {
  const m = metricOrThrow(metric);
  const find = (p) => rows.find((x) => x.pack === p);
  if (!fallbackPack) throw new Error('realizableOf 必须有 fallbackPack：没有预测的环境不许被跳过（那会让 realizable 与 oracle 不是同一批环境）');
  const list = [];
  let switched = 0;
  for (const e of envs) {
    const pe = picks[e];
    const pack = pe ? bestIn[pe] : null;
    const used = pack || fallbackPack;
    if (pack && pack !== fallbackPack) switched++;
    const v = cellOf(find(used), e, m);
    if (v !== null) list.push(v);
  }
  return { value: mean(list), n: list.length, switched: switched };
}

export function chanceOf(nEnvs) { return 1 / Math.max(1, nEnvs); }

/** 签名有没有分辨力：**跟随机与 placebo 比**，不比绝对值（27 类时 13% 已经是有信息，见下面的规则缺陷记录） */
export function isInformative(acc, chance, placebo) {
  return isFinite(acc) && acc >= 2 * Math.max(chance, isFinite(placebo) ? placebo : 0, 1e-6);
}

/** 判读分支的**唯一决策函数**（门 D193 拿"屏幕上印出来的那几个数"重算一遍，比它印的分支符）：
 * 只要"印的分支"与"数的分支"不一致就得红 —— 这正是 §E129 那次两条判词互相打脸的形状。 */
export function branchOf({ gap, readingsOk, informative, R, abstainOn, nSwitch, minSwitch }) {
  if (!readingsOk) return BRANCHES.NO_READING;
  if (abstainOn && (nSwitch || 0) < (minSwitch == null ? 5 : minSwitch)) return BRANCHES.DEGENERATE;
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
export function routingReadings({ rows, envs, bestIn, picks, acc, placebo, metric, fallbackPack, abstainOn, nSwitch, minSwitch }) {
  const m = metricOrThrow(metric);
  const oracle = mean(envs.map((e) => (bestIn[e] ? cellOf(rows.find((x) => x.pack === bestIn[e]), e, m) : NaN)));
  const bs = bestSingleOf(rows, envs, m);
  const rz = realizableOf(rows, envs, bestIn, picks, m, fallbackPack);
  const gap = oracle - bs.best;
  const chance = chanceOf(envs.length);
  const informative = isInformative(acc, chance, placebo);
  const readingsOk = isFinite(oracle) && isFinite(bs.best) && isFinite(rz.value) && isFinite(acc) && envs.length > 0;
  /* 自洽性护栏：`realizable` 是"每个环境实际打的那一粒"，任何一粒都不会比该环境的最佳包更好 ⇒ **R 不可能 > 1**。
   * §E131 一开始量到 R=2.81，就是"没有票的环境被跳过"造成的两套均值比大小 ⇒ 这条护栏当时会直接拦住我。 */
  const inconsistent = readingsOk && rz.value > oracle + 1e-9;
  const R = (readingsOk && !inconsistent && gap >= 0.02) ? (rz.value - bs.best) / gap : null;
  const branch = inconsistent ? BRANCHES.INCONSISTENT
    : branchOf({ gap, readingsOk, informative, R, abstainOn: !!abstainOn, nSwitch: rz.switched, minSwitch: minSwitch });
  const p = (x) => (100 * x).toFixed(0) + '%';
  let verdict;
  if (branch === BRANCHES.INCONSISTENT) {
    verdict = '⑥′ **链路不自洽**：realizable(' + rz.value.toFixed(3) + ') 比 oracle(' + oracle.toFixed(3)
      + ') 还高 ⇒ 两个均值不是同一批环境（通常是"没预测的环境被跳过"）⇒ **不出结论**，先修算式';
  } else if (branch === BRANCHES.NO_READING) {
    verdict = '⑥ 读数不全（oracle/best_single/realizable/准确率 里至少一个没量到）⇒ **不出结论**';
  } else if (branch === BRANCHES.DEGENERATE) {
    verdict = '⓪ **反退化条款命中**：开了弃权闸却只换 ' + rz.switched + ' 个环境（< ' + (minSwitch == null ? 5 : minSwitch)
      + '）⇒ 这一版其实就是"几乎不换包"，它的"增益"是同义反复 ⇒ **判没有结论**（§E131 跑前写死的那条）';
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
    bestSingle: bs.best, bestSinglePack: bs.pack, realizable: rz.value, realizableN: rz.n, switched: rz.switched,
    oracle, gap, R, chance, informative, branch, verdict, metric: m,
  };
}

/** 留一最近邻（**并列不许按遍历顺序裁决**）。
 *  `items` = `[{v, env}]`，`skip` = 判谁就排除谁（留一）。返回 `{env, d, ambiguous, tied}`：
 *  最近距离若被**两个以上不同环境**并列占据 ⇒ `env=null` + `ambiguous=true`（"这桌按定义分不开"），
 *  同环境内部的并列**不算歧义**（那就是同一个原型，正是我们要认的东西）。
 *  ⚠ 这条是从 §E131 的一次真实读数错误抽出来的：原先写 `if (d < bd) { bd=d; bn=o.env; }`，
 *    在签名逐位重复的池子上（K=3 有 94% 的样本如此），"预测到哪个环境"由**样本数组的顺序**决定，
 *    而准确率因此从 6% 被读成 13%（⇒ 我差点拿一个偶然当成分辨力）。 */
export function nearestDistinct(v, items, skip, dist) {
  let bd = Infinity;
  const tied = new Set();
  for (const o of items) {
    if (o === skip) continue;
    const d = dist(v, o.v);
    if (d < bd - 1e-12) { bd = d; tied.clear(); tied.add(o.env); }
    else if (d <= bd + 1e-12) tied.add(o.env);
  }
  if (!tied.size) return { env: null, d: null, ambiguous: false, tied: [] };
  const envs = [...tied];
  return { env: envs.length === 1 ? envs[0] : null, d: bd, ambiguous: envs.length > 1, tied: envs };
}

/** 欧氏距离（签名向量的默认尺；§E131/§E134 共用一把，别在探针里另写一份）。 */
export function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = (a[i] || 0) - (b[i] || 0); s += d * d; }
  return Math.sqrt(s);
}
export function meanVec(arr) {
  const d = arr[0].length;
  const out = new Array(d).fill(0);
  for (const v of arr) for (let i = 0; i < d; i++) out[i] += (v[i] || 0);
  return out.map(x => x / arr.length);
}

/** §E134 的主尺：**可分原型数**（不是"值多少分"，而是"这组特征能不能把原型分开"）。
 *  `envVecs` = `{环境: [向量,…]}`，`dist` 可注入（默认欧氏）。
 *  原型 X 算"分开"当且仅当 `min_{Y≠X} dist(质心X,质心Y) > median_{X 内部两两} dist`
 *    —— "别的环境离我，比我自己的桌子之间的距离还远"。
 *  同时给：逐样本/逐质心的唯一点数（与 §E131 那个"15 个点"对账用）、歧义率（跨环境逐位并列的样本占比）、LOO 准确率。
 *  ⚠ 唯一点数**不能当判据**：连续特征下每条样本几乎都独一无二（实测 `U_sample` 逼近样本数），
 *     那只说明"维度多"，不说明"分得开" ⇒ 判据只看 `U_sep` 与歧义率。 */
export function separabilityOf(envVecs, dist) {
  const D = dist || euclid;
  const envs = Object.keys(envVecs).filter(e => Array.isArray(envVecs[e]) && envVecs[e].length > 0);
  const samples = [];
  for (const e of envs) for (const v of envVecs[e]) samples.push({ env: e, v });
  const cent = {}; for (const e of envs) cent[e] = meanVec(envVecs[e]);
  let sep = 0; const inseparable = [];
  for (const x of envs) {
    const arr = envVecs[x];
    const within = [];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) within.push(D(arr[i], arr[j]));
    const w = medianOf(within);
    let b = Infinity;
    for (const y of envs) if (y !== x) { const dd = D(cent[x], cent[y]); if (dd < b) b = dd; }
    if (w !== null && b > w) sep++;
    else inseparable.push({ env: x, within: w, between: b === Infinity ? null : b, ratio: w ? +(b / w).toFixed(3) : null });
  }
  let amb = 0, judged = 0, hit = 0;
  for (const s of samples) {
    const nn = nearestDistinct(s.v, samples, s, D);
    if (!nn || nn.d === null) continue;
    judged++;
    if (nn.ambiguous) { amb++; continue; }
    if (nn.env === s.env) hit++;
  }
  const key = (v) => v.map(x => x.toFixed(3)).join('|');
  return {
    nEnvs: envs.length, nSamples: samples.length,
    U_sep: sep, U_centroid: new Set(envs.map(e => key(cent[e]))).size, U_sample: new Set(samples.map(s => key(s.v))).size,
    ambRate: judged ? amb / judged : null, acc: judged ? hit / judged : null,
    inseparable: inseparable.sort((a, b2) => (a.ratio === null ? -1 : a.ratio) - (b2.ratio === null ? -1 : b2.ratio)),
  };
}

/** 中位数（空数组 ⇒ null，不返回 0 冒充"量到了"） */
export function medianOf(a) {
  if (!a || !a.length) return null;
  const s = a.slice().sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 投票占比（§E131 的 `share` 规则要用）。⚠ share 量的是**一致**，不是**对**——
 *  40 个样本可以齐刷刷投给同一个错误邻居（§E130 里那 23 个 0% 命中率的环境很可能正是这种形状）。 */
export function shareOf(votes) {
  const ent = Object.entries(votes || {}).sort((a, b) => b[1] - a[1]);
  const tot = ent.reduce((s, x) => s + x[1], 0);
  if (!ent.length || !tot) return { top: null, share: 0 };
  return { top: ent[0][0], share: ent[0][1] / tot };
}

/** §E131 的两条弃权规则（跑前定死，都不带可调分位数）。入参是**已经算好的三个统计量**（别让这里重复排序）：
 *  `dist` ⇒ `nnMed ≤ tau`（`tau` = 同环境两两签名距离的中位数，即"同一个原型的两张桌子之间的典型距离"）
 *  `share` ⇒ `share ≥ 0.5`（留一投票的众数占比）
 *  `both`  ⇒ 两条都要过。返回 `{canSwitch, why}`，`why` 只给屏幕看证据用、不参与判定。 */
export function decideSwitch(mode, { nnMed, tau, share }) {
  if (!mode || mode === 'off') return { canSwitch: true, why: '未开闸' };
  const okDist = mode === 'dist' || mode === 'both' ? (nnMed !== null && tau !== null && nnMed <= tau) : true;
  const sh = share == null ? 0 : share;
  const okShare = mode === 'share' || mode === 'both' ? (sh >= 0.5) : true;
  return { canSwitch: okDist && okShare, nnMed: nnMed, tau: tau, share: sh,
    why: 'nnMed=' + (nnMed === null ? '—' : nnMed.toFixed(3)) + ' τ=' + (tau === null ? '—' : tau.toFixed(3))
      + ' share=' + (100 * sh).toFixed(0) + '%' };
}

/** 矩阵能不能用来算上界：读不出包名 / 行数不足 / 环境数不足 ⇒ 返回**错误文本**（调用方负责 exit 2） */
export function matrixComplaint(rows, envs) {
  if (!Array.isArray(rows) || rows.length < 3) return '矩阵里可读出的包不足 3 粒（实测 ' + (rows ? rows.length : 0) + '）⇒ 上界无从算起';
  if (rows.some((r) => !r.pack)) return '有行的包名读不出（矩阵键变了？）⇒ 拒绝用无名行算上界';
  if (!Array.isArray(envs) || envs.length < 4) return '环境数不足 4（实测 ' + (envs ? envs.length : 0) + '）';
  return null;
}

/** ===== 配对差（单一来源）=====
 * 两个分析器都要"同一批观测上逐位相减的均值与区间"：
 *   · `analyze-routing-gain.mjs` 配的是**逐环境**的读数（§E129/§E130）
 *   · `analyze-swap-gain.mjs` 配的是**逐桌子**的命中数（§E136）
 * 口径定死为 §E130 那一份：**样本标准差（除以 n−1）+ 双侧 1.96**（默认 z=1.96 ⇒ 老分析器的数字逐位不变），
 * 非数值项**成对剔除**（剔除多少由调用方自己核对，别在这里静默改变分母）。
 * `n<2` 返回 null ⇒ 调用方必须走"不出结论"分支，不许把 null 当 0。 */
export function pairedDiff(a, b, z) {
  const zz = z == null ? 1.96 : z;
  const d = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (typeof a[i] === 'number' && typeof b[i] === 'number' && isFinite(a[i]) && isFinite(b[i])) d.push(a[i] - b[i]);
  }
  const n = d.length;
  if (n < 2) return null;
  const m = d.reduce((x, y) => x + y, 0) / n;
  const s = Math.sqrt(d.reduce((x, y) => x + (y - m) * (y - m), 0) / (n - 1));
  const h = zz * s / Math.sqrt(n);
  const sorted = d.slice().sort((x, y) => x - y);
  return { n: n, m: m, sd: s, se: s / Math.sqrt(n), h: h, lo: m - h, hi: m + h, z: zz,
    worse: d.filter((x) => x < -1e-9).length, better: d.filter((x) => x > 1e-9).length,
    tie: d.filter((x) => Math.abs(x) <= 1e-9).length, min: sorted[0], max: sorted[sorted.length - 1],
    p05: sorted[Math.floor(0.05 * (n - 1))] };
}
