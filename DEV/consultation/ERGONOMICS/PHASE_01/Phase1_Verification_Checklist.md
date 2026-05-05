# Tashkeel Ergonomics Phase 1 — Verification Checklist
**Purpose:** Fact-check that the full `PLAN_ergonomics-phase1.md` is implemented
correctly in the running app. Work through every section in order. A Phase is
only officially complete when every item in its section is ticked. Produce
`Session_19_Handover.md` once all three phases pass.

**Before you start:** App is running (`python app.py`), a file is open in the
editor, Chrome DevTools is open (F12).

---

## Pre-flight

- [ ] `pytest test_diacritic_engine.py -v` — all tests green
- [ ] App loads at `http://127.0.0.1:5000` without console errors

---

## Phase 1: Diacritic Key Layout

### 1.1 — `shiftKey` parameter threading
Open a file. Enter Character Mode on any word (`Enter`).

- [ ] Press any existing Arabic diacritic key (raw Unicode, e.g. from an Arabic
  keyboard layout) — diacritic applies normally. No regression.
- [ ] In DevTools Sources, set a breakpoint on `handleCharacterMode`. Press a
  key without Shift — confirm `shiftKey` argument is `false`.
- [ ] Same breakpoint, hold Shift and press a key — confirm `shiftKey` is `true`.
- [ ] `character-mode.js` function signature reads:
  `handleCharacterMode(key, code, shiftKey = false)` (default `false` present).
- [ ] `navigation.js` call site reads:
  `window.handleCharacterMode(event.key, event.code, event.shiftKey)`.

### 1.2 — `keymap.json` new layout (13 entries)
Still in Character Mode on any Arabic letter.

- [ ] Press `1` → Fatha (ـَ) applied.
- [ ] Press `2` → Kasra (ـِ) applied.
- [ ] Press `3` → Damma (ـُ) applied.
- [ ] Press `7` → Tanween Fatha (ـً) applied.
- [ ] Press `8` → Tanween Kasra (ـٍ) applied.
- [ ] Press `9` → Tanween Dhamma (ـٌ) applied.
- [ ] Press `0` → Sukoon (ـْ) applied.
- [ ] Press `0` again → Sukoon toggles **off** (removed). Toggle-off works.
- [ ] Repeat the above 7 checks using the Numpad equivalents (Numpad1–3,
  Numpad7–9, Numpad0).
- [ ] Existing raw-Unicode Arabic keyboard keys still apply diacritics
  (not displaced by the new bindings).
- [ ] `keymap.json` contains exactly 13 entries: `Digit1–3`, `Digit7–9`,
  `Digit0`, `Numpad1–3`, `Numpad7–9`, `Numpad0`. Keys `Digit4/5/6` and
  `Numpad4/5/6` are **absent** (compound keys deferred to Phase 2).

### 1.3 — Shift+0 / Shift+Numpad0 → Shadda
Still in Character Mode.

- [ ] Press `Shift+0` → Shadda (ـّ) applied.
- [ ] Press `Shift+Numpad0` → Shadda (ـّ) applied.
- [ ] Press `0` (unshifted) → Sukoon (ـْ). Unshifted key undisturbed.
- [ ] Press `Shift+0` on a character **already carrying Shadda** → Shadda
  toggles off (removed). No error.
- [ ] Press `Shift+0` on a character **already carrying Sukoon** → hard block
  fires; `flashBlockedTile` flashes red; nothing is written; no API call in
  Network tab.
- [ ] In `character-mode.js`, the Shift+0 override block sits **after** the
  `diacriticCp = window.KEYMAP[code]` line and **before** the
  `if (diacriticCp)` dispatch.

### Phase 1 — Sign-off
- [ ] All items above ticked.
- [ ] `pytest` still green (rerun now).

---

## Phase 2: Navigation Extensions

### 2.1 — `window` globals exposed
With a file open, in the Chrome DevTools console:

- [ ] `typeof window._tabJumpToNextUndiac` → `"function"` (not `"undefined"`).
- [ ] `typeof window.scheduleCursorSave` → `"function"` (not `"undefined"`).

### 2.2 — Space in Word Mode
Navigate to Word Mode (press `Escape` if in Character Mode).

- [ ] Press `Space` → cursor jumps to next amber (undiacritized) word.
  Behaviour is identical to `Tab`.
- [ ] Press `Space` repeatedly until the last undiacritized word is reached,
  then press `Space` again → wraps to the **first** undiacritized word.
- [ ] Press `Tab` → still jumps forward normally (unchanged).
- [ ] With `totalUndiacCount === 0` (fully diacritized file): press `Space` →
  no-op; cursor does not move.
- [ ] Press `Space` — the **page does not scroll**. Browser default is consumed.
- [ ] In `navigation.js` `consumedKeys` array: `' '` (single space) is present.

### 2.3 — Space in Character Mode
Enter Character Mode (`Enter`) on any word.

- [ ] Press `Space` → Character Mode panel closes; cursor lands on the next
  amber word in Word Mode.
- [ ] Open DevTools **Network** tab, filter `write_char`. Press `Space` in
  Character Mode → **zero** `POST /api/write_char` requests fire.
- [ ] Zen Focus view re-centres on the new word's line after the Space press.
- [ ] Amber highlight on the word just exited is unchanged (no reclassification).
- [ ] Press `Escape` (in Character Mode) → exits to Word Mode **without** jumping
  to next word. Space and Escape remain distinct behaviours.
- [ ] The Space branch is the **first** check inside `handleCharacterMode`,
  immediately after the `if (!word) return;` guard (before the Escape check).

### 2.4 — Shift+Tab backward jump
In Word Mode, navigate to a word that has at least two amber words before it.

- [ ] Press `Shift+Tab` → cursor jumps to the **previous** amber word
  (backward direction).
- [ ] Press `Shift+Tab` at the **first** undiacritized word → wraps to the
  **last** undiacritized word in the document.
- [ ] Press `Tab` → still jumps **forward** (unchanged).
- [ ] Press `Space` → still jumps **forward** (unchanged, Task 2.2).
- [ ] Enter Character Mode; press `Shift+Tab` → **no action**; panel stays
  open. Falls through silently.
- [ ] In `navigation.js` `handleEditorKeystroke`: synthetic key mapping reads
  `(event.shiftKey && event.key === 'Tab') ? 'ShiftTab' : event.key`.
- [ ] `_tabJumpToPrevUndiac` function exists in `navigation.js` (search the
  file for the function name).

### 2.5 — Keyboard language warning
Enter Character Mode. Set OS keyboard to English (or any non-Arabic layout).

- [ ] Press any Latin letter (e.g. `a`, `b`, `q`) → amber flash fires on the
  current tile **and** an amber banner reading
  **"Switch keyboard to Arabic"** appears at the bottom of the screen.
- [ ] Banner disappears automatically after approximately **2 seconds**.
- [ ] DevTools Network tab: **no** `POST /api/write_char` fires.
- [ ] Press a valid diacritic key immediately after the warning →
  diacritic applies normally; warning did not corrupt state.
- [ ] Press `Space` in Character Mode → **no** warning fires
  (Space is handled by early return before the `else if` branch).
- [ ] Press `Escape` while the banner is visible → panel closes **and** banner
  is dismissed immediately (not left dangling).
- [ ] Press `Arrow` keys, `Delete`, `Backspace` in Character Mode →
  no warning fires.
- [ ] Press a valid Arabic diacritic key (raw Unicode) → no warning fires.
- [ ] In `character-mode.js`: `_langWarningTimer` and `_langWarningEl`
  declared at module level (not inside any function).
- [ ] The language warning trigger is an `else if (key.length === 1)` branch
  appended to the existing `if (diacriticCp)` block — it is the **last**
  branch in `handleCharacterMode`.

### Phase 2 — Sign-off
- [ ] All items above ticked.
- [ ] `pytest` still green (rerun now).

---

## Phase 3: Polish

### 3.1 — `?` overlay updated
Press `?` in the running app to open the shortcuts overlay.

**Word Mode section — verify these rows are present:**

- [ ] `Space` | "Jump to next undiacritized word (same as Tab)"
  (or equivalent accurate description).
- [ ] `Shift+Tab` | "Jump to previous undiacritized word"
  (or equivalent accurate description).

**Character Mode section — verify these rows/notes are present:**

- [ ] `Space` | "Exit Character Mode + jump to next undiacritized word"
  (or equivalent accurate description).
- [ ] A prose note covering the backward correction workflow, equivalent to:
  *"To correct a character in the same word: `→` steps back. To return to a
  previous word: `Escape` → `→` → `Enter`."*

**Diacritic Keys section — verify the full layout table is present with all 8 rows:**

- [ ] `1` / `Numpad 1` → Fatha
- [ ] `2` / `Numpad 2` → Kasra
- [ ] `3` / `Numpad 3` → Damma
- [ ] `7` / `Numpad 7` → Tanween Fatha
- [ ] `8` / `Numpad 8` → Tanween Kasra
- [ ] `9` / `Numpad 9` → Tanween Dhamma
- [ ] `0` / `Numpad 0` → Sukoon
- [ ] `Shift+0` / `Shift+Numpad 0` → Shadda

**Overlay mechanics (RULES.md §3.10):**

- [ ] Press `?` again → overlay closes.
- [ ] Press `?` to reopen, then press `Escape` → overlay closes.
- [ ] Enter Character Mode, press `Escape` → exits to Word Mode
  (**not** confused with overlay Escape). RULES.md §3.10 intact.

### 3.2 — `config.json` in `.gitignore`
Run from the `src/` directory (or the repo root — wherever `.gitignore` lives):

- [ ] `git check-ignore -v config.json` returns a match line such as:
  `.gitignore:N:config.json    config.json`.
- [ ] `git status` does **not** list `config.json` as tracked or untracked
  (if it exists locally).

### Phase 3 — Sign-off
- [ ] All items above ticked.
- [ ] `pytest` still green (final rerun).

---

## Overall Phase 1 Plan — Official Sign-off

All three phases pass when every checkbox above is ticked.

- [ ] **Phase 1 complete** — diacritic key layout verified ✅
- [ ] **Phase 2 complete** — navigation extensions verified ✅
- [ ] **Phase 3 complete** — polish verified ✅

**Sign-off:** _________________________ Date: _____________

Once signed off, update `Session_19_Handover.md` with the verification outcome
and any items that failed (with notes on what was found and what was fixed or
deferred).
