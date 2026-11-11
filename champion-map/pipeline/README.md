# pipeline/ · champion-map 数据模型 A

> 2026-11-11 起：**源头是 data/ 的长表**；build/ 是编译产物；页面暂时仍吃 coords-projcols.tsv，下一步才切到 build。

## 数据文件

| 文件 | 一行 | 关键列 |
|---|---|---|
| data/registry.tsv | 一份权重 | pack_id/path/ver/fam/fam_label/lineage/ts/sha256 |
| data/rulers.tsv | 一把尺 | ruler_id/axis/status(current/reference/frozen)/fixture/batch_id/formula |
| data/batches.tsv | 一次考试批次 | batch_id/ruler_id/axis/fixture/champ/run/source/rows |
| data/readings/current.tsv | 一条读数 | pack_id/ruler_id/cell/horizon/value/n/batch_id |
| data/readings/h5-frozen.tsv | 旧 H5 参考 | 只读；流水线不写 |
| data/features.tsv | 一份权重的行为 | rounds/dmg/.../S/Geff |
| data/projections.tsv | 一份权重的投影 | xt/yt/xt3/yt3/zt3/xt18/...；换尺不动 |

## 换尺接口

换尺 = **追加 readings + 改 current 指针**，不动 projections：

```bash
# 1. 在 data/rulers.tsv 加一行新尺（status=reference），旧尺改 reference
# 2. 用新 ruler_id 追加 data/readings/current.tsv
node champion-map/pipeline/rulers.mjs --set-current=<new_ruler_id>
node champion-map/pipeline/build-view.mjs --compare=champion-map/coords-gen3-1105.tsv
```

- H5 是 frozen：`--set-current=h5-page-1109` 会 exit 2；没有写它的路径。
- C 是派生尺（formula=(A+B)/2），不存 readings；A/B 换尺后 C 自动重算。
- projections.tsv 由 pack_id 关联，换尺绝不改它。

## 命令

```bash
# 一次性 backfill（926 行 → data/；已有 data 要 --force）
node champion-map/pipeline/backfill.mjs

# 编译考卷视图 + 与 coords-gen3 逐值对照（0 mismatch 才过）
node champion-map/pipeline/build-view.mjs

# 数据模型门（发布前 --strict：每枚 16 格齐全）
node champion-map/pipeline/validate.mjs --strict

# 当前尺清单
node champion-map/pipeline/rulers.mjs --list
```

## 新点进图（下一步）

目标是一条命令走完：
```
add-point --pack=... --id=... --ver=2.0 --readings=<批表> [--bake]
  → 登记 registry → 追加 batch/readings → validate → build-view → 页面重烘 → shot 98/0
```
当前 **尚未实现 add-point**；先完成数据模型 A 的 backfill/对照/门。
