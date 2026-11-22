# HANDOFF · 2026-11-23 早班交接（夜班 ZCode/GLM → 下一班）

> 承接 [HANDOFF-2026-11-22-night-for-glm.md](HANDOFF-2026-11-22-night-for-glm.md)（探针先行扫批方案）与
> [STATUS-2026-11-23-night-zcode.md](STATUS-2026-11-23-night-zcode.md)（今夜叙事与判例）。
> 本文件只写**下一班要动手的事**与**动手前必须知道的坑**。

## 一、台账现状（报数口径钉死）

- 台账 1002 行：`ok=517 ‖ sha-diff-wid-same=~276+（在涨） ‖ missing=~188（在降） ‖ no-path=19`。
- **报数只许用两个数**：`missing` 剩余 + 今夜恢复增量（夜班恢复 ~170 枚；用户曾因两口径混报被绕晕，见 STATUS §一）。
- 登记一律走 `tools/land-recovered.mjs --do --ids=…`（自证 wid，§7.1 口径，registry 永不动）。

## 二、在飞进程（接班时先看）

- **shard1 的 wave4 驱动**（era 们：bead1/l2a/new3/t2/u1 尾批）——跑完会自己登记；中途产物在各
  `D:/code/srv-wt-s1-<era>/docs/artifacts/`。
- **shard0 的 wave4fix2 驱动**（press2 收尾）——同上（worktree `srv-wt-s0-<era>`）。
- 两个驱动都只在**整份清单跑完**时结束；中途没有通知（夜班为此吃过亏，接班后如需盯盘挂
  `until [ -f docs/artifacts/<id>.bak ]; do sleep 60; done` 式落盘监视）。

## 三、下一班优先级

1. **wave4 余量归档批的重修**：wave4 的 ✗ 批分两类——
   - **D/G 猜测行**（ringA1/ringB1/bead15·25·100/bead2/bead3/catE5/densE?/protoE/rb1/rb2/new5 系/seat24/divK2/t1/bead1/beadseed/cmin4…）：
     配方未考古，按回执"关键结构"四条挖（`git grep 批名 <era> -- tools/` → era CHANGELOG → DSH 全量块挖掘
     —— **同名块歧义**是本夜最大坑：挖掘抓到的第一块常是兄弟批的命令，必须取**全部组合**比对，
     w3r1/noteach1/ws2/role1/press2 五批都是这么修的，见 [v7-scan-receipt-1122-night.md](v7-scan-receipt-1122-night.md) 续账节）；
   - **M 行同名块歧义残留**（w3r1✅已修/noteach1✅已修/ws2 部分命中 1/5/role1 全✗/press2 全✗）：
     ws2-81 在 era 漂移候选 6345caee 命中 ⇒ ws2 系存在未提交工作树漂移，重扫时 era 候选要往后多铺几个；
     role1 疑似**历史标签互换**（role5 用 ROLEW=0.5 同 era 6/6 全中，role1 用 1.0 全✗——试 0.5 一次性探针）；
     press2 是**加权池**（gunspam×3/guardspam×4/snipespam×2+8 通用，≈60% 线），prose 还原不了顺序，
     必须挖到真实命令块再扫。
2. **v7curri2 探针**（配方已挖到，差一维：era 候选 0f66ee8f / gens / 池逐个消融）。
3. **C 线按离散度表开臂**：全池弱点格 = **「只枪压制」multi 26.4%（3.7σ）**与**「全程只防御」long 19.5%**——
   下一枚风格包该训**反只枪压制**（教师栈可掺 taunt-dsp0b/OBS6P9 抗枪行为）。每臂先查方法论账（§15）。
4. **天火闭环**（用户点名任务）双路线红+单键作废，机制方向三条在 [STATUS-2026-11-23-night-zcode.md](STATUS-2026-11-23-night-zcode.md) §三
   ——注记：c3g 的天火出手与 curse 路径状态**纠缠**，单键采样采不到它。
5. **spread 判归档**仍等用户裁（别顺手加）。

## 四、本夜地雷清单（全踩过，别再踩）

1. **驱动只在整份清单跑完时才发通知**——中途要用落盘监视器盯（`until [ -f … ]; do sleep 60; done`）。
2. **jobs 文件三列（seeds/ids/paths/targets）非空才发**——paths/targets 空 = 驱动每行静默 `continue`，0 登记。
3. **kill 驱动不 kill 它的 spawnSync 子进程**（ring2-run 变孤儿占端口/锁，后续同 shard 全崩"已有多人训练在跑"）——
   本夜 w3r1 因祸得福：孤儿用正确配方训完并逐位命中，由幸存驱动登记。
4. **era 地雷**：包 ts(+8h) 早于特征进主线 ⇒ 当年在未提交工作树训（gf1→c7076ac9 起；ws2-81→6345caee）；
   教师名用**完整函数名**；池字面值以 era SSE 报错清单为准；`EPIRUS_BUNDLE_IN` 是死键（ring2-run:85 覆写）。
5. **同名块歧义**：DSH 挖掘取全部组合，别用第一块。
6. **同 era 并发须分 shard**（worktree 名含 shard）。
7. 单行 jobs × SHARD 过滤（老雷）。

## 五、今夜已推送的提交（按序）

573b0e5b（l2f 18）→ 7e453ba4（l2c 20）→ fd3725c1/a7297ddd（回执+l2o 3）→ fd23addc（wall1 5）→
5204c9ea（r61fix+l2s+l2h 13）→ bcb54c2d（C 线重测+meter 修复）→ 9f2b66f5（aim1+gf1 11）→
2e541561/a17e21bc（天火双臂登记）→ 492cd4ba（STATUS）→ 9d262e80（单键作废）→ adc3bbea（回执续账）→
6397182d/b54ae0f9（wave4 91+尾批）→ 558aad69（seat24b 3）→ bec6d5eb（noteach1 6）→ ws2-81（在飞续账）。
CI 全绿。
