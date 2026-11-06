const fs = require('fs');
const p = 'tools/proto2/supfit-gd.mjs';
let s = fs.readFileSync(p, 'utf8');
if (s.includes('GCAP')) { console.log('already'); process.exit(0); }
const capAnchor = "  if (SHAPEBAL) {";
if (!s.includes(capAnchor)) { console.error('c1'); process.exit(1); }
s = s.replace(capAnchor, "  /* 稀有期的每形局数上限放宽（60 ⇒ 2500）：稀有标签要靠局数堆出来 */\n  const GCAP = RARE.length ? 2500 : 60;\n" + capAnchor);
s = s.replace("for (let g = 0; g < 60 && dst.length - before < q; g++) { if (dst.length >= NGRP) break; A2.playOne(play, s, idBase + s * 1000 + g, 4242); }",
              "for (let g = 0; g < GCAP && dst.length - before < q; g++) { if (dst.length >= NGRP) break; A2.playOne(play, s, idBase + s * 1000 + g, 4242); }");
s = s.replace("for (let g = 0; g < 60 && dst.length < NGRP; g++) A2.playOne(play, s, idBase + s * 1000 + g, 4242);",
              "for (let g = 0; g < GCAP && dst.length < NGRP; g++) A2.playOne(play, s, idBase + s * 1000 + g, 4242);");
fs.writeFileSync(p, s);
console.log('caps wired');
