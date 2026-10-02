/* §E223 · **搜索的偏好，这张脸学不学得会？**（policy distillation 的可学性检验 · 只读，不动出厂路径）
 *
 * 为什么要做这一刀（01:10，今晚最后一格，也是这几天唯一没被试过的方向）：
 *   · §E215/§E219 合起来：**网络的排名≈不含信息**（前 6 名的 max 不比随机 6 名好、被排除的卡也不更值钱），
 *     但**模拟器的 max 含信息**（§E193：把搜索当策略用 `B1` 54.7 ‖ 50.0 真赢 4.7pt）；
 *   · ⇒ 剩下的唯一出路是让网络**在出手那一刻就带着搜索的判断**。DS 查过（交接件 §5-B2）：
 *     `setImitTeacher / setImitPlanByName` 这套机器**在**，但历史上接进去的 teacher **全是手写脚本**
 *     （`heavyfire/antiring/guardgun/pickDeepSaver/pickRingSpam`）⇒ **"teacher = 搜索结果"是全仓空白**。
 *   · ⚠ 与 §E197/§E205 的区别（别当成重复劳动）：那两节学的是**赢率的数值**（`Q(s,a) → win`，回归），
 *     这一节学的是**选择**（`argmax win` 的交叉熵分类）。两者不同：回归要"算准"，蒸馏只要"排对第一名"。
 *
 * 判据（**先写死再跑**）：留出带上（**另一条 seed 带**）蒸馏头与教师的一致率必须
 *   ① 明显高于**随机地板** `mean(1/n)`，且 ② 明显高于**现役冠军包自己的一致率**（半宽不重叠）；
 *   达不到 ⇒ 这一格关掉，并且那将是一句比"再加一层/再加维"更根本的话：**是这张脸装不下搜索的判断**。
 * ⚠ 一致率 ≠ 胜率：这一档只答"学不学得会"，涨跌要第二步（真训练 + 产品桌 A/B）才算，不许在这一节里当已证。
 * ⚠ 教师标签自己也是**带噪**的（`rep` 有限）⇒ 同时必须报**教师分半一致率**当可学性的天花板，
 *   否则我会把"教师噪声"误读成"脸不行"（§E208 split-half 那条课的镜像应用）。
 *
 * 用法：node tools/probe-distill-learnability.mjs --train=<jsonl> --test=<jsonl> [--rep=16] [--l2=1e-3] [--h=16] [--feat=sa|a] [--quiet]
 *      输入 = `tools/probe-myopia-regret.mjs ... --cover=1 --dumpcover=<jsonl>` 的产物。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';
import { loadCardTable } from './log-reading.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['train', 'test', 'rep', 'l2', 'h', 'feat', 'epochs', 'lr', 'export', 'byenv', 'whopicks', 'costbias', 'teacherfloor', 'plusid', 'quiet', 'allowmixedcfg', 'dumpagree', 'prodfeat', 'epsens'], 'probe-distill-learnability');
/* ⚠ `allowmixedcfg` 必须同时进这张名单：守卫用 `argv.indexOf` 读它、而 `rejectUnknownFlags` 先把不认识的 `--` 打成 exit 64
   ⇒ 漏了这一项时，"混配置"这个**我亲手建的逃生口**自己会被响亮失败挡死（§E230 跑前才发现）。 */
const arg = (k, d) => { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); };
const TRAIN = arg('train', ''), TEST = arg('test', '');
if (!TRAIN || !TEST) { console.error('⛔ 必须同时给 --train= 与 --test=（留出检验没有"同一批"这个选项）'); process.exit(64); }
const REP = Math.max(2, Number(arg('rep', 16)) || 16);
const L2 = Number(arg('l2', 1e-3));
const HID = Math.max(0, Number(arg('h', 16)) || 0);
const EPOCHS = Math.max(1, Number(arg('epochs', 240)) || 240);
const LR = Number(arg('lr', 0.5));
const FEAT = arg('feat', 'sa');            // 'sa' = 状态⊕动作 ‖ 'a' = 只看动作（诊断："条件性"到底在不在状态里）
/* ===== §E231 `--prodfeat=1`：**只给动作块补一维"状态×动作乘积"**（默认关 ⇒ 输出逐字不变）=====
 *   动因（§E230 留下的砖）：同一张线性脸在 `long` 标签上能把费用方向拧到**反的**（γ 跨带摆 0.21、三枚里一枚塌成"只打免费卡"），
 *   而 §E225 已证明原因：`dim0 = (ep − 费用)/12` 里 `ep` 是**加项** ⇒ 组内相减抵消 ⇒ 这张脸**结构上**只能表达"与珠数无关的固定排序"。
 *   ⇒ 最小的一刀就是补一个真乘积项 `ep × 费用`（其余维、标签、超参一律不碰 ⇒ 单自由度）。
 *   ⚠ 还原 `ep(珠) = 12·dim0 + 6·dim2` 有 **0.3%** 的决策撞上 `clamp(±1)` 上界（§E225 实测）⇒ 那一小撮的乘积值是**下界**，
 *     这一档只读"改不改手/方向"，不读绝对数值 ⇒ 撞界不会把符号读反。 */
const PRODF = Number(arg('prodfeat', 0)) ? 1 : 0;
const ADIM_MARGIN = 0, ADIM_COST = 2;                    /* 动作块里那两维的下标（唯一定义，`--costbias`/`--teacherfloor`/乘积维共用）*/
const PRODF_SCALE = 12;                                  /* 与 dim0 同量纲（除以 12）⇒ 不额外引入尺度这个自由量 */
const epOf = a => 12 * a[ADIM_MARGIN] + 6 * a[ADIM_COST];
const costOf = a => 6 * a[ADIM_COST];
const prodDim = a => (epOf(a) * costOf(a)) / PRODF_SCALE;
/* ===== `--plusid=1`：**离线**给动作侧拼上"卡片身份 one-hot"（30 维），其余一字不动 =====
 *   为什么要这一格（03:2x）：`--whopicks` 读到"教师在防御可打的决策里 **40.8%** 挑防御、special 可打里 **28.6%** 挑 special，
 *   而蒸馏头两者都是 **0.0%**（160 个 + 60 个决策全部跑偏）"⇒ 必须分清这是
 *   ①**编码装不下**（当前 22 维动作块里没有卡片身份，§E218 又查出防御族 8 张逐位同向量 ⇒ 头压根看不见"这是哪张卡"），还是
 *   ②**没训动/容量不够**（MLP 那一档的对照）。
 *   做法：**不动 `js/train/policy.js`、不动出厂特征**，只在分析器里把 dump 已经存着的候选键 `d.k[i]` 摊成 one-hot 拼到动作块后面
 *   ⇒ 如果拼上身份之后头**开始**挑得到防御/special，那"换代先给动作侧加卡身份"就不再是猜想，而是**零成本预测试过**的结论。
 *   ⚠ 这一档读的是"**可表达性**"，不是产品胜率：真要拿到东西还得重训出厂包（那是 DS 的地盘 + 用户裁定）。 */
const PLUSID = Math.max(0, Math.min(2, Number(arg('plusid', 0)) || 0));    /* 0=关 ‖ 1=卡片 one-hot(30) ‖ 2=类别 one-hot(4) */
const QUIET = argv.indexOf('--quiet') >= 0;

const load = p => readFileSync(p, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const TRAIN_ROWS = load(TRAIN), TEST_ROWS = load(TEST);
/* ⚠ **配置来源守卫（§E230）**：`--config=` 之后 dump 会带 `cfg` 字段 ⇒ 两带的配置不一致时**拒跑**。
 *   理由：把 `multi/5` 与 `long/5` 的标签混在一列里当"同一种局面"蒸，等于让模型去看一个混合分布，
 *   而这一节要量的恰恰是"配置之间有什么不同"（§E194 一次对照只能一个自由量 + §E226"绝对电平跨配置不可比"）。
 *   旧 dump 没有这个字段 ⇒ 按当年的口径记作 `multi/5`。要**故意**混合训练必须显式 `--allowmixedcfg`。 */
const cfgMix = rows => { const m = {}; for (const d of rows) { const c = d.cfg || 'multi/5(旧 dump 无 cfg)'; m[c] = (m[c] || 0) + 1; } return m; };
const fmtCfg = m => Object.keys(m).map(k => k + ' ×' + m[k]).join(' ‖ ');
const TRAIN_CFG = cfgMix(TRAIN_ROWS), TEST_CFG = cfgMix(TEST_ROWS);
const KEY = k => Object.keys(k).join('/');
if (KEY(TRAIN_CFG) !== 'multi/5(旧 dump 无 cfg)' && KEY(TEST_CFG) !== KEY(TRAIN_CFG) && argv.indexOf('--allowmixedcfg') < 0) {
  console.error('⛔ 两带的配置不一致（训练 ' + fmtCfg(TRAIN_CFG) + ' ‖ 留出 ' + fmtCfg(TEST_CFG) + '）⇒ 这不是留出，是混配置。' +
    '要故意混合请显式加 `--allowmixedcfg`（并在日志里写明这是"一套打天下"的那一套）。'); process.exit(8);
}
const mean = x => x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) * (b - m), 0) / (x.length - 1)); };
const ci = x => 1.96 * sd(x) / Math.sqrt(Math.max(1, x.length)) * 100;

/* ---------- 教师标签（含并列的处理：并列 = 这格不判，印比例） ---------- */
/* ⚠ 破平必须**与候选顺序无关**（§E215 §4 那条课的第三次应验：`rep` 越小并列越多，若"先出现者胜"，
   教师与天花板都会偏向网络排名第 1 ⇒ 我会把自己骗成"标签有分辨率"）。
   上提成模块级（`tieKeysOf` / `argmaxBy`）是因为 `--teacherfloor` 要在**筛过的子集**上重新取 argmax
   ⇒ 同一套破平只能有一份实现（本仓"两份同构实现必漂移"的老病）。 */
const tieKeysOf = d => {
  const salt = ((d.g + 1) * 2654435761 ^ (d.n + 1) * 40503 ^ String(d.env).length * 22465903) >>> 0;
  return i => ((salt ^ Math.imul(i + 1, 2654435761)) >>> 0);
};
const argmaxBy = (V, H, tk, idx) => {
  const cmp = (i, j) => (V[i] > V[j]) || (V[i] === V[j] && (H[i] > H[j] || (H[i] === H[j] && tk(i) < tk(j))));
  let b = idx ? idx[0] : 0;
  for (let i = 1; i < V.length; i++) { if (idx && idx.indexOf(i) < 0) continue; if (cmp(i, b)) b = i; }
  return b;
};
function prep(rows) {
  const out = []; let tiedDec = 0, shortRep = 0;
  for (const d of rows) {
    if (!d.w || d.w.length < 2) continue;
    if (d.w[0].length < REP) { shortRep++; continue; }
    const v = d.w.map(a => mean(a.slice(0, REP))), h = d.hp.map(a => mean(a.slice(0, REP)));
    const half1 = d.w.map(a => mean(a.slice(0, REP >> 1))), half2 = d.w.map(a => mean(a.slice(REP >> 1, REP)));
    const tk = tieKeysOf(d);
    const argmax = (V, H) => argmaxBy(V, H, tk, null);
    const V = v, H = h;
    const top = Math.max.apply(null, V), topH = Math.max.apply(null, H.filter((_, i) => V[i] === top));
    let nTie = 0;
    for (let i = 0; i < V.length; i++) if (V[i] === top && h[i] === topH) nTie++;
    if (nTie > 1) tiedDec++;
    const t = argmax(V, H);
    out.push({
      d: d, n: V.length, teacher: t,
      netPick: (() => { const s = d.net.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0])[0]; return s[1]; })(),
      // 教师自己分半（同一批流对半拆 ⇒ 只用"标签本身还能不能自洽"当天花板）
      tA: argmax(half1, d.hp.map(a => mean(a.slice(0, REP >> 1)))), tB: argmax(half2, d.hp.map(a => mean(a.slice(REP >> 1, REP)))),
      v: V, h: H, tied: nTie > 1
    });
  }
  return { rows: out, tiedDec: tiedDec, shortRep: shortRep };
}
/* ---------- 特征：状态存一份、动作每候选一份 ⇒ 这里拼成每候选一行 ---------- */
const DIMS = TRAIN_ROWS.length ? TRAIN_ROWS[0].s.length + TRAIN_ROWS[0].a[0].length : 0;   /* 出厂面（不含身份块）*/
/* 身份块（见文件头 `--plusid` 那段）：从 dump 里已经存好的**候选键**现算，不碰出厂特征。 */
const CT = loadCardTable();
const ID_KEYS = []; { const seen = {}; for (const k in CT.RUL.skills) { const s = CT.RUL.skills[k]; if (s && s.key && !seen[s.key]) { seen[s.key] = 1; ID_KEYS.push(s.key); } } }
const ID_POS = {}; for (let i = 0; i < ID_KEYS.length; i++) ID_POS[ID_KEYS[i]] = i;
const CAT_ORDER = ['energy', 'attack', 'defense', 'special'];
const IDN = PLUSID === 1 ? ID_KEYS.length : PLUSID === 2 ? CAT_ORDER.length : 0;
function idFeat(key) {
  if (!IDN) return [];
  if (PLUSID === 2) { const c = CT.catByKey[key]; if (!c) { console.error('⛔ 卡 `' + key + '` 在规则表里查不到类别'); process.exit(3); } const v = new Array(CAT_ORDER.length).fill(0); v[CAT_ORDER.indexOf(c)] = 1; return v; }
  if (!(key in ID_POS)) { console.error('⛔ 卡 `' + key + '` 不在规则表的 .key 里 ⇒ 身份块无法构造'); process.exit(3); }
  const v = new Array(ID_KEYS.length).fill(0); v[ID_POS[key]] = 1; return v;
}
function feats(row) {
  const s = FEAT === 'a' ? new Array(TRAIN_ROWS[0].s.length).fill(0) : row.d.s;
  return row.d.a.map((a, i) => s.concat(PRODF ? a.concat([prodDim(a)]) : a).concat(idFeat(row.d.k[i])));
}
/* ---------- ① 价值回归（岭回归，闭式解）—— 与 §E197/§E205 同一族，这里当**对照**用 ---------- */
function ridge(rows, lam) {
  const X = [], y = [];
  for (const r of rows) { const F = feats(r); for (let i = 0; i < r.n; i++) { X.push(F[i]); y.push(r.v[i]); } }
  const p = X[0].length;
  const mu = new Array(p).fill(0); for (const x of X) for (let j = 0; j < p; j++) mu[j] += x[j] / X.length;
  const ybar = mean(y);
  const A = new Array(p).fill(0).map(() => new Array(p).fill(0)), b = new Array(p).fill(0);
  for (let t = 0; t < X.length; t++) {
    const xr = X[t].map((v, j) => v - mu[j]), yr = y[t] - ybar;
    for (let i = 0; i < p; i++) { b[i] += xr[i] * yr; for (let k = i; k < p; k++) A[i][k] += xr[i] * xr[k]; }
  }
  for (let i = 0; i < p; i++) A[i][i] += lam * X.length;
  // 解 Ax=b（高斯消元，p≈235 ⇒ 一次就够）
  const M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < p; c++) {
    let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    const t = M[c]; M[c] = M[piv]; M[piv] = t;
    const d = M[c][c] || 1e-12;
    for (let k = c; k <= p; k++) M[c][k] /= d;
    for (let r = 0; r < p; r++) { if (r === c) continue; const f = M[r][c]; if (!f) continue; for (let k = c; k <= p; k++) M[r][k] -= f * M[c][k]; }
  }
  const w = M.map(r => r[p]);
  return { w: w, mu: mu, ybar: ybar };
}
/* ---------- ② 蒸馏头：softmax 交叉熵学"教师会选哪个"（这才是本节的新东西） ---------- */
function trainPolicy(rows, hidden) {
  const p = rows[0].d.a[0].length + PRODF + (FEAT === 'a' ? 0 : rows[0].d.s.length) + IDN;
  let W1 = null, W2 = null, B1 = null, beta = new Float64Array(p);
  const rnd = (function () { let s = 20261002 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s << 17; s >>>= 0; s ^= s >>> 5; s >>>= 0; return s / 4294967296 - 0.5; }; })();
  if (hidden > 0) {
    W1 = []; for (let j = 0; j < hidden; j++) { const col = new Float64Array(p); for (let i = 0; i < p; i++) col[i] = rnd() * 0.05; W1.push(col); B1 = B1 || new Float64Array(hidden); }
    W2 = new Float64Array(hidden); for (let j = 0; j < hidden; j++) W2[j] = rnd() * 0.05;
  }
  const score = hidden > 0
    ? (x => { let z = 0; for (let j = 0; j < hidden; j++) { let a = B1[j]; for (let i = 0; i < p; i++) a += x[i] * W1[j][i]; z += W2[j] * Math.tanh(a); } return z; })
    : (x => { let z = 0; for (let i = 0; i < p; i++) z += x[i] * beta[i]; return z; });
  const grad = hidden > 0
    ? (x, err, acc) => { for (let j = 0; j < hidden; j++) { let a = B1[j]; for (let i = 0; i < p; i++) a += x[i] * W1[j][i]; const th = Math.tanh(a);
        acc.w2[j] += err * th; const dh = err * (1 - th * th); for (let i = 0; i < p; i++) acc.w1[j][i] += dh * x[i]; acc.b1[j] += dh; } }
    : (x, err, acc) => { for (let i = 0; i < p; i++) acc[i] += err * x[i]; };
  let momW1 = null, momW2 = null, momB1 = null, momB = new Float64Array(p);
  if (hidden > 0) { momW1 = W1.map(c => new Float64Array(p)); momW2 = new Float64Array(hidden); momB1 = new Float64Array(hidden); }
  const MOM = 0.9;
  for (let ep = 0; ep < EPOCHS; ep++) {
    if (hidden > 0) { momW2 = new Float64Array(hidden); momB1 = new Float64Array(hidden); momW1 = W1.map(() => new Float64Array(p)); }
    else momB = new Float64Array(p);
    for (const r of rows) {
      const F = feats(r), sc = [], tot = 0;
      let mx = -Infinity; for (let i = 0; i < r.n; i++) { const s = score(F[i]); sc.push(s); if (s > mx) mx = s; }
      let Z = 0; const ex = sc.map(s => { const e = Math.exp(s - mx); Z += e; return e; });
      const acc = hidden > 0 ? { w1: W1.map(() => new Float64Array(p)), w2: new Float64Array(hidden), b1: new Float64Array(hidden) } : new Float64Array(p);
      for (let i = 0; i < r.n; i++) {
        const pr = ex[i] / Z, err = pr - (i === r.teacher ? 1 : 0);
        if (hidden > 0) grad(F[i], err, acc); else grad(F[i], err, acc);
      }
      if (hidden > 0) { for (let j = 0; j < hidden; j++) { momW2[j] = MOM * momW2[j] + LR * (acc.w2[j] / r.n + L2 * W2[j]); W2[j] -= momW2[j]; momB1[j] = MOM * momB1[j] + LR * acc.b1[j] / r.n; B1[j] -= momB1[j];
          for (let i = 0; i < p; i++) { momW1[j][i] = MOM * momW1[j][i] + LR * (acc.w1[j][i] / r.n + L2 * W1[j][i]); W1[j][i] -= momW1[j][i]; } } }
      else { for (let i = 0; i < p; i++) { momB[i] = MOM * momB[i] + LR * (acc[i] / r.n + L2 * beta[i]); beta[i] -= momB[i]; } }
    }
  }
  /* `beta` 只有在 h=0 时才有意义（`--export=` 要把线性头交给播放器）⇒ 一并返回，别让它关在闭包里。 */
  return { score: score, beta: beta, W1: W1, W2: W2, B1: B1, hidden: hidden, p: p };
}
/* ---------- 一致率与报告 ---------- */
function agree(rows, pickFn) { const a = []; for (const r of rows) a.push(pickFn(r) === r.teacher ? 1 : 0); return a; }
function byGameAgree(rows, pickFn) { const g = {}; for (const r of rows) { const k = r.d.env + '#' + r.d.g; (g[k] = g[k] || []).push(pickFn(r) === r.teacher ? 1 : 0); } return Object.keys(g).map(k => mean(g[k])); }
function report(name, arr, games) {
  return name.padEnd(22) + (100 * mean(arr)).toFixed(1).padStart(6) + '% ±' + ci(arr).toFixed(1) +
    (games && games.length > 1 ? '（按局 ' + (1.96 * sd(games) / Math.sqrt(games.length) * 100).toFixed(1) + '）' : '');
}
if (!QUIET) console.log('# §E223 可学性检验：教师 = 搜索的 argmax（`--dumpcover` 的标签）‖ 留出带 = `--test` 那一遍');
const P1 = prep(TRAIN_ROWS), P2 = prep(TEST_ROWS);
const R1 = P1.rows, R2 = P2.rows;
/* ===== `--teacherfloor=<珠>`：**只改标签的可行集**，其余一字不动（§E225，判据在 §E224 ④/文件头跑前写死）=====
 *   动因（10-02 上午的两次读数）：① 教师 argmax 本来就比现役包每手多花 +0.46 ‖ +0.39 珠（病在标签，不在这张脸）；
 *   ② 但**标签分布里 46% 的决策已经在 `ep ≤ 0.49 珠`**（= 头部署后生活的电平）⇒ "**曝光偏差 / 分布漂移**"**不是**病灶
 *   ⇒ 自洽重标（DAgger）的前提被自己的测量否掉，于是先跑**便宜的离线约束**：
 *     把教师那手限制在"**施展之后至少还剩 FLOOR 珠**"的候选里重新取 argmax（同一套顺序无关破平、同一批流、同一张表）。
 *   ⚠ 这是**可行性约束**，不是手写价：没有给珠赋任何价值，只是把"打完就归零"的那些候选从教师的选项里拿掉。
 *   ⚠ 与 `天花板` 那一列的关系：`tA/tB`（教师分半）保持**不加约束**的原义 ⇒ `floor>0` 时"一致率 vs 天花板"不可直接比，
 *     本轮的判据是**产品桌胜率**与 `--costbias` 的 师−包 费用差，不是留出一致率。
 *   ⚠ 还原用 `ep(珠) = 12·dim0 + 6·dim2`（本表所有卡费用 ≤5 ⇒ `min(c,6)` 那层截平**永不**绑定，见 §E225 记录）。 */
const FLOOR = Number(arg('teacherfloor', 0)) || 0;
/* （`ADIM_MARGIN/ADIM_COST` 的定义已上移到 `--prodfeat` 那一节 ⇒ 三档共用同一份下标，不再有两份定义）*/
if (FLOOR > 0) {
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 0; };
  let tot = 0, changed = 0, fellBack = 0;
  for (const rows of [P1.rows, P2.rows]) for (const r of rows) {
    tot++;
    const A = r.d.a; if (A.length !== r.n) { console.error('⛔ dump 动作块行数 ≠ 候选数'); process.exit(3); }
    const ep = med(A.map(x => 12 * x[ADIM_MARGIN] + 6 * x[ADIM_COST]));
    const allow = []; for (let i = 0; i < A.length; i++) if (6 * A[i][ADIM_COST] <= ep - FLOOR) allow.push(i);
    if (!allow.length) { fellBack++; continue; }
    const t2 = argmaxBy(r.v, r.h, tieKeysOf(r.d), allow);
    if (t2 !== r.teacher) changed++;
    r.teacher = t2;
  }
  console.log('# `--teacherfloor=' + FLOOR + ' 珠`：' + tot + ' 个决策里教师那手**变了 ' + changed + ' 个（' + (100 * changed / tot).toFixed(1) + '%）**' +
    ' ‖ 无候选通过筛选 ⇒ 退回原 argmax：' + fellBack + ' 个（' + (100 * fellBack / tot).toFixed(1) + '%）' +
    ' ‖ ⚠ 这一档下"天花板"那一列仍是**无约束**教师的分半 ⇒ 别拿留出一致率去比它');
}
console.log('# 训练带 ' + R1.length + ' 个决策（并列 ' + P1.tiedDec + '） ‖ 留出带 ' + R2.length + ' 个决策（并列 ' + P2.tiedDec + ' ‖ 流数不足 ' + P2.shortRep + '）' +
  ' ‖ 候选数均值 ' + mean(R2.map(r => r.n)).toFixed(1) + ' ‖ 特征 ' + FEAT + (PRODF ? ' **+ 一维乘积项 `ep×费用/12`（§E231）**' : '') + ' ‖ rep=' + REP + ' ‖ 隐藏元 ' + HID);
console.log('# 标签来自的配置：训练 ' + fmtCfg(TRAIN_CFG) + ' ‖ 留出 ' + fmtCfg(TEST_CFG) + (argv.indexOf('--allowmixedcfg') >= 0 ? ' ‖ ⚠ **已显式允许混配置**' : ''));
/* ⚠ 两带必须真的不同（§E205 那次"同文件当 train+test"的教训）
   §E230 修正：`--config=` 之后**同一个 seed 在两个配置下是两批完全不同的局** ⇒ "相同"必须连配置一起判，
   否则 `multi/3100 → long/3100` 这种合法的跨配置留出会被旧写法挡掉（本机实测 `exit 7` 才暴露）。 */
{ const tag = rows => rows[0].seed + '#' + (rows[0].cfg || 'multi/5(旧 dump 无 cfg)');
  if (tag(TRAIN_ROWS) === tag(TEST_ROWS)) { console.log('⛔ 两遍 dump 的 **seed 与配置**都相同 ⇒ 这不是留出，判据作废'); process.exit(7); }
  if (TRAIN === TEST) { console.log('⛔ `--train` 与 `--test` 是同一个文件 ⇒ 这不是留出，判据作废'); process.exit(7); } }

const netPick = r => r.netPick, teacherSelf = r => r.tA;
const ridgeH = ridge(R1, L2);
const ridgePick = r => { const F = feats(r); let b = 0, bv = -Infinity; for (let i = 0; i < r.n; i++) { let z = ridgeH.ybar; for (let j = 0; j < ridgeH.w.length; j++) z += ridgeH.w[j] * (F[i][j] - ridgeH.mu[j]); if (z > bv) { bv = z; b = i; } } return b; };
const pol = trainPolicy(R1, HID);
const polPick = r => { const F = feats(r); let b = 0, bv = -Infinity; for (let i = 0; i < r.n; i++) { const z = pol.score(F[i]); if (z > bv) { bv = z; b = i; } } return b; };
/* 头那手的挑选（**平票必须与候选顺序无关**）：§E218 说防御族 8 张卡的动作向量逐位相同 ⇒ 头的分数也逐位相同，
   若按"下标小者胜"，挑到谁完全由枚举顺序决定 ⇒ 凡"读头挑了哪张卡"的档（`--whopicks` ‖ `--costbias`）都必须走这一份实现。
   ⇒ 用"键 + 该候选动作向量"的 FNV 哈希破平：同一张卡在任何顺序下得到同一个破平值。 */
const headPickTb = r => {
  const F = feats(r), tkh = [];
  for (let i = 0; i < r.n; i++) { let h = 2166136261; const s = r.d.k[i] + '|' + F[i].join(','); for (let q = 0; q < s.length; q++) h = Math.imul(h ^ s.charCodeAt(q), 16777619); tkh.push(h >>> 0); }
  let b = 0;
  for (let i = 1; i < r.n; i++) { const z = pol.score(F[i]), zb = pol.score(F[b]); if (z > zb || (z === zb && tkh[i] < tkh[b])) b = i; }
  return b;
};
/* ⚠ 教师有并列（rep=16 时约一半的格并列，§E215 实测 57% ‖ 56%）⇒ **"与教师一致"在那批格上几乎无定义**
   （谁赢由破平哈希决定）。所以整张表必须**同时**给"全部决策"与"只算无并列的决策"两档，判据只看后者。 */
const block = function (label, rows) {
  console.log('\n## ' + label + '（留出带 ' + rows.length + ' 个决策）');
  console.log('  ' + report('随机地板 1/n', rows.map(r => 1 / r.n)) + '   ← 什么都不学的水平');
  console.log('  ' + report('现役冠军包（net）', agree(rows, netPick), byGameAgree(rows, netPick)));
  console.log('  ' + report('价值回归头（对照）', agree(rows, ridgePick), byGameAgree(rows, ridgePick)) + '   ← §E197/§E205 那一族');
  console.log('  ' + report('**蒸馏头（学 argmax）**', agree(rows, polPick), byGameAgree(rows, polPick)) + '   ← 本节的新目标');
  console.log('  ' + report('教师自己分半（天花板）', agree(rows, teacherSelf), byGameAgree(rows, teacherSelf)) + '   ← 教师标签的自洽上限');
  const aPack = agree(rows, netPick), aPol = agree(rows, polPick), aFloor = rows.map(r => 1 / r.n), aCeil = agree(rows, teacherSelf);
  const gap = rows.map((r, i) => aPol[i] - aPack[i]);
  const gapF = rows.map((r, i) => aPol[i] - aFloor[i]);
  console.log('  ‖ 配对：蒸馏头 − 现役包 **' + (100 * mean(gap)).toFixed(2) + ' ±' + ci(gap).toFixed(2) + 'pt** ‖ 蒸馏头 − 地板 **' +
    (100 * mean(gapF)).toFixed(2) + ' ±' + ci(gapF).toFixed(2) + 'pt** ‖ 天花板 − 地板 ' + (100 * mean(rows.map((r, i) => aCeil[i] - aFloor[i]))).toFixed(1) + 'pt');
  return { aPol: aPol, aPack: aPack, aFloor: aFloor };
};
/* 价值头留出 R²（"训没训动"的凭据；§E208 那条：容量型负结果必须同遍印 R²） */
{
  let ss = 0, tt = 0, n = 0; const ybar = mean(R2.map(r => r.v).flat());
  for (const r of R2) { const F = feats(r); for (let i = 0; i < r.n; i++) { let z = ridgeH.ybar; for (let j = 0; j < ridgeH.w.length; j++) z += ridgeH.w[j] * (F[i][j] - ridgeH.mu[j]); ss += (z - r.v[i]) * (z - r.v[i]); tt += (ybar - r.v[i]) * (ybar - r.v[i]); n++; } }
  let ls = 0, lm = 0;
  for (const r of R2) { const F = feats(r); const sc = F.map(x => pol.score(x)); const mx = Math.max.apply(null, sc); let Z = 0; const ex = sc.map(x => { const e = Math.exp(x - mx); Z += e; return e; }); ls += -Math.log((ex[r.teacher] || 1e-12) / Z); lm++; }
  console.log('\n  ‖ 价值头留出 R² **' + (1 - ss / tt).toFixed(3) + '**（' + n + ' 行 ‖ 负数 = 比猜均值还差 ⇒ 与 §E212 (D)"标签水平不可跨带迁移"一致）' +
    ' ‖ 蒸馏头留出 log-loss **' + (ls / lm).toFixed(3) + '**（均匀猜 = ln(候选数) ≈ ' + Math.log(mean(R2.map(r => r.n))).toFixed(3) + '）');
}
block('一致率：全部决策（含并列 ⇒ 只能看形状）', R2);
const NT = R2.filter(r => !r.tied);
const last = block('只算**无并列**的决策（判据看这一档）', NT);
console.log('\n## 判据（跑之前写死的，见文件头）');
if (!NT.length) { console.log('  ⛔ 留出带一个"无并列"的决策都没有 ⇒ 这一档不给判据（不许拿"含并列"那档当结论）'); }
else {
  const g2 = NT.map((r, i) => last.aPol[i] - last.aPack[i]), g3 = NT.map((r, i) => last.aPol[i] - last.aFloor[i]);
  console.log('  无并列档：蒸馏头 − 现役包 **' + (100 * mean(g2)).toFixed(2) + ' ±' + ci(g2).toFixed(2) + 'pt** ‖ 蒸馏头 − 地板 **' +
    (100 * mean(g3)).toFixed(2) + ' ±' + ci(g3).toFixed(2) + 'pt**');
  const ok1 = Math.abs(100 * mean(g3)) - ci(g3) > 0, ok2 = Math.abs(100 * mean(g2)) - ci(g2) > 0 && mean(g2) > 0;
  console.log('  ⇒ 判"学得会"需要：① 蒸馏头明显高于地板（' + (ok1 ? '过' : '**不过**') + '）② 且明显高于现役包（' + (ok2 ? '过' : '**不过**') +
    '）② 不过 ⇒ 这一格关掉。⚠ 一致率不是胜率，涨跌要第二步（真训练 + 产品桌 A/B）才算。');
}
/* ===== `--byenv`：**逐环境**问"教师在环境的哪一侧含增益、头在那一侧装不装得下"（§E223 第二步读到"合并 −2.7pt、
 *   但分环境全正/全负"之后补的刀）。0 rollout，用的就是 dump 里已有的逐流数组。
 * ⚠ 必须用**选择流与评价流分开**的无偏估计（§E219 那条"只引无偏那两列"的镜像）：
 *   前三条流选、后 `REP−3` 条评 —— 三臂（教师/头/包）**同一把尺**，否则 `max` 型统计量的选取膨胀只扣到教师与头身上，
 *   而包用的是确定性的 `net` 分（不含流噪声）⇒ 直接比会把"估计噪声"读成"教师比包强"。 */
if (argv.indexOf('--byenv') >= 0) {
  const H = REP >> 1;
  const mm = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  const by = {};
  for (const r of R2) {
    const d = r.d, n = d.w.length;
    const v1 = d.w.map(a => mm(a.slice(0, H))), v2 = d.w.map(a => mm(a.slice(H, REP)));
    const h1 = d.hp.map(a => mm(a.slice(0, H)));
    const salt = ((d.g + 1) * 2654435761 ^ (d.n + 1) * 40503 ^ String(d.env).length * 22465903) >>> 0;
    const tk = i => ((salt ^ Math.imul(i + 1, 2654435761)) >>> 0);
    const am = (V, W) => { let b = 0; for (let i = 1; i < n; i++) if (V[i] > V[b] || (V[i] === V[b] && (W[i] > W[b] || (W[i] === W[b] && tk(i) < tk(b))))) b = i; return b; };
    const F = feats(r), hs = F.map(x => pol.score(x));
    const iT = am(v1, h1), iH = am(hs, v1), iP = am(d.net, v1);
    const e = by[d.env] = by[d.env] || { n: 0, games: {}, agreeT: 0, agreeP: 0 };
    e.n++; e.agreeT += iT === iH ? 1 : 0; e.agreeP += iP === iT ? 1 : 0;
    const gid = d.env + '#' + d.g;
    const gg = e.games[gid] = e.games[gid] || { T: [], H: [], P: [] };
    gg.T.push(v2[iT]); gg.H.push(v2[iH]); gg.P.push(v2[iP]);
  }
  console.log('\n## 逐环境（**无偏**：前 ' + H + ' 条流选、后 ' + (REP - H) + ' 条评 ‖ 留出带 ‖ 单位 = 一手搜索口径的赢率 %）');
  console.log('⚠ 这一档的单位是**一手搜索口径的赢率**（延续策略 = 现役包 ⇒ 教师与头都在同一把有盲点的尺下），**不是产品胜率**；' +
    '产品胜率那一问在 `tools/probe-distill-player.mjs`。两把尺同向才叫结论，反向要单独解释。');
  const line = (name, e) => {
    const G = Object.keys(e.games).map(k => e.games[k]);
    const mT = mean(G.map(x => mean(x.T))), mH = mean(G.map(x => mean(x.H))), mP = mean(G.map(x => mean(x.P)));
    const dHP = G.map(x => mean(x.H) - mean(x.P)), dTP = G.map(x => mean(x.T) - mean(x.P));
    const capt = (mean(dTP) > 0) ? (mean(dHP) / mean(dTP)) : NaN;
    console.log('  ' + String(name).padEnd(12) + '│ ' + String(e.n).padStart(4) + ' │ ' + (100 * mT).toFixed(1) + '/' + (100 * mH).toFixed(1) + '/' + (100 * mP).toFixed(1) +
      '  │ 头−包 **' + (100 * mean(dHP)).toFixed(1) + ' ±' + ci(dHP).toFixed(1) + '** ‖ 教师−包 **' + (100 * mean(dTP)).toFixed(1) + ' ±' + ci(dTP).toFixed(1) + '** pt（' + G.length + ' 局）' +
      ' │ 捕捉 ' + (isNaN(capt) ? '—' : (100 * capt).toFixed(0) + '%') + ' │ 与教师一致 头/包 ' + (100 * e.agreeT / e.n).toFixed(0) + '%/' + (100 * e.agreeP / e.n).toFixed(0) + '%');
  };
  console.log('环境          │ 决策 │ 搜索口径赢率 教师/头/包  │ 配对差（无偏，pt）                              │ 捕捉比 │ 一致率');
  for (const env of Object.keys(by).sort()) line(env, by[env]);
  const ALL = { n: 0, games: {}, agreeT: 0, agreeP: 0 };
  for (const env of Object.keys(by)) { const e = by[env]; ALL.n += e.n; ALL.agreeT += e.agreeT; ALL.agreeP += e.agreeP;
    for (const gid of Object.keys(e.games)) ALL.games[gid] = e.games[gid]; }
  line('**合并**', ALL);
  console.log('  读法：某一环境若**教师−包 ≈0 或为负** ⇒ 标签在那张桌上压根不含增益（是**评估器/延续策略**瞎，不是脸装不下）；');
  console.log('        若**教师−包 明显为正而头−包 为负** ⇒ 是那一张脸装不下（这才轮得到"加身份/加交互"那条路说话）。');
}
/* ===== `--costbias`：**"头把 ep 打干"这件事，是标签带来的还是拟合带来的？**（零新 rollout）
 *   起因（10-02 上午）：§E223 在产品桌上读到 头那臂 决策时 **ep 均值 0.49 vs 包 1.81（珠）**、候选数 11.5（中位 4）vs 26.1（中位 23）、每局出手 12 vs 17 ⇒ 判语是
 *   "一手搜索的口径看不见下一手买不起"。但**这句话的主语应该是标签，不是头**：
 *   如果教师自己（在同一张候选表上取 argmax）就系统性地挑更贵的那手，那头是**忠实地抄了一个会饿死经济的偏好**，
 *   要改的是标签结算；如果教师与包在费用上没差别、只有头偏低，那才是**拟合把它推向了贵卡**（那是另一回事）。
 *   原料：动作块 22 维里第 **0** 维 = `(ep − 费用)/12`（截到 ±1 ⇒ 施展**之后**的余量），第 **1** 维 = 可否正常施展，
 *   第 **2** 维 = `min(费用,6)/6` ⇒ **`ep(珠) = 12·dim0 + 6·dim2`**（⚠ 单位：参照列"决策时 ep 均值"本来就是珠）。
 *   判据（**跑前写死**，两带各判一次）：**`标签里 ep ≤ 0.49 珠（= 部署态 headT 那一档）的决策占比`**
 *     · `< 5%` ⇒ 训练分布**没访问过**头实际生活的区域 ⇒ "在现有标签上加费用下限/惩罚"这类**离线**修法判为惰性，下一刀只有自洽重标；
 *     · `≥ 20%` ⇒ 低 ep 在标签里**有的是** ⇒ "曝光偏差 / 分布漂移"**不是**病灶 ⇒ 先跑便宜的离线费用下限，不付自洽重标的代价；
 *     · 中间 ⇒ 不 decisively，加带再看，**不许当场改判据**。
 *   ⚠ 与 `--whopicks` 同一件事：**头那手用顺序无关的破平**（`headPickTb`），否则"挑了哪张卡"是枚举顺序的函数。 */
if (argv.indexOf('--costbias') >= 0) {
  const ciu = x => 1.96 * sd(x) / Math.sqrt(Math.max(1, x.length));
  const COST = ADIM_COST, MARGIN = ADIM_MARGIN;
  const pick = (r, src) => src === 'teacher' ? r.teacher : src === 'pack' ? r.netPick : src === 'head' ? headPickTb(r) : -1;
  const SRCS = ['teacher', 'pack', 'head'];
  const stat = {};
  for (const s of SRCS) stat[s] = { cost: [], marg: [], clip: 0, n: 0 };
  let menuCost = [], menuMarg = [];
  const pair = { 'teacher−pack': [], 'head−pack': [] };
  const pairMarg = { 'teacher−pack': [], 'head−pack': [] };
  const by = {};
  for (const r of R2) {
    const A = r.d.a;
    if (A.length !== r.n) { console.error('⛔ dump 里动作块行数 ' + A.length + ' ≠ 候选数 ' + r.n); process.exit(3); }
    const c = i => 6 * A[i][COST], m = i => 12 * A[i][MARGIN];
    for (const s of SRCS) { const i = pick(r, s); stat[s].cost.push(c(i)); stat[s].marg.push(m(i)); stat[s].n++; if (Math.abs(A[i][COST]) >= 1 || Math.abs(A[i][MARGIN]) >= 1) stat[s].clip++; }
    menuCost.push(mean(A.map((_, i) => c(i)))); menuMarg.push(mean(A.map((_, i) => m(i))));
    const pc = c(r.netPick), pm = m(r.netPick);
    pair['teacher−pack'].push(c(r.teacher) - pc); pairMarg['teacher−pack'].push(m(r.teacher) - pm);
    const hi = headPickTb(r); pair['head−pack'].push(c(hi) - pc); pairMarg['head−pack'].push(m(hi) - pm);
    const e = by[r.d.env] = by[r.d.env] || { n: 0, t: 0, p: 0, h: 0, dt: [], dh: [] };
    e.n++; e.t += c(r.teacher); e.p += pc; e.h += c(hi); e.dt.push(c(r.teacher) - pc); e.dh.push(c(hi) - pc);
  }
  console.log('\n## 费用侧（单位 = 珠 ‖ 留出带 ' + R2.length + ' 个决策、同一批候选表、**逐决策配对** ‖ 头 = 训在另一带的样本外那枚）');
  console.log('  来源          │   费用均值   │  施展后余量均值  │ 截平率');
  console.log('  ' + '菜单（整表）'.padEnd(14) + '│ ' + mean(menuCost).toFixed(2) + ' 珠      │ ' + mean(menuMarg).toFixed(2) + ' 珠        │ —');
  const NAME = { teacher: '教师 argmax', pack: '现役包 argmax', head: '蒸馏头 argmax' };
  for (const k of SRCS) { const x = stat[k];
    console.log('  ' + NAME[k].padEnd(14) + '│ ' + mean(x.cost).toFixed(2) + ' 珠      │ ' + mean(x.marg).toFixed(2) + ' 珠        │ ' + (100 * x.clip / x.n).toFixed(1) + '%'); }
  for (const k of Object.keys(pair)) {
    console.log('  配对 ' + k.padEnd(12) + '：费用 **' + (mean(pair[k]) >= 0 ? '+' : '') + mean(pair[k]).toFixed(2) + ' ±' + ciu(pair[k]).toFixed(2) + ' 珠**' +
      ' ‖ 施展后余量 **' + (mean(pairMarg[k]) >= 0 ? '+' : '') + mean(pairMarg[k]).toFixed(2) + ' ±' + ciu(pairMarg[k]).toFixed(2) + ' 珠**' +
      '（正 = 这一方比包**更费** / 打完**余量更多**）');
  }
  console.log('\n  逐环境（费用均值 教师/包/头 ‖ 配对差）');
  for (const env of Object.keys(by).sort()) { const e = by[env];
    console.log('    ' + env.padEnd(11) + '│ n=' + String(e.n).padStart(4) + ' │ ' + (e.t / e.n).toFixed(2) + '/' + (e.p / e.n).toFixed(2) + '/' + (e.h / e.n).toFixed(2) +
      ' │ 师−包 ' + (mean(e.dt) >= 0 ? '+' : '') + mean(e.dt).toFixed(2) + ' ±' + ciu(e.dt).toFixed(2) + ' ‖ 头−包 ' + (mean(e.dh) >= 0 ? '+' : '') + mean(e.dh).toFixed(2) + ' ±' + ciu(e.dh).toFixed(2)); }
  console.log('  ⇒ 读法：**教师−包 明显为正** ⇒ "饿经济"写在标签里（该改的是结算/标签口径，不是这张脸）；' +
    '**教师−包 ≈0 而头−包 为正** ⇒ 是拟合把偏好推向贵卡（头自己的外推行为）；两列都要看**逐环境**那几行是否同号，平均数会把反向的两格抹平。');
  /* ===== 标签分布 vs 部署分布：**头实际生活的低 ep 区，标签里到底有没有？**（零新 rollout）
   *   为什么问这一问（10-02 上午，决定下一刀走"离线改标签"还是"自洽重标"）：§E223 的产品桌读数里
   *     部署态 `headT` 的 决策时 ep 均值 = **0.49 ‖ 0.52 ‖ 0.49 ‖ ?**（单位 = ep/12，四带同量级）而 `packT` = **1.81~1.84**，
   *     候选数 `headT` 11.5（中位 **4**）‖ `packT` 26.1（中位 23）⇒ **头是在"快没钱、菜单只剩几张"的状态里做决定**；
   *   而标签是在**现役包 trajectory** 上采的（母局由包/搜索臂打），所以标签状态的 ep 大概率是 1.8 那一侧。
   *   ⇒ 判据（**跑前写死**）：若标签里 `ep/12 ≤ 0.49` 的决策占比 **< 5%** ⇒ **训练分布压根没访问过头生活的区域**
   *     ⇒ 一切"在现有标签上再加费用下限/惩罚"的离线修法都是**惰性的**（那些状态不在数据里，改不到），
   *       只有让头自己去访问那些状态（自洽重标 = `--cont=head`）才有标签可学；
   *     若占比 **≥ 20%** ⇒ 先跑便宜的离线约束（费用下限剂量梯），不必付自洽重标的代价。
   *   ⚠ 还原式 `ep/12 = dim0 + dim2/2`（dim0 = `(ep−费用)/12` 截到 ±1，dim2 = `min(费用,6)/6`）⇒ 截平只会**低估**富的决策，
   *     不会高估穷的决策 ⇒ 上面这个判据在截平下**偏保守**（真占比只会更低），这是这一读能用的关键。 */
  const q = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
  /* ⚠ **单位自曝（本仓第 34 条同一族的第四次）**：这一档第一次写出来时我把阈值写成了 `ep/12 ≤ 0.49`，
     而 `0.49 ‖ 1.81` 那两个参照**本来就是"珠"这个原始单位**（`e223-lam-4band.log` 的"决策时 ep 均值"那一列），
     于是我把判据门槛放大了一整个 ×12 ⇒ 91.6% 那个数是**错的尺**读出来的，作废。下面统一换成"珠"。 */
  const epEst = [], rich = [];
  for (const r of R2) {
    const A = r.d.a;
    const e = A.map(x => 12 * x[MARGIN] + 6 * x[COST]);          /* ep（珠）= 12·dim0 + 6·dim2；未截平时**精确** */
    epEst.push(q(e, 0.5));
    rich.push(q(A.map(x => x[MARGIN]), 0.5) >= 0.999);           /* dim0 撞上界 ⇒ 真实 ep ≥ 12 + 费用（只低估） */
  }
  const nArr = R2.map(r => r.n);
  console.log('\n## 标签分布 vs 部署分布（**头生活的低 ep 区，标签里有没有** ‖ 还原 `ep(珠) = 12·dim0 + 6·dim2`，逐决策取候选中位）');
  console.log('  标签带 ep（珠）：p10 ' + q(epEst, 0.1).toFixed(2) + ' ‖ p25 ' + q(epEst, 0.25).toFixed(2) + ' ‖ 中位 ' + q(epEst, 0.5).toFixed(2) +
    ' ‖ p75 ' + q(epEst, 0.75).toFixed(2) + ' ‖ p90 ' + q(epEst, 0.9).toFixed(2) +
    ' ‖ **撞上界（真实值只更高）的决策 ' + (100 * mean(rich.map(x => x ? 1 : 0))).toFixed(1) + '%**（均值会被这一档抬，所以中位与占比才是主读数）');
  console.log('  ⚠ 低侧是**精确**的：判 "ep ≤ 0.49 珠" 时 `(ep−费用)/12 ∈ [−0.5, 0.05]` 远在截平范围之外 ⇒ 判据用的那一端没被仪器动过手脚；');
  console.log('     高侧撞上界 ⇒ "ep 很大"那一侧在这一台里只能当下界，不拿去定符号。');
  console.log('  占比：ep ≤ **0.49 珠**（部署态 `headT` 的均值，四带 0.49 ‖ 0.52 ‖ 0.49 ‖ 0.52）= **' + (100 * epEst.filter(x => x <= 0.49).length / epEst.length).toFixed(1) + '%**' +
    ' ‖ ≤ 1.0 珠 = ' + (100 * epEst.filter(x => x <= 1.0).length / epEst.length).toFixed(1) + '%' +
    ' ‖ ≤ **1.81 珠**（部署态 `packT` 的均值） = ' + (100 * epEst.filter(x => x <= 1.81).length / epEst.length).toFixed(1) + '%');
  console.log('  候选数：标签带 均值 ' + mean(nArr).toFixed(1) + ' ‖ 中位 ' + q(nArr, 0.5) + ' ‖ ≤4 的决策占比 ' + (100 * nArr.filter(x => x <= 4).length / nArr.length).toFixed(1) +
    '%    ← 部署参照：headT 11.5（中位 4）‖ packT 26.1（中位 23）‖ 依据 `docs/artifacts/e184-out/e223-lam-4band.log`');
  const share = 100 * epEst.filter(x => x <= 0.49).length / epEst.length;
  console.log('  ⇒ 按跑前判据（门槛 = 部署态 headT 的那一档）：这一带（' + TEST + '）低 ep 占比 ' + share.toFixed(1) + '% ⇒ **' +
    (share < 5 ? '训练分布没访问过头生活的区域 ⇒ 离线改标签那类修法判为惰性，下一刀只有自洽重标'
      : share >= 20 ? '低 ep 在标签里有的是 ⇒ "曝光偏差/分布漂移"不是病灶，先跑便宜的离线费用下限'
        : '落在 5~20% 之间 ⇒ 两边都不 decisively，先加带再看（不许当场改判据）') + '**');
}
/* ===== `--whopicks`：**"这一手该打谁"的偏好是标签带来的还是脸带来的？**（零 rollout，用的就是 dump 里的键与分）
 *   起因（03:1x）：λ=0.25 那一档在产品桌上**把防御类打到 0.0%（八带一个不剩）**、种数 11→8~10，
 *   而同幅随机方向没有这个副作用 ⇒ 如果**教师自己**在有防御可打时也几乎不挑防御，那结论就不是"这张脸不会打防御"，
 *   而是"**一手搜索的偏好天生不防御**"⇒ 下一问必须换成"改标签（多看一手 / 把跨回合可行性装进结算）"，而不是"再蒸一遍"。
 *   读法：`可打比例` = 该类别在这决策的候选表里出现过；`挑了比例` = 在该类别**可打**的决策里，这个来源挑了它的比例。
 *   ⚠ 头是**样本外**的那一枚（训在另一带、留出=这一带），与一致率那一档同源 ⇒ 三个来源看的是同一批决策。 */
if (argv.indexOf('--whopicks') >= 0) {
  const CT = loadCardTable();
  const CATS = ['energy', 'attack', 'defense', 'special'];
  const stat = {}; const availDef = { teacher: 0, pack: 0, head: 0, n: 0 };
  const defCards = {};
  let nDec = 0, nNoCat = 0;
  const headPickOf = headPickTb;
  for (const r of R2) {
    const keys = r.d.k; if (keys.length !== r.n) { console.error('⛔ dump 里键数 ' + keys.length + ' ≠ 候选数 ' + r.n); process.exit(3); }
    nDec++;
    const src = { teacher: r.teacher, pack: r.netPick, head: headPickOf(r) };
    const cats = keys.map(k => CT.catByKey[k]);
    if (cats.some(c => c === undefined)) nNoCat++;
    for (const c of CATS) {
      const s = stat[c] = stat[c] || { teacher: 0, pack: 0, head: 0, avail: 0 };
      const anyHere = cats.indexOf(c) >= 0;
      if (!anyHere) continue;
      s.avail++;
      for (const w in src) if (cats[src[w]] === c) { s[w]++; if (c === 'defense') { defCards[keys[src[w]]] = (defCards[keys[src[w]]] || 0) + 1; } }
      if (c === 'defense') for (const w in src) availDef[w]++;
    }
  }
  console.log('\n## 谁在挑哪一类（留出带 ' + nDec + ' 个决策 ‖ 头 = 训于另一带的样本外那枚 ‖ 分母 = 该类**可打**的决策数）');
  console.log('  类别        │ 可打决策数 │ 教师挑它 ‖ 现役包挑它 ‖ 蒸馏头挑它（各带 %）');
  for (const c of CATS) {
    const s = stat[c] || { avail: 0, teacher: 0, pack: 0, head: 0 };
    console.log('  ' + c.padEnd(10) + '│ ' + String(s.avail).padStart(8) + ' │ ' +
      (s.avail ? (100 * s.teacher / s.avail).toFixed(1) + '% ‖ ' + (100 * s.pack / s.avail).toFixed(1) + '% ‖ ' + (100 * s.head / s.avail).toFixed(1) + '%' : '—') +
      '   （计数 ' + s.teacher + '/' + s.pack + '/' + s.head + '）');
  }
  console.log('  ‖ 这一批决策里候选数均值 ' + mean(R2.map(r => r.n)).toFixed(1) + ' ‖ 挑到的防御卡具体是：' +
    (Object.keys(defCards).length ? Object.keys(defCards).map(k => (CT.byKey[k] || k) + ' ' + defCards[k]).join(' · ') : '（一个都没有）'));
  console.log('  ⇒ 读法：若**教师挑防御的比例本来就 ≈ 包（或更低）**，那"变窄"是**标签**带来的 ⇒ 病在一手搜索的评估口径（偏差只一手 + 延续用包），不在这张脸；');
  console.log('    若教师明显在挑而头不挑 ⇒ 才是"脸装不下"，那才轮得到"加卡身份/加交互"那条路说话。');
  /* 按教师所选类别的**错配矩阵**：头在"教师想要这一类"的那些决策上实际挑了哪一类。
     上一行只说"头挑防御 0%"，这一行要说清"那 160 个教师挑防御的决策，头拿去干了什么"。 */
  const conf = {};
  for (const r of R2) {
    const cats = r.d.k.map(k => CT.catByKey[k]);
    const tk = cats[r.teacher], hk = cats[headPickOf(r)];
    const c = conf[tk] = conf[tk] || { n: 0, same: 0, to: {} };
    c.n++; if (tk === hk) c.same++; else c.to[hk] = (c.to[hk] || 0) + 1;
  }
  console.log('\n  头在"教师想要 X"的那些决策上实际挑了什么（错配矩阵 ‖ 与上表同一批决策）');
  for (const c of CATS) {
    const x = conf[c]; if (!x) continue;
    console.log('    教师要 ' + c.padEnd(8) + '：' + String(x.n).padStart(4) + ' 个决策 ‖ 头也挑同类 **' + (100 * x.same / x.n).toFixed(1) + '%** ‖ 拿去干了 ' +
      Object.keys(x.to).sort((a, b) => x.to[b] - x.to[a]).map(k2 => k2 + ' ' + x.to[k2]).join(' · '));
  }
  if (nNoCat) console.log('  ⛔ 有 ' + nNoCat + ' 个决策的候选键在规则表里查不到类别 ⇒ 这张表不许引（别把漏数读成偏好）');
}
/* ===== §E231 `--epsens=<珠>`：**同菜单的 ep 扰动**（这一档不引入新数据，只问"这张脸的结构里有没有条件性"）=====
 *   为什么必须做：§E225 的推导说"线性头里 `ep` 是加项 ⇒ 组内相减抵消 ⇒ 它只能表达一套与珠数无关的固定排序"。
 *   这句话**可以直接用扰动验证**：把某个决策的 ep 整体抬 k 珠（`dim0` 全体同加、乘积维跟着变），
 *   ① `dim1`（可付旗标）**冻结**那一版 ⇒ 现脸的分差逐项抵消 ⇒ **改手率必须恰为 0**（判据①，不是 0 就是实现错）；
 *   ② 乘积脸那一版 ⇒ 允许改手，且方向应当是"ep 更高 ⇒ 敢挑更贵的"。
 *   ③ `dim1` **放开**那一版两枚脸都可能因为"可付集合变了"而改手 ⇒ 只作形状，不进判据。
 *   ⚠ 行为型读数（"头−包 费用差随 ep 的斜率"）**不能**当这条推导的验证：菜单内容本身就随 ep 变，那不是我预言的东西（跑前改口，见日志 §E231 判据行）。 */
const EPSENS = Number(arg('epsens', 0)) || 0;
if (EPSENS !== 0) {
  const clamp1 = v => v > 1 ? 1 : (v < -1 ? -1 : v);
  const tbPick = (r, vecs) => {
    const hs = vecs.map((v, i) => { let h = 2166136261; const t = r.d.k[i] + '|' + v.join(','); for (let q = 0; q < t.length; q++) h = Math.imul(h ^ t.charCodeAt(q), 16777619); return h >>> 0; });
    let b = 0;
    for (let i = 1; i < vecs.length; i++) { const z = pol.score(vecs[i]), zb = pol.score(vecs[b]); if (z > zb || (z === zb && hs[i] < hs[b])) b = i; }
    return b;
  };
  const mkVec = (r, i, a) => { const s = FEAT === 'a' ? new Array(r.d.s.length).fill(0) : r.d.s; return s.concat(PRODF ? a.concat([(epOf(a) * costOf(a)) / PRODF_SCALE]) : a).concat(idFeat(r.d.k[i])); };
  const stat = { frozen: { n: 0, ch: 0, up: 0, dn: 0, d: [] }, open: { n: 0, ch: 0, up: 0, dn: 0, d: [] } };
  let skipped1 = 0;
  for (const r of R2) {
    if (r.n < 2) skipped1++;                      /* 只有一个候选 ⇒ 结构上不可能改手，会稀释比率，单独计数 */
    const base = r.d.a.map((a, i) => mkVec(r, i, a));
    const p0 = tbPick(r, base);
    for (const key of ['frozen', 'open']) {
      const pert = r.d.a.map((a, i) => {
        const ep = epOf(a) + EPSENS, c = costOf(a);
        const a2 = a.slice();
        a2[ADIM_MARGIN] = clamp1((ep - c) / 12);                     /* 只有余量那一维跟着 ep 平移 */
        if (key === 'open') a2[1] = (c <= ep ? 1 : 0);               /* 放开版：可付旗标按新 ep 重算 */
        return mkVec(r, i, a2);
      });
      const p1 = tbPick(r, pert);
      const g = stat[key]; g.n++;
      const dc = costOf(r.d.a[p1]) - costOf(r.d.a[p0]); g.d.push(dc);
      if (p1 !== p0) { g.ch++; if (dc > 1e-9) g.up++; else if (dc < -1e-9) g.dn++; }
    }
  }
  const pct = x => (100 * x).toFixed(1) + '%';
  console.log('\n## §E231 同菜单 ep 扰动 `--epsens=+' + EPSENS + ' 珠`（留出带 ' + R2.length + ' 个决策 ‖ 当前脸：' + (PRODF ? '**有**乘积维 ep×费用' : '**无**乘积维（出厂 22 维动作块）') + '）');
  console.log('| 版本 | n | **改手率** | 改手里"挑得更贵" : "挑得更便宜" | 挑中费用的配对变化（珠） | 进判据 |');
  console.log('|---|---|---|---|---|---|');
  for (const key of ['frozen', 'open']) {
    const g = stat[key];
    console.log('| ' + (key === 'frozen' ? '`dim1` **冻结**（只平移 ep）' : '`dim1` 放开（可付集合跟着变）') + ' | ' + g.n + ' | **' + pct(g.ch / Math.max(1, g.n)) + '** | ' +
      g.up + ' : ' + g.dn + ' | ' + (mean(g.d) >= 0 ? '+' : '') + mean(g.d).toFixed(3) + ' ±' + (ci(g.d) / 100).toFixed(3) + ' | ' + (key === 'frozen' ? '✔' : '✘ 只作形状') + ' |');
  }
  if (skipped1) console.log('  · 跳过 ' + skipped1 + ' 个只有 1 个候选的决策（无从改手）');
  console.log('  ‖ 判据①（跑前写死）：无乘积维 + `dim1` 冻结 ⇒ 改手率**必须 = 0**（否则是我的实现错，不是结果）；乘积维同一版 >0 且"更贵:更便宜"明显偏"更贵" ⇒ 这一维真的把条件性装进了身体。');
}
/* `--dumpagree=`：逐决策落"教师那手 / 头那手 / 包那手"，**唯一用途是跨运行配对**（§E230 第二问）。
 *   为什么要它：单遍留出一致率的半宽实测 ±7.2pt（n=184）⇒ "同配置 vs 跨配置"这种 3pt 量级的差它**判不动**；
 *   但只要两次运行打的是**同一批测试决策**（同一个 `--test` 文件、同一个 `--rep` ⇒ 过滤后行集逐字相同），
 *   逐决策 0/1 就能相减配对着读，噪音只剩"头换来源"这一个自由量。
 *   ⚠ 默认关；写出去的行带身份（`cfg|seed|env|g|round` + 行序），离线 join 前**必须验证两遍身份逐字相同**。 */
if (arg('dumpagree', '')) {
  const lines = [];
  for (let i = 0; i < R2.length; i++) {
    const r = R2[i], hp = headPickTb(r);
    lines.push(JSON.stringify({ i: i, seed: r.d.seed, env: r.d.env, g: r.d.g, round: r.d.round, cfg: r.d.cfg || 'multi/5(旧 dump 无 cfg)',
      n: r.n, tied: r.tied ? 1 : 0, teacher: r.teacher, head: hp, pack: r.netPick }));
  }
  writeFileSync(arg('dumpagree', ''), lines.join('\n') + '\n');
  console.log('· §E230 逐决策落 **' + R2.length + ' 行**（教师/头/包三列下标 + 身份）→ `' + arg('dumpagree', '') + '`' +
    ' ‖ 配对读法：与另一遍**同 test 文件**的输出按身份 join，比 `head==teacher` 的 0/1');
}
/* `--export=` 把线性蒸馏头（h=0 时）导出给 `tools/probe-distill-player.mjs` 当策略用 ⇒ **一致率不是胜率**，
 * 第二步必须在产品桌上配对比。导出的是原始特征上的 β（未中心化），播放器按同一套 `featuresV7 + actionFeatures` 打分。 */
if (arg('export', '')) {
  if (HID > 0) { console.error('⛔ 只导出线性头（h=0）；MLP 头的导出还没做（本轮实测 MLP 两向都不如线性 ⇒ 没必要）'); process.exit(64); }
  if (FEAT !== 'sa') { console.error('⛔ 只导出 `--feat=sa`：`feat=a` 把状态维置零了，播放器按真状态打分 ⇒ 换了输入分布，A/B 不再单自由度'); process.exit(64); }
  if (!R1.length) { console.error('⛔ 训练带一个决策都没有 ⇒ 没有 β 可导'); process.exit(64); }
  const dimS = R1[0].d.s.length, dimA = R1[0].d.a[0].length, p = dimS + dimA + PRODF + IDN;
  const betaArr = []; for (let i = 0; i < p; i++) betaArr.push(pol.beta[i]);
  if (betaArr.length !== p) { console.error('⛔ β 长度 ' + betaArr.length + ' ≠ 布局 dimS+dimA+prodfeat+id = ' + p + ' ⇒ 导出的头无法被重建'); process.exit(9); }
  writeFileSync(arg('export', ''), JSON.stringify({ feat: FEAT, rep: REP, l2: L2, epochs: EPOCHS, lr: LR, dimS: dimS, dimA: dimA, dimId: IDN, plusid: PLUSID, teacherFloor: FLOOR,
    prodfeat: PRODF, prodScale: PRODF_SCALE,
    /* §E230：头必须自带"它是谁的标签蒸出来的"⇒ 播放器与后续任何跨配置对照都靠这两个戳筛，不靠文件名。 */
    trainCfg: KEY(TRAIN_CFG), testCfg: KEY(TEST_CFG), beta: betaArr,
    train: TRAIN, test: TEST, trainSeed: TRAIN_ROWS[0].seed, testSeed: TEST_ROWS[0].seed, nTrain: R1.length, nTest: R2.length,
    heldoutAgree: 100 * mean(last.aPol), packAgree: 100 * mean(last.aPack), ceiling: 100 * mean(agree(NT, teacherSelf)), tierN: NT.length }) + '\n');
  console.log('· 已导出线性蒸馏头 → `' + arg('export', '') + '`（' + p + ' 维 β ‖ **无并列档**留出一致率 ' + (100 * mean(last.aPol)).toFixed(1) + '% vs 现役包 ' +
    (100 * mean(last.aPack)).toFixed(1) + '% ‖ 天花板 ' + (100 * mean(agree(NT, teacherSelf))).toFixed(1) + '% ‖ n=' + NT.length + '）');
}
