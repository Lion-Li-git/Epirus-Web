/* 选择锦标赛：**训练之后**、用**产品形状的 5P 考卷**给一批候选排序（C8-lite · 千问 §3.5.3 提的形状）。
 *
 * 动因（09-30 夜 ~ 10-01）：
 *   · 本仓反复实测「**N=3 评分桌的排序外推到产品口径会翻号**」（§E137：−1.9pt；我的 `costlyW` 剂量恒 0；§E183 两样都没买到）。
 *   · 但 **C8 全量**（把训练评分桌改成 5P）被量成**不值**（"会换人 50%"），而且它会让**历史臂的尺全部作废**。
 *   ⇒ 折中：**评分的桌不动**，只在**训练产出之后**加一段"**5P 产品形状选择**"——
 *     候选来自同一条训练链（band/hall），用**同一张产品考卷、同一个 seed** 排序 ⇒ **可比的尺**、不动历史账。
 *
 * 口径（三条，写死在这里免得以后再漂）：
 *   ① **同尺**：所有候选与参照都跑**完全相同的 eval-5p 参数**（同 seed、同 `--pool`、同每组合局数）
 *      ⇒ 组合枚举与随机流一致 ⇒ **差异是配对的**（配对性由"同命令同 seed"保证，不是靠事后统计）。
 *   ② **两条读数**：`1st`（夺冠）与 `top2`（进前二）**都给**，并各给 ±1.96SE
 *      ⚠️ SE 用的是**二项近似**（同一批组合之间并不独立 ⇒ 这是**保守**的读法），所以要"超过噪声带"才敢说赢。
 *   ③ **只记录**：本工具**不 promote、不改任何文件**；输出是一张排序表 + 一句"谁在噪声带之外"。
 *
 * 用法：
 *   node tools/pick-5p.mjs [--ref=js/bundled-champion-3p.js] [--games=4] [--pool=core|all] [--seed=77000]
 *                          [--packs=a.bak,b.bak,...] [--json=out.json] [--self-test]
 *   · `--self-test`：不跑对局，只解析一段**合成**的 eval-5p 输出并断言表格与判定 —— 供门做行为验证（秒级）。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(('--' + k + '=').length) : d; };
const REF = arg('ref', 'js/bundled-champion-3p.js');
const GAMES = String(Number(arg('games', 4)) || 4);
const POOL = arg('pool', 'core');
const SEED = String(Number(arg('seed', 77000)) || 77000);
const PACKS = String(arg('packs', '')).split(',').map(s => s.trim()).filter(Boolean);
const JSONOUT = arg('json', '');
const SELF_TEST = process.argv.indexOf('--self-test') >= 0;

/* 解析 eval-5p 的收尾行（单一来源：与其它工具用同一条正则，免得各写一份） */
export function parseEval5p(text) {
  const m1 = /\[冠军\]\s*1st=([\d.]+)%/.exec(text || '');
  const m2 = /\[冠军\]\s*1st=[\d.]+%\s*top2=([\d.]+)%/.exec(text || '');
  const n = /\[冠军\][^\n]*?n=(\d+)/.exec(text || '');
  if (!m1) return null;
  return { first: Number(m1[1]) / 100, top2: m2 ? Number(m2[1]) / 100 : null, n: n ? Number(n[1]) : null };
}

/** 二项 SE（保守读法：把同一批组合当成独立样本 ⇒ 真 SE 只会更小或相当） */
export function seOf(p, n) {
  if (p == null || !n) return null;
  return Math.sqrt(Math.max(0, p * (1 - p)) / n);
}

/** 排序表 + "谁在噪声带之外"（与参照比，差 > 1.96×(两个 SE 的合成)） */
export function rankPacks(rows, refName) {
  const ref = rows.find(r => r.name === refName) || rows[0];
  const out = rows.slice().sort((a, b) => (b.first || 0) - (a.first || 0)).map(r => {
    const d1 = ref.first != null && r.first != null ? r.first - ref.first : null;
    const se = (r.se != null && ref.se != null) ? Math.sqrt(r.se * r.se + ref.se * ref.se) : null;
    return { name: r.name, first: r.first, top2: r.top2, n: r.n, d1: d1, se: se, beyond: (d1 != null && se != null) ? Math.abs(d1) > 1.96 * se : null };
  });
  const best = out[0];
  return { rows: out, ref: ref.name, best: best, verdict: (best && best.beyond && best.d1 > 0) ? 'best-beyond-noise' : 'within-noise' };
}

if (SELF_TEST) {
  /* ⚠️ 校准事实（自检第一次就抓到）：+3.0pt/n=1000 在**保守 SE**（1.96×合成 SE ≈ 4.31pt）下**仍在噪声带内**
   * ⇒ 要判"超出噪声带"得给到 +8pt；想让 +3pt 可判 ⇒ n≥~2000，或改用配对分析。 */
  const mk = (n, f, t) => '[冠军] 1st=' + f + '.0% top2=' + t + '.0% n=' + n;
  const A = parseEval5p(mk(1000, 40, 60)), B = parseEval5p(mk(1000, 48, 66)), C = parseEval5p(mk(1000, 40, 60));
  const bad = [];
  if (!A || A.first !== 0.4) bad.push('解析 A 失败');
  const r = rankPacks([
    { name: 'ref', first: A.first, top2: A.top2, n: A.n, se: seOf(A.first, A.n) },
    { name: 'cand', first: B.first, top2: B.top2, n: B.n, se: seOf(B.first, B.n) },
    { name: 'same', first: C.first, top2: C.top2, n: C.n, se: seOf(C.first, C.n) }
  ], 'ref');
  if (r.best.name !== 'cand') bad.push('最好的一粒认错（' + r.best.name + '）');
  if (r.verdict !== 'best-beyond-noise') bad.push('+8.0pt/n=1000 应判"超出噪声带"，实测 ' + r.verdict);
  /* 校准事实（自检第一次抓到的就是它）：+3.0pt/n=1000 在保守 SE 下**在噪声带内** ⇒ 判据必须能说出这一点 */
  if (rankPacks([
    { name: 'ref', first: 0.4, top2: 0.6, n: 1000, se: seOf(0.4, 1000) },
    { name: 'c3', first: 0.43, top2: 0.62, n: 1000, se: seOf(0.43, 1000) }
  ], 'ref').verdict !== 'within-noise') bad.push('+3.0pt/n=1000 应判"噪声内"（保守 SE 的校准事实）');
  const r2 = rankPacks([
    { name: 'ref', first: 0.4, top2: 0.6, n: 100, se: seOf(0.4, 100) },
    { name: 'cand', first: 0.42, top2: 0.6, n: 100, se: seOf(0.42, 100) }
  ], 'ref');
  if (r2.verdict !== 'within-noise') bad.push('+2.0pt/n=100 应判"噪声内"，实测 ' + r2.verdict);
  console.log('自检：' + (bad.length ? '⛔ ' + bad.join(' · ') : '✔ 全过（解析 / 排序 / 噪声带两侧都有牙）'));
  process.exit(bad.length ? 1 : 0);
}

if (!PACKS.length) { console.error('⛔ 要给候选：--packs=a.bak,b.bak'); process.exit(64); }
const ALL = PACKS.indexOf(REF) < 0 ? [REF].concat(PACKS) : PACKS;
console.log('# 5P 产品形状选择锦标赛（C8-lite · **只记录**）· 参照 ' + REF + ' · 同尺参数：games=' + GAMES + ' pool=' + POOL + ' seed=' + SEED);
const rows = [];
for (const p of ALL) {
  const r = spawnSync(process.execPath, ['tools/eval-5p.mjs', GAMES, '5', SEED, p, '--pool=' + POOL], { encoding: 'utf8', timeout: 7200000, maxBuffer: 1 << 26 });
  const txt = String(r.stdout || '') + String(r.stderr || '');
  const par = parseEval5p(txt);
  if (!par) { console.log('  ⛔ ' + p + '：解析不到 [冠军] 行（eval-5p exit=' + r.status + '）⇒ 不计入排序'); continue; }
  rows.push({ name: p.replace(/^.*[\\/]/, ''), path: p, first: par.first, top2: par.top2, n: par.n, se: seOf(par.first, par.n), exit: r.status });
  console.log('  ' + (p.replace(/^.*[\\/]/, '')).padEnd(28) + ' 1st ' + (100 * par.first).toFixed(1) + '% ±' + (100 * (seOf(par.first, par.n) || 0) * 1.96).toFixed(1) + ' · top2 ' + (par.top2 == null ? '—' : (100 * par.top2).toFixed(1) + '%') + (p === REF ? '  ← 参照' : ''));
}
const R = rankPacks(rows, REF.replace(/^.*[\\/]/, ''));
console.log('\n| 候选 | 1st | vs 参照 | 超噪声带？ |');
console.log('|---|---|---|---|');
for (const r of R.rows) console.log('| ' + r.name + ' | ' + (r.first == null ? '—' : (100 * r.first).toFixed(1) + '%') + ' | ' + (r.d1 == null ? '—' : ((r.d1 >= 0 ? '+' : '') + (100 * r.d1).toFixed(1) + 'pt')) + ' | ' + (r.beyond == null ? '—' : (r.beyond ? (r.d1 > 0 ? '**是（更好）**' : '**是（更差）**') : '否')) + ' |');
console.log('⇒ 判定：' + (R.verdict === 'best-beyond-noise' ? '**' + R.best.name + ' 超出噪声带**（可进下一道流程）' : '全部**在噪声带内** ⇒ 不值得换（本工具只记录，不改包）'));
if (JSONOUT) { writeFileSync(JSONOUT, JSON.stringify({ ref: REF, games: GAMES, pool: POOL, seed: SEED, rows: R.rows, verdict: R.verdict }, null, 1)); console.log('  json → ' + JSONOUT); }
