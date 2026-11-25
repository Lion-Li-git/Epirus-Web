# 状态交接 · 天火闭环第 7 道 + `FS2-LE26` / `SOFT-RING-C3G25` 入池（2026-11-25）

## 一、天火闭环（对齐珠闭环 D78 口径）

按用户裁定「宁可不贴，也不要出现不闭环」，在工具层对称落地与珠经济（`chargeProfile` + `DENSITY_BLOCK = false` + `promote` 打印 + `champion-gate/score13`）同构的天火闭环测量与记录：

| 模块 | 改动 | 判据与门态 |
|---|---|---|
| [`tools/audit-lib.mjs`](../../tools/audit-lib.mjs) | 新增 `FIRESTORM_BLOCK = false`、`firestormProfile(W, params, mode, GAMES)` 与 `feasibilityOf` 第 7 道 `firestorm` | `curseOk === 0` ⇒ `'NA'` 免罚；`curseOk > 0` ⇒ 须 `firestormHits > 0 && stickGames > 0 && loopRate ≥ 0.30 && emptyBoomPerGame ≤ 1`；探针缺失记 `null`（只记录不阻断） |
| [`tools/promote-champion.mjs`](../../tools/promote-champion.mjs) & [`champion-map/feas.mjs`](../../champion-map/feas.mjs) | 接入 `firestormProfile` 并印「天火经济（40 局）」 | 与 `珠经济` 并排输出贴出手/落地/引爆/命中/空爆/抓手/局闭环 |
| [`tools/champion-gate.mjs`](../../tools/champion-gate.mjs) & [`tools/score13.mjs`](../../tools/score13.mjs) | 在 L3 注册 `firestorm`（旧名 `火`），补解析正则与 4 项正反合成自测 | L0+L1 维持 12 项；`champion-gate --selftest` 14/14，`score13 --selftest` 27/27 |

代表包实测（40 局 `long` 镜，`firestormProfile`）：
- `FS-G2`：`52` 贴 / `37` 爆（`38` 命中、`0` 空爆）⇒ 局闭环 **`71.1%`**（`closed = true`）
- `SOFT-RING-C3G25`：`55` 贴 / `64` 爆（`64` 命中、`0` 空爆）⇒ 局闭环 **`93.1%`**（`closed = true`）
- `T65-RINGBEAD`：`7` 贴 / `1` 爆（`1` 命中、`0` 空爆）⇒ 局闭环 `16.7%`（`closed = false`）
- `OBS6E9` / `nov25-hard-le40-pg-s20261125.seg2000`：`0` 贴 ⇒ `'NA'`（免罚）

## 二、`soft` 副产物复核与 `SOFT-RING-C3G25` 入池

对昨夜两组 `soft` 副产物（`nov25-soft-ring-c3g-s25/s26`）及 `le40-pg2k` 检查点的体检、90210/90211 人席与 2P `standard vs rule` 实测对比：

| 候选 | `promote --dry` | `90210` multi/long 最高漏 | `90211` multi/long 最高漏 | 2P `vs rule` | 决策 |
|---|---|---|---|---|---|
| `nov25-soft-ring-c3g-s20261125`（→ `SOFT-RING-C3G25`） | `✅` 全过（G4 `58.7%/10.7%`，G5 `0%/2%`） | `10.0% / 0.5%` | `8.0% / 0.0%` | `14.3%` | **入 `soft`**（`sk=0`，天火 Stage1 `97%` 引爆 / `94%` 局闭环） |
| `nov25-soft-ring-c3g-s20261126` | `✅` 全过（G4 `29%/18%`，G5 `0%/0%`） | `52.0% / 50.0%`（只枪压制） | `56.0% / 48.0%` | `15.3%` | 暂不入池（保留盘上供参考） |
| `nov25-hard-le40-pg-s25/s26.seg2000` | `✗` `场A 还手 19.5%/19.2% < 20%` | `50.5%/41.0%`、`55.0%/41.0%` | `60.0%/44.5%`、`56.5%/41.0%` | `43.3% / 43.0%` | 暂不入池 |

## 三、洁净基座激光眼与桌形隔离实验（`FS2-LE26` 入 `hard`）

1. 先以 `selftest3` 验血统：`FS-G2.bak` **6/6 PASS（`0.00e+0`）**；`TK-FS4.bak` 腿 C 数值梯度对账失败（`参数 5833 rel 3.78e-3`）；`T65-RINGBEAD.bak` 可分辨格 `52 < 60` 且腿 F 红。
2. 对照实验验证桌形与行为隔离：
   - 不隔离组（`nov25-fsg2-le-s25/s26`，`lasereye` 未限定桌形）：虽跑出 `laserEye 267–352`，但 `charge#boom` 渗入 `2:standard` 致 2P `vs rule` 替身升至 `79.5%–85.0%`，且 `s25.snap0` 触发 `墙=0.25 <= 0.5` 与 `G4/G5[long] 63%/54%`。
   - 桌形与行为隔离组（`--teacher2=lasereye --teacher2keys=laserEye,charge --teacher2Shapes=3:multi,5:long`、`--rareOnly=laserEye` 排除 `charge`、`--teacher3=pack:T65-RINGBEAD.bak --teacher3Shapes=2:standard`、`--arenaShapes=2:standard@2,3:multi,5:long`）：种子 `20261126` 轮 0 快照 `nov25-fsg2-le2p-s26.snap0`（→ `FS2-LE26`）在全维度达标：
     - `promote --dry --support=2`：`✅ 五道全过`（`G(multi)=7.08 / G(long)=7.29 / 墙=13.55 / 场A=28.2%`），**珠闭环 ✓（90.7% / 0.8 过期）**、**天火闭环 ✓（68% / 0 空爆）**，G4 `12%` / `1.3%`、G5 `11%` / `1%`；
     - `measure-point --bake`：`arenaB` `arS=+0.0831 / arL=+0.0733 / arR=+0.3019`，`mixedfix` `MxC=+0.0972 / MxCL=+0.1298`，`a-long h2=74.88%`，`H=51.5, S=2.00`；
     - Stage1：`union=14/30`，`1109` 贴 / `389` 爆（`loopRate=91%, takeRate=48%`），`selfPlay long 40` 打出 `290` 次 `laserEye`，`seatKill=0`，2P `vs rule` 替身 `21.0%`。

## 四、26 成员均衡池与自动重烘（`hard 13 / soft 13`）

- 下放 `RING-MINIT-CONT`（`hard → soft`）：其 `seatKill=2`、`arR=-0.285`、`firestorm 25%` 未闭环，原有 `laserEye` / `drain` / `proto` 已分别由 `FS2-LE26`、`T65-RINGBEAD`、`OBS6E9` 承接，下放后 `hard` 零技能覆盖损失、零 `sk>0` 成员，两带数量平衡为 `hard 13 / soft 13`。
- [`tools/pool-add.mjs`](../../tools/pool-add.mjs) 已新增 `syncSkillPage()`，入池 / `--retire` / `--refresh` 改表后自动调用 [`champion-map/build-skill-page.mjs`](../../champion-map/build-skill-page.mjs) 重烘 [`champion-map/skill-report.html`](../../champion-map/skill-report.html)；`build-skill-page.mjs` 亦已改以 `pool-members.tsv` 的 `tier` 为单一真源。
- 平衡前 `14/12` 复测及 `13/13` 阶梯复测见对应门禁与交接输出。
