# Tashkeel — Full-Flow Auto-Continue Implementation Plan

**Plan version:** 1.0  
**Based on:** `EXECUTIVE_SUMMARY.md` · `RULES.md` · `Session_28_Handover.md` · Session 29  
**Current codebase state:** v1.2.1 complete and QA-verified (Session 27 — help icon + compound keys shipped)  
**Source files reviewed:** `character-mode.js`, `RULES.md`, `README.md`, `PLAN_ergonomics-phase2.md`

---

## Executive Summary

- **Current state:** v1.2.1 shipped. Smart flow and Full Flow (Space in Word Mode) are both live. However, when smart flow completes the last character of a word, it exits to Word Mode and stops — the user must manually press `Enter` to begin editing the next undiacritized word.
- **Goal:** When `_smartFlowAdvance()` reaches a word boundary and jumps to the next undiacritized word, automatically enter Character Mode on that word — ready for immediate typing. Zero friction between consecutive words.
- **Key architectural constraint:** `_smartFlowAdvance()` is a dangerous-zone function in `character-mode.js` (RULES.md §2). The change is exactly one line. RULES.md §0 applies: minimum change, no adjacent refactoring, exact file/function stated before touching anything.
- **Estimated time:** 15–30 minutes total (including verification).

---

## Locked Decisions

Carried from Sessions 28. Closed. Do not re-open.

| # | Decision | Resolution |
|---|----------|------------|
| Scope of auto-enter | Applies only to the smart-flow completion path at a word boundary | Manual boundary exits (`←`), `Space`, and `Escape` remain explicit stops — unchanged |
| Implementation | Exactly one line added to `_smartFlowAdvance()` | No other files or functions require modification |
| Insertion point | After `window.updateZenFocus()`, before `window.updateStatusBar()` | Matches RULES.md §1 ordering invariant: `enterCharacterMode()` fires after `updateZenFocus()` so `_applyCharModeLineStyle` wins over zen class assignments |
| End-of-document safety | `_tabJumpToNextUndiac()` returning false is the natural guard | If no undiacritized words remain, the `if` block does not execute; `enterCharacterMode()` is never called; user stays in Word Mode and sees the completion banner |
| Read-only safety | `totalUndiacCount === 0` prevents the jump entirely | `enterCharacterMode()` has its own `status === 'complete'` guard as defence-in-depth, but the jump never fires in read-only mode anyway |

---

## Assumptions to Validate Before Starting

1. `window.enterCharacterMode` is already exposed on `window` (from `character-mode.js`) — **check in Chrome console** before touching the file: `typeof window.enterCharacterMode` should return `'function'`.
2. `window._tabJumpToNextUndiac` is already exposed on `window` (Phase 2) — **check**: `typeof window._tabJumpToNextUndiac` should return `'function'`.
3. `window.updateZenFocus` is already exposed on `window` (from `renderer.js`) — **check**: `typeof window.updateZenFocus` should return `'function'`.
4. The app is on v1.2.1 (help icon + compound keys present). Confirm by pressing `?` and checking that compound key rows (4, 5, 6) are listed.
5. `pytest test_diacritic_engine.py` passes clean before any file is touched.

---

## Pre-Coding Checklist

- [ ] **pytest baseline is green** — `cd src && pytest test_diacritic_engine.py -v` — all tests pass
- [ ] **`window.enterCharacterMode` is a function** — exposed on `window` from `character-mode.js`
- [ ] **`window._tabJumpToNextUndiac` is a function** — Phase 2 exposure confirmed
- [ ] **`window.updateZenFocus` is a function** — `renderer.js` exposure confirmed
- [ ] **Compound key QA** (carried from Session 28 known issues) — restart Flask before testing keys 4/5/6 if not already verified

> ⚠ Do not begin if pytest is red. Do not begin if `window.enterCharacterMode` is not a function — diagnose before proceeding.

---

## Phase 1: Full-Flow Auto-Continue

### Goal

Add one line to `_smartFlowAdvance()` in `character-mode.js` so that when smart flow jumps to the next undiacritized word, it also enters Character Mode on that word automatically.

### Task Ordering Note

There is a single task. There is no scaffolding or preliminary work — `enterCharacterMode()` already exists and is already correct. The only action is the insertion.

---

**1.1 — Add `window.enterCharacterMode()` to the word-boundary branch of `_smartFlowAdvance()`** *(character-mode.js — dangerous zone · ~5 min)*

⚠ **`_smartFlowAdvance()` is a dangerous-zone function. Read RULES.md §2 before editing.**

**Locate the target block.** In `character-mode.js`, find `_smartFlowAdvance()`. The word-boundary branch currently reads:

```javascript
  if (nextIdx >= word.clusters.length) {
    // Last character in word — exit and jump to next undiacritized word.
    window.exitCharacterMode();
    if (window._tabJumpToNextUndiac()) {
      window.updateZenFocus();
      window.updateStatusBar();
      window.scheduleCursorSave();
    }
  }
```

**Make the change.** Insert exactly one line — `window.enterCharacterMode();` — immediately after `window.updateZenFocus()`:

```javascript
  if (nextIdx >= word.clusters.length) {
    // Last character in word — exit and jump to next undiacritized word.
    window.exitCharacterMode();
    if (window._tabJumpToNextUndiac()) {
      window.updateZenFocus();
      window.enterCharacterMode();  // Full-Flow Auto-Continue (Session 29)
      window.updateStatusBar();
      window.scheduleCursorSave();
    }
  }
```

**Why this ordering is correct (RULES.md §1):**
- `exitCharacterMode()` — resets mode to `'word'`, hides panel, restores line style.
- `_tabJumpToNextUndiac()` — updates `lineIdx` and `wordIdx` to the next undiacritized word; returns `false` if none exist (safe guard).
- `updateZenFocus()` — applies correct zen classes to lines at the new `lineIdx`. Must fire *before* `enterCharacterMode()`.
- `enterCharacterMode()` — sets `mode = 'character'`, `charIdx = 0`, opens the char panel, calls `_renderCharPanel()`, then calls `_applyCharModeLineStyle(true)` which overrides the zen classes set by `updateZenFocus()`. This ordering is exactly the pattern specified in RULES.md §1 for the Space-in-Word-Mode full-flow path.
- `updateStatusBar()` — updates the status bar display (redundant but harmless: `enterCharacterMode()` already calls it internally; the second call is a no-op with no side effects).
- `scheduleCursorSave()` — debounced cursor save. Must remain; `enterCharacterMode()` does not call it.

**RULES.md §2 checkpoint:**
- `_updateWordSpanText → reclassifyWord` ordering is not touched. ✓
- Exactly one `_renderCharPanel()` fires per keystroke: `enterCharacterMode()` calls it internally; no second call is added. ✓
- `checkSoftRulesAfterWrite()` sole-call-site invariant (RULES.md §3.9): still called only from `_renderCharPanel()`, which is called from `enterCharacterMode()`. No new call site is introduced. ✓
- `_smartFlowAdvance()` call-site invariant (RULES.md §2): `_smartFlowAdvance()` is still called only from `_handleDiacriticKey` and `_handleCompoundDiacriticKey` success paths. This change is inside `_smartFlowAdvance()`, not a new call site. ✓

**Verify Task 1.1:**

Run these manual checks in the live app (restart Flask first if not already running):

1. **Happy path — word boundary advance:**
   - Open a file with multiple undiacritized words. Navigate to a word in Word Mode.
   - Press `Enter` to enter Character Mode.
   - Apply a diacritic to every character in the word until smart flow triggers on the last character.
   - **Expected:** The app jumps to the next undiacritized word **and** the Character Mode panel opens immediately on it, with the cursor at `charIdx = 0` (rightmost character). No manual `Enter` press required.

2. **Explicit stop keys are unaffected:**
   - In Character Mode, press `Space` — **expected:** exits to Word Mode and jumps (no auto-enter). Behaviour unchanged.
   - In Character Mode, press `Escape` — **expected:** exits to Word Mode, stays on current word. Behaviour unchanged.
   - In Character Mode, press `←` past the word boundary — **expected:** exits to Word Mode, moves to next word. Behaviour unchanged.

3. **End-of-document safety:**
   - Navigate to the last undiacritized word in the file. Complete all characters via smart flow.
   - **Expected:** `_tabJumpToNextUndiac()` returns `false`; the `if` block does not execute; `enterCharacterMode()` is never called; the completion banner appears (or the cursor stays in Word Mode). No crash. No spurious panel open.

4. **Read-only mode:**
   - Mark a file complete (click **Mark Complete**).
   - Re-open the file. Navigate to a word and press `Enter`.
   - **Expected:** Character Mode opens but diacritic keys are no-ops (existing read-only guard in `_handleDiacriticKey`). Smart flow never triggers. Auto-enter never triggers. Behaviour unchanged.

5. **Zen Focus ordering:**
   - With Zen Focus enabled, complete a word via smart flow at a word boundary.
   - **Expected:** The jumped-to word's line correctly receives the `zen-active` treatment. The line is then dimmed to `zen-far` by `_applyCharModeLineStyle(true)` as the char panel opens. No flicker or wrong class ordering.

6. **Network tab (Chrome DevTools):**
   - Verify that the auto-advance at the word boundary does **not** trigger `POST /api/write_char`. Only diacritic key presses should produce write calls.

7. **pytest still green:**
   - `cd src && pytest test_diacritic_engine.py -v` — all tests pass.

### Phase 1 Success Criteria

- ✅ Smart flow at a word boundary auto-opens Character Mode on the next undiacritized word
- ✅ `charIdx = 0` on entry (rightmost character of the new word)
- ✅ `Space`, `Escape`, and `←` boundary exits are unaffected — still explicit stops
- ✅ No auto-enter when no undiacritized words remain (end of document)
- ✅ No auto-enter in read-only (`status === 'complete'`) mode
- ✅ Zen Focus line treatment correct at the jumped-to word
- ✅ No `POST /api/write_char` fires on auto-advance (Network tab)
- ✅ pytest green before and after

### Deliverables

- [ ] `character-mode.js` — one line added to `_smartFlowAdvance()` word-boundary branch

---

## Decision Tree & Stop Conditions

```
START
  ↓
PRE-CODING CHECKLIST
  ├─ pytest red before any change            → STOP: fix existing failure first
  ├─ window.enterCharacterMode not a function → STOP: diagnose before editing
  └─ All items checked                       → PHASE 1

PHASE 1: Full-Flow Auto-Continue
  ├─ Happy path fails (panel does not open)          → REVERT; check insertion point
  ├─ Space / Escape / ← boundary exit changed        → REVERT immediately
  ├─ write_char fires on auto-advance (Network tab)  → REVERT immediately
  ├─ Completion banner missing at end of document    → REVERT; check _tabJumpToNextUndiac guard
  ├─ Zen Focus class wrong after auto-enter          → REVERT; check updateZenFocus ordering
  └─ All 7 verification checks pass                 → SHIP
```

### Explicit Stop Conditions

**STOP and REVERT immediately if:**

- `POST /api/write_char` fires when no diacritic was intentionally applied (auto-advance at word boundary).
- `Space` in Character Mode now auto-enters the next word (two handlers conflicting).
- `Escape` in Character Mode now auto-enters the next word.
- `←` past word boundary now auto-enters the next word.
- The completion banner does not appear when the last undiacritized word is completed.
- `checkSoftRulesAfterWrite` appears to fire from a second call site (more than one char panel render per keystroke).
- pytest turns red at any point.

---

## Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `updateStatusBar()` called twice (once inside `enterCharacterMode`, once in the existing block) | Certain (by design — the existing call is retained) | None — pure display update, idempotent | No action needed; redundant call is harmless |
| `enterCharacterMode()` sets `charIdx = 0` on a word the user navigated away from mid-word | None — `_tabJumpToNextUndiac()` always lands on a fresh undiacritized word; `charIdx = 0` is the correct entry position | — | Verified by existing `enterCharacterMode()` contract |
| Auto-enter fires on a fully-diacritized word | None — `_tabJumpToNextUndiac()` only lands on words where `undiacCount > 0` | — | Guard is upstream of our change |
| `_applyCharModeLineStyle(true)` zen class collision | Low — ordering is correct: `updateZenFocus()` then `enterCharacterMode()` | Low | Verified in check 5 (Zen Focus ordering) |
| Compound key QA (carried from Session 28) | Unknown — not yet run on live app | Medium | Run compound key QA (keys 4/5/6) during this session's verification pass; document result in handover |

---

## Scope Boundaries

### In Scope (Session 29)

- ✅ One line added to `_smartFlowAdvance()` in `character-mode.js`
- ✅ Verification of all 7 checks listed under Task 1.1
- ✅ Compound key live QA (deferred from Session 28 — run opportunistically during verification)

### Out of Scope (do not implement, do not scaffold toward)

- ❌ Auto-enter after `Space` in Character Mode — `Space` is an explicit stop by design (RULES.md §3.11)
- ❌ Auto-enter after `←` word-boundary exit — manual navigation is an explicit stop
- ❌ Auto-enter after `Escape` — explicit stop
- ❌ Any change to `navigation.js`, `renderer.js`, `visual-hints.js`, `soft-rules.js`, or `completion.js`
- ❌ Any CSS change to `.char-tile`, `.char-tiles-container`, `.letter-cluster` — RULES.md §4
- ❌ Refactoring of `_smartFlowAdvance()`, `exitCharacterMode()`, or `_tabJumpToNextUndiac()` — RULES.md §0
- ❌ CSS tooltip truncation fix (`#char-panel` overflow) — deferred since Session 16; separate session required
- ❌ Undo/redo, multi-file editing, letter substitution — RULES.md §5

---

## ZAP — Files Still Needed

No additional files are required. The single-line fix touches only `character-mode.js`, which has been read in full.

---

*Plan v1.0 — Session 29 · Source files reviewed: `character-mode.js`, `RULES.md`, `Session_28_Handover.md`, `EXECUTIVE_SUMMARY.md`, `PLAN_ergonomics-phase2.md`*
