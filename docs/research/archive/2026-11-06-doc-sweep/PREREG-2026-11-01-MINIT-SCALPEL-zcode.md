# PREREG：miniT 手术刀臂——DAgger×靶向 一发判清（ZCode · 11-01 下午）

> 回答白天班交接件 §6 第 3 题（千问）：miniT 的墙（教师态拟合 100% 含选靶、自访态语义 8.3%）是不是 ring 同类
> （"教师自己不出这一手"）？千问的修法两件已入库：`--dagger` 哨兵修复（此前有时整轮空转）+
> `rareOnly` 稀有筛去掉 `srcParams==null` 条件（**学生轮也受筛**）。本臂把两件合起来：
> **学生态 + 只收教师选 miniT 的组（DAgger×靶向）**——这是夜班 §九"需要自己分布上的靶向标签"的直接实现。
> 判据先于臂提交（提交时刻早于产物 mtime）。

## 一、臂定义（一发）

```
node tools/proto2/supfit-gd.mjs \
  --upstream=scratch/arms/OB3S-C2-s7.bak --teacher=minit --objective=cand \
  --groups=1600 --shapeBal=1 --dagger=2 --rareOnly=miniT --rareFrac=0.7 \
  --out=scratch/arms/mt2-dagrare.bak --tag=mt2-dagrare
```

与夜班 `mt-OB3S-cand`（语义 4/57 ✘、浪费 60%）**只差三格**：`dagger 0→2`、`rareOnly ''→miniT`、`rareFrac 0→0.7`。
仪器修复的影响由 meta 自证：`supfitGd.roundsMoved` 必须非零（粒子真动了，否则 exit 7 当场响）。

## 二、判据（读 `skill-mastery` 小雷线：用量 ≥0.2/局 ∧ 预示代理命中 ≥1/2，40 局/格）

- **M-1 过（墙=采样）**：语义命中 ≥1/2 且用量 ≥0.2/局 ⇒ 夜班"协变量漂移的靶级版本"成立，
  修法就是 DAgger×靶向，miniT 桶线开工。
- **M-2 败（墙=语义/泛化）**：用量 ≥0.2/局 但语义 <1/2 ⇒ 连"学生态上的靶向标签"都教不会选靶，
  剩余解释只有两个，如实记档不找补：① cand 级三向目标 dof 的样本量/容量仍不够（一组 1600 富集不够就到头）；
  ② 预示代理窗（ep≥2 ∧ 4 回合内蓄过珠）与教师选靶条件系统性错位——那是**代理窗**的错，不是学生的错。
- **M-3 空臂**：用量塌回 0 ⇒ DAgger×rare 在学生态里找不到代理阳性（比夜班"稀释"更狠的形态），同样记档。
- 附带必读：浪费率/花珠率（夜班 cand 臂的珠经济破坏要在新臂上复查）、5P/3P 考卷、`roundsMoved`。

## 三、边界

只跑这一发；M-2/M-3 都不追加"再调一版"的臂（那是下一班的题）。产物只落 `scratch/arms/`，不碰池与 main。
