# FINDING · 2026-11-16 晚 · Gemini 均衡底座全过包方法审阅

> 审阅对象：[FINDING-2026-11-16-equilibrated-bases.md](./FINDING-2026-11-16-equilibrated-bases.md)（Gemini，14:05–15:40）
> 目的：提炼可复用的训练方法，并指出“全过”的真实边界，供后续训练参考。

## 一、它到底做对了什么

### 1. 先换底座，而不是先调策略
Gemini 的关键判断不是“再加一个教师”，而是：

- `BASE-U1-2L/US1-2L` 2P 强（94.2/89.2%），但 **Wall=0.00/g、G5=48–78%**；这种底座怎么蒸馏都补不出反墙/G5；
- `OBS6E9`（Wall 2.85/g、G5 28/23）与 `OBS6P9-S4000`（Wall 6.45/g、G5 33/25）已有完整反反弹/破盾主干；
- 从 E9/P9 出发的均衡蒸馏 `EQ-E9-A1` 可到 Wall 14.05/g、FieldA 40.6%、G5 3/3。

这条直接解释了本轮 Soup 线的失败：**我们一直在 US1/V3 的“墙 0、G5 50”底座上做 soup/教师**，方向本身是逆的。

### 2. 11 桌形高配额教师，2P 不是 1/8
`EQ-S4-E9` 的 `arenaShapes`（见 `scratch/arms/EQ-S4-E9.bak.meta.json`）：

```
2:standard ×3, 2:long, 2:multi, 3:multi, 5:multi, 8:multi,
3:long, 5:long ×2, 8:long
```

- 2:standard 占 **3/11 ≈27%**，不是均采 12.5%；
- 2P 能力主要由**共享主干**承载，光拼 `modeBias[standard]` 不够（Gemini 实测 70.6% 仍不恢复）；
- 加 **2:multi** 专门修 G4[multi] 的激光剑循环（86%→1–4%）。

### 3. 教师不是“一个强包”，是分桌形配比
`EQ-S4-E9` 的 `shapeTeachers`：

- 2:standard = bundled-champion 0.55 + EQ-S3-HYB 0.45；
- 2:long = EQ-S3-HYB 0.50 + EQ-E9-A1 0.50；
- 3/5multi = PG-EQ-SOUP70 0.35 + EQ-S3-HYB 0.25 + MSB14-railgun 0.20 + DEF-s15 0.10 + **breakAll 0.10**；
- 3/5/8long = EQ-S3-E9 0.25 + EQ-E9-A1 0.30 + PG-EQ-SOUP70 0.20 + OBS6P9 0.10 + **breakAll 0.15**。

**breakAll** 是关键新角色：同时监测 `guard/jinshield/proto/armor` 与 `reflect/bagua/shift`，优先锁防席释放 `laserEye/railgun/snipe/tank/cannon/bigT`；这比我们只盯 reflect 的 antiReflect 宽，也解释了为什么它能过 G5。

### 4. PG 有门控 KL，不是裸跑
- `--dmgW`、`--beadSpendW`、`--defTax` 塑形；
- `--klModes` 按模式门控 KL；裸 PG 1500 局就退化 charge/sword，全模式 KL 又会把 2P 锚死在 62–68%。

## 二、三枚“全过”包的真实差异

| 包 | 形态 | 2P | 长 C | G5 | 珠经济 | selftest3 |
|---|---|---:|---:|---|---|---|
| `EQ-S4-E9` | 纯迭代蒸馏 | **96.7%** | **0.2555** | 16/4 | 0% | **6/6 绿** |
| `EQ-SPL-75_S6m1` | 线性插值/满贯 | 91.0% | 0.1400 | 25/0 | **56.3% 闭环** | **红**（键级导数 11 处） |
| `EQ-G-75S6` | 线性插值/满贯 | 91.0% | 0.1400 | 25/0 | 56.3% | 腿 C 在 Coord5993 ReLU 折点 1.17e-3 |

补注：我实测 `EQ-S4` 2P **96.8%**、selftest3 6/6；`EQ-SPL` 2P 91.3%，但 selftest3 **红**（`guard/reflect/... logit[14]` 解析 0 vs 数值 ~1.4e-7，键级导数 11 处）。所以“全过”指的是 **promote 门**，不是数值可训练性。

独立复核（20:5x）：`EQ-S4-E9` 的 `promote-champion --dry --support=2` **通过，0 阻断**；G5[long]=16%、G5[multi]=4%；G4[multi] 最克「激光剑连刺」59.3%/60%（余 0.7pt，最薄的一格）；珠经济 0%（记录项）。

**选型**：
- 要干净、可直接接 PG、2P 最强：`EQ-S4-E9`；代价珠经济 0、G4[multi] 59.3/60 只剩 0.7pt；
- 要前线/珠经济/宽裕 G4：`EQ-SPL-75`；但先要用 S4 做教师重蒸馏，消掉插值数值病，不能直接开 PG；
- `EQ-SOUP-45_6535` 2P 94.2、长 C 更好但 G4[multi] 86% 挂，只能当教师。

## 三、可直接抄的训练配方

1. **底座**：从 `EQ-S4-E9` 或 `OBS6E9/P9` 起；不要在 US1/V3/Soup67 上继续。
2. **桌形**：2:standard 至少 2/11–3/11；加 2:multi；不要 8 桌均采。
3. **教师**：
   - 2P：bundled + HYB/E9；
   - multi：PG-EQ-SOUP70 + MSB14-railgun + DEF-s15 + breakAll；
   - long：EQ-S3-E9 + E9-A1 + P9 + breakAll；
   - 2:long/multi 单独配额，不要和 5/8 共用一个 modeBias 行（我们刚补的 `2:long` 行要对上）。
4. **PG**：`--dmgW/--beadSpendW/--defTax` + `--klModes`；先跑 `selftest3`，红就不开 PG。
5. **候选顺序**：
   - 先拿 S4 的干净全门包做基线；
   - 再把 SPL 的珠经济/前线行为**蒸馏回 S4**（S4 作学生、SPL 作教师，不用插值包当学生）；
   - 最后才考虑 PG 精修。

## 四、对我们的直接结论

- 我们本轮 Soup/antiReflect/antiTurtle 的路线是**在错误底座上修行为**；Gemini 证明先换底座后，G5/墙可以在一次均衡蒸馏里同时到位；
- 我们的 `2:long` 结构改动仍有用，但应配合 Gemini 的 11 桌形配额；
- 下一步训练如果继续，应以 `EQ-S4-E9` 为起点，不再复用 Soup67；
- `EQ-SPL` 只能当教师，不能当 PG 起点（selftest3 红，数值行为不可信）。

## 五、证据

- `scratch/arms/EQ-S4-E9.bak.meta.json`（完整 teacher/arena 配比）
- `scratch/arms/EQ-S4-E9.bak`、`EQ-SPL-75_S6m1.bak`、`EQ-G-75S6.bak`
- `docs/research/FINDING-2026-11-16-equilibrated-bases.md`
- 本地实测：`selftest3 EQ-S4 6/6`、`selftest3 EQ-SPL 红`、2P 96.8/91.3
