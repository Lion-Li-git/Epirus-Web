#!/usr/bin/env node
/* server-batch-config.mjs —— 每批的回放配置：同前缀幸存者 META 直读（opps/gens/pop/games/mode/workers）
 * 输出 scratch/v7-mined/server-batch-config.tsv: batch<TAB>fam<TAB>n_missing<TAB>missing_ids...<TAB>survivor_id<TAB>survivor_path<TAB>opps<TAB>gens<TAB>pop<TAB>games<TAB>mode<TAB>workers<TAB>hot<TAB>era_ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseMeta, packArr, widOfArr } from '../champion-map/pack-id.mjs';

const led = {};
readFileSync('docs/ARTIFACT-LOSS-1119.tsv', 'utf8').split('\n').slice(1).forEach((l) => {
  const c = l.split('\t');
  if (c.length >= 4) led[c[0]] = { st: c[2], path: c[1] };
});
const reg = {};
readFileSync('champion-map/data/registry.tsv', 'utf8').split('\n').slice(1).forEach((l) => {
  const c = l.split('\t');
  if (c.length >= 9) reg[c[0]] = { path: c[1], fam: c[3] };
});
const lin = {};
readFileSync('champion-map/data/page/lineage.tsv', 'utf8').split('\n').slice(1).forEach((l) => {
  const c = l.split('\t');
  if (c.length >= 27) lin[c[0]] = { ts: c[3], seed: c[4], wid: c[9] };
});

/* 批前缀分组（id 去尾段） */
const batches = new Map();
for (const [id, linI] of Object.entries(lin)) {
  if (!reg[id]) continue;
  const st = led[id] ? led[id].st : '';
  if (st !== 'missing' && st !== 'ok' && st !== 'sha-diff-wid-same') continue;
  const fam = reg[id].fam;
  if (!['1', '2', '3', '4', '5', '6'].includes(fam)) continue;
  const base = id.includes('-') ? id.slice(0, id.lastIndexOf('-')) : id;
  if (!batches.has(base)) batches.set(base, { fam, missing: [], ok: [], tsMin: '', tsMax: '' });
  const B = batches.get(base);
  if (linI.ts) {
    if (!B.tsMin || linI.ts < B.tsMin) B.tsMin = linI.ts;
    if (linI.ts > B.tsMax) B.tsMax = linI.ts;
  }
  if (st === 'missing') B.missing.push(id);
  else B.ok.push(id);
}

const rows = [];
for (const [base, B] of batches) {
  if (!B.missing.length) continue;
  let cfg = null, survId = '', survPath = '';
  for (const sid of B.ok) {
    const p = (led[sid] && led[sid].path) || reg[sid].path;
    if (!p || !existsSync(p)) continue;
    const m = parseMeta(readFileSync(p, 'utf8'));
    if (!m || m.source !== 'server/train-server.mjs') continue;
    cfg = { opps: m.opps, gens: m.gens, pop: m.pop, games: m.games, mode: m.mode || 'multi', workers: m.workers, hot: m.hotstartFrom, styleOpps: m.styleOpps || '', styleW: m.styleW };
    survId = sid;
    survPath = p;
    break;
  }
  rows.push({ base, fam: B.fam, n: B.missing.length, ids: B.missing, cfg, survId, survPath, tsMin: B.tsMin, tsMax: B.tsMax });
}
rows.sort((a, b) => b.n - a.n);
const out = ['batch\tfam\tn_missing\tmissing_ids\tseeds\tsurvivor\tsurvivor_path\topps\tgens\tpop\tgames\tmode\tworkers\thot\tts_min\tts_max\tcfg_src'];
for (const r of rows) {
  const seeds = r.ids.map((i) => (lin[i] ? lin[i].seed : '?')).join(',');
  out.push([r.base, r.fam, r.n, r.ids.join(','), seeds, r.survId, r.survPath,
    r.cfg ? r.cfg.opps : '(无幸存者)', r.cfg ? r.cfg.gens : '', r.cfg ? r.cfg.pop : '', r.cfg ? r.cfg.games : '',
    r.cfg ? r.cfg.mode : '', r.cfg ? r.cfg.workers : '', r.cfg ? r.cfg.hot : '', r.tsMin.slice(0, 16), r.tsMax.slice(0, 16),
    r.cfg ? 'META' : 'INFER'].join('\t'));
}
writeFileSync('scratch/v7-mined/server-batch-config.tsv', out.join('\n') + '\n');
const withCfg = rows.filter((r) => r.cfg).reduce((s, r) => s + r.n, 0);
console.log('批', rows.length, '‖ 有 META 配置的批覆盖包数', withCfg, '‖ 无配置', 505 - withCfg > 0 ? rows.filter((r) => !r.cfg).reduce((s, r) => s + r.n, 0) : 0);
for (const r of rows.slice(0, 14)) {
  console.log('%-14s fam%s n=%-3d %s oppsN=%d pop=%s workers=%s ts %s→%s', r.base, r.fam, r.n, r.cfg ? 'META✓' : 'INFER', r.cfg ? (r.cfg.opps || '').split(',').length : 0, r.cfg && r.cfg.pop, r.cfg && r.cfg.workers, r.tsMin.slice(5, 10), r.tsMax.slice(5, 10));
}
