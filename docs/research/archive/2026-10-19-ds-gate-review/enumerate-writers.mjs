/* §E653 静态枚举：门里每一处 spawn `tools/train-3p.mjs`，它的 env 有没有把产物改道
 *
 * 为什么要这台：DS 的教训 #2 是「跟着红点清是错的方法 —— 要么全量列写方，要么用点名器」。
 *   点名器（运行时）只会在**真落盘**时打一行 ⇒ 它给的是"实际写了的"，而这里要的是**全部调用点**（含这次没写成的），
 *   两者互为对照：静态列出的"没改道"处数，应当 ≥ 运行时名单的条数（少一条就说明有一把尺在骗人）。
 *
 * 判法（不做正则近似，按括号配对取整段调用）：
 *   ① 跳过注释行（`//`、`*`、`/*`）与"只是提到文件名"的行（readFileSync / import / 数组里的入口名单 / indexOf 找源码位置）；
 *   ② 从 `spawnSync(` 处起，**配对括号**取到整个调用（含 opts.env 与更远的 `{ env: armEnv(...) }`）；
 *   ③ 在这段里找 `EPIRUS_T3P_OUT` ⇒ 改道；找 `armEnv(`/`spawnCached(`/`spawnNC(` ⇒ 交给 helper 判（列出来，不猜）。
 *
 * 用法：node enumerate-writers.mjs [--root=<仓库根>]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const { rejectUnknownFlags } = await import(new URL('../../../../tools/audit-lib.mjs', import.meta.url).href);
rejectUnknownFlags(process.argv.slice(2), ['root'], 'enumerate-writers');
const ROOT = (process.argv.find(x => x.indexOf('--root=') === 0) || '').slice(7) || path.resolve(HERE, '../../../..');
const G = path.join(ROOT, 'tools', 'gates');
if (!existsSync(G)) { console.error('⛔ 读不到 ' + G); process.exit(2); }

const files = readdirSync(G).filter(f => f.endsWith('.mjs')).sort();
const rows = [];
for (const f of files) {
  const src = readFileSync(path.join(G, f), 'utf8').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.indexOf('train-3p.mjs') < 0) continue;
    const t = ln.trim();
    if (/^(\/\/|\*|\/\*)/.test(t)) continue;                                   // 注释
    if (/readFileSync|writeFileSync|indexOf\(|includes\(|match\(|split\(/.test(t) && t.indexOf('spawn') < 0) continue;  // 扫源码，不spawn
    if (/'tools\/train-fast\.mjs',\s*'tools\/train-best\.mjs',\s*'tools\/train-3p\.mjs'/.test(t)) continue;             // 入口名单（黑旋钮闸用）
    if (/readKeysOf|detectDarkKnobs|inputHash|ENTRIES\s*=/.test(t)) continue;                                          // 静态解析面
    if (t.indexOf('spawn') < 0 && !/armEnv|spawnCached|spawnNC/.test(t)) continue;                                      // 剩下不认的行单独列出来给人看
    /* ② 取**整个调用**：从这一处 `train-3p.mjs` 往前找最近的 `spawnSync(`/`spawnNC(`/`spawnCached(`，
     *   对每个候选做括号配对，取第一个"跨度盖住 at"的段。
     *   ⚑ 原来这里写的是 `src.slice(at-260, end+60)` 这种**字符窗口** ⇒ 会把孪生臂的 env 吃进来：
     *     train-runner:739（D127 的 on 臂，真的没改道、运行时真的写了默认落点）被上一版误判成"改道"，
     *     是运行时的 `META.arm=d127on` 把它揪出来的 ⇒ 这把尺的自检就是"必须能碰到 739 那一格"。 */
    const at = src.indexOf('train-3p.mjs', src.split('\n').slice(0, i).join('\n').length);
    /* 候选 = **所有**开括号调用（不分种类），按"离 at 最近"排序，取第一个跨度盖住 at 的 ⇒ 那才是**最内层**的那个调用。
     *   上一版按种类依次试（先 spawnSync 再 spawnNC），于是一处 `spawnNC(` 的调用会先被远处某个 `spawnSync(` 的跨度吃掉
     *   ⇒ train-runner:738（D127 的 on 臂）被判成"走 helper"，而它其实就在最近处、env 里少一项。 */
    const OPS = ['spawnSync(', 'spawnNC(', 'spawnCached(', 'spawn(', 'runArm(', 'armRun('];
    const cands = [];
    for (const op of OPS) { for (let c = src.lastIndexOf(op, at); c >= 0 && c > at - 6000; c = src.lastIndexOf(op, c - 1)) cands.push({ op: op, i: c }); }
    cands.sort(function (a, b) { return b.i - a.i; });
    let seg = '', viaHelper = '';
    for (const cd of cands) {
      let d = 0, closed = -1;
      for (let p = cd.i + cd.op.length - 1; p < src.length && p < cd.i + 12000; p++) {
        const ch = src[p];
        if (ch === '(' || ch === '{' || ch === '[') d++;
        else if (ch === ')' || ch === '}' || ch === ']') { d--; if (d === 0) { closed = p; break; } }
      }
      if (closed > at) { seg = src.slice(cd.i, closed + 1); if (!/spawnSync\(|spawnNC\(|spawnCached\(|spawn\(/.test(cd.op)) viaHelper = cd.op.slice(0, -1); break; }
    }
    if (!seg) seg = src.slice(Math.max(0, at - 40), at + 320);   // 兜底：配对失败也要列出来，别静默
    const gen = (t.match(/'(\d+)'(?:\s*,\s*'(\d+)'(?:\s*,\s*'(\d+)'(?:\s*,\s*'(\d+)')?)?)?/) || []).slice(1).join('/') || '?';
    rows.push({
      file: f, line: i + 1, gen: gen,
      out: /EPIRUS_T3P_OUT/.test(seg) ? '改道' : (viaHelper ? '⛔ 经 ' + viaHelper + ' 调用，其 env 里没有改道' : '⛔ 没看到改道'),
      band: /EPIRUS_BAND_DIR/.test(seg) ? 'band 也改道' : '⚠ band 未改道（会往 docs/artifacts 撒 .bak ⇒ D191）',
      arm: /EPIRUS_ARM/.test(seg) ? '报名字' : '⚠ 不报 arm（点名行会印 (no-arm)）',
      snippet: t.slice(0, 78)
    });
  }
}
console.log('# §E653 门里 train-3p 的调用点（静态，含这次没写成的那些）');
console.log('文件'.padEnd(22) + '行'.padEnd(7) + '代参'.padEnd(9) + '落点改道'.padEnd(34) + 'band'.padEnd(24) + 'arm');
for (const r of rows) console.log(r.file.padEnd(22) + String(r.line).padEnd(7) + r.gen.padEnd(9) + r.out.padEnd(34) + r.band.padEnd(24) + r.arm);
const bad = rows.filter(r => r.out.indexOf('⛔') === 0);
const viaH = bad.filter(r => r.out.indexOf('经') >= 0);
console.log('\n合计调用点 ' + rows.length + ' ‖ ⛔ 没改道 ' + bad.length + '（其中经 helper 调起 ' + viaH.length + ' ⇒ helper 会不会注入落点要逐一看定义，本机实测 `spawnNC` = `spawnCached(nocache)`，**不注入**）');
console.log('⛔ 里若含 `EPIRUS_PUBLISH` 那就是"有意写发布态"（不是漏改道）；若落在 D123/D162 那两条腿就是"有意写基线" ⇒ 这两类要在 C 方案里显式声明，不算违例。');
console.log('⚑ 这台是**静态上界**：它不判"真写了没"（那是运行时点名器的事），两把尺一起看才分得清"漏改道"与"有意写"。');

/* ===== 这把尺的自检：它必须碰得到那一格 =====
 * 正对照 train-runner:734（D127 的 **off** 臂，env 里逐字有 `EPIRUS_T3P_OUT`）⇒ 必须判"改道"；
 * 反对照 train-runner:738（同一条腿的 **on** 臂，只有 `EPIRUS_BAND_DIR`、没有落点）⇒ 必须判 ⛔。
 *   738 不是推测：**10-19 14:17:14 默认落点 `docs/artifacts/train-3p-out.js` 的 `META.arm` 实测 = `d127on`**
 *   （运行时抓到的写方，静态这台上一版因为"字符窗口/依次试 opener"两次都放过它）。 */
const must = (f, line, want, why) => {
  const r = rows.find(x => x.file === f && x.line === line);
  const got = !r ? '(这台没列出这一处)' : (r.out.indexOf('⛔') === 0 ? '⛔' : r.out.indexOf('改道') === 0 ? '改道' : '其他');
  const okk = got === want;
  console.log((okk ? '  PASS 自检 ' : '  ⛔ 自检 FAIL ') + f + ':' + line + ' 期望「' + want + '」实测「' + got + '」 ⇒ ' + why);
  if (!okk) process.exitCode = 4;
};
must('train-runner.mjs', 734, '改道', 'D127 off 臂有逐字改道 ⇒ 判"改道"才说明这台读的是最内层整个调用');
must('train-runner.mjs', 738, '⛔', 'D127 on 臂没改道、且运行时实证它写过默认落点 ⇒ 这把尺必须能碰到它');
console.log('\n⚑ 交叉核对（两把尺）：静态列出的 ⛔ 处数应当 ≥ 运行时看到的写方条数；今天运行时那把被 `gate-par` 吞了 stdout ⇒ '
  + '名单只能靠**默认产物的 META.arm + mtime**（本次 1 条：d127on @14:17:14）。要让点名器在门里可用，得先让 np-test 透传那行。');
