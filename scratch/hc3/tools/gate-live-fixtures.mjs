#!/usr/bin/env node
/* gate-live-fixtures.mjs —— 活槽夹具普查（2026-10-22 · DS）
 *   背景：GATE-AUDIT §三 的「D 栏 20 条引用活槽文件」名单来路是一台**未入仓的 scratch 尺**（`gate-census --live=`）
 *   ⇒ 下一班拿不到可复现清单。本工具只做一件事：按门体扫描「读了 `js/bundled-champion*.js`」的门，
 *   打印每条的门号/位置/命中行，并按两个信号粗分类（**只提示，不判死**）：
 *     · 解析型（同门出现 unpack/loadChamp/JSON.parse）⇒ 夹具可换（主语是“解析路径”）
 *     · 战术型（同门真的跑引擎/对局）⇒ 主语可能是这枚包本身（R9 第一种形状，活槽该留）
 *   用法：node tools/gate-live-fixtures.mjs [--json]
 */
import { gateBodyText, BOUNDARY } from './gate-src.mjs';
const lines = gateBodyText().split('\n');
const marks = [];
for (let i = 0; i < lines.length; i++) if (/^t\(/.test(lines[i]) || lines[i].indexOf(BOUNDARY) === 0) marks.push(i);
const fileOf = (i) => { for (let k = i; k >= 0; k--) if (lines[k].indexOf(BOUNDARY) === 0) return lines[k].slice(BOUNDARY.length).trim(); return '?'; };
const runRe = /sb\.window|EpirusTrainer|EpirusPlay|EpirusBots|EpirusRules|EpirusState|EpirusResolve|autoGameN|oneGameN|policyChooserN|selfPlay\(|mirrorHealth\(|evalN\(/;
const out = [];
for (let k = 0; k < marks.length; k++) {
  const s = marks[k]; if (!/^t\(/.test(lines[s])) continue;
  const e = (k + 1 < marks.length ? marks[k + 1] : lines.length) - 1;
  const text = lines.slice(s, e + 1).join('\n');
  if (!/bundled-champion/.test(text)) continue;
  const m = /^t\(['"]([^'"]+)['"]/.exec(lines[s]); const name = m ? m[1] : '?';
  const id = (name.match(/^(D\d+[a-z]?)/) || ['—'])[0];
  /* 只算**代码行**：注释里提到路径的不算“读活槽”（否则 31 条里一半是散文）。 */
  const isCode = (t) => !(t.charAt(0) === '*' || t.startsWith('//') || t.startsWith('/*'));
  const hits = lines.slice(s, e + 1).map((l, j) => ({ i: s + j + 1, t: l.trim() })).filter(x => /bundled-champion/.test(x.t) && isCode(x.t));
  const parse = /\bunpack\b|loadChamp|JSON\.parse/.test(text);
  const runs = runRe.test(text);
  if (!hits.length) continue;
  out.push({ id, file: fileOf(s), line: s + 1, hits: hits.slice(0, 3), parse, runs, live: hits.length });
}
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log('活槽夹具普查 · 读 js/bundled-champion* 的门 = ' + out.length);
  for (const o of out) console.log('  ' + o.id.padEnd(6) + o.file + ':' + o.line + '  ' + (o.runs ? '战术/跑引擎' : (o.parse ? '解析型' : '仅提及')) + '  ‖ ' + o.hits.map(h => h.i + ':' + h.t.slice(0, 80)).join(' ｜ '));
}