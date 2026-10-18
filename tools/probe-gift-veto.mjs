/* §E650 自证 · 选拔层"送盾 veto"那台纯函数（`tools/pick-best.mjs` 的 `rejectGiftSpamWinners`）
 * 为什么用可跑自证而不是门：用户规矩"不新增门（加一条要删一条）"⇒ 这条先在 `tools/gates/` 外面钉住，
 *   要不要挂一条腿（挂在 train-runner 的 `bandPickByLand` 夹具旁边）留给用户裁；要挂我就同时交一条该摘的。
 * 五条腿，全部喂**合成 entries**（不跑臂、不读盘 ⇒ 确定性、秒级）：
 *   ① 全员合格 ⇒ 不误伤：`dropped=0` ‖ `best` 就是分数最高那粒 ‖ `allRejected=false`
 *   ② 有一粒超线 ⇒ 剔它、`best` 换人、`droppedList` 报出 id 与读数
 *   ③ 全场超线 ⇒ `allRejected=true` 且 `best=null`（**不许**退回"不过滤"）
 *   ④ `gateOk` 缺（默认档从没测过）⇒ 放行但 `gateMissing` 必须报数 ⇒ "没测"与"测过且合格"不许同形
 *   ⑤ 阈值不在这儿：函数**只读 `gateOk`**，源码里不许出现那个数（6）⇒ 单源性由这条钉（本仓"两处各写一遍"老毛病）
 * ⚑ 每条都要能在被改坏时红：把 `e.gateOk !== false` 改成 `!== true` 会红在 ④；删掉 `allRejected` 会红在 ③。 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = process.env.WT || path.resolve(fileURLToPath(import.meta.url), '../..');
const { rejectGiftSpamWinners } = await import(pathToFileURL(ROOT + '/tools/pick-best.mjs').href);

let bad = 0;
const say = (c, m) => { console.log((c ? '  ✔ ' : '  ✘ ') + m); if (!c) bad++; };
const E = function (id, score, gateOk, gift) { const e = { ref: { id: id }, score: score }; if (gateOk !== undefined) e.gateOk = gateOk; if (gift !== undefined) e.giftPerGame = gift; return e; };

console.log('① 全员合格 ⇒ 不误伤');
const a = rejectGiftSpamWinners([E('hi', 0.90, true, 1.2), E('mid', 0.85, true, 0.4), E('lo', 0.50, true, 3.0)]);
say(a.dropped === 0 && a.best && a.best.ref.id === 'hi' && a.allRejected === false,
  'dropped=' + a.dropped + ' ‖ best=' + (a.best && a.best.ref.id) + ' ‖ allRejected=' + a.allRejected);
say(a.clean.length === 3, 'clean 还是 3 粒（' + a.clean.length + '）⇒ 合格的一粒都没被吃掉');

console.log('② 有一粒超线 ⇒ 剔它并换人');
const b = rejectGiftSpamWinners([E('spam', 0.95, false, 17.3), E('ok', 0.90, true, 1.2), E('ok2', 0.80, true, 0.5)]);
say(b.dropped === 1 && b.best && b.best.ref.id === 'ok', 'dropped=' + b.dropped + ' ‖ best 从 spam 换成 ' + (b.best && b.best.ref.id));
say(b.droppedList.length === 1 && b.droppedList[0].id === 'spam' && b.droppedList[0].gift === 17.3,
  '被剔那粒报得出读数：' + JSON.stringify(b.droppedList));
say(b.clean.every(function (e) { return e.gateOk !== false; }), 'clean 里不含 gateOk=false（' + b.clean.map(function (e) { return e.ref.id; }).join(' ‖ ') + '）');

console.log('③ 全场超线 ⇒ allRejected，不许退回"不过滤"');
const c = rejectGiftSpamWinners([E('s1', 0.95, false, 20.0), E('s2', 0.90, false, 12.0)]);
say(c.allRejected === true && c.best === null && c.dropped === 2, 'allRejected=' + c.allRejected + ' ‖ best=' + c.best + ' ‖ dropped=' + c.dropped
  + '（退回"不过滤"就是把 s1 塞回去，那正是这道闸要堵的东西）');

console.log('④ gateOk 缺（默认档从没测过）⇒ 放行但必须报数');
const d = rejectGiftSpamWinners([E('u1', 0.95), E('u2', 0.90)]);
say(d.dropped === 0 && d.best && d.best.ref.id === 'u1', '没测过的候选不被判死（best=' + (d.best && d.best.ref.id) + '）');
say(typeof d.gateMissing === 'number' && d.gateMissing === 2, 'gateMissing 报出 ' + (d.gateMissing === undefined ? '字段不存在（⛔ 那就是把"没测"读成"合格"还不留痕）' : d.gateMissing) + ' / 2');
const d2 = rejectGiftSpamWinners([E('m', 0.95), E('f', 0.90, false, 8.0), E('t', 0.85, true, 0.2)]);
say(d2.gateMissing === 1 && d2.dropped === 1, '混着给时两个计数各记各的：gateMissing=' + d2.gateMissing + ' ‖ dropped=' + d2.dropped);

console.log('⑤ 单源性：这函数里不许出现阈值那个数');
const { readFileSync } = await import('node:fs');
const t = readFileSync(ROOT + '/tools/pick-best.mjs', 'utf8');
const body = t.slice(t.indexOf('export function rejectGiftSpamWinners'), t.indexOf('export function rejectGiftSpamWinners') + 2200);
say(body.length > 100 && !/HOLO_GIFT_MAX\s*=\s*6/.test(body) && !/<=\s*6\b/.test(body),
  '函数体里不写 6（阈值判定在 train-3p 那侧，由 `audit-lib.HOLO_GIFT_MAX` 单源）⇒ 实测含 6 硬编码：' + (/<=\s*6\b/.test(body) ? '有（✘）' : '无'));
say(/gateOk/.test(body), '判定只吃 `gateOk`（' + (body.match(/gateOk/g) || []).length + ' 处）');

console.log(bad ? '\n⛔ 自证 ' + bad + ' 条不过 ⇒ 这条 veto 不许接进当选路径' : '\n✔ 五条腿全过（合成 entries，不跑臂）');
process.exit(bad ? 1 : 0);
