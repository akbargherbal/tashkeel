# Tashkeel Ergonomics — Phase 1 Implementation Plan

**Plan version:** 1.0
**Based on:** Ergonomics_Design_Report_v1.4 · RULES.md · Session 14
**Current codebase state:** v1.0.0 tag — all Phases 1–5 complete and verified

---

## Executive Summary

- **Current state:** Working v1.0.0 app. Ergonomics redesign designed and signed off in Sessions 12–13.
- **Goal:** Implement all eight Phase 1 items from the report (§10) as additive changes — no existing key behaviour is removed or overridden. Every change is independently verifiable before the next begins.
- **Key architectural constraint:** This is a modification plan on a live codebase. RULES.md §0 applies to every task: minimum change, no adjacent refactoring, exact file/function/line stated before touching anything.
- **Estimated time:** 6–10 hours across 2–3 sessions.

---

## ⚠ ZAP — File Required Before Phase 3

`index.html` is needed for Phase 3 Task 3.1 (update `?` overlay table).
The overlay HTML is a static block in `index.html`; `completion.js` only toggles its `visible` CSS class. **Request `index.html` before Phase 3 begins.** Phase 3 Task 3.2 (`.gitignore`) is independent and can proceed without it.

---

## Locked Decisions

These are carried over from the report (v1.4) and the Session 13 handover. They are closed. Do not re-open without a version bump to the report.

| # | Decision | Resolution |
|---|----------|------------|
| Single-key advance | **Space** — thumb-operated alias for Tab in both modes |
| Space in Word Mode | Identical to Tab — jump to next undiacritized word |
| Space in Character Mode | `exitCharacterMode()` + `_tabJumpToNextUndiac()` in one keystroke |
| Backward jump key | **Shift+Tab** in Word Mode only |
| Shift+Tab implementation | Synthetic key approach — no signature change to `handleWordMode` |
| Shift+0 / Shift+Numpad0 | Shadda (U+0651) — handled by shiftKey override in `handleCharacterMode`; not in `keymap.json` |
| `keymap.json` format | **Unchanged in Phase 1** — no array values, no format version bump |
| `_tabJumpToPrevUndiac` | **New parallel function** in `navigation.js` — `_tabJumpToNextUndiac` is not modified |
| Keymap lookup ownership | **`character-mode.js`** — confirmed at line 273; `diacritic-engine.js` is not touched |
| Compound keys (4/5/6) | Deferred to Phase 2 — positions reserved but not active |
| Language warning | Amber flash + 2-second non-blocking message; DOM element created programmatically — no `index.html` edit required |

---

## Assumptions to Validate Before Starting

1. `event.key` for the Space bar is `' '` (single space character), not the string `'Space'` — **validate in Chrome DevTools console before Task 2.2**: `document.addEventListener('keydown', e => console.log(JSON.stringify(e.key)))`, press Space.
2. `event.shiftKey` is `true` for both Shift+Tab and Shift+0 — **validate in the same listener** before Tasks 2.4 and 1.3.
3. `event.code` for Shift+0 is `'Digit0'` regardless of OS keyboard layout — **validate in same listener**.
4. The diacritic code points in the new `keymap.json` match the GROUP_A / GROUP_B sets in `diacritic-engine.js` — cross-check the table in §Locked Decisions against the `GROUP_A` Set literal at the top of `diacritic-engine.js` before writing `keymap.json`.
5. `pytest test_diacritic_engine.py` passes clean before any file is touched — **run before Phase 1 Task 1.1**.

---

## Pre-Coding Checklist

- [ ] **pytest baseline is green** — `cd src && pytest test_diacritic_engine.py -v` — all tests pass
- [ ] **Space `event.key`** confirmed as `' '` in Chrome console
- [ ] **Shift+Tab and Shift+0** — `event.shiftKey === true` confirmed for both in Chrome console
- [ ] **`event.code === 'Digit0'`** confirmed for Shift+0 keystroke
- [ ] **Open decision §11 item 1 resolved** — project owner confirms: proceed on current `sample_text_09.txt` data OR run `ergonomic_model.py` on additional samples first (recommendation: proceed; see report rationale)
- [ ] **`index.html` requested** for Phase 3 Task 3.1 — can start Phases 1 and 2 without it

> ⚠ Do not begin Phase 1 if pytest is red. An existing failure will be obscured by Phase 1 changes and become impossible to attribute.

---

## Phase 1: Diacritic Key Layout

### Goal
**Prove the Shift+modifier threading in isolation, then update the key layout — all in zero or near-zero-risk files.**

### Task Ordering Note
Task 1.1 goes first: it is the only task that changes JS behaviour, and it must be verified in isolation before the JSON changes of Task 1.2 introduce a second variable. Tasks 1.2 and 1.3 are independent of each other but both depend on 1.1 being verified first.

---

**1.1 — Thread `shiftKey` into `handleCharacterMode`** *(navigation.js + character-mode.js · ~30 min)*

This is Phase 1's highest-risk change: it modifies the call interface between two modules. It must be proved first, before any JSON changes add new bindings that depend on it.

*`navigation.js` — `handleEditorKeystroke` function (lines 60–67):*

Replace:
```javascript
} else if (state.mode === 'character') {
    if (typeof window.handleCharacterMode === 'function') {
        window.handleCharacterMode(event.key, event.code);
    }
}
```
With:
```javascript
} else if (state.mode === 'character') {
    if (typeof window.handleCharacterMode === 'function') {
        window.handleCharacterMode(event.key, event.code, event.shiftKey);
    }
}
```

*`character-mode.js` — `handleCharacterMode` function declaration (line 211):*

Replace:
```javascript
window.handleCharacterMode = function handleCharacterMode(key, code) {
```
With:
```javascript
window.handleCharacterMode = function handleCharacterMode(key, code, shiftKey = false) {
```

No other changes. The new `shiftKey` parameter defaults to `false`, so all existing behaviour is preserved. The Shift+0 override (Task 1.3) that uses `shiftKey` is added in a later task.

**Verify Task 1.1 before proceeding:**
- Open the app; enter Character Mode on any word.
- Press any existing Arabic diacritic key (raw or numpad-mapped). Confirm it applies normally — the added parameter has not disturbed the routing.
- Open Chrome DevTools; set a breakpoint on `handleCharacterMode`; press a key; confirm `shiftKey` is `false` for normal keys and `true` when Shift is held.
- pytest still green.

---

**1.2 — `keymap.json` rearrangement + number-row aliases** *(keymap.json only · ~30 min)*

Replace the entire `bindings` object. The `meta` block is unchanged.

Current bindings (8 entries, layout inconsistent with report §7.2–7.3):
```json
"Numpad1": "\u064E",  "Numpad2": "\u064B",  "Numpad3": "\u064F",
"Numpad4": "\u064C",  "Numpad5": "\u0651",  "Numpad6": "\u0650",
"Numpad7": "\u064D",  "Numpad0": "\u0652"
```

Replacement bindings (13 entries — number-row + corrected numpad; Numpad4/5/6 and Digit4/5/6 intentionally absent):
```json
{
  "bindings": {
    "Digit1":  "\u064E",
    "Digit2":  "\u0650",
    "Digit3":  "\u064F",
    "Digit7":  "\u064B",
    "Digit8":  "\u064D",
    "Digit9":  "\u064C",
    "Digit0":  "\u0652",
    "Numpad1": "\u064E",
    "Numpad2": "\u0650",
    "Numpad3": "\u064F",
    "Numpad7": "\u064B",
    "Numpad8": "\u064D",
    "Numpad9": "\u064C",
    "Numpad0": "\u0652"
  }
}
```

Diacritic identity reference (cross-check against GROUP_A in `diacritic-engine.js`):

| Code point | Diacritic | Position |
|:---|:---|:---|
| U+064E | Fatha | 1 / Numpad1 |
| U+0650 | Kasra | 2 / Numpad2 |
| U+064F | Damma | 3 / Numpad3 |
| U+064B | Tanween Fatha | 7 / Numpad7 |
| U+064D | Tanween Kasra | 8 / Numpad8 |
| U+064C | Tanween Dhamma | 9 / Numpad9 |
| U+0652 | Sukoon | 0 / Numpad0 |

**Restart the Flask server after saving** — `keymap.json` is loaded at startup, not on reload.

**Verify Task 1.2 before proceeding:**
- In Character Mode on any Arabic letter, press each new key (1, 2, 3, 7, 8, 9, 0 and Numpad equivalents). Confirm the correct diacritic appears on the tile each time.
- Press 0 (Sukoon). Press 0 again — it toggles off. Confirms Sukoon is correctly mapped and toggle-off still works.
- Existing Arabic keyboard diacritic keys (raw Unicode path) still work — the new bindings are additive.
- pytest still green (no Python changes, but run it to confirm nothing is broken by the server restart).

---

**1.3 — Shift+0 / Shift+Numpad0 → Shadda override** *(character-mode.js · ~30 min)*

In `handleCharacterMode`, the keymap lookup (lines 270–276) will now return Sukoon (U+0652) for `Digit0` and `Numpad0` regardless of whether Shift is held, because `event.code` is the same with or without Shift. This task adds a one-branch override immediately after the keymap lookup.

*`character-mode.js` — after the keymap lookup block (currently ending around line 276), add:*

```javascript
  // Shift+0 and Shift+Numpad0 → Shadda (U+0651).
  // Overrides the Sukoon result from keymap.json when Shift is held.
  // shiftKey is threaded from handleEditorKeystroke (Task 1.1).
  if (shiftKey && (code === 'Digit0' || code === 'Numpad0')) {
    diacriticCp = '\u0651'; // Shadda
  }
```

This must be placed **after** the `diacriticCp = window.KEYMAP[code]` line and **before** the `if (diacriticCp)` dispatch. The full block after this task reads:

```javascript
  let diacriticCp = null;

  if (/^[\u064B-\u0655\u0670]$/.test(key)) {
    diacriticCp = key;
  } else if (window.KEYMAP && window.KEYMAP[code]) {
    diacriticCp = window.KEYMAP[code];
  }

  // Shift+0 / Shift+Numpad0 override
  if (shiftKey && (code === 'Digit0' || code === 'Numpad0')) {
    diacriticCp = '\u0651';
  }

  if (diacriticCp) {
    _handleDiacriticKey(diacriticCp);
  }
```

**RULES.md §2 checkpoint:** This insertion is within the diacritic detection chain, before `_handleDiacriticKey`. It does not sit between `_updateWordSpanText` and `reclassifyWord`, and does not add a new `checkSoftRulesAfterWrite` call site.

**Verify Task 1.3 before proceeding:**
- In Character Mode, press Shift+0 → Shadda (فّ) appears on the tile.
- Press Shift+Numpad0 → same result.
- Press 0 (unshifted) → Sukoon (فْ). The unshifted key was not disturbed.
- Press Shift+0 on a character already carrying Shadda → toggle-off removes it. (Shadda flows through `applyDiacritic` which handles toggle-off; no special-casing needed here.)
- Press Shift+0 on a character carrying Sukoon → hard block fires (Sukoon + Shadda conflict per RULES.md §3); `flashBlockedTile` flashes; nothing is written.
- pytest still green.

### Phase 1 Success Criteria
- ✅ Keys 1–3, 7–9, 0, Shift+0 and all Numpad equivalents each apply exactly the diacritic shown in the identity table above
- ✅ Existing Arabic keyboard layout keys (raw Unicode) continue to work — not displaced
- ✅ Toggle-off works on every new key (press twice: applies then removes)
- ✅ Shift+0 on Sukoon-bearing character: hard block fires, no write; Shift+0 on Shadda-bearing character: toggles off
- ✅ pytest green throughout

### Deliverables
- [ ] `keymap.json` — updated bindings (13 entries)
- [ ] `character-mode.js` — `shiftKey` parameter added; Shift+0 override block added

### Rollback Plan
**If** the `shiftKey` parameter threading (Task 1.1) disturbs any existing key routing → revert the two changed lines (call site in `handleEditorKeystroke` and signature in `handleCharacterMode`). These are surgical; revert leaves both files byte-identical to pre-Task-1.1.

**If** `keymap.json` changes produce wrong diacritics → restore from git. No JS involved; no side effects.

---

## Phase 2: Navigation Extensions

### Goal
**Add Space (single-key advance) and Shift+Tab (backward jump) across both Word Mode and Character Mode, plus the keyboard language warning.**

### Task Ordering Note
Tasks 2.1 and 2.2 are prerequisites for 2.3 and must be done first. Task 2.2 validates that the newly exposed `_tabJumpToNextUndiac` works correctly from Word Mode before it is used from the dangerous-zone file in Task 2.3. Tasks 2.4 and 2.5 are independent of each other but must both follow 2.1.

---

**2.1 — Expose `_tabJumpToNextUndiac` and `scheduleCursorSave` on `window`** *(navigation.js · ~15 min)*

Both functions are currently private closures in `navigation.js`. `character-mode.js` needs both for the Space-in-Character-Mode handler (Task 2.3).

*`navigation.js` — immediately after the closing `}` of `scheduleCursorSave` (currently around line 22):*
```javascript
window.scheduleCursorSave = scheduleCursorSave;
```

*`navigation.js` — immediately after the closing `}` of `_tabJumpToNextUndiac` (at the end of the file):*
```javascript
window._tabJumpToNextUndiac = _tabJumpToNextUndiac;
```

No logic changes. These are pure aliases.

**Verify:** In Chrome console with a file open, type `window._tabJumpToNextUndiac` and `window.scheduleCursorSave` — both should be functions, not `undefined`.

---

**2.2 — Space in Word Mode** *(navigation.js · ~1 hour)*

Two changes, both in `navigation.js`:

*Change A — `consumedKeys` array (line 40): add `' '` (the space character):*
```javascript
const consumedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab', 'Escape', 'Backspace', 'Delete', ' '];
```
This prevents the browser from scrolling the page on Space.

*Change B — `handleWordMode` function: add a Space branch in the same `if/else if` chain as Tab (currently around line 101–105):*
```javascript
    } else if (key === ' ') {
        if (_tabJumpToNextUndiac()) {
            moved = true;
        }
    }
```
This branch is structurally identical to the Tab branch. Place it immediately after the Tab branch. The existing `if (moved) { updateZenFocus(); updateStatusBar(); scheduleCursorSave(); }` block at the bottom of `handleWordMode` handles all post-jump updates — no additional code is needed.

**Verify Task 2.2 before proceeding:**
- In Word Mode, press Space → cursor jumps to the next amber word, identical to Tab.
- Press Space at the last undiacritized word → wraps to the first.
- Press Tab → unchanged, still works.
- Press Space when `totalUndiacCount === 0` → no-op (cursor stays; `_tabJumpToNextUndiac` returns `false`, `moved` stays `false`).
- Page does not scroll on Space press (browser default consumed).
- pytest still green.

---

**2.3 — Space in Character Mode** *(character-mode.js — dangerous zone · ~1–2 hours)*

*`character-mode.js` — `handleCharacterMode` function: add a Space branch as the first check, immediately after the `if (!word) return;` guard (currently line 216) and before the Escape check:*

```javascript
  // Space: exit Character Mode and jump to next undiacritized word in one keystroke.
  // Equivalent to pressing Escape then Tab from Word Mode.
  // No diacritic is written; no API call is made.
  if (key === ' ') {
    window.exitCharacterMode();
    if (window._tabJumpToNextUndiac()) {
      window.updateZenFocus();
      window.updateStatusBar();
      window.scheduleCursorSave();
    }
    return;
  }
```

**Why before Escape:** Space must return before the diacritic detection chain (the `' '` character is `key.length === 1` and would otherwise trigger the language warning added in Task 2.5). Placing it first makes this ordering explicit and avoids a fragile conditional.

**RULES.md §2 checkpoint before writing this code:**
- This branch returns immediately via early `return` — it cannot interrupt the `_updateWordSpanText → reclassifyWord` sequence because those are only called inside `_handleDiacriticKey` and `_handleClearDiacritics`, which are never reached.
- `exitCharacterMode()` calls `window.updateZenFocus()` and `window.updateStatusBar()`. The second calls to those functions after `_tabJumpToNextUndiac()` are intentional: `exitCharacterMode` positions the Zen view on the word we just left; `_tabJumpToNextUndiac` moves to a new word that may be on a different line — so the view must update again.
- `checkSoftRulesAfterWrite()` is not called here (no write occurred — RULES.md §3.9 confirmed: warnings are write-triggered only).

**Verify Task 2.3 before proceeding:**
- In Character Mode, press Space → panel closes, cursor lands on the next amber word.
- Confirm in DevTools Network tab: no `POST /api/write_char` fires on Space press.
- Zen Focus view centres on the new word's line.
- Amber highlight on the word just exited is unchanged (no reclassification fired).
- Escape still exits to Word Mode without jumping (unchanged).
- Tab in Word Mode still works (unchanged).
- pytest still green.

---

**2.4 — Shift+Tab backward jump** *(navigation.js · ~1–2 hours)*

Two changes, both in `navigation.js`:

*Change A — `handleEditorKeystroke` function: add synthetic key mapping for Shift+Tab (immediately before the `handleWordMode(event.key)` call):*

Replace:
```javascript
    if (state.mode === 'word') {
        handleWordMode(event.key);
    }
```
With:
```javascript
    if (state.mode === 'word') {
        const key = (event.shiftKey && event.key === 'Tab') ? 'ShiftTab' : event.key;
        handleWordMode(key);
    }
```

This keeps `handleWordMode`'s existing signature unchanged. Shift+Tab in Character Mode is not handled — it falls through silently, which is correct for Phase 1.

*Change B — add `_tabJumpToPrevUndiac` function at the end of `navigation.js`, and add a `'ShiftTab'` branch to `handleWordMode`:*

New function (mirrors `_tabJumpToNextUndiac` exactly with scan direction reversed):
```javascript
/**
 * Scan backward for the previous word with undiacCount > 0.
 * Wraps at the start of the document.
 * Returns true if the cursor moved, false if no other undiacritized words exist.
 */
function _tabJumpToPrevUndiac() {
    const state = window.editorState;
    const lines = state.lines;

    if (state.totalUndiacCount === 0) return false;

    // Phase 1: search backward from previous word to start of document
    for (let li = state.lineIdx; li >= 0; li--) {
        const startWi = (li === state.lineIdx) ? state.wordIdx - 1 : lines[li].words.length - 1;
        for (let wi = startWi; wi >= 0; wi--) {
            const word = lines[li].words[wi];
            if (word.isNavigable && word.undiacCount > 0) {
                state.lineIdx = li;
                state.wordIdx = wi;
                return true;
            }
        }
    }

    // Phase 2: wrap — search backward from end of document to current word (inclusive)
    for (let li = lines.length - 1; li >= state.lineIdx; li--) {
        const endWi = (li === state.lineIdx) ? state.wordIdx : lines[li].words.length - 1;
        for (let wi = endWi; wi >= 0; wi--) {
            const word = lines[li].words[wi];
            if (word.isNavigable && word.undiacCount > 0) {
                if (li === state.lineIdx && wi === state.wordIdx) return false;
                state.lineIdx = li;
                state.wordIdx = wi;
                return true;
            }
        }
    }

    return false;
}
```

New branch in `handleWordMode` (immediately after the `'Tab'` branch):
```javascript
    } else if (key === 'ShiftTab') {
        if (_tabJumpToPrevUndiac()) {
            moved = true;
        }
    }
```

**Verify Task 2.4 before proceeding:**
- Shift+Tab jumps to the previous amber word.
- Shift+Tab at the first undiacritized word wraps to the last.
- Plain Tab still jumps forward (unchanged).
- Space still jumps forward (unchanged, Task 2.2).
- Shift+Tab in Character Mode: no action (falls through silently, panel stays open).
- pytest still green.

---

**2.5 — Keyboard language warning** *(character-mode.js — dangerous zone · ~1–2 hours)*

Two additions to `character-mode.js`:

*Addition A — module-level state (add near the top of the file, after the `const CHAR_PANEL_HEIGHT` line):*
```javascript
// Language warning state — timer ID and DOM element reference.
let _langWarningTimer = null;
let _langWarningEl = null;
```

*Addition B — `_triggerLanguageWarning` private function (add after `_updateCharStatusBar`):*
```javascript
/**
 * Flash the char panel and show a 2-second non-blocking "Switch keyboard to Arabic" message.
 * Reuses flashBlockedTile() for the flash (report §8.2 — no new visual pattern).
 * DOM element is created once on first call and appended adjacent to the char panel.
 */
function _triggerLanguageWarning() {
  window.flashBlockedTile();

  if (!_langWarningEl) {
    _langWarningEl = document.createElement('div');
    _langWarningEl.id = 'lang-warning-msg';
    _langWarningEl.style.cssText =
      'position:fixed;bottom:' + (CHAR_PANEL_HEIGHT + 8) + 'px;left:50%;' +
      'transform:translateX(-50%);background:#f59e0b;color:#000;' +
      'padding:6px 16px;border-radius:4px;font-size:14px;z-index:9999;pointer-events:none;';
    _langWarningEl.textContent = 'Switch keyboard to Arabic';
    document.body.appendChild(_langWarningEl);
  }

  _langWarningEl.style.display = 'block';
  clearTimeout(_langWarningTimer);
  _langWarningTimer = setTimeout(() => {
    if (_langWarningEl) _langWarningEl.style.display = 'none';
  }, 2000);
}
```

*Addition C — clear the warning in `exitCharacterMode` (add two lines immediately before `panel.style.display = 'none'` in that function):*
```javascript
  // Dismiss language warning immediately on exit — don't leave it dangling.
  clearTimeout(_langWarningTimer);
  if (_langWarningEl) _langWarningEl.style.display = 'none';
```

*Addition D — language warning trigger in `handleCharacterMode`: add as an `else` branch on the existing `if (diacriticCp)` block (currently the last line of the function):*

Replace:
```javascript
  if (diacriticCp) {
    _handleDiacriticKey(diacriticCp);
  }
```
With:
```javascript
  if (diacriticCp) {
    _handleDiacriticKey(diacriticCp);
  } else if (key.length === 1) {
    // key.length === 1 means printable character (any language).
    // Named keys (Escape, ArrowLeft, Delete, etc.) have key.length > 1.
    // Space (' ') has key.length === 1 but is handled by early return above — safe.
    _triggerLanguageWarning();
  }
```

**RULES.md §2 checkpoint:**
- This `else` branch is added to the end of `handleCharacterMode`, after all existing diacritic logic. It does not sit between `_updateWordSpanText` and `reclassifyWord`.
- No API call is made; no diacritic is written; `editorState` is not mutated.
- `_triggerLanguageWarning` does not call `checkSoftRulesAfterWrite` — RULES.md §3.9 intact.

**Verify Task 2.5 before proceeding:**
- With OS keyboard set to English, enter Character Mode and press any Latin letter (e.g. `a`) → amber flash fires + amber banner appears reading "Switch keyboard to Arabic".
- Banner disappears automatically after ~2 seconds.
- No diacritic is written; DevTools Network tab shows no API call.
- Press a valid Arabic diacritic key immediately after the warning → diacritic applies normally (warning did not corrupt state).
- Space in Character Mode: no warning fires (handled by early return before the `else if` branch).
- Escape clears the banner immediately.
- Arabic keyboard diacritic keys: no warning triggered.
- pytest still green.

### Phase 2 Success Criteria
- ✅ Space in Word Mode jumps to next amber word; indistinguishable from Tab
- ✅ Space in Character Mode closes panel + lands on next amber word; no write call fires
- ✅ Shift+Tab jumps to previous amber word; wraps correctly at document start
- ✅ Plain Tab still jumps forward (unchanged)
- ✅ Language warning fires on Latin key in Character Mode; auto-dismisses in ≈2 sec
- ✅ No warning on Space, Escape, Arrow, Delete, Backspace, or any valid diacritic key
- ✅ pytest green throughout

### Deliverables
- [ ] `navigation.js` — `window._tabJumpToNextUndiac` and `window.scheduleCursorSave` exposed; `' '` added to `consumedKeys`; `'ShiftTab'` synthetic key in `handleEditorKeystroke`; `' '` and `'ShiftTab'` branches in `handleWordMode`; `_tabJumpToPrevUndiac` function added
- [ ] `character-mode.js` — `shiftKey` parameter (Task 1.1); Space branch; language warning module state + function; `exitCharacterMode` cleanup; `else if (key.length === 1)` language warning trigger

### Rollback Plan
**If** `' '` in `consumedKeys` causes unexpected scroll suppression in unexpected contexts (e.g., a text input focus edge case) → remove `' '` from `consumedKeys` and move the `event.preventDefault()` call for Space into `handleEditorKeystroke` conditionally. This is a one-line swap.

**If** Space in Character Mode (Task 2.3) leaves the panel DOM open or Zen Focus in a wrong state → remove the Space branch from `handleCharacterMode` (single block). `exitCharacterMode` is the established clean exit path; removing the Space shortcut reverts to it without any state damage.

**If** `_tabJumpToPrevUndiac` wraps incorrectly → the function is self-contained. Remove the `'ShiftTab'` branch from `handleWordMode` and the function body; no other code is affected.

---

## Phase 3: Polish

### Goal
**Update the `?` overlay to reflect all Phase 1 and Phase 2 additions, and add `config.json` to `.gitignore`.**

### Task Ordering Note
Task 3.1 requires `index.html` (ZAP). Task 3.2 is independent and can be done at any time.

---

**3.1 — Update `?` overlay** *(index.html · ~1 hour)*

⚠ **Requires `index.html` — request before starting this task.**

The `#shortcuts-overlay` content is a static HTML table in `index.html`. `completion.js` only toggles its CSS class. Once `index.html` is available, add the following rows to the appropriate sections of the shortcuts table:

*Word Mode section — add:*

| Key | Action |
|-----|--------|
| `Space` | Jump to next undiacritized word (same as Tab) |
| `Shift+Tab` | Jump to previous undiacritized word |

*Character Mode section — add:*

| Key | Action |
|-----|--------|
| `Space` | Exit Character Mode + jump to next undiacritized word |

*Diacritic keys section — add or replace with the full layout table:*

| Key | Diacritic |
|-----|-----------|
| `1` / `Numpad 1` | Fatha |
| `2` / `Numpad 2` | Kasra |
| `3` / `Numpad 3` | Damma |
| `7` / `Numpad 7` | Tanween Fatha |
| `8` / `Numpad 8` | Tanween Kasra |
| `9` / `Numpad 9` | Tanween Dhamma |
| `0` / `Numpad 0` | Sukoon |
| `Shift+0` / `Shift+Numpad 0` | Shadda |

*Also add the backward correction workflow (report §6.3) as a prose note under Character Mode:*

> To correct a character in the same word: `→` steps back. To return to a previous word: `Escape` → `→` → `Enter`.

**Verify Task 3.1:**
- Press `?` in the running app. Every key from Phases 1–2 appears with an accurate description.
- Press `?` again → overlay closes. Press `Escape` → overlay closes (RULES.md §3.10 intact).

---

**3.2 — Add `config.json` to `.gitignore`** *(.gitignore · ~5 min)*

Add one line to `.gitignore`:
```
config.json
```

**Verify Task 3.2:**
```bash
git check-ignore -v config.json
# Expected output: .gitignore:N:config.json    config.json
```
If `config.json` exists locally, run `git status` and confirm it no longer appears as tracked or untracked.

### Phase 3 Success Criteria
- ✅ `?` overlay shows all new keys from Phases 1–2 with accurate descriptions
- ✅ Overlay open/close (`?` key and Escape) both still work — RULES.md §3.10 verified
- ✅ `git check-ignore -v config.json` returns a match

### Deliverables
- [ ] `index.html` — updated `#shortcuts-overlay` table
- [ ] `.gitignore` — `config.json` entry added

### Rollback Plan
`index.html` overlay changes are display-only. Reverting the diff leaves no runtime effect. `.gitignore` is trivially reversible.

---

## Decision Tree & Stop Conditions

```
START
  ↓
PRE-CODING CHECKLIST
  ├─ pytest red before any change → STOP: fix existing failure first
  ├─ Space event.key not ' '    → STOP: re-check before Task 2.2 (key value drives consumedKeys)
  └─ All items checked          → PHASE 1

PHASE 1: Diacritic Key Layout
  ├─ Task 1.1 verified (existing keys unaffected) → Task 1.2
  ├─ Task 1.1 breaks existing diacritic routing → REVERT 1.1, diagnose, do not continue
  ├─ Tasks 1.2 + 1.3 verified                   → PHASE 2
  └─ Task 1.3 Shift+0 does not produce Shadda    → check shiftKey value in console; check insertion point relative to KEYMAP lookup

PHASE 2: Navigation Extensions
  ├─ Task 2.1 verified (globals on window)           → Task 2.2
  ├─ Task 2.2 verified (Space in Word Mode works)    → Task 2.3
  ├─ Task 2.3 write call fires on Space              → REVERT 2.3 immediately; do not proceed
  ├─ Task 2.3 verified (no write, panel closes)      → Task 2.4
  ├─ Task 2.4 verified (Shift+Tab correct direction) → Task 2.5
  ├─ Task 2.5 warning fires on valid Arabic key      → check insertion point (must be inside `else if`, after diacriticCp check)
  └─ All Phase 2 verified                            → PHASE 3

PHASE 3: Polish
  ├─ index.html not yet available → do Task 3.2, wait for file
  └─ All Phase 3 verified         → SHIP PHASE 1
```

### Explicit Stop Conditions
**STOP immediately if:**
- Any task causes `POST /api/write_char` to fire when no diacritic was intentionally applied (Space, language warning, Shift+Tab)
- Task 2.3 (Space in Character Mode) leaves `state.mode === 'character'` after the Space press — this means `exitCharacterMode` did not fire
- Any task causes `reclassifyWord` to fire without a preceding `_updateWordSpanText` call on the same word (RULES.md §2 violation)
- pytest turns red at any point — stop the current task and diagnose before continuing

---

## Risk Mitigation Summary

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Space key value is not `' '` on user's keyboard | Low | High | Validate `event.key` in console before Task 2.2 (Pre-Coding Checklist item 1) |
| `shiftKey` threading breaks existing diacritic routing (Task 1.1) | Low | Medium | Task 1.1 verified in isolation before JSON changes; revert path is 2 lines |
| Space in Character Mode triggers an API write (dangerous zone) | Low | Critical | Network tab verified in Task 2.3 success criteria; stop condition fires immediately if true |
| `_triggerLanguageWarning` fires on Space (key.length === 1) | Low | Low | Space returns early before the `else if` branch — insertion order enforces this |
| Shift+Tab wraps in wrong direction | Low | Low | `_tabJumpToPrevUndiac` is a new function; revert path removes function + branch with no side effects |
| `keymap.json` Unicode values mis-typed | Medium | Medium | Cross-check against GROUP_A/B sets in `diacritic-engine.js` before saving (Pre-Coding Checklist item 4) |
| Overlay update breaks Escape-to-close (RULES.md §3.10) | Low | Low | Verified explicitly in Task 3.1 success criteria |
| `config.json` already tracked by git before `.gitignore` entry | Medium | Low | If tracked, run `git rm --cached config.json` after adding the gitignore entry |

---

## Scope Boundaries

### In Scope (Phase 1 only)
- ✅ Number-row key aliases (Digit1–3, Digit7–9, Digit0) in `keymap.json`
- ✅ Numpad layout corrected to match number-row
- ✅ Shift+0 / Shift+Numpad0 → Shadda
- ✅ Space as single-key advance (Word Mode + Character Mode)
- ✅ Shift+Tab as backward jump (Word Mode only)
- ✅ Keyboard language warning (amber flash + 2-second message)
- ✅ `?` overlay updated to reflect all new keys
- ✅ `config.json` added to `.gitignore`

### Out of Scope (do not implement, do not scaffold toward)
- ❌ Compound keys (Digit4/5/6 = Shadda+Vowel) — Phase 2; edge-case behaviour undefined
- ❌ `keymap.json` format change to array values — Phase 2
- ❌ `isClusterComplete()` — Phase 2
- ❌ Smart flow / auto-advance after diacritic — Phase 2; alters interaction contract
- ❌ Shift+Tab in Character Mode — not in Phase 1; falls through silently (correct)
- ❌ Customizable key bindings UI — Phase 3
- ❌ Latin keystroke acceptance (OS-language-agnostic input) — Phase 3
- ❌ Home-row layout (J K L) as opt-in preset — Phase 3
- ❌ Refactoring of `_tabJumpToNextUndiac` to accept a direction parameter — Option B (parallel function) is the chosen approach; do not introduce Option A
- ❌ Any CSS change to `.char-tile`, `.letter-cluster`, `.char-tiles-container` — requires RULES.md §4 review; not needed
- ❌ Refactoring of adjacent code encountered during implementation — RULES.md §0

---

*Plan v1.0 — Session 14 · Based on Ergonomics_Design_Report_v1.4 and source files reviewed: navigation.js, character-mode.js, diacritic-engine.js, completion.js, keymap.json*
