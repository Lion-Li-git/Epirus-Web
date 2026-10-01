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

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['train', 'test', 'rep', 'l2', 'h', 'feat', 'epochs', 'lr', 'export', 'byenv', 'quiet'], 'probe-distill-learnability');
const arg = (k, d) => { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : (argv[i].split('=')[1] ?? d); };
const TRAIN = arg('train', ''), TEST = arg('test', '');
if (!TRAIN || !TEST) { console.error('⛔ 必须同时给 --train= 与 --test=（留出检验没有"同一批"这个选项）'); process.exit(64); }
const REP = Math.max(2, Number(arg('rep', 16)) || 16);
const L2 = Number(arg('l2', 1e-3));
const HID = Math.max(0, Number(arg('h', 16)) || 0);
const EPOCHS = Math.max(1, Number(arg('epochs', 240)) || 240);
const LR = Number(arg('lr', 0.5));
const FEAT = arg('feat', 'sa');            // 'sa' = 状态⊕动作 ‖ 'a' = 只看动作（诊断："条件性"到底在不在状态里）
const QUIET = argv.indexOf('--quiet') >= 0;

const load = p => readFileSync(p, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const TRAIN_ROWS = load(TRAIN), TEST_ROWS = load(TEST);
const mean = x => x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) * (b - m), 0) / (x.length - 1)); };
const ci = x => 1.96 * sd(x) / Math.sqrt(Math.max(1, x.length)) * 100;

/* ---------- 教师标签（含并列的处理：并列 = 这格不判，印比例） ---------- */
function prep(rows) {
  const out = []; let tiedDec = 0, shortRep = 0;
  for (const d of rows) {
    if (!d.w || d.w.length < 2) continue;
    if (d.w[0].length < REP) { shortRep++; continue; }
    const v = d.w.map(a => mean(a.slice(0, REP))), h = d.hp.map(a => mean(a.slice(0, REP)));
    const half1 = d.w.map(a => mean(a.slice(0, REP >> 1))), half2 = d.w.map(a => mean(a.slice(REP >> 1, REP)));
    /* ⚠ 并列必须用**与候选顺序无关**的破平（§E215 §4 那条课的第三次应验：`rep` 越小并列越多，
       若"先出现者胜"，教师与天花板都会偏向网络排名第 1 ⇒ 我会把自己骗成"标签有分辨率"）。 */
    const salt = ((d.g + 1) * 2654435761 ^ (d.n + 1) * 40503 ^ String(d.env).length * 22465903) >>> 0;
    const tk = i => ((salt ^ Math.imul(i + 1, 2654435761)) >>> 0);
    const cmpArr = (V, H) => (i, j) => (V[i] > V[j]) || (V[i] === V[j] && (H[i] > H[j] || (H[i] === H[j] && tk(i) < tk(j))));
    const argmax = (V, H) => { const less = cmpArr(V, H); let b = 0; for (let i = 1; i < V.length; i++) if (less(i, b)) b = i; return b; };
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
const DIMS = TRAIN_ROWS.length ? TRAIN_ROWS[0].s.length + TRAIN_ROWS[0].a[0].length : 0;
function feats(row) {
  const s = FEAT === 'a' ? new Array(TRAIN_ROWS[0].s.length).fill(0) : row.d.s;
  return row.d.a.map(a => s.concat(a));
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
  const p = rows[0].d.a[0].length + (FEAT === 'a' ? 0 : rows[0].d.s.length);
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
console.log('# 训练带 ' + R1.length + ' 个决策（并列 ' + P1.tiedDec + '） ‖ 留出带 ' + R2.length + ' 个决策（并列 ' + P2.tiedDec + ' ‖ 流数不足 ' + P2.shortRep + '）' +
  ' ‖ 候选数均值 ' + mean(R2.map(r => r.n)).toFixed(1) + ' ‖ 特征 ' + FEAT + ' ‖ rep=' + REP + ' ‖ 隐藏元 ' + HID);
/* ⚠ 两带必须真的不同（§E205 那次"同文件当 train+test"的教训）*/
if (TRAIN_ROWS[0].seed === TEST_ROWS[0].seed) { console.log('⛔ 两遍 dump 的 seed 相同 ⇒ 这不是留出，判据作废'); process.exit(7); }

const netPick = r => r.netPick, teacherSelf = r => r.tA;
const ridgeH = ridge(R1, L2);
const ridgePick = r => { const F = feats(r); let b = 0, bv = -Infinity; for (let i = 0; i < r.n; i++) { let z = ridgeH.ybar; for (let j = 0; j < ridgeH.w.length; j++) z += ridgeH.w[j] * (F[i][j] - ridgeH.mu[j]); if (z > bv) { bv = z; b = i; } } return b; };
const pol = trainPolicy(R1, HID);
const polPick = r => { const F = feats(r); let b = 0, bv = -Infinity; for (let i = 0; i < r.n; i++) { const z = pol.score(F[i]); if (z > bv) { bv = z; b = i; } } return b; };
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
/* `--export=` 把线性蒸馏头（h=0 时）导出给 `tools/probe-distill-player.mjs` 当策略用 ⇒ **一致率不是胜率**，
 * 第二步必须在产品桌上配对比。导出的是原始特征上的 β（未中心化），播放器按同一套 `featuresV7 + actionFeatures` 打分。 */
if (arg('export', '')) {
  if (HID > 0) { console.error('⛔ 只导出线性头（h=0）；MLP 头的导出还没做（本轮实测 MLP 两向都不如线性 ⇒ 没必要）'); process.exit(64); }
  if (FEAT !== 'sa') { console.error('⛔ 只导出 `--feat=sa`：`feat=a` 把状态维置零了，播放器按真状态打分 ⇒ 换了输入分布，A/B 不再单自由度'); process.exit(64); }
  if (!R1.length) { console.error('⛔ 训练带一个决策都没有 ⇒ 没有 β 可导'); process.exit(64); }
  const dimS = R1[0].d.s.length, dimA = R1[0].d.a[0].length, p = dimS + dimA;
  const betaArr = []; for (let i = 0; i < p; i++) betaArr.push(pol.beta[i]);
  writeFileSync(arg('export', ''), JSON.stringify({ feat: FEAT, rep: REP, l2: L2, epochs: EPOCHS, lr: LR, dimS: dimS, dimA: dimA, beta: betaArr,
    train: TRAIN, test: TEST, trainSeed: TRAIN_ROWS[0].seed, testSeed: TEST_ROWS[0].seed, nTrain: R1.length, nTest: R2.length,
    heldoutAgree: 100 * mean(last.aPol), packAgree: 100 * mean(last.aPack), ceiling: 100 * mean(agree(NT, teacherSelf)), tierN: NT.length }) + '\n');
  console.log('· 已导出线性蒸馏头 → `' + arg('export', '') + '`（' + p + ' 维 β ‖ **无并列档**留出一致率 ' + (100 * mean(last.aPol)).toFixed(1) + '% vs 现役包 ' +
    (100 * mean(last.aPack)).toFixed(1) + '% ‖ 天花板 ' + (100 * mean(agree(NT, teacherSelf))).toFixed(1) + '% ‖ n=' + NT.length + '）');
}
