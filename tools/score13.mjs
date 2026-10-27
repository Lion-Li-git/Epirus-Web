#!/usr/bin/env node
/* score13.mjs —— 「无短板」13 行的**仓内判语器**（DS · 2026-10-27 晚）
 *
 * 为什么要有它：13 行判据从 10-26 夜班起是这条线的主判据，但判语器（score13/tally13）一直住在会话侧，
 *   换台机器就复算不了 ⇒ 所有 12/13、11/13 都成了不可复核的读数（METHODOLOGY 第 137 条那件事的另一面）。
 *   本文件把**列定义、阈值与读数来源**写进仓内：只读、不改包、不跑训练。
 *
 * 用法（三种来源，按需组合）：
 *   node tools/score13.mjs --pack=<包.js|.bak> [--json] [--run]   # --run：自己 spawn promote/eval（≈5-7 分钟/枚）
 *   node tools/score13.mjs --promote=<promote --dry 的输出.txt> --density=0.99,0.833 --strength=51.5 [--json]
 *   node tools/score13.mjs --selftest                               # 只跑解析器的夹具（秒级）
 *
 * ⚠ 三条口径（与 PREREG §二 一致，别在调用点各写一遍）：
 *   ① 广读 **取严** 那句（min(selfPlay ‖ breadthProfile)），不是可行性栏里的 selfPlay 值；
 *   ② G4/G5 由 `promote --dry` 的行为门行判：出现 `✗ G4[` / `✗ G5[` 就是红，行里没有 ✗ 就是绿；
 *   ③ 珠必须带 `得珠 > 0` 分母门槛（空分母的 0% 与真 0 同形，§E798 三）。
 * 判据 13 行 = 伤 平 墙 架 还 座 广 场B G4 G5 珍 珠 强。
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

/* ===== 13 行的线与判语（单一来源） ===== */
export const LINES = [
  { key: 'dmg',    name: '伤',   rule: '≥ 5/局',          get: (r) => r.raw.dmg,    pass: (v) => v != null && v >= 5 },
  { key: 'draw',   name: '平',   rule: '≤ 20%',           get: (r) => r.raw.draw,   pass: (v) => v != null && v <= 20 },
  { key: 'wall',   name: '墙',   rule: '> 0.5/局',        get: (r) => r.raw.wall,   pass: (v) => v != null && v > 0.5 },
  { key: 'stance', name: '架',   rule: '≤ 60%',           get: (r) => r.raw.stance, pass: (v) => v != null && v <= 60 },
  { key: 'fieldA', name: '还',   rule: '≥ 20%',           get: (r) => r.raw.fieldA, pass: (v) => v != null && v >= 20 },
  { key: 'seat',   name: '座',   rule: '< 30pt',          get: (r) => r.raw.seat,   pass: (v) => v != null && v < 30 },
  { key: 'broad',  name: '广',   rule: '取严 ≥ 3（两模式各判）', get: (r) => [r.raw.gMulti, r.raw.gLong], pass: (v) => Array.isArray(v) && v[0] != null && v[1] != null && v[0] >= 3 && v[1] >= 3 },
  { key: 'fieldB', name: '场B',  rule: '≥ 0.3/局',        get: (r) => r.raw.fieldB, pass: (v) => v != null && v >= 0.3 },
  { key: 'g4',     name: 'G4',   rule: '六格每格 ≤ 60%',  get: (r) => (r.raw.behaviorHeader ? r.raw.g4Fails.length === 0 : null), pass: (v) => v === true },
  { key: 'g5',     name: 'G5',   rule: '≤ 25%（带档 ≤40%）', get: (r) => (r.raw.behaviorHeader ? r.raw.g5Fails.length === 0 : null), pass: (v) => v === true },
  { key: 'dens',   name: '珍',   rule: '≥0.10 次/席·局（两档）', get: (r) => r.density,  pass: (v) => Array.isArray(v) && v.length === 2 && v[0] >= 0.10 && v[1] >= 0.10 },
  { key: 'bead',   name: '珠',   rule: '得珠>0 ∧ 浪费<50% ∧ 蓄能≤9.4', get: (r) => r.raw.gained, pass: (v, r) => v != null && v > 0 && r.raw.waste != null && r.raw.waste < 50 && r.raw.charge != null && r.raw.charge <= 9.4 },
  { key: 'strong', name: '强',   rule: 'A考卷 1st ≥ 48.2（soft 带中位）', get: (r) => r.strength, pass: (v) => v != null && v >= 48.2 }
];

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

function verdict(rec) {
  const rows = LINES.map((L) => { const v = L.get(rec); return { name: L.name, rule: L.rule, value: v, ok: L.pass(v, rec) }; });
  return { rows, red: rows.filter((x) => !x.ok).map((x) => x.name), green: rows.filter((x) => x.ok).length };
}

function fmt(v) {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? x.toFixed(3) : String(x))).join('‖');
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
      [f.raw.waste === 19 && f.raw.gained === 199, 'F 珠 19%/199'],
      [f.raw.g5Fails.length === 2 && f.raw.g4Fails.length === 0, 'F 只有 G5 红两格'],
      [s.raw.fieldB === 0 && s.raw.fieldA === 18.7, 'S3 场B 0 / 场A 18.7'],
      [s.raw.g4Fails.length === 2 && s.raw.g5Fails.length === 2, 'S3 G4/G5 各两格红'],
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
  const dArg = arg('density');
  rec.density = dArg ? dArg.split(',').map(Number) : (pack ? densityOf(pack) : null);
  const sArg = arg('strength');
  const eFile = arg('eval');
  rec.strength = sArg != null ? Number(sArg) : (eFile ? parseEval(readFileSync(eFile, 'utf8')) : null);
  const V = verdict(rec);
  if (has('json')) {
    console.log(JSON.stringify({ rows: V.rows, red: V.red, green: V.green, raw: rec.raw, density: rec.density, strength: rec.strength }));
  } else {
    for (const row of V.rows) console.log((row.ok ? '✅ ' : '❌ ') + row.name.padEnd(3, ' ') + ' ' + fmt(row.value).padEnd(12, ' ') + ' 线 ' + row.rule);
    console.log('——— ' + V.green + '/13 绿 ‖ 红：' + (V.red.join('·') || '无'));
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
G4/G5 行为门（第七轮复核 §15-1，**只判候选自己**）：✗ G5[.e811-F/long] 面对"只防御不还手"必须能清场（实测防席夺冠 51%）；G5[.e811-F/multi] 面对"只防御不还手"必须能清场（实测防席夺冠 35%）`;
const SAMPLE_S3 = `自对局（5 座同一冠军 ×20）：伤害/局 = 13.7，平局率 = 0%，回合 = 25.2
E 被动场：旧口径摆架势率 = 18%   **新口径·无威胁(对手ジ<5)时摆架势 = 8%**
场A 被集火还手率 = 18.7% ±7.6pt(n=100, 1.96SE)
可行性（与训练落盘同源 · 样本量 n=20/aggr100/seat100）：✗ 场A 还手 18.7% < 20%；场B 清场 0.00 < 0.3/局（座位 15.2pt/ok · G(multi) 6.78 · **G(long) 5.99** · 墙 1/局 · 场A 18.7% · 场B 清场 0/局）
广度：multi 有效技能数=6.78（取严） · **long（= 长程，产品常用模式）** 有效技能数=5.99（取严）
珠经济（40 局）：蓄能 3.48/局 · 得珠 139 · 过期 37 · **花掉 97** · 浪费率 27% · **花珠率 69.8%**
G4/G5 行为门（第七轮复核 §15-1，**只判候选自己**）：✗ G4[.e814-S3/long] 无一行脚本能以 >60% 击败它（最克「只防御(不还手)」83.7%）；G4[.e814-S3/multi] 无一行脚本能以 >60% 击败它（最克「只防御(不还手)」71%）；G5[.e814-S3/long] 必须能清场（实测防席夺冠 85%）；G5[.e814-S3/multi] 必须能清场（实测防席夺冠 73%）`;

if (process.argv[1] && /score13\.mjs$/.test(process.argv[1])) main();
