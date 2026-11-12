# HANDOFF · 2026-11-13 晚班入口（写给晚班 agent）

> 白天/凌晨班（02:34→09:00）交接。STATUS 全文 = `STATUS-2026-11-13-night4-zcode.md`；
> 上接夜3班 = `STATUS-2026-11-13-night3-zcode.md`。配置陈述只引用 `training/TRAINING-KNOBS.md`。

## 你接手时的世界

- 全部已提交推送（HEAD 至少 `3ff7fea8` 之后还有收工批）；工作树应当是干净的（若有余留，先 `git status` 对账）。
- 门禁：np 全绿账闭合（D234 竞态红已在 ship 组 52/52 复骑关闭）‖ spec 64/64 ‖ smoke/battle/map OK。
- 三条裁定已落地：过载炮保留（R66）‖ 2P 统一池（旧 v7 名册 = `pool-members-2p.tsv` 现在是**训练对手名册**，
  `EPIRUS_POOL_OPPS_TABLE=champion-map/pool-members-2p.tsv` 消费）‖ Δε ε=0 半边 pilot 已写进图（24 点亮）。

## 晚班主任务（按优先级）

1. **Δε 全量批 = 本班已做完**（912 枚 × 2 桌形零失败，ingest +7104 行，页面已重烘）——你接手时全图应已点亮。
   若页面显示异常，按此链路自查：`eps0-ingest.mjs`（幂等）→ `build-view` → `rebuild-map.mjs`。
   分布与"现役 T8-s114 探索脆（−0.066，第 3 百分位）"的读数见 STATUS-night4 §三。
2. **MSB18 = 本班已完**：C 0.0094→0.0853，但 mastery 复验环被洗掉（两线保住）——"GA 用 C 换语义"再度实锤。
   D191 端到端 ✔（6 条别名自动登记，meta 16/16）。晚班：GD6a/GD6b/MSB18 三枚 12 线体测（promote-champion --dry）定进池位。
3. **GD6 系进池评估 = 体测已跑，卡在壳上**：promote --dry 响亮失败（`EPIRUS_CHAMPION_3P_META` 找不到——
   proto2 容器形状）⇒ **晚班第一件事 = 壳转换**（`training/proto2/convert-obs3c.mjs` 同类先例）再 promote --dry；
   转换器 = `scratch/zcode-1113-deps/proto2-to-3p-shell.mjs`（补 META 行，权重不动）——**已跑完**，细账：
   **GD6a-3p 只差 1 条**（场A 还手 12%<20%，广度/G4/G5 全过 ⇒ 晚班补"被围殴还手"再测，进池最近）；
   **GD6b-3p 5 条阻断**（核心病 = 兑现塌缩：只 1 种打上血、每回合伤 0.311、防席夺冠 100% 打不穿防御墙
   ⇒ 候选方向 = 兑现/还手剂量或攻击型桌形再蒸）。**GD7a dagger 臂已试 = 负结果**（还手 7.7% 更差、G5 仍塌；
   学生自访留出 93% 但行为没变）——蒸馏技巧面已收口。**换教师路线已有两个数据点**：GD8 toolkit 探针 = 标签 14 键（防/反/八卦全套，还手/广度的
   教学材料）但不打 bigT/环；ration = 靶向三线但不还手。⇒ **双教师实验链已探完**（机制就绪 + 四个数据点）：GD9/GD9b（组级混采）‖ GD10/GD10b（键道掩码，frac 0.5/0.15）
   全部 = 行为全零——**状态级策略分歧是定性的**，15% 份额也毁火线；GD11（教师=pack:MSB14）= 该包采集态不演示
   bigT/环。⇒ 结论：**没有现成教师同时演示"火线+还手"**，唯一活路 = **N 教师不相交键道**（ration 独占
   ring/bigT/railgun/charge ‖ MSB14 独占 gun/sword/snipe/reflect ‖ toolkit 独占防族）——teacher2keys 机制本班
   已落地且回归（字节不变），推广 teacher3..N 是机械活，晚班第一实验。MSB18 已体测 = 三条阻断（广度 G<3 ×2 桌形 ‖ 场A 还手 11%<20% ‖
   G5 防席夺冠 34%/39%>25%）⇒ 研究点不进池，广度补课是它的路。
4. **技能上限·环境矩阵研究**（用户 11-13 指令）：雏形在 `scratch/zcode-1111-single-skill/env-matrix.mjs`
   （7 桌形 × multi/long × 逐卡出手占比）。可扩桌形（2P 统一池桌形/长程/经济桌）+ 对 GD6/MSB18 产物跑并集谱。
5. **B 轴观察账**：`scratch/zcode-1113-deps/baxis-{F2,F3k2}-1113.tsv`（5 新产物 × 双夹具）已落，
   继续积累样本量，≥100 再议换尺（11-12 裁定仍有效：暂不换 F3k2）。

## 红线提醒

- 后台任务靠自动通知，**不许前台 sleep 轮询**；并行子代理 ≤2。
- 不跑整轮门禁；按面 `node tools/gate-all.mjs --auto`。
- 新尺 = 新列族；判定 A/B/C 三列同看；批量表带 champ= 列。
- 超长活（换尺全图/全量 Δε）按用户指令就是晚班的活，白天班不硬扛。
