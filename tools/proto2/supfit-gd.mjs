#!/usr/bin/env node
/* supfit-gd.mjs — A 臂：教师蒸馏的**精确梯度**版（ZCode · 10-31，PREREG-2026-10-31-PG-TRAIN §二A）
 *
 * 与 chain-supfit（CEM 版蒸馏）唯一变量 = 求解器：
 *   数据管线逐字镜像（同随机流/同教师/同 800 组/同 75-25 切/同 lockTarget:false/同 temp=1/同 1-类频加权），
 *   CEM@sig0.08×80代×pop32 → Adam + 反传（tapeBackward，selftest3 六腿先行）。
 * 目标 = 加权键级对数似然（教师给键；键内候选是同一手的珠/目标变体）：
 *   loss = −Σ_gr w(wantKey)·log kProb[wantKey]，u_j = −w·dLogKeyP。
 * 对表基准（scratch/arms/supfit-w1.bak.meta.json）：留出同键 top-1 75.5% ‖ 加权似然 −1.429 ‖ railgun 39/39。
 * ⚑ 读数纪律：lr 只按**训练**似然挑（不偷看留出），挑完的档才报留出。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { sandbox, loadChamp, rejectUnknownFlags, chargeProfile } from '../audit-lib.mjs';   // chargeProfile = 珠账的单一来源（与门 `bead`、mastery 同一量具）
import { install as installArch2, readPack2, packCfgExit } from './arch2.mjs';
import { createArena2 } from './arena2.mjs';
import { layoutOf, tailOf, tapeForward, tapeBackward, dLogKeyP, dLogPi } from './pg-lib.mjs';
import { pickChain, pickKey } from './chain-lib.mjs';
import { scanChargeRounds, GUARD_FAMILY } from './skill-mastery.mjs';   // 预示式代理 + 防席名单的单一来源（千问 §二十三/11-01）
import { rosterFromArg, shapesFromArg } from './roster-lib.mjs';   // 对手表/桌形的单一来源（见该文件头注）

const argv = process.argv.slice(2);
rejectUnknownFlags(argv, ['upstream', 'groups', 'lr', 'steps', 'seed', 'out', 'tag', 'objective', 'dagger', 'defWeight', 'oracleSubset', 'dagtemp', 'pool', 'shapeBal', 'keySplit', 'teacher', 'arenaPool', 'arenaShapes', 'rareOnly', 'rareFrac', 'labelKindsMin', 'labelSupportMin', 'smoke', 'regen'], 'supfit-gd');
const arg = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const UP = String(arg('upstream', 'scratch/arms/OB3S-C2-s7.bak'));
const NGRP = Math.max(60, Number(arg('groups', 800)) || 800);
const LR = Number(arg('lr', 0.02)) || 0.02;
const STEPS = Math.max(10, Number(arg('steps', 400)) || 400);
const SEED = Number(arg('seed', 20261031)) || 20261031;
const OUT = String(arg('out', 'scratch/arms/supfit-gd1.bak'));
const TAG = String(arg('tag', ''));
/* ⚑ 目标层级（千问 · 10-31 午后补，A 臂读数的另一半）：
 *   `key`（默认 = ZCode 的 A 臂，逐字不变）= 键级似然 `log P(key)`。两级 softmax 的键层取 `bestOf`
 *     （键内最大 logit）⇒ 梯度只碰"当前键内赢的那一枚"，**从不表态该赢哪一枚**。而 `policy.js:680`
 *     给「蓄能」两枚同键候选（bead=elec/boom），电珠才是电磁炮的门票（`state.js` RAILGUN 需 p.elec≥1，
 *     珠只活一回合 resolve.js:1296）⇒ 键级蒸馏可以 100% 学会"该等"，却把珠蓄成爆珠（实测 gd1：电 51 / 爆 576）。
 *   `cand` = 候选级似然 `log π(教师那一枚)`（dLogPi，selftest3 腿 C 已数值对账）⇒ 珠种/目标都在标签里。 */
const OBJ = String(arg('objective', 'key'));
if (OBJ !== 'key' && OBJ !== 'cand') { console.error('⛔ --objective 只认 key|cand（收到 ' + OBJ + '）'); process.exit(2); }
/* DAgger（§十三 边界②的正解）：轮数默认 0 ⇒ 只有教师自访，路径与 A 臂逐字同 */
const DAG = Math.max(0, Math.min(6, Number(arg('dagger', 0)) || 0));
const DAG_TEMP = Number(arg('dagtemp', 0.15));
const POOL = Math.max(NGRP, Number(arg('pool', 1200)) || 1200);
/* `--shapeBal=1`：把采集配额**摊到全部桌形**（默认 0 = 现役顺序档：够 NGRP 就停 ⇒ 800 组只落在前 2 个桌形里，
 *   这是 10-31 夜里查出来的采集覆盖洞：考场 11 个桌形、采集只见 2 个）。 */
const SHAPEBAL = Number(arg('shapeBal', 0)) ? 1 : 0;
/* `--keySplit=1`：把上游按**代 3**（v:92，键层按决策键分组）装载并出货 ⇒ 用来直接检验 Stage A：
 *   同一个**键级**目标，旧口径下珠种靠起点抽签、新口径下珠种进入键层。参数量不变（DK 只改分组）。 */
const KS = Number(arg('keySplit', 0)) ? 1 : 0;   /* 训练池上限（教师 600 永远保留，学生态按新旧裁） */

const W0 = sandbox();
const refParams = Float64Array.from(loadChamp(W0, 'js/bundled-champion-3p.js', ''));
const raw = readPack2(UP);
/* ⚑ 跨代搬运（Stage B 之后唯一的一条搬运路）：代 2 的容器段表里带 `qHead`（33 个没有任何目标函数读的参数），
 *   而代 3 的尺只认代 3 ⇒ `packCfgExit` 的代闸会把旧包**响亮拒读**（那正是它的作用，不是障碍）。
 *   所以要吃旧包就必须把"我在重解释"写在明面上：cfg 从 dims 手拼 + 参数数组砍掉 qHead 那一段。
 *   砍掉它不改变策略算出的任何一手 —— 这条不是嘴上说的，验收见 §二十（前后 7993 个参数逐位同）。 */
const srcSegQ = ((raw.layout && raw.layout.seg) || []).find((x) => x.name === 'qHead');
const srcDims = raw.dims || {};
const got = srcSegQ
  ? { cfg: { mutMode: 'seg', seatH: srcDims.seatH, actH: srcDims.actH, hid: srcDims.hid, hid2: srcDims.hid2,
             input: srcDims.input, inter: srcDims.inter || 0, tinter: srcDims.tinter || 0, gen: 3, keySplit: KS },
      gen: 3, era: '代 ' + (srcDims.gen || '?') + ' → 代 3（显式砍 qHead ' + srcSegQ.len + ' 个参数）', carried: srcSegQ }
  : packCfgExit(raw, UP);
const W = sandbox();
installArch2(W, Object.assign({ mutMode: 'seg' }, got.cfg, (KS ? { gen: 3, keySplit: 1 } : {})));
const P = W.EpirusPolicy, T = W.EpirusTrainer, S = W.EpirusState, R = W.EpirusRules;
const up = (() => {
  if (got.carried) {
    console.log('  ⚑ 跨代搬运：从源容器去掉 qHead 段 [' + got.carried.off + ',' + (got.carried.off + got.carried.len) + ') 共 ' + got.carried.len + ' 个参数（代 3 无价值头）');
    const a = Float64Array.from(raw.a || []);
    const t = new Float64Array(a.length - got.carried.len);
    t.set(a.subarray(0, got.carried.off), 0);
    t.set(a.subarray(got.carried.off + got.carried.len), got.carried.off);
    return t;
  }
  return P.unpack(raw, true);
})();
if (!up || up.length !== P.paramCount()) { console.error('⛔ 上游读不出/参数数不符：' + UP + '（' + (up ? up.length : 'null') + ' vs ' + P.paramCount() + '）'); process.exit(2); }
const ly = layoutOf(P);
if (ly.L.tinterK > 0 || ly.L.interK > 0) { console.error('⛔ interK/tinterK>0 ⇒ pg-lib 拒跑'); process.exit(2); }
/* `--arenaPool`（千问 · 11-01 收敛到 `roster-lib` 单源）：`product` = 产品 7 脚本；`names:a,b,…` = 摆已登记的
 *   任意对手（含两个训练池都没在用的 specialist）；空 = 研究卷 mild 分层原路。搬了池就**不分层**（产品卷同形）。 */
const A2_POOL_ARG = String(arg('arenaPool', ''));
const A2_ROSTER = rosterFromArg(W, T, A2_POOL_ARG, 'supfit-gd');
const A2_SHAPES = shapesFromArg(arg('arenaShapes', A2_POOL_ARG ? '3:multi,5:multi' : ''), 'supfit-gd');
const A2 = createArena2(W, { refParams, temp: 0.15, highN: 1, stratified: !A2_ROSTER, stratCap: A2_ROSTER ? undefined : 2, stratMix: A2_ROSTER ? undefined : 0.5, roster: A2_ROSTER || undefined, shapes: A2_SHAPES || undefined, regen: Number(arg('regen', 0)) || 0 });

/* ---- 收集：与 chain-supfit 逐字同流（seed 20261030 LCG、同 salt/局号、同教师、同克隆）----
 * ⚑ `--dagger=R`（默认 0）：round 0 = 教师自访（= A 臂原样，局号 300000+/盐 4242）；
 *   之后每轮换**学生自己走出来的状态**再标一次教师（`--dagTemp` 部署温度）⇒ 正面治 §十三 边界②"协变量漂移"。
 *   默认路径（R=0）不碰任何一局学生自访、不改变 RNG 消耗次序 ⇒ 产物必须与 `supfit-gd1.bak` 逐位同（这条是回归腿）。 */
let seed = 20261030;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
/* `--teacher=v7mix`（ZCode · 10-31 晚，产品卷反差的一号修法）：链覆写（pickChain 优先）+ **其余全交 v7 价值 argmax**。
 *   为什么：产品考卷（eval-5p 420 局）实测纯链教师的学生"出手种类=3"（ジ/蓄/炮）、含深经济对手 Δ=−19.2pt ——
 *   忠实的攒够链模仿物是**桶专家**不是全能冠军；教师里只会弃权（ji）的那一格，学生原样学成"除了链什么都不做"。
 *   v7 读数走 fit2 的同款入口 `P.value(state,pid,key,params,sh,cand)`（形参次序有在册勘误，别动）。
 *   默认 `chain` 逐字不变（回归腿：`--teacher=chain` 产物与已登记 md5 对表）。 */
const TEACHER = String(arg('teacher', 'chain'));
/* `--teacher=toolkit`（ZCode · 10-31 深夜，用户点名的主线）：教师 = **杂货铺脚本本体**（`EpirusBots.pickToolKit`，
 *   全能地板 + 计划层 P0~P7：聚能环 3 珠链 / 避雷针 / 大雷三层选靶 / 贴贴渐进 / 过载炮 phase / 断环）。
 *   用户原话：v7 当年"克隆杂货铺之后训练"出了很会聚能环+大雷的包——问的是新网络能不能学得**更充分**、别的技能也会用。
 *   与 chain/v7mix 的本质区别：这是**每手都有标签的多技能教师**（不是只会弃权的单链），广度来自地板（pickMix 系）。
 *   key→候选映射：蓄能两枚珠种里**优先电珠**（链线教训：电珠是炮与避雷针的门票；键层 keySplit 已把珠种抬进键层）。
 *   ⚑ pickToolKit 读 `state.events`（"这局用过什么"）——cloneState 是 JSON 往返、events 在 ⇒ 克隆态重标不漂。 */
const keyToCand = (cs, key) => {
  if (!key) return null;
  const hit = cs.filter((c) => c.key === key);
  if (!hit.length) return null;
  if (key === R.SK.CHARGE) { const e = hit.find((c) => (c.bead || '') === 'elec'); if (e) return e; }
  return hit[0];
};

/* miniT 预示式教师（换道后的小雷路线，ZCode · 11-01 深夜）：对 [ep≥2 ∧ 最近 4 回合内 ok 蓄过珠] 的席出小雷
 *   （判据=千问 §二十三 的新代理，precision→railgun 87.99%×7.62）；无这样的席 ⇒ 回落链（保强底盘）。
 *   回合计数与打分尺同源（scanChargeRounds，newturn 进格）。 */
const miniTPick = (state, pid, cs) => {
  const chargeRound = {};
  for (const z of scanChargeRounds(state.events || [], R)) chargeRound[z.pid] = z.round;
  const now = state.round || 1;
  let best = null, bestEp = -1;
  for (let i = 0; i < (state.p || []).length; i++) {
    const o = state.p[i];
    if (!o || i === pid || (o.hp || 0) <= 0) continue;
    if ((o.ep || 0) < 2) continue;
    const cr = chargeRound[i];
    if (cr == null) continue;
    const gap = now - cr;
    if (!(gap >= 0 && gap <= 4)) continue;
    if ((o.ep || 0) > bestEp) { bestEp = o.ep; best = i; }
  }
  if (best == null) return null;
  const hit = cs.filter((c) => c.key === R.SK.MINI_T && c.target === best);
  return hit.length ? hit[0] : null;
};
/* 全能教师（千问 · 11-01，波次 4 之后）：把 §一/§七 量出来的三道门一次打开——
 *   环 = 经济底座（把收入抬过 ep≥5 ⇒ 大雷才进菜单）‖ 电珠链 = 兑现电磁炮 ‖ 爆珠 = 激光眼的门票。
 * 优先级：破防 > 兑现电珠 > 落雷 > 开环 > 补珠（缺哪颗补哪颗，两颗都有就补电珠当链底盘）> 弃权。
 * ⚠ 这不是"把四个技能都写进规则"：每条都只是**该技能的门 + 桶线的定义**，行为仍要靠网络自己学出来。 */
const allRoundPick = (state, pid, cs) => {
  const me = state.p[pid] || {};
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser) return laser;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec'); if (rg) return rg;
  const bt = pickKey(cs, R.SK.BIG_T); if (bt) return bt;
  const ring = pickKey(cs, R.SK.RING); if (ring) return ring;
  if (!(me.boom > 0)) { const cb = pickKey(cs, R.SK.CHARGE, 'boom'); if (cb) return cb; }
  if (!(me.elec > 0)) { const ce = pickKey(cs, R.SK.CHARGE, 'elec'); if (ce) return ce; }
  return pickKey(cs, R.SK.CHARGE, 'elec');
};

/* 环+链双兑现教师（千问 · 11-01，接 §九 的机制读数）：落雷 > 开环 > 链底盘（`pickChain`，它自带『无珠且 ep≥3 才蓄』的经济规则）。
 * 动机：`ring` 教师（环优先）拿到环 ✔ + 大雷 ✔ 但 5P 只有 15.7（收入全喂环、不兑现）；
 * `chain` 教师（兑现优先）拿到 5P 43.6~64 但大雷 0（每拍先花电珠 ⇒ ep 攒不到 5）。这一档是把两者串在一条
 * 去向上：**能兑现就兑现，兑现不了才开环** ⇒ 问的是『收入去向』能不能同时给出桶线与强度。 */
const ringChainPick = (state, pid, cs) => pickKey(cs, R.SK.BIG_T) || pickKey(cs, R.SK.RING) || pickChain(state, pid, cs, R);
/* 定量配给的混合教师（千问 · 11-01，用户 11-01：『用一堆大雷本来就没有什么用处，我给大雷要求才 0.2，
 *   你剩下的资源不就可以拿去分配给电磁炮等等了吗』+『不能纯靠单一教师』）。
 * 形状：每条贵线**只用到桶线下限的若干倍**，超了就把它的地盘还给兑现链——剂量上限住在教师里，
 *   这样标签本身就在教『分配』，而不是教『某条线打到满』。
 * ⚑ 与 §十 的三档单线教师（ring / ringchain / bigt）的区别：那三档各自收敛到一条线且 5P 全在 15~16，
 *   说明问题不是顺序而是**剂量**。计数器读 state.events（与 scanChargeRounds 同一口径：ok 才算一次）。 */
const RATION = { bigT: 1, laserEye: 1, ring: 1 };
const castCount = (state, pid, key) => {
  let n = 0;
  for (const e of (state.events || [])) if (e.type === 'action' && e.outcome === 'ok' && e.pid === pid && e.key === key) n++;
  return n;
};
const rationPick = (state, pid, cs) => {
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser && castCount(state, pid, R.SK.LASER_EYE) < RATION.laserEye) return laser;
  const bt = pickKey(cs, R.SK.BIG_T);
  if (bt && castCount(state, pid, R.SK.BIG_T) < RATION.bigT) return bt;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.RAILGUN);
  if (rg) return rg;
  const me = state.p[pid] || {};
  const ring = pickKey(cs, R.SK.RING);
  if (ring && (me.ringStreak > 0 || castCount(state, pid, R.SK.RING) < RATION.ring)) return ring;
  return pickChain(state, pid, cs, R);
};
/* DS 11-02 晚（用户「克隆旧包做起点」）：`--teacher=pack:<path>` —— 把任意 **v7 包**当教师。
 *   机制与 `toolkit` 同：v7 chooser 出键 → `keyToCand` 映射回候选（珠种按 keyToCand 的规则）。
 *   arch2 的 choose/forward 有长度守卫（5689 ≠ 2.0 的 L.n ⇒ 交回 v7 实现）⇒ 在 2.0 进程里安全。 */
const PACK_TEACHER = TEACHER.indexOf('pack:') === 0 ? TEACHER.slice(5) : null;
let packPick = null;
if (PACK_TEACHER) {
  const ptParams = Float64Array.from(loadChamp(W0, PACK_TEACHER, '.'));
  const ptChooser = T.policyChooserN(ptParams, 0.15);
  packPick = (state, pid, cs) => {
    /* ⚠ 传 `cs` 给 chooser 会全落 ji：v7 chooser 要的是**合法键表**（entry.affordable），而 cs 是候选（带 target/bead）。 */
    const legal = cs.map((c) => ({ key: c.key, affordable: c.affordable !== false }));
    const got = ptChooser(state, pid, legal);
    return keyToCand(cs, got && (got.key || got)) || null;
  };
}
const v7Pick = (state, pid, cs) => {
  let bi = -1, bv = -Infinity;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const v = P.value(state, pid, c.key, refParams, null, c);
    if (Number.isFinite(v) && v > bv) { bv = v; bi = i; }
  }
  return bi >= 0 ? cs[bi] : null;
};
/* 桶线重训教师（千问 · 11-01，用户裁"大雷/激光眼在新网络上重训，不死守旧包"）：
 *   `bigt` = chain-lib `saveBigT` 的口径（够 5 就落雷；⚑ 只在**环已连着⇒续环免费**时白捡环，绝不开新环——
 *            上一版让它在 ep≥3 开环，每局把ジ喂给环 9.9 次、一次都攒不到 5，那是脚本的经济错误不是引擎没窗口）。
 *   `lasereye` = 有激光眼就打"上一手是防御族"的席（桶线语义=破防），否则回落链。 */
const bigTPick = (state, pid, cs) => keyToCand(cs, R.SK.BIG_T)
  || (state.p[pid] && state.p[pid].ringStreak > 0 ? keyToCand(cs, R.SK.RING) : null);
const laserPick = (state, pid, cs) => {
  /* 激光眼的门是**手里有爆珠**（play.js:50：电磁炮需电珠 / 激光眼需爆珠）⇒ 没爆珠的这一拍就攒爆珠。
   * ⭐ 这正是 Stage A（keySplit）要的那一格：`charge#boom` 在代 3 是独立决策键，旧口径下它是"键内自由度"，
   *    任何键级目标都看不见它 ⇒ 现役包的蓄珠 100% 电珠、爆珠 0 ⇒ 激光眼**从来没进过菜单**。
   * ⚑ v2（11-01，读完 v1 的起点分母之后）：**没人防御就不放**（v1 是 hits[0] 兜底 ⇒ 10.8 次/局但只有 28% 打防席，
   *    桶线要 ≥1/2 ⇒ 教师的行为必须等于桶线的定义，而不是只等于"有牌就打"）。 */
  const hits = cs.filter((c) => c.key === R.SK.LASER_EYE);
  const guard = hits.find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (guard) return guard;
  return pickKey(cs, R.SK.CHARGE, 'boom');
};
/* 长程×短程权衡教师（ZCode · 11-01，PREREG-2026-11-01-LONGSHORT）：ration 的长程配给骨架原样保留，
 *   在链兜底之前插两格**短程剂量**（剑 2/局、枪 3/局，目标=血最低活敌）。贵线有上限、短程有配额、
 *   链把剩余地盘拿去攒珠——\"分配\"住在标签里（与 ration 同一哲学，多两格便宜输出）。 */
const SHORT_DOSE = { sword: 2, gun: 3 };
const lowestHpEnemy = (state, pid, cs, key) => {
  let best = null;
  for (const c of cs) {
    if (!c || c.key !== key) continue;
    const o = state.p[c.target];
    if (!o || o.hp <= 0) continue;
    if (!best || o.hp < state.p[best.target].hp) best = c;
  }
  return best;
};
const ration2Pick = (state, pid, cs) => {
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser && castCount(state, pid, R.SK.LASER_EYE) < RATION.laserEye) return laser;
  const bt = pickKey(cs, R.SK.BIG_T);
  if (bt && castCount(state, pid, R.SK.BIG_T) < RATION.bigT) return bt;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.RAILGUN);
  if (rg) return rg;
  const me = state.p[pid] || {};
  const ring = pickKey(cs, R.SK.RING);
  if (ring && (me.ringStreak > 0 || castCount(state, pid, R.SK.RING) < RATION.ring)) return ring;
  const sw = lowestHpEnemy(state, pid, cs, R.SK.SWORD);
  if (sw && castCount(state, pid, R.SK.SWORD) < SHORT_DOSE.sword) return sw;
  const gn = lowestHpEnemy(state, pid, cs, R.SK.GUN);
  if (gn && castCount(state, pid, R.SK.GUN) < SHORT_DOSE.gun) return gn;
  return pickChain(state, pid, cs, R);
};
/* 经济前提门（千问 · 11-01，PREREG-2026-11-01-ECON-LOCK §一）：ration2 的骨架逐字保留，只给短程两格加一条前提——
 *   剑/枪 **仅当 (ep≥3) ∨ (手里已有珠)** 才允许，否则先走链兜底（蓄能/环）。
 *   病因是 §十九 量到的那一格标签："ep=1 且有活敌"这个最常见状态上 ration2 教的是枪而不是蓄能 ⇒ 包养不起自己
 *   （镜像桌蓄能被选 0/1494 ⇒ 电珠恒 0 ⇒ 电磁炮连菜单都进不了）。唯一变量=这条前提。 */
const canAffordLater = (state, pid) => {
  const me = state.p[pid] || {};
  return me.ep >= 3 || (me.elec || 0) > 0 || (me.boom || 0) > 0;
};
const ration3Pick = (state, pid, cs) => {
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser && castCount(state, pid, R.SK.LASER_EYE) < RATION.laserEye) return laser;
  const bt = pickKey(cs, R.SK.BIG_T);
  if (bt && castCount(state, pid, R.SK.BIG_T) < RATION.bigT) return bt;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.RAILGUN);
  if (rg) return rg;
  const me = state.p[pid] || {};
  const ring = pickKey(cs, R.SK.RING);
  if (ring && (me.ringStreak > 0 || castCount(state, pid, R.SK.RING) < RATION.ring)) return ring;
  if (canAffordLater(state, pid)) {
    const sw = lowestHpEnemy(state, pid, cs, R.SK.SWORD);
    if (sw && castCount(state, pid, R.SK.SWORD) < SHORT_DOSE.sword) return sw;
    const gn = lowestHpEnemy(state, pid, cs, R.SK.GUN);
    if (gn && castCount(state, pid, R.SK.GUN) < SHORT_DOSE.gun) return gn;
  }
  return pickChain(state, pid, cs, R);
};
/* ration4（千问 · 11-01，PREREG-2026-11-01-ECON-LOCK §五）：ration3 治好 ep 自锁（环 82.3% 给了就选、ep 铺到 13）
 *   但珠自锁原样在（蓄能进菜单 1345 次、被选 0 ⇒ 电珠恒 0 ⇒ 电磁炮进菜单 0）。
 *   病因在**教师自己的次序**：`chain-lib.mjs:20-24` 的 `pickChain` 只在 `!hasElec ∧ ep≥3` 才出蓄能，
 *   而 ration3 把环排在链兜底之前 ⇒ 只要环还够钱/还挂着 streak，那一格永远轮不到 ⇒ 蓄能标签饿死（留出只有 12 个样本）。
 *   唯一变量 = 把蓄能提到环**之前**并放宽它自己的前提（`!有珠 ∧ ep≥2`）。 */
const ration4Pick = (state, pid, cs) => {
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser && castCount(state, pid, R.SK.LASER_EYE) < RATION.laserEye) return laser;
  const bt = pickKey(cs, R.SK.BIG_T);
  if (bt && castCount(state, pid, R.SK.BIG_T) < RATION.bigT) return bt;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.RAILGUN);
  if (rg) return rg;
  const me = state.p[pid] || {};
  const hasBead = ((me.elec || 0) > 0) || ((me.boom || 0) > 0);
  if (!hasBead && me.ep >= 2) { const ch = pickKey(cs, R.SK.CHARGE, 'elec') || pickKey(cs, R.SK.CHARGE); if (ch) return ch; }
  const ring = pickKey(cs, R.SK.RING);
  if (ring && (me.ringStreak > 0 || castCount(state, pid, R.SK.RING) < RATION.ring)) return ring;
  if (canAffordLater(state, pid)) {
    const sw = lowestHpEnemy(state, pid, cs, R.SK.SWORD);
    if (sw && castCount(state, pid, R.SK.SWORD) < SHORT_DOSE.sword) return sw;
    const gn = lowestHpEnemy(state, pid, cs, R.SK.GUN);
    if (gn && castCount(state, pid, R.SK.GUN) < SHORT_DOSE.gun) return gn;
  }
  return pickChain(state, pid, cs, R);
};
/* ration5（千问 · 11-01，PREREG-2026-11-01-ECON-LOCK §七）：ration4 治好了珠锁，锁跳到第三格
 *   （"有珠"与"ep≥3"从没同时成立 ⇒ 电磁炮仍进不了菜单，虽然反事实给钱后它 1157/1157 全开）。
 *   唯一差别 = 显式教一格**攥着等**：`有珠 ∧ ep<3 ⇒ 只 ジ`。
 *   这一档是 §三 分叉② 的最便宜判别——标签能治 = 病在次序；标签治不了 = 病在表征（每决策贪心 softmax 表达不了跨拍收益）。 */
const ration5Pick = (state, pid, cs) => {
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser && castCount(state, pid, R.SK.LASER_EYE) < RATION.laserEye) return laser;
  const bt = pickKey(cs, R.SK.BIG_T);
  if (bt && castCount(state, pid, R.SK.BIG_T) < RATION.bigT) return bt;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.RAILGUN);
  if (rg) return rg;
  const me = state.p[pid] || {};
  const hasBead = ((me.elec || 0) > 0) || ((me.boom || 0) > 0);
  if (hasBead && me.ep < 3) return cs.find((c) => c.key === R.SK.JI) || null;
  if (!hasBead && me.ep >= 2) { const ch = pickKey(cs, R.SK.CHARGE, 'elec') || pickKey(cs, R.SK.CHARGE); if (ch) return ch; }
  const ring = pickKey(cs, R.SK.RING);
  if (ring && (me.ringStreak > 0 || castCount(state, pid, R.SK.RING) < RATION.ring)) return ring;
  if (canAffordLater(state, pid)) {
    const sw = lowestHpEnemy(state, pid, cs, R.SK.SWORD);
    if (sw && castCount(state, pid, R.SK.SWORD) < SHORT_DOSE.sword) return sw;
    const gn = lowestHpEnemy(state, pid, cs, R.SK.GUN);
    if (gn && castCount(state, pid, R.SK.GUN) < SHORT_DOSE.gun) return gn;
  }
  return pickChain(state, pid, cs, R);
};
/* ===== ration6（ZCode · 11-02 夜，NIGHT3 Phase 3）：ration5 完全体 = 长程骨架 + 珠锁两格 + 批2 连招块 + 批3 防御块 =====
 * 语义全部按 11-01 深夜用户纠正后的口径核过（每格的引擎出处）：
 *   藤甲 = **双面**（resolve.js:1152：目标吃 fireWeakNow+Next，同时施放者自己进 guardSet 反弹族）；
 *   摄魂 = **自保回血**（用户裁：不是终结技。引擎门 = 目标 HP≤drainHpMax，教师门再加"自身缺血"）；
 *   全息 = 给**被作用者**套一回合原型制御（README 理想形态）。FFA 桌上的用法 = "均势盾"：
 *   保住将被强敌终结的最弱席（队伍模式里同一动作 = 给队友送盾——语义同源，注释留档）；
 *   挑衅→转移/制御 = 挑衅者知道"谁欠我一刀"（resolve.js:1135 `you.tauntByPending.push(i)` ⇒ 目标.tauntBy += 施放者）。
 * 干预全关协议：本教师供 GD3-ALL 训练 ⇒ 训练侧四键必须 0；教师标签不依赖任何引擎注入。
 * 剂量：DOSE6 每格每局上限（连招/功能卡全部窄剂量，让配给骨架管经济、门管语义）。 */
const DOSE6 = { firestorm: 1, curse: 2, armor: 2, taunt: 1, transfer: 1, proto: 1, mine: 1, rod: 1, holo: 1, cannon: 2, railgun: 8, charge: 2 };
/* ⚑ 珠经济流（04:5x 第三修）：炮配额 3→6（珠的主花口）、持珠只在 ep<2 才攥（ep≥2 有珠就该打炮）、
 *   蓄能 4/局配额——"蓄→花"要成环，否则持珠态的 JI 标签就是囤积签名（四发产物花珠全 0 的病根）。 */
/* ⚑ railgun 也要配额：富桌（:r2）上无配额的炮会单线吃满标签（11-02 shake3 实测 103/240），
 *   后面的收割/投资块全部饿死。配额超了就让位——"分配"住在教师里，与 ration 的哲学同一族。 */
const highestHpEnemy = (state, pid, cs, key) => {
  let best = null;
  for (const c of cs) {
    if (!c || c.key !== key) continue;
    const o = state.p[c.target];
    if (!o || o.hp <= 0) continue;
    if (!best || o.hp > state.p[best.target].hp) best = c;
  }
  return best;
};
const myStickersOn = (state, pid) => {   /* 我贴出去、还挂着的符咒数（resolve.js:1088 sticker={owner,age}） */
  let n = 0;
  for (const q of state.p) {
    if (!q || q.hp <= 0) continue;
    for (const s of (q.stickers || [])) if (s.owner === pid) n++;
  }
  return n;
};
const ration6Pick = (state, pid, cs) => {
  const me = state.p[pid] || {};
  /* —— 长程骨架（ration5 原样：激光眼防席门 → 大雷配给 → 电磁炮 → 攥着等 → 蓄能）—— */
  const laser = cs.filter((c) => c.key === R.SK.LASER_EYE)
    .find((x) => { const o = state.p[x.target]; return o && GUARD_FAMILY.indexOf(o.lastSkill) >= 0; });
  if (laser && castCount(state, pid, R.SK.LASER_EYE) < RATION.laserEye) return laser;
  const bt = pickKey(cs, R.SK.BIG_T);
  if (bt && castCount(state, pid, R.SK.BIG_T) < RATION.bigT) return bt;
  const rg = pickKey(cs, R.SK.RAILGUN, 'elec') || pickKey(cs, R.SK.RAILGUN);
  if (rg && castCount(state, pid, R.SK.RAILGUN) < DOSE6.railgun) return rg;
  const hasBead = ((me.elec || 0) > 0) || ((me.boom || 0) > 0);
  if (hasBead && me.ep < 2) return cs.find((c) => c.key === R.SK.JI) || null;   /* ep<2 攥到能打炮；ep≥2 有珠 = 炮的 */
  /* 蓄能天花板+配额（03:4x/04:5x）：ep≤4 且 ≤4 次/局才教蓄——无限蓄能标签把产物教成"只攒不花" */
  if (!hasBead && me.ep >= 2 && me.ep <= 4 && castCount(state, pid, R.SK.CHARGE) < DOSE6.charge) { const ch = pickKey(cs, R.SK.CHARGE, 'elec') || pickKey(cs, R.SK.CHARGE); if (ch) return ch; }
  /* —— 收割块（时敏：转化**已有**投资，过期作废 ⇒ 保持在前；都是窄门，不破蓄钱阶梯）——
   * ① 天火：引爆自己贴的符咒（符咒停留 ≤3 回合，过期白贴）；
   * ② 坦克集火：目标已被藤甲贴（fireWeakNow）⇒ 火伤+1 穿防转移不走；
   * ③ 挑衅回收：有人欠我一刀（我挑衅过还没打回）⇒ 转移给血最高第三者，转移没货就原型制御全挡；
   * ④ 全息（均势盾/队友盾）：将死之席（hp≤1）且**别的敌人**上一手正打它 ⇒ 送盾否认终结
   *    （队伍模式 = 给队友送盾；README 理想形态同一张卡，目标选择差在桌制）。 */
  const fsm = pickKey(cs, R.SK.FIRESTORM);
  if (fsm && myStickersOn(state, pid) >= 1 && castCount(state, pid, R.SK.FIRESTORM) < DOSE6.firestorm) return fsm;
  const tkWeak = cs.find((c) => c.key === R.SK.TANK && state.p[c.target] && state.p[c.target].fireWeakNow);
  if (tkWeak) return tkWeak;
  const owes = state.p.some((q) => q && q.hp > 0 && (q.tauntBy || []).indexOf(pid) >= 0);
  if (owes) {
    const tr = highestHpEnemy(state, pid, cs, R.SK.TRANSFER);
    if (tr && castCount(state, pid, R.SK.TRANSFER) < DOSE6.transfer) return tr;
    const pr = pickKey(cs, R.SK.PROTO);
    if (pr && castCount(state, pid, R.SK.PROTO) < DOSE6.proto) return pr;
  }
  const finishingOn = (t) => state.p.some((q) => q && q.hp > 0 && q.id !== t.id &&
    q.lastTarget === t.id && q.lastSkill && R.byKey[q.lastSkill] && R.byKey[q.lastSkill].cat === 'attack');
  const holo = (castCount(state, pid, R.SK.HOLO) < DOSE6.holo)
    ? cs.find((c) => c && c.key === R.SK.HOLO && state.p[c.target] &&
        state.p[c.target].hp <= 1 && finishingOn(state.p[c.target]))
    : null;
  if (holo) return holo;
  /* —— 环 + 短程（ration 骨架尾）—— */
  const ring = pickKey(cs, R.SK.RING);
  if (ring && (me.ringStreak > 0 || castCount(state, pid, R.SK.RING) < RATION.ring)) return ring;
  /* ⚑ 穷桌攻击地板（03:3x，M-3 翻案修法）：枪 2/局**不挂经济门**——节俭不能节成僵局
   *   （03:1x 全镜像实验证明：canAffordLater 全门控 ⇒ 教师穷镜像零攻击输出 ⇒ 产物镜像决胜 0%；
   *    gun 是 1ジ 的最便宜输出，配 2 发地板既保攻击样本又不破"ep≥3 才谈剑/投资"的蓄钱阶梯）。 */
  const gnFloor = lowestHpEnemy(state, pid, cs, R.SK.GUN);
  if (gnFloor && castCount(state, pid, R.SK.GUN) < 2) return gnFloor;
  if (canAffordLater(state, pid)) {
    const sw = lowestHpEnemy(state, pid, cs, R.SK.SWORD);
    if (sw && castCount(state, pid, R.SK.SWORD) < SHORT_DOSE.sword) return sw;
    const gn = lowestHpEnemy(state, pid, cs, R.SK.GUN);
    if (gn && castCount(state, pid, R.SK.GUN) < SHORT_DOSE.gun) return gn;
  }
  /* —— 投资块（批2/批3 新开投资：全部挂 canAffordLater 经济门——穷拍一律攒钱，
   *    这是 11-02 00:5x 全量冒烟红的修法：v1 把这些插在环之前，1ジ 收入每一拍被花光 ⇒
   *    大雷/电磁炮的蓄钱窗口永不出现（2400 组开火线标签=0、珠浪费 100%）。 —— */
  if (canAffordLater(state, pid)) {
    const cu = pickKey(cs, R.SK.CURSE);                                        /* 给天火备弹 */
    if (cu && castCount(state, pid, R.SK.CURSE) < DOSE6.curse) return cu;
    const ar = highestHpEnemy(state, pid, cs, R.SK.ARMOR);                     /* 贴最大威胁：自得反弹 + 目标火弱 */
    if (ar && castCount(state, pid, R.SK.ARMOR) < DOSE6.armor) return ar;
    const tn = highestHpEnemy(state, pid, cs, R.SK.TAUNT);                     /* 连招前半：挂必打义务 */
    if (tn && castCount(state, pid, R.SK.TAUNT) < DOSE6.taunt) return tn;
    const mn = pickKey(cs, R.SK.MINE);
    if (mn && castCount(state, pid, R.SK.MINE) < DOSE6.mine) return mn;
    const rodThreat = state.p.some((q) => q && q.hp > 0 && (q.ep || 0) >= 5);  /* 桌上有买得起大雷的敌人 */
    const rd = pickKey(cs, R.SK.ROD);
    if (rd && rodThreat && castCount(state, pid, R.SK.ROD) < DOSE6.rod) return rd;
    const cn = cs.find((c) => c.key === R.SK.CANNON && state.p[c.target] && state.p[c.target].lastSkill === R.SK.REFLECT);
    if (cn && castCount(state, pid, R.SK.CANNON) < DOSE6.cannon) return cn;    /* 炮穿防穿反弹（激光眼管其余防席） */
  }
  /* —— 防御系保底（横切，用户裁"防御类不能完全没有"）：缺血就挡一手；
   *      穷拍豁口 = hp≤1 的绝望挡（保命优先于攒钱），其余照经济门。 —— */
  if (me.hp < ((state.mode && state.mode.hp) || 3) && castCount(state, pid, R.SK.PROTO) < DOSE6.proto &&
      (me.hp <= 1 || canAffordLater(state, pid))) {
    const pr2 = pickKey(cs, R.SK.PROTO);
    if (pr2) return pr2;
  }
  return pickChain(state, pid, cs, R);
};
const teacherPick = PACK_TEACHER
  ? (state, pid, cs) => packPick(state, pid, cs) || pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'v7mix'
  ? (state, pid, cs) => pickChain(state, pid, cs, R) || v7Pick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'toolkit'
    ? (state, pid, cs, legal) => keyToCand(cs, W.EpirusBots.pickToolKit(state, pid, legal)) || pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0]
    : TEACHER === 'minit'
    ? (state, pid, cs) => miniTPick(state, pid, cs) || pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'chainmix'
    ? (state, pid, cs, legal) => pickChain(state, pid, cs, R) || keyToCand(cs, W.EpirusBots.pickToolKit(state, pid, legal)) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'allround'
    ? (state, pid, cs) => allRoundPick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ration'
    ? (state, pid, cs) => rationPick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ration2'
    ? (state, pid, cs) => ration2Pick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ration3'
    ? (state, pid, cs) => ration3Pick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ration4'
    ? (state, pid, cs) => ration4Pick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ration5'
    ? (state, pid, cs) => ration5Pick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ration6'
    ? (state, pid, cs) => ration6Pick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ringchain'
    ? (state, pid, cs) => ringChainPick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'ring'
    ? (state, pid, cs) => pickKey(cs, R.SK.RING) || pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0]   /* 环优先：代 3 上环的提供率只有 2.8% ⇒ 先让教师自己肯开环 */
  : TEACHER === 'bigt'
    ? (state, pid, cs) => bigTPick(state, pid, cs) || pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : TEACHER === 'lasereye'
    ? (state, pid, cs) => laserPick(state, pid, cs) || cs.find((c) => c.key === R.SK.JI) || cs[0]   /* 不回落链：链会把它拖回电珠/电磁炮那一维 */
  : TEACHER === 'oracleDef'
    ? (state, pid, cs) => pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0]
  : (state, pid, cs) => pickChain(state, pid, cs, R) || cs.find((c) => c.key === R.SK.JI) || cs[0];
/* ⛔ 教师名单响亮闸（11-01 千问）：写错名字原先会**静默落回默认 chain** ⇒ "我换了教师"是假读数。 */
const TEACHER_KNOWN = ['oracleDef', 'chain', 'v7mix', 'toolkit', 'chainmix', 'minit', 'bigt', 'lasereye', 'ring', 'ringchain', 'ration', 'ration2', 'ration3', 'ration4', 'ration5', 'ration6', 'allround'];
if (TEACHER_KNOWN.indexOf(TEACHER) < 0 && !PACK_TEACHER) { console.error('⛔ --teacher 只认 ' + TEACHER_KNOWN.join('|') + '（收到 ' + TEACHER + '）'); process.exit(2); }
/* `--rareOnly=miniT,ring --rareFrac=0.7`（靶向采集，ZCode · 11-01 凌晨）：普通配额（NGRP×(1−Frac)）收满后
 *   **只收教师选中稀有键的组**——稀有事件语义的 10× 富集器（miniT 选靶 / ring 三连都在这格）。 */
const RARE = String(arg('rareOnly', '')).split(',').filter(Boolean);
const RARE_FRAC = Math.min(0.95, Math.max(0, Number(arg('rareFrac', 0)) || 0));
if (RARE.length && !(RARE_FRAC > 0)) { console.error('⛔ --rareOnly 要配 --rareFrac>0'); process.exit(2); }
/* oracleDef（DS · 11-02 晚）：事后先知的「打过来什么→该出哪张防」标签表（与用户口径一致）。 */
const ORC_ATTACKS = new Set([R.SK.GUN, R.SK.TANK, R.SK.SWORD, R.SK.SNIPE, R.SK.RAILGUN, R.SK.DUAL_GUN]);
const DEFW = Number(arg('defWeight', 1)) || 1;   /* oracleDef：防御类标签的权重（校准用；1=均匀） */
const ORC_SUBSET = arg('oracleSubset', '0') === '1';   /* 只在「可预测子集」打标签 */
const ORC_REPLIES = new Map([[R.SK.GUN, R.SK.REFLECT], [R.SK.TANK, R.SK.REFLECT], [R.SK.DUAL_GUN, R.SK.REFLECT], [R.SK.SWORD, R.SK.GUARD], [R.SK.SNIPE, R.SK.GUN], [R.SK.RAILGUN, R.SK.TRANSFER]]);
const LABEL = { ok: 0, moved: 0, gone: 0, keys: 0, rare: 0, byKey: {} };
/* 打出去的那一手 vs 教师（只在学生自访轮里量）——与 `LABEL`（克隆态 argmax 口径）是**两个不同的数** */
const PLAY = { n: 0, hit: 0, stuckCharge: 0, missCharge: 0, missFire: 0 };

function collectInto(dst, srcParams, idBase) {
  let curShp = -1;   /* 当前桌形（覆盖自证用） */
  let lastG = null;  /* 最近推入的组：oracleDef 的 onPicks 钩子回头改它的 wantKey */
  const record = (state, pid, legal) => {
    lastG = null;
    if (!(legal && legal.length >= 2)) return;
    const cs = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
    if (cs.length < 2) return;
    const t0 = teacherPick(state, pid, cs, legal);
    if (!t0) return;
    const cl = S.cloneState(state); cl.rng = { next: rnd };
    const cs2 = P.candidatesFor(cl, pid, T.econBase(cl, pid, legal), { lockTarget: false }) || [];
    const again = teacherPick(cl, pid, cs2, legal);
    if (!again || !cs2.length) { LABEL.gone++; return; }
    /* tape 的输入与参数无关 ⇒ 收集时算一次，之后任意参数重放（单源：arch2 wantTape） */
    const fr = P.forwardCands(cl, pid, cs2, up, { temp: 1, wantTape: 1 });
    /* ⚑ 键层分组从 **tape 里拿**（arch2 的 DK 是决策键的唯一实现）⇒ 训练目标与部署 softmax 同一套键。
     *   原来这里自造 `cs2.map(c => c.key)`，代 3 开了 keySplit 就会变成苹果对橘子（键数都不一样）。 */
    const keys = fr.tape.keys;
    /* 教师那一枚在候选表里的下标（pickChain 返回的是 cs2 里的对象本身 ⇒ 按身份找，不按 key 找） */
    const wIdx = cs2.indexOf(again);
    if (wIdx < 0 || !keys[wIdx]) { LABEL.gone++; return; }
    /* 稀有期：只收教师选中稀有键的决策点。⚑ 11-01 千问：**学生自访轮也要过同一道筛**
     *   （原先带 `srcParams == null` 条件 ⇒ DAgger 轮不受筛，稀有类被自访态淹掉——昨夜 mt-dag 的
     *    "DAgger 稀释稀有类"就是这个条件造成的，不是 DAgger 本身的错）。 */
    if (RARE.length && dst.length >= Math.floor(NGRP * (1 - RARE_FRAC)) && RARE.indexOf(again.key) < 0) { LABEL.rare++; return; }   /* 稀有期：只收稀有键组 */
    dst.push({ tape: fr.tape, keys, beads: cs2.map((c) => c.bead || null), wantKey: keys[wIdx], want0: t0.key, shp: curShp,
      wantIdx: wIdx, wantBead: again.bead || null });
    lastG = dst[dst.length - 1];
    LABEL.keys++;
    LABEL.byKey[again.key] = (LABEL.byKey[again.key] || 0) + 1;
    if (again.key !== t0.key) LABEL.moved++; else LABEL.ok++;
  };
  /* oracleDef：选完/结算前看别人这一手打谁，回头把**上一组**的标签改成对应的防御（用户口径）。 */
  const oracleHook = TEACHER === 'oracleDef' ? function (state, picks, legals, seat) {
    const g = lastG; if (!g) return null;
    const me = state.p[seat]; if (!me || me.hp <= 0) return null;
    let atk = null;
    for (let pid = 0; pid < state.p.length; pid++) {
      if (pid === seat) continue;
      const pk = picks[pid]; if (!pk) continue;
      if ((pk.target === seat || pk.target2 === seat) && ORC_ATTACKS.has(pk.key)) { atk = pk; break; }
    }
    if (!atk) return null;
    if (ORC_SUBSET) { const op = state.p[atk.pid]; if (!op || !(ORC_ATTACKS.has(op.lastSkill) || op.lastTarget === seat)) return null; }
    const rep = ORC_REPLIES.get(atk.key); if (!rep) return null;
    const lg = (legals[seat] || []).find(function (c) { return c.key === rep && c.affordable; });
    if (!lg) return null;
    const idx = g.keys.indexOf(rep); if (idx < 0) return null;
    g.wantKey = rep; g.wantIdx = idx; g.wantBead = null;
    return null;
  } : undefined;
  let play;
  if (srcParams == null) {
    play = (state, pid, legal) => {
      if (dst.length < NGRP) record(state, pid, legal);
      const cs3 = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
      const a = teacherPick(state, pid, cs3, legal);
      return a ? { key: a.key, target: a.target == null ? null : a.target, target2: a.target2 == null ? null : a.target2, bead: a.bead || null } : { key: R.SK.JI };
    };
  } else {
    const ch = A2.chooserOf(srcParams, DAG_TEMP);
    play = (state, pid, legal) => {
      if (dst.length < NGRP) record(state, pid, legal);
      const act = ch(state, pid, legal);
      /* ⚑ Played-action 一致率（10-31 夜里加，因为"自访留出 100%"与考场读数打脸才补的这条）：
       *   留出一致率量的是**克隆态上的 argmax**；这一条量的是**真正打出去的那一手**。
       *   两者分开才能分清"包不认教师"与"包认教师但走漏"——OB3CH 起点那粒 92% 的蓄能打在 ep=2 上
       *   （教师从不），若这条也 100% 就是我自己的读数接错线。 */
      {
        const csP = P.candidatesFor(state, pid, T.econBase(state, pid, legal), { lockTarget: false }) || [];
        const t = teacherPick(state, pid, csP, legal);
        if (t && csP.length >= 2) {
          PLAY.n++;
          const same = act && act.key === t.key && (t.bead || null) === (act.bead || null);
          if (same) PLAY.hit++;
          else {
            if (act && act.key === R.SK.CHARGE && t.key === R.SK.JI) PLAY.stuckCharge++;   // 教师弃权、包去蓄
            if (act && act.key === R.SK.JI && t.key === R.SK.CHARGE) PLAY.missCharge++;    // 教师让蓄、包弃权
            if (act && act.key === R.SK.JI && t.key === R.SK.RAILGUN) PLAY.missFire++;     // 窗口开着、包不放
          }
        }
      }
      return act;
    };
  }
  /* 稀有期的每形局数上限放宽（60 ⇒ 2500）：稀有标签要靠局数堆出来 */
  const GCAP = RARE.length ? 2500 : 60;
  if (SHAPEBAL) {
    /* 配额摊在**组**上（第一版摊在局上 ⇒ 800 组的上限在前 2 形就撞掉，等于没改——这条已用 `覆盖 x/11 形` 自证堵死） */
    const q = Math.max(2, Math.ceil(NGRP / A2.shapes.length));
    for (let s = 0; s < A2.shapes.length; s++) {
      curShp = s;
      const before = dst.length;
      for (let g = 0; g < GCAP && dst.length - before < q; g++) { if (dst.length >= NGRP) break; A2.playOne(play, s, idBase + s * 1000 + g, 4242, oracleHook); }
    }
  } else {
    for (let s = 0; s < A2.shapes.length && dst.length < NGRP; s++) {
      curShp = s;
      for (let g = 0; g < GCAP && dst.length < NGRP; g++) A2.playOne(play, s, idBase + s * 1000 + g, 4242, oracleHook);
    }
  }
}

const groups = [];
collectInto(groups, null, 300000);
function shapeCov(list) { const m = {}; for (const g of list) m[g.shp] = (m[g.shp] || 0) + 1; const ks = Object.keys(m); return ks.length + '/' + A2.shapes.length + ' 形（逐形 ' + ks.map((k) => m[k]).join(',') + '）'; }
if (groups.length < 60) { console.error('⛔ 只抓到 ' + groups.length + ' 组 ⇒ 不做'); process.exit(2); }
const cut = Math.floor(groups.length * 0.75);
const train0 = groups.slice(0, cut), test = groups.slice(cut);
/* 1/类频 权重：`key` 路径按 wantKey（与 chain-supfit 同式，逐字不变）；
 *   `cand` 路径按"键#珠"伪类 ⇒ 让 `charge#elec` 不被 `charge#boom` 的数量吃掉（ji 本来占 6 成）。 */
const cls = (gr) => (OBJ === 'cand' ? gr.wantKey + (gr.wantBead ? '#' + gr.wantBead : '') : gr.wantKey);
function weightOf(list) {
  const c = {};
  for (const gr of list) { const k = cls(gr); c[k] = (c[k] || 0) + 1; }
  const DEFKEYS = new Set([R.SK.REFLECT, R.SK.GUARD, R.SK.TRANSFER, R.SK.HOLO, R.SK.ARMOR, R.SK.PROTO, R.SK.BAGUA, R.SK.SHIFT, R.SK.JINSHIELD]);
  const w = {}; for (const k in c) w[k] = TEACHER === 'oracleDef' ? (DEFKEYS.has(k) ? DEFW : 1) : 1 / c[k];   /* oracleDef：均匀权重（1/类频会把少数防御类放得过大 ⇒ 刷防御） */
  return w;
}
let WKEY = weightOf(train0);

/* ---- 评测（`key` = 与 chain-supfit 同口径：temp=1、键级、1/类频加权；`cand` = 教师那一枚候选的似然）---- */
/* ⚑ 留出集里出现**训练集没有的类**时（10-31 晚 v7mix 的 holo 键触发），`1/类频` 权重根本不存在：
 *   旧写法照旧 `nW += WKEY[c]` ⇒ nW 被毒成 NaN，而 JS 里 **NaN 是 falsy** ⇒ `ll` 静默落回哨兵 −99，
 *   打印看着像"这枚包差到读不出"，其实是分母被吃掉了（与 pg-train 那笔 NaN 事故同族）。
 *   现在：这类组不进加权均值、单独计数并响亮印出（带计入分母）。 */
function like(pv, list) {
  let llW = 0, nW = 0, hit = 0, n = 0, noW = 0;
  const noWKeys = {};
  const byKey = {};
  for (const gr of list) {
    const act = tapeForward(gr.tape, pv, ly);
    const t = tailOf(act.logits, gr.keys, 1);
    const p = OBJ === 'cand' ? t.probs[gr.wantIdx] : t.kProb[gr.wantKey];
    if (!(p > 0)) continue;
    const c = cls(gr);
    const w = WKEY[c];
    if (!(w > 0)) { noW++; noWKeys[c] = (noWKeys[c] || 0) + 1; continue; }
    n++; llW += w * Math.log(Math.max(1e-12, p)); nW += w;
    let bi = 0; for (let i = 1; i < t.probs.length; i++) if (t.probs[i] > t.probs[bi]) bi = i;
    const ok = OBJ === 'cand' ? (bi === gr.wantIdx) : (gr.keys[bi] === gr.wantKey);
    if (ok) hit++;
    /* byKey 用**未加权计数**（chain-supfit 同口径；wAgree 另算） */
    const bk = byKey[c] || (byKey[c] = { n: 0, hit: 0 });
    bk.n++; if (ok) bk.hit++;
  }
  /* wAgree = 1/类频加权一致率（每键的组内一致率按 1/类频加权平均） */
  let wHit = 0, wTot = 0;
  for (const k in byKey) { const w = WKEY[k] != null ? WKEY[k] : 1; wTot += byKey[k].n * w; wHit += byKey[k].hit * w; }
  return { ll: nW ? llW / nW : -99, agree: n ? hit / n : 0, wAgree: wTot ? wHit / wTot : 0, n, noW, noWKeys, byKey };
}
/* 印出被吃掉的类（带分母），−99 从此只可能真的是"整批读不出" */
const noWLine = (tag, r) => (r.noW ? ('  \u2691 ' + tag + '有 ' + r.noW + ' 组落在训练集没有的类 ⇒ 未计入加权似然（计入分母 n=' +
  r.n + '）：' + Object.entries(r.noWKeys).map(([k, v]) => k + '×' + v).join(' ‖ ') + '\n') : '');

const t0 = Date.now();
const base = like(up, test);
console.log('# supfit-gd（Adam+反传） ‖ 目标=' + OBJ + ' ‖ 轮=' + DAG + ' ‖ 上游 ' + UP.replace(/^.*[\\/]/, '') + ' ‖ 面=' + (got.cfg.input || '?') +
  ' ‖ 组 ' + groups.length + '（训 ' + train0.length + ' ‖ 测 ' + test.length + '）');
console.log('  ⚑ 采集覆盖（教师自访，shapeBal=' + SHAPEBAL + '）：' + shapeCov(groups));
console.log('  ⚑ 标签对账（克隆态重算后）：未变 ' + LABEL.ok + ' ‖ 变了 ' + LABEL.moved + ' ‖ 作废 ' + LABEL.gone + '（分母 ' + LABEL.keys + '）');
console.log('  起点：加权似然 ' + base.ll.toFixed(4) + ' ‖ ' + (OBJ === 'cand' ? '同枚 top-1' : '同键 top-1') + ' ' + (100 * base.agree).toFixed(1) + '% ‖ 加权一致率 ' + (100 * base.wAgree).toFixed(1) + '%');

/* ---- Adam + 反传（全批）：`--dagger>0` 时同一函数按轮续跑（池子换、动量重开）---- */
const B1 = 0.9, B2 = 0.999, EPSA = 1e-8;
function adamFit(pvStart, trainList, sentinelLl, roundTag) {
  WKEY = weightOf(trainList);
  const DIM = pvStart.length;
  const pvR = Float64Array.from(pvStart);
  const m = new Float64Array(DIM), v = new Float64Array(DIM);
  let best = { ll: sentinelLl, pv: Float64Array.from(pvStart) };
  for (let it = 1; it <= STEPS; it++) {
    const grad = new Float64Array(DIM);
    for (const gr of trainList) {
      const act = tapeForward(gr.tape, pvR, ly);
      const t = tailOf(act.logits, gr.keys, 1);
      const p = OBJ === 'cand' ? t.probs[gr.wantIdx] : t.kProb[gr.wantKey];
      if (!(p > 0)) continue;
      const w = WKEY[cls(gr)];
      const u = (OBJ === 'cand' ? dLogPi(gr.wantIdx, act.logits, gr.keys, 1, t) : dLogKeyP(gr.wantKey, act.logits, gr.keys, 1, t));
      for (let j = 0; j < u.length; j++) u[j] *= -w;
      tapeBackward(gr.tape, pvR, ly, act, u, grad);
    }
    const denom = Math.max(1, trainList.length);
    for (let d = 0; d < DIM; d++) {
      const g = grad[d] / denom;
      m[d] = B1 * m[d] + (1 - B1) * g;
      v[d] = B2 * v[d] + (1 - B2) * g * g;
      const mh = m[d] / (1 - Math.pow(B1, it)), vh = v[d] / (1 - Math.pow(B2, it));
      pvR[d] -= LR * mh / (Math.sqrt(vh) + EPSA);
    }
    if (it % 50 === 0 || it === STEPS) {
      const tr = like(pvR, trainList);
      if (tr.ll > best.ll) { best = { ll: tr.ll, pv: Float64Array.from(pvR) }; }
      console.log('  步 ' + it + (roundTag ? '（轮 ' + roundTag + '）' : '') + ' ‖ 训练加权似然 ' + tr.ll.toFixed(4) + ' ‖ 训练' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * tr.agree).toFixed(1) + '%');
    }
  }
  return Float64Array.from(best.pv);
}

let pvCur = Float64Array.from(up);
let trainList = train0.slice();
let stuTrain = [], stuTest = [];
const ROUNDS = [];
const ROUNDS_MOVED = [];   /* 每轮『粒子真的动了』的坐标级自证 */
pvCur = adamFit(pvCur, trainList, base.ll, 0);
{
  const r0 = like(pvCur, test);
  ROUNDS.push({ round: 0, trainG: trainList.length, teacherAgree: r0.agree, teacherLl: r0.ll, studentAgree: null, studentN: 0 });
}
for (let r = 1; r <= DAG; r++) {
  const before = { keys: LABEL.keys, gone: LABEL.gone, moved: LABEL.moved };
  const gS = [];
  collectInto(gS, pvCur, 500000 + r * 1000);
  if (gS.length < 60) { console.log('  ⚑ 轮 ' + r + ' 学生自访只抓到 ' + gS.length + ' 组 ⇒ 停在第 ' + (r - 1) + ' 轮'); break; }
  const c = Math.floor(gS.length * 0.75);
  stuTrain = stuTrain.concat(gS.slice(0, c));
  stuTest = stuTest.concat(gS.slice(c));
  const cap = Math.max(0, POOL - train0.length);
  if (stuTrain.length > cap) stuTrain = stuTrain.slice(stuTrain.length - cap);
  trainList = train0.concat(stuTrain);
  const pvBefore = Float64Array.from(pvCur);
  /* 哨兵必须与 adamFit 内部比较的量**同源**（都是 trainList 上的 train ll）。原先传的是 like(pvCur, test).ll：
   * r>=1 的起点粒子在 test 上已经接近 0，训练侧 checkpoint 想超过它全凭巧合 =
   * `--dagger` 有时静默返回起点粒（11-01 实测 GD3-BIGT 与 GD3-BIGT2 的 md5 逐位相同 = 整轮空转），
   * 有时又真的换粒（昨夜 mt-dag 与 mt-OB3S-rich 的 md5 不同）⇒ 生效与否取决于口径错配，这是仪器缺陷。 */
  pvCur = adamFit(pvCur, trainList, like(pvCur, trainList).ll, r);
  { let nMoved = 0, first = -1;
    for (let i = 0; i < pvBefore.length; i++) if (pvBefore[i] !== pvCur[i]) { nMoved++; if (first < 0) first = i; }
    console.log('  轮 ' + r + ' ‖ ⭐ 粒子自证：改变 ' + nMoved + '/' + pvBefore.length + ' 个坐标'
      + (nMoved === 0 ? '（无差异 ⇒ 这一轮没进产物）' : '（首个差异在第 ' + first + ' 个）'));
    if (nMoved === 0) { console.error('⛔ DAgger 轮 ' + r + ' 没改变粒子 ⇒ 这一档是空转，不许当成 DAgger 无效的读数'); process.exit(7); }
    ROUNDS_MOVED.push({ round: r, moved: nMoved, firstDiff: first, dim: pvBefore.length });
  }
  const tr = like(pvCur, test), ts = like(pvCur, stuTest);
  console.log('  轮 ' + r + ' ‖ 学生态采集覆盖（shapeBal=' + SHAPEBAL + '）：' + shapeCov(gS));
  console.log('  轮 ' + r + ' ‖ 打出去的手 vs 教师：一致 ' + (100 * PLAY.hit / Math.max(1, PLAY.n)).toFixed(1) + '%（' + PLAY.n + ' 手）' +
    ' ‖ 教师弃权包去蓄 ' + PLAY.stuckCharge + ' ‖ 教师让蓄包弃权 ' + PLAY.missCharge + ' ‖ 有窗不放 ' + PLAY.missFire);
  console.log('  轮 ' + r + ' ‖ 学生态 +' + gS.length + ' 组（池 ' + trainList.length + ' ‖ 标签对账 ' + (LABEL.keys - before.keys) + '，作废 ' + (LABEL.gone - before.gone) + '）' +
    ' ‖ 教师留出 ' + (100 * tr.agree).toFixed(1) + '% ‖ **学生自访留出 ' + (100 * ts.agree).toFixed(1) + '%（' + ts.n + ' 组）**');
  ROUNDS.push({ round: r, studentG: gS.length, trainG: trainList.length, teacherAgree: tr.agree, teacherLl: tr.ll, studentAgree: ts.agree, studentLl: ts.ll, studentN: ts.n });
}
/* 终评：按**训练似然最好**的那份粒报留出（lr 挑档不许偷看 test 的纪律同一源头） */
const finalPv = pvCur;
const fin = like(finalPv, test);
const finTrain = like(finalPv, trainList);
const finStudent = stuTest.length ? like(finalPv, stuTest) : null;
const byKeyLine = Object.keys(fin.byKey).filter((k) => fin.byKey[k].n >= 3).sort((x, y) => fin.byKey[y].n - fin.byKey[x].n).slice(0, 8)
  .map((k) => k + ' ' + (100 * fin.byKey[k].hit / fin.byKey[k].n).toFixed(0) + '%(' + fin.byKey[k].n + ')').join(' ‖ ');
const secs = (Date.now() - t0) / 1000;
console.log('  终（训 ' + trainList.length + ' 组上 ll 最高的粒）：留出加权似然 ' + fin.ll.toFixed(4) + '（起点 ' + base.ll.toFixed(4) + '）' +
  ' ‖ ' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * fin.agree).toFixed(1) + '%（起点 ' + (100 * base.agree).toFixed(1) + '%）' +
  ' ‖ 加权一致率 ' + (100 * fin.wAgree).toFixed(1) + '%（起点 ' + (100 * base.wAgree).toFixed(1) + '%）');
process.stdout.write(noWLine('起点（留出卷）', base) + noWLine('终评（留出卷）', fin));
console.log('  逐' + (OBJ === 'cand' ? '类(键#珠)' : '键') + '（留出）：' + byKeyLine);
if (finStudent) console.log('  ⚑ 学生自访留出（自己走出来的态）：' + (OBJ === 'cand' ? '同枚' : '同键') + ' top-1 ' + (100 * finStudent.agree).toFixed(1) + '%（' + finStudent.n + ' 组）' +
  ' ‖ 逐类 ' + Object.keys(finStudent.byKey).filter((k) => finStudent.byKey[k].n >= 3).sort((x, y) => finStudent.byKey[y].n - finStudent.byKey[x].n).slice(0, 8)
    .map((k) => k + ' ' + (100 * finStudent.byKey[k].hit / finStudent.byKey[k].n).toFixed(0) + '%(' + finStudent.byKey[k].n + ')').join(' ‖ ') +
    '（**这一行才是"实战走得动"的前导读数**，教师留出 100% 已经两次被证明不等于走得动）');
console.log('  耗时 ' + secs.toFixed(1) + 's ‖ 步数 ' + STEPS + ' ‖ lr ' + LR + ' ‖ 对表基准 supfit-w1：留出 75.5% ‖ railgun 39/39');
const verdict = OBJ === 'cand'
  ? '⇒ P-A1 只对 key 路径预登记；cand 路径的验收在实战尺（chain-price 的窗/珠/净分）'
  : (fin.agree >= 0.755 ? '⇒ P-A1 达标候选（留出 ≥75.5%）' : '⇒ P-A1 未达（<75.5%）');
console.log('  判：' + verdict);

mkdirSync(dirname(OUT), { recursive: true });
/* 教师标签**塌缩**闸（用户 11-01 提"连续 n 代一样就该报错终止"后接的第一格，成本最低的一格）：
 *   ration5 那臂蒸完标签只剩 `ji + charge#elec` 两类（meta 里逐键可见），产物是"47 回合谁都不死、5P 0.7%"的
 *   永远在攒包 ⇒ 而我直到跑完 4 条考卷腿才发现。这里**在建臂之前就拒**，不写产物。
 *   ⚠ 只在 `--objective=key` 的标签上判（`cand` 目标下 byKey 同口径，不动）。 */
const LABEL_KINDS_MIN = Math.max(0, Number(arg('labelKindsMin', 0)) || 0);
/* 支持数闸（11-01 傍晚，我自己上一条"只剩两类标签"的误读逼出来的：那是**留出**样本薄，整份采集有 3 类）：
 *   真正会静默废掉一条线的是"这一格在采集里只有 1 个样本"——ration5 的电磁炮标签 1/800（0.1%），
 *   于是蒸出"只蓄能不开炮、47 回合谁都不死、5P 0.7%"的包，而我跑到第 4 条考卷腿才发现。 */
const SUPPORT_MIN = Math.max(0, Number(arg('labelSupportMin', 0)) || 0);
const FIRE_KEYS = [R.SK.RAILGUN, R.SK.BIG_T, R.SK.LASER_EYE];
{
  const ks = Object.keys(LABEL.byKey);
  const nonJi = ks.filter((k) => k !== R.SK.JI);
  const hist = ks.map((k) => (R.byKey[k] && R.byKey[k].name || k) + '=' + LABEL.byKey[k]).sort((a, b) => b.split('=')[1] - a.split('=')[1]).join(' ‖ ');
  console.log('  ⚑ 教师标签的种类：共 ' + ks.length + ' 键（非ジ ' + nonJi.length + ' 类）‖ ' + hist);
  const rare = nonJi.length ? nonJi.reduce((a, k) => (LABEL.byKey[k] < LABEL.byKey[a] ? k : a), nonJi[0]) : null;
  console.log('  ⚑ 最稀有的非ジ标签 = ' + (rare ? (R.byKey[rare] && R.byKey[rare].name || rare) + ' ' + LABEL.byKey[rare] + '/' + LABEL.keys +
    '（' + (100 * LABEL.byKey[rare] / LABEL.keys).toFixed(2) + '%）' : '读不出（非ジ类为 0）') +
    ' ‖ 开火线支持数：' + FIRE_KEYS.map((k) => (R.byKey[k] && R.byKey[k].name || k) + '=' + (LABEL.byKey[k] || 0)).join(' '));
  if (LABEL_KINDS_MIN > 0 && nonJi.length < LABEL_KINDS_MIN) {
    console.error('⛔ 教师标签非ジ种类 ' + nonJi.length + ' < --labelKindsMin=' + LABEL_KINDS_MIN + ' ⇒ 当场拒、不写产物。');
    process.exit(9);
  }
  if (SUPPORT_MIN > 0 && rare && LABEL.byKey[rare] < SUPPORT_MIN) {
    console.error('⛔ 最稀有非ジ标签只有 ' + LABEL.byKey[rare] + ' 个样本 < --labelSupportMin=' + SUPPORT_MIN +
      ' ⇒ 这条线在采集里几乎不存在，网络学不到它（别拿"留出里没出现"当"教过了"）。**不写产物**。');
    process.exit(11);
  }
  if (nonJi.length <= 2) console.log('  ⚠ 非ジ标签只剩 ' + nonJi.length + ' 类 ⇒ 产物大概率一维/空转；要拒请给 --labelKindsMin=3');
}

/* 行为冒烟（`--smoke=<局数>`，默认 0=关）：蒸完先在镜像桌上打几局，只问两件事——
 *   ① 非ジ出手种类还剩几种 ② 有没有一局能**分出胜负**。ration5 那臂两条都会红（1 种 / 决胜率 0%），
 *   而它当时骗过了我，因为我先跑的是考卷桌（420 局）而不是这张 30 秒的镜。 */
const SMOKE = Math.max(0, Number(arg('smoke', 0)) || 0);
if (SMOKE > 0) {
  const ch = T.policyChooserN(Float64Array.from(finalPv), 0.15);
  let kinds = {}, draws = 0, rounds = 0, beadGot = 0, beadSpent = 0, beadExp = 0;
  for (let g = 0; g < SMOKE; g++) {
    const st = W.EpirusState.createState('multi', { next: T.mulberry32(9000 + g) }, 5);
    st.slotSalt = ((Math.imul(g + 3, 0x85ebca6b) ^ 0x27d4eb2f) >>> 0);
    W.EpirusPlay.autoGameN(st, [ch, ch, ch, ch, ch]);
    rounds += st.round;
    if (st.winner === 'draw' || st.winner == null) draws++;
    for (const e of st.events) {
      if (e.type === 'action' && e.outcome === 'ok' && e.key && e.key !== R.SK.JI) kinds[e.key] = (kinds[e.key] || 0) + 1;
      /* 珠账按**被测席**算（镜像桌上五席同包 ⇒ 与 mastery 的 chargeProfile 同口径但那是 long 桌，这里量 multi 镜） */
      else if (e.type === 'bead') { if (e.delta > 0) beadGot += e.delta; else beadSpent += -e.delta; }
      else if (e.type === 'beadExpire') beadExp += (e.delta != null ? Math.abs(e.delta) : 1);
    }
  }
  const nk = Object.keys(kinds).length;
  const waste = beadGot ? beadExp / beadGot : null;
  console.log('  ⚑ 行为冒烟（镜像 ' + SMOKE + ' 局 ‖ n=5 ‖ ε=0）：非ジ出手 ' + nk + ' 种（' +
    Object.keys(kinds).sort((a, b) => kinds[b] - kinds[a]).slice(0, 6).map((k) => (R.byKey[k] && R.byKey[k].name || k) + '=' + kinds[k]).join(' ') + '）' +
    ' ‖ 局均回合 ' + (rounds / SMOKE).toFixed(1) + ' ‖ 决胜率 ' + (100 * (1 - draws / SMOKE)).toFixed(1) + '%' +
    ' ‖ 珠账 得 ' + beadGot + ' 花 ' + beadSpent + ' 过期 ' + beadExp + (waste == null ? '（**没得到过珠 ⇒ 浪费率读不出，不是 0%**）' : ' ⇒ 浪费率 ' + (100 * waste).toFixed(1) + '%'));
  if (nk <= 1 || draws === SMOKE) {
    console.error('⛔ 冒烟红：非ジ出手 ' + nk + ' 种、决胜率 ' + (100 * (1 - draws / SMOKE)).toFixed(1) + '% ⇒ 这一档教师蒸出来的是空转包，**不写产物**（省下后面的考卷腿）。');
    process.exit(12);
  }
  /* 珠账判据**不自己发明**：调产品门 `bead` 的同一条（`champion-gate.mjs` L1「攒下来的珠没有被囤成一堆过期废物」
   *   = 过期 **≤5 颗/局（绝对量，不看比率）** ‖ **得珠 = 0 ⇒ 不适用**（不走珠经济是风格，不是缺陷）），
   *   量具也共用 `audit-lib.chargeProfile`（长程 n=40）。
   *   我上一版写的是"浪费率 ≥90%"的**比率**判据 ⇒ 那会把"攒得极少"与"囤死"判成同一件事
   *   （`pool-frontier-lib` 的 `isClosedShaped` 注释记录的正是这个病：两种形态被同一根率混掉）。 */
  const beadProf = (typeof chargeProfile === 'function') ? chargeProfile(W, Float64Array.from(finalPv), 'long', 40) : null;
  const expPerGame = beadProf && beadProf.games ? beadProf.expired / beadProf.games : null;
  if (beadProf) console.log('  ⚑ 珠账（与门 bead 同尺：chargeProfile long n=40）：得 ' + beadProf.gained + ' 花 ' + beadProf.spent +
    ' 过期 ' + beadProf.expired + ' ⇒ ' + (expPerGame == null ? '—' : expPerGame.toFixed(1)) + ' 颗/局（线 ≤5）' +
    (beadProf.gained === 0 ? ' ‖ 判：不适用（得珠 0 ⇒ 不走珠经济）' : (expPerGame > 5 ? ' ‖ 判：⛔ 超线' : ' ‖ 判：✔')) +
    ' ‖ 花珠率 ' + (100 * (beadProf.spentRate || 0)).toFixed(1) + '%' +
    ' ‖（镜里自查，只记录：得 ' + beadGot + ' 花 ' + beadSpent + ' 过期 ' + beadExp + (waste == null ? '' : ' ⇒ 浪费率 ' + (100 * waste).toFixed(1) + '%') + '）');
  if (beadProf && beadProf.gained > 0 && expPerGame != null && expPerGame > 5) {
    console.error('⛔ 冒烟红（门 bead 同尺）：过期 ' + expPerGame.toFixed(1) + ' 颗/局 > 5 且得珠 ' + beadProf.gained +
      ' ⇒ 只教会"攒"没教会"用"，**不写产物**（省下后面的考卷腿）。');
    process.exit(14);
  }
}

const packed = P.pack(finalPv);
writeFileSync(OUT, 'window.EPIRUS_CHAMPION_3P = ' + JSON.stringify(packed) + ';\n', 'utf8');
writeFileSync(OUT + '.meta.json', JSON.stringify({
  tool: 'supfit-gd', tag: TAG || null, parent: UP, seed: SEED, lr: LR, steps: STEPS, groups: groups.length, trainG: cut, testG: test.length,
  objective: OBJ, dagger: DAG, dagTemp: DAG_TEMP, pool: POOL, shapeBal: SHAPEBAL, teacher: TEACHER, keySplit: KS, rareOnly: RARE.length ? RARE.join(",") : null, rareFrac: RARE_FRAC || null,
  playedAgree: { n: PLAY.n, hit: PLAY.hit, stuckCharge: PLAY.stuckCharge, missCharge: PLAY.missCharge, missFire: PLAY.missFire },
  label: LABEL, supfitGd: { objective: OBJ, dagger: DAG, rounds: ROUNDS, roundsMoved: ROUNDS_MOVED, startAgree: base.agree, startLl: base.ll, agree: fin.agree, ll: fin.ll, wAgree: fin.wAgree, nTest: fin.n, nTrain: finTrain.n, testClassNotInTrain: fin.noW || 0, startClassNotInTrain: base.noW || 0,
    studentAgree: finStudent ? finStudent.agree : null, studentN: finStudent ? finStudent.n : 0,
    byKey: Object.keys(fin.byKey).map((k) => ({ key: k, n: fin.byKey[k].n, hit: fin.byKey[k].hit })), verdict },
  container: { v: packed.v != null ? packed.v : null, input: (got.cfg.input || 'v7'), dof: got.cfg.dof, gen: (KS ? 3 : (got.cfg.gen || 2)), keySplit: KS },
  lineage: { parent: UP, gen: 2, recipe: { teacher: 'chain-lib.pickChain', objective: (OBJ === 'cand' ? 'weighted candidate log-likelihood log pi(teacher action), class=key#bead (temp=1)' : 'weighted key log-likelihood (temp=1)'), solver: 'Adam+analytic backprop (pg-lib)' + (DAG ? ' + DAgger x' + DAG : '') } },
}, null, 1), 'utf8');
console.log('  产物 → ' + OUT);
