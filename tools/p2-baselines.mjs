/* Epirus 2P 基准对手表（19 个）—— Node 工具的**单一来源**（v1.5.18）。
 *
 * 为什么抽出来（第三方复核 §5-1）：2P 冠军的"考卷"就是"对这张表的实测胜率"（见 `tools/train-best.mjs`
 * 的 `evalChamp`），而这张表此前在 Node 侧被抄了不止一遍 —— 与"对手池两处各写一遍"是同一类事故
 * （已栽过三次：v1.3.59 只补 worker、v1.4.8 只补 server、v1.4.14 漏 opp-pool 本身）。
 * 现在 `tools/train-best.mjs` 与 `tools/promote-champion2p.mjs` 共用这一份。
 *
 * ⚠️ **顺序是行为输入**：`evalChamp` 的种子是 `20260207 + i * 977`（i = 本表的下标），
 * 所以**插/删/重排一个名字都会改变每个对手的种子**，从而改变"构建时考卷分"这个历史数字。
 * 要动顺序就必须重跑 `tools/promote-champion2p.mjs` 重记成绩（`np-test D16` 会跟着红）。
 *
 * ⚠️ 边界（免得下一个人以为全库只剩一份）：浏览器侧跑在 vm 沙箱里、不能 `import`，
 * 它们各有自己的名单 —— `js/train/evo.js` 的 `BOT_PICKS`（带权重的训练池）、
 * `js/train/trainer.js:67-68`（页面训练场的基准）、`server/train-server.mjs:101-102`（多人训练池，
 * 是另一套概念：18 个名字、无 `protomine/prototransfer/tankline`）。本文件只管辖 Node 侧的**2P 考卷**。
 */
export const P2_FNAME = {
  random: 'pickRandom', aggro: 'pickAggro', defend: 'pickDefend', balanced: 'pickBalanced',
  breakdef: 'pickBreakDef', wall: 'pickWall', reflectspam: 'pickReflectSpam', guardspam: 'pickGuardSpam',
  baguaspam: 'pickBaguaSpam', combocounter: 'pickComboCounter', mix: 'pickMix', tankline: 'pickTankLine',
  heavyfire: 'pickHeavyFire', guardgun: 'pickGuardGun', protowall: 'pickProtoWall', whiff: 'pickWhiff',
  reflectmix: 'pickReflectMix', reflecttank: 'pickReflectTank', defreflectgun: 'pickDefReflectGun'
};
/* 键序 = 基准顺序（`Object.keys` 按插入序）—— 见上面"顺序是行为输入"。 */
export const P2_NAMES = Object.keys(P2_FNAME);
