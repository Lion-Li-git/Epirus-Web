# HANDOFF · 2026-11-13 晚班入口（写给晚班 agent）

> 白天/凌晨班（02:34→09:00）交接。STATUS 全文 = `STATUS-2026-11-13-night4-zcode.md`；
> 上接夜3班 = `STATUS-2026-11-13-night3-zcode.md`。配置陈述只引用 `training/TRAINING-KNOBS.md`。

## 你接手时的世界

- 全部已提交推送（HEAD 至少 `3ff7fea8` 之后还有收工批）；工作树应当是干净的（若有余留，先 `git status` 对账）。
- 门禁：np 全绿账闭合（D234 竞态红已在 ship 组 52/52 复骑关闭）‖ spec 64/64 ‖ smoke/battle/map OK。
- 三条裁定已落地：过载炮保留（R66）‖ 2P 统一池（旧 v7 名册 = `pool-members-2p.tsv` 现在是**训练对手名册**，
  `EPIRUS_POOL_OPPS_TABLE=champion-map/pool-members-2p.tsv` 消费）‖ Δε ε=0 半边 pilot 已写进图（24 点亮）。

## 晚班主任务（按优先级）

1. **Δε 全量批**：`node scratch/zcode-1113-deps/eps0-pilot.mjs --n=9999 --concurrency=4`（≈926 枚 × 2 桌形 × ~40s，
   并发 4-6 路约 3-4h；18 核可开更高）。产物 = `scratch/zcode-1113-deps/exam4-F2-eps0-1113.tsv(-long)` 会**被覆盖**
   ⇒ 先 `git mv`/备份 pilot 两份（或改输出名 `eps0-pilot` 里的文件名常量），再跑全量。
   跑完：`node scratch/zcode-1113-deps/eps0-ingest.mjs` → `node champion-map/rebuild-map.mjs` → 全图 Δε 点亮。
   ⚠ ingest 幂等（键查重）；rulers 行已建（b-f2-eps0-1113，axis X）。
2. **MSB18 收尾评估**（我这边在跑，可能已完）：`scratch/night-adapt2/msbatch2-MSB18-summary.json`；
   起点 GD6b-TILT（三线 mastery ✔），D191 端到端验收 = 看 `pack-aliases.tsv` 尾部有没有 MSB18 臂**自动**登记的行
   （tool=train-3p）——有 ⇒ 根因修复实证，今晚起不再人工补账。
3. **GD6 系进池评估**：GD6a/GD6b 按 12 线体检（`tools/promote-champion.mjs --dry`），过线才谈 promote；
   GD6b 是首个"环+大雷+电磁炮"三线同保产物。
4. **技能上限·环境矩阵研究**（用户 11-13 指令）：雏形在 `scratch/zcode-1111-single-skill/env-matrix.mjs`
   （7 桌形 × multi/long × 逐卡出手占比）。可扩桌形（2P 统一池桌形/长程/经济桌）+ 对 GD6/MSB18 产物跑并集谱。
5. **B 轴观察账**：`scratch/zcode-1113-deps/baxis-{F2,F3k2}-1113.tsv`（5 新产物 × 双夹具）已落，
   继续积累样本量，≥100 再议换尺（11-12 裁定仍有效：暂不换 F3k2）。

## 红线提醒

- 后台任务靠自动通知，**不许前台 sleep 轮询**；并行子代理 ≤2。
- 不跑整轮门禁；按面 `node tools/gate-all.mjs --auto`。
- 新尺 = 新列族；判定 A/B/C 三列同看；批量表带 champ= 列。
- 超长活（换尺全图/全量 Δε）按用户指令就是晚班的活，白天班不硬扛。
