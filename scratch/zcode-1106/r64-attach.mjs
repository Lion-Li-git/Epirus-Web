/* R64 重测挂列（ZCode 11-06 晨）：把 epsfull-r64-{multi,long}-1106.tsv 的 49 枚读数写进 coords-gen3-1105.tsv。
 * 范围：39 个 ver=2.0 在图行（Hp/De/Hlong/Hplong/Flong 原位覆盖）‖ 10 枚池内图外行不建节点（读数留在 r64 表里）。
 * Flong = Hplong/100 + 0.10·S（与 attach-hlong 同一支公式，T=viewer 默认）。
 * 只动这五列；H（构建时考卷读数）按"换尺不偷名字"惯例一字不动。旧值先备份 coords-gen3-1105.tsv.bak-r64。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const multi = rd('champion-map/epsfull-r64-multi-1106.tsv'), mh = Object.fromEntries(multi[0].map((x, i) => [x, i]));
const lng = rd('champion-map/epsfull-r64-long-1106.tsv'), lh = Object.fromEntries(lng[0].map((x, i) => [x, i]));
const MP = {}, MD = {}, ME = {}, LE = {}, LP = {};
for (const r of multi.slice(1)) { if (!r[mh.id]) continue; MP[r[mh.id]] = r[mh.page]; MD[r[mh.id]] = r[mh.d]; ME[r[mh.id]] = r[mh.exam]; }
for (const r of lng.slice(1)) { if (!r[lh.id]) continue; LE[r[lh.id]] = r[lh.exam]; LP[r[lh.id]] = r[lh.page]; }

const T = 0.10;
const F = 'champion-map/coords-gen3-1105.tsv';
copyFileSync(F, F + '.bak-r64');
const co = rd(F), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
let upd = 0, missing = [], noS = [];
const report = [];
for (let r = 1; r < co.length; r++) {
  const id = co[r][h.id];
  if (!id || !(id in MP)) continue;
  if (co[r][h.ver] !== '2.0') { missing.push(id + '(ver=' + co[r][h.ver] + ')'); continue; }
  const oldHp = co[r][h.Hp], oldHpl = co[r][h.Hplong];
  co[r][h.Hp] = MP[id];
  co[r][h.De] = MD[id];
  co[r][h.Hlong] = LE[id] !== undefined ? LE[id] : '-';
  co[r][h.Hplong] = LP[id] !== undefined ? LP[id] : '-';
  const S = parseFloat(co[r][h.S]);
  if (isFinite(S) && LP[id] !== undefined) co[r][h.Flong] = (parseFloat(LP[id]) / 100 + T * S).toFixed(4);
  else { noS.push(id); co[r][h.Flong] = '-'; }
  upd++;
  report.push(id.padEnd(22) + ' Hp ' + oldHp + '→' + MP[id] + ' ‖ Hplong ' + (oldHpl || '-') + '→' + (LP[id] !== undefined ? LP[id] : '-'));
}
writeFileSync(F, co.map(r => r.join('\t')).join('\n') + '\n');
console.log('更新 ' + upd + ' 行（39 预期）' + (missing.length ? ' ‖ ⚠ ver 非 2.0 的命中：' + missing.join(' ') : '') + (noS.length ? ' ‖ 无 S 列（Flong 置 -）：' + noS.join(' ') : ''));
console.log(report.slice(0, 6).join('\n') + (report.length > 6 ? '\n… 共 ' + report.length + ' 行' : ''));
/* 池内图外 10 枚点名（读数已在 r64 表，不建节点） */
const coIds = new Set(co.slice(1).map(r => r[h.id]));
const absent = Object.keys(MP).filter(id => !coIds.has(id));
console.log('池内图外（本次不建图节点）：' + absent.length + ' 枚 ‖ ' + absent.join(' '));
