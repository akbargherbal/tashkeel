# Tashkeel Ergonomics — Phase 2 Implementation Plan

**Plan version:** 1.0  
**Based on:** Ergonomics_Executive_Summary_S21.md · RULES.md · Session 22  
**Current codebase state:** Phase 1 complete and QA-verified (Sessions 19–20)  
**Source files reviewed:** `diacritic-engine.js`, `character-mode.js`, `navigation.js`, `diacritic_engine.py`

---

## Executive Summary

- **Current state:** Phase 1 shipped. Pinky share is 50% (down from 61%). Within-word Arrow×k presses are still entirely pinky-driven — the original ergonomic complaint is substantially unresolved.
- **Goal:** Implement Smart flow (auto-advance after a completed cluster) and Full flow (Space in Word Mode jumps and enters Character Mode in one keystroke). Together these drop pinky share to 6% (residual = correction budget only). Compound keys (Digit4/5/6) are Phase 2 scope but deferred — design is documented in §Compound Keys.
- **Key architectural constraint:** The auto-advance trigger in `character-mode.js` is a dangerous-zone change (RULES.md §2). RULES.md §0 applies to every task: minimum change, no adjacent refactoring, exact file/function stated before touching anything.
- **Estimated time:** 3–5 hours across one session.

---

## Locked Decisions

Carried from Sessions 21–22. Closed. Do not re-open.

| # | Decision | Resolution |
|---|----------|------------|
| Smart flow trigger | Auto-advance fires when `isClusterComplete(newCluster)` returns true after a successful write | 
| Completeness rule | Cluster is complete iff its marks contain at least one Group A member (vowel or sukoon) |
| Shadda-alone | Does NOT trigger advance — no Group A mark present |
| Shadda + vowel | DOES trigger advance — Group A mark present |
| Full flow scope | Space in Word Mode jumps AND enters Character Mode in one keystroke |
| Phase 2 scope | Smart flow and Full flow together in one phase |
| Compound key edge case | Clear-then-apply: existing Group A is stripped, Shadda is added (Group B stacks), new vowel replaces — handled naturally by two sequential `applyDiacritic` calls using the existing engine |
| Compound key implementation | Deferred to a sub-item after compound key coding begins; design documented in §Compound Keys |
| `isClusterComplete` owner | `diacritic-engine.js` — cluster-state query; same module as `parseCluster`, `applyDiacritic` |
| Auto-advance owner | `character-mode.js` — `_handleDiacriticKey` is the only correct call site |
| Full flow owner | `navigation.js` — `handleWordMode` Space branch; one additive block |

---

## Assumptions to Validate Before Starting

1. `window.isClusterComplete` is not already defined anywhere — **check in Chrome console** before Task 1.1: `typeof window.isClusterComplete` should return `'undefined'`.
2. `window._tabJumpToNextUndiac` is already exposed on `window` (done in Phase 1) — **check in Chrome console**: `typeof window._tabJumpToNextUndiac` should return `'function'`.
3. `window.scheduleCursorSave` is already exposed on `window` (done in Phase 1) — **check in Chrome console**: `typeof window.scheduleCursorSave` should return `'function'`.
4. `enterCharacterMode` is accessible from `navigation.js` via `window.enterCharacterMode` — **check in Chrome console**: `typeof window.enterCharacterMode` should return `'function'`.
5. `pytest test_diacritic_engine.py` passes clean before any file is touched.

---

## Pre-Coding Checklist

- [ ] **pytest baseline is green** — `cd src && pytest test_diacritic_engine.py -v` — all tests pass
- [ ] **`window.isClusterComplete` is undefined** — not already defined; safe to add
- [ ] **`window._tabJumpToNextUndiac` is a function** — Phase 1 exposure confirmed
- [ ] **`window.scheduleCursorSave` is a function** — Phase 1 exposure confirmed
- [ ] **`window.enterCharacterMode` is a function** — entry point accessible from `navigation.js`

> ⚠ Do not begin if pytest is red. Do not begin if `window.isClusterComplete` is already defined — diagnose first.

---

## Phase 1: Smart Flow

### Goal
Implement `isClusterComplete()` in `diacritic-engine.js`, then wire the auto-advance trigger into `_handleDiacriticKey` in `character-mode.js`. Prove `isClusterComplete` in isolation before touching the dangerous zone.

### Task Ordering Note
Task 1.1 (`isClusterComplete`) must be verified first, in isolation, before Task 1.2 adds the trigger in the dangerous zone. Task 1.1 is additive and zero-risk. Task 1.2 is the only high-risk change in the entire plan.

---

**1.1 — Add `isClusterComplete()` to `diacritic-engine.js`** *(diacritic-engine.js · ~20 min)*

`isClusterComplete` is a cluster-state query. It belongs in `diacritic-engine.js` alongside `parseCluster`, `applyDiacritic`, and `clearDiacritics` (RULES.md §1: module ownership).

*`diacritic-engine.js` — append to the end of the file, after `flashBlockedTile`:*

```javascript
/**
 * Return true if the grapheme cluster is phonologically complete — i.e.,
 * it carries at least one Group A mark (vowel or sukoon).
 *
 * Completeness rules (spec §Smart-flow):
 *   Has a short vowel (no shadda)        → complete
 *   Has tanween (no shadda)              → complete
 *   Has sukoon                           → complete
 *   Has shadda only                      → NOT complete (awaits vowel)
 *   Has shadda + vowel or tanween        → complete
 *   Bare (no marks at all)               → NOT complete
 *   Has only Group C marks               → NOT complete
 *
 * Used by character-mode.js _handleDiacriticKey to determine whether
 * to trigger smart-flow auto-advance after a successful write.
 *
 * @param {string} cluster — grapheme cluster string
 * @returns {boolean}
 */
window.isClusterComplete = function isClusterComplete(cluster) {
    const { marks } = window.parseCluster(cluster);
    return [...marks].some(m => GROUP_A.has(m));
};
```

This implementation is correct for all cases in the completeness table:
- `GROUP_A` contains fatha, kasra, damma, fathatan, kasratan, dammatan, sukoon, and superscript alef.
- Shadda is `GROUP_B` — not in `GROUP_A` — so shadda-only clusters return `false`. ✓
- Shadda + vowel: the vowel is in `GROUP_A` — returns `true`. ✓
- Bare cluster: `marks` is empty — `some()` returns `false`. ✓
- Group C only (maddah, hamza): not in `GROUP_A` — returns `false`. ✓

**RULES.md §2 checkpoint:** This is an additive function at the end of the file. It reads cluster state only — no mutation, no DOM, no API calls. It cannot affect existing behaviour.

**Verify Task 1.1 before proceeding:**
- Reload the app in Chrome. In the console:
  ```javascript
  // Shadda only — NOT complete
  window.isClusterComplete('ب\u0651')          // → false
  // Fatha — complete
  window.isClusterComplete('ب\u064E')          // → true
  // Shadda + Fatha — complete
  window.isClusterComplete('ب\u0651\u064E')    // → true
  // Sukoon — complete
  window.isClusterComplete('ب\u0652')          // → true
  // Bare — NOT complete
  window.isClusterComplete('ب')                // → false
  ```
- All five assertions return the expected value.
- Existing diacritic behaviour is unchanged — apply/toggle/clear still work normally.
- pytest still green.

---

**1.2 — Wire auto-advance into `_handleDiacriticKey`** *(character-mode.js — dangerous zone · ~1–2 hours)*

⚠ **This is the only dangerous-zone change in the plan. Read RULES.md §2 before editing.**

The trigger fires after a successful write, after `reclassifyWord`. It replaces the explicit `_renderCharPanel()` call with a branch: advance (which renders at the new position) or stay (which renders at the current position). This ensures exactly one `_renderCharPanel()` call per keystroke regardless of path.

**Step A — Add the `_smartFlowAdvance` helper function.**

*`character-mode.js` — add immediately before `_handleDiacriticKey` (which is the first function in the "Diacritic mutation + API write-through" section):*

```javascript
/**
 * Advance the cursor after a phonologically complete cluster (smart flow).
 *
 * If there is a next character in the word: moves charIdx forward and
 * re-renders the panel at the new position.
 *
 * If the completed cluster was the last in the word: exits Character Mode
 * and jumps to the next undiacritized word — identical to the Space key
 * behaviour from Character Mode.
 *
 * Called ONLY from _handleDiacriticKey after a successful write when
 * window.isClusterComplete(newCluster) returns true. Must never be called
 * from any other site (RULES.md §3.9: _renderCharPanel is the sole
 * checkSoftRulesAfterWrite call site — this function calls _renderCharPanel
 * via the normal path, preserving that invariant).
 */
function _smartFlowAdvance() {
  const state = window.editorState;
  const word = state.lines[state.lineIdx]?.words[state.wordIdx];
  if (!word) return;

  const nextIdx = state.charIdx + 1;
  if (nextIdx >= word.clusters.length) {
    // Last character in word — exit and jump to next undiacritized word.
    window.exitCharacterMode();
    if (window._tabJumpToNextUndiac()) {
      window.updateZenFocus();
      window.updateStatusBar();
      window.scheduleCursorSave();
    }
  } else {
    // Advance to next character and re-render panel there.
    state.charIdx = nextIdx;
    _renderCharPanel();
    _updateCharStatusBar();
  }
}
```

**Step B — Modify the success path inside `_handleDiacriticKey`.**

*`character-mode.js` — `_handleDiacriticKey` function: find the block at the end of the function (after the `if (!success)` revert guard). Replace:*

```javascript
  // Reflect the change in the word span in the document pane
  _updateWordSpanText(state.lineIdx, state.wordIdx, word.clusters);
  _renderCharPanel();

  // Fix 1 (Bug Report §Task 4.1): Re-classify the affected word so amber
  // highlights clear immediately and totalUndiacCount stays accurate.
  // Must come AFTER _updateWordSpanText() so .letter-cluster spans exist.
  window.reclassifyWord(state.lineIdx, state.wordIdx);
```

With:

```javascript
  // Reflect the change in the word span in the document pane
  _updateWordSpanText(state.lineIdx, state.wordIdx, word.clusters);

  // Fix 1 (Bug Report §Task 4.1): Re-classify the affected word so amber
  // highlights clear immediately and totalUndiacCount stays accurate.
  // Must come AFTER _updateWordSpanText() so .letter-cluster spans exist.
  window.reclassifyWord(state.lineIdx, state.wordIdx);

  // Phase 2 Smart flow: if the cluster is now phonologically complete,
  // auto-advance to the next character (or exit + jump at word boundary).
  // _smartFlowAdvance() renders the panel at the new position.
  // Otherwise render at the current position. Exactly one _renderCharPanel()
  // fires per keystroke on either path.
  if (window.isClusterComplete(newCluster)) {
    _smartFlowAdvance();
  } else {
    _renderCharPanel();
  }
```

**RULES.md §2 checkpoint — three dangerous-zone invariants verified:**

1. `_updateWordSpanText()` is still called before `reclassifyWord()`. Order preserved. ✓
2. `reclassifyWord()` is still called after `_updateWordSpanText()`. Order preserved. ✓
3. `checkSoftRulesAfterWrite()` is called exactly once per keystroke via `_renderCharPanel()`, which is called inside `_smartFlowAdvance()` on the stay-path, and inside `_smartFlowAdvance` → `_renderCharPanel` on the advance-path. The `exitCharacterMode()` path in `_smartFlowAdvance` does not call `_renderCharPanel` — this is correct because the panel is being destroyed, not re-rendered. ✓

**Verify Task 1.2 before proceeding:**

- Open the app; open a file with undiacritized text.
- Enter Character Mode on any word. Press `1` (Fatha). Confirm:
  - The diacritic appears on the tile.
  - The cursor auto-advances to the next character in the word.
  - No Arrow press was needed.
- Press `Shift+0` (Shadda) on any character. Confirm:
  - Shadda appears on the tile.
  - Cursor does **not** advance (shadda alone is not complete).
- Press `1` (Fatha) immediately after. Confirm:
  - Fatha appears (cluster now has Shadda + Fatha).
  - Cursor **does** auto-advance (cluster is now complete).
- Navigate to the last character in a word. Apply any vowel. Confirm:
  - Character Mode exits cleanly.
  - Cursor lands on the next amber word in Word Mode.
- Confirm in DevTools Network tab: `POST /api/write_char` fires once per diacritic keypress. It does not fire on auto-advance itself.
- Confirm `reclassifyWord` is called (amber dot clears on the word when all characters are complete).
- Mis-press correction: apply wrong diacritic → cursor advances → press `Arrow Right` (pinky once) → cursor steps back → apply correct diacritic → cursor advances again. Confirm full round-trip works.
- Toggle-off: press `1` on a Fatha-bearing character → Fatha is removed → cursor does **not** advance (bare cluster is not complete). ✓
- pytest still green.

### Phase 1 Success Criteria
- ✅ `isClusterComplete` returns correct value for all five test cases in §1.1 verify
- ✅ Diacritic keypress auto-advances to next character when cluster is complete
- ✅ Shadda-only press does NOT trigger advance
- ✅ Shadda + vowel press DOES trigger advance (second keypress)
- ✅ Auto-advance at word boundary exits Character Mode and jumps to next amber word
- ✅ No `POST /api/write_char` fires on the advance itself
- ✅ `reclassifyWord` / amber state still correct throughout
- ✅ Mis-press correction (Arrow Right × 1) works cleanly
- ✅ pytest green throughout

### Deliverables
- [ ] `diacritic-engine.js` — `isClusterComplete` function added
- [ ] `character-mode.js` — `_smartFlowAdvance` helper added; `_handleDiacriticKey` success path modified

### Rollback Plan
**If** `isClusterComplete` causes any error → remove the function from the end of `diacritic-engine.js`. No other code depends on it yet.

**If** the `_handleDiacriticKey` modification causes incorrect behaviour → revert the two-line change (replace `if (isClusterComplete)` block with the original `_renderCharPanel()` call, and move `reclassifyWord` back to after `_renderCharPanel`). The `_smartFlowAdvance` function can remain in the file — it will be unreachable and harmless. Revert is four lines maximum.

---

## Phase 2: Full Flow

### Goal
Change Space in Word Mode to jump and enter Character Mode in one keystroke. This is an additive change to `navigation.js` only — not a dangerous-zone file.

---

**2.1 — Space in Word Mode enters Character Mode** *(navigation.js · ~30 min)*

*`navigation.js` — `handleWordMode` function: find the `if (moved)` block at the end of the function:*

```javascript
  if (moved) {
    updateZenFocus();
    updateStatusBar();
    scheduleCursorSave();
  }
```

Add one block immediately after it:

```javascript
  // Phase 2 Full flow: Space in Word Mode jumps AND enters Character Mode.
  // enterCharacterMode() fires AFTER updateZenFocus() so that
  // _applyCharModeLineStyle() (which dims the line and removes zen-active)
  // runs last and wins over the zen class assignments from updateZenFocus().
  if (key === " " && moved && typeof window.enterCharacterMode === "function") {
    window.enterCharacterMode();
  }
```

**Why after `if (moved)` and not inside the Space branch:**
`enterCharacterMode()` sets up the char panel and calls `_applyCharModeLineStyle(true)`, which removes `zen-active` from the current line. If `enterCharacterMode` fired before `updateZenFocus()`, `updateZenFocus` would re-apply `zen-active`, overwriting the char-mode dim treatment. Firing after ensures the correct visual state.

**Why `moved` guard:** If `_tabJumpToNextUndiac()` found no amber words and returned `false`, `moved` is `false`, and `enterCharacterMode` does not fire. Space becomes a no-op, which is correct — there is nothing to enter.

**Why `typeof window.enterCharacterMode === "function"` guard:** Defensive check against script load-order edge cases (RULES.md §2 load-order note). In normal operation this is always true.

**RULES.md §3.11 checkpoint:** This is the Word Mode Space branch only. The Character Mode Space branch in `character-mode.js` (which exits and jumps) is untouched. The two do not interact. ✓

**Verify Task 2.1 before proceeding:**

- In Word Mode, press Space. Confirm:
  - Cursor jumps to the next amber word (unchanged from Phase 1).
  - Character Mode panel opens immediately — no Enter press required.
  - The forward path for one word is now: Space (enter word + char mode) → diacritic keys (auto-advance per character) → Space (exit + jump to next word). Zero pinky presses on the forward path.
- Press Tab in Word Mode → jumps to next amber word only (no Character Mode entry). Tab behaviour is unchanged. ✓
- Press Space when `totalUndiacCount === 0` → no-op (cursor stays, no panel opens). ✓
- Press Space in Character Mode → exits and jumps (Phase 1 behaviour, unchanged). ✓
- Enter Character Mode via Enter key → still works (Enter branch in `handleWordMode` is untouched). ✓
- Confirm in DevTools Network tab: no `POST /api/write_char` fires on Space in Word Mode. ✓
- pytest still green.

### Phase 2 Success Criteria
- ✅ Space in Word Mode: jumps to next amber word AND opens Character Mode panel in one keystroke
- ✅ Tab in Word Mode: unchanged — jump only, no Character Mode entry
- ✅ Enter in Word Mode: unchanged — enter Character Mode on current word
- ✅ Space in Character Mode: unchanged — exits and jumps (Phase 1 behaviour)
- ✅ Space is a no-op when no amber words remain
- ✅ No write fires on Space in Word Mode
- ✅ pytest green

### Deliverables
- [ ] `navigation.js` — one additive block after `if (moved)` in `handleWordMode`

### Rollback Plan
Remove the added block (four lines). No other code is affected.

---

## Compound Keys (Deferred Sub-Item)

Compound keys (Digit4/5/6 = Shadda+Fatha / Shadda+Kasra / Shadda+Damma) are Phase 2 scope but are not implemented in this pass. They do not affect the pinky-load problem — smart flow and full flow are the fix. Compound keys are an efficiency gain on top of a solved foundation.

**Do not implement compound keys until this sub-item is explicitly unblocked.**

### Design (for the session when coding begins)

**`keymap.json` change:** Digit4/5/6 and Numpad4/5/6 values change from absent to arrays:
```json
"Digit4":  ["\u0651", "\u064E"],
"Digit5":  ["\u0651", "\u0650"],
"Digit6":  ["\u0651", "\u064F"],
"Numpad4": ["\u0651", "\u064E"],
"Numpad5": ["\u0651", "\u0650"],
"Numpad6": ["\u0651", "\u064F"]
```

**`character-mode.js` change:** In `handleCharacterMode`, after the KEYMAP lookup:
```javascript
} else if (window.KEYMAP && window.KEYMAP[code]) {
    const val = window.KEYMAP[code];
    if (Array.isArray(val)) {
        // Compound key — apply each code point in sequence using existing engine.
        // First cp is Shadda (Group B — stacks). Second cp is vowel (Group A —
        // replaces any existing Group A). Edge case (locked Session 22):
        // clear-then-apply = natural result of two sequential applyDiacritic calls.
        _handleCompoundKey(val);
        return;
    }
    diacriticCp = val;
}
```

`_handleCompoundKey(codepoints)` applies each cp to the cluster in sequence using the same `applyDiacritic` + `API.writeChar` path as `_handleDiacriticKey`, but produces one final cluster and one API write, not two. Smart flow auto-advance applies to the final cluster after the compound write.

**Blocked until:** compound key session begins. `keymap.json` format change is a prerequisite — do not make it until the JS handler is ready.

---

## Phase 3: Polish

### Goal
Update the `?` overlay to reflect Phase 2 additions (smart flow forward path, full flow Space behaviour).

⚠ **Requires `index.html` — request before starting this task.** The overlay is a static HTML table in `index.html`; `completion.js` only toggles its CSS class.

---

**3.1 — Update `?` overlay** *(index.html · ~30 min)*

*Word Mode section — update the Space row description:*

| Key | Action |
|-----|--------|
| `Space` | Jump to next undiacritized word + enter Character Mode |

*Character Mode section — add auto-advance note:*

| Key | Action |
|-----|--------|
| Diacritic key | Apply diacritic; auto-advances to next character when cluster is complete |
| `Space` | Exit Character Mode + jump to next undiacritized word |

*Add a correction workflow note under Character Mode:*

> To correct a mis-press: `→` (one Arrow press) steps back to the character. Apply the correct diacritic. Auto-advance resumes. The mis-press will not be under the cursor — check the rendered text visually. The amber classification system marks incomplete words.

**Verify Task 3.1:**
- Press `?` — all Phase 2 keys appear with accurate descriptions.
- Press `?` again → overlay closes. Press `Escape` → overlay closes. (RULES.md §3.10 intact.)

### Phase 3 Success Criteria
- ✅ `?` overlay describes auto-advance behaviour
- ✅ `?` overlay describes full-flow Space in Word Mode
- ✅ Correction workflow note present
- ✅ Overlay open/close still works — RULES.md §3.10 verified

### Deliverables
- [ ] `index.html` — updated `#shortcuts-overlay` table (requires file to be attached)

---

## Decision Tree & Stop Conditions

```
START
  ↓
PRE-CODING CHECKLIST
  ├─ pytest red before any change     → STOP: fix existing failure first
  ├─ window.isClusterComplete defined → STOP: diagnose before Task 1.1
  └─ All items checked                → PHASE 1

PHASE 1: Smart Flow
  ├─ Task 1.1 verified (5 console assertions pass) → Task 1.2
  ├─ Task 1.1 wrong result for any case            → fix isClusterComplete; do not proceed
  ├─ Task 1.2 advance fires on shadda-only press   → REVERT 1.2 immediately; isClusterComplete bug
  ├─ Task 1.2 write fires on advance itself        → REVERT 1.2 immediately; _smartFlowAdvance bug
  ├─ Task 1.2 reclassifyWord fires before _updateWordSpanText → REVERT; ordering violation
  └─ Task 1.2 fully verified                       → PHASE 2

PHASE 2: Full Flow
  ├─ Task 2.1 verified (Space opens panel after jump) → PHASE 3
  ├─ Task 2.1: Tab behaviour changed                 → REVERT the added block
  ├─ Task 2.1: Space in Char Mode behaviour changed  → REVERT the added block
  └─ Task 2.1: write fires on Space in Word Mode     → REVERT immediately

PHASE 3: Polish
  ├─ index.html not yet available → skip; document as open item in handover
  └─ All Phase 3 verified         → SHIP PHASE 2
```

### Explicit Stop Conditions

**STOP immediately if:**
- Any task causes `POST /api/write_char` to fire when no diacritic was intentionally applied (auto-advance, Space in either mode)
- Task 1.2 causes auto-advance to fire on a Shadda-only press (incomplete cluster)
- Task 1.2 causes `reclassifyWord` to fire without a preceding `_updateWordSpanText` call (RULES.md §2 violation)
- Task 1.2 causes `checkSoftRulesAfterWrite` to be called from a second call site (RULES.md §3.9 violation)
- Task 2.1 causes Space in Character Mode to open a panel instead of jumping (two handlers are conflicting)
- pytest turns red at any point

---

## Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Mis-press not under cursor (documented trade-off) | Certain (by design) | Medium | Note in `?` overlay correction workflow. Amber classification provides the safety net. Document in onboarding. |
| `_smartFlowAdvance` triggers on toggle-off (removes vowel, bare cluster returned) | None — `applyDiacritic` returns a new cluster; if toggle removed the only mark, `isClusterComplete` returns false | — | Verified by design; confirm in Task 1.2 tests |
| `updateZenFocus()` overwrites `_applyCharModeLineStyle` zen treatment in Full Flow | Low | Low | Full flow block fires after `if (moved)` block (updateZenFocus first, then enterCharacterMode last) — ordering is explicit and enforced |
| enterCharacterMode on a fully-diacritized word (undiacCount = 0) | Low | Low | `_tabJumpToNextUndiac` only lands on `undiacCount > 0` words — the `moved` guard on the full-flow block means enterCharacterMode only fires when a jump occurred |
| Compound key `keymap.json` format change breaks existing key lookups | N/A (deferred) | High | Array values are only added when the JS handler is ready; both changes ship together |
| `checkSoftRulesAfterWrite` called twice per keystroke if `_renderCharPanel` is called in wrong path | Low | Low | The branch ensures exactly one `_renderCharPanel` call — verified explicitly in RULES §2 checkpoint |

---

## Scope Boundaries

### In Scope (Phase 2)
- ✅ `isClusterComplete()` in `diacritic-engine.js`
- ✅ `_smartFlowAdvance()` helper in `character-mode.js`
- ✅ Auto-advance trigger in `_handleDiacriticKey` success path
- ✅ Space in Word Mode enters Character Mode directly (`navigation.js`)
- ✅ `?` overlay updated for Phase 2 additions (`index.html` — when available)

### Out of Scope (do not implement, do not scaffold toward)
- ❌ Compound keys (Digit4/5/6) — deferred sub-item; design documented above; `keymap.json` format unchanged until JS handler is ready
- ❌ Auto-advance after `_handleClearDiacritics` — clearing is a correction action; the pinky (Delete/Backspace) is appropriate for corrections; do not add advance there
- ❌ Shift+Tab in Character Mode — not in Phase 2
- ❌ Any CSS change to `.char-tile`, `.char-tiles-container`, `.letter-cluster` — RULES.md §4
- ❌ Refactoring of `_tabJumpToNextUndiac` or adjacent code — RULES.md §0
- ❌ Multi-file ergonomic model validation — not a gate; run `ergonomic_model.py` on additional samples in parallel if desired
- ❌ Undo/redo, multi-file editing, letter substitution — RULES.md §5

---

## ZAP — Files Still Needed

| File | Needed for | Status |
|------|------------|--------|
| `index.html` | Phase 3 Task 3.1 — `?` overlay update | Not yet attached — request before Phase 3 |

Phases 1 and 2 can proceed without `index.html`.

---

*Plan v1.0 — Session 22 · Source files reviewed: `diacritic-engine.js`, `character-mode.js`, `navigation.js`, `diacritic_engine.py`, `PLAN_ergonomics-phase1.md`*
