# Epirus 训练记录总账（dsh 会话 17 个，2026-11-20 整理）

> 来源：dsh 会话原文（session.v4/v3.jsonl.zstd，zstd 多帧解压后逐事件解析）。
> 目的：把历届班次的训练命令、server /train 参数、根包与种子集中到一处，供逐位复刻。
> 机器可读原件：
- docs/research/session-records-2026-11-20/training-recipes-consolidated.tsv（358 行：107 条 server URL + 97 条 train-3p + 97 条 supfit + 37 条 pg；已剔除含占位符/反引号的行）
- docs/research/session-records-2026-11-20/server-urls-all.tsv（210 条原始 URL）
- docs/research/session-records-2026-11-20/train3p-all.tsv（778 条原始命中，含代码/文档片段）
- docs/research/session-records-2026-11-20/roots-all.tsv（13 条 cp 根包记录）
- scratch/session-mined/train-records-all.tsv（36,573 条含上下文的原始记录，30 MB）

## 一、会话覆盖与产出

| session（前 8 位） | 日期范围 | server URL（原始去重） | train-3p | 备注 |
|---|---|---:|---:|---|
| 227e2bc8 | 09-06 19:28 ~ 09-12 20:30 | 27 | 13 | 最早会话；3P 从 0 到 1、server 雏形 |
| 0add3d39 | 09-12 20:36 ~ 09-13 14:52 | 30 | 0 | 早期 server 四批（eco/ring2/def/long）主源 |
| 4d4a95f4 | 09-13 18:38 ~ 09-16 21:06 | 41 | 0 | v7 5P server 批（15/16 对手） |
| e68ffc09 | 09-16 21:38 ~ 09-23 13:22 | 19 | 3 | 17/18/19 对手扩充 |
| 0eabf427 | 09-19 18:33 ~ 09-22 19:27 | 2 | 5 | XN 迁移/暗键实验 |
| 7134b299 | 09-24 19:14 ~ 09-30 23:05 | 7 | 14 | B 家族 / server 小批 |
| d32b00d3 | 10-01 21:00 ~ 10-02 13:24 | 0 | 0 | 仅记录，无训练命令 |
| ced71ba1 | 10-01 21:00 ~ 10-09 23:05 | 0 | 1 | v7 期 |
| 0f082cf0 | 10-10 11:29 ~ 10-12 21:53 | 0 | 8 | v7 期 e315/e370 |
| 47b47327 | 10-13 21:39 ~ 10-15 22:10 | 0 | 4 | v7 IMIT 课程 |
| b3a09167 | 10-16 18:42 ~ 10-20 22:01 | 0 | 7 | v7 |
| 02aa89f9 | 10-21 12:09 ~ 10-24 10:31 | 1 | 7 | v7 |
| f2f41eee | 10-26 13:23 ~ 11-05 13:12 | 0 | 22 | v7 大批 |
| 2b7cc70b | 11-06 19:41 ~ 11-10 13:59 | 0 | 8 | v7/2.0 交界 |
| 04e0a3ef | 11-10 18:09 ~ 11-11 12:43 | 0 | 2 | 2.0 |
| af4c3351 | 11-11 13:26 ~ 11-13 13:45 | 0 | 3 | 2.0 |
| 7715716a | 11-15 17:22 ~ 11-17 23:34 | 0 | 11 | 2.0 |

说明：server URL 数按原始去重计；train-3p 是唯一命令数。会话里未实际执行的示例命令、README 片段已在 consolidated 中剔除，但仍可能有少量代码片段残留，使用时以 TSV 的 command 列为准。consolidated 清洗后共 107 条 server URL（原 127 条），差额主要是带占位符或尾部反引号的行。

## 二、早期 server 四批（09-12/13，已逐位验证）

统一根包：docs/artifacts/champion-5p-v1.3.58.bak，wid = e379c62ccd2648fa（v6 / 3337 参数）。
统一参数：gens=250，n=5，pop=16，gpo=8，mode=multi。

### 1. eco 批（12 对手）

    /train?gens=250&n=5&pop=16&gpo=8&seed=<31..36>&opps=random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver

seeds 31–36、45、99 均出现过；产物 eco-N.bak。

### 2. ring2 批（13 对手：12 + ringspam）

    opps=random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver,ringspam

seeds 31–36、81、82；产物 ring2-N.bak。

### 3. def 批（15 对手：12 + reflectspam,guardspam,protowall）

    opps=random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver,reflectspam,guardspam,protowall

seeds 31–36；产物 def-N.bak。**已验证**：def-31 在 era e227d222 下 firstRate=0.33904761904761904 / top2=0.4990476190476191，wid=3406d277e7ce1d04，与在册一致。

### 4. long 批（12 对手 + mode=long）

    /train?gens=250&n=5&pop=16&gpo=8&seed=<31..36,99>&opps=<12 基础名单>&mode=long

### 5. 带冠军对手的批（09-13）

    opps=<12 基础名单>,champ:docs/artifacts/champion-5p-v1.3.58.bak,champ:docs/artifacts/champion-5p-hA9.bak,champ:docs/artifacts/champion-5p-armB12f.bak,champ:docs/artifacts/champion-5p-armA9.bak

seeds 31、99。

## 三、后续 server 批（09-13 ~ 09-22）

这些批把对手池扩到 15/16/17/18/20/22 个；完整 URL 见 consolidated TSV。按名单长度汇总：

| 对手数 | 名单新增 | 出现 seeds | 会话 |
|---:|---|---|---|
| 15 | + ringspam, reflectspam, guardspam | 31–36, 41–44, 51–56, 101–106 | 4d4a95f4 |
| 16 | 上述 + targeter | 31, 71, 72, 81, 82, 91–96 | e68ffc09, 4d4a95f4 |
| 17 | 16 + protomine, prototransfer | 31, 81, 82 | e68ffc09 |
| 18 | 17 + gunspam | 31, 81, 82 | e68ffc09 |
| 20 | 18 再补 gunspam, guardspam, gunfocus | 31, 92 | 0eabf427 |
| 22 | 20 再补 gunfocus | 31, 92 | 0eabf427 |

完整名单（从 URL 实读）：
- 15：12 基础 + ringspam,reflectspam,guardspam
- 16：15 + targeter
- 17：16 + protomine,prototransfer
- 18：17 + gunspam
- 20：18 + gunspam,guardspam,gunfocus（注意 gunspam/guardspam 在 18 已出现，去重后以 TSV 为准）
- 22：20 + gunfocus

## 四、根包清单（cp 到 js/bundled-champion-3p.js）

- docs/artifacts/champion-5p-v1.3.58.bak（wid e379c62ccd2648fa；早期 server 四批共用）
- docs/artifacts/champion-5p-ab2-base.bak
- docs/artifacts/v7seat2-51.bak
- docs/artifacts/eco-34.bak
- /tmp/champ.bak、/tmp/champ8877.bak、/tmp/c3p.bak、/tmp/backup-3p.js（临时根，已不可考）

## 五、train-3p 命令（97 条唯一，节选）

参数含义：代 / 人数 / 每代局数 / 种群。完整 97 条在 consolidated TSV 的 type=train-3p 行。

| session | 代表命令 |
|---|---|
| 227e2bc8 | node tools/train-3p.mjs 400 3 10 16；500 3 20 32；600 3 16 32；500 3 24 32 |
| 4d4a95f4 | node tools/train-3p.mjs 250 5 8 16 |
| e68ffc09 | node tools/train-3p.mjs 30 3 8 8；60 3 8 8 |
| 7134b299 | node tools/train-3p.mjs 1200 3 8 8；200 3 8 8；120 3 8 8 |
| 0f082cf0 | node tools/train-3p.mjs 800 5 12 12；250 5 12 12；60 5 12 12 |
| 47b47327 | node tools/train-3p.mjs 400 3 8 8；400 5 8 8 |
| f2f41eee | 22 条，多为 v7 小批（详见 TSV） |
| 7715716a | 11 条，2.0 期（详见 TSV） |

带环境变量的例子（原样）：

    EPIRUS_SEED=11 node tools/train-3p.mjs 15 3 4 6
    EPIRUS_HOTSTART=1 EPIRUS_SEEDPACK=docs/artifacts/kept/e70-out__D02-31.bak EPIRUS_SEED=47 node tools/train-3p.mjs 400 3 8 8

## 五点五、supfit / pg 命令（134 条唯一）

这些是 2.0 时代的主要训练入口，参数以命令原文保留在 consolidated TSV（type=supfit / pg）。常用旋钮：

- --upstream / EPIRUS_SEEDPACK：起训根包
- --teacher / --teacher2 / --teacher3 / --teacher4 与 *frac：教师混合
- --groups / --steps / --lr / --seed / --out：样本数、步数、学习率、种子、产物
- --onlySeg / --arenaPool / --arenaShapes / --shapeBal / --rolloutMode：分段、考场与课程

代表命令（原文）：

    node training/proto2/supfit-gd.mjs --upstream=docs/artifacts/obs6-coldstart/OBS6E9.bak --teacher=pack:scratch/arms/OBS6-LH2.bak ... --groups=3200 --steps=120 --lr=0.01 --out=scratch/arms/OBS6-LH6.bak
    node training/proto2/pg-train.mjs --upstream=... --groups=... --steps=... --out=...

完整 134 条见 TSV；其中 supfit 97 条、pg 37 条。

## 六、复刻步骤（按现有验证过的流程）

1. 先按包 ts 找 era：取该批训练之后首次落地的提交（不是 ts 前一笔），建 era worktree。
2. 用 v6/3337 根包（champion-5p-v1.3.58 或对应 lineage 根），不要用 v7 嵌入版。
3. 按上表 n/pop/gpo/gens/seed/opps 起 server，轮询到 meta.gens=250。
4. 产物算 wid，对全局缺失清单；命中即按 registry 路径落盘，不按预期文件名。
5. registry.sha256 与 ARTIFACT-LOSS 状态同步。

## 七、已知缺口

- 含占位符的 URL（$S/$B/$POOL、${...}）已剔除；具体值要靠同段 shell 循环变量还原。
- 部分会话（如 d32b00d3、b3a09167 的部分阶段）以 run_code 嵌套调用为主，命令字符串已从 code 字段抽取，但仍可能漏掉未写入文本的临时变量。
- 没有逐 URL 时间戳；表中日期是会话范围，精确到批需结合会话事件时间。
- 早期 /train 的训练代码存在未提交工作树（例如 def-31 的 era 是 e227d222），复刻时 era 选择优先于 ts。
