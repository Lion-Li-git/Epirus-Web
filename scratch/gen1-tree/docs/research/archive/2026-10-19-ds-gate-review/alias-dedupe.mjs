/* §E654 G3 的自证：别名登记**幂等**（同一 (wid, canonical, wantedPath) 不许重复追加）
 *   为什么要有这一台：10-19 主树里一趟门跑完，`champion-map/pack-aliases.tsv` 多了 **3 行同一个三元组**（只有 ts 不同）
 *   ⇒ ① 门跑一轮就改一次 tracked 文件、越跑越长；② 读账的人会把一次事件读成三次（"重复测量不是复现"同族）。
 *   ⚑ 每一步都另起一个进程：`pack-guard` 的 `widIndex(root,scope)` 有**进程内缓存**，
 *     同进程连着调的话后一次看到的是前一次之前的索引 ⇒ 第一版我这台就是这样"什么都没测到"（顺手记一条：
 *     `keep-artifact.mjs`/`soup-pack.mjs` 这类"一轮里写多份"的工具真会踩这个缓存，那是另一件事，已登记）。
 * 用法：node alias-dedupe.mjs */
import { readFileSync, existsSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const STEP = join(HERE, 'alias-dedupe-step.mjs');
const SRC = join(ROOT, 'docs/artifacts/kept/e641-out__t5-151-ringon.bak');
if (!existsSync(SRC)) { console.error('⛔ 造权重用的产物不在盘上：' + SRC); process.exit(2); }

const tmp = mkdtempSync(join(os.tmpdir(), 'aliasdedupe-'));
let fail = 0;
const ck = (nm, okk, got) => { console.log((okk ? '  PASS ' : '  ⛔ FAIL ') + nm + (got === undefined ? '' : '  ⇒ ' + got)); if (!okk) fail++; };
const rowsOf = () => { const p = join(tmp, 'champion-map', 'pack-aliases.tsv');
  return existsSync(p) ? readFileSync(p, 'utf8').replace(/\r\n/g, '\n').trim().split('\n').slice(1).filter(Boolean) : []; };
const step = (dest, why) => {
  const r = spawnSync(process.execPath, [STEP, tmp, dest, SRC, why], { encoding: 'utf8', timeout: 120000 });
  const j = (() => { try { return JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch (e) { return { parseFail: String(r.stdout || r.stderr).slice(0, 90) }; } })();
  console.log('  步 ' + dest.padEnd(22) + 'wrote=' + String(j.wrote) + ' ‖ ' + String(j.note).slice(0, 52) + ' ‖ 账 ' + rowsOf().length + ' 行');
  return j;
};

try {
  const a = step('docs/artifacts/A.bak', '正身');
  ck('① 第一份正常写盘（无别名可言）', a.wrote === true, '账里 ' + rowsOf().length + ' 行');
  const b = step('docs/artifacts/B.bak', '同一粒的第二名');
  ck('② 第二份不许写真身（§E589 的设计：只登记别名）', b.wrote === false && rowsOf().length === 1, '账里 ' + rowsOf().length + ' 行');
  const c = step('docs/artifacts/B.bak', '同一粒的第二名（再说一遍）');
  const d = step('docs/artifacts/B.bak', '换个理由再说一遍');
  ck('③ 同一三元组再登记两次 ⇒ 账里仍然只有 1 行（**这就是幂等那一条**）', c.wrote === false && d.wrote === false && rowsOf().length === 1,
    '账里 ' + rowsOf().length + ' 行');
  const e = step('docs/artifacts/C.bak', '第三个名字');
  ck('④ 换了 wantedPath 必须是一条**新**别名（去重不许吞真别名）', e.wrote === false && rowsOf().length === 2, '账里 ' + rowsOf().length + ' 行');
  console.log('\n账的内容（wid|canonical|wantedPath 三元组应各不重复）：');
  rowsOf().forEach(r => console.log('  ' + r.slice(0, 126)));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log('\n⚑ 这台只验"重复追加"这一件事；§E589"命中真身就不写第二份"的设计本身由它自己的门腿钉着，这里没动判据。');
process.exit(fail ? 1 : 0);
