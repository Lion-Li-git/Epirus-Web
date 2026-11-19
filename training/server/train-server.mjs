#!/usr/bin/env node
/* train-server.mjs —— 2.0 (obs6) 页面训练场本地 HTTP/SSE 服务
 *
 * 用法：node training/server/train-server.mjs [port=8787]
 *       node training/server/train-server.mjs --port=8787
 * 仅使用 Node 内置模块；通过 training/train.mjs 调度 pg / supfit 2.0 训练。
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const argv = process.argv.slice(2);
const portFlag = argv.find((a) => a.startsWith('--port='));
const posPort = argv.find((a) => /^\d+$/.test(a));
const PORT = Math.max(1024, Math.min(65535, Number(portFlag ? portFlag.slice(7) : (posPort || 8787)) || 8787));

const DEFAULT_UP = 'docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak';
const LATEST_OUT_REL = 'scratch/arms/ui-train-latest.bak';

let activeChild = null;
let lastOut = '';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, code, obj) {
  setCors(res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function resolveInsideRoot(relOrPath) {
  const raw = String(relOrPath || '').trim() || DEFAULT_UP;
  const full = resolve(ROOT, raw);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

function extractPackFromBak(filePath) {
  if (!existsSync(filePath)) return null;
  const txt = readFileSync(filePath, 'utf8');
  const mChamp = /window\.EPIRUS_CHAMPION_3P\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt);
  if (!mChamp) return null;
  const champion = JSON.parse(mChamp[1]);
  const mMeta = /window\.EPIRUS_CHAMPION_3P_META\s*=\s*(\{[\s\S]*?\})\s*;/.exec(txt);
  const meta = mMeta ? JSON.parse(mMeta[1]) : null;
  return { champion, meta };
}

function killActive() {
  if (!activeChild) return false;
  try { activeChild.kill('SIGTERM'); } catch (e) { /* ignore */ }
  activeChild = null;
  return true;
}

function parseStepLine(mode, line, total) {
  if (mode === 'pg') {
    const m = /局\s+(\d+)\s+‖\s+步\s+(\d+)\s+‖\s+平均净分\s+([-\d.]+)/.exec(line);
    if (m) {
      return {
        step: Number(m[1]),
        upd: Number(m[2]),
        total,
        best: Number(m[3]),
      };
    }
  } else {
    const m = /步\s+(\d+)(?:（轮\s+[^）]+）)?\s+‖\s+训练加权似然\s+([-\d.]+)(?:.*?top-1\s+([\d.]+)%)?/.exec(line);
    if (m) {
      const agree = m[3] != null ? Number(m[3]) / 100 : null;
      return {
        step: Number(m[1]),
        total,
        best: agree != null ? agree : Number(m[2]),
        ll: Number(m[2]),
        agree,
      };
    }
  }
  return null;
}

function handleTrain(req, res, q) {
  const modeRaw = String(q.get('mode') || 'pg').trim();
  const mode = (modeRaw === 'supfit' || modeRaw === 'distill') ? 'supfit' : 'pg';
  const upRaw = String(q.get('up') || q.get('upstream') || DEFAULT_UP).trim();
  const upAbs = resolveInsideRoot(upRaw);
  if (!upAbs || !existsSync(upAbs)) {
    setCors(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('data: ' + JSON.stringify({ type: 'error', msg: '起点包不存在或路径越界：' + upRaw }) + '\n\n');
    res.end();
    return;
  }

  killActive();

  const outAbs = resolve(ROOT, LATEST_OUT_REL);
  mkdirSync(dirname(outAbs), { recursive: true });

  const seed = Number(q.get('seed') || (mode === 'pg' ? 7 : 20261031)) || 7;
  const cmdArgs = ['training/train.mjs', '--mode=' + mode, '--out=' + LATEST_OUT_REL, '--tag=ui-server', '--seed=' + seed];
  let total = 0;

  if (mode === 'pg') {
    const games = Math.max(1000, Number(q.get('games') || q.get('gens') || 2000) || 2000);
    const batch = Math.max(8, Number(q.get('batch') || 48) || 48);
    const lr = Number(q.get('lr') || 0.0003) || 0.0003;
    const shapeKey = String(q.get('shapeKey') || '').trim();
    const klW = Number(q.get('klW') || 0);
    const klTilt = String(q.get('klTilt') || '').trim();
    total = games;
    cmdArgs.push('--up=' + upRaw, '--games=' + games, '--batch=' + batch, '--lr=' + lr);
    if (shapeKey) cmdArgs.push('--shapeKey=' + shapeKey);
    if (Number.isFinite(klW) && klW > 0) cmdArgs.push('--klW=' + klW);
    if (klTilt) cmdArgs.push('--klTilt=' + klTilt);
  } else {
    const steps = Math.max(10, Number(q.get('steps') || q.get('gens') || 60) || 60);
    const groups = Math.max(60, Number(q.get('groups') || q.get('batch') || 600) || 600);
    const lr = Number(q.get('lr') || 0.0004) || 0.0004;
    const teacher = String(q.get('teacher') || 'toolkit').trim() || 'toolkit';
    const teacher2 = String(q.get('teacher2') || '').trim();
    const teacher2frac = Number(q.get('teacher2frac') || 0.5) || 0.5;
    const winOnly = Number(q.get('winOnly') || 0) || 0;
    const obj = String(q.get('objective') || 'cand').trim() || 'cand';
    const dagger = Number(q.get('dagger') || 1);
    total = steps;
    cmdArgs.push(
      '--upstream=' + upRaw,
      '--steps=' + steps,
      '--groups=' + groups,
      '--lr=' + lr,
      '--teacher=' + teacher,
      '--objective=' + obj,
      '--dagger=' + (Number.isFinite(dagger) ? dagger : 1)
    );
    if (teacher2) cmdArgs.push('--teacher2=' + teacher2, '--teacher2frac=' + teacher2frac);
    if (winOnly === 1 || winOnly === 2) cmdArgs.push('--winOnly=' + winOnly);
  }

  setCors(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const t0 = Date.now();
  const child = spawn(process.execPath, cmdArgs, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  activeChild = child;

  const sendEv = (payload) => {
    if (!res.writableEnded) res.write('data: ' + JSON.stringify(payload) + '\n\n');
  };

  sendEv({ type: 'start', mode, up: upRaw, total, out: LATEST_OUT_REL, cmd: 'node ' + cmdArgs.join(' ') });

  let buf = '';
  let errBuf = '';
  const flushLines = (chunk, isErr) => {
    const s = String(chunk);
    if (isErr) errBuf = (errBuf + s).slice(-2000);
    buf += s;
    const parts = buf.split(/\r?\n/);
    buf = parts.pop() || '';
    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line) continue;
      const parsed = parseStepLine(mode, line, total);
      if (parsed) {
        sendEv(Object.assign({ type: 'step', mode, line }, parsed));
      } else if (/^#|终|产物|判：|⚠|⛔|⚑/.test(line)) {
        sendEv({ type: 'log', mode, line });
      }
    }
  };

  child.stdout.on('data', (c) => flushLines(c, false));
  child.stderr.on('data', (c) => flushLines(c, true));

  let closed = false;
  req.on('close', () => {
    closed = true;
    if (activeChild === child) {
      try { child.kill('SIGTERM'); } catch (e) { /* ignore */ }
      activeChild = null;
    }
  });

  child.on('error', (err) => {
    if (activeChild === child) activeChild = null;
    if (!closed) {
      sendEv({ type: 'error', msg: '训练进程启动失败：' + err.message });
      res.end();
    }
  });

  child.on('close', (code) => {
    if (buf.trim()) flushLines('\n', false);
    if (activeChild === child) activeChild = null;
    if (closed) return;
    const secs = Number(((Date.now() - t0) / 1000).toFixed(1));
    if (code !== 0) {
      sendEv({ type: 'error', msg: '训练退出码 ' + code + (errBuf ? '：' + errBuf.trim().split(/\r?\n/).slice(-3).join(' | ') : '') });
      res.end();
      return;
    }
    try {
      const ext = extractPackFromBak(outAbs);
      if (!ext || !ext.champion) {
        sendEv({ type: 'error', msg: '训练已结束但未读取到 2.0 包外壳：' + LATEST_OUT_REL });
      } else {
        lastOut = LATEST_OUT_REL;
        sendEv({ type: 'done', mode, secs, champ: ext.champion, meta: ext.meta, out: LATEST_OUT_REL });
      }
    } catch (e) {
      sendEv({ type: 'error', msg: '解析输出包失败：' + e.message });
    }
    res.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  const u = new URL(req.url || '/', 'http://127.0.0.1:' + PORT);
  if (u.pathname === '/' || u.pathname === '/status') {
    sendJson(res, 200, { ok: true, engine: '2.0-obs6', active: !!activeChild, lastOut: lastOut || null });
    return;
  }
  if (u.pathname === '/reset') {
    const killed = killActive();
    lastOut = '';
    sendJson(res, 200, { ok: true, stopped: killed });
    return;
  }
  if (u.pathname === '/champion') {
    const latestAbs = resolve(ROOT, LATEST_OUT_REL);
    const targetRel = existsSync(latestAbs) ? LATEST_OUT_REL : DEFAULT_UP;
    const targetAbs = resolve(ROOT, targetRel);
    try {
      const ext = extractPackFromBak(targetAbs);
      if (!ext) { sendJson(res, 404, { ok: false, msg: '未找到可用 2.0 冠军包' }); return; }
      sendJson(res, 200, { ok: true, champion: ext.champion, meta: ext.meta, path: targetRel });
    } catch (e) {
      sendJson(res, 500, { ok: false, msg: e.message });
    }
    return;
  }
  if (u.pathname === '/train') {
    handleTrain(req, res, u.searchParams);
    return;
  }
  sendJson(res, 404, { ok: false, msg: 'unknown endpoint: ' + u.pathname });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[train-server] 2.0 obs6 本地训练服务已监听 http://127.0.0.1:' + PORT);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    killActive();
    server.close(() => process.exit(0));
  });
}
