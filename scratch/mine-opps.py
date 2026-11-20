# -*- coding: utf-8 -*-
"""mine-opps.py —— dsh 会话里挖 /train?opps= 完整名单（含 POOL 变量定义）
用法：python -I scratch/mine-opps.py <zstd路径> [输出]
"""
import io, re, sys, subprocess

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
f = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else None
r = subprocess.run(['python', '-I', '-c',
    "import zstandard,sys;sys.stdout.reconfigure(encoding='utf-8',errors='replace');"
    "sys.stdout.buffer.write(zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb'),read_across_frames=True).read())",
    f], capture_output=True, timeout=300)
t = r.stdout.decode('utf-8', errors='replace')
print('size_kb', len(t) // 1024)
seen = set()
rows = []
# ① 变量定义（POOL=/B=/A= 指向 opps 名单）
for m in re.finditer(r'(POOL|A|B|L|P2|POOL2|BASE)\s*=\s*["\']?(random,balanced[^"\';&\n]{40,600})', t):
    s = m.group(2).replace('\\n', ' ').strip()
    k = s[:120]
    if k in seen:
        continue
    seen.add(k)
    rows.append(('VAR ' + m.group(1), s))
# ② /train URL（完整）
for m in re.finditer(r'/train\?[^\\`"\']{30,900}', t):
    s = m.group(0)
    k = s[:160]
    if k in seen:
        continue
    seen.add(k)
    rows.append(('URL', s))
for tag, s in rows[:60]:
    print('---', tag)
    print(s[:600])
if out:
    io.open(out, 'w', encoding='utf-8', newline='\n').write('\n'.join('%s\t%s' % (a, b) for a, b in rows))
    print('→', out, len(rows))
