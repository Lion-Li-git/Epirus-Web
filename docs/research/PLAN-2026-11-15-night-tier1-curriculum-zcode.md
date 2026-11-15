# PLAN · 2026-11-15 深夜（ZCode）——Tier1/T2 链式技能多代工程课表（下一班执行稿）

> 承 [FINDING-2026-11-15-night-distill-curriculum-zcode.md](FINDING-2026-11-15-night-distill-curriculum-zcode.md)
> §四/§六/§八″ 的三条定律与普查。今晚已验：经济可长（PG ✓）、键道状态未解（轨迹设计）、转化机制通
> （教师示范产量小）。本课表 = 三条定律直接推导的执行序列，**每步有验收判据，不过关就停**。

## 零、前提（今晚已锁定的约束）

1. **主教只有 v7blk1-92 系可用**（K2=白防御脚本收割机；GD16m=窄专家全克隆洗基座）。
2. **自蒸馏放大考卷侧摆动**——练过考卷的血脉（P4/P8/P9 系）不要再自蒸馏；自蒸馏只用干净基座
   （E5c/E6c 直系）。
3. **G4[multi] 是 E5c 血脉系统性质**——要 G4 干净走 v7blk1 蒸馏前缀（E6c→P9 线已证）。
4. **标签跟随轨迹**——键道教师只在学生轨迹到访的状态出标签；轨迹 = 学生基座 × 对手表 × 桌形。
5. 多师 frac **必须互异**（t2frac=t3frac ⇒ Bresnham 同穿饿死低号）。
6. **基座模式反射（11-15 白班 · 用户令"后面训练要注意"）**：E9 系在 long 桌 `ep=2` 即时消费反射固化
   （80 局×5 席：long 16882 手 ring=1/rail=0/ep≥3=7），高权重作长程臂基座会把 GD16m 链道空间挤进
   multi（LH6 倒挂根因：multi ring=2856 vs long 184）——**长程/Tier1 臂不用 E9 系高权重基座**：
   要么走干净冷启动（LH2/GA2PG-8K 线保留了 long>multi 的 ep≥3 倾向），要么压低 E9 权重；
   **评估一律 long/multi 分列**（池级聚合会藏倒挂），recipe 约束 `classPow≤0.25/classCap≤3`
   （LH7 0.33/4.5 即 Gap +10.1 翻正）。详见 [FINDING-2026-11-15-day-obs6-longhorizon-zcode.md](FINDING-2026-11-15-day-obs6-longhorizon-zcode.md) §五/§七。

## 一、T2 层（最快见效：transfer/drain——载体已存在）

普查：CB3-s13/s7 = tank/drain/holo 三键现成载体；transfer 全库只有今晚 E11 一枚（4%，Gap +10 带
摆动）。E11 的配方本身成立（CB3 道加 transfer + rareOnly 靶向），病在基座（P9 血练过考卷）。

- **T2-1**：E11 配方原样，基座换 **E6c**（v7blk1 前缀、Gap −26.8 干净）→ 验收 = transfer 部署 ≥2%
  ∧ Gap ≤ −10 ∧ C5长 ≥ 0.20。过 → 进图 fam23。
- **T2-2**（若 T2-1 转化不足）：P9 线再训一轮 **PG+防御特化对手**（guardspam/reflecttank/protowall）
  ——转移伤害的发射条件（挨打转移）在这些桌上高频出现，PG 奖励直接长轨迹，再接 T2-1。
- **drain**：摄魂窗口 HP≤1/2——只有残血状态出招。PG 侧无 HPSEED 注入口（在册缺）⇒ 开 `--hpSeed`
  采集旗标（残血开局）或改用 **oracleDef 教师**（TEACHER_KNOWN 里现成）在防御态标注。二选一先试
  oracleDef（零代码）。

## 二、T1 层（多代主线：charge 经济 → ring/big_t/railgun 转化）

今晚账：经济 ✓（charge 部署 13-25%）、键道状态 ✗（GD16m/CB3 道在学生轨迹命中 1-52 次）、转化 ✗
（部署 0）。缺口在**键道状态的轨迹密度**。

- **T1-1（状态密度 ×N）**：采集桌形配比倾斜——`--arenaShapes=8:long,8:multi,5:long,5:multi`
  （8p 桌状态数 ~3× 于 5p）+ `--arenaPool=names:bigtfocus,beadburst,dualspam,protomine,ringspam,
  gunspam`（蓄能/大雷/环对手全排）+ **games×3**（supfit --pool=8000 --groups=4000，贵但今晚证过
  键道命中随状态密度走：E8b 14994 vs E6e 1）。
- **T1-2（教师换任）**：主教 v7blk1 降 frac 至 0.55，GD16m 升 **0.30 且放开道**（不设 t2keys——
  GD9 全收语义：它的环/大雷/蓄能标签在它自己被采到的任何状态都收）。风险 = GD16m 窄轨迹洗基座
  （E8c 0.25 frac 洗掉 0.32→0.17），**用 segEvery 式多快照对冲**：supfit 补 `--snapEvery=N`（采集
  轮间存快照，仿 pg-train --segEvery），每轮快照单独评估，选"转化出现且强度未塌"的那一粒。
- **T1-3（转化代际）**：T1-1/T1-2 的最优粒做基座，重复 T1-1 一代——链式技能是**逐代累积**的
  （E10 一代只有 ring 10 标签），预算按 3-5 代排，每代验收 = 环/大雷部署 +1pt 或停。
- 验收判据（全链）：C5长 ≥0.20 ∧ ring/big_t/railgun 各 ≥2% 部署 ∧ Gap ≤ −10 ∧ G 门不塌。

## 三、tank（计划外真空，最便宜的一格）

CB3-s13 本体 tank ● 但它进不了强度线（C5 长）。tank 的发射条件 = 被集火——**tankline/aggro 对手桌**
+ v7blk1 主教：tank 标签会随被集火轨迹自然出现（E9 的 tank 121 标签就是佐证）。**T3-1**：E6c 配方
+ `--arenaPool=names:tankline,aggro,gunspam,wall,heavyfire + t3=CB3 keys=tank,drain,holo 0.15`
→ 验收 = tank 部署 ≥2% ∧ G4/G5 不塌。

## 四、T3 层（mini_t/mine/laser_eye/cannon——全库零开垦）

canon13 的 mine/cannon 都出在 **8p 桌**（MIX8 注释在册：地雷 8p 高性价比）。T3 层整体押后到
T1/T2 落地后（同一套 T1-1/T1-2 机器换键道即可），**不单独立项**。

## 五、池并集路线（与多代工程并行，成本最低）

- **CB3 类包进池裁定**（tank/drain/holo 三键现成载体）——CB3-s13 的 Gap/考卷读数需补测后走
  invited/block 语义（等用户点名）。
- WSEL9-200（railgun ●）已在池；ring 载体 GD16m/K2/T8 在册不在池——进池补 ring。
- 普查工具已入库可复跑（`cov-census-1115.mjs` / `cov-census-broad.mjs`）。

## 六、执行顺序建议（下一班）

T2-1（30 min）→ T3-1（20 min）→ T1-1（40 min）→ 评估验收 → T1-2/T1-3 按结果接力。
每步的产物/meta/Gap 按本班惯例（fam23 + meta 九字段 + mem-probe-e6 --subj）。

## 七、白班续训批（11-15 14:3x，ZCode 实跑——虫修后第一批，两判罚复测 + 课表开动）

前提：§零 6 条（含新补的基座模式反射）。**全部 short arm + 节点评估**（用户令），
评估三件套 = `seg-eval`（C5/X̄₄/用卡/G门）+ `probe-bead-loop` 行为账（**long/multi 分列**）+
`mem-probe-e6 --subj`（Gap）。产物 `scratch/arms/OBS6*.bak`，验收过线才谈进图。

| 批 | 臂 | 配方要点 | 验收判据 | 状态 |
|---|---|---|---|---|
| A | **E8cR** | E5c ← GD16m-D1 主教全克隆（game 模式，教师已修真）+ 全桌形矩阵，pool 2400/dagger 1 | 只回答一个问题：真 GD16m 当主教洗不洗基座（原 E8c −0.1486 是坏教师假象） | 🏃 |
| A | **T2-1R** | 课表 T2-1：E6c 自蒸馏主教 + GD16m 0.20（charge,ring,bigT,railgun）+ CB3 0.15（drain,holo,tank,transfer）+ rareOnly transfer,drain 0.30 + classPow 0.25/cap 3（LH7 边界内） | transfer ≥2% ∧ Gap ≤ −10 ∧ C5长 ≥ 0.20 | 🏃 |
| B | **T1-2R** | 课表 T1-2 修复版重测：v7blk1 0.55 + **GD16m 0.30 放开道（game 驾驶）** + CB3 0.15 + 链对手 + 8p 重桌 + snapEvery=1——T11 的"mega 龟化"是坏教师假象，真 GD16m 高份额重验 | ring/bigT/railgun 任一 long 桌部署 ≥1% ∧ G 门不塌 ∧ Gap ≤ −10 | 待 A 后 |
| B | **LH9-A** | 白班倒挂修正臂（gemini §七.1）：干净 LH2 基座 ← GD16m 主教（game）+ v7blk1 0.25 + classPow 0.25/cap 3 + long 重桌——E9 系 long 反射绕开 | long 桌 ring/rail 部署 > multi ∧ ep≥3 供给恢复 | 待 A 后 |
| C | 视 B 结果 | LH9-B（PG 强度回填：product 池 + klW + lamExp，seg 级 Gap 巡检）或 critic 路线（需先提案，动 pg-train 结构） | C5长 ≥ 0.20 ∧ 链道存活 | 待裁 |
