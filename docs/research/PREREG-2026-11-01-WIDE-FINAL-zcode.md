# PREREG：v4 = 两道关口同一把尺（WIDE_FINAL）（ZCode · 11-01 深夜，用户 21:1x 点名）

> 依据：指纹账（RESULTS §十三）——演化门槛在父母面选宽（末代 gi0 = 宽粒 3.08/3.37），但 hall 准入/终局重验仍按 fit
> ⇒ 宽粒被挤出、产物=另一粒。v4 = 终局也走**同一把宽尺**（同谓词、同参照、同 mirrorHealth 调用）。
> 千问交接件 §五.1 的实现版；判据先于臂提交。

## 一、接线（默认全关；`EPIRUS_WIDE_FINAL=1` 必须与 `EPIRUS_GA_GATE` 同开，否则当场拒）

1. **全程最宽粒追踪**（门槛块内，零训练侧行为变化）：凡门槛读出 wide 粒，记 `bestWideSeen`（参数**快照拷贝**、
   wid、代数、wideScore=两模式 effSkillsLand 之和——与门槛带内排序键同式）。
2. **终局池追加**（`HALL_SEED` 同款先例）：终局重验前，`bestWideSeen` 不在 hall ⇒ 追加为一粒候选（fit=null），响亮 banner。
3. **终局宽选**（在既有退化/窄/送盾 veto **之后**）：对幸存候选用 `wideMetricsOf`（与门槛同函数）+ 同参照 `GA_INC`
   （起点同 n 读数）判同一谓词（两模式 effSkills≥3 ∧ isWideVs）⇒
   - 有宽粒 ⇒ **宽中取重验分最高者**为产物；换人时响亮打 `[wide-final] 换人`；
   - 无宽粒 ⇒ 保留原产物 + `wideFinalAllNarrow` 响亮（不许静默）。
   训练轨迹不受影响（追踪只读不改选择）⇒ 对照 = 同命令不开 WIDE_FINAL（GATE3 在册读数）。

## 二、臂

`GATE4-s7/s13/s41` = GATE3 原命令（GD3-SWORD 起点、17 席面、GATE=3/GAMES=6/BAND=0.13、400 代）+ `EPIRUS_WIDE_FINAL=1`
+ `EPIRUS_HALL_TRACE=1`（指纹闭环）。对照 = 在册 GATE3（45.2/43.4/59.6，全窄）与 GA2R-sword（53.3/67.5/64.1，宽但镜里塌）。

## 三、判据

- **V4-1（机制闭环）**：产物 wid == 指纹里的宽粒（或终局池宽粒）⇒ "宽粒坐进产物席"成账；产物重读（wide-check n=40）过同谓词。
- **V4-2（强度记账，不立"不塌"线）**：5P 四骰均值如实报，对照 GATE3 与 GA2R-sword；这一步的问题是
  "宽粒坐进产物席要付多少强度账"，允许为负，不许藏。
- **V4-3（长程线）**：产物 mastery 桶线 ≥2 条（权衡配方的基本面）。
- **V4-4（三种子一致性）**：≥2/3 粒 V4-1 成立 ⇒ v4 机制级成立；1/3 ⇒ 记"种子条件性"，不推。

## 四、边界

不动 `js/**`、不动池/槽、不 promote；指纹与审计原件全落 `scratch/`；臂后读数 ~15 分钟。产物只落 `scratch/ga-arms/`。
