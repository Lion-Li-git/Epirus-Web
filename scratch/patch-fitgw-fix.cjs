const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');
const old = "    } else\n    let rank = reads.filter((r) => r.m.wide);";
if (!s.includes(old)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(old, "    } else {\n      rank = reads.filter((r) => r.m.wide);\n    }");
fs.writeFileSync('tools/train-3p.mjs', s);
console.log('else fixed');
