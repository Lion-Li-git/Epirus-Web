/* §E649 前置 · `gateOk` 那台量具的收敛性（不是散布！）——画阈值之前必须先知道 20 局的读数目不收敛
 * 为什么不能量"批间散布"：`js/train/evo.js:3355` 的局子是 `mulberry32(9000 + g)` **写死**的，
 *   `selfPlay`（`audit-lib.mjs:177`）也只是转发 ⇒ 重跑必然逐字同，"散布"这台尺在这台量具上不存在。
 *   ⇒ 能做的是**收敛性**：`games` 从 10/20/40/100 时读数怎么走。
 * ⚑ 但必须标清（这是 §E644 那条老教训的形状）：`games=40` 用的是 seed 9000..9039，**包含** `games=20` 那 20 粒当前缀
 *   ⇒ 这不是四个独立复本，是**同一批局的四个前缀**。所以这张表能回答"20 局够不够"，不能回答"两次抽签差多少"。
 * 为什么这件事挡在 veto 前面：在册警告 `train-3p.mjs:277` 说广度线共用的 20 局里只有 18 个决胜局、胜率类读数能摆 25~33pt。
 *   `holoOtherPerGame` 是计数不是胜率，散布可能小得多——**但那是我的猜想，不是数**。
 * 用法：node docs/research/archive/2026-10-18-night2-prior-caliber/calibrate-gateok-convergence.mjs
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { sandbox, loadChamp, rejectUnknownFlags } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
rejectUnknownFlags(process.argv.slice(2), ['prior'], 'calibrate-gateok-convergence');   /* 不认识的 `--` 一律 exit 64（D218 那条规矩在归档工具上同样成立） */
const W = sandbox(ROOT);
const T = W.EpirusTrainer;
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
/* 路径一律从 `coords.tsv` 的 `path` 列读（单一来源），只有它为空才退回猜——与 `eps-full.mjs`/`holoprobe.mjs` 同一条 §E597 纪律。
 *   第一版我手抄了 `e234-out/K2.js` 之类的路径 ⇒ 直接 ENOENT 崩在脚本里（不是"读不出"那一格，是整个工具挂掉）。 */
const CO = readFileSync(path.join(ROOT, 'champion-map/coords.tsv'), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
const CH = Object.fromEntries(CO[0].map((x, i) => [x.trim(), i]));
const PATH_OF = {};
for (const r of CO.slice(1)) { const id = r[CH.id]; if (!id) continue; PATH_OF[id] = (r[CH.path] || '').trim() || ('docs/artifacts/' + id + '.bak'); }
const IDS = [
  ['v7beadseed-82', '现役 hard，裸包 17.3 次/局'],
  ['v7expo-34', '115 次/局那枚极端'],
  ['v7teach-32', '81.4 次/局'],
  ['T8-s114', '现网冠军'],
  ['K2', '池成员，中低送盾'],
  ['def-31', '零送盾对照'],
  /* 这三个才是"能不能把线画在 20 局上"的关键样本：裸包读数正好落在 6 附近（6.15 / 6.50 / 6.85），
   *   两端那些（17.3 与 0.15）离线十万八千里，长度怎么变都不改判定 ⇒ 判定的成败只在灰带里。 */
  ['v7tgt2-52', '裸包 6.15，正好压线'],
  ['v7m2_noEffects-33', '裸包 6.50'],
  ['v16-135', '裸包 6.85'],
];
console.log('# holoOtherPerGame 的收敛性（同一批局的四个前缀，不是四个复本）‖ 阈值 HOLO_GIFT_MAX=6');
/* 判定的稳定性直接写进表里：**20 局与 100 局是不是给出同一个"过/不过"**——不一致的那一行就是要加局的那一行。 */
const lineVerdict = (v) => (v[1] <= 6 && v[3] > 6) ? '⛔ 20 局过线、100 局不过（判定随长度翻）'
  : (v[1] > 6 && v[3] <= 6) ? '⛔ 20 局不过、100 局过（判定随长度翻）'
    : (v[1] > 6 ? '两长度都不过' : '两长度都过');
console.log('包'.padEnd(44) + '   10局    20局    40局   100局   ‖ 20→100 相对变化 ‖ 与 6 的关系');
for (const [id, note] of IDS) {
  const rel0 = PATH_OF[id] || ('docs/artifacts/' + id + '.bak');
  const abs = path.join(ROOT, rel0);
  const nm = (id + '（' + note + '）');
  if (!existsSync(abs)) { console.log(nm.padEnd(44) + '   读不出（在册 path 掉盘：' + rel0 + '）'); continue; }
  let params = null;
  try { params = loadChamp(W, abs, ROOT); } catch (e) { console.log(nm.padEnd(44) + '   ⛔ loadChamp 抛：' + e.message.slice(0, 60)); continue; }
  if (!params) { console.log(nm.padEnd(44) + '   读不出（形状不认）'); continue; }
  const v = [10, 20, 40, 100].map(g => {
    const mh = T.mirrorHealth(params, g, 5, 'multi');
    return Number(mh && mh.holoOtherPerGame);
  });
  const rel = v[0] === 0 && v[3] === 0 ? '恒零' : ((v[3] - v[1]) / Math.max(0.01, Math.abs(v[1])) * 100).toFixed(0) + '%';
  console.log(nm.padEnd(44) + v.map(x => String(x.toFixed(2)).padStart(7)).join(' ') + '   ‖ ' + rel + ' ‖ ' + lineVerdict(v)
    + (v.some(x => !isFinite(x)) ? ' ‖ ⛔ 有格读不出' : ''));
}
console.log('\n判读要看的是"20 局与 100 局是否跨过头"（阈值 = 6）：同一枚包在 20 局读到 5.9、100 局读到 6.4，');
console.log('就意味着 veto 画在 6 会让它**取决于抽样长度**而不是行为本身——那这条线就不能这么画（要么加局、要么把线放到读数散布之外）。');

/* ===== 第二张表：把先验打开再量一遍（`--prior=2`）=====
 * 为什么要单独这一张：DS 今晚入库的依据是"开档后 82 的送盾 5.42/局 < 6 ⇒ 过线"。
 *   余量只有 10%，而上面那张表刚量到这台量具在 20→100 局之间会摆 14%（82 裸包 17.30 → 14.80）。
 *   ⇒ "过不过线"这一句目前**没有被判**，不是因为它错，是因为样本长度没定。这张表就是去判它。 */
const PRIOR = Number(arg('prior', 0));
if (PRIOR) {
  T.setSupportPrior(PRIOR);
  console.log('\n# 同一批包，**开档 ' + PRIOR + '** 之后的 holoOtherPerGame（knobs = ' + JSON.stringify(T.supportPriorKnobs()) + '）');
  console.log('包'.padEnd(44) + '   10局    20局    40局   100局   ‖ 与 6 那条线的关系');
  for (const [id, note] of IDS) {
    const rel0 = PATH_OF[id] || ('docs/artifacts/' + id + '.bak');
    const abs = path.join(ROOT, rel0);
    const nm = (id + '（' + note + '）');
    if (!existsSync(abs)) { console.log(nm.padEnd(44) + '   读不出'); continue; }
    let params = null; try { params = loadChamp(W, abs, ROOT); } catch (e) { console.log(nm.padEnd(44) + '   ⛔ ' + e.message.slice(0, 50)); continue; }
    if (!params) { console.log(nm.padEnd(44) + '   读不出（形状不认）'); continue; }
    const v = [10, 20, 40, 100].map(g => Number(T.mirrorHealth(params, g, 5, 'multi').holoOtherPerGame));
    const 跨线 = v[1] <= 6 && v[3] > 6 ? '⛔ **20 局过线、100 局不过**' : (v[1] > 6 && v[3] <= 6 ? '⚑ 20 局不过、100 局过' : (v[3] > 6 ? '两长度都不过' : '两长度都过'));
    console.log(nm.padEnd(44) + v.map(x => String(x.toFixed(2)).padStart(7)).join(' ') + '   ‖ ' + 跨线
      + ' ‖ 余量 ' + (100 * (6 - v[1]) / 6).toFixed(0) + '%(20局) / ' + (100 * (6 - v[3]) / 6).toFixed(0) + '%(100局)');
  }
  T.setSupportPrior(0);
}
