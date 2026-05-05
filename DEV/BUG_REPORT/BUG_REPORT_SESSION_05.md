## Phase 4 Verification Report

**Phase 4 goal:** Make undiacritized letters immediately visible, add the linguistic warning layer, and activate Tab jump.

---

### Task 4.1 — Letter-Level Amber Colouring

**Logic (visual-hints.js):** ✅ Complete and correct.

- `_isAmberCandidate()` correctly implements all spec §8.4 exempt rules: non-initial alef, final alef maqsura, waw after damma, ya after kasra, and the pragmatic fallback (undiacritized predecessor → amber).
- `classifyAllWords()` and `reclassifyWord()` are both implemented with correct delta-only totalUndiacCount updates.

**On file open:** ✅ `renderer.js` calls `classifyAllWords()` after `renderDocument()`, so amber colouring appears immediately.

**After diacritic write — 🐛 BUG (Critical):** `_handleDiacriticKey()` and `_handleClearDiacritics()` in `character-mode.js` never call `window.reclassifyWord()` after a successful write. The plan explicitly requires this in both Task 3.3 and Task 4.1. In practice: a letter you just diacritized stays amber, the word-dot persists, and `totalUndiacCount` never decrements.

**DOM structure after write — 🐛 BUG (Critical):** `_updateWordSpanText()` rebuilds the word span using bare `document.createTextNode(cluster)` instead of `<span class="letter-cluster" data-char-idx="N">` elements. When `_classifyWord()` subsequently tries `wordEl.querySelectorAll('.letter-cluster')`, it finds nothing and cannot re-apply amber classes. Even if `reclassifyWord()` were called, it would silently fail on the rebuilt DOM.

---

### Task 4.2 — Word-Level Dot Indicator

**CSS:** ✅ `.word-has-undiac::after` dot is defined in `index.html`.

**Logic:** ✅ `_classifyWord()` correctly toggles `.word-has-undiac` based on `undiacCount > 0`.

**Runtime:** ❌ Affected by the same two bugs as Task 4.1. The dot does not disappear when a word becomes fully diacritized.

---

### Task 4.3 — Live Count + Tab Jump

**On file open:** ✅ `classifyAllWords()` populates all `word.undiacCount` values and `totalUndiacCount`. Status bar correctly shows `Undiacritized: N`.

**Tab jump (`_tabJumpToNextUndiac`):** ✅ Implemented correctly in `navigation.js` — scans forward through all lines, wraps at end-of-document, and no-ops when `totalUndiacCount === 0`.

**Live count during editing:** ❌ Because `reclassifyWord()` is never called after writes, `totalUndiacCount` never updates during a session. The Tab jump and count become stale from the first keystroke.

---

### Task 4.4 — Soft Rules

**Logic (soft-rules.js):** ✅ All five spec §8.3 rules are implemented.

1. Tanwin on non-final character ✅
2. Group A on mid-position alef ✅
3. Group A on alef of ال ✅
4. Any diacritic on final alef maqsura ✅
5. ال + tanwin coexistence ✅

`word.hasSoftWarning` is persisted for downstream use. OQ4 respected — warnings are ephemeral (recomputed each render, not stored in sidecar). ✅

**CSS:** ✅ `.soft-warning-underline` (wavy amber underline) and `.char-soft-tooltip` are both defined in `index.html`.

**Wiring — 🐛 BUG:** `_renderCharPanel()` in `character-mode.js` ends without calling `window.checkSoftRulesAfterWrite()`. The `soft-rules.js` module's own JSDoc documents it as: _"Run by `_renderCharPanel()` at the end of every panel render"_ — but that call is simply missing. Soft warnings will never appear in the UI.

---

### Task 4.5 — Keymap.json Custom Bindings

✅ Fully implemented. `window.KEYMAP` is populated from `/api/config` (`cfg.keymap?.bindings`), and `character-mode.js` checks `window.KEYMAP[code]` in the diacritic key handler. Numpad bindings in `keymap.json` (Fatha, Damma, Kasra, Shadda, Sukun, tanwin variants) are all correctly mapped.

---

### Deliverables Status

| Deliverable                                                                              | Status                         |
| ---------------------------------------------------------------------------------------- | ------------------------------ |
| `static/visual-hints.js`                                                                 | ✅ Present, logic complete     |
| `static/soft-rules.js`                                                                   | ✅ Present, logic complete     |
| CSS: `amber-candidate`, `word-has-undiac`, `soft-warning-underline`, `char-soft-tooltip` | ✅ All defined in `index.html` |
| Test file with ≥3 soft rule cases                                                        | ❌ **Not found in codebase**   |

---

### Phase 4 Success Criteria

| Criterion                                                         | Result                                                                 |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Freshly opened file shows every eligible letter amber             | ✅                                                                     |
| Applying a diacritic turns amber letter to normal immediately     | ❌ `reclassifyWord()` never called                                     |
| Undiacritized count matches manual count (±0)                     | ❌ Count goes stale after first edit                                   |
| Fathatan on 2nd char shows soft warning tooltip; edit not blocked | ❌ `checkSoftRulesAfterWrite()` never called from `_renderCharPanel()` |
| Mid-word alef exempt when preceding letter has damma              | ✅ Logic correct                                                       |
| Tab jumps to next amber word, wraps at document end               | ✅                                                                     |
| Tab is no-op when `totalUndiacCount === 0`                        | ✅                                                                     |
| Numpad1→Fatha from keymap.json works in character mode            | ✅                                                                     |

---

### Summary: Phase 4 is NOT complete

There are **three bugs** that break the runtime behaviour of Phase 4, even though the underlying logic modules are correctly written:

1. **`reclassifyWord()` is never called** in `character-mode.js` after `_handleDiacriticKey()` or `_handleClearDiacritics()` succeed. Add `window.reclassifyWord(state.lineIdx, state.wordIdx)` after `_renderCharPanel()` in both functions.

2. **`_updateWordSpanText()` uses bare text nodes** instead of `.letter-cluster` spans, breaking any subsequent DOM-based reclassification. It needs to mirror the Phase 4 rendering pattern from `renderer.js` (each cluster wrapped in `<span class="letter-cluster" data-char-idx="N">`).

3. **`checkSoftRulesAfterWrite()` is never called** from `_renderCharPanel()`. Add `if (typeof window.checkSoftRulesAfterWrite === 'function') { window.checkSoftRulesAfterWrite(state.lineIdx, state.wordIdx, state.charIdx); }` at the end of `_renderCharPanel()`.

One deliverable is also missing: the manual test file with ≥3 soft rule cases.
