#!/usr/bin/env node
/* 出土训练命令的"照抄体检"（11-20 深夜 · 只读，产物落 scratch）
 * 问的是：一个班次今天把会话里挖出来的命令原样贴进终端，会发生什么？
 * 判据全部来自生产代码，不手抄名单：
 *   - 已删除键 / 暗键：`training/server/knob-guard.mjs` 的 `detectDarkKnobs`（train-3p 的真参数形态）
 *   - SELF_ENV_KEYS：从 `training/train-3p.mjs` 源码**机械提取**（该数组没 export）
 *   - 旗标形态：v1.5.244 起 `train-3p` 只吃位置参数，带 `--x=y` 一律 exit 64（源码里的响亮失败）
 *   - 入口：今天还在吗 / 搬到哪了（tools/→training/、pg-train|supfit-gd→training/proto2/）
 *   - 依赖母本：SEEDPACK / BASE / 热启动件在不在盘上（缺 ⇒ 得先复刻上游，形成依赖链）
 * 用法：node scratch/qoder-1120-recipemine/command-checkup.mjs
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { detectDarkKnobs } from '../training/server/knob-guard.mjs';
import { REMOVED_TRAIN_KEYS } from '../training/server/train-env.mjs';

const REPO = resolve(import.meta.dirname, '..');
const OUTDIR = join(REPO, 'scratch', 'command-checkup');
const RECDIR = join(REPO, 'docs', 'research', 'session-records-2026-11-20');

/* SELF_ENV_KEYS 不 export ⇒ 从源码读，保证跟代码走 */
const src = readFileSync(join(REPO, 'training/train-3p.mjs'), 'utf8');
const blk = /const SELF_ENV_KEYS = \[([\s\S]*?)\];/.exec(src);
if (!blk) { console.error('⛔ 提不到 SELF_ENV_KEYS ⇒ 体检的暗键判据不可用，别出表'); process.exit(2); }
const SELF_ENV_KEYS = [...blk[1].matchAll(/'(EPIRUS_[A-Z0-9_]+)'/g)].map(m => m[1]);
console.log('[名单] SELF_ENV_KEYS 机械提取:', SELF_ENV_KEYS.length, '枚 ‖ REMOVED_TRAIN_KEYS:', Object.keys(REMOVED_TRAIN_KEYS).length, '枚');

const ENTRY_MAP = [
  ['tools/train-3p.mjs', 'training/train-3p.mjs'],
  ['tools/pg-train.mjs', 'training/proto2/pg-train.mjs'],
  ['tools/supfit-gd.mjs', 'training/proto2/supfit-gd.mjs'],
  ['training/supfit-gd.mjs', 'training/proto2/supfit-gd.mjs'],
  ['training/pg-train.mjs', 'training/proto2/pg-train.mjs'],
];
function entryState(cmd) {
  const m = /(?:node|python\d?)\s+([\w\-./\\]*?([\w\-]+\.m?js))/.exec(cmd);
  const hits = [...cmd.matchAll(/([\w\-./\\]*train-3p\.mjs|[\w\-./\\]*train-best\.mjs|[\w\-./\\]*pg-train\.mjs|[\w\-./\\]*supfit[\w\-]*\.mjs)/g)].map(x => x[1].replace(/^\.\//, ''));
  const e = hits[0] || (m ? m[1] : '');
  if (!e) return { entry: '', state: 'NO-ENTRY' };
  if (existsSync(join(REPO, e))) return { entry: e, state: 'OK' };
  const mp = ENTRY_MAP.find(x => e.endsWith(x[0]));
  if (mp && existsSync(join(REPO, mp[1]))) return { entry: e, state: 'MOVED', now: mp[1] };
  return { entry: e, state: 'GONE' };
}

const ENVKV = /(?:^|[\s;&(])(EPIRUS_[A-Z0-9_]+)=([^\s;)"']+)/g;
const DEP = /(?:EPIRUS_SEEDPACK|--base|EPIRUS_BASE|--seedpack|SEEDPACK)=?([\w\-./\\]+\.(?:bak|js))/g;

const TRAINER = /(train-3p|train-best|pg-train|supfit[\w-]*)\.m?js/;
/* 残缺片段判据：会话/遥测里被切断的命令尾巴（`| grep -E`、`tail -2;`、以 . 开头的路径）⇒ 不可判"可用" */
const FRAGMENT = /(\|\s*(grep|tail|head)\s*(-\w+\s+)*[A-Za-z]*\s*$)|(EPIRUS_[A-Z0-9_]+="?\$[A-Za-z])|(\s\.[\w\-]+\.bak)/;
function checkup(cmd) {
  const env = {};
  for (const m of cmd.matchAll(ENVKV)) env[m[1]] = m[2];
  const es = entryState(cmd);
  if (!TRAINER.test(es.entry || '')) return { ...es, n_keys: Object.keys(env).length, dark: '', removed: '', flagform: '', deps_missing: '', verdict: es.entry ? 'NOT-TRAINER' : 'NO-ENTRY' };
  if (FRAGMENT.test(cmd)) return { ...es, n_keys: Object.keys(env).length, dark: '', removed: '', flagform: '', deps_missing: '', verdict: 'UNREADABLE-FRAGMENT' };
  const keys = Object.keys(env);
  const out = { ...es, n_keys: keys.length, dark: '', removed: '', flagform: '', deps_missing: '', verdict: '' };
  if (keys.length) {
    const d = detectDarkKnobs(env, { tool: 'train-3p', entry: 'training/train-3p.mjs', extraReadKeys: SELF_ENV_KEYS, removed: REMOVED_TRAIN_KEYS });
    out.dark = (d.dark || []).join(',');
    out.removed = (d.gone || d.removed || []).join(',');
  }
  if (/--\w+=/.test(cmd) && /train-3p\.mjs/.test(es.entry)) out.flagform = 'has --flag';
  const miss = [];
  for (const m of cmd.matchAll(DEP)) { if (!existsSync(join(REPO, m[1].replace(/^\.\//, '')))) miss.push(m[1]); }
  out.deps_missing = miss.join(',');
  out.verdict =
    es.state === 'GONE' ? 'COPY-FAIL-ENTRY-GONE' :
    out.removed ? 'COPY-FAIL-DEAD-KEY' :
    out.flagform && es.state !== 'MOVED' ? 'COPY-FAIL-FLAGFORM' :
    out.dark ? 'COPY-FAIL-DARK-KEYS' :
    out.deps_missing ? 'NEED-PREREQ' :
    es.state === 'MOVED' ? 'COPY-NEEDS-PATH-FIX' :
    es.state === 'NO-ENTRY' ? 'UNSURE(no entry parsed)' : 'COPY-OK';
  return out;
}

/* 输入表必须**在册**：原来指向 `scratch/v7-mined/`（gitignore）⇒ 换台机器或干净克隆里就只剩半张表，
 *   而那半张看起来一样能出汇总（在册 R2 那一族）。两张都已复制进 `docs/research/session-records-2026-11-20/`。 */
const sources = [
  ['qoder-telemetry-404', join(RECDIR, 'qoder-sessions-commands.tsv')],
  ['qoder-transcript-143', join(RECDIR, 'qoder-transcript-trainruns.tsv')],
];
for (const [tag, p] of sources) {
  if (!existsSync(p)) { console.error('⛔ 输入表不在：' + p + '（' + tag + '）⇒ 缺一张就是半张表，不出结论'); process.exit(2); }
}
if (!existsSync(OUTDIR)) { mkdirSync(OUTDIR, { recursive: true }); }
const rows = [];
let rows_in = 0;
const perSrc = {};
for (const [tag, p] of sources) {
  if (!existsSync(p)) { console.log('（跳过，不在盘上）' + p); continue; }
  perSrc[tag] = { in: 0, out: 0 };
  const L = readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const h = L[0].split('\t');
  const ci = h.indexOf('command');
  const di = h.indexOf('date');
  for (const line of L.slice(1)) {
    const c = line.split('\t');
    /* command 是最后一列 ⇒ 它内部若含 tab 要把剩下的段拼回来（上一版就是在这里丢了 66 行） */
    let cmd = c.slice(ci).join('\t') || '';
    rows_in++; perSrc[tag].in++;
    cmd = cmd.replace(/`/g, ' ').replace(/\s+\+\s+(?=EPIRUS_|node\s)/g, ' ');
    if (!cmd.trim()) continue;
    const r = checkup(cmd);
    rows.push({ src: tag, date: c[di] || '', verdict: r.verdict, entry: r.entry, state: r.state, now: r.now || '',
      n_keys: r.n_keys, dark: r.dark, removed: r.removed, deps_missing: r.deps_missing, cmd: cmd.replace(/\s+/g, ' ').slice(0, 300) });
    perSrc[tag].out++;
  }
}
console.log('体检条数:', rows.length, '‖ 各来源 进/出:', JSON.stringify(perSrc));

const head = ['src', 'date', 'verdict', 'entry_state', 'entry', 'now', 'n_env', 'dark_keys', 'dead_keys', 'deps_missing', 'command'];
const cell = (x) => String(x == null ? '' : x).replace(/[\t\n\r]/g, ' ');
const tsv = [head.join('\t')].concat(rows.map(r =>
  [r.src, r.date, r.verdict, r.state, r.entry, r.now, r.n_keys, r.dark, r.removed, r.deps_missing, r.cmd].map(cell).join('\t'))).join('\n') + '\n';
writeFileSync(join(OUTDIR, 'command-checkup.tsv'), tsv);

/* 完整性自证：读入行数必须等于出表行数（上一版在这里静默丢了 66 行） */
console.log('[完整性] 读入数据行 ' + rows_in + ' ‖ 出表 ' + rows.length + ' ‖ 差 ' + (rows_in - rows.length));
if (rows_in !== rows.length) console.log('⚠ 有行没进表（差值见上）⇒ 先查清是解析丢的还是判据跳过，别当全量引用');

const byVerdict = {}, bySrcVerdict = {};
for (const r of rows) {
  byVerdict[r.verdict] = (byVerdict[r.verdict] || 0) + 1;
  const k = r.src + ' | ' + r.verdict;
  bySrcVerdict[k] = (bySrcVerdict[k] || 0) + 1;
}
console.log('\n=== 按判定汇总 ===');
for (const [k, v] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) console.log('  ' + v + '\t' + k);
console.log('\n=== 分来源 ===');
for (const [k, v] of Object.entries(bySrcVerdict).sort()) console.log('  ' + v + '\t' + k);
const dk = {};
for (const r of rows) for (const k of (r.dark ? r.dark.split(',') : [])) dk[k] = (dk[k] || 0) + 1;
console.log('\n=== 最常撞的暗键 top 12（今天这个入口读不到）===');
for (const [k, v] of Object.entries(dk).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log('  ' + v + '\t' + k);
console.log('\n已写 ' + join(OUTDIR, 'command-checkup.tsv'));
