/* Epirus 上线冠军提升（v1.5.8）
 *
 * 为什么要有它：v1.5.7 我是**手工**把 long-33 拷进 `js/bundled-champion-3p.js` 并手改 meta 的
 * （加 shippedAs / examScoreAtBuild / rulesFingerprint）。手工换冠军有三处容易漏：
 *   ① 忘了刷 `index.html` 的 `?v=` 缓存戳 ⇒ 浏览器继续用旧包；
 *   ② 忘了记 `rulesFingerprint` ⇒ np-test D16 红（或更糟：静默过期）；
 *   ③ 忘了记成绩 ⇒ 下一个人不知道这个包值多少分。
 * 这个脚本把三件事绑成一条命令。
 *
 * ⚠️ 它会**先跑一遍冠军体检的 A/B/C/E/F/G 类指标**（考卷 + 自对局打架活跃度 + 被动/活跃场行为 + 有效技能数）
 * 并把结果打出来 —— 因为"单一考卷分会被熬骗"（REVIEW §11）：v1.5.7 换上 long-33 时它考卷 45.3%，
 * 自对局却 20/20 局零伤害。v1.5.8 起这些只是 `console.warn`（末尾还写着"决定权在你"）；
 * **v1.5.18 起它们是阻断条件**（第三方复核 §7-4(1)）：6 项任一不过就中止、不换包，
 * 确实要越过就 `--force`（会把越过的条件记进 meta 的 `auditFails`/`auditForced`）。
 *
 * 用法：node tools/promote-champion.mjs docs/artifacts/eco-34.bak [--exam-games=40] [--games=10] [--note="..."]
 *       [--force] [--exam-first=<1st%>]   # 后者用于沙箱里子进程管道被拦时，先自己跑 eval-5p 再把数传进来
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesFingerprint, fingerprintOfBundle } from './rules-fingerprint.mjs';
/* v1.5.18：体检指标（B/C/E/F/G）改走**共享库** —— 与 `tools/champ-audit.mjs` 同一份实现。
 * 抽取起因见 CHANGELOG v1.5.18：指标原先"只打印、不判定"（第三方复核 §7-4(1)），
 * 而把它变成阻断条件就必然要在两个工具里各写一遍 → 那正是这个项目栽过四次的事。 */
import { sandbox, selfPlay, fieldRate, reflectWall, seatSymmetry, aggressionProfile, feasibilityOf, sniperField, chargeProfile, densityProfile, breadthProfile } from './audit-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2).filter((a) => !/^--/.test(a));
const flag = (n, d) => { const h = process.argv.find((a) => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const SRC = ARGV[0];
if (!SRC) { console.error('用法: node tools/promote-champion.mjs <bak文件> [--exam-games=40] [--note="..."]'); process.exit(2); }
const EXG = Number(flag('exam-games', 40));
const NOTE = flag('note', '');
/* v1.5.71：`--dry` = 只做体检与自检、**一个文件都不写**。
 * 起因：这次给换包工具加了 `meta.feasibility` 记录块，我需要**真实运行证据**（而不是只跑单测），
 * 但又绝不能顺手改写线上包/缓存戳（改了就得多跑一轮 smoke + battle 验证）。 */
const DRY = process.argv.includes('--dry');
const BUNDLE = join(ROOT, 'js/bundled-champion-3p.js');
const INDEX = join(ROOT, 'index.html');

if (existsSync(join(ROOT, 'docs/artifacts/.training.lock'))) {
  console.error('⛔ 训练正在进行（存在 docs/artifacts/.training.lock）—— 此时换 bundle 会被自跑器的还原覆盖。等训练结束再跑。');
  process.exit(3);
}

/* 1) 读源包 + 体检（考卷 + 自对局活跃度） */
const src = readFileSync(join(ROOT, SRC), 'utf8');
/* ⚠️ 两个槽位必须分清楚：`EPIRUS_CHAMPION_3P`（权重包）与 `EPIRUS_CHAMPION_3P_META`（元数据）。
 * 第一版我把 meta 写进了**冠军槽**（replace 用错了捕获组）⇒ 包直接损坏（np-test N19/D12 立刻红）。
 * 现在：分开两个正则、只替换 meta 那一段，并在写完做**回读自检**。 */
const champM = /(window\.EPIRUS_CHAMPION_3P\s*=\s*)(\{[\s\S]*?\})(\s*;)/.exec(src);
const metaM = /(window\.EPIRUS_CHAMPION_3P_META\s*=\s*)(\{[\s\S]*?\})(\s*;)/.exec(src);
if (!champM) { console.error('⛔ 源文件里找不到 window.EPIRUS_CHAMPION_3P'); process.exit(4); }
if (!metaM) { console.error('⛔ 源文件里找不到 window.EPIRUS_CHAMPION_3P_META'); process.exit(4); }
const packJson = champM[2];
const meta = JSON.parse(metaM[2]);

console.log('== 换前体检：' + SRC + ' ==');
/* --exam-first=<百分数>：跳过内部 spawn（沙箱里 Node 的子进程管道可能被拦），
 * 由调用方先单独跑 `node tools/eval-5p.mjs <局数> 5 77000 <包>` 再把 1st% 传进来。
 * 这时 meta 里会记 examSource:'cli' 以示区分（内部跑的记 'spawn'）。 */
const EXAM_FIRST = flag('exam-first', '');
let first = null, examSource = 'spawn';
if (EXAM_FIRST !== '') {
  first = String(EXAM_FIRST);
  examSource = 'cli';
  console.log('   多人 3 血考卷 1st = ' + first + '%（由 --exam-first 传入，未内部复跑）');
} else {
  const ev = spawnSync(process.execPath, ['tools/eval-5p.mjs', String(EXG), '5', '77000', SRC], { cwd: ROOT, encoding: 'utf8' });
  const evOut = (ev.stdout || '') + (ev.stderr || '');
  first = (/\[冠军\]\s*1st=([\d.]+)%/.exec(evOut) || [])[1];
  console.log('   多人 3 血考卷 1st = ' + (first || '?') + '%（' + EXG + ' 局）');
}

/* 自对局活跃度 + E/F/G：**共享指标库**（与 champ-audit 逐字同口径，5 座全是它自己）。
 * ⚠️ v1.5.18：`--games` 默认从 10 提到 **20** —— G（有效技能数）在小样本下会**系统性偏低**：
 * 实测同一个冠军 eco-34 的 G = n5:3.08 / n10:2.99 / n20:4.24 / n40:4.54 / n80:4.21 / n160:4.21
 * （罕见技能还没出现 ⇒ 熵被低估）。用 n=10 去卡 `G<3` 等于把噪声当结论（本项目"阈值是刀锋"的第 N 次）。
 * B/C/E/F 几列在 n=10 与 n=20 下读数接近（伤害/局 13.60 → 13.50），所以统一用 20 不影响历史可比性。 */
const W = sandbox();
/* v1.5.63：**必须原生读取**（`unpack(json, true)`）。历史包是 v5/v6 形状，`unpack(json)`（默认嵌入 v7）
 * 对它们返回 **null** ⇒ 体检直接崩（实测 eco-34.bak：unpack(j)=null / unpack(j,true)=3337 位）。
 * 规矩见 `audit-lib.loadChamp` 的注释："测量工具必须能读历史形状 —— 保持原生形状读取，不要嵌入"。 */
const params = W.EpirusPolicy.unpack(JSON.parse(packJson), true);
const G = Number(flag('games', 20));
const sp = selfPlay(W, params, 'multi', G);
const fPass = fieldRate(W, params, 'passive', 'multi');
const fAct = fieldRate(W, params, 'active', 'multi');
const dpg = sp.dmgPerGame, drawRate = sp.drawRate;
console.log('   自对局（5 座同一冠军 ×' + G + '）：伤害/局 = ' + dpg.toFixed(1) +
  '，平局率 = ' + (drawRate * 100).toFixed(0) + '%，回合 = ' + sp.rounds.toFixed(1) +
  '，全息屏障/局 = ' + sp.holoPerGame.toFixed(1) + '，有效技能数 = ' + sp.effSkills.toFixed(2));
console.log('   穿透卡落地命中（自对局）：' + (sp.pierceKeys || []).map(function (k) {
  return ((W.EpirusRules.byKey[k] || {}).name || k) + '=' + ((sp.landByKey || {})[k] || 0);
}).join('  '));
console.log('   E 被动场：旧口径摆架势率 = ' + (fPass.stance * 100).toFixed(0) + '%   ' +
  '**新口径·无威胁(对手ジ<5)时摆架势 = ' + (fPass.noThreatStanceRate * 100).toFixed(0) + '%**' +
  '（无威胁回合 ' + fPass.noThreatRounds + '，最长无威胁连摆 ' + fPass.maxNoThreatRun + '）' +
  '   F 活跃场进攻率 = ' + (fAct.atk * 100).toFixed(0) + '%');
/* G 的样本下限：见上面 `--games` 的说明（n<20 时熵会被罕见技能的低估拖下去）。 */
if (G < 20) console.warn('   ⚠️ 自对局只有 ' + G + ' 局：G（有效技能数）在小样本下会系统性偏低，别拿它下结论（n≥20 才收敛）。');

/* v1.5.18（第三方复核 §7-4(1)）：原先只有 3 条 `console.warn`（末尾还写"决定权在你"），
 * 而 champ-audit 的 E/F 两列**只打印、不参与任何判定** ⇒ "集体防御/打法坍缩"这类形状量出来了也没人挡。
 * 现在 6 项全部是**阻断条件**；确实要越过就 `--force`，但会在 meta 里留痕（auditFails/auditForced）。 */
const FORCE = process.argv.includes('--force');
const fails = [];
if (dpg < 5) fails.push('伤害/局 ' + dpg.toFixed(1) + ' < 5（很可能是"熬"型冠军：考卷分会被熬骗）');
if (drawRate > 0.2) fails.push('平局率 ' + (drawRate * 100).toFixed(0) + '% > 20%（自对局打不起来）');
/* v1.5.37（复核 §2-1 + 用户裁定）：**撤掉旧的 ">2 次/局" 普通条件**。
 * 理由：全息屏障**本来就不能给自己**（自保用原型制御）⇒ "把盾送给别人"是**这张卡的定义**，不是 bug；
 * 真正的问题是**用得太频繁**。故只保留下面那条**硬门槛**（套给别人 > 6 次/局，不可 --force），
 * 并把实测分布留档：v7wall-33 = 18.7/局（100% 送人，用户手感异常）vs v7wall-31 = 2.0~2.9/局（正常使用）。
 * 若将来要给"过度送盾"更细的形状先验（例如"送给当前血量领先者才罚"），再另立指标。 */
const holoSoftNote = sp.holoPerGame;   // 仅留档，不再作为阻断条件
/* v1.5.28（第三方复核 §4-2b，用户裁定先做）：**关键穿透卡下限**。
 * G 只看出手分布的熵 ⇒ "变宽但丢关键卡"能骗过它：v1.5.27 实测 G 4.15→6.55、同时激光剑 0 命中、
 * 长程反弹墙 85%→0%（对方 4 面反弹墙时它**一枪未发**，被终局收缩耗死）。
 * 规则：**每一张能穿反弹/穿防御的攻击卡**（规则数据推导：激光剑/坦克/狙击枪/电磁炮）在自对局里
 * 必须至少落地命中 1 次；一张都没有 ⇒ 阻断（要越过就 --force，并留痕）。 */
const rw = reflectWall(W, params, 'long', G);
console.log('   反弹墙（4 席 reflectspam · 长程 · ' + G + ' 局）：主动伤害 ' + rw.dmgPerGame.toFixed(2) + '/局' +
  '，零伤害局 ' + (rw.zeroDamageRate * 100).toFixed(0) + '%' +
  '，穿透卡命中 ' + rw.pierceLand + '（' + rw.pierceKeys.map(function (k) {
    return ((W.EpirusRules.byKey[k] || {}).name || k) + '=' + (rw.landByKey[k] || 0);
  }).join(' ') + '）');
/* v1.5.28（复核 §3-1 实测）：**反弹墙里穿透卡零命中 = 打不破墙** ⇒ 阻断。
 * 这是唯一能抓住"G 涨了但激光剑线丢了"的指标：v1.5.27 自对局激光剑命中 20 次、墙里 0 次。 */
if (rw.pierceLand === 0) {
  fails.push('反弹墙里穿透卡零命中（' + rw.pierceKeys.map(function (k) {
    return ((W.EpirusRules.byKey[k] || {}).name || k);
  }).join('/') + '）⇒ 面对 4 面反弹墙一枪未发（D 列会归零）');
}
/* ⚠️ v1.5.28 实测：审计 §4-2b 建议的"每张穿透卡在**自对局**里 ≥1 命中"**不能当阻断条件** ——
 * 坦克与电磁炮是**所有冠军（含历史最好的 eco-34）都没用过**的卡 ⇒ 照字面做会把所有人挡在门外
 * （与 E/F 的"阈值定在噪声带里"同型）。故降级为**提示**，真正阻断的是下面那条量在**反弹墙**上的门槛。 */
if (sp.pierceMissing && sp.pierceMissing.length) {
  const nm = sp.pierceMissing.map(function (k) { return (W.EpirusRules.byKey[k] || {}).name || k; });
  console.warn('   ⚠️ 提示（不阻断）：自对局里这些穿透卡零命中 ' + nm.join('/') +
    ' —— 若连**反弹墙**里也是 0 才会阻断；单张冷门卡（坦克/电磁炮）多数冠军都不用。');
}
/* v1.5.26（用户裁定）：E 改用**新口径**。旧口径（摆架势回合占比 > 85%）会**误伤合理防御** ——
 * 用户原话："并不是说不能出防御，特定情况下反而是要出的（比如看到对手攒到 5 ji 防一下大雷），但总不能每回合都这样。"
 * 实测（10 局被动场）：旧口径 eco-34 89% ✗ / v7press-36 95% ✗；而新口径它们分别是 16% / 46% ✓✓
 * —— 也就是说旧口径把"有威胁时才防"和"无威胁也一直防"混为一谈了。
 * 门槛 60%：实测病态样本 v7anneal-34 = 100%（挡），健康样本 1%~46%（放行）。 */
if (fPass.noThreatStanceRate > 0.6) fails.push('E 无威胁时摆架势 ' + (fPass.noThreatStanceRate * 100).toFixed(0) +
  '% > 60%（对手ジ还没到 5、没有大雷威胁时，它也一直摆架势）');
/* v1.5.27（用户裁定）：F 门槛 35% → **25%**。
 * 数据：实测所有冠军的 F 都在 22%~35%（v7f-35 34%、v7anneal-34 35%、v7press-36 32%、eco-34 22%）
 * ⇒ 35% 属于"阈值定在噪声带里"，连**现役冠军自己都过不了**（当年是 --force 推上去的）。
 * 25% 仍然挡住"正常对局里也不进攻"的形状（eco-34 22% 会被挡），但放过均衡型。 */
/* v1.5.62（用户裁定）：**F 改用场 A**（4 席脚本猛攻 vs 1 席冠军的"还手率"）。
 * 旧口径（`fieldRate('active')`）量的是"1 席进攻者 + 4 席冠军自己"的自对局均衡，所有人 22~35%、
 * 门槛 35%→25% 之后仍靠 `--force` 越过 ⇒ 考核依据本身有问题（见 CHANGELOG v1.5.61 的代码证据）。
 * 新口径的判别力：线上包 13% ✗ / 种子 27% ✓ / eco-34 25% ✓ ⇒ 阈值 20% 首次能把已知好与已知坏分开。 */
const agg = aggressionProfile(W, params, Number(process.env.EPIRUS_AGGR_GAMES || 40));
console.log('  场A 被集火还手率 = ' + (agg.fieldA.atk * 100).toFixed(0) + '%（造成伤害 ' + agg.fieldA.dealtPerGame.toFixed(2) +
  '/局，承受 ' + agg.fieldA.takenPerGame.toFixed(2) + '/局，胜率 ' + (agg.fieldA.winRate * 100).toFixed(0) + '%）' +
  '  场B 无压进攻 = ' + (agg.fieldB.atk * 100).toFixed(0) + '%（伤害 ' + agg.fieldB.dealtPerGame.toFixed(2) + '/局）' +
  '  [旧口径 F=' + (fAct.atk * 100).toFixed(0) + '%，仅作历史对照]');
if (agg.fieldA.atk < 0.20) fails.push('F 被集火还手率 ' + (agg.fieldA.atk * 100).toFixed(0) + '% < 20%（被 4 席猛攻时不还手）');
/* v1.5.57（第五轮复核 §6）：**座位对称性**必须进上线体检。
 * 实测：上线包（v7wall-31）5 席同策略时 long 0 号座 84%、multi 58%（极差 82pt/51pt）——
 * 玩家真正遇到的对手严重偏座；而此前所有体检项都看不见这件事。
 * 判据按复核建议：**前置"分出胜负 ≥30%"**（平局过多时"各座≈0%"是空读数）+ **极差 ≥30pt ⇒ 拒**。
 * 口径一律百分点（曾把"胜场数差"当百分点报出去 ⇒ 结论反了，见 CHANGELOG v1.5.57）。 */
const ss = seatSymmetry(W, params, 'multi', Number(process.env.EPIRUS_SEAT_GAMES || 100));
if (ss.verdict === 'biased') {
  fails.push('座位对称性：5 席同策略下某座胜率极差 ' + ss.spread.toFixed(0) + 'pt（≥30pt）⇒ 偏座（' +
    ss.pct.map(function (x) { return x.toFixed(0) + '%'; }).join('/') + '，判胜 ' + ss.decisive + ' 局）');
} else if (ss.verdict === 'unjudgeable') {
  console.warn('  ⚠ 座位对称性不可判：分出胜负仅 ' + (ss.decisiveRate * 100).toFixed(0) + '%（平局过多）—— 不计入阻断，但别把它当"均衡"');
} else {
  console.log('  座位对称性 OK：极差 ' + ss.spread.toFixed(0) + 'pt（' + ss.pct.map(function (x) { return x.toFixed(0) + '%'; }).join('/') + '）');
}
if (sp.effSkills < 3) fails.push('G 有效技能数 ' + sp.effSkills.toFixed(2) + ' < 3（打法坍缩到两三张卡）');
/* ===== v1.5.71（第五轮复核 §4-6）：**出厂换包也写一份 feasibility 记录** =====
 * 病：线上包的 meta 里没有 `feasibility` —— 它是经 tools/upgrade-pack.mjs 换回来的、绕过了训练落盘
 * 那一步 ⇒ "这个包当年怎么过的五道门"在产物上不可查。
 * 阈值与 server/train-server.mjs **共用 audit-lib 的 `feasibilityOf`**（单一真源，复核 §4-6）。
 * ⚠️ 这里**只记录、不新增阻断**：把五道门升级为硬门槛是独立决策（eco-34 的场B 清场=0.00 也会被它挡，
 * 那会连带否决"换回历史冠军"这条路径）⇒ 见 CHANGELOG v1.5.71 的说明。 */
/* v1.5.90（第八轮复核 §8-3）：第 6 道判据的两个输入必须在 `feasibilityOf` **之前**算出来（它要进 meta/notes）。
 * 两个量：① 珠经济**双向**（得珠 / 花珠率）② **输出密度**（每回合出手伤害 / 按ジ占比）。 */
const dens = densityProfile(W, params, 'long', Number(process.env.EPIRUS_DENSITY_GAMES || 20));
const chgE = chargeProfile(W, params, 'long', Number(process.env.EPIRUS_CHARGE_GAMES || 40));
const feas = feasibilityOf({ seat: ss, G: sp, wall: rw, aggr: agg,
  density: { dmgPerRound: dens.dmgPerRound, jiShare: dens.jiShare, gained: chgE.gained, spentRate: chgE.spentRate } });
console.log('   可行性（与训练落盘同源）：' + (feas.ok ? '✅ 五道全过' : '✗ ' + feas.fails.join('；')) +
  '（座位 ' + feas.seatSpread + 'pt/' + feas.seatVerdict + ' · G ' + feas.G + ' · 墙 ' + feas.wallDmg +
  '/局 · 场A ' + (100 * feas.fieldA).toFixed(0) + '% · 场B 清场 ' + feas.fieldBClears + '/局' +
  '（胜率 ' + (100 * (feas.fieldBWinRate || 0)).toFixed(0) + '% —— **规则红利，不作判据**））' +
  (feas.notes.length ? ' ⚠ ' + feas.notes.join('；') : ''));
/* v1.5.90（第八轮复核 §6 / §8-3）：**输出密度** —— 把"冠军输给一行最便宜的枪"变成两个可比的数：
 * 它到底把多少回合花在"按ジ攒一种永远花不掉的东西"上。判据**只打印**（阻断开关见 audit-lib 的
 * `DENSITY_BLOCK`，现在是 false —— 在位包自己没过它 ⇒ 它现在没有判别力）。 */
console.log('   输出密度（' + dens.games + ' 局自对局）：每回合出手伤害 ' + dens.dmgPerRound.toFixed(3) +
  ' · 按ジ占比 ' + (100 * dens.jiShare).toFixed(1) + '% · 伤害卡出手占比 ' + (100 * dens.atkShare).toFixed(1) +
  '% · 出手 ' + dens.actsPerGame.toFixed(1) + '/局 · 回合 ' + dens.roundsPerGame.toFixed(1) + ' ⇒ ' +
  (feas.density && feas.density.beadLoopClosed === true
    ? '**珠经济闭环** ✓（"经济动作有出口"的第一个形态）'
    : '珠经济未闭环（按ジ攒了花不掉的东西 = 命门）'));
/* ===== v1.5.91（用户裁定）：**技能广度 S 的权威口径** —— `目标 = H + T·S` =====
 *   H = 与胜率相关的强度项（fit 主项 = 自对局回报均值；外部标尺 = A 考卷 1st%）
 *   S = 技能广度（熵，**对卡对称**：不按伤害/费用加权 —— 那会给某张卡专属梯度，见 audit-lib 里那段长注释）
 *   T = 交换率（`EPIRUS_DIV_W`）
 * 这里**只测量、只打印**，不参与 fit、不参与阻断。⚠ 必须与 N 一起报（G/S 对样本量很敏感）。 */
const brd = breadthProfile(W, params, 'long', Number(process.env.EPIRUS_BREADTH_GAMES || 20));
console.log('   技能广度 S（n=' + brd.N + ' 个非ジ出手 · ' + brd.games + ' 局自对局）：S=' + brd.S.toFixed(3) +
  ' = 类间 ' + brd.S_cat.toFixed(3) + ' + 类内 ' + brd.S_within.toFixed(3) +
  ' · S_norm=' + brd.S_norm.toFixed(3) + '（分母 ln ' + brd.K_menu + ' 固定）' +
  ' · G_eff=' + brd.G_eff.toFixed(2) + '（= 历史"有效技能数"，同值）' +
  ' · 覆盖 ' + brd.catsUsed + '/' + brd.K_cat + ' 类 · 最大单卡占比 ' + (100 * brd.maxCardShare).toFixed(1) + '%');
console.log('     各类占比：' + Object.keys(brd.catShares).map(function (c) {
  return c + ' ' + (100 * brd.catShares[c]).toFixed(1) + '%';
}).join(' · ') + '   ⇒ 目标形状 目标 = H + T·S（H=强度/T=EPIRUS_DIV_W）；本行**只记录**');
/* v1.5.93：**功能角色**那一层（8 角色）与 4 个 `cat` 并存 —— 一眼看出"更细的分区是否真的不同"。 */
console.log('     功能角色（' + brd.K_role + ' 个）：类间 ' + brd.S_role.toFixed(3) + ' · 角色内 ' + brd.S_roleWithin.toFixed(3) +
  ' · 覆盖 ' + brd.rolesUsed + '/' + brd.K_role + ' · G_role=' + brd.G_role.toFixed(2) +
  '（4 类老口径对照：类间 ' + brd.S_cat.toFixed(3) + ' · 覆盖 ' + brd.catsUsed + '/' + brd.K_cat + ' 类）');
console.log('     角色占比：' + Object.keys(brd.roleShares).map(function (r2) {
  return r2 + ' ' + (100 * brd.roleShares[r2]).toFixed(1) + '%';
}).join(' · '));
/* ===== v1.5.71（第五轮复核 §4-2）：**狙击场探针** —— 只记录，**暂不阻断** =====
 * 标定（40~60 局/包）把复核建议的判据否掉了：复核建议"靶向率 ≥20%"，但**它没有判别力** ——
 * 种子冠军 45.3% / eco-34 47.7% / 线上包 43.8%，全都远高于均匀 25% ⇒ 谁也分不开。
 * 真正分开的是**低压力场里的出手与目标多样性**：种子 2.73 伤害/局、打过 2~4 个人；
 * eco-34/线上 0.47~0.53/局、37~40 局里只打过 **1 个**人（"只盯一个靶子"= 身份映射家族的另一面）。 */
const snf = sniperField(W, params, 'long', Number(process.env.EPIRUS_SNIPER_GAMES || 20), 'mixed');
console.log('   狙击场（1 席狙击 + 3 席被动 · ' + snf.games + ' 局）：自身伤害 ' + snf.dmgPerGame.toFixed(2) +
  '/局（出手 ' + snf.attacksPerGame.toFixed(2) + '/局）· 平均打过 ' + snf.spreadAvg.toFixed(2) + ' 个人' +
  ' · 靶向率 ' + (100 * (snf.aimedAtSniperRate || 0)).toFixed(1) + '%（均匀 25%，**已知无判别力**）' +
  ' · 存活 ' + (100 * snf.survivalRate).toFixed(0) + '% · 胜率 ' + (100 * snf.winRate).toFixed(0) + '%');
/* ===== v1.5.78（第七轮复核 §11）：珠经济判据改成**双向** =====
 * 复核指出我的"浪费率 0%"是**把行为删掉**刷出来的：新包连"蓄能"这一步都不做了（0.00~0.06/局），
 * 而整条珠经济（蓄能 → 电磁炮/天火）在四代包里一次都没闭环过 ⇒ 只看 `wasteRate` 它永远绿。
 * ⇒ 同时报"花珠率"（花掉/得珠）：**只有"得珠 > 0 且花珠率 > 0"才算闭环**，与复核 §11 的建议一致。 */
const chg = chgE;   // v1.5.90：这次调用已提到 `feasibilityOf` 之前（第 6 道判据要用它的 gained/spentRate）⇒ 此处复用，别重复跑
console.log('   珠经济（' + chg.games + ' 局）：蓄能 ' + chg.chargesPerGame.toFixed(2) + '/局 · 得珠 ' + chg.gained +
  ' · 过期 ' + chg.expired + ' · **花掉 ' + chg.spent + '** · 浪费率 ' + (100 * chg.wasteRate).toFixed(0) +
  '% · **花珠率 ' + (100 * chg.spentRate).toFixed(0) + '%**' +
  (chg.gained > 0 && chg.spent > 0 ? '（闭环 ✓）' : '（**未闭环**：这是"没长出能力"，不是"指标好看"）'));
/* ===== v1.5.78（第七轮复核 §15-1）：把 **G4 克制表 / G5 破防反射** 接进阻断面 =====
 * 复核把这两条写成可跑代码（`tools/gate-drafts.mjs`）并**先证明了量具的判别力**：
 *   线上包 G4 两模式 PASS（最克 22%/18%）、G5 PASS（防席 0%）；
 *   `v7f3-91` FAIL（G4 78~82% / G5 65~75%）、`v7f3-94` FAIL（G4 67~68%）。
 * ⇒ 满足"能分开已知好与已知坏"⇒ **采纳为阻断**（可用 `--force` 越过并留痕）。
 * ⚠️ 同一脚本里的 G3（座位 ≤15pt）与 G6（靶向率 ≥40%）**不采纳为阻断**：
 *   · G3 的阈值**连线上包自己都过不了** ⇒ 不满足判别力检验（座位改用 audit-lib 的 seatSymmetry）；
 *   · G6 四代包（含线上）全部 3.5~22.5% ⇒ 是"能力未长出"不是某包退化，做成阻断会把所有候选一起挡死；
 *     路线是把它当能力练（窄奖励/教师示范），见复核 §15-3。 */
let gateDrafts = null;
if (!process.argv.includes('--skip-gate-drafts')) {
  try {
    const gr = spawnSync(process.execPath, ['tools/gate-drafts.mjs', SRC], { cwd: ROOT, encoding: 'utf8', timeout: 900000, maxBuffer: 1 << 24 });
    const outTxt = String(gr.stdout || '') + String(gr.stderr || '');
    gateDrafts = { exit: (gr.status == null ? 'null' : gr.status), blocking: [], recorded: [], unrun: [], g6: {} };
    for (const ln of outTxt.split('\n')) {
      /* v1.5.89③：`UNRUN` = 该格**跑不了 / 不可判**（量具自己报的第三态，见 gate-drafts 的 gate()）。
       * 它既不是 FAIL、更不是 PASS ⇒ 单独收集并**醒目打印**（"不得当作通过"）。 */
      const mu = /^\s*UNRUN\s+(G[3-6][^\n]*)$/.exec(ln);
      if (mu) { gateDrafts.unrun.push(mu[1].trim()); continue; }
      const m = /^\s*(PASS|FAIL)\s+(G[3-6][^\n]*)$/.exec(ln);
      if (!m) continue;
      const nm = m[2].trim();
      /* v1.5.89①：**参照行只记录、不阻断**。gate-drafts 的输出同时含"线上包 / 元测试"这些**别的对象**的行；
       * 补入"只枪(1ジ压制·打最肥)"这一格之后，线上包自己在 G4[long] 就是红的（长程被最便宜的一张卡打穿）。
       * 若把参照行也当阻断：① 任何候选都被连坐（换包实际只能靠 --force）；② 会把"候选不行"这个
       * **错误结论**传给人 —— 与 v1.5.78 想治的"把没过的当成过了"是同一类错误的反向版本。 */
      const isRef = /^G[3-6]\[(线上包|元测试)/.test(nm);
      if (m[1] === 'FAIL' && !isRef && (/^G4\[/.test(nm) || /^G5\[/.test(nm))) {
        gateDrafts.blocking.push(nm);
        fails.push('行为门未过：' + nm);
      } else if (isRef && m[1] === 'FAIL') {
        gateDrafts.recorded.push('参照(不阻断) FAIL ' + nm);
      } else if (/^G6\[/.test(nm)) {
        gateDrafts.recorded.push(m[1] + ' ' + nm);
      } else if (m[1] === 'FAIL') {
        gateDrafts.recorded.push('FAIL ' + nm);
      }
    }
    const mg6 = /G6\[([^\]]+)\] 靶向率[^\n]*实测 ([\d.]+)%/g; let t6;
    while ((t6 = mg6.exec(outTxt))) gateDrafts.g6[t6[1]] = Number(t6[2]);
    console.log('   G4/G5 行为门（第七轮复核 §15-1，**只判候选自己**）：' +
      (gateDrafts.blocking.length ? '✗ ' + gateDrafts.blocking.join('；') : '✅ 候选自己全过'));
    const refFails = gateDrafts.recorded.filter(function (x) { return x.indexOf('参照(不阻断) FAIL') === 0; });
    if (refFails.length) {
      console.log('   ⚠ 参照行（**不阻断**）：' + refFails.length + ' 条 —— **在位包自己没过** ⇒ 这是"该换包"的信号，\n      ' +
        '不是"候选不行"。为了它去 --force 越过候选门是搞错了主语。\n      ' + refFails.join('\n      '));
    }
    if (gateDrafts.unrun.length) {
      console.log('   ⛔ **不得当作通过**：' + gateDrafts.unrun.length + ' 格 UNRUN（量具跑不了 / 不可判）：\n      ' +
        gateDrafts.unrun.join('\n      '));
    }
    console.log('   G6 靶向率（只记录不阻断）：' + JSON.stringify(gateDrafts.g6));
  } catch (e) {
    console.log('   ⚠ G4/G5 行为门未能运行（不阻断，但**别当通过**）：' + String(e && e.message || e));
    gateDrafts = { error: String(e && e.message || e) };
  }
}
if (fails.length) {
  console.error('⛔ 体检未过（' + fails.length + ' 项阻断条件）：');
  for (const x of fails) console.error('   · ' + x);
  if (!FORCE) {
    console.error('   ⇒ 已中止，**未换包**。确实要换就加 `--force`（会在 meta 里留下这次越过的条件）。');
    process.exit(6);
  }
  console.warn('   ⇒ --force：强制继续，并把这次越过的条件记进 meta。');
}

/* 2) 写 bundle：保留权重原样，只补 meta */
const fp = rulesFingerprint();
/* ===== v1.5.32：**不可用 --force 越过的硬门槛** =====
 * 教训（用户实测）：v7wall-33 每局 18.7 次全息屏障、**100% 套在别人身上**（把原型制御白送对手），
 * 而它正是靠 --force 越过"全息屏障 > 2/局"那条上线的。行为缺陷不该被 --force 放行 ⇒ 单列硬门槛。 */
const hardFails = [];
const hOther = Number(sp.holoOtherPerGame || 0);
console.log('   全息屏障（自对局）：' + sp.holoPerGame.toFixed(1) + ' 次/局，其中**套给别人** ' + hOther.toFixed(1) + ' 次/局');
/* 阈值标定（实测）：**病态 18.7/局**（v7wall-33，100% 送人、用户手感异常）vs **偶发 2.0/局**（v7wall-31）
 * ⇒ 硬门槛取 **>6**，只挡"把套盾当主业"的产物；>2 仍留在普通条件里（可 --force）。
 * 教训同源：阈值不能定在噪声带里（E/F/holo 三次同型）。 */
if (hOther > 6) hardFails.push('全息屏障套给别人 ' + hOther.toFixed(1) + ' 次/局 > 6（把原型制御白送对手当主业）');
if (sp.pierceLand !== undefined && sp.pierceLand === 0) hardFails.push('自对局穿透卡零命中');
if (hardFails.length) {
  console.log('⛔ 硬门槛未过（**--force 也不放行**）：');
  for (const h of hardFails) console.log('   · ' + h);
  process.exit(6);
}
meta.shippedAs = NOTE || ('multi(3-5P) 默认冠军（由 tools/promote-champion.mjs 提升，源 ' + SRC + '）');
meta.examScoreAtBuild = first ? Number(first) / 100 : null;
meta.examMode = 'multi'; meta.examGames = EXG; meta.examSeed = 77000; meta.examAt = new Date().toISOString().slice(0, 10);
meta.examSource = examSource;                 // 'spawn' = 本工具内部复跑；'cli' = 由 --exam-first 传入
meta.rulesFingerprint = fp;
meta.selfPlayDmgPerGame = Number(dpg.toFixed(2));
meta.selfPlayDrawRate = Number(drawRate.toFixed(3));
/* v1.5.18：把新增/新启用的门槛项也记进 meta（否则"这个包当年是怎么过门的"又变成不可查）。 */
meta.selfPlayEffSkills = Number(sp.effSkills.toFixed(2));
meta.selfPlayDistinctKeys = sp.distinctKeys;
meta.passiveStanceRate = Number(fPass.stance.toFixed(3));
meta.passiveNoThreatStanceRate = Number(fPass.noThreatStanceRate.toFixed(3));
meta.passiveNoThreatRounds = fPass.noThreatRounds;
meta.passiveMaxNoThreatRun = fPass.maxNoThreatRun;
meta.pierceLandByKey = sp.landByKey;
meta.pierceMissingCards = sp.pierceMissing;
meta.reflectWallPierceLand = rw.pierceLand;
meta.reflectWallDmgPerGame = Number(rw.dmgPerGame.toFixed(2));
/* v1.5.71（复核 §4-6）：出厂包也留一份五道可行性记录（与训练落盘同源） */
meta.feasibility = feas;
/* v1.5.71（复核 §4-2）：狙击场探针读数也进 meta（独立行为探针，暂不阻断） */
meta.sniperField = {
  kind: snf.kind, games: snf.games, dmgPerGame: Number(snf.dmgPerGame.toFixed(2)),
  attacksPerGame: Number(snf.attacksPerGame.toFixed(2)), spreadAvg: Number(snf.spreadAvg.toFixed(2)),
  aimedAtSniperRate: (snf.aimedAtSniperRate == null ? null : Number(snf.aimedAtSniperRate.toFixed(3))),
  survivalRate: Number(snf.survivalRate.toFixed(3)), winRate: Number(snf.winRate.toFixed(3))
};
/* v1.5.78（第七轮复核 §15-1）：G4/G5 阻断结论 + G6 记录值进 meta（"能力未长出"要能长期追踪） */
meta.gateDrafts = gateDrafts;
meta.activeAttackRate = Number(fAct.atk.toFixed(3));
meta.auditFails = fails;
meta.auditForced = fails.length ? FORCE : false;
const out = src.replace(metaM[0], metaM[1] + JSON.stringify(meta) + ';');
/* 回读自检：冠军槽必须仍是**能解出参数的包**（第一版写坏槽位时就是这里没查，靠 np-test 才发现） */
const reChamp = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(out);
const reJson = reChamp ? JSON.parse(reChamp[1]) : null;
const reParams = reJson ? W.EpirusPolicy.unpack(reJson, true) : null;
if (!reParams || !reParams.length) { console.error('⛔ 自检失败：写出的 bundle 冠军槽解不出参数（已中止，未落盘）'); process.exit(5); }
/* v1.5.63：`checkPack` 只校验 v7 容器（`o.v !== PACK_VERSION` 直接判 not-ok）；
 * 旧形状包（v5/v6）走"原生读取 + 长度自检"这条路，否则换回历史冠军会被自检挡死。 */
const chk = (reJson && reJson.v === 7 && W.EpirusPolicy.checkPack) ? W.EpirusPolicy.checkPack(reJson) : { ok: true };
if (reJson && reJson.v !== 7) console.log('   旧形状包（v' + reJson.v + '）：跳过 checkPack（只校验 v7 容器）⇒ 已用原生读取 + 长度自检');
if (chk && chk.ok === false) { console.error('⛔ 自检失败：checkPack ' + JSON.stringify(chk) + '（已中止，未落盘）'); process.exit(5); }
if (DRY) {
  console.log('\n🧪 --dry：自检通过但**未写任何文件**（js/bundled-champion-3p.js 与 index.html 均未改动）');
} else {
  writeFileSync(BUNDLE, out);
  console.log('   回读自检：冠军包 ok（参数量 ' + reParams.length + '）');

  /* 3) 刷 index.html 的缓存戳（否则浏览器继续用旧包） */
  let html = readFileSync(INDEX, 'utf8');
  const before = (html.match(/\?v=[0-9a-z]+/gi) || [])[0];
  html = html.replace(/(\?v=)[0-9a-z]+/gi, '$1' + Date.now().toString(36));
  writeFileSync(INDEX, html);
  console.log('\n✅ 已提升：' + SRC + ' → js/bundled-champion-3p.js');
  console.log('   rulesFingerprint = ' + fp + '（bundle 里记的 = ' + fingerprintOfBundle(out) + '）');
  console.log('   examScoreAtBuild = ' + meta.examScoreAtBuild + '（' + EXG + ' 局）  缓存戳 ' + before + ' → ' + (html.match(/\?v=[0-9a-z]+/gi) || [])[0]);
  console.log('   ⚠️ 别忘了：node tools/np-test.mjs（D16 指纹 + D14）+ node tools/battle-test.mjs（真浏览器对战）');
  console.log('   ⚠️ 且注意：localStorage 里已有冠军的用户**不会**被这次换包影响（REVIEW §11.1）。');
}

/* 4) 自动跑一遍 skill report（用户 2026-09-13：「以后每次冠军有大变化的时候都可以做一下」）
 * 它回答的是"每个技能的实际强度 vs 使用率"（高使用+负强度=坑 / 零使用+正强度=没学会的强招），
 * 与 champ-audit 的"打架活跃度"互补 —— 换冠军时正是最该看它的时候。用 --no-skill-report 可跳过。 */
if (!DRY && !process.argv.includes('--no-skill-report')) {
  const nP = Number(meta.n || 5);
  const outHtml = 'docs/skill-report.html';
  console.log('\n== 自动跑技能报告（' + nP + ' 人，每条件 6 局）→ ' + outHtml + ' ==');
  const sk = spawnSync(process.execPath, ['tools/skill-report.mjs', String(nP), '6', outHtml], { cwd: ROOT, encoding: 'utf8' });
  const lines = ((sk.stdout || '') + (sk.stderr || '')).trim().split(/\r?\n/);
  lines.slice(-8).forEach(function (l) { console.log('   ' + l); });
  console.log('   （完整报告：' + outHtml + '，可直接双击打开）');
}
