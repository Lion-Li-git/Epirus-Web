#!/usr/bin/env node
/* recipe-index.mjs —— 批量重产工作清单：四 harness 会话全量挖 `--out=` 命令，对上缺失台账（2026-11-20 深夜升格）
 *
 * 为什么要有：657 枚缺失权重盘上无源，唯一复产路线 = 会话挖掘原始命令 + era worktree 复跑。
 *   本工具把"哪些缺失包已经有原始命令"一次挖全（11-20 实战：64910 条命令 → 11 枚缺失包命中，
 *   含 UNIFIED-U1/U4、EQ-E9-A1、GD3-SWORD、KD 线——其中 dsh/gemini 各贡献 4 条，zcode 5 条）。
 *
 * 用法：
 *   node tools/recipe-index.mjs                       # 全量挖 → scratch/session-mined/recipe-index.tsv
 *   node tools/recipe-index.mjs --ledger=docs/ARTIFACT-LOSS-1119.tsv --out=scratch/session-mined
 *
 * 产出 TSV 列：id \t harness \t command（同一包多 harness 命中全保留；同 harness 内按前 120 字符去重）。
 * 已知边界：
 *   - qoder 已定性（11-20）：segments/*.jsonl 是生命周期遥测、projects/*.jsonl 全是别项目对话——千问从未在本仓跑训练，0 命中是真答案，非解析缺口。
 *   - 命令里的产物名用 basename 匹配台账 id（.bak/.js 后缀剥掉）；路径别名（scratch/arms vs docs/artifacts）不影响。
 *   - 复产纪律照 docs/RECOVERY-TOOLKIT.md §5：era worktree + wid 试金，别拿重构命令硬试。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { rejectUnknownFlags } from './audit-lib.mjs';
if (process.argv[1] && process.argv[1].endsWith('recipe-index.mjs')) {
  rejectUnknownFlags(process.argv.slice(2), ['ledger', 'out'], 'recipe-index');
}
const arg = (k, d) => { const a = process.argv.find(x => x.indexOf('--' + k + '=') === 0); return a ? a.slice(k.length + 3) : d; };
const LEDGER = arg('ledger', 'docs/ARTIFACT-LOSS-1119.tsv');
const OUT = arg('out', 'scratch/session-mined');
mkdirSync(OUT, { recursive: true });

const cmds = [];   /* {h, cmd} */
const PAT = /node (training|tools|champion-map)[^\n"'`\\]{0,900}/g;
function harvest(tag, txt) {
  let m;
  const re = new RegExp(PAT);
  while ((m = re.exec(txt))) cmds.push({ h: tag, cmd: m[0].replace(/\\+/g, '/') });
}
/* zcode db.sqlite 的 JSON 转义全文 —— python 直查（for 循环没法 -c 单行，落临时脚本再跑，shell 转义老坑） */
const PY = 'import sqlite3,sys\nsys.stdout.reconfigure(encoding=\'utf-8\',errors=\'replace\')\ndb=sqlite3.connect(r\'C:/Users/14765/.zcode/cli/db/db.sqlite\')\nfor (d,) in db.execute("SELECT data FROM part WHERE data LIKE \'%node training%\' OR data LIKE \'%node tools%\' OR data LIKE \'%node champion-map%\'"):\n    print(d)';
writeFileSync('scratch/.recipe-index-zcode.py', PY);

console.log('挖 harness …');
for (const h of ['gemini', 'zcode', 'dsh', 'qoder']) {
  const before = cmds.length;
  try {
    if (h === 'zcode') {
      harvest('zcode', execSync('python -I scratch/.recipe-index-zcode.py', { maxBuffer: 1 << 29, encoding: 'utf8' }));
    } else if (h === 'dsh') {
      const ROOT = 'C:/Users/14765/.dsh/sessions';
      for (const p of readdirSync(ROOT).filter(d => !d.startsWith('.'))) {
        for (const s of readdirSync(ROOT + '/' + p)) {
          const f = `${ROOT}/${p}/${s}/session.v4.jsonl.zstd`;
          if (!existsSync(f)) continue;
          try {
            harvest('dsh', execSync(`python -I -c "import zstandard,sys;sys.stdout.reconfigure(encoding='utf-8',errors='replace');sys.stdout.buffer.write(zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb'),read_across_frames=True).read())" "${f}"`, { maxBuffer: 1 << 29, encoding: 'utf8' }));
          } catch { /* 跳过坏件 */ }
        }
      }
    } else if (h === 'gemini') {
      const BRAIN = 'C:/Users/14765/.gemini/antigravity/brain';
      for (const b of readdirSync(BRAIN)) {
        const f = `${BRAIN}/${b}/.system_generated/logs/transcript_full.jsonl`;
        if (existsSync(f)) harvest('gemini', readFileSync(f, 'utf8'));
        const CH = `${BRAIN}/${b}/.system_generated/logs/chunks/transcript`;
        if (existsSync(CH)) for (const c of readdirSync(CH)) harvest('gemini', readFileSync(CH + '/' + c, 'utf8'));
      }
    } else if (h === 'qoder') {
      const ROOT = 'C:/Users/14765/.qoder-cn/logs/sessions';
      for (const p of readdirSync(ROOT)) {
        const pdir = `${ROOT}/${p}`;
        let ents; try { ents = readdirSync(pdir); } catch { continue; }
        for (const s of ents) {
          try { harvest('qoder', readFileSync(`${pdir}/${s}`, 'utf8')); } catch { /* 二进制/压缩件跳过 */ }
        }
      }
    }
    console.log(`  ${h}: +${cmds.length - before} 条`);
  } catch (e) { console.log(`  ${h}: ✗ ${String(e.message).slice(0, 80)}`); }
}
console.log('合计命令 ' + cmds.length);

/* 对缺失台账：--out=<产物> basename → id 匹配 */
const led = readFileSync(LEDGER, 'utf8').replace(/\r/g, '').split('\n');
const lh = led[0].split('\t');
const lix = Object.fromEntries(lh.map((c, i) => [c, i]));
const missing = led.slice(1).filter(Boolean).map(l => l.split('\t')).filter(r => r[lix.state] === 'missing');
const missIds = new Set(missing.map(r => r[lix.id]));

const byId = new Map();
cmds.forEach((c) => {
  const m = c.cmd.match(/--out=([^\s]+)/);
  if (!m) return;
  const base = m[1].split('/').pop().replace(/\.(bak|js)$/, '');
  if (!missIds.has(base)) return;
  if (!byId.has(base)) byId.set(base, []);
  byId.get(base).push(c);
});
console.log('缺失 ' + missIds.size + ' 枚里，挖到原始命令的：' + byId.size + ' 枚');
const rows = ['id\tharness\tcommand'];
for (const [id, list] of [...byId].sort((a, b) => a[0].localeCompare(b[0]))) {
  const seen = new Set();
  for (const { h, cmd } of list) {
    const key = cmd.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(id + '\t' + h + '\t' + cmd);
  }
}
writeFileSync(OUT + '/recipe-index.tsv', rows.join('\n') + '\n');
console.log('→ ' + OUT + '/recipe-index.tsv（' + (rows.length - 1) + ' 行）‖ 下一步照 RECOVERY-TOOLKIT §5 复产（era worktree + wid 试金）');
