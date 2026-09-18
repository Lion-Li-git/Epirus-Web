/* 通宵臂批跑（v1.5.116 · 第三方复核者）—— L2′ 的 A/B/C 三臂，**同一配置只差开关**
 *
 * 为什么这三个臂：docs/OPTIMIZATION-ep-cliff.md §5 的判据是三条一起看
 *   （终局余 ep ↓ · A 卷不掉 · 出手/回合 ↑），而 §4 的读码显示"余 ep 惩罚挂在 maxEp、conv 2 次封顶、
 *   2C 处夹住"三处各自都能造成"资源线无梯度"⇒ 必须**逐个开关单独开一臂**，
 *   否则全开出一个好产物也不知道是哪一项起的作用（同族教训：附录 D 臂 K 的 A/A）。
 *
 * 共同配置 = 上一轮 arm A 的池与环境，但**去掉 imit 教师**（arm A 开了 `IMIT_OVERRIDE=0.5`，
 *   那会覆盖 50% 的早期决策 ⇒ 把 shaping 的效应糊在教师示范里，测不干净）。
 *
 * 用法（bash）：
 *   node tools/l2-arms.mjs            # 三臂顺序跑（每臂 6 seed × 250 代 ≈ 11 分钟）
 *   L2_ARMS=f node tools/l2-arms.mjs  # 只跑指定臂（c=对照 / h=只开余款 / f=全开）
 * 产物：docs/artifacts/v7l2{c,h,f}-<seed>.bak；进度 tail docs/artifacts/l2-arms-status.log
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(root, 'docs', 'artifacts');
const STATUS = join(ART, 'l2-arms-status.log');
const POOL = 'random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver,'
  + 'ringspam,reflectspam,guardspam,targeter,gunspam';      // = 池 E + gunspam（与 arm A 同 17 名）
const SEEDS = process.env.L2_SEEDS || '81,82,91,92,93';       // 31 由 runner 常备 ⇒ 每臂 6 seed
const COMMON = {
  EPIRUS_CLEAR_W: '0.05', EPIRUS_TRAIN_SEAT_GAMES: '24',
  RING2_POOL: POOL, RING2_SEEDS: SEEDS, RING2_STAGE: 'train', RING2_GENS: '250',
};
const ARMS = [
  { key: 'c', arm: 'v7l2c', tag: 'l2c', env: {}, note: '对照：三个开关全关（应当与"改码前"同分布）' },
  { key: 'h', arm: 'v7l2h', tag: 'l2h', env: { EPIRUS_HOARD_LEFTOVER: '1' }, note: '只把囤积惩罚换成终局余款' },
  { key: 'f', arm: 'v7l2f', tag: 'l2f', env: { EPIRUS_HOARD_LEFTOVER: '1', EPIRUS_CONV_RATIO: '1', EPIRUS_HOARD_CAP_MULT: '4' }, note: '余款 + 比率化兑现 + 4C（全开）' },
  /* 第二组（批次 2）：这组测的是**相反方向**的病。`probe-leftover.mjs` 实测两包的病方向相反
   * ⇒ 线上包是"攒不到就花光"（兑现率 94%、余 ep 0.9、峰 ep 2），对它而言"余款惩罚"是空操作。
   * 所以单独开一臂只抬**攒钱奖励上限** `STOCK_BONUS 0.05 → 0.15`，直接检验
   * "奖惩不对称才是环学不出来的阻力"这句话（不检验它就永远只是一条评论）。 */
  { key: 's', arm: 'v7l2s', tag: 'l2s', env: { EPIRUS_STOCK_BONUS: '0.15' }, note: '只抬攒钱奖励上限（治"攒不到就花光"那一侧）' },
  /* 批次 2 的关键臂（`t`）：**arm A 的原配置**（deepSaver 真示范 0.5）+ 三个开关。
   * 为什么必须带着教师跑：`v7l2c` vs `v7l2h` 实测出**无教师配置根本不产出囤积包**
   * （对照自己就兑现 97~99%、余 ep 0.2~0.5，而门槛在 C=10 ⇒ 罚不到）⇒ seed 91 两臂长出**逐位相同**的冠军。
   * 囤积是 `IMIT_TEACHER=pickDeepSaver` + `IMIT_OVERRIDE=0.5` 注入的（deepSaver = "86% ジ 攒钱"），
   * 所以 L2′-① 的正确实验对象就是 arm A 那套配方。它的对照 = 已训好的 `v7ringA1-*`，不用重跑。 */
  { key: 't', arm: 'v7l2a', tag: 'l2a',
    env: { EPIRUS_HOARD_LEFTOVER: '1', EPIRUS_CONV_RATIO: '1', EPIRUS_HOARD_CAP_MULT: '4',
      EPIRUS_IMIT_TEACHER: 'pickDeepSaver', EPIRUS_IMIT_OVERRIDE: '1', EPIRUS_IMIT_FRAC: '0.5' },
    note: 'arm A 原配置（deepSaver 真示范）+ 三个开关 ⇒ 看能不能把兑现率 23% 治上去' },
  { key: 'b', arm: 'v7l2b', tag: 'l2b', env: { EPIRUS_STOCK_BONUS: '0.15', EPIRUS_HOARD_LEFTOVER: '1', EPIRUS_CONV_RATIO: '1', EPIRUS_HOARD_CAP_MULT: '4' }, note: '攒与花**同时**给斜率（两侧一起治）' },
];
const want = (process.env.L2_ARMS || 'c,h,f').split(',').map(s => s.trim()).filter(Boolean);
writeFileSync(STATUS, '# L2′ 臂批跑（tools/l2-arms.mjs）· 池 = E+gunspam(17) · CLEAR_W=0.05 · SEAT_GAMES=24 · 无 imit 教师\n');
for (const a of ARMS) {
  if (!want.includes(a.key)) continue;
  const t0 = Date.now();
  appendFileSync(STATUS, `\n[${new Date().toISOString()}] === 臂 ${a.arm} 开跑：${a.note}\n  env: ${JSON.stringify(a.env)}\n`);
  const r = spawnSync(process.execPath, ['tools/ring2-run.mjs'], {
    cwd: root, env: Object.assign({}, process.env, COMMON, a.env, { RING2_ARM: a.arm, RING2_TAG: a.tag }),
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  appendFileSync(STATUS, out.split(/\r?\n/).filter(l => /seed|DONE|产物|health|⛔|失败|Error/.test(l)).join('\n') + '\n');
  appendFileSync(STATUS, `[${new Date().toISOString()}] 臂 ${a.arm} 结束 status=${r.status} 用时 ${((Date.now() - t0) / 1000 / 60).toFixed(1)} 分钟\n`);
}
appendFileSync(STATUS, `\n[${new Date().toISOString()}] 全部臂结束\n`);
console.log('L2 arms done — tail docs/artifacts/l2-arms-status.log');
