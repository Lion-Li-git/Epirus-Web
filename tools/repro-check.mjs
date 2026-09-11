/* tools/repro-check.mjs — 可复现性看门狗（千问建议）
 *
 * 用法: node tools/repro-check.mjs [gens=60] [n=3] [seed=42] [port=8830]
 *
 * 检查三件事：
 *   A) 同 seed 连跑两次          → 权重哈希应相同（同机可复现）
 *   B) 同 seed、不同 worker 数   → 权重哈希应相同（跨机可复现的前提）
 *   C) 不同 seed                 → 权重哈希应不同（证明种子真的生效，防"空验证"）
 *
 * ⚠️ 会临时覆写 js/bundled-champion-3p.js —— 跑完无论成败都会还原。
 * ⚠️ 只比对 **权重数组 a** 的哈希，不比对整文件：冠军文件里有
 *    ts: new Date().toISOString()（META），整文件哈希必然每次不同。
 *    这一点曾让我们误判"训练不可复现"（见 CHANGELOG v1.3.36）。
 */
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const GENS = Number(process.argv[2] || 60);
const N = Number(process.argv[3] || 3);
const SEED = Number(process.argv[4] || 42);
const PORT = Number(process.argv[5] || 8830);
const CHAMP = 'js/bundled-champion-3p.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function weightsHash(file) {
  const src = readFileSync(file, 'utf8');
  const m = src.match(/window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!m) return null;
  const pk = JSON.parse(m[1]);
  return {
    a: createHash('sha1').update(JSON.stringify(pk.a)).digest('hex').slice(0, 16),
    v: pk.v, f: pk.f, len: pk.a.length,
  };
}

/* 启停服务器：用 pwsh Start-Process（本会话验证可靠）；Node 的 spawn 在沙箱里不可靠。
 * 收尸按命令行匹配端口，**不做全局杀进程**。 */
function killServer(port) {
  const ps = "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*train-server*" + port + "*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }";
  try { spawnSync('pwsh', ['-NoProfile', '-Command', ps], { stdio: 'ignore' }); } catch (e) { }
}
async function startServer(workers, port) {
  killServer(port);
  await sleep(300);
  const env = Object.assign({}, process.env);
  const pre = workers ? ('$env:EPIRUS_WORKERS=' + workers + '; ') : '';
  const cmd = pre + "Start-Process -FilePath node -ArgumentList 'server/train-server.mjs','" + port + "' -WorkingDirectory '" + process.cwd() + "' -WindowStyle Hidden";
  spawnSync('pwsh', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    await sleep(300);
    try { const r = await fetch('http://127.0.0.1:' + port + '/'); if (r.status) return true; } catch (e) { }
  }
  throw new Error('服务器未就绪（port=' + port + '）');
}

async function trainOnce(seed) {
  const url = `http://127.0.0.1:${PORT}/train?gens=${GENS}&n=${N}&pop=8&gpo=6&fresh=1&seed=${seed}`;
  /* SSE 流不会在 done 之后关闭 ⇒ 不能 res.text()（会 body timeout）。
   * 改为增量读，看到 done / error 立刻 abort。 */
  const ac = new AbortController();
  const res = await fetch(url, { signal: ac.signal });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buf += dec.decode(chunk.value, { stream: true });
      const err = (buf.match(/"type":"error","msg":"([^"]*)"/) || [])[1];
      if (err) { ac.abort(); throw new Error('训练报错: ' + err); }
      if (/"type":"done"/.test(buf)) { ac.abort(); break; }
    }
  } catch (e) {
    if (!/abort/i.test(String(e && e.message))) throw e;
  }
}

async function main() {
  if (!existsSync(CHAMP)) { console.error('找不到 ' + CHAMP); process.exit(2); }
  const backup = readFileSync(CHAMP, 'utf8');
  const results = [];
  let fail = 0;
  try {
    const runs = [
      { label: 'A1 同 seed 第 1 遍   ', seed: SEED, workers: null },
      { label: 'A2 同 seed 第 2 遍   ', seed: SEED, workers: null },
      { label: 'B1 同 seed workers=2 ', seed: SEED, workers: 2 },
      { label: 'B2 同 seed workers=8 ', seed: SEED, workers: 8 },
      { label: 'C  不同 seed (seed+1)', seed: SEED + 1, workers: null },
    ];
    let curWorkers = '__unset__';   // 不能用 null：第一项的 workers 也是 null，会导致 startServer 永不触发（本工具的第一个 bug）
    for (const run of runs) {
      if (run.workers !== curWorkers) { await startServer(run.workers, PORT); curWorkers = run.workers; }
      await trainOnce(run.seed);
      const h = weightsHash(CHAMP);
      if (!h) { console.error('  ✘ ' + run.label + ' 冠军解包失败'); fail++; continue; }
      results.push(Object.assign({}, run, h));
      console.log('  ' + run.label + ' 权重sha=' + h.a + '  v=' + h.v + ' f=' + h.f + ' len=' + h.len);
    }
    const g = (i) => results[i] && results[i].a;
    const ck = (name, ok) => { console.log((ok ? '  ✔ ' : '  ✘ ') + name); if (!ok) fail++; };
    console.log('');
    ck('A 同 seed 同 worker 数：两次权重一致', g(0) && g(0) === g(1));
    ck('B 同 seed 跨 worker 数(2 vs 8)：权重一致', g(0) && g(0) === g(2) && g(0) === g(3));
    ck('C 不同 seed：权重应不同（防"种子没生效"的空验证）', g(0) && g(0) !== g(4));
  } finally {
    killServer(PORT);
    try { writeFileSync(CHAMP, backup, 'utf8'); } catch (e) { }
  }
  console.log('\nREPRO-CHECK ' + (fail ? 'FAILED' : 'OK') + '  (gens=' + GENS + ' n=' + N + ' seed=' + SEED + ')');
  process.exit(fail ? 1 : 0);
}
main();
