# Arabic Diacritics Editor — Product Specification

**Version:** 1.2
**Status:** Pre-development — all open questions resolved

---

## 1. Overview & Philosophy

A personal, single-user, locally-run web application for adding and correcting Arabic diacritics (tashkeel/harakat) in plain-text files.

Core philosophy:

- **Non-destructive:** The original source file is never modified under any circumstances.
- **Keyboard-centric:** All editing and navigation is designed to be done entirely from the keyboard.
- **Zen Focus:** A teleprompter-style interface that locks the active line to the vertical centre of the screen, minimising visual noise.
- **Zero build toolchain:** Python (Flask) backend, Vanilla JS/HTML frontend. No npm, no database, no authentication.
- **Persistent progress:** Work is never lost. Every session resumes exactly where the last one ended.

The app **writes edits**, but does so only on a working copy, never on the original.

---

## 2. Non-Destructive Contract

### 2.1 The Working Copy

When the user opens a file for the first time, the app **immediately and automatically** creates a working copy:

```
Original:      /project/chapter_1.txt
Working copy:  /project/diac_chapter_1.txt
```

The prefix `diac_` is prepended to the filename. The working copy is a byte-for-byte duplicate of the original at the moment of creation.

**All diacritic edits are written directly to the working copy.** The working copy IS the persistent state. There is no separate sidecar for edits.

### 2.2 Session Persistence

Because edits go directly into the working copy, progress survives power loss, browser closure, and system restarts without any explicit "save" step from the user.

A lightweight **cursor sidecar** (`.diac_cursor.json`) is saved alongside the working copy to remember the user's cursor position between sessions:

```
/project/diac_chapter_1.txt                       ← working copy (edits live here)
/project/diac_chapter_1.txt.diac_cursor.json      ← cursor position only
```

The cursor sidecar schema is:

```json
{
  "line": 0,
  "word": 0,
  "char": null,
  "status": "in_progress",
  "last_seen_mtime": 1718000000.0
}
```

The `last_seen_mtime` field records the modification timestamp of the working copy at the end of each session. On session resume, if the working copy's current mtime differs from this value, a non-blocking warning banner is shown: `"Working copy was modified externally — edits may conflict"`. See §2.5.

### 2.3 Resuming a Session

When the user re-opens a file that already has a working copy:

- The app detects the existing `diac_` file and opens it directly — no new copy is created.
- The cursor sidecar is read and the cursor is restored to the last saved position.
- The user continues exactly where they left off.

### 2.4 The `_diac_output/` Directory (Deliverables)

When the user marks a file as complete, a finalised copy is written to a `_diac_output/` folder at the project root, mirroring the folder structure:

```
/project/
├── chapter_1.txt                             ← Original (untouched forever)
├── diac_chapter_1.txt                        ← Working copy (in-session edits)
├── diac_chapter_1.txt.diac_cursor.json       ← Cursor sidecar
│
└── _diac_output/
    └── chapter_1.txt                         ← Final diacritized output
```

The output file uses the **original filename** (without the `diac_` prefix), clearly separating in-progress work from finished deliverables.

### 2.5 Working Copy Conflict Detection

If the user edits the `diac_` working copy externally between sessions (e.g., in a text editor), the app detects this via an mtime check on session resume. The detection is lightweight and non-blocking:

- On every cursor sidecar write, `last_seen_mtime` is updated to the current mtime of the working copy.
- On `/api/open`, if the working copy's mtime differs from `last_seen_mtime`, the app shows a non-blocking warning banner: `"Working copy was modified externally — edits may conflict"`.
- The app continues to load normally. No data is discarded.

---

## 3. File Scope

- Eligible file types: `.txt`, `.md`
- The `_diac_output/` directory is hidden from the file tree.
- Existing `diac_` working copies are hidden from the file tree (they are managed internally).
- Cursor sidecar files are hidden from the file tree.
- The directory scanner is recursive, sorted, and shows folders only if they contain eligible files.

---

## 4. Input Source

Source files may contain:

- **Bare Arabic text** with no diacritics — the user adds them from scratch.
- **Already-diacritized text** — the user corrects existing diacritics.
- **A mix of both** — the most common case.

The app makes no assumptions about the diacritization state of any letter. It renders all text faithfully and lets the user navigate and edit as needed.

---

## 5. Two-Tier Navigation Model

Navigation operates in two distinct modes. This is the central UX model of the app.

### 5.1 Word Mode (Outer Tier) — Default

The document is navigated **word by word**.

| Key             | Action                                          |
| --------------- | ----------------------------------------------- |
| `←` Left Arrow  | Move to **next word** (RTL direction)           |
| `→` Right Arrow | Move to **previous word**                       |
| `↓` Down Arrow  | Move to same word position on **next line**     |
| `↑` Up Arrow    | Move to same word position on **previous line** |
| `Enter`         | **Enter Character Mode** for the current word   |
| `Tab`           | **Jump to next undiacritized word** (next word with ≥1 amber candidate letter); wraps at end of document; no-op if no undiacritized words remain |

The active word is highlighted. Lines use the Zen Focus classes (`zen-active`, `zen-context`, `zen-far`).

### 5.2 Character Mode (Inner Tier)

Pressing `Enter` on a word zooms into it. The word expands visually and the cursor moves to its first character (rightmost, since Arabic is RTL).

| Key                      | Action                                                   |
| ------------------------ | -------------------------------------------------------- |
| `←` Left Arrow           | Move to **next character** (RTL)                         |
| `→` Right Arrow          | Move to **previous character**                           |
| `Escape`                 | **Exit Character Mode**, return to Word Mode             |
| Diacritic key            | **Apply** diacritic to current character (see §7)        |
| `Delete` / `Backspace`   | **Remove** diacritic from current character              |
| Same diacritic key again | **Toggle off** (remove) the diacritic if already present |

**Auto-exit at word boundary:** If the user presses `←` past the last character of the word (leftmost in RTL), the app automatically exits Character Mode and advances to the next word in Word Mode. If the user presses `→` past the first character (rightmost), the app exits and moves to the previous word. This makes continuous editing frictionless.

### 5.3 Visual State Distinction

The UI must make the current mode unambiguous at a glance:

- **Word Mode:** Active word has a subtle rectangular highlight (border or background).
- **Character Mode:** The expanded word is displayed prominently. The active character has a clearly distinct highlight (e.g., solid underline or filled background). Non-active characters in the word are slightly dimmed. A mode indicator in the status bar reads `CHARACTER MODE`.

### 5.4 Definition of "Character" — Grapheme Cluster

**"Character" in this specification always means a Unicode grapheme cluster as defined by UAX #29**, not a Unicode code point and not a UTF-16 code unit.

A grapheme cluster is the user-perceived character: a base Arabic letter together with all of its applied combining marks (e.g., `U+0628 ب` + `U+0651 Shadda` + `U+064E Fatha` form a single grapheme cluster spanning three code points).

**Implementation requirements:**

- **Frontend (Vanilla JS):** String indexing (`str[i]`) and `String.prototype.length` must never be used for cursor tracking or character counting in Arabic text. The app must use `Intl.Segmenter` with `{ granularity: 'grapheme' }` to tokenise each word into an array of grapheme clusters. The cursor index must track position within that array, not within the raw string.
- **Backend (Python 3):** Any server-side string operation on Arabic text (validation, serialisation) must use the `regex` module with the `\X` pattern, or the `uniseg` library, to correctly segment by grapheme cluster. Python's native `len()` counts code points and must not be used for character counting.

Failure to implement grapheme-cluster-aware navigation will result in the cursor landing on bare combining marks with no base letter beneath them, making the character card display impossible to render correctly.

---

## 6. Visual Hints for Undiacritized Letters

Since the input may be a mix of bare and diacritized text, the user needs to be able to locate undiacritized letters efficiently without navigating character by character through the entire document.

### 6.1 Letter-level colouring

In Word Mode, individual letters within the rendered words are coloured according to their diacritization state:

| State                                                 | Colour treatment                          |
| ----------------------------------------------------- | ----------------------------------------- |
| Has diacritic(s)                                      | Normal text colour (no special marking)   |
| No diacritic, but expected to have one                | Subtle amber / warm highlight             |
| Letter that canonically takes no diacritic (see §8.4) | No highlight (treated as "correct as-is") |

> **Note:** The "expected" determination is pragmatic, not morphological. Any consonant letter that has no diacritic and is not in the canonical no-diacritic list (§8.4) is considered a candidate.

### 6.2 Word-level undiacritized indicator

In Word Mode, words that contain one or more undiacritized candidate letters display a small dot or underline beneath them, so the user can jump to them efficiently.

### 6.3 Document-level count

The status bar shows a live count: **`Undiacritized: N letters`**, updated as the user works.

---

## 7. Diacritic Input

### 7.1 Primary input method — Raw Arabic keyboard

The user types diacritics using the standard Arabic keyboard layout. The app captures the diacritic character produced by the OS input method, not the physical key position.

Standard Arabic keyboard diacritic reference:

| Diacritic    | Unicode | Typical key (macOS Arabic) | Typical key (Windows Arabic 101) |
| ------------ | ------- | -------------------------- | -------------------------------- |
| Shadda (ّ)   | U+0651  | Shift + Q                  | Shift + `                        |
| Fatha (َ)    | U+064E  | Shift + A                  | Shift + Q                        |
| Fathatan (ً) | U+064B  | Shift + E                  | Shift + W                        |
| Dammatan (ٌ) | U+064C  | Shift + R                  | Shift + R                        |
| Kasra (ِ)    | U+0650  | Shift + S                  | Shift + A                        |
| Kasratan (ٍ) | U+064D  | Shift + W                  | Shift + E                        |
| Sukun (ْ)    | U+0652  | Shift + X                  | Shift + X                        |
| Damma (ُ)    | U+064F  | Shift + F                  | Shift + F                        |

> **Note:** Key positions differ between macOS and Windows Arabic layouts. The app must not hardcode physical key positions. See §7.2 for the correct interception strategy.

### 7.2 Keyboard event interception strategy

The app must intercept **`event.key`** on the `keydown` event, not `event.code`. `event.key` contains the Unicode character resolved by the OS after applying the active keyboard layout. This means the app receives the correct diacritic character regardless of which OS layout the user has active, without needing to know the layout name.

Standard Arabic OS layouts do not use an IME composition buffer for diacritics; `keydown` fires immediately with the resolved `event.key` value. There is no `compositionstart` / `compositionend` interference to handle for harakat input.

The correct interception pattern for diacritics:

```javascript
document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")
    return;

  const consumedKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Backspace",
    "Delete",
    "Escape",
    "Enter",
    "Tab",
  ];
  const isDiacritic = /^[\u064B-\u0655\u0670]$/.test(event.key); // Group A + B + C range

  if (consumedKeys.includes(event.key) || isDiacritic) {
    event.preventDefault(); // See §7.3 for rationale
    handleEditorKeystroke(event);
  }
});
```

### 7.3 Required `preventDefault()` calls

The global keydown handler **must** call `event.preventDefault()` synchronously for every key the app consumes. Without this, the following browser default behaviours will conflict with the editor:

| Key                        | Browser default (without `preventDefault()`)                   | Impact                                  |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `Backspace`                | Navigate back to previous page (Firefox, Safari, older Chrome) | Session loss                            |
| `ArrowDown` / `ArrowUp`    | Scroll the page                                                | Fights Zen Focus `translateY` centering |
| `ArrowLeft` / `ArrowRight` | Scroll horizontally (narrow viewports)                         | Page jitter                             |
| `Escape`                   | Dismiss browser UI, exit fullscreen                            | Unintended UI state                     |
| `Enter`                    | Submit forms, follow links                                     | Unintended navigation                   |

`preventDefault()` must be called only on the keys the app explicitly handles. It must not suppress keys the app does not consume (e.g., `Ctrl+C`, `Ctrl+V`, `F5`).

### 7.4 Configurable keymap (architecture requirement)

Beyond raw Arabic keyboard input, the key mapping must be implemented as a **configurable map object** to enable future custom shortcut remapping without code changes. A `keymap.json` file defines mappings from `event.code` values to Unicode diacritic codepoints, for non-standard or custom bindings only (e.g., mapping numpad keys to diacritics).

```json
{
  "customKeymap": {
    "Numpad1": "\u064E",
    "Numpad2": "\u064F"
  }
}
```

For standard Arabic layout diacritics, no keymap entry is needed — the app captures `event.key` directly. The `keymap.json` is read at startup and is not exposed in the UI in v1.

---

## 8. Business Logic — Diacritic Validation

This is the critical correctness layer of the app. The validator runs every time a diacritic is applied or the current state of a character changes.

### 8.1 The Harakat Taxonomy

```
Group A — Base vowels (mutually exclusive, max ONE per letter):
  Fatha      (َ)   U+064E
  Kasra      (ِ)   U+0650
  Damma      (ُ)   U+064F
  Sukun      (ْ)   U+0652
  Fathatan   (ً)   U+064B
  Kasratan   (ٍ)   U+064D
  Dammatan   (ٌ)   U+064C

Group B — Modifier (stackable with ONE Group A member, except Sukun):
  Shadda     (ّ)   U+0651

Group C — Orthographic modifiers (stackable with Group A; see §8.2 for stacking rules):
  Maddah above   (ٓ)  U+0653
  Hamza above    (ٔ)  U+0654
  Hamza below    (ٕ)  U+0655
  Wasla          (ٰ)  U+0670
```

Group C marks are combining characters applied to a base letter carrier (alef, waw, ya), not standalone letters. They represent consonantal orthographic distinctions (hamza seat, maddah contraction, wasla elision) that cannot be corrected by letter substitution. They must be fully supported as editable marks.

### 8.2 Hard Rules — Blocked immediately, edit not applied

These are absolute constraints enforced at the input level. When violated, the input is rejected silently or with a brief flash animation on the character. The invalid diacritic is never written.

| Rule                               | Description                                                                                                                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One base vowel**                 | A letter may carry at most ONE diacritic from Group A. Attempting to add a second Group A diacritic when one already exists replaces it (see §9 — replace mode).                                               |
| **No Sukun + Shadda**              | Shadda and Sukun cannot coexist on the same letter. Attempting to add one when the other is already present is a hard block.                                                                                   |
| **Max combining characters**       | A letter may carry at most one Group A mark + one Group B mark + one Group C mark (max three combining code points total). Attempting to exceed this is a hard block.                                          |
| **Shadda alone is valid**          | Shadda without a Group A diacritic is permitted.                                                                                                                                                               |
| **Group C on valid carriers only** | Hamza above, hamza below, and maddah may only be applied to alef (ا), waw (و), and ya (ي) carriers. Wasla may only be applied to alef. Attempting to apply a Group C mark to any other letter is a hard block. |

> **Existing text:** The hard rules are **input-time mutation guards only**. When the app loads a source file, it renders existing grapheme clusters faithfully regardless of how many combining marks they contain. It does not truncate, normalise, or reject clusters that exceed the above limits. The rules apply only when the user attempts to add a new mark.

### 8.3 Soft Rules — Amber warning, edit is allowed

These are contextual rules that produce a warning indicator but do not block the edit. The user may have a legitimate reason to override them.

| Rule                                             | Description                                                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tanwin on non-final character**                | Fathatan, Kasratan, Dammatan should appear only on the last character of a word. Warn if applied to a non-final character.                                                                                                                                                               |
| **Alef (ا) as long vowel — Group A diacritic**   | A bare alef in the middle of a word typically carries no Group A diacritic in its role as a long vowel. Warn when a Group A diacritic is applied. This rule is a positional heuristic; it will not distinguish a long-vowel alef from hamzat al-wasl in all cases.                       |
| **Alef in ال (definite article)**                | The alef of the definite article carries hamzat al-wasl and conventionally no harakat in most texts. Warn when Group A diacritics are attempted.                                                                                                                                         |
| **Alef maqsura (ى) at word end — any diacritic** | Alef maqsura in final position is typically left bare in classical prose. In indefinite nouns requiring tanwin fath (e.g., هُدًى), the fathatan belongs on the **preceding consonant**, not on the alef maqsura itself. Warn when any diacritic is applied to a word-final alef maqsura. |
| **ال + tanwin coexistence**                      | A word beginning with ال should not carry tanwin (semantic contradiction: definite + indefinite). Warn at the word level.                                                                                                                                                                |

**Soft warning display:** The character receives a subtle amber underline. In Character Mode, a tooltip-style label appears beneath the character explaining the issue in plain language (e.g., `"Tanwin usually appears at the last letter of a word"`).

**Persistence:** Soft warnings are ephemeral — they are recomputed on render from the current state of the working copy and are not stored in the cursor sidecar. They will re-appear automatically if the triggering condition still exists when the file is next opened.

### 8.4 Letters That Are Canonically Diacritic-free (no amber highlight)

These letters in specific positions are excluded from the "undiacritized candidate" colouring in §6.1:

| Letter           | Context                                            | Reason                              |
| ---------------- | -------------------------------------------------- | ----------------------------------- |
| Alef (ا)         | As a long vowel (mid/end of word)                  | Long vowel carrier, not a consonant |
| Waw (و)          | Preceding letter carries a damma (long vowel role) | Long vowel carrier                  |
| Ya (ي)           | Preceding letter carries a kasra (long vowel role) | Long vowel carrier                  |
| Alef maqsura (ى) | Word-final position                                | Typically bare in classical prose   |

> **Pragmatic note on waw and ya:** The no-highlight rule for waw and ya requires the preceding letter to already carry the relevant diacritic (damma or kasra respectively). If the preceding letter is currently undiacritized, the contextual rule cannot be evaluated. In that case the waw or ya **defaults to showing the amber highlight**. Distinguishing consonantal waw/ya from long-vowel waw/ya in all morphological contexts is out of scope; the rule applies only when the context is unambiguous.

> **Pragmatic note on mid-word alef:** The no-highlight rule for alef is a positional heuristic. It will not reliably identify hamzat al-wasl in all orthographic conventions. This is a known limitation and acceptable given that morphological analysis is out of scope (§18).

---

## 9. Diacritic Application Behaviour

### 9.1 Replace mode

When the cursor is on a character that already has a Group A diacritic and the user types a **different** Group A diacritic:

- The existing diacritic is **instantly replaced** by the new one.
- Shadda and Group C marks, if present, are preserved.
- No confirmation is required.

### 9.2 Toggle / clear

- Pressing the **same diacritic key** when that diacritic is already on the character **removes it** (toggle off).
- `Delete` or `Backspace` removes **all diacritics** from the current character in one keystroke.

**Toggle-off implementation:** "Same diacritic" is determined by checking whether the Unicode code point of the pressed key is present in the **set of combining marks** on the active grapheme cluster. This check is code-point identity within a set, not a byte-sequence comparison. This correctly handles cases where combining marks are stored in different orders in the source file (which can occur because Shadda and most Group A vowels share Unicode Canonical Combining Class 230 and are therefore not reordered by normalization).

### 9.3 Shadda stacking

- Shadda can be added to a character that already has a Group A diacritic (and vice versa).
- Exception: Shadda + Sukun is always a hard block (§8.2).

### 9.4 Group C stacking

- A Group C mark (hamza above, hamza below, maddah, wasla) may coexist with one Group A mark on the same carrier letter.
- Adding a Group A diacritic to a letter that already carries a Group C mark (or vice versa) follows replace mode for Group A (§9.1) and preserves the Group C mark.
- Group C + Shadda combinations are permitted on the relevant carriers.

### 9.5 No auto-advance

After placing a diacritic, the cursor **stays on the current character**. The user moves manually with arrow keys. This prevents skipping over characters unintentionally and keeps the user in full control.

---

## 10. Save & Persistence

| Event                        | Save action                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| Diacritic applied or removed | Write change immediately to the working copy (`diac_` file)       |
| Cursor moved                 | Debounced write of cursor position to `.diac_cursor.json` (500ms) |
| File switched                | Flush cursor sidecar immediately before switching                 |
| App close / page unload      | Flush cursor sidecar immediately                                  |

There is no manual "Save" button. There is no concept of an unsaved state.

### 10.1 Unicode normalization policy

The app must **not** apply global Unicode normalization (NFC, NFD, NFKC, or NFKD) to the file contents. Applying global normalization would alter bytes in grapheme clusters the user never edited, causing the working copy to diverge byte-for-byte from the original on lines that were not touched — violating the non-destructive philosophy and breaking external diffs.

The correct policy:

1. Read the source file as raw bytes; decode to a string without normalization.
2. Segment the string into grapheme clusters using `Intl.Segmenter` (frontend) or the `regex` / `uniseg` library (backend).
3. When the user edits a grapheme cluster, mutate only that cluster's combining marks.
4. When writing a mutated cluster back, serialize its combining marks in a **deterministic canonical order**: Group C mark first (if present), then Group B (Shadda, if present), then Group A vowel (if present). This ensures consistent output for edited characters without touching unedited ones.
5. Write the result back to the working copy. Unedited grapheme clusters are written back byte-for-byte as read.

---

## 11. Status System

Each file in the sidebar displays one of three statuses:

| Status        | Icon | Meaning                                            |
| ------------- | ---- | -------------------------------------------------- |
| `untouched`   | ○    | No working copy exists yet                         |
| `in_progress` | ●    | Working copy exists, not marked complete           |
| `complete`    | ✓    | Marked complete; output written to `_diac_output/` |

Status transitions:

- `untouched` → `in_progress`: On first open (when working copy is created)
- `in_progress` → `complete`: When user clicks **Mark Complete** (mouse-only, intentional)
- `complete` → `in_progress`: When user clicks **Reset** (mouse-only, intentional)

---

## 12. Mark Complete

Clicking **Mark Complete** triggers a confirmation modal (mouse-only). On confirm:

1. Any pending cursor save is flushed.
2. The current `diac_` working copy is copied to `_diac_output/<original_filename>`.
3. The cursor sidecar is updated with `"status": "complete"`.
4. The sidebar icon updates to ✓.
5. The document pane enters **read-only mode** (keyboard navigation still works; editing is blocked).
6. A banner appears: `"Complete — output saved to _diac_output/"`.

Failure modes:

- If the output directory cannot be written: a blocking error modal appears; status reverts to `in_progress`.

---

## 13. Reset Document

Clicking **Reset** triggers a confirmation modal. On confirm:

- The `diac_` working copy is **deleted**.
- The cursor sidecar is **deleted**.
- Status reverts to `untouched`.
- The next open of that file creates a fresh working copy from the original.

Reset does **not** delete anything in `_diac_output/`.

---

## 14. Keyboard Shortcuts Reference

### Word Mode

| Key     | Action                            |
| ------- | --------------------------------- |
| `←`     | Next word (RTL)                   |
| `→`     | Previous word                     |
| `↓`     | Same word position, next line     |
| `↑`     | Same word position, previous line |
| `Enter` | Enter Character Mode              |

### Character Mode

| Key                    | Action                                            |
| ---------------------- | ------------------------------------------------- |
| `←`                    | Next character (RTL); auto-exits at word boundary |
| `→`                    | Previous character; auto-exits at word boundary   |
| `Escape`               | Exit to Word Mode                                 |
| Diacritic key          | Apply / replace diacritic                         |
| Same diacritic key     | Toggle off (remove) diacritic                     |
| `Delete` / `Backspace` | Clear all diacritics from character               |

### Critical actions (mouse-only, intentional)

| Action         | Reason                                  |
| -------------- | --------------------------------------- |
| Mark Complete  | Prevent accidental completion           |
| Reset Document | Prevent accidental data loss            |
| Open Folder    | Infrequent; no keyboard shortcut needed |

---

## 15. Status Bar

The status bar displays (left to right, RTL-aware):

```
[Mode: WORD / CHARACTER]  [Line N / Total]  [Word N / Total on line]  [Char N / Total in word]  [Undiacritized: N]  [Auto-saved ✓]
```

- `Char N / Total in word` is only visible in Character Mode.
- `Undiacritized: N` counts candidate letters across the entire open file.
- `Auto-saved ✓` appears briefly after each write, then fades.

---

## 16. Typography & Visual Design

- **Font:** [Amiri](https://fonts.google.com/specimen/Amiri) for all Arabic text — designed for classical Arabic and renders diacritics correctly and beautifully.
- **Font size:** Larger than standard body text — diacritics must be clearly legible above and below letters. Minimum `24px` for body text; `32px`+ preferred.
- **Direction:** RTL throughout the document pane.
- **Zen Focus:** Active line locked to vertical centre using a `translateY` teleprompter technique.
- **Zen classes:** `zen-active` (full opacity, large), `zen-context` (medium opacity, adjacent lines), `zen-far` (low opacity, further lines).

### Character Mode expansion

When entering Character Mode, the active word is visually separated from its line context:

- The word renders at a **larger size** (e.g., 2×) in a **dedicated fixed panel at the bottom of the document pane**. The panel height is defined as a named constant (`CHAR_PANEL_HEIGHT`) so the Zen Focus vertical-centre calculation can account for the reserved space.
- Each character is displayed individually with clear spacing; diacritics above/below are rendered at full size and clearly visible.
- The main line text dims to zen-far treatment while the character panel is open.

---

## 17. Tech Stack

| Layer           | Technology                                                         |
| --------------- | ------------------------------------------------------------------ |
| Backend         | Python 3, Flask                                                    |
| Frontend        | Vanilla JavaScript (ES6+), HTML5                                   |
| Styling         | Tailwind CSS (CDN)                                                 |
| Typography      | Amiri (Google Fonts CDN)                                           |
| Persistence     | Local file system (direct writes to working copy + cursor sidecar) |
| Build toolchain | None                                                               |
| Dependencies    | `flask`, `regex` (grapheme segmentation), `pytest` (testing only)  |
| Browser         | Google Chrome 87+ (required). Firefox and Safari are not supported in v1. |

---

## 18. Out of Scope (v1)

- **Letter corrections:** Only harakat and orthographic combining marks (Groups A, B, C) may be changed. No letter substitution, deletion, or insertion.
- **Morphological validation:** Grammatical correctness of vowelling is not checked. The user is the authority.
- **Keymap editor UI:** The keymap is configurable via file but not exposed in the interface.
- **Cloud storage or sync:** Local only.
- **Multiple simultaneous open files:** One file open at a time.
- **Undo/redo:** Not in scope for v1. Replace mode and toggle-off serve as the correction path.
- **Multi-browser support:** Chrome 87+ is the only supported browser in v1. Firefox and Safari are out of scope.

---

## 19. Resolved Design Decisions

The following questions were open during spec drafting and have been resolved prior to development. They are recorded here for traceability.

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Undo/redo in v1? | **Deferred to v2.** Replace mode and toggle-off are the correction path in v1. | Scope control. |
| 2 | Character Mode expansion panel position? | **Fixed bottom panel.** | More stable across line heights; avoids z-index conflicts with the Zen Focus layer. Reflected in §16. |
| 3 | Tab jump to next undiacritized word in v1? | **Yes, in v1.** `Tab` in Word Mode is included. `editorState` is designed for it from Phase 2. | High ergonomic payoff; `Tab` is already claimed by `preventDefault()` in the key interception pattern. Reflected in §5.1. |
| 4 | Soft warning persistence? | **Ephemeral** — recomputed on render, not stored in the cursor sidecar. | Simplest correct behaviour; sidecar carries only cursor position and status. Reflected in §8.3. |
| 5 | Working copy conflict detection? | **Lightweight mtime guard.** `last_seen_mtime` stored in sidecar; mismatch triggers a non-blocking warning banner on session resume. | Sufficient protection without checksum overhead. Reflected in §2.5. |

---

_End of specification v1.2_
