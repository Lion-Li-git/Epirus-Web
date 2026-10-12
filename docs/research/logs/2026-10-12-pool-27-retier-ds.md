# 10-12 夜（DS）：新成员入池 + 按用户裁定重分带（20→27 枚）—— ★ 「困难↔普通」变成站得住的一步，而「简单档变软」没买到

用户 10-12 晚裁定（原话）：「你看一下新成员入池吧，然后就可以重新划分一下池子，把 `K2` 和 `Ldemo` 进困难场了，
中档多了也可以切一些到低档去，这样低档不就变软了」。

## 1. 入池（7 枚 · §E597 补开体检 pass）

| id | path | Hp | 入库 |
|---|---|---|---|
| `R311` | `docs/artifacts/eval-out/win-R311.bak` | 48.0 | `git add -f`（新） |
| `blk0t40-s31` | `docs/artifacts/kept/e124-out__blk0t40-s31.bak` | 49.0 | 已在册 |
| `E59-land-902` | `docs/artifacts/E59-land-902.bak` | 49.6 | `git add -f`（新） |
| `SP-s30` | `docs/artifacts/e504-out/SP-s30.js` | 47.7 | `git add -f`（新） |
| `U-s216` | `docs/artifacts/e539-out/U-s216.js` | 49.3 | `git add -f`（新） |
| `seed80` | `docs/artifacts/eval-out/sel80.bak` | 48.5 | `git add -f`（新） |
| `N5L-30` | `docs/artifacts/e106-out/N5L-30.bak` | 50.2 | `git add -f`（新） |

入池一律走 `tools/pool-add.mjs --tier=mid --seat=pool-seat-90210.tsv,pool-seat-90211.tsv`（体检 `pass` · 人席否决 0 格）。
⚠ 两处口径更正（本班造成/发现）：① `pool-add.mjs` 的 `TIERS` 还停在我 13:53 那版「两带」（`['hard','soft']`）⇒ `--tier=mid` 会被拒；
已改成 `['hard','mid','soft']`（页面环色 `champion-map/viewer.mjs:220 POOL_COL` 本来就是三色，不用动）。
② `--seat=` 的路径按 `champion-map/` 解析 ⇒ **传裸文件名**，传 `champion-map/…` 会变成 `champion-map/champion-map/…`（响亮报"批表不在"）。

## 2. 重分带（用户三条）

- `K2`(Hp 53.5) 与 `SHIPPED-Ldemo`(51.3) **中带 ⇒ 困难带**；困难带 7→9。
- 中带最弱的 4 枚 **⇒ 软带**：`v7n1-93`(46.4) `SP-s30`(47.7) `v7new5_005-81`(47.7) `R311`(48.0)；软带 7→11，中带 13→7。

## 3. 读数（在册口径：`probe-diff-ladder --pairs=1 --games=1500 --pool=1`，1500 局/档、逐局配对）

| 时点 | 池 multi 困难/普通/简单 | 池 long 困难/普通/简单 | 困难↔普通 | 普通↔简单 |
|---|---|---|---|---|
| 改动前（27 枚 · 旧分带） | 13.7 / 15.4 / 19.4 | 10.1 / 19.2 / 20.2 | multi 1.3σ ✗ ‖ long 7.1σ ✓ | multi 2.9σ ✓ ‖ long 0.7σ ✗ |
| **改动后（保留组）** | **12.8 / 17.3 / 18.8** | **12.4 / 17.7 / 20.8** | **multi 3.5σ ✓ ‖ long 4.3σ ✓** | multi 1.0σ ✗ ‖ long 2.1σ ✓ |
| 试验组 B（改切中带 Hp 最高的 4 枚进软带） | 12.8 / 19.7 / **17.5**（次序倒） | — | — | — |

★ **买到的**：把 `K2`/`Ldemo` 放进困难带之后，「困难↔普通」从 multi 1.3~1.9σ（分不开）变成 **3.5σ / 4.3σ（两种桌形都站得住）** —— 这是今天第一次让"困难档真的更难"有 ≥2σ 的读数。
★ **没买到的**：**换成员换不出"更软的软带"**。简单档 multi 19.4→18.8（略硬）、long 20.2→20.8（噪声内）；换一组切法（把中带 Hp **最高**的 4 枚切进软带）结果更差（简单 17.5 反而比普通 19.7 硬 ⇒ 次序倒，已弃用）。
与 §E286「风格的强度是桌形的函数，不是它的属性」同向：**带强度不能靠搬成员按 Hp 直觉调**（本条是本班第二次实测到）。

## 4. 判据与产物

- `champion-map/pool-members.tsv`（27 枚：soft 11 / mid 7 / hard 9）‖ `js/bundled-champion-pool.js` 重烘（`hard 9 / mid 7 / soft 11`）
- `tools/pool-add.mjs` 档名更正 ‖ `tools/diff-ladder-claims.mjs` 的 `pool:multi`/`pool:long` 读数按新名册重记（sig 未变：`DIFF_TIERS` 一字未动）
- 定向跑（**不是整轮认证**）：`--only=D234` 1/1 ✅ ‖ `--group=meta` 16/16 ✅ ‖ `node tools/smoke.mjs` **SMOKE OK** ✅
- 纪律：`js/train/bots.js` 与 `js/ui/ui.js` **未动**（只动名册与池 bundle）‖ 未新增门（278 条不变）‖ 线上两颗槽未碰 ‖ 未 promote。

## 5. 留给下一班

1. **「真简单」仍没解决**：两条杠杆 —— (a) 给简单档单留大 ε（你 16:4x 已把手感定到 0.2 ⇒ 要动得你点头）‖ (b) 往软带补**真弱**的成员，而库里 Hp<47 的过线包恰恰是龟缩型、被 G4/G5 挡 ⇒ 是"对池成员与线上槽分两套门槛"的判据级裁定。
2. 软带现在 11 枚、中带 7 枚 ⇒ 中带离契约下限（成员数 ≫ 席数）还有余量，但**别再往中带切**（本班试过两个方向，只有一个方向让困难↔普通变清晰）。
3. `pool-screen.mjs` 的绝对切点（54.3 / 46.9）仍是旧 Hp 分布定的 —— 本轮名册已与那对切点脱钩，改不改等裁。
