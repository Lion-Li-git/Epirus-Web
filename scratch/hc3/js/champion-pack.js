/* 冠军包解析（v1.5.141）：把"包文本"变成 pack 对象 —— 单一来源，纯函数、不碰 DOM。
 *
 * 为什么需要：页面原本只能导入**自己导出的 JSON**（`index.html` 的「导入」按钮 ⇒ `Champ.store.importJSON`），
 *   而训练产物是 `docs/artifacts/*.bak`，形态是 **JS 外壳**：
 *     window.EPIRUS_CHAMPION_3P = { ... };            （多人槽）
 *     window.EPIRUS_CHAMPION    = { ... };            （2P 槽）
 *   ⇒ 用户想把某个候选包拿去实机试，就得先把外壳剥掉。剥壳逻辑只写这一份（本仓"同一规则两处维护"栽过四次）。
 *
 * 口径：
 *   · 能吃三种输入：① 页面导出的 JSON ② 产物 `.bak`/`.js`（含外壳，槽位由外壳名判定）
 *     ③ 兜底：从第一个 `{` 切到最后一个 `}`（给"注释 + 包"混排的文本用）。
 *   · **不校验兼容性** —— 那是 `P.checkPack` 的职责（调用方负责），本模块只管"取出来"。
 *   · 返回 `{ ok, pack, slot, source }`；失败 `{ ok:false, reason }`（reason 与 champReasonText 同族）。
 *   · 非贪婪 `\{[\s\S]*?\}` 后面紧跟 `\s*;` 是安全的：合法 JSON 里不会出现 `};` 这个序列。
 */
(function (global) {
  'use strict';

  function _ok(pack, source, slot) {
    if (!pack || typeof pack !== 'object') return { ok: false, reason: 'parse-error' };
    return { ok: true, pack: pack, source: source, slot: slot || null };
  }

  /* 从任意文本里取出 pack。slot ∈ '2p' | '3p' | null（判定不出来时给 null，由调用方决定落到哪个槽）。 */
  function extract(text) {
    if (text == null) return { ok: false, reason: 'empty' };
    const s = String(text);
    const t = s.trim();
    if (!t) return { ok: false, reason: 'empty' };

    /* ① 纯 JSON（页面导出的就是这种） */
    if (t.charAt(0) === '{') {
      try { return _ok(JSON.parse(t), 'json', null); } catch (e) { /* 落到外壳分支 */ }
    }

    /* ② 产物外壳：window.EPIRUS_CHAMPION_3P = { ... }; —— 槽位由外壳名判定 */
    const m = /EPIRUS_CHAMPION(_3P)?\s*=\s*(\{[\s\S]*?\})\s*;/.exec(s);
    if (m) {
      try { return _ok(JSON.parse(m[2]), 'bundle', m[1] ? '3p' : '2p'); }
      catch (e) { return { ok: false, reason: 'parse-error' }; }
    }

    /* ③ 兜底：把最外层那对花括号切出来 */
    const i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i >= 0 && j > i) {
      try { return _ok(JSON.parse(s.slice(i, j + 1)), 'sliced', null); } catch (e) { /* 放弃 */ }
    }
    return { ok: false, reason: 'parse-error' };
  }

  global.EpirusChampionPack = { extract: extract, version: 'v1.5.141' };
})(typeof window !== 'undefined' ? window : globalThis);
