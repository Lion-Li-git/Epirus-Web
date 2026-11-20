# -*- coding: utf-8 -*-
"""ctx.py —— zstd 会话中关键字前几处命中的上下文（不看去重上限）
用法：python -I scratch/ctx.py <zstd路径> <关键字> [段数=3]
"""
import io, re, sys, subprocess

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
f, kw = sys.argv[1], sys.argv[2]
maxseg = int(sys.argv[3]) if len(sys.argv) > 3 else 3
r = subprocess.run(['python', '-I', '-c',
    "import zstandard,sys;sys.stdout.reconfigure(encoding='utf-8',errors='replace');"
    "sys.stdout.buffer.write(zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb'),read_across_frames=True).read())",
    f], capture_output=True, timeout=300)
t = r.stdout.decode('utf-8', errors='replace')
n = 0
for m in re.finditer(re.escape(kw), t):
    if n >= maxseg:
        break
    n += 1
    s = t[max(0, m.start() - 700):m.start() + 500].replace('\\n', '\n').replace('\\r', '')
    print('=== @', m.start())
    print(s[-1100:])
    print()
