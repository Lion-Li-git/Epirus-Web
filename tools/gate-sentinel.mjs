#!/usr/bin/env node
/* gate-sentinel.mjs —— 门禁规矩 1 的**机械检查**（Claude 文档 · docs/GATE-SHIFTS.md §七 规矩 1）
 *
 * 规矩 1：门禁只许测行为（跑代码、给输入、比输出）。禁止三类：读 .md 文件 ‖ 对源码做正则 ‖ 匹配日志措辞。
 * 文档明说：这个检查「**不算门、也不进 np-test**」⇒ 它是独立脚本，跑在 CI 里，只报告 + 退出码。
 *
 * 为什么默认**不红**（`--strict` 才红）：163 条"钉源码行"还没逐条分诊（删了会改行为 ⇒ 不一定该删），
 *   现在让 CI 变红等于用假红训练大家忽略红色 ✗。分诊完再开 `--strict`（一处开关）。
 *
 * 五个类（都按"门体行区间"近似：从 `^t(` 行到下一个 `^t(` 行之前）：
 *   ① 读 .md：门体里出现 readFileSync/readFile 且路径以 .md 结尾
 *   ② 源码正则：门体里同时出现 readFileSync 与 indexOf(...) >= 0（读到的东西被拿去比对）
 *   ③ 日志措辞：门体里出现 .out/.stdout/.stderr 与 indexOf(...) >= 0 且比对串含中文
 *   ④ ②的候选：②里"同时也有行为腿"的那批 ⇒ 可能重复，人只看这批
 *   ⑤ ②的盲区补集：**全是 pin、一条行为痕迹都没有** ⇒ 必须逐条读（当年 D132 就是这样从所有名单里漏掉的）
 *   ⑤ 另带一张**分诊台账**（本文件 `TRIAGE`）：报"还剩几条要读"，不是报"⑤ 有几条"（见下面的签名说明）。
 *
 * 用法：node tools/gate-sentinel.mjs [--strict] [--json] [--full]（其它参数一律 exit 2，不静默吞）
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
  /* 10-22：行号原来用**跨文件总偏移**（`s+1`）⇒ D4 报 1308 而它在文件里是 553，分诊时没法 grep。改成文件内行号：
   *   `at` = 门体起点到本文件 BOUNDARY 行的距离（BOUNDARY 行本身是第 0 行，门体第一行 ⇒ 1）。 */
  let __b = s; while (__b >= 0 && lines[__b].indexOf(BOUNDARY) !== 0) __b--;
  gates.push({ idx: s, at: fileOf(s) + ':' + (s - __b), text: lines.slice(s, e + 1).join('\n') });
}
const idOf = t => {
  const m = /^t\(['"]([^'"]+)['"]/.exec(t);
  if (!m) return '—';
  /* 10-22 晚（千问）：原来只认 `^D\d+` ⇒ 本仓 **15 条非 D 号门**（`L3`/`L5`…7 条 L 号、35 条 N 号、
   *   `REPRO`/`autoGame`/`fuzz` 若干）在名单里全被打成 `—`。后果不是难看：分诊表是按门号排队的，
   *   `—` 的门**进不了任何人的视线**（实测：⑤ 报"29 条全判完"，但那 29 条里 `L3`/`L5` 根本没有判词）。
   *   现在取标题第一段：像门号（字母+数字）就原样用，不像就标 `(无号)<前 12 字>`，让"没号"这件事本身可见。 */
  const first = m[1].split(/[\s(（：:]/)[0];
  return /^[A-Za-z]+\d+[a-z]?$/.test(first) ? first : '(无号)' + m[1].slice(0, 12);
};
const has = (t, re) => re.test(t);

const cls = { md: [], src: [], log: [], cand: [], allpin: [], pin_status: {} };
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
const __runRe = /sb\.window|EpirusTrainer|EpirusPlay|EpirusBots|EpirusRules|EpirusState|EpirusResolve|EpirusPolicy|autoGameN|oneGameN|policyChooserN|selfPlay\(|mirrorHealth\(|duelAssembly\(|spawnSync|spawnCached|spawnNC|execFileSync|execSync\(|runInNewContext|new vm\.|sandbox\(/;

/* 10-22 晚（千问，用户点名要补的第二处）：**⑤ 的条数 ≠ 还有多少要读**。
 *   两件事在旧口径下被混成一个数：
 *     (a) 已经判"留"的（判词在 GATE-AUDIT §三′ 丙）——它们仍满足"全 pin 无行为腿"这个**形状**，所以还留在名单里；
 *     (b) 已经**换成真调**的（`D61` v1.8.6 ‖ `D78` v1.8.5）——形状上也还留在名单里，因为这把尺认不出
 *         "调 `_ctx` 递进来的领域函数"（`AUDIT.feasibilityOf(...)` 这类）：门文件里没有 `import`，绑定来自
 *         `const { AUDIT, feasibilityOf, … } = makeCtx()` ⇒ 任何"看写法"的启发式都看不见它（我试过按 import 收集，
 *         实测**换类 0 条**，纯盲）。
 *   所以不再猜写法，改成**记账 + 签名过期**（仓里 `diff-ladder-claims.mjs` 同一种形状）：
 *     判词抄进下面这张表（人写的，本工具不生产判词），签名 = 门体里所有 `indexOf(<串>)` 的被比对串（排序后 sha1 前 8 位 + 串数）。
 *     改注释/挪行**通常**不动签名 —— 但 v1.8.11 给 D107 重签时发现两句太满了，实测两处局限：
 *       ① 取串用 `[^)]*`，串内带括号的钉（`indexOf('h32(seed0 + …)') < 0`）**进不了签名** ⇒ 它是 pin 却不被哈希看见；
 *       ② 同一串若写在**注释**里也会被算进去 ⇒ 只改一句史注也会让判词"过期"（假过期；方向安全：只会多排队，不会少排队）。
 *       ③ **数组的** `.indexOf(x) >= 0`（如 `['a','b'].indexOf(SAMPLES[0]) >= 0` 这种成员判断）也会被当成"源码 pin"计入签名与 pin 数
 *          ⇒ 所以 pin 数是**上界**，不是"有几条文本钉"的精确数（v1.8.12 换 `D88` 时现形：它 4 个"pin"里有一个是数组成员判断）。
 *     ⇒ 签名是"排队提醒"，不是"判据等价的证明"：改判据后要**主动重签**，别等它报；判词本身是否仍成立仍是 R4 第③步的活。
 *   ⚠ 局限要说清：`j:'换'` 这条哨兵**无法自检**——腿被人摘掉而 pin 串没动的话，它还会显示"已换"。
 *     它只保证"没人再为已判的门重复排队"，不保证判词永远成立（那仍是 R4 第③步的活）。 */
const sigOf = function (text) {
  const needles = [];
  for (const m of text.matchAll(/indexOf\(([^)]*)\)\s*(?:>=|<)\s*0/g)) needles.push(m[1].trim());
  return createHash('sha1').update(needles.slice().sort().join('\n')).digest('hex').slice(0, 8) + '/' + needles.length;
};
const TRIAGE = {
  'D4':    { s: 'f1bc13c0/3',  j: '留', at: '§三′ 丙' },
  'D117':  { s: '9cdb7266/8',  j: '留', at: '§三′ 丙' },
  'D98':   { s: 'b1293b77/3',  j: '留', at: '§三′ 丙' },
  'D82':   { s: '34dda06f/3',  j: '留', at: '§三′ 丙' },
  'D44':   { s: '5ca8b1ed/2',  j: '留', at: '§三′ 丙' },
  'D74':   { s: '4e297c3b/3',  j: '留', at: '§三′ 丙' },
  'D75':   { s: '0da5882c/3',  j: '留', at: '§三′ 丙' },
  'D76':   { s: '0d3c5c41/3',  j: '留', at: '§三′ 丙' },
  'D97':   { s: 'abfe1369/3',  j: '留', at: '§三′ 丙' },
  'D100':  { s: 'c9034ba8/5',  j: '留', at: '§三′ 丙' },
  'D79':   { s: '6388dbb8/14', j: '留', at: '§三′ 丙' },
  'D118':  { s: '18a0e522/7',  j: '留', at: '§三′ 丙' },
  'D107':  { s: '1380dba1/2',  j: '换', at: 'v1.8.11 八条文本 pin 换成真跑 duelAssembly 三个钩子（turtle 腿变异实测红）' },
  'D7':    { s: 'fda7fc00/2',  j: '留', at: '§三′ 丙' },
  'D11':   { s: '68af7fa8/3',  j: '留', at: '§三′ 丙' },
  'D13':   { s: 'ec824886/5',  j: '留', at: '§三′ 丙' },
  'D65':   { s: '81eff325/2',  j: '留', at: '§三′ 丙' },
  'D83':   { s: 'd395639b/8',  j: '留', at: '§三′ 丙' },
  'D88':   { s: 'aac85a93/4',  j: '换', at: 'v1.8.12 五条文本钉换成跑 gate-landscape 的 --json（三次变异实测红：M1 广度/M2 分类/M3 截断）' },
  'D27':   { s: 'c04ec7b9/8',  j: '留', at: '§三′ 丙' },
  'D73':   { s: 'df05c7d0/4',  j: '留', at: '§三′ 丙' },
  'D145':  { s: '4427698f/2',  j: '留', at: '§三′ 丙' },
  'D37':   { s: 'f6e23b87/3',  j: '留', at: '§三′ 丙' },
  'D38':   { s: '5e6bcf08/7',  j: '留', at: '§三′ 丙' },
  'D70':   { s: '045f0533/8',  j: '留', at: '§三′ 丙' },
  'D61':   { s: '9d761ad6/11', j: '换', at: 'v1.8.6 DS 补真调腿' },
  'D78':   { s: '2b7724ba/23', j: '换', at: 'v1.8.5 DS 补真调腿' },
  /* 这两条就是"门号只认 D"那个洞吃掉的分诊对象（旧版在名单里显示为 `—`）⇒ 判词见 GATE-AUDIT §三′ 丁 */
  'L3':    { s: '462fbf28/6',  j: '留', at: '§三′ 丁(千问)' },
  'L5':    { s: 'f22823e9/6',  j: '留', at: '§三′ 丁(千问)' }
};
const statusOf = function (id, sig) {
  const c = TRIAGE[id];
  if (!c) return '待读';
  return c.s === sig ? (c.j === '换' ? '已换' : '已判留') : '判词过期';
};
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
    if (pins > 0 && !hasBeh) {
      const sg = sigOf(g.text);
      const st = statusOf(id, sg);
      /* v1.8.11：把**当前签名**一起印出来 ⇒ 改完判据要回 `TRIAGE` 更新时不必再猜/再写第二份计算器
       *   （以前只能印"过期"，人就要么盲抄一个 sig、要么再抄一份 sigOf ⇒ 正是本仓"两份实现必漂移"那一族）。 */
      cls.allpin.push(id + '@' + g.at + '(' + pins + 'pin)' +
        (st === '已判留' ? '[留·已判]' : st === '已换' ? '[换·已补腿]' : st === '判词过期' ? '[过期·待重签 ' + sg + ']' : '[待读 ' + sg + ']'));
      cls.pin_status[id] = st;
    }
  }
  if (has(g.text, /\.(out|stdout|stderr)\b/) && /indexOf\(['"][^'"]*[\u4e00-\u9fff][^'"]*['"]\)\s*>=\s*0/.test(g.text)) cls.log.push(id + '@' + g.at);
}
const st_count = { 待读: 0, 已判留: 0, 已换: 0, 判词过期: 0 };
for (const k of Object.keys(cls.pin_status)) st_count[cls.pin_status[k]]++;
const pending = Object.keys(cls.pin_status).filter(k => cls.pin_status[k] === '待读' || cls.pin_status[k] === '判词过期');
const out = { gates: gates.length, md: cls.md.length, src: cls.src.length, log: cls.log.length, cand: cls.cand.length,
  allpin: cls.allpin.length, allpin_split: st_count, allpin_pending: pending, lists: cls };
/* 10-22：分诊 ⑤ 时清单被截断到 10 条（"…"）⇒ 加 --full 打全名；不认识的参数响亮失败（仓规 v1.5.234）。 */
const ARGS = process.argv.slice(2);
const FULL = ARGS.includes('--full');
for (const a of ARGS) if (['--json', '--full', '--strict'].indexOf(a) < 0) { console.error('⛔ 不认识的参数：' + a + '（在册：--json / --full / --strict）'); process.exit(2); }
const show = function (list, n) { return list.length ? '：' + (FULL ? list.join(', ') : list.slice(0, n).join(', ') + (list.length > n ? ' …' : '')) : ' ✔'; };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log('门禁哨兵（规矩 1：只许测行为）· 门数 = ' + out.gates);
  console.log('  ① 读 .md 的门        = ' + out.md + show(cls.md, 8));
  console.log('  ② 对源码做正则的门    = ' + out.src + show(cls.src, 8));
  console.log('  ③ 匹配日志措辞的门    = ' + out.log + show(cls.log, 8));
  console.log('  ④ **②的候选**（源码 pin + 同门行为腿 ⇒ 可能重复） = ' + out.cand + show(cls.cand, 8));
  console.log('  ⑤ **全 pin 无行为腿**（pins>0 且门里一条行为痕迹都没有 ⇒ 必须逐条读门体，不许默认"该留"） = ' + out.allpin +
    show(cls.allpin, 10));
  console.log('     按分诊台账拆：**待读 ' + out.allpin_split.待读 + ' ‖ 判词过期 ' + out.allpin_split.判词过期 +
    ' ‖ 已判"留" ' + out.allpin_split.已判留 + ' ‖ 已换真调腿 ' + out.allpin_split.已换 +
    '** ⇒ 下一班的队列长度 = 待读 + 过期 = **' + pending.length + '**' +
    (pending.length ? '（' + pending.join(' ') + '）' : ' ⇒ 空的') + '，不是 ' + out.allpin);
  console.log('     （台账 = 本文件里的 `TRIAGE`，签名 = 门体被钉串的哈希 ⇒ 改判据自动作废、改注释不会。' +
    '⚠ "已换"这条哨兵自检不了：把腿摘掉而串没动，它仍显示"已换"。）');
  console.log('     （④ 只提示不判死：人工只需看这 ' + out.cand + ' 条；⑤ 是 ④ 的盲区补集，别拿 "其余 = 该留" 当结论。）');
  console.log('  ⇒ 默认只报告（不红）；分诊完再开 --strict。见 docs/GATE-SHIFTS.md §八 口径 1。');
}
const strict = process.argv.includes('--strict');
process.exit(strict && (out.md + out.log) > 0 ? 1 : 0);
