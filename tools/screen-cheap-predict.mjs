/* 体质能不能靠**现有 ε=0 镜像读数**免费预测出来？（09-25 上午 · Qoder · 只读）
 *
 * 背景（§H-41）：`EPIRUS_*` 之外还有一件事实——训练桌 `OPPS` 里**早就有**"会攒钱的人"（`breakdef` 86% 出ジ、`farmer` 囤 ep），
 *   所以"桌上没有攒钱者 ⇒ 学不会破攒钱"这个假说是**错的**（省下六条臂的代价）。
 *   而 §H-39/H-41 的真困难是：体质只在**产品口径**看得见（响应型 49 粒里 37 粒 ε=0 抓不到），
 *   要加一栏就得额外跑「1 席攒钱替身 + 4 席被评包 × 两档」⇒ 比现有门贵得多。
 * ⇒ 本工具回答：**能不能用门已经算的那几个数（镜像 ε=0 的设防率/输出密度/局长/蓄能）预测出体质？**
 *   能 ⇒ 这栏零成本；不能 ⇒ 必须单独装配，且必须跑产品口径。
 * 用法：node tools/screen-cheap-predict.mjs [--limit=80] [--every=2] [--games=60]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { build } from './probe-layer-caliber.mjs';
import { densityProfile, chargeProfile } from './audit-lib.mjs';

const arg = function (k, d) { const m = new RegExp('--' + k + '=([^ ]+)').exec(process.argv.join(' ')); return m ? m[1] : d; };
const EVERY = Number(arg('every', 2)), LIMIT = Number(arg('limit', 90)), GAMES = Number(arg('games', 60));
const SKIP = [];
/* 能与同夜筛表**按名字合并**的前提：跑的是同一批包 ⇒ `--packlist=文件`（每行一个 .bak）优先于抽样。 */
const LIST_FILE = arg('packlist', '');
let picked;
if (LIST_FILE) {
  picked = readFileSync(LIST_FILE, 'utf8').split(/\r?\n/).map(function (x) { return x.trim().replace(/^.*[/\\]/, '').replace(/\.bak$/, ''); })
    .filter(Boolean).map(function (x) { return x + '.bak'; });
} else {
  const all = readdirSync('docs/artifacts').filter(function (f) { return /\.bak$/.test(f); }).sort();
  picked = all.filter(function (f, i) { return i % EVERY === 0; }).slice(0, LIMIT);
}
console.log('# 用现有 ε=0 读数预测体质（' + picked.length + ' 粒候选 · 镜像 ' + GAMES + ' 局 · 只读）');
console.log('# 标签来自同夜的两口径筛（响应/恒定/干净）；本表**只算 ε=0 那一侧已有的量**\n');
const rows = [];
for (const f of picked) {
  const path = f.indexOf('/') >= 0 ? f : 'docs/artifacts/' + f;
  let head;
  try { head = readFileSync(path, 'utf8').slice(0, 4000); } catch (e) { if (!e || !e.code) throw e; SKIP.push(f); continue; }
  if (head.indexOf('window.EPIRUS_CHAMPION') < 0) { SKIP.push(f); continue; }
  const ctx = build({ on: false, pack: path });
  const W = ctx.sb, P = W.EpirusPolicy, T = W.EpirusTrainer;
  const params = P.unpack(ctx.sb.EPIRUS_CHAMPION_3P, true) || P.unpack(ctx.sb.EPIRUS_CHAMPION, true);
  if (!params) { SKIP.push(f + '（解不出参数）'); continue; }
  const dens = densityProfile(W, params, 'multi', GAMES);
  const chg = chargeProfile(W, params, 'multi', GAMES);
  rows.push({ pack: f.replace(/\.bak$/, ''), ji: dens.jiShare, dmgR: dens.dmgPerRound, atk: dens.atkShare,
    rounds: dens.roundsPerGame, charges: chg.chargesPerGame, waste: chg.wasteRate, zeroAtk: dens.zeroAtkRate });
}
console.log('# 下面这张表只印现有 ε=0 读数；与体质标签的对表由同夜的筛表在收工时合并（不在这个工具里重复实现标签）。');
rows.sort(function (a, b) { return b.ji - a.ji; });
console.log('   包'.padEnd(24) + '按ジ%'.padStart(8) + '伤害/回合'.padStart(11) + '出手伤害%'.padStart(11) + '局长'.padStart(7) + '蓄能/局'.padStart(9) + '珠浪费%'.padStart(9));
for (const r of rows) {
  console.log('   ' + r.pack.slice(0, 22).padEnd(23) + (100 * r.ji).toFixed(1).padStart(8) + (100 * r.dmgR).toFixed(0).padStart(11) +
    (100 * r.atk).toFixed(1).padStart(11) + r.rounds.toFixed(1).padStart(7) + r.charges.toFixed(2).padStart(9) + (100 * r.waste).toFixed(0).padStart(9));
}
if (SKIP.length) console.log('   ⚠️ 跳过 ' + SKIP.length + ' 粒：' + SKIP.slice(0, 6).join('、'));
