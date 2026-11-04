#!/usr/bin/env node
/* coldstart-temp-1104.mjs —— **出生粒的"成绩方差"住在哪个温度上**（11-04 晚 · 千问）
 *
 * 背景（两台在册读数看着打脸的地方）：
 *   ‌千问 11-04 午后：2.0 随机粒在**产品温度 temp=0.15·ε=0** 的聚合行为上粒间 sd ≈ 1.7pt ⇒ "选择看不见方差"。
 *   ‌DS 11-04 晚 `scratch/face-variance.log`（未入库）：同一批粒在 **temp≈1e-9 的 argmax** 上粒间 sd **38.1pt**、
 *     而抬到 scale=4 反而 sd 0.8pt ⇒ 与"没方差"看着相反。
 *   ⇒ 两条**只差一个温度**，而真正决定 GA 能不能选的是**打分那一档**：
 *     `js/train/evo.js:648` 出厂 `fitChooser` = `policyChooserN(params, 0.35, 0.15)`（epsK 默认 5、epsMode=原口径），
 *     门禁/在册尺 = temp 0.15·ε=0，产品档 = temp 0.15·ε=0.2·soft（`js/ui/ui.js:722` 那段裁定）。
 *
 * 这台尺的问题（跑前写死）：**同一批 N 枚随机粒、同一副桌种子**，只把 (temp, ε, mode) 换成下面五个真实档 ⇒
 *   粒间夺 1 率的 sd 什么时候明显大于"纯抽样地板"（√(p(1−p)/G)）？
 *   判据（先写死）：`sd > 2×地板` 记 **看得见**；否则 **看不见**（不是"方差=0"，是"选择拿它没办法"）。
 *
 * 四条自守（都是本仓在册病名，先钉在自己尺上）：
 *   ① **装载自证**：`paramCount` 必须 5689(v7) / 7993(2.0)，且 2.0 的 cfg 从真产物 `packCfgExit` 读（不自己拼 dims）。
 *   ② **种子真注入**：`makePolicy(scale)` **不吃第二个参数**（`policy.js:486` / `arch2.mjs:809` 都只收 scale，默认流是
 *      `Math.random` ⇒ DS 的 `makePolicy(scale, mulberry32(s))` 是**空注入**，它的"四粒四种子"不可复现）。
 *      本尺走仓里唯一活的那条：`P.setRng(mulberry32(·))`（v7 面）与 `P.__arch2.rngRef.r = mulberry32(·)`（2.0 面），
 *      接不上就**当场退**，不许把"没接上"读成"没方差"。
 *   ③ **同一批粒跨档自证**：每粒带一个权重校验和；同一 (面,幅度) 的五个档必须见到**同一组**校验和 ⇒ 不同就是没配对。
 *   ④ **正对照**：v7 随机粒在 gate015 那格必须"看得见"（在册 sd 23.6pt）；判成"看不见"⇒ 这台尺不可信，读数全标灰。
 *   ⚑ 分进程：v7 与 2.0 各起子进程，且**每个温度档一个子进程**（`installArch2` 与 behavior-profile 的 `TEMP` 都是进程内/模块级一次读）。
 *
 * 用法：node scratch/coldstart-temp-1104.mjs [--N=8] [--G=24] [--seed0=66000] [--epsk=5]
 *       读数落 scratch/coldstart-temp-1104.txt 与 .tsv
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const SELF = import.meta.filename || fileURLToPath(import.meta.url);   // ESM 里没有 __filename

const ARG = {};
for (const a of process.argv.slice(2)) { const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a); if (m) ARG[m[1]] = m[2] === '' ? '1' : m[2]; }

/* 五个档：label = 谁在用这一档（temp / ε / 探索模式） */
const CELLS = [
  ['fit035', 0.35, 0.15, 'uniform', '训练打分出厂档（evo.js:648 fitChooser）'],
  ['gate015', 0.15, 0, 'soft', '门禁与在册尺口径（ε=0）'],
  ['low005', 0.05, 0, 'soft', '更低的抽样温度'],
  ['near0', 0.001, 0, 'soft', '≈argmax（DS 两把新尺在这一格附近）'],
  ['nano6', 0.000001, 0, 'soft', '极端档：用来**定位**分差的量级'],
  ['prod015', 0.15, 0.2, 'soft', '产品档（浏览器冠军那一行）'],
];
const FACES = [['7', [0.25]], ['2', [0.25, 4]]];
const PSEED = 4242;                       // 粒子号 → 种子（同一粒跨档逐字同）

/* 权重校验和（FNV-1a 量化到 4 位小数 ⇒ 只在"同一粒"上相等） */
function wsum(v) {
  let h = 0x811c9dc5;
  for (let i = 0; i < v.length; i += 7) {
    const q = Math.round(v[i] * 10000);
    h ^= q < 0 ? ~q * 2 + 1 : q;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

if (ARG.cell) {                                    /* ===== 子进程：一个 (面, 档) 一档，量完就退 ===== */
  const cell = CELLS.find(c => c[0] === ARG.cell);
  if (!cell) { console.error('⛔ 不认识的档 ' + ARG.cell); process.exit(64); }
  const [, TEMP, EPS, MODE] = cell;
  const FACE = ARG.face, N = Number(ARG.N || 8), G = Number(ARG.G || 24), SEED0 = Number(ARG.seed0 || 66000);
  /* ★ 剂量必须先进 argv，再 import 量具（TEMP 是 behavior-profile 的模块级 const，只在 import 时读一次） */
  process.argv.push('--temp=' + TEMP, '--epsk=' + Number(ARG.epsk || 5));
  const { fieldProfile, WIN } = await import('../tools/behavior-profile.mjs').then(m => m.default || m);
  const { mulberry32 } = await import('../tools/audit-lib.mjs');
  const P = WIN.EpirusPolicy;
  if (FACE === '2') {
    const { readFileSync } = await import('node:fs');
    const { install: installArch2, packCfgExit } = await import('../tools/proto2/arch2.mjs');
    const SRC = process.env.CFG_FROM || 'scratch/ga-arms/CB13.js';
    const raw = JSON.parse(/window\.EPIRUS_CHAMPION_3P = (\{[\s\S]*?\});/.exec(readFileSync(SRC, 'utf8'))[1]);
    installArch2(WIN, packCfgExit(raw, SRC).cfg);
    if (!(P.__arch2 && P.__arch2.rngRef)) { console.error('⛔ 2.0 面的 rng 抓手不在（P.__arch2.rngRef 读不到）⇒ 种子注不进去，本尺判"读不出"'); process.exit(7); }
  } else if (typeof P.setRng !== 'function') {
    console.error('⛔ v7 面没有 setRng ⇒ 种子注不进去（用 Math.random 抽的"四粒"不可复现），本尺判"读不出"'); process.exit(7);
  }
  const setSeed = (s) => { if (FACE === '2') P.__arch2.rngRef.r = mulberry32(s); else P.setRng(mulberry32(s)); };
  const PC = P.paramCount(), EXPECT = { 7: 5689, 2: 7993 };
  if (PC !== EXPECT[FACE]) { console.error('⛔ 装载自证失败：face=' + FACE + ' paramCount=' + PC + ' 期望=' + EXPECT[FACE]); process.exit(5); }
  const JI = WIN.EpirusRules.SK.JI;
  for (const sc of (FACE === '2' ? [0.25, 4] : [0.25])) {
    for (let i = 0; i < N; i++) {
      setSeed(PSEED + i);                                  // ← 同一粒跨档逐字同（自守②）
      const v = Float64Array.from(P.makePolicy(sc));
      const sig = wsum(v);
      const pr = fieldProfile(v, EPS, MODE, G, SEED0 + i * 1000, 'scripts', 'multi');
      const acts = pr.acts || 0;
      process.stdout.write('#JSON ' + JSON.stringify({
        cell: ARG.cell, face: FACE, scale: sc, i, sig,
        win: 100 * (pr.wins || 0) / (pr.decisive || G),
        def: acts ? 100 * (pr.def || 0) / acts : 0,
        acts: acts,
        kinds: Object.keys(pr.keys || {}).filter(k => k !== JI && acts && (pr.keys[k] / acts) >= 0.005).length,
      }) + '\n');
    }
  }
  process.exit(0);
}

/* ===== 父进程：逐档起子进程、汇总、判"看得见/看不见" ===== */
const N = Number(ARG.N || 8), G = Number(ARG.G || 24), SEED0 = Number(ARG.seed0 || 66000);
const rows = [], tsv = [];
const t0 = Date.now();
for (const [FACE] of FACES) {
  for (const [label] of CELLS) {
    let out;
    try {
      out = execFileSync(process.execPath, [SELF, '--face=' + FACE, '--cell=' + label, '--N=' + N, '--G=' + G,
        '--seed0=' + SEED0, '--epsk=' + (ARG.epsk || 5)], { encoding: 'utf8', maxBuffer: 1 << 26 });
    } catch (e) {
      console.error('⛔ 子进程失败 face=' + FACE + ' 档=' + label + '：' + String(e.stderr || e.message).slice(0, 300));
      process.exit(3);
    }
    let got = 0;
    for (const line of out.split('\n')) {
      if (line.startsWith('#JSON ')) { rows.push(JSON.parse(line.slice(6))); got++; }
    }
    if (got === 0) { console.error('⛔ 档 ' + label + '（面 ' + FACE + '）一粒都没收到 ⇒ 子进程静默，判"读不出"'); process.exit(3); }
    process.stderr.write('  面' + FACE + ' 档 ' + label + ' 收 ' + got + ' 行 · 累计 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's\n');
  }
}
const key = (r) => r.face + '/' + r.scale + '/' + r.cell;
const groups = new Map();
for (const r of rows) { const k = key(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const f = (x, w = 7) => String(x == null ? '—' : (Math.round(x * 10) / 10).toFixed(1)).padStart(w);

/* 自守②b（剂量真接线）：同一 (面,幅度) 五个档若**整条行为签名**（夺1/防御族/种数）完全相同 ⇒ 温度没接上。
 *   ⚑ 第一版只比夺 1 均值 ⇒ 小剂量下两粒全输也会"完全相同"，那是**分母不足**，不是接线坏（21:5x 冒烟当场被自己拦住）。 */
const dead = [], flatWin = [];
for (const [FACE, scales] of FACES) for (const sc of scales) {
  const sigs = CELLS.map(c => groups.get(FACE + '/' + sc + '/' + c[0])).filter(Boolean)
    .map(g => [mean(g.map(r => r.win)), mean(g.map(r => r.def)), mean(g.map(r => r.kinds))].map(x => x.toFixed(3)).join('|'));
  if (sigs.length > 1 && new Set(sigs).size === 1) dead.push('面' + FACE + '@' + sc);
  const wins = CELLS.map(c => groups.get(FACE + '/' + sc + '/' + c[0])).filter(Boolean).map(g => mean(g.map(r => r.win)).toFixed(3));
  if (wins.length > 1 && new Set(wins).size === 1) flatWin.push('面' + FACE + '@' + sc);
}
if (dead.length) { console.error('⛔ 剂量没接线：' + dead.join(',') + ' 在五个温度档读出**完全相同**的行为签名 ⇒ 本批作废'); process.exit(4); }
/* 自守③（同一批粒）：每个 (面,幅度) 各档的校验和集合必须逐字相同 */
const drifted = [];
for (const [FACE, scales] of FACES) for (const sc of scales) {
  const sets = CELLS.map(c => (groups.get(FACE + '/' + sc + '/' + c[0]) || []).map(r => r.sig).sort().join(','));
  if (new Set(sets).size !== 1) drifted.push('面' + FACE + '@' + sc);
}
if (drifted.length) { console.error('⛔ 配对是假的：' + drifted.join(',') + ' 各档看到的不是同一批权重 ⇒ 本批作废'); process.exit(8); }

const L = [];
L.push('# 出生粒的"成绩方差"住在哪个温度上（' + N + ' 粒随机起点 × ' + G + ' 局/粒 ‖ 桌=五席脚本场 multi ‖ seed0=' + SEED0 +
  ' ‖ 同批粒同副桌种子跨档配对 ‖ epsK=' + (ARG.epsk || 5) + ' ‖ 粒子种子=mulberry32(' + PSEED + '+i) 真注入）');
L.push('# 判据（跑前写死）**两个统计量分开判**：');
L.push('#   行为（防御族份额，分母=每粒出手数）：粒间 sd > 2×√(d(1−d)/出手) ⇒ **看得见** ← 这是主判据（午后 §二 用 31.3 vs ~4pt 定过标）');
L.push('#   成绩（夺 1，分母=G=' + G + ' 局）：同样比 2×√(p(1−p)/' + G + ') ⇒ 这一格的地板先天就有 ~' + (100 * Math.sqrt(0.075 * 0.925 / G)).toFixed(0) +
  'pt，**它判"读不出"而不是判"没差异"**（GA 真正吃的是这个，所以它自己也是一条读数）');
L.push('# 尺 = scratch/coldstart-temp-1104.mjs ‖ 六个档就是六个**真实在用的档 + 一档定位用**（训练打分 / 门禁 / 低温 / ≈argmax / 极端 / 产品）');
if (flatWin.length) L.push('⚑ ' + flatWin.join(',') + ' 的夺 1 均值跨六个温度档**全等** ⇒ 那一格的夺 1 在本剂量下没有分辨力（不代表温度没用），该行判读要看"防御族/种数"两列');
L.push('');
L.push('面@幅度  档       口径(T/ε/mode)    说明                            夺1均值  成绩sd 成绩地板 成绩判读  防御族均值 行为sd 行为地板 行为判读  种数');
const BEH = {};                        // (面,幅度,档) → 行为判读，供下面的读法与正对照用
for (const [FACE, scales] of FACES) {
  for (const sc of scales) {
    for (const [label, temp, eps, mode, note] of CELLS) {
      const g = groups.get(FACE + '/' + sc + '/' + label);
      if (!g || g.length < 2) { L.push((FACE === '2' ? '2.0' : 'v7 ') + '@' + String(sc).padEnd(5) + label.padEnd(8) + ' ⇒ 没收齐（' + (g ? g.length : 0) + ' 粒）'); continue; }
      const w = g.map(r => r.win), m = mean(w), s = sd(w);
      const wf = 100 * Math.sqrt(Math.max(1e-6, (m / 100) * (1 - m / 100) / G));
      const wv = s > 2 * wf ? '看得见' : '读不出';
      const d = g.map(r => r.def), dm = mean(d), ds = sd(d);
      const A = mean(g.map(r => r.acts)) || 1;
      const df = 100 * Math.sqrt(Math.max(1e-6, (dm / 100) * (1 - dm / 100) / A));
      const dv = ds > 2 * df ? '看得见' : '看不见';
      BEH[FACE + '/' + sc + '/' + label] = { ds, df, dv, dm, wv, s, wf, m, kinds: mean(g.map(r => r.kinds)) };
      L.push((FACE === '2' ? '2.0' : 'v7 ') + '@' + String(sc).padEnd(5) + label.padEnd(8) +
        (temp + '/' + eps + '/' + mode).padEnd(16) + note.padEnd(28).slice(0, 28) +
        f(m) + f(s) + f(2 * wf) + '  ' + wv.padEnd(6) + f(dm) + f(ds) + f(2 * df) + '  ' + dv.padEnd(6) + f(mean(g.map(r => r.kinds))));
      tsv.push([FACE, sc, label, temp, eps, mode, m.toFixed(2), s.toFixed(2), (2 * wf).toFixed(2), wv,
        dm.toFixed(1), ds.toFixed(2), (2 * df).toFixed(2), dv, mean(g.map(r => r.kinds)).toFixed(2), A.toFixed(0)].join('\t'));
    }
  }
}
/* 自守④：正对照 = v7 随机粒在 gate015 那格的**行为**方差（午后在册 sd 31.3pt ‖ 地板 ~4pt） */
const c = BEH['7/0.25/gate015'];
L.push('');
L.push('正对照（v7@0.25 · gate015 · 防御族份额）：' + (c ? '均值 ' + c.dm.toFixed(1) + ' ‖ 粒间 sd ' + c.ds.toFixed(1) + ' ‖ 2×地板 ' +
  c.df.toFixed(1) + ' ‖ ' + (c.dv === '看得见' ? '**过**（这台尺看得见真方差 ⇒ 它给的"看不见"才算数）' : '⛔ **没过** ⇒ 下面所有"看不见"要降级成"读不出"')
  : '没收齐 ⇒ 整批判"读不出"'));
L.push('');
L.push('⚑ 读法：把"防御族均值随温度**动不动**"当分差的指纹——');
L.push('   v7 从 0.35 一路到 ≈argmax，防御族明显往下走 ⇒ 它的候选分差与这些温度同量级；');
L.push('   2.0@0.25 若一路不动（要到 nano6=1e-6 那种产品绝不会用的档才动）⇒ **分差比温度小好几个数量级**，');
L.push('   ⇒ "把选择降到低温"这条路**不成立**，而 DS 的 argmax 读数（sd 38pt）住的正是产品/训练都不用的那一格。');
L.push('   反之若 2.0@0.25 在 low005/near0 就"看得见"了 ⇒ 这条路成立，比 `INIT_SCALE=4`（拿宽度换方差）便宜。');

const TXT = 'scratch/coldstart-temp-1104.txt', TSVF = 'scratch/coldstart-temp-1104.tsv';
writeFileSync(TXT, L.join('\n') + '\n');
writeFileSync(TSVF, '#face\tscale\tcell\ttemp\teps\tmode\tmeanWin\twinSd\twin2floor\twinVerdict\tmeanDef\tbehSd\tbeh2floor\tbehVerdict\tkinds\tactsPerParticle\n' + tsv.join('\n') + '\n');
console.log(L.join('\n'));
console.log('\n已落盘：' + TXT + ' ‖ ' + TSVF + ' ‖ 用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
