/* §E298 把"过线"从 94 枚扩到**全体 718 枚**，并且**只用一把尺**。
 *
 * 为什么要重跑（用户 10-04：「过线范围好像是沿用旧的那个图，只有很少的点有写是否过线。
 *   要是耗时不长的话就把所有点都搞一遍然后做一个精度更高的过线范围」）：
 *   ① 旧图吃的 `e287-panel.tsv` 的 ok 列 = 包自己 META 里的 `feasibility.ok`（训练落盘时写的），
 *      面板还额外筛了 opps=16 席 ⇒ **只有 94 枚有值**。实测全 718 枚里 482 枚带 feasibility.ok
 *      （79 过 / 403 不过），**236 枚老包根本没写这个块**（def-31 / eco-31 / fgtA-32 …）。
 *   ② 更要紧的是那 482 枚**跨 6 个 opps 层**（12/15/16/17/18/20/22 席），而 §E287 实测
 *      "只换 opps 池，过线率 45.7% → 6.4%" ⇒ 自报的 ok 是**六把不同的尺**，画在一起就是假范围。
 *
 * 做法：**照抄 `tools/promote-champion.mjs` 的调用配方**（同一个 `feasibilityOf` 单一真源、同一份
 *   `feasPlan` 默认样本量 n=20/aggr40/seat100/density20/charge40），对 718 枚**现跑一遍**。
 *   不碰 `tools/`、不碰 `js/core`、不改任何阈值 —— 只是把同一台闸机对每枚包过一遍。
 *   ⚠ 只复现 `feasibility.ok`（= 训练落盘/出厂记录的那个字段）。promote 另有几条**不在** feasibilityOf 里的
 *     阻断（穿透卡零命中、G4 当选面、HOLO_GIFT_MAX…），那些不在本脚本范围内，也不该被当成"过线"。
 *
 * 成本：每枚 ≈ 200 局（不含考卷），实测 ~1.3s/枚 ⇒ 三片并发约 5 分钟。**不测考卷 H**（那是 §E290 的尺，已有）。
 * 可续跑 + 可分片 + 空跑必红（`--shard` 写错时曾差点把"一枚没量"当跑完发出去）。
 * 用法：node champion-map/feas.mjs [--shard=1/3] [--out=feas-s1.tsv] [--limit=0] [--ids=a,b]
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sandbox, loadChamp, selfPlay, reflectWall, seatSymmetry, aggressionProfile, densityProfile,
  chargeProfile, feasibilityOf, feasPlan, extractJsonObject } from '../tools/audit-lib.mjs';

/* §E303 本目录从 docs/artifacts/e287-out/ 挪到仓库根 ⇒ 深度少两级，ROOT 与上面的 import 一起换。 */
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(('--' + k + '=').length) : d; };
const OUT = arg('out', 'feas.tsv'), LIMIT = Number(arg('limit', 0));
/* --out 带斜杠就按调用者的路径解释，不带才落在本脚本旁边 —— 否则 'docs/.../x.tsv' 会被拼成
 *   docs/artifacts/e287-out/docs/artifacts/e287-out/x.tsv，writeFileSync 直接 ENOENT（第一版就崩在这）。*/
/* §E303：裸文件名落在**本目录**（挪到仓库根之后 ROOT 与 HERE 只差一层，原来那套 join(ROOT) 会写到仓库根去）。*/
const OUTARG = OUT.indexOf('/') >= 0 || OUT.indexOf('\\') >= 0 ? OUT : join(HERE, OUT);
const SH = String(arg('shard', '1/1')).split('/').map(Number);
const FEAS_N = feasPlan(process.env, null);
const G = FEAS_N.games;
const COLS = ['id', 'ok', 'nFail', 'fails', 'G', 'G2', 'wallDmg', 'fieldA', 'fieldBClears',
  'seatVerdict', 'seatSpread', 'zeroAtkRate', 'recOk', 'recFails', 'oppsN'];

/* ---- 名单：直接读坐标表 ⇒ "判了几枚"与"画了几枚"永远是同一批 ---- */
const ct = readFileSync(join(HERE, 'coords.tsv'), 'utf8').trim().split('\n');
const ch = ct[0].split('\t'), ci = ch.indexOf('id');
let list = ct.slice(1).map(l => {
  const id = l.split('\t')[ci];
  return { id: id, path: id === 'SHIPPED-Ldemo' ? 'js/bundled-champion-3p.js' : 'docs/artifacts/' + id + '.bak' };
}).filter(e => existsSync(join(ROOT, e.path)));
const only = String(arg('ids', '')).split(',').map(s => s.trim()).filter(Boolean);
if (only.length) list = list.filter(e => only.indexOf(e.id) >= 0);
if (LIMIT > 0) list = list.slice(0, LIMIT);

const OUTP = /^[A-Za-z]:[\\\/]/.test(OUTARG) || OUTARG.startsWith('/') ? OUTARG : join(ROOT, OUTARG);
const done = new Set(existsSync(OUTP) ? readFileSync(OUTP, 'utf8').trim().split('\n').slice(1).map(l => l.split('\t')[0]) : []);
if (!existsSync(OUTP)) writeFileSync(OUTP, COLS.join('\t') + '\n');
const todo = list.filter((e, i) => i % SH[1] === SH[0] - 1 && !done.has(e.id));
console.log('闸 = feasibilityOf 单一真源 ‖ 样本量 ' + FEAS_N.tag + ' ‖ 分片 ' + SH[0] + '/' + SH[1]);
console.log('名单 ' + list.length + ' 枚（坐标表全量）‖ 本片 ' + todo.length + ' 枚 ‖ 本 out 已量 ' + done.size + ' ⇒ ' + OUT);
if (todo.length === 0 && list.length > 0) {
  console.error('⛔ 待量为 0（名单非空）⇒ 分片/续跑条件把全部筛掉了，这不是"跑完了"。shard=' + SH[0] + '/' + SH[1] + ' 已量=' + done.size);
  process.exit(2);
}

const W = sandbox();
const t0 = Date.now();
todo.forEach((e, i) => {
  const rec = { id: e.id, ok: 'ERR', nFail: '', fails: '', G: '', G2: '', wallDmg: '', fieldA: '', fieldBClears: '',
    seatVerdict: '', seatSpread: '', zeroAtkRate: '', recOk: '', recFails: '', oppsN: '' };
  try {
    const params = loadChamp(W, e.path);
    /* 与 promote-champion 逐字同序同参（顺序不同不影响判定，但同序便于对着读）*/
    const sp = selfPlay(W, params, 'multi', G);
    const spL = selfPlay(W, params, 'long', G);
    const rw = reflectWall(W, params, 'long', G);
    const agg = aggressionProfile(W, params, FEAS_N.aggr);
    const ss = seatSymmetry(W, params, 'multi', FEAS_N.seat);
    const dens = densityProfile(W, params, 'long', FEAS_N.density);
    const chg = chargeProfile(W, params, 'long', FEAS_N.charge);
    const feas = feasibilityOf({ seat: ss, G: sp, G2: spL, G2name: 'long', wall: rw, aggr: agg,
      density: { dmgPerRound: dens.dmgPerRound, jiShare: dens.jiShare, gained: chg.gained, spentRate: chg.spentRate,
        expiredPerGame: chg.games ? chg.expired / chg.games : 0, zeroAtkRate: dens.zeroAtkRate, zeroDealtRate: dens.zeroDealtRate } });
    rec.ok = feas.ok ? 1 : 0; rec.nFail = (feas.fails || []).length;
    rec.fails = String((feas.fails || []).join('；')).replace(/[\t\n]/g, ' ').slice(0, 150);
    rec.G = feas.G; rec.G2 = feas.G2; rec.wallDmg = feas.wallDmg; rec.fieldA = feas.fieldA;
    rec.fieldBClears = feas.fieldBClears; rec.seatVerdict = feas.seatVerdict; rec.seatSpread = feas.seatSpread;
    rec.zeroAtkRate = feas.density && feas.density.zeroAtkRate !== undefined ? feas.density.zeroAtkRate : '';
    /* 与包自己 META 里那份历史记录对账（同一条闸、不同时间跑的 ⇒ 不一致处正是"阈值漂/探针漂"的证据）*/
    const src = readFileSync(join(ROOT, e.path), 'utf8');
    const j = extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P_META', null) || extractJsonObject(src, 'window.EPIRUS_CHAMPION_3P', '_META') ||
      extractJsonObject(src, 'window.EPIRUS_CHAMPION_META', null) || extractJsonObject(src, 'window.EPIRUS_CHAMPION', '_META');
    if (j) { try {
      const m = JSON.parse(j), f = m.feasibility;
      if (f && typeof f.ok === 'boolean') { rec.recOk = f.ok ? 1 : 0; rec.recFails = (f.fails || []).length; }
      rec.oppsN = String((f && f.opps) || m.opps || '').split(',').filter(Boolean).length;
    } catch (x) { /* META 解析失败只影响对账列，不影响判定 */ } }
  } catch (err) {
    rec.fails = 'ERR ' + String(err.message || err).split('\n')[0].slice(0, 100).replace(/[\t\n]/g, ' ');
    if (i < 3 || i % 50 === 0) console.log('  ⚠ ' + e.id + ' 判定失败：' + rec.fails.slice(0, 90));
  }
  appendFileSync(OUTP, COLS.map(c => rec[c] === undefined ? '' : rec[c]).join('\t') + '\n');
  if (i % 25 === 0 || i === todo.length - 1) {
    const el = (Date.now() - t0) / 1000, per = el / (i + 1);
    console.log('  ' + (i + 1) + '/' + todo.length + ' ‖ ' + per.toFixed(2) + 's/枚 ‖ 已用 ' + el.toFixed(0) + 's ‖ 预计还需 ' +
      (per * (todo.length - i - 1) / 60).toFixed(1) + ' 分 ‖ 最新 ' + e.id + ' ok=' + rec.ok + ' G=' + rec.G + ' 场B=' + rec.fieldBClears);
  }
});
console.log('完成 ' + todo.length + ' 枚，用时 ' + ((Date.now() - t0) / 1000).toFixed(0) + 's ⇒ ' + OUTP);
