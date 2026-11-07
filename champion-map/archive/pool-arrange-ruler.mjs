/* pool-arrange-ruler.mjs —— **尺在环里**的排布搜索（§E598 用户裁定："多试几种排布，不是纯靠 Hp，
 * 还可以看一下技能距离（三维行为轴的分散度），尽量让一个池的行为松散一些"）。
 *
 * 为什么不能只按先验排：本班实测两条
 *   ① 纯分散度最优的排布会把强枚（`E3`/`R-s123`/`S-s120`）塞进软带 ⇒ 台阶翻序（§E598 日志）；
 *   ② **在场效应先验与在册尺互相矛盾**：按在场效应，现困难带（均 24.2）比中带（20.2）更软，
 *      而在册尺量的是困难 12.8 < 普通 17.3（困难真的更强）⇒ 混池代理不能当带级强度（§E286 的又一例）。
 *   ⇒ 强度这一维**只能用尺本身**判，所以本工具每一步都跑 `probe-diff-ladder`。
 *
 * 目标：在"阶梯次序成立（困难 < 普通 < 简单，替身夺冠越低越强）"的前提下，最大化三带的**行为分散度之和**
 *   （行为坐标 = `coords.tsv` 的 `x3/y3/z3`，与演化图 3db 同一份；三轴 z 化）。
 * 算法：贪心 —— 每步枚举所有跨带单枚交换（锁定的不算），按分散度增益取前 `--cands` 个，逐个跑尺；
 *   采纳"次序成立且分散度最高"的那个；跑不满 `--steps` 步或没有增益就停。
 *
 * 用法：
 *   node champion-map/pool-arrange-ruler.mjs [--steps=8] [--cands=5] [--games=1000] [--mode=multi]
 *        [--locked=T8-s114:hard,K2:hard,SHIPPED-Ldemo:hard] [--out=<json>] [--apply]
 * ⚠ 默认**只提议不落地**（`--apply` 才把最终排布写进 `pool-members.tsv`）；无论成败都会先备份原表并复原。
 * 退出码：0 = 跑完（打印最佳排布）‖ 2 = 前置不齐（成员缺三维坐标 / 锁定项不在表里）
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const has = k => process.argv.includes('--' + k);
const BANDS = ['hard', 'mid', 'soft'];
const STEPS = Number(arg('steps', 8)), CANDS = Number(arg('cands', 5)), GAMES = Number(arg('games', 1000));
const MODES = arg('mode', 'multi').split(',');      /* ⚠ 默认 multi；**要两种桌形都保序就把两个都写上**（`--mode=multi,long`）——
   * 本班踩过的坑：只按 multi 搜，采纳的那一步在 long 上把中/软次序做倒了（12.4/22.1/19.7）。 */
const OUT = arg('out', '');
const LOCK = arg('locked', 'T8-s114:hard,K2:hard,SHIPPED-Ldemo:hard').split(',').filter(Boolean).map(x => x.split(':'));

const MAP = join(ROOT, 'champion-map', 'pool-members.tsv');
const ORIG = readFileSync(MAP, 'utf8');
const lines = ORIG.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n');
const H = lines[0].split('\t'), ii = H.indexOf('id'), it = H.indexOf('tier');
const ids = lines.slice(1).map(l => l.split('\t')[ii]);
const bandOf = {}; for (const l of lines.slice(1)) { const c = l.split('\t'); bandOf[c[ii]] = c[it]; }
for (const [id, t] of LOCK) { if (!ids.includes(id)) { console.error('⛔ --locked 的 ' + id + ' 不在池表'); process.exit(2); } bandOf[id] = t; }

/* 行为坐标（与 pool-arrange.mjs 同一份口径：coords.tsv 的 x3/y3/z3，三轴各自 z 化） */
const co = readFileSync(join(ROOT, 'champion-map', 'coords.tsv'), 'utf8').replace(/\r?\n$/, '').split('\n');
const ch = co[0].split('\t'), ci = ch.indexOf('id'), cx = ch.indexOf('x3'), cy = ch.indexOf('y3'), cz = ch.indexOf('z3');
const raw = {}; for (const l of co.slice(1)) { const c = l.split('\t'); if (ids.includes(c[ci])) raw[c[ci]] = [Number(c[cx]), Number(c[cy]), Number(c[cz])]; }
const miss = ids.filter(id => !raw[id]); if (miss.length) { console.error('⛔ 缺三维坐标：' + miss.join(' ')); process.exit(2); }
const P = {}; for (let k = 0; k < 3; k++) { const v = ids.map(id => raw[id][k]), m = v.reduce((a, b) => a + b, 0) / v.length; const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; ids.forEach((id, j) => { (P[id] = P[id] || [])[k] = (v[j] - m) / s; }); }
const dist = (a, b) => Math.sqrt((P[a][0] - P[b][0]) ** 2 + (P[a][1] - P[b][1]) ** 2 + (P[a][2] - P[b][2]) ** 2);
const bandsOf = bo => { const o = { hard: [], mid: [], soft: [] }; for (const id of ids) o[bo[id]].push(id); return o; };
const dispOf = bo => { const b = bandsOf(bo); let s = 0, per = {}; for (const x of BANDS) { const a = b[x]; if (a.length < 2) { per[x] = 0; continue; } let t = 0, n = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) { t += dist(a[i], a[j]); n++; } per[x] = t / n; s += per[x]; } return { sum: s, per }; };

const writeTable = bo => { const o = [lines[0]]; for (const l of lines.slice(1)) { const c = l.split('\t'); c[it] = bo[c[ii]]; o.push(c.join('\t')); } writeFileSync(MAP, o.join('\n') + '\n'); };

/* 跑在册尺（逐个模式），返回 { multi: {hard,mid,soft}, long: {...} }（% 替身夺冠） */
function ruler() {
  const res = {};
  for (const m of MODES) {
    const out = execFileSync('node', ['tools/probe-diff-ladder.mjs', '--pairs=1', '--games=' + GAMES, '--pool=1', '--mode=' + m],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    const r = {};
    for (const x of out.matchAll(/^\s*(困难|普通|简单)[^\n]*?替身夺冠\s+([0-9.]+)%/gm)) {
      const k = x[1] === '困难' ? 'hard' : (x[1] === '普通' ? 'mid' : 'soft');
      r[k] = Number(x[2]);
    }
    res[m] = r;
  }
  return res;
}
const ordered = r => MODES.every(m => { const q = r[m] || {}; return q.hard !== undefined && q.mid !== undefined && q.soft !== undefined && q.hard < q.mid && q.mid < q.soft; });
const fmtR = r => MODES.map(m => m + ' ' + (r[m]?.hard ?? '?') + '/' + (r[m]?.mid ?? '?') + '/' + (r[m]?.soft ?? '?')).join(' ‖ ');

let base = { ...bandOf };
let cur = dispOf(base), r0 = ruler();
console.log('起点：分散度和=' + cur.sum.toFixed(3) + '（hard=' + cur.per.hard.toFixed(2) + ' mid=' + cur.per.mid.toFixed(2) + ' soft=' + cur.per.soft.toFixed(2) + '）');
console.log('      尺（' + MODES.join(',') + ' · ' + GAMES + ' 局/档）：' + fmtR(r0) + ' ⇒ ' + (ordered(r0) ? '次序成立 ✓' : '次序不成立 ✗'));

const log = [{ step: 0, disp: cur, ruler: r0, bands: bandsOf(base) }];
try {
  for (let st = 1; st <= STEPS; st++) {
    /* 枚举跨带单枚交换，按分散度增益排序取前 CANDS 个 */
    const b = bandsOf(base), cands = [];
    for (let x = 0; x < BANDS.length; x++) for (let y = x + 1; y < BANDS.length; y++) {
      for (const ia of b[BANDS[x]]) { if (LOCK.some(([l]) => l === ia)) continue;
        for (const ib of b[BANDS[y]]) { if (LOCK.some(([l]) => l === ib)) continue;
          const bo2 = { ...base }; bo2[ia] = BANDS[y]; bo2[ib] = BANDS[x];
          const d = dispOf(bo2); cands.push({ ia, ib, x: BANDS[x], y: BANDS[y], bo2, d }); } }
    }
    cands.sort((p, q) => q.d.sum - p.d.sum);
    const top = cands.filter((c, i, a) => i === a.findIndex(z => z.d.sum === c.d.sum)).slice(0, CANDS);
    let best = null;
    for (const c of top) {
      writeTable(c.bo2);
      let r; try { r = ruler(); } catch (e) { r = {}; }
      const ok = ordered(r);
      console.log('  步' + st + ' 试 ' + c.ia + '(' + c.x + ')↔' + c.ib + '(' + c.y + ') ⇒ 分散 ' + c.d.sum.toFixed(3)
        + ' 尺 ' + fmtR(r) + (ok ? ' ✓' : ' ✗次序'));
      if (ok && c.d.sum > cur.sum && (!best || c.d.sum > best.c.d.sum)) best = { c, r };
    }
    if (!best) { console.log('步' + st + '：没有既保次序又提高分散度的交换 ⇒ 停'); break; }
    base = best.c.bo2; cur = best.c.d; writeTable(base);
    console.log('步' + st + ' 采纳：' + best.c.ia + '↔' + best.c.ib + ' ⇒ 分散和 ' + cur.sum.toFixed(3)
      + ' ‖ 尺 ' + fmtR(best.r));
    log.push({ step: st, disp: cur, ruler: best.r, bands: bandsOf(base) });
  }
} finally {
  /* 无论成败：先复原原表，再由 --apply 决定是否写入最终排布 */
  writeFileSync(MAP, ORIG);
  const last = log[log.length - 1];
  if (has('apply') && last.step > 0) {
    const bo = {}; for (const x of BANDS) for (const id of last.bands[x]) bo[id] = x;
    writeTable(bo);
    console.log('已把最佳排布写进 `pool-members.tsv`（步 ' + last.step + '）');
  } else console.log('（只提议；要落地加 --apply，或按下面清单手改）');
}

const last = log[log.length - 1];
console.log('\n最终排布（分散和 ' + last.disp.sum.toFixed(3) + ' · 尺 ' + fmtR(last.ruler) + '）：');
for (const x of BANDS) console.log('  ' + x + '(' + last.bands[x].length + ')：' + last.bands[x].join(' '));
if (OUT) { writeFileSync(join(ROOT, OUT), JSON.stringify({ madeAt: new Date().toISOString(), modes: MODES, games: GAMES, steps: log }, null, 1) + '\n'); console.log('已写 ' + OUT); }
