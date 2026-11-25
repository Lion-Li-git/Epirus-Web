# PREREG · 2026-11-26 · hard 辅助/控制风格双底座蒸馏

## 假设与既有结论

- 当前 hard 风格仍同质：`ji/gun/reflect/snipe/sword` 合计 `66.03%`，九条空轴合计 `7.76%`；`TF-DR` 入池后 transfer 份额仅 `0.06%→0.26%`，没有改变地形。
- `holo/shift` 在 hard 合计仅 `0.74%`，且没有单独以这两个键为目标的受控臂在册；历史多技能蒸馏只是顺带覆盖，不是本假设的复证。
- 假设：在洁净 hard 底座上，以 `HL-G1`（holo）与 `OBS6E9`（shift）为键道隔离教师，配合 2P 形状教师保护短桌，可让 `holo/shift` 跨过有效覆盖并离开 hard 同质核，同时不卖强度。

## 固定配方

两个底座各一臂，除 `--upstream/--out/--tag` 外逐字相同：

- 底座 A：`docs/artifacts/DR-R3E.bak`
- 底座 B：`docs/artifacts/ROD-DR.bak`（原定 `TK-FS4` 在 `selftest3` 腿 C 变红，exit 8 未启动；同配方换独立洁净底座，未产生梯度产物）
- 主教师：`pack:docs/artifacts/HL-G1.bak`
- 第二教师：`pack:docs/artifacts/obs6-coldstart/OBS6E9.bak`，`--teacher2keys=shift --teacher2frac=0.14`
- 2P 教师：`pack:docs/artifacts/T65-RINGBEAD.bak`，`--teacher3Shapes=2:standard --teacher3frac=0.20`
- 靶向：`--rareOnly=holo,shift --rareFrac=0.35`
- 桌形：`2:standard,3:multi,3:long,5:multi,5:long,8:multi,8:long`，`--shapeBal=1`
- 训练：`--groups=2000 --steps=180 --lr=0.0003 --seed=20261130 --objective=cand --dagger=1 --smoke=40`
- 输出：`scratch/arms/nov26-util-dr-s30.bak`、`scratch/arms/nov26-util-rod-s30.bak`

## 启动与止损

- 上游 `selftest3` 红即不开训；教师零配额/饥饿报警即停。
- 第一枚 `.bak` 落盘立即验尸：必须 `v:92 / arch:S1o / params:16561`。
- 不扫剂量、不因单粒早期快照追加旁证挽留。

## 候选验收

必须同时满足：

1. `promote --dry --support=2` 0 阻断，`seatKill=0`。
2. Arena B 相对各自基座不低超过判决带 `5.8pt`；A/B/C 三列同看。
3. 2P rule/legacy 各 4 seed 无显著回退；5P multi/long 池配对无显著回退。
4. Stage 1 `holo ≥3` 格、`shift ≥3` 格，且两轴合计份额 ≥2.5%。
5. 到当前 hard 质心 L1 ≥0.30，明确离开同质核（当前 hard 中位 `0.2606`）。
6. 不吃掉基座独守覆盖；hard 前五轴份额不升。
7. 过线才走 `measure-point --bake → pool-add → 定向门禁 → 浏览器` 完整链；不入池则只留研究对照。

## 已豁免

`dualGun / mirror` 按 10-28 书面裁定“可没有”，本轮不以 `30/30` 为目标。
