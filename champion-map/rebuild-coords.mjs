#!/usr/bin/env node
/* rebuild-coords.mjs —— §E375：把"重画这张图"的**五步顺序**写成一台可重跑的链，而不是记在各脚本头注里的部落知识。
 *
 * 为什么要单独一台：这一列顺序原来是散着的（attach-kin 说它搬 Sc、attach-path 说它要先跑、attach-hp 说覆盖 ≥700），
 *   而**跑错顺序不会报错、只会静默换形状**。实测踩到的两种：
 *     ① attach-hp 跑在 attach-path/attach-dup 之前 ⇒ Hp/De 落在中间，跑在之后 ⇒ 落在表尾；
 *        更要命的是**重跑一次 attach-hp 就在表尾多一对 Hp/De**（连跑三次 → 36 列变 40 列、三个同名 Hp），
 *        下游按表头查列只看得见第一对 ⇒ 现在 attach-hp 自己幂等了，这台再兜一层"列名不许重复"。
 *     ② attach-path 的 --ruler 不给全 ⇒ 没覆盖到的枚退回"顶层 <id>.bak"猜路径（§E330 那个同名旧拷贝的病）。
 *
 * 顺序（= 现役 coords.tsv 的列序，逐列核过）：
 *   1) ruler-figs      画几何（26 列：id…z3 + 13 个行为列）
 *   2) attach-kin      搬上一版的当选键四列 + 打 kin，并把"续训现役"从 lineage 里清掉
 *   3) attach-hp       头号尺 Hp 与 Δε（--more= 把子代批与旧槽位冠军批都并进来）
 *   4) attach-path     path 列（--ruler= 必须覆盖**全部**枚，否则就是猜）
 *   5) attach-dup      dupN/dupOf（按权重身份去重，要吃 path 列）
 *
 * 用法：node champion-map/rebuild-coords.mjs [--extra=champion-map/e370-ruler.tsv]
 *                                            [--from=<上一版 coords.tsv>] [--dry]
 * ⚠ 会覆盖 champion-map/coords.tsv（先自己备份，这台不动 git）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, renameSync, existsSync as ex } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const EXTRA = String(arg('extra', 'champion-map/e370-ruler.tsv'));
const DRY = process.argv.includes('--dry');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const CO = join(HERE, 'coords.tsv');
const ruler = 'champion-map/ruler-all.tsv' + (EXTRA ? ',' + EXTRA : '');

/* --from 缺省 = **git 里那一版 coords.tsv**（不是工作树那一版：工作树可能正是我马上要覆盖的目标）。
 *   attach-kin 靠它把当选键四列原样搬过来，少了它就得重跑两小时的 attach-sc。 */
let FROM = String(arg('from', ''));
if (!FROM) {
  FROM = 'docs/artifacts/e375-out/coords-from-git.tsv';
  const txt = execFileSync('git', ['show', 'HEAD:champion-map/coords.tsv'], { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
  writeFileSync(join(ROOT, FROM), txt.replace(/\r\n/g, '\n'));
  console.log('--from 缺省取 git HEAD 那一版 ⇒ ' + FROM + '（' + txt.trim().split('\n').length + ' 行）');
}
console.log('几何输入 ' + ruler + ' ‖ 上一版 coords.tsv = ' + FROM);
if (!existsSync(join(ROOT, FROM))) { console.error('⛔ --from 读不到：' + FROM); process.exit(2); }
if (DRY) { console.log('--dry：不跑任何一步'); process.exit(0); }

const run = (script, args, tag) => {
  const out = execFileSync('node', [join(HERE, script)].concat(args), { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
  console.log('—— ' + tag + ' ——\n' + out.trim().split('\n').slice(-3).join('\n'));
};

/* 1) 几何。ruler-figs 除了 --coords 还固定往自己目录甩四张静态图 ⇒ 顺手挪走，别脏工作树 */
run('ruler-figs.mjs', ['--ruler=' + ruler, '--coords=champion-map/coords.tsv'], '① ruler-figs 画几何');
for (const f of ['e287-ladder.svg', 'e287-map2.svg', 'e287-map3.svg', 'e287-figs.html']) {
  const p = join(HERE, f); if (ex(p)) renameSync(p, join(ROOT, 'docs/artifacts/e375-out/rc-static-' + f)); }
run('attach-kin.mjs', ['--from=' + FROM], '② attach-kin 搬当选键 + 打 kin');
run('attach-hp.mjs', ['--more=e328-epsfull.tsv' + (EXTRA ? ',e370-epsfull.tsv' : '')], '③ attach-hp 头号尺');
run('attach-path.mjs', ['--ruler=ruler-all.tsv' + (EXTRA ? ',e370-ruler.tsv' : '')], '④ attach-path 真用的文件');
run('attach-dup.mjs', [], '⑤ attach-dup 权重身份去重');

/* 收尾核验：列名不许重复、每行宽度一致、lineage/kin 两列的类必须还是那几类 */
const L = rd(CO), h = L[0].split('\t'), rows = L.slice(1).map(l => l.split('\t'));
const dup = h.filter((c, i) => h.indexOf(c) !== i);
const badW = rows.filter(r => r.length !== h.length);
console.log('\n产物 ' + rows.length + ' 行 × ' + h.length + ' 列 ‖ 列序 ' + h.join(','));
if (dup.length) { console.error('⛔ 表头有重复列名：' + dup.join(',') + ' ⇒ 下游按名字查列会拿到旧的那一列'); process.exit(2); }
if (badW.length) { console.error('⛔ ' + badW.length + ' 行宽度不等于表头 ⇒ 列错位'); process.exit(2); }
const iLin = h.indexOf('lineage'), iKin = h.indexOf('kin');
const cls = {}; rows.forEach(r => { const k = (r[iLin] || r[iKin] || '层内'); cls[k] = (cls[k] || 0) + 1; });
console.log('身份分布 ' + Object.entries(cls).map(([k, v]) => k + ' ' + v).join(' ‖ '));
console.log('✅ 五步跑完且产物自洽（列名唯一、行宽一致）');
