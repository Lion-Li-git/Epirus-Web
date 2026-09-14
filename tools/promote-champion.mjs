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
import { sandbox, selfPlay, fieldRate, reflectWall } from './audit-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2).filter((a) => !/^--/.test(a));
const flag = (n, d) => { const h = process.argv.find((a) => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const SRC = ARGV[0];
if (!SRC) { console.error('用法: node tools/promote-champion.mjs <bak文件> [--exam-games=40] [--note="..."]'); process.exit(2); }
const EXG = Number(flag('exam-games', 40));
const NOTE = flag('note', '');
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
const params = W.EpirusPolicy.unpack(JSON.parse(packJson));
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
if (sp.holoPerGame > 2) fails.push('全息屏障 ' + sp.holoPerGame.toFixed(1) + ' 次/局 > 2（v1.5.4 之前的产物会把盾套给对手）');
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
if (fAct.atk < 0.25) fails.push('F 活跃场进攻率 ' + (fAct.atk * 100).toFixed(0) + '% < 25%（正常对局里也不进攻）');
if (sp.effSkills < 3) fails.push('G 有效技能数 ' + sp.effSkills.toFixed(2) + ' < 3（打法坍缩到两三张卡）');
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
meta.activeAttackRate = Number(fAct.atk.toFixed(3));
meta.auditFails = fails;
meta.auditForced = fails.length ? FORCE : false;
const out = src.replace(metaM[0], metaM[1] + JSON.stringify(meta) + ';');
/* 回读自检：冠军槽必须仍是**能解出参数的包**（第一版写坏槽位时就是这里没查，靠 np-test 才发现） */
const reChamp = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(out);
const reParams = reChamp ? W.EpirusPolicy.unpack(JSON.parse(reChamp[1])) : null;
if (!reParams || !reParams.length) { console.error('⛔ 自检失败：写出的 bundle 冠军槽解不出参数（已中止，未落盘）'); process.exit(5); }
const chk = W.EpirusPolicy.checkPack ? W.EpirusPolicy.checkPack(JSON.parse(reChamp[1])) : { ok: true };
if (chk && chk.ok === false) { console.error('⛔ 自检失败：checkPack ' + JSON.stringify(chk) + '（已中止，未落盘）'); process.exit(5); }
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

/* 4) 自动跑一遍 skill report（用户 2026-09-13：「以后每次冠军有大变化的时候都可以做一下」）
 * 它回答的是"每个技能的实际强度 vs 使用率"（高使用+负强度=坑 / 零使用+正强度=没学会的强招），
 * 与 champ-audit 的"打架活跃度"互补 —— 换冠军时正是最该看它的时候。用 --no-skill-report 可跳过。 */
if (!process.argv.includes('--no-skill-report')) {
  const nP = Number(meta.n || 5);
  const outHtml = 'docs/skill-report.html';
  console.log('\n== 自动跑技能报告（' + nP + ' 人，每条件 6 局）→ ' + outHtml + ' ==');
  const sk = spawnSync(process.execPath, ['tools/skill-report.mjs', String(nP), '6', outHtml], { cwd: ROOT, encoding: 'utf8' });
  const lines = ((sk.stdout || '') + (sk.stderr || '')).trim().split(/\r?\n/);
  lines.slice(-8).forEach(function (l) { console.log('   ' + l); });
  console.log('   （完整报告：' + outHtml + '，可直接双击打开）');
}
