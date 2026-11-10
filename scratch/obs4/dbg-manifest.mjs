/* 临时诊断：obs3.mjs manifest 的调用 ver/key 追踪（跑完删） */
const fs = require('fs');
const F = 'tools/proto2/obs3.mjs';
let s = fs.readFileSync(F, 'utf8');
if (!s.includes('DBG-MANIFEST')) {
  const anchor = "  const key = ver + ':' + R.skills.length;";
  if (!s.includes(anchor)) { console.error('锚失败'); process.exit(2); }
  s = s.replace(anchor, anchor + "\n  if (typeof DBGTRACE !== 'undefined' && DBGTRACE) console.log('[manifest] ver=' + ver + ' key=' + key + ' cached=' + (_MAN && _SK === key));");
  fs.writeFileSync(F, s);
  console.log('manifest 追踪已加');
}
