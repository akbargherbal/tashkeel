# Tashkeel — Ergonomics Phase 1 QA Test Script

**Who this is for:** Anyone testing the app. No knowledge of the code required.
**What you need:** The app running at `http://127.0.0.1:5000` in Chrome. A file open in the editor with at least a few undiacritized (amber-highlighted) words.
**How to use this:** Work through each test in order. Tick it if it behaves as described. Note anything unexpected.

---

## Setup

1. Open the app in Chrome.
2. Click any Arabic text file in the sidebar to open it.
3. You should see Arabic text with some words highlighted in amber — those are words missing diacritics.
4. The status bar at the bottom should show **Word Mode**.

---

## Section A — Diacritic Keys (Number Row + Numpad)

You need to be in **Character Mode** for these. To enter Character Mode: navigate to any amber word using the arrow keys, then press **Enter**.

The status bar should now show **Character Mode** and a panel should appear at the bottom showing the individual letters of the word.

### A1 — Applying diacritics with the number row

With the cursor on any Arabic letter in Character Mode:

| Test | What to do | Expected result                                        |
| ---- | ---------- | ------------------------------------------------------ |
| A1-1 | Press `1`  | Fatha (small diagonal stroke above the letter) appears |
| A1-2 | Press `2`  | Kasra (small diagonal stroke below the letter) appears |
| A1-3 | Press `3`  | Damma (small loop above the letter) appears            |
| A1-4 | Press `7`  | Tanween Fatha (two diagonal strokes above) appears     |
| A1-5 | Press `8`  | Tanween Kasra (two diagonal strokes below) appears     |
| A1-6 | Press `9`  | Tanween Dhamma (two loops above) appears               |
| A1-7 | Press `0`  | Sukoon (small circle above the letter) appears         |

### A2 — Toggle off

| Test | What to do                                                 | Expected result                                                    |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| A2-1 | Press `0` to apply Sukoon, then press `0` again            | Sukoon is **removed**. Pressing the same key twice toggles it off. |
| A2-2 | Same toggle-off behaviour applies to keys `1`–`3`, `7`–`9` | Each key removes its own diacritic when pressed a second time      |

### A3 — Numpad (same layout as number row)

Repeat the same tests from A1 using the Numpad keys. The mapping is identical:

| Test | What to do       | Expected result                      |
| ---- | ---------------- | ------------------------------------ |
| A3-1 | Press `Numpad 1` | Fatha appears (same as pressing `1`) |
| A3-2 | Press `Numpad 2` | Kasra appears                        |
| A3-3 | Press `Numpad 3` | Damma appears                        |
| A3-4 | Press `Numpad 7` | Tanween Fatha appears                |
| A3-5 | Press `Numpad 8` | Tanween Kasra appears                |
| A3-6 | Press `Numpad 9` | Tanween Dhamma appears               |
| A3-7 | Press `Numpad 0` | Sukoon appears                       |

### A4 — Shadda (Shift+0)

| Test | What to do                                          | Expected result                                                                     |
| ---- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A4-1 | Press `Shift+0`                                     | Shadda (small ش-like mark above the letter) appears                                 |
| A4-2 | Press `Shift+Numpad 0`                              | Same result — Shadda appears                                                        |
| A4-3 | Press `Shift+0` on a letter that already has Shadda | Shadda is **removed** (toggle-off)                                                  |
| A4-4 | First apply Sukoon (`0`), then press `Shift+0`      | Nothing happens — the letter flashes red briefly. Sukoon and Shadda cannot coexist. |

---

## Section B — Space Key (Single-Key Advance)

### B1 — Space in Word Mode

Make sure you are in **Word Mode** (press `Escape` if needed).

| Test | What to do                                    | Expected result                                                                       |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| B1-1 | Press `Space`                                 | Cursor jumps to the **next** amber (undiacritized) word — identical to pressing `Tab` |
| B1-2 | Press `Space` several times                   | Cursor keeps advancing through amber words one by one                                 |
| B1-3 | Press `Space` when on the **last** amber word | Cursor wraps around to the **first** amber word                                       |
| B1-4 | Press `Tab`                                   | Behaves exactly the same as Space — Tab is unchanged                                  |
| B1-5 | Press `Space`                                 | The page does **not** scroll — only the cursor moves                                  |

### B2 — Space in Character Mode

Enter Character Mode on any word (`Enter`).

| Test | What to do                         | Expected result                                                                                                        |
| ---- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| B2-1 | Press `Space`                      | Character Mode panel **closes** and the cursor lands on the **next** amber word in Word Mode — one keystroke does both |
| B2-2 | Press `Escape` (in Character Mode) | Exits to Word Mode on the **same word** — does NOT jump to the next amber word. Space and Escape remain distinct.      |

---

## Section C — Shift+Tab (Backward Jump)

Make sure you are in **Word Mode**.

| Test | What to do                                                                            | Expected result                                                               |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| C1   | Navigate to the middle of the document (a few amber words in), then press `Shift+Tab` | Cursor jumps to the **previous** amber word (backward direction)              |
| C2   | Press `Shift+Tab` at the **first** amber word in the document                         | Cursor wraps to the **last** amber word in the document                       |
| C3   | Press `Tab` after using Shift+Tab                                                     | Cursor jumps **forward** — Tab is unchanged                                   |
| C4   | Press `Space` after using Shift+Tab                                                   | Cursor jumps **forward** — Space is unchanged                                 |
| C5   | Enter Character Mode, then press `Shift+Tab`                                          | **Nothing happens.** The panel stays open. Shift+Tab only works in Word Mode. |

---

## Section D — Keyboard Language Warning

Enter Character Mode on any word. **Switch your OS keyboard to English** (or any non-Arabic layout).

| Test | What to do                                                              | Expected result                                                                                                                                 |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| D1   | Press any Latin letter (e.g. `a`, `s`, `d`)                             | The current letter tile **flashes red** briefly AND an amber banner appears at the bottom of the screen reading **"Switch keyboard to Arabic"** |
| D2   | Wait after the warning                                                  | The banner disappears automatically after about **2 seconds**                                                                                   |
| D3   | After the warning dismisses, press a diacritic key (`1`, `2`, etc.)     | Diacritic applies normally — the warning did not break anything                                                                                 |
| D4   | Trigger the warning again, then press `Escape` before it auto-dismisses | Character Mode exits AND the banner disappears **immediately** — it is not left on screen                                                       |
| D5   | Press `Space` in Character Mode                                         | **No warning** — Space advances to the next word silently                                                                                       |
| D6   | Press `Arrow` keys, `Delete`, or `Backspace` in Character Mode          | **No warning** — these keys work normally                                                                                                       |

---

## Section E — Shortcuts Overlay (`?` key)

Press `?` from anywhere in the app to open the keyboard shortcuts overlay.

### E1 — Word Mode shortcuts listed

Find the **Word Mode** section of the overlay. Confirm these entries are present:

- [ ] `Space` — described as jumping to the next undiacritized word (same as Tab)
- [ ] `Shift+Tab` — described as jumping to the previous undiacritized word

### E2 — Character Mode shortcuts listed

Find the **Character Mode** section. Confirm:

- [ ] `Space` — described as exiting Character Mode and jumping to the next undiacritized word
- [ ] A note explaining the backward correction workflow — something like: _"To correct a character in the same word: `→` steps back. To return to a previous word: `Escape` → `→` → `Enter`."_

### E3 — Diacritic Keys section listed

Find the **Diacritic Keys** section. Confirm all 8 rows are present:

- [ ] `1` / `Numpad 1` → Fatha
- [ ] `2` / `Numpad 2` → Kasra
- [ ] `3` / `Numpad 3` → Damma
- [ ] `7` / `Numpad 7` → Tanween Fatha
- [ ] `8` / `Numpad 8` → Tanween Kasra
- [ ] `9` / `Numpad 9` → Tanween Dhamma
- [ ] `0` / `Numpad 0` → Sukoon
- [ ] `Shift+0` / `Shift+Numpad 0` → Shadda

### E4 — Overlay open/close

| Test | What to do                                              | Expected result                                                      |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| E4-1 | Press `?`                                               | Overlay opens                                                        |
| E4-2 | Press `?` again                                         | Overlay closes                                                       |
| E4-3 | Press `?` to reopen, then press `Escape`                | Overlay closes                                                       |
| E4-4 | Close the overlay, enter Character Mode, press `Escape` | Exits to Word Mode — `Escape` still works normally in Character Mode |

---

## Test Results Summary

| Section               | Pass | Fail | Notes |
| --------------------- | ---- | ---- | ----- |
| A — Diacritic Keys    |      |      |       |
| B — Space Key         |      |      |       |
| C — Shift+Tab         |      |      |       |
| D — Language Warning  |      |      |       |
| E — Shortcuts Overlay |      |      |       |

**Tester:** **********\_\_\_********** **Date:** ******\_****** **App version / branch:** **********\_\_\_**********
