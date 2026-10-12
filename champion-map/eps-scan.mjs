#!/usr/bin/env node
/* §E313 部署口径 vs 考卷口径：把"开着 ε=0.2 soft 时谁更强"量成一张表
 *
 * ⚠ 口径纠偏（§E597 之后，10-13 夜班补注）：本尺里 `eps.tsv` 那一列写的是 **`page`**，
 *   而它给的是 `--eps=0.2 --eps-mode=soft` 这个**常数**剂量 —— 10-12 之后页面默认档（`lv:regular`）
 *   吃的是 **0.1 的回合斜坡**，0.2 变成了**简单档**的剂量 ⇒ `page` 这个标签是 §E313 时代留下的，
 *   今天读它请读成"带探索的臂（简单档剂量）"，别当"玩家默认拿到的那个数"。
 *   要页面默认档走 `eps-full.mjs --epsTier=<档 id>`（剂量由产品那张表给，§E597）。
 *   ⚠ 表里的**值**不改、标签也不改（改了会把 §E313 那批历史读数与 `epsread` 的判据同时打断），只把话说明白。
 *
 * 为什么要量这一格（用户裁的"最后一格"）：图上那把头号尺 H = `eval-5p` 的**考卷口径**（ε=0 贪心），
 *   而**当时**真页面跑的是 **ε=0.2 / soft**（§E275 才把这条口径接进工具；今天默认档已是 0.1·斜坡，见开头那句纠偏）。两把尺一直没并排量过。
 *   单点先验（今晚 06:5x 实测，seed 77000）：线上包 55.4 ⇒ 47.3（**掉 8.1pt**），
 *   而候选 `v7u1-93` 56.7 ⇒ 56.7（**一字不动**）⇒ 若这不是两枚包各自的噪声，
 *   那"考卷分接近、换包收益接近 0"那条判语就得改口：**考卷在低估换包收益**。
 *
 * 判据（跑前写死，不许事后改口）：
 *   (a) 排序稳定性：过线组上 Spearman(考卷 1st, 页面 1st)。ρ ≥ 0.9 ⇒ 换口径不改结论；
 *       ρ < 0.7 ⇒ 图上按 H 排的"名次"不许直接当"上线会更强"读。
 *   (b) "现役特别脆"要成立：线上包的 Δε 要 **≥ 过线组 |Δε| 的 90 分位**，
 *       且**至少再有 2 枚历代冠军**同量级（≥0.75×）⇒ 否则就是单枚包的性格，不是"冠军体质"（口径陷阱第 34 条）。
 *   (c) 判"该换"：页面口径下 候选 − 现役 ≥ +5pt，**且两个 eval seed 同号**。
 *   Δε ≡ 1st(ε=0) − 1st(ε=0.2 soft)，同一 seed、同一 35 组合 × 30 局 ⇒ 同世界，只在主体席的 chooser 上差一个 ε。
 *
 * 用法：node champion-map/eps-scan.mjs [--seeds=77000,88000] [--passers=113] [--quiet]
 *   产物：champion-map/eps.tsv（id / seed / eps / first / drain / bigt / ms）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const SEEDS = String(arg('seeds', '77000,88000')).split(',').map(Number);
console.error('⚠ 口径提醒：本尺落盘的 `page` 列 = 常数 `--eps=0.2 --eps-mode=soft` ⇒ 10-12 之后那是**简单档**的剂量，'
  + '不是页面默认档（`lv:regular` = 0.1 的回合斜坡）。要"玩家默认那个数"请走 `eps-full.mjs --epsTier=<档 id>`。');

/* 名单 = 过线组（三批可行性里任一判为过线）+ 历代冠军 + 线上包。
 *   ⚠ "历代冠军"的**唯一来源**是 `coords.tsv` 的 `lineage` 列非空（查看器里 d.lin 就是它，15 枚）；
 *     `lineage.tsv` 里没有 champion 列 —— 第一版按那个找，静默拿到 0 枚（名单式守卫要钉枚数，见记忆第十九条）。*/
const PASS = new Set();
for (const f of ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv']) {
  const L = readFileSync(join(HERE, f), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  const hd = Object.fromEntries(L[0].map((h, i) => [h, i]));
  for (const r of L.slice(1)) if (r[hd.ok] === '1') PASS.add(r[hd.id]);
}
const CO = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
const ch = Object.fromEntries(CO[0].map((h, i) => [h, i]));
const champ = CO.slice(1).filter((r) => r[ch.lineage]).map((r) => r[ch.id]);
if (!champ.length) { console.error('⛔ 历代冠军名单为空 ⇒ lineage 列没读到，别把"只有过线组"当成全量'); process.exit(2); }
const IDS0 = [...new Set([...PASS, ...champ, 'SHIPPED-Ldemo'])].filter((id) => existsSync(join(ROOT, 'docs/artifacts', id + '.bak')));
const LIM = Number(arg('limit', 0));
const IDS = LIM > 0 ? IDS0.slice(0, LIM) : IDS0;
console.error('名单：过线 ' + PASS.size + ' ‖ 历代冠军 ' + champ.length + ' ‖ 盘上有 .bak 的 ' + IDS0.length + ' 枚（缺 ' +
  ([...new Set([...PASS, ...champ, 'SHIPPED-Ldemo'])].length - IDS0.length) + ' 枚）' +
  (LIM > 0 ? ' ‖ **本次只跑前 ' + IDS.length + ' 枚（--limit）**' : ''));

/* 一次 eval-5p：抓 [冠军] 的 1st，外加两条用量行（大雷/摄魂）—— 它们本身也是 ε 的函数，要落盘 */
function run(id, seed, epsOn) {
  const a = ['tools/eval-5p.mjs', '30', '5', String(seed), 'docs/artifacts/' + id + '.bak'];
  if (epsOn) a.push('--eps=0.2', '--eps-mode=soft');
  const t0 = Date.now();
  const out = execFileSync(process.execPath, a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const g = (re) => { const m = out.match(re); return m ? m[1] : ''; };
  return {
    first: Number(g(/\[冠军\] 1st=([\d.]+)%/)),
    strict: Number(g(/\[冠军\] 1st=[\d.]+% 严胜=([\d.]+)%/)),
    bigt: g(/真打出 \*\*([\d]+) 张 \/ 1050 局/),
    seed, id, eps: epsOn ? 'page' : 'exam', ms: Date.now() - t0
  };
}
const rows = [];
for (const id of IDS) for (const seed of SEEDS) for (const on of [false, true]) {
  try { const r = run(id, seed, on); rows.push(r);
    if (!arg('quiet')) console.log(id + '  s' + seed + '  ' + r.eps.padEnd(4) + ' 1st=' + r.first.toFixed(1) + '%  Δ=' +
      (rows.length > 1 && rows[rows.length - 2].id === id && rows[rows.length - 2].seed === seed
        ? (rows[rows.length - 2].first - r.first).toFixed(1) : '—'));
  } catch (e) { console.error('⛔ ' + id + ' s' + seed + ' ' + (on ? 'page' : 'exam') + ' → ' + ((e && e.message) || e).slice(0, 120)); }
}
const HD = ['id', 'seed', 'eps', 'first', 'strict', 'bigt', 'ms'];
writeFileSync(join(HERE, 'eps.tsv'), HD.join('\t') + '\n' +
  rows.map((r) => HD.map((h) => r[h]).join('\t')).join('\n') + '\n', 'utf8');
console.error('已写 champion-map/eps.tsv（' + rows.length + ' 行 = ' + IDS.length + ' 枚 × ' + SEEDS.length + ' seed × 2 口径）');
