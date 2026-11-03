import io
p = 'tools/proto2/longrange-offer.mjs'
lines = io.open(p, encoding='utf-8', newline='').read().split('\n')

idx = [i for i, l in enumerate(lines) if "run('代 2 ‖ '" in l]
assert len(idx) == 1, idx
lines[idx[0]] = lines[idx[0]].replace("代 2 ‖ ", "'代 ' + ((raw.dims && raw.dims.gen) || '?') + ' ‖ ' ")

j = [i for i, l in enumerate(lines) if l.startswith("console.log('\\n判读口径：")]
assert len(j) == 1, j
NOTE = ('console.log(\'\\n⚑ 提供率这一列**不是包级读数**：夹具由"旋转键 chooser"（`lateFix` 与 `collectFixtures` 里的 '
        '`R.skills[(round*5+pid*3+g)%K]`）走出，与被测包无关 ⇒ 各包提供率**必然同形**（11-01 实测 4 枚包都是 '
        'ring 15.6% ‖ bigT 0.0% ‖ laserEye 0.0%）。包级的信息只在"提供时名次 / 排第一 / greedy 会选谁"那几列。'
        '⇒ 判"某个包自己走不到某一手"要引 `skill-mastery` 的出手账（含珠账本电/爆），不要引这一列\');')
lines[j[0]] = NOTE + '\n' + lines[j[0]]

io.open(p, 'w', encoding='utf-8', newline='').write('\n'.join(lines))
print('patched longrange-offer')
