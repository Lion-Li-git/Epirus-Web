# 门禁 ② 分诊台账（`gate-sentinel` 的「对源码做正则」族）· 10-20 DS

> 用户 10-19 的待办 T1（千问起的头，没做完）。这一份是**可续做**的台账：先把它变成"有界清单"。

## 一、总体

```
gate-sentinel --json ⇒ src = 125 条（门 279）
带就地理由（门体里写了"为什么这不是钉措辞"） 63 条
没有任何理由                              58 条   ← 这才是要做的工作面
```

> 「带就地理由」的判据：门体里出现「接线 / 删掉 / 行为真的变 / 不是钉措辞 / 单一来源 / 必须真到达 / 静态钉 / 防…忘」之一。
> 这是**文本启发式**，不是判定 —— 它只用来把 125 缩到 58，逐条仍要人看。

## 二、判定标准（每条只问一句）

**删掉这行代码，行为会不会变？**

- **会变** ⇒ **留**，并在门体里补一句**为什么它能留**（把理由写进去，下次就落在 63 那条里）；
- **不会变** ⇒ **改/摘**：留判据那半句、摘措辞那半句；纯散文的整条摘掉并在原位留 `§删` 注明"行为版在哪条门里"。

## 三、58 条清单（按文件，从小到大）

| 文件 | 条数 | 门 |
|---|---|---|
| `engine-rules.mjs` | 11 | D4 D51 D52 D53 D50 D63 D91 D92 D95 D96 D71 |
| `engine-fuzz.mjs` | 2 | D57 D98 |
| `meta-repo.mjs` | 1 | D82 |
| `train-evo.mjs` | 15 | D225 D44 D47 D48 D66 D74 D75 D77 D81 D85 D112 D123 D132 D162 D204 |
| `train-chooser.mjs` | 1 | D227 |
| `ship-promote.mjs` | 6 | D55 D61 D79 D103 D147 D168 |
| `train-table.mjs` | 3 | D223 D11 D89 |
| `train-pick.mjs` | 1 | D221 |
| `train-econ.mjs` | 1 | D119 |
| `train-feature.mjs` | 3 | D45 D65 D99 |
| `probe-instruments.mjs` | 4 | D83 D88 D148 D212 |
| `ship-feas.mjs` | 5 | D35 D49 D62 D73 D145 |
| `ui-contract.mjs` | 4 | D37 D38 D70 D111 |
| `train-env.mjs` | 1 | D181 |

## 四、建议的推进顺序（先小后大）

1. `ui-contract` 4 条 ‖ `train-table` 3 ‖ `train-feature` 3 ‖ `train-econ` 1 ‖ `train-env` 1 ‖ `train-chooser` 1 ‖ `ship-feas` 5 ‖ `probe-instruments` 4 ⇒ **22 条**，一轮能清；
2. `ship-promote` 6 ‖ `meta-repo` 1 ‖ `engine-fuzz` 2；
3. `engine-rules` 11（都是规则映射类，要逐条读）；
4. `train-evo` 15（最大，放最后）。

**每清一个文件就单独跑那个部分**（`--part=<该文件所属部分>`），并**故意打断一条判据**看它变红。

## 五、已经能看到的形状（供参考，不是结论）

- `engine-rules` 那批（D50~D53、D91~D96）看着像**规则映射的接线**，正是"删掉行为会变"那一类 ⇒ 多半是"留 + 补理由"；
- `train-evo` D123/D162 里已有**行为腿**，源码腿是"入口有没有接上" ⇒ 也偏"留"；
- `D99` 那批（`rs.indexOf('function protoReflectAll(state)')` 之类）是**纯源码串**，且带 `// v1.5.117` 这种版本注释 ⇒ **最像"该改成行为"的一类**。
