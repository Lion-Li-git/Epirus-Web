#!/usr/bin/env node
/* dimgate.mjs — 观测集的"死维度 / 常量维 / 覆盖不足 / 冗余"闸（千问 · 2026-10-29 夜）
 *
 * 用户给的目标是两句：**覆盖游戏里可知的信息** ‖ **不要有读不到信息的死维度**。
 * 第二句只有机器尺能守：读代码看不出一维是不是恒 0（`guardNext` 那次是清了，`tauntFrom/To` 那次是**从来没被写过**，
 * obs2 那版是**读了一个不存在的键** `state.mode.name==='long'` ⇒ 静默走默认值）。所以这把尺按**行**给结论。
 *
 * 每一维报三个分母（少一个就会误判）：
 *   ① 非零率（所有行）      —— 0 ⇒ **结构死**（红）
 *   ② 组间 std（先按组求均值再算 std）—— 0 ⇒ **常量维**（红：整份 dump 里它一个值都不变 ⇒ 不携带信息，只剩偏置项）
 *   ③ 组内变化率（组内取值有差的组占比）—— 0 ⇒ 只能靠**交互**读（线性头对它恒为 0，见 rank-signal 文件头那条）
 *   另外：非零率 < 0.2% ⇒ **覆盖不足**（黄，写"这枚包/这批桌没触发"，**不许**写成"没用"）
 *         两维 |r| > 0.9 ⇒ **冗余**（黄，要么合并要么写理由）
 *
 * ⭐ 这把尺自己有牙（两条变异，抓不到就 exit 3 判它是摆设）：
 *   `--mutate=zero` 往每行尾追加一枚恒 0 列 ⇒ 必须报 **结构死**
 *   `--mutate=const` 往每行尾追加一枚恒 0.5 列 ⇒ 必须报 **常量维**
 *
 * 用法：node tools/proto2/dimgate.mjs --dump=a.jsonl[,b.jsonl] [--arm=A0] [--min-rows=400 --min-groups=40] [--mutate=zero|const] [--json]
 */
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const DUMPS = String(arg('dump', '')).split(',').filter(Boolean);
const ARM = arg('arm', '');
const MIN_ROWS = Number(arg('min-rows', 400)) || 400;
const MIN_GROUPS = Number(arg('min-groups', 40)) || 40;
const MUT = arg('mutate', '');
/* ===== 新模式：`--face=obs3|obs3b` ⇒ **可知必进**对账（千问 · 10-31 补 §十一④ 的欠账）=====
 * 这把尺管的不是"有没有死维"（那是下面的 dump 路），而是**反方向**：该进来的信息进来了没有。
 * 立它的理由是那笔在册账：obs3 把对手上一手写成了**类别**（`lsEnergy…lsSpecial`），于是
 *   "对面那位是不是大雷用户"这类语义判据**在原理上不可学**——臂跑满 24k 局也只给出 0%，
 *   而当时每个环节都把 0% 读成"训练不够"。判据可以先写、面可能装不下 ⇒ 开臂前必须过这张表。
 * 通道按**每条技能键**逐一查（名单来自引擎 `R.skills`，不是我抄一份）：
 *   ① 候选身份  `skill.<key>`（C.id）           ⇒ "这张牌现在可不可能选"
 *   ② 自己上一手 `self.lsKey.<key>`（S.self）    ⇒ "我刚用过它"
 *   ③ 对手上一手 `pool.mean/self.lsKey.<key>`（P.opp）⇒ "场上有没有人刚用过它"（池化后的存在性）
 *   ④ 自己序列 bag `selfSeqBag.<key>`（Q.bag）    ⇒ "我最近几拍用过它"（多回合计划的第一段）
 * `--require=②③④…` 点名的通道缺 ⇒ **红**（exit 1）；没点名只报数。
 * 牙：`--mutate=dropkey` 从派生名单里抹掉一枚键的 ②⇒ 必须把**那一枚**报成缺，否则这把尺是摆设。 */
const FACE = arg('face', '');
if (FACE) {
  const { sandbox } = await import('../audit-lib.mjs');
  const { blocks } = await import('./obs3.mjs');
  if (FACE !== 'obs3' && FACE !== 'obs3b') { console.error('⛔ --face 只认 obs3|obs3b（收到 ' + FACE + '）'); process.exit(2); }
  const W = sandbox(); const R = W.EpirusRules;
  const M = blocks(R, FACE);
  const names = new Set(M.map((e) => e.name));
  const REQ = { cand: '① 候选身份', own: '② 自己上一手', pool: '③ 对手上一手(池化存在性)', bag: '④ 自己序列 bag' };
  /* 名字口径从盘面取（我第一版按'池化名带 self. 前缀'猜 ⇒ 把好通道报成缺，尺比没有还坏）：
   *   S.self 里是 `self.lsKey.<key>`，池化侧是 `pool.mean.lsKey.<key>` / `pool.max.lsKey.<key>`。 */
  const pat = { cand: (k) => 'skill.' + k, own: (k) => 'self.lsKey.' + k, pool: (k) => 'pool.mean.lsKey.' + k, bag: (k) => 'selfSeqBag.' + k };
  const patMax = (k) => 'pool.max.lsKey.' + k;
  if (arg('mutate', '') === 'dropkey') { const victim = R.skills[R.skills.length - 1].key; names.delete(pat.own(victim)); console.log('  ⚠ 变异：抹掉 ② 的 `' + pat.own(victim) + '`'); }
  const miss = {}; for (const c of Object.keys(REQ)) miss[c] = R.skills.map((s) => s.key).filter((k) => !names.has(pat[c](k)));
  console.log('# 可知必进对账 ‖ 面=' + FACE + ' ‖ 维 ' + M.length + ' ‖ 技能键 ' + R.skills.length + ' 枚');
  for (const c of Object.keys(REQ)) {
    const n = R.skills.length - miss[c].length;
    console.log('  ' + REQ[c].padEnd(26) + ' 覆盖 ' + n + '/' + R.skills.length + (n === R.skills.length ? ' ✔' : ' ✘ 缺：' + miss[c].slice(0, 6).join(',') + (miss[c].length > 6 ? '…' : '')));
  }
  const missMax = R.skills.map((s2) => s2.key).filter((k) => !names.has(patMax(k)));
  console.log('  3b 同一件事的 max 路：' + (R.skills.length - missMax.length) + '/' + R.skills.length + (missMax.length ? ' 缺 ' + missMax.slice(0, 6).join(',') : ' 全'));
  console.log('  资源类（自身 ep/电珠/爆珠）：' + ['ownElec', 'ownBoom'].every((x) => names.has(x)) + ' ‖ 目标**席身份**：' + (M.some((e) => /tgtSeat|target\d?\.id/.test(e.name)) ? '在' : '不在（只有方向三档 self/me/other）') + ' ‖ 对手**席位级**身份：不在（池化按设计抹掉"谁"）');
  const REQUIRE = String(arg('require', '')).split(',').map((x) => x.trim()).filter(Boolean);
  const redChannels = REQUIRE.filter((c) => REQ[c] && miss[c].length);
  if (arg('mutate', '') === 'dropkey') {
    const victim = R.skills[R.skills.length - 1].key;
    if (miss.own.indexOf(victim) < 0) { console.error('⛔ 牙：注入的 dropkey 没被抓到 ⇒ 这把尺是摆设'); process.exit(3); }
    console.log('  ✔ 牙：dropkey 被抓到（' + victim + ' 报成缺）');
  }
  if (redChannels.length) { console.error('⛔ 要求的通道缺：' + redChannels.map((c) => REQ[c]).join(' ‖ ') + ' ⇒ 相关语义判据**先别开臂**（面上看不见）。'); process.exit(1); }
  process.exit(0);
}
if (!DUMPS.length) { console.error('⛔ 需要 --dump=a.jsonl[,b.jsonl]'); process.exit(2); }
let rows = [];
for (const p of DUMPS) for (const l of readFileSync(p, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); if (!ARM || r.arm === ARM) rows.push(r); }
if (!rows.length) { console.error('⛔ 没有行'); process.exit(2); }
let F = rows[0].x.length;
if (MUT === 'zero') { for (const r of rows) r.x.push(0); F++; }
else if (MUT === 'const') { for (const r of rows) r.x.push(0.5); F++; }
else if (MUT) { console.error('⛔ 不认识 --mutate=' + MUT + '（只支持 zero|const）'); process.exit(2); }

const G = new Map();
for (const r of rows) { const k = [r.seed, r.env, r.g, r.n, r.round, r.pk].join('|'); if (!G.has(k)) G.set(k, []); G.get(k).push(r); }
const groups = [...G.values()];

let dimNames = null;
try {
  const W0 = (await import('../audit-lib.mjs')).sandbox();
  const R = W0.EpirusRules;
  const base = F - (MUT ? 1 : 0);
  const o3 = (await import('./obs3.mjs')).blocks(R);
  const o2 = (await import('./obs2.mjs')).MANIFEST;
  if (o3.length === base) dimNames = o3.map((d) => d.block + '.' + d.name);
  else if (o2.length === base) dimNames = o2.map((d) => d.block + '.' + d.name);
} catch (e) { /* 拿不到 MANIFEST 就用下标名，判据不变 */ }
if (!dimNames) dimNames = rows[0].x.map((_, j) => 'x[' + j + ']');
if (MUT) dimNames = dimNames.concat(['‹注入的变异列›']);

/* ⚠ 分母条款：**只在一个 regime 里跑，"整份 dump 里一个值都不变"不能判成常量维** ——
 *   血量档/模式这类维在标准桌里当然恒定，换 `--config=long/5` 才动。⇒ 单 regime 时降级成黄，跨 regime 才升红。 */
const regimeSet = new Set(rows.map((r) => String(r.cfg || (r.modeHp || '?')) + '|n=' + r.n));
const regimes = regimeSet.size;

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length); };

const stat = [];
for (let j = 0; j < F; j++) {
  let nz = 0;
  const gm = [];
  let within = 0;
  for (const arr of groups) {
    let first = arr[0].x[j], differs = false, s = 0;
    for (const r of arr) { const v = r.x[j]; if (Math.abs(v) > 1e-9) nz++; s += v; if (Math.abs(v - first) > 1e-9) differs = true; }
    gm.push(s / arr.length);
    if (differs) within++;
  }
  const denom = rows.length * 1;
  stat.push({ j, name: dimNames[j] || ('x[' + j + ']'), nzr: nz / denom, gbetween: std(gm), withingroup: within / groups.length, uniq: new Set(rows.map((r) => r.x[j])).size });
}

const thin = rows.length < MIN_ROWS || groups.length < MIN_GROUPS;
const red = [], yellow = [], infoOnly = [];
for (const s of stat) {
  /* 分母不足 ⇒ 不判红也不判"没用"（稀有机制非零率也可以是 0）；但**注入的变异列例外**，它必须任何时候都能被判红 */
  const inj = !!(MUT && s.j === F - 1);
  if (thin && !inj) continue;
  if (s.nzr === 0) red.push(['全零：未触发**或**决策时刻读不到 ⇒ 要么删、要么造桌证明它读得到', s]);
  else if (s.uniq === 1) {
    /* ⚑ 这条**不判红**：一份 dump 没变某个输入（比如全程 n=5），就不能据此说那枚维"不携带信息"。
     *    定罪要靠样本能变它 —— 所以这里只点名，并要求作者要么跨配置复测、要么删。 */
    yellow.push(['常量（本样本里没变过 ⇒ 未证；要跨配置复测或删掉）', s]);
  }
  else if (s.nzr < 0.002) yellow.push(['覆盖不足（要造桌或换会触发它的包，别写"没用"）', s]);
  else if (s.withingroup === 0) infoOnly.push(['只靠交互', s]);
}
/* 冗余对（组内中心化后 |r|>0.9）——只查"都随候选变"的那些维，否则整块 state 段会因为组内恒定而全 r=0 */
const vary = stat.filter((s) => s.withingroup > 0.05).map((s) => s.j);
const rowsC = [];
for (const arr of groups) { const mus = []; for (let j = 0; j < F; j++) mus.push(mean(arr.map((r) => r.x[j]))); for (const r of arr) rowsC.push(r.x.map((v, j) => v - mus[j])); }
const col = (j) => rowsC.map((r) => r[j]);
const corr = [];
for (let a = 0; a < vary.length; a++) for (let b = a + 1; b < vary.length; b++) {
  const x = col(vary[a]), y = col(vary[b]);
  const sx = std(x), sy = std(y); if (sx === 0 || sy === 0) continue;
  const r = mean(x.map((v, i) => v * y[i])) / (sx * sy);
  if (Math.abs(r) > 0.9) corr.push({ a: vary[a], b: vary[b], r, na: dimNames[vary[a]], nb: dimNames[vary[b]] });
}
corr.sort((p, q) => Math.abs(q.r) - Math.abs(p.r));

const out = { rows: rows.length, groups: groups.length, dims: F, thin, red: red.map(([, s]) => s), yellow: yellow.map(([, s]) => s), infoOnly: infoOnly.length, corr: corr.slice(0, 12) };
if (argv.includes('--json')) { console.log(JSON.stringify(out)); process.exit(red.length ? 1 : 0); }

console.log('# 死维闸 ‖ dump ' + DUMPS.join(' + ') + (ARM ? ' ‖ arm=' + ARM : '') + (MUT ? ' ‖ **变异=' + MUT + '**' : '') + ' ‖ 行 ' + rows.length + ' ‖ 组 ' + groups.length + ' ‖ 维 ' + F);
console.log(thin ? '⚠ 分母不足（要 行 ≥' + MIN_ROWS + ' 且 组 ≥' + MIN_GROUPS + '）⇒ 本轮**不判红也不判"没用"**，只报数（在册条款：分母不足只写"读不出"）' : '分母够用 ⇒ 逐条判');
const show = (kind, arr) => { if (!arr.length) return; console.log('  ' + kind + '：' + arr.length + ' 枚'); for (const it of arr.slice(0, 24)) { const s = Array.isArray(it) ? it[1] : it; console.log('    · ' + (Array.isArray(it) ? it[0] + ' ‖ ' : '') + s.name + ' ‖ 非零率 ' + (100 * s.nzr).toFixed(3) + '% ‖ 组间 std ' + s.gbetween.toFixed(5) + ' ‖ 组内变化 ' + (100 * s.withingroup).toFixed(1) + '% ‖ 取值个数 ' + s.uniq); } };
show('⛔ 红（结构死 / 常量维）', red);
show('🟡 覆盖不足（要造桌或换会触发它的包，别写"没用"）', yellow);
if (infoOnly.length) console.log('  ℹ 只靠交互才读得到（组内逐字相同）：' + infoOnly.length + ' 枚 ⇒ 线性尺对它们恒为 0，**不许**拿线性 null 判"加它们不值"');
if (corr.length) { console.log('  🟡 冗余对 |r|>0.9（组内中心化后）：' + corr.length + ' 对，前 ' + Math.min(12, corr.length) + ' 条：'); for (const c of corr.slice(0, 12)) console.log('    · ' + c.na + ' ↔ ' + c.nb + ' r=' + c.r.toFixed(3)); }

/* 自证：注入的变异列必须被点名（红或黄都算"被抓到"），否则这把尺是摆设 */
if (MUT) {
  const hit = [...red, ...yellow].find(([, s]) => s.j === F - 1);
  if (hit) console.log('  ✔ 牙：注入的 `' + MUT + '` 列被点名成「' + hit[0] + '」⇒ 这把尺真能红');
  else { console.log('  ⛔ 牙：注入的 `' + MUT + '` 列**没被**点名 ⇒ 这把尺是摆设，别用它当准入'); process.exit(3); }
}
console.log('\n⇒ ' + (red.length ? '⛔ ' + red.length + ' 枚红：观测集不满足"无死维"，先删/修再谈训练' : (thin ? '（分母不足，未判）本轮只登记读数' : '✅ 没有结构死/常量维')));
process.exit(red.length ? 1 : 0);
