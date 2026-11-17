# FINDING · 2026-11-17 · 家族 24/25 收容所修复：V3 归并 + MX 分代

> 用户观察：图上“一堆点在家族24，家族25只有两个”。核实为真：fam24=统一单包 30 枚，fam25=V3 仅 2 枚。
> 范围：只改家族/谱系/图数据与 add-point 自动归族，不动包权重、池、promote 判据。

## 一、根因

1. **24/25 被对调**：`eac2aeef` 时 fam24=V3、fam25=统一；11-17 03:xx 为修 `rebuild-map` 家族行序（BASE 11-14 早于 V3 11-15）做了 fam24↔25 对调 ⇒ 编号语义反了。
2. **V3 系列拆散**：`V3a/V3b/B2` 留在 fam23（`2.0 obs6 v7 蒸馏`），只有 `V3S2/V3H3` 在 fam25 ⇒ 看起来只有 2 枚。
3. **fam24 成收容所**：`add-point` 只按 `dims.modeBias===1` 把所有 obs6.5 包归入“统一单包”标签；BASE/U/EQ/MX1–MX8 全塞 fam24 ⇒ 30 枚。

> **编号二次整理（11-17 下午）**：GD4-RATION 并入 fam19；原 fam21–26 顺次减一，得到当前 fam20–25。根因段保留当时的旧号，下表是当前号。

## 二、修复后

| fam | 标签 | 枚数 |
|---:|---|---:|
| 11 | 臂线·env 实验（旧 v7） | 51 |
| 19 | 2.0 obs5 课程链（反墙/配给教师 · 11-09~11） | 20（含 GD4-RATION） |
| 20 | 2.0 GD6 蒸馏多线（11-12） | 4 |
| 21 | 2.0 obs6 无教师冷启动（11-14） | 8 |
| 22 | 2.0 obs6 v7 蒸馏（11-14） | 11 |
| 23 | 2.0 obs6.5 统一单包（11-16）（含基座/U/EQ） | 15 |
| 24 | 2.0 obs6 V3 融合/路由（11-16） | 5 |
| 25 | 2.0 obs6.5 键道/覆盖训练（11-17） | 15 |

- V3a/V3b/V3S2/V3H3/OBS6B2 全部归 fam24；
- MX1–MX8 全部归 **fam25 `obs6.5 键道/覆盖训练`**（同一训练方法，不再按代拆 4 族）；
- 族号仍按最早 ts 递增：24（BASE 11-14）→25（V3 11-15）→26（MX1 11-16 16:34）；
- 当前最大 fam=26，`FAM_SLOTS=30` 尚够。

## 三、工具修复

- `champion-map/pipeline/add-point.mjs` 新增 `autoFamLabel(id, dims)`：
  - `MX[1-8]-*` → fam25（键道/覆盖训练，统一方法族）；
  - `OBS6-SHAPEDIST-V3*` / `OBS6B2` → fam24；
  - 其余 `modeBias===1` → fam23（统一单包）。
- 以后新 MX 包不再默认塞进统一族；分代族按标签查已存在号，找不到才新开。

## 四、二次校正：单包族是 fam11，不是 fam20

- 用户指出：真正的单包族是 **fam11**。核实：viewer 的 `DATA.fam` 来自 `lineage.tsv`；registry 里 fam11 有 **51 枚**，但 lineage 里只有 `clone-79101` 一枚是 fam11，`B-s63/T8-s114/Q-s47` 等旧 v7 全被写成 **fam8**（`臂线·env 实验`）。
- 根因：registry ↔ lineage 有 **245 处家族列不一致**；图一直读 lineage，所以旧 v7 被折进 fam8，fam11 只剩 synthetic 的 `clone-79101`。
- 修复：以 registry 为单一真源，把相同 id 的 `fam/famLabel` 回写 `lineage.tsv`（369 行）与 `lineage-g3.tsv`（4 行）；现在两表 fam11 都是 **51 枚**，旧 v7 回到 fam11，不再有单包族。
- fam20 的 GD4-RATION 合并与 fam21–26 顺次减一仍然保留；fam11 的 51 枚是旧 v7 线，不是这次新造的。

## 五、验证

- `node champion-map/rebuild-map.mjs`：**100 PASS / 0 FAIL**，页内自检通过；
- `node tools/np-test.mjs --part=meta-repo`：**13/13**；
- registry 与 lineage-g3 行数/族号一致；
- 未动 `js/bundled-champion-pool.js`、pool-members、promote 判据。

## 六、遗留

- 统一族 fam23 仍含 15 枚（BASE/U/EQ）；如果还要更细，下一步可按 U/EQ 与 MX 矩阵再拆；
- 当前 MX 代表只保留图上 4 枚，分族后不会再出现“全在 fam23”的视觉。
