# PREREG：长程计划 × 短程攻击的权衡（a+b）（ZCode · 11-01 下午）

> 用户命题："能不能做到长程计划和短程攻击的权衡"。背景：代 3 伤害全押雷/炮（配给线短程 = 0、激光剑全代 3 = 0），
> 冠军短程 22.7%、池中位 ~24%；转移伤害实测无效（§九）；过拟合三来源见 §十。
> a = 短程教师进蒸馏；b = GA 换 RICH 压力面。判据先于臂提交。

## 一、两条改动（都不动引擎规则、不动判尺）

**a. `--teacher=ration2`（supfit-gd 新档）**：ration 的长程配给骨架**原样保留**（激光眼破防配额 1 → 大雷配额 1 →
电磁炮 → 环配额/streak → 链兜底），在**链兜底之前**插两格短程剂量：
- 激光剑：目标取血最低活敌，配额 **2/局**；
- 枪：目标取血最低活敌，配额 **3/局**；
- 然后才是 pickChain（蓄能经济）。
配给语义不变：贵线有上限，短程有配额，链把剩下的地盘拿去攒珠。蒸馏臂 = **GD3-SWORD**：
`--upstream=scratch/arms/GD3-RATION.bak --teacher=ration2 --groups=800 --objective=key --shapeBal=1`（与 RATION 同配方，只换教师 + 暖起点）。
回退许可：若 R2-1 在蒸馏阶段判败，允许**一次**降剂量重蒸（剑 2→1、枪 3→2），记档后才进 GA——不做第二次。

**b. train-3p 对手表增补（加法，默认关）**：`COUNTER_OPP_TABLE` 增 7 席（heavyfire/deepsaver/protomine/ringspam/
targeter/deadlineburst/earlypressure → OPP_SPECS 同名 fn；gunSpam 已在表）。GA×RICH 面 =
**原生 9 + 这 8 席 = 17 席**（`EPIRUS_COUNTER_OPPS=targeter,gunSpam,ringspam,protomine,deadlineburst,earlypressure,heavyfire,deepsaver`）。
与 RICH-13 的差：多了 balanced/aggro/breakdef 三席原生（比 RICH 略杂，无 single 变量意义，如实记档）。
回归腿：不点旗标时逐字原行为（v7 1 代小跑轨迹逐字同）；点的旗标名不存在当场 exit 4（既有闸）。

## 二、臂

| 组 | 起点 | 面 | 种子 |
|---|---|---|---|
| GA2R-sword | GD3-SWORD（ration2 蒸馏） | 17 席（上） | 7 / 13 / 41 |
| GA2R-broad | BROAD-tkCH-s41 | 17 席 | 7 / 13 / 41 |

形状同 §GA-SHAPE：400 代 × pop 8 × games 8 × N3，seg 变异，不开广度旋钮。

## 三、判据（权衡 = 长程不掉 + 短程进场 + 强度不塌）

- **R2-1 长程存活（蒸馏阶段）**：GD3-SWORD 的 mastery 桶线 ≥2 条（环/大雷/炮）。
- **R2-2 短程进场（蒸馏阶段）**：GD3-SWORD 的 5P 分布 枪+激光剑合计 ≥8%。
- **R2-3 GA 后长程**：GA2R-sword 三粒中 ≥2 粒桶线 ≥2 条。
- **R2-4 GA 后短程**：GA2R-sword 三粒中 ≥2 粒 枪+剑合计 ≥8%；GA2R-broad 三粒中 ≥2 粒 枪+剑合计 ≥15%（起点 13.3%）。
- **R2-5 强度不塌**：终点 5P 四骰均值 ≥ 对应起点 −5pt（sword 组起点 = GD3-SWORD 自身；broad 组起点多骰均值 48.5）。
- **R2-6 gunwall**：≥ 各自起点（RICH 面的针对性读数）。
- 附带必读：3P、出手种/有效种类、gunwall、激光剑是否仍是 0（教师教剑后它进不进菜单）。
- 诚实边界：17 席面 ≠ RICH-13（多三席原生），与 RICH-b41 的 CEM 读数只作方向对照；权衡的"权衡"二字以
  R2-3 ∧ R2-4 ∧ R2-5 同时成立为准，缺一角就是"又塌向一头"，如实记档。
