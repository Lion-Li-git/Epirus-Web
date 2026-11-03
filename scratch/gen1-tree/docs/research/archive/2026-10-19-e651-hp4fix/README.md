# §E651 归档：把图上最后 4 格跨口径的 Hp 洗平（2026-10-19 上午）

判的那句话是用户的一句问话「为啥 multi 比 long 少了 4 个点」+「那你补跑一下这几枚吧」。
正文在 `docs/research/logs/2026-10-18-beadseed82-qoder.md` **§E651**；本目录只放原始日志与命令。

## 一、这 4 枚是谁

`G12H1` ‖ `clone-79101` ‖ `Z1` ‖ `Z2`。
它们在 `champion-map/epsfull-long-2026-10-16.tsv`（Hplong 那趟的裸包表）**有行**，在 `champion-map/epsfull-tier-2026-10-12.tsv`
（Hp 那趟的裸包表）**没行** ⇒ §E649 一里 multi 失败 9 枚 / long 失败 5 枚，差集就是这 4 枚；
于是它们的 `Hp` 一直取 `champion-map/e608-epsfull.tsv` 的**关档旧值**，而同一行的 `Hplong` 是 10-19 凌晨的**开档新值**。
清单：`champion-map/e651-hp4fix-list.tsv`。

## 二、复跑命令（本机 43 秒；ROOT 由 `champion-map` 的上一层链条给出）

```bash
cd <仓库根>
for S in 0 2; do
  node champion-map/eps-full.mjs --pageOnly=1 --support=$S --examFrom=e608-epsfull.tsv \
    --only=e651-hp4fix-list.tsv --out=e651-hp4-$( [ $S = 0 ] && echo bare || echo prior2 )-2026-10-19.tsv \
    --games=120 --epsTier=lv:regular --jobs=4
done
# 关档那一趟又独立跑了一遍做复现（hp4-bare-repeat.log.txt），产物 e651-hp4-bare-repeat-2026-10-19.tsv
node docs/research/archive/2026-10-18-night2-prior-caliber/merge-hp-caliber.mjs \
  --main=epsfull-prior2-2026-10-18.tsv,e651-hp4-prior2-2026-10-19.tsv@prior-e608pair \
  --fill=epsfull-tier-2026-10-12.tsv --out=epsfull-hp-final-2026-10-19b.tsv --label=prior
node champion-map/rebuild-coords.mjs --hp=epsfull-hp-final-2026-10-19b.tsv \
  --hlong=epsfull-hlong-final-2026-10-19.tsv --extra=e370-ruler.tsv,e608-ruler.tsv,e641-ruler.tsv
node champion-map/attach-hp.mjs --check --table=epsfull-hp-final-2026-10-19b.tsv \
  --more=e328-epsfull.tsv,e370-epsfull.tsv,e608-epsfull.tsv,e641-epsfull.tsv
node champion-map/viewer.mjs
for v in tree 1d 3db map; do node champion-map/shot.mjs --hash="mode=$v&check=1" --dump; done
node tools/np-test.mjs --group=meta ; node tools/np-test.mjs --only="D234 " ; node tools/np-test.mjs --only="D191 "
```

## 三、文件清单（时刻来自 `runner.log.txt`，别改措辞）

| 文件 | 是什么 |
|---|---|
| `hp4-bare.log.txt` ‖ `hp4-prior2.log.txt` | 两档那趟 eps-full 的原样 stderr（各 `完成 4 枚 / 失败 0`） |
| `hp4-bare-repeat.log.txt` | 关档第二遍 ⇒ 与第一遍 `page` 逐字相同（只 `sec` 不同） |
| `merge-hp-e651.log.txt` | 合并器：794 `prior` + 4 `prior-e608pair` + 192 `carry` = 990 行 |
| `rebuild-coords-e651.log.txt` | 链子十步，产物 **803 行 × 49 列**、五道自证、消失 0 枚 ‖ ⚠ 子进程 stdout 不在这里（复现守卫要看 `attach-hp --check`） |
| `fourviews-e651.log.txt` | 重烘后的四视图，各 **93 PASS ‖ 0 FAIL** |
| `gate-meta-e651.txt` ‖ `gate-D234-e651.txt` ‖ `gate-D191-e651.txt` | **16 / 16** ‖ **1 / 1** ‖ **1 / 1**，都带"不是整轮认证"那句原话 |

## 四、读这批读数要带的三条限制

1. 关档今测与 `e608` 存储值三列逐字相同 ⇒ 这 4 行的裸包侧没漂；但**这只是一个批次的对拍**，不给"全库都没漂"背书。
2. Δ = +0.00 ‖ +0.30 ‖ +0.50 ‖ +0.50 是**事后补的 4 格**，不并进 §E649 一那 794 枚的分母，也不改那句 `+0.26 ± 0.03pt`。
3. **整轮门禁（不带 `--group`）本班仍未跑** ⇒ 这里的一切绿都只是分组面；出厂前必须补整轮。
