# 交接 · 2026-11-08 晨（ZCode 夜班 → 早班）

> 分支 **`night-1107-adapt`**（未并 main；main 停在 cfce7eb1 + 深夜三笔：91c6b0f6 / e3fb32eb / cfce7eb1 已推）。
> 夜班令：小遗留推送 ✓ ‖ 开分支做到 09:00 ✓ ‖ 训练方法换新考卷 ✓（结论=方法论必须换）‖ 防御族研究 ✓。

## 一、状态

- 工作树干净；分支已推（origin/night-1107-adapt）。**没有合并回 main**——等用户看终账。
- 图侧零改动（页面/champion-map 只动过 POOL-CONTRACT 文档）；引擎（js/**）零改动。
- 12 支臂包在 `docs/artifacts/night-adapt/`（未入库大文件只在本地 + 读数日志在 scratch/zcode-1106/*.log）。
- 在研的 DS 防御消融线（scratch/ds-1107-def/）没动，B1 已与它合流（q-def-ablation 是 B1 的基座）。

## 二、必读三份

1. `RESULTS-2026-11-07-night-zcode.md` §四十（池画像）§四十一（夜班执行）§四十二（正赛终账）。
2. `LIVE-LINES.md` 追记 63/64。
3. `docs/POOL-CONTRACT.md` 末节"池 v2 候补标准（**待批**）"。

## 三、今晚结论一句话版

- **读数侧全立住**：防御效用=f(键，人数，桌形)（reflect/guard 承重、bagua 累赘）；阻断频谱 G38%/清场26%/反弹墙20%；技能宽度不相关（0.062）而 noThreat站桩 −0.446 是最强负信号；池垃圾 8 枚立账（GD3ALL-G5-s13 是克星席例外）。
- **训练侧全负但值钱**：种子彩票 ≫ 处理效应（课程/credit/环境 × 两 seed 全翻符号）；ship 线 400 代 3/3 塌方而**臂内终评看着健康** ⇒ 选拔必须以考卷三件套为门；800 代零新最优（§E589 拦截）。
- **唯一强候选**：ADAPT-B-s13（0.390/0.474 双尺第一，超 Q-s47）——种子彩票产物，入池必须过 v2 闸复测。

## 四、早班动作（11-08 晨按用户裁重排：主粮 = 2.0，v7 臂降级为方法论验证）

0. **【新增·最高优先】v7→2.0 蒸馏克隆产线**（METHODOLOGY 145，用户裁"只有克隆到 2.0 的 v7 包才能做种子"）：
   ① 建入口：v7 教师包（Q-s47 / U-s205 / ADAPT-B-s13）→ 行为蒸馏 → v:92 包（`probe-distill-*` 是探针级，
   要落成标准产线工具，收尾自动接三件套）；② 保真闸：克隆包四格卷三件套 ≈ 教师（同尺量师徒）；③ 用克隆包当
   `EPIRUS_SEEDPACK` + `EPIRUS_ARCH2=1` 跑 2.0 正赛（3-seed 配对 + 考卷门）——**夜班方法论原样平移，只换架构**。
1. ~~A1 落地~~ **已完成**（11-08 凌晨二段）：train-3p 收尾自动接三件套（`EPIRUS_TRIPLET=1`，默认关历史逐字复现，冒烟自证过）。
2. **3-seed 正赛框架**：处理臂 × ≥3 seeds 配对（读配对均值 + 符号一致性）；训练桌评估降级为过程曲线。
   ⚠ 架构按 0 的产线走 2.0；v7 线只余候补验收。
3. **ADAPT-B-s13 验收**（v7 线候补，降级）：12 线补测 → 三件套复测 → POOL-CONTRACT v2 五门槛 → 进池 v2 替补。

## 五、注意事项

- 训练臂发射参数模板（已验证可用）：`EPIRUS_SEED=<s> EPIRUS_HOTSTART=1 [EPIRUS_SEEDPACK=<包>] EPIRUS_T3P_OUT=<出> [EPIRUS_MIX2_EVERY=4 EPIRUS_MIX8=4 EPIRUS_MIXHP_EVERY=2 EPIRUS_COURSE_EVERY=2] [EPIRUS_WALL_BREAK_W=0.5 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5] node tools/train-3p.mjs <代> <N> 24 8`。
- U-s205 是 **v7 架构包**（别带 EPIRUS_ARCH2——v:92-only 守卫会 exit 5，今晚试过）。
- 60 代 ≈ 4-5 分钟/臂、400 代 ≈ 13-24 分钟、800 代 ≈ 24 分钟——预算便宜，别吝啬 seeds。
- §E589 去重守卫会在产物重复时 exit 9（B8 遇过）：看见 9 先查"是不是收敛到已有粒"，不是事故。
- 用户口径回顾：2P 不必刷满只求不短板；各人数血量兼顾；考卷池没刷满不动；训练对手随便用；池垃圾等强包就位再清。
