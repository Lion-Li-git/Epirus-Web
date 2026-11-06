/* 11-07 凌晨 · D191④ 补账（wave1/2/3 臂内收敛双 band + 池入口的 band 孪生）
 * 同 qoder-1106-register-band-copies.mjs 的路子：走在册 declareCopy，文件一字不动。 */
import { readFileSync } from 'node:fs';
import { declareCopy, ALIAS_FILE } from '../../champion-map/pack-guard.mjs';
const ROOT = process.cwd();
const WHY1 = '同臂 band-save 收敛到同一粒权重（widIndex 每进程只扫一遍 ⇒ 收尾写盘看不见本进程先落的 band，pack-guard.mjs:110 已知后果）⇒ 按规矩②补登记';
const WHY2 = '池入口复制（scratch 臂产物 → docs/artifacts/2p0-pool/ 池件）与其 band 孪生同权重 ⇒ 池表=身份真源，此份按规矩②登记';
const RELS = [
  'docs/artifacts/COMBO-s16-band6.bak',
  'docs/artifacts/DEF-half-s13-band5.bak',
  'docs/artifacts/DEF-s15-band3.bak',
  'docs/artifacts/DEF-s16-band2.bak',
  'docs/artifacts/DEF-s16-band4.bak',
  'docs/artifacts/2p0-pool/DEF-s13.bak',
  'docs/artifacts/2p0-pool/DEF-s15.bak',
  'docs/artifacts/2p0-pool/DEF-s16.bak',
  'docs/artifacts/2p0-pool/COMBO-s13.bak',
  'docs/artifacts/2p0-pool/COMBO-s16.bak',
];
for (const rel of RELS) {
  const r = declareCopy({ root: ROOT, dest: rel, text: readFileSync(rel, 'utf8'), tool: 'train-3p:band', why: WHY1 + ' / ' + WHY2 });
  console.log(rel + ' ⇒ canonical=' + r.canonical + ' ‖ wid=' + r.wid);
}
console.log('别名账写向：' + ALIAS_FILE);
