#!/usr/bin/env node
/* usage-probe.mjs —— 每枚包的**按卡出手谱**（狙击／防御类／大雷／枪／攒钱…各多少一次/局）。
 *
 * 为什么要有这一份（用户 10-08 晚的问题）：她期待融合能"补齐 K2 的短板（缺狙击 + 盾太多）"，
 *   结果实测盾反而更多（K2 0.275 → Y-l65 0.325）。要判这是不是"融合搞反了"，得先看**图上有哪一列**：
 *   `coords.tsv` 只有 `holo`（全息屏障一卡的出手）与 `heavy`（重击伤害/局），**没有狙击、也没有"防御类整体"**
 *   ⇒ 她那条"狙击克盾 ⇒ 用狙击多的包防御自然少；盾克大雷 ⇒ 用大雷的包防御自然多"的耦合假设，
 *   在现有表上**根本没法算**。所以补这一把尺（而不是去 `js/**` 里加字段 —— 那条线不许碰）。
 *
 * 口径：与训练侧 `mirrorHealth` 同一套装配 —— **5 席全是被测包自己**（镜像自对局），
 *   ε 默认 **0（贪心）** ⇒ 量的是"这个策略想用什么"，不是"页面上偶然是什么"；`--eps=0.2` 可切产品口径。
 *   出手只数 `type==='action' && outcome==='ok'` 的事件（与 `aggressionProfile` 同一个判据），
 *   防御类按 `EpirusRules.byKey[k].cat === 'defense'` 归类，**不硬编码卡名单**。
 *
 * 自检（`--self-test`，三格都是手算得出来的）：
 *   ① 全程只ジ ⇒ 狙击/防御/大雷必须**恰好 0**，ジ > 0；
 *   ② 能防御就防御 ⇒ 防御类 > 0 而狙击必须**恰好 0**；
 *   ③ 能狙击就狙击 ⇒ 狙击 > 0 而防御类必须**恰好 0**。
 *   ⇒ 这三格钉的是"计数器接对了事件"，不是"某枚包读数是几"。
 *
 * 用法：node tools/usage-probe.mjs [--ids=a,b | --sample=120 | --paths=f1,f2] [--games=60] [--eps=0] [--out=usage.tsv]
 *      node tools/usage-probe.mjs --self-test
 * 退出码：0 = 跑完 ‖ 2 = 输入不齐或自检不过（宁可红也不许假绿）
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, mulberry32, rejectUnknownFlags } from './audit-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..');
const KNOWN = ['ids', 'sample', 'paths', 'games', 'eps', 'out', 'self-test', 'seed'];
const bad = process.argv.slice(2).filter(a => a.startsWith('--') && !KNOWN.some(k => a.startsWith('--' + k + '=') || a === '--' + k));
if (bad.length) { console.error('⛔ 不认识的参数：' + bad.join(' ') + '（只认 ' + KNOWN.join('/') + '）'); process.exit(64); }
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const GAMES = Number(arg('games', 60)), EPS = Number(arg('eps', 0)), SEED = Number(arg('seed', 4242));
const OUT = arg('out', 'usage.tsv');
const W = sandbox(ROOT), R = W.EpirusRules, S = W.EpirusState, Play = W.EpirusPlay, T = W.EpirusTrainer;
const SK = R.SK, CAT = 'defense';
const isDef = k => { const d = R.byKey[k]; return !!(d && d.cat === CAT); };

/* ---------- 一局镜像装配 + 按卡计数 ---------- */
function spectrum(choose, G) {
  const cnt = {}; let acts = 0, games = 0, rounds = 0;
  for (let g = 0; g < G; g++) {
    const st = S.createState('multi', { next: mulberry32(SEED + g) }, 5);
    st.slotSalt = (Math.imul(g + 1, 0x9e3779b9) ^ 0x5bf03635) >>> 0;
    const ch = []; for (let i = 0; i < 5; i++) ch.push(choose);
    Play.autoGameN(st, ch);
    games++; rounds += st.round;
    for (const e of st.events) {
      if (e.type === 'action' && e.outcome === 'ok') { acts++; cnt[e.key] = (cnt[e.key] || 0) + 1; }
    }
  }
  return { games, acts, rounds, cnt };
}
const rate = (o, k) => (o.cnt[k] || 0) / o.games;
/* ⚠ row() 一律返回**数字**：上一版在这里就 .toFixed() 成字符串，于是自检里 `snipe === 0` 永远不成立
 *   （"0.000" === 0 是 false）⇒ 三格里两格 FAIL，红的是判据自己，不是仪器。写盘时才格式化。 */
function row(o) {
  let def = 0; for (const k in o.cnt) if (isDef(k)) def += o.cnt[k];
  let atk = 0; for (const k in o.cnt) { const d = R.byKey[k]; if (d && d.cat === 'attack') atk += o.cnt[k]; }
  return {
    games: o.games, acts: o.acts / o.games,
    snipe: rate(o, SK.SNIPE), defense: def / o.games, holo: rate(o, SK.HOLO),
    guard: rate(o, SK.GUARD), reflect: rate(o, SK.REFLECT), bigT: rate(o, SK.BIG_T),
    miniT: rate(o, SK.MINI_T), gun: rate(o, SK.GUN), railgun: rate(o, SK.RAILGUN),
    charge: rate(o, SK.CHARGE), ring: rate(o, SK.RING), ji: rate(o, SK.JI),
    atkShare: o.acts ? atk / o.acts : 0, defShare: o.acts ? def / o.acts : 0,
    rounds: o.rounds / o.games,
  };
}
const COLS = ['id', 'eps', 'games', 'acts', 'snipe', 'defense', 'defShare', 'holo', 'guard', 'reflect', 'bigT', 'miniT',
  'gun', 'railgun', 'charge', 'ring', 'ji', 'atkShare', 'rounds'];

/* ---------- 自检：三格手算得出的 ---------- */
if (process.argv.includes('--self-test')) {
  let nok = 0, nbad = 0;
  const chk = (name, cond, got) => { if (cond) { nok++; console.log('  ok   ' + name); } else { nbad++; console.log('  FAIL ' + name + ' ‖ 实测 ' + got); } };
  const onlyJI = () => ({ key: SK.JI });
  const prefer = k => function (state, pid, legal) {
    const a = legal.filter(x => x.affordable && x.key === k);
    return a.length ? { key: k, target: k === SK.SNIPE ? S.opponentsOf(state, pid)[0] : null } : { key: SK.JI };
  };
  const A = spectrum(onlyJI, 12), B = spectrum(prefer(SK.GUARD), 12), C = spectrum(prefer(SK.SNIPE), 12);
  chk('① 全程只ジ ⇒ 狙击/防御/大雷恰好 0 而ジ > 0',
    A.cnt[SK.SNIPE] === undefined && Object.keys(A.cnt).filter(isDef).length === 0 && A.cnt[SK.BIG_T] === undefined && rate(A, SK.JI) > 0,
    'snipe=' + (A.cnt[SK.SNIPE] || 0) + ' def=' + JSON.stringify(Object.keys(A.cnt).filter(isDef)) + ' ji=' + rate(A, SK.JI));
  chk('② 能防御就防御 ⇒ 防御类 > 0 而狙击恰好 0',
    row(B).defense > 0 && row(B).snipe === 0, 'defense=' + row(B).defense + ' snipe=' + row(B).snipe);
  chk('③ 能狙击就狙击 ⇒ 狙击 > 0 而防御类恰好 0',
    row(C).snipe > 0 && row(C).defense === 0, 'snipe=' + row(C).snipe + ' defense=' + row(C).defense);
  console.log('usage-probe 自检：' + nok + ' ok ‖ ' + nbad + ' FAIL（每格 12 局 · ε 不参与——脚本 chooser 不吃 ε）');
  process.exit(nbad ? 2 : 0);
}

/* ---------- 名单 ---------- */
const CO = readFileSync(join(HERE, '..', 'champion-map', 'coords.tsv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map(l => l.split('\t'));
const ch0 = Object.fromEntries(CO[0].map((c, i) => [c, i]));
const rowsC = CO.slice(1).map(r => ({ id: r[ch0.id], path: r[ch0.path] })).filter(e => e.id && e.path);
let list = rowsC;
const IDS = String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean);
const PATHS = String(arg('paths', '')).split(',').map(s => s.trim()).filter(Boolean);
if (IDS.length) list = rowsC.filter(e => IDS.indexOf(e.id) >= 0);
const SAMPLE = Number(arg('sample', 0));
if (SAMPLE > 0) { const r = mulberry32(9090); const sh = rowsC.slice(); for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[sh[i], sh[j]] = [sh[j], sh[i]]; } list = sh.slice(0, SAMPLE); }
if (PATHS.length) list = PATHS.map((p, i) => ({ id: p.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/, ''), path: p })).concat(IDS.length || SAMPLE ? list : []);
if (!list.length) { console.error('⛔ 名单是空的（给 --ids= / --sample= / --paths=）'); process.exit(2); }
const miss = list.filter(e => !existsSync(isAbsolute(e.path) ? e.path : join(ROOT, e.path)));
if (miss.length) console.error('⚠ ' + miss.length + ' 枚文件不在（前 6：' + miss.slice(0, 6).map(e => e.id).join(' ') + '）⇒ 这些枚会被跳过');

/* §2026-10-09：**判绝对路径要用 isAbsolute，不能用盘符正则**。
 * 病（CI 连红 12 笔的唯一一条门，本机永远看不见的形状）：D232 的 ④ 腿传的是 `--out=<mkdtemp>/u.tsv`，
 *   Windows 上它是 `C:\Users\…\e497-usage-XXXX\u.tsv` ⇒ 命中盘符正则、按原样写；
 *   而 ubuntu runner 上是 `/tmp/e497-usage-XXXX/u.tsv` ⇒ **不命中** ⇒ 被当相对路径拼进仓库
 *   ⇒ `<repo>/champion-map/tmp/e497-usage-XXXX/u.tsv`，那层目录不存在 ⇒ writeFileSync 抛 ENOENT ⇒ 子进程 exit 1。
 *   复原过一次的脚本贴在日志 `docs/research/logs/OVERNIGHT-2026-10-09-qoder.md` §E558
 *   （`docs/artifacts/` 已整体 gitignore ⇒ 一次性脚本**不入库**，别把复现指到一个全新 clone 里没有的路径）。
 * 同仓的 champion-map/feas.mjs:63 早就写了两条支（盘符 **或** `/` 开头）⇒ 这一处是漏写，不是口径。 */
const OUTP = isAbsolute(OUT) ? OUT : join(ROOT, 'champion-map', OUT);
if (!existsSync(OUTP)) writeFileSync(OUTP, COLS.join('\t') + '\n');
const done = new Set(readFileSync(OUTP, 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]).filter(x => x));
let n = 0;
for (const e of list) {
  if (done.has(e.id)) continue;
  let params; try { params = loadChamp(W, e.path); } catch (x) { console.error('  ⚠ ' + e.id + ' 读包失败：' + String(x.message || x).split('\n')[0]); continue; }
  if (!params || !params.length) { console.error('  ⚠ ' + e.id + ' 读不出参数'); continue; }
  const o = spectrum(EPS ? T.policyChooserN(params, EPS) : T.policyChooserN(params, 0), GAMES);
  const r = row(o);
  appendFileSync(OUTP, [e.id, EPS].concat(COLS.slice(2).map(c => (typeof r[c] === 'number' ? r[c].toFixed(3) : r[c]))).join('\t') + '\n');
  if (++n % 25 === 0 || n === list.length) console.log('  ' + n + ' 枚 … 最新 ' + e.id + ' 狙击=' + r.snipe + '/局 防御类=' + r.defense + '/局 大雷=' + r.bigT + '/局');
}
console.log('完成 ' + n + ' 枚（跳过已在册 ' + done.size + ' 枚）⇒ ' + OUTP);
