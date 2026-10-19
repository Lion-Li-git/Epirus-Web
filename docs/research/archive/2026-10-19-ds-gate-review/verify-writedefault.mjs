/* §E653 D159：点名器 `[WRITE-DEFAULT]` 的三格自证（v1.7.115 改完之后必须三格各自能红/能绿）
 *
 * 为什么要这三格：v1.7.114 原版打在**模块加载**时、条件也没排发布态 ⇒ 名单会把"根本没写盘"的腿也点进来，
 *   还会把"覆盖出厂冠军"标成"写默认落点"。改完之后这三条判据要各自成立，否则尺等于没修。
 *
 * ⚑ 三格**全部在隔离 worktree 里跑**（`--wt=<目录>`），主工作树的 `docs/artifacts/train-3p-out.js`
 *   与 `js/bundled-champion-3p.js` 一个字节都不许碰：
 *   格 2 是发布态（`EPIRUS_PUBLISH=1` ⇒ 真会写 `js/bundled-champion-3p.js`），
 *   在主树里跑就等于手跑覆盖出厂冠军（这正是 §E653 要防的那类事）。
 *
 * 用法：node verify-writedefault.mjs --wt=<隔离 worktree 根>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { rejectUnknownFlags } = await import(new URL('../../../../tools/audit-lib.mjs', import.meta.url).href);
rejectUnknownFlags(process.argv.slice(2), ['wt', 'old-ref'], 'verify-writedefault');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const WT = arg('wt', '');
if (!WT || !existsSync(path.join(WT, 'tools', 'train-3p.mjs'))) {
  console.error('⛔ --wt= 必须指到一个含 `tools/train-3p.mjs` 的隔离工作树（现在：`' + (WT || '没给') + '`）'
    + '\n   ⇒ 不许在主工作树跑本自证：格 2 会写 `js/bundled-champion-3p.js`。');
  process.exit(2);
}
const MAIN_ROOT = path.resolve(HERE, '../../../..');
const shaOf = (f) => existsSync(f) ? createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 12) : '(不在)';
const guardBefore = {
  shipped: shaOf(path.join(MAIN_ROOT, 'js/bundled-champion-3p.js')),
  baseline: shaOf(path.join(MAIN_ROOT, 'docs/artifacts/train-3p-out.js'))
};
let fail = 0;
const ck = (nm, okk, got) => { console.log((okk ? '  PASS ' : '  ⛔ FAIL ') + nm + (got === undefined ? '' : '  ⇒ ' + got)); if (!okk) fail++; };

function run(arm, env, argv, expect, logVal) {
  const e = Object.assign({}, process.env, { EPIRUS_LOG_DEFAULT_OUT: logVal || '1', EPIRUS_ARM: arm, EPIRUS_BAND_DIR: path.join(WT, '.bands') }, env);
  delete e.EPIRUS_T3P_OUT;
  const r = spawnSync(process.execPath, argv, { cwd: WT, env: e, encoding: 'utf8', timeout: 900000 });
  const so = String(r.stdout || '') + String(r.stderr || '');
  /* ⚑ §E654：标记有两个身份（[WRITE-DEFAULT] 没声明的漏写 / [WRITE-BASELINE] 声明过的合法写），
   *   这台第一版只认前者 ⇒ 格 3/格 4 连着报"漏报"，而紧后面那格证明行确实在。检测器过时不是代码坏，别修错地方。 */
  const hit = /\[WRITE-(DEFAULT|BASELINE)\]/.test(so);
  console.log('\n〔' + arm + '〕exit=' + r.status + ' ‖ 打了 WRITE-DEFAULT = ' + (hit ? '是' : '否')
    + ' ‖ 真落盘行 = ' + (/已写入/.test(so) ? '有' : '无'));
  return { status: r.status, hit, wrote: /已写入/.test(so), out: so };
}

/* ===== 格 0（反向对照）：**v1.7.114 那份**在同样环境下必须上榜 ⇒ 证明"没跑成也点名"这个病是真的、而我这改法咬得住
 *   没有这一格，下面三格只说明"新版不打"，不说明"旧版会打"（= 一把没有坏样本的尺）。
 *   做法：把**钉住的那个 SHA** 那份另存成同目录的副本再跑 ⇒ 相对 import 照旧解析，不动被测文件。
 *   ⚑ 10-19 14:42 这一格自己红过一次，而且红得对：它原先取 `git show HEAD:…`，而 HEAD 在我把修复提交上去之后
 *     就已经是**新版**了 ⇒ 坏样本被自己的提交洗成好样本、尺变成恒真。⇒ **反向对照的参照必须是固定 SHA**（默认 `0b46840` = v1.7.114）。 */
const OLDREF = arg('old-ref', '0b46840');
const OLD = path.join(WT, 'tools', 'train-3p-old.mjs');
const oldSrc = spawnSync('git', ['show', OLDREF + ':tools/train-3p.mjs'], { cwd: WT, encoding: 'utf8' });
if (oldSrc.status !== 0 || !oldSrc.stdout) { console.error('⛔ 取不到 ' + OLDREF + ' 那份 train-3p.mjs ⇒ 反向对照跑不了'); process.exit(2); }
if (!/--help|OUT_PATH/.test(oldSrc.stdout)) { console.error('⛔ ' + OLDREF + ' 取回来的不像 train-3p 源码 ⇒ 参照错了'); process.exit(2); }
writeFileSync(OLD, oldSrc.stdout, 'utf8');
console.log('〔格 0 用的旧版参照 = ' + OLDREF + '（钉死，不用 HEAD）〕');
{
  const e = Object.assign({}, process.env, { EPIRUS_LOG_DEFAULT_OUT: '1', EPIRUS_ARM: 'vwd-old-control', EPIRUS_BAND_DIR: path.join(WT, '.bands'), EPIRUS_FIGHT_WHISTLE: '0.34' });
  delete e.EPIRUS_T3P_OUT;
  const r = spawnSync(process.execPath, [OLD, '1', '3', '2', '2'], { cwd: WT, env: e, encoding: 'utf8', timeout: 900000 });
  const so = String(r.stdout || '') + String(r.stderr || '');
  console.log('\n〔格 0 反向对照：v1.7.114 那份〕exit=' + r.status + ' ‖ 打了 WRITE-DEFAULT = ' + (/\[WRITE-DEFAULT\]/.test(so) ? '是' : '否')
    + ' ‖ 真落盘行 = ' + (/已写入/.test(so) ? '有' : '无'));
  ck('格 0 ⚑ 旧版在"没跑成"那次**也打了**（这就是假阳性的现场，不是我推测的）', /\[WRITE-DEFAULT\]/.test(so) && r.status !== 0 && !/已写入/.test(so),
    'exit=' + r.status + ' ‖ 打了=' + (/\[WRITE-DEFAULT\]/.test(so) ? '是' : '否'));
  ck('格 0 自证有坏样本 ⇒ 新版那格 PASS 才叫修好了（旧打 / 新不打）', /\[WRITE-DEFAULT\]/.test(so));
}

/* ===== 格 1：该失败的失败 —— 黑旋钮闸在落盘之前就 exit ⇒ 不许上榜 =====
 * `EPIRUS_FIGHT_WHISTLE` 不带 `EPIRUS_ALLOW_DARK` ⇒ train-env 那组的形状（退出码非 0，什么都没写）。 */
const g1 = run('vwd-darkknob', { EPIRUS_FIGHT_WHISTLE: '0.34' }, ['tools/train-3p.mjs', '1', '3', '2', '2']);
ck('格 1 那次调用确实**没跑成**（暗键必须拿到它自己的 exit 6，不是被 §E654 那条闸改成 10）', g1.status === 6, 'exit=' + g1.status
  + ' ⇒ 闸的位置对不对就看这一格：校验之后、训练之前');
ck('格 1 ⛔ 没跑成就不许点进来（原版会打，因为打在加载时）', !g1.hit, 'WRITE-DEFAULT=' + (g1.hit ? '打了=假阳性' : '没打=对'));
ck('格 1 自证这条红会红：若那次真写了默认落点却没打，才算漏报', !(g1.wrote && !g1.hit));

/* ===== 格 1b：`--help` 同样不许上榜 =====
 * ⚑ 这一格顺手推翻了我自己写代码时的一个假设：我以为 `--help` 退 0（那样"只看退出码"就能过滤掉它），
 *   **实测退 64**。⇒ "那次调用没写盘"这件事**不能靠退出码判**（64/6/9 都非 0 而含义各不相同，
 *   而 exit 0 的调用也可能被 §E589 守卫拦成没写）⇒ 只能像 v1.7.115 这样钉在"真落盘之后"那一步。 */
const g1b = run('vwd-help', {}, ['tools/train-3p.mjs', '--help']);
ck('格 1b `--help` 没写盘（真落盘行应为无）', !g1b.wrote, 'exit=' + g1b.status + '（实测非 0，退出码在这里不能当判据）');
ck('格 1b ⛔ `--help` 不许被点成"写默认落点"', !g1b.hit, 'WRITE-DEFAULT=' + (g1b.hit ? '打了=假阳性' : '没打=对'));

/* ===== 格 2：发布态 —— 写的是 `js/bundled-champion-3p.js`，不是默认落点 ⇒ 不许混进这份名单 ===== */
const g2 = run('vwd-publish', { EPIRUS_PUBLISH: '1' }, ['tools/train-3p.mjs', '1', '3', '2', '2']);
ck('格 2 发布态真跑成了（否则这格测不到落盘那一段）', g2.status === 0 && g2.wrote, 'exit=' + g2.status + ' ‖ 已写入行=' + (g2.wrote ? '有' : '无'));
ck('格 2 ⛔ 发布态不许被标成"写默认落点"', !g2.hit, 'WRITE-DEFAULT=' + (g2.hit ? '打了=归错名' : '没打=对'));
ck('格 2 落点行里印的是发布态那个文件（证明它确实写了别的落点）',
  (/bundled-champion-3p\.js/.test(g2.out) || g2.status !== 0) || !g2.wrote, g2.out.split('\n').filter(l => /已写入|WRITE-DEFAULT/.test(l)).slice(0, 2).join(' ‖ ') || '(无落盘行)');

/* ===== 格 3：真写默认落点（§E654 之后这一路必须**显式声明基线**）⇒ 必须上榜，且标成 BASELINE 而不是 DEFAULT ===== */
const g3 = run('vwd-baseline', { EPIRUS_T3P_BASELINE: '1' }, ['tools/train-3p.mjs', '1', '3', '2', '2']);
ck('格 3 真跑成并落了盘', g3.status === 0 && g3.wrote, 'exit=' + g3.status + ' ‖ 已写入行=' + (g3.wrote ? '有' : '无'));
ck('格 3 必须上榜', g3.hit, 'WRITE-*=' + (g3.hit ? '打了=对' : '没打=漏报'));
ck('格 3 声明了基线 ⇒ 标 [WRITE-BASELINE]、不许再标 [WRITE-DEFAULT]（两种身份在名单里要分得开）',
  /\[WRITE-BASELINE\] vwd-baseline ‖ argv=1 3 2 2 ‖ 落点=docs\/artifacts\/train-3p-out\.js/.test(g3.out)
  && !/\[WRITE-DEFAULT\]/.test(g3.out),
  (g3.out.split('\n').find(l => l.indexOf('[WRITE-') >= 0) || '(没这行)').slice(0, 150));

/* ===== 格 5：什么都不声明就要开跑 ⇒ 根上那条闸必须 exit 10（§E654 的主修，也是效率那半：不烧一整臂的算力） ===== */
const g5 = run('vwd-nodeclare', {}, ['tools/train-3p.mjs', '1', '3', '2', '2']);
ck('格 5 没声明落点 ⇒ exit 10（实测 ' + g5.status + '）', g5.status === 10, 'exit=' + g5.status);
ck('格 5 必须在**训练开始之前**就停（不许已经印出"人数=… 代=…"那条横幅）',
  !/人数=.*代=/.test(g5.out), '横幅=' + (/人数=/.test(g5.out) ? '已印 ⇒ 闸位置太靠后' : '未印=对'));
ck('格 5 拒跑时不许打 WRITE-* 那行（它根本没写盘）', !g5.hit, '打了=' + (g5.hit ? '是=说谎' : '否=对'));
ck('格 5 的报错里要点名三条出路（T3P_OUT / T3P_BASELINE / PUBLISH），否则下一班不知道该给哪一个',
  /EPIRUS_T3P_OUT/.test(g5.out) && /EPIRUS_T3P_BASELINE/.test(g5.out) && /EPIRUS_PUBLISH/.test(g5.out), '');

/* ===== 格 4：台账通道（§E654 新加的第二条路）——门里 stdout 被腿吞掉，所以名单必须能落到文件 =====
 *   判据：`EPIRUS_LOG_DEFAULT_OUT=<路径>` 时，真写默认落点那一次要往那个文件追加一行，
 *   且行里带 ISO 时刻 / arm / pid / 落点 / argv 五段（下一班要靠 arm 对回门腿）。
 *   ⚠ 这一格必须在格 3 之后跑（同一份配方 ⇒ 守卫走"原地覆写同一粒权重 ✓"，一定真写）。 */
const LEDGER = path.join(WT, '.wdledger.tsv');
try { rmSync(LEDGER, { force: true }); } catch (e) { }
const g4 = run('vwd-ledger', { EPIRUS_T3P_BASELINE: '1' }, ['tools/train-3p.mjs', '1', '3', '2', '2'], null, LEDGER.replace(/\\/g, '/'));
const led = existsSync(LEDGER) ? readFileSync(LEDGER, 'utf8').trim().split('\n').filter(Boolean) : [];
ck('格 4 台账文件被写出且只有一行', led.length === 1, '行数=' + led.length);
ck('格 4 那行六段齐（时刻/arm/pid/落点/argv/**身份**）',
  led.length === 1 && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?\tvwd-ledger\t\d+\tdocs\/artifacts\/train-3p-out\.js\t1 3 2 2\tBASELINE（声明过）$/.test(led[0]),
  (led[0] || '(空)').slice(0, 110));
ck('格 4 台账只在真写时加行（没写就不许加 ⇒ 与 stdout 那条同一条判据）', g4.hit && g4.wrote, 'hit=' + g4.hit + ' ‖ wrote=' + g4.wrote);

/* ===== 收尾：主工作树一个字节都没动（这才是"敢在 main 上跑自证"的前提） ===== */
const guardAfter = {
  shipped: shaOf(path.join(MAIN_ROOT, 'js/bundled-champion-3p.js')),
  baseline: shaOf(path.join(MAIN_ROOT, 'docs/artifacts/train-3p-out.js'))
};
console.log('\n〔主工作树未被触碰自证〕');
ck('主树 `js/bundled-champion-3p.js` sha 逐字不变', guardBefore.shipped === guardAfter.shipped, guardBefore.shipped + ' → ' + guardAfter.shipped);
ck('主树 `docs/artifacts/train-3p-out.js` sha 逐字不变', guardBefore.baseline === guardAfter.baseline, guardBefore.baseline + ' → ' + guardAfter.baseline);
console.log('\n⚑ 主语：这三格判的是"点名器自己在不在说谎"，不是"门腿有没有改道"——后者要跑 `EPIRUS_LOG_DEFAULT_OUT=1 node tools/gate-par.mjs --part=…` 才出名单。');
process.exit(fail ? 1 : 0);
