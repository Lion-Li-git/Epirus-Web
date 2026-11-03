import io

p = 'docs/research/RESULTS-2026-10-31-OBS3B-SWITCH-qoder.md'
raw = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')
orig = len(s)

sec = """
## 二十一、小件清账：池级快查在代 3 上的现状 ‖ supfit-gd 的 −99 哨兵 ‖ eval-5p 的信息-free 格

> 用户裁（10-31 晚）："先把小的做了吧，stage C 也可以做"。本节是三件小活的落账，末尾把 Stage C 的**代价**摆出来等裁。
> 原件：`scratch/poolcheck-gen3.log` `scratch/POOLCHECK-GEN3.json` `scratch/arms/{_prefix-v7mix,_postfix-v7mix}.bak(.meta.json)`
> `scratch/hc3/`（HEAD 版工具的独立副本，用来做改前/改后同输入对跑）。

**1）池级快查（`pool-check`）第一次在"只含可读包"的候选集上跑。** 候选集 = 现在这台尺能装的 5 枚代 3 包
（`gd3b-ks-sb` ‖ P-R1 两枚复现产物 ‖ P-P5 两枚 1st 货币产物），40 局/格正式档：

| 桶（线） | 会者 | 目标 |
|---|---|---|
| 会电磁炮 railgun（1/2 线） | **5/5 = 100%** | ≥50% ✔ |
| 会聚能环 ring（1/2 线） | 0/5 | ≥50% ✘ |
| 会大雷 bigT（1/2 线） | **0/5** | ≥50% ✘ |
| 会激光眼 laserEye（1/5 线） | 0/5 | ≥20% ✘ |
| 会小雷 miniT（1/5 线） | 0/5 | ≥20% ✘ |
| 会过载炮 cannon（1/5 线） | 0/5 | ≥20% ✘ |
| 珠健康（池均） | 浪费 16.1%（线 <40 ✔）‖ 花珠 82.9%（线 ≥60 ✔） | — |

每包快查：判据 **1/6**（只有 railgun 那条过），夺1 52.3~57.5% ‖ clean 0.327~0.387 ‖ 单卡 charge 50.6~60.6%。
⇒ 这张表的正确读法不是"池缺五个桶"，而是**候选集里根本没有别的桶**：bigT 桶的两枚赢家（`BIGT1-s7/s23`）与激光眼那枚
（`CH3/CH2` 系）是 **v:91 / obs3 面 / 6122 条**，代 2 退役后端上就读不出——当场证据（`skill-mastery --pack=…BIGT1-s23.bak`）：

```
⛔ scratch/arms/BIGT1-s23.bak：packInstallCfg: 这是**代 2** 的产物（v=91，dims.gen=2），当前尺只实现代 3
   （段表里没有 qHead ⇒ 与代 2 的 8026 条不同形）⇒ 不许装载。
```

**这条是 Stage C 的真正代价，不是我原本以为的"纯清理"**（见本节第 3 条）。

**2）`supfit-gd` 的 −99 哨兵：一次 JS 的 NaN 是 falsy。** 机制：留出集里出现训练集没有的类时 `WKEY[c]` 不存在 ⇒
`nW += undefined` 把 nW 毒成 **NaN**，而 `nW ? … : −99` 里 **NaN 是 falsy** ⇒ 似然静默落回哨兵 −99（与 §十七 pg-train 那笔
NaN 事故同族：同一台工具的第二次同型病）。改法：这类组不进加权均值、单独计数并印出。同一输入对跑（`--teacher=v7mix`，
其余旗标同）：

| | 起点留出 ll | 终评留出 ll | 同键 top-1 | 加权一致率 | 被吃掉的类 |
|---|---|---|---|---|---|
| 改前（HEAD 版工具） | **−99.0000** | **−99.0000** | 65.5%(200) | 53.6% | 无提示 |
| 改后（现役） | −2.8102 | −1.6750 | 65.8%(199) | 68.7% | ⚑ miniT×1 |

`--teacher=chain` 的默认路径产物 **md5 逐位不变**（`ba3a1ba8…` ≡ `gd3b-ks-sb.bak`）⇒ 在册读数没被这次改动动过。
meta 新增 `testClassNotInTrain` / `startClassNotInTrain`（本例 =1/1）⇒ 以后 −99 只可能真的是"整批读不出"。
⚠ 顺带修正一处旧措辞：改前的 top-1 分母是 200、改后是 199（那 1 组不再进判定），所以 65.5% 与 65.8% 是**同一个 131 命中**，
不是成绩涨了 0.3pt。

**3）`eval-5p` 的名次格：把没有信息量的格子从表里拿掉。** 旧写法固定印 `4th/5th`，3P 桌上 `s.ranks[3]` 是 undefined ⇒
`4th=NaN%`（今晚 ZCode 的 3P 表里就在）；而 `top3` 在 3P 恒等于 100%、`top2` 在 2P 恒等于 100%。改成按这张桌的人数印，
口径与仓里 `style-exam.mjs` 的 `N >= 4 ?` 一致。三档烟测：2P `1st/2nd | top2=（2 人桌恒 100%，不印）` ‖
3P `…2nd 3rd | top2=93.2%` ‖ 5P 逐字照旧（`2nd…5th | top2= top3=`）⇒ 在册 5P 行的可比性不变。
⚑ 我自己第一遍写成 `i < N + 1`，3P 照样冒出 `4th=NaN%`——是烟测把它抓住的，不是读代码。

**4）Stage C（obs3 面退役）现在该不该做——把代价摆出来。** 清点（今晚实测，不是推测）：

- **现役生产路径已经不吃的东西**：盘上 14 枚代 3 包 **全部是 obs3b**；三枚 P-R1 起点（OB3CH-s7 / OB3RB2-s23 / OB3S-C2-s7）
  也都是 obs3b；`np-test` 的门里没有任何一条引用 obs3 包 ⇒ 删 obs3 不砍任何**现在在跑**的读数。
- **但 obs3 是桶线迁进现役尺的唯一通路**：`supfit-gd` 的显式跨代搬运（砍 qHead）对 **任何**带 qHead 的源都成立，
  所以 `CEM48c-s7` / `BIGT1-s*`（6122 条 obs3）今天可以搬成 **6089 条代 3 obs3** 继续在现役尺上跑/测。
  删掉 obs3 面 ⇒ 这条通路断掉 ⇒ bigT 桶（2/14 全过双键、等用户裁"开池/上界门/farming"）与激光眼桶
  只能**在 obs3b 上重训**（CEM 24k 档 = 每臂几十分钟到几小时）或回旧 commit 复算。
- **换面并非纯亏**：obs3b 比 obs3 多 219 列，全在 `S.self(+63) / P.opp(+126) / Q.bag(+30)`，其中每席 **`lsKey.*`(30) +
  `bag.*`(30)** 是 obs3 根本没有的——§Handoff-from-zcode 那张"语义判据能见度"表里 miniT 那一行判 **✘（目标 cooldown/电珠不在面里）**，
  换到 obs3b 至少"对面上一手用过哪把键 / 手里有哪些键"进了面（仍**不是**冷却，是代理）。⇒ 对 C 层那两条桶判据，obs3b 是**放宽**不是收紧。
- **我的建议**：先别删。顺序改成 ① 用户裁桶线三选一（那条本来就在等裁）⇒ ② 若桶线要在 obs3b 上续，就顺手把 obs3 删掉并把
  桶赢家重蒸/重训过去（一次搬家，两件事一起收）；若桶线要在 obs3 上续，那 obs3 就是现役面，删它等于砍自己的路。
  Stage C 与"搬考卷"（适应段换产品形状卷）不冲突，但**它俩都动 arena2 的桌子**，一起做会比分开做省事。

**5）本轮验收**：`selftest2` 36 条 ‖ `selftest3` 6 条（在 `gd3b-ks-sb` 上）‖ `browser-parity` P1–P6 ‖
`pack2-audit` A–E ‖ `supfit-gd` 默认路径 md5 逐位同 ‖ `eval-5p` 2/3/5P 三档烟测。旧桶赢家包在现役尺上**响亮拒读**（退码 2，非静默）。
"""

s = s.rstrip('\n') + '\n' + sec
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('§二十一 已追加（NL=%r）字符 %d → %d' % (nl, orig, len(s)))
