---

# 第九段（10-29 03:0x）· 停手的一格：**rollout 标签的续局不能重写，只能整只搬**

`#143` 的前置试点（`scratch/rollout-pilot.mjs`，60 组 × rep8）没跑出来，现场很干脆：

```
js/train/policy.js:738  const r = state.rng.next();   → TypeError: state.rng.next is not a function
  at Object.chooseCandidates (policy.js:738)
  at greedyOf (evo.js:986)
  at evo.js:1098
  at rollout-pilot.mjs:35        ← 我自己写的"强制一手 + 焦点席之后续用 v7"那个闭包
  at Object.autoGameN (play.js:60)
```

⇒ 我照 `probe-myopia-regret.mjs:202 playRollout` 的**形状**手搓了一份（克隆状态 + 自定 rng + 强制一手 + 之后换回策略），结果引擎在 `greedyOf` 里拿到一个 **rng 不可调用**的状态。
⇒ 差别一定在原版那几个**看着像杂物的 plumbing**上：`deepFlag.v`（嵌套 rollout 的栈，注释明写"必须恢复而不是置 false"）、`RNGCUR` 压栈（§E204：每次"偏离对局"都要压/恢复）、`FRESHRNG`、以及 `N/FOCUS` 是**模块级**的（它的 FOCUS=1、还和 `--memisolate/--freshseats` 那几档纠缠）。
⇒ 所以这条的结论不是"rollout 标签做不了"，而是**做它的唯一正确姿势是把 `playRollout/outcomeStreams` 连同这套栈一起抽成 `tools/rollout-label-lib.mjs`，让原工具改吃 lib**；照形状重写会静默拿到错的续局（这次是当场抛，算运气好）。
⇒ 牙口（跑前就写死，不许事后补）：抽取前后各跑一次 `--dumpobs3` 小样本，**逐行比 `winS` 必须完全一致** ⇒ 不一致就是搬错了；这条也正是 §㉖"重写 vs 抽取"与"覆盖式接入要自证真被调用"那一族的第三次现场。

顺带留在盘上的两件事，明早可以直接接：
1. `scratch/N-obs3-labels.jsonl`（修好 `winS` 之后的 210 维 × 8 流标签，昨夜后台在落）——抽取做完就能直接喂 `rankfit --labelmode=rollout`；
2. 主判据已经换了：**不看组内一致率**，看 `profile2 --temp=0.001` 的 Δ夺1(2.0 − 同结构随机起点)（SE≈1.0pt，>+2pt 才算路线成立；<−2pt 且剖面仍塌成 e:98 ⇒ 转序列级目标）。
