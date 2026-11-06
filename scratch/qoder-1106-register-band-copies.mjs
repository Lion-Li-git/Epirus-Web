/* 11-06 午 · D191④「未登记的重复 2 枚」的补账（用户令"修一下"）。
 * 事实：docs/artifacts/MUTFLAT-s15-band5.bak 与 band6.bak 的 wid 与 band1.bak 逐位相同（206a93fabfa23653）
 *   ⇒ 一粒权重三个名字，而别名表里只有 MIX8/MUTFLAT-s16 那批的 4 对，这批 07:56 跑的没登记。
 * 为什么没登记（不是有人偷懒）：`champion-map/pack-guard.mjs:110` 那段写明 —— `widIndex` 每进程只扫一遍 ⇒
 *   `train-3p` 收尾写 band 夹具时**看不见本进程刚落的另外几枚** ⇒ 判成"新权重" ⇒ 走了"不拦、不登记"的分支。
 * 本件只做补账：走在册的 `declareCopy`（写同样字节 + 登记带理由的别名行），不手抄表、不删别人的产物。
 * 根因那一半（band-save 该不该 declareCopy）留给 #29，不在这里顺手改训练侧。
 */
import { readFileSync } from 'node:fs';
import { declareCopy, ALIAS_FILE } from '../champion-map/pack-guard.mjs';
const ROOT = process.cwd();
const WHY = '同臂 band-save 收敛到同一粒权重（真身 = band1）；07:56 那批跑完没登记是 widIndex 每进程只扫一遍、' +
  '收尾写盘时看不见本进程先落的 band（pack-guard.mjs:110 那段没补缓存的已知后果）⇒ 按规矩②补登记，文件一字未动';
for (const rel of ['docs/artifacts/MUTFLAT-s15-band5.bak', 'docs/artifacts/MUTFLAT-s15-band6.bak']) {
  const r = declareCopy({ root: ROOT, dest: rel, text: readFileSync(rel, 'utf8'), tool: 'train-3p:band', why: WHY });
  console.log(rel + ' ⇒ wrote=' + r.wrote + ' ‖ canonical=' + r.canonical + ' ‖ wid=' + r.wid + ' ‖ ' + r.note);
}
console.log('别名账写向：' + ALIAS_FILE);
