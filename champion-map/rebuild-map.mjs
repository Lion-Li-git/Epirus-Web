#!/usr/bin/env node
/* rebuild-map.mjs —— 阶段 3：页面只走这一条入口。
 *   ① attach-exam-stamp --check（数据来源戳）
 *   ② build-view（data/ → data/build/coords-view，canonical + display）
 *   ③ viewer（吃 data/build/coords-view.tsv）
 *   ④ shot --hash=mode=tree&check=1（页内自检，0 FAIL 才收工）
 * 为什么不能只把 viewer 的 --fit 默认改 gen3：gen3 没有 xt18/yt18/xt20/yt20，
 *   1.8/2.0 预设会退回 xt/yt 混轴；所以页面入口固定是先派生 projcols 再烘。
 * 用法：node champion-map/rebuild-map.mjs [--skip-shot] [--dry]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const DATA = resolve(arg('data', 'champion-map/data'));
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
/* ② 从 data/ 编译完整页面视图（canonical + display 模板） */
run([join(HERE, 'pipeline/build-view.mjs'), '--data=' + DATA,
  '--compare=champion-map/archive/2026-11-11-legacy-data/coords-gen3-1105.tsv'], '② build-view 编译 coords-view');
const viewPath = join(DATA, 'build/coords-view.tsv');
if (!existsSync(viewPath)) { console.error('⛔ 没有 ' + viewPath + '（build-view 没产出）'); process.exit(2); }
/* ③ 独立趋势页（A/B/C，30 枚滑动；数据仍只读 data/） */
run([join(HERE, 'pipeline/build-trends.mjs')], '③ build-trends 趋势页');
/* ④ 烘页面：flags 以 bake-flags.txt 为单一来源；--fit 固定到 data 编译产物 */
const flagFile = join(HERE, 'bake-flags.txt');
const flags = (existsSync(flagFile)
  ? readFileSync(flagFile, 'utf8').replace(/\r/g, '').trim().split(/\s+/).filter(Boolean)
  : ['--preset=all', '--projcols=1', '--verpages=0']).filter((x) => !x.startsWith('--fit='));
run([join(HERE, 'viewer.mjs'), '--fit=' + viewPath, ...flags], '④ viewer 烘 index.html');
/* ④ 页内自检 */
if (!SKIP_SHOT) {
  const out = run([join(HERE, 'shot.mjs'), '--hash=mode=tree&check=1', '--dump'], '④ shot 页内自检');
  if (!/0 FAIL/.test(out) || !/PASS/.test(out)) {
    console.error('⛔ 页内自检不是 0 FAIL：' + (out.match(/断言：[^\n]*/) || ['（没找到断言行）'])[0]);
    process.exit(1);
  }
  console.log('✅ rebuild-map 完成：data coords-view + index.html + 98/0 自检');
} else {
  console.log('✅ rebuild-map 完成（--skip-shot：未跑页内自检）');
}
