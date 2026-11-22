# STATUS 2026-11-22 15:00–16:05 — 坦克藤甲线：反射键手术失败

> 承接：TRAINING-RUN-LOG 中 AR-TK2 / AR-TK2-PG 行（11-22 14:2x）。
> 目标：把 AR-TK2 的 long 反射从 25% 压到 <20%，同时保住 arenaB ≥ 0；不改规则/尺。

## 结论

**在教师层摘 reflect 键不可行。** 反射与 armor 包的强度绑定：

- AR-TK3（armor 只教 armor 键）：反射标签 561→340，seat long 反射 6.7%，但 **arenaB 中位 -41.40pt**；
- AR-TK4（armor 恢复除 reflect 外全部键，0.50）：**arenaB 中位 -25.05pt**，仍远低于 AR-TK2 的 +10.36pt；
- AR-TK2 本身仍卡在 long 反射 25%（seatKill 线），AR-TK2-PG 机制留存但 arenaB -5.71pt。

⇒ AR-TK2 只能作为机制/教师资产留 scratch；ARMOR 的 hard 覆盖仍不能由这条线闭环。

## 实验读数

### AR-TK3

- 命令（可重跑）：

  node training/train.mjs --mode=supfit --up=docs/artifacts/obs6-coldstart/TZT2D.bak --teacher=pack:docs/artifacts/obs6-coldstart/TZT2D.bak --teacher2=pack:docs/artifacts/nov21-armor-tzt2d.bak --teacher2frac=0.30 --teacher2keys=armor --teacher3=tkWeak --teacher3frac=0.20 --teacher3keys=tank --rareOnly=tank --rareFrac=0.35 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6 --out=scratch/arms/AR-TK3.bak

- 训练：armor 标签 161、tank 145、reflect 340；学生自访留出 top-1 68.3%。
- promote --dry --support=2：**0 阻断**（F 21.5%、G4 42.3/44.3、G5 全 0、珠经济闭环 40.4%）。
- 人席 120 局：long 全程刷反弹 **6.7%**、multi 5.0%。
- **arenaB：med -41.3993 / spread 49.8561 / 6 粒 -52.51,-3.95,-40.84,-31.30,-53.81,-41.95 ⇒ 淘汰。**
- 产物：scratch/arms/AR-TK3.bak（未入池）。

### AR-TK4

- 命令（可重跑）：

  node training/train.mjs --mode=supfit --up=docs/artifacts/obs6-coldstart/TZT2D.bak --teacher=pack:docs/artifacts/obs6-coldstart/TZT2D.bak --teacher2=pack:docs/artifacts/nov21-armor-tzt2d.bak --teacher2frac=0.50 --teacher2keys=armor,guard,bagua,holo,proto,jinshield,transfer,shift,charge,bigT,gun,sword,snipe,ji --teacher3=tkWeak --teacher3frac=0.20 --teacher3keys=tank --rareOnly=tank --rareFrac=0.35 --groups=2400 --steps=450 --lr=0.002 --objective=cand --dagger=1 --shapeBal=1 --classPow=0.5 --classCap=6 --out=scratch/arms/AR-TK4.bak

- 训练：armor 313、reflect 313、tank 63；学生自访留出 top-1 65.5%。
- **arenaB：med -25.0458 / spread 39.7297 / 6 粒 -26.22,-23.87,-26.28,+5.22,-20.51,-34.51 ⇒ 未跑 promote（预注册 ≥0 已破）。**
- 产物：scratch/arms/AR-TK4.bak（未入池）。

## 判读

1. AR-TK2 的强度不是来自 armor 键本身，而是来自 armor 包全键道（含 reflect）与 TZT2D 的联合；摘 reflect 后强度按“摘得越干净、掉得越多”单调恶化。
2. AR-TK3 证明“低反射”可以做到（seat long 6.7%），但代价是 -41.4pt；AR-TK4 只回收到 -25.0，不够。
3. PG 也不是解法：AR-TK2-PG 保留因果（+13.66pt）但 arenaB -5.71，且不解决 long 反射。

## 后续（建议，不在本文执行）

- 停止“教师键过滤”路线，不再开 AR-TK5/6 同型臂。
- 若要继续 armor：换低反射底座重训，或训练后对 reflect 做显式动作惩罚/剪枝；PG 必须带 --klCand=1.0 且短程验证，先看 arenaB 不破线。
- hard 覆盖优先转向 firestorm / mine / cannon；armor 可保留“书面不做”或等新底座。
