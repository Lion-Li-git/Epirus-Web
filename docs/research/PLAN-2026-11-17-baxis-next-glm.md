# PLAN · 2026-11-17 · B 轴夹具审计与下一轮（给 GLM）

> 交接时间：2026-11-17 23:35 +08:00。
> 目的：不是再换一组固定夹具刷分，而是先判断现役 B 轴到底在量什么，再设计一组低风格偏置、可复算的外部 B' 尺。
> 当前产品池 17 枚、版本 v2.1.0 均未改；本文所有实验包只在 scratch。

## 一、背景：B 轴为什么可疑

现役 B 轴是 F5 冠军墙（5 枚冠军席，长/短两档），定义见 FINDING-2026-11-14-obs6-coldstart.md：

- F5 = MSB11-R2S306293884 + MSB14-railgun-R1S175656469 + WSEL9-200 + MSB15R-HITMIX + GD6a-TILT；
- 主尺 C = (A + B) / 2；A 是脚本桌，B 是冠军墙。

已有回归证据（FINDING-2026-11-11-exam-old-vs-new.md §3.5）：

| 轴 | R² | 最重风格系数 |
|---|---:|---|
| A 短 P5 | 0.299 | rwDmg +0.32 · dmg +0.29 · rounds −0.21 · heavy −0.34 · holo −0.23 · Geff +0.41 |
| B 短 P5R | 0.423 | rwDmg +0.32 · fieldAAtk −0.46 · noThreatStance +0.21 · S −0.23 · Geff +0.28 |

- B 的风格解释力比 A 更强；
- B 奖励 rwDmg（真实伤害/破反弹），惩罚 fieldAAtk（露头攻击），奖励 noThreatStance（藏威胁）；
- v7 后期 B 下降的机制是 charges +5.4 / rwDmg −4.4，不是“回合变长”；
- 长回合方向：A 短 −0.141，B 短 +0.156 ⇒ B 本身并不惩罚长回合。

结论：B 不是纯强度尺，不宜单独决定入池。

## 二、已跑的实验（2026-11-17 晚）

### 2.1 夹具

| 代号 | 成员 | 用途 |
|---|---|---|
| F5 | MSB11-R2S306293884, MSB14-railgun-R1S175656469, WSEL9-200, MSB15R-HITMIX, GD6a-TILT | 现役 B 基线 |
| EXT-A | MSB11-R2S306293884, MX6-GD-TF15, MX8-TN25-KL, MSB15R-HITMIX, OBS6-LH6P | 外部均衡组 |
| EXT-B | MSB14-railgun-R1S175656469, DEF-s16, MX8-R6B-KL, OBS6-SHAPEDIST-V3S2, MX5-GD-T2STR | 外部反墙/经济组 |

EXT-A/EXT-B 都不含被测代表点；POOL17/HARD8 已试过，慢且有被测点自评污染，弃用。

### 2.2 代表点

新包：EQ-S4-E9、EQ-S4-GD6ATEACH、MX5-GD-LE40、EQ-S4-RINGEC6、EQ-S4-RINGB2。
旧包：OBS6E9、T8-s114、v7blk1-92。

### 2.3 命令

~~~powershell
node tools/exam-4n.mjs 6 77000 <pack> --exam=B --mode=long --champ=<fixture>
~~~

口径：rounds=6 seed=77000，长桌，B 轴；X̄₄ = 0.15·x2 + 0.25·x3 + 0.45·x5 + 0.15·x8。
所有读数都是 scratch 读数，未改 registry/图/池。

### 2.4 结果（长桌 B 轴 X̄₄）

| 代表点 | F5 | EXT-A | EXT-B |
|---|---:|---:|---:|
| EQ-S4-E9 | −0.089 | +0.018 | +0.029 |
| EQ-S4-GD6ATEACH | −0.057 | −0.133 | −0.031 |
| MX5-GD-LE40 | +0.021 | +0.027 | +0.110 |
| EQ-S4-RINGEC6 | −0.047 | −0.120 | −0.075 |
| EQ-S4-RINGB2 | −0.124 | −0.044 | −0.135 |
| OBS6E9（旧 v7） | +0.293 | +0.164 | +0.055 |
| T8-s114（旧 v7） | −0.163 | −0.181 | −0.224 |
| v7blk1-92（旧 v7 长程） | +0.423 | +0.283 | +0.086 |

### 2.5 已能确认的结论

1. B 不是“长程一律低”：旧 v7blk1-92 长程三组都高；OBS6E9 也高。
2. B 惩罚的是“经济型长程/低真实伤害”：RINGEC6、RINGB2、GD6A 在三组外部夹具下都低；T8-s114 稳定垫底。
3. E9 对夹具敏感：F5 倒数，EXT-A/B 回到中位；F5 单独会低估它。
4. RINGEC6 不是被 F5 冤枉：EXT-A/EXT-B 都低；它的长桌 A≈0.168, B≈0.008，是 A/经济特化包。
5. F5/EXT-A/EXT-B 对高位包的排序大体一致（v7blk/OBS6E9/LE40 高，T8/RING 低），但中位包会翻；不能只报单组。

## 三、给 GLM 的下一阶段计划

### Phase 0 — 固定口径，先别改产品

- 保留 F5；不要覆盖现有 B 列。
- 新 B' 只作为研究列/新列族（遵守 §E597：新尺 = 新列名，不许同名覆盖）。
- 不改池、不改版本、不改 promote 判据，直到用户裁。

### Phase 1 — 扩充外部夹具与代表点（优先）

夹具：先固定 EXT-A/EXT-B，新增 EXT-C 作为旧包外部组。建议 EXT-C：

~~~text
MSB11-R2S306293884
MSB14-railgun-R1S175656469
MSB15R-HITMIX
MX6-GD-TF15
OBS6-LH6P
~~~

EXT-C 与 EXT-A 有意重叠 3 枚，但替换掉 MX8-TN25-KL，用于测“同风格墙内换一枚”的稳定性；如果与 EXT-A 排名相关 <0.6，说明夹具对单枚成员过敏，需再扩。

代表点：至少 12 枚，必须新旧混合：

- 新：EQ-S4-E9、EQ-S4-GD6ATEACH、MX5-GD-LE40、EQ-S4-RINGEC6、EQ-S4-RINGB2；
- 旧：OBS6E9、T8-s114、v7blk1-92、Q-s47、GD16m；
- 结构点：MX5-GD-T2STR（池内最强综合）、DEF-s16（防御/反墙）。

目的：让“强/弱/经济/反墙/旧代”都有锚点，避免只用新包导致夹具看起来稳定。

### Phase 2 — 统计，不靠单组分

对每个点跑 F5/EXT-A/EXT-B/EXT-C：

1. 计算 Spearman 排名相关（4 组两两）；
2. 对 B 做风格回归：B ~ rwDmg + fieldAAtk + noThreatStance + S + Geff + rounds，报 R² 与标准化系数；
3. 输出 rank mean / rank median，不直接平均原始分；
4. 标记：
   - 四组同向高 → “实际能力/抗墙”；
   - 只在某组高 → “风格特化”；
   - 四组都低 → “不适合 B 角色”。

### Phase 3 — 选 B'

B' 的候选规则（预注册，先写死再跑）：

- 至少 3 组外部夹具（EXT-A/B/C）；
- 组间 Spearman 中位 ≥ 0.7；
- 不用绝对分门槛，只用排名；
- 若达不到 0.7，不选 B'，回到 Phase 1 增加夹具/点，而不是改模型。

不要把 F5 的绝对分和 EXT 的绝对分直接平均；它们的尺度/风格不同。

### Phase 4 — 接入方式（需用户裁）

- 方案 A：B' 只做研究列，不进入 C/pool；用于解释 B 低是风格还是能力；
- 方案 B：B' 作为第二把 B，与 F5 并列报告；池准入仍用 F5/实际桌强度；
- 方案 C：B' 替换 B（风险最大，需重新量全库、换列族、版本 bump）。

默认建议 方案 A → B，不直接替换。

## 四、实现注意（给 GLM 的工程约束）

1. exam-4n --champ 只认 registry 在册 id；scratch 包不能直接当夹具，必要时先注册或加临时 registry。
2. --exam=B 要求至少一个 --champ；N=2 会轮换冠军，N≥3 用多个冠军席。
3. 不要用 POOL17/HARD8 当 B'：包含被测点，自评污染；而且 17 枚跑得慢。
4. 固定 rounds=6 seed=77000 mode=long；换种子/回合必须换列名，不能混表。
5. 读数落 scratch 或新研究表；不要写 display.tsv/registry 做“临时对比”。
6. 如果新增列，遵守：
   - 新列族（§E597）；
   - 旧 B 冻结；
   - rebuild-map 100 PASS 后才算落图；
   - 不改池/版本，除非用户明确裁。

## 五、当前仓库状态（交接）

- 池 17 枚（hard8/soft9），版本 v2.1.0；本工作未动。
- 本地有未推送提交 22c860e6（谱系统一/ MSB15 家族），先确认是否要随下一笔代码一起走。
- 未提交：
  - training/proto2/supfit-gd.mjs（Gemini 的 ringEcon 教师 + 我们的 charge 教师）；
  - docs/skill-report.html；
  - 未跟踪 docs/research/FINDING-2026-11-17-ring-econ-direction.md。
- RINGEC6/RINGB2 只在 scratch/arms/，未入池/未入图。
- 本文所有 B 读数都是 scratch，不是产品读数。

## 六、一句话给 GLM

先把 B 从“单组 F5 绝对分”改成“多组外部夹具的排名稳定性”再谈模型；RINGEC6 的 B 低不是 F5 冤枉，而是经济型长程在四组里都低；要补 B 应从 v7blk1-92/OBS6E9/LE40 这类“真实伤害型长程”取教师，而不是继续加 ring。
