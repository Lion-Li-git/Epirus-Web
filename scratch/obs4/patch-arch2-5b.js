/* arch2.mjs forwardObs3 的 obs5 分支：死亡席跳过 / 无池化 / 注意力+PMA / xin 拼接（与 policy2 逐字同源） */
const fs = require('fs');
const F = 'tools/proto2/arch2.mjs';
let s = fs.readFileSync(F, 'utf8');
let n = 0;
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const repRE = (anchorLines, replaceLines, tag) => {
  const pat = new RegExp(anchorLines.map(esc).join('\r?\n'));
  if (!pat.test(s)) { console.error('锚失败: ' + tag); process.exit(2); }
  s = s.replace(pat, replaceLines.join('\n'));
  n++;
};

/* ① v4 旗标旁加 v5 */
repRE(["    const v4 = L.input === 'obs4';   /* obs4：槽位分支（无 mean/max、无 hSelf 单列——自己在槽里） */"],
  ["    const v4 = L.input === 'obs4';   /* obs4：槽位分支（无 mean/max、无 hSelf 单列——自己在槽里） */",
   "    const v5 = L.input === 'obs5';   /* obs5：注意力聚合（与 policy2.forwardCands 逐字同源，改一处必改三处） */"], 'B1');

/* ② 循环顶：死亡席不进集合 */
repRE(["    for (const s of sc.seats) {",
       "      let k = 0;"],
  ["    for (const s of sc.seats) {",
   "      /* obs5：死亡席不进集合（不编码、不占 softmax、不进 tape）——淘汰信息由 sit 的淘汰数维承载 */",
   "      if (v5 && !(s.isSelf === 1 || s.public[14] === 1)) continue;",
   "      let k = 0;"], 'B2');

/* ③ 池化两处包上 !v4 && !v5 */
repRE(["      if (!v4 && s.isSelf) { hSelf = e; continue; }"],
  ["      if (!v4 && !v5 && s.isSelf) { hSelf = e; continue; }"], 'B3');
repRE(["      if (!v4) {", "        poolN++;"],
  ["      if (!v4 && !v5) {", "        poolN++;"], 'B4');
repRE(["    if (!v4) { const kk = Math.max(1, poolN); for (let j = 0; j < L.seatH; j++) mean[j] /= kk; }"],
  ["    if (!v4 && !v5) { const kk = Math.max(1, poolN); for (let j = 0; j < L.seatH; j++) mean[j] /= kk; }"], 'B5');

/* ④ 注意力+PMA 块（插在 mean 归一之后、xin 之前）——与 policy2.forwardCands 逐字同源 */
repRE(["    if (!v4 && !v5) { const kk = Math.max(1, poolN); for (let j = 0; j < L.seatH; j++) mean[j] /= kk; }"],
  ["    if (!v4 && !v5) { const kk = Math.max(1, poolN); for (let j = 0; j < L.seatH; j++) mean[j] /= kk; }",
   "",
   "    /* ---- obs5 注意力聚合（11-10 ZCode）——与 policy2.forwardCands / pg-lib tapeForward 逐字同源，改一处必改三处 ----",
   "     *   活席集合上的自注意力（QKV 线性投影 /√H 掩码 softmax，残差直连）→ PMA（4 seed 查询，keys/values",
   "     *   重读注意力后语境向量 ē）。置换不变与跨人数泛用由结构成立：softmax 作用在在场集合上，K 不进权重。 */",
   "    const pooled5 = new Float64Array(L.poolN * L.seatH);",
   "    if (v5) {",
   "      const H5 = L.seatH, SQ5 = Math.sqrt(H5);",
   "      const atS = L.seg.find((s) => s.name === 'attn'), pmS = L.seg.find((s) => s.name === 'pma');",
   "      const WQ = atS.off, BQ = WQ + H5 * H5;",
   "      const WKg = BQ + H5, BKg = WKg + H5 * H5;",
   "      const WVg = BKg + H5, BVg = WVg + H5 * H5;",
   "      const WQ2 = pmS.off, BQ2 = WQ2 + H5 * H5, SD0 = BQ2 + H5;",
   "      const lin5 = (src, wOff, bOff) => { const out = new Float64Array(H5); for (let j = 0; j < H5; j++) { let s5 = params[bOff + j]; const base = wOff + j * H5; for (let i = 0; i < H5; i++) s5 += params[base + i] * src[i]; out[j] = s5; } return out; };",
   "      const sm5 = (row) => { let m5 = -Infinity; for (let j = 0; j < row.length; j++) if (row[j] > m5) m5 = row[j]; let s5 = 0; const w = new Float64Array(row.length); for (let j = 0; j < row.length; j++) { w[j] = Math.exp(row[j] - m5); s5 += w[j]; } for (let j = 0; j < row.length; j++) w[j] /= s5; return w; };",
   "      const es5 = [];",
   "      for (const s of sc.seats) if (enc.has(s.id)) es5.push(enc.get(s.id));   // sc.seats = pid 序 ⇒ 求和序确定",
   "      const K5 = es5.length;",
   "      const qs5 = [], ks5 = [], vs5 = [];",
   "      for (let i = 0; i < K5; i++) { qs5.push(lin5(es5[i], WQ, BQ)); ks5.push(lin5(es5[i], WKg, BKg)); vs5.push(lin5(es5[i], WVg, BVg)); }",
   "      const ebs5 = [];",
   "      for (let i = 0; i < K5; i++) {",
   "        const row = new Float64Array(K5);",
   "        for (let j = 0; j < K5; j++) { let lg = 0; for (let t = 0; t < H5; t++) lg += qs5[i][t] * ks5[j][t]; row[j] = lg / SQ5; }",
   "        const w = sm5(row);",
   "        const eb = new Float64Array(H5);",
   "        for (let j = 0; j < K5; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H5; t++) eb[t] += wj * vs5[j][t]; }",
   "        for (let t = 0; t < H5; t++) eb[t] += es5[i][t];   // 残差：席位原始嵌入直通，信息全覆盖不过瓶颈",
   "        ebs5.push(eb);",
   "      }",
   "      const kbs5 = [], vbs5 = [];",
   "      for (let j = 0; j < K5; j++) { kbs5.push(lin5(ebs5[j], WKg, BKg)); vbs5.push(lin5(ebs5[j], WVg, BVg)); }",
   "      for (let d = 0; d < L.poolN; d++) {",
   "        const seed = new Float64Array(H5);",
   "        for (let t = 0; t < H5; t++) seed[t] = params[SD0 + d * H5 + t];",
   "        const q2d = lin5(seed, WQ2, BQ2);",
   "        const row = new Float64Array(K5);",
   "        for (let j = 0; j < K5; j++) { let lg = 0; for (let t = 0; t < H5; t++) lg += q2d[t] * kbs5[j][t]; row[j] = lg / SQ5; }",
   "        const w = sm5(row);",
   "        for (let j = 0; j < K5; j++) { const wj = w[j]; if (!wj) continue; for (let t = 0; t < H5; t++) pooled5[d * H5 + t] += wj * vbs5[j][t]; }",
   "      }",
   "    }"], 'B6');

/* ⑤ xin 拼接：obs4 块后加 v5 分支 */
repRE(["      for (let s = 0; s < 8; s++) { const e = enc.has(s) ? enc.get(s) : BUF.zeroSeat; for (let j = 0; j < L.seatH; j++) xin[p++] = e[j]; }",
       "    } else {"],
  ["      for (let s = 0; s < 8; s++) { const e = enc.has(s) ? enc.get(s) : BUF.zeroSeat; for (let j = 0; j < L.seatH; j++) xin[p++] = e[j]; }",
   "    } else if (v5) {",
   "      /* obs5：局面比较 4 维（直接可读）+ PMA 池 4×seatH（内容寻址，K 自由）——没有 mean/max、没有槽位身份 */",
   "      for (let i = 0; i < (sc.sit || []).length; i++) xin[p++] = sc.sit[i];",
   "      for (let i = 0; i < pooled5.length; i++) xin[p++] = pooled5[i];",
   "    } else {"], 'B7');

fs.writeFileSync(F, s);
console.log('forwardObs3 obs5 分支完成 ' + n + ' 处');
