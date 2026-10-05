/* duel-run.mjs —— §E334 把 §E289 那台 A/B 配对决斗搬进入库，并且**按 coords.tsv 的 path 列找包**。
 *
 * 为什么要搬（旧稿住在 gitignored 的 docs/artifacts/e287-out/）：
 *   ① 它的 `packPath()` 按 `docs/artifacts/<id>.bak` 猜路径 ⇒ 正是 §E330 抓到的那个洞：
 *      同名旧拷贝在场，量出来的"那枚"可能根本不是图上的那枚（谱系图 181 枚叠在同一秒就是这么来的）。
 *   ② 它的候选表是 `e287-panel2-22.tsv`（718 枚那版），看不见 §E329 扩进来的 183 枚子代。
 *   ⇒ 现在候选与路径都读 `coords.tsv`（名单/路径/读数同表同序），并且**自检不过就红着退出**。
 *
 * 双臂（每枚候选跑两次，互为攻守）：
 *   A = style-exam(受试 = 候选, 场 = 4 × 现役) → 候选在"现役场"里的夺 1 率
 *   B = style-exam(受试 = 现役, 场 = 4 × 候选) → 现役在"候选场"里的夺 1 率
 *   读数 = A − B（>0 ⇒ 候选更强）。地板 = 20%（1 打 4，对称策略下各席等权）。
 *   ⚠ A 与 B 不是同一局轨迹（换受试者会换随机流消耗）⇒ 这是"同批种子 + 同座位表"的配对，不是逐局同轨迹配对。
 *   自检：现役 vs 现役 ⇒ A−B 必须**恰好 0**，不为 0 就是仪器坏了（旧稿只打印，这里直接 exit 2）。
 *
 * 用法：node champion-map/duel-run.mjs [--ids=a,b | --top=8] [--games=60] [--seed=77000] [--out=duel-e334-s77000.tsv]
 *        [--ref=SHIPPED-Ldemo]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const rd = f => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');   /* §E333 本仓工作树是 CRLF，末列会带裸 \r */
const GAMES = Number(arg('games', 60)) || 60;
const SEED = String(Number(arg('seed', 77000)) || 77000);
const MODE = 'multi';
const REF = arg('ref', 'SHIPPED-Ldemo');

/* ---- 候选 = coords.tsv（id ‖ path  F ‖ rank），路径**一律读表里的 path 列** ---- */
const CL = rd(join(HERE, 'coords.tsv')).trim().split('\n'), ch = CL[0].split('\t');
const iId = ch.indexOf('id'), iPath = ch.indexOf('path'), iF = ch.indexOf('F'), iR = ch.indexOf('rank');
if (iPath < 0) { console.error('⛔ coords.tsv 没有 path 列 ⇒ 先跑 node champion-map/attach-path.mjs'); process.exit(2); }
const ALL = CL.slice(1).map(l => { const c = l.split('\t');
  return { id: c[iId], path: c[iPath], F: Number(c[iF]), rank: Number(c[iR]) }; })
  .filter(r => r.id && r.path && r.id !== REF).sort((a, b) => a.rank - b.rank);
const only = String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean);
const cands = only.length ? ALL.filter(r => only.indexOf(r.id) >= 0) : ALL.slice(0, Number(arg('top', 8)) || 8);
const missing = only.filter(id => !ALL.some(r => r.id === id));
if (missing.length) { console.error('⛔ --ids 里这些枚不在名单上（拼错或没进过面板）：' + missing.join(' ')); process.exit(2); }
const refRow = ALL.concat([{ id: REF, path: REF === 'SHIPPED-Ldemo' ? 'js/bundled-champion-3p.js' : '', rank: 0, F: 0 }])
  .find(r => r.id === REF);
if (!refRow || !refRow.path || !existsSync(join(ROOT, refRow.path))) { console.error('⛔ 参照枚 ' + REF + ' 找不到文件'); process.exit(2); }

function exam(subject, fieldOpp, tag) {
  const j = join(HERE, 'duel-' + tag + '.json');
  const cmd = ['tools/style-exam.mjs', subject, String(GAMES), '--n=5', '--seed=' + SEED, '--mode=' + MODE,
    '--styles=champ:' + fieldOpp, '--json=' + j];
  const r = spawnSync(process.execPath, cmd, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) { console.error('⛔ ' + tag + ' 退出码 ' + r.status + '\n' + (r.stderr || r.stdout).split('\n').slice(-8).join('\n')); return null; }
  const o = JSON.parse(rd(j)); const row = o.rows[0];
  if (!row || row.games !== GAMES) { console.error('⛔ ' + tag + ' 落盘里没有风格场那一行（rows[0].games=' + (row && row.games) + '）'); return null; }
  return { first: row.firstRate, top2: row.top2Rate, ranks: row.ranks, games: row.games };
}
const out = [];
function duel(aId, bId, tag) {
  const pa = ALL.concat([{ id: REF, path: refRow.path }]).find(r => r.id === aId);
  const pb = ALL.concat([{ id: REF, path: refRow.path }]).find(r => r.id === bId);
  if (!pa || !pb) { console.log('⛔ 名单里查不到：' + aId + ' / ' + bId); return; }
  if (!existsSync(join(ROOT, pa.path)) || !existsSync(join(ROOT, pb.path))) { console.log('⛔ 缺包：' + pa.path + ' / ' + pb.path); return; }
  const t0 = Date.now();
  const A = exam(pa.path, pb.path, tag + '.A');       /* a 坐受试席，b 占满其余四席 */
  const B = exam(pb.path, pa.path, tag + '.B');       /* 反过来 */
  if (!A || !B) return;
  const d = 100 * (A.first - B.first);
  const se = 100 * Math.sqrt(A.first * (1 - A.first) / A.games + B.first * (1 - B.first) / B.games);
  out.push({ a: aId, b: bId, aPath: pa.path, bPath: pb.path, aFirst: 100 * A.first, bFirst: 100 * B.first,
    diff: d, se: se, aTop2: 100 * A.top2, bTop2: 100 * B.top2, aRanks: (A.ranks || []).join('/'), secs: ((Date.now() - t0) / 1000).toFixed(0) });
  console.log('  ' + aId.padEnd(16) + ' vs ' + bId.padEnd(16) + ' A=' + (100 * A.first).toFixed(1) + '% B=' + (100 * B.first).toFixed(1) +
    '% ⇒ 差 ' + (d >= 0 ? '+' : '') + d.toFixed(1) + ' ±' + se.toFixed(1) + 'pt（' + ((Date.now() - t0) / 1000).toFixed(0) + 's）');
}
console.log('§E334 配对决斗 · 参照 = ' + REF + '（' + refRow.path + '）‖ 候选 ' + cands.length + ' 枚 ‖ 每场 ' + GAMES +
  ' 局 · n5 · ' + MODE + ' · seed 基 ' + SEED + ' ‖ 入口 = tools/style-exam.mjs（champ: 对手场）');
console.log('— 仪器自检（同一枚包打自己 ⇒ 差必须恰好 0）—');
duel(REF, REF, 'selftest-' + SEED);
if (!out.length || Math.abs(out[0].diff) > 1e-9) {
  console.error('⛔ 自检没过（A−B = ' + (out.length ? out[0].diff : '无读数') + '）⇒ 仪器坏了，这一批读数一条都不许引');
  process.exit(2); }
out.length = 0;
console.log('— 正式 —');
for (const c of cands) duel(c.id, REF, 'r' + c.rank + '-' + c.id);

const wins = out.filter(o => o.diff > 0).length, sig = out.filter(o => o.diff - 1.96 * o.se > 0).length;
console.log('\n判定：' + out.length + ' 枚里 ' + wins + ' 枚 A>B（其中 ' + sig + ' 枚超出 1.96SE）‖ 配对差中位 ' +
  (out.length ? out.map(o => o.diff).sort((x, y) => x - y)[Math.floor(out.length / 2)].toFixed(1) : '-') + 'pt');
/* ⚠ 这里不下"F 有效/无效"的结论：只看"几枚赢了参照包"会骗人 —— 判剂量-反应要合两批种子并算秩相关（§E289 的同一套）。*/
const TSVOUT = arg('out', 'duel-e334-s' + SEED + '.tsv');
const P = TSVOUT.indexOf('/') >= 0 ? TSVOUT : join(HERE, TSVOUT);
writeFileSync(P, ['a', 'b', 'aPath', 'bPath', 'aFirst%', 'bFirst%', 'diff_pt', 'approxSE', 'aTop2%', 'bTop2%', 'aRanks', 'secs'].join('\t') + '\n' +
  out.map(o => [o.a, o.b, o.aPath, o.bPath, o.aFirst.toFixed(2), o.bFirst.toFixed(2), o.diff.toFixed(2), o.se.toFixed(2),
    o.aTop2.toFixed(2), o.bTop2.toFixed(2), o.aRanks, o.secs].join('\t')).join('\n') + '\n');
console.log('已写 ' + P + '（' + out.length + ' 行）');
