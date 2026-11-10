/* obs3.mjs 的 obs4 三处收尾（循环/seatN/return）——行尾容错 */
const fs = require('fs');
const F = 'tools/proto2/obs3.mjs';
let s = fs.readFileSync(F, 'utf8');
const E = '(?:\r?\n)';
if (!/  const seatList = v4 \? state\.p : alive;/.test(s)) {
  const loopOld = new RegExp('  for \\(const q of alive\\) \\{' + E + '    const rel = \\[0, 0, 0, 0, 0\\];' + E + '    if \\(q\\.id !== pid\\) \\{');
  if (!loopOld.test(s)) { console.error('锚r1'); process.exit(2); }
  s = s.replace(loopOld, "  const seatList = v4 ? state.p : alive;\r\n  for (const q of seatList) {\r\n    const rel = [0, 0, 0, 0, 0];\r\n    if (q.id !== pid && q.hp > 0) {");
}
if (!/  const seatN = ver === 'obs3c' \? SEAT_NC : \(b \? SEAT_NB : ver === 'obs4' \? 29/.test(s)) {
  const seatN = /  const seatN = ver === 'obs3c' \? SEAT_NC : \(b \? SEAT_NB : SEAT_N\);/;
  if (!seatN.test(s)) { console.error('锚r2'); process.exit(2); }
  s = s.replace(seatN, "  const seatN = ver === 'obs3c' ? SEAT_NC : (b ? SEAT_NB : ver === 'obs4' ? 29 : SEAT_N);");
}
if (!/  return \{ W, R, state, pid, me, modeHp, maxR, sd, alive, g, priv, seats, sums, sit,/.test(s)) {
  const ret = /  return \{ W, R, state, pid, me, modeHp, maxR, sd, alive, g, priv, seats, sums, seq: selfSeq\(state, pid, R, ver\), SEAT_W: seatN \+ 6, seatN, ver \};/;
  if (!ret.test(s)) { console.error('锚r3'); process.exit(2); }
  s = s.replace(ret, "  return { W, R, state, pid, me, modeHp, maxR, sd, alive, g, priv, seats, sums, sit, seq: selfSeq(state, pid, R, ver), SEAT_W: seatN + 6, seatN, ver };");
}
fs.writeFileSync(F, s);
console.log('三处完成');
