#!/usr/bin/env node
/* 全库重测 · 引擎纪元 120fca4d + 新轴（ZCode · 11-14 夜6班，用户令「先调整好轴再跑重测，不然就是白跑」）
 *
 * 背景：① 3a32e551 结算规则修复 ⇒ 指纹 668081a2 → 120fca4d，地图三根 current 尺全是旧引擎纪元；
 *   ② 11-14 用户令换轴：A 轴 = 原 28 席脚本轮**保留** + 配合剧本局追加（--coop=v3，exam-coop.mjs，
 *      用户点名两典型：藤甲+坦克天火集火 ‖ 给攒大招的角色套盾）；B 轴 = 风格互补五夹具 F5
 *      （MSB11-R2 蓄爆锚 ‖ MSB14 枪炮反击 ‖ WSEL9-200 广度 ‖ MSB15R-HITMIX 反墙 ‖ GD6a-TILT 蒸馏三线）
 *      替换旧 F2（三 charge 一杂 = 风格太偏，11-11 夜班判「B 轴风格倾向太明显」）。
 * 本驱动把 registry 全部在盘包 × {B page ‖ B exam(Δε 半边) ‖ A page+coop} × {multi,long} 重测；
 *   ingest 时换 current 指针（换尺只追加 readings + 改指针，rulers.mjs 契约）。
 *   seed/rounds 与旧批一致（100/77000）⇒ 跨纪元读数可配对，差值里只剩「引擎代+轴代」。
 *   ⚠ C=(A+B)/2 在 A/B 两根都换新后由 build-view 重算（不混纪元）。
 *
 * 用法：node scratch/zcode-1113-deps/rerun-1114.mjs [--concurrency=6] [--pass=Bpage|Bexam|Apage]
 *   产物（断点续跑：重跑自动跳过已完成的 id|mode）：
 *     exam4-F5-page-1114.tsv / -long   → 新 B 尺 b-f5-page-1114（夹具 F5）
 *     exam4-F5-eps0-1114.tsv / -long   → 新 X 尺 b-f5-eps0-1114（Δε 配对半边，同 F5）
 *     exam4-A-coop-1114.tsv / -long    → 新 A 尺 a-v2coop-page-1114（原轮 + coop 追加局）
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';

const arg = (k, d) => { const a = process.argv.find((x) => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const CONC = Math.max(1, Number(arg('concurrency', 6)) || 6);
const ONLY = String(arg('pass', '')).toUpperCase();
const F5 = 'MSB11-R2S306293884,MSB14-railgun-R1S175656469,WSEL9-200,MSB15R-HITMIX,GD6a-TILT';
const OUTDIR = 'scratch/zcode-1113-deps';
const HEAD = ['id', 'h2', 'h3', 'h5', 'h8', 'x2', 'x3', 'x5', 'x8', 'n2', 'n3', 'n5', 'n8', 'seed', 'rounds', 'mode', 'dose', 'exam', 'pool', 'champ', 'sec'];

const PASSES = [
  { key: 'Bpage', base: 'exam4-F5-page-1114',  exam: 'B', dose: 'page', champ: F5, line: '[冠军4N-B]' },
  { key: 'Bexam', base: 'exam4-F5-eps0-1114',  exam: 'B', dose: 'exam', champ: F5, line: '[冠军4N-B]' },
  { key: 'Apage', base: 'exam4-A-coop-1114',   exam: 'A', dose: 'page', champ: null, coop: true, line: '[冠军4N]' },
].filter((p) => !ONLY || p.key.toUpperCase() === ONLY);
if (!PASSES.length) { console.error('⛔ --pass 只认 Bpage/Bexam/Apage'); process.exit(2); }

/* registry 在盘包（与 eps0 全量批同一枚举口径） */
const reg = readFileSync('champion-map/data/registry.tsv', 'utf8').replace(/\r/g, '').trim().split('\n').map((l) => l.split('\t'));
const h = Object.fromEntries(reg[0].map((x, i) => [x, i]));
const packs = reg.slice(1).filter((r) => r[h.path] && existsSync(r[h.path]));
console.log('registry 在盘包 ' + packs.length + ' 枚 ‖ 并发 ' + CONC + ' ‖ 待跑 pass: ' + PASSES.map((p) => p.key).join(' → '));

const secSum = { n: 0, t: 0 };
function runPass(pass, done) {
  return new Promise((resolvePass) => {
    const fileM = OUTDIR + '/' + pass.base + '.tsv';
    const fileL = OUTDIR + '/' + pass.base + '-long.tsv';
    for (const [f, mode] of [[fileM, 'multi'], [fileL, 'long']]) {
      if (!existsSync(f)) appendFileSync(f, HEAD.join('\t') + '\n');
      else for (const l of readFileSync(f, 'utf8').split('\n').slice(1)) { if (l.trim()) done.add(pass.key + '|' + l.split('\t')[0] + '|' + mode); }
    }
    const jobs = [];
    for (const r of packs) for (const mode of ['multi', 'long']) {
      const key = pass.key + '|' + r[h.pack_id] + '|' + mode;
      if (!done.has(key)) jobs.push({ id: r[h.pack_id], path: r[h.path], mode });
    }
    console.log('▶ pass ' + pass.key + '：' + jobs.length + ' 跑待做（已跳过 ' + (packs.length * 2 - jobs.length) + '）');
    if (!jobs.length) return resolvePass();
    let cursor = 0, ok = 0, fail = 0, finished = 0;
    const t0 = Date.now();
    function fmtEta() {
      const el = (Date.now() - t0) / 1000, per = el / Math.max(1, ok + fail);
      return '均 ' + per.toFixed(1) + 's/跑 ‖ 剩余 ≈ ' + ((jobs.length - ok - fail) * per / 3600).toFixed(2) + 'h';
    }
    function worker() {
      if (cursor >= jobs.length) return;
      const job = jobs[cursor++];
      const args = ['tools/exam-4n.mjs', '100', '77000', job.path, '--exam=' + pass.exam, '--dose=' + pass.dose];
      if (pass.champ) args.push('--champ=' + pass.champ);
      if (pass.coop) args.push('--coop=v3');
      if (job.mode === 'long') args.push('--mode=long');
      const attempt = (n) => execFile(process.execPath, args, { maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
        if (err || !(stdout || '').includes(pass.line)) {
          if (n < 1) return attempt(n + 1);   /* 瞬态失败重试一次 */
          fail++; return after();
        }
        const line = (stdout || '').split('\n').find((l) => l.startsWith(pass.line));
        const get = (k) => { const m = line.match(new RegExp('[ hnxpkc]' + k + '=([^ ]+)')); return m ? m[1] : ''; };
        const sec = parseFloat(get('sec'));
        if (isFinite(sec)) { secSum.n++; secSum.t += sec; }
        const row = [job.id, get('h2'), get('h3'), get('h5'), get('h8'), get('x2'), get('x3'), get('x5'), get('x8'),
          get('n2'), get('n3'), get('n5'), get('n8'), '77000', '100', job.mode === 'long' ? 'long' : 'multi(默认)',
          pass.dose, pass.exam, get('pool'), pass.champ || get('champ'), get('sec')];
        appendFileSync(job.mode === 'long' ? fileL : fileM, row.join('\t') + '\n');
        ok++; after();
      });
      attempt(0);
    }
    function after() {
      finished = ok + fail;
      if (finished % 50 === 0 || finished === jobs.length) console.log('[' + pass.key + ' ' + finished + '/' + jobs.length + '] ✔' + ok + ' ✘' + fail + ' ‖ ' + fmtEta());
      if (finished === jobs.length) {
        console.log('■ pass ' + pass.key + ' 完成：✔' + ok + ' ✘' + fail + ' ‖ 全程 ' + ((Date.now() - t0) / 3600000).toFixed(2) + 'h ‖ 均 sec ' + (secSum.n ? (secSum.t / secSum.n).toFixed(1) : '-'));
        if (fail) console.log('  ✘ 失败清单：重跑本驱动可续（失败的 id|mode 不在 tsv 里会自动重试）');
        resolvePass();
      } else worker();
    }
    for (let i = 0; i < CONC; i++) worker();
  });
}

(async () => {
  const done = new Set();
  const t0 = Date.now();
  for (const pass of PASSES) await runPass(pass, done);
  console.log('★ 全部 pass 完成 ‖ 总耗时 ' + ((Date.now() - t0) / 3600000).toFixed(2) + 'h ⇒ 下一步 ingest（换 current 指针 + readings 追加 + attach-cmean-r + rebuild-map）');
})();
