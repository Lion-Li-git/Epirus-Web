
> **历史账**：v1.x–v2.0.4 的版本节（约 7400 行）于 11-08 白班被裁出本文件且当时未留档；
> 11-08 午后补档 ⇒ 全文见 [docs/CHANGELOG-archive-2026-11-08.md](docs/CHANGELOG-archive-2026-11-08.md)（自 e6d926ce^ 逐字导出）。

> 产物点名（D82）：本批 38 个 band/seg 原始快照（MSB16/MSB16T/MSB17 系）未入仓；目录 docs/artifacts 被忽略，读数与哈希见 docs/research/STATUS-2026-11-13-night4-zcode.md §三B/§四；原始文件约 10 MB，只在盘上保留。

## v2.1.48 — 11-28（`v7` 训练线正式整体退役 · `knobs ≤ 40` 达标 ＆ `LE-S2`/`PH-S2` 分担替换 `MX8-TN35-KL3`/`MX8-R6B-KL`）

**这一版是什么**：经用户拍板授权后执行两项结构性改动：① 正式整体退役历史 `v7` 训练代码并同笔清零活文档引用，将环境旋钮全集从 `185` 合法降至 `≤40`；② 用两枚分离低废珠、`seatKill=0` 的 `soft` 载体 [`docs/artifacts/LE-S2.bak`](docs/artifacts/LE-S2.bak)（`laserEye/firestorm`）与 [`docs/artifacts/PH-S2.bak`](docs/artifacts/PH-S2.bak)（`proto/holo/ring`）替换掉高废珠且带人席否决的 `MX8-TN35-KL3`（`seatKill=2`）与 `MX8-R6B-KL`（`seatKill=1`），池维持 35 枚 `hard 17 / soft 18`。

- **`v7` 整体退役与 `knobs` KPI 收敛**：依 `AGENTS.md §24` 将 [`training/train-3p.mjs`](training/train-3p.mjs) 等 5 个 `v7` 训练侧遗留文件连同 SHA256 清单整体迁出至仓外隔离目录 `D:\code\Epirus-Web-artifacts-quarantine\cleanup-2026-11-28\`；移除 [`training/train.mjs`](training/train.mjs) 的 `--mode=v7` / `--era` 入口、清理 [`training/knobs.mjs`](training/knobs.mjs) 入口与说明、静态化 [`tools/audit-lib.mjs`](tools/audit-lib.mjs) `feasPlan` 对五项局数旋钮的读取。`node training/knobs.mjs --check` 实测降至 **`≤40`**。
- **双载体分担入池与 `MX8` 双退池（[RESULTS-2026-11-28-day-split-v7.md](docs/research/RESULTS-2026-11-28-day-split-v7.md)）**：
  - `LE-S2`（[`docs/artifacts/LE-S2.bak`](docs/artifacts/LE-S2.bak)，`wid=f43d1e2551a4bd7a`）：`FS2-LE26` 底 + `L1B-S1200`（`ring/bigT/drain`）+ Stage C 岭基线 PG，`selftest3` 全绿，Stage 1 胜率 `41.25%`、总废珠 **`27.92%`**（`boom 296/299` 仅 3 过期）、`laserEye=15`、`firestorm=33`，Stage 2 强度 `21` 技，`Arena B = -2.5213pt`，`promote` `0` 阻断、`90210/90211 seatKill=0`；
  - `PH-S2`（[`docs/artifacts/PH-S2.bak`](docs/artifacts/PH-S2.bak)，`wid=1fe874c317e3cf6e`）：`L1B-S1200` 底 + `MX8-TN35-KL3`（`proto/holo/jinshield`）+ Stage C 岭基线 PG，`selftest3` 全绿，Stage 1 胜率 `48.83%`、总废珠 **`51.72%`**（仅 15 过期）、`proto=8`、`holo=29`、`ring=20`、`drain=11`，Stage 2 强度 `25` 技，`Arena B = +28.998pt`，`promote` `0` 阻断、`90210/90211 seatKill=0`；
  - 备份 `MX8-TN35-KL3.json` / `MX8-R6B-KL.json` 至仓外隔离区后通过 `pool-add --retire` 退池；`soft` 全部 `27` 项技能深度均 `≥1`（无任何技能归零），`soft` 现仅余 `1` 枚点名 `seatKill=1`（`MX6-GD-TF20`）。
- **池级与页面验证**：`pool-add --audit` `35 枚 (17/18), bad=[]`、`D234` / `meta-repo` / `D16` / `D168` / `spec-run` / `train-server-selftest` / `knobs --check` 通过；`probe-diff-ladder --pool=1` 在 `2P rule`（`30.8% < 42.3% < 52.1%`）、`2P legacy`（`19.2% < 24.3% < 26.7%`）、`5P multi`（`2.9% < 10.4% < 15.4%` & `3.4% < 10.8% < 17.9%`）、`5P long`（`4.5% < 7.3% < 14.0%`）及 `seed=77000` 全部严格单调；未跑 `--group=engine` 整轮。

## v2.1.47 — 11-28（`train-server` 控制台服务修复 ＆ `TN35-S` 清单外六臂收口）

**这一版是什么**：修复本地训练服务 `training/server/train-server.mjs` 在浏览器打开带 `?token=` 地址返回 JSON 而非页面、对齐交接文档状态，并在不动冠军池（维持 35 枚 `hard 17 / soft 18`）与 `c61298e6` 指纹的前提下完成 `TN35-S` 清单外六臂探索验证与止损收口（`PREREG/RESULTS-2026-11-28-day-tn35.md`）。

- **训练服务控制台修复（[`training/server/train-server.mjs`](training/server/train-server.mjs)）**：新增白名单静态路由 `/app/`（仅放行 `index.html`、`css/**`、`js/**` 与排除 `champion-map/archive/**` 后的 `champion-map/**`；`/app` 入口与全部训练 API 仍校验随机令牌）；`GET /` 对浏览器导航（无 `X-Epirus-Token` 且 `Accept` 含 `text/html`）`302` 跳转至 `/app/?token=...`，保留 JSON 探活/API 行为不变。同步扩充 [`tools/train-server-selftest.mjs`](tools/train-server-selftest.mjs) 校验跳转、HTML/CSS 放行与路径白名单隔离。
- **交接状态对齐（[`docs/research/HANDOFF-2026-11-28-morning.md`](docs/research/HANDOFF-2026-11-28-morning.md)）**：消除 `02:03` 初版与 `06:36/07:48` 已完成项（Pages archive 排除、workflow 触发路径、`cdp-boot.mjs` 重试、soft 收口）之间的表格与 NEXT 重叠。
- **清单外 `TN35-S` 六臂探索与机制结论（[`docs/research/RESULTS-2026-11-28-day-tn35.md`](docs/research/RESULTS-2026-11-28-day-tn35.md)）**：验证 H1（`L1B-S1200` 跨亲蒸馏）、H2（`FS2-LE26` 主从反转 + `--winOnly=0/1` 对照）与 H3（`TN35-FS2.snap0` 两阶段岭基线 PG ＆ `FS-DR` 无 DAgger 嫁接 `proto/holo/jinshield`）。六臂按预注册硬门（覆盖 + `废珠≤60%`）止损淘汰、产物全留在 `scratch/`；确认 `holo/proto` 与 `charge#boom → laserEye` 在单枚 `16561` 维策略头上存在结构性电珠闲置拮抗，且再证 `--winOnly=1` 稳梯度但收窄次级稀有技覆盖。
- **验证**：`train-server-selftest`、旋钮册、`pool-add --audit`、`spec-run`、`meta-repo`、`ship-pool`、`D16/D168` 与 Chrome `smoke.mjs` 定向验证通过；未跑 `--group=engine` 整轮。

## v2.1.46 — 11-28（soft 第二次补强：L1B-S1200 原位替换 RINGB11）

**这一版是什么**：在 v2.1.45 当前池上完成 L1b `seg1200` 的第二次完整准入链，用它原位替换 soft 成员 `RINGB11`，池维持 35 枚 `hard 17 / soft 18`。候选血统 `v:92 / S1o / 16561`，`selftest3` 全绿，Stage 1 胜率 51.58%、并集 19、电珠闭环 84.15%（69/82），A/B/C 为 `MxC=0.2562 / MxCL=0.1197 / arR=0.1565`，两 seed 人席 `seatKill=0`。

- **池级效果**：同抽签同位替换全矩阵保持 hard < regular < sparring；2P rule 普通/简单 `−0.96/−0.94pt`，2P legacy `+0.09/+0.10pt`，5P multi `−0.05/+0.15pt`，5P long `−0.25/−0.43pt`。
- **产品复核**：`seed=77000` 四桌形全部保序；2P rule `−0.50/−0.90pt`，legacy `0/+0.70pt`，5P multi `+0.20/0pt`，5P long `−0.50/−0.30pt`。
- **覆盖收益**：全池有效并集保持 28；soft 的 bagua/curse/drain/ring/snipe 深度各 +1，无技能归零，覆盖只增不减。
- **槽位与审计**：候选放回 `RINGB11` 原第 30 行；`pool-add --audit` 为 35 枚、`bad=[]`、`seatUnknown=0`。现役 invited seatKill 清单未再变化。
- **验证**：Stage 1/2、promote、measure-point、两 seed 人席、bundle/manifest、地图重烘、产品四桌形阶梯和定向门通过；未跑 `--group=engine` 整轮。

## v2.1.45 — 11-28（soft 长程补强：L1B-S600 原位替换 RING-MINIT-CONT）

**这一版是什么**：在 `c61298e6` 新基线上完成 L1b `seg600` 的完整准入链，用它原位替换 soft 成员 `RING-MINIT-CONT`，池维持 35 枚 `hard 17 / soft 18`。候选血统 `v:92 / S1o / 16561`，`selftest3` 全绿，Stage 1 胜率 54.42%、并集 18、电珠闭环 68.67%（57/83），A/B/C 为 `MxC=0.2400 / MxCL=0.1703 / arR=0.2445`，两 seed 人席 `seatKill=0`。

- **池级效果**：同抽签同位替换全矩阵保持 hard < regular < sparring；2P rule 普通/简单 `−0.11/−0.97pt`，2P legacy `+0.04/+0.29pt`，5P multi `−0.40/+0.03pt`，5P long `+0.50/+0.13pt`。
- **覆盖代价**：全池有效并集保持 28；soft 的 laserEye 深度 `2→1`、proto `4→3`、jinshield `6→5`，holo `5→6`，无技能归零。
- **槽位与审计**：候选放回 `RING-MINIT-CONT` 原第 29 行；`pool-add --audit` 为 35 枚、`bad=[]`、`seatUnknown=0`。soft 参照变化使现役 invited `MX8-TN35-KL3` 的带内 seatKill 从 1 更新为 2，未隐瞒。
- **验证**：Stage 1/2、promote、measure-point、两 seed 人席、bundle/manifest、地图重烘、产品 `seed=77000` 四桌形阶梯和定向门通过；未跑 `--group=engine` 整轮。

## v2.1.44 — 11-28（通宵审查修复：训练服务认证 / 金刚盾交叉规则 / UI 与池整表校验）

**这一版是什么**：修复通宵审查确认的 P0/P1/P2 缺陷：本地训练服务增加随机令牌、Host/Origin 校验和 POST-only 控制，并等待进程树真正退出；金刚盾主动判定接入狙击干扰与地雷触发；UI 修正下一回合无极变速徽章和 session 新包优先级；池整表增加数量、ID 集合与重复校验。冠军权重未改，规则指纹 `442b4b68 → c61298e6`。

- **训练服务**：`training/server/train-server.mjs` 默认生成随机令牌，启动时打印带令牌地址；`/train` 与 `/reset` 只收 POST，外国 Origin/错误 Host/缺失令牌均拒绝；`pack:<路径>` 教师合法，越界仍拒绝；Windows `taskkill` 后等待 close/error 再释放状态。UI 改用带 `X-Epirus-Token` 的 POST SSE，新增令牌输入。
- **金刚盾**：`js/core/resolve.js` 将主动判定伤加入地雷触发，并在狙击干扰/爆头判断中识别金刚盾声明目标；不扩大 `ATK_EFFECT`，避免顺带改变相抵与过载炮反制。规则页同步过载炮旧句。
- **UI 与池加载**：`guardNext` 徽章恢复；session 新多人包在本地持久化失败时仍优先于旧包；整表截断、缺项和重复 ID 会响亮失败。
- **验证**：`spec 96/96`、`D16`、`D126`、`N21`、`N22b`、`N22c`、`D23`、`D166`、`probe-pool-loader`、`train-server-selftest` 与真实 Chrome `SMOKE OK` 通过；未跑 `--group=engine` 整轮。

## v2.1.43 — 11-27（P1 前端与池加载修复 ‖ P2 AI 推理与训练服务修复 ‖ 千问通宵班计划）

**这一版是什么**：修复 P1（前端对局界面 / 冠军池抽签与整表校验）及 P2（AI 推理孪生 / 训练服务与脚本）已定位缺陷，并落盘基于 `442b4b68` 指纹的千问通宵班执行计划 [`docs/research/PLAN-2026-11-27-overnight-qwen.md`](docs/research/PLAN-2026-11-27-overnight-qwen.md)。核心规则引擎与冠军权重未动，规则指纹保持 **`442b4b68`**。

- **P1（冠军池与前端交互）**：
  - `js/pool-draw.js`：2 人局仅 1 席 AI 时不再执行「禁全同」重写循环，保住 2P `lv:regular` 按带加权抽签（`bandW`）且不再误标 `still-all-same`；
  - `js/pool-loader.js`：`loadMonolith()` 加载整表前先快照原清单 `wid` 表再比对，避免加载后与自身比对成恒真；
  - `js/ui/ui.js` & `css/style.css` & `js/ui/rules-panel.js`：补全观战结束/回合末侧栏刷新；未正式落子前预览次轮状态徽章与梦魇/回魂对摄魂的合法可用性；修复 3P 导入/训练覆盖内置 `EPIRUS_CHAMPION_3P` 与纯 JSON 2.0/3P 导出再导入错进 2P 槽的问题；修复 6–8 人目标弹窗溢出与 961–1120px 窄屏三列挤压；规则表解析 `**加粗**` 标签，训练页适配 DAgger 轮次与 `POST /reset`。
- **P2（AI 推理与训练管线）**：
  - `js/train/policy2.js` & `training/proto2/arch2.mjs`：双边同步修复 `chooseCandidates(..., { greedy: true })` 因 `r=0` 恒返回 `cands[0]` 的 bug，改为直接返回 `cands[f.argmax]`；
  - `js/train/evo.js`：`beliefSearchPick` 对 `params.p2` 改走 `forwardCands` 候选分数，避免在 beam 裁剪或平票破局时调用旧版 `P.value` 崩溃；`wrapBotN` 保留脚本自选 `bead`；
  - `training/server/train-server.mjs` & `pg-train.mjs` & `supfit-gd.mjs`：Windows 下用 `taskkill /T /F` 清理子进程树，收紧本地 CORS 白名单并要求 `POST /reset`，校验 `teacher`/`teacher2` 防目录穿越，修复 `seed=0`/`dagger=0` 被假值覆盖及 DAgger 进度轮次拼接，修 `pg-train` 空包防御与 `supfit-gd` lineage 元数据。
- **验证**：语法自检、专项回归、`spec 94/94`、`engine-rules 63/63`、`ui-contract 8/8`、`ship-pool`（`D234`）、`meta-repo`（`D8` / `L6` / `D205` / `D230`）、`D16` / `D168`、`browser-parity` 与真实 Chrome `SMOKE OK` / `BATTLE OK` 全绿（不跑 `--group=engine` 整轮）。

## v2.1.42 — 11-27（规则引擎边界集中修复：回魂 / 过载炮 / 金刚盾 / 镜面 / 激光眼 / 大雷×全息 / 天火转移 / 避雷针 / 反复横跳 / 终局收缩 / 挑衅）

**这一版是什么**：按用户裁定集中修复核心规则引擎已复现边界缺陷，同步更新 [`docs/RULES-2P.md`](docs/RULES-2P.md)、[`docs/RULES-NP.md`](docs/RULES-NP.md) 与玩家可见事件/规则页文案。冠军权重未改，规则指纹 `03a9cc97 → 442b4b68`；保留双枪优先级 3、聚光炮/合二为一穿防、反弹/藤甲仅反弹枪/坦克/双枪既有设定。

- **回魂无限能量（R48）**：`state.js` `rawCost` 豁免 `infiniteEnergy` 回合对电磁炮电珠与首次激光眼爆珠的前置持有要求，仍保留模式白名单、摄魂血量门槛与天火符咒等非能量条件（同步更新 `D126` 门禁与规则页 FAQ）。
- **过载炮互轰快照（B2）**：`resolve.js` 过载炮前置反制改为入口快照判定，修复 2P 互轰过载炮时先手被废、后手白打的座位偏置。
- **金刚盾独立主动判定（R15 / R66）**：从 `deliverDamage` 受击回调拆出，改为「防御挡非穿透来伤 + pri 3 独立判定一次」，对声明目标造成 1 点普通伤害（走目标正常防御矩阵、不依赖是否挨打、多人打只判一次）。
- **镜面反射复制已作废来源（N14）**：`resolveMirrorChain` 按来源 `outcome === 'ok'` 追踪，修复来源在 pri 5/4 被作废时错报 `mirrorNoEffect`（仅来源未出招才无效；更新 `D23` ⑤ 与 `N14g` 双向回归）。
- **激光眼破除无极变速次轮八卦与双层盾（R32 / N23）**：激光眼快照独立检查并清除目标 `baguaExtra`（发 `voided` 事件）与全部 `holoShieldsFrom` 叠盾；修正规则页 FAQ 病句。
- **取消大雷连带转向 / 大雷×全息（N6 / N22）**：彻底移除大雷连带对防御族声明目标的转向逻辑（不再发生藤甲/金刚盾/全息将连带 2 电转嫁他人的行为）；所有连带成员均由本人按自身正常防御矩阵结算（全息施放者本人吃连带 2 电并禁全息，不反打被护者；藤甲/金刚盾本人挡下连带且不禁用）。同步取消大雷对豁免技能发射虚假 `ban` 事件（`N21`），前端 `ban` 文案改读 `e.skill` 并同步移除连带"转给"文案分支。
- **天火转移穿透原型制御（R63）**：天火直击仍被原型制御挡下，经转移伤害转给指定落点后按转移伤害口径穿透落点原型制御。
- **避雷针与反复横跳（R31 / N15）**：避雷针情形 A 反噬补电属性、参与铁索并拦截镜面雷系，镜面避雷针情形 B 不再重复发 `rod` 事件；反复横跳 `cycleEdgeMask` 精确只伤害在环上的镜面使用者并跳过已结算镜面。
- **终局收缩事件与挑衅/回魂独立判定（N25 / R48 / R50）**：0 号位阵亡后第 45/100 回合仍发出 `终局收缩` 事件；挑衅 `impossible` 按回合初行动存活快照判定；梦魇不再覆盖清除被挑者的 `reviveNext`。
- **验证**：`spec 94/94`、`engine-rules 63/63`、`engine-fuzz 13/13`、`ui-contract 8/8`、`meta-repo 13/13`、`D16`、`D168` 与真 Chrome `SMOKE OK` 通过（未跑整轮门禁）。

## v2.1.41 — 11-27（保留 AR-TK2 并追加 PG-CN-S1200 ‖ 池 35 枚 17/18 ‖ 修复 skill-report 页面不同步）

**这一版是什么**：按用户 B 方案回退 v2.1.40 的“PG-CN-S1200 原位替换 AR-TK2”，保留 AR-TK2 的 soft armor/tank 载体，同时把 PG-CN-S1200 作为额外 soft 成员；池从 34 枚变为 35 枚（hard 17 / soft 18）。规则指纹不变（03a9cc97）。

- **AR-TK2 回池**：恢复 soft 行与 skill-report raw，按当前夹具 fx-pool1126d、指纹 03a9cc97 重跑 Stage 1：并集 17/30、胜率 39.58%、armor 120/120、tank 22/120、transfer 11 格；保留其既有 promote pass / seatKill=0 记录。
- **PG-CN-S1200 保留为额外成员**：不再宣称原位替换 AR-TK2；其并集 17/30、胜率 54.17%，但 armor/tank 为 0，定位为强度/经济补强，不承担 armor/tank 角色。
- **页面修复**：skill-report 页面此前 35 张卡但池表/raw 只有 34，多出的是已退役 AR-TK2；本版重烘后页面与池表一致为 35 枚（AR-TK2 回池 + PG-CN-S1200 保留）。证据见 [`RESULTS-2026-11-27-pool35-b.md`](docs/research/RESULTS-2026-11-27-pool35-b.md)。
- **验证**：`pool-add --audit` 35 枚 / `hard 17 + soft 18` / `bad=[]`；`champion-map/pipeline/validate.mjs` 通过（canonical 998 / mismatch 0）；`spec 86/86`；`SMOKE OK`；`BATTLE OK`；`rebuild-map` 页内自检 101 PASS / 0 FAIL；`bundle` 与 `manifest` 均为 35 枚，`skill-report.html` 35 张卡（AR-TK2 + PG-CN-S1200 同在）。

## v2.1.40 — 11-27（soft fallout 入池与 selftest3 量具修正）

**这一版是什么**：用已有 hard PG 中间快照补强 soft 低档，并修正梯度启动门的两类假红；不改规则指纹。

- **soft 换代**：`PG-CN-S1200`（`nov26-pgcn2-pg3.seg1200`，`wid=a4be887766a4eb3a`）原位替换 `AR-TK2`，全池维持 `34` 枚 `17/17`；armor/tank/transfer 有效载体各减 1 但并集不丢。
- **量具修正**：`selftest3` 腿 C 改用 `ε=1e-5`，腿 F 跳过最大值并列的不可导点；注入 `+1%` ctx 偏置梯度错误仍被腿 C 抓住。
- **训练止损纠正**：`nov27-long-pgdr-l1.seg600/seg1200` 的旧红灯分别是并列与舍入假红；同 seed 重跑 `nov27-long-pgdr-l1b` 3600 局，全部快照与终点 `selftest3` 绿，前 1200 局权重与 L1 逐位相同。

**验证**：`PG-CN-S1200` promote 0 阻断、人席 `seatKill=0`；A/B/C 为 `MxC=0.3008 / MxCL=0.2171 / arR=0.4688`。2P 八 seed 与 5P 双桌形池级替换均保持 hard 不变、阶梯有序；产品 `seed=77000` 复核与同位模拟一致。`ship-pool 1/1`、`ship-promote 19/19`、浏览器 `SMOKE OK`，演化图 `101 PASS / 0 FAIL`。

## v2.1.39 — 11-27（池降级 / 观战 / 悔棋 / 训练异步与伤害归因收口）

**这一版是什么**：修复上一轮审计留下的产品接缝与量具口径，不换冠军权重、不改规则指纹（仍为 `03a9cc97`）。

- **冠军池失败降级**：6–8 人桌在分片与整表都失败时改用多人强档脚本，不再退回 v7 单包；`aiInfo` 与导出标签如实显示“池降级/脚本回退”。缺少 Web Crypto 的不安全 HTTP 源增加纯 JS SHA-1 校验回退。
- **结算中切档**：难度切换在当前回合结算窗口内排队，结算后应用；人类死亡时若新池仍在加载，先等待加载完成再自动观战。
- **悔棋确定性**：快照同时保存/恢复脚本 AI 的跨回合记忆，避免同一状态重放出不同招。
- **训练与存储**：训练探测/重连增加代际取消，旧请求晚到不再覆盖新会话；本地冠军写入失败返回失败并明确提示。
- **伤害归因**：`dmgW`、`rankOf` 与穿透/集火/破墙等输出量统一排除 `source===to` 的返回伤害；转移诊断改用真实 `to` 字段。
- **回归与文档**：真实 Chrome 覆盖 2–8 人 × 3/4/5 血共 21 格，并验证 8 人推进、悔棋记忆、切档排队、存储失败与旧训练请求；门禁文档计数同步为当前 167 门。
- **训练研究**：长程 PG 先导 `nov27-long-pgdr-l1` 的旧 `selftest3` 红灯已定位为并列最大值与 `ε=1e-6` 舍入假红；量具修正后两枚快照均绿。现有 `nov26-pgcn2-pg3.seg1200` / `nov27-pg-rod-s1.seg1800` 已补 promote、人席与 2P 八 seed，A/B/C 仍在测。

**验证**：`spec 86/86`；`ship-pool 1/1`；`ui-contract 8/8`；`meta-repo 13/13`；`audit-lib-selftest` 通过；扩展浏览器 `SMOKE OK`。未跑整轮门禁。

## v2.1.38 — 11-27（规则边界修复：挑衅 / 双枪 / 金刚盾 / 镜面避雷针）

**这一版是什么**：按用户裁定修正四个规则边界，并同步玩家可见规则文本与回归用例。冠军权重未改，规则指纹 `bfd49045 → 03a9cc97`。

- **挑衅履约**：同等级攻击互相抵消不算违约；被小雷、大雷、过载炮反制等非抵消原因无效化仍算违约。`setVoid` 记录 `voidReason`，回合末按原因区分。
- **双枪第二目标**：重复、死亡或不存在的 `target2` 会兜底为另一名存活对手；找不到第二目标时响亮拒绝，不再扣满 3 ジ只打一枪。
- **金刚盾重做**：从“自指防御 + 反打攻击者”改为“有攻击目标的防御”；判定成功对该目标造成 1 点伤害，不再反伤。过载炮等穿透防御的攻击跳过判定。大雷仍只做一级传导，现有传导逻辑不改。
- **镜面避雷针**：情形 A 与真实避雷针一起参与废雷与能量均分，不再额外获得情形 B 免雷窗口；情形 B 行为不变。
- **镜面文本纠偏**：来源行动是否已被作废不影响镜面复制；只要求镜面自身未被提前无效化。补行为测试固定该口径。
- **验证**：`spec 86/86`；`engine-rules 63/63`；`engine-fuzz 13/13`；`ui-contract 8/8`；`D16` 指纹通过；真 Chrome `SMOKE OK`。受影响包按同 seed 配对复测：`JN-DR / OBS6E9 / DR-R3E / nov21-taunt-dsp0b / RD-PG / TF2-RD / PUR-2P` 与两个内置槽，legacy 替身 500 局下胜率变化均在 ±0.6pt 内，局长变化 ≤0.9 回合；未跑整轮门禁。

## v2.1.37 — 11-27（`hard` 三席高废珠换代：**`MT-PG`/`MN-PG`/`RD-PG`** 替换 **`MT-DR`/`MN-DR`/`ROD-DR`** ‖ 修 `PG-DR.json` Stage 2）

**这一版是什么**：在排查 `v2.1.36` 后继路线后主攻 **`hard`** 带三名高废珠主力——**`MT-PG`**（替 `MT-DR`）、**`MN-PG`**（替 `MN-DR`）与 **`RD-PG`**（替 `ROD-DR`）。三席退役成员合计 `Stage 1` 过期电珠由 **`628 → 48`**（降 **`13.1×`**），同时完整保留 `miniT` / `mine` / `rod` 稀缺技能覆盖且全部 **`0` 阻断 / `seatKill=0`**；同时补全被上版截断的 [`PG-DR.json`](champion-map/data/skill-report/PG-DR.json) Stage 2 普查数据。全池保持 **`34` 枚（`hard 17 / soft 17`、`bad=[]`、`fx-pool1126d`）**。

- **`MT-PG`（[`docs/artifacts/MT-PG.bak`](docs/artifacts/MT-PG.bak) · `wid=ac6271b6e10a6381`）入 `hard` 替换退役 `MT-DR`**：
  - `MT-DR` 底座两段 Stage C PG（`nov27-pg-mt-s1.seg3600` `--beadSpendW=0.50` → `nov27-pg-mt-s2.seg1200` `--beadSpendW=0.65 --lamExp=1.10 --penDeadElec=0.70 --klModes=standard`）；
  - `Stage 1`：胜率 **`56.3%`**（`MT-DR 48.8%`）、`16/30`（`Stage 2 = 24 技`）、`miniT=39 (6 格)`、电珠闭环 **`41.9% (13/31)`**（仅过期 `18`，较 `MT-DR 271` 降 **`15.1×`**）；
  - `2P`（300g `95001`）：`rule 17.0% / legacy 18.3%`；`6` 粒 `Arena B +42.9809pt`（`6/6` 正 `[34.66 .. 49.59]pt`，极差 `14.9349pt`，全池最高）；`promote` **0 阻断**（`G4 0.3%/0%`、`G5 0%/0%`）；`90210/90211 seatKill=0`；图坐标 `H=58.3 / S=1.56`。
- **`MN-PG`（[`docs/artifacts/MN-PG.bak`](docs/artifacts/MN-PG.bak) · `wid=a7272467c05792ea`）入 `hard` 替换退役 `MN-DR`**：
  - 针对红线 `MN-DR` 不直接做梯度，改为在绿色 `PG-DR` 注入 `MN-DR` 的 `3:multi,5:long,8:long` `mine@0.65`（`nov27-pgmn-r2`）再接 `DR-R3E(2:standard@0.85)` 短程 2P 抛光（`nov27-mnpg-2p`）；
  - `Stage 1`：胜率 **`54.5%`**、`17/30`（`Stage 2 = 25 技`）、`mine=302 (21 格 / 结算 35/135=25.9%)`、电珠闭环 **`66.7% (10/15)`**（仅过期 `4`，较 `MN-DR 236` 降 **`59×`**）；
  - `2P`（300g `95001`）：`rule 19.3% / legacy 17.7%`；`6` 粒 `Arena B +40.7633pt`（`6/6` 正 `[14.33 .. 74.84]pt`，极差 `60.515pt`，全池第二）；`promote` **0 阻断**；`90210/90211 seatKill=0`；图坐标 `H=53.2 / S=1.52`。
- **`RD-PG`（[`docs/artifacts/RD-PG.bak`](docs/artifacts/RD-PG.bak) · `wid=653e6bd461e6b6d9`）入 `hard` 替换退役 `ROD-DR`**：
  - `ROD-DR` 单段 Stage C PG（`nov27-pg-rod-s1.seg2700`，`--lamExp=1.10 --penDeadElec=0.70 --beadSpendW=0.50 --klModes=standard`）；
  - `Stage 1`：胜率 **`52.3%`**、`17/30`（`Stage 2 = 24 技`）、`rod=312 (14 格 / 结算 11/79=13.9%, 2:multi 10/10)`、电珠闭环 **`38.8% (19/49)`**（仅过期 `26`，较 `ROD-DR 121` 降 **`4.7×`**）；
  - `2P`（300g `95001`）：`rule 18.7% / legacy 19.3%`；`6` 粒 `Arena B +19.5179pt`（极差 `32.0424pt`）；`promote` **0 阻断**（`G4 4.7%/0%`、`G5 0%/0%`）；`90210/90211 seatKill=0`；图坐标 `H=61.6 / S=1.41`。
- **`soft` 下沉评估与净变化**：
  - 评估了落选臂 `TA-PG`（`nov27-pgta-r1`，`Arena B -1.51pt` 但 `G5[long] 37% > 25%` 阻断，不入池）与已退位原主 `MT-DR / ROD-DR / MN-DR`（`Arena B +13.6..+28.1pt` 但废珠 `82.9–91.8%`），直接退役以防高废珠与过度抬硬压扁 `5P long` 阶梯。
  - 更新后 `hard` 17 枚 `Arena B` 中位 **`+19.52pt`**、废珠率中位 **`51.85%`**、带内覆盖 **`27` 技**；`soft` 17 枚 `Arena B` 中位 **`+4.09pt`**、带内覆盖 **`27` 技**；`MT-DR/MN-DR/ROD-DR.json` 依 `AGENTS.md §24` 移至仓外隔离目录（`.bak` 保留在册）。
  - 换代后 `probe-diff-ladder --pool=1` 全桌形无缺口通过：`2P rule`（1500g `95001`）`32.93% < 42.40% < 57.07%`、`2P legacy` `21.20% < 25.27% < 27.73%`、`5P multi`（800g `95002`）`3.63% < 12.00% < 17.13%`、`5P long`（400g `95001`）`3.75% < 7.25% < 13.25%`。

## v2.1.36 — 11-27（**`TK-PG`** 入 `soft` 替换退役 **`MX8-R6C-KL`** ‖ 人数剖面量具与坦克覆盖修正）

**这一版是什么**：按 `2/3/5/8P` 拆开技能使用与兑现，确认电磁炮在 2P 最少、随人数上升属正常形状；`PG-CN` 的真实缺口在 8P 电珠闭环（`5/29`），不是 2P。坦克覆盖线经 `FS-G2 → T1 → T2` 得到绿色坦克教师，再低剂量蒸回绿色 `PG-DR`，得到 **`TK-PG`**（[`docs/artifacts/TK-PG.bak`](docs/artifacts/TK-PG.bak) · `wid=4fb5b59cb4e5a446`）入 **`soft`**，替换高废珠的 `MX8-R6C-KL`；全池维持 **`34` 枚（`hard 17 / soft 17`、`bad=[]`）**。

- **`TK-PG` 入 `soft` 替换退役 `MX8-R6C-KL`**：
  - 配方：`PG-DR` 绿底座 + `nov26-tank-fsg2-t2` 只借 `tank`（3/5/8P、教师比例 `0.10`、`1000` 组 / `80` 步 / `lr=1e-4` / `seed=20261165`）；
  - `Stage 1`：胜率 **`48.5%`**、并集 **`18/30`**、坦克 **`27` 次 / `13` 格 / `95.8%` 兑现**、电珠闭环 **`40.8% (51/125)`**；
  - `2P` 四 seed：rule hard **`18.8%`** / simple **`27.7%`**，legacy hard **`19.0%`** / simple **`19.6%`**；
  - `6` 粒 `Arena B +21.4494pt`（极差 `49.2045pt`）；`promote --dry --support=2` **0 阻断**（G4 long `19.7%` / multi `9.3%`，G5 long `17%` / multi `0%`）；`90210/90211 seatKill=0`；落图 `H=53.5 / S=1.41`。
- **替换净变化**：`MX8-R6C-KL` 废珠 `93.3%` → `TK-PG 59.2%`；soft `Arena B` 中位 **`2.3→4.1pt`**；hard/soft 覆盖并集仍各 **`27`**，全池有效并集 **`29/30`** 不变。
- **人数剖面量具**：新增 `shape-skill-profile.mjs`、`railgun-window-diagnostic.mjs`、`tank-transfer-window-diagnostic.mjs`、`transfer-outcome-diagnostic.mjs`，证据落 `docs/research/evidence-2026-11-26-value-coverage/`。电磁炮全池 `uses/game` 随人数上升；坦克瓶颈是选择窗口而非结算；TF-DR 长程转移兑现偏低。
- **替换后阶梯**：2P 八 seed rule `32.3% < 44.5% < 56.9%`、legacy `20.5% < 26.0% < 29.3%`；5P 八 seed（每 seed 400 局/档）multi `0.7% < 13.0% < 18.5%`，long `1.7% < 15.5% < 26.1%`。对比替换前，5P hard 不变；multi 普通 `-0.44pt`、简单 `+0.47pt`；long 普通 `-1.34pt`、简单 `-0.41pt`。

## v2.1.35 — 11-26（**`PG-CN`** 真电珠闭环入 `hard` 替换 **`CN-DR`** ‖ 重构 `skill-report.html` 闭环口径标签 ‖ 夹具 `fx-pool1126d`）

**这一版是什么**：在查清 [`CN-DR`](docs/artifacts/CN-DR.bak) 只少按 `charge`（`99` 次仅 `10/10` 在 `2:multi` 花掉，`3/5/8P` 因 `railgun=0` 导致 **`0/89`** 未闭环）后，先向 `PG-DR` 借 `charge/railgun` 唤醒 `CN-DR` 3/5/8P 电磁炮通道（`nov26-cnrg-r1`，`G5 1%/0%`, `2P 14.0%`, `railgun 27`），再接两段 `--beadSpendW=0.50 --penDeadElec=0.70 --lamExp=1.10` Stage C PG，训成 **`PG-CN`**（[`docs/artifacts/PG-CN.bak`](docs/artifacts/PG-CN.bak) · `wid=7e2ac4666074c364`）正式替换退役 `CN-DR`；同步重构 [`champion-map/build-skill-page.mjs`](champion-map/build-skill-page.mjs) 消除两类闭环混读。全池保持 **`34` 枚（`hard 17 / soft 17`、`bad=[]`）**。

- **`PG-CN` 入 `hard` 替换退役 `CN-DR`（`fx-pool1126d` · `AR-TK2,DR-R3E,FS-DR,FS-G2,FS2-LE26`）**：
  - `Stage 1`：**胜率 `57.3%`**、`17/30`（`Stage 2 = 25 技 消融 6`）、**`电珠闭环 50.5%`（`56/111`，仅过期 `53`）**、**`贴爆闭环 50%`（`5/10` 局）**、完整保留 `cannon 151 (18 格)`；
  - `2P`（300g `95001`）：`rule 19.3% / legacy 16.0%`；`6` 粒 `Arena B +30.3824pt`（`6/6` 正 `[17.49 .. 57.65]pt`）；`promote --dry --support=2` **0 阻断**（`G4 0%/4.3%`、`G5 1%/0%`）；`90210/90211 seatKill=0`；图坐标 `H=49.7 / S=1.76`。
  - `CN-DR.json` 依 `AGENTS.md §24` 备份至仓外隔离目录后 `pool-add --retire=CN-DR`（`.bak` 保留在 `docs/artifacts/`），`fixtures.tsv` 升代为 `fx-pool1126d`。
- **重构 [`champion-map/build-skill-page.mjs`](champion-map/build-skill-page.mjs) 闭环视图标签**：
  - 每张卡片顶部新增 `.clbar` 摘要条，显式分列 **`电珠闭环`** / **`爆珠闭环`** / **`贴爆闭环`**；
  - Stage 2 `贴贴/天火` 行统一改名为 **`贴爆闭环`**（不再与 `电珠闭环` 混名），`蓄能` 行直接标注 `电珠闭环 / 爆珠闭环` 并为普查占比 `< 1%` 落入 `强制` 的条目加 `<1%` 悬停提示。
- **更新池结构与难度阶梯（`fx-pool1126d`）**：`hard` `arenaB` 中位 **`17.9pt`**、并集 `27` 技；`probe-diff-ladder --pool=1`：`2P rule 33.7% < 43.4% < 59.5%`（`5.9σ / 8.9σ`）、`2P legacy 21.8% < 24.7% < 30.3%`、`5P multi 3.0% < 12.4% < 16.5%`、`5P long 4.0% < 6.3% < 17.3%`。

## v2.1.34 — 11-26（修复 `pg-train.mjs` 反 REINFORCE 负号 ‖ **`CN-DR` / `PG-DR`** 入 `hard` 替换退役 **`RG-CN` / `nov21-purify-dsp0`** ‖ 修复查看器 3D `roundTrip` 隔离 ‖ 夹具 `fx-pool1126c`）

**这一版是什么**：定位并修复 [`training/proto2/pg-train.mjs`](training/proto2/pg-train.mjs) 中长期潜伏的 REINFORCE 梯度反号 Bug（使带惩罚的 PG 从“越罚越死电”恢复为真正压低电珠浪费），在此基础上训成 [`docs/artifacts/CN-DR.bak`](docs/artifacts/CN-DR.bak) 与 [`docs/artifacts/PG-DR.bak`](docs/artifacts/PG-DR.bak) 正式入 **`hard`**，替代高废珠低胜率（`95.6% / 44.3%` 与 `97.3% / 41.5%`）的退役旧包 `RG-CN` 与 `nov21-purify-dsp0`；同时修复 [`champion-map/viewer.mjs`](champion-map/viewer.mjs) `roundTrip()` 颜色状态隔离与补加 PG 梯度符号门禁，全池保持 **`34` 枚（`hard 17 / soft 17`、`bad=[]`）**。

- **修复 [`training/proto2/pg-train.mjs`](training/proto2/pg-train.mjs#L517-L518) REINFORCE 梯度反号 Bug + 门禁锁死**：
  - `dLogPi` 返回 `+∂logπ/∂logits`，而 `pg-train.mjs` 第 518 行原写作 `g[j] *= A`（漏负号），与下方 `pv[d] -= LR*step` 组成**反 REINFORCE**（越惩罚 `死电/局` 反而从 `0.65` 翻倍至 `1.24`）；改为 `g[j] *= -A;` 后，`DR-R3E` PG 首臂（`--klModes=standard --lamExp=0.90 --penDeadElec=0.50 --beadSpendW=0.15`）将 `死电/局` 压至 `0.049`、电珠过期率由 `77.6%` 降至 `32.6%`，对照 `FS2-LE26` 同配方总废珠降至 `10.8%`。
  - 在 [`tools/gates/meta-repo.mjs`](tools/gates/meta-repo.mjs) `L3` 补入静态 + `pg-lib.mjs` 数值符号步进回归断言，防止再次反号。
- **`CN-DR`（`wid=7b92bfbbfdc5d756`）入 `hard` 替换退役 `RG-CN`**：
  - 双教师蒸馏（`DR-R3E` 底 + `nov26-pg-rgcn-s1.seg2400` + `T65 2:standard@0.80`）：`fx-pool1126c` Stage 1 **`51.3%`**、`18/30`（`Stage 2 = 25 技`，保留 `hard` 唯一 `cannon`），电珠过期 `86`（较 `RG-CN` `1517` 降 `17.6×`），`bigT 67/95 (70.5%)`、`firestorm 17/22 (77.3%)`；`2P` 由 `77.0%` 改善至 `19.0% / 16.3%`；6 粒 `Arena B +30.9588pt`（6/6 正）；`promote --dry --support=2` **0 阻断**，`seatKill=0`，落图 `H=49 / S=1.77`。
- **`PG-DR`（`wid=93064163aa5e563b`）入 `hard` 替换退役 `nov21-purify-dsp0`**：
  - 修号后 PG（`--klModes=standard --lamExp=0.90 --penDeadElec=0.50 --beadSpendW=0.15`）+ `DR-R3E` 短程 2P 抛光：`fx-pool1126c` Stage 1 `16/30`（`Stage 2 = 24 技`），`charge` `84` 次得珠 **`65` 已花 / `19` 过期（花珠闭环 `77.4%`、废珠 `22.6%`，`2:long 14/14, 2:multi 20/20`）** vs `nov21-purify-dsp0` `97.3% (1821)`；`2P 21.0% / 18.7%`；6 粒 `Arena B +15.9117pt`；`promote` **0 阻断**，`seatKill=0`，落图 `H=58.3 / S=1.46`。
- **修复 [`champion-map/viewer.mjs`](champion-map/viewer.mjs#L6251-L6320) 3D 自检隔离 + 全池与难度阶梯提升（`fx-pool1126c`）**：
  - `roundTrip()` 临时切 `st.mode = 'map'` 时未隔离 `st.color = 'fam'`，导致 `mode=tree`/`3db` 下沿用 `'F'` 热力图把 `v7wall-31` 选中环冲淡（`30% < 50%`）；补齐 `bak.color` 保存/恢复后 4 视图 `map-selfcheck` 全绿 `101 PASS / 0 FAIL`。
  - 更新池结构（`hard 17 / soft 17`, `hard arenaB 中位 17.9pt`, `bad=[]`）下 `probe-diff-ladder.mjs --pool=1` 全部四把尺明显改善：`2P rule 32.8% < 45.5% < 59.5%`（`7.7σ / 7.7σ`）、`2P legacy 21.7% < 25.0% < 30.3%`、`5P multi 2.5% < 11.4% < 16.5%`、`5P long 3.0% < 8.0% < 17.3%`。

## v2.1.33 — 11-26（A1 `rod`/`mine`/`taunt` 归因修正 ‖ A2 `use-value` `N=100` 全通过 ‖ **`FS-DR`** 入 `hard` 替换退役 **`FC-G1`** ‖ 夹具 `fx-pool1126b`）

**这一版是什么**：修复 [`tools/pool-skill-report.mjs`](tools/pool-skill-report.mjs) 中三类技能结算归因漏计（`rod` mode A `voided`、`mine` 间接伤害数组 `e.from`、`tauntCheck` 守约与违规并记），完成 `N=100` 版 `use-value` 单点替换反事实先导验证，并训成低废珠电火双闭环新包 [`docs/artifacts/FS-DR.bak`](docs/artifacts/FS-DR.bak) 正式入 **`hard`**，同时将高废珠低胜率（`99.4%` / `36.4%` / `invited=1 block`）的 `FC-G1` 走完整退役流移出冠军池；全池保持 **`34` 枚（`hard 17 / soft 17`、`bad=[]`）**。

- **A1 事件归因修复与全池复核**：
  - `ROD-DR` `rod` 闭环从 `1/78 (1.3%)` 修正至 `12/79 (15.2%)`（`2:multi 10/10`），`MN-DR` `mine` 为 `28/106 (26.4%)`，`nov21-taunt-dsp0b` `taunt` 从 `180/811 (22.2%)` 修正至 `792/792 (100%)`；退池前在 `fx-pool1126a` 上通过 `A1_VALIDATE_OK packs=34 legacyFieldsIdentical=15 chargeLedgerReconciled=34 holoPositiveControl=46/151`。
- **A2 `use-value` 先导（`N=100` · [`probe-use-value-pilot.mjs`](docs/research/evidence-2026-11-26-value-coverage/probe-use-value-pilot.mjs)）**：
  - 4 项对照全部通过：`selfMaxAbs=0`、正对照 `snipe vs 4×guard` `+1.9625 ±0.1710`（`n=80`）、死卡 `deadCharge` `+0.00875 ±0.01042`（`n=1600`, 95% CI 覆盖 0）、跨种子 `Spearman=0.8419`（23 格）；检出 `FC-G1 curse`（`-0.295 / -0.258`, 95% CI 全负）与 `MX8-R6C-KL charge`（`-0.1725 / -0.1925`）负价值动作。
- **`FS-DR` 入 `hard` 替换退役 `FC-G1`**：
  - [`docs/artifacts/FS-DR.bak`](docs/artifacts/FS-DR.bak)（`wid=c46104966cb681fb`）通过无 `charge` 键冲突的多教师蒸馏保留 `FS2-LE26` `boom→laserEye` 闭环：`promote --dry --support=2` **0 阻断**（`A 60.4%`, `G(multi)=4.92/G(long)=5.30`, 珠闭环 `65.7%`, 天火 `27/27` 闭环 `79%`），`90210/90211` `seatKill=0`，测绘入图 `Arena B +14.4545pt`（6 粒 floor / `H=60.8, arR=+0.2733`），`fx-pool1126b` Stage 1 `15/30`（`charge` 废珠 `53.9%` vs `FC-G1` `99.4%`、`firestorm 233/233`、引爆率 `86%`、局闭环 `92%`）。
  - `FC-G1.json` 依 `AGENTS.md §24` 备份至仓外隔离目录后按 `pool-add --retire=FC-G1` 清退，夹具升代为 `fx-pool1126b`（`AR-TK2,DR-R3E,FS-DR,FS-G2,FS2-LE26`）；同步经用户批准将 `D234 ⑥b/⑥c` 在册测试锚由早期 v7 `WSEL9-200.js` 升级为现役 `2.0` `hard` 成员 [`docs/artifacts/DR-R3E.bak`](docs/artifacts/DR-R3E.bak)（`22.50%` vs `rand 6.67%`，`15.83pt`）。
- **终态 `34` 池（`17/17`）与难度阶梯（`probe-diff-ladder --pool=1`）**：
  - 带内并集与底座：`hard` 17 枚（`arenaB` 中位 `16.6pt`、Stage 1 并集 `27` 技），`soft` 17 枚（`arenaB` 中位 `2.3pt`、并集 `27` 技）。
  - `2P`（1500 局，`seed=95001`）：`rule` `37.4% < 46.1% < 59.5%`（`-8.73pt 5.1σ` / `+13.33pt 7.5σ`）；`legacy` `21.0% < 25.9% < 30.3%`（`-4.93pt 3.5σ` / `+4.33pt 2.8σ`）。
  - `5P`：`multi`（800 局，`seed=95002`）`3.1% < 13.4% < 16.5%`；`long`（400 局，`seed=95001`）`6.8% < 9.0% < 17.3%`。详情见 [`RESULTS-2026-11-26-value-coverage.md`](docs/research/RESULTS-2026-11-26-value-coverage.md)。

## v2.1.32 — 11-26（`MT-DR`/`JN-DR`/`MN-DR`/`PUR-2P` 升级 `hard` ‖ 退役 `nov22-c3g-s300k` ‖ 34 池 `17/17` ‖ 修复 `measure-point` 投影表头顺序）

**这一版是什么**：在保持单一统一池（`D-34`/`D-35`）下，基于洁净 `DR-R3E` 底座以 `--rolloutMode=game` + 单技能 `--rareOnly` + `2:standard@4` + `T65-RINGBEAD@0.80` 训成并接纳 4 枚强 `2P` 替代包入 **`hard`**：[`docs/artifacts/MT-DR.bak`](docs/artifacts/MT-DR.bak)（补回 `hard` 缺失的 `miniT`）、[`docs/artifacts/JN-DR.bak`](docs/artifacts/JN-DR.bak)（替代 `OBS6E9`）、[`docs/artifacts/MN-DR.bak`](docs/artifacts/MN-DR.bak)（替代 `RG-MN`）与 [`docs/artifacts/PUR-2P.bak`](docs/artifacts/PUR-2P.bak)（替代 `R-GD12`）；`OBS6E9`/`RG-MN`/`R-GD12` 下放 `soft`，同时退役在新 `soft` 带标尺下触发 `seatKill=3`（`D234` 阻断）的 `nov22-c3g-s300k`，全池调整为 **`34` 枚（`hard 17 / soft 17`）**。

- **4 枚 `hard` 新包（`v:92 / S1o`，`promote --dry --support=2` 0 阻断，`90210/90211` `seatKill=0`）**：
  - `MT-DR`（`wid=dc222c8e7a090b40`）：`Stage 1` 并集 `16/30`（`miniT 5/120` 36 次，恢复 `hard miniT` 有效覆盖），`Arena B +28.12pt`（6/6 正），`2P` 500 局（`seed=95001`）`rule 17.4% / legacy 19.2%`，`G4 0%/1%` / `G5 0%/0%`。
  - `JN-DR`（`wid=27923b8d6ee584e8`）：`Stage 1` `18/30`（`jinshield 25/120` 445 次 + `miniT 3/120` 37 次），`Arena B +37.43pt`（6/6 正），`2P` `rule 21.8% / legacy 12.4%`（原 `OBS6E9` `93.0% / 28.8%`），`G4 0%/2.3%` / `G5 0%/1%`。
  - `MN-DR`（`wid=452ae508bd062653`）：`Stage 1` `15/30`（`mine 14/120` 129 次），`Arena B +13.59pt`，`2P` `rule 22.0% / legacy 19.6%`（原 `RG-MN` `89.4% / 41.6%`），`G4 0%/0.3%` / `G5 0%/0%`。
  - `PUR-2P`（`wid=25140b2b9bc576e6`）：`Stage 1` `17/30`（`purify 1/120`、`rod 2/120`、`ring 14/120`），`Arena B +34.69pt`（6/6 正），`2P` `rule 16.2% / legacy 13.6%`（原 `R-GD12` `62.6% / 14.6%`），`G4 0%/0%` / `G5 0%/0%`。
- **终态 `34` 池并集与难度阶梯（统一池）**：
  - `Stage 1` 有效并集（`>=3` 格）：全池 `28/30`，`hard (17)` `27/30`（恢复 `miniT`，仅 `armor`/`mine`/`purify` 等稀有卡池内互有侧重）。
  - `2P`（1500 局，`seed=95001`）：`rule` `困难 37.5% < 普通 46.4% < 简单 59.5%`（`-8.87 ±3.34pt 5.2σ` / `+13.07 ±3.51pt 7.3σ`）；`legacy` `21.3% < 25.9% < 30.3%`（`-4.60 ±2.73pt 3.3σ` / `+4.33 ±3.02pt 2.8σ`）。
  - `5P`：`multi` 800 局（`seed=95002`）`2.8% < 12.5% < 16.5%`；`long` 400 局（`seed=95001`）`6.8% < 9.5% < 17.3%`。
- **测绘链修复与清理**：
  - 修复 [`champion-map/pipeline/measure-point.mjs`](champion-map/pipeline/measure-point.mjs#L397-L406) 生成投影表头顺序与 `champion-map/data/projections.tsv` 不一致的问题（改为动态读取现役表头列序）；地图四视图 `101 PASS / 0 FAIL`。
  - 家族图分类校正：`fam25` 扩为「2.0 obs6.5 强包底座与多技能协同演进」，将 `DR-R3E` 续训/对照线与 `T65-RINGBEAD`、`FS2-LE26`、`SOFT-RING-C3G25` 共 15 枚从 `fam24` 迁入；池内 `fam24/fam25` 由 `27/4` 调整为 `14/17`，自动归族规则同步扩展。
  - `skill-report` 夹具收口至 **`fx-pool1126a`** 与总览矩阵：修复 [`tools/pool-skill-report.mjs`](tools/pool-skill-report.mjs) 从 [`fixtures.tsv`](champion-map/data/skill-report/fixtures.tsv) 单源读取 `fixtureKey` 与 `real-opponents`（`AR-TK2,DR-R3E,FC-G1,FS-G2,FS2-LE26`）并在真包夹具漂移时 fail-fast；重扫全池 34 枚 Stage 1，在 [`champion-map/build-skill-page.mjs`](champion-map/build-skill-page.mjs) 顶部新增 `30 技 × 34 包` 使用率总览表（支持出手占比 / 环境覆盖率切换、困难/简单带联动过滤、点击包名跳至卡片），重烘 [`champion-map/skill-report.html`](champion-map/skill-report.html) 与 [`firestorm-closure-1124.tsv`](champion-map/data/firestorm-closure-1124.tsv)（同时补录行为多样性与 `RG-CN` 非 DR 复现研究结论见 [`RESULTS-2026-11-26-diversity-replication.md`](docs/research/RESULTS-2026-11-26-diversity-replication.md)）。
  - 清理遗留仓外 worktree（`srv-wt-s0-caebdf45`）、9 个临时 `%TEMP%/epirus-*` 目录（经回收站），退池的 `nov22-c3g-s300k` 原始 `skill-report` JSON 同步备份至仓外隔离目录。详情见 [`RESULTS-2026-11-26-hard-2p-upgrades.md`](docs/research/RESULTS-2026-11-26-hard-2p-upgrades.md)。

## v2.1.31 — 11-26（三维行为轴按版本独立投影 ‖ 过线/势曲面默认 40%/50% ‖ transfer 计量回归腿）

**这一版是什么**：修复冠军演化图版本切换只替换二维坐标、三维仍共用全库投影的问题；1.8 / 2.0 子集现在各自拟合二维与三维坐标，页面同步切换并重建三维曲面。过线曲面默认阈值由 30% 调到 40%，势曲面由 67% 调到 50%。`skill-mastery` 增加 transfer 已知答案回传腿，并修正 miniT 子断言未计入总失败的问题。

- 投影生成链新增 [`champion-map/pipeline/rebuild-version-projections.mjs`](champion-map/pipeline/rebuild-version-projections.mjs)，接入 `rebuild-map`；1.8 `831/831`、2.0 `209/209` 枚三维坐标通过“不同于全库 fit”自证。
- 页内自检新增三版本三维坐标签名与默认阈值断言；当前 `101 PASS / 0 FAIL`。40% 阈值下壳带宽对照改测滑杆下限 `c=0.05`，仍保持“漏画归零”原判据。
- 31 池同 seed 回归：2P rule `47.475/49.338/54.500%`（6/8 seed 有序）、legacy `24.125/26.963/30.188%`（7/8）；5P multi `1.8/14.8/20.0%`、long `7.0/21.0/29.5%`。
- holo/shift 双底座蒸馏均达到风格目标，但 DR 候选 2P rule 退化 `11.55pt`、ROD 候选 promote 偏座阻断，按预注册淘汰；**池成员与难度表未改**。
- 证据：[`STATUS-2026-11-26-style-overnight.md`](docs/research/STATUS-2026-11-26-style-overnight.md)、[`evidence-2026-11-26-style/`](docs/research/evidence-2026-11-26-style/)。

## v2.1.30 — 11-25（`TF-DR` 入 `hard` ‖ `TF2-RD`/`TF2-DR` 入 `soft` ‖ 修复 `skill-mastery` `transfered` 漏字 ‖ 31 池 `16/15`）

**这一版是什么**：修复 `skill-mastery.mjs` 的 `transfer` 回传字段缺失后，基于 `DR-R3E`/`ROD-DR` 洁净底座开展受控 `transfer` 蒸馏并将 3 枚短命名正式包按完整入池链收编：[`docs/artifacts/TF-DR.bak`](docs/artifacts/TF-DR.bak) 入 **`hard`**（恢复 `hard` 有效 `transfer` 覆盖至 `29/120` 格），[`docs/artifacts/TF2-RD.bak`](docs/artifacts/TF2-RD.bak) 与 [`docs/artifacts/TF2-DR.bak`](docs/artifacts/TF2-DR.bak) 入 **`soft`**（填补 `soft` `rod=0` 并扩充 `transfer`/长程广度），全池扩至 **`31` 枚（`hard 16 / soft 15`）**；另将 3 枚代表对照点 `TF-RDMX`、`TF2-RDC`、`PUR-2P` 测绘上 [`champion-map/index.html`](champion-map/index.html)。

- **`TF-DR`（`hard` · `wid=ac6b3456fc2cebe4` · 亲代 `DR-R3E`）**：
  - 配方：`MX6-GD-TF20` 单师多/长程 `transfer` + `T65-RINGBEAD@0.25 (2:standard)`，`groups=2000 / steps=180 / lr=3e-4 / rareOnly=transfer,ring@0.30`；
  - 实测（[`docs/artifacts/promote-TF-DR.txt`](docs/artifacts/promote-TF-DR.txt)）：`promote --dry --support=2` **`0` 阻断**，`hostile skill-mastery` 同步通过 **✔ 会转移（`10.0%/局 · 50.0%`）** 与 **✔ 会聚能环（`2` 段）**；`Stage 1` 并集 **`17/30`**（`transfer 29/120 / 408` 次、`ring 30/120`、`bigT 20/120`、`drain 11/120`、`holo 9/120`），`Stage 2` **`25` 技（消融 `10`）**；演化图谱 `Arena B +27.4971pt`（`arS=+0.2869 / arL=+0.1180 / arR=+0.6819`、`MxC=+0.1992`、`okLong=1, okShort=1`）；`90210/90211` **`seatKill=0`**（`multi ≤3.5%` / `long ≤7.5%`，自适应 `0.0%`）；2P 四粒均值 `rule 27.75% / legacy 24.40%`。
- **`TF2-RD` 与 `TF2-DR`（`soft` · `wid=ccc8268b8e386077` / `97430ee6cf744e0f`）**：
  - [`docs/artifacts/TF2-RD.bak`](docs/artifacts/TF2-RD.bak)（亲代 `ROD-DR`）：`Stage 1` **`18/30`**（**`rod 13/120 / 344` 次** + **`transfer 11/120 / 86` 次** + `ring 29/120`），`Stage 2` `25` 技（消融 `9`），`promote exit=0`，`okLong=1, okShort=1`，`Arena B +23.7784pt`（`arR=+0.0348`），`90210/90211` `seatKill=0`（全格 `≤3.0%`），2P `rule 29.75% / legacy 22.75%`；
  - [`docs/artifacts/TF2-DR.bak`](docs/artifacts/TF2-DR.bak)（亲代 `DR-R3E`）：`promote exit=0`（`G(long)=7.53 / S=2.054 / 7` 角色），`Stage 1` `16/30`（`transfer 3/120 / 32` 次），`Stage 2` `24` 技（消融 `8`），`Arena B +17.9278pt`（`arS=+0.1560 / arR=+0.3583`），`90210/90211` `seatKill=0`（`≤8.0%`），2P `rule 37.75% / legacy 25.75%`。
- **代表对照点入图与工具修复**：
  - 将 `TF-RDMX`（二跳 `ROD-DR + MX`：`transfer 21/120`、`arR=+0.2733`）、`TF2-RDC`（轻步坍缩对照：`selftest3` 全绿与 `transfer 25/120` 但 `arR=-0.4463`）、`PUR-2P`（`2:standard@10` 降稀释：`arR=+0.5229`）测绘入图（共计 `1040` 行）；
  - 修复 [`training/proto2/skill-mastery.mjs`](training/proto2/skill-mastery.mjs#L153) `rows.push` 漏传 `transfered` 导致真受创转移恒为 `0` 的缺陷（`--selftest` 五腿全过）；证据与 31 池阶梯见 [`RESULTS-2026-11-25-transfer-admission.md`](docs/research/RESULTS-2026-11-25-transfer-admission.md)。

## v2.1.29 — 11-25（2P 池级换带：`purify` 入 `hard` / `armor` 入 `soft`，修复三档次序）

**这一版是什么**：按 28 包 2P 普查与 8 seed 临时带位实跑，将 [`docs/artifacts/nov21-purify-dsp0.bak`](docs/artifacts/nov21-purify-dsp0.bak) 从 `soft` 提到 `hard`，同时将 [`docs/artifacts/nov21-armor-tzt2d.bak`](docs/artifacts/nov21-armor-tzt2d.bak) 降到 `soft`；池仍为 **28 枚（hard 15 / soft 13）**。

- **2P 三档实测（换带后同口径）**：rule `hard 49.16% / regular 52.10% / simple 56.08%`，legacy `23.50% / 27.43% / 30.76%`；两把尺均恢复 `hard < regular < simple`，普通档与换带前基本一致。5P multi `4.0/16.8/19.5%`、long `7.8/19.3/32.8%`，hard 与普通档均较换带前更强。
- **准入与 5P 代价**：purify `promote --dry --support=2` 通过，hard 带 projected `seatKill=0`；成员 ArenaB 由 armor `−12.20pt` 换为 purify `+14.04pt`。
- **覆盖代价**：hard 有效并集 `26→25`，`transfer` 从 7 格 / 76 手降为 0；soft 接回 armor，全池仍 `28/30`。转移伤害已登记为后续训练研究项，先量状态可达性与部署窗口，不直接加单步奖励。
- 证据：[`RESULTS-2026-11-25-2p-census.md`](docs/research/RESULTS-2026-11-25-2p-census.md) 与 [`evidence-2026-11-25-2p-census/`](docs/research/evidence-2026-11-25-2p-census/)。

## v2.1.28 — 11-25（`ROD-DR` 入 `hard` / `PUR-DR` 入 `soft` ‖ 退役 `nov21-rod-tzt2d-r10` ‖ 全池 `28` 枚并集 `28/30`）

**这一版是什么**：继续沿 `DR-R3E` 洁净底座攻克全池技能缺口与带伤替换，训出并入池 **`ROD-DR`**（[`docs/artifacts/ROD-DR.bak`](docs/artifacts/ROD-DR.bak)，`wid=c5f68b29031ab56c`）进 **`hard`** 并退役带 `seatKill=2` 的老避雷针包 `nov21-rod-tzt2d-r10`，再将首次打通全池净化 `≥3` 格覆盖、人席零漏格而 `2P` 偏弱的 **`PUR-DR`**（[`docs/artifacts/PUR-DR.bak`](docs/artifacts/PUR-DR.bak)，`wid=7fd8b3c1d487dcdd`）合入 **`soft`**；全池调至 **`28` 枚（`hard 15 / soft 13`）**，全池 Stage 1 有效并集由 `27/30` 升至 **`28/30`**（`hard 26/30`、`soft 25/30`，全池仅余 `dualGun, mirror` 未跨 `≥3` 格线）。

- **`ROD-DR`（`hard` · 两粒种子复现后择强入池，`hard` 首获洁净避雷针覆盖）**：
  - 配方：`up/teacher=pack:DR-R3E.bak`、`--teacher2=rod@0.35 (3/5/8P)`、`--teacher3=pack:T65-RINGBEAD.bak@0.25 (2:standard)`、`--rareOnly=rod,drain,ring@0.35`（`2000 组/240 步/lr=4e-4`），种子 1（`nov25-rod-dr-s25`）与种子 2（`nov25-rod-dr-s26` → `ROD-DR`）双双过 `selftest3 6/6 全绿`、`promote exit=0`、`Arena B +23.31/+23.35pt` 与 `seatKill=0`；
  - `ROD-DR` 实测（[`docs/artifacts/promote-ROD-DR.txt`](docs/artifacts/promote-ROD-DR.txt)）：**`selftest3` 6/6 全绿（`0.00e+0`）**、`promote 0` 阻断（`G(multi)=4.12 / G(long)=5.97`、`S=1.814`、G4 `multi 0% / long 1%`、G5 `0%`、`环@安全 61.5%`）、`Arena B +23.3499pt`（6/6 正、极差 `34.10pt`、`H=60.0, S=1.48`、`a-long h2=89.50%`）、`90210/90211` **`seatKill=0`（全 28 格 `≤3.0%`）**、2P `rule 20.8% / legacy 19.8%`、`Stage 1` 并集 **`17/30`（`rod 14/120`, `drain 10/120`, `ring 31/120`, `bigT 8/120`）**、Stage 2 `24` 技。
- **`PUR-DR`（`soft` · 补齐全池首个 `purify ≥3` 格载体）与退役 `nov21-rod-tzt2d-r10`**：
  - [`docs/artifacts/PUR-DR.bak`](docs/artifacts/PUR-DR.bak)（[`docs/artifacts/promote-PUR-DR.txt`](docs/artifacts/promote-PUR-DR.txt)）：**`selftest3` 6/6 全绿（`0.00e+0`）**、`promote 0` 阻断（`G(multi)=4.25 / G(long)=4.64`、G4 `2.7%/0%`、G5 `0%`）、`Arena B +26.6586pt`（6/6 正、`H=59.3, S=1.45`）、`Stage 1` **`purify = 6/120`（`41` 次出手、`8` 非零格）/`drain 19/120`/`ring 44/120`**、`90210/90211` **`seatKill=0`**（`≤13.5%`）；因 `2P rule = 88.3%` 入 **`soft`** 补盲；
  - 同期从 `soft` 退役 `nov21-rod-tzt2d-r10`（`seatKill=2`，移除其 Stage 1 raw）；使全池 `seatKill>0` 成员减为 2 枚（`hard` 持续保持 0 漏格）。
- **2P 回合占比定位、消融发现与 28 池验证（见 [`docs/research/RESULTS-2026-11-25-pool-gap-and-2p.md`](docs/research/RESULTS-2026-11-25-pool-gap-and-2p.md)）**：
  - 查明 `2:standard` 短局因回合数仅为 `long` 的约 1/5 在混合采样中被稀释；将抽样比重与教师配额提高至 `2:standard@10 + 0.90` 后，`nov25-purify-2p-s28` 把 2P 压至 `20.0%/12.5%` 并获 `Arena B +34.69pt`、`seatKill=0`（`≤4.0%`）；`nov25-fsg2-2p-s25` 虽将 `FS-G2` 2P 由 `59.3%` 降至 `16.5%` 且保住双闭环，但人席 `只枪压制` 达 `26%–44.5%` 拒入池；`nov25-taunt-2p-s25` 继承 `G5[long]=27%` 阻断；
  - 28 池阶梯（`probe-diff-ladder --pool=1 --surrogate=rule`, 400 局/档）：`5P long` 困难 **`9.5%`** → 普通 **`22.8%`**（`5.1σ`）→ 简单 **`31.8%`**（`2.9σ`）；`5P multi` 困难 **`5.5%`** → 普通 **`17.8%`**（`5.4σ`）→ 简单 **`22.0%`**；`2P standard` 普通 `50.8%` / 简单 `51.8%` / 困难 `55.3%`。

## v2.1.27 — 11-25（路线 A 多师隔离补摄魂：`DR-R3E` 入 `hard`，填补 `hard` 带有效摄魂覆盖，全池 `27` 枚 `14/13`）

**这一版是什么**：定位昨夜–午间摄魂（`drain`）训练失利的根因（`FS2-LE26` 在 `long` 40 局镜仅 `0.3%` 决策点达 `EP≥3`、`drainLegal=2`，属于状态不可达与 `--rareOnly` 饿死既有技能），改由 `selftest3` 全绿且原生具 `ring` / 高强度底盘的 [`docs/artifacts/nov22-ring3-gd6a18.bak`](docs/artifacts/nov22-ring3-gd6a18.bak) 起跑，在多师不冲突键道/桌形隔离下训出并优选种子 1 **`DR-R3E`**（[`docs/artifacts/DR-R3E.bak`](docs/artifacts/DR-R3E.bak)，`wid=eae4b0ad4013c202`）正式入 **`hard`**，使 `hard` 带重获 `drain ≥3 格` 有效覆盖，全池扩至 **`27` 枚（`hard 14 / soft 13`）**。

- **路线 A 受控两臂与跨种子复现**（详情见 [`docs/research/RESULTS-2026-11-25-drain-training.md`](docs/research/RESULTS-2026-11-25-drain-training.md)）：
  - **底座与配方**：`up/teacher=pack:nov22-ring3-gd6a18.bak`，`2:standard` 配 `--teacher4=pack:T65-RINGBEAD.bak@0.25`，多人长程由 `--teacher2=drain@0.35 --teacher2keys=drain --teacher2Shapes=3:multi,3:long,5:long,8:long` 开摄魂窗，配 `--rareOnly=drain,ring --rareFrac=0.35`（`groups=2000, steps=240, lr=0.0004, dagger=1`）；其中 **A2 臂** 叠加 `--teacher3=ringEcon@0.17 --teacher3keys=ring --teacher3Shapes=3:long,5:long,8:long`，**A1 臂**（`nov25-r3-ringdrain-s25`）`T2=TZ2C@0.35(ring,drain)` 作为对照。
  - **两粒种子实测**：A2 种子 1（`20261125` → **`DR-R3E`**）与种子 2（`20261126`）均在 `long` 代理局同步通过聚能环（`23`/`13` 段三连）、大雷（`25.0%`/`20.0%`）与摄魂（`17.5%`/`20.0%`），2P `standard vs rule` 均由亲代 `39.5%` 降至 `22.3%`/`22.5%`，且 `promote --dry --support=2` 均 `0` 阻断；择强选定种子 1（`selftest3` **6/6 全绿 `0.00e+0`**、`Arena B +27.50pt`、珠经济闭环）正式入 `hard`。历史摘要的 `hostile` 双过缺少原始回执，当前池复跑未复现（种子 1 `n3 7.5% < 10%`），已降级为待复核。
- **`DR-R3E` 全维度验收入池（`hard 14 / soft 13`）**：
  - `promote --dry --support=2`（[`docs/artifacts/promote-DR-R3E.txt`](docs/artifacts/promote-DR-R3E.txt)）：**`0` 阻断**（`✅ 五道全过`：`G(multi)=4.97 / G(long)=5.23`、`S=1.700`、墙 `17.10/局`、场A `30.2%`、反退化 `ok` `41.4%`、**珠闭环 ✓ `33.3%`（过期 `0.1/局`）**、G4 `multi 0% / long 12.3%`、G5 `0%`）；**场B `1.16/局` 是 `multi` 口径**，地图 `allLong` 另登记 `场B 清场 0.03/局 < 0.3`（`okLong=0`），long 无压清场未过；
  - 演化图谱（`100 PASS / 0 FAIL`）：`arenaB` `arS=+0.1789 / arL=+0.1616 / arR=+0.5229`（6 粒中位 **`+27.5039pt`**），`mixedfix MxC=+0.2593 / MxCL=+0.2346`、`a-long h2=88.04% / h5=41.49% / h8=33.18%`、`H=56.8, S=1.59`；
  - 人席与 Stage 1/2：`90210/90211` **`seatKill=0`**（`90210` `multi ≤3.5% / long ≤1.5%`，`90211` `multi ≤0.5% / long ≤6.0%`，`规则理解·自适应` 全 `0.0%`）；2P `standard` `rule 22.3% / legacy 20.5%`；Stage 1 并集 **`17/30`**（实池 `36.3%`、`drain` `7/120` 有效格 / `29/120` 非零 / `73` 次出手），Stage 2 `24` 技（消融 `10`、`drain rich Δ=+10.42% ±4.46%`）；
  - 27 池阶梯（`probe-diff-ladder --pool=1 --surrogate=rule`, 400 局/档）：`5P long` 困难 **`5.8%`** → 普通 **`23.8%`**（`7.4σ`）→ 简单 **`33.8%`**（`3.2σ`）；`5P multi` 困难 **`4.8%`** → 普通 **`18.0%`**（`6.1σ`）→ 简单 **`20.0%`**；`2P standard` 困难 **`53.8%`** / 普通 **`54.3%`** / 简单 **`52.5%`**。
- **工具修复**：补齐 [`champion-map/data/page/promote.tsv`](champion-map/data/page/promote.tsv) 末尾 6 行缺失尾列的格式使其与 6 列表头对齐。

## v2.1.26 — 11-25（天火闭环对称接入第 7 道与 L3 ‖ `FS2-LE26` 入 `hard` / `SOFT-RING-C3G25` 入 `soft` ‖ `RING-MINIT-CONT` 下放平衡池 `13/13`）

**这一版是什么**：按与「珠经济闭环（第 6 道 / `D78`）」相同的方式把「天火贴/爆闭环」接入全仓测评、体检与登记口径，并以洁净底座 `FS-G2` 配合桌形与行为隔离方案训出 **`FS2-LE26`**（[`docs/artifacts/FS2-LE26.bak`](docs/artifacts/FS2-LE26.bak)）入 `hard`、从昨夜副产物优选 **`SOFT-RING-C3G25`**（[`docs/artifacts/SOFT-RING-C3G25.bak`](docs/artifacts/SOFT-RING-C3G25.bak)）入 `soft`，并将人席 `seatKill=2` 且已被 `FS2-LE26`/`T65-RINGBEAD` 接班的 **`RING-MINIT-CONT`** 下放至 `soft`，全池由 `24` 枚（含此前合入的 [`docs/artifacts/T65-RINGBEAD.bak`](docs/artifacts/T65-RINGBEAD.bak)）整理为 **`26` 枚均衡双带（`hard 13 / soft 13`）**；同步补齐 [`tools/pool-add.mjs`](tools/pool-add.mjs) 入池/退役/刷新自动重烘 [`champion-map/skill-report.html`](champion-map/skill-report.html)。

- **天火闭环接入（对齐珠闭环架构，默认只记录不阻断）**：
  - [`tools/audit-lib.mjs`](tools/audit-lib.mjs)：新增 `FIRESTORM_BLOCK = false` 与单一真源探针 `firestormProfile(W, params, mode, GAMES)`（同 `chargeProfile` `long` 40 局 × 5 席），统计 `curseOk` / `curseLanded` / `firestormOk` / `firestormHits` / `emptyBoom` / 席局闭环率 `loopRate`（分母 `loopGames/stickGames`）/ 合法机会抓手率 `takeRate`，并在 `feasibilityOf` 接入第 7 道（`curseOk === 0` 记 `NA` 免罚，`curseOk > 0` 按 `firestormHits > 0 && stickGames > 0 && loopRate ≥ 0.30 && emptyBoomPerGame ≤ 1` 判定，`o.firestorm` 缺失按 `null` 报「探针缺失」）；
  - [`tools/promote-champion.mjs`](tools/promote-champion.mjs) 调用 `firestormProfile` 写入 `feas.firestorm` 并打印「天火经济」栏；
  - [`tools/champion-gate.mjs`](tools/champion-gate.mjs) 在 L3 只记录层登记 `firestorm`（旧机器名 `火`），[`tools/score13.mjs`](tools/score13.mjs) 解析该行并新增 4 条自测（`27/27 PASS`，L0+L1 维持 `12` 项）。
- **洁净基座激光眼与桌形隔离入 `hard`：`FS2-LE26`（[`docs/artifacts/FS2-LE26.bak`](docs/artifacts/FS2-LE26.bak)，`wid=56806d43e003f89b`）**：
  - 由 `selftest3` 全绿（`6/6, 0.00e+0`）的 `FS-G2.bak` 起跑，将 `lasereye` 限定在 `--teacher2Shapes=3:multi,5:long`（`--teacher2keys=laserEye,charge`、`--rareOnly=laserEye` 排除 `charge`），并在 `2:standard` 配 `--teacher3=pack:T65-RINGBEAD.bak`（不使用 `bundled-champion-2p.js`）取轮 0 快照 `.snap0`：
  - `promote --dry --support=2` **全过**：`✅ 五道全过`（`座位 14.1pt · G(multi)=7.08 · G(long)=7.29 · 墙=13.55/局 · 场A=28.2% · 场B=1.79/局`）、**珠闭环 ✓（花珠 90.7% / 过期 0.8/局）**、**天火闭环 ✓（席局闭环 68% / 0 空爆）**、G4 最坏 `12%` / `1.3%`（≤60%）、G5 `11%` / `1%`（≤25%）；
  - `measure-point --bake`（`100 PASS / 0 FAIL`）：`arenaB` `arS=+0.0831` / `arL=+0.0733` / `arR=+0.3019`，`mixedfix` `MxC=+0.0972` / `MxCL=+0.1298`，`a-long h2=74.88%`，Stage1 贴 1109 / 爆 389（`loopRate=91%, takeRate=48%`）、`laserEye` 在 `selfPlay long 40` 打出 `290` 次且覆盖 `ε=0` 与产品档双过，`seatKill=0`（90210/90211 `multi ≤19%`、`long ≤8.5%`），2P `standard` 替身复跑两 seed：rule 均值 `22.2%`、legacy 均值 `21.4%`（亲代 `FS-G2` 分别为 `61.0%` / `27.05%`）。
- **`soft` 副产物优选入池：`SOFT-RING-C3G25`（[`docs/artifacts/SOFT-RING-C3G25.bak`](docs/artifacts/SOFT-RING-C3G25.bak)，`wid=8c7030eb03258b17`）**：
  - `promote --dry --support=2` 全过（G4 `58.7%/60%`、`10.7%/60%`，G5 `0%/2%`），90210/90211 全 28 格 `≤10.0%`（`seatKill=0`，大幅收敛亲代 `nov22-c3g-s300k` 的 `57.5%/45.5%` 漏格），2P 替身 rule 均值 `14.35%`、legacy 均值 `36.0%`，Stage1 **天火引爆率 `97%`（906/933，抓手 `63%`，局闭环 `94%`）** 位居全 26 枚池成员首位。
- **26 枚全池复测（`hard 14 / soft 12`）与图谱记录**：
  - 同并录此前入 `hard` 的双亲融合包 [`docs/artifacts/T65-RINGBEAD.bak`](docs/artifacts/T65-RINGBEAD.bak)（`wid=00065fc589070d4e`，`4bcfdb17` 修复双亲谱系，`D82` 点名归档）；
  - `probe-diff-ladder`（1000 局/档 `vs rule`）：`5P multi` 困难 `5.3%` → 普通 `18.7%`（`9.2σ`）→ 简单 `24.2%`（`3.0σ`）；`5P long` 困难 `9.6%` → 普通 `21.7%`（`7.4σ`）→ 简单 `30.4%`（`4.5σ`）；`2P standard` 困难由 24 池的 `62.0%`（相对普通 `55.6%` 倒挂 `3.0σ`）收敛为 `56.1%`（相对普通 `54.4%` 差 `+1.70 ±4.27pt = 0.8σ`）。详情见 [`docs/research/STATUS-2026-11-25-firestorm-and-pool.md`](docs/research/STATUS-2026-11-25-firestorm-and-pool.md)。
- **权重考古补账**：恢复 `v7b-43.bak` / `v7b-44.bak` / `v7b-45.bak` / `v7b-46.bak` 四枚历史权重，wid 全部命中；文件 SHA 与历史 registry 不同，按 `sha-diff-wid-same` 登记，未改写历史 SHA。
- **摄魂训练研究**：`DRAIN-SOFT-SELF.bak` 双场 mastery 过线、2P 改善，但 ArenaB 仅 +2.23pt 且 G4/G5 未过，保留为 soft 研究候选、不入池；`supfit-gd` 新增教师零配额 fail-fast（exit 15），避免无声空转。

## v2.1.25 — 11-24（原位摘要日志与事件自动换行 ‖ 冠军加载/UI 防卡死 ‖ 图谱三父谱系与退图修复）

**这一版是什么**：把对战页战斗日志改造成“原位摘要 + 自动换行事件 + 一键展开完整日志”，同时补齐冠军池懒加载 `wid`/超时防御、包维度与权重校验以及演化图三父融合与异常底点清理。

- **对战页原位摘要日志**（[`index.html`](index.html)、[`css/style.css`](css/style.css)、[`js/ui/ui.js`](js/ui/ui.js)、[`tools/ui-probe.mjs`](tools/ui-probe.mjs)）：
  - 日志栏放回对局区 `#page-battle` 原全宽 `grid` 行（取消底部 `fixed` 悬浮），收起与展开都不再悬在视口最底端或遮挡技能栏与对手面板；
  - 收起态显示 `R<n>` + 全席动作芯片与过滤后的特殊事件摘要（`LOG_SUMMARY_SKIP` 跳过面板已展示的 EP/伤害/死亡/普通架势等高频条目），两行均采用 `flex-wrap: wrap` 自动换行、无横向滚动条；`logClear` 与悔一步 `undo` 同步刷新摘要，新增 `cannonCountered` 事件文案；
  - 点击「展开」在原位切换为 `min(42vh, 320px)` 完整事件日志面板，UI 探针第 `⑥` 组扩容校验至 **`19/19`** 全过。
- **冠军池懒加载校验、包结构防御与 UI 防卡死**（`2675f6ef`、`a3239351`）：
  - [`js/pool-loader.js`](js/pool-loader.js) 新增 15 秒加载超时、`widOf`（SHA-1）身份校验与回退后 `epoch` / `monoPacks` 作废晚到分片，新增 [`tools/probe-pool-loader.mjs`](tools/probe-pool-loader.mjs) 并接入 `D234`；
  - [`js/train/policy.js`](js/train/policy.js) 拒绝未知 `v` 与非有限权重借旧形状升级；[`js/train/policy2.js`](js/train/policy2.js) 与 [`training/proto2/arch2.mjs`](training/proto2/arch2.mjs) 同步校验 `dims.norm` 维度/有限性/正标准差并对齐缺省 `keySplit=1`，[`js/bundled-champion.js`](js/bundled-champion.js) / [`js/bundled-champion-3p.js`](js/bundled-champion-3p.js) 刷新规则指纹至 `bfd49045`；
  - [`js/ui/ui.js`](js/ui/ui.js) 分离终局收缩起扣回合清空与独立伤害配置，切脚本档立即作废挂起加载、`newGame`/`closeModal` 清空弹窗按钮与焦点防跨局误触、局中导入冠军包补写换包留痕。
- **演化图三父融合导出、谱系真相修正与极值退图**（`e6b52a2f`，含 `8bbd671a` / `c93d6c81`）：
  - [`champion-map/lineage.mjs`](champion-map/lineage.mjs) 与 [`champion-map/viewer.mjs`](champion-map/viewer.mjs) 补齐 `parentOf3` / `parentName3` / `parentSrc3` 导出与追溯链/明细渲染，使真三路融合包 `OBS6-SHAPEDIST-V3S2` 完整保留三父边；
  - 清除 `MSB15-SOUPB` 残留的半截融合父边，标实未落档 R1 热启动与 `soup-15b` 来源说明；退图无强度训练且将全图线性高度轴压扁 20% 以上的蒸馏中间态 `GD4-RATION`（保留磁盘原件 `scratch/arms/GD4-RATION.bak`，同步更新 `MSB15R-GD4RAT` 说明与 `11-18` 对照快照），重烘后页内自检 **`100 PASS / 0 FAIL`**。

## v2.1.24 — 11-24（**`TK-FS4`** 入 `hard`：藤甲坦克 × 天火闭环 × 珠闭环双闭环火弱协同 ‖ 珠经济塌缩定位与覆盖口径纠偏）

**这一版是什么**：回应用户对 `FC-G1 / FC-S1 / AR-TK2` 珠经济崩溃的定位要求，查明「退化底座（`RG-CN 4.1%` / `MX8-CN-M 1.3%` / `TZT2D+armor 2.1%`）+ `ship-promote.mjs DENSITY_BLOCK = false` 不阻断」的成因，并以 `FS-G2` 双闭环底座叠加 `AR-TK2`（`armor,tank@0.20`）兼在 `--rareOnly` 中明确护住 `railgun` 训出 **`TK-FS4`**（[`docs/artifacts/TK-FS4.bak`](docs/artifacts/TK-FS4.bak)，`wid=ac126b3320bd4ed5`）正式合入 **`hard`**（池 `22 → 23`：`hard 12 / soft 11`，缓存戳 `p1124a → p1124b`）。

- **藤甲坦克 × 天火闭环双协同载体 `TK-FS4`（`hard`）**：
  - Stage1（120 格）：**珠闭环 `82.7%`**（`220/266`，每局过期仅 `0.04` 颗）、**天火闭环 `79.8%`**（`186/233`，抓手 `48.1%`，空爆 `0`）、`armor=1,545(99/120)`、`tank=156(19/120)`、`railgun=220(12/120)`，`gunspam@2m/@2l` 全胜 `10/10`。
  - 300 局 `5P` `eps=0` 自对局：珠闭环 **`70.8%`（`multi`）/ `54.3%`（`long`）**，首次打出同局内藤甲火弱 `+1` 同步触发 **`tank +1`（`18/29`）与 `firestorm +1`（`3/12`）** 的双火焰伤害协同。
  - `3000` 局 `5P` 全池均胜 **`22.6%`**（`#11/23`，超越 `AR-TK2` `22.2%` 与 `OBS6E9` `17.8%`；`long` `27.1%` 全场 #3）；`arenaB=-3.40pt`、`promote` **0 阻断**（`G4[long] 2%/60%`、`G5 0%/1%`）、Stage2 `强度 20 技（消融 9）`、`seatKill=0`（90210/90211 全 28 格 `≤ 12.5%`）。
- **定位记录、家族修正与典型失败对照进图**：
  - 记录 [`supfit-gd.mjs`](training/proto2/supfit-gd.mjs#L1170-L1180) `pickBresenham` 在 `--teacher2frac == --teacher3frac` 时发生游标撞车抢占（错开 `0.23/0.19` 可恢复 `teacher2` 采样）；
  - 修复并精简 [`add-point.mjs`](champion-map/pipeline/add-point.mjs#L119-L138) 的 `obs6.5` 家族归类：将原零碎 6 族（`fam=23..28`，其中 `24/26/27` 各仅 3–7 枚）依演化主脉合并为 `fam=23..25`（总计 `0..25` 共 `26` 族）：① `fam=23`「V3 路由与统一单包（11-16）」（`22` 枚 = 原 `23+24`）；② `fam=24`「键道/覆盖补盲与协同蒸馏」（`39` 枚 = 原 `25` + `night2-X2b-fuse / purify / taunt / cannon-pg` + `nov24-bandsym-jin`）；③ `fam=25`「天火闭环与双协同演进」（`11` 枚 = `night2-E1-det-strong → c3g/c3b → FS-G2 / FC-G1 / FC-S1 / TK-FS4` 及 4 枚对照）；
  - 测点纳入 5 枚有代表性的非崩盘失败/取舍对照包（图谱 `1,024 → 1,029` 行，`100 PASS / 0 FAIL`）：`nov24-fsclose-f35`（`G5[long]=49%`）、`nov24-pierce3-20261101`（闭环被挤至 `28.1%` 边缘）、`TK-FS1`（未护 `railgun` 致珠 `10.0%`+偏座 `23pt`）、`TK-FS3`（`S=1.991` 但 `arenaB=-22.13pt` 且 `long` 反弹人席 `38%/35.5%`）、`nov24-bandsym-jin`（吞掉基座独守 `miniT` 归零）；
  - 更正并统一池覆盖表述：`skill-report` 总出手（`totalUses > 0`）口径下为 **`hard 27/30 / soft 29/30 / 全池 29/30`**（全池仅 `mirror` 0 出手）；`pool-xray` `cov ≥ 1` 格口径为 `hard 25 / soft 24 / 并集 27`。

## v2.1.23 — 11-24（天火闭环双将 **`FC-G1 / FC-S1`** 入池 + 退 `5` 枚冗余未闭环包 `25 → 22` + `arena-eval` JSON 回归修复 + T3 考古 10 枚收口）

**这一版是什么**：落实用户 `08:00` 裁定——不立天火闭环硬准入门、`curseOk=0` 免管；将天火闭环双将 **`FC-G1`**（`--invite` 入 `hard`，仅 `G5[long]=31%`、无其它缺陷）与 **`FC-S1`**（`0` 阻断入 `soft`）合入产品池，同时退役 `5` 枚冗余未闭环成员使全池精简为 **`22` 枚（`hard 11 / soft 11`）** 兼闭环主力翻倍（`2 → 4`）；顺手修复 `tools/arena-eval.mjs` stdout 混入日志文本破坏 `measure-point` 的回归，并完成最后 `8` 条 T3 线索考古扫尾（找回 `10` 枚，正式收口）。

- **新入池天火闭环双将**：
  - **`FC-G1`（`hard`，`--invite`，[`docs/artifacts/FC-G1.bak`](docs/artifacts/FC-G1.bak)，`wid=cd0d19ba78e411cf`）**：`RG-CN` 底座 + 双路穿防 `@0.20` + `curse,firestorm@0.30`；`selftest3` **6/6**（`0.00e+0, π=0.943`），`5P` 3000g 循环赛 **`28.4%`**（`#3/29`），`Arena B` 6-seed 配对胜现役 `RG-CN +1.02pt`（`arenaB=-16.64pt`），`seatKill=0`（`90210/90211` `multi` 全 `0.0%`、`long ≤ 8.5%`），Stage1 `union=16/30`、`loopRate=91.71% (343/374)`、`takeRate=46.22%`、`emptyBoom=0`。
  - **`FC-S1`（`soft`，[`docs/artifacts/FC-S1.bak`](docs/artifacts/FC-S1.bak)，`wid=9390478ce2e1ba00`）**：`MX8-CN-M` 底座 + 同 v5 配方直接接替 `MX8-CN-M`；`selftest3` **6/6**，`promote --dry --support=2` **0 阻断**（`G5[long]=20% ≤ 25%`），`5P` `17.8%`，`arenaB=-25.67pt`，`seatKill=0`，Stage1 `union=15/30`（`cannon:9`）、`loopRate=92.76% (333/359)`、`takeRate=53.82%`、`emptyBoom=0`。
- **池精简（`25 → 22`：`hard 11 / soft 11`）与天火普查**：
  - 退役 5 枚冗余 `onlyStick`（`noGrab=1`）成员：`MX8-TN25-KL`、`MX1-GD-EQ`、`CN-G1`、`MX8-CN-M`、`MX7-T2-R`；按 `skill-report` `totalUses > 0` 口径 `hard 27/30` / `soft 29/30` / 全池 `29/30`（仅 `mirror` 未覆；`cov ≥ 1` 格为 `hard 25 / soft 24 / 并集 27`），`probe-pool --tier=hard --games=60` `multi=1.55% / long=2.50%`（零 `3σ` 漏格）。
  - `firestorm-closure.mjs` 复测：闭环主力扩至 `4` 枚（`FC-G1 92%`、`FC-S1 94%`、`FS-G2 88%`、`nov22-c3g-s300k 88%`），抓手率均 `47–55%`；`OBS6E9 / RG-MN / MSB11-R1S130778313 / nov21-purify-dsp0 / RINGB11` 共 `5` 枚 `curseOk=0` 免管。
- **难度阶梯 `1500g` 复测（[diff-ladder-claims.mjs](tools/diff-ladder-claims.mjs)）**：
  - `pool:multi`：困难 `5.3%` → 普通 `18.4%`（`+13.13 ±1.16pt = 11.3σ`）→ 简单 `22.3%`（`+3.93 ±1.50pt = 2.6σ`）；
  - `pool:long`：困难 `11.5%` → 普通 `23.5%`（`+12.00 ±1.41pt = 8.5σ`）→ 简单 `31.1%`（`+7.60 ±1.62pt = 4.7σ`）。
- **工具链修复与 T3 考古收口**：
  - 修复 `arena-eval.mjs` 将 `✅ 条件留痕` 输出到 `stdout` 导致 `measure-point.mjs --pack` JSON 解析失败的回归（改为 `console.error`，并在 `measure-point.mjs` 取末尾 `{` 行容错）；
  - 对剩余 8 线索（7 批）执行 `sweep-server-batches.mjs`，校准命中并找回 **`10`** 枚缺失权重（`v7new5_005-82/91/92/93`、`v7bead3-31/93`、`v7beadseed-31/93`、`v7cmin4-93`、`v7t2-82`），台账 `missing` 从 `147 → 137`（`ok 708 / sha-diff-wid-same 138`，`land-recovered --check` 零违例），其余无线索项正式收口；重烘清单与分片戳 `p1123f → p1124a`、演化图 100 PASS / 0 FAIL。

## v2.1.22 — 11-23（**`RG-CN`** 入 `hard` + 全场强弱重分层与精简 `38 → 25` + `lv:sparring` `scriptMix` 调降为 `p=0.35/s1`）

**这一版是什么**：新增过载炮 × 长程聚能环强包 **`RG-CN`**（5P 全池均胜 **31.5%**、对规则人类 `0.0%/0.0%`、`G4` 全原型 `0%`）；随后按 **4000 局全场 5P 循环赛 + 逐枚人席强度 + 技能覆盖并集** 将冠军池从臃肿的 `38` 枚精简并重分层为 **`25` 枚（`hard 13 / soft 12`）**，并把简单档脚本席概率由 `p=0.7/s2` 下调至 `p=0.35/s1`（保留 `st:mix` + `st:toolkit`），使 `multi` 与 `long` 四相邻难度台阶全部站上 **`≥ 2.1σ`**。

- **新入池 `hard` 成员 `RG-CN`**（[`docs/artifacts/RG-CN.bak`](docs/artifacts/RG-CN.bak)，`wid=6f926e8b926fa719`，`v:92 / S1o / 16,561`）：
  - 用 fresh `EQ-S4-GD6ATEACH` 单轮防抖 + `CN-G1` 主教师 + `ringEcon@0.22(5:long,8:long)`（`--rareOnly=ring --rareFrac=0.35 --steps=250 --lr=0.0004`）训出；**`selftest3` 6/6 全绿（`0.00e+0`、`π=0.886`、腿 F `12/12`）**；100g `long` `5P ring=20(3连×4)/cannon=5`，`8P ring=35(3连×8, 4连×1)/cannon=4/bigT=6`。
  - `promote --dry --support=2` **0 阻断**：`G(long)=5.93 / S=1.818 / G_eff=6.16`、`环@有ep·安全=80%`、`G4[multi/long]` 全原型 **`0%/60%`**、`G5=0%/0%`、场A `37.9%`、墙 `17.15/局`、`arenaB=-1.9914pt`、`MxC=0.1596 / MxCL=0.2403`（`MxSkU=15 / MxSkE=14`）、`seatKill=0`（`multi` 7 格全 `0.0%`、`long ≤ 6.0%`）；Stage1 `ring 27/120 (412)、bigT 11/120 (160)、charge 30/120 (1602)、railgun 7/120 (67)、cannon 4/120 (30)`。
- **全池重平衡（`38 → 25`：`hard 13 / soft 12`）**：
  - **跨带重划**：`nov21-armor-tzt2d`（全场均胜 `27.2%`）`soft → hard`；`AR-TK2 / nov21-purify-dsp0 / MX6-GD-TF20`（对规则人类分别给到 `34–41% / 24–28% / 15.5–17.5%` 或全池偏弱）`hard → soft`。
  - **退役 13 枚冗余 / 劣质克隆**：`EQ-S4-E9`、`EQ-S4-GD6ATEACH`、`MN-G1`、`MX3-GDEQ-GD`、`MX5-GD-T2STR`、`MX6-GD-TF15`、`OBS6P9-S4000`、`DEF-s16`、`MX5-GD-LE40`、`night2-E1-det-strong`、`nov22-c4c-t20`、`RINGB9`（`soft` 中潜伏的 `0%/0%` 强包，已由 `RING-MINIT-CONT` 接续）、`TZT2D`。保留 `MX8-TN35-KL3` 与 `nov21-rod-tzt2d-r10` 分别守 `soft` 带 `dualGun` / `rod` 覆盖，**全池 `28` 技能并集零缺失**（`hard` 中位 `+11.4pt / 25 技`，`soft` 中位 `-16.7pt / 24 技`）。
  - `probe-pool --tier=hard --games=60`：`multi` 6 格均值 **`0.84%`**、`long` **`4.40%`**（零 `3σ` 漏格）。
- **难度阶梯与脚本混合重校（[bots.js](js/train/bots.js)）**：
  - 全池精简后 `lv:sparring` 原 `p=0.7/s2` 下 `long` 已不再倒挂，但与 `lv:regular` 仅差 `+0.80pt (0.4σ)`；将 `lv:sparring.scriptMix` 调为 `{ p: 0.35, seats: 1, min: 1, ids: ['st:mix', 'st:toolkit'] }` 后，`probe-diff-ladder --pool=1 --surrogate=rule --pairs=1 --games=1000` 实测：**`multi`** 困难 `6.2%` → 普通 `20.2%`（`+14.00 ±1.51pt = 9.3σ`）→ 简单 `24.0%`（`+3.80 ±1.82pt = 2.1σ`）；**`long`** 困难 `8.1%` → 普通 `25.6%`（`+17.50 ±1.65pt = 10.6σ`）→ 简单 `31.7%`（`+6.10 ±2.09pt = 2.9σ`）。
- **池与产物**：重烘 `25` 个分片 / 清单（缓存戳 `p1123e → p1123f`）、演化图（1021 行，100 PASS / 0 FAIL）与 `skill-report`（25 枚，missing=0）；并收口 v7 考古回收对账脚本与账本（`state=ok 708 / sha-diff-wid-same 121 / missing 154 / 0 违规`）。

## v2.1.21 — 11-23（**`HL-G1`** 入 `hard`：对局中全息套盾配合载体，`holo 35/120` 格、`40g other=56/self=0`、`arenaB=-1.83pt`、`MxC=.255`、`seatKill=0` ‖ 池 36 → 37）

**这一版是什么**：用 fresh `EQ-S4-GD6ATEACH` 底座 + `OBS6E9` `holo@0.15`（`--rareOnly=holo --rareFrac=0.25 --steps=250 --lr=0.0004`）训出对局配合强包 **`HL-G1`**；在 `hard` 带首次打出高覆盖全息均势/队友套盾（**Stage1 `holo 35/120` 格 / `322` 出手**，此前 `hard` 最高仅 `9/120`），同时保住 `railgun 33/120` 格、`bigT 8/120`、`S=1.822` 与 `seatKill=0`，池增至 **37 枚**（`hard 21 / soft 16`）。

- **新入池 `hard` 成员 `HL-G1`**（[`docs/artifacts/HL-G1.bak`](docs/artifacts/HL-G1.bak)，`wid=803f773db2e563f0`，`v:92 / S1o / 16,561`）：
  - `promote --dry --support=2` **0 阻断**：**`全息屏障（自对局）0.2/局（套给别人 0.2/局）`**（40 局自对局实测 `self=0 / other=56`），`G(long)=5.87 / S=1.822 / G_eff=6.18`（最大单卡压到 `30.6%`），场A `32.4%`，座位 `13pt`，`G4[long] 9.7% / G4[multi] 5.0%`，`G5=0%/0%`，珠闭环 `83.0%`。
  - `arenaB=-1.8279pt`（spread `35.54`，`arS=+0.0988 / arL=+0.0349 / arR=+0.2154`）；`MxC=0.2546 / MxCL=0.1694`（`MxSkU=13 / MxSkE=12`），`ax-multi h2=85.12 / h3=56.46`；`seatKill=0`（90210/90211 `multi ≤ 0.5% / long ≤ 10.0%`）；Stage 1 `union=13/30`（**`holo 35/120` 格/`322` 出手、`railgun 33/120` 格/`582` 出手、`bigT 8/120`、`shift 2/120`**）。
- **池与产物**：`champion-map/data/page/pool-members.tsv` 36 → **37**（`hard 21 / soft 16`）；重烘整表 / 清单 / 37 个分片、演化图（1020 行，100 PASS / 0 FAIL）与 `skill-report`（37 枚，missing=0）；池缓存戳 `p1123d → p1123e`。

## v2.1.20 — 11-23（**`RG-MN`** 入 `hard`：地雷 × 长程聚能环单轮防抖强将，`arenaB=+11.38pt`、`MxCL=0.257`、`ax-long h2=88.77`、`seatKill=0` ‖ 池 35 → 36）

**这一版是什么**：用 fresh `EQ-S4-GD6ATEACH` 单轮防抖、`MN-G1` 主教师（地雷风格）叠加 `ringEcon@0.22(5:long,8:long)`（`--rareOnly=ring --rareFrac=0.35 --steps=250 --lr=0.0004`）训出 **`RG-MN`**；首次让 `hard` 带拿到**「地雷 + 长程聚能环 + 落雷」三位一体**的新风格长程环包（非 `GD6ATEACH` 单一克隆），池增至 **36 枚**（`hard 20 / soft 16`）。

- **新入池 `hard` 成员 `RG-MN`**（[`docs/artifacts/RG-MN.bak`](docs/artifacts/RG-MN.bak)，`wid=7e4628cbec354183`，`v:92 / S1o / 16,561`）：
  - `promote --dry --support=2` **0 阻断**：`G(multi)=3.71 / G(long)=5.61`（`S=1.803 / G_eff=6.07`，最大单卡压到 `33.3%`），场A `36.4%`（含反弹 `47.6%`），反弹墙 `13.65/局`（0 零伤害局），座位 `8.5pt`，`G4[long] 4.3% / G4[multi] 15.7%`，`G5=0%/0%`，`环@有ep·安全=28.6%`。
  - **`arenaB=+11.3764pt`**（`arS=+0.1334 / arL=+0.1319 / arR=+0.4415`，4/6 粒正）；`MxCL=0.2568`（`MxSkU=14 / MxSkE=13`），`ax-long h2=88.77 / h3=62.50 / h5=41.89 / h8=31.82`；`seatKill=0`（90210/90211 `multi ≤ 1.0% / long ≤ 9.0%`）；Stage 1 `union=14/30`（**`mine 44/120` 格/`710` 出手、`ring 26/120` 格/`1,041` 出手、`bigT 10/120` 格/`125` 出手、`railgun 4/120`**）。
- **池与产物**：`champion-map/data/page/pool-members.tsv` 35 → **36**（`hard 20 / soft 16`）；重烘整表 / 清单 / 36 个分片、演化图（1019 行，100 PASS / 0 FAIL）与 `skill-report`（36 枚，missing=0）；池缓存戳 `p1123c → p1123d`。

## v2.1.19 — 11-23（**`MN-G1`** 入 `hard`：P1-2 `hard` 带 `mine` 补盲首破，`arenaB=+10.38pt`、`selftest3` 6/6、`seatKill=0` ‖ 池 34 → 35）

**这一版是什么**：沿用低剂量底座配方（`EQ-S4-GD6ATEACH` + `MSB11-R1S130778313` `mine@0.12`，`--rareOnly=mine --rareFrac=0.15 --steps=250 --lr=0.0004`）训出短名强包 **`MN-G1`**；`hard` 带首次拿到活跃 **`mine`（Stage1 `52/120` 格 / `797` 出手）** 兼 `arenaB=+10.38pt` 低抖动，池增至 **35 枚**（`hard 19 / soft 16`）。

- **新入池 `hard` 成员 `MN-G1`**（[`docs/artifacts/MN-G1.bak`](docs/artifacts/MN-G1.bak)，`wid=79e3b76bbf41c67a`，`v:92 / S1o / 16,561`）：
  - `selftest3` **6/6 全绿**（`0.00e+0`, `π=0.941`, 腿 F `57/57`）；`promote --dry --support=2` **0 阻断**（`G(multi)=3.98 / G(long)=4.68`、`S=1.543 / G_eff=4.68`，场A `31.3%`、反弹墙 `15.3/局`、座位 `13.3pt`，`G4[long] 10.3% / G4[multi] 16%`、`G5=0%/1%`、珠闭环 `81.8%`）。
  - **`arenaB=+10.3772pt`**（spread `21.39`，5/6 粒正）；`MxC=0.1929 / MxCL=0.1559`（`MxSkU=12 / MxSkE=11`）；`seatKill=0`（90210/90211 `multi ≤ 1.0% / long ≤ 5.5%`）；Stage 1 `union=12/30`（**`mine 52/120` 格 / `797` 出手**、`railgun 17/120`、`charge 26/120`）。
- **池与产物**：`champion-map/data/page/pool-members.tsv` 34 → **35**（`hard 19 / soft 16`）；重烘整表 / 清单 / 35 个分片、演化图（1018 行，100 PASS / 0 FAIL）与 `skill-report`（35 枚，missing=0）；池缓存戳 `p1123b → p1123c`。

## v2.1.18 — 11-23（**`CN-G1`** 入 `hard`：P1-2 `hard` 带 `cannon` 补盲首破，`arenaB=-2.46pt`、`G4 只枪 2.7%/60%`、珠闭环 `82.4%`、`seatKill=0` ‖ 池 33 → 34）

**这一版是什么**：沿用 `FS-G2` 低剂量底座配方（`EQ-S4-GD6ATEACH` + `MX8-CN-M` `cannon@0.12`，`--rareOnly=cannon --rareFrac=0.15 --steps=250 --lr=0.0004`）训出短名强包 **`CN-G1`**；`hard` 带首次拿到稳定 **`cannon` 覆盖（Stage1 `10/120` 格 / `88` 出手）** 且全考卷 `cannon` 活跃，池增至 **34 枚**（`hard 18 / soft 16`）。

- **新入池 `hard` 成员 `CN-G1`**（[`docs/artifacts/CN-G1.bak`](docs/artifacts/CN-G1.bak)，`wid=a3f63c60a01e4f35`，`v:92 / S1o / 16,561`）：
  - `promote --dry --support=2` **0 阻断**：`G(multi)=4.41 / G(long)=4.95`（`S=1.672, G_eff=5.32`，4/4 类、5/8 角色），场A `33.9%`（含反弹 `44.8%`），反弹墙 `17.10/局`（0 零伤害局），座位 `16.7pt`，`G4[long]` 最克「只枪」`2.7%/60%`（余 `57.3pt`）、`G4[multi]` `18.7%/60%`，`G5` 与带档均 `0%/0%`，珠闭环 `82.4%`（过期 `0.1/局`）。
  - `arenaB=-2.4571pt`（spread `49.77`，3/6 粒正：最高 `+29.01 / +27.33`）；`MxC=0.2181 / MxCL=0.2586`（`MxSkU=14 / MxSkE=12`）；`seatKill=0`（90210 `multi ≤ 0.5% / long ≤ 4.0%`，90211 `multi ≤ 2.5% / long ≤ 6.5%`）；Stage 1 `union=15/30`（`cannon 10/120` 格/`88` 出手、`railgun 25/120`、`bigT 6/120`、`curse 4/120`、`shift 1/120`）。
- **池与产物**：`champion-map/data/page/pool-members.tsv` 33 → **34**（`hard 18 / soft 16`）；重烘整表 / 清单 / 34 个分片、演化图（1017 行，100 PASS / 0 FAIL）与 `skill-report`（34 枚，missing=0）；池缓存戳 `p1123a → p1123b`。

## v2.1.17 — 11-23（**`FS-G2`** 入 `hard`：P1-1 反只枪压制 × `curse/firestorm` 低剂量首破，`arenaB=-3.48pt`、`G4 只枪 14.7%/11.0%`、珠闭环 `80%`、`seatKill=0` ‖ 池 32 → 33）

**这一版是什么**：修复 `supfit-gd` `--rareFrac <= 0.25` 切分边界并按单变量控制（`EQ-S4-GD6ATEACH` 底座 + `nov22-c3g-s300k` 的 `curse,firestorm@0.12`、`--rareOnly=firestorm,curse --rareFrac=0.15 --steps=250 --lr=0.0004`）训出短名强包 **`FS-G2`**；`hard` 带首次拿到活跃 **`firestorm`（38/120 格）+ `curse`（68/120 格）+ `railgun`（25/120 格）**，池增至 **33 枚**（`hard 17 / soft 16`）。

- **新入池 `hard` 成员 `FS-G2`**（[`docs/artifacts/FS-G2.bak`](docs/artifacts/FS-G2.bak)，`wid=892ba770d1dfca0b`，`v:92 / S1o / 16,561`）：
  - **门禁与血统**：`selftest3` **6/6 全绿**（`腿C 最坏相对误差 0.00e+0` · `π=0.777` · `腿F 57/57`）；`promote --dry --support=2` **0 阻断**（`考卷 56.8%` · `G(multi)=5.05 / G(long)=4.88` · `墙 18.8/局` · `场A 27.6%` · `场B 3.99/局` · `G4 只枪 14.7%/11.0%` · `G5=0%/0%` · 珠闭环 `80.0%`）；
  - **B/C 轴与人席**：`arenaB = -3.4817pt`（spread `48.9125` · 3/6 粒为正最高 `+21.54` · 较 `c3g-s300k` `+24.1pt`）；4N `multi x2..x8 = +.141/+.500/+.286/+.286`、`long = +.090/+.357/+.256/+.143`；**`seatKill = 0`**（`90210/90211` 只枪压制 `multi 20%/23%`、`long 13.5%/18%` 均优于基准，反弹 `≤5%`）；Stage1 120 格 `firestorm 38/120(524 手)` · `curse 68/120(853 手)` · `railgun 25/120(257 手)`。
- **管线与工具修复**：修复 `champion-map/pipeline/add-point.mjs` 在 `1061ac9e` 退役 `lineage-g3` 后新增 `2.0` 点未写入 `page/lineage.tsv` 导致掉入 `fam 0` 的问题；修复 `tools/` 7 台命令行工具 `rejectUnknownFlags` 缺口（`D218` 转绿）；修复 `scratch/sweep-server-batches.mjs` 漏解析 `hot` 列并新增追回 `v7protoE` 3/3、`v7role12` 3/3、`v7curri2` 6/6、`v7u1-31`、`v7t1` 2/2 等 `v7` 历史包。
- **池与产物**：`champion-map/data/page/pool-members.tsv` 32 → **33**（`hard 17 / soft 16`）；重烘整表 / 清单 / 33 个分片、演化图（1016 行，100 PASS / 0 FAIL）与 `skill-report`（33 枚，missing=0）；池缓存戳 `p1122e → p1123a`。

## v2.1.16 — 11-22（`nov22-ring3-gd6a18` 入 `hard`：5P long 三连 30.1% / 8P 27.2%，`arenaB=+20.40pt`，`seatKill=0` ‖ 池 31 → 32）

**这一版是什么**：把 `ringEcon` 的 long 剂量从 `0.12` 提到 `0.18`，在 fresh `EQ-S4-GD6ATEACH` 上训出 `nov22-ring3-gd6a18`：5P/8P long 的环链首次稳定越过 3 连，同时 `arenaB` 和 `selftest3` 都不掉；池从 31 枚增到 **32 枚**（`hard 16 / soft 16`）。

- **新入池 `hard` 强将 `nov22-ring3-gd6a18`**（[`docs/artifacts/nov22-ring3-gd6a18.bak`](docs/artifacts/nov22-ring3-gd6a18.bak)，`wid=a64b53c90367221a`，`v:92 / S1o / 16,561`）：
  - **配方**：`EQ-S4-GD6ATEACH.bak` 起点 + `ringEcon@0.18`，仅 `5:long,8:long` 形态；`--rareOnly=ring --rareFrac=0.35 --groups=2400 --steps=250 --lr=0.0004 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6`；相对 `R-GD12` 只改 `ringEcon` 剂量 `0.12 → 0.18`；
  - **环链（100 局 headless，ε=0.15）**：5P long 链长 `1/28 · 2/23 · 3/20 · 4/2`，**三连 22/73 = 30.1%**；8P long `1/57 · 2/34 · 3/28 · 4/4 · 5/2`，**三连 34/125 = 27.2%**、最长 5 连；R-GD12 基线为 5P `0%` / 8P `7.0%`；
  - **强度与门禁**：`arenaB=+20.401pt`（6/6 种子正，spread `24.28`）；`selftest3` **6/6 全绿**；`promote --dry --support=2` **0 阻断**（A 57.9%、场A 还手 32.1%/含反弹 47.0%、场B 30%、珠经济闭环 66.7%）；`seatKill=0`（人席 90210/90211 multi≤2.5% / long 最高 7.0%）；
  - **训练对照**：`nov22-ring3-rgd12`（从 R-GD12 再蒸一轮）行为上也能把三连推到 13%/20%，但 `selftest3` 腿 C 红（第二轮过饱和），已作为淘汰臂留在 TRAINING-RUN-LOG；本版只收 fresh 单变量成功臂。
- **池与产物**：`champion-map/data/page/pool-members.tsv` 31 → **32**；`champion-map/pool-seat-90210.tsv` / `pool-seat-90211.tsv` 补入正式人席行；重烘 32 枚整表 / 清单 / 32 个分片、演化图（1015 行，100 PASS）与 `skill-report`（32 枚，missing=0）；池缓存戳 `p1122d → p1122e`。
- **验证**：`np 166/166（291.2s） · spec 81/81 · smoke OK · battle OK · map OK`；`pool-add --audit` = `members=32 / hard=16 / seatUnknown=0 / dupWid=0 / blockedAuto=0 / bad=[]`。

## v2.1.15 — 11-22（玩家向文案与移动端/日志 UI 修正 ‖ 冠军池 HTTP 懒加载：3P 默认从 4.49MB gzip 降到约 304KB）

**这一版是什么**：修掉上一轮复核里发现的玩家向文案错误与版式问题，并把冠军池从“整表 9.6MB 全量下发”改成“清单 + 本局抽到的 N−1 枚分片懒加载”。规则引擎、抽签算法与池成员（31 枚，hard 15 / soft 16）一字未动；v2.1.14 的 AR-TK2 随本版一并提交。

- **玩家向文案修正**（[js/ui/rules-panel.js](js/ui/rules-panel.js)）：
  - 小雷 FAQ 改为引擎真实口径：**只有防御/反弹/原型制御免疫**；蓄能、聚能环、ジ、摄魂、全息都会被作废且花费照扣。旧文案写“不含蓄能/聚能环/全息”与 MINI_T_IMMUNE 矛盾；
  - 大雷的格挡清单补全（防御/反弹/藤甲/原型可挡，八卦/金刚盾按判定）；
  - 全息屏障补上“激光眼打施放者或被套盾者都能拆”；挑衅由“指定攻击类技能”改为“任意攻击类技能”（引擎 TAUNT_SATISFY 本来就是任意攻击）。
- **对局 UI**：
  - 日志改为视口底部固定抽屉：收起 84px / 展开 42vh，1440×900 与 1366×768 下最新一行不再落到折叠线以下；
  - 手机端新增粘性对手 HP 速览条（#quickopps），选招时不必滚到技能区下方看对手血量；390×844 实测速览条 0–36、技能区 44–678、日志抽屉 728–844，同屏可见；
  - 1024×768 窄桌面技能格压缩到 84px/50px（10 行 → 8 行，底边 930 → 784）。
- **终局收缩日志**：不再冒用“触发隐藏技能【终局收缩】”，改为“场地效果【终局收缩】启动”（[js/ui/ui.js](js/ui/ui.js) 的 evText）。
- **冠军池 HTTP 懒加载**：
  - [tools/build-pool-bundle.mjs](tools/build-pool-bundle.mjs) 新增 --split：同时生成 js/pool-manifest.js（约 5KB）与 js/pool-packs/ 下的 31 枚分片，原整表照写；
  - [js/pool-loader.js](js/pool-loader.js) 按本局 draw.seats 注入分片（script 标签，不是 fetch，file:// 也能用）；本地无分片或 HTTP 分片 404 时回退整表并响亮说明；
  - [index.html](index.html) 改读清单 + loader；[.github/workflows/pages.yml](.github/workflows/pages.yml) 在 Pages 构建时跑 --split --ver=p1122d；.gitignore 排除 js/pool-packs/（构建产物，不入库）；
  - 实测 3P 普通 = 清单 1,548B + 2 枚分片 150,616/151,795B ≈ **304KB**（整表 gzip 4,487,656B，约 −93%）；8P 为 6 枚包 + 1 席脚本；同 seed 下整表与懒加载 10 回合 transcript 逐字相同。
- **验证**：np 166/166（243.9s） · spec 81/81 · smoke OK · battle OK · map OK；另测分片全 404 回退整表、file:// 双击回退整表、中途切难度加载新分片均正常。
- **版本与缓存戳**：v2.1.14 → v2.1.15；index.html 的 ?v=mwm11sbr → mwm11sbs、?v=p1122c → p1122d，CSS 加同一缓存戳。

## v2.1.14 — 11-22（`AR-TK2` 正式入池 `hard` 带 · 池 `30 → 31` ‖ 坦克×藤甲线 `reflect` 误读修正与 `rareFrac` 切分机制定论）

> ⚠ **记账重复的版本号，无对应发布点（11-22 深夜核）**：本节描述的 `AR-TK2` 入池实际随 `2c6ba531`（标题记为 `release(v2.1.15)`）落盘，
> `index.html` 的程序版本戳从 `v2.1.13` 直接跳到 `v2.1.15`、从未出现 `v2.1.14` ⇒ 补打的 tag 只有 `v2.1.13` 与 `v2.1.15`，**没有 `v2.1.14` 这个 tag**。

**这一版是什么**：复核 DS 的 `AR-TK3/4` 判例并完成 `AR-TK5–AR-TK8` 受控对比实验，厘清 `probe-human-seat` `全程刷反弹` 指标含义、发现 `supfit-gd.mjs` `rareFrac` 与 `splitByShape` 的 `75%/25%` 切分边界、核实 `seat-rule.mjs` 带内参照下 **`AR-TK2`** 全部五道门全绿（`seatKill = 0`），正式将其入库合入 **`hard` 带**（全池 `30 → 31`，`hard 15 / soft 16`），使 `hard` 带首次同时具备 `armor`（`120/120` 格）与 `tank`（`26/120` 格）条件协同覆盖。

- **新入池 `hard` 强将 [`AR-TK2`](docs/artifacts/AR-TK2.bak)**（`wid=b5d4cbc6af57bbdd`，`hard 14 → 15` / 全池 `30 → 31`）：
  - **配方**：`TZT2D` 起步 + `nov21-armor-tzt2d` 单主教师 + `tkWeak@0.20`（`--teacher2keys=tank --rareOnly=tank --rareFrac=0.35 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1`）；
  - **三轴与体检读数**（`champ=bundled-champion-3p` / `24 锚`）：**A 轴** `a-multi x5=0.2466 / a-long x5=0.2399`、`考卷 54.5%`、`ruler H=51.9 / S=2.01`；**B 轴** `arenaB` 6 种子中位 **`+10.3588pt`**（极差 `53.42pt`，`arR=+0.0036`、`arL=+0.0586`）；**C 轴** `C5R=+0.0826 / C5RL=+0.1752`；`selftest3` **6/6 全绿（`0.00e+0`）**；`promote --dry --support=2` **0 阻断**（`G_eff=7.54/8.25`、`G4=6.3%/18.7%`、`G5=7%/5%`、`反弹墙 10.30/局`、`场A 12.2%/含反弹触发 28.6%`）；
  - **人席与普查**：按 `seat-rule.mjs` 官方 `hard` 带内参照（`90210/90211` 允许上限 `<25.25% / <24.25%`），`AR-TK2` `long 全程刷反弹 = 25.0% / 25.0%` 不满足两批同号 `≥20pt` 否决，**`pool-add --tier=hard` 判定 `seatKill = 0`**；Stage 1 胜率 `40.75%`（`并集 16/30`、`armor 120/120` 格 **`5,205` 手**、`tank 26/120` 格 **`212` 手**、`sword 80/120` 格 `770` 手、`snipe 54/120` 格 `1,815` 手），Stage 2 强度 `22` 技（消融 `9`）。
- **坦克×藤甲线实验机制定论（`AR-TK3..AR-TK8` 留档 `scratch/arms/`，详见 [`STATUS-2026-11-22-tank-armor.md`](docs/research/STATUS-2026-11-22-tank-armor.md)）**：
  - **指标误读澄清**：`probe-human-seat` 的 `全程刷反弹` 是 1 席反弹脚本人对阵 4 席 AI 的夺冠率（非 AI 自身按 `reflect`）。`AR-TK3` 降到 `6.7%` 是因为退回 `TZT2D` 恢复了破反 `sword`（`62 → 214`），并非摘 `reflect` 键生效；三教师拼盘导致 `AR-TK3/4` `arenaB` 崩盘至 `-41.40pt / -25.05pt`；
  - **`rareFrac` 切分边界**：`supfit-gd.mjs` 中 `inRare` 在每形后 `rareFrac` 段启用，而 `splitByShape` 固定前 `75%` 进 `train`、后 `25%` 进 `test`，故 `--rareFrac=0.25`（`AR-TK5`）使稀有样本 100% 落入测试集、`tank` 条件响应归零；`AR-TK6`（`-18.25pt`）、`AR-TK7`（`-2.37pt` / `反弹墙 0` / `multi 只枪压制 41%/48%`）、`AR-TK8`（`-11.54pt` / `long 反弹 36.5%`）均未全面超越 `AR-TK2`。

## v2.1.13 — 11-22（`R-GD12` 携 `聚能环` 高分入池 `hard` 带 · 池 `29 → 30` ‖ `tkWeak` 条件藤甲×坦克配合实证）

**这一版是什么**：在 `EQ-S4-GD6ATEACH` 底座上通过低学习率长程定向蒸馏合入 **`R-GD12`**，首次实现在不触发 `selftest3` 数值饱和与 `seatKill=0` 的前提下以 `arenaB = +15.89pt` 正式入池 `hard` 带并把 `hard` 带聚能环载体从 `2/13` 推升至 `3/14`；同时新增可选条件教师 `tkWeak` 完成 **`藤甲 → 坦克`** 因果协同与 6 万局 RL 留存实验。

- **新入池 `hard` 强将 [`R-GD12`](docs/artifacts/R-GD12.bak)**（`wid=7e55abc3894ca3e2`，`hard 13 → 14` / 全池 `29 → 30`）：
  - **配方**：`EQ-S4-GD6ATEACH.bak` 底 + `--teacher2=ringEcon --teacher2keys=ring --teacher2Shapes=5:long,8:long --teacher2frac=0.12 --rareOnly=ring --rareFrac=0.35 --groups=2400 --steps=250 --lr=0.0004 --objective=cand --dagger=1`（控制步数与学习率以避开 `nov22-r2-gd6a-ring` 在 `lr=0.001 / steps=450` 时的 `π=NaN` 过饱和）；
  - **读数**：6 种子 `arenaB = +15.89pt`（全部 6 粒为正，`+46.88/+11.53/+6.43/+20.24/+11.47/+26.26`，超底座 `GD6ATEACH` `+3.5pt`）、`arR = +0.4688`、`ruler H=58.2, S=1.62`、`promote --dry` **0 阻断**（`考卷 57.7%` · `G4=0%/0.3%` · `G5=0%/0%` · `场A 35.0%/含反弹 47.4%` · `墙 21.35/局` · 珠经济 `50%` 闭环 · 安全开环 `19.2%`）、人席 `90210/90211` **`seatKill=0`**（`multi ≤3.0% / long ≤2.5%`）、Stage 1 跨环境胜率 **`47.0%`**（`ring 28/120` 格 **`1,046` 手** · `railgun 24` · `bigT 17` · `sword 88` · `snipe 83`）。
- **`坦克 + 藤甲` 配合机制实证（新增 opt-in 教师 `tkWeak`，结果保留于 `scratch/arms/`）**：
  - [training/proto2/supfit-gd.mjs](training/proto2/supfit-gd.mjs)：新增可选教师 `tkWeak`（仅当目标已挂 `fireWeakNow` 且上一手非反弹/藤甲/制御时教 `tank` 追打 `2` 火伤，零新旋钮、默认路径不变）；
  - 单轮 joint 臂 **`AR-TK2`**（`TZT2D` 起步 + `nov21-armor-tzt2d` 主教师 + `tkWeak@0.20`）达成 `selftest3` **6/6 全绿（`0.00e+0`）**、`arenaB = +10.36pt`、`promote` **0 阻断**（`G_eff = 7.54/8.25`），109 局中盘反事实因果探针测得目标翻为 `fireWeakNow=true` 时 `P(tank→target)` 从 `2.09%` 跃升至 **`15.78%`（`+13.69pt`，`argmax 2→18`）**；
  - 接续 60,000 局 `--klCand=1.0` 纯胜负 `pg-train`（`AR-TK2-PG`）后，该因果增益 **`+13.66pt`（`2.09% → 15.75%`）几乎无损留存**（`arenaB = -5.71pt`）；因 `AR-TK2` 在 `long` 全程刷反弹格为 `25.0%`（相对基线贴 `20–21pt` 边界），按自动入池红线暂不推自动席、留 `scratch/arms/AR-TK2.bak` 供点名研究对照。
- 同期聚能环对照组 **`nov22-r1-ringb9-klcand.seg90000`**（`RINGB9 + klCand=1.0 PG @90k`）：`arenaB` 从 `-10.65pt` 抬至 `-4.11pt`（`promote` 0 阻断、60 局长程 `ring=297`），因人席 `multi` 只防御格触红留档不入池。

## v2.1.12 — 11-22（场A 反弹触发计入阻断而不换历史尺 ‖ `armor` / `klCand-PG` / `tank` 三将入 `soft` 带 ‖ `night2-X2b-fuse` 退役 ‖ 池 27 → 29）

**这一版是什么**：落实用户对任务 1 与任务 2 的裁定——保持图谱历史 `fieldA.atk` / `feasibility.tsv` 尺列逐位不变，将 `promote` 与筛选器的 `F 场A` 阻断改按「主动攻击或触发反弹」计算；随后将 `armor` 强载体 `nov21-armor-tzt2d`、`--klCand=1.0` 长程 PG 强节点 `nov22-c3g-s300k` 及降剂量 `supfit` `tank` 新将 `nov22-c4c-t20` 走完整测点与人席流程并入池 `soft` 带，正式退役池底最后一枚残障融合包 `night2-X2b-fuse`（池 `27 → 29`，`hard 13 / soft 16`）。

- **`场A` 阻断口径升级（不破坏 1,010 枚历史尺列同尺性）**：
  - [tools/audit-lib.mjs](tools/audit-lib.mjs)：`aggressionProfile` 保留原 `fieldA.atk` 与 `feasibilityOf` `feas.fieldA` 逐位不变，新增同回合反弹触发统计 `reflActs`、`reflHits` 与 `atkWithReflect = (atkNew + reflActs) / acts`（识别 `e.type === 'reflect' && e.to === me`，同回合最多记 1 手）；
  - [tools/promote-champion.mjs](tools/promote-champion.mjs)、[tools/screen-champ.mjs](tools/screen-champ.mjs)、[tools/gates/ship-promote.mjs](tools/gates/ship-promote.mjs)（`D55`）：均改为以 `atkWithReflect < 0.20` 作为 `F` 阻断判据并在体检输出并列展示旧尺与含反弹触发还手率。
- **新入池 `soft` 带（3 枚全部 `promote` 0 阻断）与 `night2-X2b-fuse` 退役**：
  - `nov21-armor-tzt2d`（[`docs/artifacts/nov21-armor-tzt2d.bak`](docs/artifacts/nov21-armor-tzt2d.bak)，`wid=7819b2196ba23fca`）：`TZT2D` 底 + `armor@0.30`，6 种子 `arenaB = -12.20pt`（`arR = +0.0036`），`场A` 旧尺 `14.5%` / 含反弹 `32.5%` 过门，`G4` 余 `25.3–34.0pt`，`G5` `14%/17%`，`seatKill=0`（自动合格），Stage 1 `armor` **`5,228` 次**；
  - `nov22-c3g-s300k`（[`docs/artifacts/nov22-c3g-s300k.bak`](docs/artifacts/nov22-c3g-s300k.bak)，`wid=39f605c3f8b9a62c`，筛自 `nov22-c3g-long.seg300000.bak`）：`arenaB = -27.55pt`（超 `night2-E1-det-strong` `+2.8pt`），**珠经济闭环（花珠率 75.0% / 浪费率 0%）**，`G4` `10.7%/53.0%`、`G5` `6%/0%`、`场A` `20.8%/26.8%`，`seatKill=0`（自动合格），Stage 1 `curse 1,370 / firestorm 851`；
  - `nov22-c4c-t20`（[`docs/artifacts/nov22-c4c-t20.bak`](docs/artifacts/nov22-c4c-t20.bak)，`wid=e658497a05bf30b2`，`TZT2D` 底 + `night2-X2b-fuse@0.20` `tank` 键道 + `rareFrac=0.35`；同波 `nov22-c4b-klcand.bak` 对照 `G4[multi]` 停 `63–66%` 未入）：`selftest3` 六腿全绿（`0.00e+0`），`promote` **0 阻断**（`G4 41.3%/54.7%`、`G5 7%/7%`、`场A 28.5%`、`tank` 自对局命中 `146` 次 / `multi` 占 `28.7%`），`arenaB = -34.72pt`（较 `night2-X2b-fuse` 抬升 **`+52.5pt`**，`arL=+0.0149 / arR=-0.0602`），Stage 1 **`tank 2,528` 次**；因 `long` 全程刷反弹触带内 `seatKill=2` 点名入池接盘 `tank` 格，随之 `pool-add --retire=night2-X2b-fuse` 退役并备份其 raw（已同步更新 [`docs/artifacts/nov22-tzt2d-stab.bak`](docs/artifacts/nov22-tzt2d-stab.bak) 先前在池台账）；
  - 另记同批已纳入台账之历史与过夜 `.bak` 点名（D82）：`nov21-armor-dsp0.bak`、`nov21-armor-dsp0b.bak`、`nov21-armor-tzt2d-b.bak`、`nov21-cannon-tzt2d.bak`、`nov21-rod-tzt2d-r10b.bak`、`nov22-c4-tank-x2b.bak`、`nov22-c5-ladder-r2.bak`、`nov22-c6-lasereye.bak`、`nov22-c7-tank-on-c6.bak`、`nov22-c8a-stab.bak`、`nov22-c8b-halfdose.bak`、`nov22-c9-tank-mild.bak`、`nov22-c10-e9-stab.bak`、`nov22-c1-replay.bak`、`nov22-c1-replay2.bak`、`nov22-c2a-freeze-long.bak`、`nov22-c2b-tilt-long.bak`、`nov22-c2c-synergy.bak`、`nov22-c2d-lowlr.bak`、`nov22-c2e-hianchor.bak`、`nov22-c2f-script-arena.bak`、`nov22-c3a-kw0.bak`、`nov22-c3b-kw100.bak`、`nov22-c3c-smoke.bak`、`nov22-c3c-cand-anchor.bak`、`nov22-c3d-pack.bak`、`nov22-c3e-gain.bak`、`nov22-c3f-both.bak`、`nov22-c3g-long.bak`。
- **演化图自检重标定与产品烘焙**：
  - [champion-map/viewer.mjs](champion-map/viewer.mjs)：`1,009+` 点（`sig=0.099`）下 `§E608` 等值面抽样在 `GN=96` 发生 `301 vs 290`（差 `11 > 9.0`）离散混叠，将自检固定网格切至 UI 精细档 `st.isoGN = 128`（判据线 `max(3, 3%)` 一字未动），`rebuild-map.mjs` 恢复 **100 PASS / 0 FAIL**；
  - 重烘 [`js/bundled-champion-pool.js`](js/bundled-champion-pool.js)（`8989 KB`，`29` 枚 `hard 13 / soft 16`）、[`champion-map/index.html`](champion-map/index.html)（`1,010` 枚）、[`champion-map/trends.html`](champion-map/trends.html) 与 [`champion-map/skill-report.html`](champion-map/skill-report.html)（`238,059` 字节，`missing=0`），同步更新 `README.md`、`index.html?v=p1122a`、[`docs/MAP-PACK-INVENTORY.md`](docs/MAP-PACK-INVENTORY.md) 与 [`docs/TRAINING-RUN-LOG.md`](docs/TRAINING-RUN-LOG.md)。

## v2.1.11 — 11-21（DS-P0 `purify` / `taunt` 双强包入 `hard` 带 ‖ `night2-S6` 退役 ‖ 池 25 → 26）

**这一版是什么**：在 `Q-s47` 恢复解除建图阻塞后，于 [`training/proto2/supfit-gd.mjs`](training/proto2/supfit-gd.mjs) 补齐仅键道触发的 `taunt` / `rod` / `mirror` 专科教师，训练并筛选出两枚 `hard` 带 `DS-P0` 补盲新将正式入池，同时回填 `night2-E1-det-strong` 人席并退役软带头号负资产 `night2-S6`（池 `25 → 26`，`hard 13 / soft 13`，全池 `seatUnknown = 0`）。

- **新入池 `hard` 带（2 枚 · 全 `seatKill=0` ‖ 自动合格）**：
  - `nov21-purify-dsp0`（[`docs/artifacts/nov21-purify-dsp0.bak`](docs/artifacts/nov21-purify-dsp0.bak)，`wid=b4a65ee4437584cf`）：`EQ-S4-E9@0.70 + purify@0.30`（活咒源 `day1119-det-gd`）；6 种子 `arenaB = +14.04pt`、`promote` **0 阻断**（珠经济 100% 闭环）、`seatKill=0`、对活咒源条件净化 `0.27/局`（为 `hard` 带补上 `purify`）。
  - `nov21-taunt-dsp0b`（[`docs/artifacts/nov21-taunt-dsp0b.bak`](docs/artifacts/nov21-taunt-dsp0b.bak)，`wid=db7883520de2e2fe`）：`EQ-S4-E9@0.70 + taunt@0.30`；6 种子 `arenaB = +17.92pt`（100 局 `arR = +35.83pt`）、`seatKill=0`（`multi` 7/7 全 `0%`）、`promote` 上线档全过（`G4 0%/28%`，`G5[long]=29% ≤ 40%`）、Stage 1 普查 **`taunt` 活跃 `95/120` 格（`1,822` 次出手）**。
- **池维护升级**：
  - 补测并回填 `night2-E1-det-strong` 的人席否决（`seatKill: -1 → 1`）；
  - 通过 `pool-add.mjs --retire=night2-S6` 退役并清理软带负资产 `night2-S6`（`arenaB=-104.8pt`、`seatKill=8`、废贴 `0/315`）；
  - 同步重烘 [`js/bundled-champion-pool.js`](js/bundled-champion-pool.js)（`7966 KB`，`26` 枚）及 `champion-map/{index,trends,skill-report}.html`，刷新 `index.html?v=p1121a`；更新 [`docs/MAP-PACK-INVENTORY.md`](docs/MAP-PACK-INVENTORY.md) 与 [`docs/TRAINING-RUN-LOG.md`](docs/TRAINING-RUN-LOG.md)。
- **同波机制排查留档**：`nov21-rod-rm`（`RING-MINIT-CONT` 底座 + `rod`）在 `arenaB = -1.86pt` 下将条件 `rod` 抬至 `8/100` 局；`nov21-mirror-dsp0` 暴露双目标 `(t1, t2)` 12 组分散 `cand` 梯度且挤占主线（`G4/G5` 阻断，不入池）。

## v2.1.10 — 11-21（全图谱包盘存总表 + 固定训练参数台账 + 历史缺件抢救里程碑）

**这一版是什么**：整理并固化全谱系冠军包的盘存与可复现边界总文档，建立后续所有训练臂共用的固定训练参数流水台账，并同步纳入 `fam=7` / `fam=9`（`36/36`）及 `2.0` 小族（`24/40`）逐位抢救落仓成果（全图缺失由 `668 → 416`）。

- **新增长期文档**：
  - [`docs/MAP-PACK-INVENTORY.md`](docs/MAP-PACK-INVENTORY.md)：汇总 `champion-map/data/registry.tsv` 全图 **1,003** 枚在册包（`568` 在盘、`416` 缺失、`19` 无路径）、`26` 个谱系家族明细、现役池 **25** 枚（`hard 11 / soft 14` 全员在盘）与 B 轴 **24** 锚（`24/24` 在盘），并划定 `fam=19..20`（`16` 枚）由未播种 `KDO5-seed` 永久阻断及 `fam=1..6`（`400` 枚）早期 `server` 批边界。
  - [`docs/TRAINING-RUN-LOG.md`](docs/TRAINING-RUN-LOG.md)：后续每次训练均需登记的固定参数台账与标准实验卡片模板（只记非默认 `--flag` / 环境变量 / 上游与三尺读数，旋钮全集单源仍引用 [`training/TRAINING-KNOBS.md`](training/TRAINING-KNOBS.md)）。
- **历史包恢复归档汇总**：`fam=7`（`seed81` + `docs/artifacts/E35-prod-807.bak`）与 `fam=9`（`L/R/09-28/e234` 共 `34` 枚）整族清零，连同 `2.0` 小族 `24` 枚逐位复现并同步台账，`19` 个家族已清零。
- **版本与门禁**：`v2.1.9 → v2.1.10`（`README.md` / `index.html` / `CHANGELOG.md` 三方同步）。

## v2.1.9 — 11-19 晚（人席复测：day1119-cannon-pg 退役，RING-MINIT-CONT 点名保留 ‖ 池 25 → 24）

**这一版是什么**：补测 7 枚 seatKill=-1 成员的人席读数后，按用户裁定执行 B 方案：day1119-cannon-pg（seatKill=4、arenaB -82pt）退役；RING-MINIT-CONT（hard 带 ring/miniT 唯一载体）点名保留并记录 seatKill=2（band provisional）。池 25 → **24 枚**（hard 11 / soft 13）。

- 人席探针：7 枚 × 200 局 × multi/long × seed 90210/90211；报告 docs/research/SEAT-2026-11-19-refresh.md。
- 图/包：rebuild-map 100 PASS；bundle 7318KB；版本 v2.1.9；?v= 刷 p1119b。
- 说明：本轮补齐 7 枚补测值（RING-MINIT-CONT=2、S6=8、X2b=0、RINGB11=0、RINGB9=2、TZT2D=2）；RINGB9/TZT2D 以点名保留；其余旧成员保持旧值（band refresh 的 10 个变动未全量应用）。
## v2.1.8 — 11-19 午（`skill-report` 行内引爆率与电/爆珠使用率 ‖ 池 25 枚 `day1119-cannon-pg` 入 `soft` 带）

**这一版是什么**：在 `skill-report` 去掉卡片顶部重复横幅，把**真实引爆率**与**蓄能电/爆珠使用率**内联进表格行；同时把全项 0 阻断通过体检的过载炮宽谱候选 `day1119-cannon-pg` 走完整管道入池 `soft` 带（池 24 → **25 枚**，hard 11 / soft 14）。

- **`skill-report` 观察层指标与页面优化**：
  - [tools/pool-skill-report.mjs](tools/pool-skill-report.mjs) Stage 1 在 120 格跨环境对局同步统计 `curseStats`（`curseOk` / `curseLanded` / `firestormOk` / `firestormHits`）与 `bead`（`elec`/`boom` 的获得/消耗/过期数）。
  - [champion-map/build-skill-page.mjs](champion-map/build-skill-page.mjs) 删除顶部冗余 `.wastewarn` 横幅，改为在「天火 / 贴贴」行内标注真实引爆率（可超过 `100%`）并在「蓄能」行内分列**电珠/爆珠使用率**；重跑全池 25 枚 Stage 1 与 [champion-map/skill-report.html](champion-map/skill-report.html)（207,124 字节）。
- **池 24 → 25（`day1119-cannon-pg` 入 `soft` 带）**：
  - `day1119-cannon-pg`（`docs/artifacts/day1119-cannon-pg.bak`，wid `ae28c0aaf8bf6098`，`MX8-R6C-KL` 上 `toolkit+cannon 0.25` 双教师 + PG 1,500 局）：`promote --dry --support=2` **0 阻断全过**（`G4[long] 23%/60%` · `G4[multi] 19%/60%` · `G5 3%/25%` · `场A 21.0%` · `G(multi/long) 5.12/4.59` · `花珠率 98.8%`），Stage 1 覆盖 `cannon` 28 格、`armor` 81 格、`shift` 41 格、电珠使用 **`97%`**（`2393/2469`）、0 废贴；`measure-point` A 轴 `P2=+0.4077 / P3=+0.1677 / P5L=+0.0828 / MxSkE=20`，`arenaB=-82.28pt`（强于现役 `night2-X2b-fuse` `-87.25pt` 与 `night2-S6` `-104.76pt`）。
  - 完成 `measure-point --bake` → `pool-add` → `exam4n-mixedfix-1116`（`MxC/MxCL`）→ `rebuild-map`（`1002` 行，`100 PASS`）→ `build-pool-bundle.mjs`（`js/bundled-champion-pool.js` `7642 KB`，`D234` 验收 25 枚全齐）。
- **24h 产物点名（D82）**：`day1119-cannon-pg.bak`、`night2-S6.bak`、`night2-X2b-fuse.bak`、`night1119-A1-tank-band3.bak`、`night1119-MS2c-band1.bak` 均在 `docs/artifacts/` 在场对账。
- **版本**：`v2.1.7 → v2.1.8`。

## v2.1.7 — 11-19 午（移除 skill-report `ji` 消融 · 补齐天火贴符前置与废贴告警 · 训练侧治「只贴不爆」）

**这一版是什么**：修复 `skill-report` 把 0 费基础回资源动作 `ji` 纳入消融以及天火无贴符前置恒报“实验未生效”的两处测量缺陷，并在可视化页与训练管线里同时显形和治理「只贴不爆（贴贴而不接天火）」纯浪费。

- **池级与单包 `skill-report` 修复**：
  - [pool-skill-report.mjs](tools/pool-skill-report.mjs) 与 [skill-report.mjs](tools/skill-report.mjs)：把 `ji`（ジ）移出 Stage 2 消融选择集与 `--ban` 循环，消除禁 `ji` 导致整局 0 资源的失真消融（且此前因 `cat === 'energy'` 在 `econ`/`econLong` 重复出现两次）。
  - [strength-lib.mjs](tools/strength-lib.mjs)：`makeSelCore` 为 `forceKey === R.SK.FIRESTORM` 自动补上 R64 贴符前置（场上无己方存活符咒时先强制 `curse` 上膛），全池 24 枚包的天火强制命中率从 0%（实验未生效）全部恢复至 **`100%`**。
  - [build-skill-page.mjs](champion-map/build-skill-page.mjs)：在 `QUOTAS` 新增「贴爆闭环」配额并支持多键联合计数；在卡片区与强度表对 `curse >= 3 && firestorm * 4 < curse` 的包打出「⚠ 贴而不引 / 只贴不爆」告警；重刷全池 24 枚 `champion-map/data/skill-report/*.json`（剔除 `ji` 并重跑 `firestorm`）后重烘 [champion-map/skill-report.html](champion-map/skill-report.html)，实测揪出 **15 枚** 在池包存在「只贴不爆」纯浪费。
- **训练管线根治「只贴不爆」与两路实验验证**：
  - [supfit-gd.mjs](training/proto2/supfit-gd.mjs)：`buildTeacherPick`（`pack:`/`toolkit`/`chainmix` 分支）接入 `closeCurseStorm` 闭环守卫——场上存在己方存活符咒且非关键终结拍时优先引爆天火，同时禁止 `ep < 2` 穷贴孤儿符并优先选最高血量活敌。同 seed 双跑 `--teacher=chain` 默认路径 `wid` 逐位一致（`d58efca69c0b6bbd`）。
  - [pg-train.mjs](training/proto2/pg-train.mjs)：负权 `curse`（`--shapeKey=...,curse:-0.08`）改为仅惩罚“之后本局再无 `firestorm` 引爆”的孤儿贴符，并在 `--klW` 冻结锚分布 `q0` 中自动清零负塑形键避免锚回旧废招。同 seed 双跑无负塑形路径 `wid` 逐位一致（`13ed6123e3c5fa90`）。
  - 实测臂 A（`day1119-X2b-cf` → `day1119-X2b-pg.seg1500`）清零孤儿贴符后，`arenaB` 从 `night2-X2b-fuse` 的 `-87.25pt` 升至 **`-57.97pt`（`+29.28pt`）**；臂 B 产出过载炮宽谱候选 `day1119-cannon-pg.seg1500`（`promote --dry --support=2` **0 阻断**，`G4 19%/23%`、`G5 3%`、`场A 21.0%`、`花珠率 98.8%`、`用卡 9`、`cannon 1%`、`arenaB -82.28pt`）。
- **24h 产物点名（D82）**：在册留档产物 `night2-S6.bak`、`night2-X2b-fuse.bak`、`night1119-A1-tank-band3.bak`、`night1119-MS2c-band1.bak` 均在盘上且已入上一版账（详见 `D137` 与 `D234` 门禁验收）。
- **版本**：`v2.1.6 → v2.1.7`。

## v2.1.6 — 11-19 午（2.0 统一训练总入口与训练场恢复 ‖ 演化图颜色分尺与普查页导航 ‖ 池 24 枚两带与数据补齐）

**这一版是什么**：收拾昨晚退役 `v7` 线后留下的训练接口与文档残账——新建统一的 2.0 训练 CLI 总入口与本地 2.0 SSE 训练服务，恢复主页「🧪 训练场」页签，把演化查看器底图/点颜色按短程/长程彻底拆列，并补齐新入池成员（`night2-S6`、`night2-X2b-fuse`、`RING-MINIT-CONT`）的地图读数与普查入口。

- **2.0 统一训练总入口与本地训练场**：
  - 新增 `training/train.mjs`（统一 `--mode=pg|supfit|distill|fuse|selftest`，自检默认基座对齐 `obs6` 包 `EQ-S4-E9.bak`）与本地 2.0 HTTP+SSE 服务 `training/server/train-server.mjs` + `training/start-train-server.cmd`（纯 Node 内置模块实现 `/status`、`/reset`、`/champion`、`/train`）。
  - 恢复主页 [index.html](index.html) / [js/ui/ui.js](js/ui/ui.js)「🧪 训练场」tab（支持 2.0 `pg` 策略梯度与 `supfit` 蒸馏拟合实时波形和热插拔），修复 `#btn-import` 首次点击无效绑定与 `useBuiltinChampion()` 后冠军状态栏未刷新；同步更新 `tools/smoke.mjs` 与 `tools/battle-test.mjs`。
  - 对齐 `pg-train.mjs` / `supfit-gd.mjs` 的 `--up`/`--upstream`、`--segEvery`/`--snapEvery` 别名并将默认基座改为 `docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak`；收敛 `supfit-gd.mjs` / `arch2.mjs` / `rotation-obs5.mjs` / `_ctx.mjs` 残留的环境变量直读，重新生成 `training/TRAINING-KNOBS.md` 达标 `KPI ≤ 40`（全集 **40** ‖ 在用 **19** ‖ 暗键 **21**）。
- **演化查看器与管道收口**：
  - `champion-map/viewer.mjs` 的 `#color`（底图色）与 `#dot-color`（点颜色）下拉框按短程/长程分列、将无长程语义的 `b` 替换为短/长 `G(Geff / G2)`、移除无用的 `random`/`pass` 与已退役旧 B 轴，并在顶栏 `kids[0]` 内补挂 `skill-report.html`（「技能普查 ↗」）入口；重建 `champion-map/index.html`（100 PASS）。
  - 修复 `champion-map/pipeline/measure-point.mjs`（补 `a-v2coop-exam-1118` 与长程 `G2` 提取）、`add-point.mjs`（写入 `feasibility.tsv` 的 `g2`）、`tools/pool-add.mjs`（`--run-promote` 联动 `promscan.mjs`）与 `champion-map/rebuild-map.mjs` / `tools/sync-page-coords.mjs`（幂等补行与增量同步）。
  - 补齐 `night2-S6.bak`、`night2-X2b-fuse.bak`、`RING-MINIT-CONT` 的 `g2`、`a-v2coop-exam-1118`（`De`/`DeL`）、`exam4n-mixedfix-1116`（`MxC`/`MxCL`）与 `promote.tsv`；修正 `G5C-100`/`G5J-50` 夹具路径（`docs/artifacts/exam4-fixtures/`）。
- **夜班 24h 产物点名（D82）与仓库清理**：
  - 昨晚入池及方法论留档产物共 4 枚留在 `docs/artifacts/`：`night2-S6.bak`、`night2-X2b-fuse.bak`（pool 24 枚 soft 带，两带配置见 `D234`）、以及方法论/STATUS 引用的 v7 教师种子 `night1119-A1-tank-band3.bak`、`night1119-MS2c-band1.bak`（同时在 `scratch/arms/` 留存副本）；其余 124 枚夜班临时 `night1119*` 快照已删清。
  - 更新 `README.md` 与 `training/README.md`，删除失效脚本与 `v7` 旧入口说明，保留最新 2.0 CLI 现状。
- **版本**：`v2.1.5 → v2.1.6`。

## v2.1.5 — 11-18 晚（X 轴退役：B 轴照 A 轴，只留 page 一条）

**这一版是什么**：按用户裁定，A 轴只有 page 一条，B 轴照办，不再单独维护 X 轴。

- **X 轴退役**：`b-arena-pl-1118` 从 X current 改回 B reference（ε=0 读数留作参考，不再上图）；F5 的 `b-f5-page-1114` / `b-f5-eps0-1114` 保持 reference。
- **数据层**：display 的 16 个 X/n 列清空；`build-view` 与 `measure-point` 容忍无 current X（不再响亮报错，X 列留空；新点不再跑 x 复测）。
- **页面**：viewer 移除 Δε 标签；F 公式不变——X̄₄ 读的始终是 C 族 `(A+B)/2`，A/B 现在都是页面剂量。
- **重建**：新对照锚 `archive/2026-11-18-noX/coords-gen8-noX-1118.tsv`；`rebuild-map` **100 PASS**。
- **版本**：v2.1.4 → v2.1.5。

## v2.1.4 — 11-18 晚（B 轴换页面剂量 Arena + F5 退役）

**这一版是什么**：演化图 B 轴从 ε=0 贪心换成实机 page dose；X 半边同步换成 Arena 贪心版，F5 两条尺退役。产品池不变（22 枚，8/14）。

- **B 轴 b-arena-page-1118**：24 锚联盟整桌按 DIFF_TIERS lv:regular（eps 0.1 / epsK 5 / soft + 前 3 回合斜坡）出手；全库 980 包 × 176 局（multi+long 双桌），289 秒、fail=0。页面 B 轴读数口径即玩家默认拿到的剂量。
- **X 半边 b-arena-pl-1118**：把贪心版从 B 轴改挂到 X 轴（同赛程同种子），F5 的 b-f5-page-1114 / b-f5-eps0-1114 转 reference（保留历史行，不删数据）。
- **Δε 恢复**：P?R（Arena 页面）− X?R（Arena 贪心）同赛程；例 EQ-S4-E9 5P short −0.0024 − (−0.0805) = +0.078；RING-MINIT-CONT 5P short −0.1932 − 0.0727 = −0.266、long +0.152 − (−0.083) = +0.235。两版各自标定锚点联盟（page short/long corr 0.7035，greedy 0.6696），读数按各自联盟均值归一 ⇒ 同赛程近似配对，不是逐局配对。
- **数据层**：page/coords.tsv 补 5 枚到 999；readings +7840 行（57524 → 65364）；display 的 arS/arL/arR 换页面版；重建图 999 行、rebuild-map 100 PASS（新对照锚 archive/2026-11-18-arena-page/coords-gen7-arena-page-1118.tsv）。
- **工具**：arena-eval 新增 --dose=exam|page --eps-tier=；新增 tools/attach-arena.mjs；build-view 去掉 F5 短程兜底；measure-point 的 Arena 新点分 page+exam 两半测；viewer 的 Δε 守卫只保留 bp1118 跨夹具一条。
- **版本**：v2.1.3 → v2.1.4。

## v2.1.3 — 11-18 下午（**人类替身重做 + 池 22 枚 + B 轴换 Arena 尺 + 5 枚多样性包入图**）

**这一版是什么**：产品侧池 20→22（hard 8 / soft 14），演化图 B 轴从 bp1118 五墙换为 Arena Plackett-Luce 尺，并补入 5 枚多样性包；人类替身新增规则理解型（默认仍 legacy）。

- **人类替身**：`tools/human-pool.mjs` 新增 `makeRuleHuman`（穿反弹/留珠兑现/开局憋环/按威胁排名/残血摄魂与穿透），`probe-diff-ladder --surrogate=legacy|rule`（默认 legacy，旧读数不变）。真机 9 局基线：人类 P1 4/9 胜，而同桌 AI 聚能环 0 次、枪 218 次——旧替身失真的直接证据。
- **池 20→22**：`OBS6P9-S4000` 入 hard（bpM +0.0847，10r X4m 0.140 / X4l 0.272；seatKill=3，按"点名越过"入池——**该条待用户确认**），`RING-MINIT-CONT` 入 soft（全门 pass，A短 0.298/A长 0.236，珠闭环 73.8%）。bundle 6728 KB；D234 通过（22 枚，0 未量自动成员，4 枚人席未量）。
- **B 轴换代**：`b-arena-pl-1118`（24 锚 PL 联盟、双程 176 局/包、全图 980 包）成为 current；与 5 席桌战真值 corr **0.628**（旧 bpM 0.537）、与 A 轴正交 **0.010**。bp1118 转 reference；viewer 默认桌形切 long，trends 短长分列。
- **5 枚入图**：DIV-V3-PRESSURE-S2 / DIV-V3-ANTIDEF / DIV-LH6-HEAVY-S2 / RING-MINIT-CONT / P9-CN-MINI-CONT；map 999 包，`rebuild-map` 100 PASS。
- **口径说明（重要）**：B 轴 Arena 是**纯贪心 ε=0**（`policyChooserN(params, 0.15)`），不是实机剂量；因此 `P?R` 列不再是 page dose，Δε 的配对半边不存在，viewer 对 arena / bp1118-long 显示"未测"（是缺数据，不是零）。
- **已知边界**：rule 替身下 multi 仍是 困难 18.7 < 简单 21.0 < 普通 21.3（普通档最软，只修好了困难）；`page/coords.tsv` 仍 994 行，5 枚新包只在 coords-view / 页面里。
- **版本**：`v2.1.2 → v2.1.3`。

## v2.1.2 — 11-18（**池 hard 补到 7 枚：8 人局 7 席可全不同**）

**这一版是什么**：只动池分带；规则、权重、2P 收缩都不变。

- **hard 6 → 7**：补 `MX8-TN35-KL3`（C̄ .20）进 hard，soft 13。用户裁定：8 人局有 7 个 AI 席，而 `js/pool-draw.js` 的单带 `compose` 是洗牌后**不放回** ⇒ 6 枚必然出现重复，7 枚才能 7 席全不同。
- **候选实测**（`probe-pool` 人类六原型均值，40 局 × 2 seed，越低=越强）：A(+TN35) multi **2.68** / long **4.11** ‖ B(+TF15) **1.96** / **6.25** ‖ C(+CN-M) **4.46** / **6.61** ‖ D(+TN35+TF15) **5.00** / **8.93** ‖ soft13 **11.25** / **14.64**。选 **A**：long 侧最稳、且 TN35 是 C̄ 第 7 名（0.20，下一位 0.19）。
- ⚠ **阶梯仪的读数与 band 仪相反**：同批 `probe-diff-ladder` 3000 局/档给 简单 17.7 / 普通 19.1 / 困难 19.6（"简单最硬"），加 TN35 前后都如此 ⇒ 判定为**阶梯尺本身的问题**（人类替身在强 AI 互斗时更容易捡漏），不是切点；带强弱改以 band 仪 + 8P 全不同为准，阶梯尺重做列入 HANDOFF。
- bundle 重烘 6071 KB，`rebuild-map` 100 PASS；版本 `v2.1.1 → v2.1.2`。

## v2.1.1 — 11-18（**2P 终局收缩同起点 45 + 池顶 6 切带 + 8 人桌日志常驻**）

**这一版是什么**：三件用户裁定的产品改动 + 一次池重切。规则只动了 2P `standard` 的收缩起点（指纹 `214a614a → 4fcadaad`；中间因版本注释重打变过一次，最终以 4fcadaad 为准），冠军权重一个字节未动。

- **2P 终局收缩（用户裁定「2P 也和标准一样开」）**：`standard` 补 `suddenDeath: 45`（与 `multi` 同起点；此前吃全局 100 而回合上限 60 ⇒ 一局里永不触发，2P 可以拖到上限比血、同血平局）。同步 `docs/RULES-2P.md` §1/§8 与 `docs/RULES-NP.md` N26；新增 spec **R71**（第 44 回合末不扣、第 45 回合末扣 1）；2P 考卷 **98.37%** 与修前逐位一致（20 基准 × 40 局），两个线上 bundle 的 `rulesFingerprint` 已重记为 `17dcd585`。
- **池重切**：按 mixed 复合 C̄ 的**顶 6 自然断点**（0.25 → 0.20，全池最大间隙）把 20 枚切成 **hard 6 ‖ soft 14**（原 9/11，`MX5-GD-LE40`/`MX6-GD-TF15`/`TZT2D` 下调 soft；v2.1.2 又补 TN35 到 hard 7 ‖ soft 13）。band 仪（`probe-pool` 人类六原型均值、越低=越强）：hard6 multi **2.73** / long **6.54** vs soft14 **13.57** / **13.09**（旧 9/11 是 4.53/8.68 vs 12.27/9.52 ⇒ long 侧两带间距 0.84 → 6.55pt）。bundle 重烘 6071 KB，`rebuild-map` 100 PASS。
  ⚠ 已知边界：难度阶梯仪（`probe-diff-ladder` 2000 局/档）同一天仍量不出三档有序（默认脚本席下"简单"反而最硬；关掉脚本后 hard 17.3 < easy 18.2 < regular 18.5 也只差 1pt）——重切解决的是**带强度间距**，阶梯残余翻转在脚本席（`st:mix`/`st:toolkit`）与剂量，下一班再调。
- **8 人桌日志常驻**：≥6 人时日志并入对手栏、整列 sticky 在视口内，对手卡压紧；1366×768 实测日志 492–642（修前日志顶 675 = 折叠线下、页高 1176），对手栏**不加滚轮**（用户裁定）。2–5 人桌布局不变。
- **版本**：程序 `v2.1.0 → v2.1.1`（用户裁定：这次走 2.1 线的小版本，不跳 2.2；规则文档版本仍是 v2.1.0）。

## v2.1.0 — 11-17（**冠军池换代：17 枚实桌两带 + 家族按训练方法合并 + 图数据管线**）

**这一版是什么**：不换规则，只换产品侧冠军池与出图口径。池从 31 枚收敛到 **17 枚**（hard 8 / soft 9），全部 `promote=pass`；hard 桌对外部参照 C̄ 0.1314 vs soft 0.2045（7AI 整桌差 0.0731，long 0.1065）。

- **池**：补齐全 21 枚池/代表的 90210/90211 人席与 `--dry --support=2` 体检；踢出未过线/低广度/踩线旧包；`MX6-GD-TF15`、`MX5-GD-LE40` 上调 hard；`DEF-s16`、`MSB11-R1S130778313` 保留 soft。T1 覆盖 15/17（88.2%）、T2 6/17（35.3%）；除无教师 `purify` 外 29/29 可训技能有载体。
- **家族**：24/25 收容所修复；GD4-RATION 并入 fam19（消掉单包族 fam20），原 fam21–26 顺次减一为 fam20–25；V3a/V3b/V3S2/V3H3/B2 归 fam24（5 枚）；MX1–MX8 按训练方法合并为 fam25 `obs6.5 键道/覆盖训练`（15 枚）；fam23 保留统一单包/基座（15 枚）。`add-point` 按 id 前缀自动归族，不再把所有 MX 塞进统一族；同时以 registry 为单一真源校准 `lineage.tsv`/`lineage-g3.tsv` 的 fam/famLabel（修正旧 v7 被折进 fam8、fam11 只剩一枚 synthetic 的错位）。
- **图/管线**：`pipeline-audit`、`sync-page-coords`、`attach-exam4n-mixed`；`rebuild-map 100 PASS / 0 FAIL`；bundle 5266 KB。
- **版本**：程序版本 `v2.0.9 → v2.1.0`（池换代是玩家可感知的新东西，按版本规则走次版本；规则集仍是 v2.1.0）。

## v2.0.9 — 11-15（**规则边界修复 + 2P/UI 收口**）
- **规则与产品侧联动收口**：
  - **镜面复制 & N6/N9/R65 边界对齐**：`resolve.js` 修正 `R.CAT.DEFENSE`（镜面复制防御类不再误走攻击分支/二次发 `mirror` 事件）；`bigTBan` 记录原技能 `mirror` 而非复制产物；大雷连带先检查第三方承伤者 `rodGuard`（免疫 2 电与禁用并消耗避雷针，发 `rodBlock`）；镜面复制 `ring` 保留 `ringStreak`；多人 `chains` 改为双向追加而非覆盖；`金刚盾反击` 与 `挑衅违约` 走 `rawDamage` 参与 `铁索连环`；`roundTaunts` 迁至 `state._roundTaunts`；同步更新 `RULES-NP.md`（并纠偏镜面复制双枪 `pri 3` 文案）与 `RULES-2P.md`。
  - **产品与工具修复**：修复 `rules-panel.js` 小雷/挑衅 FAQ 过时描述；`ui.js` 悔一步保存/恢复 `mulberry32` RNG 状态、脚本风格放开 6/7/8 人上限（切包档时自动同步降回并重开）、修正 `ban` 豁免名单日志文案；`evo.js` 多目标第二目标随机兜底并删嵌套重复 `setSeatGames`；`trainer.js` `quickEval` 补齐 `tankline`；`train-server.mjs`/`knob-guard.mjs` 修正迁移后 `training/server` 默认路径；补全 `tests/spec.js` 6 条回归并更新内置包 `rulesFingerprint` 为 `1e59bb28`。

- **规则引擎三处边界修**（`js/core/resolve.js`；均有回归用例，`spec 71/71`）：
  - **大雷禁用覆盖多人专用卡**：`bigTBan` 删掉 `R.MULTI_ONLY` 整类跳过 ⇒ 双枪/镜面/全息被大雷命中后按 R29 禁用 3 回合（豁免名单仍只有 防御/反弹/金刚盾/ジ + 小雷）。
  - **大雷连带的"自指防御族"照常判定**：八卦/原型/全息没有作用目标可承接 ⇒ 连带 2 电落到防御者本人并按 R28①/R23' 判定/禁用；有目标的藤甲/金刚盾仍按 N22c 转给其目标。
  - **作废的无极变速不再留下下一回合八卦**：`setVoid` 补回滚 `guardNext`（快照 `ea.act.guardNextPrev`）⇒ 被激光眼作废的变速不再白送一次八卦阵。
  - 规则指纹换代：`120fca4d → f7f457d3`（`node tools/rules-fingerprint.mjs`）；按用户 2026-11-15 裁定"这批规则对实战影响不大，不重跑全图成绩"，**未重跑 12 线/全图**；2P 槽按 `promote-champion2p` 重测（20 基准 × 40 局 **98.37%**，与修前逐位同）并记新指纹，3P 槽只刷 meta 指纹 + `fingerprintRefresh` 留痕（权重逐字节未动）。
- **冠军包校验补权重**：`policy2.js` / `policy.js` 的 `checkPack` 现在要求每个权重是有限数值；全 `'NaN'` 的包此前会 `checkPack {ok:true}` 并静默把 AI 退化，现在按 `weights` 拒绝，导入提示补一条中文原因。
- **2P 本机包/池的优先级修正**（用户 11-15："所有'现役'都作废，永远只用池，只有手工载入包的时候用"）：`champForCount(2)` 只在 2P/3P 槽是 **local**（手工导入）时才压池；内置 2P 包退回"池失效时的回退单包"；`poolPlan` 接受 `local·回退(2P 槽空)` 前缀 ⇒ 手工载入的 3P 包在 2P 桌也会生效（此前被内置 2P 与池盖掉）。README:19 的键名与语义同步改正。
- **对局页小修**：
  - 2P 单席不再每局误报"⚠各席全同：该档成员不足"（`allSame` 是 1 席的数学必然，与 `champForSeat/aiInfo` 同判）；
  - 双枪/镜面的第二目标进回合行与导出（`→玩家2、玩家3`）；
  - 「导出冠军 JSON」按当前桌面槽导出（3P 桌不再拿到 2P 包），文件名带 `2p/3p`；
  - 结算路径加 `battleFatal` 兜底：AI 选择/结算任一步异常都会解锁并给"开新对局"出口，不再永久卡在"正在结算"；
  - `loadMultiChamp` 的 `P.loadGame` 进 try；评测标题的脚本数改为现读（不再写死 8）。
- **文档/读数漂移**：`index.html` 静态按钮"40局"改为由 `EVAL_GAMES` 现写；`bots.js` 的池枚数注更新为 18（hard 9 ‖ soft 9）。
- **2P 池方向不变**：仍按 11-13 裁定使用统一池；本批不换成员、不退回单包。2P 考卷暴露的"同一包在 2P/8P 行为差异"按 2.0 的多环境训练目标继续推进（后续训练线），不在本批用回退解决。
- 验证：`spec 71/71`；本批未推送。

## v2.0.8 — 11-15（**`obs6` 冠军入池 + 结算优先级对齐 + 长程/电磁炮训练基建**）

- **引擎与规则对齐（`3a32e551`）**：修复地雷/镜面/避雷针/回合末死亡结算优先级并更新规则指纹；`spec` 用例增至 **68/68**，重测内置包与门禁夹具。
- **冠军池与演化图更新（`a30f1098`、`48f93700` 至今）**：移除未判定三无成员 `WSEL9-200`，新晋三枚 `obs6` 冠军包（`OBS6E9` / `OBS6P9-S4000` / `OBS6P4-S4000`（`KD-G2 invited`））入 `hard` 带、线上合并池重烘为 **18 枚** `{hard 9, soft 9}`；蒸馏中间底座 `OBS6-LH6` 与长程代表 `OBS6-LH6P`（`S=2.12`、3/4 类满长程花珠、`mem-probe-e6 Gap -3.4pt`）双双入 `champion-map`，串成 **`OBS6E9 —> OBS6-LH6 —> OBS6-LH6P`** 实线谱系（`seedpack-wid`、`shot.mjs 100/0`）。
- **训练与入图工具链增量（`e3bec149` 至今）**：`supfit-gd.mjs` 新增 `--rolloutMode=step|game` 与 `--classPow` / `--classCap`（抑制极稀疏键 `1/class` 权重冲垮强攻防底座）；`pg-train.mjs` 新增 `--lamExp` 死珠过期定向惩罚、多键加权 `--shapeKey` 及 `--penDeadElec`（保留 `ep=2` 爆珠激光眼的同时单向惩罚死胡同 `ep<3#elec`）；`champion-map/pipeline/add-point.mjs` 支持 `--parent=<id>` 与跨未入图中间包多跳 `hotstartFrom` 回溯、`measure-point.mjs` 新增 `--reuse` 子产物缓存跳过与外部 `--readings=`/`--display=` 复用；`knobs.mjs` 旋钮精简至 193（在用 183）；白班长程与电磁炮排查交接见 [STATUS-2026-11-15-day-longhorizon-zcode.md](docs/research/STATUS-2026-11-15-day-longhorizon-zcode.md)。

## v2.0.7 — 11-13 夜（**规则文档对齐 + R66 过载炮编号化 + 量具/门禁收口 + 训练基建**）

- **规则文档对齐两处（代码自 2026-09 起即如此，本次只改文档——"先文档后代码"的文档补课）**：
  - **R49（回魂唯一性）**：旧句「复活回合再触发 ⇒ 状态重置重新判定」描述的路径在引擎里不可达（复活回合 `infiniteEnergy` 使回魂触发检查的 `!infiniteEnergy` 永假，`checkOver` 亦把该席视作存活）⇒ 按 2026-11-12 用户裁定改写为「回魂每局至多触发一次」；`tests/spec.js` 补钉行为用例（复活回合再挑衅并死亡 ⇒ 不再复活）⇒ **spec 64/64**。
  - **N20⑥（地雷转移）**：文档旧句「不会被转移伤害转移」与 v1.5.136 N6 用户裁定（非当回合埋的雷其波可被【转移伤害】单跳转走）矛盾 ⇒ 按 N6 对齐（2026-11-12 用户授权自选，取保留实现：与 R63「转移不在乎来源」同族）；顺带清掉该节陈旧的「实现要点（待做）」块与漂移行号。
- **过载炮 pierce 平衡研究**（用户 23:5x 勘误「机制不动」后降为研究题）：双沙箱同种子配对实测（`scratch/zcode-1112-research/cannon-study.mjs`），结论 = **建议保留 `pierce:{defense,reflect}`**（去 pierce ⇒ 被剑/坦克/狙击严格支配：纯防御墙 150/150 胜 → 0/150 自伤致死；原型制御/八卦对炮的既有答案不变；三段循环 φ3 清 ep 实测 28 次均 3.3 ジ）。全文 `docs/research/FINDING-2026-11-13-cannon-pierce-zcode.md`。
- **R66 落地（2026-11-13 用户裁定「过载炮保留」）**：v1.3.14 的"新规"句补上裁定编号——`RULES-2P` R15 矩阵加炮行（防/反/藤 P，八卦 J，原型 B，可转移）+ §过载炮 R66 条目；`rules.js` desc 勘误（「失ジ」=使用者付光全部ジ的费用而非效果；φ3 **清空目标全部ジ** desc 原漏写；pierce 口径写全：藤甲同穿、金刚盾跳反击、原型/八卦照常）；`tests/spec.js` 炮用例扩 4 钉（藤甲同穿 ‖ 原型照挡 ‖ 金刚盾跳反击 ‖ 八卦双向照判 seqRng 钉死）；`v2v4-lib.mjs` pierceDef 校验无需改（`pierce.defense` 表驱动 + CANNON 硬编码的既有形态已对）。**desc 动了 `rules.js` ⇒ 指纹换代**：两线上槽按 v2.0.6 先例重测考卷 + 新指纹记回 meta（3P 走 `promote-champion`，2P 走 `promote-champion2p`）。
- **门禁/量具收口**：
  - `gate-all.mjs` --auto 摘除训练侧死路径（`tools/(train-3p|train-best)`；11-13 用户裁定：训练侧门禁不进主门禁/CI ⇒ `training/**` 落 meta 是**有意的少跑**，注释已写明）；`js/train/`、`js/bundled*` 产品面 probe 路由保留。
  - **D191 四条未登记重复补账**（MSB15R-gd4keep ×2 + gd4rat ×2 的 band 夹具同批副本）：孪生体逐条定位（band 产品 .bak ↔ night-adapt 副本，mtime 相差几十毫秒 = PROBLEMS #9 的形状），按 `pack-aliases.tsv` 既有 train-3p 形态登记 ⇒ 门绿；**根因（train-3p 收尾 widIndex 进程内一遍）未修**，每批臂复发一次的账仍在。
  - 口径数对齐：门总数 171/173 → **172**（np-test 头注 + PARTS 三处注释 + gates/README + gate-all 头注）；spec 用例数 52/55/61 → 现读（`tests/RESULT.txt` 记沿革）；CI 矩阵注释（16/19 路 vs 实际 11 路）未动。
  - `knobs.mjs --check` 补「**在用但无注解**」拦截腿（AGENTS.md 铁律 1 的执行缺口：此前只拦无登记）+ `train-3p.mjs` SELF_ENV_KEYS 14 行无注解键逐键补注（语义逐一查过读取点）⇒ 册重生成，--check 绿（无注解 0）。
- **训练基建（msbatch2 段内选粒）**：臂候选从 {final} 扩成 {final + BAND_DIR 下的 segK 快照}，argmax C 选臂冠军（并列取 final > 高 seg）；exit=9 臂走 seg 候选、seg 全无才父代顶替。⚠ 首版实现拿 `OUTDIR`（=night-adapt）探 seg 而探空、静默退化成旧行为（MSB16/MSB17/MSB16T 三跑实锤后自抓：**seg 与 final 分家是 train-3p:2428 的既有设计**，seg 按 `BAND_DIR_NAME` 落 `docs/artifacts` 根）——已修为 `EPIRUS_BAND_DIR || 'docs/artifacts'` 对齐 `train-3p:2498`。
- **训练读数（全部在新臂上现测）**：
  - **蒸馏三线全部过 mastery 预注册尺**：GD4-BIGT（电磁炮 ✔）/ GD4-RATION（环 ✔ 3 段三连）/ **GD4-LASER（新蒸馏：激光眼 ✔ 560%/局、打防席 506/506）**。
  - **多线保持 = 负结果**：GD5-R14RAT（ration 教师**叠加蒸馏**在 R14 产物上）环 ✔ 3 段三连但 **bigT 被洗掉（540% → 0%）**——蒸馏重写键层，naive 叠加不是解；R14 产物（bigT ✔ + railgun ✔）仍是「两条同时保住」的现役答案，ring 第三线保持开放。
  - **lasereye GA 线 = 量换语义**：MSB17 换代冠军（C -0.319 → -0.227）激光眼 922%/局但打防席 272/820 = 33% < 50% ⇒ mastery ✘（与 R15 同形状）。
  - **B 轴双夹具记数（单包，信息量小）**：MSB17 冠军 B X̄₄ F2 = -0.299 ‖ F3k2 = -0.304（Δ≈-0.004；与 30 枚样本的整体 -0.089 偏移方向不一致，只记数）。
- **2P 桌切统一池（2026-11-13 用户裁定「2p 直接切到统一池」，考古结论同条末尾）**：页面 2P 槽（`POOLS.p2` / `EPIRUS_CHAMPION_POOL_2P`）退役删除，两桌读同一份 `js/bundled-champion-pool.js`；`js/bundled-champion-pool-2p.js` 删除，`index.html` 挂载点移除。旧 v7 名册 `champion-map/pool-members-2p.tsv`（hard 5 ‖ soft 4）**转任 2P 训练对手名册**（`EPIRUS_POOL_OPPS_TABLE` 指它，不再喂页面）——「桌上是谁未同步」的账由结构性统一清零。连带：`POOL-CONTRACT §9` 整节改写（§E599 旧制留档 git）‖ `ship-pool ⑬b` 改钉主表同源 ‖ `probe-diff-ladder` 表选择统一 ‖ `battle-test` 2P 来源判据不变（本来就钉实质）‖ 旋钮注解更新 + 册重生成。考古结论：难度阶梯早已同步主桌（v1.6.5/66）；「桌上是谁」未同步——2P 原生池 7 枚 v7 + 2 枚邀请成员（10-21 换代），主池 2.0 包有 P2 读数但从未上 2P 桌。
- 收工交接：`docs/research/STATUS-2026-11-13-night3-zcode.md` ‖ 研究计划与执行：`docs/research/PLAN-2026-11-12-night3-zcode.md`。

## v2.0.6 — 11-08 深夜（**引擎规则修**：地雷不再因雷主死亡而静默作废；用户裁定 2026-11-08）

- **实机 bug**（results/2.0 的 27回合局 r17）：玩家埋雷同回合被 枪×2+狙击枪 击杀，雷没响。四局对账：只有「踩雷那一下恰好致命」的雷会哑火。
- **根因**：N20 延后引爆（踩雷只标 `_minePending`，全部伤害结完才统一引爆），而 `mineResolveAll` 第一阶段私加了 `hp > 0` 守卫 ⇒ 雷主死于踩雷那一跳时 pending 被静默丢弃。N20① 文义触发条件只有「非狙击枪攻击**且伤害落到他身上**」，"存活"限定的是被波及那一侧；间接侧（N20②）同守卫同病。
- **修**：删两处 `hp > 0`（直接触发 resolve.js mineResolveAll 阶段一 + 间接触发收集处）——雷主死了雷照炸；被雷波炸死的雷主同样链爆。
- **验证**：最小复现（hp=1 + armed + 一发枪 ⇒ 旧：无 mine 事件/枪手满血；新：雷炸/枪手 -1）；spec **63/63**（新增 N20①a 直接触发 + N20②a 间接触发两条用例）；probe-instruments 33/33；ship-feas 14/14。
- **规则指纹**：e61790e8 → **da113550**（训练侧内存补丁类旋钮不受影响；在册包 META 的 rulesFingerprint 记账本就漂移（e61790e8 ≠ bundle 里的 ebdbff36），bundle 批量刷新留待下次出厂统一做）。

## v2.0.5 — 11-08（2.0 线「强 vs 过线」诊断 + 考卷第 5 格 + 保真闸行为项 + 进图三步；规则与引擎一字未动）

- **诊断（核心发现）**：2.0 线的高分是**反射墙**刷出来的 —— `CTRL2-Q-s7`（X̄₄ 0.427）对 4 个只攒钱脚本 reflect 91%、伤害 0.30/局、清场 **0.00**；
  `PASS2C-Q-s13`（**0.523**，全库最高）伤害 **0.00/局**、47 回合五人一起被终局收缩磨死判平。对照 v7：Q-s47 伤害 6.00/局、清场 2.91、12 线 nFail=0。
  ⇒ 「强度」与「过线」在 2.0 这条线上被两种桌面分开了；考的 28 个脚本全都会打人，反射墙天然占便宜。
- **考卷第 5 格**：新增 `tools/exam-fb.mjs`（场A 还手 / 场B 清场 / 对农民桌胜率，与 `feasibilityOf` 同源，直接调 `aggressionProfile`）。
  口径记档：门里的场A/场B 实际在 **long 桌**上量（同包 multi 0.64 vs long 0.09，`--mode=long` 与门逐位一致）。
- **池 23 枚全量过门**：只有 4 枚过线（X̄₄ 0.117~0.181，都是弱批）；强的 3 枚（DSTR4 0.215 / POPP 0.214 / PUSHON 0.197）卡在**广度 G 1.0~1.9**。
- **蒸馏保真**：KD-Qg（Q-s47 蒸馏、未 GA）场A 34.8%→18.6%、场B 2.91→0.00；逐键同键率 sword 72~93% / guard 53~85% / ji 62~66% / **gun 15%（400 步）→50%（2000 步）**。
- **四臂**：PASS2C（0.523，龟壳）‖ GATE3C（0.422，2P 塌）‖ KRP（0.198，场A 28.7% 修好、场B 0）‖ **KRF（0.252/0.313，场A 29.3% ✔、场B 0.09、12 线只差 1 条）**。
  前沿：**PASS2-Q-s13 仍是最接近「既过线又强」的一枚**（12 线 nFail=0、X̄₄ 0.24）。
- **进图三步**（METHODOLOGY 146）：侧车 `lineage-g3` → 全表 `proj-tsne` 重投影 → `attach-projcols` + `viewer` 重烘；本次 890 行（kNN@10 0.459）。
  补齐 `KD-Qg` / `KD-K2-l` / `KD-K2` 三枚节点；夜班 4 条父边按权重升级成 `seedpack-wid`（图上有父边 47 条里不可证的 14→10）；
  `V7C/V7M/V7L` 六枚（v:7 架构的 GA 对照臂）家族标签改正（fam 15 扩注，不再读成 gen-3/2.0 臂）。
- **修 intake 列错位**：`intake-rows.mjs` 把 N 当数组下标 ⇒ 3 枚候补 P2 写的是 5P、P3 写 8P、P5/P8 空（已修数据 + 根因）。
- **保真闸加行为项**（METHODOLOGY 147）：分数 ‖ 防御占比 ‖ 场A/场B/农民桌胜率各 ≥0.8×教师。
- **D191 收口**：夜班 34 条未登记重复粒进 `dupes-manifest.tsv`（meta 15/15）。
- 详情：`docs/research/RESULTS-2026-11-08-2p0-strength-vs-gate-ds.md`。

## v2.0.4 — v1.8.40 归档摘要（11-07～10-27）

- 本区 8 个版本的逐字正文已收录于 [`docs/CHANGELOG-archive-2026-11-08.md`](docs/CHANGELOG-archive-2026-11-08.md)：v2.0.4 / v2.0.3 / v2.0.2 / v2.0.1 / v1.8.44 / v1.8.43 / v1.8.42 / v1.8.40。
- 根文件保留当前版本与后续逐版记录；历史逐字读数请查归档或 git 历史。

## v1.8.39 — 10-27（千问夜班 + DS 早班）：训练侧两根新旋钮（X1 桌形 ‖ 破反弹墙奖励）‖ 激光眼线 36 臂的总账 ⇒ 参数空间用尽

- **触发**（用户 10-26 00:2x 给的四条口径）：「要有激光眼（很少都行）‖ 没有短板能上线 ‖ 强度不掉到 soft 带中游以下 ‖ 珠浪费 <50%，且不能是靠疯狂蓄能刷出来的」。判据与线钉在 `docs/research/PREREG-2026-10-27-laser-noshortboard-qoder.md`（§一~§二十三，**每节先于开臂落盘**）。
- **两根新旋钮**（都在 `js/train/evo.js` + `tools/train-3p.mjs`，**默认关 ⇒ 历史臂逐字不变**）：
  - `EPIRUS_FAMILY_FIELD=<k>`（X1 桌形 · 夜班）：每局在**非受评席**里选 k 席跑"被测同一个 `params` 的副本"，其余仍是脚本对手，**必留 ≥1 席外部人**，席位按 `(g+gen)` 旋转。家族席不吃 econ 包装、不消耗脚本轮换索引。CLI 照 `KILL_FIELD` 先例：非整数 `exit 4` ‖ 读回不一致 `exit 7` ‖ 作用计数 0 局或只落 1 席 `exit 8`。剂量轴实收：**k=1 不关任何门 ‖ k=2 更差 ‖ k=3 关掉 G4/G5 但广度/经济塌** ⇒ 这条轴封顶在 1 席。