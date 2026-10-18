# 本轮原始证据归仓 · 2026-10-18 夜二段（§E648~§E650：先验口径拆档 + Hp/Hplong 重跑 + 训练侧送盾 veto）

研究日志：[../../logs/2026-10-18-beadseed82-qoder.md](../../logs/2026-10-18-beadseed82-qoder.md)（文中把本目录写作 **`归档/`**），分支 `qoder-1018-night2`；
计划、判线与机理勘察三份文档都在 `docs/research/` 下（不是本目录）：`PLAN-2026-10-18-night2-qoder.md` ‖ `PREREG-2026-10-19-gift-veto-qoder.md` ‖ `DESIGN-2026-10-19-train-side-gift-qoder.md`。
本目录存在的理由与上一批相同：**这些数只有结论表在 git 里，产出它们的脚本与原始日志原本只在会话临时工作区** ⇒ 干净克隆里既没路径也没脚本。

## 一、清单 → 对应哪一格

| 文件 | 产出的读数 |
|---|---|
| `strength-batch.sh` + `strength-E648.log.txt` + `strength-E648.runner.log.txt` | §E648 六 的 54 格三档强度重测（off/strict/prod × 3 起点 × 2 桌 × 3 seed，200 局/格）‖ 收尾行 `STRENGTH_DONE 54 格` |
| `strength-recheck-strict.sh` + `strength-E648b-strict.log.txt` | A1b 修 `pick='max'` 之后**重跑的 strict 三起点**（18 行）⇒ 喂给下面那台校验器才是"修完之后"的复现 |
| `verify-e647-repro.mjs` + `verify-e647-postfix.log.txt` | "旧形状没被我的码挪动"这句的**机器判**：36 格可比 ‖ 缺对照 0 ‖ 值不同 0。⚑ **缺省只读一份文件**，复验必须显式给两份（`strength-E648.log.txt strength-E648b-strict.log.txt`，日志自报"覆盖 18 处"）|
| `analyze-support-strength.mjs`（在上一批目录，本批复用） | 把 `ROW` 行按（起点, 桌, gear）分层出配对 SE；gear 维度向后兼容是先在旧归档上验过的 |
| `hp-multi-prior2.log.txt` ‖ `hp-long-prior2.log.txt` | §E649 一 的两台重跑批（multi 00:30:01 收口 794 ‖ long 02:09 收口 `完成 803 / 失败 5`）；表本体在 `champion-map/epsfull-prior2-2026-10-18.tsv` ‖ `epsfull-long-prior2-2026-10-18.tsv` |
| `epsfull-noopcheck-2026-10-18.tsv` ‖ `…-s0-…` ‖ `hp-noopcheck-12.tsv` | **仪器没漂**的证据：12 枚控制包 `--support=0` 逐字复现 10-12 那张表（12/12）；同一批也用来验 `holo.tsv` 当筛子会漏（6/12 开档后仍变） |
| `hp-rerun-list.tsv` | 那张"想按送盾筛再重跑"的筛子名单——**结论是筛子不成立**，所以它只作为反例留存 |
| `merge-hp-caliber.mjs` | 把新口径表与旧表按 id 合并成 `champion-map/epsfull-hp-final-2026-10-19.tsv`（986 行）‖ `epsfull-hlong-final-2026-10-19.tsv`（798 行）；逐行断言行宽（carry 行曾被写成少一列，修法就是这条断言） |
| `analyze-hp-prior.mjs` + `hp-delta-e649.log.txt` | §E649 一 那张 Δ 表（全库/会变的/池成员/hard 档 × multi、long）＋ 逐行牙 `d ≡ exam − pageBare` |
| `ab-pool-batch.sh` + `ab-tmp/` + `analyze-ab-pool.mjs` + `ab-pool.paired.txt` + `ab-pool.runner.log.txt` | §E649 二 池桌全池 A/B（29 枚 × 2 桌 × 2 档 × 20 批）⇒ **批内 SE 只说明仪器，枚间分布才是证据量** |
| `calibrate-gift-veto.mjs` | veto 之前那台标定：线放在 2/4/6/8 各砍掉几粒、现役池命中谁（`DESIGN-2026-10-19-train-side-gift-qoder.md` §二 用它）|
| `calibrate-gateok-convergence.mjs` | "贴线的包判定随测量长度翻"的实测（10/20/40/100 局，`v7tgt2-52` 6.15 → 4.94）⇒ §E649 的 20 局灰带警告来自这里 |
| `gift-veto-arms.sh` + `gift-veto-{gv,tw}*.log.txt` + `gift-veto-arms{,-tw}.log.txt` | §E650 一 与 §E650 六 的六臂批（**同一台驱动、`PFX/TAG/SEEDPACK` 换谱系**）‖ `…-aliases-side.diff.txt` = 被驱动还原掉的在册表行（留在证据里）|
| `analyze-gift-arms.mjs` + `gift-arms-gv.analyzed.txt` ‖ `gift-arms-tw.analyzed.txt` | 六臂收口表（含**权重本体 sha8** 那一列与"结构零不计入分母"的点名）‖ 预注册 §三 逐条判 |
| `noninfer-5p.mjs` + `noninfer-5p.log.txt` | §E650 二.2/2.3：`eval-5p` 考卷同 seed 配对的强度差 + `landShareOf` 的最大单卡落地份额（tw 那批**没跑**，理由写在 §E650 六.1：三格产物逐位相同）|
| `arms/*.winner.js` ‖ `arms/MANIFEST.tsv.txt` | 12 份当选产物（唯一进仓的形式：`.bak` 被 `.gitignore:3` 全局屏掉）＋每格的权威源与 sha8 ⇒ 没有 MANIFEST 就分不出"哪份是哪臂" |
| `gift-ladder-dist.mjs` + `gift-ladder-dist.log.txt` | §E650 七 的候选分布（**一臂没新跑**，只吃 `arms/` 里的带内六席，按 sha8 去重）|
| `veto-seed7-inert.log.txt` | 01:05/01:06 那次 seed 7 对拍（六席逐位同 ⇒ 该格 veto 无动作），以及"它**不是**默认档不变性证明"的订正 |
| `rebuild-coords-e650.log.txt` ‖ `-e650b.log.txt` ‖ `fourviews-e650.log.txt` ‖ `coords-before-e650.tsv.txt` | 图重建两趟（第一趟被"行数守恒"点名丢 9 枚）＋ 四视图各 93 PASS ‖ 0 FAIL ＋ 改图前的带时刻备份 |
| `gate-train-night2.txt` ‖ `gate-meta-night2.txt` ‖ `gate-D191-rerun.txt` | 门禁按组跑的原始计数（157/159 ‖ 16/16 ‖ 1/1）——**都带工具自己那句"只跑了 X / 278 ⇒ 不是整轮认证"** |

## 二、复算入口（照抄即可；ROOT 全部自解析，不需要改路径）

```bash
# 强度三档（54 格 ≈17 分钟；与别的批并发只影响墙钟，值确定）
bash docs/research/archive/2026-10-18-night2-prior-caliber/strength-batch.sh
# "旧形状没被挪动"的机器判：**必须显式给两份**（后给的覆盖先给的）
node docs/research/archive/2026-10-18-night2-prior-caliber/verify-e647-repro.mjs \
  docs/research/archive/2026-10-18-night2-prior-caliber/strength-E648.log.txt \
  docs/research/archive/2026-10-18-night2-prior-caliber/strength-E648b-strict.log.txt
# 六臂收口与代价（换谱系 = 换前缀）
node docs/research/archive/2026-10-18-night2-prior-caliber/analyze-gift-arms.mjs
node docs/research/archive/2026-10-18-night2-prior-caliber/analyze-gift-arms.mjs --pfx=tw --log=gift-veto-arms-tw.log.txt
node docs/research/archive/2026-10-18-night2-prior-caliber/noninfer-5p.mjs
node docs/research/archive/2026-10-18-night2-prior-caliber/gift-ladder-dist.mjs
# 重建那张图：--extra 是**替换**默认 extra，历批尺表一张都不能少
node champion-map/rebuild-coords.mjs --hp=epsfull-hp-final-2026-10-19.tsv --hlong=epsfull-hlong-final-2026-10-19.tsv \
  --extra=champion-map/e370-ruler.tsv,champion-map/e608-ruler.tsv,champion-map/e641-ruler.tsv
```

## 三、本目录想拦住的三个坑（都是这一班自己踩的，写在这里而不是只写在日志里）

1. **配对臂别照抄共用落盘名。** 配对两臂共享同一条带内梯子（实测三粒 seed 每粒 6/6 逐位同）⇒ 关档先写、开档的当选者必然已在盘上 ⇒ §E589 守卫**不写产物、退出码 9**，那一刻 `docs/artifacts/train-3p-out.js` 里是**上一臂**的冠军。
   权威源 = 臂日志 `[band-save] …（当选）` 那一粒，并核对拷贝自己的 `META arm`（`analyze-gift-arms.mjs` 会点名失配）。
2. **实验 `.bak` 别落共享产物池 `docs/artifacts/` 根上。** 门 D191④ 扫的就是那里；驱动收尾还原 `champion-map/pack-aliases.tsv`  ⇒ "文件在、登记没了" 立刻红（实测 0→6，还原 gv-* 时 0→19）。
   收尾顺序固定：证据进 `arms/` → 目录移出池 → `node tools/dedupe-artifacts.mjs --audit` 确认 `unregistered: 0`。
3. **"已复验"三个字必须贴命令原文。** 本目录那台校验器缺省只读最近一批 ⇒ 拿缺省跑一遍不构成对"改码之后"的复验（这一班差点把没做的写进账）。多输入型校验器还要看它自报的**覆盖处数**。
