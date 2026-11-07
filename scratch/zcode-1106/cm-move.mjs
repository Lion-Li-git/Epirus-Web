/* champion-map 整理搬迁（11-07 午 · 用户令"整理干净+信息汇总"）
 * 去向：
 *   archive/    = 已并入 coords 系联合表的历史测量批次 + 一次性探针 + 退役分页图 + 可再生成的旧产物
 *   build-1105/ = coords-gen3-1105 联合表的**建造源**（night6-join 的冻结输入；join 路径同步更新）
 * 顶层保留：活脚本 + 活表（viewer/attach 链/join/builder/pool-sync/gates 读的）
 * 规矩：git mv 保历史；搬迁后全库 grep 复核零断引。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, renameSync } from 'node:fs';

const A = 'champion-map/archive/';
const B = 'champion-map/build-1105/';
mkdirSync(A, { recursive: true });
mkdirSync(B, { recursive: true });

const TO_ARCHIVE = [
  /* e 系列批次对（信息已并入 coords.tsv，§E608~E825 时代的 per-experiment 尺表+考卷表） */
  'e608-epsfull.tsv', 'e608-ruler.tsv', 'e608-ruler-extra.tsv',
  'e641-epsfull.tsv', 'e641-ruler.tsv', 'e757-epsfull.tsv', 'e757-ruler.tsv',
  'e762-epsfull.tsv', 'e762-ruler.tsv', 'e772-epsfull.tsv', 'e772-ruler.tsv',
  'e779-epsfull.tsv', 'e779-ruler.tsv', 'e806-epsfull.tsv', 'e806-ruler.tsv',
  'e825-epsfull.tsv', 'e825-ruler.tsv',
  /* 一次性探针/分析脚本（读数已入账，git 史留档） */
  '_probe-e330.mjs', '_probe-legend.mjs', '_probe-pan.mjs', '_probe-winflick.mjs',
  'directions.mjs', 'gapscan.mjs', 'duel-stats.mjs', 'evaln-noise.mjs',
  'eps-arms.mjs', 'eps-arms-read.mjs', 'eps2seed.mjs', 'hlong-compare.mjs',
  'holefeatures.mjs', 'stats-lib.mjs', 'holoprobe.mjs', 'holo2proto.mjs',
  'iso-sweep.mjs', 'k8arms.mjs', 'k8measure.mjs', 'oldpacks.mjs', 'oldpacks-epsfull.mjs',
  'pool-arrange.mjs', 'pool-arrange-ruler.mjs', 'pool-basin-1103.mjs', 'pool-screen.mjs',
  'pool-traits.mjs', 'seatassoc.mjs', 'seatgap.mjs', 'seatroster.mjs', 'selkeys.mjs',
  'trace-game.mjs', 'vetoline.mjs', 'widhunt.mjs',
  /* 退役分页图（09b38ebc 已退，html+mjs 成对） */
  'gen3-map.html', 'gen3-map.mjs', 'gen3-evolution.html', 'gen3-evolution.mjs',
  /* 已并入的历史数据表 */
  '_e318-all15.tsv', '_e328-descendants.tsv',
  'bead-epsfull.tsv', 'bead-epsfull-long.tsv', 'bead-extra.tsv', 'bead-ruler.tsv',
  'cont1200-2026-10-10.tsv', 'duel-e334-s77000.tsv',
  'eps2s88000-120-2026-10-10.tsv', 'eps313-agg.tsv',
  'epsfull-hp-final-2026-10-19.tsv', 'epsfull-hp-final-2026-10-19b.tsv', 'epsfull-hp-final-2026-10-19c.tsv',
  'epsfull-hlong-final-2026-10-19.tsv', 'epsfull-hlong-final-2026-10-19c.tsv',
  'epsfull-long-2026-10-16.tsv', 'epsfull-long-2026-10-24.tsv',
  'epsfull-long-prior2-2026-10-18.tsv', 'epsfull-prior2-2026-10-18.tsv',
  'epsfull-tier-88000c-2026-10-12.tsv', 'epsfull-v7long-1106.tsv',
  'extra-g3-1105-new.tsv', 'extra-g3c-1105.tsv', 'extra-g3d-1105.tsv',
  'feas-long-g3-1105.tsv', 'feas-short-g3-1105.tsv',
  'h2p-epsfull.tsv', 'h2p-extra.tsv', 'h2p-ruler.tsv',
  'holo-gift-retest-2026-10-18.tsv', 'holo.tsv', 'holo2proto.tsv',
  'opphuman-arms.tsv', 'pool-hp.tsv', 'pool-traits.tsv', 'poolruler-2026-10-17.tsv',
  'pool-seat-ml2-90210.tsv', 'pool-seat-ml2-90211.tsv',
  'ruler-pool-new-1107.tsv',
  'seat-2026-10-11-90210.tsv', 'seat-2026-10-11-90211.tsv', 'seat-2026-10-11-90212.tsv',
  'seat-cands-2026-10-09.tsv', 'selband-2026-10-18.tsv',
  'usage-buckets-2026-10-20.tsv', 'usage.tsv',
  'point-data.tsv', 'point-data.mjs',          /* 旧数据代（gen3-map 时代）；table-census 的引用是同名前缀假阳性，搬迁后复核 */
  'index.html.bak',
];
const TO_BUILD = [
  /* coords-gen3-1105 的建造源（night6-join-coords.mjs 读；本班同步更新 join 路径） */
  'coords-gen3-1103.tsv', 'g3-nodes-1103.tsv', 'ruler-g3-1103.tsv',
  'epsfull-g3-1105.tsv', 'epsfull-g3b-1105.tsv', 'epsfull-g3c-1105.tsv', 'epsfull-g3d-1105.tsv',
  'epsfull-r64-multi-1106.tsv', 'epsfull-r64-long-1106.tsv',
];

let moved = 0, movedPlain = 0, missing = [];
for (const [dir, list] of [[A, TO_ARCHIVE], [B, TO_BUILD]]) {
  for (const f of list) {
    const src = 'champion-map/' + f;
    if (!existsSync(src)) { missing.push(f); continue; }
    try {
      execFileSync('git', ['mv', src, dir + f], { stdio: 'pipe' });
      moved++;
    } catch (e) {
      /* 未跟踪文件（从没进过 git）⇒ 普通 mv */
      renameSync(src, dir + f);
      movedPlain++;
    }
  }
}
console.log('搬迁 ' + moved + ' (git mv) + ' + movedPlain + ' (普通 mv) 个文件（archive ' + (TO_ARCHIVE.length - missing.filter(f => TO_ARCHIVE.includes(f)).length) + ' ‖ build-1105 ' + TO_BUILD.length + '）');
if (missing.length) console.log('缺文件（跳过）：' + missing.join(' '));
