#!/usr/bin/env node
/* session-mine.mjs —— 四 harness 会话记录挖掘：把历届 agent 班次跑过的训练/工具命令从会话原文里挖出来（2026-11-20 深夜升格）
 *
 * 为什么要有：11-19 清理事故后 662 枚权重缺失，其中大量可用「会话原文里的原始命令」逐位复现——
 *   OBS6-LH6 / LH6P / V3S2 三枚 B 轴锚就是这么救回来的（白班 32 发全错，原文第一发即中）。
 *   会话原文散在四家 harness 各自的存储里，本机是唯一入口。
 *
 * 用法：
 *   node tools/session-mine.mjs --harness=gemini [--brain=<uuid|all>] [--out=目录]
 *   node tools/session-mine.mjs --harness=zcode
 *   node tools/session-mine.mjs --harness=dsh    （需 python zstandard：pip install zstandard）
 *   node tools/session-mine.mjs --harness=qoder  （logs 目录，尚未有命中案例，先探路）
 *   通用旗标：--pattern=<子串>（默认挖 node training|tools 命令行）--context=<首现上下文字符数>
 *
 * 各 harness 的会话原文位置（本机实测）：
 *   gemini: C:/Users/14765/.gemini/antigravity/brain/<uuid>/.system_generated/logs/transcript_full.jsonl
 *           （chunks/transcript/0000*.jsonl 存更早分片；conversation_summaries.db 是索引）
 *   zcode:  C:/Users/14765/.zcode/cli/db/db.sqlite（表 message/part，data 列含全文；python sqlite3 读）
 *   dsh:    C:/Users/14765/.dsh/sessions/<项目>/<会话>/session.v4.jsonl.zstd（zstd 压缩）
 *   qoder:  C:/Users/14765/.qoder-cn/logs/sessions/<项目路径转义>/…
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { rejectUnknownFlags } from './audit-lib.mjs';
if (process.argv[1] && process.argv[1].endsWith('session-mine.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['harness', 'brain', 'out', 'pattern', 'context', 'limit'], 'session-mine');
}
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const HARNESS = arg('harness', 'gemini');
const OUTDIR = arg('out', 'scratch/session-mined');
const PATTERN = arg('pattern', 'node (training|tools)[^\\n"\'`\\\\]{0,700}');
const CTX = Number(arg('context', 0) || 0);
const LIMIT = Number(arg('limit', 60) || 60);
mkdirSync(OUTDIR, { recursive: true });
const RE = new RegExp(PATTERN, 'g');

function extract(tag, txt) {
  const hits = [];
  let m;
  const re = new RegExp(PATTERN, 'g');
  while ((m = re.exec(txt)) && hits.length < LIMIT) hits.push(m[0].replace(/\\+/g, '/'));
  if (!hits.length) return 0;
  const dedup = [...new Set(hits.map(h => h.slice(0, 120)))].map(k => hits.find(h => h.startsWith(k)));
  const name = (tag.replace(/[^\w.-]/g, '_')) + '.txt';
  writeFileSync(join(OUTDIR, name), dedup.join('\n'));
  console.log('  ' + tag.slice(0, 52) + ' → ' + dedup.length + ' 条');
  if (CTX) {
    const i = txt.indexOf(dedup[0].slice(0, 40));
    if (i >= 0) console.log(txt.slice(Math.max(0, i - CTX), i + CTX).replace(/\\n/g, '\n').slice(0, CTX * 2));
  }
  return dedup.length;
}

let total = 0;
if (HARNESS === 'gemini') {
  const BRAIN = 'C:/Users/14765/.gemini/antigravity/brain';
  const brains = readdirSync(BRAIN).filter(d => statSync(join(BRAIN, d)).isDirectory());
  const want = arg('brain', 'all');
  for (const b of brains) {
    if (want !== 'all' && !b.startsWith(want)) continue;
    const f = join(BRAIN, b, '.system_generated/logs/transcript_full.jsonl');
    if (!existsSync(f)) continue;
    total += extract(b.slice(0, 8), readFileSync(f, 'utf8'));
  }
} else if (HARNESS === 'zcode') {
  /* db.sqlite 的 message/part 存 JSON 转义文本 —— 用 python 直查再喂本进程 */
  const py = `import sqlite3,re,sys\nsys.stdout.reconfigure(encoding='utf-8',errors='replace')\ndb=sqlite3.connect(r'C:/Users/14765/.zcode/cli/db/db.sqlite')\nfor (d,) in db.execute("SELECT data FROM part WHERE data LIKE '%node training%' OR data LIKE '%node tools%'"):\n    print(d)`;
  const txt = execSync(`python -I -c "${py.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, { maxBuffer: 1 << 28, encoding: 'utf8' });
  total += extract('zcode-db', txt);
} else if (HARNESS === 'dsh') {
  const ROOT = 'C:/Users/14765/.dsh/sessions';
  for (const p of readdirSync(ROOT).filter(d => !d.startsWith('.'))) {
    const pdir = join(ROOT, p);
    for (const s of readdirSync(pdir)) {
      const f = join(pdir, s, 'session.v4.jsonl.zstd');
      if (!existsSync(f)) continue;
      try {
        const txt = execSync(`python -I -c "import zstandard,sys; sys.stdout.reconfigure(encoding='utf-8',errors='replace'); sys.stdout.buffer.write(zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb'),read_across_frames=True).read())" "${f}"`, { maxBuffer: 1 << 28, encoding: 'utf8' });
        total += extract(p.slice(0, 24) + '__' + s.slice(0, 24), txt);
      } catch (e) { console.log('  ✗ ' + s.slice(0, 20) + ': ' + String(e.message).slice(0, 60)); }
    }
  }
} else if (HARNESS === 'qoder') {
  const ROOT = 'C:/Users/14765/.qoder-cn/logs/sessions';
  for (const p of readdirSync(ROOT)) {
    const pdir = join(ROOT, p);
    for (const s of readdirSync(pdir)) {
      const f = join(pdir, s);
      if (!statSync(f).isFile()) continue;
      try { total += extract(p.slice(0, 30) + '__' + s.slice(0, 20), readFileSync(f, 'utf8')); } catch (e) { /* 二进制/压缩件跳过 */ }
    }
  }
} else { console.error('⛔ --harness 只认 gemini|zcode|dsh|qoder'); process.exit(2); }
console.log('合计 ' + total + ' 条 → ' + OUTDIR);
