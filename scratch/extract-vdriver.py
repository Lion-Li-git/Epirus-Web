# -*- coding: utf-8 -*-
"""extract-vdriver.py —— 从千问 A 级名单提取某段的 JSON content 原文（手工扫描器，不用正则）
用法：python -I scratch/extract-vdriver.py <段名> [输出文件]
"""
import io, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
t = io.open('scratch/qoder-1120-recipemine/missing-A-commands.txt', encoding='utf-8', errors='replace').read()
sec = sys.argv[1]
i = t.find('### ' + sec)
if i < 0:
    print('段未找到:', sec)
    sys.exit(2)
j = t.find('### ', i + 5)
seg = t[i:j if j > 0 else len(t)]
KEY = '"content":"'
out = []
k = 0
while True:
    i2 = seg.find(KEY, k)
    if i2 < 0:
        break
    p = i2 + len(KEY)
    buf = []
    while p < len(seg):
        c = seg[p]
        if c == '\\' and p + 1 < len(seg):
            buf.append(seg[p:p + 2])
            p += 2
            continue
        if c == '"':
            break
        buf.append(c)
        p += 1
    raw = ''.join(buf)
    try:
        s = raw.encode('utf-8').decode('unicode_escape', errors='replace')
    except Exception as e:
        s = raw
    out.append(s)
    k = p
print('content 数:', len(out))
for n, s in enumerate(out):
    print('===== %d (len %d) =====' % (n, len(s)))
    print(s[:6000])
if len(sys.argv) > 2:
    io.open(sys.argv[2], 'w', encoding='utf-8', newline='\n').write('\n\n@@@@@@\n\n'.join(out))
    print('→', sys.argv[2])
