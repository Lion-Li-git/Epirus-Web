/* supfit-full 教师 2.0 补丁②：标签/开车都走 2.0 路（第一版只装了面，value() 对 2.0 参数当场抛
 * ⇒ catch 吞成 0 ⇒ 教师退化成"永远第一枚候选"——实测 ji 100%。11-10 ZCode） */
const fs = require('fs');
const F = 'tools/proto2/supfit-full.mjs';
let s = fs.readFileSync(F, 'utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
};

/* ① 记住教师是不是 2.0 */
repRE([
  "  console.log('[supfit-full] 教师 = 2.0 包（面=' + tchPack.dims.input + '）⇒ Wv 已装教师面');",
  "}"],
  ["  console.log('[supfit-full] 教师 = 2.0 包（面=' + tchPack.dims.input + '）⇒ Wv 已装教师面');",
   "}",
   "const TCH20 = !!tchCfgMatch;   /* 教师 = 2.0 包 ⇒ 标签/开车走 forwardCands/chooseCandidates（v7 的 value() 对 2.0 参数当场抛） */"], 'T21');

/* ② 标签：2.0 教师用 forwardCands 的 probs argmax（与 chooseCandidates 同一口径的确定性版） */
repRE([
  "  let best = -1e9, bi = 0;",
  "  for (let i = 0; i < cs.length; i++) {",
  "    let v = 0;",
  "    try { v = Wv.EpirusPolicy.value(state, pid, cs[i].key, tchParams, null, cs[i]); } catch (e) { v = 0; }",
  "    if (v > best) { best = v; bi = i; }",
  "  }",
  "  return bi;"],
  ["  if (TCH20) {",
   "    /* 2.0 教师：逐候选前向取 argmax（确定性；与它的 chooseCandidates 同一前向，只是不加温） */",
   "    const fr = Wv.EpirusPolicy.forwardCands(state, pid, cs, tchParams, { temp: 1 });",
   "    let bi = 0, bp = -1;",
   "    for (let i = 0; i < cs.length; i++) { const p2 = fr.probs[i]; if (p2 > bp) { bp = p2; bi = i; } }",
   "    return bi;",
   "  }",
   "  let best = -1e9, bi = 0;",
   "  for (let i = 0; i < cs.length; i++) {",
   "    let v = 0;",
   "    try { v = Wv.EpirusPolicy.value(state, pid, cs[i].key, tchParams, null, cs[i]); } catch (e) { v = 0; }",
   "    if (v > best) { best = v; bi = i; }",
   "  }",
   "  return bi;"], 'T22');

/* ③ 开车：2.0 教师用 chooseCandidates */
repRE([
  "const tchChooser = T.policyChooserN(tchParams, 0.15);   /* 教师的生产口径（--collect=teacher 时开车用） */"],
  ["const tchChooser = TCH20",
   "  ? ((state, pid, legal) => Wv.EpirusPolicy.chooseCandidates(state, pid, legal, tchParams, { temp: 0.15 }))   /* 2.0 教师：走自己的 chooseCandidates（temp=0.15 同生产档） */",
   "  : T.policyChooserN(tchParams, 0.15);   /* v7 教师：生产口径不变（--collect=teacher 时开车用） */"], 'T23');

fs.writeFileSync(F, s);
console.log('教师 2.0 开车/标签补丁完成');
