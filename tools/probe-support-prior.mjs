/* §E646 自证 · 路线 B「送盾的部署层先验」（引擎里的 `SUPPORT_PRIOR`，默认 **0=关**）
 * 六条腿，只读数、不改规则、不加门（默认关的开关不在现网路径上 ⇒ 用可跑自证替代门；"加一条要删一条"仍生效）。
 *   ① 默认值在册 + 非法值必须抛 ⇒ 否则"关档 = 出厂形状"这句没根
 *   ② 关档逐字同结果：不设旗标 vs 显式 `setSupportPrior(0)` ⇒ 决策序列必须一字不差
 *   ③ 档 1「只改目标」：核对到**第一处分叉**（分叉那一格必须"同为 holo、只差目标"），
 *      之后一律按**每手自己的决策时刻**核（`pred!==null ⇒ 目标=谓词`；`pred===null ⇒ 照网络`）
 *   ④ 构造态三条牙：濒死席（hp≤1）必须跳过 ‖ 没人搓招返回 null（不是返回 0 号席）‖ 排除自己
 *   ⑤ 真局侧的牙：决策时刻同时记"严格（排除濒死）"与"宽松（只排除死人）"两版挑人 ⇒
 *      两版一次都没差 = 这批样本照不到那一格，④ 就是装饰，必须响亮报警
 *   ⑥ 档 2「挑不到就不送（改攒）」：档 2 仍送出去的每一手，都必须"当时挑得到人"或"当时连攒都不合法"
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
/* 宽松版谓词：只去掉 `hp>1` 那一格，其余一字不变 —— 只为量"这条门槛在真局里有没有牙"，不进引擎 */
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
function runOne(prior) {
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
  const onTurn = (s2) => {
    const row = [];
    for (let i = 0; i < s2.p.length; i++) { const a = s2.actions && s2.actions[i]; row.push((a && a.key) ? a.key + ':' + (a.target == null ? '-' : a.target) : '.'); }
    seq.push(row.join('|'));
  };
  duelAssembly({ S, Play, T, R }, params, { games: G, mode: MODE, seed0: SEED0, n: 5, scripted: chooser, chooserFor: () => chooser, onTurn });
  return { seq, gifts };
}
const A = runOne(0), A2 = runOne(0), B = runOne(1), C = runOne(2);
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

/* ⑤ 真局侧的牙 */
console.log('⑤ 变异（真局）：摘掉"排除濒死"这半，同批决策是否真的改挑人');
let differ = 0, nullStrict = 0;
for (const g of A.gifts) { if (g.pred === null) nullStrict++; if (g.pred !== g.predLax) differ++; }
say(differ > 0, '关档 ' + A.gifts.length + ' 手里"严格 vs 宽松"挑人不同 = ' + differ + ' 手（严格挑不到 ' + nullStrict + ' 手）'
  + (differ > 0 ? ' ⇒ ④ 那条门槛在真局里看得见' : ' ⇒ ⛔ 这批局里没有"濒死又在搓招"的格子，④ 只是装饰，得加局或换桌形'));

/* ⑥ 档 2：挑不到就不送（改攒） */
console.log('⑥ 档 2「挑不到就不送」：只看每手自己的决策时刻');
const shouldHaveSaved = C.gifts.filter(g => g.pred === null && g.ji === true);
say(shouldHaveSaved.length === 0, '档 2 送出 ' + C.gifts.length + ' 手里"当时挑不到人却又攒得起"= ' + shouldHaveSaved.length + ' 手（必须是 0 ⇒ 该改攒的都改攒了）');
say(C.gifts.length < A.gifts.length, '送盾总量下降：关档 ' + A.gifts.length + ' 手 → 档 2 ' + C.gifts.length + ' 手（省下 ' + (100 * (1 - C.gifts.length / A.gifts.length)).toFixed(1) + '%）');
const cf = C.gifts.filter(g => g.pred !== null), cfOk = cf.filter(g => g.target === g.pred).length;
say(cf.length === 0 || cfOk === cf.length, '档 2 剩下的送盾里谓词挑得到 ' + cf.length + ' 手、跟着谓词 ' + cfOk + ' 手');
if (C.gifts.length === 0) console.log('   ⚠ **本批档 2 剩 0 手 ⇒ 上面 (a) 与这条 (c) 是空过**（没有一手可供核对）⇒ 要引这两条必须加局直到剩下非 0 手；这不是"通过"，是"没测到"。');

console.log('\n—— 两档在**这张桌**上的实际形状（mirror 5×同包 ‖ ' + G + ' 局 ‖ ' + MODE + ' ‖ pack=' + PACK + ' ‖ seed0=' + SEED0 + '）');
console.log('   档 1：' + (following === 0 ? '**no-op**（谓词挑得到的次数=' + withPred.length + '，而网络本来就给同一位）' : '由谓词决定 ' + following + ' 手'));
console.log('   档 2：省下 ' + (100 * (1 - C.gifts.length / A.gifts.length)).toFixed(1) + '% 的送盾 ⇒ 在这张桌上它不是"少而准"，是**几乎不送**');
console.log('   ⚑ 这正是 §E644 六"桌上没有长招生态"的行为面后果。先验本身没坏（④⑤ 有牙），是**这里没有它能兑现的局面**.');
console.log(bad ? '\n⛔ 自证 ' + bad + ' 条不过 ⇒ `SUPPORT_PRIOR` 不许按现在的形状用' : '\n✔ 六条腿全过（' + G + ' 局 × 4 趟 ‖ 尺 = 本文件 + `tools/v2v4-lib.mjs` 的 duelAssembly）');
process.exit(bad ? 1 : 0);
