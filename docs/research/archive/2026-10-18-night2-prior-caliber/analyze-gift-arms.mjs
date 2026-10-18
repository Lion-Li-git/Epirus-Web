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
const { sandbox, loadChamp, rejectUnknownFlags } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
rejectUnknownFlags(process.argv.slice(2), [], 'analyze-gift-arms');   /* 这台不吃旗标 ⇒ 空名单 = 任何 `--x=` 都该 exit 64 */
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
/* 产物指认：**权威来源是臂自己日志里 `[band-save] …（当选）` 那行**，不是 `train-3p-out.js`。
 *   为什么改（01:32 实测踩到）：当选者与上一臂的**带内某一粒**权重相同时，§E589 守卫判"这粒已在盘上"⇒
 *   **不写产物、退出码 9**，`train-3p-out.js` 里躺着的还是**上一臂**的东西；驱动照抄 ⇒ 把 gv0 的冠军登记成 gv1 的。
 *   band-save 在守卫之前就跑完了、写的是 `docs/artifacts/gv-<臂>/<臂>-bandN.bak`，带臂名 ⇒ 这才是这一臂的当选者。
 *   拷贝（`arms/<臂>.winner.js`）只在**它自己的 `META.arm` 等于这一臂**时才可用作"落盘时刻"的证据；不相等就当场点名失配。 */
function winnerOf(arm) {
  const f = path.join(HERE, 'gift-veto-' + arm + '.log.txt');
  if (!existsSync(f)) return { arm: arm, missing: '日志缺失' };
  const s = readFileSync(f, 'utf8');
  const bandSel = [...s.matchAll(/^\[band-save\] (\S+?-band\d+)\.bak\s+trainFit=[\d.]+（当选）/gm)].map(x => x[1]);
  /* 权威 band 文件的**归档拷贝**优先（`arms/gv-<臂>--<臂>-bandN.bak`，驱动收尾收的），
   *   再看 `docs/artifacts/` 里那一版；两个都找不到才报"找不到"。
   *   为什么以归档为准：批收尾会把 `pack-aliases.tsv` 里本批追加的登记行还原 ⇒ 池里那些 band 就成了"未登记的重复"，
   *   门 D191④ 会红（实测 unregistered 从 0 跳到 19）⇒ 收尾必须把 `gv-*` 移出共享产物池，那时只有 arms/ 这份还在。 */
  const archived = bandSel.length ? path.join(HERE, 'arms', 'gv-' + arm + '--' + bandSel[0] + '.bak') : null;
  const live = bandSel.length ? path.join(ROOT, 'docs/artifacts/gv-' + arm, bandSel[0] + '.bak') : null;
  const bandPath = archived && existsSync(archived) ? archived : (live && existsSync(live) ? live : null);
  const copy = path.join(HERE, 'arms', arm + '.winner.js');
  let prod = null, how = '';
  if (existsSync(copy)) {
    const metaArm = (readFileSync(copy, 'utf8').match(/"arm":"([^"]*)"/) || [])[1];
    if (metaArm === arm) { prod = copy; how = '拷贝自落盘时刻（META arm 相符）'; }
    else { how = '⚑ 拷贝失配：arms/' + arm + '.winner.js 的 META arm=' + (metaArm || '无') + ' ⇒ 不用它，改用当选 band'; }
  }
  if (!prod && bandPath) { prod = bandPath; how = how ? (how + ' ‖ 当选 band 用归档拷贝') : '按 `[band-save] …（当选）` 行指认（归档拷贝）'; }
  if (!prod && bandSel.length) how += ' ‖ 当选 band 文件找不到：' + archived + ' 与 ' + live;
  const gate = (s.match(/^\[送盾闸\].*$/m) || [null])[0];
  const allSpam = /名人堂\*\*全部超线\*\*/.test(s);
  const first = (s.match(/^1st=([\d.]+)%/m) || [])[1];
  return { arm: arm, prod: prod, how: how, gate: gate, allSpam: allSpam, bandSel: bandSel,
    missing: (prod ? '' : '产物找不到 ‖ ') + (first === undefined ? '末局 1st 没读到' : '')
      + (bandSel.length > 1 ? ' ‖ ⚑ 日志里 ' + bandSel.length + ' 个"（当选）"（名人堂装了同一粒权重两次 ⇒ 取第一个，要人工确认）' : '') };
}
const rows = [];
for (const l of lines) {
  const m = /^ARM gv([01])-(\d+) rc=(\d+)/.exec(l);
  if (!m) { console.error('⛔ ARM 行解析不了：' + l); process.exit(3); }
  const veto = m[1], seed = m[2], arm = veto + '-' + seed;
  const w = winnerOf('gv' + arm);
  let g20 = null, g100 = null;
  if (w.prod) { g20 = giftOf(w.prod, 20); g100 = giftOf(w.prod, 100); }
  rows.push({ veto: veto, seed: seed, rc: m[3], prod: w.prod, how: w.how, allSpam: w.allSpam, gate: w.gate, g20: g20, g100: g100, missing: w.missing });
}
console.log('# §E650 六臂收口（裸包送盾 = `mirrorHealth(multi)` @20/@100 局 ‖ 线 = `HOLO_GIFT_MAX` = 6）');
console.log('臂'.padEnd(14) + 'seed'.padEnd(8) + 'veto'.padEnd(6) + 'rc'.padEnd(5) + '@20局'.padEnd(9) + '@100局'.padEnd(9) + 'allRejected'.padEnd(12) + '备注');
for (const r of rows) {
  console.log(('gv' + r.veto).padEnd(14) + r.seed.padEnd(8) + r.veto.padEnd(6) + r.rc.padEnd(5)
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
