# STATUS (2026-11-21 15:36) —— `fam=7` (2/2) 与 `fam=9` (34/34) 整族清零 + `fam=19/20` 阻断链闭环（台账 452 → 416）

> 接力前序：[STATUS-2026-11-20-night-zcode.md](STATUS-2026-11-20-night-zcode.md) §十 + [HANDOFF-2026-11-20-minor2p0-repro.md](HANDOFF-2026-11-20-minor2p0-repro.md)

## 一、`fam=19/20`（最后 16 枚 `2.0` 缺失包）完整阻断链核实

此前 GLM 在 `83a68a6b`（§8.1）仅将 `MSB2` 3 枚判为受 `KDO5-seed` 随机权重阻断，仍把下游 13 枚记为"挂在未知 `23a782cb` 下待查 Qoder projects"。本班交叉核查 DSH 原始会话日志与 [dupes-manifest.tsv](../../champion-map/dupes-manifest.tsv)（L464–465），将全链闭合：

1. `KDO5-seed.bak`（`b24c6ffafd722648`，ZCode DB `rowid=26662` 实录）由 `make-seed5.mjs` 调用 `arch2.mjs` 未播种 `Math.random()` 生成（在 `wt-kdo5c` 连续重跑两次实测产出不同指纹：`258c3474165f44e2` vs `bc3ac8fd798c9c72`；此前工作树残件同为 `52ec9a45163a0c70` 系预设拷贝所致）。
2. `KDO5C` (`2eecbe24`) -> `MSB2-R1S773345716` / `R2` / `R1S1494663071` -> `MSB4-R1S1928336850`（`ca7c04ccab25f5b6`，`dupes-manifest.tsv` 在案指纹）-> `K2-def-o5.bak`（**`23a782cb`**，DSH 以 `MSB4-R1S1928336850` 为 `--up` 跑 `supfit-full` 生成）-> `ADAPT-DEF-O5-s916` -> `S916` -> `S916R2B` -> `MSB6..12`（11 枚）+ `fam=20` `GD6b-TILT` -> `MSB18`（2 枚）。
3. 全局扫描主仓（1566 文件）、`Epirus-Web-artifacts-quarantine`（377 文件）、全部 24 个 `wt-*` worktree、`D:/$Recycle.Bin`、用户目录及 `git --all` 历史，**该链任何中间节点均零备份留存**。

⇒ **`2.0` 小族 40 枚中可复现的 24 枚已 100% 落仓，其余 16 枚由单一未播种 `Math.random()` 祖先闭环阻断（不用再去 Qoder 日志追 `23a782cb`）。**

---

## 二、`fam=7`（2/2）与 `fam=9`（34/34）全部 **36 枚** 逐位复现并落仓

利用幸存者包内 `EPIRUS_CHAMPION_3P_META.recipe.env`、`docs/research/session-records-2026-11-20/qoder-transcript-trainruns.tsv`、以及 git 历史中原始夜班日志（`docs/RESEARCH-LOG-2026-09-28-qoder.md` §E95/§E116 与 `75b67b73:docs/OVERNIGHT-2026-10-02-qoder.md` §E234–§E248），在干净 era worktree（`wt-fam79` / `wt-e234`）一次性 36/36 逐位命中：

| 组别 | era 提交 | 恢复件（`id` / 路径 / `wid`） |
|---|---|---|
| **`fam=7` (2/2)** | `d492a461` | `seed81` → `docs/artifacts/eval-out/sel81.bak` (`25df919c7dc61ddf`，带预先建好的 `EPIRUS_BAND_DIR` 取 `-band6.bak`) |
| **`fam=7` (2/2)** | `cd5c7665` | `e35prod807` → `docs/artifacts/E35-prod-807.bak` (`ed5aa28dfbad4ab2`，`EPIRUS_TRAIN_EPS=0.2` / `K=5` / `soft` / `TEMP=0.15`，`800 5 12 12`) |
| **`fam=9` L 组 (3)** | `612d3255` | `L111` (`bbe12fe3dfeaee00`)、`L151` (`83e0e8eda550bded`)、`L191` (`f6a59e850aa7f954`)（起点 `e50-out__E51-t8-713.bak`，`1200 3 8 8`） |
| **`fam=9` R 组 (5+校准1)** | `597d6762` | 校准锚 `R311` (`ccc41e51a11947ce`) + `R231` (`3afd512a5c385dc6`)、`R271` (`1a9212dd40284382`)、`R351` (`df22f23903e14339`)、`R391` (`3c4b3db7bd8cf585`)、`R431` (`8e3b1f1ab18ba7f7`) |
| **`fam=9` 09-28 散批 (5)** | `4ff969aa` / `ff6db04d` / `f44aa910` | `B0L-71` (`5e7411aa8c77ff8e`，`TRAIN_MODE=long` `3 8 8`)、`N5-0` (`403144a22c14873a`，§E95 `ANCHOR=0.08 RING_W=0` `5 8 8`)、`B5-05-71` (`27cdfccc9cdef574`，`ANCHOR=0.08 BEAD_W=0.05` `5 8 8`)、`N5L-15` (`612eb0386aabd4c2`，**`SEED=31 + ANCHOR=0.15`** `5 8 8`)、`HF-191` (`3df992a9e40c1533`，§E116 `ANCHOR=0.08 BEAD_W=0.05 HALL_SEED=1` `5 8 8`) |
| **`fam=9` `e234-out/*` (21)** | `75b67b73` | `D2a`/`D3a`/`D6a`/`D7a`/`D8a`（示范/补贴 5 枚）、`K1`/`K4`（`COSTLY_W` 0.01/0.1）、`B1`/`B2`（`BIGCARD_W` 0.05/0.2）、`E1`/`E2`（`EPIRUS_ECON_OPPS`）、`R1`（`DIV_W=0`）、`X1`（`COSTLY_W=0.05 + long`）、`U1`（`COSTLY_W=0.05 + SEL_KEEP=0.3`）、`U2`（`COSTLY_W=0.05 + ECON_OPPS`）、`V71`/`V111`/`V151`/`V191`（`DIV_W=0` 4 种子）、`W31`/`W71`（`DIV_W=0 + COSTLY_W=0.02`）—— **21/21 一次全中** |

全 36 枚均已将 `META.ts` 归一化回 `registry.tsv` 在册值（`wid` 不变）、`git add -f` 入库并同步 `registry.tsv` `sha256` 与 `docs/ARTIFACT-LOSS-1119.tsv`（`missing -> ok`）。

---

## 三、落仓后全图缺件分布（**452 → 416**）

- **`fam=7`、`fam=9`～`fam=18`、`fam=21`～`fam=25` 全部清零（missing=0）**。
- 剩余 **416 枚** 仅余两部分：
  1. 早期 `1.8` `server` 批次（`400 枚`）：`fam=4` (109)、`fam=6` (107)、`fam=5` (94)、`fam=3` (43)、`fam=1` (28)、`fam=2` (19)——留待通宵班以精确 `EPIRUS_*` 覆写匹配盲扫表；
  2. `2.0` 未播种随机根链（`16 枚`）：`fam=19` (14)、`fam=20` (2)。
