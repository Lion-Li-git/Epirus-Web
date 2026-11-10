const fs = require('fs');
const F = 'tools/proto2/obs3.mjs';
let s = fs.readFileSync(F, 'utf8');
if (s.includes("const v4 = ver === 'obs4';")) { console.log('v4 已在'); process.exit(0); }
const anchor = "  const b = ver === 'obs3b' || ver === 'obs3c';\r\n  /* ⚑ obs3b/obs3c：最近 K=4 回合的键/目标 bag——一次反扫共用给所有活席（含自己：自己的 bag 也是“我最近打谁”） */\r\n";
if (!s.includes(anchor)) {
  const anchor2 = "  const b = ver === 'obs3b' || ver === 'obs3c';";
  const i = s.indexOf(anchor2);
  if (i < 0) { console.error('锚丢'); process.exit(2); }
  const nl = (s.slice(i - 2, i) === '\r\n') ? '\r\n' : '\n';
  const ins = [
    "  const v4 = ver === 'obs4';",
    "  /* obs4：全席位进 recent（含已淘汰 ⇒ 槽位恒零），威胁计数才有来源；sit = 局面比较 4 维 */",
    "  const recentMap = (b || v4) ? recentAll(state, R, (v4 ? state.p.map((q) => q.id) : alive.map((q) => q.id)), pid, BAG_K) : null;",
    "  let sit = null;",
    "  if (v4) { const al = alive.map((q) => q.hp); const lead = al.length ? Math.max.apply(null, al) : 0;",
    "    sit = [(al.filter((h2) => h2 > me.hp).length + 1) / 8, Math.max(-1, Math.min(1, (me.hp - lead) / modeHp)),",
    "      al.reduce((a, c) => a + c, 0) / Math.max(1, al.length * modeHp), (state.n - alive.length) / 8]; }",
  ].join(nl) + nl;
  s = s.slice(0, i) + ins + s.slice(i);
} else {
  const ins = [
    "  const v4 = ver === 'obs4';",
    "  let sit = null;",
    "  if (v4) { const al = alive.map((q) => q.hp); const lead = al.length ? Math.max.apply(null, al) : 0;",
    "    sit = [(al.filter((h2) => h2 > me.hp).length + 1) / 8, Math.max(-1, Math.min(1, (me.hp - lead) / modeHp)),",
    "      al.reduce((a, c) => a + c, 0) / Math.max(1, al.length * modeHp), (state.n - alive.length) / 8]; }",
    "  const recentMap = (b || v4) ? recentAll(state, R, (v4 ? state.p.map((q) => q.id) : alive.map((q) => q.id)), pid, BAG_K) : null;",
  ].join('\r\n') + '\r\n';
  s = s.replace(anchor, ins + anchor.split('\r\n')[0] + '\r\n');
}
fs.writeFileSync(F, s);
console.log('scene v4/sit/recentMap 已补');
