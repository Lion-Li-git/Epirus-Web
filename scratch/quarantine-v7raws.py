# -*- coding: utf-8 -*-
"""quarantine-v7raws.py —— e370-out 剩余 v7 时代原件挪隔离 + dupes-manifest 登记 move 行
"""
import io, json, os, re, shutil, hashlib

Q = 'D:/code/Epirus-Web-artifacts-quarantine/cleanup-2026-11-20'
PAIRS = [('0d61340a', 'docs/artifacts/v7force2-35.bak'), ('213e6f32', 'docs/artifacts/v7teach2-31.bak'),
         ('30724115', 'docs/artifacts/incumbent-forpromote.bak'), ('3dedd628', 'docs/artifacts/v7n1-31.bak'),
         ('65207cc7', 'docs/artifacts/v7tgt2-52.bak'), ('81057cb2', 'docs/artifacts/v7press-36.bak'),
         ('c7a69570', 'docs/artifacts/v7new5_005-31.bak'), ('cab48220', 'docs/artifacts/v7wall-33.bak'),
         ('de80959d', 'docs/artifacts/long-33.bak'), ('f020ce0e', 'docs/artifacts/v7a-35.bak')]
BS = chr(92)


def wid_of(path):
    t = io.open(path, encoding='utf-8').read()
    KEY = 'EPIRUS_CHAMPION_3P'
    i = t.find(KEY)
    while i >= 0:
        after = t[i + len(KEY):i + len(KEY) + 4]
        if re.match(r'^\s*=', after):
            a = t.find('{', i)
            depth = 0
            end = -1
            inS = False
            esc = False
            for j in range(a, len(t)):
                c = t[j]
                if inS:
                    if esc:
                        esc = False
                    elif c == BS:
                        esc = True
                    elif c == '"':
                        inS = False
                    continue
                if c == '"':
                    inS = True
                elif c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if not depth:
                        end = j
                        break
            o = json.loads(t[a:end + 1])
            if isinstance(o.get('a'), list):
                return hashlib.sha1(json.dumps(o['a']).encode()).hexdigest()[:16]
        i = t.find(KEY, i + 1)
    return None


man = io.open('champion-map/dupes-manifest.tsv', encoding='utf-8').read().rstrip('\n').split('\n')
n = 0
for w8, canon in PAIRS:
    rel = 'docs/artifacts/e370-out/%s.js' % w8
    if not os.path.exists(rel):
        continue
    dest = Q + '/' + rel
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    wid = wid_of(rel) or w8
    shutil.move(rel, dest)
    man.append('\t'.join([wid, 'move', rel, canon, '', '0', 'disk', dest.replace(BS, '/')]))
    n += 1
io.open('champion-map/dupes-manifest.tsv', 'w', encoding='utf-8', newline='\n').write('\n'.join(man) + '\n')
print('挪+登记', n, '件')
