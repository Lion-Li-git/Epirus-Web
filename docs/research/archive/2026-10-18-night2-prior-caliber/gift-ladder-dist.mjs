/* §E650 七 · 把"训练把送盾推向哪里"从**一个当选者**升成**一条分布**（不新跑任何臂）
 * 为什么这台值得存在：§E650 六那句"teach 谱系自己练没了、82 谱系练高了"的分母只有**每支 3 个当选者**，n=3 说不了形状。
 *   而臂批已经把每臂的**带内六席**都落进 `arms/gv-*--*-bandN.bak` ‖ `arms/tw-*--*bandN.bak` ⇒ 同一批数据里就躺着候选分布。
 * ⚑ 两个必须处理对的点：
 *   ① **配对两臂共享同一条梯子**（§E650 四.1 实测 6/6 逐位同）⇒ 按**权重本体 sha8 去重**，不然每个候选被数两次（把 n=18 报成 n=36 = 自己给自己加样本）；
 *   ② 主长度用 **@100 局**（§E649：贴着线的包 20 局会翻判定），@20 只作对照印出来。
 * 用法：node docs/research/archive/2026-10-18-night2-prior-caliber/gift-ladder-dist.mjs
 */
import { readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../../..');
const { sandbox, loadChamp, rejectUnknownFlags, HOLO_GIFT_MAX } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);
rejectUnknownFlags(process.argv.slice(2), [], 'gift-ladder-dist');   /* 不吃旗标 ⇒ 任何 `--x=` 都该 exit 64 */
const A = path.join(HERE, 'arms');
if (!existsSync(A)) { console.error('⛔ 没有 arms/ ⇒ 读不出'); process.exit(2); }
const W = sandbox(ROOT); const T = W.EpirusTrainer;
T.setSupportPrior(0);   // 全部按**裸包**量
const wid = p => { const a = loadChamp(W, p, ROOT); return a ? createHash('sha1').update(JSON.stringify(a.a || a)).digest('hex').slice(0, 8) : null; };
const gift = (p, g) => { const a = loadChamp(W, p, ROOT); if (!a) return null; const mh = T.mirrorHealth(a, g, 5, 'multi'); const v = Number(mh && mh.holoOtherPerGame); return isFinite(v) ? v : null; };

for (const [tag, pfx, start] of [['82 谱系（起点 v7beadseed-82）', 'gv', 'docs/artifacts/v7beadseed-82.bak'],
                                 ['teach 谱系（起点 v7teach-32）', 'tw', 'docs/artifacts/v7teach-32.bak']]) {
  const seen = new Map();
  for (const f of readdirSync(A)) {
    if (f.indexOf(pfx + '-') !== 0 || f.indexOf('--') < 0) continue;
    const abs = path.join(A, f);
    const w = wid(abs);
    if (!w) { console.error('  ⚑ 读不出权重本体，跳过：' + f); continue; }
    if (!seen.has(w)) seen.set(w, abs);   // 同一粒只算一次（配对臂共享梯子）
  }
  const rows = [];
  for (const [w, abs] of seen) rows.push({ w: w, g20: gift(abs, 20), g100: gift(abs, 100) });
  const bad = rows.filter(r => r.g100 === null).length;
  if (bad) console.log('  ⚑ ' + bad + ' 粒读不出 `holoOtherPerGame`（**不当 0**）');
  const v = rows.map(r => r.g100).filter(x => x !== null && isFinite(x)).sort((a, b) => a - b);
  const pct = q => v.length ? v[Math.min(v.length - 1, Math.floor(q * v.length))] : NaN;
  const over = v.filter(x => x > HOLO_GIFT_MAX).length;
  const s20 = gift(path.join(ROOT, start), 20), s100 = gift(path.join(ROOT, start), 100);
  console.log('\n## ' + tag);
  console.log('  起点本身 @20=' + (s20 === null ? '读不出' : s20.toFixed(2)) + ' ‖ @100=' + (s100 === null ? '读不出' : s100.toFixed(2)) + ' 次/局');
  console.log('  带内候选（按权重本体去重）n=' + v.length + ' 粒 ‖ @100 中位 ' + pct(0.5).toFixed(2) +
    ' ‖ P10 ' + pct(0.10).toFixed(2) + ' ‖ P90 ' + pct(0.90).toFixed(2) + ' ‖ 最小 ' + (v[0] || 0).toFixed(2) + ' ‖ 最大 ' + (v[v.length - 1] || 0).toFixed(2));
  console.log('  超线（>' + HOLO_GIFT_MAX + '）的粒数 = ' + over + '/' + v.length + '（' + (v.length ? (100 * over / v.length).toFixed(0) : '—') + '%）‖ 恰为 0.00 的 ' + v.filter(x => x === 0).length + ' 粒');
  console.log('  逐粒：' + rows.map(r => r.w + '=' + (r.g100 === null ? '—' : r.g100.toFixed(2))).join(' ‖ '));
}
console.log('\n⚑ 单位说清：这一台数的是**候选分布**（训练器端出来多少粒超线），不是"谁当选"；当选那一席的读数在 §E650 一/六。');
console.log('⚑ 分母仍然是**两条谱系各一批候选**（谱系 n=1/条）⇒ 它把"当选者恰好超线"那句话说实，但不构成"起点决定收敛形状"的结论。');

/* ===== 名次那一格（PREREG §六 1b，判线写在跑之前）=====
 * 每格 = 一个（谱系 × seed）：取**关档臂**日志里 `[band-save] …（当选）` 那一粒，量它的 @100 裸包送盾，
 * 在那条梯子六席的 @100 值里排名（1 = 最凶 … 6 = 最干净）。同谱系三格共享起点 ⇒ 只判"形状是不是巧合"。 */
const { readFileSync } = await import('node:fs');
const LINES = [['gv', 'v7beadseed-82'], ['tw', 'v7teach-32'], ['ex', 'v7expo-34'], ['wa', 'v7wall-33']];
/* 从臂日志里取"（当选）"那个 band 名（与 `analyze-gift-arms.mjs` 同一把判据，别在这儿发明第二种） */
const winnerBandOf = (txt, arm) => ((txt.match(new RegExp('^\\[band-save\\] (' + arm + '-band\\d+)\\.bak\\s+trainFit=[\\d.]+（当选）', 'm')) || [])[1]) || null;
console.log('\n## 关档当选者在自家六席里按 @100 送盾的名次（1=最凶 ‖ 判线见 PREREG §六 1b：≥8/12 落在前两席才许升格）');
const ranks = [];
for (const [pfx, name] of LINES) {
  const cells = [];
  for (const s of [77000, 77001, 77002]) {
    const lg = path.join(HERE, 'gift-veto-' + pfx + '0-' + s + '.log.txt');
    if (!existsSync(lg)) continue;
    const m = winnerBandOf(readFileSync(lg, 'utf8'), pfx + '0-' + s);
    if (!m) { cells.push(s + '=日志里读不到（当选）行'); continue; }
    const abs = path.join(A, pfx + '-' + pfx + '0-' + s + '--' + m + '.bak');
    const absLive = path.join(ROOT, 'docs/artifacts', pfx + '-' + pfx + '0-' + s, m + '.bak');
    const p = existsSync(abs) ? abs : (existsSync(absLive) ? absLive : null);
    if (!p) { cells.push(s + '=产物不在盘上'); continue; }
    const wg = gift(p, 100);
    if (wg === null) { cells.push(s + '=读不出'); continue; }
    /* 同一条梯子的六席（按权重去重后取该 seed 那一支）*/
    const lAD = new Set(); const ladder = [];
    for (let k = 1; k <= 6; k++) {
      const f = path.join(A, pfx + '-' + pfx + '0-' + s + '--' + pfx + '0-' + s + '-band' + k + '.bak');
      const fl = path.join(ROOT, 'docs/artifacts', pfx + '-' + pfx + '0-' + s, pfx + '0-' + s + '-band' + k + '.bak');
      const q = existsSync(f) ? f : (existsSync(fl) ? fl : null);
      if (!q) continue;
      const w = wid(q); if (lAD.has(w)) continue; lAD.add(w);
      const g = gift(q, 100); if (g !== null) ladder.push(g);
    }
    const rank = 1 + ladder.filter(g => g > wg + 1e-9).length;
    cells.push(s + '=' + wg.toFixed(2) + '/局 名次 ' + rank + '/' + ladder.length);
    ranks.push({ pfx: pfx, seed: s, rank: rank, n: ladder.length });
  }
  if (cells.length) console.log('  ' + name.padEnd(16) + cells.join('   ‖   '));
  else console.log('  ' + name.padEnd(16) + '还没跑（臂日志不在 ⇒ 这一支不参与名次统计）');
}
if (ranks.length) {
  const top2 = ranks.filter(r => r.rank <= 2).length;
  console.log('  合计 ' + ranks.length + ' 格 ‖ 落在前两席（最凶的两粒）= ' + top2 + ' 格 ‖ 判线要 ≥8/12 ⇒ ' + (ranks.length >= 12 && top2 >= 8 ? '**可升格**' : '**维持"方向一致的观察"**'));
}

