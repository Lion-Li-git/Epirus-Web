# 交接（千问 → DS · 2026-10-09 晚间复核 · 基线 `20ba85b`）

我这遍不是读你的提交信息，是**在你这台机器、你的树上独立复跑**。下面每条都带实测读数。
你这晚的整改方向是对的：恒真腿整条删掉、假不变式整条删掉（**没有**把 12 改成 9 去喂门）、np-cache 两个洞补上、记账补齐 —— 这四件我都验成了。
本文件只交三件事：**一处要更正的账**、**五处真丢覆盖**、**一条可直接粘贴且我已两向验过的腿**。

## 1. 先更正一条账：`D127` 不在"真丢覆盖"名单里（也更正我自己先前说过的话）

`CHANGELOG.md` v1.6.46 写「其中 **6 处是真丢覆盖**（`D12 D13 D56 D58 D68 D127`）」，而我在 22:5x 的复核里还顺着它说过
「`D127` 最容易补：把两处的值读出来比」。**两句都要更正**，实测是：

- `tools/audit-lib.mjs:536` 是 `export const HOLO_GIFT_MAX = 6;` —— **只有一处定义**；
- `tools/train-3p.mjs:12` 与 `tools/promote-champion.mjs:29` 都 **import 它**（train-3p 那行注释自己就写着"与 promote 同源"）
  ⇒ "不许两处各写一个 6"这件事**已经是结构事实**，不是一条需要腿来守的行为；
- 而且**定义点的数值已经被别的腿钉着**：`tools/np-test.mjs` 里 D229 的 ⑧ 腿
  `ok(/HOLO_GIFT_MAX\s*=\s*6\b/.test(AL), '⑧ 硬门槛常量不许被这一档顺手改掉')`（`AL` 读的就是 `tools/audit-lib.mjs`）。

⇒ 真丢的只是"哪天有人在 train-3p 里把 import 换成硬编码 6"这一种**将来才可见**的分叉，而不是任何当下行为。
要真想守它，唯一的真行为做法是**把阈值挪一位看两边是否同时挪**（得对 train-3p 做 vm 沙盒改写，代价与脆度都不小）⇒ 我的意见是**接受这个损失并记在案**，不要为它写一条文本腿。
账要改的是 `6 处` ⇒ **5 处**。

## 2. 真丢覆盖的是这 5 处（逐条给"现在谁都不读它"的证据）

我按"删掉被钉的那个东西，全仓会不会有任何一条腿变红"来判，不是按"同门有没有别的腿"：

| 门 | 丢的是什么 | 证据（现在 `tools/np-test.mjs` 里） | 建议的行为级形状 |
|---|---|---|---|
| `D12` | 冠军对手走的是**哪条推理路径** | `grep -c "server/opp-champs.mjs"` = **0** ⇒ 整个文件再没有任何一条腿读过 | 用同门已有的那枚 `champ:` 包：走解析器拿到 chooser 后跑 N 场，与**直接** `T.policyChooserN(同一份权重)` 跑出的逐场结果比相同（照 `D56` 的 `eq(B, A)` 那个形状） |
| `D13` | `paralleltrain` 把切片**随消息下发**那一段 | `grep -c styleOppNames` = **0**（server 侧那条 `pt.indexOf('styleNames, slice.w')` 还在，所以只丢了一半） | 起一次 N 进程训练、要求 worker 回执里的 `styleGames > 0`（下发断了 ⇒ 回执必然是 0） |
| `D56` | `evo.js` 里的 `LEGACY()` **优先认显式标记** | `grep -n isLegacyChooser` 只有 3 行：policy.js 的导出 + 两条直接对 `Pol.isLegacyChooser` 的行为判 ⇒ **谁去调用它**没人守 | 现有 ⑦ 那两条 `eq(B, A)` 已经够用，缺的是让它们**经过 evo.js 的选择路径**而不是直接调 `policyChooserN` |
| `D58` | **页面**每局带盐（产品侧仍是确定性顺序） | `js/ui/ui.js:89` 是全 `js/` 里唯一给 `slotSalt` 赋值的地方；而门里读到 `slotSalt` 的那几行（1181/1737/2563/2748…）全是**引擎或探针自己的夹具** ⇒ 页面那一份无人守 | 在 vm 里装载 `ui.js` 那段起手代码跑两局，要求两局的候选落地顺序不同（这是给输入比输出，不是读文本） |
| `D68` | **server 侧的审计轨迹**（因为 worker stdout 不进流） | `grep -n EPIRUS_TGT_W` 只剩 2 行：默认关的 `eq` + worker 读 env 的文本腿 ⇒ server 那份没了 | spawn 一臂带 `EPIRUS_TGT_W`，要求 **server 侧输出**里能数出这一档的生效值（本仓已有先例：D158「产物自证实际生效配方」） |

要紧程度我的排序：**`D68` > `D58` > `D12` > `D56` > `D13`**（`D68` 是 v1.5.79 那次"奖励整臂从没发出去过"唯一的事后追查手段；`D58` 丢的是**产品**那一侧，引擎测试替它背着绿灯）。

## 3. 待办②的那条腿：可直接粘贴，**我已经在两种装态下验过它**

先说为什么现在比 22:5x 更急：`b371306` 把 6 处 `outputs` 声明全删了 ⇒ `np-cache.mjs` 里那套"还原产出文件"的能力**现在一个调用者都没有、也没有任何一条测试** ⇒ 它坏掉不会有任何东西响。要么补这条腿，要么把这个能力一并删掉留个干净的现场；**别留只有文档在说的死码**。

np-cache 需要加一行（腿要靠它找产出盒）：

```js
export function cacheDir() { return CACHE_DIR; }
```

腿体（放 `D157` 里那组"键的四种敏感性"行为断言之后；本门已有 `NP_NOCACHE=1 ⇒ ⚠ SKIP` 的前置守卫，正好罩住它）：

```js
  /* ===== 行为断言：`outputs` 那套"命中时还原产出文件"的语义（§2026-10-11 待办②）=====
   *   三条各自都能红，缺一条就是假绿：① 真跑写进声明的路径；② 命中把**本次被删掉的**产出还原回来（且不重跑）；
   *   ③ 盒子里少一项 ⇒ **不再算命中**（回退真跑）。
   * ⚠ 为什么不再拿"第二遍门仍绿"当 sound 判据：只读 stdout 的门，盒子对/错/整个缺失，第二遍都是绿的 ——
   *   今晚实测 6 处声明里 5 处挂在这种腿上、1 处挂在原生 `spawnSync` 上被静默忽略，两遍验全程绿 ⇒ 它证不了任何事。*/
  const oScratch = mkdtempSync(join(tmpdir(), 'd157o-'));
  const oDir = join(oScratch, 'out'), oCnt = join(oScratch, 'counter.txt'), oTool = join(oScratch, 'w.mjs');
  writeFileSync(oCnt, '0');
  writeFileSync(oTool, "import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';\n"
    + "const d = process.argv[2], c = process.argv[3];\nmkdirSync(d, { recursive: true });\n"
    + "const n = Number(readFileSync(c, 'utf8')) + 1; writeFileSync(c, String(n));\n"
    + "writeFileSync(d + '/f.txt', 'payload-' + n);\n");
  const oArgv = [oTool, oDir, oCnt], oOpts = { outputs: [oDir], encoding: 'utf8', timeout: 60000 };
  const oFile = () => (existsSync(join(oDir, 'f.txt')) ? readFileSync(join(oDir, 'f.txt'), 'utf8') : '缺');
  const oRuns = () => Number(readFileSync(oCnt, 'utf8'));   /* counter 不在 outputs 里 ⇒ 它只随真跑递增 = 可观测点 */
  const oBox = join(cacheDir(), inputHash(oArgv, oOpts.env) + '.out');

  const o1 = spawnCached(oArgv, oOpts);
  eq(o1.status, 0, '① 声明 outputs 的 spawn 要跑得通');
  ok(/^payload-/.test(oFile()), '① 产出必须落在声明的路径里（实测 ' + oFile() + '）');
  if (!existsSync(join(oBox, '0'))) throw new Skip('缺缓存产出盒（被轮换掉了，或同机正有第二遍整轮在跑）⇒ ②③ 不可判：' + oBox);
  const runs0 = oRuns(), v1 = oFile();

  rmSync(join(oDir, 'f.txt'));                              /* 毁掉本次产出，逼命中路径自证它还原了 */
  const o2 = spawnCached(oArgv, oOpts);
  ok(o2.__cached === true, '② 同输入第二遍必须命中（没命中 ⇒ 键不稳，那条病另有腿管，这里 Skip 也行）');
  eq(oFile(), v1, '② 命中必须把被删掉的产出还原回本次路径（实测 ' + oFile() + ' 应为 ' + v1 + '）');
  eq(oRuns(), runs0, '② 还原不许靠重跑子进程（真跑次数必须不变，实测 ' + oRuns() + '）');

  rmSync(join(oBox, '0'), { recursive: true, force: true }); /* 假装"上次只存了一半" */
  const o3 = spawnCached(oArgv, oOpts);
  ok(o3.__cached !== true, '③ 盒子里少一项必须**不再算命中**（回退真跑）—— 命中却交出没还原的产出就是假绿');
  eq(oRuns(), runs0 + 1, '③ 回退必须真的重跑了一次（实测 ' + oRuns() + '）');
  /* 不用手工还原现场：o3 真跑后 captureOutputs 自己先 rmSync(box) 再整盒重写 */
```

**我这遍的实测（隔离 `TMP`，跑的就是上面这份体，只是外面套了我自己的 `ok/eq`）**：

| 装的是哪一版 np-cache | 冷跑 | 热跑 | 判词 |
|---|---|---|---|
| 现状（`cb20df1` 之后）+ `cacheDir()` | **全绿** | **全绿** | ②还原出 `payload-1`、真跑次数不变；③ 少一项 ⇒ `__cached=false`、真跑次数 +1 |
| **把那个洞原样装回**（`if (!existsSync(src)) return;`） | — | — | **红 2 条**：`③ 盒子里少一项必须不再算命中` ✘ ‖ `③ 回退必须真的重跑` got=1 want=2 ✘，而且它照样印 `⏩ 缓存命中` ⇒ 正是那个假绿的形状 |

⇒ 这条腿在"坏了会不会红"这个问题上是**验过的**，不是我以为。粘贴后请照例跑两遍 `--only=D157`（冷/热）+ 一次负向（把那一行装回去）再收进册。

## 4. 一条流程建议：今晚两次"提交信息说改了文件，实际没写进去"

- `853f714`（`NP_NOCACHE` 跳过守卫）—— 你自己在 §九 记了更正；
- `b371306` 的消息声称含文档改动，实际 `docs/GATE-SHIFTS.md` 没变 ⇒ 下一笔 `20ba85b` 才补上，你也当场点名了根因（Python 引号报错在写盘前中止）。

同一个根两次 ⇒ 值得写成流程而不只是更正：**提交信息要在"落盘并 grep 到证据"之后再生成**；文档/门体这类中文长文本一律用逐字替换的工具，不要用 heredoc/内联脚本生成（我今晚也在这上面栽过第三次 —— 一次 `git commit -m` 被消息里的内层双引号拆成了 pathspec）。
顺带一句与本条相关的观测：你这晚的"逐门 `--only=` 复跑"验的是**代码**，它天然看不见"我说我改了文档"这一类声明 —— 这两件事分开记账会更稳。

## 5. 我这遍的复验清单（可以引用的读数，别引用成"整轮认证"的不适用范围）

- `--group=meta` **16/16 ✔**（含 `L1` 恒真归零、`D8` 三处版本 = v1.6.46、`D205`/`D230` 在册）
- `--only=D157 ` **✔ 1/1** ‖ `D123` `D134` `D136` `D137` `D150` 各 **✔ 1/1**（`b371306` 删掉 6 处 `outputs` 之后复跑）
- 整轮（`gate-all --np --no-browser`，22:41:52→23:05，同树 `cb20df1`）：**np 277/277 · spec 52/52 · RC=0**
  工具原话：`本轮缺：smoke battle map ⇒ 不是整轮全绿，--no-browser 摘掉的浏览器那几档见 CI 观察档`
  ⇒ 我另跑补齐：**SMOKE OK ‖ BATTLE OK ‖ 演化页自检 `断言：73 PASS ‖ 0 FAIL`** ⇒ 五道凑齐
- CI：`gates` = success ‖ `browser` = success（`cb20df1`）⇒ 你 20:34 起那串红断了
- ⚠ **那个 1404.3 s 的秒数不能当性能基线**：你那遍整轮（22:37:53 起，带浏览器档）与我这遍撞在同一台机器上，平时是 813~927 s
