const fs = require('fs');
let s = fs.readFileSync('tools/train-3p.mjs', 'utf8');
const old = 'try { mkdirSync(HALL_TRACE_OUT.replace(/\\\\[^\\\\]*$/, \'\') || \'.\', { recursive: true }); } catch (eTrace) {}';
if (!s.includes(old)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(old, "try { mkdirSync(HALL_TRACE_OUT.split(/[\\\\/]/).slice(0, -1).join('/') || '.', { recursive: true }); } catch (eTrace) {}");
fs.writeFileSync('tools/train-3p.mjs', s);
console.log('mkdir fixed');
