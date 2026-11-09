# obs4 设计定稿（ZCode · 2026-11-10 深夜实现 · 用户原则「正交维度信息全覆盖 + 不再因可变人数平均化」）

> 与 DS 版（PROPOSAL-2026-11-09-obs4-ds.md，注意力+PMA，~15k）的根本分歧：**游戏人数上限 8 ⇒ 可变 N 用
> alive 掩码 + 固定槽位解决，不需要集合池化**。槽位拼接让每个席位的每一维被直接读到——平均化从结构上不可能发生。

## 一、结构（已实现，`input:'obs4'`，容器 v:92 兼容、dims.gen=3）

| 块 | 维 | 内容 | 消费者 |
|---|---|---|---|
| 8 × 席位槽 | 8×29 | 每槽：状态14（hp/ep/ringStreak/cannonCount/rodGuard/mineTurns/baguaExtra/fireWeak/tauntActive/nightmare/vampire/infiniteEnergy/贴纸数/贴纸龄）+ alive1 + 风格5（上次动作类4+none）+ 穿透2（上次动作破防/破反弹）+ 目标3（self/me/other）+ 计数4（打我加权/最近4手数/连防streak/持珠）| **槽 = 座位 pid（每局随机指派 ⇒ 槽位身份≠脚本指纹）**；已淘汰槽全零 |
| 关系 | 5 | 挑衅互指/铁索/镜面指我/上回合打我 | 每槽后缀 |
| 自块 | 60 | G5 + 私有2 + 自己序列48（类+果，**无自身键 bag**）+ 合计1 + **局面比较4**（我的排名/8、领先者血差、存活总血比、淘汰数/8）| 场B「该收尾了」第一次有输入依据 |
| 候选 | 60+30 | base30（费/优先级/类/目标型/伤/穿透三向/持续/珠/ afford/lethal/…）+ 键身份 one-hot30 | 「我要出什么」保留精确键 |

**正交审计** = `obs3.mjs dims('obs4')` 的 manifest（292 项，逐项命名到块）：每个事实恰好出现一次；
对手侧**无精确键**（脚本指纹通道从特征层切断——比 DS 版的"训练时不用它"更硬）；无 mean/max（平均化不存在）。

## 二、账目（已验证）
- 参数 **12,969**（seatEnc 864 共享逐席 ‖ actEnc 1464 ‖ ctx 8096 ‖ cand 2520 ‖ head 25）
- manifest 292 = 8×29 + 60 ✓（`obs3.mjs dims('obs4')` 与 `policy2.js DOF.obs4` 与 `arch2 packDims` 三方同账）
- 段表/长度守卫/往返 pack↔unpack ✓；**obs3b 回归未破坏**（KDG-B 照常加载对局）
- 冒烟：5P/8P/2P 前向 Σ|probs−1| < 1e-4、无 NaN、tape（svs/afs/xin/keys）全形（`scratch/obs4/smoke.js`）

## 三、两条前向都实现（同账同序）
- `policy2.js`（GA 训练 + 浏览器）
- `arch2.mjs forwardObs3`（supfit 蒸馏梯度路）——KD 桥实测：教师 T8 → obs4 学生，**sword 100% / gun 100% / ji 55% / guard 0%**（留出 60%）；guard×3 过采样无效且伤 sword（DS 的 KD-D1/D2 否证在 obs4 上复现）⇒ 防御交给 GA 阶段的课程+credit，不在蒸馏步硬修

## 四、已发射的验收臂（本分支，200 代 × 2 seeds）
- 种子 = KDO4（KD 桥产物）；配方 = STR-B 全配方（KILL_REWARD=2/KILL_FIELD=1/WIDTH_W=0.5/MIX2/MIX8/MIXHP/COURSE=pickFarmer every1）+ EPIRUS_TRIPLET
- 产物 `docs/artifacts/night-adapt/OBS4-Q-s13.js / OBS4-Q-s41.js`
- **验收线（用户原则的直接翻译）**：场A≥20% ∧ G5≤25%（互斥对的同时成立 = 观测面换代的试金石）∧ 用卡≥9 ∧ C 综合≥0.30 ∧ 12 线 ≤1 缺（场B 记录项）
- 对照 = WSEL9-200（obs3b 架构顶：9卡/0.325·0.304）与 STR-B-Q-s13（最干净 6 卡）

## 五、第一轮臂结果（11-10 02:4x，诚实记录）

- 200 代 ×2 seeds（KDO4 种子 + STR-B 配方）：X̄₄ **−0.184/−0.186 与 −0.184/−0.192**（深负），1st 14.3-14.5% 低于随机基线。
- exam-fb 画像：**coherent 不是 bug**——对农民桌 85-90%（会赢）、被围殴伤害 1.75-1.83/局（有输出），
  但场A 还手 4% 、场B 0.02-0.05 = 极度被动。
- 判定：**没训够 + 缺反被动饮食**（STR-B 配方里没有反制席；PASS2 线的场A 是 COUNTER_OPPS 练出来的）。
- 处置：续训臂 OBS4-C-Q-s13/s41 已发射（400 代 + COUNTER_OPPS(gunFocus,gunSpam,guardSpam,targeter)+SEL_COUNTER），结果见 triplet 台账。
- 结构本身的冒烟全过（三人数形状/无 NaN/obs3b 回归），「平均化消除」的观测面改动本身没有红。

## 五″、续训结果与两个坐实的坑（11-10 深夜补记）

**OBS4-C 续训臂（400 代 + 反制面，11-10 04:0x 落地）**：X̄₄ −0.160/−0.165（s13）与 −0.165/−0.180（s41）
—— 比 200 代深负（−0.184）只挣回 +0.02~0.03，四格 cells 全线微升但仍深负。增量饮食救不动。

**坑① KD 桥无效（`kd-corruption-check.mjs` 坐实）**：`pg-lib.tapeForward` 只会重放 obs3 族尾块
（hSelf/mean/mx）——拿去重放 obs4 包时：xin[60..180) 是**槽 0-4 的陈旧嵌入**（seatEnc 抖动后 0 维变化，
训练全程冻结、反传拿不到这条梯度），尾块 [180..251) 被整体改写成 obs3 族池化。
⇒ KDO4 的"sword100/gun100"是在**被污染的前向**上量的，不是 obs4 蒸馏保真；
KDO4 种子的 ctx 尾 72 行是按另一张输入面训的，第一轮深负有它一份锅。
**修复**：pg-lib 补 `tapeForward4/tapeBackward4`（槽位每步从 tape.svs 重建 + dxin 按槽路由），
修后 obs4 包过 selftest3 六腿（含腿 E 浏览器镜像——从红转绿）。
修复后真重放的同配方对照：sword 0%/gun 100%/ji 54%/guard 0% —— 旧 sword100 确系伪影。

**坑② 训练侧 obs4 两维死维（selftest3 腿 E 抓出）**：obs3.mjs 的 `recentAll` 没产 `keys/cnt`
（policy2 的双胞胎有）⇒ **obs4 训练时 `actsLast4`/`streakDef`（public[26]/[27]）恒 0，浏览器却有活值**
——训-读不同账，obs4 各臂全程带着这个洞在训。已修（recentAll 补 keys/cnt；obs3b 只读 bag/tgt 零回归）。

**坑③ makePolicy 签名误用 → JSON NaN→null→0 静默链**：`P.makePolicy(scale)` 只收 scale，
把 rng 当 scale 传 → 权重 NaN → JSON.stringify 静默写 null → unpack 读回 0 → 全零种子包、梯度全零、
KD 桥塌缩成多数类且对 lr 完全不敏感。已修（make-seed5 签名 + **arch2.pack 加非有限守卫**，NaN/Inf 拒写盘）。

## 六、obs5：obs4 特征 + set-transformer 聚合（用户问「attention+PMA 会不会更好」的落地回答）

**动机**：固定 8 槽的置换不变性是统计的（靠每局随机指派期望抹平），2P 时槽 2-7 恒零、8P 全满，
ctx 层槽位权重按位置分家——跨人数泛用差（用户点名"和当初 v7 一个样"）。attention+PMA 从**结构**解决：

| | obs4（8 槽） | obs5（attention+PMA） |
|---|---|---|
| 置换不变 | 统计的 | **结构严格**（softmax 作用在在场集合上） |
| 跨人数 | K 进权重（零槽伪影） | K 只经 softmax 归一（权重和恒 1，mean 的"除以 N"不存在） |
| 威胁比较 | 线性读 8 槽 | 一跳注意力内容寻址，PMA 4 seed 各盯一类席位 |
| 参数 | 12,969 | **12,393**（ctx 扇入 252→156，反而更省） |

**设计**（特征与 obs4 完全同一张 292 manifest，聚合段才分家）：
- 共享 seatEnc（35→24）→ 1 层自注意力（QKV 各 24×24，**活席掩码 softmax**，残差直连保底信息全覆盖）
  → PMA（4 seed，keys/values 读注意力后语境向量 ē）→ xin = [局面 60 原始 ‖ pooled 96]
- 死亡席不进集合（不编码不占 softmax——淘汰信息由 sit4 承载，不给死席发 bias 泄漏的假嵌入）
- init 时注意力 logits≈0 ⇒ 从软均值起步特化；段序 = seatEnc‖attn‖pma‖actEnc‖ctx‖cand‖head
- **段查找一律按名**（obs5 插段后 seg[1..4] 下标假设破——policy2/arch2/pg-lib 三处已改，obs3 族名字=下标逐位不变）

**验证**（`scratch/obs4/smoke5.mjs` 五腿 + `selftest3.mjs` 六腿全绿）：
① 5P/8P/2P 前向无 NaN/probs 归一/xin=156 ② 重放对账逐位 0 ③ svs 换序重放逐位 0（置换不变）
④ 数值梯度（selftest3 腿 C：2971 可分辨坐标最坏 0.00e+0）⑤ obs3b 现役包回归 ✓

**KD 桥（修后真重放）**：T8→KDO5（同 KDO4 配方）gun 100%/ji 54%/sword 0%/guard 0%——sword/guard
蒸馏否证在注意力面上复现，交 GA 课程；键均衡档 +lr 也不救。种子 `scratch/obs4/KDO5.bak`。

**验收臂**：OBS5-Q-s13/s41 已发射（400 代，配方与 OBS4-C 逐字同源只换种子包与面；triplet 台账）。
判定线同 §四：场A≥20% ∧ G5≤25% ∧ 用卡≥9 ∧ C≥0.30。对照 = OBS4-C 两臂（同配方同预算）。

## 五′、已知边界（下一班接手点）
- obs4 的 obs3.mjs `scene4` 双胞胎已加（scene/seatVec4/manifest），但 browser-parity 的显式腿没跑（policy2 单实现两处调用，结构性同源；要钉死再加一条 parity 用例）
- guard 蒸馏保真 0% 的机理未查（候选侧 guard 的 te 特征无"对手在防御"信号——本来就该由计数维补，等臂训完看 GA 是否自学）
- 防御三件（bagua/jinshield/armor）在 obs4 特征里只有 mineArmed/贴纸类标志，**jinshield/armor 无专属位**——若臂训完仍 0 使用，加 2 维（下一版）
