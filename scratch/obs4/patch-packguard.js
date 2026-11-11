/* arch2 pack() 加非有限守卫：JSON.stringify(NaN) → null → 读回 0 的静默污染必须堵死。
 * （11-10 种子包全零事故根因：makePolicy 误签名 → 权重 NaN → JSON null → unpack 得 0） */
const fs = require('fs');
const F = 'tools/proto2/arch2.mjs';
let s = fs.readFileSync(F, 'utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
};
repRE([
  "  function pack(p) {",
  "    return { v: V_FOR_GEN[L.gen], arch: L.arch, dims: packDims(), a: Array.from(p), n: L.n,"],
  ["  function pack(p) {",
   "    for (let i = 0; i < p.length; i++) if (!Number.isFinite(p[i])) throw new Error('pack: 参数 ' + i + ' 非有限（NaN/Inf）⇒ JSON.stringify 会静默写成 null、读回来变 0（11-10 种子包全零事故的根因），拒绝写盘');",
   "    return { v: V_FOR_GEN[L.gen], arch: L.arch, dims: packDims(), a: Array.from(p), n: L.n,"], 'PG');
fs.writeFileSync(F, s);
console.log('pack NaN 守卫完成');
