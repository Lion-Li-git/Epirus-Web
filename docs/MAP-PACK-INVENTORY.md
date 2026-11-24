# 全图谱冠军包盘存总表（Champion Map Pack Inventory）

> 统计基准：以 [`champion-map/data/registry.tsv`](../champion-map/data/registry.tsv)（`1,014` 枚）与 [`docs/ARTIFACT-LOSS-1119.tsv`](ARTIFACT-LOSS-1119.tsv)（`1,002` 行历史对照）为真源，于 `2026-11-22 19:58`（合入 `AR-TK2` 至 `hard` 带 + 补入代表性失败包 `AR-TK3`、`nov22-c3b-kw100` 替换纯崩盘点 `nov22-c3a-kw0` + 拆分 `fam=23..27` 与全量 `mixedfix` 补测后）实盘核验。  
> 相关文档：[`docs/ARTIFACT-LOSS-1119.md`](ARTIFACT-LOSS-1119.md) ‖ [`docs/GOAL-2026-11-19-ruler-resolution.md`](GOAL-2026-11-19-ruler-resolution.md) ‖ [`docs/POOL-CONTRACT.md`](POOL-CONTRACT.md) ‖ [`docs/TRAINING-RUN-LOG.md`](TRAINING-RUN-LOG.md)

---

## 一、全局盘存总览

| 口径 | 数量 | 说明 |
|---|---:|---|
| **图谱在册总数** | **1,014** | `v1.8` 早期演化线 **831** 枚 + `2.0` 网络线 **183** 枚（含 **`AR-TK2`**、**`R-GD12`**、失败对照 **`AR-TK3` / `nov22-c3b-kw100`** 及 `nov21–nov22` 新入图批） |
| 无路径记录（`no-path`） | **19** | 仅见于 `fam=11`（4）、`fam=13`（14）、`fam=19`（1） |
| 有路径记录（`hasPath`） | **995** | 以下盘面状态均基于此 995 枚 |
| **实际在盘（可用）** | **615** | 原封 `sha256` 一致 **529** 枚 + 逐位复现 `wid` 一致、`META.ts` 归一化致 `sha256` 变更 **86** 枚 |
| **盘上仍缺失（`missing`）** | **380** | `364` 枚早期 `v1.5.x` `server` 盲扫尾批（`fam=1..6`）+ `16` 枚未播种 `KDO5-seed` 随机根链（`fam=19..20`） |
| **现役产品冠军池** | **22** | **`hard` 11 枚 / `soft` 11 枚**，**`22/22` 全员在盘（0 缺失、`seatUnknown=0`、`arenaUnknown=0`）** |
| **现役 B 轴 24 锚联盟** | **24** | [`arena-league-1118-page.tsv`](../champion-map/data/arena-league-1118-page.tsv)，**`24/24` 全员在盘（0 缺失）** |

> 缺失台账分目录剩余（共 `380` 枚）：`docs/artifacts/*.bak` 根目录 **365** 枚、`docs/artifacts/night-adapt/` **14** 枚、`scratch/arms/` **1** 枚（`GD6b-TILT-3p.bak`）。

---

## 二、28 个谱系家族全量分布（`fam=0..27`）

> 家族聚类由 [`champion-map/data/registry.tsv`](../champion-map/data/registry.tsv) 的 `fam` / `fam_label` 定义；其中 **`21` 个家族已实现 `missing = 0`（全部 `2.0` 小族可复现部分与 `fam=0, 7..18, 21..27` 已清零）**。

| `fam` | 网络线 | 在册 | 在盘 | `shaOk` | `shaDiff` | 缺失 | 无路径 | 家族语义 / 定位 | 盘存状态 |
|---:|:---:|---:|---:|---:|---:|---:|---:|---|---|
| **0** | `1.8` | 16 | 16 | 16 | 0 | **0** | 0 | 旧槽位冠军（`SLOT-*` 等 40 段历史槽位） | 已清零（11-20 `87f2c849` 全清） |
| **1** | `1.8` | 47 | 19 | 17 | 2 | **28** | 0 | 珠价 / 代数步进 B2（09-12 → 09-16） | 部分缺失（早期 `server` 批，需配对 `EPIRUS_*` 重跑） |
| **2** | `1.8` | 55 | 46 | 45 | 1 | **9** | 0 | 历史配方步进 A（09-12 → 09-13：`mix`/`sty`/早期池） | 部分缺失（11-22 恢复 +10） |
| **3** | `1.8` | 97 | 80 | 64 | 16 | **17** | 0 | 对手池步进 B1（09-13 → 09-15：对手池 1→77） | 部分缺失（11-22 恢复 +26） |
| **4** | `1.8` | 128 | 19 | 9 | 10 | **109** | 0 | 对手池步进 C2（09-16 → 09-19：对手池 16/19 + 小类） | 缺失主力区（早期 `server` 批） |
| **5** | `1.8` | 137 | 43 | 36 | 7 | **94** | 0 | 多样性步进 C1（09-16 → 09-18：多样性 5→30） | 缺失主力区（早期 `server` 批） |
| **6** | `1.8` | 133 | 26 | 19 | 7 | **107** | 0 | 对手池 / 珠价步进 C3（09-19 → 09-21：对手池 14→22） | 缺失主力区（早期 `server` 批） |
| **7** | `1.8` | 7 | 7 | 6 | 1 | **0** | 0 | 旧生产对照（09-25 → 09-27：`e35`/`e39`/`seed80`/`seed81`/`cal-ctl`/`E51`） | 已清零（11-21 `seed81` + `e35prod807` 归位） |
| **8** | `1.8` | 7 | 7 | 3 | 4 | **0** | 0 | 早期 `env` 臂（16 轴全空，09-27 → 10-15） | 已清零 |
| **9** | `1.8` | 110 | 110 | 87 | 23 | **0** | 0 | 现代基线与 `Ldemo`/`e234` 大批（09-27 → 10-17） | 已清零（11-21 最后 34/34 归位） |
| **10** | `1.8` | 6 | 6 | 6 | 0 | **0** | 0 | 融合与续训（10-08） | 已清零 |
| **11** | `1.8` | 51 | 47 | 41 | 6 | **0** | 4 | 臂线 · `env` 实验（`COUNTER_OPPS` / 纯续训 + T8/snipe + E1/E2） | 有路径者已清零（4 枚历史无路径） |
| **12** | `1.8` | 13 | 13 | 13 | 0 | **0** | 0 | 臂线 · `COUNTER_OPPS=guardSpam`（10-08） | 已清零 |
| **13** | `1.8` | 18 | 4 | 4 | 0 | **0** | 14 | 激光眼线（`g12→g18` · 冷启破零 / 破密 / 珠闭环，10-23 → 10-27） | 有路径者已清零（14 枚历史无路径） |
| **14** | `2.0` | 25 | 25 | 25 | 0 | **0** | 0 | 2.0 蒸馏根与 `L5`/`CB`/`D` 产线 | 已清零（11-20 补齐最后 5/5） |
| **15** | `2.0` | 31 | 31 | 31 | 0 | **0** | 0 | `gen-3` 实验臂 ∪ `v7` 面 GA 对照臂（`T8-s114` 热启动） | 已清零 |
| **16** | `2.0` | 9 | 9 | 9 | 0 | **0** | 0 | `KD` 蒸馏链（种子与克隆 · `v7` 教师全模型） | 已清零（`KD-V7/KDFULL2/KD-K2/KD-K2-l/KD-Qg` 全归位） |
| **17** | `2.0` | 14 | 14 | 7 | 7 | **0** | 0 | 2.0 GA 强化线（11-08 → 09：集火 / 清场 / 宽包 / `SEL_CARDS`） | 已清零 |
| **18** | `2.0` | 4 | 4 | 2 | 2 | **0** | 0 | 2.0 行为课程线（11-09：破防与还手） | 已清零 |
| **19** | `2.0` | 24 | 9 | 9 | 0 | **14** | 1 | 2.0 `obs5` 课程链（`MSB*` 反墙 / 配给教师，11-09 → 11） | **永久阻断**（受单一未播种 `KDO5-seed` 随机根链锁定） |
| **20** | `2.0` | 4 | 2 | 2 | 0 | **2** | 0 | `GD6` 蒸馏多线（11-12：`GD6b-TILT-3p` / `MSB18`） | **永久阻断**（上游挂 `fam=19` 的 `MSB8-charge`） |
| **21** | `2.0` | 8 | 8 | 8 | 0 | **0** | 0 | 2.0 `obs6` 无教师冷启动（11-14：`OBS6A4/W2/A5` 等） | 已清零 |
| **22** | `2.0` | 13 | 13 | 13 | 0 | **0** | 0 | 2.0 `obs6` `v7` 蒸馏（11-14） | 已清零 |
| **23** | `2.0` | 15 | 15 | 15 | 0 | **0** | 0 | 2.0 `obs6.5` 统一单包（11-16：`OBS6-UNIFIED-*` / `EQ-*` / `BASE-*`） | 已清零 |
| **24** | `2.0` | 7 | 7 | 7 | 0 | **0** | 0 | 2.0 `obs6` `V3` 融合 / 路由（11-16） | 已清零（B 轴缺锚与 `V3H3` 全归位） |
| **25** | `2.0` | 28 | 28 | 28 | 0 | **0** | 0 | 2.0 `obs6.5` 键道 / 覆盖与协同蒸馏（`MX*` / `RING*` / `TZ*` / `nov21`–`nov22` 覆盖线 / `R-GD12` / `AR-TK2` / `AR-TK3`） | 已清零 |
| **26** | `2.0` | 4 | 4 | 4 | 0 | **0** | 0 | 2.0 `obs6.5` `DS-P0` 强锚补盲与融合重馏（`night2-X2b-fuse` / `night2-E1-det-strong` / `purify` / `taunt`） | 已清零 |
| **27** | `2.0` | 3 | 3 | 3 | 0 | **0** | 0 | 2.0 `obs6.5` `PG / KL` 强化续训（`day1119-cannon-pg` / `nov22-c3b-kw100` / `nov22-c3g-s300k`） | 已清零 |
| **合计** | — | **1,014** | **615** | **529** | **86** | **380** | **19** | 全谱系（`1.8` `831` + `2.0` `183`） | `21` 族清零；余 `364` 早期 `server` + `16` 不可复根链 |

---

## 三、现役产品冠军池（22 枚 · `hard 11 / soft 11` · 全员在盘）

> 真源：[`champion-map/data/page/pool-members.tsv`](../champion-map/data/page/pool-members.tsv) → 烘焙产物 [`js/pool-manifest.js`](../js/pool-manifest.js) + [`js/bundled-champion-pool.js`](../js/bundled-champion-pool.js)（`hard 11 / soft 11`，`seatUnknown = 0`，全池 28 技能并集 0 缺失）。

| # | `id` | 分带 | `wid` | `invited` | `seatKill` | 产物路径 | 关键角色 / 备注 |
|---:|---|---|---|---:|---:|---|---|
| 1 | **`FC-G1`** | `hard` | `cd0d19ba78e411cf` | 1 | 0 | [`docs/artifacts/FC-G1.bak`](artifacts/FC-G1.bak) | **11-24 `hard` 天火闭环强将（特邀 `G5[long]=31%`）**：`RG-CN` 底 + 双路穿防 `@0.20` + 闭环 `@0.30`；`5P` 28.4%（#3/29）、`arenaB=-16.64pt`（配对胜 `RG-CN +1.02pt`）、Stage1 `loopRate=91.71%` / `takeRate=46.22%` / `emptyBoom=0` |
| 2 | `FS-G2` | `hard` | `892ba770d1dfca0b` | 0 | 0 | [`docs/artifacts/FS-G2.bak`](artifacts/FS-G2.bak) | `hard` 反只枪×天火低剂量载体（`arenaB=-3.48pt`、`promote` 0 阻断、`loopRate=88%`） |
| 3 | `HL-G1` | `hard` | `803f773db2e563f0` | 0 | 0 | [`docs/artifacts/HL-G1.bak`](artifacts/HL-G1.bak) | `hard` 全息套盾配合载体（`arenaB=-1.83pt`、40g `self=0/other=56`、`holo 35/120` 格） |
| 4 | `nov21-armor-tzt2d` | `hard` | `7819b2196ba23fca` | 0 | 0 | [`docs/artifacts/nov21-armor-tzt2d.bak`](artifacts/nov21-armor-tzt2d.bak) | `hard` 藤甲载体（全场 `27.2%`、`armor 5,228` 次） |
| 5 | `nov21-taunt-dsp0b` | `hard` | `db7883520de2e2fe` | 0 | 0 | [`docs/artifacts/nov21-taunt-dsp0b.bak`](artifacts/nov21-taunt-dsp0b.bak) | `hard` 挑衅补盲（`arenaB=+17.92pt`、`taunt 95/120` 格） |
| 6 | `nov22-ring3-gd6a18` | `hard` | `a64b53c90367221a` | 0 | 0 | [`docs/artifacts/nov22-ring3-gd6a18.bak`](artifacts/nov22-ring3-gd6a18.bak) | `hard` 环 3 连载体（`arenaB=+20.40pt`、`5P` 三连 30.1% / `8P` 27.2%） |
| 7 | `OBS6E9` | `hard` | `d2a64af418b85949` | 0 | 0 | `docs/artifacts/obs6-coldstart/OBS6E9.bak` | `hard` 强宽六轴全持代表（`arenaB=+14.02pt`、`curseOk=0`） |
| 8 | `R-GD12` | `hard` | `7e55abc3894ca3e2` | 0 | 0 | [`docs/artifacts/R-GD12.bak`](artifacts/R-GD12.bak) | `hard` 聚能环强将（`arenaB=+15.89pt`、`ring 28/120` 格） |
| 9 | `RG-CN` | `hard` | `6f926e8b926fa719` | 0 | 0 | [`docs/artifacts/RG-CN.bak`](artifacts/RG-CN.bak) | `hard` 过载炮×长程聚能环（`arenaB=-1.99pt`、`cannon` / `ring`） |
| 10 | `RG-MN` | `hard` | `7e4628cbec354183` | 0 | 0 | [`docs/artifacts/RG-MN.bak`](artifacts/RG-MN.bak) | `hard` 地雷×长程聚能环（`arenaB=+11.38pt`、`mine 44/120`、`curseOk=0`） |
| 11 | `RING-MINIT-CONT` | `hard` | `225404c8e4454cf0` | 1 | 2 | `docs/artifacts/obs6-coldstart/RING-MINIT-CONT.bak` | `hard` `ring` / `miniT` 载体（`arenaB=+2.30pt`） |
| 12 | `AR-TK2` | `soft` | `b5d4cbc6af57bbdd` | 0 | 0 | [`docs/artifacts/AR-TK2.bak`](artifacts/AR-TK2.bak) | `soft` 藤甲×坦克协同载体（`arenaB=+10.36pt`） |
| 13 | **`FC-S1`** | `soft` | `9390478ce2e1ba00` | 0 | 0 | [`docs/artifacts/FC-S1.bak`](artifacts/FC-S1.bak) | **11-24 `soft` 过载炮×天火闭环（直接接替 `MX8-CN-M`）**：`5P` 17.8%、`arenaB=-25.67pt`、`promote` 0 阻断、`cannon 9/120`、Stage1 `loopRate=92.76%` / `takeRate=53.82%` / `emptyBoom=0` |
| 14 | `MSB11-R1S130778313` | `soft` | `970c77da80818f40` | 0 | 0 | `docs/artifacts/night-adapt/MSB11-R1S130778313.js` | `soft` `obs5` 反墙线保留成员（`curseOk=0`） |
| 15 | `MX6-GD-TF20` | `soft` | `bab64e2b297b1e68` | 1 | 0 | `docs/artifacts/obs6-coldstart/MX6-GD-TF20.bak` | `soft` `transfer` + `miniT` + `railgun` + `bigT` |
| 16 | `MX8-R6B-KL` | `soft` | `eb5f0460834e3974` | 1 | 1 | `docs/artifacts/obs6-coldstart/MX8-R6B-KL.bak` | `soft` `rod` + `mine` 载体 |
| 17 | `MX8-R6C-KL` | `soft` | `ece05168351625a9` | 1 | 0 | `docs/artifacts/obs6-coldstart/MX8-R6C-KL.bak` | `soft` `armor` + `rod` 载体 |
| 18 | `MX8-TN35-KL3` | `soft` | `137f584ec08418b2` | 1 | 0 | `docs/artifacts/obs6-coldstart/MX8-TN35-KL3.bak` | `soft` 最高用卡广度（20 技）与 `dualGun` / `taunt` / `drain` |
| 19 | `nov21-purify-dsp0` | `soft` | `b4a65ee4437584cf` | 0 | 0 | [`docs/artifacts/nov21-purify-dsp0.bak`](artifacts/nov21-purify-dsp0.bak) | `soft` 净化补盲（`arenaB=+14.04pt`、`curseOk=0`） |
| 20 | `nov21-rod-tzt2d-r10` | `soft` | `da2981d21406ca06` | 1 | 2 | [`docs/artifacts/nov21-rod-tzt2d-r10.bak`](artifacts/nov21-rod-tzt2d-r10.bak) | `soft` 避雷针覆盖首枚（待后续洁净低剂量替换） |
| 21 | `nov22-c3g-s300k` | `soft` | `39f605c3f8b9a62c` | 0 | 0 | [`docs/artifacts/nov22-c3g-s300k.bak`](artifacts/nov22-c3g-s300k.bak) | `soft` 天火闭环强节点（`arenaB=-27.55pt`、`loopRate=88%`） |
| 22 | `RINGB11` | `soft` | `764f0b92c696fc62` | 0 | 0 | `docs/artifacts/obs6-coldstart/RINGB11.bak` | `soft` 环线升级件（`curseOk=0`） |

> 现役池状态（`2026-11-24 v2.1.23` 精简闭环后定稿：共 **`22` 枚 = `hard 11 ‖ soft 11`**，`mid` 空）：  
> 1. **11-23 `v2.1.22` 先前退役 `13` 枚**：`EQ-S4-E9 / EQ-S4-GD6ATEACH / MN-G1 / MX3-GDEQ-GD / MX5-GD-T2STR / MX6-GD-TF15 / OBS6P9-S4000 / DEF-s16 / MX5-GD-LE40 / night2-E1-det-strong / nov22-c4c-t20 / RINGB9 / TZT2D`；  
> 2. **11-24 `v2.1.23` 新入 `2` 枚天火闭环包并再退 `5` 枚冗余未闭环包**：特邀 `FC-G1` 入 `hard`、`FC-S1` 入 `soft`，退役 `MX8-TN25-KL / MX1-GD-EQ / CN-G1 / MX8-CN-M / MX7-T2-R`；`hard` `25` 技 / `soft` `24` 技 / 全池 `28` 技能并集 `0` 缺失，`probe-pool --tier=hard --games=60` `multi=1.55% / long=2.50%`；`1500g` 阶梯 `multi 5.3/18.4/22.3% (11.3σ/2.6σ)`、`long 11.5/23.5/31.1% (8.5σ/4.7σ)`。

---

## 四、剩余 380 枚缺失的可复现边界结论

1. **不可复现红线（`16` 枚：`fam=19` 14 枚 + `fam=20` 2 枚）**：
   - `KDO5-seed.bak` 由 `make-seed5.mjs` 调用未播种 `Math.random()` 生成，经 `KDO5C` → `MSB2×3` → `MSB4-R1S1928336850` → `K2-def-o5` (`23a782cb`) → `ADAPT-DEF-O5-s916` → `S916/S916R2B/MSB6..12/GD6b-TILT/MSB18` 全链盘上/隔离区/worktree/git 均零留存。**逐位复现数学上不可达，不再追查日志。**
2. **仅余的未闭环空间（`364` 枚：`fam=1..6` 早期 `v1.8` `server` 批次）**：
   - 上游统一根包 `champion-5p-v1.3.58.bak`（`e379c62ccd2648fa`）与 `slot-timeline.tsv` 全部 `16` 枚 `SLOT` 已在盘，且 `ring2-run` 回放管道已打通；
   - 两轮裸盲扫已证伪「仅靠阶梯推断对手池」的打法——后续若继续抢救，必须基于幸存者 `META` 与配方台账（`COMMAND-CHECKUP` / `session-records-2026-11-20`）逐批精配 `EPIRUS_*` 环境变量覆写再重放；夹在会话未提交编辑态中间的少数分支（如 `v7l2c` / `v7w3c` / `v7seat24`）则依赖按时间回放会话 `Write/Edit` 的会话树重构。

---

## 五、日常运维核验命令

```bash
node tools/map-audit.mjs          # 核对 registry / loss / alias / stale / orphan 完整账
node tools/pool-skill-report.mjs  # 复测现役池技能覆盖观察层与强度层
node tools/gate-all.mjs --auto    # 提交前门禁自检
```
