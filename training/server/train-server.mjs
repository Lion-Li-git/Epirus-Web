#!/usr/bin/env node
/* train-server.mjs —— 2.0 (obs6) 页面训练场本地 HTTP/SSE 服务
 *
 * 用法：node training/server/train-server.mjs [port=8787]
 *       node training/server/train-server.mjs --port=8787
 * 仅使用 Node 内置模块；通过 training/train.mjs 调度 pg / supfit 2.0 训练。
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

const argv = process.argv.slice(2);
const portFlag = argv.find((a) => a.startsWith('--port='));
const tokenFlag = argv.find((a) => a.startsWith('--token='));
const posPort = argv.find((a) => /^\d+$/.test(a));
const PORT = Math.max(1024, Math.min(65535, Number(portFlag ? portFlag.slice(7) : (posPort || 8787)) || 8787));
const TOKEN = tokenFlag ? tokenFlag.slice(8) : randomBytes(24).toString('hex');
if (!TOKEN) throw new Error('--token 不能为空');

const DEFAULT_UP = 'docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak';
const LATEST_OUT_REL = 'scratch/arms/ui-train-latest.bak';

let activeChild = null;
let stopPromise = null;
let lastOut = '';

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === 'null') return true;   // 本地双击 file:// 打开页面；仍必须带 token
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
}

function tokenOk(got) {
  const a = Buffer.from(String(got || ''));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestError(req, u, needToken) {
  const host = String((req.headers && req.headers.host) || '').toLowerCase();
  if (host !== '127.0.0.1:' + PORT && host !== 'localhost:' + PORT) return { code: 403, msg: 'Host 不允许' };
  const origin = String((req.headers && req.headers.origin) || '');
  if (!isAllowedOrigin(origin)) return { code: 403, msg: 'Origin 不允许' };
  if (needToken) {
    const got = (req.headers && req.headers['x-epirus-token']) || (u && u.searchParams.get('token')) || '';
    if (!tokenOk(got)) return { code: 401, msg: '训练令牌无效' };
  }
  return null;
}

function setCors(req, res) {
  const origin = req && req.headers ? String(req.headers.origin || '') : '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Epirus-Token');
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

export function validateTeacher(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (/^[A-Za-z0-9_-]+$/.test(t)) return t;
  const path = t.startsWith('pack:') ? t.slice(5) : t;
  const full = resolve(ROOT, path);
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
  if (!child) return Promise.resolve(false);
  if (child.exitCode != null || child.signalCode != null) return Promise.resolve(true);
  return new Promise((resolveStop) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.off('close', onClose);
      child.off('error', onError);
      resolveStop(ok);
    };
    const onClose = () => finish(true);
    const onError = () => finish(false);
    child.once('close', onClose);
    child.once('error', onError);
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch (e) { /* ignore */ }
      finish(false);
    }, 8000);
    try {
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
        killer.once('error', () => { try { child.kill('SIGTERM'); } catch (e) { /* ignore */ } });
      } else {
        child.kill('SIGTERM');
      }
    } catch (e) {
      finish(false);
    }
  });
}

function killActive() {
  if (stopPromise) return stopPromise;
  if (!activeChild) return Promise.resolve(false);
  const c = activeChild;
  stopPromise = killChildTree(c).then((ok) => {
    if (activeChild === c) activeChild = null;
    stopPromise = null;
    return ok;
  });
  return stopPromise;
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

async function handleTrain(req, res, q) {
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

  await killActive();

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

const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.tsv': 'text/tab-separated-values; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function resolveAppAsset(pathname) {
  let rel = '';
  if (pathname === '/app/' || pathname === '/app/index.html') rel = 'index.html';
  else if (pathname === '/app/champion-map' || pathname === '/app/champion-map/') rel = 'champion-map/index.html';
  else if (pathname.startsWith('/app/')) rel = pathname.slice(5);
  else return null;
  if (!rel || rel.includes('\\') || rel.includes('\0')) return null;
  if (rel !== 'index.html' && !/^(css|js|champion-map)\//.test(rel)) return null;
  if (rel === 'champion-map/archive' || rel.startsWith('champion-map/archive/')) return null;
  const full = resolve(ROOT, rel);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  if (!existsSync(full) || !statSync(full).isFile()) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1:' + PORT);
  const boundaryError = requestError(req, u, false);
  if (boundaryError) {
    sendJson(req, res, boundaryError.code, { ok: false, msg: boundaryError.msg });
    return;
  }
  if (req.method === 'OPTIONS') {
    setCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }
  /* 静态 UI 子资源只放行白名单目录（排除 champion-map/archive），无需每个 <script>/<link> 带 token；
   * 入口 HTML（/app /app/ /app/index.html）及全部训练 API 仍强制校验 token。 */
  const isAppEntry = u.pathname === '/app' || u.pathname === '/app/' || u.pathname === '/app/index.html';
  if (!isAppEntry && u.pathname.startsWith('/app/')) {
    if (req.method !== 'GET') { sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed' }); return; }
    const assetPath = resolveAppAsset(u.pathname);
    if (!assetPath) { sendJson(req, res, 404, { ok: false, msg: 'unknown endpoint: ' + u.pathname }); return; }
    const mime = STATIC_MIME[extname(assetPath).toLowerCase()] || 'application/octet-stream';
    setCors(req, res);
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    res.end(readFileSync(assetPath));
    return;
  }
  const authError = requestError(req, u, true);
  if (authError) {
    sendJson(req, res, authError.code, { ok: false, msg: authError.msg });
    return;
  }
  if (u.pathname === '/app') {
    if (req.method !== 'GET') { sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed' }); return; }
    const qs = u.searchParams.get('token') ? u.search : ('?token=' + encodeURIComponent(TOKEN));
    res.writeHead(302, { Location: '/app/' + qs, 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  if (u.pathname === '/app/' || u.pathname === '/app/index.html') {
    if (req.method !== 'GET') { sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed' }); return; }
    const htmlPath = resolveAppAsset(u.pathname);
    if (!htmlPath) { sendJson(req, res, 404, { ok: false, msg: 'index.html missing' }); return; }
    res.writeHead(200, { 'Content-Type': STATIC_MIME['.html'], 'Cache-Control': 'no-store' });
    res.end(readFileSync(htmlPath));
    return;
  }
  if (u.pathname === '/' || u.pathname === '/status') {
    if (req.method !== 'GET') { sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed' }); return; }
    if (u.pathname === '/' && !req.headers['x-epirus-token'] && /text\/html/i.test(String(req.headers.accept || ''))) {
      const tok = String(u.searchParams.get('token') || TOKEN);
      res.writeHead(302, { Location: '/app/?token=' + encodeURIComponent(tok), 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    sendJson(req, res, 200, { ok: true, engine: '2.0-obs6', active: !!activeChild, lastOut: lastOut || null });
    return;
  }
  if (u.pathname === '/reset') {
    if (req.method !== 'POST') {
      sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed: use POST /reset' });
      return;
    }
    const killed = await killActive();
    lastOut = '';
    sendJson(req, res, 200, { ok: true, stopped: killed });
    return;
  }
  if (u.pathname === '/champion') {
    if (req.method !== 'GET') { sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed' }); return; }
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
    if (req.method !== 'POST') {
      sendJson(req, res, 405, { ok: false, msg: 'Method Not Allowed: use POST /train' });
      return;
    }
    try {
      await handleTrain(req, res, u.searchParams);
    } catch (e) {
      if (!res.headersSent) sendJson(req, res, 500, { ok: false, msg: e.message });
      else res.end();
    }
    return;
  }
  sendJson(req, res, 404, { ok: false, msg: 'unknown endpoint: ' + u.pathname });
});

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log('[train-server] 2.0 obs6 本地训练服务已监听 http://127.0.0.1:' + PORT);
    console.log('[train-server] 浏览器打开 http://127.0.0.1:' + PORT + '/app/?token=' + TOKEN + ' （API 探活: /?token=' + TOKEN + '）');
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, async () => {
      await killActive();
      server.close(() => process.exit(0));
    });
  }
}
