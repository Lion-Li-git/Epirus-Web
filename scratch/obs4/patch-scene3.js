const fs = require('fs');
const F = 'tools/proto2/obs3.mjs';
let s = fs.readFileSync(F, 'utf8');
if (s.includes("const v4 = ver === 'obs4';")) { console.log('scene v4 已在'); process.exit(0); }
/* 在 scene 的 recentMap 行之前插 v4/sit，并把 recentMap 行换成 (b||v4) 版 —— 用 scene 独有的注释行做锚 */
const a1 = "  /* ⚑ obs3b/obs3c：最近 K=4 回合的键/目标 bag——一次反扫共用给所有活席（含自己：自己的 bag 也是“我最近打谁”） */\r\n  const recentMap = b ? recentAll(state, R, alive.map((q) => q.id), pid, BAG_K) : null;\r\n";
const a1lf = a1.replace(/\r\n/g, '\n');
let anchor = a1, nl = '\r\n';
if (!s.includes(anchor)) { anchor = a1lf; nl = '\n'; }
if (!s.includes(anchor)) { console.error('scene 锚丢'); process.exit(2); }
const ins = [
  "  const v4 = ver === 'obs4';   /* obs4：全席位进 recent（含已淘汰 ⇒ 槽位恒零）；sit = 局面比较 4 维 */",
  "  let sit = null;",
  "  if (v4) { const al = alive.map((q) => q.hp); const lead = al.length ? Math.max.apply(null, al) : 0;",
  "    sit = [(al.filter((h2) => h2 > me.hp).length + 1) / 8, Math.max(-1, Math.min(1, (me.hp - lead) / modeHp)),",
  "      al.reduce((a, c) => a + c, 0) / Math.max(1, al.length * modeHp), (state.n - alive.length) / 8]; }",
  "  const recentMap = (b || v4) ? recentAll(state, R, (v4 ? state.p.map((q) => q.id) : alive.map((q) => q.id)), pid, BAG_K) : null;",
].join(nl) + nl;
s = s.replace(anchor, ins);
fs.writeFileSync(F, s);
console.log('scene v4/sit/recentMap 已补');
