/* Epirus 2P 冠军 meta 补记（v1.5.18）
 *
 * 为什么要有它（第三方复核 §5-1，实测）：`js/bundled-champion.js`（2P 线上包）此前**没有 meta**：
 * 没有 `EPIRUS_CHAMPION_META`、没有 `rulesFingerprint`、没有成绩 ⇒ `np-test D16`
 * （"产物与引擎错配就报成绩已过期"）**完全看不到它**。而它最后一次重训是 v1.3.47，
 * 此后有 11 次提交动过 `js/core/rules.js` / `resolve.js`，其中 v1.5.7 还把【全息屏障】
 * 移出了 2P 卡表 —— 也就是说这个包是在"2P 还能用全息屏障"的规则下训出来的，
 * 而没有任何机械检查能发现。这是**溯源缺陷**（它现在仍能打），不是"已坏"。
 *
 * 本工具**不动一个权重字节**：只实测当前规则下的 2P 考卷成绩、把它与新指纹一起记进 meta。
 * 考卷口径 = `tools/train-best.mjs` 的 `evalChamp`（19 个基准 × 40 局，种子 20260207 + i*977，
 * `P.choose(temp 0.15)` 只挑可负担 —— 与页面「困难·冠军」一致），基准表来自单一来源
 * `tools/p2-baselines.mjs`。两个工具用同一份 evScore 门（任一基准 ≤50% 即不合格）。
 *
 * 用法：node tools/promote-champion2p.mjs [--note="..."] [--dry] [--games=40] [--skip-stamp]
 *   产物：js/bundled-champion.js（只多一行 meta）+ index.html 的 ?v= 缓存戳
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { rulesFingerprint, fingerprintOfBundle } from './rules-fingerprint.mjs';
import { P2_FNAME, P2_NAMES } from './p2-baselines.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const flag = (n, d) => { const h = process.argv.find((a) => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const NOTE = flag('note', '');
const GAMES = Number(flag('games', 40));
const DRY = process.argv.includes('--dry');
const SKIP_STAMP = process.argv.includes('--skip-stamp');
const BUNDLE = join(ROOT, 'js/bundled-champion.js');
const INDEX = join(ROOT, 'index.html');

if (existsSync(join(ROOT, 'docs/artifacts/.training.lock'))) {
  console.error('⛔ 训练正在进行（存在 docs/artifacts/.training.lock）—— 训练每轮都会改写/还原这个 bundle，等训练结束再跑。');
  process.exit(3);
}

/* ---------- 0) 沙箱（与 train-best / promote-champion 同一套） ---------- */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js', 'js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const W = sb.window;
const T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots, R = W.EpirusRules;

/* 与 train-best 同口径的播种（否则"构建时成绩"与它择优时报的数不可比） */
const SEED = Number(process.env.EPIRUS_SEED || 1);
(function seedSandbox(sbox, seed) {
  if (!seed) return;
  const M = Object.create(Math);
  let s = (seed >>> 0) || 1;
  M.random = function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  sbox.Math = M;
})(sb, SEED);
if (P.setRng && T.mulberry32) P.setRng(T.mulberry32(SEED * 7919 + 13));

/* ---------- 1) 读现有包（权重原样） ---------- */
const src = readFileSync(BUNDLE, 'utf8');
const champM = /window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/.exec(src);
if (!champM) { console.error('⛔ js/bundled-champion.js 里找不到 window.EPIRUS_CHAMPION'); process.exit(4); }
const packJson = champM[1];
const params = P.unpack(JSON.parse(packJson));
if (!params || !params.length) { console.error('⛔ 现有包解不出参数（先别急着写 meta）'); process.exit(4); }
console.log('现有 2P 包：参数量 ' + params.length + '，特征维度 shapeOf = ' + JSON.stringify(P.shapeOf(params)));
console.log('文件头注释：' + (src.split('\n')[0] || '').trim().slice(0, 120));

/* ---------- 2) 实测当前规则下的 2P 考卷 ---------- */
const champSel = function (state, pid, legal) {
  const aff = legal.filter((l) => l.affordable);
  const base = aff.length ? aff : [{ key: R.SK.JI, affordable: true }];
  return T.pickChampion(state, pid, base, params, 0.15);   // v7：候选感知
};
const per = {};
let tot = 0;
for (let i = 0; i < P2_NAMES.length; i++) {
  const nm = P2_NAMES[i];
  const fn = B[P2_FNAME[nm]];
  if (typeof fn !== 'function') { console.error('⛔ EpirusBots.' + P2_FNAME[nm] + ' 不存在（p2-baselines 与 bots.js 漂移）'); process.exit(4); }
  const r = T.correctedWinRate(champSel, fn, GAMES, 20260207 + i * 977);
  per[nm] = r.wr; tot += r.wr;
}
const avg = tot / P2_NAMES.length;
const mn = Math.min.apply(null, P2_NAMES.map((k) => per[k]));
const gateOk = P2_NAMES.every((k) => per[k] > 0.5);
console.log('\n== 2P 考卷（' + P2_NAMES.length + ' 基准 × ' + GAMES + ' 局，temp 0.15） ==');
for (const k of P2_NAMES) {
  console.log('   ' + k.padEnd(14) + (per[k] * 100).toFixed(1).padStart(6) + '%' + (per[k] > 0.5 ? '' : '   ← ≤50% 不合格'));
}
console.log('   平均 = ' + (avg * 100).toFixed(2) + '%   最差基准 = ' + (mn * 100).toFixed(2) + '%   过门 = ' + (gateOk ? '是' : '否'));
if (!gateOk) console.warn('   ⚠️ 有基准 ≤50% ⇒ 按项目的冠军门（严格 >50%）这个包不合格。本次只做**如实记录**，不换包；要换请重训后再 promote。');

/* ---------- 3) 写 meta（权重逐字节不变） ---------- */
const fp = rulesFingerprint();
const meta = {
  source: 'js/bundled-champion.js（原注释：' + (src.split('\n')[0] || '').replace(/^\/\*\s*|\s*\*\/$/g, '').trim().slice(0, 90) + '）',
  shippedAs: NOTE || '2P 默认冠军（tools/promote-champion2p.mjs 仅补记 meta，未改动权重）',
  examMode: '2p-standard', examBaselines: P2_NAMES.length, examGames: GAMES, examSeedBase: 20260207,
  examScoreAtBuild: Number(avg.toFixed(4)), examMinBaseline: Number(mn.toFixed(4)), examGateOk: gateOk,
  examAt: new Date().toISOString().slice(0, 10), rulesFingerprint: fp,
  selfPlayNote: '2P 自对局是镜像局（项目实测几乎全平），故不作为活跃度指标；打架活跃度看 19 基准胜率'
};
const metaRe = /window\.EPIRUS_CHAMPION_META\s*=\s*\{[\s\S]*?\}\s*;/;
const out = metaRe.test(src)
  ? src.replace(metaRe, 'window.EPIRUS_CHAMPION_META = ' + JSON.stringify(meta) + ';')
  : src.replace(champM[0], 'window.EPIRUS_CHAMPION_META = ' + JSON.stringify(meta) + ';\n' + champM[0]);

/* 回读自检（promote-champion 第一版写坏槽位就是靠这个 + np-test 抓到的） */
const reChamp = /window\.EPIRUS_CHAMPION\s*=\s*(\{[\s\S]*?\})\s*;/.exec(out);
if (!reChamp) { console.error('⛔ 自检失败：写出的文件里找不到冠军槽（已中止，未落盘）'); process.exit(5); }
if (reChamp[1] !== packJson) { console.error('⛔ 自检失败：冠军槽的字节变了（本工具不该动权重）—— 已中止'); process.exit(5); }
const reParams = P.unpack(JSON.parse(reChamp[1]));
const chk = P.checkPack ? P.checkPack(JSON.parse(reChamp[1])) : { ok: true };
if (!reParams || !reParams.length || chk.ok === false) {
  console.error('⛔ 自检失败：checkPack ' + JSON.stringify(chk) + '（已中止，未落盘）'); process.exit(5);
}
const mchk = /window\.EPIRUS_CHAMPION_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(out);
if (!mchk || JSON.parse(mchk[1]).rulesFingerprint !== fp) { console.error('⛔ 自检失败：meta 槽读不回新指纹'); process.exit(5); }
console.log('\n回读自检：冠军包 ok（参数量 ' + reParams.length + '，权重逐字节未变）；meta 指纹 = ' + fingerprintOfBundle(out));

if (DRY) { console.log('--dry：未写盘。'); process.exit(0); }
writeFileSync(BUNDLE, out, 'utf8');

/* ---------- 4) 刷缓存戳（否则浏览器继续用旧包） ---------- */
if (!SKIP_STAMP) {
  const html = readFileSync(INDEX, 'utf8');
  const before = (html.match(/bundled-champion\.js\?v=[0-9a-z]+/i) || [])[0];
  const html2 = html.replace(/(bundled-champion\.js\?v=)[0-9a-z]+/i, '$1' + Date.now().toString(36));
  writeFileSync(INDEX, html2, 'utf8');
  console.log('缓存戳 ' + before + ' → ' + ((html2.match(/bundled-champion\.js\?v=[0-9a-z]+/i) || [])[0]));
}
console.log('\n✅ 已补记：js/bundled-champion.js   rulesFingerprint = ' + fp + '（meta 里记的 = ' + fingerprintOfBundle(out) + '）');
console.log('   下一步：node tools/np-test.mjs（D16 现在会同时守 2P 与 3P 两个包）');
