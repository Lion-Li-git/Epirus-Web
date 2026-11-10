const fs = require('fs');
const F = 'tools/proto2/obs3.mjs';
let s = fs.readFileSync(F, 'utf8');
if (s.includes("const v4 = ver === 'obs4';")) { console.log('已在'); process.exit(0); }
const rm = "  const recentMap = b ? recentAll(state, R, alive.map((q) => q.id), pid, BAG_K) : null;";
if (!s.includes(rm)) { console.error('recentMap 锚丢'); process.exit(2); }
const nl = '\n';
const ins = [
  "  const v4 = ver === 'obs4';   /* obs4：全席位进 recent（含已淘汰）；sit = 局面比较 4 维 */",
  "  let sit = null;",
  "  if (v4) { const al = alive.map((q) => q.hp); const lead = al.length ? Math.max.apply(null, al) : 0;",
  "    sit = [(al.filter((h2) => h2 > me.hp).length + 1) / 8, Math.max(-1, Math.min(1, (me.hp - lead) / modeHp)),",
  "      al.reduce((a, c) => a + c, 0) / Math.max(1, al.length * modeHp), (state.n - alive.length) / 8]; }",
  "  const recentMap = (b || v4) ? recentAll(state, R, (v4 ? state.p.map((q) => q.id) : alive.map((q) => q.id)), pid, BAG_K) : null;",
].join(nl) + nl;
s = s.replace(rm, ins.slice(0, -nl.length - rm.length - nl.length) ? rm : rm);
// 直接：把 rm 行替换为「v4/sit 块 + 新 recentMap 行」
s = fs.readFileSync(F, 'utf8');
const rm2 = "  const recentMap = b ? recentAll(state, R, alive.map((q) => q.id), pid, BAG_K) : null;";
s = s.replace(rm2, ins.trimEnd().split(nl).slice(0, 5).join(nl) + nl + "  const recentMap = (b || v4) ? recentAll(state, R, (v4 ? state.p.map((q) => q.id) : alive.map((q) => q.id)), pid, BAG_K) : null;");
fs.writeFileSync(F, s);
console.log('scene v4/sit 已补');
