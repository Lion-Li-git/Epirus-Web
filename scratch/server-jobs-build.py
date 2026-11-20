# -*- coding: utf-8 -*-
"""server-jobs-build.py —— 组 server 批回放任务表（era 候选列表版）
输出 scratch/v7-mined/server-jobs.tsv
"""
import io, subprocess, os

POOL_A = 'random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver'
POOL_B = POOL_A + ',ringspam'
POOL_C = POOL_B + ',reflectspam,guardspam'
DEF15 = POOL_A + ',reflectspam,guardspam,protowall'
L16 = POOL_B + ',reflectspam,guardspam,targeter'
L17 = L16 + ',gunspam'
L18 = POOL_B + ',reflectspam,guardspam,targeter,protomine,prototransfer'
L22 = POOL_B + ',targeter,gunspam,snipespam,gunspam,guardspam,gunfocus,gunfocus'
LADDER = {12: [POOL_A], 13: [POOL_B], 15: [POOL_C, DEF15], 16: [L16], 17: [L17], 18: [L18], 22: [L22]}

led = {}
with io.open('docs/ARTIFACT-LOSS-1119.tsv', encoding='utf-8') as f:
    f.readline()
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) >= 4:
            led[c[0]] = (c[2], c[1])
lin = {}
with io.open('champion-map/data/page/lineage.tsv', encoding='utf-8') as f:
    h = f.readline().rstrip('\n').split('\t')
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) >= 27:
            lin[c[0]] = {'seed': c[4], 'wid': c[9], 'ts': c[3], 'mode': c[25]}


def utc_to_local(ts):
    """lineage ts 是 UTC（def-31/eco-31/v12/mix/sty/V2-31 六处独立实证，sty 与会话墙钟 22:50:54 对上）；
    git --since/--before 按本地 +0800 解析 ⇒ 先 +8h 再喂。"""
    from datetime import datetime, timedelta
    try:
        t = datetime.strptime(ts.replace('T', ' ')[:19], '%Y-%m-%d %H:%M:%S') + timedelta(hours=8)
        return t.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return ts.replace('T', ' ')


def after_commits(ts, k=2):
    r = subprocess.run(['git', 'log', '--reverse', '--pretty=%h', '--since=' + utc_to_local(ts)],
                       capture_output=True, encoding='utf-8')
    return [x for x in (r.stdout or '').strip().split('\n') if x][:k]


def before_commit(ts):
    r = subprocess.run(['git', 'log', '-1', '--pretty=%h', '--before=' + utc_to_local(ts)],
                       capture_output=True, encoding='utf-8')
    return (r.stdout or '').strip()


def find_pack(wid):
    cands = ['docs/artifacts/e370-out/%s.js' % wid[:8], 'docs/artifacts/e370-out/%s-v7.js' % wid[:8]]
    with io.open('champion-map/data/registry.tsv', encoding='utf-8') as f:
        f.readline()
        for ln in f:
            c = ln.rstrip('\n').split('\t')
            if len(c) >= 9 and c[7].startswith(wid[:12]) and c[1]:
                cands.append(c[1])
                break
    cands.append('D:/code/Epirus-Web-artifacts-quarantine/cleanup-2026-11-20/docs/artifacts/e370-out/%s.js' % wid[:8])
    for p in cands:
        if os.path.exists(p):
            return p
    return ''


out = ['batch\tfam\tera\tarm\tseeds\topps\tmode\thot\tids\tpaths\ttargets']
n1 = n2 = 0
with io.open('scratch/v7-mined/server-batch-config.tsv', encoding='utf-8') as f:
    hdr = f.readline().rstrip('\n').split('\t')
    ixx = {x: i for i, x in enumerate(hdr)}
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) < 18:
            continue
        base = c[ixx['batch']]
        if base in ('mix', 'sty'):
            continue    # 专用驱动 scratch/replay-mixsty.mjs 已接管（会话原文配方，2026-11-21）
        ids = c[ixx['missing_ids']].split(',')
        tsmin = c[ixx['ts_min']]
        if not ids or tsmin == 'null' or not tsmin:
            continue
        seeds, paths, targets, ok_ids = [], [], [], []
        for pid in ids:
            L = lin.get(pid)
            if not L:
                continue
            if led.get(pid, ('?', ''))[0] != 'missing':
                continue
            seeds.append(L['seed'] or '0')
            paths.append(led.get(pid, ('?', pid))[1])
            targets.append(L['wid'])
            ok_ids.append(pid)
        if not ok_ids:
            continue
        mode = (c[ixx['mode']] if c[ixx['cfg_src']] == 'META' and c[ixx['mode']] else (lin.get(ok_ids[0], {}).get('mode') or 'multi'))
        # 根 = BASE（server 批恒用 champion-5p-v1.3.58——era runner 硬编码实证），hot 列留空走缺省
        if base == 'v9':
            eras = ['16b3854e'] + after_commits(tsmin, 2) + [before_commit(tsmin)]
        else:
            eras = after_commits(tsmin, 2) + [before_commit(tsmin)]
        seen = set()
        eras2 = []
        for e in eras:
            if e and e not in seen:
                seen.add(e)
                eras2.append(e)
        if not eras2:
            continue
        if c[ixx['cfg_src']] == 'META' and c[ixx['opps']]:
            opps = c[ixx['opps']]
            wave = 1
        else:
            try:
                n = int(c[ixx['oppsN']])
            except Exception:
                continue
            cands = LADDER.get(n)
            if not cands:
                continue
            opps = cands[0]
            wave = 2
        out.append('\t'.join([base, c[ixx['fam']], ','.join(eras2), base, ','.join(seeds), opps, mode, '',
                              ','.join(ok_ids), ','.join(paths), ','.join(targets)]))
        if wave == 1:
            n1 += len(ok_ids)
        else:
            n2 += len(ok_ids)

io.open('scratch/v7-mined/server-jobs.tsv', 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('Wave1(META)', n1, '‖ Wave2(阶梯)', n2, '‖ 批', len(out) - 1)
