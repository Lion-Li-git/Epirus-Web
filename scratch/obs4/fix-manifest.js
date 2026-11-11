const fs = require('fs');
let s = fs.readFileSync('tools/proto2/obs3.mjs', 'utf8');
const junk = [
  "  const v4 = ver === 'obs4';",
  "  /* obs4：全席位进 recent（含已淘汰 ⇒ 槽位恒零），威胁计数才有来源；sit = 局面比较 4 维 */",
  "  const recentMap = (b || v4) ? recentAll(state, R, (v4 ? state.p.map((q) => q.id) : alive.map((q) => q.id)), pid, BAG_K) : null;",
  "  let sit = null;",
  "  if (v4) { const al = alive.map((q) => q.hp); const lead = al.length ? Math.max.apply(null, al) : 0;",
  "    sit = [(al.filter((h2) => h2 > me.hp).length + 1) / 8, Math.max(-1, Math.min(1, (me.hp - lead) / modeHp)),",
  "      al.reduce((a, c) => a + c, 0) / Math.max(1, al.length * modeHp), (state.n - alive.length) / 8]; }",
].join('\r\n') + '\r\n';
if (!s.includes(junk)) {
  const junk2 = junk.replace(/\r\n/g, '\n');
  if (!s.includes(junk2)) { console.error('junk 没找到'); process.exit(2); }
  s = s.replace(junk2, '');
} else s = s.replace(junk, '');
fs.writeFileSync('tools/proto2/obs3.mjs', s);
console.log('manifest 误插已清');
