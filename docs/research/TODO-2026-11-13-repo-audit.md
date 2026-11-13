# 仓库非 ZCode 路线待办与治理计划（2026-11-13）

> 本文档整理自全仓核查（排除已于 `3a32e551`、`79001594` 修复推送的核心战斗结算规则与 3D 曲面缓存问题），并与界面/文档同步修正一并落盘。ZCode 训练线的实验交接继续以 `docs/research/HANDOFF-2026-11-13-night5-zcode.md` 为主，两线互补、互不越界。
> 训练旋钮配置真源一律引用 `training/TRAINING-KNOBS.md`，本文不复抄具体键表。

---

## 已收口项（供后续基准对照）

1. **核心结算规则与指纹换代**（commit `3a32e551`，`rulesFingerprint: 668081a2 → 120fca4d`）
   - `SK.MINE` 声明 pri 3 / 引爆 pri 0；`SK.MIRROR` 完整按复制技能优先级与全部规则结算（含链式复制、互镜仅 `N15`/`N16` 有效）；回合末统一判定死亡、`SK.PURIFY` 在天火后回血可救命；多 `SK.ROD` 均分能量防浮点；`SK.CANNON` φ3 仅在 `land` 时清目标能量；`SK.LASER_EYE` 层快照破防；对称 `roundTaunts`。
   - 内置 2P/3P 冠军与 `tools/gates/ship-pool.mjs` 夹具（`WSEL9-200.js`）已重测对齐。
2. **冠军演化图 3D 曲面视图与地图越界自检修复**（`79001594` + 本次提交）
   - `过线曲面` 与 `势曲面` 改为按当前 `VIS[i]`（`all` / `1.8` / `2.0`）重建并分桶缓存。
   - `buildBitmap` 越界判定 `nOob` 改为对照可见点真实边界 `BND9.rawLo / BND9.rawHi`（修复 `2f8adf55`/`0fa3bda2` 改为 `p02/p98` 后导致的 `带外 59 格` 误报），CI 四视图 `tree / 1d / 3db / map` 全部达到 `99 PASS ‖ 0 FAIL`。
3. **界面与文档漂移同步**（本次修改）
   - `js/ui/rules-panel.js`：对齐优先级 `5→0` 与声明/结算区别、回合末统一死亡与净化救命、全灭按伤害判胜与平局的矛盾文案、避雷针均分、镜面反射规则、以及「2~8 人共用分级冠军池」（删除旧 2P 独立池表述）。
   - `docs/RULES-2P.md` 与 `docs/RULES-NP.md`：同步上述规则、2~8 人扩展状态及 `N14` 镜面完整执行口径。
   - `js/train/bots.js`：更新 `lv:hard` 注释中的当前 `pool-members.tsv` 成员数（7 hard + 9 soft）。
   - `index.html`：在 `#page-train` 补充说明页内训练服务对应旧 `v7`（2–5 人），现役 `2.0 / obs5` 训练走 `training/`。

---

## 后续待办计划（按优先级分批推进）

### P0｜立即可测与近期阻断清理

| 编号 | 事项 | 现状与问题 | 完成判据 | 涉及路径 |
|---|---|---|---|---|
| **P0-1** | **新规则（`120fca4d`）下冠军池复检** | 原来在 `668081a2` 下测得：5–8P `hard` 池易被 `reflectspam` 反杀（最高 35%）、2P 对 `balanced` 偏软（48%）、约 2/3 卡牌出场率 <0.5%。规则已换代且地雷/镜面大改，旧强度与覆盖度读数仅作参考基线。 | 在 `120fca4d` 下重跑 `probe-pool`、对 `reflectspam`/脚本基线与 30 卡覆盖度扫描，产出新基线表供 ZCode/调池决策。 | `tools/probe-pool.mjs`、`tools/card-usage.mjs`、`champion-map/data/page/pool-members.tsv` |
| **P0-2** | **清零 `pool-members.tsv` 审核欠账** | 在籍 16 行（7 hard + 9 soft）中 `seatKill` 全部为 `-1`；`hard` 中 `KDG-B-Q-s13`/`STR-B-Q-s41` 仍为 `block`、`MSB15R-HITMIX` 为 `untested`、3 枚 `obs5` 标「12 线待复核」、`WSEL9-200` 审核状态为空。 | 由 `promote-champion` / 人席评测流程补齐真实 `seatKill` 与 `promoteVerdict`，明确留用、降软或替换名单。 | `champion-map/data/page/pool-members.tsv`、`tools/promote-champion.mjs` |

### P1｜中期训练系统与策略机制收口

| 编号 | 事项 | 现状与问题 | 完成判据 | 涉及路径 |
|---|---|---|---|---|
| **P1-1** | **页内训练场（`#page-train`）与 `2.0/obs5` 对齐或下线旧服务端** | `index.html` `#tr-n` 只支持 2–5 人、`ui.js:1433` 钳制 2–5 人，`training/server/train-server.mjs` 仍接 `v7`（`EpirusPolicy.loadAny` / `bundled-champion.js`），与现役 `2.0 / obs5` 流水线割裂。 | 明确产品取舍：① 若保留页面训练，迁至 `EpirusPolicy2`（2–8 人）与 `obs5`；② 若定位为开发者脚本训练，移除或冻结旧 `v7` 服务端以免误导。 | `index.html`、`js/ui/ui.js`、`training/server/train-server.mjs` |
| **P1-2** | **评估将「蓄能选珠」纳入动作面** | `js/ui/bead-choice.js` 仍强制替代策略决定电珠/爆珠（缺省交替），策略无法主动按对局形势选择攒珠种类。 | 通过小规模 A/B 实验评估扩动作面（或保留双分支输出）的收益与复杂度，决定是否立项改造策略输出头。 | `js/ui/bead-choice.js`、`js/train/policy2.js`、`training/proto2/arch2.mjs` |
| **P1-3** | **瘦身 `evo.js` 与清理部署期硬编码先验** | `js/train/evo.js` 长达 4279 行，同时承担训练核心与线上推理；`BIGT_PUSH=12`、`DRAIN_PUSH=1`、`SUPPORT_PRIOR` 等人工先验仍嵌在推理/探索分支中。 | 评估可下线的旧推理启发式，逐步把公共辅助拆清（严格遵守不破坏产品侧与训练侧 `policy2/arch2` 双胞胎约定）。 | `js/train/evo.js`、`js/train/policy2.js`、`training/proto2/arch2.mjs` |

### P2｜工程治理、门禁与 CI 卫生

| 编号 | 事项 | 现状与问题 | 完成判据 | 涉及路径 |
|---|---|---|---|---|
| **P2-1** | **环境变量（旋钮）压缩至 KPI `≤40`** | 当前 `node training/knobs.mjs --check` 报：**全集 245 / 在用 235 / 暗键 9**（基线远超 `AGENTS.md` KPI `≤40`）。 | 按「加一删二」原则分批合并/退役历史实验旋钮，每批留前→后计数，并同步更新 `training/TRAINING-KNOBS.md`。 | `training/train-3p.mjs`、`training/knobs.mjs`、`training/TRAINING-KNOBS.md` |
| **P2-2** | **门禁哨兵治理与 `D79` 重签** | `node tools/gate-sentinel.mjs` 目前非阻断：存在 1 条过期签名（`D79@tools/gates/ship-promote.mjs:342`）与 53 条「对源码做正则的门」。 | 重签或改造 `D79`；分批把源码正则门改造成真实行为调用；归零后开启 `gate-sentinel --strict`。 | `tools/gate-sentinel.mjs`、`tools/gates/ship-promote.mjs`、`tools/gates/meta-repo.mjs` |
| **P2-3** | **补齐 3 台研究工具的未知参数拒绝** | `node tools/np-test.mjs --part=meta-lint` 提示 3 台工具读取了 `--` 旗标但未接 `rejectUnknownFlags`。 | 接入统一旗标校验并在 `--part=meta-lint` 下清零提示。 | `tools/champion-gate.mjs`、`tools/exam-fb.mjs`、`tools/score13.mjs` |
| **P2-4** | **CI 浏览器门禁转正** | `.github/workflows/gates.yml:159` `browser` job 仍带 `continue-on-error: true`。 | 连续 5 次 CI `smoke` + `battle` 全绿后移除 `continue-on-error: true`，使真实页面回归成为硬阻断。 | `.github/workflows/gates.yml` |
