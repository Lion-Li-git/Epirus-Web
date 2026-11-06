const fs = require('fs');
const p = 'tools/proto2/supfit-gd.mjs';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('const RARE = ')) { console.log('rare consts already'); }
else {
  const rc = 'const LABEL = { ok: 0, moved: 0, gone: 0, keys: 0 };';
  if (!s.includes(rc)) { console.error('f2'); process.exit(1); }
  s = s.replace(rc, "/* `--rareOnly=miniT,ring --rareFrac=0.7`（靶向采集，ZCode · 11-01 凌晨）：普通配额（NGRP×(1−Frac)）收满后\n" +
    " *   **只收教师选中稀有键的组**——稀有事件语义的 10× 富集器（miniT 选靶 / ring 三连都在这格）。 */\n" +
    "const RARE = String(arg('rareOnly', '')).split(',').filter(Boolean);\n" +
    "const RARE_FRAC = Math.min(0.95, Math.max(0, Number(arg('rareFrac', 0)) || 0));\n" +
    "if (RARE.length && !(RARE_FRAC > 0)) { console.error('⛔ --rareOnly 要配 --rareFrac>0'); process.exit(2); }\n" +
    rc);
}
if (!s.includes('LABEL.rare')) {
  const rc2 = 'const LABEL = { ok: 0, moved: 0, gone: 0, keys: 0 };';
  s = s.replace(rc2, 'const LABEL = { ok: 0, moved: 0, gone: 0, keys: 0, rare: 0 };');
}
if (!s.includes('稀有期：只收稀有键组')) {
  const ra = "    dst.push({ tape: fr.tape, keys, beads: cs2.map((c) => c.bead || null), wantKey: keys[wIdx], want0: t0.key, shp: curShp,";
  if (!s.includes(ra)) { console.error('f3'); process.exit(1); }
  s = s.replace(ra, "    if (srcParams == null && RARE.length && dst.length >= Math.floor(NGRP * (1 - RARE_FRAC)) && RARE.indexOf(again.key) < 0) { LABEL.rare++; return; }   /* 稀有期：只收稀有键组 */\n" +
    ra);
}
fs.writeFileSync(p, s);
console.log('rare pieces applied');
