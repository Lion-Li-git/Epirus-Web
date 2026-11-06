/* §E659 的**独立**复算尺：不信任 `gate-resplit.mjs` 的自证②，另走一条路核"拆分有没有动过门体"。
 * 为什么还要再核一次：那条自证与拆分是**同一只手写的**（我自己），而"门体逐字节没动"是这件事唯一的
 *   安全性论据。⇒ 这里改成：从 `git show 8da68a3:tools/gates/train-runner.mjs` 拿拆前的原文，
 *   与拆后的四个部分文件里**同名门**的整块逐字节比，并把差异归到"今晚有意改过的那几条"。
 * 用法：node docs/research/archive/2026-10-20-night-d15-gates/split-body-diff.mjs
 * 只读：`git show` ‖ 读盘，不写任何东西。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '../../../..');
/* 默认与"拆分那一笔的前一帧"比（= 当前 origin/main）。
 * `--base=<sha>` 是**这台尺自己的对照**：拿一个门体真的改过的历史帧去跑，它必须报出差异 ⇒
 *   否则"30 条逐字节相同"这句话是空枪（本仓规矩：任何"跑 X 绿"都要答"坏了 X 会不会红"）。 */
const BASE = (process.argv.find(a => a.indexOf('--base=') === 0) || '--base=8da68a3').slice(7);
const NEWF = ['train-pick', 'train-breadth', 'train-table', 'train-econ'];
/* ⚑ 今晚在拆分**之后**有意动过门体的两条（§E660）：D13 补夹具 ‖ D17 腿⑥ 换播种顺序。
 *   D15 在 `train-evo.mjs`，不在这四个文件里 ⇒ 不参与本比对。 */
const DELIBERATE = { 'D13': '§E660 补 reset + 先播种再装配', 'D17': '§E660 腿⑥ setRng 挪到 makePolicy 之前' };

function blocks(src) {
  const lines = src.split('\n'); const out = new Map(); let cur = null;
  for (const ln of lines) {
    if (/^t\(/.test(ln)) { if (cur) out.set(cur.k, cur.body.join('\n'));
      const k = (ln.match(/^t\('([^']+)'/) || [, '???'])[1]; cur = { k: k, body: [ln] }; }
    else if (cur) cur.body.push(ln);
  }
  if (cur) out.set(cur.k, cur.body.join('\n'));
  /* ⚑ 每个文件的**最后一个块**会把文件尾巴（模块函数收尾那个 `}` ‖ 尾随空行）一起吃进来 ——
   *   第一次跑就是被这个骗了：D136 ‖ D159 ‖ D165 ‖ D229 各报一处差异，逐行打出来全是
   *   `old=(无) / new=}` 这种尾巴形状 ⇒ 不是门体动了。⇒ 比对前统一从后往前剥掉"空行与单个 `}`"。
   *   门体自己的收尾是 `});`，剥不到它，所以这条归一化不会把真差异也剥没。 */
  for (const [k, v] of out) {
    const ls = v.split('\n');
    while (ls.length && (ls[ls.length - 1].trim() === '' || ls[ls.length - 1].trim() === '}')) ls.pop();
    out.set(k, ls.join('\n'));
  }
  return out;
}
const old = blocks(execFileSync('git', ['show', BASE + ':tools/gates/train-runner.mjs'], { cwd: ROOT, maxBuffer: 64e6 }).toString());
const now = new Map();
for (const f of NEWF) for (const [k, v] of blocks(readFileSync(path.join(ROOT, 'tools/gates', f + '.mjs'), 'utf8'))) now.set(k, [v, f]);

const oK = [...old.keys()], nK = [...now.keys()];
const onlyOld = oK.filter(k => !now.has(k)), onlyNew = nK.filter(k => !old.has(k));
const same = [], diff = [];
for (const k of oK) { if (!now.has(k)) continue; (old.get(k) === now.get(k)[0] ? same : diff).push(k); }
const nameOf = k => k.split(' ')[0];
console.log('拆前 ' + oK.length + ' 条 ‖ 拆后（四个部分文件）' + nK.length + ' 条');
console.log('① 拆前有、拆后没有：**' + onlyOld.length + '**' + (onlyOld.length ? ' ⇒ ' + onlyOld.join(' ‖ ') : '（一条不丢）'));
console.log('② 拆后有、拆前没有：**' + onlyNew.length + '**' + (onlyNew.length ? ' ⇒ ' + onlyNew.join(' ‖ ') : '（没有凭空多出来的门）'));
console.log('③ 门体逐字节相同：**' + same.length + '/' + oK.length + '**');
console.log('④ 门体不同：**' + diff.length + '**');
for (const k of diff) {
  const n = nameOf(k);
  const oLines = old.get(k).split('\n'), nLines = now.get(k)[0].split('\n');
  let firstDiff = -1;
  for (let i = 0; i < Math.max(oLines.length, nLines.length); i++) if (oLines[i] !== nLines[i]) { firstDiff = i; break; }
  console.log('   ' + n + '（在 ' + now.get(k)[1] + '.mjs）：' + oLines.length + ' 行 → ' + nLines.length + ' 行 ‖ 第一处不同在第 ' +
    (firstDiff + 1) + ' 行 ‖ ' + (DELIBERATE[n] ? '**今晚有意改：' + DELIBERATE[n] + '**' : '⚠ 不在有意名单里 ⇒ 要人工看'));
}
if (diff.every(k => DELIBERATE[nameOf(k)]) && !onlyOld.length && !onlyNew.length)
  console.log('\n✔ 判读：四个部分文件里唯一的差异就是上面那几条，且都在"今晚有意改"名单内 ⇒ **拆分本身没有动过任何一条门体**。' +
    '（范围要说清：这台尺只比这四个文件；§E660 的另一条 D17 在 `train-evo.mjs`，不在本比对的面里。）');
else console.log('\n⛔ 判读：有对不上的差异 ⇒ 逐条人工核对，别让"拆完全绿"替这句话背书。');
