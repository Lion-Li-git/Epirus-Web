# §E652 归档：§E641 那 5 枚 ring 实验臂的两桌补测（2026-10-19 上午）

判的那句话是用户在页头看到的「**F = 长程桌**（有读数 798/803 ‖ 缺长程 5 枚 ⇒ 这些枚退回默认桌，一张图上混两把尺）」+「你之前不是补跑了吗」。
正文在 `docs/research/logs/2026-10-18-beadseed82-qoder.md` **§E652**。

## 一、为什么这 5 枚跟 §E651 那 4 枚不是一回事

| | §E651 那 4 枚（`G12H1 / clone-79101 / Z1 / Z2`） | §E652 这 5 枚（`t5-151-ringon/ringoff`、`t5-G12H1-ringon/ringoff`、`t5-T8-ringon`） |
|---|---|---|
| 病因 | 10-16 长表有行、10-12 短表没行 ⇒ **只缺 Hp** | **两张裸包表都没有行** ⇒ 两桌都缺 |
| 裸包基线 | 搬 `e608-epsfull.tsv`（今测关档 4/4 逐字相同） | 长程侧**没有裸包表可搬** ⇒ 本次现造；短程侧搬 `e641-epsfull.tsv`（今测关档 5/5 逐字相同） |
| 后果 | 一行之内 Hp 旧档 / Hplong 新档 | 页头那句"F = 长程桌 混两把尺"，且这 5 枚的 Hp 也是旧档 |

`--support=` 有硬要求（必须配 `--pageOnly=1 --examFrom=<裸包表>`），因为 `d` 若现算 `exam − page` 会把先验效应塞进一个已注册的列名 ⇒ **没有裸包基线就不许开档跑**，这正是这 5 枚昨晚被判"失败"而不是"跳过"的原因。

## 二、复跑命令（本机合计 3 分 41 秒；时刻见 `runner.log.txt`）

```bash
cd <仓库根>
# ① 长程裸包（新造：考卷臂 + 页面臂都现测）
node champion-map/eps-full.mjs --mode=long --only=e652-t5long-list.tsv \
  --out=e652-hlong-bare-2026-10-19.tsv --games=120 --epsTier=lv:regular --jobs=4
# ② 长程开档（Δ = 同行 page − pageBare ⇒ 同一天同尺的配对）
node champion-map/eps-full.mjs --pageOnly=1 --support=2 --mode=long \
  --examFrom=e652-hlong-bare-2026-10-19.tsv --only=e652-t5long-list.tsv \
  --out=e652-hlong-prior2-2026-10-19.tsv --games=120 --epsTier=lv:regular --jobs=4
# ③④ 短程关档（漂移控制）与开档
node champion-map/eps-full.mjs --pageOnly=1 --support=0 --examFrom=e641-epsfull.tsv --only=e652-t5long-list.tsv --out=e652-hp-bare-2026-10-19.tsv --games=120 --epsTier=lv:regular --jobs=4
node champion-map/eps-full.mjs --pageOnly=1 --support=2 --examFrom=e641-epsfull.tsv --only=e652-t5long-list.tsv --out=e652-hp-prior2-2026-10-19.tsv --games=120 --epsTier=lv:regular --jobs=4
# 合并（--main= 认多表 + 表@标签）
cd docs/research/archive/2026-10-18-night2-prior-caliber
node merge-hp-caliber.mjs --main=epsfull-prior2-2026-10-18.tsv,e651-hp4-prior2-2026-10-19.tsv@prior-e608pair,e652-hp-prior2-2026-10-19.tsv@prior-e641pair --fill=epsfull-tier-2026-10-12.tsv --out=epsfull-hp-final-2026-10-19c.tsv --label=prior
node merge-hp-caliber.mjs --main=epsfull-long-prior2-2026-10-18.tsv,e652-hlong-prior2-2026-10-19.tsv@prior-e652bare --fill=epsfull-long-2026-10-16.tsv --out=epsfull-hlong-final-2026-10-19c.tsv --label=prior
cd <仓库根>
node champion-map/rebuild-coords.mjs --hp=epsfull-hp-final-2026-10-19c.tsv --hlong=epsfull-hlong-final-2026-10-19c.tsv --extra=e370-ruler.tsv,e608-ruler.tsv,e641-ruler.tsv
node champion-map/attach-hp.mjs --check --table=epsfull-hp-final-2026-10-19c.tsv --more=e328-epsfull.tsv,e370-epsfull.tsv,e608-epsfull.tsv,e641-epsfull.tsv
node champion-map/viewer.mjs
for v in tree 1d 3db map; do node champion-map/shot.mjs --hash="mode=$v&check=1" --dump; done
node tools/np-test.mjs --group=meta ; node tools/np-test.mjs --only="D234 " ; node tools/np-test.mjs --only="D191 "
```

## 三、文件清单

| 文件 | 是什么 |
|---|---|
| `hlong-bare.log.txt` | ① 长程裸包：`完成 5 枚 / 失败 0 ‖ 用时 1.7 分钟` |
| `hlong-prior2.log.txt` ‖ `hp-bare.log.txt` ‖ `hp-prior2.log.txt` | ②③④ 三趟的原样 stderr（各 `完成 5 枚 / 失败 0`） |
| `merge-hp-e652.log.txt` ‖ `merge-hlong-e652.log.txt` | 两张合并产物 995 行 ‖ 803 行，`hpSrc` 逐行写来路 |
| `rebuild-coords-e652.log.txt` | 链子十步 ⇒ 803 × 49、五道自证、消失 0 枚 ‖ 第⑩步那行：**考卷/页面量到 803 ‖ 没量到 0 ‖ 过线(全腿长程) 798 ‖ 无 5** |
| `attach-hp-check-e652.txt` | 四张 `--more` 表全部"新增 0 枚" ‖ 复现守卫逐字相同 ‖ 覆盖 803/803 |
| `viewer-e652.log.txt` ‖ `fourviews-e652.log.txt` | 重烘那台的读数 ‖ 四视图各 **93 PASS ‖ 0 FAIL** |
| `gate-meta-e652.txt` ‖ `gate-D234-e652.txt` ‖ `gate-D191-e652.txt` | **16 / 16** ‖ **1 / 1** ‖ **1 / 1**（都带"不是整轮认证"那句原话） |
| `gate-meta-final.txt` | 落笔之后再跑一遍 `--group=meta` ⇒ 仍 **16 / 16**（13:04:27） |
| `runner.log.txt` | 每一趟的起止时刻（这表里的钟全部从这里与日志收尾行抄，不是估的） |

## 四、读这批数要带的三条限制

1. **假绿一次（§E652 三）**：第一版整列统计写 `if($46==" - ")` 数缺值，而表里的空值记号是 `-`（不带空格）⇒ 那条尺永远不匹配、"缺 0"是废读数。现在这一节靠三条独立读数：逐行打印 ‖ `attach-hlong` 自己那行 ‖ 页内 `var DATA` 的 `hpl2` 键计数（803 个、null/`-` 为 0）。
2. **ΔHp 合计 +0.60 ‖ ΔHplong 合计 +1.10（各 n=5）** ⇒ 都是**事后补的格子**，不并进 §E649 一那 794/798 的分母，也不改全库那句 `+0.26 ± 0.03pt`。
3. **`okLong` 仍缺这 5 枚**（它来自 `feas.mjs --allLong=1` 的分片表 `feas-long-s*.tsv`，不属这条链）⇒ "图已完全同档"这句**不包括**绿环/过线那一维；补 feas 的时长未量，先并到待裁 #47。
