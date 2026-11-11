#!/usr/bin/env node
/* B 轴代表重测（11-11 夜 · 用户令"搞出好包之后尽早找代表重测 B 轴以及评分再调整"）
 *
 * 问题：图上 C=(A+B)/2 的 B 侧是 11-09 定的旧夹具三锚（KDG-B-Q-s13/FOCUS-Q-s13/Q-s47），
 *   obs5 时代的新冠军不在里面 ⇒ 907 枚 B 扫的 PB 全是"打旧天王"的读数（G5J-50 PB 0.94 一类）。
 * 设计：同一批代表包 × 两套夹具对扫，差值 = 刷分定量：
 *   O = 旧夹具（--exam=B 缺省，与图逐位同尺 ⇒ 顺带确定性对账：应与 coords 的 P2B 逐位同）
 *   N = 现役夹具（--champ=MSB2-R1S1494663071,OBS5-F-s13,Q-s47——两枚 2.0 现役最强 + 反墙锚照旧）
 * 读数行 champ 戳已由 exam-4n 印出（11-10 千问补丁），驱动器原样入表。
 *
 * 用法: node scratch/zcode-1111-bretest/b-retest.mjs [--jobs=4] [--rounds=100]
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const JOBS = Math.max(1, Number(arg('jobs', 4)));
const ROUNDS = Number(arg('rounds', 100));
const SEED = 77000;
const OUT = new URL('./b-retest-exam.tsv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/* 代表名单：new = obs5 时代产物（ledger 在册）；old = 图顶 + 低锚（路径从 coords 面板解析） */
const NEW = {
  'MSB2-R1S1494663071': 'docs/artifacts/night-adapt/MSB2-R1S1494663071.js',
  'MSB2-R2S103437527': 'docs/artifacts/night-adapt/MSB2-R2S103437527.js',
  'OBS5-F-s13': 'docs/artifacts/night-adapt/OBS5-F-s13.js',
  'OBS5-F-s41': 'docs/artifacts/night-adapt/OBS5-F-s41.js',
};
const OLD_IDS = ['G5J-50', 'G5C-100', 'v7b-48', 'CTRL2-Q-s7', 'WSEL9-200', 'ADAPT2-Q-s7', 'KDG-B-Q-s13', 'B-s63'];
const co = readFileSync('champion-map/coords-gen3-1105.tsv', 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map((l) => l.split('\t'));
const ch = Object.fromEntries(co[0].map((x, i) => [x, i]));
const OLD = {};
for (const id of OLD_IDS) {
  const r = co.find((r) => r[ch.id] === id);
  if (!r || !r[ch.path]) { console.error('⛔ coords 里取不到 ' + id + ' 的 path'); process.exit(2); }
  OLD[id] = r[ch.path];
}
const REPS = Object.assign({}, NEW, OLD);
const FIXTURES = {
  O: [],                                                          /* 旧夹具 = exam-4n 缺省（在册三锚） */
  N: ['MSB2-R1S1494663071', 'OBS5-F-s13', 'Q-s47'],               /* 现役夹具 = 两枚 2.0 现役最强 + 反墙锚 */
};
const NS = [2, 3, 5, 8], W4 = [0.15, 0.25, 0.45, 0.15];
const x4 = (o) => NS.reduce((s, _, i) => s + W4[i] * o['x' + NS[i]], 0);

if (existsSync(OUT)) { console.error('⛔ ' + OUT + ' 已存在 ⇒ 先删再跑'); process.exit(2); }
writeFileSync(OUT, ['id', 'fixture', 'champ', 'x2', 'x3', 'x5', 'x8', 'X4PB', 'h2', 'sec'].join('\t') + '\n', 'utf8');

const jobs = [];
let done = 0;
const total = Object.keys(REPS).length * Object.keys(FIXTURES).length;
function runOne(id, fx) {
  return new Promise((res) => {
    const args = [String(ROUNDS), String(SEED), REPS[id], '--exam=B', '--dose=exam'];
    if (FIXTURES[fx].length) args.push('--champ=' + FIXTURES[fx].join(','));
    execFile(process.execPath, ['tools/exam-4n.mjs', ...args], { encoding: 'utf8', maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
      const line = (stdout || '').split(/\r?\n/).find((l) => l.indexOf('[冠军4N-B]') === 0);
      if (!line) {
        console.error('[' + (++done) + '/' + total + '] ⛔ ' + id + '/' + fx + ' 无读数：' + ((stderr || err && err.message || '').split('\n')[0] || '').slice(0, 160));
        appendFileSync(OUT, [id, fx, 'FAIL', '', '', '', '', '', '', ''].join('\t') + '\n', 'utf8');
        return res();
      }
      const get = (k) => { const m = line.match(new RegExp(' ' + k + '=(\\S+)')); return m ? m[1] : ''; };
      const o = {}; for (const n of NS) o['x' + n] = +get('x' + n);
      const row = [id, fx, get('champ'), ...NS.map((n) => o['x' + n]), x4(o).toFixed(4), get('h2'), get('sec')];
      appendFileSync(OUT, row.join('\t') + '\n', 'utf8');
      console.error('[' + (++done) + '/' + total + '] ' + id + '/' + fx + ' X̄₄PB=' + x4(o).toFixed(4) + ' champ=' + get('champ'));
      res();
    });
  });
}
for (const id of Object.keys(REPS)) for (const fx of Object.keys(FIXTURES)) jobs.push({ id, fx });
const queue = jobs.slice();
await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
  while (queue.length) { const j = queue.shift(); await runOne(j.id, j.fx); }
}));
console.error('完成：' + done + '/' + total + ' → ' + OUT);
