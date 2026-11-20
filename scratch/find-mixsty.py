# -*- coding: utf-8 -*-
"""find-mixsty.py —— 0add3d39 会话原文里 mix/sty 批的驱动上下文
用法：python -I scratch/find-mixsty.py <zstd路径>
"""
import io, re, sys, subprocess

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
f = sys.argv[1]
r = subprocess.run(['python', '-I', '-c',
    "import zstandard,sys;sys.stdout.reconfigure(encoding='utf-8',errors='replace');"
    "sys.stdout.buffer.write(zstandard.ZstdDecompressor().stream_reader(open(sys.argv[1],'rb'),read_across_frames=True).read())",
    f], capture_output=True, timeout=400)
t = r.stdout.decode('utf-8', errors='replace')
print('size_kb', len(t) // 1024)
pats = ['styleopps', 'stylew', 'sty-31', 'mix-31', 'champion-5p-hA9']
for p in pats:
    ms = list(re.finditer(re.escape(p), t))
    print('=== %s : %d hits' % (p, len(ms)))
    shown = set()
    for m in ms[:14]:
        seg = t[max(0, m.start() - 350):m.start() + 350]
        key = seg[300:380]
        if key in shown:
            continue
        shown.add(key)
        print('---')
        print(seg.replace('\\n', '\n').replace('\\r', ''))
