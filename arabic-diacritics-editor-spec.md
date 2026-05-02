# Arabic Diacritics Editor — Product Specification

**Version:** 1.0 — Draft for Review  
**Status:** Pre-development client brief  
**Companion app:** Arabic Proofreading App (no integration; shared philosophy only)

---

## 1. Overview & Philosophy

A personal, single-user, locally-run web application for adding and correcting Arabic diacritics (tashkeel/harakat) in plain-text files.

The app inherits the core philosophy of the Arabic Proofreading App:

- **Non-destructive:** The original source file is never modified under any circumstances.
- **Keyboard-centric:** All editing and navigation is designed to be done entirely from the keyboard.
- **Zen Focus:** A teleprompter-style interface that locks the active line to the vertical centre of the screen, minimising visual noise.
- **Zero build toolchain:** Python (Flask) backend, Vanilla JS/HTML frontend. No npm, no database, no authentication.
- **Persistent progress:** Work is never lost. Every session resumes exactly where the last one ended.

The key difference from the proofreading app is that this tool **writes edits**. It does so only on a working copy, never on the original.

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
/project/diac_chapter_1.txt               ← working copy (edits live here)
/project/diac_chapter_1.txt.diac_cursor.json  ← cursor position only
```

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

---

## 3. File Scope

- Eligible file types: `.txt`, `.md`
- The `_diac_output/` directory is hidden from the file tree.
- Existing `diac_` working copies are hidden from the file tree (they are managed internally).
- Cursor sidecar files are hidden from the file tree.
- The directory scanner otherwise behaves identically to the proofreading app (recursive, sorted, folders shown only if they contain eligible files).

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

The document is navigated **word by word**, exactly as in the proofreading app.

| Key | Action |
|---|---|
| `←` Left Arrow | Move to **next word** (RTL direction) |
| `→` Right Arrow | Move to **previous word** |
| `↓` Down Arrow | Move to same word position on **next line** |
| `↑` Up Arrow | Move to same word position on **previous line** |
| `Enter` | **Enter Character Mode** for the current word |

The active word is highlighted. Lines use the same Zen Focus classes (`zen-active`, `zen-context`, `zen-far`) as the proofreading app.

### 5.2 Character Mode (Inner Tier)

Pressing `Enter` on a word zooms into it. The word expands visually and the cursor moves to its first character (rightmost, since Arabic is RTL).

| Key | Action |
|---|---|
| `←` Left Arrow | Move to **next character** (RTL) |
| `→` Right Arrow | Move to **previous character** |
| `Escape` | **Exit Character Mode**, return to Word Mode |
| Diacritic key | **Apply** diacritic to current character (see §7) |
| `Delete` / `Backspace` | **Remove** diacritic from current character |
| Same diacritic key again | **Toggle off** (remove) the diacritic if already present |

**Auto-exit at word boundary:** If the user presses `←` past the last character of the word (leftmost in RTL), the app automatically exits Character Mode and advances to the next word in Word Mode. If the user presses `→` past the first character (rightmost), the app exits and moves to the previous word. This makes continuous editing frictionless.

### 5.3 Visual State Distinction

The UI must make the current mode unambiguous at a glance:

- **Word Mode:** Active word has a subtle rectangular highlight (border or background).
- **Character Mode:** The expanded word is displayed prominently. The active character has a clearly distinct highlight (e.g., solid underline or filled background). Non-active characters in the word are slightly dimmed. A mode indicator in the status bar reads `CHARACTER MODE`.

---

## 6. Visual Hints for Undiacritized Letters

Since the input may be a mix of bare and diacritized text, the user needs to be able to locate undiacritized letters efficiently without navigating character by character through the entire document.

### 6.1 Letter-level colouring

In Word Mode, individual letters within the rendered words are coloured according to their diacritization state:

| State | Colour treatment |
|---|---|
| Has diacritic(s) | Normal text colour (no special marking) |
| No diacritic, but expected to have one | Subtle amber / warm highlight |
| Letter that canonically takes no diacritic (see §8.3) | No highlight (treated as "correct as-is") |

> **Note:** The "expected" determination is pragmatic, not morphological. Any consonant letter that has no diacritic and is not in the canonical no-diacritic list (§8.3) is considered a candidate.

### 6.2 Word-level undiacritized indicator

In Word Mode, words that contain one or more undiacritized candidate letters display a small dot or underline beneath them in the word list, so the user can jump to them efficiently.

### 6.3 Document-level count

The status bar shows a live count: **`Undiacritized: N letters`**, updated as the user works.

---

## 7. Diacritic Input

### 7.1 Primary input method — Raw Arabic keyboard

The user types diacritics using the standard Arabic keyboard layout. This matches how they would work in any word processor.

Standard Arabic keyboard diacritic positions (for reference in the spec):

| Key | Diacritic | Unicode |
|---|---|---|
| `Shift + Q` | Shadda (ّ) | U+0651 |
| `Shift + A` | Fatha (َ) | U+064E |
| `Shift + E` | Fathatan (ً) | U+064B |
| `Shift + R` | Dammatan (ٌ) | U+064C |
| `Shift + S` | Kasra (ِ) | U+0650 |
| `Shift + W` | Kasratan (ٍ) | U+064D |
| `Shift + X` | Sukun (ْ) | U+0652 |
| `Shift + F` | Damma (ُ) | U+064F |

### 7.2 Future keyboard customisation (architecture requirement)

The key mapping must be implemented as a **configurable map object**, not hardcoded. A `keymap.json` file (or equivalent config section) must define the mapping between keyboard events and Unicode codepoints. This enables future user-defined remapping without code changes.

Example structure:
```json
{
  "diacriticKeymap": {
    "ShiftQ": "U+0651",
    "ShiftA": "U+064E",
    "1":      "U+064E"
  }
}
```

The UI does not need to expose a keymap editor in v1. The file just needs to exist and be read at startup.

---

## 8. Business Logic — Diacritic Validation

This is the most critical correctness layer of the app. The validator runs every time a diacritic is applied or the current state of a character changes.

### 8.1 The Harakat Taxonomy

```
Group A — Base vowels (mutually exclusive, max ONE per letter):
  Fatha    (َ)  U+064E
  Kasra    (ِ)  U+0650
  Damma    (ُ)  U+064F
  Sukun    (ْ)  U+0652
  Fathatan (ً)  U+064B
  Kasratan (ٍ)  U+064D
  Dammatan (ٌ)  U+064C

Group B — Modifier (stackable with ONE Group A member, except Sukun):
  Shadda   (ّ)  U+0651
```

### 8.2 Hard Rules — Blocked immediately, edit not applied

These are absolute constraints enforced at the Unicode level. When violated, the input is rejected silently or with a brief flash animation on the character. The invalid diacritic is never written.

| Rule | Description |
|---|---|
| **One base vowel** | A letter may carry at most ONE diacritic from Group A. Attempting to add a second Group A diacritic when one already exists replaces it (see §9 — replace mode). |
| **No Sukun + Shadda** | Shadda and Sukun cannot coexist on the same letter. Attempting to add one when the other is already present is a hard block. |
| **Max two combining characters** | A letter may carry at most two Unicode combining marks total (one from Group A + Shadda). Three or more is a hard block. |
| **Shadda alone is valid** | Shadda without a Group A diacritic is permitted. |

### 8.3 Soft Rules — Amber warning, edit is allowed

These are contextual rules that produce a warning indicator but do not block the edit. The user may have a legitimate reason to override them.

| Rule | Description |
|---|---|
| **Tanwin on non-final character** | Fathatan, Kasratan, Dammatan should appear only on the last character of a word. Warn if applied to a non-final character. |
| **Alef (ا) as long vowel** | Bare alef in the middle of a word typically carries no diacritic in its role as a long vowel. Warn when any diacritic is applied. |
| **Alef in ال (definite article)** | The alef of the definite article carries hamzat al-wasl and conventionally no harakat in most texts. Warn when diacritics are attempted. |
| **Alef maqsura (ى) at word end** | Can take Fathatan only. Warn on any other diacritic. |
| **ال + tanwin coexistence** | A word beginning with ال should not carry tanwin (semantic contradiction: definite + indefinite). Warn at the word level. |

**Soft warning display:** The character receives a subtle amber underline. In Character Mode, a tooltip-style label appears beneath the character explaining the issue in plain language (e.g., `"Tanwin usually appears at the last letter of a word"`).

### 8.4 Letters That Are Canonically Diacritic-free (no amber highlight)

These letters in specific positions are excluded from the "undiacritized candidate" colouring in §6.1:

| Letter | Context | Reason |
|---|---|---|
| Alef (ا) | As a long vowel (mid/end of word) | Long vowel carrier, not a consonant |
| Waw (و) | Following a damma (long vowel role) | Long vowel carrier |
| Ya (ي) | Following a kasra (long vowel role) | Long vowel carrier |
| Alef maqsura (ى) | Word-final position | Typically takes only fathatan |

> **Pragmatic note:** Distinguishing consonantal waw/ya from long-vowel waw/ya requires morphological analysis, which is out of scope. The app applies the no-highlight rule only in unambiguous positional cases (e.g., ا is almost always a long vowel mid-word). Ambiguous cases default to showing the amber highlight.

---

## 9. Diacritic Application Behaviour

### 9.1 Replace mode

When the cursor is on a character that already has a Group A diacritic and the user types a **different** Group A diacritic:

- The existing diacritic is **instantly replaced** by the new one.
- Shadda, if present, is preserved.
- No confirmation is required.

### 9.2 Toggle / clear

- Pressing the **same diacritic key** when that diacritic is already on the character **removes it** (toggle off).
- `Delete` or `Backspace` removes **all diacritics** from the current character in one keystroke.

### 9.3 Shadda stacking

- Shadda can be added to a character that already has a Group A diacritic (and vice versa).
- Exception: Shadda + Sukun is always a hard block (§8.2).

### 9.4 No auto-advance

After placing a diacritic, the cursor **stays on the current character**. The user moves manually with arrow keys. This prevents skipping over characters unintentionally and keeps the user in full control.

---

## 10. Save & Persistence

| Event | Save action |
|---|---|
| Diacritic applied or removed | Write change immediately to the working copy (`diac_` file) |
| Cursor moved | Debounced write of cursor position to `.diac_cursor.json` (500ms) |
| File switched | Flush cursor sidecar immediately before switching |
| App close / page unload | Flush cursor sidecar immediately |

There is no manual "Save" button. There is no concept of an unsaved state.

---

## 11. Status System

Each file in the sidebar displays one of three statuses, identical to the proofreading app:

| Status | Icon | Meaning |
|---|---|---|
| `untouched` | ○ | No working copy exists yet |
| `in_progress` | ● | Working copy exists, not marked complete |
| `complete` | ✓ | Marked complete; output written to `_diac_output/` |

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

| Key | Action |
|---|---|
| `←` | Next word (RTL) |
| `→` | Previous word |
| `↓` | Same word position, next line |
| `↑` | Same word position, previous line |
| `Enter` | Enter Character Mode |

### Character Mode

| Key | Action |
|---|---|
| `←` | Next character (RTL); auto-exits at word boundary |
| `→` | Previous character; auto-exits at word boundary |
| `Escape` | Exit to Word Mode |
| Diacritic key | Apply / replace diacritic |
| Same diacritic key | Toggle off (remove) diacritic |
| `Delete` / `Backspace` | Clear all diacritics from character |

### Critical actions (mouse-only, intentional)

| Action | Reason |
|---|---|
| Mark Complete | Prevent accidental completion |
| Reset Document | Prevent accidental data loss |
| Open Folder | Infrequent; no keyboard shortcut needed |

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

Inherits directly from the proofreading app:

- **Font:** [Amiri](https://fonts.google.com/specimen/Amiri) for all Arabic text — designed for classical Arabic and renders diacritics correctly and beautifully.
- **Font size:** Larger than the proofreading app — diacritics must be clearly legible above and below letters. Minimum `24px` for body text recommended; `32px`+ preferred.
- **Direction:** RTL throughout the document pane.
- **Zen Focus:** Active line locked to vertical centre using the same `translateY` teleprompter technique.
- **Zen classes:** `zen-active` (full opacity, large), `zen-context` (medium opacity, adjacent lines), `zen-far` (low opacity).

### Character Mode expansion

When entering Character Mode, the active word is visually separated from its line context:

- The word renders at a **larger size** (e.g., 2×) in a dedicated area above or below the main line, showing each character individually with clear spacing.
- Diacritics above/below each character are rendered at full size and clearly visible.
- The main line text dims (zen-far treatment).

---

## 17. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask |
| Frontend | Vanilla JavaScript (ES6+), HTML5 |
| Styling | Tailwind CSS (CDN) |
| Typography | Amiri (Google Fonts CDN) |
| Persistence | Local file system (direct writes to working copy + cursor sidecar) |
| Build toolchain | None |
| Dependencies | `flask`, `pytest` (testing only) |

---

## 18. Out of Scope (v1)

- **Letter corrections:** Only harakat may be changed. No letter substitution, deletion, or insertion.
- **Morphological validation:** Grammatical correctness of vowelling is not checked. The user is the authority.
- **Integration with the proofreading app:** No shared data, no linked workflows.
- **Keymap editor UI:** The keymap is configurable via file but not exposed in the interface.
- **Cloud storage or sync:** Local only.
- **Multiple simultaneous open files:** One file open at a time.
- **Undo/redo:** Not in scope for v1. (Replace mode and toggle-off serve as the correction path.)

---

## 19. Open Questions for Next Review

The following items were flagged during spec drafting and require a decision before development begins:

1. **Undo/redo:** Replace mode handles simple mistakes, but a deeper error (e.g., wrong diacritic applied and not noticed until 10 characters later) has no recovery path in v1. Should a single-level undo (`Ctrl+Z`) be added?

2. **Character Mode expansion area position:** Should the expanded word render *above* the active line (like a tooltip), or should it occupy a dedicated **fixed panel** at the top or bottom of the doc pane? The fixed panel approach is more stable across line heights.

3. **Jump-to-next-undiacritized shortcut:** A `Tab` key shortcut in Word Mode that jumps to the next word containing undiacritized letters would significantly accelerate work on sparse files. Should this be in v1?

4. **Soft warning persistence:** Should soft warnings (§8.3) be stored in the cursor sidecar and re-displayed on session resume, or are they ephemeral (recomputed on render)?

5. **Working copy conflict:** If the user edits the `diac_` file externally between sessions, the app has no mismatch detection equivalent to the proofreading app's line-count check. Should a checksum or timestamp guard be added?

---

*End of specification v1.0*
