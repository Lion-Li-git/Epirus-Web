/* 训练侧旋钮普查（Qoder · 11-10）——只读源码，不跑任何臂。
 * 用仓库自己的解析器（server/knob-guard.mjs），不写第二份扫描逻辑：
 *   readKeysOf 的 opt 逐条抄自四个入口各自的 enforceKnobs 调用，否则读集就是假的。
 * 落盘：scratch/qoder-1110-knob-census.tsv（每键一行）+ stdout 摘要。 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readKeysOf, repoKnobUniverse, scanKeysFromSource } from '../server/knob-guard.mjs';

const ENTRIES = [
  { tool: 'train-3p', file: 'tools/train-3p.mjs' },
  { tool: 'train-best', file: 'tools/train-best.mjs' },
  { tool: 'train-fast', file: 'tools/train-fast.mjs' },
  { tool: 'train-server', file: 'server/train-server.mjs' },
];

/* 各入口的 opt —— 与源码里的 enforceKnobs 调用同源（train-3p 要 extraReadKeys=SELF_ENV_KEYS，
 * train-server 要 selfFiles + 三份单一来源列表）。这里若偷工，读集会少一片。 */
const src3p = readFileSync('tools/train-3p.mjs', 'utf8');
const selfEnvKeys = [];
{
  const a = src3p.indexOf('const SELF_ENV_KEYS = [');
  const b = src3p.indexOf('\n];', a);
  if (a < 0 || b < 0) { console.error('找不到 SELF_ENV_KEYS 数组边界'); process.exit(2); }
  for (const k of scanKeysFromSource(src3p.slice(a, b))) selfEnvKeys.push(k);
}
/* 三份单一来源列表 + "已删除键"台账都直接 import（它们是导出的常量 ⇒ 比再写一份解析器可信） */
import { ECON_ENV_KEYS } from '../server/econ-env.mjs';
import { FIGHT_ENV_KEYS } from '../server/fight-env.mjs';
import { TRAIN_ENV_KEYS, REMOVED_TRAIN_KEYS } from '../server/train-env.mjs';
const optsFor = function (e) {
  if (e.tool === 'train-3p') return { tool: e.tool, env: {}, entry: e.file, extraReadKeys: selfEnvKeys };
  if (e.tool === 'train-server') {
    return { tool: e.tool, env: {}, entry: e.file, selfFiles: ['server/train-worker.mjs', 'server/paralleltrain.mjs'],
      extraReadKeys: ECON_ENV_KEYS.concat(FIGHT_ENV_KEYS, TRAIN_ENV_KEYS) };
  }
  return { tool: e.tool, env: {}, entry: e.file };
};

const sets = {};
for (const e of ENTRIES) { const r = readKeysOf(optsFor(e)); sets[e.tool] = r.read; console.error(e.tool + ' 读集=' + r.read.size + '（扫 ' + r.files.length + ' 个文件）'); }
const universe = Array.from(repoKnobUniverse(['tools', 'server'])).sort();
console.error('全集（tools/+server/ 里真出现过的 EPIRUS_*，去注释）=' + universe.length);

/* 已删除键的台账（REMOVED_TRAIN_KEYS，单一来源）——"该关"最硬的一类证据 */
const removed = REMOVED_TRAIN_KEYS;
console.error('已登记"被删除"的键=' + Object.keys(removed).length);

const FAM = [
  ['SEL_*（当选面/选拔键）', /^EPIRUS_SEL_/],
  ['*_OPPS（对手饮食）', /_OPPS(_|$)/],
  ['*_EVERY（隔 K 局/代注入）', /_EVERY$/],
  ['*_W / *_PUSH（奖励权重与推进）', /(_W|_PUSH)$/],
  ['*_MIN / *_MAX / *_GAMES / *_SEEDS（阈值与剂量）', /(_MIN|_MAX|_GAMES|_SEEDS|_HANDS|_SHARE|_EPS|_MODE|_KEYS)$/],
  ['OUTPUT/路径（产物与落盘）', /^(EPIRUS_(T3P_OUT|TB_OUT|BUNDLE_OUT|BAND_DIR|PUBLISH|HOLDOUT_SEG))/],
  ['ARCH/面（obs3b/obs4/obs5 与架构）', /^(EPIRUS_(ARCH2|OBS|FACE))/],
  ['桌形/人数（MIX/MIXHP/MIX8/TRAIN_MODE/HPSEED）', /^(EPIRUS_(MIX|MIXHP|TRAIN_MODE|HPSEED|N_))/],
  ['闸/杀臂（BREADTH_FATAL/CARD_ABORT/ALLOW_DARK）', /(FATAL|ABORT|ALLOW_DARK)/],
];
const famOf = function (k) { for (const [n, re] of FAM) if (re.test(k)) return n; return '其它'; };

const rows = [];
for (const k of universe) {
  const readers = ENTRIES.filter(e => sets[e.tool].has(k)).map(e => e.tool);
  let sites = 0;
  for (const f of ['tools/train-3p.mjs', 'tools/train-best.mjs', 'tools/train-fast.mjs', 'server/train-server.mjs', 'server/train-worker.mjs', 'server/paralleltrain.mjs', 'js/train/evo.js', 'js/train/policy2.js']) {
    try { const s = readFileSync(f, 'utf8'); const re = new RegExp('EPIRUS_' + k.slice(7), 'g'); const m2 = s.match(re); if (m2) sites += m2.length; } catch (e) { }
  }
  rows.push({ k, fam: famOf(k), n: readers.length, readers: readers.join('|') || '（无入口读：只在别处/门体文本里出现）', sites, reg: selfEnvKeys.indexOf(k) >= 0 ? 'Y' : '-', gone: removed[k] ? 'GONE' : '' });
}
rows.sort((a, b) => a.fam === b.fam ? a.k.localeCompare(b.k) : a.fam.localeCompare(b.fam));
writeFileSync('scratch/qoder-1110-knob-census.tsv',
  'knob\tfamily\tentries_reading\twhich\tmention_sites\tin_SELF_ENV_KEYS\tremoved\n' +
  rows.map(r => [r.k, r.fam, r.n, r.readers, r.sites, r.reg, r.gone].join('\t')).join('\n') + '\n');

const byFam = {};
for (const r of rows) byFam[r.fam] = (byFam[r.fam] || 0) + 1;
console.log('=== 按族计数（全集 ' + universe.length + ' 键）===');
for (const [f, c] of Object.entries(byFam).sort((a, b) => b[1] - a[1])) console.log('  ' + String(c).padStart(4) + '  ' + f);
const noReader = rows.filter(r => r.n === 0);
console.log('=== 没有任何训练入口读到的键：' + noReader.length + ' ===');
console.log(noReader.map(r => r.k).join(' '));
const onlyOne = rows.filter(r => r.n === 1);
console.log('=== 只有 1 个入口读到的键（换入口就静默失效那一族）：' + onlyOne.length + ' ===');
console.log(onlyOne.map(r => r.k + '(' + r.readers + ')').join(' '));
console.log('=== train-3p 自己读集里、却没登记进 SELF_ENV_KEYS 的键 ===');
const notReg = Array.from(sets['train-3p']).filter(k => k !== 'EPIRUS_ALLOW_DARK' && selfEnvKeys.indexOf(k) < 0);
console.log(notReg.length + ' 条：' + notReg.slice(0, 40).join(' '));
console.log('\nSEL_* 族逐条：');
for (const r of rows.filter(x => /^EPIRUS_SEL_/.test(x.k))) console.log('  ' + r.k + '  登记=' + r.reg + '  提及=' + r.sites);
console.log('\n回执：scratch/qoder-1110-knob-census.tsv（' + rows.length + ' 行）');
