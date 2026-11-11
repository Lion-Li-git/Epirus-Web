#!/usr/bin/env node
/* rebuild-map.mjs —— 阶段 3：页面只走这一条入口。
 *   ① attach-exam-stamp --check（数据来源戳）
 *   ② attach-projcols（gen3 → coords-projcols，幂等）
 *   ③ viewer（吃 bake-flags.txt 的 --fit=coords-projcols.tsv）
 *   ④ shot --hash=mode=tree&check=1（页内自检，0 FAIL 才收工）
 * 为什么不能只把 viewer 的 --fit 默认改 gen3：gen3 没有 xt18/yt18/xt20/yt20，
 *   1.8/2.0 预设会退回 xt/yt 混轴；所以页面入口固定是先派生 projcols 再烘。
 * 用法：node champion-map/rebuild-map.mjs [--skip-shot] [--dry]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DRY = process.argv.includes('--dry');
const SKIP_SHOT = process.argv.includes('--skip-shot');
const run = (args, tag) => {
  const t0 = Date.now();
  const out = execFileSync('node', args, { cwd: ROOT, maxBuffer: 1 << 26, encoding: 'utf8' });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('—— ' + tag + '（' + secs + 's）——');
  const lines = out.trim().split('\n').filter(Boolean);
  console.log(lines.slice(-3).join('\n'));
  return out;
};

console.log('rebuild-map: ' + (DRY ? 'dry' : 'run'));
/* ① 数据戳：缺 unknown / 旧夹具 / C 不符会 exit 2 */
run([join(HERE, 'attach-exam-stamp.mjs'), '--check'], '① exam 批次戳');
if (DRY) process.exit(0);
/* ② 派生页面表 */
run([join(HERE, 'attach-projcols.mjs'),
  '--in=champion-map/coords-gen3-1105.tsv',
  '--out=champion-map/coords-projcols.tsv'], '② attach-projcols');
/* ③ 烘页面：flags 以 bake-flags.txt 为单一来源 */
const flagFile = join(HERE, 'bake-flags.txt');
const flags = existsSync(flagFile)
  ? readFileSync(flagFile, 'utf8').replace(/\r/g, '').trim().split(/\s+/).filter(Boolean)
  : ['--fit=coords-projcols.tsv', '--preset=all', '--projcols=1', '--verpages=0'];
run([join(HERE, 'viewer.mjs'), ...flags], '③ viewer 烘 index.html');
/* ④ 页内自检 */
if (!SKIP_SHOT) {
  const out = run([join(HERE, 'shot.mjs'), '--hash=mode=tree&check=1', '--dump'], '④ shot 页内自检');
  if (!/0 FAIL/.test(out) || !/PASS/.test(out)) {
    console.error('⛔ 页内自检不是 0 FAIL：' + (out.match(/断言：[^\n]*/) || ['（没找到断言行）'])[0]);
    process.exit(1);
  }
  console.log('✅ rebuild-map 完成：projcols + index.html + 98/0 自检');
} else {
  console.log('✅ rebuild-map 完成（--skip-shot：未跑页内自检）');
}
