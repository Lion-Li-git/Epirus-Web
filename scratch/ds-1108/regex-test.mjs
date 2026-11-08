
import { readFileSync } from 'node:fs';
for (const f of ['docs/artifacts/night-adapt/CTRL2-Q-s7.js', 'scratch/night-adapt2/KD-Qg.bak']) {
  const src = readFileSync(f, 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION(?:_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/);
  let ok = false, err = '';
  if (m) { try { const o = JSON.parse(m[1]); ok = true; } catch (e) { err = e.message.slice(0, 80); } }
  console.log(f.split('/').pop() + ' 匹配=' + !!m + ' 解析=' + ok + (err ? ' err=' + err : '') + (m ? ' 匹配长度=' + m[1].length : ''));
}
