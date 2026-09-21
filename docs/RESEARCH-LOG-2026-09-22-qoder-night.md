# RESEARCH LOG · qoder 夜班 2026-09-21 夜→22 早（分支 `qoder-explore-0921night` · 基于 main@c3c00fa=v1.5.147）

> 用户指令（09-21 22:5x）：**推到 09:00 停工**；开分支自主探索 + 跑长时训练；
> 动因之问："tgt-44 就算 2P 调得再好，**打 5P 局又怎么样**？5P 门一大堆（今天下午刚加电磁炮 0.35/局 行为判据、广度两模式都判）。"
> 本文件是**防失忆日志**：每完成一格就更新 DONE/DOING/NEXT，带时间戳；上下文被压缩后从这里续接。

## 0. 状态灯（最后更新：09-21 23:1x）

**DONE（本夜之前 · 摘要，详见 CHANGELOG v1.5.146/147 与 RESEARCH-LOG-2026-09-21-qoder.md）**
- 审计复跑全绿（spec 52/52 · np-test 160/160 · smoke/battle OK）；v1.5.146（D95 去 spawn/D113 unpack 守卫/README）与
  v1.5.147（择优 hill05→distinct→divNorm + 带内全落盘 + D104⑦⑧⑨）已提交并**推 main**（`c3c00fa`）。
- E1-E3 探针（docs/debug/night-probe-*.cjs/mjs）：3P 现役包 2P 对决 0-120；ε=0.2 soft 下 2P 对决被先手座主导(~85%)；
  特征面 60 维在 2P 恒死（但"输入休克"非主瓶颈——tgt-44 同几何 120-0）。
- **tgt-44 = "3P 血统可移植进 2P" 首个正例**；热启动微调臂 xfer44（seed4 选种类2/候选3 种类5 未留存=旧代码）与
  xfer44b（seed5 全员窄体、带=1）⇒ 微调可复现（120-0 + 四脚本 100% 含 cc），**广度要靠种群重掷**。
  产物点名（D82）：`v7xfer44-2p.bak` `v7xfer44b-2p.bak` `v7xfer44b-band1.bak`。

**DOING / NEXT（夜班队列，按序）**
- [ ] **N1** tgt-44/xfer44 家族的 5P 全门成绩单（回答用户之问）— 预注册见 §N1
- [ ] **N2** xfer44 种群重掷循环（seeds 6..13 · 新 band-save 留住广员）— §N2
- [ ] **N3** 广员候选复评（H2H + 2P 广度 + 5P 门 dry）— §N3
- [ ] **N4** ε 长程口径全扫（0.1/0.15/0.2 × mixed/long 两场 · 昏手/防御/镜像/电磁炮）— §N4
- [ ] **N5** 老包 2P 移植普查（高 G 包 ×16 找第二个 tgt-44）— §N5
- [ ] **N6** 跨 N 混适应度（若时间够 · 只走 default-off env + 断线不碰线上口径）— §N6
- [ ] 09:00 前：写早报（结论/裁定件清单/产物点名），停在干净状态，不合 main。

## 1. 夜班规矩（沿用仓规 + 用户本夜指令）

- **槽位冻结**：`js/bundled-champion*.js` 一律 git 还原到 main 字节；train-best 直写槽 ⇒ 每次臂跑完立即 `.bak` 点名 + `git checkout --`。
- **不合 main、不 promote**：夜里只推 `qoder-explore-0921night` 分支；一切"上线/换包/改判据"= 早报里的裁定件，等用户。
- **不碰指纹五件套**（rules/state/resolve/play/policy）；碰 evo/tools 的改动必须 **default-off**、np-test 全绿才提交。
- **预注册跑前写死**；否证照记。产物 `.bak` 点名进本日志（D82；D82 门只查 CHANGELOG —— 夜产物不写 CHANGELOG 也行？
  ⚠️ 不行：D82 是 24h 窗口全目录扫 ⇒ **夜里的 .bak 必须同步点名进 CHANGELOG 的"夜班进行时"条目**，见 §登记簿）。
- 后台任务判活 = 标记文件 + 实测 PID；轮询不写进 tool call。
- 18 核：训练臂与评测**不并发**（臂占满 worker 时评测排队）。

## 登记簿（夜产物点名 · D82 用 · 全部 gitignored）

| 时间 | 产物 | 臂/用途 |
|---|---|---|
| （沿用）| v7xfer44-2p.bak / v7xfer44b-2p.bak / v7xfer44b-band1.bak | xfer44 两跑 |
| N2 起 | v7xfer44c{6..13}-band*.bak 等 | 种群重掷 |

## §N1 tgt-44 家族 5P 全门成绩单（预注册 · 跑前写死）

对象：`docs/artifacts/v7tgt-44.bak`、`v7xfer44-2p.bak`、`v7xfer44b-2p.bak`；参照：现役 `js/bundled-champion-3p.js`。
量具（全部 ε=0 门禁口径）：`promote-champion.mjs <pack> --dry` 全套（五道门 + G4/G5 `GATE4_GAMES=120` + 电磁炮 0.35/局 行为档 + 两模式广度）。
判据（**只是报告，不 promote**）：
- ① 记每包：可行性五道 过/挂哪道；G4 两模式最克格 %；G5 %；电磁炮/局（long 20 局自对局）；蓄能/局。
- ② 结论问题："微调后的 2P 强者回 5P 还过门吗？tgt-44 本来过不过？" —— 若 xfer44 挂门而 tgt-44 不挂 ⇒ "2P 微调是 5P 门上的代价"，量到代价多大；反之 ⇒ 家族全能，早报告"2P 槽有真候选 + 3P 槽可议"。
- ③ 数字全录 §N1 结果表，**不许只写"过/不过"**。

## §N2 xfer44 种群重掷（预注册）

配方：`EPIRUS_ARM=v7xfer44c<seed> EPIRUS_SEED=<seed> node tools/train-best.mjs 3 500`，HOT=tgt-44 换槽法（每次跑完还原）。
seeds：6,7,8,9,10,11,12,13（8 掷 × ~8min ≈ 70min）。
判据：
- ① 每掷记录带内各粒 `种类/hill05/avg/H2H`（H2H 只对种类 ≥4 者跑，省时）。
- ② 若出现 **种类≥5 且 avg≥98%** 的带内粒 ⇒ 它进 §N3 复评（这就是"2P 又强又宽"候选）。
- ③ 否证分支：8 掷全部 种类≤3 ⇒ 记"2P 域内适应度天然收敛到窄体；广度必须靠 fit 项（EPIRUS_DIV_W 进 2P 侧）或教师"，交早报裁定，不再滑 seed。
- 副产物：若 `EPIRUS_DIV_W` 确认能进 train-best 的 fit（跑前查证 econ-env 接线），追加 1 掷 DIV_W=0.6 对照（写进 §N2b）。

## §N3 广员候选复评（预注册 · N2 有产物才启动）

对每个"种类≥5"带内包：ε=0 H2H 120 镜像 vs 现 2P 冠军；四脚本席；`--dry` 五道门（它们不是 3P 包 ⇒ 只跑 2P 考卷 `promote-champion2p` 的只读部分或等价）；2P 决策态出手画像（E3 法）。
判据：H2H 胜差 >0 且 cc>50% 且 种类≥5 ⇒ 早报列"2P 槽候选"（仍不动槽）。

## §N4 ε 长程口径扫描（预注册）

`behavior-profile.mjs --field=self --gamemode=long --eps=0,0.1,0.15,0.2 --epsmode=soft,uniform --games=20` + `--mirror`。
判据：只报告不改线上 —— 表 = 每档 (防御%/环%/集火%/昏手/局长/电磁炮·镜像破局)；若 ε=0.15 在 long 口径复现 mixed 的"昏手最低+镜像 100%"⇒ 早报提请"0.2→0.15 一行改"裁定件；否则记"甜点不跨场"，指向 NEXT-2 预算制。

## §N5 高 G 老包 × 2P 移植普查（预注册）

对象：N-已测之外的高 G 家族（seat24/bead25/bead3/t2/new6/f5* 各 seed + tgt 家族全粒）≈ 20 包。
量具：`night-probe-2p-transfer.mjs`（60+60 镜像 H2H + 四脚本）。
判据：记每包 H2H 与四脚本；H2H 胜率 ≥60% 者 = "可移植血统"集合 S ⇒ 早报回答"tgt 是孤例还是血统特征"（S 成员若集中在某配方家族，报配方共性）。

## §N6 跨 N 混适应度（时间盒：仅当 N1-N5 全落袋且 ≥05:30 前）

最小实现路线（default-off）：`EPIRUS_XN_MIX` 解析 `mode:N:w` 三元组 ⇒ evo 训练侧 eval 聚合按权重跑 {multi:5, long:5, standard:2} 三场；零值缺省 = 现行为逐字。
⚠️ 红线：standard:2 场进 3P 臂的 fit 是**口径变更**——夜里只做**实现 + np-test 断线用例 + 一臂 60 代 smoke**（产物 `v7xn-smoke*`），**不产出可换包候选、不 promote**；正式臂交用户 GO。
若实现不能当天 np-test 全绿 ⇒ 回滚改动、只留设计笔记。

---

## §结果登记表（随做随填）

（待填）
