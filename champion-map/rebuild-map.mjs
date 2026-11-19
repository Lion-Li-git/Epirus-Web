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
import { DEFAULT_COMPARE } from './pipeline/build-view.mjs';

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
/* ① 历史戳：只对 F2/F5 旧图有意义（2026-11-18 起 B=Arena，旧戳不参与当前图） */
const _rul = readFileSync(join(HERE, 'data/rulers.tsv'), 'utf8').replace(/\r/g, '').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
const _b = _rul.find((r) => r[1] === 'B' && r[3] === 'current');
if (_b && ['b-f5-page-1114', 'b-f2-page-1111'].includes(_b[0])) run([join(HERE, 'attach-exam-stamp.mjs'), '--check'], '① exam 批次戳');
else console.log('—— ① 历史戳检查：当前 B=' + (_b ? _b[0] : '?') + ' 非 F2/F5 夹具 ⇒ 跳过（旧戳只服务 gen3 旧图）——');
if (DRY) process.exit(0);
/* ② 从 data/ 编译完整页面视图（canonical + display 模板）
 *    对照锚从 pipeline/build-view.mjs 的 DEFAULT_COMPARE 单源读取（gen10-de-1118），防止与无参 build-view 门禁漂移。 */
run([join(HERE, 'pipeline/build-view.mjs'), '--data=' + DATA,
  '--compare=' + DEFAULT_COMPARE], '② build-view 编译 coords-view');
const viewPath = join(DATA, 'build/coords-view.tsv');
if (!existsSync(viewPath)) { console.error('⛔ 没有 ' + viewPath + '（build-view 没产出）'); process.exit(2); }
/* ③ 同步谱系总表（仅在默认 data/ 时运行：lineage.mjs 读写 data/page/lineage.tsv，防 registry/g3 改后生成物过期）
 *   2026-11-19：registry 里存在缺失权重文件时**不重生成 lineage** —— 11-19 清理删掉了 docs/artifacts/*-out
 *   （800 枚 active、不可恢复），重生成会因配置/融合父粒读不到而把家族并拢、把薄图写进历史（§E503）。
 *   默认保留在册 lineage.tsv 并响亮说明；权重补回后自动恢复，或显式 --require-lineage 强制跑（会按原判据失败）。 */
if (DATA === resolve(HERE, 'data')) {
  run([join(ROOT, 'tools/sync-page-coords.mjs')], '②b sync page/coords.tsv');
  const _missPath = (() => {
    const rp = join(DATA, 'registry.tsv');
    const L = readFileSync(rp, 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
    const h = L[0].split('\t'), ix = {}; h.forEach((c, i) => ix[c] = i);
    let n = 0;
    for (const l of L.slice(1)) { const c = l.split('\t'); const p = c[ix.path]; if (p && !existsSync(join(ROOT, p))) n++; }
    return n;
  })();
  if (_missPath > 0 && !process.argv.includes('--require-lineage')) {
    console.log('—— ③ lineage 跳过：registry 缺 ' + _missPath + ' 枚权重文件（11-19 清理；Gemini 已挽回 130 枚，其中 86 枚是 sha 不同但 wid 相同的 quarantine 件，权重等价；docs/ARTIFACT-LOSS-1119.md）' +
      ' ⇒ 重生成会塌家族/融合父边（§E503）；保留在册 lineage.tsv。补回权重后自动恢复，或加 --require-lineage 强制跑 ——');
  } else {
    run([join(HERE, 'lineage.mjs')], '③ lineage 同步 lineage.tsv');
  }
}
/* ④ 独立趋势页（A/B/C，30 枚滑动；数据仍只读 data/） */
run([join(HERE, 'pipeline/build-trends.mjs')], '④ build-trends 趋势页');
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
