/* §E646/§E648 自证 · 路线 B「送盾的部署层先验」（引擎里的 `SUPPORT_PRIOR`：引擎默认 0=关，**但页面默认开档 2** ⇒ 它现在就在现网路径上）
 * 九条腿，只读数、不改规则、不加门（当初"默认关 ⇒ 不用门"的理由已被 v1.7.111 的 `ui.js` 作废 ⇒ 要不要给它加一条腿**待用户裁**，
 *   要加就按 D224 那个形状挂在既有家族里，并同班交一条该摘的旧腿；"加一条要删一条"仍生效）。
 *   ① 默认值在册 + 非法值必须抛 ⇒ 否则"关档 = 出厂形状"这句没根
 *   ② 关档逐字同结果：不设旗标 vs 显式 `setSupportPrior(0)` ⇒ 决策序列必须一字不差
 *   ③ 档 1「只改目标」：核对到**第一处分叉**（分叉那一格必须"同为 holo、只差目标"），
 *      之后一律按**每手自己的决策时刻**核（`pred!==null ⇒ 目标=谓词`；`pred===null ⇒ 照网络`）
 *   ④ 构造态三条牙：濒死席（hp≤1）必须跳过 ‖ 没人搓招返回 null（不是返回 0 号席）‖ 排除自己
 *   ⑤ 真局侧的牙（在 `pick=max` 那一趟上做，单变量才干净）：严格 vs 宽松两版挑人必须真分得出
 *   ⑥ 档 2「按 `skipP` 概率改攒」：⑥a 分母非 0 ‖ ⑥b 拦下的比例对上 skipP（⚑ 不是二项检验，随机数是 hash）‖
 *      ⑥c 产品档必须"有时不拦" ‖ ⑥d `skipP=1` 必须 ≡ 旧的严档（未拦 = 0 手）‖ ⑥e `skipP=0` 必须**逐字同档 1** ‖ ⑥f 总量仍降 ‖ ⑥g 剩下的跟着谓词走
 *   ⑦ knobs 自己的牙：默认回读 = 产品档 ‖ 非法值与**打错的键**必须抛（静默用默认值跑 = 假绿）
 *   ⑧ `weighted` 不是装饰：同一构造态下 ep 高与 ep 低两位都要被挑到过，且高权份额对上 5/8
 *   ⑨ 随机源：先用"逐回合与引擎对拍过的复刻 hash"量 `salt=2` 在真实 (回合,席) 网格上的通过率 ⇒ `skipP=0.6` 是声明、兑现率是读数；
 *      对拍不过就是复刻件过期（红得该）。⚑ 回合号在各局之间重复 ⇒ 同一张彩票重复刮，**不许按"每局独立"算方差**。
 * ⚠ 为什么 ③⑥ 都用"决策时刻的条件"而不是"整条序列对比"：先验一改，被改的那位活法就变 ⇒ 后面所有键都跟着变。
 *   第二枚包 R-s123 · long 实测把这条逼出来了：目标只改了 3 手，下游却有 32583 格不同 —— 那是**分叉**，不是错误。
 * ⚑ 这是**部署层先验不是学到的**（用户 10-17 主语规矩）⇒ 本工具的读数不许写成"AI 学会辅助"。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../..');
const imp = (p) => import(pathToFileURL(ROOT + '/' + p).href);
const { sandbox, loadChamp, rejectUnknownFlags } = await imp('tools/audit-lib.mjs');
const { duelAssembly } = await imp('tools/v2v4-lib.mjs');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
/* 仓规（门 D218，v1.5.318）：读了的旗标必须逐个登记，**不认识的 `--` 参数要响亮失败**（静默忽略会把"我以为控制了这一维"变成假绿）。
 *   本班 D218 把这台新量具跑红之后补的。⚠ 形状要求：第一个实参是 **`argv` 变量**、第二个是**内联数组**（与 `gate-par` / `probe-conversion-chain` 等同形）。
 *   为什么不能写成把 `process.argv.slice(2)` 直接塞进括号：门的抽取式只认上面那种形状，写成内联的话"没有缺口"那条虽然绿，
 *   **名单却根本没被扫**（空过）。⇒ 也别在这台工具的注释里逐字抄门的针脚字符串——本班就是这么把注释当成源码被扫、自己把自己报红的。 */
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['pack', 'games', 'mode', 'seed0'], 'probe-support-prior');   /* 名单 = 下面 arg() 实际读的四个 */
const W = sandbox(ROOT);
const S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer, R = W.EpirusRules;
const PACK = arg('pack', 'docs/artifacts/v7beadseed-82.bak');
const G = Number(arg('games', 120)), MODE = arg('mode', 'multi'), SEED0 = Number(arg('seed0', 90210));

let bad = 0;
const say = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) bad++; };
/* 宽松版谓词：**argmax + 只去掉 `hp>1` 那一格**，其余一字不变 ⇒ 它与引擎 `pick=max` 那一趟才构成单变量对照（腿⑤ 只在 max 档比）。
 *   它只为量"这条门槛在真局里有没有牙"而存在，**不进引擎**。 */
const laxTarget = (state, pid) => {
  let b = -1, be = -1;
  for (let i = 0; i < state.p.length; i++) {
    if (i === pid || state.p[i].hp <= 0) continue;
    if (!((state.p[i].ringStreak | 0) >= 1 || state.p[i].ep >= 3)) continue;
    if (state.p[i].ep > be) { be = state.p[i].ep; b = i; }
  }
  return b >= 0 ? b : null;
};

/* ① 默认值 + 非法值 */
console.log('① 默认值在册 ‖ 非法值必须抛');
say(T.supportPriorOn() === 0, '引擎回读 `SUPPORT_PRIOR = ' + T.supportPriorOn() + '`（0 = 关 ⇒ 现网/训练/门禁不受本档影响）');
const REJECT = [3, -1, 0.5, 'x', 'on'];
let rejected = 0;
for (const v of REJECT) { let threw = false; try { T.setSupportPrior(v); } catch (e) { threw = true; } if (threw) rejected++; else say(false, '① 非法值 ' + JSON.stringify(v) + ' 居然被接受（setter 没牙）'); }
say(rejected === REJECT.length, '非法值 ' + rejected + '/' + REJECT.length + ' 个都被拒 ⇒ 合法档只有 0/1/2');

/* 包住每一席的 chooser：在**决策时刻**记 holo 的三种信息（引擎实际给的目标、严格谓词、宽松谓词、当时攒得起吗） */
function runOne(prior, knobs) {
  T.setSupportPriorKnobs(knobs || { minEp: 3, skipP: 0.6, pick: 'weighted' });
  T.setSupportPrior(prior);
  const params = loadChamp(W, PACK, ROOT);
  if (!params) { console.error('⛔ 包读不出：' + PACK); process.exit(7); }
  const net = T.policyChooserN(params, 0.15);
  const gifts = [];
  const chooser = (state, pid, legal) => {
    const r = net(state, pid, legal);
    if (r && r.key === R.SK.HOLO) {
      gifts.push({ slot: seq.length, pid, target: r.target == null ? null : Number(r.target),
        pred: T.supportPriorTarget(state, pid), predLax: laxTarget(state, pid),
        ji: legal.some(function (l) { return l.key === R.SK.JI && l.affordable; }) });
    }
    return r;
  };
  const seq = [];
  const turns = new Set();   // ⑨ 要量"随机源在这批真实出现过的 (回合,席) 网格上兑现成多少"⇒ 得知道键长什么样，不能按拍数猜
  const onTurn = (s2) => {
    turns.add(s2.turn != null ? s2.turn : (s2.round != null ? s2.round : 0));
    const row = [];
    for (let i = 0; i < s2.p.length; i++) { const a = s2.actions && s2.actions[i]; row.push((a && a.key) ? a.key + ':' + (a.target == null ? '-' : a.target) : '.'); }
    seq.push(row.join('|'));
  };
  duelAssembly({ S, Play, T, R }, params, { games: G, mode: MODE, seed0: SEED0, n: 5, scripted: chooser, chooserFor: () => chooser, onTurn });
  return { seq, gifts, turns };
}
/* 五趟：A/A2 关档（两趟验确定性）‖ B 档 1 ‖ C **产品档**（weighted + skipP=0.6）‖ D **严档**（max + skipP=1，§E643/§E647 那个形状）‖ E 档 2 但不拦（skipP=0 ⇒ 应 ≡ 档 1）。
 *   knobs 每趟显式给 ⇒ "档 2"这个词在这台自证里不再有两种形状（本班就是被这个混用咬到的）。 */
const STRICT = { minEp: 3, skipP: 1, pick: 'max' }, LOOSE = { minEp: 3, skipP: 0.6, pick: 'weighted' }, NORESCUE = { minEp: 3, skipP: 0, pick: 'weighted' };
const A = runOne(0, LOOSE), A2 = runOne(0, LOOSE), B = runOne(1, LOOSE), C = runOne(2, LOOSE);
const D = runOne(2, STRICT), E = runOne(2, NORESCUE);
T.setSupportPriorKnobs(LOOSE);   // 放回产品默认，再关档
T.setSupportPrior(0);   // 腿跑完放回默认档，否则同进程后面的读数带着先验跑

/* ② 关档逐字同 */
console.log('② 关档逐字同结果（不设旗标 vs 显式 setSupportPrior(0)）');
say(A.seq.length === A2.seq.length && A.seq.every((x, i) => x === A2.seq[i]), '回合快照 ' + A.seq.length + ' 拍逐字相同 ‖ 关档送盾 ' + A.gifts.length + ' 手');
say(A.seq.length > 0 && A.gifts.length > 0, '分母非 0（' + A.seq.length + ' 拍 ‖ ' + A.gifts.length + ' 手）⇒ 后面几条腿不是空转');
let holoSlots = 0;
for (let t = 0; t < A.seq.length; t++) { const ra = A.seq[t].split('|'); for (let i = 0; i < ra.length; i++) if (ra[i].split(':')[0] === R.SK.HOLO) holoSlots++; }

/* ③ 档 1：只改目标 */
console.log('③ 档 1「只改 holo 目标」（核对到第一处分叉 ‖ 每手按决策时刻的条件核）');
const withPred = B.gifts.filter(g => g.pred !== null);
const following = withPred.filter(g => g.target === g.pred).length;
const fellBack = B.gifts.length - withPred.length;
let forkMsg = '（全程无分叉 ⇒ 档 1 在这张桌上不可见）', forkBad = 0;
const nT = Math.max(A.seq.length, B.seq.length);
outer: for (let t = 0; t < nT; t++) {
  const ra = (A.seq[t] || '').split('|'), rb = (B.seq[t] || '').split('|');
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] === rb[i]) continue;
    const ka = ra[i].split(':')[0], kb = (rb[i] || '.').split(':')[0];
    const ok = (ka === R.SK.HOLO && kb === R.SK.HOLO);
    if (!ok) forkBad++;
    forkMsg = '第 ' + t + ' 拍 席 ' + i + '：`' + ra[i] + '` → `' + rb[i] + '`' + (ok ? '（同为 holo、只差目标 ✔）' : '（⛔ 第一处分叉就不是"只差目标"）');
    break outer;
  }
}
say(forkBad === 0, '第一处分叉之前逐字同、且分叉只能是"同键不同目标"：' + forkMsg);
say(B.gifts.every(g => g.pred === null || g.target === g.pred),
  '档 1 送盾 ' + B.gifts.length + ' 手：谓词挑得到 ' + withPred.length + ' 手、全部跟着谓词（' + following + '/' + withPred.length + '）‖ 挑不到（分母 0 ⇒ 照网络）' + fellBack + ' 手');
console.log('   ⚑ 幅度：关档 holo 出手 ' + holoSlots + ' 拍次，其中由谓词决定的 ' + following + ' 手（' + (100 * following / Math.max(1, holoSlots)).toFixed(2) + '%）⇒ 其余都是"桌上没人搓长招"');

/* ④ 构造态三条牙 */
console.log('④ 构造态：濒死跳过 ‖ 没人搓招返回 null ‖ 排除自己');
const fake = (rows) => ({ p: rows.map(r => ({ hp: r[0], ep: r[1], ringStreak: r[2] })) });
const DYING = fake([[4, 0, 0], [1, 5, 0], [3, 3, 0], [3, 0, 0], [0, 9, 9]]);
say(T.supportPriorTarget(DYING, 0) === 2, '1 号 ep=5 但 hp=1（濒死）、2 号 ep=3 hp=3 ⇒ 应挑 2（实测 ' + T.supportPriorTarget(DYING, 0) + '）');
say(T.supportPriorTarget(fake([[4, 0, 0], [3, 2, 0], [3, 1, 0], [3, 0, 0], [3, 2, 0]]), 0) === null,
  '没人 `ringStreak≥1 ∨ ep≥3` ⇒ 必须 null（分母 0，不是"随便给一个"）');
say(T.supportPriorTarget(fake([[4, 9, 9], [3, 3, 0], [3, 0, 0], [3, 0, 0], [3, 0, 0]]), 0) === 1,
  '自己 ep=9 最会搓 ⇒ 不得选自己，退到下一位 churning 席（实测 ' + T.supportPriorTarget(fake([[4, 9, 9], [3, 3, 0], [3, 0, 0], [3, 0, 0], [3, 0, 0]]), 0) + '）');
/* ④d max 档比的是**原始 ep**，不是"钳到 ≥1 的权重"：ep=1 与"ep=0 但在搓环流"同时在场时必须选 ep=1 那一位。
 *   这条是我自己 A1 那版 `pick='max'` 分支的漏洞（权重 `Math.max(1, ep)` 会把 0 与 1 压成同值 ⇒ 变成"选席号小的"，
 *   与 §E643/§E647 那个 argmax 形状在 ep∈{0,1} 的组合上不等价）。红就要红在这里：修完必须变绿。 */
T.setSupportPriorKnobs(STRICT);
const EP1 = fake([[4, 0, 0], [3, 0, 1], [3, 1, 1], [3, 0, 0], [3, 0, 0]]);   // 1 号 ep=0 但 ringStreak=1 ‖ 2 号 ep=1 且 ringStreak=1
say(T.supportPriorTarget(EP1, 0) === 2,
  '④d max 档：ep=1（2 号）必须赢过"ep=0 但在搓环流"（1 号）⇒ 旧形状比的是原始 ep（实测挑到 ' + T.supportPriorTarget(EP1, 0) + '）');
T.setSupportPriorKnobs(LOOSE);

/* ⑤ 真局侧的牙（**在 `pick=max` 那一趟上做**：宽松版谓词是"argmax 但不排濒死"，只有在确定性挑人下两者才只差"排不排濒死"这一格；
 *   拿 weighted 那趟比就会把"挑人规则不同"混进"门槛不同"里 ⇒ 读数不再是单变量） */
console.log('⑤ 变异（真局 · max 档）：摘掉"排除濒死"这半，同批决策是否真的改挑人');
let differ = 0, nullStrict = 0;
for (const g of D.gifts) { if (g.pred === null) nullStrict++; if (g.pred !== g.predLax) differ++; }
say(differ > 0, '严档 ' + D.gifts.length + ' 手里"严格 vs 宽松"挑人不同 = ' + differ + ' 手（严格挑不到 ' + nullStrict + ' 手）'
  + (differ > 0 ? ' ⇒ ④ 那条门槛在真局里看得见' : ' ⇒ ⛔ 这批局里没有"濒死又在搓招"的格子，④ 只是装饰，得加局或换桌形'));

/* ⑥ 档 2：按 `skipP` 的概率改攒（v1.7.105 的形状；旧的"必然改攒"由腿⑥c 单独钉） */
console.log('⑥ 档 2「挑不到时按 skipP 的概率改攒」：只看每手自己的决策时刻');
/* 分母 = 关档里"挑不到人却又攒得起"的那些时刻（这些才是改攒分支能作用的地方） */
const nullAndCanSave = A.gifts.filter(g => g.pred === null && g.ji === true).length;
say(C.gifts.filter(g => g.pred === null && g.ji === true).length >= 0 && nullAndCanSave > 0,
  '⑥a 分母非 0：关档里"挑不到人却又攒得起"= ' + nullAndCanSave + ' 手 ‖ 产品档里同类时刻只剩 ' + C.gifts.filter(g => g.pred === null && g.ji === true).length + ' 手（方向：确有拦截发生）');
console.log('   ⚑ 上面两个数**不许相除当"概率"**：先验一改，C 的轨迹就跟 A 分岔 ⇒ 分子分母不是同一个总体（腿③ 那条老教训的又一形态）。'
  + 'skipP 兑现成多少由腿⑨ 直量。');
say(C.gifts.filter(g => g.pred === null && g.ji === true).length > 0,
  '⑥c 产品档确实"有时不拦"：还剩 ' + C.gifts.filter(g => g.pred === null && g.ji === true).length + ' 手没拦（必须是 > 0 ⇒ 全拦就退回旧的严档，用户要的"别完全变成脚本工作"就没有了）');
const DnotSaved = D.gifts.filter(g => g.pred === null && g.ji === true).length;
say(DnotSaved === 0, '⑥d 严档（`skipP=1`）下"挑不到却又攒得起"仍送出 = ' + DnotSaved + ' 手（必须是 0 ⇒ 这就是 §E643/§E647 在册那批的形状， knob 不灵就是假复现）');
const Enull = E.gifts.filter(g => g.pred === null && g.ji === true).length, Bnull = B.gifts.filter(g => g.pred === null && g.ji === true).length;
say(E.seq.length === B.seq.length && E.seq.every((x, i) => x === B.seq[i]) && Enull === Bnull,
  '⑥e `skipP=0` 与档 1 **逐字同**（回合快照 ' + E.seq.length + ' 拍 ‖ 未拦 ' + Enull + ' vs ' + Bnull + '）⇒ "改攒"那一支真的只由 skipP 驱动，没有藏在别处的第二道拦截');
say(C.gifts.length < A.gifts.length, '⑥f 送盾总量仍下降：关档 ' + A.gifts.length + ' 手 → 产品档 ' + C.gifts.length + ' 手（省下 ' + (100 * (1 - C.gifts.length / A.gifts.length)).toFixed(1) + '%）‖ 严档 ' + D.gifts.length + ' 手');
const cf = C.gifts.filter(g => g.pred !== null), cfOk = cf.filter(g => g.target === g.pred).length;
say(cf.length === 0 || cfOk === cf.length, '⑥g 产品档剩下的送盾里谓词挑得到 ' + cf.length + ' 手、跟着谓词 ' + cfOk + ' 手');
if (C.gifts.length === 0) console.log('   ⚠ **本批产品档剩 0 手 ⇒ ⑥a/⑥g 是空过**（没有一手可供核对）⇒ 要引这两条必须加局直到剩下非 0 手；这不是"通过"，是"没测到"。');

/* ⑦ knobs 自己的牙（本班病根就是"档 2"这个词没有可判的形状） */
console.log('⑦ knobs：默认值在册 ‖ 非法值与打错的键必须抛');
const K0 = T.supportPriorKnobs();
say(K0.pick === 'weighted' && K0.skipP === 0.6 && K0.minEp === 3, '引擎回读默认 = pick=' + K0.pick + ' skipP=' + K0.skipP + ' minEp=' + K0.minEp + '（**产品档**，改 knobs 不许动它）');
const BAD_KNOB = [{ minEp: 0 }, { minEp: 2.5 }, { minEp: 'x' }, { skipP: 1.5 }, { skipP: -0.1 }, { skipP: 'a' }, { pick: 'zzz' }, { skipp: 0.5 }, { minEp: null, nope: 1 }];
let kRejected = 0;
for (const k of BAD_KNOB) { let threw = false; try { T.setSupportPriorKnobs(k); } catch (e) { threw = true; } if (!threw) say(false, '⑦ knobs ' + JSON.stringify(k) + ' 居然被接受（setter 没牙 ⇒ 打错键会静默用默认值跑）'); else kRejected++; }
say(kRejected === BAD_KNOB.length, '非法/未知旋钮 ' + kRejected + '/' + BAD_KNOB.length + ' 个都被拒');
say(T.supportPriorKnobs().pick === 'weighted' && T.supportPriorKnobs().skipP === 0.6, '被拒之后默认值没被写坏（回读仍是产品档）');

/* ⑧ weighted 这一支不是装饰：构造态上"ep 高"与"ep 低"两位都在搓招，两档各挑什么 */
console.log('⑧ 挑人形状：max 档永远挑 ep 最大 ‖ weighted 档两个都要被挑到过（否则"加权"是装饰）');
const TWO = (turn) => ({ turn: turn, p: [{ hp: 4, ep: 0, ringStreak: 0 }, { hp: 4, ep: 5, ringStreak: 0 }, { hp: 4, ep: 3, ringStreak: 0 }, { hp: 4, ep: 0, ringStreak: 0 }, { hp: 4, ep: 0, ringStreak: 0 }] });
T.setSupportPriorKnobs(STRICT); const maxPicks = {};
for (let t = 0; t < 200; t++) { const r = T.supportPriorTarget(TWO(t), 0); maxPicks[r] = (maxPicks[r] || 0) + 1; }
say(Object.keys(maxPicks).length === 1 && maxPicks[1] === 200, 'max 档 200 个回合全部挑 ep 最大的那一位（1 号席）：分布 ' + JSON.stringify(maxPicks));
T.setSupportPriorKnobs(LOOSE); const wPicks = {}; const engW = [];
for (let t = 0; t < 200; t++) { const r = T.supportPriorTarget(TWO(t), 0); wPicks[r] = (wPicks[r] || 0) + 1; engW.push(r); }
const wLow = wPicks[2] || 0, wHigh = wPicks[1] || 0;
say(wLow > 0 && wHigh > 0, 'weighted 档同一构造态 200 个回合挑到 1 号 ' + wHigh + ' 次 ‖ 2 号 ' + wLow + ' 次 ⇒ 两个都被挑过（期望比 ≈ ep 5:3 ⇒ 实测 ' + (wLow ? (wHigh / wLow).toFixed(2) : '读不出') + '）');
say(Math.abs(wHigh / Math.max(1, wHigh + wLow) - 5 / 8) <= 0.12, 'weighted 档的高权份额对上 5/8=0.625：实测 ' + (wHigh / Math.max(1, wHigh + wLow)).toFixed(3) + '（允差 ±0.12）');
T.setSupportPriorKnobs(LOOSE);

/* ⑨ 随机源：先让复刻件与引擎对拍，再用它直量 `salt=2`（"改攒"那一支）在这批真实键上的通过率。
 *   为什么要有这条：`skipP=0.6` 是**声明**，兑现成多少要看 `hash(回合|席|盐)` 在小整数输入上均不均匀；
 *   而"从产品档的送盾总数反推概率"是错的（跨轨迹，总体都变了 ⇒ 腿⑥a 旁那句 ⚑）。 */
console.log('⑨ 随机源：复刻件与引擎逐回合对拍 ‖ 再量 salt=2 的真实通过率');
const randReplica = (turn, pid, salt) => {
  const s = turn + '|' + pid + '|' + (salt || 0);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h / 4294967296;
};
let mismatchW = 0;
for (let t = 0; t < 200; t++) { const want = (randReplica(t, 0, 1) * 8) <= 5 ? 1 : 2; if (engW[t] !== want) mismatchW++; }
say(mismatchW === 0, 'salt=1 上 200 个回合逐回合一致（不一致 ' + mismatchW + '/200）⇒ 下面这条用复刻件量到的就是引擎的数（对拍不过就是复刻件过期，红得该）');
const TS = Array.from(A.turns).sort((a, b) => a - b);
let pass = 0, tot = 0; const byPid = [0, 0, 0, 0, 0], totPid = [0, 0, 0, 0, 0];
for (const t of TS) for (let pid = 0; pid < 5; pid++) { tot++; totPid[pid]++; if (randReplica(t, pid, 2) < 0.6) { pass++; byPid[pid]++; } }
const frac = tot ? pass / tot : null;
console.log('   真实键网格 ' + tot + ' 格（' + TS.length + ' 个不同回合号 × 5 席 ‖ 120 局里回合号会重复 ⇒ hash 也重复：**这不是每局独立抛硬币，是同一张彩票重复刮**）');
console.log('   salt=2 通过率 = ' + (frac === null ? '读不出' : (100 * frac).toFixed(1) + '%') + ' ‖ 声明 skipP=60.0% ‖ 逐席 '
  + byPid.map((v, i) => i + ':' + (100 * v / Math.max(1, totPid[i])).toFixed(0) + '%').join(' '));
say(frac !== null && Math.abs(frac - 0.6) <= 0.10,
  '⑨b 随机源兑现：偏差 ' + (frac === null ? '读不出' : (100 * (frac - 0.6)).toFixed(1) + 'pt') + '（允差 ±10pt）⇒ 超线就是"FNV 在小整数输入上不均匀"，那"60%"只是个名字，不是剂量');
T.setSupportPriorKnobs(LOOSE);

console.log('\n—— 三档在**这张桌**上的实际形状（mirror 5×同包 ‖ ' + G + ' 局 ‖ ' + MODE + ' ‖ pack=' + PACK + ' ‖ seed0=' + SEED0 + ' ‖ knobs 默认 pick=weighted skipP=0.6）');
console.log('   档 1：' + (following === 0 ? '**no-op**（谓词挑得到的次数=' + withPred.length + '，而网络本来就给同一位）' : '由谓词决定 ' + following + ' 手'));
console.log('   产品档：关档 ' + A.gifts.length + ' 手 → ' + C.gifts.length + ' 手（省 ' + (100 * (1 - C.gifts.length / A.gifts.length)).toFixed(1) + '%）‖ 严档（旧在册形状）：' + D.gifts.length + ' 手（省 ' + (100 * (1 - D.gifts.length / A.gifts.length)).toFixed(1) + '%）');
console.log('   ⚑ 两档的差就是 §E648 要说的那件事：**"档 2"从"几乎不送"变成了"少送三成、仍留四成"** ⇒ 引用 §E643/§E647 那些"档 2"读数时必须带 `pick=max skipP=1`（腿⑥d 钉这个形状还活着）。');
console.log('   ⚑ §E644 六"桌上没有长招生态"仍然是底色：谓词挑得到的只有 ' + withPred.length + '/' + B.gifts.length + ' 手 ⇒ 这张桌上先验大部分时间无事可做.');
console.log(bad ? '\n⛔ 自证 ' + bad + ' 条不过 ⇒ `SUPPORT_PRIOR` 不许按现在的形状用' : '\n✔ 九条腿全过（' + G + ' 局 × 6 趟 ‖ 尺 = 本文件 + `tools/v2v4-lib.mjs` 的 duelAssembly）');
process.exit(bad ? 1 : 0);
