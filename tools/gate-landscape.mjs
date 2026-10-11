/* tools/gate-landscape.mjs —— **门地形**量具（v1.5.100）
 *
 * 要回答的问题（`FRAC` 两档都只是"抽到过好点"之后的下一问）：
 *   **现有这五道门到底在挡什么？** 各门的阻塞频次、以及"广度"与"过门"是不是互斥。
 *
 * 为什么要有它：`promote-champion` 一次只看**一个**候选；而"门是否可达到"是**分布**问题。
 * 本工具把一批产物逐个体检、聚成一张表 —— 只有先看清分布的**形状**，才知道该改门、还是改训练。
 *
 * 口径（重要）：
 *   · 体检**完全走 `promote-champion --dry`**（同一条已被审计的路径），本工具只做解析与聚合；
 *   · `--exam-first=0` 跳过 A 考卷那 1400 局（五道门不依赖它）⇒ 每个包约 10~20s；
 *   · **在位包是"参照行"，不是"候选"**：它自己就过不了只枪格（G4）—— 本工具把它单列，
 *     免得把"参照不行"读成"候选不行"（v1.5.89 §5.5 的教训）。
 *
 * 用法：node tools/gate-landscape.mjs [产物…（省略则用内置清单）]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BUILTIN = [
  'js/bundled-champion-3p.js',                 // 在位包 = 参照行
  'docs/artifacts/v7f5t-31.bak',               // 唯一过五道门的那个（座位 n≥400）
  'docs/artifacts/v7f5t-92.bak',
  'docs/artifacts/v7f2t-82.bak',
  'docs/artifacts/v7f35t-82.bak',
  'docs/artifacts/v7f5b-94.bak', 'docs/artifacts/v7f5b-95.bak', 'docs/artifacts/v7f5b-96.bak',
  'docs/artifacts/v7f5b-97.bak', 'docs/artifacts/v7f5b-98.bak', 'docs/artifacts/v7f5b-99.bak',
  'docs/artifacts/v7f35b-94.bak', 'docs/artifacts/v7f35b-95.bak', 'docs/artifacts/v7f35b-96.bak',
  'docs/artifacts/v7f35b-97.bak', 'docs/artifacts/v7f35b-98.bak', 'docs/artifacts/v7f35b-99.bak',
  'docs/artifacts/v7stock2-31.bak', 'docs/artifacts/v7stock2-93.bak',
  'docs/artifacts/v7role1-82.bak', 'docs/artifacts/v7role1-31.bak',
  'docs/artifacts/v7w3c-93.bak'
];

const files = process.argv.slice(2).length ? process.argv.slice(2) : BUILTIN;
const GATES = ['座位偏座', 'G<3', '反弹墙', '场B 清场', '零攻击局'];
const tally = {}; GATES.forEach(function (g) { tally[g] = 0; });
let pass = 0, rows = 0;
const rowsData = [];

console.log('包'.padEnd(26) + ' 五道门   阻塞项                              G_eff  最大单卡');
for (const f of files) {
  if (!existsSync(f)) { console.log(f.padEnd(26) + '  (缺文件)'); continue; }
  rows++;
  const r = spawnSync(process.execPath, ['tools/promote-champion.mjs', f, '--dry', '--skip-gate-drafts', '--exam-first=0'],
    { encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || '');
  const feas = (/可行性[^\n]*/.exec(out) || [''])[0];
  const head = feas.split('：').slice(1).join('：').split('（')[0];   // 只取"挂科清单"，别把括号里的读数当挂科
  const okAll = feas.indexOf('✅ 五道全过') >= 0;
  const blocked = [];
  if (!okAll) {
    if (head.indexOf('座位偏座') >= 0) { blocked.push('座位'); tally['座位偏座']++; }
    if (/G [\d.]+ < 3/.test(head)) { blocked.push('G<3'); tally['G<3']++; }
    if (head.indexOf('反弹墙') >= 0) { blocked.push('墙'); tally['反弹墙']++; }
    if (head.indexOf('场B 清场') >= 0) { blocked.push('场B'); tally['场B 清场']++; }
    if (head.indexOf('零攻击局') >= 0) { blocked.push('退化'); tally['零攻击局']++; }
    if (!blocked.length) blocked.push('(其它)');
  } else pass++;
  const ge = (/G_eff=([\d.]+)/.exec(out) || [, '—'])[1];
  const mc = (/最大单卡占比 ([\d.]+)%/.exec(out) || [, '—'])[1];
  /* v1.5.100 追加：把括号里的**读数**也取出来 —— 因为要问的是"广度与能力是不是互斥"：
   *   `场B 清场` = 收缩开始前真把对手打死的局均次数（第五轮复核 §2-1：**绝不能用胜率**，
   *   新规则下打 1 点就能在全灭判胜里赢 ⇒ 胜率白送）。它低 ⇒ "赢得不难看，但杀不掉人"。 */
  const fbc = (/场B 清场 ([\d.]+)\/局/.exec(feas) || [, '—'])[1];
  const wall = (/墙 ([\d.]+)\/局/.exec(feas) || [, '—'])[1];
  const seat = (/座位 ([\d.]+)pt/.exec(feas) || [, '—'])[1];
  const gv = (/· G ([\d.]+) ·/.exec(feas) || [, '—'])[1];
  const nm = f.replace('docs/artifacts/', '').replace('.bak', '');
  rowsData.push({ nm: nm, ok: okAll, ge: ge === '—' ? null : Number(ge),
    mc: mc === '—' ? null : Number(mc), fbc: fbc === '—' ? null : Number(fbc),
    wall: wall === '—' ? null : Number(wall), seat: seat === '—' ? null : Number(seat), gv: gv });
  console.log(nm.padEnd(24) + ' ' + (okAll ? '✅ 全过' : '✗ ' + blocked.join('/')).padEnd(14) +
    '  单卡 ' + (mc === '—' ? '—' : String(mc + '%').padStart(6)) +
    '  G_eff ' + String(ge).padStart(5) + '  G ' + String(gv).padStart(5) +
    '  清场 ' + String(fbc).padStart(5) + '  墙 ' + String(wall).padStart(6) + '  座位 ' + String(seat).padStart(5));
}

console.log('');
console.log('=== 汇总（' + rows + ' 个包）');
console.log('五道全过 = ' + pass + ' / ' + rows + (rows ? '（' + (100 * pass / rows).toFixed(0) + '%）' : ''));
console.log('各门阻塞次数 = ' + GATES.map(function (g) { return g + ' ' + tally[g]; }).join(' · '));
/* v1.5.100：**广度 vs 清场**是不是此消彼长 —— 用"单卡占比"当广度代理（越低越广），两分法对照。 */
const withBoth = rowsData.filter(function (d) { return d.mc != null && d.fbc != null; });
const broad = withBoth.filter(function (d) { return d.mc < 50; });
const narrow = withBoth.filter(function (d) { return d.mc >= 50; });
const mean = function (arr, k) { return arr.length ? arr.reduce(function (a, d) { return a + d[k]; }, 0) / arr.length : NaN; };
console.log('');
console.log('=== 广度 vs 清场（单卡占比当广度代理）');
console.log('  宽（单卡 <50%）：' + broad.length + ' 个 · 清场均值 ' + (broad.length ? mean(broad, 'fbc').toFixed(2) : '—') +
  '/局 · 其中清场 ≥0.3 的 ' + broad.filter(function (d) { return d.fbc >= 0.3; }).length + ' 个');
console.log('  窄（单卡 ≥50%）：' + narrow.length + ' 个 · 清场均值 ' + (narrow.length ? mean(narrow, 'fbc').toFixed(2) : '—') +
  '/局 · 其中清场 ≥0.3 的 ' + narrow.filter(function (d) { return d.fbc >= 0.3; }).length + ' 个');
console.log('⚠️ 第一行是**在位包（参照行）**：它自己过不了只枪格（G4）—— 别把"参照不行"读成"候选不行"。');
