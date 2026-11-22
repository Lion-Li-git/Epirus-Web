#!/usr/bin/env node
/* v7-scan-plan.mjs —— 从旧谱系表推早期 server 缺件的复现队列（2026-11-22，Qoder）
 *
 * 为什么要有：11-19 清理事故后 fam4/5/6 还剩 310 枚权重缺失，历届夜班的做法是"猜 env 阶梯 + 盲扫"
 *   （11-21 handoff §三 立的规矩），两轮裸盲扫 0 命中后判定"必须逐批挖会话原文精配 env"。
 *   但 page/lineage.tsv 里三列一直没被当恢复依据用：
 *     parent / parentOf / parentName = 该枚的热启动根（11-20 起只被画图用）
 *     metaSeed                       = 该枚的训练 seed（此前靠包名尾号猜，尾号规则实测不可靠）
 *     wid                            = 身份判据（anchor-recover 在用）
 *   本工具把三者合成"每批先跑 1 枚探针"的队列：探针中 ⇒ 整批按表内 seed 铺开；不中 ⇒ 该批确有表外变量，
 *   考古目标从"猜配置"缩成"差分定位这一批缺哪一维"。
 *
 * 用法：node tools/v7-scan-plan.mjs [--fams=4,5,6] [--out=docs/research/v7-scan-plan.tsv] [--no-tsv]
 *   退出码 0=出表；2=输入对不上（缺件数与台账不符等，宁可红也不出半张表）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { rejectUnknownFlags } from './audit-lib.mjs';
if (process.argv[1] && process.argv[1].endsWith('v7-scan-plan.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['fams', 'out', 'no-tsv'], 'v7-scan-plan');
}
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const FAMS = new Set((arg('fams', '4,5,6') || '').split(',').filter(Boolean));
const OUT = arg('out', 'docs/research/v7-scan-plan.tsv');

const tsv = (f) => readFileSync(f, 'utf8').replace(/\r/g, '').trim().split('\n');
const lin = tsv('champion-map/data/page/lineage.tsv');
const H = lin[0].split('\t'), ix = Object.fromEntries(H.map((c, i) => [c, i]));
const ROWS = lin.slice(1).map((l) => l.split('\t'));
const BY_ID = new Map(ROWS.map((c) => [c[ix.id], c]));

const reg = tsv('champion-map/data/registry.tsv');
const rh = reg[0].split('\t'), rx = Object.fromEntries(rh.map((c, i) => [c, i]));
const LED = new Map(tsv('docs/ARTIFACT-LOSS-1119.tsv').slice(1).map((l) => { const c = l.split('\t'); return [c[0], c[2]]; }));
const state = (id) => LED.get(id) || 'unknown';

const miss = ROWS.filter((c) => FAMS.has(c[ix.fam]) && state(c[ix.id]) === 'missing');
const KNOBS = ['divW', 'divK', 'divRoleW', 'divCatW', 'oppsN', 'stockBonus', 'hoardPen', 'dealW', 'firstW',
  'whistlePen', 'styleW', 'gens', 'mode', 'seedEmb'];

/* 进出对账（11-20 之夜立的规矩：读入 ≠ 出表就停，别交半张表） */
const ledgerMissing = [...LED.entries()].filter(([, s]) => s === 'missing').length;
const famsInLedger = miss.length + ROWS.filter((c) => FAMS.has(c[ix.fam]) && ['ok', 'sha-diff-wid-same', 'no-path'].includes(state(c[ix.id]))).length;
if (famsInLedger === 0 || miss.length === 0) {
  console.error('⛔ 没读到任何缺件行（台账 missing 共 ' + ledgerMissing + '）⇒ 台账路径或 fam 口径不对，不出口径不明的表');
  process.exit(2);
}

/* 根解析：parentOf/parentName 命中行优先，其次按 8 位 wid 前缀回找 */
function resolveRoot(c) {
  for (const k of [ix.parentOf, ix.parentName]) {
    const v = (c[k] || '').trim();
    if (v && BY_ID.has(v)) return BY_ID.get(v);
  }
  const p = (c[ix.parent] || '').trim();
  if (p && p !== '-') for (const r of ROWS) { const w = r[ix.wid] || ''; if (w.length >= 8 && (w.startsWith(p) || p.startsWith(w.slice(0, 8)))) return r; }
  return null;
}

const batches = new Map();
for (const c of miss) {
  const b = c[ix.id].replace(/-\d+$/, '');
  if (!batches.has(b)) batches.set(b, []);
  batches.get(b).push(c);
}

const out = [];
const tierCount = new Map();
for (const [b, arr] of [...batches.entries()].sort((a, z) => z[1].length - a[1].length)) {
  const roots = arr.map(resolveRoot);
  const unresolved = roots.filter((r) => !r).length;
  const blocked = roots.filter((r) => r && state(r[ix.id]) === 'missing').map((r) => r[ix.id]);
  const tier = unresolved > 0 ? 'T3根查不到' : blocked.length > 0 ? 'T2父仍在缺件' : 'T1根已在盘';
  tierCount.set(tier, (tierCount.get(tier) || 0) + 1);
  const vecs = new Set(arr.map((c) => KNOBS.map((k) => (c[ix[k]] || '').trim()).join('|')));
  const slots = [...new Set(arr.map((c) => (c[ix.parentOf] || '').trim() || '-'))];
  out.push({
    batch: b, tier, packs: arr.length, ids: arr.map((c) => c[ix.id]).join(' '),
    seeds: arr.map((c) => (c[ix.metaSeed] || '').trim()).join(' '),
    rootBatch: slots.join('/'), rootState: tier === 'T1根已在盘' ? 'ok' : [...new Set(blocked)].join('/'),
    knobUniform: vecs.size === 1 ? 'uniform' : vecs.size + '种',
    knobs: vecs.size === 1 ? [...vecs][0] : [...vecs].join(' ; '),
    oppsN: [...new Set(arr.map((c) => (c[ix.oppsN] || '').trim()))].join('/'),
    probeFirst: tier === 'T1根已在盘' ? arr[0][ix.id] + '@' + (arr[0][ix.metaSeed] || '?') : '先复现父：' + ([...new Set(blocked)][0] || '?'),
  });
}

if (!process.argv.includes('--no-tsv')) {
  const cols = ['batch', 'tier', 'packs', 'rootBatch', 'rootState', 'seeds', 'oppsN', 'knobUniform', 'knobs', 'probeFirst', 'ids'];
  writeFileSync(OUT, cols.join('\t') + '\n' + out.map((r) => cols.map((k) => String(r[k])).join('\t')).join('\n') + '\n');
}

const t1 = out.filter((r) => r.tier === 'T1根已在盘');
console.log('目标缺件 ' + miss.length + ' 枚 / ' + out.length + ' 批（台账 missing 共 ' + ledgerMissing + ' ‖ fam 口径 ' + [...FAMS].join(',') + '）');
for (const [t, n] of tierCount) {
  const p = out.filter((r) => r.tier === t).reduce((s, r) => s + r.packs, 0);
  console.log('  ' + t + ' —— ' + n + ' 批 / ' + p + ' 枚');
}
console.log('\n探针优先队列（T1 前 15 批，每批 1 次跑判"这批是否只靠表内配方"）：');
for (const r of t1.slice(0, 15)) {
  console.log('  ' + r.batch.padEnd(13) + String(r.packs).padStart(2) + ' 枚 ‖ 槽 ' + r.rootBatch.padEnd(15) +
    ' ‖ seed ' + r.seeds.slice(0, 22).padEnd(23) + ' ‖ 先跑 ' + r.probeFirst);
}
const big = t1.filter((r) => r.packs >= 6);
console.log('\n收益排序建议：≥6 枚的 T1 批 ' + big.length + ' 个（覆盖 ' + big.reduce((s, r) => s + r.packs, 0) + ' 枚），' +
  '只需 ' + big.length + ' 次探针；整批铺开总跑数 = T1 ' + t1.reduce((s, r) => s + r.packs, 0) + ' 枚（每枚 1 次，seed 已在表里）。');
console.log('T2 的 ' + (tierCount.get('T2父仍在缺件') || 0) + ' 批是父子链（例 v7aim1 → v7aim2 → v7cur），T1 命中后按链深自然解锁。');
if (!process.argv.includes('--no-tsv')) console.log('队列表已落盘：' + OUT);
