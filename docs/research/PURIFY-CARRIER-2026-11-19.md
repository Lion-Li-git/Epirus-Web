# PURIFY 载体与 Q-s47 锚缺失（2026-11-19 夜）

## 已做出的载体

- 产物：`scratch/arms/day1119-purify-t2b.bak`（wid=c279f4c5e45ec35a）
- 训练：`--teacher=purify --teacher2=pack:EQ-S4-E9 --teacher2frac=0.4 --rareOnly=purify --rareFrac=0.3 --arenaPool=names:pack:day1119-det-gd --arenaShapes=5:multi --groups=2000 --steps=800`
- 教师标签：净化 657 条；留出净化 96%（500）
- 条件能力（200 局 vs 活咒源 det-gd）：净化 **0.64 次/局（multi）**、**0.56 次/局（long）**
- 体检：无阻断；A 考卷 43.0%；广度 multi 3.88 / long 3.12；G4 最坏 39%/60%；G5 严格/上线档 PASS
- 临时入池后的 Stage1：并集 18/30，**purify 覆盖 2/120**（说明夹具里确有少量咒源）

## 阻塞：Q-s47 锚缺失

`measure-point` 给新点补图时退出：

```
Error: ENOENT: docs/artifacts/e507-out/Q-s47.js
```

- Q-s47 是 `tools/exam-4n.mjs` 的默认 B 轴冠军席（反墙锚，注释：2.0 池没有包压得住反射墙，只有 v7 Q-s47 能把 G5C 压到 3P 17%）。
- 它是 11-19 清理丢失的 669 枚之一；全盘 `D:\code`、用户目录、Git 历史、两个 Release 资产都没有。
- 没有它，**当前尺无法测新点**；池表/包/图三账无法同时满足，所以本载体已从池表撤下（池保持 24，工作区干净）。

## 选项

1. **用户提供 Q-s47 备份**（最佳，当前尺原样恢复）。
2. 重训一枚替代反墙锚 ⇒ 等于换 B 尺，必须重测 1002 点的 B/C，且需要用户明确点头。
3. 暂不在图上加载体 ⇒ P1 覆盖/负资产替换全部停在“能训、不能入图”的状态。
