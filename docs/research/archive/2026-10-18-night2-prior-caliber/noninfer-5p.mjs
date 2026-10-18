/* §E650 三.2/三.3 · 预注册的那两格：**强度非劣**用 `eval-5p` 考卷（不是臂内 5 人实测）、**广度不塌**用最大单卡落地份额
 * 为什么单独一台：PREREG §三.2 把尺钉成 `eval-5p 200 局 × 3 seed 同 seed 配对`，而臂日志里那个 `1st` 是**另一把尺**
 *   （名人堂 36 对 × 20 局 × 4 粒 seedBase）。拿后者去结前者的线 = 换尺不认账，本仓栽过（§E646 那条"同一把尺"的规矩）。
 * 判线**逐字照 PREREG §三.2/§三.3**，看完数据不改线。
 * 用法：node docs/research/archive/2026-10-18-night2-prior-caliber/noninfer-5p.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const { sandbox, loadChamp, pairedStats, rejectUnknownFlags, landShareOf } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
rejectUnknownFlags(process.argv.slice(2), ['pfx'], 'noninfer-5p');
const PFX = String(arg('pfx', 'gv'));   /* 第二个起点用 `--pfx=tw`（产物名 = `<前缀>{0,1}-<seed>.winner.js`） */
const SEEDS = [77000, 77001, 77002];
const prodOf = a => path.join(HERE, 'arms', a + '.winner.js');
for (const s of SEEDS) for (const v of [0, 1]) {
  const p = prodOf(PFX + v + '-' + s);
  if (!existsSync(p)) { console.error('⛔ 产物不在盘上：' + p + ' ⇒ 读不出，别用别的格顶'); process.exit(2); }
}
/* 名单签名由 `arms/MANIFEST.tsv.txt` 记着（每格的权威源与权重本体 sha8）；这台只量两把尺，不重述它 */

const one = (seed, arm) => {
  const out = execFileSync(process.execPath, ['tools/eval-5p.mjs', '200', '5', String(seed),
    path.relative(ROOT, prodOf(arm)).replace(/\\/g, '/'), '--mode=multi'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
  const m = /^\[冠军\] 1st=([\d.]+)%/m.exec(out);
  if (!m) { console.error('⛔ ' + arm + ' seed=' + seed + ' 的输出解析不到 `^[冠军] 1st=` ⇒ 判 PARSE_FAIL（不许当 0）\n' + out.slice(-400)); process.exit(3); }
  return Number(m[1]);
};

console.log('# §E650 三.2 强度非劣（尺 = `eval-5p` 考卷 200 局 × 5 席 multi，同 seed 配对 ‖ 差 = 开档产物 − 关档产物）');
const diffs = [];
for (const s of SEEDS) {
  const off = one(s, PFX + '0-' + s), on = one(s, PFX + '1-' + s);
  const d = on - off; diffs.push(d);
  console.log('  seed ' + s + '  关档 1st=' + off.toFixed(1) + '%  开档 1st=' + on.toFixed(1) + '%  Δ=' + (d >= 0 ? '+' : '') + d.toFixed(2) + 'pt');
}
const ps = pairedStats(diffs);
const neg = diffs.filter(x => x < 0).length;
const line2 = neg >= 2 && ps.mean <= -3;
console.log('  配对均值 ' + ps.mean.toFixed(2) + ' ± ' + ps.se.toFixed(2) + 'pt（t=' + (ps.t === null ? '—' : ps.t.toFixed(2)) + '，n=' + ps.n +
  '，同号 ' + ps.pos + '+' + ps.neg + '−）');
console.log('  §三.2 的线（≥2 格同号为负 且 均值 ≤ −3pt）⇒ 同号为负 ' + neg + '/3 ‖ 均值 ≤−3pt ? ' + (ps.mean <= -3 ? '是' : '否') +
  ' ⇒ **判词：' + (line2 ? 'veto 有强度代价' : '代价读不出或可忽略') + '**');
console.log('  ⚑ 分母是**同一枚起点里的 3 粒 seed** ⇒ 这一条只判方向，不判普适（PREREG §二 ⚑ 与 §三.4 的升格规则）');

const W = sandbox(ROOT); const T = W.EpirusTrainer;
T.setSupportPrior(0);
console.log('\n# §E650 三.3 广度不塌（尺 = `mirrorHealth(multi)` 20 局的**最大单卡落地份额**，`landShareOf` 与当选面同一实现）');
const share = a => landShareOf(W, T.mirrorHealth(loadChamp(W, prodOf(a), ROOT), 20, 5, 'multi'));
console.log('臂'.padEnd(14) + '关档份额'.padEnd(12) + '开档份额'.padEnd(12) + 'Δ(pt)'.padEnd(10) + '关档主落卡 ‖ 开档主落卡');
let worst = 0; const shares = [];
for (const s of SEEDS) {
  const off = share(PFX + '0-' + s), on = share(PFX + '1-' + s);
  shares.push(off.share, on.share);
  const dd = (on.share - off.share) * 100;
  if (dd > worst) worst = dd;
  console.log((PFX + '·' + s).padEnd(14) + (off.share * 100).toFixed(1).padEnd(12) + (on.share * 100).toFixed(1).padEnd(12) +
    (dd >= 0 ? '+' : '') + dd.toFixed(1) + 'pt'.padEnd(5) + '   ' + off.key + ' ‖ ' + on.key);
}
console.log('  §三.3 的线（开档不得比关档恶化 >10pt）⇒ 最大恶化 ' + worst.toFixed(1) + 'pt ⇒ **判词：' + (worst > 10 ? '广度塌了' : '没塌') + '**');
/* 整列 0 与"真的没有主落卡"同形 ⇒ 先查钩子接没接上，再把这一格当读数（§E643 那条自反对照的教训） */
if (shares.every(x => !x)) console.log('  ⛔ 六格份额**全是 0** ⇒ 大概率 `mirrorHealth` 没吐 `landByKey/landedTotal` ⇒ 这一格按"读不出"处理，**不许**读成"广度没塌"');
