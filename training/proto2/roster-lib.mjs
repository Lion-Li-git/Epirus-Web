/* roster-lib.mjs — 训练场**对手表**的单一来源（千问 · 11-01）
 *
 * 为什么单独一个文件：`PRODUCT7` 这份名单原先在 `tools/probe-cem-arm.mjs` 与 `tools/proto2/supfit-gd.mjs`
 *   各写一遍，而 `server/opp-pool.mjs` 的头注记着同族三次事故（"加名字漏一处"⇒ 服务端拿到 undefined，
 *   跑到一半才报 `sel is not a function`）。⇒ 名单只在这里写一次，两个工具都 import。
 * `names:` 档（同文件第二形态）是给"对手面实验"用的：`server/opp-pool.mjs` 里**已登记但两个训练池都没在用**
 *   的脚本（targeter / gunspam / snipespam / ringspam / deadlineburst / earlypressure …）可以直接摆进训练桌，
 *   不必每加一枚对手就改一次代码。名字不在册 ⇒ 当场拒（不许静默变成 undefined 席位）。
 * `pack:` 席（ZCode · 11-17 深夜，用户批）：`names:` 表里可摆**真包对手**——`names:MX6-GD-TF15,pack:scratch/arms/X.bak`
 *   也允许 `pack:<在册id>`。动机（11-17 两班汇合）：① FINDING-ring-econ 的"混强包谱"强度训练；
 *   ② purify/贴贴类技能的**状态可达性**（自对局里没人出符咒 ⇒ 被诅咒状态 0 可达 ⇒ 教师演示不了；
 *      MX7-T4-R 这种活咒源包上桌才有状态流）。装包/chooser 与 exam-4n 冠军席**同一条路**：
 *   `loadChamp`（audit-lib 单一来源，2P/3P 壳都认）+ `T.policyChooserN(params, 0.15)`（exam-4n :151 同参）。
 *   ⚠ arena2 纪律不变：整表换池 ⇒ stratified 必关（roster 与 stratified 互斥是 arena2 的硬条款）。
 */
import { OPP_SPECS } from '../server/opp-pool.mjs';
import { makeAsChooser } from '../../tools/bot-chooser-lib.mjs';
import { sandbox, loadChamp } from '../../tools/audit-lib.mjs';
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRODUCT7 = ['random', 'defend', 'antidef', 'wall', 'farmer', 'heavyfire', 'deepsaver'];

/* registry id → 在册路径（懒加载单例；archived 剔除）。读不到 registry 不静默——只在真被用到时报错。 */
let REG_PATHS = null;
function regPath(id) {
  if (!REG_PATHS) {
    REG_PATHS = {};
    try {
      const L = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../champion-map/data/registry.tsv'), 'utf8').replace(/\r\n/g, '\n').split('\n');
      const ix = Object.fromEntries(L[0].split('\t').map((c, i) => [c, i]));
      for (const l of L.slice(1)) { const c = l.split('\t'); if (c[ix.pack_id] && c[ix.path] && c[ix.status] !== 'archived') REG_PATHS[c[ix.pack_id]] = c[ix.path]; }
    } catch (e) { REG_PATHS = {}; }
  }
  return REG_PATHS[id] || '';
}

/* pack: 席构造。item = 在册 id 或文件路径（相对仓库根 / 绝对）。口径 = exam-4n 冠军席（temp 0.15）。 */
function buildPackSeat(W, T, item, tag) {
  const isPath = /[\\/]/.test(item) || /\.(bak|js)$/i.test(item);
  const path = isPath ? item : regPath(item);
  if (!path || (!isAbsolute(path) && !existsSync(join('.', path)) && !existsSync(path))) {
    console.error('⛔ ' + tag + '：pack 对手席「' + item + '」解析不出（' + (isPath ? '文件不存在' : 'registry 无此 id 或已 archived') + '）'); process.exit(2);
  }
  /* 2026-11-19: 跨维度真包席。agent 侧 P 只装当前 arch2 的布局，16411 维的 OBS6P9 直喂会 checkPack 失败
   *   => 这里给每枚 pack 席装**它自己的** arch2 布局（独立沙箱），chooser 用那套参数；
   *   同一维度的包仍然等价，v7/旧壳走下面 loadChamp 原路。 */
  let raw = null;
  try { raw = readPack2(path); } catch (e) { raw = null; }
  if (raw && raw.dims && raw.a) {
    let got;
    try { got = packCfgExit(raw, path); }
    catch (e) {
      const seg = ((raw.layout && raw.layout.seg) || []).find((x) => x.name === 'qHead');
      if (!seg) throw e;
      const d = raw.dims || {};
      got = { cfg: { mutMode: 'seg', seatH: d.seatH, actH: d.actH, hid: d.hid, hid2: d.hid2, input: d.input, inter: d.inter || 0, tinter: d.tinter || 0, gen: 3, keySplit: d.keySplit || 0 }, carried: seg };
    }
    const W2 = sandbox();
    installArch2(W2, Object.assign({ mutMode: 'seg' }, got.cfg));
    const P2 = W2.EpirusPolicy;
    let prm;
    if (got.carried) {
      const a = Float64Array.from(raw.a || []);
      const out = new Float64Array(a.length - got.carried.len);
      out.set(a.subarray(0, got.carried.off), 0);
      out.set(a.subarray(got.carried.off + got.carried.len), got.carried.off);
      prm = out;
    } else prm = P2.unpack(raw, true);
    if (!prm || prm.length !== P2.paramCount()) {
      console.error('⛔ ' + tag + '：pack 席「' + item + '」独立布局参数数不符（' + (prm ? prm.length : 'null') + ' vs ' + P2.paramCount() + '）');
      process.exit(2);
    }
    const nm = 'pack:' + (isPath ? item.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/i, '') : item);
    return { name: nm, kind: 'pack', sel: W2.EpirusTrainer.policyChooserN(prm, 0.15) };
  }
  const params = loadChamp(W, path, '.');
  if (!params) { console.error('⛔ ' + tag + '：pack 对手席读不出参数：' + path); process.exit(2); }
  if (typeof T.policyChooserN !== 'function') { console.error('⛔ ' + tag + '：T.policyChooserN 不存在（训练双子未装？）'); process.exit(2); }
  const name = 'pack:' + (isPath ? item.replace(/^.*[\\/]/, '').replace(/\.(bak|js)$/i, '') : item);
  return { name, kind: 'pack', sel: T.policyChooserN(params, 0.15) };
}

function build(W, T, rows, tag) {
  const asC = makeAsChooser({ T: T, R: W.EpirusRules });
  const out = [];
  for (const nm of rows) {
    if (nm.indexOf('pack:') === 0) { out.push(buildPackSeat(W, T, nm.slice(5), tag)); continue; }
    const x = OPP_SPECS.filter((o) => o.name === nm)[0];
    if (!x) { console.error('⛔ ' + tag + '：对手名不在册（`server/opp-pool.mjs` 的 OPP_SPECS 里没有 "' + nm + '"；可选 ' + OPP_SPECS.map((o) => o.name).join(',') + '，或用 pack:<在册id|路径> 摆真包）'); process.exit(2); }
    const fn = W.EpirusBots[x.fn];
    if (typeof fn !== 'function') { console.error('⛔ ' + tag + '：' + nm + ' 的函数 ' + x.fn + ' 在 EpirusBots 里不存在（核对 server/opp-pool.mjs 与 js/train/bots.js）'); process.exit(2); }
    out.push({ name: nm, kind: 'bot', sel: asC(fn) });
  }
  if (!out.length) { console.error('⛔ ' + tag + '：roster 空'); process.exit(2); }
  return out;
}

/* 产品 7 的**摆桌次序 = OPP_SPECS 的次序**（不是名单的书写次序）：
 *   arena2 的席位轮换是 `ri % roster.length` ⇒ 换了顺序就是换了考场，昨夜 `RB2P-*` 那批配对读数会复现不出来。 */
function buildProduct(W, T, tag) {
  return build(W, T, OPP_SPECS.filter((o) => PRODUCT7.indexOf(o.name) >= 0).map((o) => o.name), tag);
}

/* `--arenaPool` 的三种取值：
 *   `product`          ⇒ 产品 7 脚本（eval-5p CORE 同名单）
 *   `names:a,b,c`      ⇒ 按名字摆任何**已登记**对手（可含产品池没用的 specialist）
 *   空                 ⇒ 不换池（研究卷 buildPoolSeeded 原路，逐字不变）
 * 返回 null 表示"不换"。 */
export function rosterFromArg(W, T, s, tag) {
  const str = String(s || '');
  if (!str) return null;
  if (str === 'product') return buildProduct(W, T, tag);
  const m = /^names:(.+)$/i.exec(str);
  if (m) return build(W, T, m[1].split(',').map((x) => x.trim()).filter(Boolean), tag);
  console.error('⛔ ' + tag + '：--arenaPool 只认 product | names:a,b,c（收到 ' + str + '）');
  process.exit(2);
}

/* 桌形串（`3:multi,5:multi`）⇒ {n,mode} 列表；空串 ⇒ null（沿用 arena2 默认 11 格）。
 * `:rN` 后缀（ZCode · 11-02 夜）= **逐形经济补贴**（该形每回合每席 +N ep；缺省 = arena 级 regen）：
 *   蒸馏采集要穷富混装——穷桌教攒钱/短程，富桌才能演示大雷(5ジ)/激光眼/投资块（11-02 两次冒烟红的修法）。
 * `@W` 后缀 = **仅训练环的逐格权重**（正整数）；评测/冻结菜单仍只含这一格一次。
 *   旧写法重复格会同时改变菜单与每格浓度，11-24 已证无法分离「2P 剂量」和「每格样本数」。 */
export function shapesFromArg(str, tag, dflt) {
  const s = String(str == null || str === '' ? (dflt || '') : str);
  if (!s) return null;
  return s.split(',').map((x) => {
    const m = /^(\d+):([a-z0-9]+)(?::r(\d+))?(?:@([1-9]\d*))?$/i.exec(x.trim());
    if (!m) { console.error('⛔ ' + tag + '：--arenaShapes 只认 n:mode[:rN][@W]（收到 "' + x + '"）'); process.exit(2); }
    return { n: Number(m[1]), mode: m[2], regen: m[3] == null ? null : Number(m[3]), weight: m[4] == null ? 1 : Number(m[4]) };
  });
}
