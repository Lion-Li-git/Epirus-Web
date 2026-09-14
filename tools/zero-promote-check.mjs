/* v1.5.33：**零提升检测**（防"静默冻结"）。
 *
 * 起因（实测）：v7both / v7soft 两臂 **6/6 seed 的产物逐字节等于热启动种子** —— 训练其实一次提升都没发生，
 * 但流程把它们当正常产物写盘、还拿去评估（白白烧掉一轮实验）。
 * 机制：奖励把顶端个体推向不健康区域 ⇒ 健康门槛拒掉每一次提升 ⇒ 冠军冻在种子（兜底逻辑把它写了出来）。
 *
 * 用法：node tools/zero-promote-check.mjs <臂标签> <种子文件> [seed1,seed2,...]
 *   例：node tools/zero-promote-check.mjs v7soft docs/artifacts/champion-5p-v1.3.58.bak 31,32,33,34,35,36
 * 判据：产物权重哈希 == 种子（嵌入 v7 后）的权重哈希 ⇒ 该 seed **零提升**。
 * 退出码：有任一 seed 零提升 ⇒ 3（可被脚本捕获；0 = 全部有提升）。
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox } from './audit-lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [ARM, SEEDFILE, SEEDLIST] = process.argv.slice(2);
if (!ARM || !SEEDFILE) { console.error('用法: node tools/zero-promote-check.mjs <臂标签> <种子文件> [seed1,seed2,...]'); process.exit(1); }
const seeds = (SEEDLIST || '31,32,33,34,35,36').split(',').map(function (x) { return Number(x.trim()); }).filter(Boolean);

const W = sandbox(ROOT);
const P = W.EpirusPolicy;
const readPack = function (f) {
  const s = readFileSync(f, 'utf8');
  const m = /EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(s);
  return m ? JSON.parse(m[1]) : null;
};
const hashOf = function (arr) { return createHash('sha1').update(JSON.stringify(arr)).digest('hex').slice(0, 12); };

/* 种子按"训练起点"口径嵌入 v7（与服务端 loadSeed 的 embedLegacy 同一路径） */
const seedPack = readPack(SEEDFILE);
if (!seedPack) { console.error('读不到种子包: ' + SEEDFILE); process.exit(1); }
const seedRaw = P.unpack(seedPack, true);
const seedEmb = seedRaw ? P.embedLegacy(seedRaw) : null;
const seedHash = seedEmb ? hashOf(seedEmb) : null;

let frozen = 0, ok = 0, missing = 0;
console.log('臂=' + ARM + '  种子哈希=' + (seedHash || '(旧形状)') + '  种子文件=' + SEEDFILE);
for (const sd of seeds) {
  const f = join(ROOT, 'docs', 'artifacts', ARM + '-' + sd + '.bak');
  if (!existsSync(f)) { console.log('  seed ' + String(sd).padEnd(3) + ' （无产物）'); missing++; continue; }
  const pack = readPack(f);
  const raw = pack ? P.unpack(pack, true) : null;
  if (!raw) { console.log('  seed ' + String(sd).padEnd(3) + ' ⚠ 产物读不出（形状/指纹不符）'); missing++; continue; }
  const emb = P.embedLegacy(raw);
  const same = seedHash && hashOf(emb) === seedHash;
  console.log('  seed ' + String(sd).padEnd(3) + (same ? ' ❌ **零提升**（产物 = 热启动种子）' : ' ✅ 有提升') + '  哈希=' + hashOf(emb));
  if (same) frozen++; else ok++;
}
console.log('汇总：有提升 ' + ok + ' / 零提升 ' + frozen + ' / 缺产物 ' + missing);
if (frozen > 0) {
  console.error('⛔ 该臂存在零提升的 seed ⇒ 训练很可能被"奖励把顶端个体推向不健康区 + 健康门槛全拒"冻死（见 CHANGELOG v1.5.31/v1.5.32）。');
  process.exit(3);
}
