## v1.3.25 — P0：存档版本兼容（形状自适应）→ A/B 证据链恢复

### 问题（千问指出，我确认）
升 `PACK_VERSION 5→6` 后，**7 个实验存档全变砖**：
`checkPack` 要求 v=6/f=123/len=3337，而存档是 v=5/f=122/len=3313 → 全部拒绝，
`econ-eval ③ head-to-head` 直接抛"冠军 B 解包失败"。
⇒ **五次失败实验的结论无法复现、无法对照**，而且以后每次改特征都会重演一次。
根因：`FEAT_S`/`HID`/`PACK_VERSION` 是**模块全局**，一个进程只能存在一种网络形状。

### 修法（千问方案）：形状从 `params.length` 反推
`paramCount = HID*FEAT_N + HID + HID + 1` ⇒ `FEAT_N = (len - 2*HID - 1)/HID`
- v5: `(3313-49)/24 = 136` ⇒ `FEAT_S = 136 - FEAT_A(14) = 122`
- v6: `(3337-49)/24 = 137` ⇒ `FEAT_S = 123`

具体改动（`js/train/policy.js`）：
1. 原 `features` 改名 `featuresV6`；新增 `features(state,pid,featS)` 包装——
   当 `featS < 123` 时**去掉"自己跨得过环启动线"那一维**。
   **下标用运行时探测而非硬编码**：把 `me.ringStreak` 从 0 改到 3，
   唯一"由 1 变 0"的那一维就是它（`ringSelfIdx()`）。
2. 新增 `shapeOf(params)`：按长度反推 `{featS, featA, featN, legacy}`；
   `value()`/`forward()` 改用它（**v6 路径行为完全不变**，仅在长度不匹配时走 legacy）。
3. `unpack(o, allowLegacy)`：`allowLegacy=true` 时按包内长度重建；
   **游戏侧仍调用严格版 `unpack(o)`，checkPack 一字未改**。
4. `tools/econ-eval.mjs` 的两处 unpack 改传 `allowLegacy=true`。
5. `tools/seat-diag.mjs:78` 坏行修复（残留 `(R.ACT_KEYS ? 0 : 0) +` 拼出"06 种"）。

### 验证
```
champion-3p-div555.bak    v=5 f=122 len=3313  严格=✗  工具侧=✓  反推 featS=122 featN=136
champion-3p-curriculum.bak v=5 f=122 len=3313  严格=✗  工具侧=✓  反推 featS=122 featN=136
bundled-champion-3p.js    v=6 f=123 len=3337  严格=✓  工具侧=✓  反推 featS=123 featN=137
```
`econ-eval ③` 恢复可用（回归：spec 37/37、np-test 30/30）。

### ⚠️ P0 修好后立刻暴露的重要事实
A/B 一恢复，就发现**当前 v6 冠军比 v5 存档差**：

| | A（当前 v6 冠军） | **B（v5 存档 div555）** |
|---|---|---|
| 最大 ep | **1** | **5** |
| 贵技能出手 | **0.0%** | **11.8%** |
| 技能种类 | 6 | **10** |
| 分布 | ジ39.5/枪27.3/藤甲11.3 | ジ40.7/枪12.9/**坦克11.8**/反弹11.1/八卦阵11.0/防御10.0 |
| head-to-head | A×2:B×1 = 71.4%；A×1:B×2 = **20.7%** | — |

⇒ **v6 那次重训（含 (a) 特征 + 探针门槛 + 名次改动）是净负向的**：
经济更浅、种类更少、头对头更弱。这也印证了千问的判断
（"加了 (a) 特征的那次重训在经济深度上是负向的"）。
**此前因为存档变砖，这个对比根本做不出来** —— 这就是 P0 的价值。

回归：spec 37/37、np-test 30/30。

## v1.3.24 — 修 v1.3.23 引入的回归：冠军包版本不兼容 + 模仿默认关闭

### 回归（我在 v1.3.23 犯的）
v1.3.23 里我把 3P 冠军回滚到 **v1.3.11 的包（v5）**，但 `PACK_VERSION` 早在 v1.3.19 已升到 **6**
→ `checkPack` 拒绝 → **困难档会静默掉回脚本 AI**。
被 `tools/np-test.mjs` 的「N19 多人冠军包：可加载且维度兼容」抓到（30/30 → **29/30**）。

### 修法
1. **重训 v6 冠军**（1500 代 / 75s）：`band=4 pickedWr=0.49 divNorm=0.460 distinct=6`。
2. **模仿默认关闭**：C 方案实测未奏效（只做动作级模仿，学不到跨回合轨迹），
   故 `imitGens` 默认取 `EPIRUS_IMIT_FRAC=0`；需要复验时设 `EPIRUS_IMIT_FRAC=0.35` 打开。

### 教训
**升 `PACK_VERSION` 之后，任何回滚旧冠军的"安全操作"都会造成静默降级。**
回滚冠军前必须先看包版本；本轮是靠 np-test 的版本断言才发现的——
这条断言（v1.3.12 加的）价值在这一刻兑现了。

回归：spec 37/37、np-test **30/30**（恢复）。

