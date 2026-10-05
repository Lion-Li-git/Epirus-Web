/* directions.mjs —— §E307：从冠军演化图里读"后续还能往哪儿训"。
 *
 * 为什么不靠想象力：这 718 枚本身就是一次**已经跑完的自然实验** —— lineage 把 10 天里的 22 次
 *   "方法/目标大改"切成了组，每组都有 n 枚、都有同一把尺上的 H/S/F、有同一道闸的过线判定、
 *   还有 §E305 新量出来的送盾率（= 发货侧那条图上看不见的腿）。
 *   ⇒ 能问的不是"还有什么方向听起来有戏"，而是"**过去每次拧动某个旋钮，前沿动了没有**"。
 *
 * 三张表：
 *   A 家族级自然实验：每改一次，最好名次 / 过线率 / 送盾 各变了多少（同卷同种子 ⇒ 可比）
 *   B 行为轴"重要但没探"：与 F 相关强、但全库分布极窄的轴 = 想拧也拧不动；反之是已经拧过的
 *   C 前沿的成分：F 前 20 名与全库的行为中位数差在哪，以及它们落在哪些家族
 *
 * ⚠ 口径：H/S/F 全部来自 §E290 那把统一尺（考卷固定种子 1050 局/枚 + selfPlay 广度），
 *   跨家族比的是**名次与率**，不比绝对电平（§E202/§E204 那条：仪器扰动过电平，配对差才可信）。
 * 用法：node champion-map/directions.mjs [--top=20]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const TOPN = Number(arg('top', 20));
const T = Number(arg('T', 0.10));
/* ⚠ §E314 之后页面/等值面用的是**线上口径 `Hp`**，这台脚本 §E307 当年按 `H` 跑 ⇒ 默认换到 `Hp` 与页面同仪器
 *   （§E312 的规矩：喂决策的离线工具必须先证明它是同一台仪器）。要复刻 §E307 的历史表就显式加 `--ruler=H`。
 *   名次也一样：**不许读 `coords.tsv` 的 `rank` 列**（那是换尺前算的），改成**在本尺上现算**。 */
const RULER = arg('ruler', 'Hp');
if (RULER !== 'Hp' && RULER !== 'H') { console.error('⛔ --ruler 只认 Hp|H，收到 ' + RULER); process.exit(2); }
if (RULER !== 'Hp' && RULER !== 'H') { console.error('⛔ --ruler 只认 Hp|H，收到 ' + RULER); process.exit(2); }

function tsv(f) { const L = readFileSync(join(HERE, f), 'utf8').trim().split('\n'), h = L[0].split('\t');
  return L.slice(1).map(l => { const c = l.split('\t'); const o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }); }
const co = tsv('coords.tsv'), lin = tsv('lineage.tsv');
const LB = {}; for (const r of lin) LB[r.id] = r;
const OKM = {};
for (const f of ['feas-s1.tsv', 'feas-s2.tsv', 'feas-s3.tsv']) { try { for (const r of tsv(f)) OKM[r.id] = r.ok; } catch (e) { } }
const HOL = {}; for (const r of tsv('holo.tsv')) HOL[r.id] = r;

const R = co.map(r => ({ id: r.id, H: +r.H, Hp: +r.Hp, S: +r.S, Ge: +r.Geff, rk: 0, F: +r[RULER] / 100 + T * (+r.S),
  fam: LB[r.id] ? +LB[r.id].fam : 0, fl: LB[r.id] ? LB[r.id].famLabel : '', ts: LB[r.id] ? LB[r.id].ts : '',
  ok: OKM[r.id] === '1' ? 1 : (OKM[r.id] === '0' ? 0 : null),
  holo: HOL[r.id] && HOL[r.id].holoOther !== '' ? +HOL[r.id].holoOther : null,
  lin: r.lineage || '',
  beh: { dmg: +r.dmg, heavy: +r.heavy, holo: +r.holo, rounds: +r.rounds, draw: +r.drawRate, zero: +r.zeroRate,
    seat: +r.seatSpread, keys: +r.distinctKeys, chg: +r.charges, waste: +r.waste, stance: +r.noThreatStance,
    fA: +r.fieldAAtk, rw: +r.rwDmg } }));
/* 名次**在本尺上现算** —— 直接读 `coords.tsv` 的 `rank` 列会把旧尺名次当新尺结论用（viewer 会重算，离线脚本不会） */
(function () { const o = R.map((r, i) => i).sort((a, b) => R[b].F - R[a].F);
  for (let k = 0; k < o.length; k++) R[o[k]].rk = k + 1; })();
console.log('量具: --ruler=' + RULER + ' ‖ T=' + T + ' ‖ 名次 = 本尺现算（不读 coords 的 rank 列）‖ n=' + R.length);
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
function spear(x, y) { const n = x.length; if (n < 4) return NaN;
  const rk = v => { const s = v.map((x2, i) => [x2, i]).sort((a, b) => a[0] - b[0]); const r = new Array(n); s.forEach((p2, i) => r[p2[1]] = i); return r; };
  const a = rk(x), b = rk(y), ma = (n - 1) / 2; let sxy = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sxy += (a[i] - ma) * (b[i] - ma); sa += (a[i] - ma) ** 2; sb += (b[i] - ma) ** 2; }
  return sxy / Math.sqrt(sa * sb); }

/* ===== A 家族级自然实验 ===== */
console.log('=== A. 22 次方法/目标改动 = 一组已跑完的自然实验（尺 = §E290 统一卷上的 ' + RULER + ' · T=' + T + '）===');
console.log('家 枚数 最好名次 中位名次 过线率 送盾中位 冠军  改了什么（相对上一家）');
const fams = {};
for (const r of R) if (r.fam) (fams[r.fam] || (fams[r.fam] = [])).push(r);
const rows = Object.keys(fams).map(Number).sort((a, b) => a - b).map(f => {
  const g = fams[f];
  return { f, n: g.length, best: Math.min.apply(null, g.map(r => r.rk)), mid: med(g.map(r => r.rk)),
    okr: g.filter(r => r.ok === 1).length / g.length, holo: med(g.map(r => r.holo)),
    champ: g.filter(r => r.lin).length, label: g[0].fl.split(' ‖ ')[0], t0: g[0].ts.slice(5, 10) };
});
for (const r of rows) console.log(String(r.f).padStart(2) + ' ' + String(r.n).padStart(4) + ' ' +
  String(r.best).padStart(6) + ' ' + String(Math.round(r.mid)).padStart(7) + ' ' +
  (r.okr * 100).toFixed(0).padStart(5) + '% ' + (Number.isFinite(r.holo) ? r.holo.toFixed(1) : '—').padStart(7) + ' ' +
  String(r.champ).padStart(4) + '  ' + r.t0 + '  ' + r.label);
/* 每次改动的"边际收益"：与上一家比最好名次（名次越小越好 ⇒ 负数 = 进步） */
console.log('\n改动边际收益（最好名次的变化，负 = 前沿被推进）：');
for (let i = 1; i < rows.length; i++) {
  const d = rows[i].best - rows[i - 1].best;
  console.log('  ' + String(rows[i - 1].f).padStart(2) + '→' + String(rows[i].f).padStart(2) + '  ' +
    (d >= 0 ? '+' : '') + d + '   ' + rows[i].label.slice(0, 46));
}

/* ===== B 行为轴：重要 vs 已探 ===== */
console.log('\n=== B. 行为轴：与 F 的秩相关 × 全库分布宽度（"重要但没探"= |ρ| 大而 IQR/全距 小）===');
const keys = Object.keys(R[0].beh);
const tab = keys.map(k => {
  const v = R.map(r => r.beh[k]);
  const rho = spear(v, R.map(r => r.F));
  const spread = (pct(v, .95) - pct(v, .05)) || 1;
  const iqr = (pct(v, .75) - pct(v, .25));
  return { k, rho, iqrF: iqr / spread, med: med(v), p05: pct(v, .05), p95: pct(v, .95) };
});
tab.sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho));
for (const t of tab) console.log('  ' + t.k.padEnd(8) + ' ρ(F)=' + (t.rho >= 0 ? '+' : '') + t.rho.toFixed(3) +
  '  IQR/全距=' + t.iqrF.toFixed(2) + '  中位=' + t.med.toFixed(2) + '  p05..p95=' + t.p05.toFixed(2) + '..' + t.p95.toFixed(2));

/* ===== C 前沿成分 ===== */
const top = R.slice().sort((a, b) => a.rk - b.rk).slice(0, TOPN);
console.log('\n=== C. F 前 ' + TOPN + ' 名的构成 ===');
const byFam = {}; for (const r of top) byFam[r.fam] = (byFam[r.fam] || 0) + 1;
console.log('  家族分布：' + Object.keys(byFam).map(Number).sort((a, b) => a - b).map(f => 'f' + f + '×' + byFam[f]).join('  '));
console.log('  其中历代冠军 ' + top.filter(r => r.lin).length + ' 枚 ‖ 今天过线 ' + top.filter(r => r.ok === 1).length + ' 枚 ‖ 线上包 ' + (top.filter(r => r.id === 'SHIPPED-Ldemo').length ? '在' : '不在'));
console.log('  行为中位数（前 ' + TOPN + ' vs 全库）：');
for (const k of keys) { const a = med(top.map(r => r.beh[k])), b = med(R.map(r => r.beh[k]));
  const sd = (pct(R.map(r => r.beh[k]), .95) - pct(R.map(r => r.beh[k]), .05)) || 1;
  console.log('    ' + k.padEnd(8) + ' ' + a.toFixed(2).padStart(8) + ' vs ' + b.toFixed(2).padStart(8) +
    '   差 = ' + ((a - b) / sd).toFixed(2) + ' 个全库展宽' + (Math.abs((a - b) / sd) > 0.35 ? '  ★' : '')); }

/* ===== D 平台期：前沿随时间 ===== */
console.log('\n=== D. 前沿随日期（每天最好名次；越平 = 越没在推进）===');
const byDay = {};
for (const r of R) { const d = r.ts.slice(0, 10); if (d.length === 10) (byDay[d] || (byDay[d] = [])).push(r); }
for (const d of Object.keys(byDay).sort()) { const g = byDay[d];
  console.log('  ' + d + '  ' + String(g.length).padStart(4) + ' 枚  最好名次 ' + String(Math.min.apply(null, g.map(r => r.rk))).padStart(4) +
    '  过线率 ' + (g.filter(r => r.ok === 1).length / g.length * 100).toFixed(0) + '%'); }
console.log('\n  ⇒ 全库最好名次 = ' + Math.min.apply(null, R.map(r => r.rk)) + '（第 1 名 ' + R.filter(r => r.rk === 1)[0].id + '）‖ 历代冠军里最好名次 = ' +
  Math.min.apply(null, R.filter(r => r.lin).map(r => r.rk)) + '（线上包名次 ' + (R.find(r => r.id === 'SHIPPED-Ldemo') || {}).rk + '）');
