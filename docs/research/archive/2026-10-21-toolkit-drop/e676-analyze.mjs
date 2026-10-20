/* §E676 配对分析（qoder 10-21 早班）
 * 主语是**行为剖面**（她问的是"能不能学会用"），强度只当闸 ⇒ 主尺用既有的 `tools/usage-probe.mjs`（ε=0 贪心，5 席镜像 = "这个策略想用什么"）。
 * 三件必须分开的事：
 *   ① **配对单位 = (起点, seed)**：起点按产物 META 的 `hotstartFrom`（wid）认，不按文件名猜；格按 `recipe.arm` / `recipe.h2p` / `recipe.toolkitOpps` 认。
 *      文件名与 META 不相等就当场点名失配（§E650 那批照抄 `train-3p-out.js` 的教训）。
 *   ② **先报漂移再报 Δ**：同格跨 seed 的 |Δ| 中位就是这把尺的地板，Δ 小于地板只许写"读不出"。
 *      地板用 §E675 在册那批 p2 产物（同起点、同几何、只差 seed）现算，不引旧文档里的数。
 *   ③ base 格 = 上一班的 p2 产物：只有当本臂 `EXIT=9` 且日志点名"同一粒权重已在 e675-out/…p2.js"时才敢这么接（那就是逐字相同的证明）。
 * 用法：node e676-analyze.mjs [--multi=tsv] [--long=tsv] [--dims=proto,shift,guard,reflect,defense,holo,bigT,miniT,ring,charge,railgun,acts,rounds]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ROOT 自解析（归档规矩第 1 条）‖ 尺表默认落在本归档目录的 raw/ 下，复跑不覆盖原件见 README */
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WT || process.env.EPIRUS_ROOT || resolve(HERE, '../../../..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const MULTI = arg('multi', join(HERE, 'raw/usage-multi.tsv'));
const LONG = arg('long', join(HERE, 'raw/usage-long.tsv'));
const AUDIT_M = arg('auditMulti', join(HERE, 'raw/audit-multi.txt'));
const AUDIT_L = arg('auditLong', join(HERE, 'raw/audit-long.txt'));
const USAGE_DIMS = String(arg('dims', 'proto,shift,guard,reflect,defense,defShare,holo,bigT,miniT,ring,charge,railgun,snipe,acts,ji,rounds')).split(',');
/* 强度那一侧用**同一套配对与地板**过一遍 `champ-audit` 的表（不是新尺，是既有体检的既有列） */
const AUDIT_DIMS = String(arg('adims', '考卷1st,严胜,伤害,盾/局,零伤害率,平局率,回合,摆架势,G,种类,座位极差,蓄能,珠浪费,混合场,对被动')).split(',');

const DIRS = [join(ROOT, 'docs/artifacts/e676-out'), join(ROOT, 'docs/artifacts/e675-out')];
const ORIGINS = {};   /* wid → 可读名，来自归档的 origins.tsv（唯一在册的起点身份表） */
const ot = join(ROOT, 'docs/research/archive/2026-10-20-prior-style/origins.tsv');
for (const l of readFileSync(ot, 'utf8').split('\n')) {
  const c = l.split('\t');
  if (c.length >= 4 && /^[A-Za-z0-9]/.test(c[0] || '') && c[2] && c[2] !== 'wid') ORIGINS[c[2]] = c[0];
}

function metaOf(file) {
  const m = /EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(readFileSync(file, 'utf8'));
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}
function cellOf(mt) {
  const r = (mt && mt.recipe) || {};
  const arm = String(r.arm || '');
  /* §E675 那批 p0 产物是**先验关档**，与本班 base（档 2）不同格 ⇒ 单独标掉，绝不混进 base 的分母 */
  if (/-p0/.test(arm)) return 'excluded-p0';
  if (/base/.test(arm)) return 'base';
  if (r.toolkitOpps && String(r.h2p || '').toLowerCase() === 'drop') return 'tk+drop';
  if (r.toolkitOpps) return 'tk';
  if (String(r.h2p || '').toLowerCase() === 'drop') return 'drop';
  if (/-p2/.test(arm)) return 'base';
  return '?';
}

/* id → 文件 + META */
const PACKS = new Map();
for (const d of DIRS) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) {
    if (!/\.js$/.test(f)) continue;
    const mt = metaOf(join(d, f));
    if (!mt || !mt.recipe) continue;
    const r = mt.recipe;
    const seed = Number(r.seed);
    const wid = String(mt.hotstartFrom || '');
    const origin = ORIGINS[wid];
    if (!origin || !Number.isFinite(seed)) continue;
    const id = basename(f).replace(/\.js$/, '');
    PACKS.set(id, { id, file: join(d, f), origin, seed, cell: cellOf(mt), arm: String(r.arm || ''), toolkit: r.toolkitOpps, h2p: r.h2p, prior: r.supportPrior });
  }
}

function readTsv(p) {
  if (!existsSync(p)) { console.error('⛔ 尺表不存在：' + p); return null; }
  const lines = readFileSync(p, 'utf8').trim().split('\n');
  const cols = lines[0].split('\t');
  const rows = {};
  for (const l of lines.slice(1)) {
    const c = l.split('\t');
    const o = {}; for (let i = 0; i < cols.length; i++) o[cols[i]] = c[i];
    rows[o.id] = o;
  }
  return rows;
}

const num = (v) => { const x = Number(String(v == null ? '' : v).replace(/[%(].*$/, '').replace(/[^0-9.eE+-]/g, '')); return Number.isFinite(x) ? x : NaN; };
/* `champ-audit` 没有机器可读输出（无 --json），表是**两格以上空格**对齐的 ⇒ 按 2+ 空格切；
 *  形状不对（列数 <15）的行走 `bad` 计数并点名，不许静默少一枚（少一枚 = 分母错）。 */
function readAudit(p) {
  if (!existsSync(p)) { console.error('⛔ 体检表不存在：' + p); return null; }
  const COLS = ['id', '考卷1st', '严胜', '伤害', '重击', '盾/局', '零伤害率', '平局率', '回合', '反弹墙', '摆架势', '被集火还手', 'F回合', 'G', '种类', '座位极差', '蓄能', '珠浪费', '混合场', '对被动'];
  const rows = {}; let bad = 0; const badLines = [];
  for (const l of readFileSync(p, 'utf8').split('\n')) {
    if (!/\.(js|bak)\b/.test(l)) continue;
    const c = l.trim().split(/\s{2,}/);
    if (c.length < 15) { bad++; badLines.push(l.slice(0, 60)); continue; }
    const o = {};
    for (let i = 0; i < COLS.length; i++) o[COLS[i]] = i === 0 ? c[i] : num(c[i]);
    const kinds = /\((\d+)种\)/.exec(c[13] || '');
    o.种类 = kinds ? Number(kinds[1]) : NaN;
    o.id = basename(String(c[0]).trim()).replace(/\.(js|bak)$/, '');
    rows[o.id] = o;
  }
  if (bad) console.error('⚠ 体检表里有 ' + bad + ' 行列数不足，已跳过（不是"读成 0"）：' + badLines.slice(0, 3).join(' ‖ '));
  return rows;
}
const med = (a) => { const s = a.filter(x => Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return NaN; const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
const f2 = (x) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(2) : '—');

/* ⚑ `champ-audit` 只有一部分列随 `--mode` 变（`SP_MODE` 只管自对局那几列，考卷那几列是固定腿）。
 *   实测（27 枚逐列比）：`考卷1st/严胜/零伤害率/平局率/反弹墙/被集火还手/种类/座位极差/蓄能/珠浪费/混合场/对被动`
 *   在两档下**逐字相同** ⇒ 把它们当"两个模式都印了一次"就是**同一测量数两遍**（§E675 那条"重复测量不是复现"）。
 *   所以下面 long 档遇到这些维度**只点名不重跑配对**。 */
function invariantAuditDims() {
  const a = readAudit(AUDIT_M), b = readAudit(AUDIT_L);
  if (!a || !b) return new Set();
  const ids = Object.keys(a).filter(k => b[k]);
  const inv = new Set();
  for (const dim of AUDIT_DIMS) {
    let same = 0, n = 0;
    for (const id of ids) { const x = a[id][dim], y = b[id][dim]; if (x === undefined || y === undefined) continue; n++; if (String(x) === String(y)) same++; }
    if (n && same === n) inv.add(dim);
  }
  return inv;
}
const AUDIT_INV = invariantAuditDims();

for (const [lab, src, DIMS] of [
  ['usage ‖ multi', MULTI, USAGE_DIMS], ['usage ‖ long', LONG, USAGE_DIMS],
  ['audit ‖ multi', AUDIT_M, AUDIT_DIMS], ['audit ‖ long', AUDIT_L, AUDIT_DIMS]
]) {
  const rows = /audit/.test(lab) ? readAudit(src) : readTsv(src);
  if (!rows) continue;
  console.log('\n########## ' + lab + ' ‖ 尺表=' + basename(src) + ' ‖ 表内 ' + Object.keys(rows).length + ' 枚 ‖ 认得出的产物 ' + PACKS.size + ' 枚 ##########');
  if (/audit/.test(lab) && /long/.test(lab)) {
    console.log('  ⚑ 这些列在两档下**逐字相同**（`champ-audit` 的考卷那几条腿不看 `--mode`）⇒ 本档不重复判，免得把一次测量数两遍：' + Array.from(AUDIT_INV).join(','));
  }

  /* ① 漂移地板：同 (起点,格) 跨 seed 两两 |Δ| 的中位（只用 base 格 = §E675 在册 p2 那批） */
  const byKey = {};
  for (const [id, pk] of PACKS) {
    if (!rows[id]) continue;
    const k = pk.origin + '|' + pk.cell;
    (byKey[k] = byKey[k] || []).push({ seed: pk.seed, r: rows[id] });
  }
  const drift = {}; const driftN = {};
  for (const k in byKey) {
    const list = byKey[k];
    for (const dim of DIMS) {
      const ds = [];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = num(list[i].r[dim]), b = num(list[j].r[dim]);
        if (Number.isFinite(a) && Number.isFinite(b)) ds.push(Math.abs(a - b));
      }
      if (ds.length) { (drift[k] = drift[k] || {})[dim] = med(ds); (driftN[k] = driftN[k] || {})[dim] = ds.length; }
    }
  }
  console.log('\n【地板】同起点同格跨 seed 的 |Δ| 中位 ‖ **只用 base 格**（= 对照组自己的重复性，与 §E675 同一条定义）');
  console.log('   ⚑ 为什么不并处理格的跨 seed 对：那一格里很多维**结构性为 0**（产物根本不出这张卡），|Δ| 当然也是 0 ⇒' +
    ' 地板会被压成 0.00，"超地板"就变成"只要不为零就算" —— 那是把"这把尺在这一维没分辨率"读成"效应显著"。');
  const allKeys = Object.keys(byKey).filter(k => Object.keys(drift[k] || {}).length);
  const baseKeys = Object.keys(byKey).filter(k => k.endsWith('|base') && Object.keys(drift[k] || {}).length);
  const dRows = {};
  for (const k of baseKeys) for (const dim of DIMS) { const v = (drift[k] || {})[dim]; if (Number.isFinite(v)) (dRows[dim] = dRows[dim] || []).push(v); }
  /* 逐枚"活度"：这一维上有多少枚产物根本是 0 ⇒ 地板再小也不代表有分辨率 */
  const alive = {};
  for (const dim of DIMS) {
    const vs = Object.values(rows).map(r => num(r[dim])).filter(Number.isFinite);
    alive[dim] = { n0: vs.filter(v => v === 0).length, n: vs.length, max: vs.length ? Math.max(...vs) : NaN };
  }
  console.log('  贡献地板的组：base ' + baseKeys.length + ' 组（全部同格组 ' + allKeys.length + ' 组）');
  console.log('  维度'.padEnd(12) + '中位 ‖ 逐起点值');
  for (const dim of DIMS) {
    if (!dRows[dim]) continue;
    console.log('  ' + dim.padEnd(10) + med(dRows[dim]).toFixed(2).padStart(6) + ' ‖ ' +
      baseKeys.map(k => (drift[k][dim] === undefined ? '' : (drift[k][dim].toFixed(1))).padStart(6)).join(''));
  }

  /* ② 配对：每个起点 × 每个非 base 格，Δ = 处理 - base（同 seed 先配，seed 缺配就不算） */
  const origins = Array.from(new Set(Array.from(PACKS.values()).map(p => p.origin)));
  const cells = ['tk', 'drop', 'tk+drop'];
  for (const cell of cells) {
    const perDim = {};
    let pairs = 0;
    for (const dim of DIMS) perDim[dim] = [];
    const linesByOrigin = [];
    for (const o of origins) {
      const baseList = (byKey[o + '|base'] || []);
      const treat = Array.from(PACKS.values()).filter(p => p.origin === o && p.cell === cell && rows[p.id]);
      if (!baseList.length || !treat.length) continue;
      const deltas = {};
      for (const t of treat) {
        const b = baseList.find(x => x.seed === t.seed);
        if (!b) { continue; }
        pairs++;
        for (const dim of DIMS) {
          const a = num(rows[t.id][dim]), bb = num(b.r[dim]);
          if (Number.isFinite(a) && Number.isFinite(bb)) (deltas[dim] = deltas[dim] || []).push(a - bb);
        }
      }
      const parts = [];
      for (const dim of DIMS) {
        if (!deltas[dim]) continue;
        const v = deltas[dim].reduce((x, y) => x + y, 0) / deltas[dim].length;
        perDim[dim].push({ o, v, n: deltas[dim].length });
        parts.push(dim + ' ' + f2(v));
      }
      if (parts.length) linesByOrigin.push('  ' + o.padEnd(10) + parts.join(' ‖ '));
    }
    if (!linesByOrigin.length) { console.log('\n【' + cell + '】没有可配对的（base 缺失或产物没进尺表）⇒ 读不出'); continue; }
    console.log('\n【' + cell + ' vs base】配对 ' + pairs + ' 对');
    for (const l of linesByOrigin) console.log(l);
    console.log('  ——判词——');
    for (const dim of DIMS) {
      const arr = perDim[dim]; if (!arr.length) continue;
      if (/audit/.test(lab) && /long/.test(lab) && AUDIT_INV.has(dim)) continue;   // 同一测量不在 long 档再判一遍
      const pos = arr.filter(r => r.v > 0).length, neg = arr.filter(r => r.v < 0).length, zer = arr.filter(r => r.v === 0).length;
      const floor = med((dRows[dim] || []));
      const above = arr.filter(r => Math.abs(r.v) > floor).length;
      const signVerdict = (pos >= 3 && neg === 0) ? '稳定上移' : (neg >= 3 && pos === 0) ? '稳定下移' : (pos >= 3 && neg > 0 && neg <= 1) ? '偏上（有 ' + neg + ' 枚反号，不写结论）'
        : (neg >= 3 && pos > 0 && pos <= 1) ? '偏下（有 ' + pos + ' 枚反号，不写结论）' : '判不动';
      /* 两条判词**都要印**：符号条是 §E675 预注册那条（≥3 起点同号且 0 反号），地板条是同一节里那条结案规则
       * （"效应小于同档换 seed 的漂移 ⇒ 判不动"）。只印符号条会把"漂移范围内的晃动"读成方向 —— 那正是昨晚 DS 踩的坑。 */
      const gated = (signVerdict === '判不动' || !Number.isFinite(floor) || above === 0)
        ? (signVerdict === '判不动' ? '判不动' : '判不动（符号够，但 Δ 中位**低于地板** ⇒ 按 §E675 结案规则不写方向）')
        : (above < arr.length ? signVerdict + '（仅 ' + above + '/' + arr.length + ' 枚超地板）' : signVerdict);
      console.log('  ' + dim.padEnd(10) + '同+' + pos + ' 反-' + neg + ' 零' + zer + ' ‖ Δ中位 ' + f2(med(arr.map(x => x.v))) +
        ' ‖ 地板 ' + f2(floor) + ' ‖ 超地板 ' + above + '/' + arr.length +
        ' ‖ 活度 ' + (alive[dim] ? (alive[dim].n - alive[dim].n0) + '/' + alive[dim].n + '枚非零·最大 ' + alive[dim].max.toFixed(1) : '—') +
        ' ‖ 符号判 ' + signVerdict + ' ‖ 合地板判 ' + gated);
    }
  }
  /* ③ 逐枚原始谱（防"均值吞双峰"） */
  const SP = DIMS.slice(0, 10);
  console.log('\n【逐枚谱】' + lab + ' ‖ 只列前 ' + SP.length + ' 维');
  console.log('  ' + 'id'.padEnd(34) + SP.map(s => String(s).slice(0, 6).padStart(7)).join(''));
  for (const [id, pk] of PACKS) {
    const r = rows[id]; if (!r) continue;
    console.log('  ' + id.padEnd(34) + SP
      .map(k => { const v = num(r[k]); return (Number.isFinite(v) ? v.toFixed(2) : '—').padStart(7); }).join(''));
  }
}
