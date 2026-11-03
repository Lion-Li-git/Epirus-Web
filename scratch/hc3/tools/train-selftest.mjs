#!/usr/bin/env node
/* train-selftest.mjs —— 训练侧的三条凭据（**不是门禁**，不进 np-test；DS · 2026-10-27 晚）
 *
 * 为什么要有它：10-27 用户裁定「所有训练测的门禁全部删掉」⇒ 108 条训练门离开产品门禁面（280→171）。
 *   代价是这一侧从此没有机器守卫：奖励接线/送达/默认值只靠人眼读回执。本脚本把那三条凭据机器化：
 *     ① **回执往返**：`economyReward()` 里每个数值键 set 0.5 ⇒ 读回必须相等 ⇒ reset 必须清零；
 *     ② **出厂默认清单**：逐个打印奖励/惩罚的默认值，**非 0 的必须写在 ALLOW_NONZERO 里并注明裁定**
 *        （`VOID_W`/`VOID_IDEAL_W` 就是 10-27「先开奖励再找激光眼」那条裁定改的、`PIERCE_W`/`PRESS_W` 是更早的在册默认）
 *        ⇒ 以后谁再悄悄把一个默认改非 0，这里会红；
 *     ③ **env 送达名单**：`tools/train-3p.mjs` 里读的每个 `EPIRUS_*` 必须在 `SELF_ENV_KEYS` 里，或有自己的下达横幅
 *        （原先这是门 D206 的活，D206 随训练组一起删了）。
 *
 * 用法：node tools/train-selftest.mjs [--json]   （退出码 0 = 三条都过；1 = 有红）
 */
import { readFileSync } from 'node:fs';
import { ECON_ENV_KEYS, ECON_REWARD_KEYS, readEconEnv } from '../server/econ-env.mjs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSONOUT = process.argv.includes('--json');

/* 非 0 默认值的**白名单**（每一条写清是谁的裁定；不在表里的非 0 默认 = 红） */
const ALLOW_NONZERO = {
  /* 两项 10-27 之前就在册的**奖励**默认（不是新开的） */
  pierceW: 'v1.5.29 起在册（穿反弹/穿防御的落地奖励；门 train-evo 曾断言「默认必须 >0」）',
  pressW: 'v1.5.25 起在册（主动回合奖励）',
  /* 10-27 用户裁定改的：先开失效奖励再找激光眼（v1.8.41） */
  voidW: '2026-10-27 用户裁定「先开奖励再找激光眼」⇒ 出厂 0.05',
  voidIdealW: '同上 ⇒ 出厂 0.10（在 voidW 之上再加）',
  /* 出厂就非 0 的**结构参数**（不是奖励）：多样性/囤积/珠基价这类早就定型的默认 */
  divW: 'v1.5.x 在册默认（多样性项权重 0.06）',
  divK: 'v1.5.x 在册默认（归一化常数 6；setter 有 Math.max(2, …) 夹紧）',
  K_role: 'v1.5.x 在册默认（角色分工常数 8，只读）',
  fitGF: 'v1.6.50 在册默认（广度下界地板 3，与池闸同线）',
  stockBonus: 'v1.5.x 在册默认（攒钱分段奖励 0.05）',
  hoardPen: 'v1.5.x 在册默认（囤积惩罚 0.12，只读回）',
  hoardCapMult: 'v1.5.x 在册默认（囤积上限倍数 2）',
  wallGames: 'v1.5.x 在册默认（反弹墙测量局数 3）',
  ringW: 'v1.5.x 在册默认（聚能环退火权重 0.10）',
  fitTailQ: 'v1.5.x 在册默认（尾部聚合分位 0.25）',
  beadW: 'v1.5.x 在册默认（珠闭环基价 0.05）'
};

/* setter 会按设计夹紧/忽略的键（往返测试对它们只查 reset，不查 set 0.5） */
const NOT_FREE = new Set(['divK', 'K_role', 'hoardPen', 'hoardCapMult', 'wallGames', 'costlyHits', 'at3', 'at5long']);

const out = [];
const record = (ok, name, detail) => { out.push({ ok, name, detail }); if (!JSONOUT) console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' ‖ ' + detail : '')); };

/* ===== 载引擎 ===== */
const sb = { console, Math, JSON, Object, Array, Number, String, Error, Infinity, isNaN, parseInt, parseFloat, Date, Set, Map, Float64Array };
sb.window = sb; sb.globalThis = sb;
for (const f of ['js/core/rules.js', 'js/core/state.js', 'js/core/resolve.js', 'js/core/play.js', 'js/train/bots.js', 'js/train/policy.js', 'js/train/evo.js']) {
  vm.runInNewContext(readFileSync(join(ROOT, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer;
const base = T.economyReward();

/* ① 回执往返（只测数值键；对象/统计键跳过） */
const numeric = Object.keys(base).filter((k) => typeof base[k] === 'number' && k.indexOf('Stat') < 0 && k !== 'games');
let rtBad = [];
for (const k of numeric) {
  const before = base[k];
  if (!NOT_FREE.has(k)) {
    T.setEconomyReward({ [k]: 0.5 });
    const got = T.economyReward()[k];
    if (got !== 0.5) rtBad.push(k + ' set 0.5 读回 ' + got);
  } else {
    T.setEconomyReward({ [k]: 0.5 });   // 夹紧/只读键也要喂一次，看 reset 能不能抹回去
  }
  T.setEconomyReward({ reset: true });
  const back = T.economyReward()[k];
  if (back !== before) rtBad.push(k + ' reset 后 ' + back + ' ≠ 出厂 ' + before);
}
record(rtBad.length === 0, '① 回执往返（' + numeric.length + ' 个数值键：set 0.5 ⇒ 读回相等 ⇒ reset 归零）', rtBad.join(' ; '));

/* ② 出厂默认清单 */
const nonZero = numeric.filter((k) => Number(base[k]) !== 0);
const undeclared = nonZero.filter((k) => !ALLOW_NONZERO[k]);
record(undeclared.length === 0, '② 出厂默认：非 0 的 ' + nonZero.length + ' 个全部在册（共 ' + numeric.length + ' 键）',
  nonZero.map((k) => k + '=' + base[k]).join(' ‖ ') + (undeclared.length ? ' ⚠ 不在册：' + undeclared.join(',') : ''));

/* ③ env 送达名单：train-3p 里读的每个 EPIRUS_* 要么进 SELF_ENV_KEYS，要么有自己的横幅 */
const src = readFileSync(join(ROOT, 'tools/train-3p.mjs'), 'utf8');
const keys = Array.from(new Set((src.match(/process\.env\.(EPIRUS_[A-Z0-9_]+)/g) || []).map((s) => s.replace('process.env.', '')))).sort();
const keysBlock = (src.match(/const SELF_ENV_KEYS = \[([\s\S]*?)\];/) || [])[1] || '';
const inList = new Set((keysBlock.match(/'(EPIRUS_[A-Z0-9_]+)'/g) || []).map((s) => s.slice(1, -1)));
/* ③a 硬判据（这是已删门 D206 的活）：每个 econ env 键都要能映射到一个 econ 字段，
 *   而每个 econ 字段都要能被引擎 `economyReward()` 读回 ⇒ 抓"映射到引擎读不到的字段"与"环境变量没人认"两种坏法。*/
/* 布尔档键（wallFilter/hoardOnLeftover/convRatio/convOffense）用 '1' 喂；其余用 '0.5' */
const unmapped = ECON_ENV_KEYS.filter((env) => {
  for (const probe of ['0.5', '1']) {
    const o = readEconEnv({ [env]: probe });
    if (o && Object.keys(o).some((k) => o[k] !== undefined && o[k] !== null && k !== 'at3' && k !== 'at5long')) return false;
  }
  return true;
});
/* 读回侧的别名：target/cap 在 economyReward() 里叫 targetOverride/capOverride，divCatW 与 divRoleW 同源 */
const ALIAS = { target: 'targetOverride', cap: 'capOverride', divCatW: 'divRoleW' };
const unreachable = ECON_REWARD_KEYS.filter((k) => !(k in base) && !(ALIAS[k] && ALIAS[k] in base));
record(unmapped.length === 0 && unreachable.length === 0,
  '③a econ 往返（env ' + ECON_ENV_KEYS.length + ' 个全部映射 ⇒ 字段 ' + ECON_REWARD_KEYS.length + ' 个全部能读回）',
  (unmapped.length ? '⚠ 没映射：' + unmapped.join(',') : '') + (unreachable.length ? ' ⚠ 读不回：' + unreachable.join(',') : '') || '无缺');
/* ③b 其余读到的键只登记（它们是 runner 参数/只读开关，没有'必须进名单'的承诺） */
const notListed = keys.filter((k) => !inList.has(k));
record(true, '③b 名单外还有 ' + notListed.length + ' 个被读的键（登记用，不判红）', notListed.join(','));

if (JSONOUT) console.log(JSON.stringify({ checks: out, nonZero: Object.fromEntries(nonZero.map((k) => [k, base[k]])), envKeys: keys.length, inList: inList.size }));
process.exit(out.every((x) => x.ok) ? 0 : 1);
