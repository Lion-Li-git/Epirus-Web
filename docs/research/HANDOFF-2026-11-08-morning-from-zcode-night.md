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

## 四、早班动作（11-08 晨二次更新：克隆桥已走通，看 RESULTS §四十三）

0. ~~v7→2.0 蒸馏克隆产线~~ **已走通**（凌晨二段）：`supfit-full.mjs` 三参数化（--teacher/--balance/--collect）+
   双门保真闸 → KD-Qg（Q-s47 教师，0.280/0.380 防富 39.3%）→ **CTRL2-Q-s7 = 0.427/0.459 图上最强包首次是 2.0 包**。
   配方注意：键级均衡采样会 guard 畸变（用 --balance=0）；自访采集守癖螺旋（--collect=teacher 留作下一档实验）。
1. ~~A1 落地~~ **已完成**：`EPIRUS_TRIPLET=1` 收尾自动读考卷三件套（`EPIRUS_TRIPLET_LOG` 台账）。
2. **候补验收队列（最高优先）**：CTRL2-Q-s7 / ADAPT2-Q-s7 / CTRL2-Q-s13 → 12 线补测（现全空）→ 三件套复测 →
   POOL-CONTRACT v2 五门槛 → 过则进池 v2 替补（联动清理候选 8 枚，GD3ALL-G5-s13 克星席例外）。
3. **白防率 v2（墙体归因）**：v1 对 guard 型校准好、对 reflect 墙型系统性高估白防（CTRL2-Q-s7 91% 是度量失真）——
   把 `blocked(to=队友)` + 墙体范围/存在纳入窗口。工具 = `scratch/night-adapt2/def-audit.mjs`（已支持传包）。
4. **下一轮 2.0 臂**：种子候选 = KD-Qg（已验证）/ KD-U（0.234/0.290，守癖 65% 需重蒸 --balance=0）/ KD-Qg-l；
   处理 = 裸跑为主（3 seed 均值最优）+ 课程+credit 为适应性档（短换长形状）——白防率进选拔读数（credit 降档）。

## 五、注意事项

- 训练臂发射参数模板（已验证可用）：`EPIRUS_SEED=<s> EPIRUS_HOTSTART=1 [EPIRUS_SEEDPACK=<包>] EPIRUS_T3P_OUT=<出> [EPIRUS_MIX2_EVERY=4 EPIRUS_MIX8=4 EPIRUS_MIXHP_EVERY=2 EPIRUS_COURSE_EVERY=2] [EPIRUS_WALL_BREAK_W=0.5 EPIRUS_REFLECT_W=0.5 EPIRUS_GUARD_HIT_W=0.5 EPIRUS_DEF_ADAPT_W=0.5] node tools/train-3p.mjs <代> <N> 24 8`。
- U-s205 是 **v7 架构包**（别带 EPIRUS_ARCH2——v:92-only 守卫会 exit 5，今晚试过）。
- 60 代 ≈ 4-5 分钟/臂、400 代 ≈ 13-24 分钟、800 代 ≈ 24 分钟——预算便宜，别吝啬 seeds。
- §E589 去重守卫会在产物重复时 exit 9（B8 遇过）：看见 9 先查"是不是收敛到已有粒"，不是事故。
- 用户口径回顾：2P 不必刷满只求不短板；各人数血量兼顾；考卷池没刷满不动；训练对手随便用；池垃圾等强包就位再清。
