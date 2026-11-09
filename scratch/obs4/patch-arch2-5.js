/* arch2.mjs 的 obs5 接入：输入闸 / layout（is5 旗标 + poolN=4 + attn/pma 段 + fanIn）/ packDims */
const fs = require('fs');
const F = 'tools/proto2/arch2.mjs';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const rep = (a, b, tag) => {
  if (!s.includes(a)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.split(a).join(b); n++;
};

rep("const isO3Input = (s) => s === 'obs3' || s === 'obs3b' || s === 'obs3c' || s === 'obs4';",
  "const isO3Input = (s) => s === 'obs3' || s === 'obs3b' || s === 'obs3c' || s === 'obs4' || s === 'obs5';   /* obs5：注意力面（11-10 ZCode）——特征与 obs4 同一张 manifest，聚合段换 set-transformer */", 'A47');

rep("  const input = o.input === 'obs3' || o.input === 'obs3b' || o.input === 'obs3c' || o.input === 'obs4' ? o.input : 'v7';",
  "  const input = o.input === 'obs3' || o.input === 'obs3b' || o.input === 'obs3c' || o.input === 'obs4' || o.input === 'obs5' ? o.input : 'v7';", 'A146');

rep("  const isO3 = input === 'obs3' || input === 'obs3b' || input === 'obs3c' || input === 'obs4';",
  "  const isO3 = input === 'obs3' || input === 'obs3b' || input === 'obs3c' || input === 'obs4' || input === 'obs5';", 'A147');

rep("    const is4 = input === 'obs4';   /* obs4：固定 8 槽 + 正交席位块 + 无池化（11-10 深夜 ZCode） */\n  const seatIn = is4 ? 35 : input === 'obs3' ? SEAT3 : input === 'obs3c' ? SEAT3C : input === 'obs3b' ? SEAT3B : SEAT_DIM;",
  "    const is4 = input === 'obs4';   /* obs4：固定 8 槽 + 正交席位块 + 无池化（11-10 深夜 ZCode） */\n    const is5 = input === 'obs5';   /* obs5：注意力聚合（seatIn/selfDim 与 obs4 同族；seg 多 attn/pma 两段） */\n  const seatIn = (is4 || is5) ? 35 : input === 'obs3' ? SEAT3 : input === 'obs3c' ? SEAT3C : input === 'obs3b' ? SEAT3B : SEAT_DIM;", 'A153');

rep("    const selfDim = is4 ? 60 : input === 'obs3' ? SELF3_EXTRA : (input === 'obs3b' || input === 'obs3c') ? SELF3B_EXTRA : BASE + 3;",
  "    const selfDim = (is4 || is5) ? 60 : input === 'obs3' ? SELF3_EXTRA : (input === 'obs3b' || input === 'obs3c') ? SELF3B_EXTRA : BASE + 3;", 'A156');

rep("    const poolN = is4 ? 8 : isO3 ? 3 : 2;   /* obs4：8 槽位（无池化块） */",
  "    const poolN = is4 ? 8 : is5 ? 4 : isO3 ? 3 : 2;   /* obs4：8 槽位（无池化块） ‖ obs5：4 个 PMA seed（ctx 拼接块） */", 'A163');

rep("  const candIn = hid + actH + ((isO3 || is4) ? 2 * seatH : seatH);   // obs4：两目标槽同 obs3 族",
  "  const candIn = hid + actH + ((isO3 || is4) ? 2 * seatH : seatH);   // obs4/obs5：两目标槽同 obs3 族", 'A170');

/* seg 表：obs5 在 seatEnc 后插 attn/pma；fanIn 补两段（He-ish 定标按 seatH 扇入）。行尾自适应（文件是 CRLF）。 */
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
rep(["  const seg = [",
  "    { name: 'seatEnc', off: 0, len: seatH * seatIn + seatH },",
  "    { name: 'actEnc', off: 0, len: actH * actIn + actH },"].join(EOL),
  ["  const seg = [",
  "    { name: 'seatEnc', off: 0, len: seatH * seatIn + seatH },",
  "    /* obs5（11-10 ZCode）：attn = Wq|bq|Wk|bk|Wv|bv（各 H*H+H）；pma = Wq2|bq2|seeds(4*H）。注意这两个块的",
  "     *   内部序与偏移算术必须与 policy2.layoutOfPack / pg-lib.layoutOf 逐字同源，不一致由 parity 当场红。 */",
  "    ...(is5 ? [",
  "      { name: 'attn', off: 0, len: 3 * (seatH * seatH + seatH) },",
  "      { name: 'pma', off: 0, len: (seatH * seatH + seatH) + 4 * seatH },",
  "    ] : []),",
  "    { name: 'actEnc', off: 0, len: actH * actIn + actH },"].join(EOL), 'SEG');

rep("    fanIn: { seatEnc: seatIn, actEnc: actIn, ctx: ctxDim, cand: candIn, policyHead: hid2, inter: hid, tinter: seatH, keyHead: hid },",
  "    fanIn: { seatEnc: seatIn, actEnc: actIn, ctx: ctxDim, cand: candIn, policyHead: hid2, inter: hid, tinter: seatH, keyHead: hid, attn: seatH, pma: seatH },", 'FAN');

rep("    if (L.input === 'obs4') d.dof = 292;   /* obs4：8×29 公开 + 60 自块（manifest 见 obs3.mjs dims('obs4')） */",
  "    if (L.input === 'obs4' || L.input === 'obs5') d.dof = 292;   /* obs4/obs5：同一张特征 manifest（8×29 公开 + 60 自块，见 obs3.mjs dims） */", 'DOF');

fs.writeFileSync(F, s);
console.log('arch2 闸口/layout 完成 ' + n + ' 处');
