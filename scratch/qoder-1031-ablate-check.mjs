/* qoder-1031-ablate-check.mjs — "消融切段修好"这件事的两侧证据（千问 · 10-31 晨）
 *  ① **默认路逐字不变**：不开消融时，两枚包在 200 个真局决策点上的 logits 指纹必须与修复前**逐位相同**；
 *  ② **开关真的有被修**：同一批局面上 `setAblate(['Q.out'])` 的指纹必须与修复前**不同**
 *     （不同 ⇒ 从前那个"关 Q.out"确实关错了列）；
 *  ③ 顺手把两面的序列块型打出来（obs3 交错 / obs3b 连续）——这条是给文档留的字据。
 * 用法：node scratch/qoder-1031-ablate-check.mjs [标签]
 */
import { sandbox, loadChamp } from '../tools/audit-lib.mjs';
import { install, readPack2, packCfgExit } from '../tools/proto2/arch2.mjs';
import { collectFixtures } from '../tools/proto2/head-health.mjs';
import { blocks, setAblate, dims } from '../tools/proto2/obs3.mjs';
/* seqLayout 是"修复后"才有的导出 ⇒ 版本自适应，这份探针必须能在修复前后**同一份**跑（否则 A/B 不成立）*/
const seqLayout = (await import('../tools/proto2/obs3.mjs')).seqLayout || null;
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

const TAG = process.argv[2] || '现在';
const packs = ['scratch/arms/CEM48c-s7.bak', 'scratch/arms/OB3S-BIGT-s7.bak', 'scratch/arms/OB3S-C1-s7.bak']
  .filter((f) => existsSync(f));

const W = sandbox();
const R = W.EpirusRules;
console.log('## ' + TAG + ' ‖ obs3 dof=' + dims(R, 'obs3') + ' ‖ obs3b dof=' + dims(R, 'obs3b'));
const pat = (ver) => { const s = seqLayout(R, ver); const o = []; let last = null; for (const b of s) { if (b !== last) { o.push(b); last = b; } } return o.length + ' 段: ' + o.join('|'); };
console.log(seqLayout ? ('   序列块型 obs3  = ' + pat('obs3') + '（' + seqLayout(R, 'obs3').length + ' 列）') : '   序列块型：这版还没有 seqLayout（= 修复前的代码）');
console.log(seqLayout ? ('   序列块型 obs3b = ' + pat('obs3b') + '（' + seqLayout(R, 'obs3b').length + ' 列）') : '');

for (const p of packs) {
  let raw, got;
  try { raw = readPack2(p); got = packCfgExit(raw, p); } catch (e) { console.log('   ⚠ 读不出 ' + p + '：' + String(e.message).slice(0, 60)); continue; }
  const inp = (raw.dims && raw.dims.input) || '?';
  const A = install(W, Object.assign({ mutMode: 'seg' }, got.cfg));
  const pp = W.EpirusPolicy.unpack(raw, true);
  if (!pp) { console.log('   ⚠ ' + p + '：unpack 不出（装档形状与包不符？）⇒ 跳过'); A.restore(); continue; }
  const P = W.EpirusPolicy;
  const fx = collectFixtures(W, { perShape: 12, seed: 20261031 }).fixtures;
  const dig = (mode) => {
    setAblate(mode ? [mode] : null);
    if (P.__arch2) P.__arch2.rngRef.r = (() => 0.5);      /* 前向不吃随机，这里只是把状态定死 */
    const h = createHash('sha1');
    let n = 0;
    for (const f of fx) {
      const cands = f.cands && f.cands.length >= 2 ? f.cands : null;
      if (!cands) continue;
      const fr = P.forwardCands(f.st, f.pid, cands, pp, { temp: 0.5 });
      const lg = fr.logits || fr.probs || [];
      for (let i = 0; i < lg.length; i++) h.update(String(Math.round(lg[i] * 1e9)));
      n++;
    }
    setAblate(null);
    return { n, sum: h.digest('hex').slice(0, 16) };
  };
  const off = dig(null), qo = dig('Q.out'), qs = dig('Q.seq'), qb = dig('Q.bag');
  console.log('   ' + p.replace(/^.*[\\/]/, '') + ' ‖ input=' + inp + ' ‖ 决策点 ' + off.n);
  console.log('     不开消融=' + off.sum + ' ‖ 关Q.out=' + qo.sum + ' ‖ 关Q.seq=' + qs.sum + ' ‖ 关Q.bag=' + qb.sum +
    ' ‖ 三者互不相同=' + (off.sum !== qo.sum && off.sum !== qs.sum && qo.sum !== qs.sum));
  A.restore();
}
