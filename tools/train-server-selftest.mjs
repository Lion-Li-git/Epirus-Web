import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { validateTeacher } from '../training/server/train-server.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = 18991;
const TOKEN = 'epirus-selftest-token';
const BASE = 'http://127.0.0.1:' + PORT;

assert.equal(validateTeacher('toolkit'), 'toolkit');
assert.equal(validateTeacher('pack:docs/artifacts/PG-DR.bak'), 'pack:docs/artifacts/PG-DR.bak');
assert.equal(validateTeacher('pack:docs/artifacts/not-here.bak'), null);
assert.equal(validateTeacher('pack:../outside.bak'), null);

const child = spawn(process.execPath, ['training/server/train-server.mjs', '--port=' + PORT, '--token=' + TOKEN], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (c) => { stderr += String(c); });

async function waitReady() {
  for (let i = 0; i < 50; i++) {
    if (child.exitCode != null) throw new Error('train-server 提前退出：' + stderr);
    try {
      const r = await fetch(BASE + '/', { headers: { 'X-Epirus-Token': TOKEN } });
      if (r.ok) return;
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('train-server 启动超时：' + stderr);
}

async function status(path, opts) {
  const r = await fetch(BASE + path, opts);
  return r.status;
}

try {
  await waitReady();
  assert.equal(await status('/'), 401);
  assert.equal(await status('/app/'), 401);
  assert.equal(await status('/', { headers: { Origin: 'https://evil.example', 'X-Epirus-Token': TOKEN } }), 403);
  assert.equal(await status('/', { headers: { Origin: 'null' } }), 401);
  assert.equal(await status('/', { headers: { Origin: 'null', 'X-Epirus-Token': TOKEN } }), 200);
  const redir = await fetch(BASE + '/?token=' + TOKEN, { headers: { Accept: 'text/html' }, redirect: 'manual' });
  assert.equal(redir.status, 302);
  assert.equal(redir.headers.get('location'), '/app/?token=' + TOKEN);
  const appHtml = await fetch(BASE + '/app/?token=' + TOKEN);
  assert.equal(appHtml.status, 200);
  assert.match(String(appHtml.headers.get('content-type') || ''), /text\/html/);
  assert.match(await appHtml.text(), /Epirus|epirus/);
  assert.equal(await status('/app/css/style.css'), 200);
  assert.equal(await status('/app/docs/RULES-2P.md'), 404);
  assert.equal(await status('/app/champion-map/archive/'), 404);
  assert.equal(await status('/train', { headers: { 'X-Epirus-Token': TOKEN } }), 405);
  assert.equal(await status('/reset', { method: 'POST', headers: { 'X-Epirus-Token': TOKEN } }), 200);
  const bad = await fetch(BASE + '/train?up=docs/artifacts/not-here.bak', {
    method: 'POST',
    headers: { 'X-Epirus-Token': TOKEN },
  });
  assert.equal(bad.status, 200);
  assert.match(await bad.text(), /起点包不存在/);
  console.log('TRAIN-SERVER SELFTEST OK');
} finally {
  if (child.exitCode == null) {
    child.kill();
    await Promise.race([once(child, 'exit'), new Promise((r) => setTimeout(r, 3000))]);
  }
}
