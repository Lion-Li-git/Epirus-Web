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

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === 'null') return true;   // 本地双击 file:// 打开页面
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
}

function setCors(req, res) {
  const origin = req && req.headers ? String(req.headers.origin || '') : '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(req, res, code, obj) {
  setCors(req, res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function numParam(q, key, fallback) {
  const raw = q.get(key);
  if (raw == null || String(raw).trim() === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

function resolveInsideRoot(relOrPath) {
  const raw = String(relOrPath || '').trim() || DEFAULT_UP;
  const full = resolve(ROOT, raw);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

function validateTeacher(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (/^[A-Za-z0-9_-]+$/.test(t)) return t;
  const full = resolve(ROOT, t);
  if ((full !== ROOT && !full.startsWith(ROOT + sep)) || !existsSync(full)) return null;
  return t;
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

function killChildTree(child) {
  if (!child) return false;
  try {
    if (process.platform === 'win32' && child.pid) {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      killer.unref();
    } else {
      child.kill('SIGTERM');
    }
    return true;
  } catch (e) {
    return false;
  }
}

function killActive() {
  if (!activeChild) return false;
  const c = activeChild;
  activeChild = null;
  return killChildTree(c);
}

function parseStepLine(mode, line, stepsPerRound, totalAll) {
  if (mode === 'pg') {
    const m = /局\s+(\d+)\s+‖\s+步\s+(\d+)\s+‖\s+平均净分\s+([-\d.]+)/.exec(line);
    if (m) {
      return {
        step: Number(m[1]),
        upd: Number(m[2]),
        total: totalAll,
        best: Number(m[3]),
      };
    }
  } else {
    const m = /步\s+(\d+)(?:（轮\s+(\d+)）)?\s+‖\s+训练加权似然\s+([-\d.]+)(?:.*?top-1\s+([\d.]+)%)?/.exec(line);
    if (m) {
      const localStep = Number(m[1]);
      const round = m[2] != null ? Number(m[2]) : 0;
      const agree = m[4] != null ? Number(m[4]) / 100 : null;
      return {
        step: round * stepsPerRound + localStep,
        localStep,
        round,
        total: totalAll,
        best: agree != null ? agree : Number(m[3]),
        ll: Number(m[3]),
        agree,
      };
    }
  }
  return null;
}

function handleTrain(req, res, q) {
  const sseError = (msg) => {
    setCors(req, res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('data: ' + JSON.stringify({ type: 'error', msg }) + '\n\n');
    res.end();
  };

  const modeRaw = String(q.get('mode') || 'pg').trim();
  const mode = (modeRaw === 'supfit' || modeRaw === 'distill') ? 'supfit' : 'pg';
  const upRaw = String(q.get('up') || q.get('upstream') || DEFAULT_UP).trim();
  const upAbs = resolveInsideRoot(upRaw);
  if (!upAbs || !existsSync(upAbs)) {
    sseError('起点包不存在或路径越界：' + upRaw);
    return;
  }

  const outAbs = resolve(ROOT, LATEST_OUT_REL);
  mkdirSync(dirname(outAbs), { recursive: true });

  const seed = numParam(q, 'seed', mode === 'pg' ? 7 : 20261031);
  const cmdArgs = ['training/train.mjs', '--mode=' + mode, '--out=' + LATEST_OUT_REL, '--tag=ui-server', '--seed=' + seed];
  let stepsPerRound = 0;
  let total = 0;

  if (mode === 'pg') {
    const games = Math.max(1000, numParam(q, 'games', numParam(q, 'gens', 2000)));
    const batch = Math.max(8, numParam(q, 'batch', 48));
    const lr = numParam(q, 'lr', 0.0003);
    const shapeKey = String(q.get('shapeKey') || '').trim();
    const klW = numParam(q, 'klW', 0);
    const klTilt = String(q.get('klTilt') || '').trim();
    total = games;
    cmdArgs.push('--up=' + upRaw, '--games=' + games, '--batch=' + batch, '--lr=' + lr);
    if (shapeKey) cmdArgs.push('--shapeKey=' + shapeKey);
    if (Number.isFinite(klW) && klW > 0) cmdArgs.push('--klW=' + klW);
    if (klTilt) cmdArgs.push('--klTilt=' + klTilt);
  } else {
    const steps = Math.max(10, numParam(q, 'steps', numParam(q, 'gens', 60)));
    const groups = Math.max(60, numParam(q, 'groups', numParam(q, 'batch', 600)));
    const lr = numParam(q, 'lr', 0.0004);
    const teacherRaw = String(q.get('teacher') || 'toolkit').trim() || 'toolkit';
    const teacher = validateTeacher(teacherRaw);
    if (!teacher) {
      sseError('teacher 不合法或文件不存在/路径越界：' + teacherRaw);
      return;
    }
    const teacher2Raw = String(q.get('teacher2') || '').trim();
    let teacher2 = '';
    if (teacher2Raw) {
      teacher2 = validateTeacher(teacher2Raw);
      if (!teacher2) {
        sseError('teacher2 不合法或文件不存在/路径越界：' + teacher2Raw);
        return;
      }
    }
    const teacher2frac = numParam(q, 'teacher2frac', 0.5);
    const winOnly = numParam(q, 'winOnly', 0);
    const obj = String(q.get('objective') || 'cand').trim() || 'cand';
    const dagger = Math.max(0, Math.min(6, numParam(q, 'dagger', 1)));
    stepsPerRound = steps;
    total = steps * (dagger + 1);
    cmdArgs.push(
      '--upstream=' + upRaw,
      '--steps=' + steps,
      '--groups=' + groups,
      '--lr=' + lr,
      '--teacher=' + teacher,
      '--objective=' + obj,
      '--dagger=' + dagger
    );
    if (teacher2) cmdArgs.push('--teacher2=' + teacher2, '--teacher2frac=' + teacher2frac);
    if (winOnly === 1 || winOnly === 2) cmdArgs.push('--winOnly=' + winOnly);
  }

  killActive();

  setCors(req, res);
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
      const parsed = parseStepLine(mode, line, stepsPerRound, total);
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
      activeChild = null;
      killChildTree(child);
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
    setCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }
  const u = new URL(req.url || '/', 'http://127.0.0.1:' + PORT);
  if (u.pathname === '/' || u.pathname === '/status') {
    sendJson(req, res, 200, { ok: true, engine: '2.0-obs6', active: !!activeChild, lastOut: lastOut || null });
    return;
  }
  if (u.pathname === '/reset') {
    if (req.method !== 'POST') {
      sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed: use POST /reset' });
      return;
    }
    const killed = killActive();
    lastOut = '';
    sendJson(req, res, 200, { ok: true, stopped: killed });
    return;
  }
  if (u.pathname === '/champion') {
    const latestAbs = resolve(ROOT, LATEST_OUT_REL);
    const targetRel = existsSync(latestAbs) ? LATEST_OUT_REL : DEFAULT_UP;
    const targetAbs = resolve(ROOT, targetRel);
    try {
      const ext = extractPackFromBak(targetAbs);
      if (!ext) { sendJson(req, res, 404, { ok: false, msg: '未找到可用 2.0 冠军包' }); return; }
      sendJson(req, res, 200, { ok: true, champion: ext.champion, meta: ext.meta, path: targetRel });
    } catch (e) {
      sendJson(req, res, 500, { ok: false, msg: e.message });
    }
    return;
  }
  if (u.pathname === '/train') {
    handleTrain(req, res, u.searchParams);
    return;
  }
  sendJson(req, res, 404, { ok: false, msg: 'unknown endpoint: ' + u.pathname });
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
