/* Epirus — Node 快速训练器（并行加速：worker_threads 多核跑评估）。
 * 用法：node tools/train-fast.mjs [世代数=500] [worker数=auto]
 * 产物：js/bundled-champion.js —— 一个设置 window.EPIRUS_CHAMPION 的脚本，页面自动加载作为回退冠军。
 * 好处：并行后 500 代可在几十秒内出强冠军（视 CPU 核心数）；训练完直接随项目分发，双击即玩。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { makeAsyncStep } from '../server/paralleltrain.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const sb = { console, Math, JSON, Object, Array, Number, String, Error,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
sb.globalThis = sb;
for (const f of ['js/core/rules.js','js/core/state.js','js/core/resolve.js','js/core/play.js','js/train/bots.js','js/train/policy.js','js/train/evo.js','js/train/trainer.js']) {
  vm.runInNewContext(readFileSync(join(root, f), 'utf8'), sb, { filename: f });
}
const T = sb.EpirusTrainer, P = sb.EpirusPolicy;

const gens = Number(process.argv[2] || 500);
const workers = Number(process.argv[3]) || 0;
const stepAsync = makeAsyncStep(T, workers ? { workers: workers } : {});
console.log('[parallel] 训练 worker 数：' + stepAsync.workers);
const t = T.makeTrainer({ popSize: 16, gamesPerOpp: 6 });
const t0 = Date.now();
let last;
for (let g = 0; g < gens; g++) last = await stepAsync(t);
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const pack = JSON.stringify(P.pack(t.champion));
writeFileSync(join(root, 'js', 'bundled-champion.js'),
  '/* Epirus 内置冠军：由 tools/train-fast.mjs 生成（' + gens + ' 代，' + secs + 's）。不要手改。 */\n' +
  'window.EPIRUS_CHAMPION = ' + pack + ';\n', 'utf8');
console.log(`训练完成 ${gens} 代，用时 ${secs}s；冠军 score=${t.bestChampScore.toFixed(3)}，attackShare=${(t.bestChampAttack||0).toFixed(2)}`);
console.log('已写入 js/bundled-champion.js（' + pack.length + ' 字节）');
stepAsync.close();   // 关停 worker 池，让进程正常结束（否则 worker 会让进程挂住）
