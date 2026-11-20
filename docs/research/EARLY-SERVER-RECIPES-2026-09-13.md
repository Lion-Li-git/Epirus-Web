# 早期 server 训练配方（dsh 会话出土，2026-09-12/13）

来源：dsh 会话
- session-227e2bc8-49f3-4852-9923-92f8333e03d5（最早，09-07~09-10）
- session-0add3d39-7534-4b8a-b64b-8afdeaf07d2b（第二个，09-12~09-13）

## 一、3P 训练起点（session 1，CLI）

- 首条真实训练：`node tools/train-3p.mjs 400 3 10 16`（09-09 13:12）
- 随后：`500 3 10 20`、`600 3 16 32`、`500 3 24 32`、`400 3 20 32`、`500 3 20 32`（09-09~09-10）
- 参数含义：代 / 人数 / 每代局数 / 种群；产物 `js/bundled-champion-3p.js`。

## 二、09-12/13 server 批次（session 2，HTTP /train）

**统一根包**：`docs/artifacts/champion-5p-v1.3.58.bak`（wid `e379c62ccd2648fa`，v6/3337）
**统一参数**：`gens=250&n=5&pop=16&gpo=8`，每次跑前 `cp` 根包到 `js/bundled-champion-3p.js`。

### 2.1 eco 批（12 对手）

```
/train?gens=250&n=5&pop=16&gpo=8&seed=$S&opps=random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver
```

seeds 31–36 → `eco-31..36.bak`；日志中 seed31 自评 0.2962/top2 0.5008。

### 2.2 ring2 批（12 + ringspam）

`B="$A,ringspam"`，seeds 32–36（31 已单独产出 `ring2-31.bak`）→ `ring2-N.bak`。

### 2.3 def 批（12 + reflectspam,guardspam,protowall）

```
/train?gens=250&n=5&pop=16&gpo=8&seed=$S&opps=random,balanced,aggro,defend,wall,antidef,breakdef,mix,farmer,tankline,heavyfire,deepsaver,reflectspam,guardspam,protowall
```

seeds 31–36 → `def-N.bak`；日志 seed31 自评 0.3390/top2 0.4990。

### 2.4 long 批（12 对手 + mode=long）

`...&seed=$S&opps=<12>&mode=long`，seeds 31–36。

## 三、复现结论

- 根包 `champion-5p-v1.3.58.bak` 的 wid 就是 `e379c62ccd2648fa`（与 slot 根一致）。
- 之前 def 复现失败的唯一原因是 **opps 名单用错**：def 批是 `reflectspam,guardspam,protowall`，不是 `ringspam,reflectspam,guardspam`。
- 09-12/13 的 fam1/2 缺失包应按上述四批 × seeds 31–36 重放；产物 wid 对全局缺失清单，命中即收。

## 四、验证结果（2026-11-20 13:35）

- 用 e227d222 + champion-5p-v1.3.58 + seed31 + def 名单重放：firstRate=0.33904761904761904、top2=0.4990476190476191，与 09-13 日志逐位相同；wid=3406d277e7ce1d04 = 在册 def-31。
- 已落盘 docs/artifacts/def-31.bak，registry sha=9a2815358810，台账 534→533。

