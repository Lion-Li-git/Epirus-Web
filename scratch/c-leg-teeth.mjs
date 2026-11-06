/* c-leg-teeth.mjs — 腿 C 换地板（ulp(f)/ε + 训练尺度 1e-5）并改成逐坐标全扫之后还剩多少牙。
 *   注入按"**真值是不是真的被改坏了**"分两类：
 *     必红：改动落在**有真实梯度**的坐标上（head 权重少算一列 / 整体缩放 / ctx 偏置减半）
 *     必不红：改动落在**数学上恒零**的坐标上 ⇒ 解析侧给 0 才是对的
 *   ⚑ 后一类不是装饰，是这次测出来的结构事实：`policyHead` 那个 bias 对**每个候选同加**，
 *     两级 softmax 里被完全对消 ⇒ ∂logπ/∂bias ≡ 0（10-31 我先把它当"漏项"注入，腿绿了三次才想明白）。
 * 每条跑完**逐字节还原**，最后自证还原后的 md5 与动手前一致。 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const P = 'tools/proto2/pg-lib.mjs';
const orig = readFileSync(P, 'utf8');
const md5 = (s) => createHash('md5').update(s).digest('hex').slice(0, 8);
const before = md5(orig);
console.log('# 腿C 牙 ‖ pg-lib md5(动手前) ' + before);

const HEAD = '    for (let j = 0; j < hid2; j++) grad[headOff + j] += u * hc[j];';
const CTXB = '    grad[ctxBias + j] += d;';
const BIAS = '    grad[headOff + hid2] += u;';

/* [标签, 锚点, 替换, 期望]  期望 '红' = 必须抓到；'绿' = 真值恒零，抓到才是假阳性 */
const MUT = [
  ['head 权重梯度少算 j=0 这一列（单坐标真漏项 ⇒ 全扫的靶子）', HEAD, '    for (let j = 1; j < hid2; j++) grad[headOff + j] += u * hc[j];', '红'],
  ['head 权重梯度整体 ×1.02（2% 相对误差）', HEAD, HEAD.replace('u * hc[j]', 'u * hc[j] * 1.02'), '红'],
  ['ctx 层 32 个偏置梯度只算一半', CTXB, '    grad[ctxBias + j] += d * 0.5;', '红'],
  ['policyHead bias 梯度删掉（对所有候选同加 ⇒ 真值恒 0，**不该**红）', BIAS, null, '绿'],
];

let pass = true;
for (const [tag, a, b, want] of MUT) {
  const n = orig.split(a).length - 1;
  if (n !== 1) { console.log('  ⛔ 锚点命中 ' + n + ' 处（要 1）⇒ 这条没注入：' + tag); pass = false; continue; }
  writeFileSync(P, orig.replace(a, b === null ? '' : b), 'utf8');
  let out = '', code = 0;
  try { out = execFileSync('node', ['tools/proto2/selftest3.mjs', 'scratch/arms/gd3b-ks-sb.bak'], { encoding: 'utf8' }); }
  catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); code = e.status || 1; }
  const legC = (out.split('\n').find((l) => l.indexOf('腿C') >= 0) || '（没跑到腿C）').trim();
  const got = code !== 0 && legC.indexOf('✘') >= 0 ? '红' : '绿';
  const ok = got === want;
  if (!ok) pass = false;
  console.log('  ' + (ok ? '✔' : '✘') + ' ' + got + '（期望 ' + want + '）‖ ' + tag + ' ‖ ' + legC.replace(/^腿C 数值梯度:\s+/, '').slice(0, 130));
}
writeFileSync(P, orig, 'utf8');
const after = md5(readFileSync(P, 'utf8'));
console.log('  还原：md5 ' + before + ' → ' + after + ' ⇒ ' + (before === after ? '逐字节同 ✔' : '**没还原，手工检查**'));
console.log(pass && before === after ? '⇒ 腿 C 的牙合格：三条真漏项全咬，恒零坐标不误咬' : '⇒ 腿 C 的牙不合格');
process.exit(pass && before === after ? 0 : 8);
