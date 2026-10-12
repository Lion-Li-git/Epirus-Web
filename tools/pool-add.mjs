#!/usr/bin/env node
/* pool-add.mjs —— **「加入冠军池」**（§E590 · 取代 promote 的那条路）
 *
 * 为什么要有这一台（用户 2026-10-11 23:0x：「做成冠军池之后自然没有 promote 这个东西了，你可以新做一个"加入冠军池"的机制」）：
 *   `promote` 的语义是"**把这枚包写进那颗槽**"⇒ 它一次只能安置一枚，且它的判据（体检/当选/换包）全绑在"整桌四席同一枚"上。
 *   池的语义是"**这枚成为某档里可被抽到的成员之一**"⇒ 需要的新事实是：身份按权重、成员必须在册、两道闸（体检 + 人席）都要留痕。
 *   所以这台工具不写 `js/**`（那是 `tools/build-pool-bundle.mjs` 的活），它只维护**真源表** `champion-map/pool-members.tsv`。
 *
 * 四条硬规矩（每条都对得上一次真实的坑）：
 *   ① **身份只按权重**（`pack-id.mjs` 的 `widOf`）：同 wid 已有成员就拒绝 ⇒ 表里出现两枚同权重 = 抽签会连着抽到同一颗，
 *      而"池里有 N 枚"这句话又会虚高（§E589 的普查就是这么翻车的：1443 个文件其实 1130 粒）。
 *   ② **成员必须 tracked**：不在 git 里的包 ⇒ CI/干净克隆根本看不见它（今晚 `D191` 的④ 已经为这件事红过一次）。
 *      缺件不是"判不了就算了"，是**这台工具当场拒绝**，并给出该跑的 `git add -f` 命令。
 *   ③ **两道闸都留痕**：上槽体检（`promote.tsv`：送盾/G4/G5）与人席杀刀（`seat-rule.mjs`：两批同号 ≥20pt）。
 *      自动成员任一道闸不过 ⇒ 拒绝；点名成员（`--invite`）可越过，但列里必须写明它越过了什么。
 *      ⚠ "没量过"≠"过关"⇒ 没测的就如实写 `untested` / `seatKill=-1`，并让门 D234 把枚数印出来。
 *   ④ 缺行**不许当零**：批表里没有这一枚 ⇒ `seatKill=-1`（未知），不是 0（干净）。
 *
 * 用法：
 *   node tools/pool-add.mjs --id=E3 --pack=docs/artifacts/e234-out/E3.js --tier=hard [--note="困难档自动成员"]
 *        [--invite] [--run-promote] [--seat=pool-seat-90210.tsv,pool-seat-90211.tsv] [--dry]
 *   node tools/pool-add.mjs --audit          # 给门 D234 用的机器可读一行（stdout 最后一个 {…}）
 *   node tools/pool-add.mjs --list [--tier=hard]
 * 退出码：0 = 跑完 ‖ 2 = 输入/前置不齐（宁可红也不许假绿）
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { widOf } from '../champion-map/pack-id.mjs';
import { resolve as resolvePath, rdTable, seatKillIndex, pairHasBase, MODES } from '../champion-map/seat-rule.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const MAP = join(ROOT, 'champion-map', 'pool-members.tsv');
const COLS = ['id', 'wid', 'path', 'tier', 'invited', 'promoteVerdict', 'seatKill', 'addedAt', 'note'];
/* 池的**带名**（`pool-members.tsv` 的 `tier` 列取值）—— §E596（10-12 下半场）把带定成**三带**：
 *   `hard`（最强，现役钉在这一带）/ `mid` / `soft`（最软）。§E594 那版"两带"已被三带取代。
 * ⚠ 这张名单同时管着三件事：`--tier=` 的校验、表内排序、以及"少了一档 = 图例与环色要一起加"的那个信号。
 *   页面侧的环色表是 `champion-map/viewer.mjs` 的 `POOL_COL`（两处都得改，改一处会被页内第三条牙抓红）。 */
const TIERS = ['hard', 'mid', 'soft'];
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const has = k => process.argv.includes('--' + k);
const rd = p => { const L = readFileSync(p, 'utf8').replace(/\r/g, '').replace(/\n+$/, '').split('\n');
  return { h: Object.fromEntries(L[0].split('\t').map((x, i) => [x, i])), rows: L.slice(1).map(l => l.split('\t')) }; };
function loadMap() {
  if (!existsSync(MAP)) return { h: Object.fromEntries(COLS.map((c, i) => [c, i])), rows: [] };
  const t = rd(MAP);
  for (const c of COLS) if (t.h[c] === undefined) { console.error('⛔ ' + 'champion-map/pool-members.tsv' + ' 缺列 ' + c + '（表头被人改了？）'); process.exit(2); }
  return t;
}
function saveMap(t) { writeFileSync(MAP, [COLS.join('\t')].concat(t.rows.map(r => r.join('\t'))).join('\n') + '\n'); }
const trackedSet = () => new Set(execSync('git ls-files docs/artifacts', { cwd: ROOT, maxBuffer: 1 << 26 }).toString().trim().split('\n').filter(Boolean));
const WARNED = new Set();   /* `--refresh` 会对每枚成员调一次 seatKillOf ⇒ 同一对坏表只吼一次，别刷 13 遍屏 */

/* ---------- 人席：按 **wid** 找批表里的行（名字会骗人，路径也会 —— §E589 的教训） ----------
 * 归一逻辑在 `champion-map/seat-rule.mjs` 的 `seatKillIndex`（`pool-screen.mjs` 用的是**同一个**，不另抄一份）。
 * ⚠ 批表必须**两两成对**再喂：`killOf` 只读 batches[0]/batches[1]（§E531 的"两批同号"天生是成对的判据），
 *   而 `seatKillIndex` 的公共 id 集合却是**全部**表的交集 ⇒ 一次传 4 张表 = 用第 1、2 张算格、
 *   却要求这枚同时出现在第 3、4 张里 ⇒ 老成员会被读成"没量过"（10-11 夜就是这么把 hard 档的 0 冲成 -1 的）。
 *   所以这里按对切片，**每对独立出结论，取最坏的那一对**（同一枚在 A 对干净、B 对踩线 ⇒ 判踩线）。 */
function seatKillOf(wid, seatFiles) {
  const tr = trackedSet();
  const readWid = rel => {
    const abs = resolvePath(rel, ROOT);
    if (!existsSync(abs) || !tr.has(rel)) return null;      /* 批表指向未在册/已消失的文件 ⇒ 这一行不参与身份对齐 */
    try { return widOf(readFileSync(abs, 'utf8')); } catch (e) { return null; }
  };
  if (seatFiles.length % 2) console.error('⚠ --seat 传了 ' + seatFiles.length + ' 张（奇数）⇒ 最后一张没有同伴，按对丢弃');
  let worst = -1, pairsUsable = 0, pairs = 0;
  for (let i = 0; i + 1 < seatFiles.length; i += 2) {
    pairs++;
    const pairFiles = [seatFiles[i], seatFiles[i + 1]];
    const pair = pairFiles.map(f => {
      const p = resolvePath(f, join(ROOT, 'champion-map'));
      if (!existsSync(p)) { console.error('⛔ 批表不在：' + f); process.exit(2); }
      return rdTable(f, readFileSync(p, 'utf8'));
    });
    /* **没有基准行的那一对整对作废**（不许读成"零格否决"）—— 10-11 夜 `pool-seat-ml-*` 就是这种表：
     *   跑探针时 `--packs=` 顶掉了默认的 `js/bundled-champion-3p.js` ⇒ 判不出差，六枚成员全被刷成"干净"。 */
    if (!pairHasBase(pair)) {
      if (!WARNED.has(pairFiles.join('/'))) { WARNED.add(pairFiles.join('/'));
        console.error('⛔ 批表对 ' + pairFiles.join(' ‖ ') + ' 里没有基准行（两个口径都要）⇒ **这一对判不出杀刀，整对跳过**' +
          ' ⇒ 重跑：node tools/probe-human-seat.mjs --packs=js/bundled-champion-3p.js,<成员…> --seed=…'); }
      continue;
    }
    pairsUsable++;
    const hit = seatKillIndex(pair, readWid).get(wid);
    if (hit && (worst < 0 || hit.kills > worst)) worst = hit.kills;
  }
  if (pairs >= 1 && pairsUsable === 0) {
    console.error('⛔ --seat 给的 ' + seatFiles.length + ' 张表里**没有一对**带基准 ⇒ 人席闸这次什么都没判。' +
      '要么带基准重跑，要么别传 --seat=（传了却不判 = 假装判过）');
    process.exit(2);
  }
  return worst;                                             /* 每一对里都没有这一粒 ⇒ 未知，不是零 */
}

/* ---------- 上槽体检：查表；表里没有就（按点名）现跑一次 ---------- */
function promoteInfoOf(id, pack, runPromote) {
  const PT = join(ROOT, 'champion-map', 'promote.tsv');
  const look = () => {
    if (!existsSync(PT)) return null;
    const t = rd(PT);
    const r = t.rows.filter(x => x[t.h.id] === id)[0];          /* 全等匹配（`K2` 是 `E35-prod-807` 之类名字的子串 ⇒ 不许 indexOf） */
    return r ? { verdict: r[t.h.verdict], blocks: r[t.h.blocks] || '' } : null;
  };
  let v = look();
  if (v || !runPromote) return v;
  const out = 'docs/artifacts/promote-' + id + '.txt';           /* 用这个文件名 ⇒ 下次 promscan 直接收得到（它的 glob 已扩） */
  console.log('   跑上槽体检（≈2.5 分钟）：node tools/promote-champion.mjs ' + pack + ' --dry → ' + out);
  const s = spawnSync(process.execPath, ['tools/promote-champion.mjs', pack, '--dry'], { cwd: ROOT, encoding: 'utf8', timeout: 20 * 60 * 1000 });
  const txt = String((s.stdout || '') + '\n' + (s.stderr || ''));
  writeFileSync(join(ROOT, out), txt);
  const bl = [...txt.split('\n')].filter(l => /^\s+·\s/.test(l) && !/⇒/.test(l)).map(l => l.trim().replace(/^·\s*/, '')).join(' · ');
  const verdict = /自检通过/.test(txt) ? 'pass' : (/体检未过|硬门槛未过/.test(txt) ? 'block' : null);
  if (verdict === null) console.log('   ⚠ 跑了但没解析出裁决（原文在 ' + out + '）⇒ 记 untested，不猜');
  return verdict ? { verdict: verdict, blocks: bl } : null;
}
/* 用户 10-12 裁定：「**按上线档算**」—— G5 在池里的判据用**上线档**阈值（用户 10-03 已裁定"G5 稍微差一点问题不大"，
 *   `tools/gate-drafts.mjs:399` 的 `G5_MAX_DEPLOY = 40`），不是严格档 25%。
 * 为什么落在**池这一层**、不去改 `promote.tsv`：那张表记的是**上槽**语义（严格档），池是另一个产品对象，
 *   它的判据由本条裁定给出；把表改宽会让"上槽体检"这个词失去意义。
 * ⚠ 只对 **G5** 生效：**G4**（被一行脚本打穿）阈值不动，送盾那类硬闸照旧一律拒（`classifyBlock` 里硬闸优先）。 */
const G5_MAX_DEPLOY = 40;
/* 阈值的单一真源在 `gate-drafts.mjs` —— 它是**脚本**（文件体就会跑起来）⇒ 不能 import ⇒ 从它源码里抽出来**对账**，
 *   分叉就红（本仓"两处各写一个 6"栽过四次；同族做法见 `champion-map/pool-screen.mjs` 的 DIMS 对账）。 */
(function reconcileG5() {
  const gd = join(ROOT, 'tools', 'gate-drafts.mjs');
  if (!existsSync(gd)) return;
  const m = /G5_MAX\s*=\s*\d+\s*,\s*G5_MAX_DEPLOY\s*=\s*(\d+)/.exec(readFileSync(gd, 'utf8'));
  if (m && Number(m[1]) !== G5_MAX_DEPLOY) {
    console.error('⛔ G5 上线档阈值与 `tools/gate-drafts.mjs` 不一致：本文件 ' + G5_MAX_DEPLOY + ' ‖ 那边 ' + m[1] +
      '\n   ⇒ 两处必须同一份（改阈值要一起改，否则池的判据与门说的不是一回事）。');
    process.exit(2);
  }
})();
function poolVerdictOf(id, pack, runPromote) {
  const v = promoteInfoOf(id, pack, runPromote);
  if (!v || v.verdict !== 'block') return v;
  if (!/G5/.test(v.blocks) || /G4/.test(v.blocks)) return v;        /* G4 与送盾一律不豁免 */
  const m = v.blocks.match(/夺冠\s*([0-9]+)\s*%/);
  if (!m || Number(m[1]) > G5_MAX_DEPLOY) return v;
  return { verdict: 'pass', blocks: v.blocks + ' ‖ **用户 10-12 裁定：G5 按上线档 ≤' + G5_MAX_DEPLOY +
    '% 算 ⇒ 本条不构成阻断**（严格档 25% 仍越线，如实留在左边）' };
}
/* 阻断分两类（**这是产品裁定，不是我这台工具自定的口味**）：
 *   · **硬闸**（送盾 > `HOLO_GIFT_MAX`=6/局，`promote` 自己写着"不可 --force"）⇒ 点名也不放行；
 *   · **行为闸**（G4 被一行脚本打穿 / G5 清不了防席）⇒ 自动成员拒绝，**点名成员放行并把越过的原话记进 note**。
 *     依据：用户 10-11 明确要求 K2 进池，而 K2 的阻断恰是 `G5[long] 防席夺冠 30% > 25%`
 *     ⇒ 若这里也一刀切，等于我用一条门槛覆盖了用户的点名。
 * ⚠ 附带印一句：`G5_MAX_DEPLOY = 40`（上线档，用户 10-03 裁定"G5 稍微差一点问题不大"）——**不拿它偷偷放宽判据**，
 *   只把"严格档不过 / 上线档合格"这件事说清楚，要不要按上线档算由用户裁。 */
function classifyBlock(blocks) {
  if (/送盾/.test(blocks)) return { kind: 'hard', why: '送盾（不可 --force 那一类）：' + blocks };
  if (/G4|G5/.test(blocks)) {
    const m = blocks.match(/夺冠\s*([0-9]+)%/);
    const deploy = m && Number(m[1]) <= G5_MAX_DEPLOY ? ' ‖ 按上线档 ≤' + G5_MAX_DEPLOY + '% 算**合格**（严格档 25% 越线只作记录）—— 用户 10-12 裁定' : '';
    return { kind: 'behavior', why: '行为闸：' + blocks + deploy };
  }
  return { kind: 'other', why: '其它阻断：' + blocks };
}

/* ---------- --audit：给门 D234 的机器可读一行（判 JSON 里的数，不判退出码 —— 管道会吃掉退出码） ---------- */
if (has('audit')) {
  const t = loadMap(), tr = trackedSet();
  const byWid = {}; let untracked = 0, blockedAuto = 0, untestedProm = 0, seatKilled = 0, seatUnknown = 0, dupWid = 0;
  const tiers = {}; const bad = [];
  for (const r of t.rows) {
    const id = r[t.h.id], w = r[t.h.wid], p = r[t.h.path], tier = r[t.h.tier], inv = r[t.h.invited] === '1';
    tiers[tier] = (tiers[tier] || 0) + 1;
    (byWid[w] = byWid[w] || []).push(id);
    if (byWid[w].length > 1) { dupWid++; bad.push({ why: '同 wid 两枚成员', id: id + '/' + byWid[w][0] }); }
    if (!tr.has(p)) { untracked++; bad.push({ why: '不在 git', id: id }); }
    const pv = r[t.h.promoteVerdict];
    if (!inv && pv === 'block') { blockedAuto++; bad.push({ why: '自动成员体检 block', id: id }); }
    if (pv === 'untested' && !inv) untestedProm++;
    const sk = Number(r[t.h.seatKill]);
    if (!inv && sk > 0) { seatKilled++; bad.push({ why: '自动成员人席否决 ' + sk + ' 格', id: id }); }
    if (sk < 0) seatUnknown++;
  }
  console.log(JSON.stringify({ members: t.rows.length, tiers: tiers, untracked: untracked, dupWid: dupWid,
    blockedAuto: blockedAuto, untestedAuto: untestedProm, seatKilledAuto: seatKilled, seatUnknown: seatUnknown,
    modes: MODES, bad: bad.slice(0, 6) }));
  process.exitCode = (untracked || dupWid || blockedAuto || seatKilled) ? 1 : 0;
  process.exit(0);
}
if (has('list')) {
  const t = loadMap(); const only = arg('tier', '');
  console.log('池成员 ' + t.rows.length + ' 枚' + (only ? '（tier=' + only + '）' : ''));
  for (const r of t.rows) if (!only || r[t.h.tier] === only) {
    console.log('  ' + (r[t.h.id] + '                ').slice(0, 16) + ' ' + r[t.h.tier] + ' · wid=' + String(r[t.h.wid]).slice(0, 8) +
      ' · 体检 ' + r[t.h.promoteVerdict] + ' · 人席否决 ' + (r[t.h.seatKill] === '-1' ? '没量过' : r[t.h.seatKill] + ' 格') +
      (r[t.h.invited] === '1' ? ' · 点名越过门槛' : '') + ' · ' + r[t.h.path]);
  }
  process.exit(0);
}

/* ---------- --refresh：把表里已有行的"两道闸"重算一遍（人席/体检的数据常晚于入池那一刻到） ----------
 * 为什么必须有：入池时某枚可能 `seatKill=-1`（批表还没跑它）。没有这条模式的话，表会**永远停在"没量过"**，
 *   而 `D234` 只把"没量过"印出来不判红 ⇒ 一个没人回填的字段就是假象上的完整。 */
if (has('refresh')) {
  const t = loadMap();
  const seatFiles = arg('seat', 'pool-seat-90210.tsv,pool-seat-90211.tsv').split(',');
  const changes = []; let unknown = 0;
  for (const r of t.rows) {
    const before = r[t.h.promoteVerdict] + '/' + r[t.h.seatKill];
    const got = poolVerdictOf(r[t.h.id], r[t.h.path], has('run-promote'));
    /* ⚠ 查不到行**不许把已记录的裁决冲掉**（第一版就是这么干的：`pass/-1 → untested/-1`，
     *   同一类错的第二个副本是 `0 → -1`：只喂了新到的 mid/low 批表，hard 档量过的 0 被当成"没量过"抹掉）。
     *   表里的旧值来自上一次真跑，这张表里没有这行只说明"这批表没覆盖它"，
     *   不等于"它没被量过/它没过体检" ⇒ 保持原样，只有明确跑出来/查出来才覆盖。**没查到 ≠ 作废。** */
    if (got) r[t.h.promoteVerdict] = got.verdict;
    const sk = seatKillOf(r[t.h.wid], seatFiles);
    if (sk >= 0) r[t.h.seatKill] = String(sk);
    if (Number(r[t.h.seatKill]) < 0) unknown++;
    if (before !== r[t.h.promoteVerdict] + '/' + r[t.h.seatKill]) changes.push(r[t.h.id] + ' ' + before + ' → ' + r[t.h.promoteVerdict] + '/' + r[t.h.seatKill]);
  }
  if (has('dry')) { console.log('（--dry）要改 ' + changes.length + ' 行：\n   ' + (changes.join('\n   ') || '无')); }
  else { saveMap(t); console.log('✔ 已刷 champion-map/pool-members.tsv：改了 ' + changes.length + ' 行 ‖ 人席仍没量过的 ' + unknown + ' 枚');
    for (const c of changes) console.log('   · ' + c); }
  process.exit(0);
}

/* ---------- 加入 ---------- */
const ID = arg('id', ''), PACK = arg('pack', ''), TIER = arg('tier', '');
if (!ID || !PACK || !TIERS.includes(TIER)) {
  console.error('⛔ 要 --id= --pack= --tier=' + TIERS.join('|') + '（查名单用 --list，给门用 --audit）'); process.exit(2);
}
const ABS = resolvePath(PACK, ROOT);
if (!existsSync(ABS)) { console.error('⛔ 包文件不在盘上：' + PACK); process.exit(2); }
const WID = widOf(readFileSync(ABS, 'utf8'));
if (!WID) { console.error('⛔ 解不出权重（这台工具不许把"读不出"当成"没重复"）：' + PACK); process.exit(2); }
const TR = trackedSet();
const t = loadMap();
const dup = t.rows.filter(r => r[t.h.wid] === WID);
if (dup.length) { console.error('⛔ 这一粒权重已经在池里了：' + dup.map(r => r[t.h.id] + '(' + r[t.h.tier] + ')').join(' ‖ ') +
  ' ⇒ 再加一枚只会让"池里有 N 枚"虚高（§E589：1443 文件 = 1130 粒）。要给同一个包换名字请改那一条的 id/path。'); process.exit(2); }
if (t.rows.filter(r => r[t.h.id] === ID).length) { console.error('⛔ 池里已有同名成员 ' + ID + '（改名请直接从表里删那条再来，别留两行）'); process.exit(2); }

const INVITE = has('invite');
/* ⚠ 查不到行 ⇒ `promoteInfoOf` 返回 **null**，门槛判的是字符串 `'untested'` ⇒ 不归一就是"没测过被当放行"
 *   （10-11 夜自测抓到：一枚查不到裁决的包就这么静默进了表）。null 与 'untested' 在这里是同一件事，必须合并。 */
const PI = poolVerdictOf(ID, PACK, has('run-promote')) || { verdict: 'untested', blocks: '' };
const PV = PI.verdict;
const SK = seatKillOf(WID, arg('seat', 'pool-seat-90210.tsv,pool-seat-90211.tsv').split(','));
/* 每条 blocker 自带"点名能不能越过"的标记 ⇒ 能不能越过是**判据的属性**，不是调用时的口味 */
const hard = [], soft = [];
if (!TR.has(PACK)) hard.push('包文件不在 git 里 ⇒ CI 与干净克隆看不见这枚 ⇒ 先跑：git add -f ' + PACK);
if (PV === 'block') { const c = classifyBlock(PI.blocks); (c.kind === 'hard' ? hard : soft).push(c.why); }
if (PV === 'untested') soft.push('没过上槽体检（没测 ≠ 过关；要现在跑加 --run-promote）');
if (SK > 0) soft.push('人席否决 ' + SK + ' 格（§E531 两批同号 ≥20pt；引用时须带 §E587 的检出力脚注）');
if (SK < 0 && PV !== 'pass') soft.push('人席也没量过（批表里没这枚 ⇒ seatKill=-1，不是 0）');

console.log('== 加入冠军池 ==');
console.log('   id=' + ID + ' · wid=' + WID.slice(0, 16) + ' · tier=' + TIER + (INVITE ? ' · 点名' : ''));
console.log('   上槽体检：' + PV + (PI.blocks ? '（' + PI.blocks.slice(0, 90) + '）' : '') +
  ' ‖ 人席否决：' + (SK < 0 ? '没量过（批表里没这枚）' : SK + ' 格'));
if (hard.length) { console.error('\n⛔ 拒绝入池（硬闸，点名也不放行）：\n   · ' + hard.join('\n   · ')); process.exit(2); }
if (soft.length && !INVITE) { console.error('\n⛔ 拒绝入池（自动成员要过两道闸；要点名进就加 --invite，越过的原话会记进表）：\n   · ' + soft.join('\n   · ')); process.exit(2); }
if (soft.length) console.log('   ⚠ 点名越过：' + soft.join(' ‖ '));
const NOTE = arg('note', '') + (INVITE && soft.length ? ' · 点名越过：' + soft.join(' ‖ ') : '');
const row = [ID, WID, PACK, TIER, INVITE ? '1' : '0', PV, String(SK), new Date().toString(), NOTE];
if (has('dry')) { console.log('（--dry：没写表）将落这一行：\n   ' + COLS.join(' | ') + '\n   ' + row.join(' | ')); process.exit(0); }
t.rows.push(row);
t.rows.sort((a, b) => (TIERS.indexOf(a[3]) - TIERS.indexOf(b[3])) || a[0].localeCompare(b[0]));
saveMap(t);
console.log('✔ 已写 champion-map/pool-members.tsv（现 ' + t.rows.length + ' 枚）');
console.log('   下一步：node tools/build-pool-bundle.mjs（把表派生成浏览器读的 js/bundled-champion-pool.js）');
