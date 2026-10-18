/* §E650 分析器 · 送盾 veto 的六臂预注册判定（判据写在 `PREREG-2026-10-19-gift-veto-qoder.md`，**看完数据不改线**）
 * 输入：`gift-veto-arms.log.txt`（每臂一行 `ARM gv{0,1}-<seed> rc=… ‖ [送盾闸]… ‖ 产物: …`）+ 每臂完整日志 + `arms/` 里的 band 产物
 * 做三件事：
 *   ① 从每臂日志里取"当选那粒"的产物路径（落盘行），量它的**裸包**送盾 @20 局与 @100 局（§E649：判定随长度翻 ⇒ 两个长度都要报）
 *   ② 非劣性：把两臂产物的 `1st`（`eval-5p` 200 局，同 seed）成对比较 —— 这一步**不在这里跑**（那是另一次批量），本文件只把 ① 与日志里的数并排印出来
 *   ③ 判据逐条给"过 / 不过 / 读不出"，缺一格就写"读不出"，不许拿别的臂顶
 * 用法：node analyze-gift-arms.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const { sandbox, loadChamp } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
const W = sandbox(ROOT); const T = W.EpirusTrainer;
const LOGF = path.join(HERE, 'gift-veto-arms.log.txt');
if (!existsSync(LOGF)) { console.error('⛔ 还没有臂批日志 ⇒ 读不出（别写"没影响"）'); process.exit(2); }
const lines = readFileSync(LOGF, 'utf8').replace(/\r\n/g, '\n').split('\n').filter(l => l.indexOf('ARM ') === 0);
if (!lines.length) { console.error('⛔ 日志里没有 ARM 行 ⇒ 这批没跑成'); process.exit(2); }
T.setSupportPrior(0);   // 全部按**裸包**量：这一节问的是"包自己送不送盾"，不是"开档后剩多少"
const giftOf = function (abs, games) {
  const p = loadChamp(W, abs, ROOT);
  if (!p) return null;
  const mh = T.mirrorHealth(p, games, 5, 'multi');
  const v = Number(mh && mh.holoOtherPerGame);
  return isFinite(v) ? v : null;
};
/* 产物指认：臂日志的落盘行给的是 `docs/artifacts/<arm>-bandN.bak` 或 `train-3p-out.js` ⇒ 优先取带臂名的那个 */
function winnerOf(arm) {
  const f = path.join(HERE, 'gift-veto-' + arm + '.log.txt');
  if (!existsSync(f)) return { arm: arm, missing: '日志缺失' };
  const s = readFileSync(f, 'utf8');
  /* 首选驱动趁落盘还没被下一臂覆写时收走的那份拷贝（`arms/gv0-77000.winner.js`）；
   *   找不到才退回按日志文本猜路径 —— 猜来的东西必须说明是猜的。 */
  const copy = path.join(HERE, 'arms', arm + '.winner.js');
  let prod = existsSync(copy) ? copy : null, how = '拷贝自落盘时刻';
  if (!prod) {
    const m = s.match(/已在 `?(docs\/artifacts\/[^\s`]+\.bak)/) || s.match(/已写入 (\S+\.js)/);
    const band = m ? m[1] : null;
    prod = band && existsSync(path.join(ROOT, band)) ? path.join(ROOT, band) : null;
    how = '按日志文本指认';
  }
  const gate = (s.match(/^\[送盾闸\].*$/m) || [null])[0];
  const allSpam = /名人堂\*\*全部超线\*\*/.test(s);
  const first = (s.match(/^1st=([\d.]+)%/m) || [])[1];
  return { arm: arm, prod: prod, how: how, gate: gate, allSpam: allSpam,
    missing: (prod ? '' : '产物找不到 ‖ ') + (first === undefined ? '末局 1st 没读到' : '') };
}
const rows = [];
for (const l of lines) {
  const m = /^ARM gv([01])-(\d+) rc=(\d+)/.exec(l);
  if (!m) { console.error('⛔ ARM 行解析不了：' + l); process.exit(3); }
  const veto = m[1], seed = m[2], arm = veto + '-' + seed;
  const w = winnerOf('gv' + arm);
  let g20 = null, g100 = null;
  if (w.prod) { g20 = giftOf(w.prod, 20); g100 = giftOf(w.prod, 100); }
  rows.push({ veto: veto, seed: seed, rc: m[3], prod: w.prod, allSpam: w.allSpam, gate: w.gate, g20: g20, g100: g100, missing: w.missing });
}
console.log('# §E650 六臂收口（裸包送盾 = `mirrorHealth(multi)` @20/@100 局 ‖ 线 = `HOLO_GIFT_MAX` = 6）');
console.log('臂'.padEnd(14) + 'seed'.padEnd(8) + 'veto'.padEnd(6) + '@20局'.padEnd(9) + '@100局'.padEnd(9) + 'allRejected'.padEnd(12) + '备注');
for (const r of rows) {
  console.log(('gv' + r.veto).padEnd(14) + r.seed.padEnd(8) + r.veto.padEnd(6)
    + (r.g20 === null ? '读不出' : r.g20.toFixed(2)).padEnd(9)
    + (r.g100 === null ? '读不出' : r.g100.toFixed(2)).padEnd(9)
    + (r.allSpam ? '⛔ 全超线' : '否').padEnd(12)
    + (r.missing || '') + (r.prod ? ' ‖ 产物 ' + path.basename(r.prod) + '（' + r.how + '）' : ''));
}
const off = rows.filter(r => r.veto === '0'), on = rows.filter(r => r.veto === '1');
const med = a => { const v = a.filter(x => x !== null).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
console.log('\n## 预注册 §三 的逐条判读');
console.log('  主判据（开档 ≤6 且 关档 >6，@100 局）：开档中位 ' + (med(on.map(r => r.g100)) === null ? '读不出' : med(on.map(r => r.g100)).toFixed(2))
  + ' ‖ 关档中位 ' + (med(off.map(r => r.g100)) === null ? '读不出' : med(off.map(r => r.g100)).toFixed(2)));
const nSpam = on.filter(r => r.allSpam).length;
console.log('  §三.5 全被挡那一格：开档臂里 ' + nSpam + '/' + on.length + ' 臂出现 allRejected'
  + (nSpam ? ' ⇒ 按预注册记"这条线在该谱系上剪不出合格当选者"，**不许**读成"veto 无效"，也不许读成"包学会了少送"' : ''));
console.log('  非劣性（强度）：**本工具不判**——需要 `eval-5p` 同 seed 配对，跑法与判线写在 PREREG §二/§三.2，跑完补进 §E650 正文');
console.log('\n⚑ 主语：veto 剪的是"谁当选"，产物送盾下降 = **选拔面换了人**，不是"包学会了少送盾"（用户 10-17 的主语规矩）。');
