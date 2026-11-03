import io

def load(p):
    raw = io.open(p, encoding='utf-8', newline='').read()
    return raw.replace('\r\n', '\n'), ('\r\n' if '\r\n' in raw else '\n')

def save(p, s, nl):
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)

# ---------- A) PREREG 补一段"落地追补" ----------
p = 'docs/research/PREREG-2026-10-31-MINIT-FACE-qoder.md'
s, nl = load(p)
a = "## 四、随本次探针一起落的勘误（不改原句，加同日订正）"
assert s.count(a) == 1
add = """## 四·补　落地追补（10-31 深夜，用户裁『继续吧』之后）

- **M-F2 的标签窗口修了一格**：第一版把"随后 ≤N 回合"写成**严格大于当前回合** ⇒ 目标在本回合（在我们之后出手）放的那一炮被漏掉。
  改成含本回合后重跑：在册代理仍是 **0.00%（×0.00，n=413）/ 1.03%（×0.26，n=290）** ⇒ "方向反了"这个结论**更硬**；
  预示代理从 87.99%/30.53% 变成 **90.94%（×5.27）/ 44.77%（×11.42）**。两处读数 §二十三 一起记，本文不回填。
- **判据重写落地**：`skill-mastery.mjs` 的 miniT 语义格换成
  `≥1/2 打 [ep≥2 ∧ 最近 4 回合内有过一次 ok charge] 的席`（口径标记 `MINIT_ERA = predictive-2026-10-31` 印在表头与 meta）。
  臂侧 `probe-cem-arm --masterySem=1 --masteryKey=miniT` 骑同一段审计 ⇒ 自动跟着换，**没有第二套判定**。
- 旧口径的在册 miniT 语义读数（含 `only:miniT` 那类"语义计数"）**属换代前**，不许与新线横比。

"""
s = s.replace(a, add + a)
save(p, s, nl)
print('PREREG 追补已写（NL=%r）' % nl)

# ---------- B) RESULTS 文档加 §二十三 ----------
p2 = 'docs/research/RESULTS-2026-10-31-OBS3B-SWITCH-qoder.md'
s2, nl2 = load(p2)
sec = '''
## 二十三、miniT 语义格换口径（预示式代理）—— 落地时我自己那版实现有两处坏，都是腿抓住的

> 承接 §二十二与 `PREREG-…-MINIT-FACE` 的『四·补』‖ 改动文件：`tools/proto2/skill-mastery.mjs`（判定 + 表头口径 + 自证 E 腿）
> ‖ `tools/probe-cem-arm.mjs`（注释跟口径，门的实现没动：它 import `auditCells`，同一份判定）。

**换成了什么**：miniT 那格从『打 `lastSkill∈{ring,bigT,railgun}` 的用户』改成
**『打 [ep≥2 ∧ 最近 4 回合内有过一次 ok charge] 的席』**，并在表头/meta 打口径标记 `predictive-2026-10-31`。
窗口与阈值就是 §二十二 那张事后表里 lift 最高的一条（×5.27 / ×11.42），**面内可算、不加维、不碰私有**。

**实现里我自己抓到的两个坏（都记下来，因为它们都是"跑了、绿了、但量不到"的形状）**：

1. **`row.round` 根本不存在**——回合号在 pick 快照里（`pk.round`）。第一版把 `row.round` 传进判定 ⇒ `gap = undefined − cr = NaN`
   ⇒ 比较恒 false ⇒ **这条语义计数从写下来那刻起就一次都没亮过**，而它不会红，只会安静地给 0。
   抓法不是看代码，是我给臂侧烟测加了 `--masterySem=1 --masteryKey=miniT` 的端到端跑，看到 `审计 20 ‖ 达标 0` 才回头查判定输入。
2. **合成对照 bot 拿不到正例**：我先写了 `smart:miniT` / `dumb:miniT` 两只控制 bot 当腿，结果 `smart` 命中 **0/63**。
   原因不是判定坏，是**这张桌上几乎没人蓄珠**——直接看事件流：4 局里 `key=charge` 的 ok 事件**只有 1 条**
   （`scratch/ev-shape.mjs` 的输出）。 ⇒ 在这种池子上"集成对照"永远是 0，把它当腿等于**一条不会红的装饰**。
   处理：删掉两只合成 bot（连同其死码），腿改成**已知答案单测**——判定式 6 条（ep 不够 / 窗口边界内外 / 没锁目标 / 从没蓄珠 /
   正常命中）+ 事件流扫描 1 条（只认 ok、`newturn` 才进格、失败那手不记、同一 pid 取最近）。
   ⚑ 写这条单测时自己又踩一格：fixture 用 `(extra && extra.pid) || 1` 兜底，把 **pid 0** 悄悄变成 1（0 是 falsy）⇒
   单测自己判错。已改成显式 `!= null`。
3. 另外把语义游标从"只看被审计那一席的 picks"改成**扫事件流**（`scanChargeRounds(evs, R)` 按行的事件位推进游标）——
   原来的写法只能看见 subject 自己蓄的珠，而这一格要判的是**目标**蓄没蓄过珠。同一处顺手保证不偷看未来（只吸收事件位早于本次决策的）。

**分母 0 从此不说 0%**：`verdictOf().miniT` 新增 `unreadable`，打印走
`语义**读不出**（这格一次 miniT 都没出手 ⇒ 分母 0，不是 0%）`——gd3b 就是这样（它根本不出小雷），
v7 只有 2 次出手 ⇒ 老实印 `预示代理命中 0/2`。**"没人做过"与"做了但做错"在这把尺上不再同形。**

**验收**：`skill-mastery --selftest` 五腿全过 ✔（A 阳性 / B 阴性 / C 确定性 / D 容器装载 / E miniT 语义方向 7 条单测）
‖ 同一次自证里我把 D 腿修好了——它原先挑 `v==91` 的容器，而代 2 已退役 ⇒ `packCfgExit` 的响亮拒读直接把自证**进程终止**
（这是我 Stage B 的第三条漏网；ZCode 的 AC-CAP 那枚包就是触发包）。现在 D 腿挑代 3 容器，并额外断言
"同一枚代 3 容器改标 v:91 ⇒ `checkPack` 必须 `reason:version` 拒读"（`{"ok":false,"reason":"version","got":91,"want":92}` ✔），
这样"旧代进不来"这句话**有牙**且不靠 process.exit。
‖ 臂侧端到端：`--masteryKey=miniT --masteryGate=elite --masterySem=1` 跑通并**正确报空臂**
（`lineage.noOp=true`，产物与起点逐字节相同 ⇒ 门的饿死保护在工作，没有被静默绕过）。

**下一步（不自动做）**：miniT 桶要真开臂，缺的已经不是我原先说的"能见度"，而是 §二十二 列的 M-F3——
**行为可达性**（gd3b 这类包根本不出小雷 ⇒ 门只会饿死）。要动就得先立"候选侧曝光/课程"那条线的预登记。
'''
anchor = s2.rstrip('\n')
s2 = anchor + '\n' + sec
save(p2, s2, nl2)
print('§二十三 已追加（NL=%r）' % nl2)
