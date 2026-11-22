# STATUS · 2026-11-23 夜班（ZCode/GLM，01:00–09:00）

> 承接 [HANDOFF-2026-11-22-night-for-glm.md](HANDOFF-2026-11-22-night-for-glm.md)（千问探针先行扫批方案，已采纳执行）
> 与用户 01:40 追加令：「自主到 09:00；别忘 C 线多风格包 + 困难带天火闭环；DS 的聚能环强包可以用上了」。
> 按批回执在 [v7-scan-receipt-1122-night.md](v7-scan-receipt-1122-night.md)；训练臂账在
> [TRAINING-RUN-LOG.md](../TRAINING-RUN-LOG.md)；本文件记叙事与判例。

## 一、v7 回收扫批战役（主线）

**今夜找回 194 枚（missing 375 → 181）**，分四波；全部 `land-recovered --do` 自证登记（wid 逐位、§7.1 口径、registry 零改动）。

| 波 | 批数 | 命中 | 内容 |
|---|---:|---:|---|
| 前半（wave1-3 + wave2fix） | 10 批 | 76 | l2c 20 / l2f 18 / sub1 6 / aim1 6 / r61fix·l2s·wall1·gf1 各 5 / l2o·l2h 各 3（唯一失手 curri2 0/6 归档） |
| wave4 双 shard（50 行/140 枚） | 24 批 | 98 | 全 6/6：big1·iso1·new1·new4·new6·press1·fix1·ringT3·role1w·role5·stock1；近全：f2t 5、wall2 5、f5div3 5、f5t 4、seat24b 3、blk1 3、w3c 3、seat24 2、new2·new3 各 1 |
| wave4fix2（5 批歧义行重修） | 3 批 | 13 | **w3r1 6/6**（POOL16+ROLEW=1）· **noteach1 6/6**（IMIT_FRAC=0=无教师真相）· ws2-81（era 漂移候选 6345caee）；press2 在飞 |
| wave5 探针（真组合纠偏） | 1 批 | 3 | **catE5 3/3**（DIV_CATW=0.5——wave4 挖到的是兄弟批 catE1 的 env）；bead 系 22 名池真相已挖到但 era 漂移未解 |

关键配方纠偏（全量组合挖掘 = 取全部组合不取第一块）：bead 系真池 22 名（含 gunfocus×2）‖ noteach1 = IMIT_FRAC 0 ‖
catE5 = CATW 0.5 ‖ protoE = DIV_W 0.06 + FORCE_GENS 60 + WALL_FILTER 1 ‖ densE 真池 16 名 ‖ w3r1 真池 16 名。
**era 未提交工作树漂移**是残余主敌（gf1→c7076ac9、ws2-81→6345caee 已证；bead/protoE/densE/press2/role1 待漂移扫描）。

## 二、C 线重测（口径 v2 量测协议第 1 条，Qoder handoff §5.4 —— 已跑完）

数据：[pool-synergy-remeasure-1123.tsv](../champion-map/data/pool-synergy-remeasure-1123.tsv)（900 局×2 桌）
+ [pool-probe-hard-1123.tsv](../champion-map/data/pool-probe-hard-1123.tsv)（hard 16 枚 900 局，`__win:` 行已落 tsv）
+ style-distance 重读。提交 bcb54c2d / probe 提交见 git log。

**三个结论**：

1. **「13 枚全在核内、9 空轴 <10%」的旧结论已被打破**：hard 核桌（老核 3 + ring3 + AR-TK2）
   空轴触达 **1.0% → 5.8%**（transfer 29 / tank 13 / bigT 9 出卡）；真空轴剩 laserEye/holo/shift/proto
   与 curse（仅 1-22/900 局）。
2. **DS 的聚能环强包 `nov22-ring3-gd6a18` 站住了**：meter 硬核桌 186 胜（第 3/6）；probe-pool
   **multi 27.0%（第 4/16）/ long 20.7%**。ring 轴在 hard 带既有强度载体（ring3/R-GD12）。
3. **全池共同弱点格 = 下一批风格包的指向**：probe-pool 弱点剖面
   **「只枪压制」human 原型 multi 26.4%（3.7σ，整池 14.0%）**、**「全程只防御」long 19.5%（3.7σ）**
   ——整池没人会打只枪压制/清只龟。离散度表说：下一枚该训的是**反只枪压制**（或反只龟）的行为轴，
   哪怕它的 arenaB 不如现成强将。

风格距离重读：咒/天火载体（night2-E1-det-strong 0.4183、nov22-c3g-s300k 0.3935）与 AR-TK2 0.4364
仍是风格外围；新入带的 ring3 反而贴核（0.2176）——**hard 带的"多风格"缺口就是 curse/firestorm 一族**。

## 三、困难带天火闭环（用户点名任务）—— 两条路线本夜双红，判例已留痕

| 臂 | 路线 | 结果 | 判 |
|---|---|---|---|
| `nov23-fs-c3g-tzt2d` | c4 tank 并入路线平移：TZT2D 底 + c3g 的 curse,firestorm 双键道 | `arenaB=-91.2`（spread 82.6）+ `promote --dry` 2 阻断（**G4[multi] 只枪 65.7%>60% 稳赢它**）+ defense 1.7%（底座防御被冲掉） | **淘汰+判例**：tank 单键路线不可平移到 offense-economy 键；形状正好踩全池弱点格被放大利用 |
| `nov23-fs-hard-klcand` | 对带练 × klCand（C2c 失败时 klCand 未出生的未测格子） | seg50k `arenaB=-49.3` vs 底座 -27.55（50k 局掉 22pt） | **50k 淘汰**：C2c 失败形状复现，**候选级锚也止不住对带练流失** |
| `nov23-fs-single-tzt2d` | 单键消融（curse 是不是毒药？） | **作废**：`t2 命中键道 0`——c3g 的天火出手与 curse 路径状态纠缠，纯 firestorm 键道采样采不到它（教师标签只剩 ジ/蓄能/电磁炮） | 机制注记：双键天火/咒在 c3g 里是一体的，拆键消融此路不通 |

**留给下一班的机制方向**（按证据排序）：
1. **反只枪压制 × 天火双持**：既然并入臂与整池都死在只枪压制格，教师栈加一路反只枪成分
   （taunt-dsp0b / OBS6P9 的抗枪行为）+ firestorm 键道，一次解决"强度税"与"弱点格"两件事；
2. **低剂量单键**：c4 剂量（frac 0.25/rare 0.45）对 offense 键过猛——剂量响应曲线未测，frac 0.10 起步；
3. c2c 的副产物值得接：**hard 桌教出的珠经济闭环首形态**（花珠率 0.444）——economy 出口是 hard 桌
   能教的东西，强度轴和它分开走。

## 四、下一班接着排（优先级）

1. wave4 余量（~70 枚）——驱动按台账 skip 自动续，jobs 文件与配方都在；
2. v7curri2 探针（配方已挖到，差一维：试 era 候选 0f66ee8f / gens / 池 16 名逐个消融）；
3. C 线按 §三机制方向开臂（每臂先查方法论账）；
4. T2 链 12 批/33 枚在 T1 命中后解锁；
5. spread 判归档仍未做（**等用户裁**，Qoder handoff §5.3 的断言草案在那里）。

## 五、夜班裁定留痕（§23）

- **era=未提交工作树裁定**（gf1）：包 ts 早于特征进主线提交 ⇒ era 取特征提交本体起。00:5x，回执 §教训。
- **教师名用完整函数名**（aim1）：era runner fail-fast 是当年错标签事故的牙，重放必须喂它认的名。01:0x。
- **nov23-fs-hard-klcand 50k 处砍臂**：seg50k -49.3 判据明确，砍臂省 ~2h 算力给扫批。02:4x。
- **单键消融臂插队**：12 分钟臂，为把"curse 是否毒药"消融干净，短暂三线并发（两扫批+一小臂）。02:5x。
- wave4 双 shard 跑满到收工；未动 D55/PR #9；未加 spread 判据；未碰 srv-wt-s0-3242a160。
