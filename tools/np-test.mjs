/* Epirus N 人（3-5）引擎测试 —— **runner**（v1.7.8 拆分：278 条门搬进 tools/gates/**）
 *
 * 本文件现在只负责"跑"：解析命令行 → 把 16 个部分文件的门收上来 → **按原始行号排序**执行 → 汇总/退出。
 *   · 门体住在 tools/gates/<部分>.mjs，每一条都带自己的**原始行号**（`ords`）⇒ 执行顺序与拆分前逐条相同。
 *   · 共享前导（import / 沙箱 / ok / eq / Skip / mulberry32 / 常量…）住在 tools/gates/_ctx.mjs，部件解构接回。
 *   · runner 自己留着 t/PASS/FAIL/__skipped/__KEYS/ONLY/GROUP/RUNSET/GRP/CUM/KEY2G/gateKey 与收尾块。
 *
 * 用法（`--only=` / `--group=` / `--list-groups` 与拆前逐字相同）：
 *   node tools/np-test.mjs                    整轮（278 条）
 *   node tools/np-test.mjs --group=meta       只跑仓库纪律那一组（含累计依赖）
 *   node tools/np-test.mjs --part=train-evo   只跑**那一个部分文件**里的门（2026-10-14 DS 加；见下"两个轴"）
 *      ⚠ 与 `--group` **不是同一个轴**：`--group` 是**累计深度轴**（meta ⊂ ship ⊂ train/ui ⊂ probe ⊂ engine=全部，
 *        组与组互相包含 ⇒ 摆不出互不相交的并行）；`--part` 是**分区轴**（16 个文件互不重叠、并集 = 278 条）
 *        ⇒ 它才是"把整轮摊成互不相交若干份（CI 矩阵）"与"单独量某一个部分的墙钟"的那个口子。
 *        ⚠ 同样**不冒充全绿**：收尾响亮印"本部分共 N 条、跑了 M 条"。
 *   node tools/np-test.mjs --only=D193        只跑名字匹配的那条
 *   node tools/np-test.mjs --list-order       按**执行顺序**印 [原始行号, 门名]（用于证明保序）
 *   node tools/np-test.mjs --list-parts       印部分划分、每部分条数、路径→部分映射表
 *   node tools/np-test.mjs --list-parts --explain=D234   某条门为什么落在这个部分（可复算）
 * ⚠ `--list-*` 只是**清单**，不跑门、也不冒充全绿（与 `--list-groups` 同规矩）。 */
import { existsSync, readFileSync, readdirSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
/* 共享前导（原 L1..L205）：沙箱 / 断言助手 / 库 / 常量 —— 全在这一个文件里装载（ESM 单实例）。 */
import { makeCtx, NP_GATE_FILES } from './gates/_ctx.mjs';
import * as PART0 from './gates/engine-rules.mjs';
import * as PART1 from './gates/engine-fuzz.mjs';
import * as PART2 from './gates/train-evo.mjs';
import * as PART3 from './gates/train-chooser.mjs';
import * as PART4 from './gates/train-feature.mjs';
import * as PART5 from './gates/train-env.mjs';
/* §E659（10-20 夜班 #51）：原 `train-runner`（31 条 ‖ CI 上一个部分顶住整趟 97%）按**语义族**拆成四个部分
 *   —— 用户 23:1x 口径「拆门禁要尽量保证其基本逻辑，而不是单纯为了快而拆」⇒ 不是按耗时对半切。
 *   族表在 docs/research/archive/2026-10-20-night-d15-gates/families.json，搬门体由 tools/gate-resplit.mjs 做（带四条自证）。 */
import * as PART6 from './gates/train-table.mjs';
import * as PART17 from './gates/train-pick.mjs';
import * as PART18 from './gates/train-econ.mjs';
import * as PART19 from './gates/train-breadth.mjs';
import * as PART7 from './gates/ship-feas.mjs';
import * as PART8 from './gates/ship-pool.mjs';
import * as PART9 from './gates/ship-promote.mjs';
import * as PART10 from './gates/ship-artifact.mjs';
import * as PART11 from './gates/probe-libs.mjs';
import * as PART12 from './gates/probe-instruments.mjs';
import * as PART13 from './gates/ui-contract.mjs';
import * as PART14 from './gates/meta-repo.mjs';
import * as PART15 from './gates/meta-lint.mjs';
/*#np-runner-header
{"file":"tools/np-test.mjs","ranges":[[98,99],[108,156],[169,179],[204,205],[10490,10506],[12292,12339]],"patched":[12292]}
#np-runner-header-end*/
const { cacheStats } = makeCtx();   /* runner 侧只借这一件：收尾的缓存计数行（原 L10501） */

/* ===== 19 个部分文件（顺序无关：收上来之后按原始行号排序）===== */
const PARTS = [
  { part: 'engine-rules', group: 'engine', file: 'tools/gates/engine-rules.mjs', mod: PART0 },   /* 62 条 */
  { part: 'engine-fuzz', group: 'engine', file: 'tools/gates/engine-fuzz.mjs', mod: PART1 },   /* 13 条 */
  { part: 'train-evo', group: 'train', file: 'tools/gates/train-evo.mjs', mod: PART2 },   /* 65 条 */
  { part: 'train-chooser', group: 'train', file: 'tools/gates/train-chooser.mjs', mod: PART3 },   /* 2 条 */
  { part: 'train-feature', group: 'train', file: 'tools/gates/train-feature.mjs', mod: PART4 },   /* 4 条 */
  { part: 'train-env', group: 'train', file: 'tools/gates/train-env.mjs', mod: PART5 },   /* 4 条 */
  { part: 'train-table', group: 'train', file: 'tools/gates/train-table.mjs', mod: PART6 },   /* 10 条：训练桌与对手（原 train-runner 的 C 族） */
  { part: 'train-pick', group: 'train', file: 'tools/gates/train-pick.mjs', mod: PART17 },   /* 6 条：当选键与 veto（A 族） */
  { part: 'train-econ', group: 'train', file: 'tools/gates/train-econ.mjs', mod: PART18 },   /* 11 条：econ 下达 · 起点 · 缓存（D 族） */
  { part: 'train-breadth', group: 'train', file: 'tools/gates/train-breadth.mjs', mod: PART19 },   /* 4 条：广度与兑现（B 族） */
  { part: 'ship-feas', group: 'ship', file: 'tools/gates/ship-feas.mjs', mod: PART7 },   /* 14 条 */
  { part: 'ship-pool', group: 'ship', file: 'tools/gates/ship-pool.mjs', mod: PART8 },   /* 1 条 */
  { part: 'ship-promote', group: 'ship', file: 'tools/gates/ship-promote.mjs', mod: PART9 },   /* 21 条 */
  { part: 'ship-artifact', group: 'ship', file: 'tools/gates/ship-artifact.mjs', mod: PART10 },   /* 1 条 */
  { part: 'probe-libs', group: 'probe', file: 'tools/gates/probe-libs.mjs', mod: PART11 },   /* 4 条 */
  { part: 'probe-instruments', group: 'probe', file: 'tools/gates/probe-instruments.mjs', mod: PART12 },   /* 33 条 */
  { part: 'ui-contract', group: 'ui', file: 'tools/gates/ui-contract.mjs', mod: PART13 },   /* 8 条（v1.7.115 加 D236） */
  { part: 'meta-repo', group: 'meta', file: 'tools/gates/meta-repo.mjs', mod: PART14 },   /* 12 条 */
  { part: 'meta-lint', group: 'meta', file: 'tools/gates/meta-lint.mjs', mod: PART15 },   /* 4 条 */
];
const PART_GROUPS = {
  engine: ['engine-rules', 'engine-fuzz'],
  train: ['train-evo', 'train-chooser', 'train-feature', 'train-env', 'train-table', 'train-pick', 'train-econ', 'train-breadth'],
  ship: ['ship-feas', 'ship-pool', 'ship-promote', 'ship-artifact'],
  probe: ['probe-instruments', 'probe-libs'],
  meta: ['meta-repo', 'meta-lint'],
  ui: ['ui-contract'],
};

/* ===== 路径 → 部分 映射表（判据 = 这道门**读哪一层的输入**；本表与 --list-parts 是同一份）=====
 * 深度序（越靠前越深；一条门同时命中多个部分时取**它所在组内**最深的那个）：
 *   engine-rules > engine-fuzz > train-evo > train-chooser > train-feature > train-env > train-runner(已拆成 train-table ‖ train-pick ‖ train-econ ‖ train-breadth，四者同深度) > ship-feas > ship-pool > ship-promote > ship-artifact > probe-libs > probe-instruments > ui-contract > meta-repo > meta-lint
 * 组归属由 GRP 钉死（与拆分前逐字相同）：命中的部分若不在本门所在组 ⇒ 跳过，继续往下看。
 * 记号表（只对 engine 组生效：N/D 裁定点读的是进程内沙箱、没有文件路径 ⇒ 只用路径表会把整组压进 engine-rules）：
 *   /Play\.autoGame/ ⇒ engine-fuzz   （记号：自动对局驱动（Play.autoGame*））
 *   /\bfuzz\b/ ⇒ engine-fuzz   （记号：fuzz 随机对局）
 *   /终局收缩|suddenDeath|回合上限/ ⇒ engine-fuzz   （记号：终局收缩 / 回合上限（长程族））
 *   /long mode|long 模式|setTrainMode\('long'\)|'long'/ ⇒ engine-fuzz   （记号：长程模式档）
 * 路径表（按深度序；同深度内具体文件在前、通配在后）：
 *   /^js\/core\// ⇒ engine-rules   （js/core/** 引擎语义）
 *   /^tests\// ⇒ engine-rules   （tests/** 引擎用例）
 *   /^(rules|state|resolve|play)\.js$/ ⇒ engine-rules   （裸名核心引擎件）
 *   /^js\/train\/evo\.js$/ ⇒ train-evo   （js/train/evo.js）
 *   /^(evo|trainer)\.js$/ ⇒ train-evo   （裸名 evo / trainer）
 *   /^js\/train\/policy\.js$/ ⇒ train-feature   （js/train/policy.js）
 *   /^policy\.js$/ ⇒ train-feature   （裸名 policy）
 *   /^js\/train\/bots\.js$/ ⇒ train-chooser   （js/train/bots.js）
 *   /^bots\.js$/ ⇒ train-chooser   （裸名 bots）
 *   /^js\/train\// ⇒ train-table   （js/train/** 其余）
 *   /^server\/(train-env|econ-env|knob-guard|wall-cap|fight-env)\.mjs$/ ⇒ train-env   （server 旋钮表）
 *   /^(train-env|econ-env|knob-guard|wall-cap|fight-env)\.mjs$/ ⇒ train-env   （裸名旋钮表）
 *   /^server\/(train-server|train-worker|paralleltrain)\.mjs$/ ⇒ train-table   （server 训练跑器）
 *   /^(train-server|train-worker|paralleltrain)\.mjs$/ ⇒ train-table   （裸名训练跑器）
 *   /^tools\/(train-3p|train-best|train-fast|eval-5p|pick-5p|ring2-run|diag|style-exam)\.mjs$/ ⇒ train-table   （tools 训练入口）
 *   /^(train-3p|train-best|train-fast|eval-5p|pick-5p|ring2-run|diag|style-exam)\.mjs$/ ⇒ train-table   （裸名训练入口）
 *   /^champion-map\/feas/ ⇒ ship-feas   （champion-map/feas*）
 *   /^champion-map\/ruler-/ ⇒ ship-feas   （champion-map/ruler-*）
 *   /^tools\/champ-audit\.mjs$/ ⇒ ship-feas   （tools/champ-audit.mjs）
 *   /^(feas|ruler-.*)\.(mjs|tsv)$/ ⇒ ship-feas   （裸名可行性件）
 *   /^js\/pool-draw\.js$/ ⇒ ship-pool   （js/pool-draw.js）
 *   /^champion-map\/pool-/ ⇒ ship-pool   （champion-map/pool-*）
 *   /^champion-map\/pack-/ ⇒ ship-pool   （champion-map/pack-*）
 *   /^tools\/(pool-add|build-pool-bundle|pool-sync|soup-pack)\.mjs$/ ⇒ ship-pool   （tools 池装配）
 *   /^(pool-members|pack-aliases)\.(tsv|md)$/ ⇒ ship-pool   （裸名池表）
 *   /^docs\/POOL-CONTRACT\.md$/ ⇒ ship-pool   （docs/POOL-CONTRACT.md）
 *   /^js\/bundled/ ⇒ ship-promote   （js/bundled* 线上槽）
 *   /^js\/champion-pack\.js$/ ⇒ ship-promote   （js/champion-pack.js 包解析）
 *   /^tools\/(promote-champion|gate-drafts|gate4-exception|unrun-policy|screen-champ|p2-baselines|zero-promote-check)\.mjs$/ ⇒ ship-promote   （tools 出厂面）
 *   /^(promote-champion|gate-drafts|gate4-exception|unrun-policy|screen-champ|p2-baselines|bundled-champion[^/]*)\.(mjs|js)$/ ⇒ ship-promote   （裸名出厂面）
 *   /^docs\/artifacts\// ⇒ ship-artifact   （docs/artifacts/** 产物面）
 *   /^tools\/(dedupe-artifacts|keep-artifact)\.mjs$/ ⇒ ship-artifact   （tools 产物维护）
 *   /^(dedupe-artifacts|keep-artifact)\.mjs$/ ⇒ ship-artifact   （裸名产物维护）
 *   /^tools\/[A-Za-z0-9_.-]*-lib\.mjs$/ ⇒ probe-libs   （tools/*-lib.mjs 纯函数库）
 *   /^(audit-lib|v2v4-lib|np-cache|[A-Za-z0-9_.-]*-lib)\.mjs$/ ⇒ probe-libs   （裸名纯函数库）
 *   /^tools\/probe-/ ⇒ probe-instruments   （tools/probe-* 量具）
 *   /^tools\/(usage-probe|behavior-profile|log-behavior|log-census|log-reading|gate-sentinel|skill-report|explain-champion-decision|gate-landscape|screen-)\.mjs$/ ⇒ probe-instruments   （tools 量具）
 *   /^tools\/analyze-/ ⇒ probe-instruments   （tools/analyze-* 判读器）
 *   /^(probe-.*|screen-.*|usage-probe|behavior-profile|log-behavior|log-census|log-reading|gate-sentinel|skill-report|explain-champion-decision|gate-landscape|analyze-.*)\.mjs$/ ⇒ probe-instruments   （裸名量具）
 *   /^docs\/debug\// ⇒ probe-instruments   （docs/debug/**）
 *   /^js\/ui\// ⇒ ui-contract   （js/ui/** 页面）
 *   /^ui\.js$/ ⇒ ui-contract   （裸名 ui.js）
 *   /^index\.html$/ ⇒ ui-contract   （index.html）
 *   /^README\.md$/ ⇒ meta-repo   （README.md）
 *   /^CHANGELOG\.md$/ ⇒ meta-repo   （CHANGELOG.md）
 *   /^docs\/[^/]*\.md$/ ⇒ meta-repo   （docs/*.md）
 *   /^tools\/gate-all\.mjs$/ ⇒ meta-repo   （tools/gate-all.mjs）
 *   /^tools\/(smoke|battle-test|spec-run|repro-check)\.mjs$/ ⇒ meta-repo   （tools 门禁跑器）
 *   /^(REVIEW-.*|PARAMS-PLAN|PROPOSAL-.*|POOL-CONTRACT)\.md$/ ⇒ meta-repo   （裸名文档）
 *   /^tools\/np-test\.mjs$/ ⇒ meta-lint   （自指：tools/np-test.mjs）
 *   /^np-test\.mjs$/ ⇒ meta-lint   （自指：裸名 np-test.mjs）
 *   /^tools\/gates\// ⇒ meta-lint   （自指：tools/gates/**）
 * 一条門都没有路径引用 ⇒ 落在本组第一个部分（engine=engine-rules / train=train-evo / ship=ship-feas /
 *   probe=probe-instruments / meta=meta-repo / ui=ui-contract）。
 * 复算：`node tools/np-test.mjs --list-parts`（每个部分几条）+ `--list-parts --explain=<门键>`（这一条为什么落这儿）。
 * ⚠ 抽取式是"门文本里形如 `js/core/…`、`tools/…`、`docs/…` 且以 .mjs/.js/.tsv/.json/.md/.html/.css/.bak 收尾的引号内字符串"；
 *   拼出来的路径（`'tools/' + nm + '.mjs'`）抽不到 ⇒ 那些门按它**其余**的引用判，全无引用则回落到本组第一个部分。 */
const MAP_RULES = [
  ['sig', /Play\.autoGame/, 'engine-fuzz', '记号：自动对局驱动（Play.autoGame*）'],
  ['sig', /\bfuzz\b/, 'engine-fuzz', '记号：fuzz 随机对局'],
  ['sig', /终局收缩|suddenDeath|回合上限/, 'engine-fuzz', '记号：终局收缩 / 回合上限（长程族）'],
  ['sig', /long mode|long 模式|setTrainMode\('long'\)|'long'/, 'engine-fuzz', '记号：长程模式档'],
  ['path', /^js\/core\//, 'engine-rules', 'js/core/** 引擎语义'],
  ['path', /^tests\//, 'engine-rules', 'tests/** 引擎用例'],
  ['path', /^(rules|state|resolve|play)\.js$/, 'engine-rules', '裸名核心引擎件'],
  /* §E659 语义族规则**必须排在所有 train 组的路径规则之前**：一条门常常同时读 `js/train/evo.js` 与
   *   `tools/train-3p.mjs`，按路径分根本分不开（那会把同一族拆散、把不同族混在一起）⇒ 归属按**门号名单**判。
   *   ⚠ 往这四个部分里**新加一条门**必须同时把它加进下面对应的那串门号，否则它落到下面的路径规则上 ⇒
   *   `tools/gate-parts-check.mjs` 的判据④（文件成员数 ≠ 归属条数）当场红，不会静默。 */
  ['sig', /^t\('D(?:221|104|114|176|213|165)\b/, 'train-pick', 'A 族：当选键与 veto'],
  ['sig', /^t\('D(?:127|128|130|159)\b/, 'train-breadth', 'B 族：广度与兑现'],
  ['sig', /^t\('D(?:220|223|7|11|12|72|89|13|135|136)\b/, 'train-table', 'C 族：训练桌与对手'],
  ['sig', /^t\('D(?:185|184|180|175|174|120|144|157|229|222|119)\b/, 'train-econ', 'D 族：econ 下达 · 起点 · 缓存'],
  ['path', /^js\/train\/evo\.js$/, 'train-evo', 'js/train/evo.js'],
  ['path', /^(evo|trainer)\.js$/, 'train-evo', '裸名 evo / trainer'],
  ['path', /^js\/train\/policy\.js$/, 'train-feature', 'js/train/policy.js'],
  ['path', /^policy\.js$/, 'train-feature', '裸名 policy'],
  ['path', /^js\/train\/bots\.js$/, 'train-chooser', 'js/train/bots.js'],
  ['path', /^bots\.js$/, 'train-chooser', '裸名 bots'],
  ['path', /^js\/train\//, 'train-table', 'js/train/** 其余（原 train-runner 的路径规则 ⇒ 拆族后归到训练桌族，新门要靠上面的门号名单登记）'],
  ['path', /^server\/(train-env|econ-env|knob-guard|wall-cap|fight-env)\.mjs$/, 'train-env', 'server 旋钮表'],
  ['path', /^(train-env|econ-env|knob-guard|wall-cap|fight-env)\.mjs$/, 'train-env', '裸名旋钮表'],
  ['path', /^server\/(train-server|train-worker|paralleltrain)\.mjs$/, 'train-table', 'server 训练跑器（原 train-runner 的路径规则 ⇒ 拆族后归到训练桌族，新门要靠上面的门号名单登记）'],
  ['path', /^(train-server|train-worker|paralleltrain)\.mjs$/, 'train-table', '裸名训练跑器（原 train-runner 的路径规则 ⇒ 拆族后归到训练桌族，新门要靠上面的门号名单登记）'],
  ['path', /^tools\/(train-3p|train-best|train-fast|eval-5p|pick-5p|ring2-run|diag|style-exam)\.mjs$/, 'train-table', 'tools 训练入口（原 train-runner 的路径规则 ⇒ 拆族后归到训练桌族，新门要靠上面的门号名单登记）'],
  ['path', /^(train-3p|train-best|train-fast|eval-5p|pick-5p|ring2-run|diag|style-exam)\.mjs$/, 'train-table', '裸名训练入口（原 train-runner 的路径规则 ⇒ 拆族后归到训练桌族，新门要靠上面的门号名单登记）'],
  ['path', /^champion-map\/feas/, 'ship-feas', 'champion-map/feas*'],
  ['path', /^champion-map\/ruler-/, 'ship-feas', 'champion-map/ruler-*'],
  ['path', /^tools\/champ-audit\.mjs$/, 'ship-feas', 'tools/champ-audit.mjs'],
  ['path', /^(feas|ruler-.*)\.(mjs|tsv)$/, 'ship-feas', '裸名可行性件'],
  ['path', /^js\/pool-draw\.js$/, 'ship-pool', 'js/pool-draw.js'],
  ['path', /^champion-map\/pool-/, 'ship-pool', 'champion-map/pool-*'],
  ['path', /^champion-map\/pack-/, 'ship-pool', 'champion-map/pack-*'],
  ['path', /^tools\/(pool-add|build-pool-bundle|pool-sync|soup-pack)\.mjs$/, 'ship-pool', 'tools 池装配'],
  ['path', /^(pool-members|pack-aliases)\.(tsv|md)$/, 'ship-pool', '裸名池表'],
  ['path', /^docs\/POOL-CONTRACT\.md$/, 'ship-pool', 'docs/POOL-CONTRACT.md'],
  ['path', /^js\/bundled/, 'ship-promote', 'js/bundled* 线上槽'],
  ['path', /^js\/champion-pack\.js$/, 'ship-promote', 'js/champion-pack.js 包解析'],
  ['path', /^tools\/(promote-champion|gate-drafts|gate4-exception|unrun-policy|screen-champ|p2-baselines|zero-promote-check)\.mjs$/, 'ship-promote', 'tools 出厂面'],
  ['path', /^(promote-champion|gate-drafts|gate4-exception|unrun-policy|screen-champ|p2-baselines|bundled-champion[^/]*)\.(mjs|js)$/, 'ship-promote', '裸名出厂面'],
  ['path', /^docs\/artifacts\//, 'ship-artifact', 'docs/artifacts/** 产物面'],
  ['path', /^tools\/(dedupe-artifacts|keep-artifact)\.mjs$/, 'ship-artifact', 'tools 产物维护'],
  ['path', /^(dedupe-artifacts|keep-artifact)\.mjs$/, 'ship-artifact', '裸名产物维护'],
  ['path', /^tools\/[A-Za-z0-9_.-]*-lib\.mjs$/, 'probe-libs', 'tools/*-lib.mjs 纯函数库'],
  ['path', /^(audit-lib|v2v4-lib|np-cache|[A-Za-z0-9_.-]*-lib)\.mjs$/, 'probe-libs', '裸名纯函数库'],
  ['path', /^tools\/probe-/, 'probe-instruments', 'tools/probe-* 量具'],
  ['path', /^tools\/(usage-probe|behavior-profile|log-behavior|log-census|log-reading|gate-sentinel|skill-report|explain-champion-decision|gate-landscape|screen-)\.mjs$/, 'probe-instruments', 'tools 量具'],
  ['path', /^tools\/analyze-/, 'probe-instruments', 'tools/analyze-* 判读器'],
  ['path', /^(probe-.*|screen-.*|usage-probe|behavior-profile|log-behavior|log-census|log-reading|gate-sentinel|skill-report|explain-champion-decision|gate-landscape|analyze-.*)\.mjs$/, 'probe-instruments', '裸名量具'],
  ['path', /^docs\/debug\//, 'probe-instruments', 'docs/debug/**'],
  ['path', /^js\/ui\//, 'ui-contract', 'js/ui/** 页面'],
  ['path', /^ui\.js$/, 'ui-contract', '裸名 ui.js'],
  ['path', /^index\.html$/, 'ui-contract', 'index.html'],
  ['path', /^README\.md$/, 'meta-repo', 'README.md'],
  ['path', /^CHANGELOG\.md$/, 'meta-repo', 'CHANGELOG.md'],
  ['path', /^docs\/[^/]*\.md$/, 'meta-repo', 'docs/*.md'],
  ['path', /^tools\/gate-all\.mjs$/, 'meta-repo', 'tools/gate-all.mjs'],
  ['path', /^tools\/(smoke|battle-test|spec-run|repro-check)\.mjs$/, 'meta-repo', 'tools 门禁跑器'],
  ['path', /^(REVIEW-.*|PARAMS-PLAN|PROPOSAL-.*|POOL-CONTRACT)\.md$/, 'meta-repo', '裸名文档'],
  ['path', /^tools\/np-test\.mjs$/, 'meta-lint', '自指：tools/np-test.mjs'],
  ['path', /^np-test\.mjs$/, 'meta-lint', '自指：裸名 np-test.mjs'],
  ['path', /^tools\/gates\//, 'meta-lint', '自指：tools/gates/**'],
];
const PATH_RE = /['"`]([A-Za-z0-9_][A-Za-z0-9_.\/-]*\.(?:mjs|js|tsv|json|md|html|css|bak))['"`]/g;

/* 从部分文件里按**同样的行边界**切门：`^t(` 起、到下一个 `^t(` 的前一行止（与拆分用的那把尺一致）。 */
function tNameOf(line) { const q = line.indexOf("'"); let i = q + 1, out = "";
  while (i < line.length) { const c = line[i]; if (c === "\\") { out += line[i + 1]; i += 2; continue; } if (c === "'") break; out += c; i++; }
  return out; }
function partGateTexts(P) {
  const ls = readFileSync(P.file, "utf8").split("\n");
  const marks = [];
  for (let i = 0; i < ls.length; i++) if (/^t\(/.test(ls[i])) marks.push(i);
  return marks.map(function (a, k) {
    const b = k + 1 < marks.length ? marks[k + 1] - 1 : ls.length - 1;
    return { ord: P.mod.ords[k], name: tNameOf(ls[a]), text: ls.slice(a, b + 1).join("\n") };
  });
}
function attributeGate(text, group) {
  const ps = []; let m; PATH_RE.lastIndex = 0;
  while ((m = PATH_RE.exec(text))) ps.push(m[1]);
  const uniq = Array.from(new Set(ps));
  for (const r of MAP_RULES) {
    if (PART_GROUPS[group].indexOf(r[2]) < 0) continue;
    if (r[0] === "sig") { if (r[1].test(text)) return { part: r[2], reason: "sig「" + r[3] + "」", paths: uniq }; continue; }
    for (const p of uniq) if (r[1].test(p)) return { part: r[2], reason: "path「" + p + "」⇒ " + r[3], paths: uniq };
  }
  return { part: PART_GROUPS[group][0], reason: "fallback：本组第一个部分（门文本里没有任何路径引用命中）", paths: uniq };
}
const ARG_LIST_PARTS = process.argv.includes("--list-parts");
const ARG_LIST_ORDER = process.argv.includes("--list-order");
const ARG_EXPLAIN = (process.argv.find(function (a) { return a.indexOf("--explain=") === 0; }) || "").slice(10) || null;

/*#np-keep 98-99*/
let PASS = 0, FAIL = 0;
let __skipGates = 0;   /* §2026-10-09 DS：响亮跳过（缺本机产物）—— 不算通过、不算失败、CI 不红 */
/*#np-keep-end*/
/*#np-keep 108-156*/
const __T = [];   /* v1.5.224：按门计时。默认**零成本**（只 push 两个数），NP_TIME=1 时才在收尾印排行榜。
                   * 整轮墙钟用 `process.uptime()`（见收尾），不另记起点 —— 少一个变量就少一处能写错的地方。 */
/* `--only=<子串>`：**只跑名字匹配的门**（v1.5.288）。
 * 为什么要它：本文件没有"单门复跑"的口子，改一条门的判据就要等整轮 6~10 分钟 ⇒
 * 实际发生的是我拿**开发台脚本**在外面复算同一批断言（D193 今天就这么做的），
 * 而那套外部脚本与门体是分叉的两份代码。有了 `--only`，"改门 → 验门"回到同一把尺上。
 * ⚠ 这条**不冒充全绿**：跑完会响亮印"跳过 N 条"，收尾的注册数守卫也把跳过数算进去。 */
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7) || null;
let __skipped = 0;
/* ===== §E335 分组：以后不必每次全跑一遍（用户 10-06 点名）=====
 * 为什么这样切：整轮里最慢的 15 道全是 train/ship（当时 D176 一道 107.5s —— **那是 v1.5.281 之前的读数**：
 *   D176 早已改 `spawnBatch`、v1.7.64 又把两波合成一波；现数见 docs/GATE-SHIFTS.md 的真源表），而"只改了 champion-map/ 或 docs/"
 *   那一类工作，实测**没有任何一道门读那两个目录**
 *   （`grep -c champion-map tools/np-test.mjs tools/spec-run.mjs tools/smoke.mjs tools/battle-test.mjs` 全 0）
 *   ⇒ 那种班次真正该跑的只有"仓库纪律"那 15 道（读 CHANGELOG/README/门号/源码形状），是**秒级**的。
 * 分组键 = 门名第一个空格前那段（D###/N##/L#/REPRO…）。键数 < 门数（一个键可盖住多条同前缀的门）；
 *   ⚠ 这两个数**都不在本文件里写死**（曾写死 269/272，早已漂）⇒ 现读 `--list-parts --json`；有 3 个键被多条门共用
 *   （N2/N3/N4 那几族）⇒ **同键必须同组**，启动时撞组直接红。
 * ⚠ 三条不许糊：① `--group` 与 `--only` 一样**不冒充全绿**（跳过多少条响亮印出来）；
 *   ② **整轮（不带 --group）额外要求"每条门都归了组"** ⇒ 新加门忘了归类当场判红，
 *      否则表会悄悄漏掉后加的腿，那正是本仓最怕的"门绿着但它没在看你要上线的那个东西"；
 *   ③ 归组判据是"这道门读哪一层的输入"，不是"它属于哪个 §E 编号" —— 后者会把改引擎的门留在窄组里。*/
const GRP = {
  meta: 'REPRO L1 L2 L3 L7 L6 L5 D218 D8 D82 D189 D191 D194 D205 D206 D230',   // 仓库纪律：只读源码/CHANGELOG/README/门号
  ui: 'D37 D38 D28 D70 D131 D111 D166 D236',                                    // 页面与前端契约
  ship: 'D219 D55 D16 D35 D27 D49 D60 D61 D62 D67 D73 D78 D79 D103 D105 D116 D118 D124 D125 D141 D153 D155 D163 D107 D110 D121 D145 D146 D147 D168 D169 D170 D190 D197 D210 D228 D234',   // 出厂面：可行性闸 / 当选 / promote / 线上槽 / 池装配契约
  train: 'REPRO2 L4 D217 D220 D221 D222 D223 D224 D225 D226 D227 D229 D5 D7 D9 D10 D11 D12 D13 D15 D56 D58 D59 D17 D24 D25 D26 D33b D33 D36 D39 D40 D41 D42 D43 D44 D45 D47 D48 D65 D66 D68 D72 D74 D75 D76 D77 D80 D81 D84 D85 D86 D87 D89 D90 D104 D97 D99 D100 D101 D108 D109 D112 D113 D114 D119 D122 D123 D127 D128 D129 D130 D132 D134 D135 D136 D139 D140 D115 D162 D120 D143 D144 D157 D159 D167 D172 D173 D174 D175 D176 D179 D181 D180 D182 D184 D185 D213 D164 D165 D187 D188 D201 D204 D231 D232',   // 训练侧：evo.js / chooser / 特征 / env 旋钮 / 并发跑器
  probe: 'D34 D64 D83 D88 D137 D138 D148 D149 D150 D151 D152 D154 D160 D161 D106 D158 D177 D178 D183 D186 D192 D193 D195 D196 D198 D200 D199 D212 D214 D202 D203 D207 D208 D209 D211 D216 D233',   // 研究量具自身的牙
  engine: 'N1 N2 目标：attemptAction N3 N3b N10 N10b N10c N8 N14 N14b N15 N16 N17 N18 N19 N4 N4b N4c N12 N12b N6 N6b 目标反锁：上回合与某对手互为目标而相抵 目标选择：能一击必杀先杀；否则打血量最高的领先者 fuzz：3/4/5 autoGame N20a N20b N20c N20d N20e N21 N22 N22b N22c N23 D1 D2 D3 D4 D6 D51 D52 D53 D54 D57 D18 D19 D20 D21 D22 D14 D23 D29 D30 D31 D46 D50 D63 D91 D102 D92 D93 D94 D95 D96 D98 D71 D117 D126 D142',   // 引擎与规则语义（改这里 ⇒ 只能全跑）
};
/* 累计依赖：跑一个组 = 跑它自己 + 它所依赖的更浅的组。engine 是"全部"。 */
const CUM = { meta: ['meta'], ship: ['ship', 'meta'], ui: ['ui', 'train', 'ship', 'meta'],
  train: ['train', 'ship', 'meta'], probe: ['probe', 'train', 'ship', 'meta'], engine: null };
const KEY2G = {}; const __CLASH = [];
for (const g in GRP) for (const k of GRP[g].split(' ')) {
  if (KEY2G[k] && KEY2G[k] !== g) __CLASH.push(k + '（' + KEY2G[k] + ' / ' + g + '）');
  KEY2G[k] = g; }
if (__CLASH.length) { console.error('⛔ §E335 分组表撞组（同一个键落进两个组 ⇒ 同键的多条门必须同组）：' + __CLASH.join(' ')); process.exit(2); }
const gateKey = n => String(n).trim().split(/[ \u3000]/)[0];
const __KEYS = [];
if (process.argv.includes('--list-groups')) {
  for (const g in GRP) console.log('  ' + g.padEnd(7) + GRP[g].split(' ').length + ' 个键');
  console.log('  合计   ' + Object.keys(KEY2G).length + ' 个键（⚠ 键数 ≠ 门数：一个键可盖住多条同前缀的门（N2/N3/N4 那几族）⇒ 门数看 `--list-parts --json` 的 total，本文件不许再写死那个数）');
  console.log('  累计   ' + Object.keys(CUM).map(g => g + (CUM[g] ? '=' + (CUM[g].reduce((s, x) => s + GRP[x].split(' ').length, 0)) + '条' : '=全部')).join(' ‖ '));
  process.exit(0);
}
const GROUP = (process.argv.find(a => a.startsWith('--group=')) || '').slice(8) || null;
if (GROUP && !(GROUP in CUM)) {
  console.error('⛔ `--group=' + GROUP + '` 不认识（可选：' + Object.keys(CUM).join('/') + '）。含糊拼写不许当"没写"。');
  process.exit(2); }
const RUNSET = GROUP ? new Set(CUM[GROUP].reduce((a, g) => a.concat(g === 'engine' ? Object.keys(GRP).flatMap(x => GRP[x].split(' ')) : GRP[g].split(' ')), [])) : null;
/*#np-keep-end*/

/* ===== `--part=<部分>`（2026-10-14 DS）：只跑**某一个部分文件**里的门 =====
 * 为什么要有它：拆成 16 个文件之后，"16 个文件"第一次成为一个**分区**（互不重叠、并集 = 278 条），
 *   而 `--group` 那条轴做不到这件事 —— 它是累计的（见文件头"两个轴"）。
 * 判据用**门住在哪个文件**（注册时记下的 P.part），不是门名也不是它读了哪些路径：
 *   并行的物理单位就是文件；用名字/路径去推会在 N2/N3/N4 那种同键多门的地方推歪。
 * ⚠ 少跑了就是少跑了：执行处按跳过记账（`__skipped++`），收尾响亮印"本部分共 N 条 · 跑了 M 条"。 */
const PART = (process.argv.find(a => a.startsWith('--part=')) || '').slice(7) || null;
if (PART && !PARTS.some(p => p.part === PART)) {
  console.error('⛔ `--part=' + PART + '` 不认识（可选：' + PARTS.map(p => p.part).join(' ') + '）。含糊拼写不许当"没写"。');
  process.exit(2);
}
if (PART && GROUP) {
  console.error('⛔ `--part=` 与 `--group=` 不许同时给：一个是分区轴、一个是累计深度轴，混在一起只会得到"看着像全量"的假绿。');
  process.exit(2);
}
/* v1.7.22：**裸位置参数一律拒**（10-15 夜班实测踩的：`--part= train-chooser train-evo …` 这种"等号后空格列多个"的写法，
 *   `--part=` 的值是空串 ⇒ `PART = null` ⇒ 筛选**当成没给** ⇒ 我以为在跑 8 段，实际跑了整轮 278 条，退出码还是 0）。
 *   整轮本身不是错，错在"以为自己在跑分段"——这一类静默降级与 D218 那条"拼错的旗标被忽略"是同一种病。
 *   要跑多段请分别调用（一次一个 `--part=<名>`）。 */
const STRAY = process.argv.slice(2).filter(function (a) { return a[0] !== '-'; });
if (STRAY.length) {
  console.error('⛔ 不认识裸参数：' + STRAY.join(' ') + ' ⇒ 本工具只认 `--flag=值`。' +
    '特别地：`--part=` 后面**留空格再列多个名字**会被读成"没给筛选"= 整轮；要分段请一次一个 `--part=<名>` 分别调用。');
  process.exit(64);
}
/* ===== --list-parts / --explain：把"哪条门落哪个部分、为什么"印出来（可复算）===== */
if (ARG_LIST_PARTS || ARG_EXPLAIN) {
  const all = [];
  for (const P of PARTS) for (const g of partGateTexts(P)) all.push({ part: P.part, group: P.group, ord: g.ord, name: g.name, text: g.text });
  /* `--list-parts --json`（2026-10-14 DS）：给 **CI 的 plan 作业**现读部分清单用。
   * 为什么必须从 runner 现读、不许在 workflow 里写死：写死清单迟早在加第 17 个部分时漏掉，
   *   而漏掉的表现是"少跑几条门却全绿" —— 本仓今天已经在这上面栽过两次（轮询漏消费者）。
   * 条数报的是**文件成员数**（`ords.length`，也就是 `--part=` 真正会跑的那些），
   *   同时把**路径归属表的条数**（`attr`）一起报出来：两者不一致 = 映射表漂了，CI 那条并集守卫会红。 */
  if (process.argv.includes('--json')) {
    const out = PARTS.map(function (P) {
      return { part: P.part, group: P.group, file: P.file,
        gates: (P.mod.ords || []).length,
        attr: all.filter(function (g) { return g.part === P.part; }).length };
    });
    console.log(JSON.stringify({ parts: out, total: out.reduce(function (s, x) { return s + x.gates; }, 0) }));
    process.exit(0);
  }
  if (ARG_EXPLAIN) {
    const hit = all.filter(function (g) { return gateKey(g.name) === ARG_EXPLAIN; });
    if (!hit.length) { console.error("⛔ --explain=" + ARG_EXPLAIN + "：没有这条件（门键 = 门名第一个空格前那段）"); process.exit(2); }
    for (const g of hit) {
      const a = attributeGate(g.text, g.group);
      console.log("  门 " + gateKey(g.name) + "（原始行 " + g.ord + " · 组 " + g.group + "）⇒ 部分 " + a.part);
      console.log("     理由：" + a.reason);
      console.log("     抽到的路径引用：" + (a.paths.length ? a.paths.join(" ‖ ") : "（无）"));
      console.log("     落盘：" + (a.part === g.part ? "与当前落盘一致 ✅" : "⛔ 与当前落盘不一致：" + g.part));
    }
    process.exit(0);
  }
  console.log("== 部分划分（16 个文件；组归属与拆分前的 GRP 逐字相同）==");
  for (const P of PARTS) console.log("  " + P.group.padEnd(7) + P.part.padEnd(18) + all.filter(function (g) { return g.part === P.part; }).length + " 条");
  console.log("  " + "".padEnd(25) + all.length + " 条合计");
  console.log("");
  console.log("== 每组条数（GRP 键数在同一行；N2/N3/N4 各有多条 ⇒ 门的条数 ≥ 键数）==");
  for (const g in GRP) console.log("  " + g.padEnd(7) + all.filter(function (x) { return x.group === g; }).length + " 条门 / " + GRP[g].split(" ").length + " 个键");
  console.log("");
  console.log("== 路径 → 部分 映射表（表序 = 深度序；同时命中取本组内最深）==");
  for (const r of MAP_RULES) console.log("  " + r[0] + "  " + r[2] + "  /" + r[1].source + "/  " + r[3]);
  process.exit(0);
}

/*#np-keep 169-179*/
function t(name, fn) {
  const __k = gateKey(name); __KEYS.push(__k);
  if (ONLY && name.indexOf(ONLY) < 0) { __skipped++; return; }
  if (RUNSET && !RUNSET.has(__k)) { __skipped++; return; }
  const __t0 = Date.now();
  try { fn(); PASS++; console.log('  ✔ ' + name); }
  catch (e) {
    if (e && e.__skip) { __skipGates++; console.log('  ⚠ SKIP ' + name + '  → ' + e.message); return; }
    FAIL++; console.log('  ✘ ' + name + '  → ' + e.message); }
  __T.push([Date.now() - __t0, name]);
}
/*#np-keep-end*/

/* ===== 收门：16 个部分各自的 [[原始行号, 门名, 门函数]] =====
 * ⚠ 门在部分文件里**只注册不执行**（`register(t)` 把 t 当参数接走）⇒ 这里才真正决定执行顺序：按原始行号。 */
const __UNITS = [];
for (const P of PARTS) {
  const o = P.mod.ords;
  if (!Array.isArray(o) || !o.length) throw new Error("部分文件 " + P.part + " 没有导出 ords（拆分坏了）");
  let i = 0;
  P.mod.register(function (name, fn) {
    const ord = o[i++];
    if (ord === undefined) throw new Error("部分文件 " + P.part + " 的 register() 比 ords 多调了一次 t()（拆分坏了）");
    __UNITS.push([ord, name, fn, P.part]);   /* 第 4 位 = 这条门住在哪个部分文件（`--part=` 的筛子只看这个） */
  });
  if (i !== o.length) throw new Error("部分文件 " + P.part + " 的 register() 少调了 " + (o.length - i) + " 次 t()（拆分坏了）");
}
/* 夹在门与门之间的**顶层代码**（原文 L10490..L10506，`NP_TIME=1` 的计时/缓存汇总）
 * —— 它不是门，但按拆前的**位置**在门 D214 之后、D164 之前执行 ⇒ 这里按原始行号插回执行序列（保序、保值）。 */
function __npTimeStep() {
/*#np-keep 10490-10506*/
/* ⚠ v1.5.79：汇总**必须在 process.exit 之前**（否则它是死代码、永远不打印 =>
 * 门禁会安静地不报结论）。~~D69 自检守着这个顺序~~ ⇒ **D69 已在 v1.5.128 按审计删掉**
 * （它是自指门：检查 np-test 自己的行序）⇒ **现在没有门守这个顺序，改文件尾部时自己看住**。 */if (process.env.NP_TIME === '1') {
  /* v1.5.224：**按门计时**（默认零成本，只有 NP_TIME=1 时才印排行榜）。
   * 动机：用户问"门禁为什么要 4 分钟"，我先前只能靠猜 —— 现在先量再优化。 */
  const __tot = __T.reduce(function (a, b) { return a + b[0]; }, 0);
  const __slow = __T.slice().sort(function (a, b) { return b[0] - a[0]; });
  /* v1.5.224：**整轮**用 `process.uptime()`（真·进程墙钟，含引擎装载）；`门槛外` = 整轮 − 门内合计。 */
  const __wall = process.uptime();
  console.log('\n=== 计时：整轮 ' + __wall.toFixed(1) + ' 秒 · 门内合计 ' + (__tot / 1000).toFixed(1) +
    ' 秒 · 门槛外 ' + (__wall - __tot / 1000).toFixed(1) + ' 秒（进程启动 + 沙箱装载）===');
  const __cs = cacheStats();
  console.log('=== 缓存：命中 ' + __cs.hit + ' 次 · 真跑 ' + __cs.miss + ' 次 · 省下 ' + (__cs.savedMs / 1000).toFixed(1) +
    ' 秒（`NP_NOCACHE=1` 关闭；键 = argv + EPIRUS_* env + 源码树内容）===');
  console.log('=== 最慢的 15 道门 ===');
  for (const r of __slow.slice(0, 15)) console.log('  ' + (r[0] / 1000).toFixed(1).padStart(6) + ' 秒  ' + r[1].slice(0, 76));
}
/*#np-keep-end*/
}
/* 执行序列 = 278 条门 + 1 段门间顶层代码，**全部按原始行号排序** ⇒ 与拆前逐条同序。 */
const __STEPS = __UNITS.map(function (u) { return [u[0], "gate", u[1], u[2], u[3]]; });
__STEPS.push([10490, "raw", "__np-time-block", __npTimeStep]);
__STEPS.sort(function (a, b) { return a[0] - b[0]; });
if (ARG_LIST_ORDER) { for (const st of __STEPS) console.log(String(st[0]).padStart(6) + "\t" + st[2]); process.exit(0); }
/*#np-keep 204-205*/
console.log('== N 人引擎测试 ==');

/*#np-keep-end*/
for (const st of __STEPS) {
  if (st[1] !== "gate") { st[3](); continue; }
  if (PART && st[4] !== PART) { __KEYS.push(gateKey(st[2])); __skipped++; continue; }   /* 跳过的门也登记键 ⇒ 收尾的"每条门都归了组"仍然是对**全仓 278 条**说的，不是对这一个部分说的 */
  t(st[2], st[3]);
}
/* `--part` 与 `--only`/`--group` 同罪：少跑了就是少跑了，收尾前自己喊出来（这一段在 #np-keep 之外，可改）。 */
if (PART) {
  const __partN = __STEPS.filter(function (s) { return s[1] === 'gate' && s[4] === PART; }).length;
  console.log('\n⚠ `--part=' + PART + '`：本部分共 ' + __partN + ' 条，跑了 ' + (PASS + FAIL) + ' 条（其余 ' + __skipped
    + ' 条按跳过记账）⇒ 这不是全量门禁，**不许当整轮全绿引用**（整轮 = 不带 --part/--group/--only）。');
  if (PASS + FAIL === 0) { console.error('⛔ `--part=' + PART + '` 一条都没跑 ⇒ 部分筛选写错了，这不是全绿。'); process.exit(3); }
}

/*#np-keep 12292-12339*/
const __src = NP_GATE_FILES.map(function (f) { return readFileSync(f, "utf8"); }).join("\n").split("\n");

const __nReg = __src.filter(l => /^t\(/.test(l)).length;
if (__nReg !== PASS + FAIL + __skipped + __skipGates) {
  console.error("⛔ 注册的 t() 有 " + __nReg + " 条，但只执行了 " + (PASS + FAIL) + " 条"
    + (__skipped ? "（另有 " + __skipped + " 条被 --only 跳过）" : "")
    + " ⇒ 有门落在 process.exit 之后（死代码）或被条件跳过。这不是全绿，是少跑。");
  process.exit(1);
}
if (ONLY) {
  console.log('\n⚠ `--only=' + ONLY + '`：**只跑了 ' + (PASS + FAIL) + ' / ' + __nReg + ' 条**（跳过 ' + __skipped
    + ' 条）⇒ 这不是全量门禁，**不许当整轮全绿引用**（`node tools/np-test.mjs` 不带参数才是整轮）。');
}
/* §E335 `--group` 与 `--only` 同罪：少跑了就是少跑了，必须自己喊出来。 */
if (GROUP) {
  console.log('\n⚠ `--group=' + GROUP + '`：**只跑了 ' + (PASS + FAIL) + ' / ' + __nReg + ' 条**（跳过 ' + __skipped
    + ' 条；累计含 ' + (CUM[GROUP] ? CUM[GROUP].join('+') : '全部') + '）⇒ 这不是全量门禁，**不许当整轮全绿引用**。');
}
if (GROUP && PASS + FAIL === 0) {
  console.error('⛔ `--group=' + GROUP + '` 一条都没跑（' + __nReg + ' 条注册全被筛掉）⇒ 分组表或累计关系写错了，这不是全绿。');
  process.exit(3);
}
/* §E335 整轮才查"每条门都归了组"：新加的门忘了归类 ⇒ 判红。
   不这么钉的话，表会在某次加门之后**悄悄**漏掉那条腿，而窄组照样绿 —— 本仓最怕的"门绿着但它没在看你要上线的东西"。*/
if (!GROUP && !ONLY) {
  const un = []; const seenU = {};
  for (const k of __KEYS) if (!KEY2G[k] && !seenU[k]) { seenU[k] = 1; un.push(k); }
  if (un.length) {
    console.error('⛔ §E335 分组表漏了 ' + un.length + ' 条门（新加门要在 GRP 里归组）：' + un.slice(0, 12).join(' ')
      + (un.length > 12 ? ' …' : ''));
    process.exit(4);
  }
  console.log('§E335 分组在册 ✅ ' + __KEYS.length + ' 条门全部归组（' + Object.keys(KEY2G).length + ' 个键）');
}
/* `--only` 打错字 ⇒ 一条都不跑却报"通过 0 / 0"，那是最坏的一种绿（看着像跑完且全绿）。响亮拒。 */
if (ONLY && PASS + FAIL + __skipGates === 0) {
  console.error('⛔ `--only=' + ONLY + '` 在 ' + __nReg + ' 条注册里**一个都没匹配到** ⇒ 一条没跑，这不是全绿。检查子串拼写。');
  process.exit(3);
}


/* §2026-10-09：括号挪回正确位置 —— 上一版写成 `console.log(…) + (跳过…)`，于是**跳过数永远不显示**
 * （它拼到了 console.log 的返回值 undefined 上）。CI 日志就是证据：那一遍 D233 明明被跳过，
 * 总结行却是光秃秃的「通过 274 / 275」⇒ 读者会把"少跑了一条"读成"跑完 275 条"。 */
console.log('\nN人测试：通过 ' + PASS + ' / ' + (PASS + FAIL) + (__skipGates ? ' · 跳过 ' + __skipGates + '（不算通过也不算失败）' : ''));


process.exit(FAIL ? 1 : 0);
/*#np-keep-end*/

