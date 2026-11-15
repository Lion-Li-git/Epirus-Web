#!/usr/bin/env node
/* probe-crossenv-skill.mjs —— 跨环境技能使用普查尺（ZCode · 2026-11-16 凌晨，PLAN-2026-11-16-overnight 批1）
 *
 * 回答用户点名的缺口：现有用卡数（cardUsageProfile）全是五席镜像自对局，没有环境多样性。
 * 这把尺把每包摆上「对手矩阵 × 人数 × 模式」网格，量四件事：
 *   ① 技能并集数（跨格 union——延续「技能上限用环境矩阵测」原则，但对手维度也进格）
 *   ② 每技能环境覆盖率（≥阈值出手的格数/总格数——区分「跨环境稳定会」与「单环境偶发」）
 *   ③ 换招（跨环境·桶钉版）：同 (血档×ep档) 桶内、跨对手类型（脚本组 vs 真包组）的出手分布
 *      JS 散度——§E183 的朴素跨格 JS 被否证（量的是局怎么结束），这里只在数值状态相同的地方比
 *   ④ 自对局失真列：镜像自对局（cardUsageProfile）卡谱 vs 环境矩阵卡谱的差
 *
 * 对局核心逐字沿用 exam-4n/eval-5p 口径：T.oneGameN(choosers, seed, n, {mode}) + T.rankOf；
 * 对手 = 脚本（makeAsChooser(Bots[fn])，opp-pool 单源）+ 真包（T.policyChooserN(params, 0.15)，
 * exam-v2 口径）；被测席轮换（seat = g % n，解耦座位率）。真包对手格 = 其余全席同一真包（纯对位，
 * 不掺脚本填充——格语义 = "对手身份"，混填充会污染分布）。
 *
 * 用法：
 *   node scratch/probes/probe-crossenv-skill.mjs --packs=a.bak,b.bak [--games=10] [--out=x.json]
 */
import { writeFileSync } from 'node:fs';
import { rejectUnknownFlags, sandbox, loadChamp, cardUsageProfile } from '../../tools/audit-lib.mjs';
import { OPP_SPECS } from '../../training/server/opp-pool.mjs';
import { makeAsChooser } from '../../tools/bot-chooser-lib.mjs';

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['packs', 'games', 'out', 'temp', 'coverth'], 'probe-crossenv-skill');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

const PACKS = arg('packs', '').split(',').map((s) => s.trim()).filter(Boolean);
if (!PACKS.length) { console.error('用法：--packs=a.bak,b.bak [--games=10] [--out=x.json]'); process.exit(2); }
const GAMES = Math.max(4, Number(arg('games', 10)) || 10);
const OTEMP = 0.15;
const COVERTH = Math.max(1, Number(arg('coverth', 3)) || 3);
const NS = [2, 3, 5, 8];
const MODES = ['multi', 'long'];

const SCRIPTS = ['gunspam', 'wall', 'baguaspam', 'guardgun', 'heavyfire', 'deepsaver', 'ringspam', 'tankline', 'targeter', 'beadburst'];
const REAL_PACKS = [
  ['E9', 'docs/artifacts/obs6-coldstart/OBS6E9.bak'],
  ['P4-S4000', 'docs/artifacts/obs6-coldstart/OBS6P4-S4000.bak'],
  ['P9-S4000', 'docs/artifacts/obs6-coldstart/OBS6P9-S4000.bak'],
  ['MSB15R-HITMIX', 'docs/artifacts/night-adapt/MSB15R-hit-mix-R1S2057836694.js'],
  ['WSEL9-200', 'scratch/ds-1109/WSEL9-200.js'],
];

const W = sandbox();
const T = W.EpirusTrainer, R = W.EpirusRules, B = W.EpirusBots;
const asChooser = makeAsChooser({ T, R });

const FN = {};
for (const o of OPP_SPECS) FN[o.name] = B[o.fn];
for (const nm of SCRIPTS) if (typeof FN[nm] !== 'function') { console.error('⛔ 脚本对手取不到：' + nm); process.exit(2); }
const SCRIPT_CH = Object.fromEntries(SCRIPTS.map((nm) => [nm, asChooser(FN[nm])]));
const REAL_CH = [];
for (const [nm, p] of REAL_PACKS) {
  let params = null;
  try { params = loadChamp(W, p); } catch (e) { console.error('⛔ 真包对手读不出：' + nm + ' ' + String(e).slice(0, 80)); process.exit(2); }
  REAL_CH.push([nm, T.policyChooserN(params, OTEMP)]);
}
const OPPONENTS = [...SCRIPTS.map((nm) => [nm, SCRIPT_CH[nm], false]), ...REAL_CH.map(([nm, ch]) => [nm, ch, true])];

/* 桶：血 3 档（满/中/残）× ep（1/2/3+）——粗桶保样本量；桶钉思想承 §E184 */
function bucketOf(state, pid) {
  const me = (state && state.p && state.p[pid]) || {};
  const hp = me.hp != null ? me.hp : 0;
  const ep = me.ep != null ? me.ep : 0;
  const hpB = hp >= 4 ? 0 : (hp >= 2 ? 1 : 2);
  return hpB * 4 + Math.min(3, ep);
}
function jsDiv(p, q) {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  let np = 0, nq = 0;
  for (const k of keys) { np += p[k] || 0; nq += q[k] || 0; }
  if (!np || !nq) return 0;
  let d = 0;
  for (const k of keys) {
    const a = (p[k] || 0) / np, b = (q[k] || 0) / nq, m = (a + b) / 2;
    if (a > 0) d += 0.5 * a * Math.log2(a / m);
    if (b > 0) d += 0.5 * b * Math.log2(b / m);
  }
  return d;
}

let curCell = null;
function evalPack(tag, path) {
  const params = loadChamp(W, path);
  const base = T.policyChooserN(params, 0.15);
  let decN = 0;
  const wrapped = function (state, pid, legal) {
    decN++;
    const got = base(state, pid, legal);
    const key = got && (got.key || got);
    const bk = bucketOf(state, pid);
    curCell.buckets[bk] = curCell.buckets[bk] || {};
    curCell.buckets[bk][key] = (curCell.buckets[bk][key] || 0) + 1;
    curCell.keys[key] = (curCell.keys[key] || 0) + 1;
    return got;
  };
  const cells = [];
  for (const [oname, oppCh, isReal] of OPPONENTS) {
    for (const n of NS) for (const mode of MODES) {
      const cell = { opp: oname, real: isReal, n, mode, games: 0, win: 0, keys: {}, buckets: {} };
      curCell = cell;
      for (let g = 0; g < GAMES; g++) {
        const seat = g % n;
        const choosers = [];
        for (let pid = 0; pid < n; pid++) choosers.push(pid === seat ? wrapped : oppCh);
        const gseed = 910000 + n * 1000003 + (mode === 'long' ? 500000 : 0) + g * 977 + (isReal ? 7919 : 0);
        const r = T.oneGameN(choosers, gseed, n, { mode });
        cell.games++;
        cell.win += T.rankOf(r.state, seat, gseed) === 1 ? 1 : 0;
      }
      cells.push(cell);
    }
  }
  curCell = null;
  /* 聚合：①并集 ②覆盖率 ③桶钉换招（脚本组 vs 真包组，同 n/mode/桶）④自对局失真 */
  const union = new Set(); for (const c of cells) for (const k of Object.keys(c.keys)) union.add(k);
  const coverage = {};
  for (const k of union) coverage[k] = cells.filter((c) => (c.keys[k] || 0) >= COVERTH).length;
  const mk = (real) => {
    const m = {};
    for (const c of cells.filter((c) => c.real === real)) {
      for (const bk of Object.keys(c.buckets)) {
        m[bk] = m[bk] || {};
        for (const k of Object.keys(c.buckets[bk])) m[bk][k] = (m[bk][k] || 0) + c.buckets[bk][k];
      }
    }
    return m;
  };
  const S = mk(false), Rp = mk(true);
  let pairSum = 0, pairN = 0;
  for (const bk of Object.keys(S)) {
    if (!Rp[bk]) continue;
    const totS = Object.values(S[bk]).reduce((a, b) => a + b, 0);
    const totR = Object.values(Rp[bk]).reduce((a, b) => a + b, 0);
    if (totS >= 30 && totR >= 30) { pairSum += jsDiv(S[bk], Rp[bk]); pairN++; }
  }
  const cuL = cardUsageProfile(W, params, { games: 15, mode: 'long' });
  const cuM = cardUsageProfile(W, params, { games: 15, mode: 'multi' });
  const selfKeys = new Set([...Object.keys(cuL.pct || {}), ...Object.keys(cuM.pct || {})]);
  const winBy = {};
  for (const c of cells) winBy[c.opp + '@' + c.n + c.mode[0]] = { w: c.win, g: c.games };
  return {
    tag, path, decN,
    unionN: union.size, selfUnionN: selfKeys.size,
    envOnlySkills: [...union].filter((k) => !selfKeys.has(k)),
    selfOnlySkills: [...selfKeys].filter((k) => !union.has(k)),
    coverage, totalCells: cells.length,
    switchJs: pairN ? +(pairSum / pairN).toFixed(4) : null, switchJsCells: pairN,
    winRate: +(cells.reduce((a, c) => a + c.win, 0) / cells.reduce((a, c) => a + c.games, 0)).toFixed(4),
    winBy, cells,
  };
}

const OUT = arg('out', '');
const results = [];
for (const p of PACKS) {
  const tag = p.split('/').pop().replace(/\.bak$|\.js$/, '');
  const t0 = Date.now();
  let r = null;
  try { r = evalPack(tag, p); } catch (e) { console.error('⛔ ' + tag + ' ' + String(e).slice(0, 140)); continue; }
  r.sec = +((Date.now() - t0) / 1000).toFixed(1);
  results.push(r);
  console.error('[' + tag + '] 并集 ' + r.unionN + '（自对局 ' + r.selfUnionN + '） 换招JS ' + r.switchJs + '（' + r.switchJsCells + '桶） 胜率 ' + r.winRate + ' ' + r.sec + 's');
}
console.log('\n包'.padEnd(14) + '并集 自并集 环境独有  换招JS   胜率');
for (const r of results) {
  console.log(r.tag.padEnd(14) + [r.unionN, r.selfUnionN, r.envOnlySkills.length, r.switchJs, r.winRate].map((v) => String(v).padStart(6)).join(''));
}
if (results.length) {
  const allKeys = new Set(); for (const r of results) for (const k of Object.keys(r.coverage)) allKeys.add(k);
  const nc = results[0].totalCells;
  console.log('\n— 每技能环境覆盖（格数/' + nc + '，≥' + COVERTH + ' 手/格判"在该环境会用"）—');
  console.log('key'.padEnd(10) + results.map((r) => r.tag.slice(0, 9)).join(' ').padStart(results.length * 10));
  for (const k of [...allKeys].sort()) {
    console.log(k.padEnd(10) + results.map((r) => String(r.coverage[k] != null ? r.coverage[k] : '·').padStart(9)).join(' '));
  }
}
if (OUT) { writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8'); console.error('产物 → ' + OUT); }
