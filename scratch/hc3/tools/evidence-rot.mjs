/* 证据腐化体检（**只读**，不写任何文件、不进任何门 —— 2026-10-18 · DS）
 *
 * 病（千问 §E643 §五 实测）：`champion-map/coords.tsv` 的 803 行里，`path` 列指向**不在 git 里**的本机 `.bak` 有 702 行。
 *   ⇒ 换机器、或清理一次 `docs/artifacts/`，图上大片证据就**无法复算**，而且**没有任何门会变红**。
 *   这在本仓是最忌讳的形状：**读数还在、证据已经不在**。
 *
 * 为什么不做成门：规矩 2「总数封顶，加一条必须删一条」—— 摘哪条要用户裁（千问 §E642 待裁 #4 同款理由）。
 *   所以这里只做**读数**：每次跑都印一行，红了也不阻断（但会出现在 `LIVE-LINES.md` 的账上）。
 *
 * 口径：一行的 `path` 只要满足「被 git 跟踪 ‖ 盘上存在」，就算还能复算；
 *   两者都不成立 ⇒ 记为 `rot`（证据已腐化）；只在盘上不跟踪 ⇒ 记为 `local`（换机即腐化）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TSV = join(ROOT, 'champion-map', 'coords.tsv');

const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })
  .split(/\r?\n/).filter(Boolean));

const lines = readFileSync(TSV, 'utf8').replace(/\r/g, '').split('\n').filter(Boolean);
const head = lines[0].split('\t');
const iPath = head.indexOf('path');
if (iPath < 0) { console.error('⛔ coords.tsv 里没有 path 列 ⇒ 口径变了，拒绝瞎读'); process.exit(2); }

let rows = 0, trackedOk = 0, localOnly = 0, rot = 0;
const rotSample = [], localSample = [];
for (const ln of lines.slice(1)) {
  const c = ln.split('\t');
  const p = String(c[iPath] || "").trim();
  if (!p) continue;
  rows++;
  const inGit = tracked.has(p);
  const onDisk = existsSync(join(ROOT, p));
  if (inGit) trackedOk++;
  else if (onDisk) { localOnly++; if (localSample.length < 3) localSample.push(p); }
  else { rot++; if (rotSample.length < 3) rotSample.push(p); }
}

const pct = (n) => rows ? (100 * n / rows).toFixed(1) + '%' : '—';
console.log('证据腐化体检（coords.tsv · 只读）');
console.log('  行数 ' + rows + ' ‖ 可复算（被跟踪）' + trackedOk + '（' + pct(trackedOk) + '）'
  + ' ‖ 只在盘上（换机即腐化）' + localOnly + '（' + pct(localOnly) + '）'
  + ' ‖ 已腐化 ' + rot + '（' + pct(rot) + '）');
if (localSample.length) console.log('  ⚠ 只在盘上的样本：' + localSample.join(' ‖ '));
if (rotSample.length) console.log('  ⛔ 已腐化的样本：' + rotSample.join(' ‖ '));
if (rot > 0) console.log('  ⇒ 有 ' + rot + ' 行指向的行**既不在 git、也不在盘上** ⇒ 那些读数已无法复算（本条只记录，不阻断）');
process.exit(0);