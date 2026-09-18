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
