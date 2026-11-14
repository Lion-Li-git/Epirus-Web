# STATUS · 2026-11-14 夜（23:30 收工账 · `obs6` 多师分轨突破）

> 接 [STATUS-2026-11-14-pm.md](STATUS-2026-11-14-pm.md)；本批围绕 **`obs6` 单师瓶颈诊断、多师分轨 DAgger + KL-PG 精调、泛化与上槽体检、以及两枚新代表点正式入图重烘**。旋钮定义口径一律以 [training/TRAINING-KNOBS.md](../../training/TRAINING-KNOBS.md) 为准。

---

## 一、本批完成事项

1. **定位 `OBS6E1 / E2` 卡在 `+0.09–+0.10` 的根因**
   - 核实 `v7blk1-92.bak`（偏攻 `C5长=0.3931, G=5.02/5.42`）与 `v7seat24b-92.bak`（均衡 `C5长=0.2344, G=9.35/8.46, 防御=29.3%`）画像，定位三项问题：`--shapeBal=0` 缺省早停、`E1 rareOnly` 过窄、高学习率无正则导致过拟合（详细实验对照见 [FINDING-2026-11-14-obs6-multiteacher-dagger.md](FINDING-2026-11-14-obs6-multiteacher-dagger.md)）。
2. **Round 5–6b 训练突破与全面验收**
   - **`OBS6E5c.bak`（旗舰突破：`--teacher2keys` 分轨 + `teacher2frac=0.40`, `shapeBal=1, seatDrop=0.1, seatL2=1e-4`）**：
     - `seg-eval`：`C5短=0.2346` | `C5长=0.3232` | `X̄₄短=0.1644` | `X̄₄长=0.3098` | `防御=26.4%` | `G=5.88/6.78 ✓`。
     - `exam-4n`（`100` 轮 / `MSB15R+GD6a+MSB14`）及图谱 F5 三尺（`A/B/X`）**全部 24 格严格全正**（如 `x-long [+0.5862, +0.3143, +0.3214, +0.2600]`，`b-long [+0.4554, +0.2971, +0.3036, +0.2171]`）。
     - `mem-probe`（`200` 局/对）：`R 41.9% ‖ H 66.8% ‖ Gap -24.9pt`（优于对照组 `GD6a-TILT` `-10.9pt`，无记忆过拟合）。
     - `promote-champion --dry`：通过 `9/10` 项门禁，仅 `G4[multi]`「只枪」`66%/60%`（超 `6.0pt`，其余 7 格对抗均值 `10.1%` / 中位 `0.0%`）。
   - **`OBS6E4c.bak`（全门 0 阻断通过基线）**：
     - `promote-champion --dry` 与 `gate-drafts` **0 阻断全过**（`audit: OBS6E4c ⇒ pass —`），`mem-probe` `R 52.0% ‖ H 54.4% ‖ Gap -2.4pt`。
   - **KL-PG 精调对照组（保留于本机 `scratch/arms/`，其中 `OBS6F1.seg1500`）**：`C5短=0.2510 / X̄₄短=0.1802 / G=7.98/6.63 / mem-probe Gap -23.3pt`，`exam-4n` 24 格全正，`G4[multi]` 只枪从 `71%` 压至 `66.3%`。
3. **正式归档与图谱入库（`fam=22`，943 → 945 枚）**
   - 权重存盘 [docs/artifacts/obs6-coldstart/OBS6E5c.bak](../../docs/artifacts/obs6-coldstart/OBS6E5c.bak) 与 [docs/artifacts/obs6-coldstart/OBS6E4c.bak](../../docs/artifacts/obs6-coldstart/OBS6E4c.bak)（各存 1 份防 D191 重复），经 `measure-point.mjs --audit --bake` 更新 [champion-map/data/](../../champion-map/data/registry.tsv) 并重烘 [champion-map/index.html](../../champion-map/index.html)（自检 `99 PASS / 0 FAIL`）。

---

## 二、后续接班建议

1. 如要将 `obs6` 正式推上产品池/线槽，优先从 `OBS6E5c` 做针对 `G4[multi]`「只枪（1 ジ压制）」的低强度行为校准（例如 `gunspam` 低占比回放混合或轻度 KL 锚定，目标在不损失 `防御=26%` 与 `C5长=+0.32` 前提下将 `66%` 压到 `<60%`）。
2. 本批验证用探针脚本保留在本机 `scratch/probes/mem-probe-e4.mjs`，未污染仓库正式文件。
