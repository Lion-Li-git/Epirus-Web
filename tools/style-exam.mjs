/* Epirus 「风格反制」考卷（v1.5.2）
 *
 * 用法：
 *   node tools/style-exam.mjs <受试者> [局数=40] [--seed=77000] [--n=5] [--mode=multi]
 *        [--styles=champ:pathA,champ:pathB,...] [--json=out.json]
 *
 *   受试者 = 冠军文件（.bak / js/bundled-champion-3p.js）**或**一个脚本名（例 random、tankline）
 *           —— 支持脚本名是为了量"地板"（脚本对手在风格场里拿多少）。
 *
 * 回答什么问题：这个冠军能不能打**成体系的风格**，而不只是打脚本 if-else 人格？
 *   · 每个风格各开一个场：其余 n-1 个座位**全是该风格冠军**；
 *   · 外加一个**混合场**：其余座位各放一个不同风格（最接近"什么对手都要赢"的考卷）；
 *   · 外加一个**脚本场**作对照（random/defend/antidef/farmer 轮转）。
 *
 * 口径与可复现：
 *   · 每局座位轮换 `seat = g % N`，局种子 `SEED + g*977 + total` —— 与 `tools/eval-5p.mjs` 同一范式；
 *   · 两臂用**同一批 seed** ⇒ 逐局配对，可直接比；
 *   · 默认模式跟随受试冠军自己的 `meta.mode`（长程冠军自动按 5 血测），可用 `--mode=` 覆盖；
 *   · 对手解析走 `server/opp-champs.mjs`（**唯一入口**）—— 不在本工具里再写一份"名字→函数"映射。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { OPP_FN } from '../server/opp-pool.mjs';
import { makeOppSelResolver, loadChampParams, champOppAbs } from '../server/opp-champs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const ARGV = process.argv.slice(2).filter(function (a) { return !/^--/.test(a); });
const FLAG = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z0-9-]+)=?(.*)$/i.exec(a);
  if (m) FLAG[m[1]] = m[2] === '' ? '1' : m[2];
}
const SUBJECT = ARGV[0] || 'champ:docs/artifacts/champion-5p-v1.3.58.bak';
const GAMES = parseInt(ARGV[1] || '40', 10);
const N = Math.max(3, Math.min(parseInt(FLAG.n || '5', 10), 5));
const SEED = parseInt(FLAG.seed || '77000', 10);
const TEMP = 0.15;                       // 与页面「困难」档一致
const JSON_OUT = FLAG.json || '';
/* 四个风格化冠军（画像见 docs/skill-report-cmp.html）：
 *   激光剑流 / 狙击枪+环流 / 坦克流 / 枪+墙流 —— 都是"成体系的流派"，不是脚本人格。 */
const DEFAULT_STYLES = [
  'champ:docs/artifacts/champion-5p-v1.3.58.bak',
  'champ:docs/artifacts/champion-5p-hA9.bak',
  'champ:docs/artifacts/champion-5p-armB12f.bak',
  'champ:docs/artifacts/champion-5p-armA9.bak'
];
const STYLE_NAMES = ['激光剑流(现役)', '狙击枪+环流', '坦克流', '枪+墙流'];
const STYLES = FLAG.styles ? FLAG.styles.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : DEFAULT_STYLES;
/* 混合场默认用全部风格；可用 `--mixstyles=` 单独指定 —— 用途：把某个风格当作**留出场**
 * （只测、不放进混合场）时，混合场仍应是"训练里见过的那些风格"的组合。 */
const MIXSTYLES = FLAG.mixstyles ? FLAG.mixstyles.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : STYLES;
const SCRIPT_FIELD = ['random', 'defend', 'antidef', 'farmer'];

/* ===== 沙箱（与 eval-5p / train-worker 同一加载清单）===== */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN,
  parseInt, parseFloat, Float64Array, Date, window: {},
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js',
  'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const W = sb.window, R = W.EpirusRules, T = W.EpirusTrainer, P = W.EpirusPolicy, B = W.EpirusBots;
/* ⚠ 传 `W`（window）而不是 `sb`：本工具的沙箱里 `sb.window={}` 已存在 ⇒ 模块挂在 window 上；
 * 而 server/worker 的沙箱没有 window、模块挂在 sb 自身上。解析器只要求"传进来的对象能拿到
 * EpirusPolicy/EpirusTrainer"，所以两边各自传对的那个。 */
const resolveOpp = makeOppSelResolver(W, root, OPP_FN, B, TEMP);

/* ===== 受试者：冠军文件 或 脚本名 ===== */
function subjectMeta(src, file) {
  const m = src.match(/window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/);
  try { return m ? JSON.parse(m[1]) : null; } catch (e) { return null; }
}
let subjParams = null, subjLabel = SUBJECT, subjMode = FLAG.mode || 'multi';
if (OPP_FN[SUBJECT]) {
  subjLabel = '脚本:' + SUBJECT;
  subjMode = FLAG.mode || 'multi';
} else {
  const rel = SUBJECT.indexOf('champ:') === 0 ? SUBJECT.slice(6) : SUBJECT;
  const file = isAbsolute(rel) ? rel : join(root, rel);
  const src = readFileSync(file, 'utf8');
  const meta = subjectMeta(src, file);
  const mm = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!mm) throw new Error('不是多人冠军包: ' + file);
  subjParams = P.unpack(JSON.parse(mm[1]));
  if (!subjParams) throw new Error('冠军包不兼容: ' + file);
  if (!FLAG.mode && meta && meta.mode) subjMode = meta.mode;
  subjLabel = rel + (meta && meta.firstRate != null ? '（自评=' + (meta.firstRate * 100).toFixed(1) + '%）' : '');
  if (meta && meta.mode) subjLabel += ' [训练模式=' + meta.mode + ']';
}
if (!R.MODES[subjMode]) { console.error('--mode 未知: ' + subjMode); process.exit(1); }

/* 每个 chooser **每局新建**（与 eval-5p 的 makeSel()/局 一致；chooser 可能带状态）。
 * 注意 `resolveOpp()` 对冠军返回的是**已经建好的 chooser**（不是 params）—— 所以这里：
 *   · 用它做**启动期校验**（文件缺失/包不兼容要立刻响亮失败）；
 *   · 真正取 params 用 loadChampParams（保留每局新建 chooser 的自由度）。 */
function subjSel() {
  if (OPP_FN[SUBJECT]) return T.wrapBotN(B[OPP_FN[SUBJECT]]);
  return T.policyChooserN(subjParams, TEMP);
}
const styleParamsCache = new Map();
function styleParams(nm) {
  if (!styleParamsCache.has(nm)) styleParamsCache.set(nm, loadChampParams(P, champOppAbs(nm, root)));
  return styleParamsCache.get(nm);
}
function styleSel(nm) {
  if (OPP_FN[nm]) return T.wrapBotN(B[OPP_FN[nm]]);      // 脚本：包一层（保留脚本自己选的目标）
  return T.policyChooserN(styleParams(nm), TEMP);        // 冠军：每局新建 chooser
}
/* 启动期把每个风格对手都解一次：缺文件/包不兼容要在这里就响亮中止 */
for (const nm of STYLES.concat(MIXSTYLES)) {
  if (OPP_FN[nm]) continue;
  resolveOpp(nm);   // 解析器内部含缓存与清晰报错
}

/* ===== 一个场 ===== */
function runField(field, label) {
  const ranks = new Array(N + 1).fill(0);   // ranks[1..N]
  let first = 0, top2 = 0, total = 0;
  for (let g = 0; g < GAMES; g++) {
    const seat = g % N;
    const choosers = [];
    let oi = 0;
    for (let pid = 0; pid < N; pid++) {
      if (pid === seat) { choosers.push(subjSel()); continue; }
      const nm = field[oi % field.length]; oi++;
      choosers.push(styleSel(nm));
    }
    const r = T.oneGameN(choosers, SEED + g * 977 + total, N, { mode: subjMode });
    const rank = T.rankOf(r.state, seat, SEED + g * 977 + total);
    ranks[rank]++;
    if (rank === 1) first++;
    if (rank <= 2) top2++;
    total++;
  }
  return { label: label, games: total, first: first, top2: top2, ranks: ranks,
    firstRate: total ? first / total : 0, top2Rate: total ? top2 / total : 0 };
}

/* ===== 跑：每风格一场 + 混合场 + 脚本对照场 ===== */
console.log('[风格考卷] 受试=' + subjLabel);
console.log('  人数=' + N + '  模式=' + subjMode + '(' + (R.MODES[subjMode].name || '') + ')  每场 ' + GAMES + ' 局  种子基=' + SEED + '  对手强度=页面困难档(temp ' + TEMP + ')');
const fields = [];
for (let i = 0; i < STYLES.length; i++) {
  const nm = STYLES[i];
  fields.push({ label: (STYLE_NAMES[i] || nm) + ' ×' + (N - 1), field: [nm, nm, nm, nm] });
}
fields.push({ label: '混合风格场', field: MIXSTYLES.slice() });
fields.push({ label: '脚本对照场', field: SCRIPT_FIELD });

const out = [];
for (const f of fields) {
  const r = runField(f.field, f.label);
  out.push(r);
  console.log('  ' + r.label.padEnd(20) + ' 1st=' + (r.firstRate * 100).toFixed(1).padStart(5) + '%' +
    '  top2=' + (r.top2Rate * 100).toFixed(1).padStart(5) + '%' +
    '  名次分布 2nd=' + ((r.ranks[2] / r.games) * 100).toFixed(1) + '% 3rd=' + ((r.ranks[3] / r.games) * 100).toFixed(1) +
    '% ' + (N >= 4 ? '4th=' + ((r.ranks[4] / r.games) * 100).toFixed(1) + '% ' : '') +
    (N >= 5 ? '5th=' + ((r.ranks[5] / r.games) * 100).toFixed(1) + '%' : ''));
}
/* 风格平均（不含脚本对照场）—— 一个数概括"对风格的适应力" */
const styleRows = out.filter(function (r) { return r.label !== '脚本对照场'; });
const styleMean = styleRows.reduce(function (a, r) { return a + r.firstRate; }, 0) / styleRows.length;
const mixRow = out[out.length - 2];
console.log('  —— 风格场平均(含混合) 1st=' + (styleMean * 100).toFixed(1) + '%   混合场 1st=' + (mixRow.firstRate * 100).toFixed(1) + '%');
if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ subject: SUBJECT, label: subjLabel, n: N, games: GAMES,
    seed: SEED, mode: subjMode, temp: TEMP, styles: STYLES, rows: out, styleMean: styleMean }, 'utf8'));
  console.log('已写出 JSON ' + JSON_OUT);
}
