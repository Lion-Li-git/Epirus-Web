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

## 五′、已知边界（下一班接手点）
- obs4 的 obs3.mjs `scene4` 双胞胎已加（scene/seatVec4/manifest），但 browser-parity 的显式腿没跑（policy2 单实现两处调用，结构性同源；要钉死再加一条 parity 用例）
- guard 蒸馏保真 0% 的机理未查（候选侧 guard 的 te 特征无"对手在防御"信号——本来就该由计数维补，等臂训完看 GA 是否自学）
- 防御三件（bagua/jinshield/armor）在 obs4 特征里只有 mineArmed/贴纸类标志，**jinshield/armor 无专属位**——若臂训完仍 0 使用，加 2 维（下一版）
