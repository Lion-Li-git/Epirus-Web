/* 11-06 午 · 用户点名"有几个点没有长程的成绩"：那 6 枚 = V7C/V7M/V7L × s13/s41（全 v7 面臂，
 *   页眉当时印「有读数 874/880 ‖ 缺长程 6 枚」）。读数来自 champion-map/epsfull-v7long-1106.tsv
 *   （eps-full --mode=long --games=120 --jobs=6 --epsTier=lv:regular，6/6 成、1.5 分钟）。
 * 顺带把三张表拉齐：Hlong/Hplong/Flong 以主表为准同步进 coords-view-18 / coords-view-20
 *   （单页版吃 coords-projcols，但子集表留着旧空列 = 下一个人烘子集页时又缺一遍）。
 * Flong 沿用在册公式 Hplong/100 + 0.10·S。旧值备份 *.bak-v7long。
 */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const T = 0.10;
const MAIN = 'champion-map/coords-gen3-1105.tsv';
const lng = rd('champion-map/epsfull-v7long-1106.tsv'), lh = Object.fromEntries(lng[0].map((x, i) => [x, i]));
const LONG = {};
for (const r of lng.slice(1)) if (r[lh.id]) LONG[r[lh.id]] = { exam: r[lh.exam], page: r[lh.page] };

function patch(file, isMain) {
  const co = rd(file), h = Object.fromEntries(co[0].map((x, i) => [x, i]));
  copyFileSync(file, file + '.bak-v7long');
  let filled = 0, synced = 0;
  const src = isMain ? null : (() => { const m = rd(MAIN), mh = Object.fromEntries(m[0].map((x, i) => [x, i]));
    const o = {}; for (const r of m.slice(1)) o[r[mh.id]] = { Hlong: r[mh.Hlong], Hplong: r[mh.Hplong], Flong: r[mh.Flong] }; return { o, mh }; })();
  for (let r = 1; r < co.length; r++) {
    const id = co[r][h.id]; if (!id) continue;
    if (isMain && LONG[id]) {
      co[r][h.Hlong] = LONG[id].exam; co[r][h.Hplong] = LONG[id].page;
      const S = parseFloat(co[r][h.S]);
      co[r][h.Flong] = isFinite(S) ? (parseFloat(LONG[id].page) / 100 + T * S).toFixed(4) : '';
      filled++;
    } else if (src && src.o[id] && String(src.o[id].Hlong || '').trim() && !String(co[r][h.Hlong] || '').trim()) {
      co[r][h.Hlong] = src.o[id].Hlong; co[r][h.Hplong] = src.o[id].Hplong; co[r][h.Flong] = src.o[id].Flong; synced++;
    }
  }
  writeFileSync(file, co.map(x => x.join('\t')).join('\n') + '\n');
  const miss = co.slice(1).filter(x => !String(x[h.Hlong] || '').trim()).length;
  console.log(file + ' ⇒ 新填 ' + filled + ' ‖ 从主表同步 ' + synced + ' ‖ 仍缺长程 ' + miss + '/' + (co.length - 1));
}
patch(MAIN, true);
patch('champion-map/coords-view-18.tsv', false);
patch('champion-map/coords-view-20.tsv', false);
