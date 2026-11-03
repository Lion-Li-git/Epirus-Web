/* 11-03 T1 自证 · 选拔层"族别签名分格取最稀格"那台纯函数（`tools/pick-best.mjs` 的 `gridPickByRarity`）
 * 为什么用可跑自证而不是门：用户规矩"可以加（门），但尽量少加"⇒ 先在 `tools/gates/` 外面钉住，
 *   要不要挂一条腿留给用户裁（挂的话我同时交一条该摘的）——与 `probe-gift-veto.mjs` 同一处置。
 * 七条腿，全部喂**合成 entries**（不跑臂、不读盘 ⇒ 确定性、秒级）：
 *   ① 全员同格 ⇒ 不误伤：`changedWinner=false` ‖ `best` 就是带内最高分
 *   ② 带内有一粒格更稀 ⇒ **换人**，并算出它值多少分（这根键必须"有牙"）
 *   ③ 带外不许因为"稀"爬进来（`tolPt` 是硬边界，与 `bandPickByFloor`/`bandPickByUsage` 同一把尺）
 *   ④ `gateOk === false` 的最稀也不许当选（v1.5.168 的教训：0.8pt 换到一粒给别人套 11.9 次盾的包）
 *   ⑤ 稀有度按**整池**数而不是只按带内数（rule ③ of the function doc）⇒ 这条能区分两种口径
 *   ⑥ 带内一粒不剩 ⇒ `best=null` ‖ `empty=true`（调用方必须响亮，**不许**静默退回"不过滤"）
 *   ⑦ 签名没接（`__sig` 缺且无 sigOf）⇒ 全员落"未测"这一格 ⇒ 按分选人且**明写**格无效；sigOf 每粒只调一次（缓存）
 * ⚑ 每条都要能在被改坏时红（11-03 实测，见 scratch/probe-sel-grid-mutation.txt）：
 *   把 `pop` 的统计域从整池改成带内 ⇒ 红在 ⑤；删掉 `gateOk !== false` 那道过滤 ⇒ 红在 ④；
 *   把 `ranked` 的比较改成只按分 ⇒ 红在 ②；把 `band` 的 `>=` 放宽成"全员" ⇒ 红在 ③ 与 ⑥。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../..');
const { rejectUnknownFlags } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
/* 仓规（门 D218）：研究量具必须响亮拒绝不认识的 `--` 参数。这台工具不吃任何旗标 ⇒ 名单是空数组。 */
rejectUnknownFlags(process.argv.slice(2), [], 'probe-sel-grid');
const { gridPickByRarity } = await import(pathToFileURL(ROOT + '/tools/pick-best.mjs').href);

let bad = 0;
const say = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) bad++; };
/* e = { 名字, 重验分, 格, gateOk? }；`__sig` 预置 ⇒ 不需要真量具（这台函数只管算术，量具在调用点） */
const E = function (id, score, cell, gateOk) {
  const e = { ref: { id: id }, score: score, __sig: cell };
  if (gateOk !== undefined) e.gateOk = gateOk;
  return e;
};
const id = (r) => (r && r.best && r.best.ref.id) || '(null)';

console.log('① 全员同格 ⇒ 不误伤');
const a = gridPickByRarity([E('hi', 0.90, 'D0K1'), E('mid', 0.885, 'D0K1'), E('lo', 0.50, 'D0K1')], 2, null);
say(a.best && a.best.ref.id === 'hi' && a.changedWinner === false,
  '同格 ⇒ 仍按分：best=' + id(a) + ' ‖ changedWinner=' + a.changedWinner);
say(a.band.length === 2 && a.cells.length === 1 && a.cells[0].count === 3,
  '带内 ' + a.band.length + ' 粒（0.90−0.02=' + (0.88).toFixed(3) + ' 线以下那粒被挡）‖ 整池那格 ' + a.cells[0].count + ' 粒');

console.log('② 带内有一粒格更稀 ⇒ 换人（这根键的牙）');
/* ⚑ 那个 0.40 的带外粒**必须和被挤下去的那粒同格**：稀有度按整池数（rule ③）⇒ 给它一个新格就会让
 *   "原当选"那格反而变成最稀（1 粒）→ 谁都不换。这条腿要的是"带内那格被自己人挤满"的形状。 */
const b = gridPickByRarity([E('crowded', 0.90, 'D0K0'), E('rare', 0.895, 'D2K3'), E('out', 0.40, 'D0K0')], 2, null);
say(b.best && b.best.ref.id === 'rare' && b.changedWinner === true,
  'best=' + id(b) + ' ‖ changedWinner=' + b.changedWinner + ' ‖ 付的分差 ' + ((0.90 - 0.895) * 100).toFixed(1) + 'pt');
say(b.pickedCell === 'D2K3' && b.pickedCount === 1 && b.byScore.ref.id === 'crowded',
  '取的是 ' + b.pickedCell + '（池里 ' + b.pickedCount + ' 粒）‖ 按分本来是 ' + b.byScore.ref.id + ' ⇒ 两者不同才叫改判');

console.log('③ 带外不许因为"稀"爬进来');
const c = gridPickByRarity([E('incumbent', 0.90, 'D0K0'), E('farRare', 0.70, 'D3K3')], 2, null);
say(c.best && c.best.ref.id === 'incumbent' && c.band.length === 1,
  '0.70 那粒比带线（0.88）低 ⇒ 不参与：best=' + id(c) + ' ‖ 带内 ' + c.band.length + ' 粒');
say(c.cells.length === 2 && c.cells.every(function (x) { return x.count === 1; }),
  '两格各 1 粒（稀有度**算得出来**但不能越带取 ⇒ 说明"带"这道闸门独立于排序键）：' + JSON.stringify(c.cells));

console.log('④ gateOk=false 的最稀也不许当选');
const d = gridPickByRarity([E('ok', 0.90, 'D0K1'), E('spam', 0.895, 'D3K3', false)], 2, null);
say(d.best && d.best.ref.id === 'ok' && d.skipped === 1,
  '被剔 ' + d.skipped + ' 粒过硬门槛不过的 ⇒ best=' + id(d) + '（不是那粒最稀的 spam）');
const d2 = gridPickByRarity([E('spam2', 0.95, 'D3K3', false), E('ok2', 0.90, 'D0K0')], 2, null);
say(d2.skipped === 1 && d2.best.ref.id === 'ok2' && d2.pickedCount === 1,
  'spam 分最高也进不了带（top 从**闸后**算）：best=' + id(d2) + ' ‖ pickedCount=' + d2.pickedCount);

console.log('⑤ 稀有度按整池数（不是只按带内）');
/* A/B 都在带内且**各占一格**、A 分高 ⇒ 只数带内必然平手 → 按分选 A；
 * 但 X 格在带外还有 C/D 两粒 ⇒ 整池数就是 X=3 / Y=1 → 选 B。这一条就是两种口径的分水岭。 */
const e5 = gridPickByRarity([E('A', 0.90, 'X'), E('B', 0.885, 'Y'), E('C', 0.50, 'X'), E('D', 0.45, 'X')], 2, null);
say(e5.best && e5.best.ref.id === 'B',
  'best=' + id(e5) + '（带内 X/Y 各 1 粒时按分该选 A ⇒ 选到 B 只可能是**整池**数出 X=3、Y=1）');
const xCount = (e5.cells.filter(function (x) { return x.cell === 'X'; })[0] || {}).count;
say(xCount === 3, 'X 格整池计数=' + xCount + '（带内只 1 粒）‖ Y=' + ((e5.cells.filter(function (x) { return x.cell === 'Y'; })[0] || {}).count));

console.log('⑥ 带内一粒不剩 ⇒ best=null 且 empty=true（调用方必须响亮）');
const f = gridPickByRarity([E('s1', 0.95, 'D3K3', false), E('s2', 0.90, 'D0K0', false)], 2, null);
say(f.best === null && f.empty === true && f.skipped === 2,
  'best=' + (f.best === null ? 'null' : '非 null（⛔ 静默退回不过滤）') + ' ‖ empty=' + f.empty + ' ‖ skipped=' + f.skipped);
const g = gridPickByRarity([], 2, null);
say(g.best === null && g.empty === false && g.band.length === 0,
  '空池 ⇒ best=null 但 empty=false（' + g.empty + '）：池本来就是空的与"全员被闸掉"不许同形');

console.log('⑦ 签名缺（量具没接）⇒ 落"未测"格，不许崩、也不许当成一格有效区分');
const h = gridPickByRarity([{ ref: { id: 'p' }, score: 0.90 }, { ref: { id: 'q' }, score: 0.88 }], 2, null);
say(h.best && h.best.ref.id === 'p' && h.pickedCell === '未测' && h.cells[0].count === 2,
  '无 `__sig` 无 sigOf ⇒ 全落 `' + h.pickedCell + '`（' + JSON.stringify(h.cells) + '）⇒ 按分选人、格不参与');
let sigCalls = 0;
/* 三粒、`sigOf` 现场算格（没有预置 `__sig`）：x 那格带外还有一个 z ⇒ 整池 x=2 / y=1 ⇒ 该换到 y。 */
const i5 = gridPickByRarity([E2('x', 0.90), E2('y', 0.895), E2('z', 0.40)], 2, function (e) { sigCalls++; return e.cell; });
function E2(id2, score) { return { ref: { id: id2 }, score: score, cell: (id2 === 'y' ? 'D1K2' : 'D0K0') }; }
say(i5.best && i5.best.ref.id === 'y' && sigCalls === 3,
  'sigOf 每粒只调一次（实测 ' + sigCalls + ' 次 / 3 粒 ⇒ 第二次读走 `__sig` 缓存）‖ 现场算出的稀格 D1K2 换人成功=' + id(i5) +
  ' ‖ pickedCount=' + i5.pickedCount);

console.log(bad ? '\n⛔ 自证 ' + bad + ' 条不过 ⇒ 这根排序键不许接进当选路径' : '\n✔ 七条腿全过（合成 entries，不跑臂）');
process.exit(bad ? 1 : 0);
