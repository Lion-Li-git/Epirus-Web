/* arch2.mjs 的 obs4 接入（layout / packInstallCfg / forwardObs3 槽位分支） */
const fs = require('fs');
const F = 'tools/proto2/arch2.mjs';
let s = fs.readFileSync(F, 'utf8');
const E = '(?:\r?\n)';

/* ① 输入闸：isO3Input 收 obs4（actIn/dof/inter/tinter/keyHead/seqBlocks 与 obs3 族同构） */
if (!/const isO3Input = \(s\) => s === 'obs3' \|\| s === 'obs3b' \|\| s === 'obs3c' \|\| s === 'obs4';/.test(s)) {
  const a1 = /const isO3Input = \(s\) => s === 'obs3' \|\| s === 'obs3b' \|\| s === 'obs3c';/;
  if (!a1.test(s)) { console.error('锚A1'); process.exit(2); }
  s = s.replace(a1, "const isO3Input = (s) => s === 'obs3' || s === 'obs3b' || s === 'obs3c' || s === 'obs4';   /* obs4：槽位面（11-10 ZCode），与 obs3 族同构（actIn/dof/inter/seqBlocks） */");
}

/* ② layout：seatIn/selfDim/poolN 的 obs4 分支 */
if (!/const seatIn = is4 \? 35 :/.test(s)) {
  const a2 = /const seatIn = input === 'obs3' \? SEAT3 : input === 'obs3c' \? SEAT3C : input === 'obs3b' \? SEAT3B : SEAT_DIM;/;
  if (!a2.test(s)) { console.error('锚A2'); process.exit(2); }
  s = s.replace(a2, "  const is4 = input === 'obs4';   /* obs4：固定 8 槽 + 正交席位块 + 无池化（11-10 深夜 ZCode） */\n  const seatIn = is4 ? 35 : input === 'obs3' ? SEAT3 : input === 'obs3c' ? SEAT3C : input === 'obs3b' ? SEAT3B : SEAT_DIM;");
}
if (!/const selfDim = is4 \? 60 :/.test(s)) {
  const a3 = /const selfDim = input === 'obs3' \? SELF3_EXTRA : \(input === 'obs3b' \|\| input === 'obs3c'\) \? SELF3B_EXTRA : BASE \+ 3;/;
  if (!a3.test(s)) { console.error('锚A3'); process.exit(2); }
  s = s.replace(a3, "  const selfDim = is4 ? 60 : input === 'obs3' ? SELF3_EXTRA : (input === 'obs3b' || input === 'obs3c') ? SELF3B_EXTRA : BASE + 3;   // obs4：G5+私有2+序列48+合计1+局面比较4");
}
if (!/const poolN = is4 \? 8 :/.test(s)) {
  const a4 = /const poolN = isO3 \? 3 : 2;/;
  if (!a4.test(s)) { console.error('锚A4'); process.exit(2); }
  s = s.replace(a4, "  const poolN = is4 ? 8 : isO3 ? 3 : 2;   /* obs4：8 槽位（无池化块） */");
}
if (!/const is4 = input === 'obs4';/.test(s)) { console.error('is4 旗标丢了'); process.exit(2); }
if (!/const isO3 = input === 'obs3' \|\| input === 'obs3b' \|\| input === 'obs3c';/.test(s)) { console.error('isO3 丢了'); process.exit(2); }

/* ③ packInstallCfg 输入检查（isO3Input 已含 obs4 ⇒ 无需改） */

/* ④ forwardObs3：v4 槽位分支（无池化累积 / xin=局面前缀+8槽） */
if (!/const v4 = L\.input === 'obs4';/.test(s)) {
  const a5 = /    const PUBN = sc\.seatN;[^]*?const TP = \(opts2 && opts2\.wantTape\) \? \{ svs: \[\], afs: \[\], t1: \[\], t2: \[\], keys: \[\], xin: null \} : null;/;
  if (!a5.test(s)) { console.error('锚A5'); process.exit(2); }
  s = s.replace(a5, (m0) => m0 + "\r\n    const v4 = L.input === 'obs4';   /* obs4：槽位分支（无 mean/max、无 hSelf 单列——自己在槽里） */");
}
/* 席位循环里的池化累积：包一层 !v4 */
if (!/if \(!v4 && s\.isSelf\) \{ hSelf = e; continue; \}/.test(s)) {
  const a6 = /      if \(s\.isSelf\) \{ hSelf = e; continue; \}\r?\n      poolN\+\+;\r?\n      for \(let j = 0; j < L\.seatH; j\+\+\) \{ mean\[j\] \+= e\[j\]; if \(e\[j\] > mx\[j\]\) mx\[j\] = e\[j\]; \}\r?\n    \}\r?\n    const kk = Math\.max\(1, poolN\);\r?\n    for \(let j = 0; j < L\.seatH; j\+\+\) mean\[j\] \/= kk;/;
  if (!a6.test(s)) { console.error('锚A6'); process.exit(2); }
  s = s.replace(a6, "      if (!v4 && s.isSelf) { hSelf = e; continue; }\r\n      if (!v4) {\r\n        poolN++;\r\n        for (let j = 0; j < L.seatH; j++) { mean[j] += e[j]; if (e[j] > mx[j]) mx[j] = e[j]; }\r\n      }\r\n    }\r\n    if (!v4) { const kk = Math.max(1, poolN); for (let j = 0; j < L.seatH; j++) mean[j] /= kk; }");
}
/* xin：v4 = g/priv/seq/sums/sit(4) + 8 槽；obs3 族照旧 hSelf‖mean‖mx */
if (!/for \(let s = 0; s < 8; s\+\+\) \{ const e = enc\.has\(s\) \? enc\.get\(s\) : zeroSeat;/.test(s)) {
/* A7 已手工完成（xin 三行手术），跳过 */

/* ⑤ dof：obs4 = 292（obs3Dims 不认 obs4，packDims 里补显式分支） */
if (!/if \(is4\) d\.dof = 292;/.test(s)) {
  const a8 = /    if \(isO3Input\(L\.input\)\) d\.dof = obs3Dims\(R, L\.input\);/;
  if (!a8.test(s)) { console.error('锚A8'); process.exit(2); }
  s = s.replace(a8, "    if (is4) d.dof = 292;   /* obs4：8×29 公开 + 60 自块（manifest 见 obs3.mjs dims('obs4')） */\r\n    else if (isO3Input(L.input)) d.dof = obs3Dims(R, L.input);");
}
}
fs.writeFileSync(F, s);
console.log('arch2 obs4 接入完成');
