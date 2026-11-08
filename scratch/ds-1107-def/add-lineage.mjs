
/* 给夜班 3 枚 2.0 候补补 lineage-g3 行（fam 16 = KD 蒸馏链），并补上游 KD-Qg
 * 病：intake 只写了 coords 行，没写谱系侧车 ⇒ viewer 的 fam/ts/par 全取 LIN ⇒ fam=0、ts=''、
 *     地图上色成家族 0、谱系图落不进「最新」那一列（用户实测「最新的点只到 DEF 族」）。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const P = 'champion-map/lineage-g3.tsv';
copyFileSync(P, P + '.bak-1108');
const raw = readFileSync(P, 'utf8').replace(/^\uFEFF/, '');
const EOL = raw.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const lines = raw.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t');
const has = (id) => lines.some(l => l.split('\t')[0] === id);
const LAB = 'KD 蒸馏链（v7 教师全模型）';
const rows = [
  ['KD-Qg', '16', LAB, '2026-11-07T17:20:00.000Z', '', 's13', 'Q-s47', 'Q-s47', 'Q-s47', 'fa28800eae6a3d7c', 'teacher', 'product'],
  ['CTRL2-Q-s7', '16', LAB, '2026-11-07T17:45:02.829Z', '', 's7', 'KD-Qg', 'KD-Qg', 'KD-Qg', '5a1d3ce77b2fd2c3', 'seedpack-wid', 'product'],
  ['CTRL2-Q-s13', '16', LAB, '2026-11-07T17:25:35.822Z', '', 's13', 'KD-Qg', 'KD-Qg', 'KD-Qg', '9b0cc330a1598a2a', 'seedpack-wid', 'product'],
  ['ADAPT2-Q-s7', '16', LAB, '2026-11-07T17:45:53.171Z', '', 's7', 'KD-Qg', 'KD-Qg', 'KD-Qg', '6c84d61da4bd9a17', 'seedpack-wid', 'product'],
];
let added = 0;
for (const r of rows) {
  if (has(r[0])) { console.log('已在册，跳过 ' + r[0]); continue; }
  lines.push(r.join('\t'));
  added++;
}
writeFileSync(P, lines.join(EOL) + EOL);
console.log('追加 ' + added + ' 行 ⇒ ' + P);
