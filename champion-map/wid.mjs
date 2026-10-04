#!/usr/bin/env node
/* §E311 权重指纹速查：node champion-map/wid.mjs <文件…>
 * 为什么单独一个工具：今晚三次手搓"取 EPIRUS_CHAMPION_3P.a 再 sha1"（lineage.mjs 里一份、探针里两份），
 *   而这里有个真坑：`EPIRUS_CHAMPION_3P` 同时是 `EPIRUS_CHAMPION_3P_META` 的前缀，且 .bak 里 META 那行在前面
 *   ⇒ 直接 indexOf 会拿到 META 对象（它没有 .a）⇒ 全部静默返回 null。只认"名字后面紧跟 ="的那一处。
 * 口径与 server/train-server.mjs:100 的 weightsId(params) 一致（只哈希权重数组，不含决策期常数 ⇒ "同指纹"≠"同行为"）。
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function braceObj(txt, start) {
  const b = txt.indexOf('{', start); if (b < 0) return null;
  let d = 0, i = b, inS = false, esc = false;
  for (; i < txt.length; i++) {
    const c = txt[i];
    if (inS) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inS = false; continue; }
    if (c === '"') inS = true;
    else if (c === '{') d++;
    else if (c === '}') { d--; if (!d) { try { return JSON.parse(txt.slice(b, i + 1)); } catch { return null; } } }
  }
  return null;
}
export function widOf(txt) {
  const KEY = 'EPIRUS_CHAMPION_3P';
  for (let k = txt.indexOf(KEY); k >= 0; k = txt.indexOf(KEY, k + 1)) {
    if (!/^\s*=/.test(txt.slice(k + KEY.length, k + KEY.length + 4))) continue;
    const o = braceObj(txt, k); if (!o || !Array.isArray(o.a)) continue;
    return createHash('sha1').update(JSON.stringify(Array.from(o.a))).digest('hex').slice(0, 16);
  }
  return null;
}
if (process.argv[1] && /wid\.mjs$/.test(process.argv[1])) {
  const seen = {};
  for (const f of process.argv.slice(2)) {
    let w = null;
    try { w = widOf(readFileSync(f, 'utf8')); } catch (e) { console.log(f.padEnd(56) + '读取失败：' + e.message); continue; }
    console.log((w || '取不到权重').padEnd(18) + f);
    (seen[w || 'null'] = seen[w || 'null'] || []).push(f);
  }
  const g = Object.entries(seen).filter(([, v]) => v.length > 1);
  if (g.length) { console.log('\n⚠ 逐字节相同的组：'); for (const [w, v] of g) console.log('  ' + w + '  ' + v.join(' ‖ ')); }
  else if (process.argv.length > 3) console.log('\n✅ 两两不同 ⇒ 剂量真的换了人（不是 §E249/§E309 那类零剂量）');
}
