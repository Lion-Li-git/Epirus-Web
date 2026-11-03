/* §E662 · veto 到底动得动：每格"同梯子里有几席是干净的"，并用**同一个纯函数**预测换谁，再拿真开档臂对答案
 * 为什么要这一台：§E661 把假设收窄成"脏的是那条梯子整体"，§E650 八/九 量到 veto 的覆盖面只有 **3/18 格**——
 *   两句之间缺的就是这一格：**当选位超线的时候，它自己那条梯子里到底有没有干净席可换**（没有 ⇒ 闸只能 allRejected，
 *   有 ⇒ 才真的"换一粒"）。这格决定 待裁 #1（要不要付那 −5.65pt）值不值。
 * ⚑ 不自己发明判据：预测用**产品那台纯函数** `tools/pick-best.mjs` 的 `rejectGiftSpamWinners`（与门、与训练侧同一个源），
 *   喂进去的 `score` = 臂日志里那一席的 `trainFit` ‖ `gateOk` = 裸包送盾 ≤ 线 ‖ `giftPerGame` = 同一个读数。
 * ⚑ 自证有**两条问题**（第一版把它们混成一条，于是 10 格"不一致"其实讲的是另一件事）：
 *   T1 两臂的梯子是不是同一批（开档臂当选那粒的权重 ∈ 关档臂六席？这钉的是 §E650 四.1 那句"共享梯子"）；
 *   T2 **只在 veto 有动作点的格上**问"预测换到的那粒 = 真开档臂当选的那粒？"——没动作点的格不许问这条（两臂各自的带内次序与一堆 0.00 的平局，本来就不保证同一席号/同一粒）。
 * 用法：node docs/research/archive/2026-10-18-night2-prior-caliber/ladder-clean-seats.mjs
 * 只读：读 `arms/` 与臂日志，不写盘、不跑训练。
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const { sandbox, loadChamp, rejectUnknownFlags, HOLO_GIFT_MAX } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const { rejectGiftSpamWinners } = await import(pathToFileURL(ROOT + '/tools/pick-best.mjs').href);
rejectUnknownFlags(process.argv.slice(2), [], 'ladder-clean-seats');
const A = path.join(HERE, 'arms');
const W = sandbox(ROOT); const T = W.EpirusTrainer;
T.setSupportPrior(0);   // 与 §E650/§E661 同档：裸包
const gift = p => { const a = loadChamp(W, p, ROOT); if (!a) return null;
  const mh = T.mirrorHealth(a, 100, 5, 'multi'); const v = Number(mh && mh.holoOtherPerGame); return isFinite(v) ? v : null; };
/* 权重本体指纹（与 §E650 七 那台 `gift-ladder-dist.mjs` 同一把：配对臂要按"是不是同一粒"对，不能按编号对） */
const wid = p => { const a = loadChamp(W, p, ROOT); return a ? createHash('sha1').update(JSON.stringify(a.a || a)).digest('hex').slice(0, 8) : null; };
const bandOf = (txt, arm) => ((txt.match(new RegExp('^\\[band-save\\] (' + arm + '-band\\d+)\\.bak\\s+trainFit=[\\d.]+（当选）', 'm')) || [])[1]) || null;
const seatsOf = (txt, arm) => { const out = []; const re = new RegExp('^\\[band-save\\] (' + arm + '-band(\\d))\\.bak\\s+trainFit=([\\d.]+)', 'gm');
  let m; while ((m = re.exec(txt))) out.push({ seat: +m[2], fit: +m[3] }); return out; };

const LINES = [['gv', 'v7beadseed-82'], ['tw', 'v7teach-32'], ['ex', 'v7expo-34'], ['wa', 'v7wall-33'], ['b3', 'v7beadseed-31'], ['b9', 'v7beadseed-93']];
console.log('线值 HOLO_GIFT_MAX=' + HOLO_GIFT_MAX + '（单源 `audit-lib`，与 promote 同源）‖ 每格 = 谱系 × seed，关档臂的六席');
const rows = [];
let mismatch = 0;
for (const [pfx, name] of LINES) {
  console.log('\n## ' + name);
  for (const s of [77000, 77001, 77002]) {
    const offLg = path.join(HERE, 'gift-veto-' + pfx + '0-' + s + '.log.txt');
    if (!existsSync(offLg)) { console.log('  seed ' + s + '：关档臂日志不在 ⇒ 读不出'); continue; }
    const txt = readFileSync(offLg, 'utf8');
    const winBand = bandOf(txt, pfx + '0-' + s);
    const entries = []; const widBySeat = {};
    for (const st of seatsOf(txt, pfx + '0-' + s)) {
      const f = path.join(A, pfx + '-' + pfx + '0-' + s + '--' + pfx + '0-' + s + '-band' + st.seat + '.bak');
      const fl = path.join(ROOT, 'docs/artifacts', pfx + '-' + pfx + '0-' + s, pfx + '0-' + s + '-band' + st.seat + '.bak');
      const p = existsSync(f) ? f : (existsSync(fl) ? fl : null);
      if (!p) continue;
      const g = gift(p); if (g === null) continue;
      widBySeat[st.seat] = wid(p);
      entries.push({ ref: { id: 'band' + st.seat }, score: st.fit, gateOk: g <= HOLO_GIFT_MAX, giftPerGame: g, seat: st.seat });
    }
    if (!winBand || entries.length < 2) { console.log('  seed ' + s + '：读不出当选行或席位不足 ⇒ 这一格不参与'); continue; }
    const offWinner = entries.find(e => winBand.indexOf('band' + e.seat) >= 0) || null;
    if (!offWinner) { console.log('  seed ' + s + '：当选那席不在六席读数里 ⇒ 记账读不出（不许猜）'); continue; }
    const clean = entries.filter(e => e.gateOk).length;
    const pred = rejectGiftSpamWinners(entries);
    const over = !offWinner.gateOk;
    /* 自证拆成**两条不同的问题**（第一版把它们混成一条 ⇒ 10 格"不一致"其实是第二条在说话）：
     *   T1 **梯子是不是同一批**：开档臂当选那粒的权重，在不在关档臂六席的权重集合里（这才是 §E650 四.1 那句"配对两臂共享同一条梯子"）；
     *   T2 **预测对不对**：**只在"veto 有动作点"的格上问**（当选位超线 ⇒ 会换）⇒ 预测换到的那粒 = 真开档臂当选的那粒？
     *   没动作点的格**不许问 T2**：那里 veto 不该换人，而两臂各自的带内次序/大量 0.00 的平局本来就不保证"同一席号"。 */
    const onLg = path.join(HERE, 'gift-veto-' + pfx + '1-' + s + '.log.txt');
    const ladderWids = new Set(Object.values(widBySeat));
    let onGift = null, inLadder = '未对答案', t2 = '（本格无动作点 ⇒ 不问 T2）';
    if (existsSync(onLg)) {
      const onBand = bandOf(readFileSync(onLg, 'utf8'), pfx + '1-' + s);
      const onFile = onBand && [path.join(A, pfx + '-' + pfx + '1-' + s + '--' + onBand + '.bak'),
        path.join(ROOT, 'docs/artifacts', pfx + '-' + pfx + '1-' + s, onBand + '.bak')].find(x => existsSync(x));
      if (!onFile) inLadder = '开档臂产物不在盘上';
      else {
        const oh = wid(onFile); onGift = gift(onFile);
        inLadder = ladderWids.has(oh) ? '✔ 在关档六席的权重集合里' : '⚠ **不在** ⇒ §E650 四.1 那句"共享梯子"在这一格不成立';
        if (over) t2 = (pred.best && widBySeat[pred.best.seat] === oh)
          ? '✔ T2：预测换到的那粒 = 真开档臂当选（同一粒权重，送盾 ' + onGift.toFixed(2) + '）'
          : '⚠ T2：预测与真开档臂不是同一粒 ⇒ 判据接错，先别引用本节';
        if (t2.indexOf('⚠') === 0) mismatch++;
      }
    }
    console.log('  seed ' + s + ' ‖ 六席里干净席 = **' + clean + '/' + entries.length + '** ‖ 关档当选 ' + offWinner.ref.id +
      ' 送盾 ' + offWinner.giftPerGame.toFixed(2) + (over ? '（**超线**）' : '（本来就合格）') +
      (over && pred.best && pred.best.ref.id !== offWinner.ref.id
        ? ' ⇒ veto 会换成 ' + pred.best.ref.id + '（送盾 ' + pred.best.giftPerGame.toFixed(2) + ' ‖ trainFit ' +
          pred.best.score.toFixed(3) + ' vs 原 ' + offWinner.score.toFixed(3) + ' ⇒ **让分 ' + (offWinner.score - pred.best.score).toFixed(3) + '）'
        : over && pred.allRejected ? ' ⇒ 全场超线 ⇒ allRejected（换不了）'
        : ' ⇒ veto 在这格**没有动作点**'));
    console.log('        └ T1 梯子同源：' + inLadder + (onGift === null ? '' : ' ‖ 真开档臂当选送盾 ' + onGift.toFixed(2)) +
      (t2.indexOf('（') === 0 ? '' : ' ‖ ' + t2));
    rows.push({ pfx: pfx, seed: s, clean: clean, n: entries.length, over: over, act: t2.indexOf('✔') === 0 ? 1 : (t2.indexOf('⚠') === 0 ? 0 : null),
      t1: inLadder.indexOf('✔') === 0 ? 1 : (inLadder.indexOf('⚠') === 0 ? 0 : null) });
  }
}
if (rows.length) {
  const over = rows.filter(r => r.over);
  const movable = over.filter(r => r.clean > 0);
  console.log('\n汇总：' + rows.length + ' 格 ‖ 当选位超线的 = **' + over.length + '** ‖ 其中"自家梯子里有干净席"（veto 真有动作点）= **' +
    movable.length + '** ‖ 超线但**整条梯子都不干净**（veto 只能 allRejected）= ' + (over.length - movable.length) + ' 格');
  console.log('  干净席数的分布：' + rows.map(r => r.clean).sort((a, b) => a - b).join(' '));
  console.log('  ⚑ 与 §E650 八/九 那句"覆盖面 3/18 格"对不对得上：这里"当选位超线"= ' + over.length + ' 格 ⇒ 若不等，**别改任一边的说法**，' +
    '先查是去重档不同（§E650 按权重本体去重、本台按一梯子的席逐格数）还是线值/长度档不同。');
  console.log('  ⚑ T1（两臂梯子同源）：成 ' + rows.filter(r => r.t1 === 1).length + ' 格 ‖ **不成 ' + rows.filter(r => r.t1 === 0).length +
    '** ‖ 无从判 ' + rows.filter(r => r.t1 === null).length + ' 格（开档臂日志/产物不在）' +
    (rows.some(r => r.t1 === 0) ? ' ⇒ **§E650 四.1 那句"配对两臂共享同一条梯子"不是全称**，引用它要带格数' : ''));
  console.log('  ⚑ T2（veto 有动作点的格 ⇒ 预测对不对）：问 ' + rows.filter(r => r.act !== null).length + ' 格 ‖ ✔ ' +
    rows.filter(r => r.act === 1).length + ' ‖ ⚠ ' + mismatch + (mismatch ? ' ⇒ 先把这几格读完再引用本节任何数' : '（0 ⇒ 判据与产品同源）'));
}
