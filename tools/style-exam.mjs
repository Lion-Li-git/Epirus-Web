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
/* §E342：映射档的解析/下达口只从 audit-lib 拿（与 promote-champion、eval-5p 同一份 ⇒ 一处改档、三处一致）。 */
import { extractJsonObject, parseMetaTolerant, packHoloMode, applyHoloMode } from './audit-lib.mjs';

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
/* §E340/§E342 全息屏障→原型制御 的映射档（`off|proto|drop`，**默认 off ⇒ 两处都不设时与旧版逐字相同**）。
 *   §E342（用户裁定 10-06）把优先级定成与 `promote-champion` **同一条**：
 *     显式覆盖（环境变量 `EPIRUS_HOLO2PROTO`）> 包自带声明（`META.holo2proto`）> `off`。
 *   为什么包声明要压过"没设环境变量"：这份考卷常被拿去比"这枚包好不好"，而包上线后跑的是**它声明的那一档**
 *     ⇒ 读数若按 off 计，就是在给一枚永远不会以 off 上线的包记 off 的成绩（两本账）。
 *   ⚠ 下达必须在**受试包解出来之后**（见下面 `subjHoloApply` 的调用点）：包还没读到就先下达 = 拿错档打分。
 *   含糊值必须响亮拒（本仓规矩：含糊拼写不许被当成"没写"，否则一次拼错就是一份静默的假读数）。 */
const ENV_HOLO = (process.env.EPIRUS_HOLO2PROTO == null || String(process.env.EPIRUS_HOLO2PROTO).trim() === '')
  ? null : String(process.env.EPIRUS_HOLO2PROTO).trim();
if (ENV_HOLO != null) {
  try { packHoloMode({ holo2proto: ENV_HOLO }); }
  catch (e) { console.error('⛔ EPIRUS_HOLO2PROTO：' + e.message); process.exit(2); }
}
/* 只给 `holo2proto` 这一件事用 audit-lib 的健壮解析口；上面 `subjectMeta` 那条懒惰正则**原样留着**读其它字段
 *   ⇒ 历史读数零变动（换成健壮解析会让嵌套 META 的包突然多读出 `meta.mode`，那是另一笔换尺）。 */
let HOLO_APPLIED = 'off';
function subjHoloApply(src, file, label) {
  let dm = {};
  const mj = src ? extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P_META') : null;
  if (mj) {
    try { dm = parseMetaTolerant(mj, file).meta || {}; }
    catch (e) { console.error('⛔ ' + file + ' 的 META 解析不出 ⇒ 映射档无从判定（不许静默当 off）：' + e.message); process.exit(2); }
  }
  const declared = packHoloMode(dm);
  const mode = ENV_HOLO != null ? ENV_HOLO : declared;
  try { applyHoloMode({ EpirusPolicy: P }, { holo2proto: mode }, 'style-exam'); }
  catch (e) { console.error('⛔ ' + e.message); process.exit(2); }
  HOLO_APPLIED = mode;
  if (mode !== 'off') console.log('#holo2proto=' + mode + '（来自' + (ENV_HOLO != null ? '环境变量' : '包声明') + '）');
  if (src && ENV_HOLO != null && ENV_HOLO !== declared) {
    console.log('⚠ ' + label + ' 的包声明是 "' + declared + '"，本次被环境变量改成 "' + ENV_HOLO + '"'
      + ' ⇒ 这份读数**不是**该包上线后的行为，跨档比较时不许混用。');
  }
}

/* ===== 受试者：冠军文件 或 脚本名 ===== */
function subjectMeta(src, file) {
  const m = src.match(/window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/);
  try { return m ? JSON.parse(m[1]) : null; } catch (e) { return null; }
}
let subjParams = null, subjLabel = SUBJECT, subjMode = FLAG.mode || 'multi';
let subjSrc = null, subjFile = null;
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
  subjParams = P.unpack(JSON.parse(mm[1]), true);   // v7：允许历史形状
  if (!subjParams) throw new Error('冠军包不兼容: ' + file);
  if (!FLAG.mode && meta && meta.mode) subjMode = meta.mode;
  subjLabel = rel + (meta && meta.firstRate != null ? '（自评=' + (meta.firstRate * 100).toFixed(1) + '%）' : '');
  if (meta && meta.mode) subjLabel += ' [训练模式=' + meta.mode + ']';
  subjSrc = src; subjFile = file;
}
/* §E342：映射档在这里下达 —— **包已读到、但一局都还没跑**。
 *   放在 unpack 之后：拿一枚不兼容/不存在的包来定档，应当在报错之后就停，而不是先按某档跑完一场。 */
subjHoloApply(subjSrc, subjFile, subjLabel);
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
/* §E342 口径边界（**明写不猜**）：映射档在引擎里是**进程级**的一个值（`policy.js` 的 `H2P`），
 *   而这张考卷把受试者和 4 个风格对手装进**同一个沙箱** ⇒ 一下达就是全场同一档。
 *   所以风格包若自带声明、且与本次 applied 档不一致，那些对手**并不是以它自己上线后的行为在打**。
 *   第一版在这里只做响亮报告、不做分席下达（分席要改 `chooseCandidates` 的签名 = 动引擎面，等用户裁定）。 */
{
  const seen = {}, off = [];
  for (const nm of STYLES.concat(MIXSTYLES)) {
    if (OPP_FN[nm] || seen[nm]) continue;
    seen[nm] = 1;
    const mj = extractJsonObject(readFileSync(champOppAbs(nm, root), 'utf8'), 'window.EPIRUS_CHAMPION_3P_META');
    let dm = {};
    if (mj) { try { dm = parseMetaTolerant(mj, nm).meta || {}; } catch (e) { dm = {}; } }
    const d = packHoloMode(dm);
    if (d !== HOLO_APPLIED) off.push(nm + '（声明 ' + d + '）');
  }
  if (off.length) console.log('⚠ 风格对手自带映射档、与本次全场档 "' + HOLO_APPLIED + '" 不一致：'
    + off.join(' ‖ ') + ' ⇒ 这些对手是以**本次档**在打，不是它们上线后的行为（档是进程级，做不到一席一档）。');
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
