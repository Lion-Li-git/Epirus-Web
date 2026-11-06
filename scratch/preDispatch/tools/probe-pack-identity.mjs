/* 权重逐位对账（v1.5.276 · qoder 09-28 §E115）—— 今晚用得最多的一个"证明"没有常驻的家
 * 为什么要有它：`行为中性` / `两臂同配置可复现` / `λ 饱和（0.08≡0.15）` / `veto 容差 100% 不改人`
 *   这几条全靠"把两粒产物的权重逐位比一遍"，而我一直是用临时目录里的 `cmp.mjs` 一次性脚本做的
 *   ⇒ 下一班要么重写、要么**凭一次哈希文件当等价**（本仓"比较器假通过"的老账）。
 * ⚠ 三条硬规矩（都是今晚踩过的）：
 *   ① **只比权重，不比文件字节** —— `.bak` 的头注与 `META.ts/arm/band_dir` 每次都不同，整文件哈希会漏报/误报；
 *   ② 读不出包必须**点名 + 非零退出**（缺行 ≠ 相等，同 `champ-audit`/`probe-human-seat` 那条）；
 *   ③ 必须**自带判别力自证**：给一个已知不同的对（不同 seed 的两粒）要求它报"不同"，
 *      否则"全部逐位相同"可能只是"两边都没读出来"。
 * 用法：node tools/probe-pack-identity.mjs a.bak b.bak [...] [--pair=a,b] [--self-test]
 *   不带 --pair：对**所有两两组合**打印；--pair 只比指定那一对；--self-test 额外要求"输入里存在至少一对不同"。 */
import { sandbox, rejectUnknownFlags, loadChamp } from './audit-lib.mjs';
rejectUnknownFlags(process.argv.slice(2), ['pair', 'self-test'], 'probe-pack-identity');
const ARGS = process.argv.slice(2).filter(function (a) { return a.indexOf('--') !== 0; });
const pairArg = (process.argv.find(function (a) { return a.indexOf('--pair=') === 0; }) || '').split('=')[1] || '';
const SELF_TEST = process.argv.includes('--self-test');
if (ARGS.length < 2) { console.error('用法：node tools/probe-pack-identity.mjs a.bak b.bak [...] [--pair=a,b] [--self-test]'); process.exit(2); }
const W = sandbox();
/* 绝对路径由 `loadChamp` 自己处理（v1.5.276 修了它 `root || ROOT` 的假值坑，见 `audit-lib.mjs`）。
 * 这个坑的代价很具体：第一版我拿临时目录里的包测"缺包必须点名 + exit 7"，它**确实红了，但红在路径拼接上**——
 * 一个"结果对、理由错"的用例比红门更糟。 */
const loaded = {}, missing = [];
for (const f of ARGS) {
  try {
    const p = loadChamp(W, f);
    if (!p) { missing.push(f + '（没有可认的冠军外壳）'); continue; }
    loaded[f] = p;
  } catch (e) { missing.push(f + '（' + String(e.message || e).split('\n')[0].slice(0, 60) + '）'); }
}
if (missing.length) {
  console.error('⛔ 有 ' + missing.length + ' 个包读不出 ⇒ 按失败处理（"读不出"绝不能被算成"逐位相同"）：');
  for (const m of missing) console.error('   · ' + m);
  process.exit(7);
}
const files = Object.keys(loaded);
const cmp = function (a, b) {
  const x = loaded[a], y = loaded[b];
  if (x.length !== y.length) return { lenBad: true, n: x.length + ' vs ' + y.length };
  let diff = 0, mx = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) { diff++; const d = Math.abs(x[i] - y[i]); if (d > mx) mx = d; }
  return { diff: diff, n: x.length, mx: mx };
};
let pairs;
if (pairArg) {
  const ab = pairArg.split(',');
  if (ab.length !== 2 || !loaded[ab[0]] || !loaded[ab[1]]) {
    console.error('⛔ --pair 必须是两个**已在参数里出现过**的路径（逗号分隔），实得：' + pairArg);
    process.exit(7);
  }
  pairs = ab[0] === ab[1] ? [] : [[ab[0], ab[1]]];
} else {
  pairs = [];
  for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) pairs.push([files[i], files[j]]);
}
/* ⚠ 去重后只剩一个路径 ⇒ 一对都比不了。这时候**绝不能"零比较 exit 0"**：
 *   那等于把"没比"报成"比过且相同"，正是要防的恒真形状（`same vs same` 这种请求本身没有意义，直接拒）。 */
if (!pairs.length) {
  console.error('⛔ 去重后只剩 ' + files.length + ' 个包 ⇒ 没有任何一对可比（' +
    (pairArg ? '--pair 给了同一个路径两次' : '传同一个路径两次不算"逐位相同"的证明') + '）。拒绝以"零比较"通过。');
  process.exit(7);
}
console.log('# 权重逐位对账（只比 `a` 数组，不比文件字节）· ' + pairs.length + ' 对');
let anyDiff = 0;
for (const pr of pairs) {
  const r = cmp(pr[0], pr[1]);
  if (r.lenBad) { console.log('  ⛔ 维度数不同 ' + r.n + ' ⇒ ' + pr[0] + ' vs ' + pr[1]); anyDiff++; continue; }
  if (r.diff === 0) console.log('  ✓ 逐位相同 · n=' + r.n + ' ⇒ ' + pr[0].split('/').pop() + ' ≡ ' + pr[1].split('/').pop());
  else { anyDiff++; console.log('  ✘ 不同 ' + r.diff + '/' + r.n + ' 维（max|Δ|=' + r.mx.toFixed(4) + '）⇒ ' +
    pr[0].split('/').pop() + ' vs ' + pr[1].split('/').pop()); }
}
if (SELF_TEST && anyDiff === 0) {
  console.error('⛔ --self-test：所有对都"逐位相同" ⇒ 要么它们真的全同，要么这把尺没在读东西（**恒真的比较器是本仓最怕的形状**）。');
  console.error('   处置：本轮判失败。去掉 --self-test 可只看结果，或加进一粒确实不同的包。');
  process.exit(7);
}
process.exit(0);
