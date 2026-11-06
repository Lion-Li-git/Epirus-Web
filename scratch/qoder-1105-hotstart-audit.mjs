/* 2.0 那批的"父身份证明"盘点（Qoder · 11-05）
 * 问题：sidecar 把 24 条父边全标成 `arm`（按名字推）⇒ 图上全虚线。但产物 meta 里到底有没有
 *   `hotstartFrom`（16 位权重 wid）？有 ⇒ 这不是"没证据"，是"证据没被用"。
 * 只做只读扫描：枚数 / 有 hotstartFrom 的 / 该 wid 能否在盘上反查到一枚 / 与名字父是否同一枚。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { braceObj, widOfArr } from '../champion-map/pack-id.mjs';

const ROOT = join(import.meta.dirname, '..');
function walk(dir, out) {
  let es; try { es = readdirSync(dir); } catch (e) { return out; }
  for (const e of es) {
    const p = join(dir, e); let st; try { st = statSync(p); } catch (err) { continue; }
    if (st.isDirectory()) walk(p, out); else if (/\.bak$/.test(e) || /\.js$/.test(e)) out.push(p);
  }
  return out;
}
const files = walk(join(ROOT, 'scratch'), []).concat(walk(join(ROOT, 'docs/artifacts'), []));
const metaOf = (txt) => {
  const m = /EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt) || /EPIRUS_CHAMPION_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt);
  if (m) { try { return JSON.parse(m[1]); } catch (e) { return {}; } }
  return {};
};
const packOf = (txt) => {
  for (const kx of ['EPIRUS_CHAMPION_3P', 'EPIRUS_CHAMPION']) {
    for (let k = txt.indexOf(kx); k >= 0; k = txt.indexOf(kx, k + 1)) {
      if (!/^\s*=/.test(txt.slice(k + kx.length, k + kx.length + 4))) continue;
      const o = braceObj(txt, k); if (o && Array.isArray(o.a)) return o;
    }
  }
  return null;
};
/* wid → 盘上文件名（反查 hotstartFrom 指向谁） */
const WIDIDX = {};
for (const f of files) {
  const txt = (() => { try { return readFileSync(f, 'utf8'); } catch (e) { return ''; } })();
  const o = packOf(txt); if (!o) continue;
  const w = widOfArr(o.a); if (w) WIDIDX[w] = WIDIDX[w] || f.replace(ROOT + '/', '');
}
const rows = readFileSync(join(ROOT, 'scratch/night6/bands-final.tsv'), 'utf8').replace(/\r/g, '').trim().split('\n').slice(1).map(l => l.split('\t')[0]);
const side = readFileSync(join(ROOT, 'champion-map/lineage-g3.tsv'), 'utf8').replace(/\r/g, '').trim().split('\n');
const hd = side[0].split('\t'); const SID = {};
for (const l of side.slice(1)) { const c = l.split('\t'); const o = {}; hd.forEach((k, i) => o[k] = c[i]); SID[o.id] = o; }

let nHas = 0, nResolvable = 0, nAgree = 0, nDisagree = 0, nNoParent = 0;
const detail = [];
for (const id of rows) {
  const hits = files.filter(f => { const b = f.split(/[\\/]/).pop(); return b === id + '-band1.bak' || b === id + '-seg1.bak' || b === id + '.bak'; });
  if (!hits.length) { detail.push([id, '产物文件没找到', '', '']); continue; }
  const txt = readFileSync(hits[0], 'utf8');
  const mt = metaOf(txt);
  const hf = mt.hotstartFrom || (mt.recipe && mt.recipe.env && mt.recipe.env.EPIRUS_SEEDPACK ? 'ENV:' + mt.recipe.env.EPIRUS_SEEDPACK : '');
  if (!mt.hotstartFrom) { detail.push([id, 'meta 无 hotstartFrom', '', '']); continue; }
  nHas++;
  const who = WIDIDX[mt.hotstartFrom];
  const s = SID[id] || {};
  const parName = s.parentOf || s.parent || '';
  if (who) nResolvable++;
  /* 名字父是谁的 wid？用 sidecar 记的 parentName 去找它的产物 */
  let parWid = '';
  if (parName) { const ph = files.filter(f => { const b = f.split(/[\\/]/).pop(); return b === parName + '-band1.bak' || b === parName + '-seg1.bak' || b === parName + '.bak'; });
    if (ph.length) { const po = packOf(readFileSync(ph[0], 'utf8')); parWid = po ? widOfArr(po.a) : ''; } }
  if (parName && parWid && parWid === mt.hotstartFrom) { nAgree++; detail.push([id, 'hotstartFrom ✔', parName, '与名字父同一枚 ⇒ 可升实线']); }
  else if (parName) { nDisagree++; detail.push([id, 'hotstartFrom=' + String(mt.hotstartFrom).slice(0, 8) + ' ⇒ ' + (who || '盘上反查不到'), '名字父=' + parName + '(' + (parWid || '?').slice(0, 8) + ')', '两者不是同一枚 ⇒ 名字父可疑']); }
  else { nNoParent++; detail.push([id, 'hotstartFrom=' + String(mt.hotstartFrom).slice(0, 8) + ' ⇒ ' + (who || '反查不到'), 'sidecar 无父', '哈希能补出父边']); }
}
console.log('== 2.0 带表 ' + rows.length + ' 枚的父身份证明盘点 ==');
console.log('   meta 里有 hotstartFrom：' + nHas + '/' + rows.length + ' ‖ 其中该 wid 能在盘上反查到一枚：' + nResolvable);
console.log('   与 sidecar 的名字父**同一枚**（可直接升实线）：' + nAgree + ' ‖ 不同一枚（名字父可疑）：' + nDisagree + ' ‖ sidecar 本来没父（哈希可补边）：' + nNoParent);
console.log('\n   逐枚：');
for (const d of detail) console.log('     ' + (d[0] + '                  ').slice(0, 20) + (d[1] + '                              ').slice(0, 46) + (d[2] + '            ').slice(0, 26) + d[3]);
