## 后台：只跑了一个，已经停了

`MSB5`（我上一条发的「每局都上冠军席」那轮）在你喊停之前就已经起跑了，刚才查到它还在跑 —— **已 kill**。现在没有任何后台任务。

## 你说的兼容性是对的，而且比蒸馏更省

我去看了实现，结论比预想的好：

- `EpirusPolicy2.checkPack` **本来就是按「包自己的 dims」建布局**（gen/input 白名单 + dof 表 + 段表对账），**不依赖当前训练 spec**；
- v7 包走 `policy.js` 的 legacy unpack（也早就支持）；
- 所以 obs3b/obs4 的冠军**原则上能直接当对手**，不需要蒸馏。

**唯一阻塞**：`tools/train-3p.mjs` 的沙箱里拿不到 `EpirusPolicy2` 句柄（`installArch2` 把面装上了，但没把 Policy2 对象挂到 `window`）⇒ 我上一版双路加载取到 `undefined`，才一直报「同架构才行」。

修法很小：`arch2.install()` 里加一行 `W.EpirusPolicy2 = P2`，然后 `FIT_CHAMP/COURSE_PACK` 走「v92 → Policy2.unpack，v7 → legacy unpack」双路。

## 已把计划改掉

`PLAN-2026-11-10-afternoon-ds.md` 的 **A 步**从「蒸馏 3 枚教练（30 分钟）」改成 **「训练直接吃 v7/obs3 冠军（20 分钟）」**，判据变成：

- `FIT_CHAMP=G5C-100`（obs3b 墙）、`FIT_CHAMP=Q-s47`（v7 反墙专家）都能载入；
- 训练局里 `FIT_STAT.fired > 0`（真上了桌）；
- 1 代 smoke 不崩。

止损：前向抛错（面/段不兼容）⇒ 退回蒸馏路线。

**这样 A 步跑完，我们就能直接拿「真墙 G5C」和「反墙专家 Q-s47」当教练**，而不是用自己复制自己。要我开始改这一行 + 双路加载吗？