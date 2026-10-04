# 通宵自主工作 2026-10-05（Qoder）· 家族谱系 / 三维等值面 / beadseed-82 之谜 / 可训练方向

> 用户指令（10-04 23:4x，原话拆成四条）：
>   ① 把冠军演化网页挪到外面，不要放在很深的文件夹里；
>   ② 开新分支，研究三维行为轴里能否用**连贯的闭合曲面**圈出过线的冠军（要可开关，不然挡得严重）；
>   ③ 现在的"家族"标的是 seed 数字，看着像训练随机种子 ⇒ 那样没用，**至少要按"每次训练方法或目标大改"分家族**
>      （或许另做一个家族谱系图）；
>   ④ `v7-beadseed-82` 在不同 T 权重下几乎一直首位、却甚至没上过冠军 ⇒ 研究怎么回事；
>      并借这张图研究**后续还有哪些方向可训**。
>   干到明天早上 9 点。

## 进度板（防止失忆：DONE / DOING / NEXT + 实测时间戳）

**DONE**
- `23:4x → 23:5x` 新分支 `research/night-1005-lineage-3d-isosurface`（从 `e703171` = 刚快进过的 main 起）；
  §E303 查看器**挪到仓库根 `champion-map/`**（详见该节）。

**DOING**
- §E304 家族到底是什么：先证 `seed` 是不是纯随机种子，再找"方法/目标大改"的分界证据。

**NEXT（按用户的顺序）**
1. §E304 家族改成按训练方法/目标大改分（+ 可能的谱系图）。
2. §E305 `v7-beadseed-82` 长居榜首却从未当选 —— 三选一归因（尺坏了 / 当选层看不见 / 输了决赛）。
3. §E306 三维行为轴的闭合等值面（marching cubes + 开关 + 遮挡代价实测）。
4. §E307 从演化图读可训练方向（成片的"高 F 但没采样到"区域）。

---

## §E303（10-04 23:4x → 23:5x）查看器从 `docs/artifacts/e287-out/` 挪到仓库根 `champion-map/`

> 用户：「把这个冠军演化的网页挪到外面来，不要放在很深的文件夹里面了」

**做法**：`git mv` 九个文件（保留 git 的 R 重命名记录，不是一删一增），文件名一律去掉 `e287-` 前缀：

```
champion-map/
  index.html      ← e287-viewer.html   （双击就能看，自包含、无外部依赖）
  viewer.mjs      ← e287-viewer.mjs    （生成器：node champion-map/viewer.mjs）
  coords.tsv      ← e287-coords.tsv    （718 枚的坐标 + H/S/F/rank + 14 列行为）
  fit.tsv panel.tsv feas-s{1,2,3}.tsv feas.mjs
```

**挪目录真正会坏的地方**（都改并实测过）：`feas.mjs` 里 `ROOT = join(HERE,'..','..','..')` 和
`import ... from '../../../tools/audit-lib.mjs'` —— 新位置只比仓库根深一层，两处都少两级，
不改就是 `ERR_MODULE_NOT_FOUND`（**它不在生成页面这条路上，所以只跑页面根本发现不了**）；
另外 `--out=裸名` 以前经 `join(ROOT,…)` 落到仓库根，现在改成落本目录。
自检 = 真跑一枚过闸：`node champion-map/feas.mjs --limit=1` ⇒ 1.94s/枚、`def-31 ok=0 G=5.62 场B=0`，
与 §E298 记的 1.9s/枚 和"eco/def 这类老包栽在清场腿"一致。

**证据：这一挪是纯结构改动、零行为变化** —— 同一窗口尺寸、同一 dpr=1.75 下，
挪前 `shot-e302-map.png` 与挪后 `shot-e303-moved.png` **md5 逐位相同**（`61a3b75d…`）。

⚠ **留一个诚实的口子**：`coords.tsv` 是 `docs/artifacts/e287-out/e287-figs.mjs` 吃 `results/`（用户私有）
+ gitignored 臂产物算出来的 ⇒ 换机**不能重算**，只能带着这份 TSV 走。已把这句话写进 `viewer.mjs` 头注释，
免得下次有人以为 `node viewer.mjs` 能把坐标也重新算出来。`.gitignore` 里上一轮给 `e287-out/` 开的白名单随之作废
（新目录不在任何屏蔽规则里，不需要白名单）。
