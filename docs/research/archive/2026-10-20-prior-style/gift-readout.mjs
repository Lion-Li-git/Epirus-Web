/* §E675 送盾读数（千问 10-20 夜）—— 用 audit-lib 这份**单一实现**逐包量"施放/给别人"，
 *   不抄第二份算法（`champ-audit` 与 `promote-champion` 用的就是同一份，见 `tools/audit-lib.mjs` 顶部口径）。
 *
 * 为什么要单独跑这一支：`champ-audit` 印的 C 盾/局 是 `holoPerGame`（**施放总数**，5 座同一冠军），
 *   而产品那条硬门槛判的是 `holoOtherPerGame`（**套给别人**，DS 10-20 重定成 1.5/席 ⇒ 5 席 7.5）。
 *   今晚这个题正好卡在这两件事的差上：训练时开先验，学到的是"少给别人"还是"干脆不放"？
 *
 * 口径：`selfPlay(W, params, --mode, --games)`，默认 games=20 = 与 `promote-champion` 逐字同（那条线就是在 20 局上定的）。
 *   每枚包量两遍：**关档**（引擎默认 0）与**开档 2**（产品档）⇒ 同一枚包在两档下的给别人量，就是 holo.tsv 里那两列的形状。
 * 用法：node docs/research/archive/2026-10-20-prior-style/gift-readout.mjs [--games=20] [--mode=multi] [--out=<tsv>]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, selfPlay, HOLO_GIFT_MAX, HOLO_GIFT_PER_SEAT } from '../../../../tools/audit-lib.mjs';
import { widOf } from '../../../../champion-map/pack-id.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const GAMES = Number(arg('games', 20));
const MODE = arg('mode', 'multi');
const OUT = arg('out', join(HERE, 'gift-readout-' + MODE + '-g' + GAMES + '.tsv'));
const PACKS = process.argv.slice(2).filter(a => !/^--/.test(a));
if (!PACKS.length) { console.error('⛔ 至少要给一枚包'); process.exit(2); }

const W = sandbox(ROOT);
const T = W.EpirusTrainer;
if (typeof T.setSupportPrior !== 'function' || typeof T.supportPriorOn !== 'function') {
  console.error('⛔ 引擎没导出 setSupportPrior/supportPriorOn ⇒ 这台量具的前提没了（不许静默当 0 跑）'); process.exit(3);
}
const rows = [['pack', 'wid', 'trainedPrior', '放/局@关', '给别人/局@关', '给别人/局@开2', '给别人@开2占放的比例',
  '过7.5线@关(=挡)', '过7.5线@开2'].join('\t')];

const readOne = (file, prior) => {
  T.setSupportPrior(prior);
  if (Number(T.supportPriorOn()) !== prior) { console.error('⛔ 先验=' + prior + ' 没读回'); process.exit(3); }
  const params = loadChamp(W, file);
  const sp = selfPlay(W, params, MODE, GAMES);
  return { holo: sp.holoPerGame, other: sp.holoOtherPerGame };
};

for (const f of PACKS) {
  const file = f.startsWith('docs/') ? join(ROOT, f) : f;
  if (!existsSync(file)) { console.log('✗ 文件不存在，跳过并响亮：' + f); rows.push([f, '缺文件'].join('\t')); continue; }
  const off = readOne(file, 0), on = readOne(file, 2);
  const share = off.holo > 0 ? (on.other / off.holo) : null;
  rows.push([f.replace(/^docs\/artifacts\//, ''), widOf(readFileSync(file, 'utf8')),
    /-p2[-.]/.test(f) ? '2(训练时开)' : /-p0[-.]/.test(f) ? '0(训练时关)' : '起点包',
    off.holo.toFixed(1), off.other.toFixed(2), on.other.toFixed(2),
    share === null ? '' : share.toFixed(3),
    off.other > HOLO_GIFT_MAX ? '**挡**' : '过', on.other > HOLO_GIFT_MAX ? '**挡**' : '过'].join('\t'));
  console.log('量完 ' + f + ' 放' + off.holo.toFixed(1) + ' 给别人@关' + off.other.toFixed(2) + ' @开2' + on.other.toFixed(2));
}
rows.push('# 口径 selfPlay(mode=' + MODE + ', games=' + GAMES + ') ‖ 线 = HOLO_GIFT_MAX = ' + HOLO_GIFT_MAX + '（' + HOLO_GIFT_PER_SEAT + '/席 × 5，DS 10-20 重定）');
writeFileSync(OUT, rows.join('\r\n') + '\r\n', 'utf8');
console.log('写 ' + OUT);
