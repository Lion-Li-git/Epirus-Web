/* D218 扩口径之前的量尺：把"用正则字面量读 --旗标"这一形扫出来，逐台对着它的白名单核。
 * 只报事实（谁读了什么没登记），不改任何文件。跑法：node scratch/qoder-1106-d218-scan.mjs */
import { readdirSync, readFileSync } from 'node:fs';

const files = readdirSync('tools').filter(f => f.endsWith('.mjs') && f !== 'np-test.mjs');

/* 名单解析（照门里的 span 思路：顶层逗号后的内联 [ ] 才算名单；变量形式跳过） */
function listedOf(src) {
  const i0 = src.indexOf('rejectUnknownFlags(');
  if (i0 < 0) return null;
  let d = 1, comma = -1, end = -1;
  for (let j = i0 + 'rejectUnknownFlags('.length; j < src.length; j++) {
    const c = src.charAt(j);
    if (c === '(' || c === '[' || c === '{') d++;
    else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) { end = j; break; } }
    else if (c === ',' && d === 1 && comma < 0) comma = j;
  }
  if (comma < 0 || end < 0) return null;
  let k0 = comma + 1;
  while (k0 < end && ' \t\r\n'.includes(src.charAt(k0))) k0++;
  if (src.charAt(k0) !== '[') return null;
  let d2 = 0, close = -1;
  for (let j = k0; j < end; j++) {
    const c = src.charAt(j);
    if (c === '[') d2++;
    else if (c === ']') { d2--; if (d2 === 0) { close = j; break; } }
  }
  if (close < 0) return null;
  const names = [];
  src.slice(k0, close).split(String.fromCharCode(39)).forEach((s, i) => { if (i % 2 === 1) names.push(s); });
  return names;
}

/* 门里已有的那些针脚（旧口径） */
function grab(src, needle) {
  const out = []; const q = String.fromCharCode(39); let i = -1;
  while ((i = src.indexOf(needle, i + 1)) >= 0) {
    const j = src.indexOf(q, i + needle.length);
    if (j > i + needle.length) out.push(src.slice(i + needle.length, j));
  }
  return out;
}
/* 新口径：正则字面量 /^--name=/ —— 名字从针脚后读到 `=` 或 `/` 为止 */
function grabRe(src, needle) {
  const out = []; let i = -1;
  while ((i = src.indexOf(needle, i + 1)) >= 0) {
    let j = i + needle.length, s = '';
    while (j < src.length) { const o = src.charCodeAt(j);
      if ((o >= 48 && o <= 57) || (o >= 65 && o <= 90) || (o >= 97 && o <= 122) || o === 95 || o === 45) { s += src.charAt(j); j++; } else break; }
    if (s) out.push(s);
  }
  return out;
}
const OLD = ["arg('", "flag('", "=== '--", "startsWith('--", "indexOf('--", "includes('--"];
const isName = v => v.length >= 2 && v.charAt(0) !== '-' && /^[A-Za-z0-9_-]+$/.test(v);

let scanned = 0;
for (const f of files) {
  const src = readFileSync('tools/' + f, 'utf8');
  const listed = listedOf(src);
  const oldUsed = new Set();
  OLD.forEach(n => grab(src, n).forEach(x => { const v = x.replace('=', ''); if (isName(v)) oldUsed.add(v); }));
  const reUsed = new Set(grabRe(src, '/^--').map(x => x.replace('=', '')).filter(isName));
  if (!oldUsed.size && !reUsed.size) continue;
  scanned++;
  const newly = [...reUsed].filter(x => !oldUsed.has(x));
  if (!newly.length) continue;
  if (listed === null) {
    console.log(f + '  → 正则形读到 ' + newly.join(',') + ' ‖ 但本机没有内联白名单（变量形式或没消毒层）⇒ 门跳过');
    continue;
  }
  const miss = newly.filter(x => !listed.includes(x));
  console.log(f + '  → 正则形读到 ' + newly.join(',') + ' ‖ 名单=[' + listed.join(',') + '] ‖ ' + (miss.length ? '未登记 = ' + miss.join(',') : '已登记（旧口径看不见）'));
}
console.log('扫了 tools/*.mjs 里读了旗标的 ' + scanned + ' 台');
