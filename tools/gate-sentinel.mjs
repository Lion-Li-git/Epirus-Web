#!/usr/bin/env node
/* gate-sentinel.mjs —— 门禁规矩 1 的**机械检查**（Claude 文档 · docs/GATE-SHIFTS.md §七 规矩 1）
 *
 * 规矩 1：门禁只许测行为（跑代码、给输入、比输出）。禁止三类：读 .md 文件 ‖ 对源码做正则 ‖ 匹配日志措辞。
 * 文档明说：这个检查「**不算门、也不进 np-test**」⇒ 它是独立脚本，跑在 CI 里，只报告 + 退出码。
 *
 * 为什么默认**不红**（`--strict` 才红）：163 条"钉源码行"还没逐条分诊（删了会改行为 ⇒ 不一定该删），
 *   现在让 CI 变红等于用假红训练大家忽略红色 ✗。分诊完再开 `--strict`（一处开关）。
 *
 * 三个类（都按"门体行区间"近似：从 `^t(` 行到下一个 `^t(` 行之前）：
 *   ① 读 .md：门体里出现 readFileSync/readFile 且路径以 .md 结尾
 *   ② 源码正则：门体里同时出现 readFileSync 与 indexOf(...) >= 0（读到的东西被拿去比对）
 *   ③ 日志措辞：门体里出现 .out/.stdout/.stderr 与 indexOf(...) >= 0 且比对串含中文
 *
 * 用法：node tools/gate-sentinel.mjs [--strict] [--json]
 */
import { readFileSync } from 'node:fs';

/* v1.7.8：278 条门搬进 tools/gates/** ⇒ 源码面**只能**问 `gate-src.mjs` 要（继续读 tools/np-test.mjs 会看到 0 条门，
 *   而默认档 exit 0 ⇒ CI 会全绿着变瞎）。面 = runner + _ctx + 16 个部分，文件之间有一行 `BOUNDARY` 分隔行
 *   ⇒ 门体不跨文件；坐标随之改成 `文件:行号`（并集偏移对人没用）。消费者审计见 gate-src.mjs 头注。 */
import { gateBodyText, BOUNDARY } from './gate-src.mjs';

const lines = gateBodyText().split('\n');

/* 门体 = 从 ^t( 行到下一个 ^t( 行（或下一个文件分隔行）之前（不做花括号配平 ⇒ 与审计器的口径互为独立校验） */
const marks = [];
for (let i = 0; i < lines.length; i++) if (/^t\(/.test(lines[i]) || lines[i].indexOf(BOUNDARY) === 0) marks.push(i);
const fileOf = (i) => { for (let k = i; k >= 0; k--) if (lines[k].indexOf(BOUNDARY) === 0) return lines[k].slice(BOUNDARY.length).trim(); return '?'; };
const gates = [];
for (let k = 0; k < marks.length; k++) {
  const s = marks[k];
  if (!/^t\(/.test(lines[s])) continue;
  const e = (k + 1 < marks.length ? marks[k + 1] : lines.length) - 1;
  gates.push({ idx: s, at: fileOf(s) + ':' + (s + 1), text: lines.slice(s, e + 1).join('\n') });
}
const idOf = t => {
  const m = /^t\(['"]([^'"]+)['"]/.exec(t);
  return m ? (m[1].match(/^(D\d+[a-z]?)/) || ['—'])[0] : '—';
};
const has = (t, re) => re.test(t);

const cls = { md: [], src: [], log: [], cand: [], allpin: [] };
/* v1.7.127（用户 10-20：把「有行为腿覆盖同一件事」做成可自动提示的启发式）：
 *   ② 那族里有两种：**只有源码 pin**（没有替代品 ⇒ 留），和 **源码 pin + 行为腿**（可能重复 ⇒ 候选）。
 *   这里只把后者**标出来**（只报告、不阻断），把 125 条人工分诊压成一张候选清单。
 *   判据（故意宽）：同一个门体里既出现 `readFileSync(...).indexOf(...) >= 0` 这种 pin，
 *   又出现 **至少一条 `eq(`/`is(`**（那是在比运行时值，不是比源码字符串）。 */
const __pinRe = /indexOf\([^)]*\)\s*(?:>=|<)\s*0/g;
const __behRe = /\n\s*(?:eq|is)\(/g;
/* 更严的第二道：**必须真的跑引擎**。`eq(` 也可能在比源码解析出来的东西（第一版 77 条太宽）。 */
/* v1.7.165：执行痕迹原来只认"引擎符号名"，**不认起子进程/起沙箱**那一族 ⇒ 一批"真 spawn 了量具/工具、只用 ok() 断言"的门
 *   被漏进 ⑤（例：`D119` 真跑 `train-3p` 断 exit 5，却仍显示"全 pin 无行为腿"）。补齐这几个符号。
 * ⚠ 这把尺仍然只是**形状启发**：它认不出"调本文件里自己定义的 helper"，所以 ⑤ 的名单是候选、不是判词。 */
const __runRe = /sb\.window|EpirusTrainer|EpirusPlay|EpirusBots|EpirusRules|EpirusState|EpirusResolve|EpirusPolicy|autoGameN|oneGameN|policyChooserN|selfPlay\(|mirrorHealth\(|spawnSync|spawnCached|spawnNC|execFileSync|execSync\(|runInNewContext|new vm\.|sandbox\(/;
for (const g of gates) {
  const id = idOf(lines[g.idx]);
  if (/readFileSync\([^)]*\.md['"]/.test(g.text) || /readFile\([^)]*\.md['"]/.test(g.text)) cls.md.push(id + '@' + g.at);
  if (has(g.text, /readFileSync\(/) && has(g.text, /indexOf\([^)]*\)\s*>=\s*0/)) {
    cls.src.push(id + '@' + g.at);
    const pins = (g.text.match(__pinRe) || []).length;
    const runs = __runRe.test(g.text);
    const hasBeh = runs || (g.text.match(__behRe) || []).length > 0;
    /* v1.7.165 口径更正（千问）：④/⑤ 原来把"有没有行为腿"等同于"门里有没有写过 `eq(`/`is(`"（`__behRe`，`:50`）。
     *   但本仓大量门体是**真跑引擎/真起子进程、只用 `ok(...)` 断言**的形状（例：`ok(rr.status === 5)`），
     *   这一类门在 ④ 里看不见自己（④ 要求 eq/is），又掉进 ⑤ 里被标成"全 pin 无行为腿" ⇒ 名单两头都不对。
     *   正确口径：**行为腿 = 有执行痕迹（`__runRe`）或 有 eq/is 断言**；于是
     *     ④ = 有 pin 且有行为腿（可能重复 ⇒ 人只需看这批）‖ ⑤ = 有 pin 且**一条行为痕迹都没有**（必须逐条读）。
     *   两类互斥、且与 ② 的交集可核对（② = 读源码且正向钉命中）。默认仍只报告，不影响任何门的红绿。 */
    if (pins > 0 && hasBeh) cls.cand.push(id + '@' + g.at + '(' + pins + 'pin)');
    /* 10-22（DS）：④ 只列"pin + 有行为腿"，于是**一条全是 pin、零行为腿的门反倒不进任何名单**（`D132` 就这样漏掉，
     *   靠逐条读门体才发现）⇒ 全 pin 无行为腿的门单独列一类，不许再当"只有源码 pin ⇒ 该留"默认放过。 */
    if (pins > 0 && !hasBeh) cls.allpin.push(id + '@' + g.at + '(' + pins + 'pin)');
  }
  if (has(g.text, /\.(out|stdout|stderr)\b/) && /indexOf\(['"][^'"]*[\u4e00-\u9fff][^'"]*['"]\)\s*>=\s*0/.test(g.text)) cls.log.push(id + '@' + g.at);
}
const out = { gates: gates.length, md: cls.md.length, src: cls.src.length, log: cls.log.length, cand: cls.cand.length, allpin: cls.allpin.length, lists: cls };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log('门禁哨兵（规矩 1：只许测行为）· 门数 = ' + out.gates);
  console.log('  ① 读 .md 的门        = ' + out.md + (out.md ? '：' + cls.md.slice(0, 8).join(', ') + (out.md > 8 ? ' …' : '') : ' ✔'));
  console.log('  ② 对源码做正则的门    = ' + out.src + (out.src ? '：' + cls.src.slice(0, 8).join(', ') + (out.src > 8 ? ' …' : '') : ' ✔'));
  console.log('  ③ 匹配日志措辞的门    = ' + out.log + (out.log ? '：' + cls.log.slice(0, 8).join(', ') + (out.log > 8 ? ' …' : '') : ' ✔'));
  console.log('  ④ **②的候选**（源码 pin + 同门行为腿 ⇒ 可能重复） = ' + out.cand +
    (out.cand ? '：' + cls.cand.slice(0, 8).join(', ') + (out.cand > 8 ? ' …' : '') : ' ✔'));
  console.log('  ⑤ **全 pin 无行为腿**（pins>0 且门里一条 eq/is 都没有 ⇒ 必须逐条读门体，不许默认"该留"） = ' + out.allpin +
    (out.allpin ? '：' + cls.allpin.slice(0, 10).join(', ') + (out.allpin > 10 ? ' …' : '') : ' ✔'));
  console.log('     （④ 只提示不判死：人工只需看这 ' + out.cand + ' 条；⑤ 是 ④ 的盲区补集，别拿 "其余 = 该留" 当结论。）');
  console.log('  ⇒ 默认只报告（不红）；分诊完再开 --strict。见 docs/GATE-SHIFTS.md §八 口径 1。');
}
const strict = process.argv.includes('--strict');
process.exit(strict && (out.md + out.log) > 0 ? 1 : 0);
