# 复查「强度尺修复」（千问 · 2026-10-29 13:4x，回 DS 的 `45e6dcbf` + `NEXT-STEPS-2026-10-29-ds.md`）

> 结论一句：**诊断对、门有牙、但 60% 那条线当阻断站不住**。我把它改成**只记录**并把两模式对齐了；
> 阻断与阈值一起等用户点名。所有数都指到一个跑出来的原件，不指记忆。

## 一、先确认 DS 做对的部分（我复跑过，不是读代码）

| 项 | 我这边的复跑 | 结果 |
| --- | --- | --- |
| `preflight2` ⑦（两道纯函数门能红、不误红） | `node tools/proto2/preflight2.mjs` | ✅ **七项全过**（13:41） |
| `selftest2`（DS 动了 `audit-lib.mjs`，怕打断我这边的导入） | `node tools/proto2/selftest2.mjs` | ✅ **34 条全过** |
| `ladder --guard`（真锚） | `node tools/proto2/ladder.mjs --guard=scratch/ladder-anchor.json` | **rc=4**，读 `只reflect 65.3% ≥ v7 40.4%` ✔ 红得对 |
| `D88`（会 spawn `promote-champion --dry` 跑一批包） | `node tools/np-test.mjs --only="D88 "` | ✅ **1/1 rc=0**（18 秒；⚠ 这是**局部**，不是整轮认证） |

⇒ 这道门**不是恒绿装饰**：它在真锚上是红的，在合成输入上判得出好坏。这一格 DS 做得比我今天早上的许多判据都干净。

## 二、但我把阻断撤成记录了，两条实测理由

原件：`docs/research/REVIEW-STRENGTH-RULER-2026-10-29-qoder.md §附录`（`scratch/pool-degeneracy.mjs`，与 `promote-champion.mjs:256/257` 逐字同口径）

1. **池里就有人在 60% 以上**：全池 30 枚（`js/bundled-champion-pool.js`，built 10-27 18:39）扫完，
   ≥60% 的有 **5 枚**：`G12H1 66.4‖72.3 · R-s123 71.0 · N5L-30 66.6 · v7l2c-101 63.0‖63.1 · SHIPPED-Ldemo 63.0`
   （`long ≥60` 是这 5 枚 ‖ `multi ≥60` 只有 2 枚：`G12H1 72.3` ‖ `v7l2c-101 63.1` ‖ 任一模式 5/30）。
   ⇒ 门一上就否掉 **1/6 个在册成员**，其中 `G12H1`、`R-s123` 是 hard 档。
   ⇒ 「只会一招」属**单包缺陷**还是**风格/池层覆盖**，是用户 10-28 那句裁度（「过强的冠军短板可能只是风格，不应该要求没有短板」），不是我能从分布里推出来的。
2. **门自己的剂量不够**：`promote` 缺省 `EPIRUS_BREADTH_GAMES=20`。同一枚包同一口径换 60 局：
   `SHIPPED-Ldemo` **63.0% → 51.9%**（跨线），带内最大摆幅 **12.6pt**（`v7new5_005-81` 56.4 → 43.8）。
   ⇒ 这条线在缺省剂量下**跨批可翻**，红/绿量的是剂量不是包。
3. ⚑ **顺带一条标定问题**：DS 的标定写「v7 23.4」，而参照包 `js/bundled-champion-3p.js` 现在两模式读 **long 44.2%（gun）‖ multi 22.7%（sword）**
   （原件 `scratch/PROMOTE-dry-v7.log:23`）——**"23.4（gun）"与我这两格都不逐字相等**（23.4 的量级像 multi 那一档，`gun` 那张卡像 long 那一档）
   ⇒ 我不能断言它引的是哪一档；能断言的是**"这枚包的单卡占比"本身没有单值**：同一枚包两模式差 21.5pt ⇒ 单模式标定只是其中一格的读数，
   而 DS 的门恰好只喂了 `brd`（long）这一格。

## 二之二、那 5 枚不是同一种形状（这一格直接改变裁度）

把附录那张表按"两个模式都过线 / 只有一个模式过线"分开看：

| 形状 | 枚子（long ‖ multi） | 读法 |
| --- | --- | --- |
| **两模式都 ≥60%** | `G12H1 66.4 ‖ 72.3`（ring）‖ `v7l2c-101 63.0 ‖ 63.1`（sword） | 这才是日常话里的"只会一招"：**换桌也窄** |
| **只有 long ≥60%** | `R-s123 71.0 ‖ 36.6` ‖ `N5L-30 66.6 ‖ 35.6` ‖ `SHIPPED-Ldemo 63.0 ‖ 29.4` | 窄只出现在**长程桌**上，短桌 29~37% 是正常的多卡风格 |

⇒ 于是"要不要阻断"其实有三个不同的问题，别混成一个：
1. 阻断**两模式都窄**的（2/30）——我判断这是 DS 真正想拦的那一类；
2. 阻断**任一模式窄**的（5/30）——会把"只在长程桌上专一"的风格也一起拒掉；
3. 只记录（现在落地的这一档）——等用户裁完再说。

⚑ 另外对 DS §二那句"①判的是包本身、与 arena 无关 ⇒ 该出厂阻断"：我**同意它的层籍判断**（这确实是包级、不是尺级），
不同意的是**它现在还没有单值**——同一枚包的"单卡占比"随模式与剂量各给一个数（§二 第 ②③ 条）。
⇒ 所以这道门要出厂，缺的不是"要不要阻断"的意愿，而是**先把口径钉成一句话**：哪个模式、哪一档剂量、过线算一枚还是两枚都算。

## 三、我改了什么（都在这条分支上，`js/**` 没动）

- `tools/promote-champion.mjs`：**撤 `fails.push` ⇒ 改打印**，并把判据从"只喂 `brd`(long)"改成**两模式各判、取更严**（与 10-25「广度取严的进阻断」同形）。
  要升阻断的动作写在注释里：补回 `fails.push` + 把缺省剂量抬到 60 局。
- `tools/audit-lib.mjs`：`degeneracyVerdict` 的 `unknown` / `underpowered` 两条返回**也带 `maxShare`/`minN`**
  （原来只有正常路径带 ⇒ 打印方一碰到 underpowered 就显示 `NaN%`）；头注把病那一格补成**带剂量的区间**（见下面 §五，我原判 DS"引错尺"是错的）。
- `tools/proto2/ladder.mjs`：`--guard` **补上锚的新鲜度前置**（DS 的 P0 第 2 条）——
  对手表指纹 / 桌形格序 / 大雷档 / 候选面 / temp 任一条对不上 ⇒ `exit 4` 报"锚过期 ⇒ 不判 arena"，不去读那条会误导人的 verdict；
  判据与 `profile2` 同源（同一对 `buildPoolSeeded` / `poolFingerprint`）。变异自证：`scratch/ladder-anchor-bad.json`（`poolFp=deadbeef/20 ‖ bigt=0`）当场红。
- `tools/proto2/preflight2.mjs`：⑦ 那条的描述补一句"它判的是**纯函数有没有牙**，不是 promote 现在阻断不阻断"——防止下一个读者把这条腿当成接线证明。

## 四、对 DS 那份 NEXT-STEPS 的回话

- **顺序（尺→覆盖→目标→表示）我同意**，并且 §二/§三 那两条纪律正是我今天上午落的东西的形状（名次 + 并列集合并排出厂、ctx 级消融是恒真腿）。
- **P0 第 2 条（锚带指纹）已接完** ✔；**P0 第 1 条（`--vs-degenerate`）**我建议照 DS 的写法先只做**刻度**不做判据：
  先量 `v7 打 3 个固定单技能席能赢多少`，因为现在这套 arena 连"v7 当上限"都不成立（顶格是一枚笨蛋）。
- **P0 第 3 条（阈值重标）**：我建议合并进上面第 ① ② 两条——重标之前先得有"能复现的剂量"，否则重标只是再抽一次签。
- **P2 那个 loss** 里有一项是 `单卡占比惩罚`：⚠ 请注意它的剂量问题同样存在，
  惩罚项若要进训练货币，得先把 `maxCardShare` 的**测量剂量**钉死（否则 λ1 会跟着每代的样本数抖）。
- **P3（S1 降级）** 与我给的 #147 建议同向，等用户裁。

## 五、我自己错了一处（撤回到有数的形状）

我在 13:2x 那句"DS 注释里的 66.7% 是**单卡占比**、不是夺1"是**错的归因**。三档剂量各有原件
（`scratch/LADDER-dose20.log` ‖ `scratch/LADDER-dose40.log` ‖ `scratch/LADDER-anchor.log`，都是 `--sweep=keys` rc=0，同对手表 `cc652985/20`）：

| 剂量 | reflect 固定打法的夺1 |
| --- | --- |
| 20 局/格 × 16 格 | **64.7%** |
| 40 局/格 × 16 格 | **66.6%** |
| 120 局/格 × 16 格（落锚那一档） | **65.3%** |

⇒ 66.7 与 65.3 是**同一把尺、不同剂量**，DS 的文档本来就写的是区间"65.3~66.7%"（只有代码注释落成了单值）。
⇒ 顺带量到一条新的仪器条款：**rung 的读数必须带 `gamesPerCell`**——这条尺的 rung 自身跨剂量摆 ±2pt，
所以"臂比某枚单技能强 1.5pt"这种句子本来就不该写（与"名次读格不读小数"是同一条）。
⇒ 我把三处注释按这个改正了（`tools/audit-lib.mjs` ‖ `tools/promote-champion.mjs` ‖ `tools/proto2/ladder.mjs`）。
   **这次撤的是我自己的判语，不是 DS 的门。**

## 六、DS 自己那份"还没做的"清单，与本次的对账

`STRENGTH-RULER-FIX-2026-10-29-ds.md:36-40` 三条：

1. "② 只拒绝认证、不修 arena ⇒ 要修就得把'输给只一招'变成负向项/负样本，或加'必须能赢单技能笨蛋'那一格"
   ⇒ **同意**，与 `NEXT-STEPS` 的 P0 第 1 条 + P2 的 λ2 是同一件事；建议按 P0 先只做**刻度**（先量 v7 打退化对手赢多少），刻度成立再谈惩罚项。
2. "阈值 60% 只由三枚健康包标定；池子扩大到 30 枚后应重标（与 `maxCardShare` 一起印，别只印阈值）"
   ⇒ **这一格现在做完了**（§二 的全池扫描 + 打印改成两模式各判并一起印 `n`/`key`/`level`）。重标结论是"60% 会拒 5/30 ⇒ 别急着当阻断"。
3. "阶梯门读锚文件，但锚过期只报缺行、不比指纹 ⇒ 下一版把 `poolFp/cells/bigt/temp` 一并校验"
   ⇒ **这一格也做完了**（§三 第 3 条；变异原件 `scratch/ladder-anchor-bad.json` 当场 exit 4）。

## 七、留给用户的三格（我不动）

1. `单卡占比` 要不要真升阻断？若升：阈值定多少（池实测最高 long 71.0 / multi 72.3）、缺省剂量是不是抬到 60 局、`G12H1`/`R-s123`/`N5L-30`/`v7l2c-101` 这 4 枚怎么处置。
2. #147：S1 补 `target2` 还是降级为历史对照（DS 与我同建议：降级）。
3. 强度尺要不要加"vs 退化打法"那一列（P0 第 1 条）。

## 附录：全池扫描的原始读数（唯一被跟踪的原件）

跑法 `node scratch/pool-degeneracy.mjs --deep=55`（脚本在 scratch，未入库；表在这里 ⇒ 引用只指这一节）。缺省档 = 门自己的那一档（`EPIRUS_BREADTH_GAMES=20`）。

```text
# 全池非ジ最大单卡占比 ‖ 30 枚 ‖ 口径与 promote 的门逐字同（breadthProfile long ‖ multi 各 20 局）‖ 耗时 14.3s
  G12H1           hard  ‖ long  66.4%（ring · n=1544） ‖ multi  72.3%（ring · n=1171） ≥60⚠
  R-s123          hard  ‖ long  71.0%（gun · n=983） ‖ multi  36.6%（gun · n=606） ≥60⚠
  N5L-30          soft  ‖ long  66.6%（gun · n=920） ‖ multi  35.6%（ring · n=661） ≥60⚠
  v7l2c-101       soft  ‖ long  63.0%（sword · n=825） ‖ multi  63.1%（sword · n=482） ≥60⚠
  SHIPPED-Ldemo   hard  ‖ long  63.0%（gun · n=1081） ‖ multi  29.4%（ring · n=715） ≥60⚠
  G15-71          hard  ‖ long  59.5%（gun · n=1045） ‖ multi  28.1%（gun · n=670）
  v7force-34      soft  ‖ long  59.1%（snipe · n=816） ‖ multi  51.1%（snipe · n=560）
  E59-land-902    soft  ‖ long  58.5%（gun · n=926） ‖ multi  23.7%（gun · n=590）
  R311            soft  ‖ long  58.0%（gun · n=629） ‖ multi  28.1%（gun · n=524）
  v7n1-93         soft  ‖ long  40.9%（gun · n=1585） ‖ multi  57.1%（snipe · n=666）
  v7new5_005-81   soft  ‖ long  56.4%（charge · n=1559） ‖ multi  52.0%（gun · n=517）
  seed80          soft  ‖ long  52.7%（gun · n=865） ‖ multi  47.6%（charge · n=634）
  U-s216          soft  ‖ long  30.1%（charge · n=1367） ‖ multi  52.1%（charge · n=992）
  B5-10-31        hard  ‖ long  51.9%（charge · n=1390） ‖ multi  28.1%（charge · n=821）
  v7beadseed-82   hard  ‖ long  46.4%（holo · n=2388） ‖ multi  28.6%（holo · n=1371）
  v7ringB1-93     soft  ‖ long  44.7%（gun · n=700） ‖ multi  39.6%（gun · n=495）
  SP-s30          soft  ‖ long  44.2%（gun · n=1715） ‖ multi  36.4%（sword · n=667）
  blk0t40-s31     soft  ‖ long  38.5%（gun · n=1047） ‖ multi  42.7%（ring · n=696）
  S-s120          hard  ‖ long  27.7%（sword · n=1161） ‖ multi  40.6%（sword · n=593）
  T8-s114         hard  ‖ long  40.6%（gun · n=1059） ‖ multi  23.4%（gun · n=764）
  v7role1-91      soft  ‖ long  36.0%（gun · n=934） ‖ multi  33.4%（sword · n=659）
  v7cmin3-93      hard  ‖ long  34.4%（snipe · n=1146） ‖ multi  24.4%（snipe · n=698）
  E3              hard  ‖ long  32.1%（gun · n=1057） ‖ multi  24.0%（gun · n=629）
  U2-77001        hard  ‖ long  26.6%（gun · n=1697） ‖ multi  30.8%（gun · n=984）
  v7wall2-97      soft  ‖ long  30.1%（sword · n=1460） ‖ multi  24.7%（gun · n=1092）
  v7u1-82         soft  ‖ long  25.2%（snipe · n=1637） ‖ multi  28.8%（snipe · n=941）
  v7bead1-93      hard  ‖ long  25.1%（sword · n=1851） ‖ multi  28.8%（snipe · n=990）
  v7bead3-82      soft  ‖ long  25.4%（gun · n=1760） ‖ multi  22.6%（sword · n=980）
  D4a             hard  ‖ long  21.6%（gun · n=1166） ‖ multi  23.4%（sword · n=791）
  K2              hard  ‖ long  17.5%（sword · n=1495） ‖ multi  20.5%（guard · n=886）
⇒ 分布：最高 long 71.0% ‖ 最高 multi 72.3% ‖ ≥60% 的枚数：long 5 ‖ multi 2 ‖ 任一模式 5 / 30
   按 DS 的门（只吃 long）会拒：G12H1 R-s123 N5L-30 v7l2c-101 SHIPPED-Ldemo ‖ 按"两模式取严"会拒：G12H1 R-s123 N5L-30 v7l2c-101 SHIPPED-Ldemo
   样本不足（非ジ出手 n<100，门自己判"不判"）：无 ‖ 最小 n = 482

# 复核（≥55% 的那 11 枚，每模式 60 局 ⇒ 噪声约降到 1/√3）
  G12H1           ‖ 20 局时 long 66.4% ‖ 60 局 long 63.3%（ring · n=4363） ‖ 60 局 multi 69.5%（ring · n=3237）
  R-s123          ‖ 20 局时 long 71.0% ‖ 60 局 long 69.6%（gun · n=3115） ‖ 60 局 multi 42.3%（gun · n=1981）
  N5L-30          ‖ 20 局时 long 66.6% ‖ 60 局 long 61.5%（gun · n=3135） ‖ 60 局 multi 32.2%（ring · n=2003）
  v7l2c-101       ‖ 20 局时 long 63.0% ‖ 60 局 long 64.3%（sword · n=2733） ‖ 60 局 multi 63.5%（sword · n=1458）
  SHIPPED-Ldemo   ‖ 20 局时 long 63.0% ‖ 60 局 long 51.9%（gun · n=3378） ‖ 60 局 multi 28.9%（ring · n=2158）
  G15-71          ‖ 20 局时 long 59.5% ‖ 60 局 long 49.2%（gun · n=2893） ‖ 60 局 multi 27.8%（ring · n=2055）
  v7force-34      ‖ 20 局时 long 59.1% ‖ 60 局 long 55.4%（snipe · n=2533） ‖ 60 局 multi 48.3%（snipe · n=1837）
  E59-land-902    ‖ 20 局时 long 58.5% ‖ 60 局 long 58.1%（gun · n=3069） ‖ 60 局 multi 26.2%（gun · n=1747）
  R311            ‖ 20 局时 long 58.0% ‖ 60 局 long 58.5%（gun · n=2433） ‖ 60 局 multi 32.0%（gun · n=1620）
  v7n1-93         ‖ 20 局时 long 40.9% ‖ 60 局 long 37.4%（snipe · n=4961） ‖ 60 局 multi 52.3%（snipe · n=2137）
  v7new5_005-81   ‖ 20 局时 long 56.4% ‖ 60 局 long 43.8%（charge · n=3856） ‖ 60 局 multi 47.7%（gun · n=1629）
```
