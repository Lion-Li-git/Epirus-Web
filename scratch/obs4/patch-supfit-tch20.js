/* supfit-full 教师支持 2.0 包（11-10 ZCode）：教师是 obs3b/obs4/obs5 包时，先在 Wv 里装它自己的面再 unpack。
 * v7 参照 params 先取（Float64Array 快照，不受后装的 arch2 覆盖影响——§E821 的 LEGACY 路由保证 v7 参数走老路）。 */
const fs = require('fs');
const F = 'tools/proto2/supfit-full.mjs';
let s = fs.readFileSync(F, 'utf8');
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
};
repRE([
  "/* 先读 v7 参照（createArena2 的硬条款：必须在 installArch2 之前） */",
  "const Wv = sandbox();",
  "const refParams = Float64Array.from(loadChamp(Wv, 'js/bundled-champion-3p.js', ''));",
  "const tchParams = Float64Array.from(loadChamp(Wv, TEACHER, ''));   /* 标签教师（可与参照不同包） */"],
  ["/* 先读 v7 参照（createArena2 的硬条款：必须在 installArch2 之前） */",
   "const Wv = sandbox();",
   "const refParams = Float64Array.from(loadChamp(Wv, 'js/bundled-champion-3p.js', ''));",
   "/* 教师 = 2.0 包时：先在 Wv 装**教师自己的面**再 unpack（11-10 ZCode）。v7 参照已取成参数快照，",
   " *   后装的 arch2 不动它；v7 参照跑局时走 LEGACY 老路（§E821 修过的路由），两边互不踩。 */",
   "let tchParams = null;",
   "const tchRawSrc = readFileSync(TEACHER, 'utf8');",
   "const tchCfgMatch = tchRawSrc.match(/\"dims\":\\{[^}]*\"input\":\"(obs[345][a-z]?)\"/);",
   "if (tchCfgMatch) {",
   "  const tchPack = JSON.parse(tchRawSrc.match(/EPIRUS_CHAMPION_3P\\s*=\\s*(\\{[\\s\\S]*?\\})\\s*;/)[1]);",
   "  installArch2(Wv, { input: tchPack.dims.input, gen: tchPack.dims.gen, keySplit: tchPack.dims.keySplit, seatH: tchPack.dims.seatH, actH: tchPack.dims.actH, hid: tchPack.dims.hid, hid2: tchPack.dims.hid2, skills: tchPack.skills, mutMode: 'seg' });",
   "  console.log('[supfit-full] 教师 = 2.0 包（面=' + tchPack.dims.input + '）⇒ Wv 已装教师面');",
   "}",
   "tchParams = Float64Array.from(loadChamp(Wv, TEACHER, ''));   /* 标签教师（可与参照不同包/不同面） */"], 'T20');
fs.writeFileSync(F, s);
console.log('supfit 教师 2.0 支持完成');
