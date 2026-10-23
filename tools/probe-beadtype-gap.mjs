#!/usr/bin/env node
/* ===== 爆珠通道的**分差尺**（§E703 · 千问 10-23 夜 · 研究分支）=====
 * 动因（§E701 实测逼出来的问题）：`probe-fire-weak-frequency.mjs --cell=guard` 数出
 *   **激光眼在五个臂 × 剂量里全是 `0/0/0`**，而同一行的"珠持有"列是 **电珠 4.0%~4.6% ‖ 爆珠 0/135,262 决策点**
 *   ⇒ 那张牌**从没进过合法表**（缺爆珠时 `computeCost.ok=false`，`state.js:150-153` ⇒ `play.js:16-23` 直接 `continue`）。
 * ⇒ 于是"激光眼破盾"这一格的分母不是"罕见"而是**结构零**，且病因在**蓄能选哪种珠**那一步（`policy.js:666-668` 明明给了两个候选）。
 * 本尺回答的是**下一问**（它决定要不要为这一格做任何事）：**差一点点，还是差很远？**
 *
 * 量法：只在"蓄能可负担"的决策点上，把那**两个候选**单独喂给真打分路径 `EpirusPolicy.forwardCands`（temp 与对局同档），
 *   于是 `p_boom` 就是"这一格里爆珠相对电珠的胜率"，而分差可由 log-odds 反推：`s_elec − s_boom = temp · ln(p_elec/p_boom)`。
 *   ⚠ 不另写一份 softmax，也不自己算网络 ⇒ **吃的就是产品那条打分路径**（这一条如果接错，读数会恒 0.5 或恒 0，正对照会立刻抓到）。
 *
 * 三条自证（缺一条这台尺就没有判语权）：
 *   `Z` 全零权重 ⇒ 两候选的特征只差那两维指示位 ⇒ `p_boom` 必须 = 0.5（证明"我测到的差确实来自权重"，不是来自候选构造）；
 *   `M` 掩掉 bead 块（`setFeatMask`）⇒ 两个候选的 `actionFeatures` 必须**逐位相同**且 `p_boom` 必须 = 0.5（证明那一维是**唯一**差别）；
 *   `B` 与 §E701 咬合 ⇒ 真 chooser 交出的 `bead==='boom'` 次数单独印出来（若非 0，说明"爆珠 0/135,262"那行是尺子错）。
 *
 * 用法：node tools/probe-beadtype-gap.mjs [--games=300] [--n=5] [--arm=champ|mix|kit] [--seed=77000] [--temp=0.15] [--pack=<路径>] [--quiet]
 *   `--pack=` 是 §E703b 补的**跨包把手**：§E703 那句"权重级压倒"只在一枚包上量过 ⇒ 要分清它是"这枚包的习惯"还是"训练过程的整体性质"，
 *   必须**在第二枚、第三枚包上复现**（记忆里那条"写推荐语前先在第二个对象上复现"）。缺文件 ⇒ 响亮 `exit 2`，不许静默回落到默认包。
 *   ⚑ 默认档（不带 `--pack`）输出与 §E703 落盘时逐字相同 ⇒ 在册数字仍可 `diff` 复算。
 * 只读：不落任何文件；不动 `js/**`（`setFeatMask` 只在**自己 boot 的沙箱**里调，出厂面一行不碰）。 */
import { existsSync } from 'node:fs';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['games', 'n', 'arm', 'seed', 'temp', 'quiet', 'pack'], 'probe-beadtype-gap');
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 300)), N = Number(arg('n', 5)), SEED0 = Number(arg('seed', 77000));
const ARM = arg('arm', 'champ');
const TEMP = Number(arg('temp', 0.15));
const PACK = arg('pack', 'js/bundled-champion-3p.js');
const QUIET = argv.includes('--quiet');
if (!(GAMES >= 20 && GAMES <= 5000)) { console.error('⛔ --games 要在 20~5000（实测 ' + GAMES + '）'); process.exit(2); }
if (['kit', 'champ', 'mix'].indexOf(ARM) < 0) { console.error('⛔ --arm 只认 kit|champ|mix（实测 ' + ARM + '）'); process.exit(2); }
if (!(TEMP > 0 && TEMP <= 2)) { console.error('⛔ --temp 要在 (0,2]（实测 ' + TEMP + '）'); process.exit(2); }

const W = sandbox();
const T = W.EpirusTrainer, S = W.EpirusState, Play = W.EpirusPlay, R = W.EpirusRules, B = W.EpirusBots, P = W.EpirusPolicy;
const K = R.SK;
if (!existsSync(PACK)) { console.error('⛔ --pack 指向的文件不存在：' + PACK + ' ⇒ 按失败处理（不许静默回落到默认包，那会把"换了枚包"读成"换了档"）'); process.exit(2); }
const champ = loadChamp(W, PACK);
if (!champ || champ.length !== P.paramCount()) { console.error('⛔ 包读不出/维度不符：' + PACK); process.exit(2); }
const params = Float64Array.from(champ);
const ZERO = new Float64Array(P.paramCount());

/* ---------- 三条自证先跑（跑不过就不必有读数）---------- */
const twoCands = function () {
  return [{ key: K.CHARGE, target: null, target2: null, bead: 'elec' },
    { key: K.CHARGE, target: null, target2: null, bead: 'boom' }];
};
function pairProbe(pp) {
  /* 造一个"手上没有珠、买得起蓄能"的最小局面（真局里也大量存在这种点，但这里要的是**确定性**） */
  const st = S.createState('multi', { next: T.mulberry32(4242) }, N);
  st.p[0].ep = 3; st.p[0].elec = 0; st.p[0].boom = 0;
  const f = P.forwardCands(st, 0, twoCands(), pp, { temp: TEMP });
  return f.probs[1];
}
const z = pairProbe(ZERO);
if (!(Math.abs(z - 0.5) < 1e-6)) { console.error('⛔ 自证 Z 没过：全零权重下 p_boom=' + z + '（应 0.5）⇒ 候选构造或调用路径接错'); process.exit(3); }
const maskBefore = P.featMask().bead;
P.setFeatMask('target,effects,rel');   /* 语义："列出的块开、其余关" ⇒ 这一句才是**掩掉 bead**（写成 'bead' 是反过来，本尺第一版就栽在这里） */
const fa = P.actionFeatures(S.createState('multi', { next: T.mulberry32(4242) }, N), 0, K.CHARGE, twoCands()[0]);
const fb = P.actionFeatures(S.createState('multi', { next: T.mulberry32(4242) }, N), 0, K.CHARGE, twoCands()[1]);
let sameMasked = fa.length === fb.length;
const stillDiff = [];
for (let i = 0; i < fa.length; i++) if (fa[i] !== fb[i]) { sameMasked = false; stillDiff.push(i); }
P.setFeatMask(null);
if (!sameMasked) { console.error('⛔ 自证 M 没过：掩掉 bead 后两候选仍不同（差在维度 ' + JSON.stringify(stillDiff) + '）⇒ 它们不止差那一维（本尺的问题陈述就不成立）'); process.exit(3); }
if (P.featMask().bead !== maskBefore) { console.error('⛔ 自证 M 没收尾：featMask.bead 应从 ' + maskBefore + ' 回到原位，实测 ' + P.featMask().bead); process.exit(3); }
/* 未掩时两候选**必须**不同（否则真局里的分差是零 ⇒ 与 §E701 的 0/135,262 打脸，得先查尺） */
const stC = S.createState('multi', { next: T.mulberry32(4242) }, N);
const ca = P.actionFeatures(stC, 0, K.CHARGE, twoCands()[0]), cb = P.actionFeatures(stC, 0, K.CHARGE, twoCands()[1]);
let diffDims = [];
for (let i = 0; i < ca.length; i++) if (ca[i] !== cb[i]) diffDims.push(i);
if (!diffDims.length) { console.error('⛔ 自证 M 的反面没过：未掩码时两候选特征逐位相同 ⇒ 这一维根本没进特征'); process.exit(3); }
/* `M2` 把同一份**真权重**再喂一次，但掩掉 bead ⇒ 打分必须回到 0.5。
 * 这条才是"我这把尺不是恒零仪器"的证明：Z 只用全零权重，恒零仪器在 Z 上也照样报 0.5。 */
P.setFeatMask('target,effects,rel');
const zMasked = pairProbe(params);
P.setFeatMask(null);
const gapReal = pairProbe(params);
if (!(Math.abs(zMasked - 0.5) < 1e-6)) { console.error('⛔ 自证 M2 没过：掩掉 bead 之后真权重的 p_boom=' + zMasked + '（应 0.5）⇒ 两候选还差在别处，或掩码没接到打分路径'); process.exit(3); }
if (!(Math.abs(gapReal - 0.5) > 1e-9)) { console.error('⛔ 自证 M2 的反面没过：真权重下 p_boom=' + gapReal + ' 与 0.5 分不开 ⇒ 这一维对**这枚包**没有打分影响（要么尺接错，要么这枚包那两维权重相同）⇒ 本尺读不出"偏好"，只读得出"无差异"'); process.exit(3); }
/* ⚑ 这里**不判方向**（§E703b 实测推翻了我原来写的"必须 <0.5"）：那条将一枚包的偏好烤成了仪器前提，
 *   于是 `v7beadseed-82` 在这同一颗种子的合成局面上 `p_boom = 1.0`（爆珠**被偏好**）被自己的自证当成"接线错"挡掉。
 *   仪器的自证只该问"这一维有没有影响"，不该问"影响朝哪边"——方向是被测对象的事实，归读数管。 */

/* ---------- 真局采样：每个"蓄能可负担"的决策点数一次 ---------- */
const stat = { dec: 0, chargeAff: 0, boomWins: 0, sumP: 0, pmax: 0, gaps: [], realPicks: { elec: 0, boom: 0, none: 0 }, games: 0, nChg: 0, sumPChg: 0, boomWinsChg: 0 };
function runGame(g) {
  const st = S.createState('multi', { next: T.mulberry32(SEED0 + g * 977) }, N);
  st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
  const choosers = [];
  for (let i = 0; i < N; i++) {
    const isKit = ARM === 'kit' || (ARM === 'mix' && i % 2 === 1);
    const inner = isKit ? B.pickToolKit : T.policyChooserN(params, TEMP, 0);
    const wrapped = function (state, pid, legal) {
      const act = inner(state, pid, legal);
      const key = (typeof act === 'string') ? act : (act && act.key);
      const affCharge = legal.some(function (l) { return l.key === K.CHARGE && l.affordable; });
      stat.dec++;
      if (affCharge && !isKit) {
        const f = P.forwardCands(state, pid, twoCands(), params, { temp: TEMP });
        const pb = f.probs[1];
        stat.chargeAff++; stat.sumP += pb;
        /* 拆两栏（§E703b）：**"蓄能可负担"** 的对内偏好 ≠ **"真交出蓄能那一刻"** 的对内偏好。
         *   不拆就会把"这枚包在 boom 更强的局面上干脆不选蓄能"读成"boom 从没赢过"——那是两个不同的事实。 */
        if (key === K.CHARGE) { stat.nChg++; stat.sumPChg += pb; if (pb > 0.5) stat.boomWinsChg++; }
        if (pb > stat.pmax) stat.pmax = pb;
        if (pb > 0.5) stat.boomWins++;
        stat.gaps.push(pb);
        if (key === K.CHARGE) {
          const bb = (act && act.bead) || 'none';
          stat.realPicks[bb] = (stat.realPicks[bb] || 0) + 1;
        }
      } else if (affCharge && isKit) {
        if (key === K.CHARGE) { const bb = (act && act.bead) || 'none'; stat.realPicks[bb] = (stat.realPicks[bb] || 0) + 1; }
      }
      return act;
    };
    choosers.push(wrapped);
  }
  Play.autoGameN(st, choosers);
  stat.games++;
}
for (let g = 0; g < GAMES; g++) runGame(g);

const srt = stat.gaps.slice().sort(function (a, b) { return a - b; });
const q = function (p) { return srt.length ? srt[Math.min(srt.length - 1, Math.floor(p * srt.length))] : NaN; };
const fmt = function (x) { return (x >= 1e-6 || x === 0) ? x.toExponential(2) : x.toExponential(2); };
console.log('== 爆珠通道的分差尺（§E703）· ' + GAMES + ' 局 ‖ n=' + N + ' ‖ 装配=' + ARM + ' ‖ seed0=' + SEED0 + ' ‖ temp=' + TEMP +
  (PACK === 'js/bundled-champion-3p.js' ? '' : ' ‖ 包=' + PACK) + ' ==');
console.log('   自证：Z 全零权重 p_boom=' + z.toFixed(6) + '（应 0.5）‖ M 掩 bead ⇒ 两候选特征逐位相同、未掩时差在维度 ' + JSON.stringify(diffDims) + '（特征面唯一差别）');
console.log('   自证 M2：同一份**真权重**、掩掉 bead ⇒ p_boom=' + zMasked.toFixed(6) + '（应 0.5）‖ 不掩 ⇒ ' + gapReal.toExponential(2) + ' ⇒ 这不是恒零仪器');
console.log('   决策点 ' + stat.dec + ' ‖ 其中"蓄能可负担"的冠军侧决策 ' + stat.chargeAff + ' 次');
console.log('   p_boom（爆珠相对电珠的选择率）：均值 ' + fmt(stat.chargeAff ? stat.sumP / stat.chargeAff : 0) +
  ' ‖ 中位 ' + fmt(q(0.5)) + ' ‖ P10 ' + fmt(q(0.1)) + ' ‖ P90 ' + fmt(q(0.9)) + ' ‖ **最大 ' + fmt(stat.pmax) + '**');
console.log('   其中 p_boom > 0.5（爆珠赢过电珠）= ' + stat.boomWins + ' / ' + stat.chargeAff +
  ' ‖ 折成分差 log-odds（temp·ln(p_e/p_b)）中位 = ' +
  (q(0.5) > 0 && q(0.5) < 1 ? (TEMP * Math.log((1 - q(0.5)) / q(0.5))).toFixed(3) : '—') +
  ' ‖ **最小**（最接近平衡的那一次）= ' +
  (stat.pmax > 0 && stat.pmax < 1 ? (TEMP * Math.log((1 - stat.pmax) / stat.pmax)).toFixed(3) : '—'));
console.log('   只在"**真交出蓄能**"的那些决策上（n=' + stat.nChg + '）：`p_boom` 均值 ' + fmt(stat.nChg ? stat.sumPChg / stat.nChg : 0) +
  ' ‖ boom 胜出 ' + stat.boomWinsChg + ' 次 ⇒ 与上一行的分母**不同**（那行是"买得起蓄能"）');
console.log('   chooser 交出蓄能时**显式给的**珠类型 = ' + JSON.stringify(stat.realPicks) +
  ' ‖ `none` = 不显式给 ⇒ 走引擎兜底 `play.js:69 beadOf`（相等时取电珠），所以脚本侧那一栏本来就不会有 boom');
const verdict = stat.chargeAff === 0
  ? (ARM === 'kit'
    ? 'ℹ 全是脚本席 ⇒ 按设计**不进**对内打分：杂货铺交出蓄能时**不显式给珠类型**（本表 `none` 那一栏），珠由引擎兜底 `play.js:69` 取 ⇒ 爆珠通道在两侧都是零，但**病因不同**（冠军侧 = 权重压倒，脚本侧 = 根本没接）。本尺的主语请用 --arm=champ / --arm=mix'
    : '⛔ 一格里"蓄能可负担"都没出现 ⇒ 本尺**没有判语权**（先查桌形/剂量），不许读成"爆珠不缺"')
  : (stat.pmax < 0.001
    ? '✅ 差距是**压倒性**的：连最偏向爆珠的那一次也只有 ' + fmt(stat.pmax) + ' ⇒ 想靠"顺手调一点价"救激光眼不现实，要动的是**珠类型那两维的相对权重**（= 训练侧的目标，不是规则指纹）'
    : (stat.boomWins === 0
      ? '⚠ 差距小但**方向恒定**（最大 ' + fmt(stat.pmax) + '，0 次翻）⇒ 这是一个"符号一致、幅度可调"的格子：给一点先验/示范就够翻（与 §E700 那种"权重买了广度反而 −6.4pt"不同类）'
      : '❓ 真局里爆珠**有时赢**（' + stat.boomWins + '/' + stat.chargeAff + '）⇒ §E701 那行"持有爆珠 = 0"要么依赖别的环节（赢得之后珠被清/过期），要么那行读数接错 ⇒ 先复查 §E701 再谈处方'));
console.log('\n   ⇒ ' + verdict);
if (!QUIET) {
  console.log('   口径：p_boom 是**两候选对内**的相对选择率（同一份 `forwardCands`、同一个 temp），不是"整桌候选里的概率"；');
  console.log('   它回答"珠类型这一步的偏好有多强"，不回答"激光眼多久能用一次"（后者 = §E701 的 ②/逐张那两栏）。');
  console.log('   ⚠ `p_boom` 只数**冠军侧**的决策（脚本席没有珠类型候选 ⇒ 对它做对内比较没有意义）；最后一行 `显式给的珠类型` 是**全场合计**，换 --arm 才能分开看。');
}
