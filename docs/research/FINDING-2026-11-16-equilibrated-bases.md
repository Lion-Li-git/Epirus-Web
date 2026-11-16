# 2026-11-16 下午自主研究总结：多底座均衡蒸馏与反「打地鼠」单包闭环

- **时段**：`2026-11-16 14:05 – 15:40 +08:00`（接续午班 [STATUS-2026-11-16-g5-unified.md](file:///d:/code/Epirus-Web/docs/research/STATUS-2026-11-16-g5-unified.md)）
- **统一架构**：`obs6.5` 5 行 `modeBias`（`standard, multi, multi4, long, 2:long`，`16561` 维统一单包，**未拆包**；旋钮契约见 `training/TRAINING-KNOBS.md`，本次零新增 env 旋钮）。
- **核心交付（两类三枚 `promote --dry` 全门禁零阻断通过包 + 一枚独立底座对照包）**：
  1. **[`scratch/arms/EQ-S4-E9.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-S4-E9.bak)**：纯迭代蒸馏成品（无混成），`promote --dry` 全项通过、`selftest3` **6/6 腿误差 `0.00e+0`**、`2P-exam(20×120) = 96.7% (<=50%: NONE)`、`exam-4n` Short C = `+0.3360` / Long C = `+0.2555`（全四格为正）。
  2. **[`scratch/arms/EQ-SPL-75_S6m1.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-SPL-75_S6m1.bak)** & **[`scratch/arms/EQ-G-75S6.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-G-75S6.bak)**：全满贯推进成品，`promote --dry` 全项通过且**同步打通第 6 道珠经济闭环（花珠率 `56.3%`, `exp 0.2/g`）**、反退化全绿（`long gun 41.0% / multi gun 41.4%`）、前线 8 强对抗复合 `0.3083` / `0.3104`（大幅领先 `EQ-S4-E9` 的 `0.2562`）、`G4[multi]` 余量从 `0.7pt` 扩厚到 **`+23.7pt`（`36.3%/60%`）**（注：`EQ-G-75S6` 为线性插值粒子，推理腿 A/B/D/E 逐位通过、`selftest3` 数值差分腿 C 在 Coord 5993 处过 ReLU 折点报 `1.17e-3`，若要继续开 PG 臂须先接 `EQ-S4-E9` 或经 `supfit-gd` 重蒸馏）。
  3. **[`scratch/arms/EQ-S5-P9.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-S5-P9.bak)**：独立 **`BASE-P9-MB5`（`OBS6P9-S4000`）** 底座单轮复现对照，`selftest3` 6/6 全绿（`0.00e+0`），验证 11 槽均衡教师配方跨底座可迁移。

---

## 一、为何此前陷入「修好一个又冒出一个」（打地鼠）—— 根因解剖

通过 `probe-unified-screen.mjs` 横向测齐各代底座与教师、配合对局逐手回放，定位了 4 个直接诱发回归的机制根因：

1. **底座遗传锁定（`V3/US1` vs `OBS6E9/OBS6P9`）**：
   - `BASE-U1-2L` / `US1-2L` 2P 极强（`94.2%` / `89.2%`），但在 5P 被动设防 `52%–58%`、`Wall(20g)=0.00/g (zero=100%)`、`G5=48%–78%`。一旦将其作为主底座或混进 `3/5/8P` 教师，反弹墙与 `G5` 必然一起崩；
   - 反观 `OBS6E9`（`Wall=2.85/g, G5=28%/23%`）与 `OBS6P9-S4000`（`Wall=6.45/g, G5=33%/25%`）具备完整反反弹/破盾主干，配合均衡多人/长程教师蒸馏后（`EQ-E9-A1`）可直接打到 `Wall=14.05/g (zero=0%), FieldA=40.6%, FieldB=2.17/g, G5=3%/3%`。
2. **`2P` 崩盘的双重原因（`8/8` 均摊失衡 + 共享主干压过单行 `modeBias`）**：
   - 8 桌形均采时 `2:standard` 仅占 `12.5%` 权重，且默认 `arena2` 有 `50%` 对局是无防纯冲的 `bundled-champion-3p`，几乎见不到 `aggro/balanced/combocounter/guardgun`；
   - 单独把 `EQ-HYBRID-S2` 的 `modeBias[standard]` 拼接到 `EQ-E9-A1` 上时，`2P` 仍为 `70.6%`（未恢复），证实现代 2P 抗压行为主要由**共享主干（`seatEnc/ctx/cand/policyHead`）**承载。必须用 **`2:standard` 高配额（`2/11–3/11`）+ 多风格脚本池**联合训练。
3. **`G4[multi vs 激光剑连刺]` 暗桩（缺 `2:multi` 覆盖导致对称平局死循环）**：
   - 追踪 `EQ-SOUP-45_6535` 在 `multi` 1v1 对阵「只出激光剑」脚本（`ji, ji, sword`），我方固定走出 `ji,ji,ji,sword,ji,ji,sword`，第 6 手落后 1 血陷入无限互换 `sword` 平局超时判负（`86%` 败率）；根因是从未在蒸馏桌形里放入 `2:multi`。加入 `2:multi`（用 `EQ-S4-E9 + OBS6E9 + bundled-champion` 教破循环）后，`G4[multi vs sword]` 100 局胜率从 `86%` 直降至 **`1%–4%`**（插值/拼接版稳在 `36.3%–49.0%`）。
4. **无 KL 约束的 PG 必然漂移塌缩，且 KL 锚必须分模式门控**：
   - PG 若不加锚，哪怕加了 `defTax/dmgW/lamExp` 也会在 `1500` 局内退化为 `charge/sword`（`PG-HYB-G5`：`Wall 2.25 -> 0.00/g`, `G5 43% -> 70%`）；
   - 但若全模式加 `--klW=0.18`（`PG-EQ-SOUP70` / `PG-EQ-E9`），则会把 `2:standard` 锚死在起点 `62%–68%` 的低 2P 水平。因此工具已补齐 `--klModes` 按模式精准门控。

---

## 二、工具与训练器改动清单（仅训练与探测侧，产品门零触动）

- [training/proto2/supfit-gd.mjs](file:///d:/code/Epirus-Web/training/proto2/supfit-gd.mjs)：
  - 新增 `--teacher=breakAll`（比 `antiReflect` 更完整：同时监测护盾系 `guard/jinshield/proto/armor` 与反弹系 `reflect/bagua/shift`，优先锁靶防席释放穿透牌 `laserEye/railgun/snipe/tank/cannon/bigT`，平常态回落 `v7Pick/pickChain`）；
  - 修复未传 `--arenaShapes` 时结尾写 `.meta.json` 访问 `A2_SHAPES.length` 的空指针崩溃。
- [training/proto2/pg-train.mjs](file:///d:/code/Epirus-Web/training/proto2/pg-train.mjs)：
  - 新增 `--dmgW`（回合造成伤害塑形）、`--beadSpendW`（回合花珠塑形）、`--defTax`（纯被动防税，受 `--shapeModes` 门控）、`--klModes`（按模式门控批级 KL 锚与 `--klTilt`，互不干扰）。
- [scratch/probes/probe-unified-screen.mjs](file:///d:/code/Epirus-Web/scratch/probes/probe-unified-screen.mjs)：
  - 统一快筛 2P（20×20 / 20×40）、4 桌形分、Wall、FieldA/B、BeadLoop、G5（d0/d12）与 G4def30；修正 `aggressionProfile` 参数传递，消除 `FieldB` `NaN`。

---

## 三、关键产物全维指标总表（A / B / C 与 `promote --dry` 实测）

> ⛔ Rule 7 标注：`exam-4n` 全表 B 轴冠军夹具统一为 **`champ=MSB15R-HITMIX,GD6a-TILT,Q-s47`**（`pool=v2#fbf59889 K=28 plan=v2`），A/B/C(`C=(A+B)/2`) 同列对照。

### 3.1 `promote-champion --dry` 与详细性能总览

| 候选包 | `promote --dry` | 2P(20×120) | `2:std / 2:long / 5:multi / 5:long` (`eval-v2-detail`) | Wall(20g) | FieldA / FieldB清场 | G4[`long`/`multi`] (红线≤60) | G5[`long`/`multi`] (红线≤25) | 珠经济(40g) | `gun`反退化 | `frontline`(8强) |
|---|---|---|---|---|---|---|---|---|---|---|
| [`EQ-S4-E9.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-S4-E9.bak) | **✅ PASS (0 阻断)** | **96.7%** (`<=50%:NONE`) | `0.875 / 0.925 / 0.484 / 0.453` | **17.00/g** (0%零伤) | `29.5%` / **3.03/g** | `19.7%` / `59.3%` | `16%` / `4%` | 0% (得5花0) | `ok` (`53.3% / 37.3%`) | `0.2562` |
| [`EQ-G-75S6.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-G-75S6.bak) | **✅ PASS (0 阻断)** | `91.0%` | `0.900 / 0.838 / 0.266 / 0.305` | **17.00/g** (0%零伤) | **40.2%** / `1.67/g` | `25.3%` / **41.3%** | `25%` / **0%** | **56.3% 闭环 ✓** | **ok (`41.0% / 46.7%`)** | **0.3104 (#1)** |
| [`EQ-SPL-75_S6m1.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-SPL-75_S6m1.bak) | **✅ PASS (0 阻断)** | `91.0%` | `0.900 / 0.838 / 0.242 / 0.305` | **17.00/g** (0%零伤) | **40.7%** / `1.59/g` | `25.3%` / **36.3%** | `25%` / **0%** | **56.3% 闭环 ✓** | **ok (`41.0% / 41.4%`)** | `0.3083 (#2)` |
| [`EQ-SOUP-45_6535.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-SOUP-45_6535.bak) | ✗ 仅G4[multi] | `94.2%` | `0.875 / 0.900 / 0.570 / 0.391` | **17.00/g** (0%零伤) | `34.6%` / `2.49/g` | `19.7%` / `86%✗` | `17%` / `1%` | **56.3% 闭环 ✓** | `61.3% / 35.4%` | `0.3208` |
| [`EQ-S5-P9.bak`](file:///d:/code/Epirus-Web/scratch/arms/EQ-S5-P9.bak) | — (2号底座) | `80.9%` | `0.550 / 0.525 / 0.367 / 0.281` | **17.80/g** *(快筛)* | `34.4%` / `0.63/g` *(快筛)* | `G4def=20%/0%` *(快筛)* | `30%` / `0%` *(快筛)* | `12.1%` *(快筛)* | — | — |

### 3.2 `exam-4n`（Short 与 Long A / B / C 三轴读数，`rounds=12`, `seed=77000`, `champ=MSB15R-HITMIX,GD6a-TILT,Q-s47`）

| 包（模式） | A (`x2 / x3 / x5 / x8`) | B vs现役冠军团 (`x2 / x3 / x5 / x8`) | **C=(A+B)/2** (`x2 / x3 / x5 / x8`) | `h2 / h3 / h5 / h8` (C) |
|---|---|---|---|---|
| `EQ-S4-E9` **(Short)** | `0.7051 / 0.3482 / 0.2560 / 0.2143` | `0.9679 / 0.1875 / 0.0327 / -0.0238` | **`0.8365 / 0.2679 / 0.1444 / 0.0953`** | `91.83 / 51.19 / 31.55 / 20.84` |
| `EQ-S4-E9` **(Long)** | `0.7821 / 0.3571 / 0.3006 / 0.1667` | `0.5385 / -0.0536 / -0.0714 / 0.0238` | **`0.6603 / 0.1517 / 0.1146 / 0.0953`** | `83.01 / 43.45 / 29.17 / 20.83` |
| `EQ-SPL-75_S6m1` **(Short)** | `0.6474 / 0.4018 / 0.2411 / 0.1190` | `0.9231 / 0.0982 / -0.1310 / -0.0952` | **`0.7853 / 0.2500 / 0.0551 / 0.0119`** | `89.26 / 50.00 / 24.41 / 13.55` |
| `EQ-SPL-75_S6m1` **(Long)** | `0.5577 / 0.4554 / 0.2708 / 0.1905` | `-0.0833 / -0.0625 / -0.1607 / -0.0476` | **`0.2372 / 0.1965 / 0.0550 / 0.0714`** | `61.85 / 46.43 / 24.41 / 18.75` |
| `EQ-G-75S6` **(Short)** | `0.6410 / 0.4107 / 0.2113 / 0.1429` | `0.9359 / 0.0536 / -0.1012 / -0.0952` | **`0.7884 / 0.2321 / 0.0550 / 0.0238`** | `89.42 / 48.80 / 24.40 / 14.59` |
| `EQ-G-75S6` **(Long)** | `0.5577 / 0.4554 / 0.2708 / 0.1905` | `-0.0833 / -0.0625 / -0.1607 / -0.0476` | **`0.2372 / 0.1965 / 0.0550 / 0.0714`** | `61.85 / 46.43 / 24.41 / 18.75` |
| `EQ-S5-P9` **(Short)** | `0.5000 / 0.3125 / 0.3304 / 0.1429` | `0.1090 / -0.0982 / -0.1161 / -0.0238` | `0.3045 / 0.1071 / 0.1072 / 0.0595` | `65.22 / 40.48 / 28.57 / 17.71` |
| `EQ-S5-P9` **(Long)** | `0.2756 / 0.1518 / 0.2113 / 0.2143` | `-0.4359 / 0.0625 / -0.0565 / -0.0714` | `-0.0801 / 0.1071 / 0.0774 / 0.0714` | `46.00 / 40.48 / 26.19 / 18.75` |

---

## 四、选包建议与下一步接力建议（HANDOFF）

1. **当前已有两枚完全可上线的 `promote --dry` 全过包，选型权衡清晰**：
   - 若优先**综合 C 轴强胜率 + 高 2P + 全自证 `selftest3` 六腿全绿 + 可直接继续接 PG**：选 **`scratch/arms/EQ-S4-E9.bak`**（Short C `+0.3360` / Long C `+0.2555` / 2P `96.7%`，唯一局限是珠经济 `0%`、且 `G4[multi]` 距 60% 门槛仅剩 `0.7pt` 余量）；
   - 若优先**前线对抗实战（`0.308–0.310`）+ 珠经济闭环（`56.3%`）+ 宽裕的 `G4[multi]` 安全边际（`36.3%/60%`）**：选 **`scratch/arms/EQ-SPL-75_S6m1.bak`**（或先以 `EQ-S4-E9.bak` 做起点对 `EQ-SPL-75_S6m1` 的全部 11 桌形跑一轮轻量 `supfit-gd` 蒸馏，可同时消掉插值包在 `selftest3` Coord 5993 的 ReLU 数值微分告警并将 `G5[long]` 从 `25%` 压回 `10–15%`）。
2. **门禁验证现状**：
   - `node training/knobs.mjs --check`、`node training/proto2/selftest2.mjs`（36/36）、`node training/proto2/selftest3.mjs scratch/arms/EQ-S4-E9.bak`（6/6，`0.00e+0`）、`node training/proto2/selftest3.mjs scratch/arms/EQ-S5-P9.bak`（6/6，`0.00e+0`）以及 `node tools/gate-all.mjs --auto`（`np/meta 16/16 · spec 77/77 · smoke OK · battle OK · map OK`）均已在本棵代码树全绿通过。
