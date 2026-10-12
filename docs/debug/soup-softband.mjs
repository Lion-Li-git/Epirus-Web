/* soup-softband.mjs —— §E600-B 的下一手：**整带**换成融合粒，看产品尺动不动（2026-10-13 夜班 · 实验量具，不进判据）
 *
 * 为什么是"整带"而不是"再补一枚"：B1 实测把一枚 Hp 29.4 的融合粒替进 soft 档 11 席之一，
 *   整带读数只差 0~1pt（`_pool-V3.tsv`）⇒ "往 soft 带补更弱的成员"这条在册杠杆被证伪了一半
 *   （`js/train/bots.js` 的 `DIFF_TIERS` note 写的两条杠杆之一）。
 *   单席被摊薄是结构性的 ⇒ 要验"融合能不能造出更简单的**一档**"，只能改一档。
 *
 * 做什么：
 *   1) 用 `soup-pack` 造 7 粒跨带/同带融合（父母一律取 `pool-members.tsv` 里 soft 那 11 枚 + 一枚 hard 做对照）
 *   2) 现测 Hp（`eps-full --extra --onlyExtra`，同批同 seed 才可配对）
 *   3) 出一张**把 soft 档整带替掉**的名册 `_soup-members-SOFTALL.tsv`（hard/mid 行原样保留）
 * 用法：node docs/debug/soup-softband.mjs [--pairs=N]
 * ⚠ 只写 scratch（`champion-map/_soup-*`、`docs/artifacts/e599-soup/`），不碰 `pool-members.tsv`、不碰线上槽。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from '../../champion-map/wid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'docs', 'artifacts', 'e599-soup');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const P = f => join(ROOT, f);
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trim();
const rows = t => { const L = t.split('\n'), h = L[0].split('\t');
  return { h, r: L.slice(1).filter(s => s.trim()).map(s => { const c = s.split('\t'), o = {}; h.forEach((k, i) => o[k] = c[i] || ''); return o; }) }; };

const PM = rows(rd('champion-map/pool-members.tsv'));
const soft = PM.r.filter(x => x.tier === 'soft' && x.path && existsSync(P(x.path)));
const hard = PM.r.filter(x => x.tier === 'hard' && x.path && existsSync(P(x.path)));
if (soft.length < 6) { console.error('⛔ soft 档在盘的成员不足 6 枚（' + soft.length + '）⇒ 这实验没法做'); process.exit(2); }
console.log('可用父母：soft ' + soft.length + ' 枚 ‖ hard ' + hard.length + ' 枚');

/* ---- 1) 配对：soft 内部首尾配对（弱×弱）+ 末位配一枚 hard（看"掺一点强的"会不会把整带抬回去）---- */
const pairs = [];
for (let i = 0; i + 1 < soft.length && pairs.length < 6; i += 2) pairs.push([soft[i], soft[i + 1]]);
pairs.push([hard[0], soft[0]]);
const made = [];
for (const [a, b] of pairs) {
  const name = 'soupSB-' + a.id.replace(/[^A-Za-z0-9]/g, '') + 'x' + b.id.replace(/[^A-Za-z0-9]/g, '');
  const rel = 'docs/artifacts/e599-soup/' + name + '.js';
  try {
    execFileSync(process.execPath, ['tools/soup-pack.mjs', '--packs=' + a.path + ',' + b.path, '--w=0.5,0.5', '--out=' + rel],
      { cwd: ROOT, encoding: 'utf8' });
  } catch (e) { console.error('⛔ 造不出 ' + name + '：' + String(e.message).slice(0, 120)); continue; }
  const w = widOf(rd(rel));
  made.push({ id: name, wid: w, path: rel, from: a.id + ' × ' + b.id });
  console.log('造好 ' + name + '（' + a.id + ' × ' + b.id + '）wid=' + String(w).slice(0, 8));
}
if (!made.length) { console.error('⛔ 一粒都没造出来'); process.exit(2); }

/* ---- 2) 现测 Hp 用的清单（eps-full 认 arm + productRel 两列）---- */
const ex = ['arm\tproductRel'].concat(made.map(m => m.id + '\t' + m.path)).join('\n') + '\n';
writeFileSync(P('champion-map/_soup-extra2.tsv'), ex, 'utf8');

/* ---- 3) 整带替掉的名册：soft 行按顺序换成融合粒，多出来的粒塞进去，hard/mid 原样 ---- */
const out = [PM.h.join('\t')];
let k = 0;
for (const r of PM.r) { const c = PM.h.map(h => r[h] || '');
  if (r.tier === 'soft' && k < made.length) { const m = made[k++];
    c[PM.h.indexOf('id')] = m.id; c[PM.h.indexOf('wid')] = m.wid || ''; c[PM.h.indexOf('path')] = m.path;
    c[PM.h.indexOf('note')] = '§E600-B2 融合整带替席（实验名册，不进池）'; c[PM.h.indexOf('seatKill')] = '-1';
    c[PM.h.indexOf('addedAt')] = new Date().toString();
    out.push(c.join('\t')); continue; }
  out.push(c.join('\t')); }
writeFileSync(P('champion-map/_soup-members-SOFTALL.tsv'), out.join('\n') + '\n', 'utf8');
console.log('实验名册写好：champion-map/_soup-members-SOFTALL.tsv ‖ 替进 soft 档 ' + Math.min(k, made.length) + ' 枚（融合粒共 ' + made.length + '）');
console.log('下一步：node champion-map/eps-full.mjs --extra=_soup-extra2.tsv --onlyExtra --games=120 --epsTier=lv:regular --out=_soup-tier2.tsv');
console.log('        node tools/probe-pool.mjs --tier=soft --games=300 --seeds=90210,90211 --modes=multi,long --members=champion-map/_soup-members-SOFTALL.tsv --out=_pool-SOFTALL.tsv');
