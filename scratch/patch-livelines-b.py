import io

p = 'docs/research/LIVE-LINES.md'
raw = io.open(p, encoding='utf-8', newline='').read()
nl = '\r\n' if '\r\n' in raw else '\n'
s = raw.replace('\r\n', '\n')

anchor = '关闭的路累计 9 条；未试：TD(λ)/更大 batch。账 §十七 §十八 |'
assert s.count(anchor) == 1, ('anchor', s.count(anchor))

row = ('| `research/champion-2.0-repr-2026-10-28`（**结构与训练对齐段**，10-31 深夜—02 时，千问，与上五行同分支接力） '
       '| 千问 | 查法 `git log --oneline -1`（本表不写死 SHA）‖ 判据：Stage A 代 3（`dims.keySplit`）+ Stage B 删 qHead 并**整体退役代 2** '
       '| 两段做完：键层按决策键分组（珠种进键层，§十九）‖ qHead 那 33 个参数删掉 ⇒ 重蒸产物前 7993 条与旧代 3 **逐位同 0.00e+0**、'
       '440 局冻结桌逐列复现 **+47.3%**（仍是册上最好一列，不是新读数）‖ 代 2（v:91）随段表变化**整体退役**（`GEN_LATEST=3` ‖ 浏览器分派只认 92 ‖ '
       '旧包响亮拒读 exit 7）‖ 验收：selftest2 36 条 ‖ selftest3 6 条（腿 G 随头删）‖ browser-parity P1–P6 ‖ pack2-audit A–E ‖ '
       '三台出货面（supfit-gd / pg-train / probe-cem-arm）各烟测一发。'
       '**路上抓出五条"坏了不红"**：① 腿 C 的 1e-8 绝对地板在饱和包上把整批好格子判成红（诊断=数值梯度随 ε 缩小而等比放大 ⇒ 纯舍入；改 ulp(f)/ε + 训练尺度地板，'
       '分母"判定 680 ‖ 不进判定 7933"一起印）；② 旧腿 C 每点只抽 4% 坐标 ⇒ 单坐标漏项 ~89% 概率扫不到（注入"删 policyHead 偏置梯度"三次都绿），'
       '改逐坐标全扫 + 全扫夹具须可分辨坐标 ≥300 否则判红，牙=四条注入三咬一不误咬；③ `policyHead` 的 bias 对所有候选同加 ⇒ 两级 softmax 里被完全对消 ⇒ '
       '**恒不可学**（这条是 ② 的注入测顺手量出来的）；④ v:92 在游戏侧读不出（Stage A 的 parity 只验了工具侧腿 E）；'
       '⑤ `pack2-audit` 的 D 段对 obs3b 静默跳过 + A 段 dof 那一格恒过（改完拿 dims.dof=208 的变异验牙 ⇒ 当场红），'
       '外加 `chain-price`/`fitness-noise` 的"unpack 不出 ⇒ 跳过"会少一行而退码照 0 ⇒ 改成整桌不交。'
       '账 §十九 §二十 ‖ **Stage C 只剩观测面双轨（obs3/obs3b）退役** |')

s = s.replace(anchor, anchor + '\n' + row)
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace('\n', nl) if nl == '\r\n' else s)
print('LIVE-LINES 加行完成（NL=%r）' % nl)
