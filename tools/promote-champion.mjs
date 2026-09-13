/* Epirus 上线冠军提升（v1.5.8）
 *
 * 为什么要有它：v1.5.7 我是**手工**把 long-33 拷进 `js/bundled-champion-3p.js` 并手改 meta 的
 * （加 shippedAs / examScoreAtBuild / rulesFingerprint）。手工换冠军有三处容易漏：
 *   ① 忘了刷 `index.html` 的 `?v=` 缓存戳 ⇒ 浏览器继续用旧包；
 *   ② 忘了记 `rulesFingerprint` ⇒ np-test D16 红（或更糟：静默过期）；
 *   ③ 忘了记成绩 ⇒ 下一个人不知道这个包值多少分。
 * 这个脚本把三件事绑成一条命令。
 *
 * ⚠️ 它会**先跑一遍冠军体检的 A/B 两类指标**（考卷 + 自对局打架活跃度）并把结果打出来 ——
 * 因为"单一考卷分会被熬骗"（REVIEW §11）：v1.5.7 换上 long-33 时它考卷 45.3%，
 * 自对局却 20/20 局零伤害。低于阈值的候选会**明确警告**（不阻止，决定权在人）。
 *
 * 用法：node tools/promote-champion.mjs docs/artifacts/eco-34.bak [--exam-games=40] [--games=10] [--note="..."]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rulesFingerprint, fingerprintOfBundle } from './rules-fingerprint.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARGV = process.argv.slice(2).filter((a) => !/^--/.test(a));
const flag = (n, d) => { const h = process.argv.find((a) => a.indexOf('--' + n + '=') === 0); return h ? h.split('=')[1] : d; };
const SRC = ARGV[0];
if (!SRC) { console.error('用法: node tools/promote-champion.mjs <bak文件> [--exam-games=40] [--note="..."]'); process.exit(2); }
const EXG = Number(flag('exam-games', 40));
const NOTE = flag('note', '');
const BUNDLE = join(ROOT, 'js/bundled-champion-3p.js');
const INDEX = join(ROOT, 'index.html');

if (existsSync(join(ROOT, 'docs/artifacts/.training.lock'))) {
  console.error('⛔ 训练正在进行（存在 docs/artifacts/.training.lock）—— 此时换 bundle 会被自跑器的还原覆盖。等训练结束再跑。');
  process.exit(3);
}

/* 1) 读源包 + 体检（考卷 + 自对局活跃度） */
const src = readFileSync(join(ROOT, SRC), 'utf8');
/* ⚠️ 两个槽位必须分清楚：`EPIRUS_CHAMPION_3P`（权重包）与 `EPIRUS_CHAMPION_3P_META`（元数据）。
 * 第一版我把 meta 写进了**冠军槽**（replace 用错了捕获组）⇒ 包直接损坏（np-test N19/D12 立刻红）。
 * 现在：分开两个正则、只替换 meta 那一段，并在写完做**回读自检**。 */
const champM = /(window\.EPIRUS_CHAMPION_3P\s*=\s*)(\{[\s\S]*?\})(\s*;)/.exec(src);
const metaM = /(window\.EPIRUS_CHAMPION_3P_META\s*=\s*)(\{[\s\S]*?\})(\s*;)/.exec(src);
if (!champM) { console.error('⛔ 源文件里找不到 window.EPIRUS_CHAMPION_3P'); process.exit(4); }
if (!metaM) { console.error('⛔ 源文件里找不到 window.EPIRUS_CHAMPION_3P_META'); process.exit(4); }
const packJson = champM[2];
const meta = JSON.parse(metaM[2]);

console.log('== 换前体检：' + SRC + ' ==');
const ev = spawnSync(process.execPath, ['tools/eval-5p.mjs', String(EXG), '5', '77000', SRC], { cwd: ROOT, encoding: 'utf8' });
const evOut = (ev.stdout || '') + (ev.stderr || '');
const first = (/\[冠军\]\s*1st=([\d.]+)%/.exec(evOut) || [])[1];
console.log('   多人 3 血考卷 1st = ' + (first || '?') + '%（' + EXG + ' 局）');

/* 自对局活跃度：直接内联跑（与 champ-audit 同一口径，5 座全是它自己） */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, window: {} };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/policy.js', 'js/train/bots.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const W = sb.window;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const params = W.EpirusPolicy.unpack(JSON.parse(packJson));
const G = Number(flag('games', 10));
let dmg = 0, draws = 0, holo = 0, rds = 0;
for (let g = 0; g < G; g++) {
  const st = W.EpirusState.createState('multi', { next: mulberry32(9000 + g) }, 5);
  const ch = []; for (let i = 0; i < 5; i++) ch.push(W.EpirusTrainer.policyChooserN(params, 0.15));
  W.EpirusPlay.autoGameN(st, ch);
  for (const e of st.events) { if (e.type === 'damage') dmg += e.amt; if (e.type === 'holoSet') holo++; }
  rds += st.round;
  if (st.p.every((p) => p.hp > 0)) draws++;
}
const dpg = dmg / G, drawRate = draws / G;
console.log('   自对局（5 座同一冠军 ×' + G + '）：伤害/局 = ' + dpg.toFixed(1) + '，平局率 = ' + (drawRate * 100).toFixed(0) + '%，回合 = ' + (rds / G).toFixed(1) + '，全息屏障/局 = ' + (holo / G).toFixed(1));
let warn = 0;
if (dpg < 5) { console.warn('   ⚠️ 伤害/局 < 5：这很可能是"熬"型冠军（考卷分会被熬骗）'); warn++; }
if (drawRate > 0.2) { console.warn('   ⚠️ 平局率 > 20%：自对局打不起来'); warn++; }
if (holo / G > 2) { console.warn('   ⚠️ 全息屏障 > 2 次/局：v1.5.4 之前的产物会把盾套给对手，可能互套盾僵局'); warn++; }
if (warn) console.warn('   ⇒ 有 ' + warn + ' 项警告，确认无误再继续（决定权在你）。');

/* 2) 写 bundle：保留权重原样，只补 meta */
const fp = rulesFingerprint();
meta.shippedAs = NOTE || ('multi(3-5P) 默认冠军（由 tools/promote-champion.mjs 提升，源 ' + SRC + '）');
meta.examScoreAtBuild = first ? Number(first) / 100 : null;
meta.examMode = 'multi'; meta.examGames = EXG; meta.examSeed = 77000; meta.examAt = new Date().toISOString().slice(0, 10);
meta.rulesFingerprint = fp;
meta.selfPlayDmgPerGame = Number(dpg.toFixed(2));
meta.selfPlayDrawRate = Number(drawRate.toFixed(3));
const out = src.replace(metaM[0], metaM[1] + JSON.stringify(meta) + ';');
/* 回读自检：冠军槽必须仍是**能解出参数的包**（第一版写坏槽位时就是这里没查，靠 np-test 才发现） */
const reChamp = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(out);
const reParams = reChamp ? W.EpirusPolicy.unpack(JSON.parse(reChamp[1])) : null;
if (!reParams || !reParams.length) { console.error('⛔ 自检失败：写出的 bundle 冠军槽解不出参数（已中止，未落盘）'); process.exit(5); }
const chk = W.EpirusPolicy.checkPack ? W.EpirusPolicy.checkPack(JSON.parse(reChamp[1])) : { ok: true };
if (chk && chk.ok === false) { console.error('⛔ 自检失败：checkPack ' + JSON.stringify(chk) + '（已中止，未落盘）'); process.exit(5); }
writeFileSync(BUNDLE, out);
console.log('   回读自检：冠军包 ok（参数量 ' + reParams.length + '）');

/* 3) 刷 index.html 的缓存戳（否则浏览器继续用旧包） */
let html = readFileSync(INDEX, 'utf8');
const before = (html.match(/\?v=[0-9a-z]+/gi) || [])[0];
html = html.replace(/(\?v=)[0-9a-z]+/gi, '$1' + Date.now().toString(36));
writeFileSync(INDEX, html);
console.log('\n✅ 已提升：' + SRC + ' → js/bundled-champion-3p.js');
console.log('   rulesFingerprint = ' + fp + '（bundle 里记的 = ' + fingerprintOfBundle(out) + '）');
console.log('   examScoreAtBuild = ' + meta.examScoreAtBuild + '（' + EXG + ' 局）  缓存戳 ' + before + ' → ' + (html.match(/\?v=[0-9a-z]+/gi) || [])[0]);
console.log('   ⚠️ 别忘了：node tools/np-test.mjs（D16 指纹 + D14）+ node tools/battle-test.mjs（真浏览器对战）');
console.log('   ⚠️ 且注意：localStorage 里已有冠军的用户**不会**被这次换包影响（REVIEW §11.1）。');

/* 4) 自动跑一遍 skill report（用户 2026-09-13：「以后每次冠军有大变化的时候都可以做一下」）
 * 它回答的是"每个技能的实际强度 vs 使用率"（高使用+负强度=坑 / 零使用+正强度=没学会的强招），
 * 与 champ-audit 的"打架活跃度"互补 —— 换冠军时正是最该看它的时候。用 --no-skill-report 可跳过。 */
if (!process.argv.includes('--no-skill-report')) {
  const nP = Number(meta.n || 5);
  const outHtml = 'docs/skill-report.html';
  console.log('\n== 自动跑技能报告（' + nP + ' 人，每条件 6 局）→ ' + outHtml + ' ==');
  const sk = spawnSync(process.execPath, ['tools/skill-report.mjs', String(nP), '6', outHtml], { cwd: ROOT, encoding: 'utf8' });
  const lines = ((sk.stdout || '') + (sk.stderr || '')).trim().split(/\r?\n/);
  lines.slice(-8).forEach(function (l) { console.log('   ' + l); });
  console.log('   （完整报告：' + outHtml + '，可直接双击打开）');
}
