#!/usr/bin/env node
/* seg-widths-1103.mjs — 把 11-03 落盘的**深度快照**逐个量一遍宽度/族别（qoder · 给"冠军演化可视化"喂数）
 * 问的是：一枚包的"宽"与"防御族"是**第几代**定下来的？（§十五 说两盆之间有势垒，那这条曲线就是势垒的形状）
 * 口径不自造：`fieldProfile(params, 0, 'soft', GAMES, 77000, 'scripts', 'long')` ‖ 种数 = 非ジ且份额 ≥0.5%
 *   （与 `scratch/breadth.mjs:43`、`train-3p` 的 selGrid 同一条）‖ 防御族 = 引擎 `cat === R.CAT.DEFENSE`。
 * ⚠ 分母 = 12 局长桌（配对：所有快照同一颗 seed）⇒ 看**趋势**可以，看单点绝对值不行（0.5% 线在 12 局上约等于"打过 1 次"）。
 * 用法：node scratch/seg-widths-1103.mjs [--games=12] [--mode=long] [--out=scratch/seg-widths-1103.tsv]
 */
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const ROOT = path.resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const f = argv.find((x) => x.startsWith('--' + k + '=')); return f ? f.slice(k.length + 3) : d; };
const known = ['games', 'mode', 'out', 'glob', 'gen'];
const bad = argv.filter((x) => x.startsWith('--') && !known.includes(x.slice(2).split('=')[0]));
if (bad.length) { console.error('⛔ 不认识的旗标：' + bad.join(' ') + '（可用 --games= --mode= --out= --glob=）'); process.exit(64); }
const GAMES = Math.max(4, Number(arg('games', 12)) || 12);
const GMODE = String(arg('mode', 'long'));
const OUT = String(arg('out', 'scratch/seg-widths-1103.tsv'));
const GLOBG = String(arg('glob', ''));

const { fieldProfile, WIN } = await import(pathToFileURL(ROOT + '/tools/behavior-profile.mjs').href);
const { install: installArch2, readPack2, packCfgExit, verifyWired: verifyArch2Wired } = await import(pathToFileURL(ROOT + '/tools/proto2/arch2.mjs').href);
const { parseMetaTolerant, loadChamp } = await import(pathToFileURL(ROOT + '/tools/audit-lib.mjs').href);

/* ⚑ 混代必须**分两次跑**（`breadth.mjs` 的在册坑 + 今天这一次实测的病）：
 *   v7 快照进了装好 arch2 的沙箱 ⇒ `packCfgExit` 直接 `process.exit(2)` 把整批带走（17:33 实测死在 V7C-s13-seg1）
 *   ⇒ 这里先用**文本预扫**判容器版本，只处理 `--gen=` 点名的那一代，另一代留给第二次进程（arch2 装上就摘不掉）。 */
const WANT_GEN = Number(arg('gen', 92));
const versionOf = (txt) => {
  const m = /EPIRUS_CHAMPION_3P\s*=\s*\{\s*"v"\s*:\s*(\d+)/.exec(txt) || /EPIRUS_CHAMPION_3P\s*=\s*\{\s*v\s*:\s*(\d+)/.exec(txt);
  return m ? Number(m[1]) : null;
};

const SPEC = 'S1ob:input=obs3b,gen=3,keySplit=1';
const cfg = Object.fromEntries(SPEC.split(':')[1].split(',').map((kv) => { const [k, v] = kv.split('='); return [k, /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v]; }));
let A2 = null, WC = null;
if (WANT_GEN !== 7) {
  A2 = installArch2(WIN, cfg);
  WC = verifyArch2Wired(WIN, A2, { mode: 'multi', n: 5, games: 1 });
  console.error('接线自证：' + JSON.stringify(WC) + ' ‖ 面=' + A2.L.input + ' ‖ 量具 n=' + GAMES + ' 局/' + GMODE + '（seed 77000 配对）');
} else {
  console.error('代=v7 ⇒ **不装** arch2（量具沙箱走原生 v7 通路）‖ 量具 n=' + GAMES + ' 局/' + GMODE + '（seed 77000 配对）');
}

/* 收集快照 */
const dirs = fs.readdirSync(ROOT + '/scratch/ga-bands').filter((d) => {
  try { return fs.statSync(ROOT + '/scratch/ga-bands/' + d).isDirectory(); } catch (e) { return false; }
});
const segs = [];
for (const d of dirs) {
  for (const f of fs.readdirSync(ROOT + '/scratch/ga-bands/' + d)) {
    if (!/-seg\d+\.bak$/.test(f)) continue;
    const p = 'scratch/ga-bands/' + d + '/' + f;
    if (GLOBG && !p.includes(GLOBG)) continue;
    segs.push(p);
  }
}
segs.sort();
console.error('找到 ' + segs.length + ' 枚深度快照');

const R = WIN.EpirusRules, JI = R.SK.JI;
const defB = (d) => (d < 0.5 ? 0 : d < 3 ? 1 : d < 8 ? 2 : 3);
const kindB = (k) => (k < 5 ? 0 : k < 8 ? 1 : k < 11 ? 2 : 3);
const rows = [];
let skip = 0, skipGen = 0, metaBroken = 0;
for (let i = 0; i < segs.length; i++) {
  const p = segs[i];
  const txt = fs.readFileSync(ROOT + '/' + p, 'utf8');
  const vg = versionOf(txt);
  if (vg !== WANT_GEN) { skipGen++; continue; }   /* 另一代留给第二次进程（不是错误，也不许当"读不出"） */
  let meta = null;
  /* 快照的账在 `EPIRUS_CHAMPION_3P_META`（segIndex/gen/fit/arm/hotstartFrom）。`parseMetaTolerant` 吃的是
   * 体检外壳那种形状 ⇒ 对 seg 返回空（实测 78 行的 seg/gen/fit 全空）；这里直接抓那一行 JSON，抓不到就**留 null**，不许瞎猜。 */
  try {
    const mm = /EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt);
    if (mm) meta = JSON.parse(mm[1]);
  } catch (e) { meta = null; }
  if (!meta) metaBroken++;
  let pv = null;
  try {
    if (WANT_GEN === 7) pv = Float64Array.from(loadChamp(WIN, p, ROOT));   /* v7 外壳走 audit-lib 的读口（同一个，不另写） */
    else { const raw = readPack2(p); pv = Float64Array.from(WIN.EpirusPolicy.unpack(raw, true)); if (String(raw.dims && raw.dims.input) !== A2.L.input) throw new Error('面=' + (raw.dims && raw.dims.input)); }
  }
  catch (e) { skip++; console.error('  跳过 ' + p + '：' + String(e && e.message || e).slice(0, 50)); continue; }
  const t = fieldProfile(pv, 0, 'soft', GAMES, 77000, 'scripts', GMODE);
  const acts = t.acts || 0;
  const dsh = acts ? 100 * (t.def || 0) / acts : 0;
  const ks = Object.keys(t.keys || {}).filter((k) => k !== JI && acts && ((t.keys[k] || 0) / acts) >= 0.005)
    .sort((a, b) => t.keys[b] - t.keys[a]);
  const defKinds = ks.filter((k) => { const d = R.byKey[k]; return d && d.cat === R.CAT.DEFENSE; });
  rows.push({
    path: p, arm: (meta && meta.arm) || path.basename(path.dirname(p)), seg: (meta && meta.segIndex) || null,
    gen: (meta && meta.gen) || null, fit: (meta && typeof meta.fit === 'number') ? Number(meta.fit.toFixed(4)) : null,
    hotstartFrom: (meta && meta.hotstartFrom) || null, kinds: ks.length, defShare: Number(dsh.toFixed(1)),
    defKinds: defKinds.length, cell: 'D' + defB(dsh) + 'K' + kindB(ks.length), keys: ks.join(' ')
  });
  if ((i + 1) % 12 === 0) console.error('  进度 ' + (i + 1) + '/' + segs.length + '（' + new Date().toTimeString().slice(0, 8) + '）');
}
const tsv = ['arm\tseg\tgen\tfit\tkinds\tdefShare\tdefKinds\tcell\tkeys\tpath'];
for (const r of rows) tsv.push([r.arm, r.seg, r.gen, r.fit, r.kinds, r.defShare, r.defKinds, r.cell, r.keys, r.path].join('\t'));
fs.writeFileSync(ROOT + '/' + OUT, tsv.join('\n') + '\n', 'utf8');
fs.writeFileSync(ROOT + '/' + OUT.replace(/\.tsv$/, '.json'), JSON.stringify({ caliber: { instrument: 'behavior-profile.fieldProfile', eps: 0, temp: 'soft', games: GAMES, seed0: 77000, field: 'scripts', gamemode: GMODE, kindsFloor: '非ジ且份额≥0.5%', defCat: 'R.CAT.DEFENSE', gen: WANT_GEN, wired: WC }, n: rows.length, skipped: skip, skippedOtherGen: skipGen, rows: rows }, null, 1), 'utf8');
console.log('✔ 量到 ' + rows.length + ' 枚（读不出 ' + skip + ' ‖ 另一代留给第二进程 ' + skipGen + ' ‖ META 抓不到 ' + metaBroken + '）‖ 落盘 ' + OUT + ' ‖ ' + OUT.replace(/\.tsv$/, '.json') + ' ‖ ' + new Date().toTimeString().slice(0, 8));
const byArm = {};
for (const r of rows) { (byArm[r.arm] = byArm[r.arm] || []).push(r); }
for (const a of Object.keys(byArm).sort()) {
  console.log('  ' + a.padEnd(16) + ' ' + byArm[a].map((r) => 'g' + r.gen + ':种' + r.kinds + '/防' + r.defShare + '%').join(' ‖ '));
}
