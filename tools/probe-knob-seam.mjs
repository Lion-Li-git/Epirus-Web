/* tools/probe-knob-seam.mjs —— 旋钮「作用点开火」对照屏（qoder 09-22 · §N12）
 *
 * 要治的病：**setter 活着、作用点断了**。v1.5.159 把 `EPIRUS_PASSIVE_FIELD` 从"宿主读不到"修成"读得到"，
 * 但当天下午的臂 v7xn11a 与 DS 的 7′ **5689 维产物逐位相同** —— 因为注入的判据要查 `BOT_PICKS['farmer']`，
 * 而那张表从来没有这个键（`js/train/evo.js:1210`）。横幅会打印"消费点读回 0.34"，可**读回的是变量、不是效果**。
 * 本屏不读代码、不问横幅：同一受控种子只改一个键，比**两次跑的全部可见产物**——
 *   ① 逐代 bestFit / 名人堂 trainFit 轨迹，② 带内每一粒候选的权重哈希（`EPIRUS_BAND_DIR` 指临时目录，不欠 D82 的账），
 *   ③ 终产物权重哈希。
 * 三者全同 ⇒ 这个键在本预算下**一个评估局面都没改变** ⇒ 拿它跑出来的"读数"不许当实验结果。
 *
 * ⚠️ 只看 ③ 会误判"活" ⇒ 反向也会误判"死"：实测 `XN2REF`/`XN2SCRIPTS` 与 base 的**终产物逐位相同**
 *    （3 代小预算下冠军没收敛到同一个体是巧合、hall 里本来就有重复粒），但轨迹完全不同。所以 ①②③ 一起比。
 *
 * 用法：node tools/probe-knob-seam.mjs [--gens=3] [--games=6] [--pop=4] [--n=3]
 * 它会覆盖 docs/artifacts/train-3p-out.js（本来就是一次性产物），别的什么都不写。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const arg = (k, d) => { const m = new RegExp('--' + k + '=(\\S+)').exec(process.argv.slice(2).join(' ')); return m ? m[1] : d; };
const GENS = arg('gens', '3'), N = arg('n', '3'), GAMES = arg('games', '6'), POP = arg('pop', '4');
const SEED = '7';
const ROOT = process.cwd();
const SEEDPACK = existsSync(ROOT + '/docs/artifacts/v7cmin4-31.bak') ? 'docs/artifacts/v7cmin4-31.bak'
  : (existsSync(ROOT + '/js/bundled-champion.js') ? 'js/bundled-champion.js' : null);

/* 每行 = {标签, 试验组 env, 对照组 env}。对照组不重复跑：同一份 env 前缀哈希命中就复用。 */
const ROWS = [
  ['EPIRUS_XN2W', {}, { EPIRUS_XN2W: '1' }],
  ['EPIRUS_XN2G', { EPIRUS_XN2W: '1' }, { EPIRUS_XN2W: '1', EPIRUS_XN2G: '1' }],
  ['EPIRUS_XN2REF', { EPIRUS_XN2W: '1' }, SEEDPACK ? { EPIRUS_XN2W: '1', EPIRUS_XN2REF: SEEDPACK } : null],
  ['EPIRUS_XN2SCRIPTS', { EPIRUS_XN2W: '1' }, { EPIRUS_XN2W: '1', EPIRUS_XN2SCRIPTS: '1' }],
  ['EPIRUS_CLEAR_W', {}, { EPIRUS_CLEAR_W: '1' }],
  ['EPIRUS_KILL_FIELD', {}, { EPIRUS_KILL_FIELD: '0.2' }],
  ['EPIRUS_PASSIVE_FIELD', {}, { EPIRUS_PASSIVE_FIELD: '1' }],
  ['EPIRUS_PASSIVE_FIELD(=0)', {}, { EPIRUS_PASSIVE_FIELD: '0' }],
  ['EPIRUS_ANCHOR(冷启动)', {}, { EPIRUS_ANCHOR: '3' }],
  ['EPIRUS_ANCHOR(热启动)', { EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: SEEDPACK || '' },
  SEEDPACK ? { EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: SEEDPACK, EPIRUS_ANCHOR: '3' } : null],
  ['EPIRUS_HOTSTART', {}, SEEDPACK ? { EPIRUS_HOTSTART: '1', EPIRUS_SEEDPACK: SEEDPACK } : null],
];

const cache = new Map();
function signature(env, tag) {
  const key = JSON.stringify(env);
  if (cache.has(key)) return cache.get(key);
  const bandDir = tmpdir() + '/epi-seam-' + (tag || 'x').replace(/[^\w.-]/g, '_');
  rmSync(bandDir, { recursive: true, force: true }); mkdirSync(bandDir, { recursive: true });
  const r = spawnSync(process.execPath, ['tools/train-3p.mjs', GENS, N, GAMES, POP], {
    cwd: ROOT, encoding: 'utf8',
    env: Object.assign({}, process.env, env, { EPIRUS_SEED: SEED, EPIRUS_BAND_DIR: bandDir, EPIRUS_ARM: 'seam-probe' }),
    timeout: 900000,
  });
  const out = String(r.stdout || '') + String(r.stderr || '');
  const traj = (out.match(/^(?:gen .*|.*trainFit=.*)$/gm) || []).join('\n');
  const bands = readdirSync(bandDir).filter(f => f.endsWith('.bak')).sort().map(f => {
    const s = readFileSync(bandDir + '/' + f, 'utf8');
    const fit = (/trainFit":([-.\d eE]+)/.exec(s) || [, '?'])[1];
    const a = (/"a":\[([^\]]*)\]/.exec(s) || [, ''])[1];
    return fit + ':' + sha8(a);
  });
  const finalOut = ROOT + '/docs/artifacts/train-3p-out.js';
  const fin = sha8((/"a":\[([^\]]*)\]/.exec(existsSync(finalOut) ? readFileSync(finalOut, 'utf8') : '') || [, ''])[1]);
  rmSync(bandDir, { recursive: true, force: true });
  const sig = { rc: r.status, traj, bands, fin, banner: (out.match(/\[train-3p\].*/g) || []).join(' | ') };
  cache.set(key, sig);
  return sig;
}
function sha8(s) { return s ? createHash('sha1').update(s).digest('hex').slice(0, 8) : '-'; }

console.log('# 旋钮作用点开火对照屏（seed=' + SEED + ' · ' + GENS + ' 代 × ' + N + ' 人 × ' + GAMES + ' 局 × 种群 ' + POP + '）');
console.log('# 判据：轨迹 / 全部带内候选 / 终产物 三者**全同** ⇒ 该键一个评估局面都没改变 ⇒ 死作用点\n');
let dead = 0;
for (const [name, base, test] of ROWS) {
  if (!test) { console.log(name.padEnd(28) + ' 跳过（缺参照包）'); continue; }
  const a = signature(base, 'base'); const b = signature(test, 'test');
  const same = a.traj === b.traj && a.bands.join('|') === b.bands.join('|') && a.fin === b.fin;
  if (same) dead++;
  console.log(name.padEnd(28) + (same ? ' ✗ 未开火（与对照组逐位相同）' : ' ✓ 开火') +
    '   候选 ' + b.bands.length + ' 粒 · 终产物 ' + (same ? '==' : '!=') + ' ' + b.fin +
    (b.rc !== 0 ? '  ⚠️ exit=' + b.rc : ''));
  if (same) console.log('    横幅：' + (b.banner || '（无）').slice(0, 200));
}
console.log('\n# 合计：' + (ROWS.length - dead) + ' 个键确有作用 · ' + dead + ' 个键在本预算下**没有改变任何评估局面**。');
console.log('# 说明：本屏只能证"没作用"，不能替代码定位；判"死"之前先想清楚该键在此预算下**本该**起作用。');
process.exit(0);
