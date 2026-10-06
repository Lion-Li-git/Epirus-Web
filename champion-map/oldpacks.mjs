#!/usr/bin/env node
/* oldpacks.mjs —— §E370 把槽位时间轴上"面板里没名字"的旧包捞出来，用**今天的兼容方法**量它们的水平。
 *
 * 为什么要这一台（用户 10-06 深夜：「那些旧包也可以找出来，反正现在有兼容的方法，可以跑一下他们的水平」）：
 *   `slot-timeline.tsv` 39 段里只有 19 段能对上面板上的枚 ⇒ 剩下那批曾在 3P 槽里住过的冠军**在演化页上是隐身的**，
 *   而它们正是"冠军之间到底差多少"这条轴的低端。低端缺样，色标就被中位那一片挤成一坨（这也是 #149 的动机）。
 *
 * 兼容方法 = `tools/upgrade-pack.mjs`（v1.5.63 那条"旧形状包上线通路"）：原生读取 ⇒ `embedLegacy` 嵌入 v7 容器 ⇒ `checkPack`。
 *   ⚠ 量的是**嵌进 v7 之后那一份**（那才是真发出去的东西），不是 v4/v6 原件 —— 原件在今天的引擎里连容器都进不去。
 *
 * 两条硬守卫（不满足就**红着退出**，不许静默记 0）：
 *   ① **身份**：从 git 取出的那份，`widOf` 必须逐字等于时间轴里那一行的 wid。
 *      不查这一步 = 可能把"上一段的包"量成这一段（时间轴是按"引入提交"切的，取错一个 sha 就整体偏移一格）。
 *   ② **两口径成对**：考卷（ε=0）与页面（ε=0.2/soft）**同批同 seed**，与 `eps-full.mjs` 逐字同一台仪器
 *      （argv 除路径外完全一致）⇒ 这样量出来的 Hp 才敢和 coords.tsv 那 901 枚并排读。
 *
 * 读数怎么读（写在这里免得下次误读）：这些包的 ts 早于 v1.4/v1.5/v1.6 的规则改动 ⇒
 *   **本次数字是"这枚旧权重在今天的规则下值多少"，不是"它当年的水平"**。它自己那批的 firstRate 一并落表（`metaFirst`），
 *   两件事不许混着讲。
 *
 * 用法：node champion-map/oldpacks.mjs [--segs=unnamed|all] [--games=30] [--seed=77000] [--only=<wid8,wid8>]
 *        [--promote=1]        ‖ [--duel=1 [--duelgames=200] [--ref=SHIPPED-Ldemo]]
 * 产物：docs/artifacts/e370-out/<wid8>.js（git 原件）‖ <wid8>-v7.js（嵌入后）‖ champion-map/oldpacks.tsv
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync, execFile, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { widOf } from './wid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const SEGS = arg('segs', 'unnamed'), GAMES = Number(arg('games', 30)), SEED = String(arg('seed', 77000));
const ONLY = (arg('only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const SLOT = 'js/bundled-champion-3p.js';
const DIR = join(ROOT, 'docs/artifacts/e370-out');
const OUT = join(HERE, 'oldpacks.tsv');
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const git = a => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });

/* ---- 1) 时间轴 → 待测清单（按 wid 去重；同一份权重住过两段只量一次）---- */
const TL = rd(join(HERE, 'slot-timeline.tsv')).trim().split('\n'), th = TL[0].split('\t');
const T = Object.fromEntries(th.map((h, i) => [h, i]));
const want = [];
for (const l of TL.slice(1)) {
  const c = l.split('\t');
  const named = (c[T.panelId] || '').trim();
  if (SEGS === 'unnamed' && named) continue;
  const wid = c[T.wid];
  if (!wid || wid.startsWith('(')) { console.log('  ⤳ 跳过一段取不到权重的：' + c[T.sha] + ' ' + wid); continue; }
  if (want.some(w => w.wid === wid)) continue;
  want.push({ wid, sha: c[T.sha], from: c[T.fromUTC], subject: c[T.subject] || '', panelId: named, metaTs: c[T.metaTs] || '' });
}
const list = ONLY.length ? want.filter(w => ONLY.some(o => w.wid.startsWith(o))) : want;
console.log('时间轴 ' + (TL.length - 1) + ' 段 ‖ 模式 --segs=' + SEGS + ' ⇒ 去重后待量 ' + list.length + ' 枚'
  + (ONLY.length ? '（--only 过滤后）' : '') + ' ‖ 每枚两口径 × ' + GAMES + ' 局/组合');
if (!list.length) { console.error('⛔ 清单是空的 ⇒ 不是"没有旧包"，是 --segs/--only 配错了'); process.exit(2); }

/* ---- 2) 取原件 → 身份守卫 → 嵌入 v7 ---- */
function prepare(w) {
  const raw = join(DIR, w.wid.slice(0, 8) + '.js'), emb = join(DIR, w.wid.slice(0, 8) + '-v7.js');
  let src;
  try { src = git(['show', w.sha + ':' + SLOT]); } catch (e) { return { err: 'git show 失败：' + String(e.message || e).slice(0, 60) }; }
  const got = widOf(src);
  if (got !== w.wid) return { err: '**身份不符**：' + w.sha + ' 的槽文件 wid=' + (got || '(无)') + ' ≠ 时间轴的 ' + w.wid };
  if (!existsSync(emb) || (existsSync(raw) && statSync(raw).mtimeMs < statSync(emb).mtimeMs)) writeFileSync(raw, src);
  let cv = '', clen = 0;
  const m = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\});/.exec(src);
  if (m) { const j = JSON.parse(m[1]); cv = 'v' + j.v; clen = (j.a || []).length; }
  if (!existsSync(emb)) {
    try { execFileSync(process.execPath, ['tools/upgrade-pack.mjs', 'docs/artifacts/e370-out/' + w.wid.slice(0, 8) + '.js',
      'docs/artifacts/e370-out/' + w.wid.slice(0, 8) + '-v7.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }); }
    catch (e) { return { err: 'upgrade-pack 失败：' + String((e.stdout || '') + (e.stderr || '') + (e.message || '')).replace(/\s+/g, ' ').slice(0, 90) }; }
  }
  return { emb: 'docs/artifacts/e370-out/' + w.wid.slice(0, 8) + '-v7.js', cv, clen };
}

/* ---- 3) 两口径成对量（与 eps-full.mjs 同一台仪器）---- */
function one(rel, on) {
  const a = ['tools/eval-5p.mjs', String(GAMES), '5', SEED, rel];
  if (on) a.push('--eps=0.2', '--eps-mode=soft');
  return new Promise(res => execFile(process.execPath, a, { cwd: ROOT, maxBuffer: 1 << 28, timeout: 600000 },
    (e, so) => res(e ? { err: String(e.message || e).slice(0, 90) } : { out: String(so) })));
}
const grab = (s, re) => { const m = re.exec(s); return m ? m[1] : ''; };
function read(s) {
  return {
    win: Number(grab(s, /\[冠军\] 1st=([\d.]+)%/)),
    strict: Number(grab(s, /1st=[\d.]+% 严胜=([\d.]+)%/)),
    top2: Number(grab(s, /top2=([\d.]+)%/)),
    deepIn: grab(s, /拆分: 含深经济对手 ([\d.]+)%/), deepOut: grab(s, /vs  不含 ([\d.]+)%（/),
    rounds: grab(s, /平均回合=([\d.]+)/), keys: grab(s, /出手种类=(\d+)/),
    bigt: grab(s, /真打出 \*\*(\d+) 张/), drain: grab(s, /真打出 \*\*(\d+) 张[^\n]*窗口=自己 hp≤1/),
    metaTs: grab(s, /"ts":"([^"]+)"/), metaFirst: grab(s, /"firstRate":([\d.]+)/),
    hot: grab(s, /"hotstartFrom":"([^"]+)"/), gens: grab(s, /"gens":(\d+)/),
  };
}

/* ---- 3b) 上槽体检（**永远带 --dry**：promote 不带它会把 3P 槽换掉）----
 *   判词形状：过 = stderr/stdout 里那行 `🧪 --dry：自检通过但**未写任何文件**`；
 *   不过 = `⛔ 体检未过（N 项阻断条件）：` 后面那几条 bullet。两类都要落表，"没过"要能说出**卡在哪一条**。
 *   ⚠ 路径必须传**仓库相对路径**：promote-champion 自己按 ROOT 解析，喂绝对路径会拼成
 *      `D:\code\Epirus-Web\D:\code\Epirus-Web\...` 而 ENOENT 崩掉（实测）⇒ 崩了不能记成"体检没过"。 */
function promote(embRel) {
  const r = spawnSync(process.execPath, ['tools/promote-champion.mjs', embRel, '--dry'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 1800000 });
  const all = String(r.stdout || '') + '\n' + String(r.stderr || '');
  const okDry = /--dry：自检通过/.test(all);
  const failed = /体检未过（\d+ 项/.test(all);
  const why = (all.match(/^   · (.+)$/gm) || []).map(s => s.trim().replace(/^·\s*/, '')).join(' ‖ ');
  if (okDry) return { verdict: 'PASS', why: '', G: grab(all, /multi 有效技能数=([\d.]+)/), S: grab(all, /S=([\d.]+) = 类间/) };
  if (!failed) return { verdict: 'CRASH', why: ('退出码 ' + r.status + ' ' + all.split('\n').filter(Boolean).slice(-3).join(' ')).slice(0, 160), G: '', S: '' };
  return { verdict: 'FAIL', why: why || '(没抓到 bullet)', G: grab(all, /multi 有效技能数=([\d.]+)/), S: grab(all, /S=([\d.]+) = 类间/) };
}

/* ---- 3c) 与现役的配对决斗（同一台仪器 = tools/style-exam.mjs，与 duel-run.mjs 逐字同形）----
 *   为什么不在 duel-run 里跑：它的候选表钉死是 coords.tsv，而那 16 枚旧包**还没进面板**（进不进 = 待裁）。
 *   自检照抄：同一枚打自己 ⇒ 配对差必须恰好 0，否则整批读数一条都不许引。 */
function duel(embRel, refPath, tag) {
  const ex = (subject, fieldOpp, sfx) => {
    const j = join(DIR, 'duel-' + tag + '.' + sfx + '.json');
    const r = spawnSync(process.execPath, ['tools/style-exam.mjs', subject, String(DGAMES), '--n=5', '--seed=' + SEED,
      '--mode=multi', '--styles=champ:' + fieldOpp, '--json=' + j], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 29 });
    if (r.status !== 0) return null;
    try { const row = JSON.parse(rd(j)).rows[0]; return row && row.games === DGAMES ? row : null; } catch (e) { return null; }
  };
  const A = ex(embRel, refPath, 'A'), B = ex(refPath, embRel, 'B');
  if (!A || !B) return { err: 'duel 没跑成' };
  const d = 100 * (A.firstRate - B.firstRate);
  const se = 100 * Math.sqrt(A.firstRate * (1 - A.firstRate) / A.games + B.firstRate * (1 - B.firstRate) / B.games);
  return { a: (100 * A.firstRate).toFixed(1), b: (100 * B.firstRate).toFixed(1), d: d.toFixed(1), se: se.toFixed(1) };
}

const COLS = ['wid8', 'wid', 'fromUTC', 'sha', 'container', 'wlen', 'panelId', 'H', 'Hp', 'dEps', 'strict', 'top2',
  'deepIn', 'deepOut', 'rounds', 'keys', 'bigt', 'drain', 'promote', 'promoteWhy', 'Gmulti', 'S',
  'duelOld%', 'duelRef%', 'duelDiff', 'approxSE', 'metaTs', 'metaFirst', 'hot', 'gens', 'subject'];
const DO_PROMOTE = arg('promote', '0') === '1', DO_DUEL = arg('duel', '0') === '1';
const DGAMES = Number(arg('duelgames', 200)) || 200;
const REFID = arg('ref', 'SHIPPED-Ldemo');
let refPath = '';
if (DO_DUEL) {
  const CO = rd(join(HERE, 'coords.tsv')).trim().split('\n'), c0 = CO[0].split('\t');
  const ci = c0.indexOf('id'), cp = c0.indexOf('path');
  for (const l of CO.slice(1)) { const c = l.split('\t'); if (c[ci] === REFID) refPath = c[cp]; }
  if (!refPath || !existsSync(join(ROOT, refPath))) { console.error('⛔ 参照枚 ' + REFID + ' 的包找不到（' + refPath + '）⇒ 决斗一档不跑'); process.exit(2); }
  console.log('决斗参照 = ' + REFID + '（' + refPath + '）‖ 每场 ' + DGAMES + ' 局 · 两席互换');
}
const rows = [];
let bad = 0;
const write = () => writeFileSync(OUT, COLS.join('\t') + '\n' + rows.map(r => r.join('\t')).join('\n') + '\n');
(async function () {
  for (const w of list) {
    const p = prepare(w);
    if (p.err) { console.error('  ⛔ ' + w.wid.slice(0, 8) + '  ' + p.err); bad++; continue; }
    const ex = await one(p.emb, false), pg = await one(p.emb, true);
    if (ex.err || pg.err) { console.error('  ⛔ ' + w.wid.slice(0, 8) + '  eval 失败：' + (ex.err || pg.err)); bad++; continue; }
    const a = read(ex.out), b = read(pg.out);
    if (!isFinite(a.win) || !isFinite(b.win)) { console.error('  ⛔ ' + w.wid.slice(0, 8) + '  读不到 1st= ⇒ 两口径必须都成数'); bad++; continue; }
    const embRel = p.emb;
    let pr = { verdict: '', why: '', G: '', S: '' }, du = { a: '', b: '', d: '', se: '' };
    if (DO_PROMOTE) { pr = promote(embRel); console.log('    上槽体检 --dry ⇒ ' + pr.verdict + (pr.why ? '（' + pr.why.slice(0, 110) + '）' : '')); }
    if (DO_DUEL) { du = duel(embRel, refPath, w.wid.slice(0, 8)); if (du.err) { console.log('    ⛔ ' + du.err); bad++; } else console.log('    决斗 vs ' + REFID + '：旧 ' + du.a + '% ‖ 现役 ' + du.b + '% ⇒ 差 ' + du.d + ' ±' + du.se + 'pt'); }
    const r = [w.wid.slice(0, 8), w.wid, w.from, w.sha, p.cv, p.clen, w.panelId, a.win.toFixed(2), b.win.toFixed(2),
      (a.win - b.win).toFixed(2), a.strict.toFixed(2), b.top2.toFixed(2), b.deepIn, b.deepOut, b.rounds, b.keys,
      b.bigt, b.drain, pr.verdict, pr.why, pr.G, pr.S, du.a, du.b, du.d, du.se,
      a.metaTs, a.metaFirst, a.hot, a.gens, (w.subject || '').replace(/\t/g, ' ')];
    rows.push(r); write();
    console.log('  ' + w.wid.slice(0, 8) + ' ' + String(p.cv).padEnd(3) + ' ' + String(p.clen).padStart(4) + ' 位 ‖ 考卷 H='
      + a.win.toFixed(2) + ' ‖ 页面 Hp=' + b.win.toFixed(2) + ' ‖ Δε=' + (a.win - b.win).toFixed(2)
      + ' ‖ 随机基线 20.0 ⇒ ' + (b.win > 20 ? '高于基线' : '**低于基线**') + ' ‖ 出手种类 ' + b.keys + ' ‖ 平均回合 ' + b.rounds);
  }
  write();
  console.log('已写 oldpacks.tsv：' + rows.length + ' 枚 ‖ 失败 ' + bad + ' ‖ 目录 docs/artifacts/e370-out/');
  console.log('⚠ 这张表的 Hp 是**今天的规则**下量的（旧包嵌进 v7 容器后跑的，走旧口径由门 D56 钉着），不是它们当年的水平；两件事的读数在 metaFirst 那一列并排放着。');
  if (bad) { console.error('⛔ 有 ' + bad + ' 枚没量成 ⇒ 退出码非 0（空跑不许静默）'); process.exit(4); }
})();
