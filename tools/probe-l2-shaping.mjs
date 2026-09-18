/* L2′ 接线自检（v1.5.116 · 第三方复核者）
 * 三条必过的门：
 *   G1 **默认关闭 ⇒ 逐位等于旧口径**（A/A）：把旧式内联重算一遍，在 (人数×模式×门槛×mEp 0~60) 网格上比对；
 *   G2 **打开后必须分得开**："攒到 40 花光赢"与"攥着 40 点死"拿不同分（这正是复核实测到的病灶）；
 *   G3 **env 单一来源真的接上了**：`server/econ-env.mjs` 的三个新键 → `setEconomyReward` 的字段名逐字对齐
 *      （否则又会落到"只落在服务进程自己那份模块上、16 个 worker 仍是默认值"那个事故形状 —— 附录 D 臂 K 的 A/A）。
 * 用法：node tools/probe-l2-shaping.mjs
 */
import { sandbox } from './audit-lib.mjs';
import { readFileSync } from 'node:fs';
import { readEconEnv, ECON_REWARD_KEYS, ECON_ENV_KEYS } from '../server/econ-env.mjs';
const W = sandbox();
const T = W.EpirusTrainer;
const SB = T.economyReward().stockBonus, HP = T.economyReward().hoardPen;
let fail = 0;
const ok = (c, m) => { console.log((c ? '  ✔ ' : '  ✗ ') + m); if (!c) fail++; };

/* ---------- G1 默认关闭 ⇒ 与旧式逐位相同 ---------- */
function oldStock(mEp, n, mode, tv, cv) {
  const d = T.economyTargets(n, mode);
  const TT = Math.max(1, tv != null ? tv : d.target);
  const CC = Math.max(TT, cv != null ? cv : d.cap);
  if (mEp <= TT) return SB * (mEp / TT);
  if (mEp <= CC) return SB;
  return SB - HP * Math.min(1, (mEp - CC) / CC);
}
let tot = 0, bad = 0;
for (const [n, mode] of [[3, 'multi'], [5, 'multi'], [4, 'multi'], [5, 'long'], [4, 'long']]) {
  for (const [tv, cv] of [[null, null], [3, 10], [5, 20], [4, 14]]) {
    /* 网格改了门槛，就必须**同时把门槛设进模块** —— 否则比的是"显式 T/C 的旧式" vs "默认 T/C 的新式"，
     * 那 586 个 DIFF 是本自检自己的 bug（第一版就踩了：n=3 默认 T=3，网格却按 T=5 算旧式）。 */
    /* setter 是"只覆盖非 null"的语义（`if (o.target != null)`）⇒ 传 null **不清**旧值，
     * 必须显式 `reset`。第一版没写这条，网格从第二格起就在拿"上一次的 T/C"比，多出 190 个假 DIFF。 */
    T.setEconomyReward({ reset: true });
    if (tv != null || cv != null) T.setEconomyReward({ target: tv, cap: cv });
    for (let mEp = 0; mEp <= 60; mEp += 0.5) {
      const a = oldStock(mEp, n, mode, tv, cv), b = T.economyStock(mEp, n, mode);
      tot++; if (Math.abs(a - b) > 1e-12) { bad++; if (bad <= 3) console.log(`    DIFF n=${n} ${mode} T=${tv} C=${cv} mEp=${mEp}: 旧${a} 新${b}`); }
    }
  }
}
ok(bad === 0, `G1 默认关闭：economyStock 与旧式在 ${tot} 个点上**逐位相同**（不同 ${bad} 个）`);
ok(T.economyReward().hoardOnLeftover === false && T.economyReward().convRatio === false && T.economyReward().hoardCapMult === 2,
  'G1b 三个开关的代码默认值 = 关 / 关 / 2（不设 env 时出厂行为不变）');

/* ---------- G2 打开后分得开 ---------- */
T.setEconomyReward({ reset: true });          // G2 必须在**默认门槛**下测（否则继承 G1 网格留下的 T/C）
T.setEconomyReward({ hoardOnLeftover: true });
const spent = T.economyStock(39.9, 5, 'multi', 0);      // 峰 ep 39.9、结束时钱全花掉
const hoard = T.economyStock(39.9, 5, 'multi', 38.9);   // 峰 ep 39.9、攥着 38.9 点死
ok(spent > hoard + 1e-9, `G2 打开余款惩罚：花光 ${spent.toFixed(4)} > 攥着 ${hoard.toFixed(4)}（旧口径两者同为 −0.0700）`);
const mid = T.economyStock(39.9, 5, 'multi', 12);       // 余款在 C=10 与 2C=20 之间 ⇒ 应有**斜率**
ok(Math.abs(mid - hoard) > 1e-9, `G2b 余款 12 与 38.9 也不同分（${mid.toFixed(4)} vs ${hoard.toFixed(4)}）⇒ 区间内有梯度`);
T.setEconomyReward({ hoardCapMult: 4 });
const m4 = T.economyStock(39.9, 5, 'multi', 38.9);
ok(m4 > hoard, `G2c 饱和点 2C→4C：余款 38.9 的罚分 −0.0700 → ${m4.toFixed(4)}（40~100 区间重新有斜率）`);
T.setEconomyReward({ hoardOnLeftover: false, convRatio: false, hoardCapMult: 2 });
ok(Math.abs(T.economyStock(39.9, 5, 'multi') - (-0.07)) < 1e-9, 'G2d 复位后回到旧值 −0.0700（setter 可逆）');

/* ---------- G3 env 单一来源接线 ---------- */
const env = readEconEnv({ EPIRUS_HOARD_LEFTOVER: '1', EPIRUS_CONV_RATIO: '1', EPIRUS_HOARD_CAP_MULT: '4' });
ok(env.hoardOnLeftover === true && env.convRatio === true && env.hoardCapMult === '4',
  'G3 三个 env 名被 readEconEnv 读出（键：' + ECON_ENV_KEYS.slice(-3).join(',') + '）');
const applied = T.setEconomyReward(env);
ok(applied.hoardOnLeftover === true && applied.convRatio === true && applied.hoardCapMult === 4,
  'G3b readEconEnv 的输出能原样喂进 setEconomyReward 并生效（worker 侧同一对函数）');
const rw = readFileSync('js/train/evo.js', 'utf8');
const miss = ECON_REWARD_KEYS.filter(k => rw.indexOf(k) < 0);
ok(miss.length === 0, 'G3c ECON_REWARD_KEYS 的每个键在 evo.js 里都有对应字段（缺：' + (miss.join(',') || '无') + '）');
const double = ['EPIRUS_HOARD_LEFTOVER', 'EPIRUS_CONV_RATIO', 'EPIRUS_HOARD_CAP_MULT']
  .filter(k => { try { return readFileSync('server/train-worker.mjs', 'utf8').indexOf(k) >= 0 || readFileSync('server/train-server.mjs', 'utf8').indexOf(k) >= 0; } catch (e) { return false; } });
ok(double.length === 0, 'G3d 三个新键**没有**第二处读取点（只在 econ-env.mjs 里被读；违规：' + (double.join(',') || '无）') );
T.setEconomyReward(env);   // 留开着给下面的打印
console.log('\n生效值：' + JSON.stringify(T.economyReward(), (k, v) => (typeof v === 'object' && v && v.at ? undefined : v)));
console.log(fail ? `\n✗ ${fail} 条不过` : '\n全部通过');
process.exit(fail ? 1 : 0);
