# 2026-11-15 白班交接 —— `obs6` 长程技能与珠经济整治（`ep=2` 保留激光眼蓄能）

> 时区：本机 `2026-11-15 14:25 +08:00` ‖ 接力自：[STATUS-2026-11-15-night-zcode.md](file:///d:/code/Epirus-Web/docs/research/STATUS-2026-11-15-night-zcode.md)
> 完整早/白班发现总录：[FINDING-2026-11-15-day-obs6-longhorizon-zcode.md](file:///d:/code/Epirus-Web/docs/research/FINDING-2026-11-15-day-obs6-longhorizon-zcode.md)
> 铁律：`CHARGE_MIN_EP = 2`（[evo.js](file:///d:/code/Epirus-Web/js/train/evo.js)）未动——`ep=2` 蓄爆珠可合法接 `laserEye`（1 ep + 1 boom），问题只在于夜训包把 `ep=2` 全用来蓄**电珠**（`charge#elec`）导致次回合 `ep=1 < 2` 买不起电磁炮而 100% 过期。

---

## 一、根因与工具链改动（只加 CLI 旗标，未增 env 旋钮）

1. **`supfit-gd.mjs`（[training/proto2/supfit-gd.mjs](file:///d:/code/Epirus-Web/training/proto2/supfit-gd.mjs)）**：新增 `--rolloutMode=step|game`（缺省 `step` 逐字不变；非法值 `exit 2`）。
   - `rolloutMode=step` 下 `TEACHER1` 会在 `ep=1–2` 劫持滚局，使 `GD16m-D1`/`lasereye` 等副教师根本走不到 `ep=3..6` / `ringStreak` / `boom` 轨道（夜里 `OBS6T12` `t2Hits=1`）；改为 `game` 后每局由单名教师用原始选卡器跑完整轨迹，仅在记录期滤除副教师非目标键。
2. **`pg-train.mjs`（[training/proto2/pg-train.mjs](file:///d:/code/Epirus-Web/training/proto2/pg-train.mjs)）**：
   - 新增 `--lamExp=<w>`（缺省 `0`）：按局内 `row.evs` 时序追踪产珠的 `CHARGE`（`delta > 0`），一旦该珠在后续被 `delta < 0` 花掉则清零计数；仅当 `beadExpire` 过期浪费时才对该次 `CHARGE` 扣除 `LAM_EXP` 塑形奖励（`ep=2 -> charge#boom -> laserEye` 零惩罚，直接惩罚死珠 `ep=2 -> charge#elec -> 过期`）。同时修正 `lastChg[e.kind] >= 0` 守卫防止初始 `-1` 误计。
   - 扩展 `--shapeKey` 支持多键加权 `k1:w1,k2:w2`（经 `R.SK` 校验，未知键 `exit 2`），保留单键+`--shapeW` 向后兼容。

---

## 二、实测实验矩阵（B 轴 `OBS6E9` vs 本班 `LH1–LH4P` 系列，未进正式榜）

> 门禁与评测口径见 `seg-eval`（C5/X̄₄/用卡/G_M/G_L）、`chargeProfile`（`ε=0`，40 局/格）及 `probe-bead-loop`（`multi × 60`，`ε=0` 账本 B 与决定追踪）。所有产物留在未跟踪目录 `scratch/arms/`。

| 候选包 | 路线说明 | C5短 | C5长 | X̄₄短 / 长 | 用卡 | G_M / G_L | `long` 花珠 | `multi` 花珠 | `②`买得起没射 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `OBS6E9`（基线） | 夜训高战力冠军，含 `ep=2 -> charge#elec` 病灶 | 0.2165 | 0.2759 | 0.1796 / 0.2290 | 11 | 7.87 / 6.88 | 0/38 (0.0%) | 0/64 (0.0%) | 16.5% (`16/97`) |
| `OBS6-LH2` | 干净底座 `GA2PG-8K` + `game` 蒸馏（剔除 E9 `charge`） | 0.0027 | 0.0331 | — | 13 | 6.67 / 5.99 | 166/209 (79.4% `elec:109/boom:57`) | 83/105 (79.0%) | **0.0% (`0/86`)** |
| `OBS6-LH2P` | `LH2` 接 PG 9000 局（`--lamExp=0.06 --klW=0.08`） | -0.0082 | 0.0226 | -0.0327 / -0.0146 | 11–12 | 4.37 / 4.39 | `long40`: 95/111 (85.6%) | — | — |
| `OBS6-LH2P2.seg1000` | `LH2P` 接 `product` 池 PG（`seg4000+` 后过塑形退化） | 0.0141 | 0.0316 | -0.0284 / -0.0021 | 12 | 5.11 / 4.68 | — | — | — |
| `OBS6-LH3` | `OBS6E9` 底座 + `game` 蒸馏（`LH2P` 任 `T1` + DAgger 1 被稀释） | 0.0451 | 0.0147 | -0.0125 / -0.0161 | 13 | 6.74 / 6.23 | 140/276 (50.7%) | 53/115 (46.1%) | **0.7% (`1/142`)** |
| `OBS6-LH3P.seg4000` | `LH3` 接 `product` PG（`lamExp=0.05`） | 0.0142 | 0.0267 | -0.0773 / -0.0457 | **14** | 6.84 / 6.83 | 205/384 (53.4%) | 76/151 (50.3%) | **0.0% (`0/125`)** |
| `OBS6-LH1P.seg1000` | `LH1` 接高温高压 PG（`temp=0.75, lamExp=0.10`，`2000+` 崩溃） | 0.0731 | 0.0760 | **+0.0261 / +0.0366** | 12 | **7.57 / 7.77** | 98/229 (42.8%) | 42/117 (35.9%) | 8.2% (`6/73`) |
| `OBS6-LH4` | `OBS6E9` 底座 `--dagger=0`（65% E9 无 `charge` + `GD16m`/`lasereye`/`LH2`） | 0.0672 | **0.1117** | -0.0323 / +0.0204 | 10 | 5.17 / 4.94 | 62/102 (60.8% `boom:62`) | 51/100 (51.0%) | **0.0% (`0/76`)** |
| `OBS6-LH4P.seg1000` | `LH4` 接紧锚 `product` PG（`klW=0.06, lamExp=0.05, temp=0.5`） | 0.0651 | 0.0949 | -0.0377 / +0.0088 | 8 | 4.88 / 4.68 | 50/79 (63.3%) | 57/86 (66.3%) | — |

### 核心结论与剩余缺口

1. **珠经济与长程路径已打通**：不砍 `CHARGE_MIN_EP=2` 前提下，`OBS6-LH2` 实现 **79.4%/79.0% 双珠花掉**（`elec:109 + boom:57`、`ep=2` 仅出 `ji:98.7%` 与 `charge#boom:0.9%`），`LH3P.seg4000` 扩到 **14 卡**，`LH2 / LH3P / LH4` 均把“买得起电磁炮却不射”压到 **`0.0%`**。
2. **强度 vs 长程两难尚未完全拉齐**：
   - `supfit-gd` 默认按类频反比（`1/class`）平衡且保留小样本超强加权，即使去掉 DAgger（`OBS6-LH4`）仍会把 `OBS6E9` 的 `C5长` 从 `0.2759` 折损到 `0.1117`。
   - 后续以 `product` 池做 PG：重塑形+高探索（`LH1P`）在 1000 局后用 `charge/ji` 挤掉 `guard` 导致 `C5` 塌缩；紧 KL 锚（`LH4P`、`klW=0.06`）保住了 `63–66%` 花珠率与 `+0.095 C5长`，但不足以把 `C5长` 拉回 `0.25+`。

---

## 三、午后收口：`OBS6-LH6P` 进图 + 激光眼有效率审计 + 鼓励电磁炮模式（`LH8R`–`LH8R4`）

> 时区：本机 `2026-11-15 13:41 +08:00`

1. **`supfit-gd.mjs` `--classPow` / `--classCap` 与 `OBS6-LH6` + `OBS6-LH6P` 串链进图**：
   - 使用 `--classPow=0.25 --classCap=3` 蒸馏出 `OBS6-LH6`（`docs/artifacts/obs6-coldstart/OBS6-LH6.bak`，`ruler H=40 S=1.25`）后接 `product` PG 产出 `OBS6-LH6P`（`docs/artifacts/obs6-coldstart/OBS6-LH6P.bak`，`H=36.8 S=2.12`）。两者已一同入 `champion-map`，在 [lineage-g3.tsv](file:///d:/code/Epirus-Web/champion-map/data/page/lineage-g3.tsv) 上形成直连双实线 **`OBS6E9 —> OBS6-LH6 —> OBS6-LH6P`**（均为 `seedpack-wid`，`shot.mjs` 自检 **100 PASS ‖ 0 FAIL**）。
   - 修复 `add-point.mjs` 只查直接一跳 `hotstartFrom` 导致跨过未入图底座时断成 `unknown-wid` 的问题：新增 `--parent=` 与局部包目录多跳回溯（按 `viewer.mjs` 白名单记 `seedpack`）；`measure-point.mjs` 新增 `--reuse`（命中 staging 子产物即跳过重测）、`--readings=` / `--display=` 复用已有数据与 `--parent=` 透传。
   - **长程 vs 短程 `ring/railgun` 倒挂根因对照**：原始教师 `GD16m-D1` 与 `OBS6-LH2` 本身均符合“5 血长程更敢用聚能环”的直觉（`GD16m-D1` 80 局：`long ring=1108 rail=504` vs `multi ring=844 rail=118`）；但 `OBS6-LH6` 以 `OBS6E9` 为起点且按 `76% OBS6E9 + 14% GD16m-D1` 混合微调后，`OBS6E9` 在 `long` 下的高密度 `ep=2` 消费反射（`snipe/sword/shift`、`ep=2` 仅 `ji:66`）把 `OBS6-LH6` 的 `ring/rail` 挤到了 `multi` 分支（`LH6`：`multi ring=2856, rail=49` vs `long ring=184, rail=9`），后续 KL 锚定到 `LH6` 的 `LH6P` / `LH8R4` 因而延续该模式偏置。
2. **激光眼有效率专项分析（`80g × 5p`, `temp=0.2`, 2026-11-15 口径：命中防御系=1 分，同回合同目标另有其他伤害=2 分，光伤穿命中无防=0 分）**：
   - `OBS6-LH6P` 加权有效率全项过 50%：`long self5` **57.9%**（132/228）、`long prod5` **85.4%**（41/48）、`multi self5` **53.3%**（49/92）、`multi prod5` **59.1%**（13/22）；反观未接 PG 的纯 SFT `OBS6-LH5` 低于 50%（`long self5` 43.9%、`multi self5` 47.1%）。
   - 激光眼远多于电磁炮的根因在于回合经济边界：`charge` 消耗 1 ep 且能量珠回合末清空（[resolve.js](file:///d:/code/Epirus-Web/js/core/resolve.js#L1320-L1325)），因此 `ep=2` 蓄能后次回合只有 `ep=1`——只买得起 `laserEye`（1 ep + 1 boom），买不起 `railgun`（2 ep + 1 elec，[state.js](file:///d:/code/Epirus-Web/js/core/state.js#L155-L157)）；只要 `ep >= 3` 且有电珠，`OBS6-LH6P` 的 `canRail` 实放率极高。
3. **鼓励电磁炮 PG 模式（`pg-train.mjs` `--penDeadElec`）实验结果**：
   - 实现：`--penDeadElec=<w>` 保留 `ep=2#boom`（护住激光眼），单向惩罚死胡同 `ep<3#elec`（`-PEN_DEAD_ELEC`），并将 `--lamC` 奖励收紧到 `bead==='elec'` 的 `ep>=3` 纪律蓄电珠。
   - 混合 `:r1` 补贴桌（`OBS6-LH8R2`、`OBS6-LH8R3`）会把训练集 `炮/局` 拉高到 `0.198–0.204`，但大部分 `ep>=3` 来自规则白送能量；`OBS6-LH8R2`（`mem-probe-e6` `Gap -10.4pt`、`C5短=0.1744 C5长=0.1880`、`花珠率 75.4%`、`G_M=7.77 G_L=4.99`）在 `promote-champion --dry` 上因反弹墙 `0.00`、场A 还手 `13.7%`、无档 G5 `long` `33%` 被阻断，未换现役槽。
   - 纯 `r0` 强诱导 `OBS6-LH8R4`（`5:long,5:multi`, `6000g`, `--penDeadElec=0.25 --lamC=0.15 --lamF=0.25`）全检查点 `mem-probe-e6 Gap < 0`（`-6.9pt` 到 `-0.4pt`）：
     - **`OBS6-LH8R4.seg1500.bak`**：`C5短=0.1714 / C5长=0.1756`、`用卡=13`、`Gap=-6.9pt`；在 80 局 `r0 multi` 中将 `ep=2#elec` 从 `84` 压半至 **`37`**，并将 `ep>=3#elec` 从 `18` 拉升 3.5× 至 **`63`**（`affRail 59`，实放 `13` vs `LH6P 11`）。
     - **`OBS6-LH8R4.bak`（6k 终点）**：`C5长=0.1956`（本系列最高 `C5长`，`Gap=-0.4pt`，`用卡=13`，`防御%=48.1`）；80 局 `r0 long` 中 `ep>=3#elec=5`、`rail=5`（vs `LH6P 1/1`）。
     - 结论：`--penDeadElec` 在 `multi`（通过 `ring` 提速 ep）与纯 `r0 long`（`ep>=3#elec` 与 `rail` 同时增至 5×）上验证有效；但因 `ep=2 -> charge#boom -> laserEye` 天生比"多攒一手 `ji` 再 `ep=3 -> charge#elec -> railgun`"少花 1 回合节奏，常态 `r0 long` 里激光眼仍将自然占优，除非同时配更强的多步价值基线。

---

## 四、收工验证与接力

- 早/白班总览详账与统一口径对照表已落盘至 [FINDING-2026-11-15-day-obs6-longhorizon-zcode.md](file:///d:/code/Epirus-Web/docs/research/FINDING-2026-11-15-day-obs6-longhorizon-zcode.md)。
- 线上代码/图谱已推送至 `origin/main`（`abfefc9f`；前置 `e2816572` 已通过全量 `engine` `gate-all` 5 道全绿：`np 172/172 · spec 68/68 · smoke OK · battle OK · map OK`）。
- `node training/knobs.mjs --check`：**通过**（全集 193 ‖ 在用 183 ‖ 未登记 0 ‖ 无注解 0 ‖ 暗键 9）。
- `champion-map` `shot.mjs` 自检（含 `OBS6-LH6` + `OBS6-LH6P` + `--reuse` + 父边回溯）：**100 PASS ‖ 0 FAIL**。
- `node tools/gate-all.mjs --auto`（纯文档收档，骑 `e2816572` 全量认证）：`meta` 组 **5 道全绿**（按用户指令纯文档仅本地收档，不执行 `git push`）。
