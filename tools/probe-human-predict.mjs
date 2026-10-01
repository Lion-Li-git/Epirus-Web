/* §E207 · 真人有多可预测？（回答 §E191 挂到现在的那一格）
 *
 * 为什么要这一格：Route B（信念搜索）今晚被量成"**大半是在吃对手的确定性**"—— 把对手脚本随机化到 80%，
 *   +29~35pt 的夺冠优势清零（§E191 剂量曲线）。那么"线上该不该默认开档"就不是难度题，而是
 *   **"真人到底比脚本/冠军可预测多少"** —— 这项目前本仓没人量过，因为没有真人样本。用户 10-01 上午补了 12 局。
 *
 * 口径（一次只动一个自由度： subject 换人/换 AI，其余算法全同）：
 *   · 数据 = `tools/parse-battle-log.mjs --jsonl=`（**解析只有那一份**，本文件不抄第二个 log parser）
 *   · **两遍标签**：`card` = 这一手打哪张卡（词表约 30）‖ `target` = 这一手打谁（词表约 6）。
 *     信念模型的作用面是"打谁" ⇒ 只测 card 会把"读不到"误报成"没人读对手"。
 *   · 条件特征 = 只从日志直读得到的东西，两遍同一套（一次只换标签这一个自由度）：
 *       `own`  = 自己上一手的卡 / 上一手打的人   `hit` = 上一回合**我被打了几次**（0~3+）
 *       `oh`   = own ⊕ hit                      `oth` = 各席上一手卡名的**多重集**（不区分谁）
 *       `alive`= 存活席数                       `oa`/`oal`/`all` = own ⊕ 其余
 *   · 指标 = **交叉熵**（bit/决策，add-k 平滑）与 **top-1 命中率**；比"无上下文基线"低多少 ⇒ ΔH
 *   · ⭐ 最后那张**增量表**才是要引的数：ΔCE = CE(`own`) − CE(`own⊕X`)（逐局配对）
 *     —— 单看 ΔH(X) 会把 own 的功劳记给 X（`oh` 的 ΔH 0.319 就是 `own` 的 0.376 换了个包装）。
 *   · **留一局做 held-out**（每折训练其余局、测那一局）⇒ 不是"在同一批数上拟合又同一批数上报数"
 *   · **置换对照**：把 subject 的条件特征序列整体打乱（保留边缘分布、切断上下文↔标签的链接）⇒ ΔH 必须塌到 ≈0
 *     否则这条尺在量"平滑本身"而不是"可预测性"（§E198 的教训：对照是要减掉的基线）
 *   · 区间 = **按局聚类 bootstrap**（1000 次，**定种子**，§E160 那条"自助要播种"）
 *
 * ⚠ 四条限制，引的时候必须一起给：
 *   ① 日志里读不到"当回合买得起什么" ⇒ 菜单没进条件集 ⇒ 这里的 ΔH 是**上界意义上的可预测性**
 *      （§E189 量过：人类那份"读"里约 14~15% 其实是菜单变化。同一族病，AI 侧也一样，且 AI 菜单更稳定 ⇒ **对 AI 更有利**）。
 *   ② 真人只有 1 个人、120 个决策 ⇒ 单批什么都可能不显著；结论看"两侧同不同向"，不看单点。
 *   ③ 4 个 AI 席共用同一只冠军包（`js/bundled-champion-3p.js`）⇒ "AI 可预测"里含"同一策略"这一层，
 *      不是"同一个随机种子的复现"。真人对手是 1 个人 ⇒ 两边本来就不是同一个东西，这条比的是"**被学到的程度**"。
 *   ④ 样本量本身是只看不见的分母（AI 666 条 ‖ 真人 120 条 ⇒ 数据多的一侧任何模型都更像被学到）
 *      ⇒ 所以除了"全量 AI"那栏，还**再印一栏把 AI 抽到与真人同量**（按局分层、定种子）。两栏同向才算立住。
 *
 * 用法：node tools/probe-human-predict.mjs [--jsonl=docs/artifacts/e184-out/human-decisions-2026-10-01.jsonl] [--perm=N] [--boot=N]
 */
import { readFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['jsonl', 'perm', 'boot'], 'probe-human-predict');
const flag = (k, d) => { const i = argv.findIndex(a => a === '--' + k || a.startsWith('--' + k + '=')); return i < 0 ? d : argv[i].split('=')[1]; };
const FILE = String(flag('jsonl', 'docs/artifacts/e184-out/human-decisions-2026-10-01.jsonl'));
const NPERM = Math.max(0, Number(flag('perm', 1)) || 0);
const NBOOT = Math.max(0, Number(flag('boot', 400)) || 0);

const rows = readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
const GAMES = [...new Set(rows.map(r => r.game))].sort((a, b) => a - b);
console.log('# §E207 真人 vs 冠军：谁更可被学到（`' + FILE.split('/').pop() + '` ‖ ' + rows.length + ' 条决策 ‖ ' + GAMES.length + ' 局）');
const byMode = {}; for (const r of rows) byMode[r.mode] = (byMode[r.mode] || 0) + (r.isHuman ? 1 : 0);
console.log('# 真人决策按模式：' + Object.entries(byMode).map(([k, v]) => k + '=' + v).join(' ‖ ')
  + ' ⇒ **长程(5血) 是您自己调的规则档**，与多人不同分布 ⇒ 下面分开算');

/* ---- 条件特征 ---- */
/* `oth` 是"四席上一手的多重集"（约 30 种取值）⇒ 在 n=120 上**绝大多数桶观测数 < 3 ⇒ 退回边缘**，
 *   一退回就带噪声 ⇒ 它的"未检出"里有一半是**分辨率不够**不是"人不受对手影响"。
 *   补两条**低维**的信念相关特征：`hit` = 上一回合我被打了几次（0~3+，4 个桶）、`oh` = own ⊕ hit。
 *   `hit` 需要"谁打了谁"，日志里每条决策自带 `target` ⇒ 从**上一回合**那批行里数。 */
const BYGR = new Map();                                    /* game → round → rows */
for (const r of rows) { const g = BYGR.get(r.game) || new Map(); BYGR.set(r.game, g); const a = g.get(r.round) || []; g.set(r.round, a); a.push(r); }
for (const r of rows) {
  const g = BYGR.get(r.game), pr = g.get(r.round - 1) || [];
  r.hitMe = Math.min(3, pr.filter(x => x.target === r.seat).length);
  const self = pr.find(x => x.seat === r.seat);
  r.prevTgt = self ? (self.target === null ? 'none' : self.target) : '-';   /* 目标那一遍的 `own` 用它 */
}
const othKey = r => Object.values(r.prevOthers).slice().sort().join(',');
let OWNKEY = 'prev';
const FEATS = {
  own: r => r[OWNKEY],
  oth: r => othKey(r),
  alive: r => 'a' + r.alive,
  hit: r => 'h' + r.hitMe,
  oh: r => r[OWNKEY] + '|h' + r.hitMe,
  oa: r => r[OWNKEY] + '|' + othKey(r),
  oal: r => r[OWNKEY] + '|a' + r.alive,
  all: r => r[OWNKEY] + '|' + othKey(r) + '|a' + r.alive,
};
const K = 0.35;                                             /* add-K 平滑（K<1 ⇒ 少量平滑，主要靠数据） */
/* 词表 = 这一遍标签的全集（"打哪张卡"约 30 项 / "打谁"约 6 项）。两边共用同一张表 ⇒ 公平。
 *   不这么做的话，"测试局出现、训练局没出现"的取值要拍一个任意地板概率，CE 就随词表大小漂。 */
let VOCAB = [];
function fitModel(sub, feat) {
  const marg = {}, cond = {};
  for (const a of VOCAB) marg[a] = 0;
  for (const r of sub) { marg[r.skill]++; const k = feat(r); const c = cond[k] = cond[k] || {}; c[r.skill] = (c[r.skill] || 0) + 1; }
  const V = VOCAB.length, tot = sub.length || 1;
  /* 平滑式：p(a) = (c + K·p0(a)) / (n + K)，p0 = 全局边缘 ⇒ 少观测的桶自动退回边缘，不会 log(0) */
  const p0 = {}; for (const a of VOCAB) p0[a] = (marg[a] + 1) / (tot + V);
  const PM = {}; for (const a of VOCAB) PM[a] = (marg[a] + K * p0[a]) / (tot + K);
  const tC = {};
  for (const k in cond) {
    const n2 = Object.values(cond[k]).reduce((x, y) => x + y, 0);
    const pk = {}; for (const a of VOCAB) pk[a] = ((cond[k][a] || 0) + K * p0[a]) / (n2 + K);
    tC[k] = { pk, n2 };
  }
  return { PM, p0, tC, tot: sub.length, V, feat, nused: 0, ntot: 0 };
}
function score(model, r) {
  const k = model.feat(r), c = model.tC[k];
  const seen = c && c.n2 >= 3;                             /* 少于 3 次观测 ⇒ 退到无上下文模型（避免条件熵假性下降） */
  model.nused += seen ? 1 : 0; model.ntot++;
  const p = seen ? c.pk[r.skill] : model.PM[r.skill];
  return -Math.log2(Math.max(p, 1e-6));
}
function top1(model, r) {
  const k = model.feat(r), c = model.tC[k];
  let best = null, bv = -1;
  const src = (c && c.n2 >= 3) ? c.pk : model.PM;
  for (const a in src) if (src[a] > bv) { bv = src[a]; best = a; }
  return best === r.skill ? 1 : 0;
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mean = x => x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN;
const sd = x => { if (x.length < 2) return NaN; const m = mean(x); return Math.sqrt(x.reduce((p, q) => p + (q - m) * (q - m), 0) / (x.length - 1)); };

/* 留一局：每折训练其余局、测那一局；按局聚合 ⇒ 再对局取均值（配对）
 *   训练折下限**自适应**：固定 40 会让"长程 · 真人"（40 条 / 3 局）每折都 30<40 被跳光 ⇒ 印 0 局。 */
function loo(subject, featName, permSeed) {
  const feat = FEATS[featName];
  const minTr = Math.max(12, Math.floor(0.6 * subject.length));
  const perGame = [], perGameHit = [], used = [];
  for (const g of GAMES) {
    const tr = subject.filter(r => r.game !== g), te = subject.filter(r => r.game === g);
    if (!te.length || tr.length < minTr) continue;
    let tr2 = tr;
    if (permSeed) {                                           /* 置换对照：打乱训练折的"标签↔上下文"配对（同一批标签、同一批上下文） */
      const rnd = mulberry32(permSeed * 7919 + g);
      const sk = tr.map(r => r.skill);
      for (let i = sk.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = sk[i]; sk[i] = sk[j]; sk[j] = t; }
      tr2 = tr.map((r, i) => Object.assign({}, r, { skill: sk[i] }));
    }
    const m = fitModel(tr2, feat);
    perGame.push(mean(te.map(r => score(m, r)))); perGameHit.push(mean(te.map(r => top1(m, r))));
    used.push(m.nused / Math.max(1, m.ntot));
  }
  return { ce: mean(perGame), se: 1.96 * sd(perGame) / Math.sqrt(perGame.length), hit: 100 * mean(perGameHit), ng: perGame.length, pts: perGame, use: 100 * mean(used) };
}

function report(label, subject0, subN) {
  /* 数据量配对：`subN` 把 subject 抽到 N 条（按局分层、定种子）。
   *   为什么必须能抽：AI 侧 666 条 vs 真人 120 条 ⇒ 直接比"谁的 CE 更低"里含一只**看不见的分母 = 样本量**
   *   （样本多 ⇒ 任何模型都更像被学到）。要证"AI 更可预测"，得先把两边拉到同一条数上。 */
  let subject = subject0;
  const SUB = Math.max(0, Number(subN) || 0);
  if (SUB && subject.length > SUB) {
    const rnd = mulberry32(20261001);
    const byG = {}; for (const r of subject) (byG[r.game] = byG[r.game] || []).push(r);
    const gs = Object.keys(byG).sort((a, b) => a - b), per = Math.max(1, Math.floor(SUB / gs.length));
    subject = [];
    for (const g of gs) { const a = byG[g].slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } subject.push(...a.slice(0, per)); }
  }
  const minTr = Math.max(12, Math.floor(0.6 * subject.length));
  /* 无上下文基线 = 只用全局边缘。与 `loo` 走**同一套 skip 规则** ⇒ 两两按局对齐 ⇒ ΔH 可以做**配对**差
   *（配对 SE 才是这条要引的数；把两个独立 SE 平方相加会把"同一批局"的共同变异当成噪声，§E160 族）。*/
  const margOnly = [];
  for (const g of GAMES) {
    const tr = subject.filter(r => r.game !== g), te = subject.filter(r => r.game === g);
    if (!te.length || tr.length < minTr) continue;
    const m = fitModel(tr, () => '__one__');
    margOnly.push(mean(te.map(r => -Math.log2(Math.max(m.PM[r.skill], 1e-6)))));
  }
  const rows2 = [];
  for (const f of ['own', 'hit', 'oh', 'oth', 'oa', 'alive', 'oal', 'all']) rows2.push([f, loo(subject, f, 0)]);
  const get = f => rows2.find(x => x[0] === f)[1];
  const b0 = rows2[0][1];
  if (b0.ng < 2) { console.log('\n· **' + label + '**（n=' + subject.length + ' 个决策）⇒ ⚠ held-out 局数 = ' + b0.ng + '（<2）⇒ **这一遍不报数**，连方向都不给。'); return null; }
  console.log('\n· **' + label + '**（n=' + subject.length + ' 个决策' + (SUB && subject.length < subject0.length ? ' ‖ 抽样自 ' + subject0.length : '') + ' ‖ ' + b0.ng + ' 局 held-out ‖ 无上下文基线 ' + mean(margOnly).toFixed(3) + ' ±' + (1.96 * sd(margOnly) / Math.sqrt(margOnly.length)).toFixed(3) + ' bit）');
  if (b0.ng < 4) console.log('  ‖ ⚠ held-out 只有 ' + b0.ng + ' 局 ⇒ 下面所有 ± 都是"两三个点的样本标准差"，**只能当方向、不可当显著性**。');
  /* ⚠ §E205 的教训：两行**逐位相同**就不是两条独立读数，是恒等（这里多半是"条件桶几乎全数退回边缘"）
   *    ⇒ 必须自己印出来，不能让读表的人把"两栏都写 0.055"看成两次确认。 */
  const dup = [];
  for (let i = 0; i < rows2.length; i++) for (let j = i + 1; j < rows2.length; j++) {
    const a = rows2[i][1].pts, b = rows2[j][1].pts;
    if (a.length === b.length && a.every((v, k) => v === b[k])) dup.push('`' + rows2[i][0] + '` ≡ `' + rows2[j][0] + '`');
  }
  if (dup.length) console.log('  ‖ ⚠ **恒等对**（两栏不是两次独立读数）：' + dup.join(' ‖ ') + ' ⇒ 这些条件下**桶几乎全数退回边缘**（分辨率不足，不是"证实了两遍"）');
  console.log('  | 条件特征 | 交叉熵 (bit/决策) | ΔH = 基线 − 它（**按局配对**） | top-1 命中 | 条件**真被用上**的比例 |');
  const rp = subject.filter(r => r[OWNKEY] !== '-');
  console.log('  ‖ 可直接解释的一个数：**重复上一手' + (OWNKEY === 'prev' ? '的卡' : '打同一个目标') + '率 = ' + (100 * mean(rp.map(r => r.skill === r[OWNKEY] ? 1 : 0))).toFixed(1) + '%**（分母 = 有上一手可比的 ' + rp.length + ' 条；首回合 ' + (subject.length - rp.length) + ' 条剔除）');
  const dH = {};
  for (const [f, s] of rows2) {
    const d = margOnly.map((v, i) => v - s.pts[i]);
    dH[f] = { m: mean(d), ci: 1.96 * sd(d) / Math.sqrt(d.length) };
    console.log('  | `' + f + '` | ' + s.ce.toFixed(3) + ' ±' + s.se.toFixed(3) + ' | **' + dH[f].m.toFixed(3) + ' ±' + dH[f].ci.toFixed(3) + '**'
      + (Math.abs(dH[f].m) <= dH[f].ci ? '（未超 0）' : dH[f].m > 0 ? '（显著 > 0）' : '（显著 < 0：加了反而更差）') + ' | ' + s.hit.toFixed(1) + '% | ' + s.use.toFixed(0) + '%'
      + (s.use < 30 && f !== 'own' ? ' ⚠**量程不足**' : '') + ' |');
  }
  /* ⭐ 增量表：`own`（自己上一手）已经吃掉大部分可预测性 ⇒ 单看 ΔH(X) 会把"own 的功劳"记给 X。
   *   真正要问的是"**已知自己上一手之后，X 还能再多学掉多少熵**"= CE(own) − CE(own⊕X)，逐局配对。
   *   对照 = 同一套差、但两边都用"打乱标签↔上下文配对"后的模型 ⇒ 差里不含真链接（§E179 增量探针同族）。*/
  console.log('  | `own` 之外的**增量** ΔCE（bit/决策，逐局配对） | 值 | 对照差（只作参考，不作判据） | 判 |');
  const seeds = []; for (let i = 1; i <= Math.max(1, NPERM); i++) seeds.push(1000 + i);
  const pl = f => seeds.map(sd => loo(subject, f, sd));
  const ownP = pl('own');
  for (const [x, combo] of [['hit', 'oh'], ['oth', 'oa'], ['alive', 'oal']]) {
    const o = get('own'), c = get(combo);
    const d = o.pts.map((v, i) => v - c.pts[i]);
    const dm = mean(d), dci = 1.96 * sd(d) / Math.sqrt(d.length);
    const cp = pl(combo);
    const net = d.map((v, i) => v - (mean(ownP.map(p => p.pts[i])) - mean(cp.map(p => p.pts[i]))));
    const nm = mean(net), nci = 1.96 * sd(net) / Math.sqrt(net.length);
    /* ⚠ 判据只认"值 vs 它自己的配对 CI"。"对照差"那列**不作判据**：n 局配对下 `net` 的方差是"两次同批局之差的差"，
     *    局数一少（<4）它能印出 ±0.009 这种不可能的窄区间 —— 拿它当显著性会造出假阳性（正是 §E200/§E203 那一族）。*/
    const verdict = o.ng < 4 ? 'held-out 仅 ' + o.ng + ' 局 ⇒ **不判定**'
      : (dm > dci ? '增量显著 > 0 ✔（真值超过自身 95% 区间）' : '未超 ⇒ **X 在 own 之外无可检出的额外可预测性**（未检出 ≠ 无）');
    console.log('  | `' + x + '` → `' + combo + '` | **' + dm.toFixed(3) + ' ±' + dci.toFixed(3) + '** | ' + nm.toFixed(3) + ' ±' + nci.toFixed(3) + ' | ' + verdict + ' |');
  }
  if (NPERM) {
    for (const f of ['hit', 'oh', 'oth', 'oa', 'alive', 'oal', 'all']) {
      const pr = []; for (let i = 1; i <= NPERM; i++) pr.push(loo(subject, f, 1000 + i));
      const dc = margOnly.map((v, i) => v - mean(pr.map(p => p.pts[i])));   /* ΔH_控制：逐局配对，NPERM 次置换先逐局平均 */
      const cm = mean(dc), cci = 1.96 * sd(dc) / Math.sqrt(dc.length);
      const r2f = rows2.find(x => x[0] === f)[1];
      const d = margOnly.map((v, i) => v - r2f.pts[i]);
      let bsMsg = '';
      if (NBOOT) {
        const rnd = mulberry32(20261001);                       /* 自助要播种（§E160） */
        const bsv = [];
        for (let b = 0; b < NBOOT; b++) { let s0 = 0; for (let i = 0; i < d.length; i++) s0 += d[Math.floor(rnd() * d.length)]; bsv.push(s0 / d.length); }
        bsv.sort((x, y) => x - y);
        const lo = bsv[Math.floor(0.025 * NBOOT)], hi = bsv[Math.floor(0.975 * NBOOT)];
        bsMsg = ' ‖ bootstrap(按局聚类, ' + NBOOT + ' 次, 定种子) 95% = ' + lo.toFixed(3) + ' ~ ' + hi.toFixed(3)
          + (lo > 0 ? '（不跨 0）' : hi < 0 ? '（整段 < 0）' : '（跨 0 ⇒ 不显著）');
      }
      console.log('  ‖ 置换对照 `' + f + '`：ΔH_控制 = ' + cm.toFixed(3) + ' ±' + cci.toFixed(3)
        + (cm > cci ? ' ⇒ ⚠ **对照自己显著 > 0 ⇒ 这条尺在量平滑/泄漏，本遍作废**' : '（未超 0 ⇒ 尺没弯）')
        + ' ‖ 真值 = ' + dH[f].m.toFixed(3) + ' ±' + dH[f].ci.toFixed(3)
        + (dH[f].m > dH[f].ci ? ' ⇒ **显著 > 0 且对照不 > 0 ⇒ 立住** ✔' : ' ⇒ 未超 0 ⇒ **"该上下文可被学到"= 未检出**（⚠ 未检出 ≠ 无，n 太小）') + bsMsg);
    }
  }
  return { ce0: mean(margOnly), rows2, dH };
}
/* 两遍标签：`card` = 打哪张卡（约 30 项）‖ `target` = 打谁（约 6 项）。
 *   为什么必须两遍都跑：信念模型的**作用面是"打谁"**，不是"手里剩哪张" ⇒ 只跑 card 会把"读不到东西"
 *   误报成"没人读对手"。两遍用**同一套条件特征与同一个算法**，只换标签（一次一个自由度）。*/
function run(tag, ownKey, labelOf) {
  OWNKEY = ownKey;
  const sub = rows.map(r => Object.assign({}, r, { skill: labelOf(r) }));
  VOCAB = [...new Set(sub.map(r => r.skill))].sort();
  console.log('\n\n════ 标签 = **' + tag + '**（词表 ' + VOCAB.length + ' 项）════');
  const NH = sub.filter(r => r.isHuman).length;
  report('真人（座位 1）', sub.filter(r => r.isHuman));
  report('冠军 AI（座位 2~5 合并）', sub.filter(r => !r.isHuman));
  report('冠军 AI · **数据量抽到与真人相同**（n=' + NH + '，按局分层、定种子）', sub.filter(r => !r.isHuman), NH);
  for (const m of [...new Set(sub.map(r => r.mode))]) {
    report('仅模式=' + m + ' · 真人', sub.filter(r => r.isHuman && r.mode === m));
    report('仅模式=' + m + ' · 冠军 AI', sub.filter(r => !r.isHuman && r.mode === m));
  }
}
run('打哪张卡（card）', 'prev', r => r.skill);
run('打谁（target）', 'prevTgt', r => (r.target === null ? 'none' : r.target));

console.log('\n⚠ 四条限制（正文里已写，这里再印一遍防走眼）：① 菜单（当回合买得起什么）不在条件集里 ⇒ 两侧都被低估、**且 AI 被低估得更少**（它的菜单更稳定）；'
  + '② 真人 = 1 个人 × ' + rows.filter(r => r.isHuman).length + ' 个决策 ⇒ 单点都别引，只引方向；③ AI 四席共用同一只冠军包 ⇒ "AI 可预测"含"同一策略"，比的是**被学到的程度**，不是同一随机流的复现；'
  + '④ 样本量是看不见的分母（AI 全量 ' + rows.filter(r => !r.isHuman).length + ' ‖ 真人 ' + rows.filter(r => r.isHuman).length + '）⇒ 只引"抽到同量"那一栏与全量栏**同向**的结论。');
console.log('· 读法：`own` 那一行的 ΔH 若远大于 `hit`/`oth` ⇒ 被学到的东西主要是"**要不要重打上一手**"（手牌还在 ⇒ 近乎恒等）；'
  + '**要看的是最后一张"增量表"**：`own⊕X` 相对 `own` 的 ΔCE 才是"X 在 own 之外还多给了多少"，而 `hit`/`oth` 正是 Route B 依赖的那两维。');
console.log('· ⭐ 最后一列"**条件真被用上**"= 测试决策里，训练折中同一条件桶被观测 ≥3 次的比例 ⇒ 这是这条尺的**量程**。'
  + '它低（<30%）时"ΔH 未超 0"**只能读成"没测到"**，不能读成"没有"：模型对大多数决策根本没敢用条件，退回的是边缘分布本身（§E184 那条"多样性只到量程 ~15%"是同一族读数）。');
console.log('rc=0');
