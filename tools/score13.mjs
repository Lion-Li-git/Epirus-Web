#!/usr/bin/env node
/* score13.mjs —— 冠军验收线的**判语器**（DS · 2026-10-27 晚建 ‖ 千问 · 2026-10-28 改成分层判语）
 *
 * 为什么要有它：13 行判据从 10-26 夜班起是这条线的主判据，但判语器（score13/tally13）一直住在会话侧，
 *   换台机器就复算不了 ⇒ 所有 12/13、11/13 都成了不可复核的读数（METHODOLOGY 第 137 条那件事的另一面）。
 *   本文件把**读数解析与判语**写进仓内：只读、不改包、不跑训练。
 * 2026-10-28：**线的定义搬到了 `tools/champion-gate.mjs`**（人话名 / 能力维度 / 层 / 桌与 n 只有一份），
 *   这里只剩「把 `promote --dry` 的文本解析成读数 ⇒ 交给登记处判」。改措辞不许再动判据，改判据不许再动措辞。
 *
 * 用法（三种来源，按需组合）：
 *   node tools/score13.mjs --pack=<包.js|.bak> [--json] [--run]   # --run：自己 spawn promote/eval（≈5-7 分钟/枚）
 *   node tools/score13.mjs --promote=<promote --dry 的输出.txt> --density=0.99,0.833 --strength=51.5 [--json]
 *   node tools/score13.mjs --selftest                               # 只跑解析器的夹具（秒级）
 *   `--rows=13` = 连 L3「只记录」那几条一起印（旧口径对照）；默认只判闸门层（L0+L1）。
 *
 * ⚠ 三条口径（与 PREREG §二 一致，别在调用点各写一遍）：
 *   ① 广读 **取严** 那句（min(selfPlay ‖ breadthProfile)），不是可行性栏里的 selfPlay 值；
 *   ② G4/G5 由 `promote --dry` 的行为门行判：出现 `✗ G4[` / `✗ G5[` 就是红，行里没有 ✗ 就是绿；
 *   ③ 珠 2026-10-28 起按**绝对颗数**判（过期 ≤5 颗/局），得珠=0 = 不适用；比率（浪费率）降为诊断读数。
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';

const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1').replace(/\/$/, '');
const A = process.argv.slice(2);
const arg = (k) => { const f = A.find((a) => a.indexOf('--' + k + '=') === 0); return f ? f.slice(k.length + 3) : null; };
const has = (k) => A.includes('--' + k);

/* ===== 解析器（纯函数：文本进 ⇒ 读数出；不碰文件系统，便于 selftest） ===== */
export function parsePromote(txt) {
  const t = String(txt || '');
  const out = { rows: {}, raw: {} };
  const num = (m) => (m ? Number(m[1]) : null);
  const self = t.match(/自对局（5 座同一冠军 ×20）：伤害\/局 = ([\d.]+)，平局率 = ([\d.]+)%/);
  if (self) { out.raw.dmg = Number(self[1]); out.raw.draw = Number(self[2]); }
  const stance = t.match(/无威胁\(对手ジ<5\)时摆架势 = ([\d.]+)%/);
  if (stance) out.raw.stance = Number(stance[1]);
  const fa = t.match(/场A 被集火还手率 = ([\d.]+)%/);
  if (fa) out.raw.fieldA = Number(fa[1]);
  const feas = t.match(/可行性（[^）]*）：([^\n]*)/);
  if (feas) {
    const blk = feas[1];
    const wall = blk.match(/墙 ([\d.]+)\/局/); if (wall) out.raw.wall = Number(wall[1]);
    const seat = blk.match(/座位 ([\d.]+)pt/); if (seat) out.raw.seat = Number(seat[1]);
    const fb = blk.match(/场B 清场 ([\d.]+)\/局/); if (fb) out.raw.fieldB = Number(fb[1]);
    out.feasOk = /✅ 五道全过/.test(blk);
    out.feasFails = (blk.match(/✗ ([^（；]+)/g) || []).map((s) => s.slice(2).trim());
  }
  /* 广度三行（取严那句才是判据；旁边可行性栏里的是 selfPlay 值，口径不同） */
  const bm = t.match(/multi 有效技能数=([\d.]+)/);
  const bl = t.match(/long（= 长程，产品常用模式）\*\* 有效技能数=([\d.]+)/);
  if (bm) out.raw.gMulti = Number(bm[1]);
  if (bl) out.raw.gLong = Number(bl[1]);
  else { const al = t.match(/\*\*long[^\n]*?有效技能数=([\d.]+)/); if (al) out.raw.gLong = Number(al[1]); }
  /* 珠经济（40 局） */
  const bead = t.match(/珠经济（40 局）：蓄能 ([\d.]+)\/局 · 得珠 (\d+) · 过期 (\d+) · \*\*花掉 (\d+)\*\* · 浪费率 (\d+)% · \*\*花珠率 ([\d.]+)%/);
  if (bead) { out.raw.charge = Number(bead[1]); out.raw.gained = Number(bead[2]); out.raw.expired = Number(bead[3]); out.raw.spent = Number(bead[4]); out.raw.waste = Number(bead[5]); out.raw.spendRate = Number(bead[6]); }
  /* 2026-10-28：珠这条改按**绝对颗数**判（用户：「或许可以按照绝对浪费数量来算？」）⇒ 要抓那句尾部的「过期 X/局」 */
  const expPg = t.match(/· 过期 ([\d.]+)\/局/);
  if (expPg) out.raw.expiredPerGame = Number(expPg[1]);
  /* 防御质量栏（`defense-quality.mjs` 的措辞）：⚠ **promote 默认那一栏是「攒钱者(banker)」装配 ⇒ 不能拿来立线**。
   *   实测（2026-10-28，池 30 枚同装配）：白防率 min 72.4 ‖ 中位 **89.4%** ‖ max 94.8，且倍差中位 0.65×(<1)
   *   ⇒ 「出了防御但没人打」在这张桌上是**装配产物**（探针自己的话：倍差≈1 时「空挡高只是没人打我，不许读成防得没道理」）。
   *   所以：只有当那一行印的是**被攻击桌（hotseat）**才喂给「防了个寂寞」那条；banker 那一份只留作诊断。 */
  const dq = t.match(/白防 ([\d.]+)%\*\* · n=(\d+) 手/);
  const asm = t.match(/装配=([^）)]+)/);
  if (dq) {
    const feed = asm && /被攻击|hotseat/i.test(asm[1]);
    if (feed) { out.raw.idle = Number(dq[1]); out.raw.defN = Number(dq[2]); out.defqAssembly = 'hotseat'; }
    else { out.raw.idleBanker = Number(dq[1]); out.raw.defBankerN = Number(dq[2]); out.defqAssembly = 'banker(不立线)'; }
  }
  /* 送盾（旧硬门槛的读数；2026-10-28 起登记为**只记录**） */
  const hg = t.match(/其中\*\*套给别人\*\* ([\d.]+) 次\/局/);
  if (hg) out.raw.holoOther = Number(hg[1]);
  /* 行为门：只有红的那几格会被印出来 */
  const beh = (t.match(/G4\/G5 行为门（[^）]*）：([^\n]*)/) || [])[1] || '';
  /* 只有**第一格**带 ✗，后面的格子是「；G5[...]」⇒ 必须按格子切，不能靠 ✗ 全局找（第一版就是这么少算一格的） */
  const behSegs = beh.split('；');
  out.raw.g4Fails = behSegs.filter((s) => /G4\[/.test(s)).map((s) => s.trim());
  out.raw.g5Fails = behSegs.filter((s) => /G5\[/.test(s)).map((s) => s.trim());
  out.raw.behaviorHeader = beh.length > 0;
  out.raw.g4Worst = (function () { const m = beh.match(/最克「([^」]+)」([\d.]+)%/); return m ? { cell: m[1], pct: Number(m[2]) } : null; })();
  return out;
}

export function parseEval(txt) {
  const m = String(txt || '').match(/\[冠军\] 1st=([\d.]+)%/);
  return m ? Number(m[1]) : null;
}

/* ===== 线的定义在 `tools/champion-gate.mjs`（单一来源）=====
 * 2026-10-28 用户裁定：① 激光眼密度不进闸门 ② 池子是多风格抽卡，不能指望每枚都会所有技能
 *   ⇒ 判据分两层（单包只判缺陷 / 能力覆盖归整池），并且**每条线要写人话**。
 * 本文件因此不再自带 `LINES`：它只做「解析 promote 的输出 ⇒ 按登记处判语」。
 * 默认判 **闸门层（L0+L1）**；`--rows=13` 把旧口径（含珍那一条 L3）一并印出来做历史对照。 */
import { LINES, LAYERS } from './champion-gate.mjs';

/* ===== 密度：仓内 in-process（ε=0 镜像 120 局 × 5 席，castByKey.laserEye） ===== */
export function densityOf(packPath) {
  const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map, Float64Array };
  sb.window = sb; sb.globalThis = sb;
  for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
    vm.runInNewContext(readFileSync(REPO + '/' + f, 'utf8'), sb, { filename: f });
  }
  vm.runInNewContext(readFileSync(packPath, 'utf8'), sb, { filename: packPath });
  const pack = sb.window.EPIRUS_CHAMPION_3P || sb.window.EPIRUS_CHAMPION;
  const params = sb.window.EpirusPolicy.unpack(pack, true);
  if (!params) throw new Error('读不出权重');
  const out = [];
  for (const mode of ['multi', 'long']) {
    const r = sb.window.EpirusTrainer.mirrorHealth(params, 120, 5, mode);
    out.push(Math.round(1000 * ((r.castByKey && r.castByKey.laserEye) || 0) / 600) / 1000);
  }
  return out;
}

function verdict(rec, allRows) {
  /* 默认只判闸门层（L0+L1）；`--rows=13` 把登记处所有行都印出来（含 L3 只记录那几条）*/
  const set = allRows ? LINES : LINES.filter(l => l.layer === 'L0' || l.layer === 'L1');
  const rows = set.map((L) => {
    const v = L.get(rec);
    const p = L.pass(v, rec);
    return { key: L.key, name: L.name, old: L.old, layer: L.layer, dim: L.dim, rule: L.rule, src: L.src, value: v,
      partial: Array.isArray(v) && v.some((x) => x == null),
      ok: p === null ? null : !!p };   /* null = **读不出**（量具没给这一栏），既不是绿也不是红 */
  });
  const gate = rows.filter(r => r.layer === 'L0' || r.layer === 'L1');
  return { rows, red: gate.filter(r => r.ok === false).map(r => r.old),
    na: gate.filter(r => r.ok === null).map(r => r.old),
    green: gate.filter(r => r.ok === true).length, of: gate.length };
}

function fmt(v) {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? x.toFixed(3) : (x == null || x === undefined ? '—' : String(x)))).join('‖');
  if (typeof v === 'boolean') return v ? '✅' : '❌';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function main() {
  if (has('selftest')) {
    const f = parsePromote(SAMPLE_F), s = parsePromote(SAMPLE_S3);
    const checks = [
      [f.raw.dmg === 14.5, 'F 伤 14.5'],
      [f.raw.wall === 0, 'F 墙 0'],
      [f.raw.fieldB === 1, 'F 场B 1'],
      [f.raw.gMulti === 4.15 && f.raw.gLong === 4.44, 'F 广取严 4.15/4.44（不是可行性栏的 4.55）'],
      [f.raw.waste === 19 && f.raw.gained === 199, 'F 珠 19%/199（诊断读数，判语已不看它）'],
      [f.raw.expiredPerGame === 0.9, 'F 珠绝对量 过期 0.9/局（2026-10-28 的新判据吃的就是这一栏）'],
      [f.raw.holoOther === 14.9, 'F 送盾 套给别人 14.9/局（旧硬门槛的读数，现登记为只记录）'],
      [f.raw.idle == null && f.raw.idleBanker === 63.9 && f.raw.defBankerN === 36, 'F 白防 63.9%/36 手落进 banker 诊断格、**不喂判据**（装配=攒钱者 ⇒ 这张桌没人打它）'],
      [f.raw.g5Fails.length === 2 && f.raw.g4Fails.length === 0, 'F 只有 G5 红两格'],
      [s.raw.fieldB === 0 && s.raw.fieldA === 18.7, 'S3 场B 0 / 场A 18.7'],
      [s.raw.expiredPerGame == null, 'S3 没印「过期 X/局」⇒ 珠那条必须读不出（不许当成 0）'],
      [s.raw.g4Fails.length === 2 && s.raw.g5Fails.length === 2, 'S3 G4/G5 各两格红'],
      [verdict({ raw: f.raw, density: null, strength: 51.5 }, false).of === 13, '闸门默认条数 = 13（L0+L1；珍/送盾/G6 在 L3 不进分母）'],
      [verdict({ raw: s.raw, density: null, strength: 44 }, false).na.includes('（新增）'), 'S3 缺防御质量栏 ⇒ 那条挂"读不出"，不判绿'],
      [verdict({ raw: { gained: 0, expiredPerGame: 0, charge: 0, waste: 0 }, density: null, strength: null }, false)
        .rows.find(r => r.key === 'bead').ok === true, '得珠=0 ⇒ 珠那条判「不适用」（绿）而不是红'],
      [parseEval('[冠军] 1st=51.5% 严胜=49.5%') === 51.5, 'eval 解析']
    ];
    let bad = 0;
    for (const [ok, name] of checks) { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + name); }
    console.log('自测：' + (checks.length - bad) + '/' + checks.length);
    process.exit(bad ? 1 : 0);
  }
  const pack = arg('pack');
  let promoteTxt = '';
  const pFile = arg('promote');
  if (pFile) promoteTxt = readFileSync(pFile, 'utf8');
  else if (pack && has('run')) {
    const r = spawnSync(process.execPath, ['tools/promote-champion.mjs', pack, '--dry'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    promoteTxt = (r.stdout || '') + (r.stderr || '');
  } else if (pack) {
    console.error('⛔ 给了 --pack 但没给 --promote=<txt>：要么先跑 promote --dry 存成文件，要么加 --run（≈5-7 分钟）。');
    process.exit(2);
  }
  const rec = parsePromote(promoteTxt);
  /* 「防了个寂寞」这条要的是**被攻击桌**的白防率，而 promote 印的是攒钱者桌（不喂判据）⇒ 自己补跑一次 hotseat。
   *   只在给了 --pack 且没关掉时跑（探针 ~2 秒/枚）；`--no-defq` 可跳过（批量筛省时）。 */
  if (pack && !has('no-defq')) {
    try {
      const qr = spawnSync(process.execPath, ['tools/probe-wasted-play.mjs', '--packs=' + pack, '--games=30', '--quiet=1', '--assembly=hotseat'],
        { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      const mixed = (qr.stdout || '') + '\n' + '装配=被攻击桌(hotseat)';
      const dq = parsePromote(mixed);
      if (dq.raw.idle != null) { rec.raw.idle = dq.raw.idle; rec.raw.defN = dq.raw.defN; rec.defqAssembly = 'hotseat(本工具补跑)'; }
    } catch (e) { /* 探针挂 ⇒ 保持读不出（这条不许因为量具坏了就判绿或判红） */ }
  }
  const dArg = arg('density');
  rec.density = dArg ? dArg.split(',').map(Number) : (pack ? densityOf(pack) : null);
  const sArg = arg('strength');
  const eFile = arg('eval');
  rec.strength = sArg != null ? Number(sArg) : (eFile ? parseEval(readFileSync(eFile, 'utf8')) : null);
  const V = verdict(rec, arg('rows') === '13');
  if (has('json')) {
    console.log(JSON.stringify({ rows: V.rows, red: V.red, na: V.na, green: V.green, of: V.of, raw: rec.raw, density: rec.density, strength: rec.strength }));
  } else {
    let lastLayer = null;
    for (const row of V.rows) {
      if (row.layer !== lastLayer) { lastLayer = row.layer; console.log('\n【' + row.layer + ' ' + LAYERS[row.layer].name + '】负责：' + LAYERS[row.layer].who + ' —— ' + LAYERS[row.layer].mean); }
      console.log((row.ok === true ? '✅ ' : row.ok === false ? '❌ ' : '◻　')
        + row.name.padEnd(22, ' ') + fmt(row.value).padEnd(12, ' ') + '〔原机器名 ' + row.old + ' ‖ ' + row.dim + '〕'
        + (row.partial ? '  ⚠ 有子句**读不出**（上面那条线里没判到的部分要自己看量具）' : ''));
      console.log('        线：' + row.rule);
      console.log('        量具：' + row.src);
    }
    console.log('\n——— 闸门 ' + V.green + '/' + V.of + ' 绿 ‖ 红：' + (V.red.join('·') || '无')
      + (V.na.length ? ' ‖ **读不出**（量具没给这一栏 ⇒ 既不判绿也不判红）：' + V.na.join('·') : '')
      + '\n    红项仍用旧机器名，便于与 10-27/10-28 那两张表对账。线的定义与层籍只在 `tools/champion-gate.mjs`。');
  }
  process.exit(V.red.length ? 1 : 0);
}

/* 夹具：两份真实 promote --dry 输出（F = 只红 G5；S3 = G4/G5 各两格红） */
const SAMPLE_F = `自对局（5 座同一冠军 ×20）：伤害/局 = 14.5，平局率 = 0%，回合 = 31.6，全息屏障/局 = 0.0，有效技能数 = 4.15
E 被动场：旧口径摆架势率 = 3%   **新口径·无威胁(对手ジ<5)时摆架势 = 4%**（无威胁回合 159，最长无威胁连摆 1）
场A 被集火还手率 = 28.5% ±8.9pt(n=100, 1.96SE)（造成伤害 1.97/局，承受 2.83/局，胜率 11%）
可行性（与训练落盘同源 · 样本量 n=20/aggr100/seat100）：✗ 反弹墙伤害 0.00 ≤ 0.5/局（座位 6.5pt/ok · G(multi) 4.15 · **G(long) 4.55** · 墙 0/局 · 场A 28.5% · 场B 清场 1/局）
广度（门判 multi 与 long）：multi 有效技能数=4.15（取严 = min(selfPlay 4.15 ‖ breadthProfile 4.44） · **long（= 长程，产品常用模式）** 有效技能数=4.44（取严 = min(selfPlay 4.55 ‖ breadthProfile 4.44））
珠经济（40 局）：蓄能 4.97/局 · 得珠 199 · 过期 38 · **花掉 160** · 浪费率 19% · **花珠率 80.4%** · 过期 0.9/局
   全息屏障（自对局）：15.9 次/局，其中**套给别人** 14.9 次/局
   防御质量栏（同上，**只记录不阻断**）：防御质量 **25.0%**（有效 13.9% · 被穿透=半 22.2% · **白防 63.9%** · n=36 手） · 装配=攒钱者（1 席 hold + 4 席被评） · 口径 ε=0.2/soft · 判定用的是**手次数**，不是占比
G4/G5 行为门（第七轮复核 §15-1，**只判候选自己**）：✗ G5[.e811-F/long] 面对"只防御不还手"必须能清场（实测防席夺冠 51%）；G5[.e811-F/multi] 面对"只防御不还手"必须能清场（实测防席夺冠 35%）`;
const SAMPLE_S3 = `自对局（5 座同一冠军 ×20）：伤害/局 = 13.7，平局率 = 0%，回合 = 25.2
E 被动场：旧口径摆架势率 = 18%   **新口径·无威胁(对手ジ<5)时摆架势 = 8%**
场A 被集火还手率 = 18.7% ±7.6pt(n=100, 1.96SE)
可行性（与训练落盘同源 · 样本量 n=20/aggr100/seat100）：✗ 场A 还手 18.7% < 20%；场B 清场 0.00 < 0.3/局（座位 15.2pt/ok · G(multi) 6.78 · **G(long) 5.99** · 墙 1/局 · 场A 18.7% · 场B 清场 0/局）
广度：multi 有效技能数=6.78（取严） · **long（= 长程，产品常用模式）** 有效技能数=5.99（取严）
珠经济（40 局）：蓄能 3.48/局 · 得珠 139 · 过期 37 · **花掉 97** · 浪费率 27% · **花珠率 69.8%**
G4/G5 行为门（第七轮复核 §15-1，**只判候选自己**）：✗ G4[.e814-S3/long] 无一行脚本能以 >60% 击败它（最克「只防御(不还手)」83.7%）；G4[.e814-S3/multi] 无一行脚本能以 >60% 击败它（最克「只防御(不还手)」71%）；G5[.e814-S3/long] 必须能清场（实测防席夺冠 85%）；G5[.e814-S3/multi] 必须能清场（实测防席夺冠 73%）`;

if (process.argv[1] && /score13\.mjs$/.test(process.argv[1])) main();
