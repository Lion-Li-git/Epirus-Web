# -*- coding: utf-8 -*-
"""server-jobs-build.py —— 组 server 批回放任务表（Wave1=META✓；Wave2=干净阶梯推断）
输出 scratch/v7-mined/server-jobs.tsv
"""
import io, subprocess, collections

POOL_A = 'random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver'
POOL_B = POOL_A + ',ringspam'
DEF15 = POOL_A + ',reflectspam,guardspam,protowall'
R2DEF15 = POOL_B + ',reflectspam,guardspam'
L16 = POOL_B + ',reflectspam,guardspam,targeter'
L17 = L16 + ',gunspam'
L18 = POOL_B + ',reflectspam,guardspam,targeter,protomine,prototransfer'
L22 = POOL_B + ',targeter,gunspam,snipespam,gunspam,guardspam,gunfocus,gunfocus'
LADDER = {12: [POOL_A], 13: [POOL_B], 15: [DEF15, R2DEF15], 16: [L16], 17: [L17], 18: [L18], 22: [L22]}

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
    ix = {x: i for i, x in enumerate(h)}
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) >= 27:
            lin[c[0]] = {'seed': c[4], 'wid': c[9], 'ts': c[3], 'mode': c[ix['mode']]} 

# era 缓存（git log -1 --before）
cache = {}
def era_before(ts):
    d = ts.replace('T', ' ')
    key = d[:13]
    if key in cache:
        return cache[key]
    r = subprocess.run(['git', 'log', '-1', '--pretty=%h', '--before=' + d], capture_output=True, encoding='utf-8')
    cache[key] = (r.stdout or '').strip()
    return cache[key]

# 槽时间轴 → 批时代根包
slot_rows = []
with io.open('champion-map/data/page/slot-timeline.tsv', encoding='utf-8') as f:
    sh = f.readline().rstrip('\n').split('\t')
    six = {x: i for i, x in enumerate(sh)}
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) < 4:
            continue
        slot_rows.append((c[six['fromUTC']], c[six['wid']], c[six['panelId']]))

def slot_at(ts):
    best = None
    for fr, wid, panel in slot_rows:
        fr2 = fr.replace('+08:00', '')
        if fr2 <= ts:
            if best is None or fr > best[0]:
                best = (fr, wid, panel)
    return best  # (fromUTC, wid, panelId)

def find_pack(wid):
    # ① 主仓 e370-out（保留的 v4-v6 原件与 -v7 嵌入件）② registry path ③ 隔离区 v7 原件
    cands = ['docs/artifacts/e370-out/%s.js' % wid[:8], 'docs/artifacts/e370-out/%s-v7.js' % wid[:8]]
    rp = ''
    with io.open('champion-map/data/registry.tsv', encoding='utf-8') as f:
        f.readline()
        for ln in f:
            c = ln.rstrip('\n').split('\t')
            if len(c) >= 9 and c[7].startswith(wid[:12]) and c[1]:
                rp = c[1]
                break
    if rp:
        cands.append(rp)
    cands.append('D:/code/Epirus-Web-artifacts-quarantine/cleanup-2026-11-20/docs/artifacts/e370-out/%s.js' % wid[:8])
    for p in cands:
        try:
            import os
            if os.path.exists(p):
                return p
        except Exception:
            pass
    return ''

rows = []
with io.open('scratch/v7-mined/server-batch-config.tsv', encoding='utf-8') as f:
    hdr = f.readline().rstrip('\n').split('\t')
    ixx = {x: i for i, x in enumerate(hdr)}
    for ln in f:
        c = ln.rstrip('\n').split('\t')
        if len(c) < 16:
            continue
        rows.append(c)

out = ['batch\tfam\tera\tarm\tseeds\topps\tmode\thot\tids\tpaths\ttargets']
n_wave1 = n_wave2 = 0
skipped = []
for c in rows:
    base = c[ixx['batch']]
    fam = c[ixx['fam']]
    ids = c[ixx['missing_ids']].split(',')
    tsmin = c[ixx['ts_min']]
    cfg_src = c[ixx['cfg_src']]
    opps_meta = c[ixx['opps']]
    mode_meta = c[ixx['mode']]
    if not ids or tsmin == 'null' or not tsmin:
        skipped.append(base)
        continue
    era = era_before(tsmin)
    if not era:
        skipped.append(base)
        continue
    seeds, paths, targets, ok_ids = [], [], [], []
    for pid in ids:
        L = lin.get(pid)
        if not L:
            continue
        st = led.get(pid, ('?', '?'))[0]
        if st != 'missing':
            continue
        seeds.append(L['seed'] or '0')
        paths.append(led.get(pid, ('?', pid))[1])
        targets.append(L['wid'])
        ok_ids.append(pid)
    if not ok_ids:
        continue
    # mode：META 优先，缺省 lineage
    mode = (mode_meta if cfg_src == 'META' and mode_meta else (lin.get(ok_ids[0], {}).get('mode') or 'multi'))
    # hot = 时代槽冠军
    sl = slot_at(tsmin.replace('T', ' '))
    hot = ''
    if sl:
        hot = find_pack(sl[1])
    # opps：META 或阶梯
    if cfg_src == 'META' and opps_meta:
        opps = opps_meta
        wave = 1
    else:
        oppsN = c[ixx['oppsN']] if 'oppsN' in ixx else ''
        try:
            n = int(oppsN)
        except Exception:
            skipped.append(base + '?oppsN')
            continue
        cands = LADDER.get(n)
        if not cands:
            skipped.append(base + '?L%d' % n)
            continue
        opps = cands[0]
        wave = 2
    arm = base
    out.append('\t'.join([base, fam, era, arm, ','.join(seeds), opps, mode, hot,
                          ','.join(ok_ids), ','.join(paths), ','.join(targets)]))
    if wave == 1:
        n_wave1 += len(ok_ids)
    else:
        n_wave2 += len(ok_ids)

io.open('scratch/v7-mined/server-jobs.tsv', 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('Wave1(META) 包数', n_wave1, '‖ Wave2(阶梯) 包数', n_wave2, '‖ 跳过批', len(skipped), skipped[:10])
print('→ scratch/v7-mined/server-jobs.tsv', len(out) - 1, '批')
