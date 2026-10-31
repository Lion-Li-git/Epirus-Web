#!/usr/bin/env node
/* §E679 探索训练（10-22 夜班·千问 · 用户 10-21 夜授权「开新分支搞一些探索训练…之前提过的优化算子和梯度训练
 * 的东西可以再拿出来研究一些以前没搞过的东西」）：**CEM（对角高斯精英再拟合）** 与 GA 在**同一份评估预算**下对比。
 *
 * 为什么是这条：全仓 grep `CEM|NES|tabu|surrogate|岛模型` 零命中（在册调研结论，见
 * `docs/research/GATE-AUDIT-2026-10-22-qoder.md` 引用的两支调研）⇒ 算子面这是真空白；而梯度面 E1 已经跑过
 * （`CHANGELOG.md:2148`），结论是"输在对手场错位、不是输在梯度"（E6 同场回收 +24.9/+43.8pt）。
 *
 * 预算口径（跑前写死，不给事后挑空间的余地）：**单位 = 个体评估次数**，两臂都只调同一个
 * `T.scoreMemberN(params, opps, games, n, gen, idx, h)` ⇒ GA 一代 = pop 次评估，CEM 一轮 = samples 次评估；
 * 两臂吃同一个 `--evals` 总预算。**没有第三个自由量**（§E194 那条"一次对照只能有一个自由量"）。
 *
 * 自证（发臂前先跑，任一不过就 exit 2，不许开跑）：
 *   ① 同一粒、同一 (gen=0, idx=0) 连跑三遍 ⇒ fit 必须**逐字相同**（这才叫"两臂读同一件事"）；
 *      顺手把"同一粒只换 idx 的散布"当**量具噪声底**打出来（10-22 实测 games=6·n=3：SD≈0.12–0.17 ⇒ `inLoopBest` 有一截是抽签）。
 *      ⚠ 第一版这里写的是"退化臂 POP 个全同样本取 max 必须等于起点"——那是把"同源"错写成"与 idx 无关"，pop>1 时必然 FAIL。
 *   ② 起点分母必须报出来（seed 粒与随机粒各一次），否则"涨了多少"没有参照（记忆里那条"发臂前先量起点分母"）。
 *
 * 用法：node tools/probe-cem-arm.mjs --mode=ga|cem --evals=2000 [--pop=14] [--games=4] [--n=3]
 *        [--seed=7] [--elite=4] [--sig=0.2] [--degenerate=1] [--out=<pack 落点>] [--quiet]
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, rejectUnknownFlags } from './audit-lib.mjs';
import { install as installArch2, verifyWired as verifyArch2Wired, readPack2 } from './proto2/arch2.mjs';   // §E821：默认关（不带 EPIRUS_ARCH2 ⇒ 逐字照旧）
import { createArena2, SHAPES as ARENA2_SHAPES } from './proto2/arena2.mjs';   // 10-29 夜：扩表考卷（--arena2=1 才开）
import { auditCells } from './proto2/skill-mastery.mjs';                      // 10-31 凌晨：mastery 门骑同一把审计尺
import { collectFixtures, headHealth, agreeVsRandom, fmtHead, HEAD_FLAT_AGREE } from './proto2/head-health.mjs';
import { OPP_SPECS } from '../server/opp-pool.mjs';               // 考卷搬迁：产品 7 脚本的单一来源
import { makeAsChooser } from './bot-chooser-lib.mjs';             // 同款包装（评测同款）

/* §E679 补（10-22）：这台量具原先**没有输入消毒层**（D218 那条门当场抓到，是我今夜建它时就漏的）。
 * 拼错的旗标被静默忽略 = 读数按默认档跑完而没人知道 ⇒ 与"黑键"同族。名单跟着 `arg('…')` 走。 */
const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['mode', 'evals', 'pop', 'games', 'n', 'seed', 'elite', 'sig', 'degenerate',
  'start', 'out', 'quiet', 'trainMode', 'holdoutGames', 'targetGames', 'fxSelect', 'fxGames', 'sigmaAdaptive', 'playtemp',
  'masteryKey', 'masteryGate', 'masteryLine', 'masteryGames', 'masteryN', 'masteryTable', 'masteryCap', 'masterySem', 'masteryMax',
  'arena2', 'arenaTemp', 'arenaHold', 'arenaCur', 'arenaDiverse', 'divTol', 'divDelta', 'divEvery', 'divTrigger', 'arenaHighN', 'arenaStrat', 'arenaStratCap', 'arenaStratMix', 'sigFloor', 'sigRestart', 'arenaPen', 'arenaLex', 'arenaFloorPen', 'fxAll', 'preSel', 'fxQuota', 'fxQuotaPerIter', 'fxPaired', 'fxPairedK', 'boN', 'boNK', 'arenaShapeCap', 'arenaShapeTemp', 'arenaShapeGames', 'arenaDefCap', 'arenaJiCap', 'arenaWarmShape', 'arenaWarmTol', 'arenaShapeRel', 'arenaShapeRelDef', 'arenaShapeRelJi', 'arenaShapePick', 'arenaPerN', 'headGate', 'headFixtures', 'headTemp', 'verifGate', 'label', 'funnel', 'funnelGames', 'arenaPool', 'arenaShapes'], 'probe-cem-arm');

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const MODE = arg('mode', '');
if (MODE !== 'ga' && MODE !== 'cem' && MODE !== 'esa') {
  console.error('⛔ --mode 只认 ga|cem|esa（实测 ' + (MODE || '(空)') + '）。本工具只吃 --旗标，不吃位置参数。');
  process.exit(64);
}
const EVALS = Number(arg('evals', 2000));
const POP = Number(arg('pop', 14));
const GAMES = Number(arg('games', 4));
/* ⚑ 漏斗式两阶段选择（用户 10-31 晚裁“可以做，只要效果好”）：默认 0 = 现役 flat（每候选 GAMES 局）逐字不变；
 *   >0 ⇒ 同代先给每粒 FUNNEL_S1 局，前 FUNNEL 粒补到 GAMES 局，精英按**补完后的总均值**排⇒ 同预算把局数花在分得开的人身上。 */
const FUNNEL = Math.max(0, Number(arg('funnel', 0)) || 0);
const FUNNEL_S1 = Math.max(1, Number(arg('funnelGames', 2)) || 2);
/* `--fxSelect=1`：ES 的当选改到**冻结桌**上判（gen=500，与终局读数 gen=999 那批桌**不是同一批** ⇒ 没在考卷上选答案） */
const FXSEL = Number(arg('fxSelect', 0)) > 0;
/* `--fxGames=`：当选用的冻结桌**每格打几局**。默认跟 `--games` 同档，但 10-29 的读数是：
 *   6 局的冻结桌读数自己就比父子差还吵 ⇒ 接受/拒绝成了掷硬币。要当筛子就得把这一档抬到几十局。 */
const FXG = Math.max(0, Number(arg('fxGames', 0)) || 0);   /* 0 = 沿用 --games（别让 Math.max(1,…) 把默认变成 1 局） */
const N = Number(arg('n', 3));
const SEED = Number(arg('seed', 7));
const ELITE = Number(arg('elite', 4));
const SIG0 = Number(arg('sig', 0.2));
const SIG_FLOOR = 0.01;
/* P4（10-29 深夜）：s11 的 1/5 律把 σ 一路除到 0.0001、全臂只接受 4 次 ⇒ 步长塌了还继续按老规矩缩短。
 *   `--sigFloor=`：自适应 σ 的下限（0 = 维持旧的 1e-4）；`--sigRestart=N`：触底且连续 N 个窗口零接受 ⇒ σ 回 SIG0（只回步长，不动父代）。 */
const SIG_FLOOR_ESA = Math.max(0, Number(arg('sigFloor', 0)) || 0);
const SIG_RESTART = Math.max(0, Math.floor(Number(arg('sigRestart', 0)) || 0));
/* `--arenaPen=λ`（10-29 深夜，DS §九.5 的处方）：冻结验证的**当选分**改成
 *   `fit − λ·max(0, 单卡占比 − 0.5)`。
 *   动机：Pareto 带（divTol/divDelta）三次都没咬住（41 次探针 0 次接受）；这里直接给"单卡 >50%"明码扣分，
 *   但**只影响当选**，终局仍报未罚的干净净胜（罚项买了多少，看两列差）。
 *   λ=0（缺省）与旧行为逐字相同。 */
const ARENA_PEN = Math.max(0, Number(arg('arenaPen', 0)) || 0);
/* `--fxPaired=1`（E8，10-30 上午）：**换父代要看配对显著性，不只看两次平均差**。
 *   动因（E7 实测，`scratch/LEXQ-s19-rerun.log`）：88 局的冻结桌单次读数 SE≈0.075，而六次接受的分差是
 *   0.011/0.047/0.067 ⇒ **全部落在 2SE 以内**，当选面其实在噪声带里翻牌。
 *   父子本来就打在**同一批局号**上（v2 起每局重置 bot 记忆 ⇒ 同局号=同局面），所以逐局配对是免费的：
 *   平均差不变，但标准误从"两批各自抖"变成"配对差抖"，于是同一个 88 局能问出"这次改进是不是真的"。
 *   开档时接受条件加一条 `配对 z ≥ --fxPairedK`（缺省 1）；缺省关档 ⇒ 逐字旧行为。 */
const FX_PAIRED = Number(arg('fxPaired', 0)) > 0;
const FX_PAIRED_K = Math.max(0, Number(arg('fxPairedK', 1)) || 1);
/* ===== `--boN=1`（DS · 10-30）：**best-of-generation 当选**，对照棘轮门 =====
 * 病（E7/E8，10-30）：每次接受都是 88 局读数、SE≈0.075，而父子分差 0.011~0.067 ⇒ 6 次接受全在噪声带内；
 *   加更严的统计（配对门）只是换一批种子翻好。⇒ 换的是**信息怎么花**：不逐个「过门才送验」，
 *   而是**一代所有子代在同一批环内局上排一次序，只把最好的那一个送 88 局确认**（送验次数≈代数）。
 *   环内局号 = gen*games+g（arena2 loop 相位，与 idx 无关）⇒ 同代子代本来就吃同一批局，排序是同批比较。
 * 默认关 ⇒ 旧路径逐字不变（已用 --boN=0 的 md5 复现腿验过）。 */
const BO_N = arg('boN', '') === '1';
const BO_N_K = Math.max(1, Math.floor(Number(arg('boNK', 1)) || 1));
/* ===== `--arenaShapeCap=x`（DS · 10-30，用户裁定「必须先有多样性再考虑强度」）=====
 * 把「形状」做成**可行性约束**（词典序第一关键字），而不是 0.06 那样的小奖励：
 *   子代的非ジ单卡占比 > x ⇒ 直接不可接受（不管 fit 涨多少）。x=0（缺省）= 关，逐字旧行为。
 * 理由：2.0 的臂走 arena2 的 clean/net 分，**根本不经过 evo.js 的 F=H+T·G**（那条只在非 arena2 路径里），
 *   所以单卡在 2.0 训练里没有任何扣分；而 1.8 的 DIV_W=0.06 自身也远小于胜负项（见 evo.js:2462）。
 * 形状约束把「下限」写成硬条件：先保证不退化，再在可行域里比强度。 */
const SHAPE_CAP = Math.max(0, Math.min(1, Number(arg('arenaShapeCap', 0)) || 0));
/* 10-30 二版：形状读数**测在报告条件**（锐温度）+ 多键。
 * 病（一版）：约束在 frozen@0.15 上读，报告在 holdout@最佳温度上读 ⇒ s11 训练 36%、报告 81%。
 * 修：形状单独评一次 frozen，用 `--arenaShapeTemp`（缺省 0.05，最锐）与 `--arenaShapeGames`（每格 4 局=44 局）；
 *    同时卡 防御占比（--arenaDefCap）与 ji 占比（--arenaJiCap），防「把一招换成 ji」稀释。 */
const SHAPE_TEMP = Number(arg('arenaShapeTemp', 0.05));
const SHAPE_GAMES = Math.max(2, Math.floor(Number(arg('arenaShapeGames', 4)) || 4));
const DEF_CAP = Math.max(0, Math.min(1, Number(arg('arenaDefCap', 0)) || 0));
const JI_CAP = Math.max(0, Math.min(1, Number(arg('arenaJiCap', 0)) || 0));
const DEF_KEYS = ['guard', 'reflect', 'bagua', 'shift', 'jinshield', 'proto', 'armor', 'holo'];
let lastShapeStat = null;
/* `--arenaPerN=1`（DS · 10-30，用户「跨环境适应」）：词典序的**聚合层从 (n,hp) 格换成 N 组**。
 * 病：验收是 11 格平均 ⇒ 2P/3P 的强项盖住 8P/10P 的塌方（v7 自己 2P 0.300 / 8P 0.086 / 10P −0.028）。
 * 做法：同一 N 的各 hp 模式取平均，比较「candN − v7N」：先比低于地板的 N 数，再比最差 N 余量，最后比总分。
 * 默认 0 = 旧的 (n,hp) 词典序。 */
const ARENA_PER_N = Number(arg('arenaPerN', 0)) > 0;
/* ===== `--arenaWarmShape=N`（DS · 10-30，方案 A 两阶段）=====
 * 前 N 局只做**形状闸**、不按强度强化（接受条件退成 `fit ≥ 父代 − --arenaWarmTol`，缺省 0.05 的宽带），
 * N 局之后恢复原来的词典序/配对/罚项。目的：先把种群移进形状可行域，再在可行域里强化度。
 * N=0（缺省）⇒ 逐字旧行为。 */
const WARM_SHAPE = Math.max(0, Math.floor(Number(arg('arenaWarmShape', 0)) || 0));
const WARM_TOL = Math.max(0, Number(arg('arenaWarmTol', 0.05)) || 0.05);
/* `--arenaShapeRel=e`（DS · 10-30，相对约束）：子代每键 ≤ 父代 + e ⇒ **起点永远可行**，且父代变好时约束自动收紧。
 * 绝对 cap 的教训：起点 t=0.05 单卡 44.1%，cap 0.50 只留 6pp；实测 43 次送验里单卡挡 28、防御挡 25、ji 挡 6 ⇒ 可行域几乎空。
 * 默认 0 = 关；三键各一个容差（share/def/ji）。 */
const SHAPE_REL = Math.max(0, Number(arg('arenaShapeRel', 0)) || 0);
const REL_DEF = Math.max(0, Number(arg('arenaShapeRelDef', 0.08)) || 0.08);
const REL_JI = Math.max(0, Number(arg('arenaShapeRelJi', 0.08)) || 0.08);
let parentShapeStat = null;
/* `--arenaShapePick=1`（DS · 10-30，归档 + 终选）：**搜索不变**（不因形状拒绝任何子代），
 * 但每次接受时把候选（含起点）连同形状一起存进 archive；终局时在**形状合格**的归档里挑 fit 最高的一枚作为产物。
 * 这样既不会把搜索饿死（v2 的教训：43 次送验只有 5 个过形状闸），又保证产物在报告相位上形状合格。
 * 形状合格线用同一组 `--arenaShapeCap/DefCap/JiCap`（在 SHAPE_TEMP 上读）。默认 0 = 关。 */
const SHAPE_PICK = Number(arg('arenaShapePick', 0)) > 0;
const shapeArchive = [];
/* ===== `--arenaLex=1`（#161，ZCode · 10-30 夜）：**分格无权词典序当选** =====
 * 动因：6k 包 2P 65~75% vs 10P 28% 的剖面被标量平均吞掉。冻结桌上的接受判据从标量改成 (n,hp) 格词典序：
 *   先比「低于地板的格数」（少者优先），再比「最差格余量」（大者优先），最后才比总分。
 * 地板 = v7 在**同一张冻结桌**（phase=frozen、同 salt、同局号）上的逐格读数 ⇒ 父子同局配对（CRN），格间不互相加权。
 * 只换接受判据这一格；环内预选、Pareto 多样性带、终局读数全部不动 ⇒ 与同参数标量臂是**一变量对照**。
 * 判据（预登记，HANDOFF §四 P0-2）：8P/10P 每格 ≥ v7−3pt ‖ 总干净胜 ≥ 同起点标量臂最佳(0.211)−2pt ‖ 3 种子最小值 ≥ v7 同场 ≈0.10。
 * ⚠ 与 `--arenaPen` 互斥：两者都换 byScore 的判据，同时开 = 一次对照两个自由量。 */
const ARENA_LEX = arg('arenaLex', '') === '1';
/* ===== `--arenaFloorPen=λ`（10-30 凌晨，#161 的预登记落点）：**标量 + 分格地板罚项** =====
 * 预登记（HANDOFF §四 P0-2）："任一条不过 ⇒ 词典序不成立，回标量 + 分格罚项" ⇒ 这就是那条回退路。
 * 当选分 = `fit − λ·Σ_k max(0, v7地板_k − 格分_k)`（连续版词典序：低于地板的格按差额扣分，不设跳变）；
 * 与词典序的区别：允许"低一格买两格"的交易（词典序先数格数不许交易），λ 控制汇率。
 * 判据沿用 P0-2 同一套三条（8P/10P 每格 ≥ v7−3pt ‖ 总 ≥ 0.211−2pt ‖ 3 种子最小 ≥ v7 同场）。
 * ⚠ 与 --arenaLex / --arenaPen 互斥（都换 byScore 判据）。 */
const ARENA_FPEN = Math.max(0, Number(arg('arenaFloorPen', 0)) || 0);
/* ===== `--fxAll=1`（10-30 凌晨，坏种子诊断刀）：**拆掉环内预选门** =====
 * 病（10-30 剂量-响应实测）：坏种子（s7/s17）的接受率 ≈3.7%（预选 246 次只过 9 次），24k 预算 s17 零接受。
 * 问：是"循环分门把能过冻结桌的子代挡在外面"，还是"那片区域真的贫瘠"？
 * 本旗标让**每个子代都上冻结桌验证**（预选门短路；预算照记 ⇒ 迭代数会掉一个量级，只做诊断不做常规训练）。
 * 判读：同预算下接受数若显著高于带门版（s7@6k = 5 次）⇒ 门是阻塞点；接近 ⇒ 区域贫瘠。 */
const FXALL = arg('fxAll', '') === '1';
/* ===== `--preSel=parent`（10-30 晨，坏种子机制的处方刀）：预选门从"≥全局 best"换成"≥父代" =====
 * 机制（10-30 fxAll 诊断）：坏种子起步深负，全局 bestFit 被好种子的动力学定标 ⇒ 坏种子的子代循环分
 *   几乎永远过不了门 ⇒ 冻结桌验证被饿死（6k 只验 60 次、接受 5 次）。fxAll 证明区域不贫瘠，但 fxAll
 *   把生成量全卖了（好种子塌）。parent 门是中间点：子代循环分 ≥ 父代循环分就送验（循环分是 4 局噪声，
 *   ≈40-50% 通过率）⇒ 生成量保留大半、验证密度翻 ~3 倍。
 * ⚠ 只改预选门这一格；接受判据/多样性带/终局读数不动。判读见回执 §九（预登记先于开臂）。 */
const PRESEL = String(arg('preSel', 'best'));

/* ===== 响亮失败第二型（10-31 千问）：**旗标认识、但这条路上不生效** =====
 * 起因是实测：我给 `--mode=cem` 的臂带了 `--arenaLex=1 --fxSelect=1 --arenaDefCap=… --arenaShapeCap=…`，
 *   结果两臂与不带这些旗标的臂**逐位相同**（净胜 −0.013 / −0.080、达标 2 / 1 一模一样）——因为这些闸全都住在
 *   `verifyChild()`（ESA 那条路的冻结桌送验）里，CEM 分支根本不经过它。
 *   `rejectUnknownFlags` 拦不住这种（旗标名是对的），而回执里写一句"这臂开了词典序"就是假话。
 * ⚑ 另一头的对称事实（同一处审计查出来的）：`--masteryKey` 的**行为门只在 CEM 分支**实现
 *   ⇒ "既要行为门、又要形状闸"这一格**当前没有一条路能跑**，要跑得先接线，不是加旗标。 */
/* 名单 = **实测**出来的，不是我读码猜的（同一颗小预算 pop8/evals40/seed5，产物 md5 逐个对）：
 *   不生效：fxSelect ‖ fxGames ‖ fxAll ‖ arenaPen ‖ arenaFloorPen ‖ arenaDiverse ‖ boN ‖ arenaShapeCap ‖ arenaDefCap ‖
 *           arenaJiCap ‖ arenaShapeRel ‖ arenaWarmShape ‖ arenaShapePick ‖ arenaPerN ‖ preSel（全部与不带的基线 md5 `6b3d954b` 相同）
 *   **生效、不许 warn**：arenaCur（换货币 ⇒ md5 `b5ac3976`）‖ arenaHighN（改训练环桌形权重 ⇒ md5 `ca380954`）
 *   `--arenaLex` 由它自己的闸硬拦（"需要 --fxSelect=1"），所以不在此列。
 *   证据文件：`scratch/FLZ-*.err` ‖ 产物 md5 对照见本次提交说明。 */
const IGNORED_IN_CEM = (MODE === 'cem') ? ['--fxSelect', '--fxGames', '--fxAll', '--arenaPen', '--arenaFloorPen',
  '--arenaDiverse', '--boN', '--arenaShapeCap', '--arenaDefCap', '--arenaJiCap', '--arenaShapeRel',
  '--arenaWarmShape', '--arenaShapePick', '--arenaPerN', '--preSel']
  .filter((f) => { const k = f.slice(2); const v = arg(k, ''); return v !== '' && v !== '0' && v !== 'parent'; }) : [];
if (IGNORED_IN_CEM.length) {
  console.log('⚠ **这几个旗标只住在 `mode=esa` 那条路（`verifyChild` 的冻结桌送验）里 ⇒ 本臂是 cem，它们一概不生效**：' + IGNORED_IN_CEM.join(' ‖ '));
  console.log('   （实测依据：同一 seed 带与不带这些旗标，产物逐位相同。引用本臂时**不许**写"它开了词典序/形状闸"。）');
}
const DEG = arg('degenerate', '') === '1';
/* ===== §E822（10-28 傍晚 · 千问）：`--targetGames=` ⇒ **按计数器停，不按记账停** =====
 * 为什么必须加：实测同一 GA 的"每代真打几局"**不是常数**（60 evals 校准时 ≈8 局/代，6000 evals 真跑时 ≈2 局/代
 *   ⇒ 因为 `EpirusTrainer.step` 每代评估的新粒数随精英/移民/σ 退火变）。所以"把 `--evals` 配平等预算"这条路
 *   本身就不可行 —— 唯一可靠的货币是**数出来的局数**。给了这个旗标就忽略 `--evals`（后者只当"计划剂量"印着）。 */
const TARGET_G = Number(arg('targetGames', 0)) || 0;
const QUIET = process.argv.includes('--quiet');
/* `--headGate=1`（10-30 傍晚，用户“也可以”）：**平头包不许当冠军**。
 *   动因：代 2 短臂在同一批真局上集中度 max(p)×K 只有 2.02（v7 是 27.00、熵占比 0.000），
 *   实测后果是“换一枚包，对局记录逐字相同”（随机初始化包也打出同一局）⇒ 分数却照样能当选。
 *   缺省 0 ⇒ 只量不判、逐字不改历史臂；判据阈值只在 head-health.mjs 一处。 */
const HEAD_GATE = Number(arg('headGate', 0)) > 0;
/* `--verifGate=1`（10-30 傍晚 · 训练侧专用，**不进发布门禁**，按用户 10-30 裁定）：
 *   病（今天抓到的）：`--arenaPerN=1` + 弱/随机起点下，整臂可以 `accepted=0 verifications=0` 跑完 1120 次评估
 *     而 **fit、曲线、holdout、健康度照样全部出数** ⇒ 读起来像"训练没效果"，实际是"子代根本没被送去验证"
 *     （搜索全程没问过考卷，只在起点重测里抖）。代 1 的三臂同配方也是 0 ⇒ 这条与换代无关，是配方的病。
 *   判据只钉"有没有被问过"这一件可机器判的事；"该问几次"依配方而变，不写死。 */
const VERIF_GATE = Number(arg('verifGate', 0)) > 0;

/* ===== `--masteryKey=`（ZCode · 10-31 凌晨，P4 大雷桶）：CEM 路径的 mastery 验收门 =====
 * 结构出处：ARCH-2026-10-31-BUCKET-POOL（分桶专家池）——"验收收紧进选择"。
 * CEM 路径本来**没有 accept/verify 事件**（CEM48c meta 里 arenaLex=true 实为死旗，本日查明）⇒ 门落在两处：
 *   elite 档（缺省）：精英重拟合只吃"行为达标"的候选——按 fit 降序逐个 cheap 审计（同批固定局号=配对），
 *     攒满 ELITE 个达标者或审计预算（--masteryCap，缺省 16 次/代）用尽为止；
 *     达标者 <2 ⇒ 本代退回纯 fit 精英并记 starved（搜索不饿死，压力按代记账）。
 *   best 档：产物 best 必须达标——top-fit 不达标就沿 fit 降序往下审，审到的第一个达标且超 bestFit 者当产物。
 * 审计 = skill-mastery 的 auditCells（**同一段代码**，正式尺只差局数）：long n=3 × 12 局 × t=ARENA_TEMP。 */
const MASTERY_KEY = arg('masteryKey', '');
const MASTERY_GATE = arg('masteryGate', 'elite');   /* elite | best | off */
const MASTERY_LINE = Number(arg('masteryLine', 0.1));
const MASTERY_GAMES = Math.max(2, Number(arg('masteryGames', 12)) || 12);
const MASTERY_N = Math.max(2, Number(arg('masteryN', 3)) || 3);
const MASTERY_TABLE = arg('masteryTable', 'long');
const MASTERY_CAP = Math.max(2, Number(arg('masteryCap', 16)) || 16);
/* `--masterySem=1`（勘误六）：达标数从"出手率"换"语义命中数/局"（laserEye→打防席、miniT→打 [ep≥2 ∧ 最近 4 回合蓄过珠]
 * 用户、cannon→第3下打ep顶的三连；auditCells 的 sem/chains 计数，不加第二套）。动机：LASER1 的用量-语义反比。 */
const MASTERY_SEM = Number(arg('masterySem', 0)) > 0;
/* `--masteryMax=`（勘误八）：防滥刷上界——cheap 审计该键超过上界 ⇒ 记 spam、不进达标者（0=关）。
 * 动机：桶内 clean 双峰，上枝=门 shaped 后滑进刷分区（大雷 3~5/局）。 */
const MASTERY_MAX = Number(arg('masteryMax', 0)) || 0;
const MASTERY_ON = !!(MASTERY_KEY && MASTERY_KEY !== 'off' && MASTERY_GATE !== 'off');
const HEAD_FIX = Math.max(2, Number(arg('headFixtures', 12)) || 12);
const HEAD_TEMP = Number(arg('headTemp', 0.15)) || 0.15;
const START_PACK = arg('start', 'docs/artifacts/eval-out/win-Ldemo.bak');
if (!/^[a-zA-Z0-9._/-]+.(bak|js)$/.test(START_PACK)) { console.error('⛔ --start 要一个仓库内包文件（实测 ' + START_PACK + '）'); process.exit(64); }
let OUT = arg('out', '');       // 缺省时由 `defaultOut()` 在**起点定下来之后**拼（名字要带得上父本，见下）
/* ===== §E822（用户 10-28 傍晚裁定：「以后给一个默认落盘路径吧」）=====
 * 病（今天我自己踩的）：`--out` 缺省为空 ⇒ 三臂跑完**权重没落盘**，事后任何别的尺都量不到它们
 *   （组内判别力、12 行、演化图……全都要重新训一遍才能问）。臂的产物本身就是读数的一部分。
 * 默认落点选 `scratch/arms/` 而不是 `docs/artifacts/`：后者是门禁比哈希的活文件夹，
 *   研究臂默认往里撒 `.bak` 会当场吃 `D191`（未登记重复）——这条提醒写在 `tools/train-3p.mjs:2493-2500`。
 *   要入库/进图的包仍由人**显式**点名搬到 `docs/artifacts/`（默认值不该替人做入库决定）。 */
/* ===== 落盘名字的规则 v2（用户 10-30 晚两次点名："设得有规律一些" → "太长了，进演化图是灾难"）=====
 * **名字只当身份证，描述全进索引**：
 *   文件名 = `<label>-<n>.bak`，`n` = 该 label 现有最大序号 +1（扫目录得 ⇒ 无状态文件、不撞名）
 *   其余字段（代/预算/父本/seed/起点分/终点分/agree/集中度/单卡/秒数/内容 hash）进 `scratch/arms/index.tsv`
 *     —— 一臂一行、制表符分隔、追加写；分析与演化图都读这张表，**不许再解析文件名**
 *     （v1 那串长名字在图里既不可读也不可比较：那是我把"要有规律"错做成了"把所有字段塞进名字"）。
 * ⚑ 名字里刻意**不写父本**：写了就会在"起点被拒 ⇒ 其实从随机粒起跑"的那批臂上，
 *   留下一个声称自己有父本的文件名（"名字比读数会说话"是本仓最怕的那一族）。父本只进 `lineage.parent` 与索引列。 */
const LABEL = String(arg('label', '')).replace(/[^A-Za-z0-9+]/g, '').slice(0, 14) || 'arm';
function nextSeq(dir, label) {
  let mx = 0;
  const rx = new RegExp('^' + label + '-(\\d+)\\.bak$');
  try { for (const f of readdirSync(dir)) { const m = rx.exec(f); if (m) mx = Math.max(mx, Number(m[1])); } } catch (e) { /* 目录还没有 ⇒ 从 1 开始 */ }
  return mx + 1;
}
function defaultOut() {
  const dir = 'scratch/arms';
  return dir + '/' + LABEL + '-' + nextSeq(dir, LABEL) + '.bak';
}
/** 短 ID = 文件名去扩展名 ⇒ 演化图的节点键；父本引用也用同一套键 */
function armId(o) { return String(o || '').replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, ''); }

const W = sandbox(HERE + '/..');
const T = W.EpirusTrainer, P = W.EpirusPolicy, R = W.EpirusRules;
const TMODE = arg('trainMode', 'multi');
if (T.setTrainMode) T.setTrainMode(TMODE);
if (T.trainMode && T.trainMode() !== TMODE) { console.error('⛔ 桌形没生效（要 ' + TMODE + ' 读到 ' + (T.trainMode && T.trainMode()) + '）⇒ 记下来的口径是假的'); process.exit(2); }
const HOLD = Number(arg('holdoutGames', 60));
/* ===== `--playtemp=`（10-29 02:4x 千问，任务 #142 那一格的开关）=====
 * 动因是量出来的两条：① 2.0 头的 logits 间距只有 ~0.3，而 v7 的分差是 ~50 ⇒ **同一个绝对 temp 下 2.0 打得近似掷硬币**
 *   （同一粒在 16 格上：temp=0.6 读 18.1%、temp=0.001 读 33.6%）；② v7 自己那两条路的 softmax 是饱和的 ⇒ 它**本来就是贪心**。
 *   ⇒ 拿"高熵的 2.0"去比"贪心的 v7 对手"，整局货币当然平。这一档把评估/考核的温度显式压低（只动研究量具，`js/**` 不改）。
 * ⚑ 自证：设完必须回读 `trainEps().temp`，读到不算数就当场停——"接上了"和"生效了"是两件事（§E822 那族的教训）。
 * ⚠ 开了它，**适应度的刻度就换了**（贪心赢面 ≠ 抽样赢面）⇒ 只能与同档的臂互比，也不许与 dFirst<原档> 那批并排引用。 */
const PLAYTEMP = arg('playtemp', '');
if (PLAYTEMP !== '') {
  const t = Number(PLAYTEMP);
  if (!(t > 0)) { console.error('⛔ --playtemp 要正数（收到 ' + PLAYTEMP + '）'); process.exit(2); }
  const cur = T.trainEps ? T.trainEps() : null;
  T.setTrainEps(cur ? cur.eps : 0, cur ? cur.k : 5, cur ? cur.mode : 'soft', t);
  const back = T.trainEps ? T.trainEps() : {};
  if (back.temp !== t) { console.error('⛔ --playtemp 没生效（设 ' + t + ' 回读 ' + back.temp + '）'); process.exit(2); }
  console.log('[cem-arm] ⚙ 评估温度钉成 temp=' + t + '（回读 trainEps()=' + JSON.stringify(back) + '）‖ ⚠ 这一档换了适应度刻度，只与同档臂互比');
}
/* ===== `--arena2=1`（10-29 夜 · 用户裁定「扩 arena 之后再训练一批」）=====
 * 换掉 `scoreMemberN` 那套 shaped 适应度：每评估仍只打 GAMES 局（`--targetGames` 的记账口径不变），
 *   但**对手席**从扩表（20 脚本 bot + 30 单技能固定打法 + 均匀随机）轮换、**桌形**从 11 格（2/3/5/8/10 人 × 3/4/5 血）轮换。
 * 货币是**净胜** `(wv−1/n)/(1−1/n)`（胜 1 / 平 0.5 / 负 0）而不是 shaped fit ⇒ 与旧臂的 `fit` 数值不可比，
 *   跨臂只比同一 arena2 档的读数。终局读数走 `--arenaHold=` 局/桌形（缺省 20）；`--fxSelect` 的冻结验证也走全桌形固定局号。
 * ⚠ v7 参照必须在 `installArch2` **之前**读出（arch2 的 unpack 只认 v90）；本工具用它与 profile2/ladder 同一张对手表。 */
const ARENA2 = arg('arena2', '') === '1';
const ARENA_HOLD = Math.max(2, Number(arg('arenaHold', 20)) || 20);
const ARENA_TEMP = (function () { const x = Number(arg('arenaTemp', arg('playtemp', 0.15))); return x > 0 ? x : 0.15; })();
/* `--arenaCur=net|clean`（10-29 夜 (a) 臂）：把训练货币从"净胜"换成"干净胜"（winner=我 且 hp>0；平/死者胜都按 0）。
 * 只换货币，别的一字不动 ⇒ 与同种子同预算的纯净胜臂是一变量对照。 */
const ARENA_CUR = String(arg('arenaCur', 'net'));
if (ARENA_CUR !== 'net' && ARENA_CUR !== 'clean' && ARENA_CUR !== 'first') { console.error('⛔ --arenaCur 只认 net|clean|first（收到 ' + ARENA_CUR + '）'); process.exit(2); }
/* ⚑ 响亮闸（ZCode · 10-31 晚，P-P5 首遍发臂当场栽的）：arena2 只在 `--arena2=1` 时建表，不带它 ⇒
 *   `evalOne` 静默掉进 `T.scoreMemberN` 内部对手表，而 `--arenaCur/--arenaStrat/…` 那一族在那条路上
 *   **全部不生效**（meta 里 `arena:null` / `currency:"scoreMemberN.fit"` 是事后才看得见的报警）。
 *   点了 arena 族旗标却不给 `--arena2=1` ⇒ 当场拒跑。 */
if (!ARENA2 && ['arenaCur', 'arenaStrat', 'arenaStratCap', 'arenaStratMix', 'arenaHold', 'arenaHighN', 'arenaDiverse']
    .some((k) => argv.some((x) => x === '--' + k || x.startsWith('--' + k + '=')))) {
  console.error('⛔ 点了 arena2 族旗标却没给 `--arena2=1` ⇒ arena2 桌不会建、这族旗标会静默掉进 scoreMemberN 内部对手表（10-31 晚 P-P5 首遍就是这么废的）。要么加 `--arena2=1`，要么去掉这族旗标。'); process.exit(2);
}
/* `--arenaDiverse=1`（10-29 夜 (b) 臂）：净胜货币不变，**当选**加一条 Pareto 带：
 * 冻结验证里若 `净胜 ≥ 父代 − divTol` 且 `单卡占比 ≤ 父代 − divDelta` ⇒ 也接受（同分带选单卡低的）。
 * 为了不让"只反弹"父代把整轮卡死，父代单卡 >0.5 时每 divEvery 个子代无条件送一次冻结验证。 */
const ARENA_DIV = arg('arenaDiverse', '') === '1';
const DIV_TOL = Math.max(0, Number(arg('divTol', 0.02)) || 0.02);
const DIV_DELTA = Math.max(0.01, Number(arg('divDelta', 0.10)) || 0.10);
const DIV_EVERY = Math.max(1, Math.floor(Number(arg('divEvery', 10)) || 10));
/* `--divTrigger=`：父代单卡占比**超过它才开探针**（缺省 0.5 = 只在明显退化时）。
 * 组合臂从 CLEAN-s7（单卡 49%）出发 ⇒ 用 0.40 让多样性真正开始工作；纯 net 臂维持 0.5。 */
const DIV_TRIGGER = Math.min(1, Math.max(0, Number(arg('divTrigger', 0.5)) || 0.5));
/* `--arenaHighN=3`：**高人数课程**，只把训练环里 n≥8 的桌形重复 3 次（终局仍均匀 11 格）。
 * 用来判 8P/10P 的弱是"训练里见得少"还是"表示/池化不行"；不改变读数口径。 */
const ARENA_HIGH_N = Math.max(1, Math.floor(Number(arg('arenaHighN', 1)) || 1));
/* `--arenaStrat=1|full|mild`（DS P1）：分层场——每局非被测席优先塞 bigT/reflect/snipe/guard 轮换，
 *   让"只一招"每局都见到天敌，平均分不再被 51 项 roster 稀释。终局也用同一分层场（DS 提交的口径）。
 *   `mild` = 每局 ≤2 只捕食者、50% 的局用分层场（满编场把 v7 打到机会线 ⇒ 减毒）。 */
const ARENA_STRAT_ARG = String(arg('arenaStrat', ''));
const ARENA_STRAT = ARENA_STRAT_ARG === '1' || ARENA_STRAT_ARG === 'full' || ARENA_STRAT_ARG === 'mild';
const ARENA_STRAT_CAP = arg('arenaStratCap', ARENA_STRAT_ARG === 'mild' ? '2' : '') || undefined;
const ARENA_STRAT_MIX = arg('arenaStratMix', ARENA_STRAT_ARG === 'mild' ? '0.5' : '') || undefined;
if (ARENA_DIV && (!ARENA2 || !FXSEL)) { console.error('⛔ --arenaDiverse 需要 --arena2=1 且 --fxSelect=1（多样性只读冻结验证那一把）'); process.exit(7); }
if (ARENA_LEX && (!ARENA2 || !FXSEL)) { console.error('⛔ --arenaLex 需要 --arena2=1 且 --fxSelect=1（词典序只换冻结桌的接受判据）'); process.exit(7); }
if (ARENA_LEX && ARENA_PEN > 0) { console.error('⛔ --arenaLex 与 --arenaPen 互斥（都换 byScore 的判据，一次对照只许一个自由量）'); process.exit(7); }
      if (ARENA_FPEN > 0 && (!ARENA2 || !FXSEL)) { console.error('⛔ --arenaFloorPen 需要 --arena2=1 且 --fxSelect=1（地板罚项只换冻结桌的接受判据）'); process.exit(7); }
      if (ARENA_FPEN > 0 && (ARENA_LEX || ARENA_PEN > 0)) { console.error('⛔ --arenaFloorPen 与 --arenaLex/--arenaPen 互斥（都换 byScore 的判据）'); process.exit(7); }
      if (FXALL && (!FXSEL || !ARENA2)) { console.error('⛔ --fxAll 需要 --fxSelect=1 且 --arena2=1（它拆的是冻结桌预选门）'); process.exit(7); }
if (BO_N && (!FXSEL || !ARENA2)) { console.error('⛔ --boN=1 需要 --fxSelect=1 且 --arena2=1（它换的是冻结桌当选形状）'); process.exit(7); }
if (BO_N && (FXALL || arg('fxQuota', '') !== '' || PRESEL === 'parent' || (Number(arg('arenaDiverse', 0)) > 0))) { console.error('⛔ --boN 与 fxAll/fxQuota/preSel=parent/arenaDiverse 互斥（一次只换一个自由量）'); process.exit(7); }
      if (PRESEL !== 'best' && PRESEL !== 'parent') { console.error('⛔ --preSel 只认 best|parent（收到 ' + PRESEL + '）'); process.exit(7); }
      if (PRESEL === 'parent' && (!FXSEL || !ARENA2)) { console.error('⛔ --preSel=parent 需要 --fxSelect=1 且 --arena2=1（它换的是冻结桌预选门）'); process.exit(7); }
      if (PRESEL === 'parent' && FXALL) { console.error('⛔ --preSel=parent 与 --fxAll 互斥（都改预选门，一次对照一个自由量）'); process.exit(7); }
/* 健康度量的 v7 参照：**必须在装 2.0 档之前**读（装完之后 `P.unpack` 只认 2.0 容器 ⇒ 那时再读就是 null，
  这条纪律在册是 selftest2 的 T14 教的）。--arena2 已经读过一次，没开 arena2 的臂这里补读。 */
let V7_HEALTH_REF = null;
let ARENA_ROSTER = null;   /* --arenaPool=product 时 = 产品 7 脚本的 chooser 表（考卷搬迁） */
let ARENA_SHAPES = null;   /* --arenaShapes 覆盖（缺省 = 产品两格 3:multi,5:multi） */
let ARENA_REF = null;
if (ARENA2) {
  const c0 = loadChamp(W, 'js/bundled-champion-3p.js', HERE + '/..');
  if (!c0) { console.error('⛔ --arena2 需要 v7 参照包来固定对手表，但读不出 js/bundled-champion-3p.js'); process.exit(2); }
  ARENA_REF = Float64Array.from(c0);
  V7_HEALTH_REF = Float64Array.from(c0);
  if (MODE === 'ga') { console.error('⛔ --arena2 没接 GA 的内部 trainer（它走 T.makeTrainer/step，不吃本工具的 evalOne）⇒ 拒绝静默按旧口径跑'); process.exit(7); }
  /* `--arenaPool=product`（ZCode · 10-31 深夜，考卷搬迁）：对手池整表换成**产品 7 脚本**（eval-5p 的 CORE 池；
   *   单一来源 = server/opp-pool.mjs `OPP_SPECS` + tools/bot-chooser-lib.mjs `makeAsChooser`——评测同款包装）。
   *   `--arenaShapes=3:multi,5:multi`（缺省 = 产品两格）。⚑ 分层在自选池上被 arena2 响亮拒（捕食者行不在池里）。 */
  const ARENA_POOL_ARG = String(arg('arenaPool', ''));
  if (ARENA_POOL_ARG && ARENA_POOL_ARG !== 'product') { console.error('⛔ --arenaPool 只认 product（收到 ' + ARENA_POOL_ARG + '）'); process.exit(2); }
  if (ARENA_POOL_ARG === 'product') {
    const PRODUCT7 = ['random', 'defend', 'antidef', 'wall', 'farmer', 'heavyfire', 'deepsaver'];
    const asC = makeAsChooser({ T: T, R: W.EpirusRules });
    ARENA_ROSTER = OPP_SPECS.filter((x) => PRODUCT7.indexOf(x.name) >= 0).map((x) => {
      const fn = W.EpirusBots[x.fn];
      if (typeof fn !== 'function') { console.error('⛔ 产品池缺函数：' + x.fn + '（核对 server/opp-pool.mjs 与 js/train/bots.js）'); process.exit(2); }
      return { name: x.name, kind: 'bot', sel: asC(fn) };
    });
    if (ARENA_ROSTER.length !== PRODUCT7.length) { console.error('⛔ 产品池 7 脚本没凑齐（得到 ' + ARENA_ROSTER.length + '）'); process.exit(2); }
    const SHP = String(arg('arenaShapes', '3:multi,5:multi'));
    ARENA_SHAPES = SHP.split(',').map((s) => { const m = /^(\d+):([a-z0-9]+)$/i.exec(s.trim()); if (!m) { console.error('⛔ --arenaShapes 格式 n:mode（收到 ' + s + '）'); process.exit(2); } return { n: Number(m[1]), mode: m[2] }; });
  }
}
/* ===== §E821（10-28 傍晚 · 千问）：`EPIRUS_ARCH2` ⇒ 两臂都训在 **2.0 结构**上 =====
 * 与 `tools/train-3p.mjs` 那处同一手法（覆盖沙箱里的导出入口，`js/**` 不动 ⇒ 规则指纹不变），
 *   所以 GA / CEM 两个模式**天然吃到同一份 DIM 与同一套算子** —— 这正是"优化器 × 新结构"要的同场对照。
 * ⚠ 结构换成 2.0 之后，`--start` 那枚在册 v7 夹具包**读不进来**（本工具的 `unpack` 已被覆盖 ⇒ 走它本来就有的
 *   "退回固定种子随机粒"那条腿）⇒ 起点标签会印 `makePolicy(0.25)`，**这是设计而非事故**：
 *   2.0 没有热启动来源，两臂同起点随机、只差算子。 */
if (process.env.EPIRUS_ARCH2) {
  const parts = String(process.env.EPIRUS_ARCH2).split(':');
  const cfg = { mutMode: String(process.env.EPIRUS_MUT_MODE || 'seg') };
  if (parts[1]) parts[1].split(',').forEach(function (kv) { const e = kv.split('='); if (e.length === 2) {
    const k0 = e[0].trim();
    /* `mutOnly=` 是**段名表**（P2 的"只动最后一层"）⇒ 不许过 Number()，多段用 `+` 连（`,` 已是 kv 分隔符） */
    cfg[k0] = (k0 === 'input') ? e[1].trim() : (k0 === 'mutOnly') ? e[1].trim() : Number(e[1]);
  } });
  if (!ARENA2) { const c9 = loadChamp(W, 'js/bundled-champion-3p.js', HERE + '/..'); if (c9) V7_HEALTH_REF = Float64Array.from(c9); }   /* 没开 arena2 也要有 v7 参照：装档之后就读不出了 */
  const A2 = installArch2(W, cfg);
  if (T.mulberry32) A2.rngRef.r = T.mulberry32((SEED * 7919 + 13) >>> 0);
  /* ⚑ **开臂前的接线自证**（10-28 晚三波读数作废换来的闸）：打一局量一下 `forwardCands` 有没有被叫到。
   *   没叫到 ⇒ 训练环在走 v7/旧口径分支（`evo.js:21` 的 `LEGACY(params)` 把认不出形状的包判成旧包），
   *   这时整批臂的 `fit` 照样出数、臂照样跑完 ⇒ "没崩"与"接上了"同形。宁可开不了臂。 */
  let wired;
  try { wired = verifyArch2Wired(W, A2, { mode: TMODE, n: N, games: 1 }); }
  catch (e) { console.error('⛔ ' + String(e && e.message || e)); process.exit(7); }
  console.log('[cem-arm] ⚙ 架构 = 2.0 原型 `' + process.env.EPIRUS_ARCH2 + '`（§E821） ‖ paramCount=' + P.paramCount() +
    ' ‖ 变异算子=' + cfg.mutMode + (cfg.mutOnly ? '（**只动 ' + cfg.mutOnly + '**）' : '') + ' ‖ 起点=' + (process.argv.some(x => x.startsWith('--start=')) ? '--start 已给（**这一行不判接受与否** ⇒ 看下面的 `起点分母：…` 或那条 ⚠）' : '随机（makePolicy 0.25）') +
    ' ‖ **接线自证 PASS**：校准局里 forwardCands ' + wired.forwards + ' 次 ‖ chooseCandidates(2.0 版) ' + wired.chooseCandidatesCalls + ' 次 ‖ fit=' + (wired.fit == null ? 'n/a' : wired.fit.toFixed(3)));
}
/* ===== 2026-10-29（千问）：把 DS 的**配对评估**接进臂里（`EPIRUS_PAIRED=1`）=====
 * §E822 的病：同代每个个体各抽各的桌 ⇒ 适值差里混着"这桌好不好打"，两臂 ES 因此在**选择噪声上爬坡**
 *   （inLoopBest 涨、固定桌 holdoutFit 反跌）。配对之后同代所有个体吃同一批局 ⇒ 差就是权重差。
 * ⚑ 光把开关拨上不算数（DS 的 `preflight2` ③ 只验了 `evalSeedOf` 这个**函数**，那与"评估路径真走它"同形差别）：
 *   这里除读回 + 同代两个下标种子相同之外，再加一条**记账**：把开/关两侧的"同代种子集合"当场打出来，
 *   跑完的人在回执里能直接看到臂到底配对没配对，不用信我说。 */
if (process.env.EPIRUS_PAIRED) {
  if (typeof T.setPairedEval !== 'function' || typeof T.evalSeedOf !== 'function') {
    console.error('⛔ 下达了 EPIRUS_PAIRED 但引擎没有 setPairedEval/evalSeedOf ⇒ 拒绝静默空转'); process.exit(7);
  }
  T.setPairedEval(true);
  if (T.pairedEvalOn() !== true) { console.error('⛔ EPIRUS_PAIRED 读回不是 true'); process.exit(7); }
  const s0 = T.evalSeedOf(7, 0), s3 = T.evalSeedOf(7, 3), s0b = T.evalSeedOf(8, 0), s3b = T.evalSeedOf(8, 3);
  if (s0 !== s3 || s0b !== s3b) { console.error('⛔ 配对没生效（gen7 idx0/idx3 = ' + s0 + '/' + s3 + ' ‖ gen8 = ' + s0b + '/' + s3b + '）'); process.exit(7); }
  if (s0 === s0b) { console.error('⛔ 跨代没换桌（gen7 与 gen8 种子相同 ⇒ 整轮钉死一张桌，那不是配对，是过拟合同一批局）'); process.exit(7); }
  console.log('[cem-arm] ⚙ **配对评估开**：同代同局号 = 同种子（gen7 idx0=idx3=' + s0 + ' ‖ gen8=' + s0b + ' ⇒ 跨代仍换桌）‖ 每评估 ' + GAMES + ' 局');
}
const DIM = P.paramCount();

/* 起点粒：用**在册的 3P 夹具包**而不是活槽（R3：会换主人的指针不配当夹具）。读不出来就退回固定种子随机粒。 */
let startParams = null, startLabel = '';
/* 谱系（DS · 10-30 晚，用户要画冠军演化图）：起点是谁、哈希多少、产物代与哈希都进 meta。 */
let startHash = null;
const c = loadChamp(W, START_PACK, HERE + '/..');
if (c && c.length === DIM) { startParams = Float64Array.from(c); startLabel = '夹具包 ' + START_PACK;
  try { startHash = createHash('md5').update(readFileSync(START_PACK)).digest('hex'); } catch (e) { startHash = null; } }
if (!startParams) {
  /* ⚑ 读不出必须点名**是哪个闸**拦的（代 1 的包 / 长度 / arch / dof），不许一句"退回随机粒"就翻篇——
   *   否则下一班会把"起点其实是随机"读成"起点是那枚冠军"，整条臂的解释就反了。 */
  let why = '';
  try { const raw0 = readPack2(START_PACK); why = 'checkPack=' + JSON.stringify(P.checkPack ? P.checkPack(raw0) : { reason: 'no-checkPack' }); }
  catch (e) { why = '解不开文件：' + String((e && e.message) || e); }
  console.log('[cem-arm] ⚠ 起点 **' + START_PACK + ' 没被接受** ⇒ ' + why + ' ⇒ 本臂起点 = 随机粒（不是那枚包！）');
  P.setRng(T.mulberry32(SEED)); startParams = P.makePolicy(0.25); startLabel = 'makePolicy(0.25)';
}
startParams = Float64Array.from(startParams);
if (!OUT) OUT = defaultOut();   // 缺省名要扫目录取号 ⇒ 只能在起点判定之后拼（父本只进索引，不进名字）
/* arena2 只在起点粒定下来之后建表；它用 v7 参照固定对手表，与起点粒无关（起点不参与建桌）。 */
var ARENA = null;
if (ARENA2) {
  try { ARENA = createArena2(W, { refParams: ARENA_REF, temp: ARENA_TEMP, highN: ARENA_HIGH_N, stratified: ARENA_STRAT, stratCap: ARENA_STRAT_CAP, stratMix: ARENA_STRAT_MIX, roster: ARENA_ROSTER || undefined, shapes: ARENA_SHAPES || undefined }); }
  catch (e) { console.error('⛔ arena2 建表失败：' + String(e && e.message || e)); process.exit(7); }
  console.log('[cem-arm] ⚙ 扩表 arena2 开：指纹 ' + ARENA.fp);
  console.log('   ‖ 桌形 ' + ARENA2_SHAPES.length + '（' + ARENA.shapes.map(function (s) { return s.n + ':' + s.mode; }).join(',') + '）' +
    ' ‖ 对手表 ' + ARENA.roster.length + ' 项（' + ARENA.pool.length + ' 脚本 bot + ' + (ARENA.roster.length - ARENA.pool.length - 1) + ' 单技能 + 均匀随机）' +
    ' ‖ 货币=' + ARENA_CUR + (ARENA_DIV ? '+多样性当选' : '') + (ARENA_HIGH_N > 1 ? '+高人数×' + ARENA_HIGH_N : '') + (ARENA_STRAT ? '+分层场' : '') +
    ' ‖ temp=' + ARENA_TEMP + ' ‖ 终局 holdout=' + ARENA_HOLD + ' 局/桌形');
  if (P.__arch2) {
    const w = ARENA.verifyWired(startParams, { temp: ARENA_TEMP });
    if (!w.ok) { console.error('⛔ arena2 接线没生效（forwardCands +' + w.forwards + ' ‖ chooseCandidates ' + w.chooseCandidatesCalls + '）⇒ 开不了臂'); process.exit(7); }
    console.log('   ‖ **接线自证 PASS**：校准局里 forwardCands +' + w.forwards + ' 次 ‖ chooseCandidates ' + w.chooseCandidatesCalls + ' 次');
  } else {
    console.log('   ‖ ⚠ 没装 arch2 ⇒ 这是 v7 包的 arena2 读数（不验 2.0 接线）');
  }
}
/* mastery 门的审计桌：与 ARENA 同一 refParams/temp（同一对手表同一温度），多要一份 wantEvents 事件流。 */
var MAST_ARENA = null;
const MASTERY_STAT = { audits: 0, pass: 0, spam: 0, starved: 0, bestGatedFail: 0, bestAccepted: 0, lastRate: null };
if (MASTERY_ON) {
  if (!ARENA2) { console.error('⛔ --masteryKey 需要 --arena2=1（审计必须骑同一张 arena2 对手表）'); process.exit(7); }
  try { MAST_ARENA = createArena2(W, { refParams: ARENA_REF, temp: ARENA_TEMP, wantEvents: 1 }); }
  catch (e) { console.error('⛔ mastery 审计桌建表失败：' + String(e && e.message || e)); process.exit(7); }
  console.log('[cem-arm] ⚙ mastery 门开：key=' + MASTERY_KEY + ' ≥' + MASTERY_LINE + '/局 ‖ gate=' + MASTERY_GATE + (MASTERY_SEM ? '+sem' : '') +
    ' ‖ cheap 审计 ' + MASTERY_GAMES + ' 局 n=' + MASTERY_N + ':' + MASTERY_TABLE + ' t=' + ARENA_TEMP +
    ' ‖ 每代审计上限 ' + MASTERY_CAP + ' ‖ 指纹 ' + MAST_ARENA.fp);
}
const masteryRate = function (params) {
  if (!MASTERY_ON) return null;
  const ch = T.policyChooserN(params, ARENA_TEMP);
  const { cells } = auditCells(W, MAST_ARENA, ch, [{ n: MASTERY_N, table: MASTERY_TABLE }], MASTERY_GAMES, 101);
  MASTERY_STAT.audits++;
  const st = cells[0];
  let rate;
  if (MASTERY_SEM && MASTERY_KEY === 'laserEye') rate = st.sem.laserEyeHit / Math.max(1, st.games);
  else if (MASTERY_SEM && MASTERY_KEY === 'miniT') rate = st.sem.miniTHit / Math.max(1, st.games);
  else if (MASTERY_SEM && MASTERY_KEY === 'cannon') rate = st.chains.cannonEpMax / Math.max(1, st.games);
  else rate = (st.okUses[MASTERY_KEY] || 0) / Math.max(1, st.games);
  /* 上界门：超过 masteryMax 记 spam 不算达标（返回原 rate，由 elite 档的 >=MASTERY_LINE 判断前先看 spam 标记） */
  if (MASTERY_MAX > 0 && rate > MASTERY_MAX) {
    MASTERY_STAT.spam = (MASTERY_STAT.spam || 0) + 1;
    MASTERY_STAT.lastRate = rate;
    return null;   /* null = 不达标（与审计失败同形，但计数分列） */
  }
  if (rate >= MASTERY_LINE) MASTERY_STAT.pass++;
  MASTERY_STAT.lastRate = rate;
  return rate;
};
/* P0-2（#161）：词典序地板 = v7 在**同一张冻结桌**上的逐格读数，必须在开臂前量好存底。
 * 同 salt 同局号 ⇒ 之后每个子代的冻结评估与它**逐局配对**，"低于地板"比的是权重差不是抽桌差。 */
var V7_FLOOR = null;
if (ARENA && (ARENA_LEX || ARENA_FPEN > 0)) {
  const fr = ARENA.evalParams(ARENA_REF, { phase: 'frozen', gamesPerShape: Math.max(8, FXG || 0), temp: ARENA_TEMP, cur: ARENA_CUR });
  V7_FLOOR = fr.byShape;
  const cellOf = function (bs, k) { return ARENA_CUR === 'first' ? bs[k].firstScore : (ARENA_CUR === 'clean' ? bs[k].cleanScore : bs[k].score); };
  console.log('[cem-arm] ⚙ **' + (ARENA_LEX ? '词典序当选开' : '地板罚项当选开') + '**（#161）：地板 = v7 冻结桌逐格（' + Object.keys(V7_FLOOR).length + ' 格 × ' + Math.max(8, FXG || 0) + ' 局/格，货币=' + ARENA_CUR + '，与子代同局配对）' + (ARENA_FPEN > 0 ? ' ‖ λ=' + ARENA_FPEN : ''));
  console.log('   地板：' + Object.keys(V7_FLOOR).map(function (k) { return k + ' ' + cellOf(V7_FLOOR, k).toFixed(3); }).join(' ‖ '));
}
/* §E822 起手三件固定动作（都是被"读数看着正常"逼出来的）：
 *   ① 只读副本 `START_COPY` —— 内部 GA 会**就地改**传进去的数组，起点基线绝不能再吃 `startParams`；
 *   ② 固定对手表 `FIX_OPPS`（用起点粒造一次）⇒ 起点与冠军吃**同一批桌**，跨臂才是配对比较；
 *   ③ 算子真实性自检：同一父代、同一条随机流，`seg` 与 `flat` 两档变异**必须产出不同的子代**，
 *      否则"我在比算子"这句话是空的（今天 GA 两臂 md5 相同就是这么来的）。 */
/* 固定对手表（**必须在任何读数之前建好**；用 `var` 声明在这里、真正赋值在下面 `START_COPY` 之后，
 *   因为造它要用到 `T.buildOpps` 而那时 `startParams` 才刚定下来） */
var FIX_OPPS = null;
const START_COPY = Float64Array.from(startParams);
if (!ARENA) FIX_OPPS = T.buildOpps(START_COPY, 0.05);
{
  const mk = function (mode) {
    const bak = P.mutatePolicy;
    const before = P.__arch2 ? P.__arch2.OPT.mutMode : null;
    /* `mutOnly` 与 flat 互斥（flat 没有段）⇒ 这条**自检**要临时把它摘掉再比；比完原样放回 */
    const onlyBefore = P.__arch2 ? P.__arch2.OPT.mutOnly : null;
    if (P.__arch2) { P.__arch2.OPT.mutMode = mode; if (mode === 'flat') P.__arch2.OPT.mutOnly = null; }
    const r = bak(START_COPY, 0.2);
    if (P.__arch2) { P.__arch2.OPT.mutMode = before; P.__arch2.OPT.mutOnly = onlyBefore; }
    return r;
  };
  if (P.__arch2) {
    const a = mk('flat'), b = mk('seg');
    let same = true; for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) { same = false; break; } }
    if (same) { console.error('⛔ 算子档没生效：seg 与 flat 产出**同一个子代** ⇒ "比算子"是空的（今天 GA 两臂 md5 相同的同一个病）'); process.exit(7); }
    console.log('[cem-arm] ✔ 算子真实性自检：seg 与 flat 对同一父代产出**不同**子代（逐位比对第一个差异在第 ' + (() => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i; return -1; })() + ' 个坐标）');
  }
}
/* 每臂一条自己的随机流：同一 seed 两臂可配对（起点相同、预算相同，只差算子） */
function rngFor(s) { let x = (s >>> 0) || 1; return function () { x = (x + 0x6D2B79F5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = function (r) { const u = Math.max(r(), 1e-12), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/* 评估口径两臂共用同一个 opps 构造函数（同一份对手 = E6 那条"与验收同场"的教训） */
/* ===== §E822（10-28 晚，三处"看着正常"的读数一起修）=====
 *   ① `T.buildOpps(params, …)` 里有一部分对手是**按被评的这粒权重**造的 ⇒ 不同臂的"同一函数"其实吃了不同的桌 ⇒
 *      跨臂比读数必须先钉住一份**固定对手表**（用起点粒造一次，之后所有读数都用它）。
 *   ② GA 侧会**就地改**传进去的数组 ⇒ "同场起点基线"若复用 `startParams`，量到的是冠军自己（今天就是这样：
 *      报表起点 fit 与冠军逐字相同，而我另起一次量到的起点是 0.337 vs 报表 0.399）。⇒ 起手前先 `slice()` 一份只读副本。
 *   ③ 内部 GA（`T.makeTrainer`/`step`）不调 `EpirusPolicy.mutatePolicy` ⇒ 我那两档"算子"跑出来是**同一份权重**（md5 相同）。
 *      ⇒ 加一条工具自己拥有的进化策略 `--mode=esa`：父代 + λ 个子代全走 `P.mutatePolicy`/`P.crossover`，
 *      `EPIRUS_MUT_MODE=seg|flat` 才第一次真的改变干预。 */
/* （`FIX_OPPS` 在上面 `START_COPY` 那一节声明并赋值 —— 必须先于任何读数） */
function evalOne(params, gen, idx) {
  if (ARENA) {
    const r = ARENA.evalParams(params, { phase: 'loop', gen: gen, games: GAMES, temp: ARENA_TEMP, cur: ARENA_CUR });
    return { fit: r.score, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard };
  }
  const opps = T.buildOpps(params, 0.05);
  const r = T.scoreMemberN(params, opps, GAMES, N, gen, idx, 0);
  return { fit: r.fit == null ? -1 : r.fit, first: r.firstRate == null ? 0 : r.firstRate, top2: r.top2Rate == null ? 0 : r.top2Rate };
}
function evalFixed(params, gen, idx, gamesOverride, wantPerGame) {   /* 固定对手表 ⇒ 跨臂配对；games 用 HOLD 的那一档做终局读数 */
  if (ARENA) {
    const r = ARENA.evalParams(params, { phase: 'frozen', gamesPerShape: Math.max(8, FXG || 0), temp: ARENA_TEMP, cur: ARENA_CUR, perGame: !!wantPerGame });
    return { fit: r.score, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard, cleanScore: r.cleanScore, byShape: r.byShape, perGame: r.perGame };
  }
  const r = T.scoreMemberN(params, FIX_OPPS, gamesOverride || (gen === 999 ? HOLD : GAMES), N, gen, idx, 0);
  return { fit: r.fit == null ? -1 : r.fit, first: r.firstRate == null ? 0 : r.firstRate, top2: r.top2Rate == null ? 0 : r.top2Rate };
}
const holdout = function (params) {      /* 终局读数：固定场（同一批桌 + 同一 idx/gen） */
  if (ARENA) {
    const r = ARENA.evalParams(params, { phase: 'holdout', gamesPerShape: ARENA_HOLD, temp: ARENA_TEMP, cur: ARENA_CUR });
    return { fit: r.score, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard, byShape: r.byShape, cleanScore: r.cleanScore };
  }
  return evalFixed(params, 999, 0);
};

/* ===== ② 起点分母（必须先报，否则"涨了多少"没有参照）===== */
if (MODE === 'cem' && FUNNEL > 0) {
  if (!ARENA) { console.error('⛔ --funnel 只接 arena2 那条评估路（要 --arena2=1）⇒ 拒绝静默按旧口径跑'); process.exit(7); }
  if (FUNNEL < ELITE) console.error('⛔ --funnel=' + FUNNEL + ' 少于 elite(' + ELITE + ') ⇒ 精英数超过决赛数');
  console.log('  ⚑ **选择结构=漏斗**：每代先 ' + FUNNEL_S1 + ' 局粗筛 ' + POP + ' 粒 → 前 ' + FUNNEL + ' 粒补到 ' + GAMES +
    ' 局（两批桌互不相交，精英只从决赛者里出）⇒ 每代实际局数 ' + (POP * FUNNEL_S1 + FUNNEL * Math.max(0, GAMES - FUNNEL_S1)) +
    ' vs flat 的 ' + (POP * GAMES) + ' ⇒ 同 --targetGames 下漏斗臂会**多跑代**（横比看 [budget] 与 meta.funnel，不许按名义口径混说）' +
    (FUNNEL === ELITE ? ' ‖ ⚠ funnel=elite ⇒ **选谁完全由粗筛决定**（决赛补的局只动 σ/产物棘轮）' : ''));
}
const FUNNEL_REF = 100000;   /* 决赛段的 gen 偏移：环内局号 = gen*games+g ⇒ 大偏移保证决赛桌与粗筛桌**永不撞**，且每代自换桌 */
function coarseOne(v, it) {
  const r = ARENA.evalParams(v, { phase: 'loop', gen: it, games: FUNNEL_S1, temp: ARENA_TEMP, cur: ARENA_CUR });
  return { fit: r.score, first: r.first, top2: r.top2, draw: r.draw, games: r.games, maxCard: r.maxCard, coarse: true };
}
function refineInto(prev, v, it) {
  /* 只补"多出来的那几局"，与粗筛桌拼成 GAMES 局的**总均值**（两批桌互不相交 ⇒ 这 GAMES 局是一个干净的均值，不是拿新桌的分替换旧桌） */
  const n2 = Math.max(0, GAMES - FUNNEL_S1);
  if (!n2) return { fit: prev.fit, first: prev.first, top2: prev.top2, draw: prev.draw, games: prev.games, maxCard: prev.maxCard, refined: false };
  const r = ARENA.evalParams(v, { phase: 'loop', gen: FUNNEL_REF + it, games: n2, temp: ARENA_TEMP, cur: ARENA_CUR });
  return { fit: (prev.fit * FUNNEL_S1 + r.score * n2) / GAMES, first: r.first, top2: r.top2, draw: r.draw,
    games: GAMES, maxCard: r.maxCard, refined: true };
}
const base = evalOne(startParams, 0, 0);
P.setRng(T.mulberry32(SEED + 1));
const randParams = Float64Array.from(P.makePolicy(0.25));
const rnd = evalOne(randParams, 0, 0);
console.log('桌形 trainMode=' + TMODE + ' ‖ 人数 n=' + N + ' ‖ 每评估局数 games=' + GAMES + ' ‖ 终局读数 ' +
  (ARENA ? 'arena2 ' + ARENA_HOLD + ' 局/桌形 × ' + ARENA2_SHAPES.length + ' 桌形' : 'holdoutGames=' + HOLD));
console.log('起点分母：' + startLabel + ' fit=' + base.fit.toFixed(4) + ' 夺1=' + (base.first * 100).toFixed(1) + '% ‖' +
  ' 随机粒 fit=' + rnd.fit.toFixed(4) + ' 夺1=' + (rnd.first * 100).toFixed(1) + '%');
if (!(isFinite(base.fit) && isFinite(rnd.fit))) { console.error('⛔ 起点分母读不出（fit 非有限）⇒ 这台尺是死的，不开跑'); process.exit(2); }
/* arena2：上面那两条是 **4 局**的循环读数（噪声大），真正的起点地板要走 holdout 全桌形。 */
function fmtCard(c) { return c ? (c.key + ' ' + (100 * c.share).toFixed(1) + '%') : '—'; }
if (ARENA) {
  const bA = ARENA.evalParams(startParams, { phase: 'holdout', gamesPerShape: ARENA_HOLD, temp: ARENA_TEMP, cur: ARENA_CUR });
  const rA = ARENA.evalParams(randParams, { phase: 'holdout', gamesPerShape: ARENA_HOLD, temp: ARENA_TEMP, cur: ARENA_CUR });
  console.log('起点分母（arena2 holdout ' + ARENA_HOLD + ' 局/桌形 × ' + ARENA2_SHAPES.length + ' 桌形 = ' + bA.games + ' 局，货币=' + ARENA_CUR + '）：' +
    startLabel + ' 夺1=' + (bA.first * 100).toFixed(1) + '% 净胜=' + bA.score.toFixed(3) + ' 平局=' + (bA.draw * 100).toFixed(1) + '% 单卡=' + fmtCard(bA.maxCard) +
    ' ‖ 随机粒 夺1=' + (rA.first * 100).toFixed(1) + '% 净胜=' + rA.score.toFixed(3) + ' 平局=' + (rA.draw * 100).toFixed(1) + '%');
}

/* ===== ① 退化 CEM 自证：同一粒、同一 (gen,idx) 跑几遍必须**逐字相同** =====
 * ⚠ 10-22 凌晨改正了自己的判据形状。第一版写的是"std=0 ⇒ POP 个全同样本取 max 必须等于起点 fit"，
 *   而 `idx` 是 `scoreMemberN` 的入参、**每格抽的桌不同** ⇒ 同一粒权重只换 idx 就能差出一大截
 *   （实测 `idx-spread.mjs`：games=6 · n=3 · 同一粒只换 idx(8 个) ⇒ multi SD=0.167 极差 0.488 ‖ long SD=0.120 极差 0.341）。
 *   ⇒ 那条 max 判据把"两臂同源"错写成"fit 与 idx 无关"，只要 pop>1 就必然 FAIL（本次 multi/long 都 FAIL 过 —— 判据错，不是产品错）。
 *   真正的同源判据是**同格重复逐字相同**；idx 那一截不是 bug，是要**报出来的量具噪声底**。 */
if (DEG) {
  const dup0a = evalOne(startParams, 0, 0), dup0b = evalOne(startParams, 0, 0);
  const same = dup0a.fit === base.fit && dup0b.fit === base.fit;
  if (ARENA) {
    /* arena2 的桌号只跟 (gen,g) 走、与 idx 无关（配对）⇒ 旧的"idx 散布"在这一档**结构性为 0**，
     *   拿它当噪声底会把"已配对"读成"没有噪声"⇒ 这里只验同格重复逐字相同，并把这一点印出来。 */
    console.log('同格重复（arena2：同一粒、gen=0 的 ' + GAMES + ' 局）逐字相同? ' + (same ? 'PASS' : 'FAIL') +
      ' ‖ ⚠ 已配对 ⇒ idx 不换桌，旧 idx 散布自检在这一档是空的（不是 0 噪声）');
    process.exit(same ? 0 : 1);
  }
  const xs = [];
  for (let i = 0; i < POP; i++) xs.push(evalOne(startParams, 0, i).fit);
  const mean = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length;
  const sd = xs.length > 1 ? Math.sqrt(xs.reduce(function (a, b) { return a + (b - mean) ** 2; }, 0) / (xs.length - 1)) : 0;
  console.log('同格重复（同一粒、gen=0、idx=0 共三遍）fit 逐字相同? ' + (same ? 'PASS' : 'FAIL'));
  console.log('量具噪声底：同一粒只换 idx(前 ' + POP + ' 格) ⇒ 均值 ' + mean.toFixed(4) + ' ‖ SD ' + sd.toFixed(4) +
    ' ‖ 极差 ' + (Math.max.apply(null, xs) - Math.min.apply(null, xs)).toFixed(4) +
    ' ⇒ **inLoopBest 里有一截是 idx 抽签，不是权重变好**（跨臂只比固定场读数）');
  console.log(same ? 'PASS 评估口径两臂同源' : 'FAIL 不同源 ⇒ 两臂对比作废');
  process.exit(same ? 0 : 1);
}

const t0 = Date.now();
/* ===== §E822（10-28 傍晚）：**实际局数计数器** =====
 * 动因（实测，不是猜）：三臂标称都是 `--evals=600 --games=2`，但 GA 用了 35.8s、CEM 用了 113.3s ⇒
 *   "评估次数"这一口径在两个模式里**不是同一笔钱**（GA 的 `makeTrainer` 走精英保留 + shaped 适应度，
 *   每代真正打出去的局数与 `POP×GAMES×iters` 不等）。拿它当"同预算"报，就是把**记账口径**当成**干预强度**
 *   （[[feedback-cross-process-readings-must-share-conditions]] 同族）。
 * 修法：在沙箱外面给 `EpirusPlay.autoGameN` 包一层计数器（只数、不改行为），把**实际局数**印进每臂读数。
 *   ⇒ 之后横比只认这个数；标称 evals 仍印着，但它只是"计划剂量"。 */
let GAMES_PLAYED = 0;
{
  const Play = W.EpirusPlay;
  const origN = Play.autoGameN;
  Play.autoGameN = function () { GAMES_PLAYED++; return origN.apply(null, arguments); };
}
const gamesIn = function () { return GAMES_PLAYED; };
let best = startParams, bestFit = -Infinity, used = 0, curve = [];
const checkpoints = [0.1, 0.25, 0.5, 0.75, 1.0].map(function (f) { return f * EVALS; });
const cpG = TARGET_G ? [0.1, 0.25, 0.5, 0.75, 1.0].map(function (f) { return Math.round(f * TARGET_G); }) : [];
let ESA_DIV_STAT = null;
let ESA_SIG_STAT = null;
let ESA_LEX_STAT = null;   /* P0-2：词典序终态元组（esa 分支里赋值，row 里引用） */
let ESA_FPEN_STAT = null;  /* P0-2 回退：地板罚项终态（同上） */

if (MODE === 'esa') {
  /* (1+λ)-ES：**全部算子都由本工具拥有**（父代 + λ 个子代各过一遍 `P.mutatePolicy`）
   *   ⇒ `EPIRUS_MUT_MODE=flat|seg` 第一次成为真正的干预（内部 GA 那条路不调这些算子，见上面 ③ 的自检）。
   * ===== `--fxSelect=1`：把"当选"从**每代换桌的最大值**改成**同一批冻结桌上的改进**（10-29 段 C 的直接处方）=====
   * 病（10-29 00:3x 四臂实测）：配对评估开与不开，三条 ES 臂都是 `inLoopBest` 一路涨（0.79~1.09），
   *   而固定桌留出的 dFirst 是 −3.5 / −0.5 / −0.3pt ⇒ 配对只把**同代**个体配平了，
   *   而这里的最优是**跨迭代棘轮**——每次换一批桌取 max，涨的是"哪代桌好打"，不是权重。
   * 处方：廉价环内读数只做**预选**；要真的换父代，必须在**同一批冻结桌**上把父子各评一遍，比的是同格配对差。
   * ⚠ 代价要说清：每接受一次改进就多花 `FX_GAMES` 局 ⇒ 同样的 targetGames 预算下迭代数会变少（读数里能看见）。 */
  let parent = Float64Array.from(startParams);
  let pf = evalOne(parent, 0, 0).fit; bestFit = pf; best = parent;
  let parentLoopFit = pf;   /* --preSel=parent 的门基准（接受子代时更新为它的循环分） */
  /* FXSEL：父代在冻结桌上的**净胜 + 单卡占比**一起记（多样性当选要拿它当起点）。 */
  let parentFix = 0, parentShare = 0, parentPen = 0;
  let parentVec = null;   /* E8：父代在冻结桌上的**逐局**得分（同局号 ⇒ 可与子代配对） */
  const pairStat = function (a, b) {
    if (!a || !b || a.length !== b.length) return null;
    const n = a.length; let s = 0, ss = 0;
    for (let i = 0; i < n; i++) { const d = a[i] - b[i]; s += d; ss += d * d; }
    const mean = s / n; const varr = Math.max(0, ss / n - mean * mean); const se = Math.sqrt(varr / n);
    return { mean, se, z: se > 0 ? mean / se : Infinity };
  };
  const penOf = function (fit, share) { return fit - ARENA_PEN * Math.max(0, share - 0.5); };
  /* P0-2：词典序的元组与比较器（below = 低于地板格数，worst = 最差格余量，total = 冻结桌总分）。 */
  const cellOf = function (bs, k) { return ARENA_CUR === 'first' ? bs[k].firstScore : (ARENA_CUR === 'clean' ? bs[k].cleanScore : bs[k].score); };
  const lexTupleOf = function (bs) {
    let below = 0, worst = Infinity;
    /* --arenaPerN：先按 N 聚合（同 N 的 hp 模式取平均），再比「低于地板的 N 数 / 最差 N 余量」。 */
    if (ARENA_PER_N) {
      const byN = {};
      for (const k in V7_FLOOR) {
        const n = String(k).split(':')[0];
        const c = cellOf(bs, k), f = cellOf(V7_FLOOR, k);
        const g = (bs[k] && bs[k].games) || 1;
        (byN[n] = byN[n] || { c: 0, f: 0, w: 0 });
        byN[n].c += c * g; byN[n].f += f * g; byN[n].w += g;
      }
      for (const n in byN) { const x = byN[n]; const d = x.c / x.w - x.f / x.w; if (d < 0) below++; if (d < worst) worst = d; }
      return { below: below, worst: worst };
    }
    for (const k in V7_FLOOR) {
      const m = cellOf(bs, k) - cellOf(V7_FLOOR, k);
      if (m < 0) below++;
      if (m < worst) worst = m;
    }
    return { below: below, worst: worst };
  };
  let parentLex = null;
  /* --arenaFloorPen：地板罚项分（连续版词典序）。 */
  const floorGapSum = function (bs) {
    let s = 0;
    for (const k in V7_FLOOR) { const g = cellOf(V7_FLOOR, k) - cellOf(bs, k); if (g > 0) s += g; }
    return s;
  };
  const fpenOf = function (fx) { return fx.fit - ARENA_FPEN * floorGapSum(fx.byShape); };
  let parentFpen = 0, parentGap = 0;
  if (FXSEL) {
    const pe = evalFixed(parent, 500, 0, FXG || undefined, FX_PAIRED);
    if (SHAPE_REL > 0 && ARENA) {
      const sh0 = ARENA.evalParams(parent, { phase: 'frozen', gamesPerShape: SHAPE_GAMES, temp: SHAPE_TEMP, cur: ARENA_CUR });
      const acts0 = Math.max(1, sh0.acts * sh0.games);
      let d0 = 0; for (const k of DEF_KEYS) d0 += (sh0.cat && sh0.cat[k]) || 0;
      parentShapeStat = { share: sh0.maxCard ? sh0.maxCard.share : 0, def: d0 / acts0, ji: ((sh0.cat && sh0.cat[R.SK.JI]) || 0) / acts0 };
    }
    parentFix = pe.fit;
    parentShare = pe.maxCard ? pe.maxCard.share : 0;
    parentPen = penOf(parentFix, parentShare);
    if (FX_PAIRED) parentVec = pe.perGame;
    if (ARENA_LEX) parentLex = lexTupleOf(pe.byShape);
    if (ARENA_FPEN > 0) { parentGap = floorGapSum(pe.byShape); parentFpen = pe.fit - ARENA_FPEN * parentGap; }
  }
  /* 自证（记忆 [[feedback-patch-must-prove-invoked]]）：开档就必须真拿到逐局向量，拿不到当场红，不许静默退回无配对。 */
  if (FX_PAIRED && FXSEL && ARENA && !(parentVec && parentVec.length)) {
    console.error('⛔ --fxPaired=1 但 arena2 没交出逐局得分（perGame 空）⇒ 配对判定没接上，拒绝按旧口径静默跑'); process.exit(7);
  }
  if (FX_PAIRED && !ARENA) { console.error('⛔ --fxPaired 目前只接了 arena2 冻结桌（旧 scoreMemberN 那条不交逐局分）'); process.exit(7); }
  const r = rngFor(SEED + 17);
  void r;
  const iters = TARGET_G ? 1000000 : Math.max(1, Math.floor(EVALS / POP));
  let accepted = 0, screened = 0, accScore = 0, accDiv = 0, divProbes = 0;
  /* ===== `--fxQuota=N`（E7，10-30 上午）：把每臂的**冻结桌送验次数钉住** =====
   * 病（只读已有 meta 量出来的，`scratch/budget-split.mjs`）：送验只有两个口子——棘轮门 `循环分 > 历史最高`
   *   与多样性探针（父代单卡 > 0.4 才探）。环内分只打 4 局 ⇒ 满分 1.0，**摸到 1.0 门就永久关闭**；
   *   于是 6k 预算的去向在种子间差 15 倍（MILD-s13 送验 4 次/5.9% ‖ MILD-s7 送验 62 次/90.9%），
   *   而且**剂量与"形状干净"反着来**（单卡低 ⇒ 不探针 ⇒ 饿死）。不钉住剂量，跨种子比较量的就是剂量不是配方。
   * 做法：每代末若送验次数不到配额，按环内分**补送该代最优的未验子代**；承兑规则与门内**同一段函数**，
   *   不另写一套。`N=0`（缺省）⇒ 逐字旧行为。⚠ 补送发生在代末，不进 1/5 律的成功窗口（那条只数门内尝试）。 */
  const QUOTA = Math.max(0, Math.floor(Number(arg('fxQuota', 0)) || 0));
  const QUOTA_PER_ITER = Math.max(1, Math.floor(Number(arg('fxQuotaPerIter', 2)) || 2));
  let verifications = 0, quotaTopups = 0, quotaAccepted = 0, pairedBlocked = 0, shapeBlocked = 0, shapeBlockKeys = { share: 0, def: 0, ji: 0 };
  const acceptDeltas = [];
  /* 一次送验 = 冻结桌评一遍 + 走同一套承兑判据（棘轮门/探针/配额补送共用，保证"补送"不是第二套规则）。 */
  const verifyChild = function (child, loopFit, isTopup) {
    const cf = evalFixed(child, 500, 0, FXG || undefined, FX_PAIRED);
    verifications++;
    const cfShare = cf.maxCard ? cf.maxCard.share : 0;
    /* 形状可行性：单卡过线 ⇒ 这一子代不进候选（词典序第一关键字）。 */
    /* 形状可行性（二版）：在**报告条件**（锐温度）下单独评一次 frozen，多键同时判。 */
    /* --arenaShapePick 时**跳过闸**：搜索不因形状拒子，形状只在终选时用（否则归档＝被闸筛过的轨迹，测的仍是约束）。 */
    if (!SHAPE_PICK && (SHAPE_CAP > 0 || DEF_CAP > 0 || JI_CAP > 0)) {
      const sh = ARENA.evalParams(child, { phase: 'frozen', gamesPerShape: SHAPE_GAMES, temp: SHAPE_TEMP, cur: ARENA_CUR });
      const acts = Math.max(1, sh.acts * sh.games);
      const share = sh.maxCard ? sh.maxCard.share : 0;
      let defN = 0; for (const k of DEF_KEYS) defN += (sh.cat && sh.cat[k]) || 0;
      const defShare = defN / acts, jiShare = ((sh.cat && sh.cat[R.SK.JI]) || 0) / acts;
      lastShapeStat = { share, defShare, jiShare, temp: SHAPE_TEMP };
      const badShare = (SHAPE_CAP > 0 && share > SHAPE_CAP + 1e-9) || (SHAPE_REL > 0 && parentShapeStat && share > parentShapeStat.share + SHAPE_REL + 1e-9);
      const badDef = (DEF_CAP > 0 && defShare > DEF_CAP + 1e-9) || (SHAPE_REL > 0 && parentShapeStat && defShare > parentShapeStat.def + REL_DEF + 1e-9);
      const badJi = (JI_CAP > 0 && jiShare > JI_CAP + 1e-9) || (SHAPE_REL > 0 && parentShapeStat && jiShare > parentShapeStat.ji + REL_JI + 1e-9);
      if (badShare) shapeBlockKeys.share++;
      if (badDef) shapeBlockKeys.def++;
      if (badJi) shapeBlockKeys.ji++;
      if (badShare || badDef || badJi) { shapeBlocked++; return false; }
    }
    const candLex = ARENA_LEX ? lexTupleOf(cf.byShape) : null;
    /* byScore 四档：词典序（#161）‖ 地板罚项（预登记回退）‖ 罚项（--arenaPen）‖ 标量净胜（原口径）——一次只许开一档 */
    const inWarm = WARM_SHAPE > 0 && gamesIn() < WARM_SHAPE;
    const byScore = inWarm ? (cf.fit >= parentFix - WARM_TOL) : (ARENA_LEX
      ? (candLex.below !== parentLex.below ? candLex.below < parentLex.below
        : (Math.abs(candLex.worst - parentLex.worst) > 1e-12 ? candLex.worst > parentLex.worst : cf.fit > parentFix))
      : (ARENA_FPEN > 0 ? fpenOf(cf) > parentFpen
        : (ARENA_PEN > 0 ? penOf(cf.fit, cfShare) > parentPen : cf.fit > parentFix)));
    /* E8：方向已经由上面那档定了，这里只补一道"这次改进超出配对噪声了吗"。 */
    let pz = null;
    if (FX_PAIRED) {
      pz = pairStat(cf.perGame, parentVec);
      if (byScore && pz && pz.z < FX_PAIRED_K) { pairedBlocked++; return false; }
    }
    const byDiv = DIV && cf.fit >= parentFix - DIV_TOL && cfShare < parentShare - DIV_DELTA;
    if (byScore || byDiv) {
      /* 判定力记账：这次接受到底赢了多少冻结桌分？88 局一次读数的 SE ≈ 0.07（两点分布估），
       *   所以差值 <2SE 的"接受"其实是噪声带内的翻牌——不记下来就没人知道当选面在量什么。 */
      acceptDeltas.push({ d: cf.fit - parentFix, z: pz ? Number(pz.z.toFixed(2)) : null, via: byDiv && !byScore ? 'div' : (ARENA_LEX ? 'lex' : 'score'), topup: !!isTopup });
      parentFix = cf.fit; parent = Float64Array.from(child); parentShare = cfShare; parentPen = penOf(cf.fit, cfShare);
      if (FX_PAIRED) parentVec = cf.perGame;
      if (SHAPE_REL > 0 && lastShapeStat) parentShapeStat = { share: lastShapeStat.share, def: lastShapeStat.defShare, ji: lastShapeStat.jiShare };
      if (SHAPE_PICK) {
        const shp = ARENA.evalParams(child, { phase: 'frozen', gamesPerShape: SHAPE_GAMES, temp: SHAPE_TEMP, cur: ARENA_CUR });
        const actsP = Math.max(1, shp.acts * shp.games);
        let dP = 0; for (const k of DEF_KEYS) dP += (shp.cat && shp.cat[k]) || 0;
        shapeArchive.push({ pack: Float64Array.from(child), fit: cf.fit, share: shp.maxCard ? shp.maxCard.share : 0, def: dP / actsP, ji: ((shp.cat && shp.cat[R.SK.JI]) || 0) / actsP });
      }
      parentLoopFit = loopFit;   /* parent 门的新基准 = 刚接受的这个子代自己的循环分 */
      if (ARENA_LEX) parentLex = candLex;
      if (ARENA_FPEN > 0) { parentGap = floorGapSum(cf.byShape); parentFpen = fpenOf(cf); }
      if (loopFit > bestFit) bestFit = loopFit;
      best = child; accepted++;
      if (byScore) accScore++; else accDiv++;
      return true;
    }
    return false;
  };
  const DIV = ARENA && ARENA_DIV;
  /* ===== `--sigmaAdaptive=1`：Rechenberg 的 **1/5 成功律**（10-29 段 C 的第二个旋钮）=====
   * 为什么现在加：两波读数合起来看，问题不在"当选在哪批桌上判"，而在**步长**——
   *   `--fxSelect=1` 把棘轮砍掉了（inLoopBest 0.98→0.765），可 6000 局里只接受了 3~4 次改进
   *   ⇒ σ=0.2 固定一步到底，搜索基本在原地随机游走。1/5 律让 σ 自己找尺度：
   *   近 10λ 次尝试里成功率 >1/5 ⇒ σ×1.22；<1/5 ⇒ σ÷1.22。窗口与判定都写死在这里，别事后调。 */
  const ADAPT = Number(arg('sigmaAdaptive', 0)) > 0;
  const WIN = Math.max(10, POP * 3);
  const hist = [];
  let sig = SIG0, sigTraj = [SIG0], sigMin = SIG0, sigRestarts = 0, zeroStreak = 0;
  /* 1/5 律的推进抽成闭包：旧路径与 --boN 路径共用同一段（否则两条路会各写一份 σ 规则）。 */
  const adaptPush = function (ok) {
    hist.push(ok ? 1 : 0); if (hist.length > WIN) hist.shift();
    if (hist.length === WIN) {
      const rate = hist.reduce(function (a, b) { return a + b; }, 0) / WIN;
      sig = rate > 0.2 ? sig * 1.22 : sig / 1.22;
      const sigLo = SIG_FLOOR_ESA > 0 ? SIG_FLOOR_ESA : 1e-4;
      sig = Math.min(2.0, Math.max(sigLo, sig));
      /* 触底 + 连续零接受 ⇒ 步长回 SIG0（只回步长，父代仍是最优；`--sigRestart=0` 时关掉） */
      if (SIG_FLOOR_ESA > 0 && sig <= sigLo * 1.0001) {
        zeroStreak = rate === 0 ? zeroStreak + 1 : 0;
        if (SIG_RESTART > 0 && zeroStreak >= SIG_RESTART) { sig = SIG0; zeroStreak = 0; sigRestarts++; sigTraj.push('restart'); }
      } else zeroStreak = 0;
      sigMin = Math.min(sigMin, sig);
      sigTraj.push(Math.round(sig * 1e5) / 1e5);
      hist.length = 0;
    }
  };
  for (let it = 0; it < iters; it++) {
    const iterBuf = [];   /* --fxQuota 的候选缓冲（本代未送验的子代） */
    let verThisIter = 0;
    /* ===== --boN=1：一代所有子代在同一批环内局上排序，只把最好的送冻结桌确认 =====
     * 与棘轮门的唯一差别是"信息怎么花"：旧路径=逐个过门才送验（送验次数由门的历史决定）；
     *   boN=每代固定 1 次送验（--boNK 可放前 k 个）。环内局号只由 it 决定 ⇒ 同代同批，排序是无偏比较。 */
    if (BO_N) {
      if (!ARENA) { console.error('⛔ --boN 需要 arena2 真建起来（ARENA 为空）'); process.exit(7); }
      const kids = [];
      for (let i = 0; i < POP; i++) {
        const child = P.mutatePolicy(parent, sig);
        const e = evalOne(child, it, i);
        used += 1;
        kids.push({ p: child, fit: e.fit });
        if (TARGET_G && gamesIn() >= TARGET_G) break;
      }
      kids.sort(function (a, b) { return b.fit - a.fit; });
      let ok = false;
      for (let k = 0; k < BO_N_K && k < kids.length; k++) {
        screened++; verThisIter++;
        if (verifyChild(kids[k].p, kids[k].fit)) { ok = true; break; }
        if (TARGET_G && gamesIn() >= TARGET_G) break;
      }
      if (ADAPT) adaptPush(ok);
      while (cpG.length && gamesIn() >= cpG[0]) { curve.push({ games: gamesIn(), best: bestFit }); cpG.shift(); }
      if (TARGET_G && gamesIn() >= TARGET_G) break;
      continue;
    }
    for (let i = 0; i < POP; i++) {
      const child = P.mutatePolicy(parent, sig);
      const e = evalOne(child, it, i);
      used += 1;
      let ok = false;
      if (QUOTA > 0 && FXSEL) iterBuf.push({ p: Float64Array.from(child), fit: e.fit, done: false });
      /* 多样性探针（(b) 臂）：父代还退化时，每 DIV_EVERY 个子代**无条件**送一次冻结验证，
       *   否则"只反弹"父代的等分带永远轮不到一个更低单卡的子代。 */
      const probe = DIV && parentShare > DIV_TRIGGER && (i % DIV_EVERY === 0);
      if (probe) divProbes++;
      const preSelGate = PRESEL === 'parent' ? (e.fit > parentLoopFit) : (e.fit > bestFit);
      if (preSelGate || probe || FXALL) {
        screened++;
        if (!FXSEL) { bestFit = e.fit; best = child; ok = true; }
        else {
          if (iterBuf.length) iterBuf[iterBuf.length - 1].done = true;
          verThisIter++;
          ok = verifyChild(child, e.fit);
        }
      }
      if (ADAPT) adaptPush(ok);
      while (cpG.length && gamesIn() >= cpG[0]) { curve.push({ games: gamesIn(), best: bestFit }); cpG.shift(); }
      if (TARGET_G && gamesIn() >= TARGET_G) break;
    }
    /* --fxQuota 补送：本代末若送验次数不到配额，按环内分从高到低补送未验过的子代（同一套承兑规则）。 */
    if (QUOTA > 0 && FXSEL) {
      iterBuf.sort(function (a, b) { return b.fit - a.fit; });
      for (let k = 0; k < iterBuf.length && verifications < QUOTA && verThisIter < QUOTA_PER_ITER; k++) {
        if (TARGET_G && gamesIn() >= TARGET_G) break;
        const c = iterBuf[k];
        if (c.done) continue;
        c.done = true; verThisIter++; quotaTopups++;
        if (verifyChild(c.p, c.fit, true)) quotaAccepted++;
      }
    }
    if (!FXSEL && best !== parent) { parent = Float64Array.from(best); pf = bestFit; }
    if (!TARGET_G) { used += 0; while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); } }
    if (TARGET_G && gamesIn() >= TARGET_G) break;
  }
  if (ADAPT) console.log('[cem-arm] ⚑ 1/5 律自适应 σ：起 ' + SIG0 + ' → 终 ' + sig.toFixed(5) + ' ‖ 最小 ' + sigMin.toFixed(5) +
    ' ‖ 下限 ' + (SIG_FLOOR_ESA > 0 ? SIG_FLOOR_ESA : 1e-4) + ' ‖ 重启 ' + sigRestarts + ' 次 ‖ 轨迹样本 ' + sigTraj.length + ' 点 ‖ 窗口 ' + WIN + ' 次尝试');
  ESA_SIG_STAT = ADAPT ? { start: SIG0, final: sig, min: sigMin, floor: SIG_FLOOR_ESA > 0 ? SIG_FLOOR_ESA : 1e-4, restarts: sigRestarts } : null;
  if (FXSEL) console.log('[cem-arm] ⚑ 冻结桌当选：环内预选 ' + screened + ' 次 ‖ 在冻结桌上真打过父代 ' + accepted + ' 次（按净胜 ' + accScore +
    (PRESEL === 'parent' ? ' ‖ **预选门=parent**（子代循环分 ≥ 父代即送验）' : '') +
    (DIV ? ' ‖ 按多样性 ' + accDiv + '（探针 ' + divProbes + ' 次；触发 >' + DIV_TRIGGER + '，净胜带 ±' + DIV_TOL + '，单卡需降 ≥' + DIV_DELTA + '）' : '') +
    '）‖ 父代单卡终值 ' + (100 * parentShare).toFixed(1) + '%' + (WARM_SHAPE > 0 ? ' ‖ **两阶段**（前 ' + WARM_SHAPE + ' 局只形状、容差 ' + WARM_TOL + '）' : '') + (SHAPE_CAP > 0 || DEF_CAP > 0 || JI_CAP > 0 ? ' ‖ **形状约束@t' + SHAPE_TEMP + '**（单卡≤' + (100 * SHAPE_CAP).toFixed(0) + '% ‖ 防御≤' + (100 * DEF_CAP).toFixed(0) + '% ‖ ji≤' + (100 * JI_CAP).toFixed(0) + '%，挡下 ' + shapeBlocked + ' 个送验：单卡 ' + shapeBlockKeys.share + ' ‖ 防御 ' + shapeBlockKeys.def + ' ‖ ji ' + shapeBlockKeys.ji + '）' : '') + ' ‖ 每次验证花 ' +
    (ARENA ? Math.max(8, FXG || 0) * ARENA2_SHAPES.length : (FXG || GAMES)) + ' 局（fxGames=' + FXG + (ARENA ? '，arena2 每桌形' + Math.max(8, FXG || 0) : '') + ' ‖ 预算被这块吃掉，迭代数会少）');
  if (ARENA_LEX && parentLex) { console.log('[cem-arm] ⚑ **词典序终态**（#161' + (ARENA_PER_N ? '·每 N 聚合' : '') + '）：' + (ARENA_PER_N ? '低于地板 N 数 ' : '低于地板格数 ') + parentLex.below + '/' + (ARENA_PER_N ? new Set(Object.keys(V7_FLOOR).map(function (k) { return String(k).split(':')[0]; })).size : Object.keys(V7_FLOOR).length) +
    ' ‖ 最差格余量 ' + parentLex.worst.toFixed(3) + ' ‖ 冻结桌总分 ' + parentFix.toFixed(3) + '（货币=' + ARENA_CUR + '）');
  ESA_LEX_STAT = { below: parentLex.below, worst: parentLex.worst, floorCells: Object.keys(V7_FLOOR).length }; }
  if (ARENA_FPEN > 0) { console.log('[cem-arm] ⚑ **地板罚项终态**（λ=' + ARENA_FPEN + '）：地板缺口和 ' + parentGap.toFixed(3) +
    ' ‖ 罚后分 ' + parentFpen.toFixed(3) + ' ‖ 冻结桌总分 ' + parentFix.toFixed(3));
  ESA_FPEN_STAT = { lam: ARENA_FPEN, gap: parentGap, after: parentFpen, total: parentFix }; }
  if (QUOTA > 0 && FXSEL) console.log('[cem-arm] ⚑ **验证配额**（E7）：目标 ' + QUOTA + ' 次 ‖ 实送 ' + verifications + ' 次' +
    '（门内/探针 ' + (verifications - quotaTopups) + ' ‖ 代末补送 ' + quotaTopups + '，其中被接受 ' + quotaAccepted + '）‖ 每代补送上限 ' + QUOTA_PER_ITER +
    ' ‖ 验证吃掉约 ' + (100 * verifications * (ARENA ? Math.max(8, FXG || 0) * ARENA2_SHAPES.length : (FXG || GAMES)) / Math.max(1, gamesIn())).toFixed(1) + '% 的循环预算');
  ESA_DIV_STAT = { accepted: accepted, byScore: accScore, byDiv: accDiv, divProbes: divProbes, parentShare: parentShare,
    acceptDeltas: acceptDeltas, verifications: verifications, quota: QUOTA, quotaPerIter: QUOTA_PER_ITER, quotaTopups: quotaTopups, quotaAccepted: quotaAccepted,
    paired: FX_PAIRED ? { k: FX_PAIRED_K, blocked: pairedBlocked } : null };
  if (acceptDeltas.length) {
    const ds = acceptDeltas.map(function (x) { return x.d; }).sort(function (a, b) { return a - b; });
    const perVerifyGames = ARENA ? Math.max(8, FXG || 0) * ARENA2_SHAPES.length : (FXG || GAMES);
    console.log('[cem-arm] ⚑ **接受事件的判定力**：' + ds.length + ' 次接受的冻结桌分差 最小 ' + ds[0].toFixed(3) +
      ' ‖ 中位 ' + ds[Math.floor(ds.length / 2)].toFixed(3) + ' ‖ 最大 ' + ds[ds.length - 1].toFixed(3) +
      ' ‖ 其中 <2SE 的 ' + ds.filter(function (x) { return x < 2 * 0.7 / Math.sqrt(perVerifyGames); }).length + ' 次' +
      '（每次验证 ' + perVerifyGames + ' 局 ⇒ 单次读数 SE≈' + (0.7 / Math.sqrt(perVerifyGames)).toFixed(3) + '，两点分布估）');
    const zs = acceptDeltas.map(function (x) { return x.z; }).filter(function (x) { return x != null; });
    if (zs.length) console.log('[cem-arm] ⚑ **配对判定**（E8，K=' + FX_PAIRED_K + '）：' + zs.length + ' 次接受的配对 z 最小 ' + Math.min.apply(null, zs).toFixed(2) +
      ' ‖ 中位 ' + zs.slice().sort(function (a, b) { return a - b; })[Math.floor(zs.length / 2)].toFixed(2) +
      ' ‖ 最大 ' + Math.max.apply(null, zs).toFixed(2) + ' ‖ 被配对噪声挡下的送验 ' + pairedBlocked + ' 次');
  } else if (FX_PAIRED) {
    console.log('[cem-arm] ⚑ **配对判定**（E8，K=' + FX_PAIRED_K + '）：零次接受 ‖ 被配对噪声挡下 ' + pairedBlocked + ' 次 ⇒ 这一臂一次父代都没换（噪声门把臂关死了）');
  }
  if (SHAPE_PICK) {
    /* 起点也进归档（它本身就是形状合格线内的一枚，保证归档非空）。 */
    const shS = ARENA.evalParams(startParams, { phase: 'frozen', gamesPerShape: SHAPE_GAMES, temp: SHAPE_TEMP, cur: ARENA_CUR });
    const actsS = Math.max(1, shS.acts * shS.games);
    let dS = 0; for (const k of DEF_KEYS) dS += (shS.cat && shS.cat[k]) || 0;
    shapeArchive.push({ pack: Float64Array.from(startParams), fit: base.fit, share: shS.maxCard ? shS.maxCard.share : 0, def: dS / actsS, ji: ((shS.cat && shS.cat[R.SK.JI]) || 0) / actsS });
    const okShape = function (x) { return (SHAPE_CAP <= 0 || x.share <= SHAPE_CAP + 1e-9) && (DEF_CAP <= 0 || x.def <= DEF_CAP + 1e-9) && (JI_CAP <= 0 || x.ji <= JI_CAP + 1e-9); };
    const feas = shapeArchive.filter(okShape);
    if (feas.length) {
      feas.sort(function (a, b) { return b.fit - a.fit; });
      const pick = feas[0];
      parent = Float64Array.from(pick.pack); best = pick.pack; parentFix = pick.fit;
      console.log('[cem-arm] ⚑ **形状终选**（归档 ' + shapeArchive.length + ' 枚，合格 ' + feas.length + ' 枚）：选中 fit=' + pick.fit.toFixed(3) + ' ‖ 单卡 ' + (100 * pick.share).toFixed(1) + '% ‖ 防御 ' + (100 * pick.def).toFixed(1) + '% ‖ ji ' + (100 * pick.ji).toFixed(1) + '%');
    } else {
      console.log('[cem-arm] ⚑ **形状终选**：归档 ' + shapeArchive.length + ' 枚**没有一枚合格** ⇒ 退回 fit 最高的那枚（产物形状不合格，必须写明）');
    }
  }
  if (OUT) console.log("[cem-arm] ⚑ 单局记录（复盘用）：node tools/proto2/game-record.mjs --pack=" + OUT +
    " --temp=" + ARENA_TEMP + " --mode=" + TMODE + " --n=" + N + " --out=results/<包名>/5p-seed777.txt");
} else if (MODE === 'ga') {
  const tr = T.makeTrainer({ popSize: POP, gamesPerOpp: GAMES });
  /* 两臂必须**从同一粒起步**，否则比的不是算子而是起点。GA 侧用仓库自己的热启动 API
   * （`T.seedChampion` ⇒ 0 号位放种子粒、其余围绕它变异），不自己改种群内部结构。 */
  T.seedChampion(tr, startParams);
  const seededOk = tr.pop[0] && tr.pop[0].params.length === DIM;
  if (!seededOk) { console.error('⛔ GA 播种没落地 ⇒ 两臂起点不同，对比作废'); process.exit(2); }
  const gens = TARGET_G ? 1000000 : Math.max(1, Math.floor(EVALS / POP));
  if (T.setSeed) T.setSeed(SEED);
  for (let g = 0; g < gens; g++) {
    const st = T.step(tr);
    used += POP;
    if (st && st.best != null && st.best > bestFit) { bestFit = st.best; }
    if (TARGET_G) {
      if (gamesIn() >= TARGET_G) break;
      while (cpG.length && gamesIn() >= cpG[0]) { curve.push({ games: gamesIn(), best: bestFit }); cpG.shift(); }
    } else while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); }
  }
  best = Float64Array.from(tr.champion);
} else {
  /* 对角 CEM：mean/σ 各 DIM 维；精英取 top ELITE 重拟合；σ 有地板（不做任何"看结果再调"的事后旋钮） */
  let mean = Float64Array.from(startParams);
  let sd = new Float64Array(DIM).fill(SIG0);
  const r = rngFor(SEED);
  const iters = TARGET_G ? 1000000 : Math.max(1, Math.floor(EVALS / POP));
  let auditsBefore = 0;   /* mastery 门的本代审计起点（每代重置） */
  let bestFitPasser = -Infinity;   /* 勘误二：达标者产物棘轮（产物只从过门候选里出） */
  for (let it = 0; it < iters; it++) {
    auditsBefore = MASTERY_STAT.audits;
    const cand = [], scored = [];
    for (let i = 0; i < POP; i++) {
      const v = new Float64Array(DIM);
      for (let d = 0; d < DIM; d++) v[d] = mean[d] + sd[d] * gauss(r);
      cand.push(v); scored.push(FUNNEL > 0 ? coarseOne(v, it) : evalOne(v, it, i));
    }
    let order;
    if (FUNNEL > 0) {
      /* 粗筛（每粒只有 FUNNEL_S1 局）→ 前 FUNNEL 粒补到 GAMES 局 → **精英只从决赛者里出**（successive rejecting）。
       *   非决赛者按粗筛分排在后面 ⇒ mastery 门在决赛者全不达标时仍能按序退回审计（口径与 flat 臂同一条队列）。 */
      const co = scored.map(function (x, i) { return i; }).sort(function (a, b) { return scored[b].fit - scored[a].fit; }).slice(0, Math.min(FUNNEL, POP));
      for (const i of co) scored[i] = refineInto(scored[i], cand[i], it);
      const finSet = new Set(co);
      const rest = scored.map(function (x, i) { return i; }).filter(function (i) { return !finSet.has(i); })
        .sort(function (a, b) { return scored[b].fit - scored[a].fit; });
      order = co.sort(function (a, b) { return scored[b].fit - scored[a].fit; }).concat(rest);
    } else order = scored.map(function (s, i) { return i; }).sort(function (a, b) { return scored[b].fit - scored[a].fit; });
    /* mastery 门 · elite 档：精英只吃达标者（按 fit 降序审计；<2 个达标 ⇒ 退回纯 fit 并记 starved）。
     * ⚑ 勘误二（10-31 00:4x）：产物只从**达标者**里棘轮（bestFitPasser 独立记账）——
     *   第一轮的教训：4 局循环分棘轮会把产物冻结在早期幸运子代上（往往是饿退代的纯 fit 顶），
     *   门塑形了种群（合格率 87%）却管不到产物（正式尺 0.0/局）。饿退代一律不更新产物。 */
    let keep, passerTop = null;
    if (MASTERY_ON && MASTERY_GATE === 'elite') {
      const passers = [];
      for (const k of order) {
        if (passers.length >= Math.max(2, ELITE)) break;
        if (MASTERY_STAT.audits - auditsBefore >= MASTERY_CAP) break;
        const r = masteryRate(cand[k]);
        if (r != null && r >= MASTERY_LINE) passers.push(k);
      }
      if (passers.length >= 2) {
        keep = passers.slice(0, Math.max(2, ELITE));
        passerTop = keep[0];
      } else { MASTERY_STAT.starved++; keep = order.slice(0, Math.max(2, ELITE)); }
    } else keep = order.slice(0, Math.max(2, ELITE));
    const nm = new Float64Array(DIM), ns = new Float64Array(DIM);
    for (let d = 0; d < DIM; d++) {
      let m = 0; for (const k of keep) m += cand[k][d]; m /= keep.length; nm[d] = m;
    }
    for (let d = 0; d < DIM; d++) {
      let v = 0; for (const k of keep) { const e = cand[k][d] - nm[d]; v += e * e; } v /= keep.length;
      ns[d] = Math.sqrt(v) < SIG_FLOOR ? SIG_FLOOR : Math.sqrt(v);
    }
    /* mastery 门 · best 档：产物必须达标（top-fit 不达标沿 fit 降序往下审；elite 档下 keep 已全达标，直落）。 */
    const bf = scored[keep[0]].fit;
    if (MASTERY_ON && MASTERY_GATE === 'elite') {
      /* 勘误二：elite 档产物只从达标者棘轮；饿退代（passerTop 空）不更新产物 */
      if (passerTop != null && scored[passerTop].fit > bestFitPasser) {
        bestFitPasser = scored[passerTop].fit; best = cand[passerTop];
        if (bestFitPasser > bestFit) bestFit = bestFitPasser;
      }
    } else if (MASTERY_ON && MASTERY_GATE === 'best') {
      for (const k of order) {
        if (MASTERY_STAT.audits - auditsBefore >= MASTERY_CAP) break;
        if (scored[k].fit <= bestFit) break;   /* 再往下审计也超不过现役 best */
        const r = masteryRate(cand[k]);
        if (r != null && r >= MASTERY_LINE) { bestFit = scored[k].fit; best = cand[k]; MASTERY_STAT.bestAccepted++; break; }
        MASTERY_STAT.bestGatedFail++;
      }
    } else if (bf > bestFit) { bestFit = bf; best = cand[keep[0]]; }
    mean = nm; sd = ns;
    used += POP;
    if (TARGET_G) {
      if (gamesIn() >= TARGET_G) break;
      while (cpG.length && gamesIn() >= cpG[0]) { curve.push({ games: gamesIn(), best: bestFit }); cpG.shift(); }
    } else while (checkpoints.length && used >= checkpoints[0]) { curve.push({ evals: used, best: bestFit }); checkpoints.shift(); }
  }
}
const gLoop = gamesIn();
/* §E822：**同场起点基线** —— 终局那把尺必须先在同一批桌上量一次"起点粒"，否则 6.5% / 13.0% 这种数没有地板
 *   （第一波只印了 `起点分母 fit=… 夺1=50.0%`，那是 **2 局**的读数，拿来当参照就是把噪声当地板）。 */
const hoStart = holdout(START_COPY);
const gStart = gamesIn() - gLoop;
const ho = holdout(best);
const gHold = gamesIn() - gLoop - gStart;
const row = { mode: MODE, seed: SEED, evals: used, pop: POP, games: GAMES, n: N, elite: ELITE, sig0: SIG0, ignoredFlags: IGNORED_IN_CEM.length ? IGNORED_IN_CEM : null,
  sigFloor: SIG_FLOOR_ESA, sigRestart: SIG_RESTART, esaSig: ESA_SIG_STAT, arenaPen: ARENA_PEN,
  /* §E822：**实际局数**（计数器数出来的）与"标称预算"并列印 ⇒ 谁想拿 `evals` 当等预算，先看见这两个数 */
  gamesPlanned: used * GAMES, gamesActualLoop: gLoop, gamesActualHoldout: gHold, gamesActualStartHoldout: gStart,
  targetGames: TARGET_G || null,
  /* §E822 吞吐记账（2.0 才有 ⇒ 不带 EPIRUS_ARCH2 时为 null）：横比与"要不要上 GPU"都得先看这两个数 */
  netForwards: P.__arch2 ? P.__arch2.CNT.forwards : null,
  netCandScores: P.__arch2 ? P.__arch2.CNT.cands : null,
  /* §E679 补（10-22）：回执里必须自带**桌形与终局读数局数** —— 批 D 的数当时只能从日志首行的打印抄，
   *   而"哪台尺 + 哪种启动"是读数可不可比的一部分（记忆：记下用哪台尺与哪种启动）。 */
  trainMode: TMODE, holdoutGames: HOLD,
  startFit: base.fit, inLoopBest: bestFit, holdoutFit: ho.fit, holdoutFirst: ho.first, holdoutTop2: ho.top2,
  /* §E822 同场起点基线：与上面三个 `holdout*` 走**同一函数、同一批桌** ⇒ `dFirst/dTop2` 才是这趟训练买到的东西
   *   （第一波只印了 2 局的"起点分母"，那不是地板，是噪声）。 */
  holdoutStartFit: hoStart.fit, holdoutStartFirst: hoStart.first, holdoutStartTop2: hoStart.top2,
  dFirst: ho.first - hoStart.first, dTop2: ho.top2 - hoStart.top2,
  /* arena2（--arena2=1）：上面所有 holdout* 都是 **arena2 的 holdout**（净胜 + 原始夺1），不是旧 scoreMemberN。
   *   `currency` 标明这一格 ⇒ 与旧臂的 fit 数值不可比。`maxCard` 是终局那一把的单卡占比（判退化用）。 */
  currency: ARENA ? ('arena2.' + ARENA_CUR + (ARENA_DIV ? '+div' : '')) : 'scoreMemberN.fit',
  arena: ARENA ? { fp: ARENA.fp, temp: ARENA_TEMP, shapes: ARENA2_SHAPES.length, roster: ARENA.roster.length, pool: ARENA.pool.length,
    holdGamesPerShape: ARENA_HOLD, holdGames: ho.games, draw: ho.draw, cur: ARENA_CUR, diverse: ARENA_DIV, highN: ARENA_HIGH_N, stratified: ARENA_STRAT,
    stratCap: ARENA.stratCap, stratMix: ARENA.stratMix,
    divTol: DIV_TOL, divDelta: DIV_DELTA, divEvery: DIV_EVERY, divTrigger: DIV_TRIGGER, esa: ESA_DIV_STAT,
    lex: ESA_LEX_STAT,
    fpen: ESA_FPEN_STAT,
    bestMaxCard: ho.maxCard, startMaxCard: hoStart.maxCard, bestByShape: ho.byShape } : null,
  curve: curve, secs: Number(((Date.now() - t0) / 1000).toFixed(1)), startLabel: startLabel,
  /* 谱系（给演化图用）：parent 是起点包或 random；outHash/gen 是产物身份。recipe 只收与"选法"有关的开关。 */
  id: armId(OUT), parent: (startLabel.indexOf('夹具包') === 0 ? armId(START_PACK) : ''),
  lineage: { parent: startLabel.indexOf('夹具包') === 0 ? START_PACK : 'random', parentHash: startHash,
    outHash: OUT ? (function () { try { return createHash('md5').update(JSON.stringify(P.pack(best))).digest('hex'); } catch (e) { return null; } })() : null,
    gen: OUT ? (function () { try { const vv = P.pack(best).v; return vv === 92 ? 3 : (vv === 91 ? 2 : (vv === 90 ? 1 : null)); } catch (e) { return null; } })() : null,
    seed: SEED, recipe: { arenaLex: ARENA_LEX, arenaPerN: ARENA_PER_N, boN: BO_N, shapeCap: SHAPE_CAP, shapePick: SHAPE_PICK, warmShape: WARM_SHAPE } },
  /* mastery 门（ARCH-2026-10-31-BUCKET-POOL §四）：开着就必带计数，audits=0 视为没接电（见下方自证） */
  mastery: MASTERY_ON ? { key: MASTERY_KEY, gate: MASTERY_GATE, line: MASTERY_LINE, games: MASTERY_GAMES, n: MASTERY_N, table: MASTERY_TABLE, cap: MASTERY_CAP, stat: MASTERY_STAT } : null,
  funnel: (MODE === 'cem' && FUNNEL > 0) ? { take: FUNNEL, coarseGames: FUNNEL_S1, totalGames: GAMES,
    gamesFirstStage: POP * FUNNEL_S1, gamesSecondStage: FUNNEL * Math.max(0, GAMES - FUNNEL_S1) } : null };
/* 打分健康度（2.0 臂才量：v7 那档没有“逐候选打分退化”这一格病，别把两件事混在一条读数里） */
if (P.__arch2) {
  try {
    const fx = collectFixtures(W, { perShape: HEAD_FIX }).fixtures;
    const hPack = agreeVsRandom(W, Float64Array.from(best), fx, HEAD_TEMP, headHealth(W, Float64Array.from(best), fx, HEAD_TEMP));
    const hRef = headHealth(W, ARENA_REF || V7_HEALTH_REF, fx, HEAD_TEMP);   /* v7 只并报刻度：架构不同，拿它比“随机起点包”没意义 */
    row.headHealth = { temp: HEAD_TEMP, states: hPack.states, pack: hPack, v7: hRef, flatLineAgreePct: Number((100 * HEAD_FLAT_AGREE).toFixed(0)), calib: '随机起点彼此 93~97% ‖ v7 5%（60 个真局决策点，原件 scratch/qoder-1030-headcalib2.mjs）', gate: HEAD_GATE ? '开' : '关（只报不判）' };
    console.log('\n⚑ 打分有没有牙（判据 = 同一串骰子下与随机起点包打同一手的比率，平头线 ' + (HEAD_FLAT_AGREE * 100).toFixed(0) + '% ‖ 并报刻度：集中度 max(p)×K、熵占比）：');
    console.log(fmtHead('本臂最优粒', hPack));
    if (hRef && hRef.states) console.log(fmtHead('v7 参照 同t', hRef));
    if (HEAD_GATE && hPack.flat) {
      console.error('\n⛔ --headGate=1：**平头包不许当冠军** ⇒ 与随机起点包同骰一致 ' + hPack.agreeRandom + '% ≥ 平头线 ' + (HEAD_FLAT_AGREE * 100).toFixed(0) + '%（随机彼此实测 93~97% ‖ v7 只有 5%）' +
        '（同批 ' + hPack.states + ' 个真局决策点）。产物已落盘但不算合格臂；要放开就别带这个旗标。');
      row.headGate = '红';
    } else row.headGate = HEAD_GATE ? '绿' : '未开闸';
  } catch (e) { row.headHealth = { err: String((e && e.message) || e) }; console.log('⚠ 健康度量失败（不影响臂本身）：' + row.headHealth.err); }
}
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  const packed = P.pack(best);
  writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
  row.wrote = OUT;
  /* ⚑ 空臂标记（10-31）：产物与起点**逐字节相同** ⇒ 这一臂什么都没接受。
   *   动因是实测：`OB3S-BIGT-s7.bak` 与 `OB3S-BIGT-s11.bak` 的 md5 与父本 `OB3S-C2-s7.bak` 全等
   *   （各吃 24k 局、0 次接受），而它们在建表时算"两条子代"⇒ 演化图上是两条**假分叉**。
   *   只在起点是真包时判（随机起点没有父本可对）；哈希口径 = md5(pack JSON)，
   *   与 `parentHash`（md5 文件字节）**不同源不可互相对账**，所以这里现算两边。 */
  if (startLabel.indexOf('夹具包') === 0) {
    try {
      const hOf = (arr) => createHash('md5').update(JSON.stringify(P.pack(arr))).digest('hex');
      row.lineage.noOp = hOf(best) === hOf(START_COPY);
      if (row.lineage.noOp) console.log('⚑ **空臂**：产物与起点 `' + START_PACK + '` 逐字节相同 ⇒ 整轮零次接受，别把它当分叉画进演化图。');
    } catch (e) { row.lineage.noOp = null; }
  }
  /* 代 2 补的标注：**产物自己说自己是哪一代理出来的**（容器字段 + 段表 + 每段权重区/bias 区 + 参数量）。
   * 为什么放这儿：以前读一枚包要照 `arch` 猜输入面、照长度猜形状，两处各写一遍下标就会静默错位
   *   （10-30 那笔事故：S1o 声明 5650、任何前向都不读 2688）。标注由 `pack()` 一次算出来 ⇒ 只有这一个真源。 */
  if (P.__arch2) {
    const LL = P.__arch2.L;
    row.container = {
      v: packed.v, arch: packed.arch, gen: LL.gen, dims: packed.dims, n: LL.n,
      seg: LL.seg.map(function (s) {
        const inDim = { seatEnc: LL.seatIn, actEnc: LL.actIn, ctx: LL.ctxDim, cand: LL.candIn }[s.name];
        const rows = { seatEnc: LL.seatH, actEnc: LL.actH, ctx: LL.hid, cand: LL.hid2, policyHead: LL.hid2 }[s.name];
        return inDim ? { name: s.name, off: s.off, len: s.len, weight: [s.off, s.off + rows * inDim], bias: [s.off + rows * inDim, s.off + s.len], fanIn: LL.fanIn[s.name] }
          : { name: s.name, off: s.off, len: s.len, weight: [s.off, s.off + s.len], bias: null, fanIn: LL.fanIn[s.name] };
      })
    };
  }
}
if (!QUIET) console.log(JSON.stringify(row));
else console.log('RESULT ' + JSON.stringify(row));
/* mastery 门自证（patch-must-prove-invoked）：开着但 0 审计 ⇒ 没接电，响亮退出；顺带印终态计数 */
if (MASTERY_ON) {
  console.log('[cem-arm] ⚑ mastery 门终态（' + MASTERY_KEY + ' ≥' + MASTERY_LINE + '/局 ' + MASTERY_GATE + ' 档' + (MASTERY_MAX > 0 ? '，上界 ' + MASTERY_MAX : '') + '）：审计 ' + MASTERY_STAT.audits +
    ' ‖ 达标 ' + MASTERY_STAT.pass + '（' + (100 * MASTERY_STAT.pass / Math.max(1, MASTERY_STAT.audits)).toFixed(1) + '%）' +
    (MASTERY_MAX > 0 ? ' ‖ 上界拦 spam ' + (MASTERY_STAT.spam || 0) : '') +
    ' ‖ 精英饿退 ' + MASTERY_STAT.starved + ' 代 ‖ best 档拒 ' + MASTERY_STAT.bestGatedFail + ' ‖ 末次审计率 ' + (MASTERY_STAT.lastRate == null ? '-' : MASTERY_STAT.lastRate.toFixed(3)) + '/局');
  if (MASTERY_STAT.audits === 0) { console.error('⛔ mastery 门开着但 0 次审计 ⇒ 门没接电，本臂作废'); process.exit(7); }
}
console.log('⚠ inLoopBest 是各臂**循环内部**的分（GA 走 shaped/内部择优，CEM 走原始 fit）⇒ 跨臂不可比；跨臂只比 holdoutFit / holdoutFirst（同一函数同一场）。');
if (ARENA) {
  console.log('⚑ arena2 终局（货币=' + ARENA_CUR + (ARENA_DIV ? '+多样性当选' : '') + (ARENA_STRAT ? '+分层场' : '') + '）：' + (ARENA_CUR === 'clean' ? '干净净胜' : '净胜') + ' ' + ho.fit.toFixed(3) + '（起点 ' + hoStart.fit.toFixed(3) + ' ⇒ Δ ' + (ho.fit - hoStart.fit).toFixed(3) + '）' +
    ' ‖ 夺1 ' + (100 * ho.first).toFixed(1) + '%（起点 ' + (100 * hoStart.first).toFixed(1) + '%）' +
    ' ‖ 平局 ' + (100 * ho.draw).toFixed(1) + '%（起点 ' + (100 * hoStart.draw).toFixed(1) + '%）' +
    ' ‖ 单卡 ' + fmtCard(ho.maxCard) + '（起点 ' + fmtCard(hoStart.maxCard) + '）');
  console.log('   逐桌形夺1：' + Object.keys(ho.byShape).map(function (k) { return k + ' ' + (100 * ho.byShape[k].first).toFixed(1) + '%'; }).join(' ‖ '));
}
console.log('⚑ 实际局数（计数器数的，含起点分母与 holdout 之外的循环）：循环 ' + gLoop + ' 局 ‖ holdout ' + gHold + ' 局 ‖' +
  ' 而标称 `evals×games` = ' + (used * GAMES) + ' ⇒ **横比只认这个数**；两臂循环局数不等 ⇒ "同预算"这句话不成立（§E822 实测 GA 与 CEM 差 3 倍）');
if (P.__arch2) {
  const c = P.__arch2.CNT;
  console.log('⚑ 吞吐（2.0 前向自己的账）：决策打分 ' + c.forwards + ' 次 ‖ 候选打分 ' + c.cands + ' 个 ‖' +
    ' 每局平均 ' + (c.forwards / Math.max(1, gLoop + gHold + gStart)).toFixed(1) + ' 次决策 ⇒' +
    ' **"局数相等"不等于"算力相等"：赢面高的包局更长、决策更多**（这一格以前没人印过）');
}
/* ===== `--verifGate=1` 的判语（在落 meta 之前算，事后拿 .meta.json 也能复查这一格）===== */
if (row.arena && row.arena.esa) {
  const vv = row.arena.esa.verifications, aa = row.arena.esa.accepted;
  if (VERIF_GATE && vv === 0) {
    console.error('\n⛔ --verifGate=1：整臂 **verifications=0**（accepted=' + aa + ' ‖ evals=' + row.evals + ' ‖ 循环 ' + row.gamesActualLoop + ' 局）' +
      ' ⇒ 搜索一次都没把子代送去验证 ⇒ 这条臂的 Δ 全部是"同一起点重测"的抖动，不是训练的效果。' +
      '\n   这不是"训练没用"，是"训练没被问过"。10-30 实测：同预算换 `--arenaLex=1`+冻结桌验证 ⇒ accepted=5 ‖ verifications=104 ⇒ 头能醒（一致率 57.9%）。' +
      '\n   （本闸按用户 10-30 裁定**只住训练侧**，不接发布门禁。）');
    row.verifGate = '红';
  } else if (VERIF_GATE) row.verifGate = '绿（verifications=' + vv + ' ‖ accepted=' + aa + '）';
  else row.verifGate = '未开闸';
} else if (VERIF_GATE) {
  /* ⚑ 10-30 晚补：GA/CEM 路径**没有 `arena.esa` 这个块** ⇒ 上面那段整个跳过 ⇒ 传了 `--verifGate=1` 也既不判也不印。
   *   "闸没跑成"与"闸过了"同形是本仓最怕的那一族（今天 DS 的 9 枚 CEM 臂 meta 里就一格 `verifGate` 都没有）。
   *   这里明写"不适用"，不许留空。 */
  row.verifGate = '不适用（本臂 mode=' + row.mode + ' 没有 esa 计数 ⇒ 这条闸只判 ESA/精英接受口径）';
  console.log('[cem-arm] ⚠ `--verifGate=1` 已传但**本臂没有 esa 计数**（mode=' + row.mode + '）⇒ 这条闸**不判**，不是"判过了"。' +
    '⇒ CEM 每代整池评估 ⇒ 要判"搜索有没有被考卷回答"请看 `verifications` 之外的口径（如 冻结桌当选次数），或改用 ESA。');
}

/* ===== 索引 `scratch/arms/index.tsv`：名字瘦下去之后，"规律"住在这一层 =====
 * 列固定、制表符分隔、追加写 ⇒ 分析用 awk/TSV、演化图按 `id`/`parent` 连边。
 * 读不出的格一律写 `-`：空串会让列错位，而列错位是本仓表格的老病（分隔符现算，别在源码里写字面制表符）。 */
function appendIndex(o, row) {
  const TAB = String.fromCharCode(9), NL = String.fromCharCode(10);
  const f = 'scratch/arms/index.tsv';
  const head = ['id', 'file', 'gen', 'parent', 'mode', 'pop', 'seed', 'evals', 'targetGames',
    'startFit', 'fit', 'dFit', 'startFirst', 'first', 'agree', 'conc', 'singleCard', 'cardShare',
    'secs', 'outHash', 'headGate', 'verifGate', 'time'].join(TAB) + NL;
  const hv = (x) => (x === null || x === undefined || !Number.isFinite(Number(x)) ? '-'
    : (typeof x === 'number' ? Number(x).toFixed(4) : String(x)));
  try {
    const hh = row.headHealth && row.headHealth.pack ? row.headHealth.pack : {};
    const mc = row.arena && row.arena.bestMaxCard ? row.arena.bestMaxCard : null;
    const line = [armId(o), o, (row.lineage && row.lineage.gen != null ? row.lineage.gen : (P.__arch2 ? 2 : 0)),
      row.parent || '-', row.mode, row.pop, row.seed, row.evals,
      row.targetGames == null ? '-' : row.targetGames,
      hv(row.holdoutStartFit), hv(row.holdoutFit),
      hv((typeof row.holdoutFit === 'number' && typeof row.holdoutStartFit === 'number') ? row.holdoutFit - row.holdoutStartFit : NaN),
      hv(row.holdoutStartFirst), hv(row.holdoutFirst), hv(hh.agreeRandom), hv(hh.concMed),
      mc ? mc.key : '-', hv(mc ? mc.share : NaN), hv(row.secs),
      (row.lineage && row.lineage.outHash) ? String(row.lineage.outHash).slice(0, 8) : '-',
      /* 闸的读数在 meta 里是一整句话；索引这一列只留**词**（TSV 里塞整句会把 awk 的读者惹毛，也让图例没法画） */
      (function (x) { const t = String(x || '-'); return t.indexOf('绿') === 0 ? '绿' : t.indexOf('红') === 0 ? '红' : t.indexOf('不适用') === 0 ? '不适用' : t.indexOf('未开闸') === 0 ? '未开闸' : t.slice(0, 6); })(row.headGate),
      (function (x) { const t = String(x || '-'); return t.indexOf('绿') === 0 ? '绿' : t.indexOf('红') === 0 ? '红' : t.indexOf('不适用') === 0 ? '不适用' : t.indexOf('未开闸') === 0 ? '未开闸' : t.slice(0, 6); })(row.verifGate),
      new Date().toISOString().slice(5, 16).replace('T', ' ')].join(TAB) + NL;
    if (!existsSync(f)) writeFileSync(f, head, 'utf8');
    appendFileSync(f, line, 'utf8');
  } catch (e) {
    console.log('[cem-arm] ⚠ 索引没写上（' + String((e && e.message) || e).slice(0, 60) + '）——臂本身已落盘，但**这一臂在图里会缺席**，补索引或重跑');
  }
}
if (OUT) { mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT + '.meta.json', JSON.stringify(row, null, 1), 'utf8'); appendIndex(OUT, row); }
/* `--headGate=1` 的红要真的把批挡住 ⇒ 非零退出（产物已落盘，事后仍可复盘，但**回执不许被当合格臂引用**）。
   缺省不开闸 ⇒ 历史臂与不带这个旗标的批次逐字不变。 */
if (HEAD_GATE && row.headGate === '红') process.exit(9);
if (VERIF_GATE && row.verifGate === '红') process.exit(9);
