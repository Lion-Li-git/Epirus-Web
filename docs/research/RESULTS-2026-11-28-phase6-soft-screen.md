# 研究结果：2026-11-28 Phase 6 soft 靶点筛选

> 对应计划：[`PLAN-2026-11-27-overnight-qwen.md`](PLAN-2026-11-27-overnight-qwen.md)。
> 当前池基线：`v2.1.45`，35 枚 `hard 17 / soft 18`。
> 证据目录：[`evidence-2026-11-27-overnight-qwen/`](evidence-2026-11-27-overnight-qwen/)。
> 完成时间：2026-11-28 01:45（UTC+8）。

## 1. 靶点快筛

候选 `L1B-S1200` 对三枚 soft 弱包做同 seed 同位替换，全部保序：

| 靶点 | 普通档最差 | 简单档最差 | 覆盖结论 |
|---|---:|---:|---|
| MSB11-R1S130778313 | −1.30pt | −2.00pt | mine `2→1`、proto `3→2`、tank `4→3` |
| RINGB11 | −0.90pt | −1.50pt | 无深度损失，bagua/curse/drain/ring/snipe 各 +1 |
| SOFT-RING-C3G25 | 0.00pt | −2.80pt | firestorm `2→1`、jinshield `5→4` |

选择 `RINGB11`：覆盖只增不减，且 ladder 代价小于另外两枚。

## 2. RINGB11 全矩阵

| 视图 | hard | regular | sparring |
|---|---:|---:|---:|
| 2P rule（8 seed） | 0 | −0.9625 | −0.9375 |
| 2P legacy（8 seed） | 0 | +0.0875 | +0.1000 |
| 5P multi（4 seed） | 0 | −0.0500 | +0.1500 |
| 5P long（4 seed） | 0 | −0.2500 | −0.4250 |

全部 seed 保持 hard < regular < sparring。2P rule 退化未超过 2pt；5P long 两档约 1σ，未触发 ≥2σ 止损。

## 3. 裁定

- `L1B-S1200` 通过 Phase 6 筛除，进入第二次完整入池链，原位替换 `RINGB11`。
- 候选已有 `selftest3`、Stage 1/2、promote、A/B/C 和两 seed 人席 `seatKill=0` 证据；入池前按已跟踪路径重算人席并保存当前池基线。
- 本替不覆盖 `dualGun/mirror` 缺口，也不改变规则指纹 `c61298e6`。
