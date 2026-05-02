# Arabic Diacritics Editor: Implementation Plan

**Plan version:** 1.1
**Based on spec:** v1.2
**Last updated:** Session 1 — pre-development review

---

## Executive Summary

- **Current State**: Blank project — nothing exists yet
- **Goal**: A locally-run, keyboard-centric Flask + Vanilla JS editor for adding/correcting Arabic diacritics (tashkeel) in plain-text files, with a Zen Focus teleprompter interface and non-destructive file contract
- **Key Architectural Decision**: The working copy (`diac_` prefix) IS the persistent state — no database, no undo stack, no save button. Every diacritic keystroke writes through immediately to the working copy
- **Estimated Time**: 12–20 days across 5 phases (contingent on OQ2 and OQ3 being resolved — they now are)

---

## Locked Decisions (resolved in Session 1 pre-development review)

These were open questions in the spec (§19) or ambiguities in plan v1.0. They are now locked and must not be re-opened without a deliberate version bump.

| # | Decision | Resolution | Rationale |
|---|----------|------------|-----------|
| OQ2 | Character Mode expansion panel position | **Fixed bottom panel** | Stable across line heights; avoids z-index conflicts with Zen Focus layer |
| OQ3 | Tab jump to next undiacritized word | **In v1** — `editorState` must be designed for it from Phase 2 | High ergonomic payoff; Tab is already claimed by `preventDefault()` in the key interception pattern |
| OQ4 | Soft warning persistence | **Ephemeral** — recomputed on render, not stored in sidecar | Simplest correct behaviour; sidecar carries only cursor position and status |
| OQ1 | Undo/redo | **Deferred to v2** — replace mode + toggle-off are the correction path in v1 | Scope control |
| Write strategy | Per-keystroke vs batched diacritic writes | **Per-keystroke** — every diacritic key fires `POST /api/write_char` immediately | Crash-safe at the character level; consistent with spec §10; cursor sidecar saves separately at 500ms debounce |
| Browser target | `Intl.Segmenter` polyfill | **Chrome only, no polyfill** — this is a personal local app | Chrome 87+ has native `Intl.Segmenter`; polyfill complexity is not justified |
| OQ5 | Working copy conflict detection | **Lightweight mtime guard in Phase 5** — store `last_seen_mtime` in cursor sidecar; warn on mismatch | Non-blocking warning banner is sufficient |

---

## Assumptions to Validate Before Starting

1. `Intl.Segmenter` is available in Chrome (Chrome 87+) — **validate in console before Phase 1** (one line: `new Intl.Segmenter()`)
2. Python `regex` module segments `\X` correctly for harakat combining ranges — **validate in Phase 1**
3. Flask `send_file` / streaming is sufficient for large `.txt` files (no pagination needed for v1)
4. OS Arabic keyboard layout fires `event.key` with the diacritic character directly (confirmed by spec §7.2), not through an IME buffer — **smoke-test in Phase 2**

---

## Pre-Coding Checklist (complete before any code is written)

- [ ] **Resolve OQ2** → Fixed bottom panel ✅ locked
- [ ] **Resolve OQ3** → Yes, Tab in v1 ✅ locked
- [ ] **Collect test corpus**: 3–5 real Arabic `.txt` files covering:
  - Fully bare (undiacritized) text
  - Partially diacritized text
  - Text with non-canonical combining mark ordering (critical for Phase 1 byte-preservation test)
  - Text with Group C marks (hamza-bearing alefs, waw, ya)
- [ ] **Validate `Intl.Segmenter`** in your Chrome console: `new Intl.Segmenter('ar', { granularity: 'grapheme' })`
- [ ] **Validate Python environment**: Python 3.10+, `pip install flask regex pytest`

> ⚠️ The test corpus must exist before Phase 1 Task 1.4. It is a hard dependency for grapheme segmentation tests, not a parallel nice-to-have.

---

## Phase 1: Foundation — Flask Scaffold + Non-Destructive File Contract (2–4 days)

### Goal
**Prove the write-and-read-back file contract in isolation before touching any UI.**

### Task Ordering Note
**Tasks must be executed in the order listed below.** Task 1.4 (the diacritic write engine) is the highest-risk technical assumption in the entire project and must be proven first. Tasks 1.1–1.3 build the surrounding scaffold only after the core is validated.

### Tasks

**1.4: Diacritic Write Endpoint — DO THIS FIRST** (3–5 hours)
- Implement `write_character()` and `canonical_cluster()` in isolation, with no Flask server yet
- Reads a file line, segments into grapheme clusters using `regex` `\X`, replaces the target cluster, serialises back with canonical combining-mark order: Group C first, then Group B (Shadda), then Group A vowel
- **Critical invariant**: unedited grapheme clusters on the same line must be written back byte-for-byte as read. The implementation must re-serialise only the mutated cluster and concatenate the surrounding clusters verbatim — never re-join all clusters after segmentation, as this would silently re-canonicalise untouched clusters and break the non-destructive contract
- **No global normalisation applied anywhere in this path**
- Validate with `xxd` / `hexdump` against the test corpus

```python
def write_character(working_copy: Path, line_idx: int,
                    word_idx: int, char_idx: int, new_cluster: str) -> None:
    """Mutate single grapheme cluster in working copy.
    Serialise only the mutated cluster in canonical order: Group C → Group B → Group A.
    All other clusters on the line are written back verbatim (byte-for-byte)."""
    pass

def canonical_cluster(base: str, marks: set[str]) -> str:
    """Rebuild grapheme cluster from base + mark set in canonical order."""
    pass
```

**Required test before proceeding to 1.1:**
- A line containing two clusters: one with non-canonical mark ordering (e.g., Fatha before Shadda), one that will be edited. After editing the second cluster, the first cluster's bytes must be identical to the original. Verify with `xxd`.

**1.1: Project Skeleton** (2–4 hours)
- Create directory structure: `app.py`, `static/`, `templates/index.html`, `keymap.json`
- Install deps: `flask`, `regex` (no pip freeze until end of phase)
- Start Flask with debug mode; confirm `127.0.0.1:5000` serves the index page
- Load `keymap.json` at startup; expose it to the frontend via a `/api/config` endpoint

**1.2: File Tree Scanner** (3–5 hours)
- Recursive directory walk from a configurable `ROOT_DIR`
- Include only `.txt` and `.md` files
- Exclude from results: files prefixed `diac_`, cursor sidecar files (`.diac_cursor.json`), and anything inside `_diac_output/`
- Return sorted list with file status per file: `untouched` / `in_progress` / `complete`
- Status derived from filesystem: no working copy → `untouched`; `diac_` file exists → `in_progress`; cursor sidecar has `"status": "complete"` → `complete`
- **Word tokenization rule**: lines are split into word tokens on `\s+`. Punctuation characters (Arabic comma `،`, Arabic full stop `۔`, Western punctuation) that are attached to words must be split into their own non-navigable display spans at render time (Phase 2). The file scanner does not need to handle this — document it here so Phase 2 implements it correctly

```python
def scan_directory(root: Path) -> list[dict]:
    """Return sorted list of eligible files with their status."""
    pass

def get_file_status(original_path: Path) -> str:
    """Return 'untouched' | 'in_progress' | 'complete'."""
    pass
```

**1.3: Working Copy Contract** (3–5 hours)
- `POST /api/open` — receives `file_path`; creates `diac_` copy if absent; returns working copy content as lines array + cursor position; also stores `last_seen_mtime` of the working copy in the cursor sidecar on every open (for OQ5 conflict detection in Phase 5)
- Working copy creation: byte-for-byte copy via `shutil.copy2`; decode without normalisation
- Cursor sidecar: read `{"line": N, "word": N, "char": null, "status": "in_progress", "last_seen_mtime": N}` if it exists; return defaults if not
- **Key Decision**: File read always goes through the `diac_` copy once created; the original is never read again after that moment

```python
def open_file(original_path: Path) -> dict:
    """Ensure working copy exists, read it, load cursor sidecar.
    Returns: {lines: [...], cursor: {...}, status: str}"""
    pass

def ensure_working_copy(original_path: Path) -> Path:
    """Create diac_ copy if absent. Return working copy path."""
    pass
```

**1.4 (as Flask endpoint): Diacritic Write Endpoint** (1–2 hours, logic already proven above)
- Wire the validated `write_character()` into `POST /api/write_char` — receives `{file_path, line_idx, word_idx, char_idx, new_cluster}`
- Returns `{ok: true}` on success
- **Frontend contract**: if this endpoint returns non-200 or a network error, the frontend must surface a blocking error banner and halt all further input until the user acknowledges. A failed write that goes unnoticed causes the UI and working copy to diverge silently — this is the worst failure mode in the app

**1.5: Cursor Save + Status Transitions** (2–3 hours)
- `POST /api/save_cursor` — debounced from frontend (500ms), writes cursor sidecar; updates `last_seen_mtime`
- `POST /api/mark_complete` — flushes cursor, copies working copy to `_diac_output/<original_filename>`, updates sidecar `status`; returns error if output dir unwritable
- `POST /api/reset` — deletes `diac_` working copy and cursor sidecar; returns `{status: "untouched"}`

### Success Criteria
- ✅ `write_character()` + `canonical_cluster()` proven in isolation before Flask scaffold begins
- ✅ A line with a non-canonical untouched cluster is preserved byte-for-byte after editing a different cluster on the same line (verified with `xxd`)
- ✅ Applying Shadda + Fatha to a cluster: reads back as `U+0651 U+064E` (Group B then Group A) — correct canonical order
- ✅ File tree returns correct files with correct statuses (verified via `/api/files` in browser)
- ✅ Opening a file creates exactly one `diac_` copy; re-opening does not create a second
- ✅ Mark Complete copies file to `_diac_output/`; Reset deletes working copy cleanly
- ✅ `Intl.Segmenter` available in Chrome console (one-line check)

### Deliverables
- [ ] `app.py` with all 5 API routes
- [ ] `static/api.js` — thin JS wrapper for all API calls, including the blocking error banner on non-200 responses
- [ ] `pytest` test file with ≥12 tests covering: working copy creation, grapheme segmentation, canonical ordering, byte-preservation of untouched clusters, status transitions, output write
- [ ] `requirements.txt` pinned

### Rollback Plan
**If** `regex \X` does not segment harakat clusters correctly → evaluate `uniseg` library as drop-in replacement; no frontend changes required

---

## Phase 2: Document Rendering + Word Mode Navigation + Zen Focus (3–5 days)

### Goal
**Deliver a navigable, readable document pane where the user can move through words and lines using only arrow keys. Design `editorState` to support Tab jump from the start.**

### Tasks

**2.1: Document Renderer** (4–6 hours)
- On file open, render each line as a `<div class="line">` containing `<span class="word">` elements
- **Word tokenization**: split lines on `\s+`. Punctuation tokens (Arabic comma `،`, Arabic full stop `۔`, Western punctuation attached to words) are rendered as non-navigable `<span class="punct">` elements — they display correctly but the word cursor skips over them
- Each word span: tokenize into grapheme clusters using `Intl.Segmenter({ granularity: 'grapheme' })` and store the cluster array in the JS data structure keyed by line/word index
- RTL: `dir="rtl"` on the document pane; Amiri font at ≥28px; all text flows right-to-left
- Words are non-contenteditable spans — no browser text editing, all input is keyboard-intercepted

```javascript
function renderDocument(lines) {
    /** Tokenize each line into words (and punctuation spans).
     *  Populate #doc-pane with line/word/punct spans.
     *  Store cluster arrays in docState.lines[i].words[j].clusters[]
     *  Store undiacritized candidate count per word in docState.lines[i].words[j].undiacCount
     *  (undiacCount supports Tab jump and status bar; initialise to 0, populate in Phase 4) */
}

function segmentWord(word) {
    /** Use Intl.Segmenter to return array of grapheme cluster strings. */
}
```

**2.2: `editorState` Object — Central Source of Truth** (2–3 hours)

Design `editorState` now to accommodate all features through Phase 5. Do not add fields ad hoc in later phases.

```javascript
const editorState = {
    // File
    filePath: null,
    status: 'untouched',           // 'untouched' | 'in_progress' | 'complete'

    // Mode
    mode: 'word',                  // 'word' | 'character'

    // Word Mode cursor
    lineIdx: 0,
    wordIdx: 0,

    // Character Mode cursor
    charIdx: 0,                    // index into clusters[] array — NEVER a raw string index

    // Document data (populated by renderDocument)
    lines: [],
    // lines[i] = {
    //   words: [
    //     {
    //       clusters: [],          // array of grapheme cluster strings
    //       undiacCount: 0,        // count of undiacritized candidate letters (Phase 4)
    //       hasSoftWarning: false, // any soft rule triggered in this word (Phase 4)
    //     }
    //   ]
    // }

    // Document-level counts
    totalUndiacCount: 0,           // sum of all word undiacCounts (Tab jump + status bar)

    // UI state
    lastSaveTime: null,
};
```

**2.3: Zen Focus Teleprompter** (3–5 hours)
- The document pane has `overflow: hidden`; a single inner container scrolls via `transform: translateY()`
- Active line always lands at 50% viewport height: `translateY = -(activeLine.offsetTop - viewportHeight/2)`
- Apply CSS classes: `zen-active` (100% opacity), `zen-context` (±1–2 lines, ~55% opacity), `zen-far` (further lines, ~20% opacity)
- Smooth transition via `transition: transform 300ms ease`
- Arrow up/down updates active line and re-runs the translateY calculation
- **Bottom panel reservation**: the fixed character panel (Phase 3) occupies the bottom of the viewport. The Zen Focus vertical-centre calculation must account for this reserved height so the active line never sits behind the panel. Calculate `viewportHeight` as `window.innerHeight - CHAR_PANEL_HEIGHT` where `CHAR_PANEL_HEIGHT` is a named constant set in Phase 3

**2.4: Word Mode Keyboard Navigation** (4–6 hours)
- Global `keydown` handler (spec §7.2 interception pattern) — `preventDefault()` on all consumed keys
- Word Mode state: `{lineIdx, wordIdx}` in `editorState`
- `←` → advance to next word in RTL reading order (next word toward start of line in DOM terms), skipping punct spans, wrapping to previous line
- `→` → previous word, skipping punct spans, wrapping to next line
- `↑` / `↓` → same `wordIdx` on adjacent line; clamp if line is shorter
- `Enter` → switch to Character Mode (Phase 3)
- `Tab` → jump to next word with `undiacCount > 0`; scan forward from current position through all lines; wrap at end of document back to beginning; if no undiacritized words exist, no-op (Tab jump is fully implemented in Phase 4 once `undiacCount` is populated, but the key handler and routing must be wired here)
- Active word gets class `word-active`; update status bar

**2.5: Status Bar (Word Mode fields)** (2–3 hours)
- Live display: `[WORD MODE]  [Line N / Total]  [Word N / Total on line]  [Undiacritized: N]`
- `Undiacritized: N` reads from `editorState.totalUndiacCount` (0 until Phase 4 populates it — display as `Undiacritized: –` until then)
- `Auto-saved ✓` flash: appears on successful cursor save API call, fades after 2s via CSS opacity transition

### Success Criteria
- ✅ Opening a 200-line Arabic file renders without visible layout shift or horizontal scroll
- ✅ Active line stays visually centred through ≥50 consecutive `↓` keypresses
- ✅ `←` on word 1 of line 5 moves to last word of line 4 (verified manually)
- ✅ `↑` on a line shorter than the current `wordIdx` clamps correctly without JS error
- ✅ `Intl.Segmenter` cluster arrays for the word `يَكْتُبُ` produce 5 clusters, not 8 code points
- ✅ Punctuation spans are visible but the word cursor skips over them cleanly
- ✅ `editorState` contains all fields listed above; `charIdx` is never set to a raw string index anywhere in the codebase

### Deliverables
- [ ] `static/renderer.js` — document rendering + Zen Focus
- [ ] `static/navigation.js` — Word Mode state machine + keyboard handler (including Tab routing stub)
- [ ] `static/editor-state.js` — central `editorState` object with full schema
- [ ] Manual test with a real Arabic `.txt` file (≥50 lines)

### Rollback Plan
**If** Zen Focus `translateY` jitters on long files → fall back to `scrollIntoView({ block: 'center', behavior: 'smooth' })` as a temporary measure; re-address in Phase 5

---

## Phase 3: Character Mode + Diacritic Editing (3–5 days)

### Goal
**Deliver the complete edit loop: enter a word, navigate its characters, apply/replace/toggle diacritics, and watch them persist immediately to disk.**

### Tasks

**3.1: Character Mode Entry + Expanded Panel** (4–6 hours)
- `Enter` in Word Mode: open the fixed character panel at the **bottom of the viewport** (this is locked — see Locked Decisions)
- Panel height: define `CHAR_PANEL_HEIGHT` as a CSS custom property and a JS constant. Phase 2's Zen Focus uses this constant — set it here and backfill into Phase 2's translateY calculation
- Panel renders the active word's grapheme clusters as large individual character tiles (≥48px, Amiri)
- Each tile shows base letter + all combining marks rendered visibly above/below
- Active character tile: solid highlight (filled background, high contrast)
- Non-active tiles in panel: slightly dimmed (70% opacity)
- Main document line dims to `zen-far` treatment while panel is open
- Mode indicator in status bar switches to `CHARACTER MODE`

**3.2: Character Mode Navigation** (3–4 hours)
- `←` → advance to next character (RTL, toward word start); at boundary → auto-exit to Word Mode and advance to next word
- `→` → previous character; at boundary → auto-exit and move to previous word
- `Escape` → exit to Word Mode, keep word position
- `editorState.charIdx` tracks position within `clusters[]` array — never a raw string index

**3.3: Diacritic Application Engine** (5–8 hours)
- Intercept `event.key` for diacritic range `/^[\u064B-\u0655\u0670]$/`
- Classify incoming diacritic into Group A / B / C (hardcoded set membership, not computed)
- **Hard rules enforcement (spec §8.2)** — all checks run before any mutation:
  - Group A: if different Group A already present → Replace mode (§9.1), not a block
  - Sukun + Shadda → hard block (silent rejection + brief flash animation on tile)
  - Max 3 combining marks total → hard block
  - Group C only on alef/waw/ya carriers → hard block
- **Replace mode**: strip existing Group A mark, insert new Group A mark, preserve Shadda and Group C
- **Toggle-off**: if incoming code point already present in cluster's mark set → remove it
- **Delete/Backspace**: remove all combining marks from current cluster
- After mutation: rebuild cluster in canonical order, call `POST /api/write_char` immediately
- **On API write failure**: surface blocking error banner, halt all input (see Phase 1 Task 1.4 frontend contract)
- After successful write: re-classify the affected word's `undiacCount` and update `editorState.totalUndiacCount` (increment/decrement only — do not re-scan full document)

```javascript
function applyDiacritic(cluster, incomingCodePoint) {
    /** Returns new cluster string or null if hard-blocked.
     *  Handles replace, toggle-off, stacking per spec §9. */
}

function hardRulesCheck(cluster, incomingCodePoint) {
    /** Returns {allowed: bool, reason: string}.
     *  Never reads the DOM; operates only on the cluster string. */
}
```

**3.4: Status Bar (Character Mode fields)** (1–2 hours)
- Add `[Char N / Total in word]` — only visible in Character Mode
- Char count uses `clusters.length`, not `word.length`

### Success Criteria
- ✅ Applying Fatha to a bare letter writes the correct byte to the working copy (verify with `xxd`)
- ✅ Applying Fatha to a letter that already has Kasra replaces it — Kasra gone, Fatha present
- ✅ Applying Shadda to a letter with Sukun is silently blocked; tile flashes; no write to disk
- ✅ Pressing the same diacritic key twice: first apply adds it, second removes it
- ✅ Delete/Backspace on a cluster with 3 combining marks removes all 3; base letter remains
- ✅ `←` past the last character of a word auto-exits to Word Mode and advances one word (no extra keypress)
- ✅ `charIdx` never references a raw string index — confirmed by code review
- ✅ Simulated API failure (kill Flask mid-session): blocking error banner appears; no further input is processed

### Deliverables
- [ ] `static/character-mode.js` — panel rendering + navigation
- [ ] `static/diacritic-engine.js` — hard rules + apply/replace/toggle/clear logic
- [ ] End-to-end test: open file → navigate to word → enter character mode → apply Shadda + Fatha → verify file bytes with `xxd`

### Rollback Plan
**If** immediate write-per-keystroke causes perceptible lag on large files → batch writes: accumulate mutations in-memory, flush to API on `Escape` (exit char mode). This is an acceptable tradeoff that still preserves all work at word-exit boundaries.

---

## Phase 4: Visual Hints + Soft Validation Rules + Tab Jump (2–4 days)

### Goal
**Make undiacritized letters immediately visible, add the linguistic warning layer, and activate Tab jump.**

### Tasks

**4.1: Letter-Level Colouring (Undiacritized Candidates)** (4–6 hours)
- In Word Mode, each rendered letter span is classified on render:
  - Has ≥1 diacritic → normal colour
  - No diacritic, not in canonical-exempt list (spec §8.4) → amber highlight class
  - In canonical-exempt list → no highlight
- Canonical-exempt logic (spec §8.4): alef in mid/end position, waw if preceding letter has damma, ya if preceding letter has kasra, alef maqsura in final position
- **Pragmatic rule**: if preceding letter is undiacritized, waw/ya default to amber (cannot evaluate context)
- **Re-classification scope**: after each diacritic write, re-classify all characters in the **entire affected word** (not just the edited character) — waw/ya exemption requires look-behind within the word. Update `word.undiacCount` and `editorState.totalUndiacCount` accordingly

**4.2: Word-Level Undiacritized Dot Indicator** (1–2 hours)
- A word with `undiacCount > 0` gets a small dot rendered beneath it (CSS `::after` pseudo-element)
- Dot removed when `undiacCount` reaches 0

**4.3: Live Undiacritized Count + Tab Jump Activation** (2–3 hours)
- On file open: classify all words, populate `word.undiacCount` for every word, sum into `editorState.totalUndiacCount`
- Status bar `Undiacritized: N` now shows a real count
- **Tab jump is now fully active**: the key handler stub from Phase 2 now has real `undiacCount` data to scan. Verify Tab correctly skips to the next word with `undiacCount > 0`, wrapping at end of document. If no undiacritized words exist, Tab is a no-op

**4.4: Soft Rules — Amber Underline + Tooltip** (4–6 hours)
- Soft rule checks run in Character Mode when a diacritic is applied (spec §8.3):
  - Tanwin on non-final character
  - Group A diacritic on alef long-vowel in mid-position
  - Group A diacritic on alef of ال
  - Any diacritic on word-final alef maqsura
  - ال + tanwin coexistence (word-level check)
- Soft rule fires: character tile gets amber underline; tooltip label appears beneath tile in plain language
- Edit is **not blocked** — diacritic is still applied
- Soft warnings are **ephemeral** (locked decision OQ4): recomputed on render, not stored in sidecar

**4.5: Keymap.json Custom Bindings** (1–2 hours)
- On startup, `/api/config` returns `customKeymap` object
- In the keydown handler: after checking `event.key` for diacritics, also check `event.code` against `customKeymap`; if a match, treat mapped codepoint as the diacritic

### Success Criteria
- ✅ A freshly opened undiacritized file shows every eligible letter in amber
- ✅ Applying a diacritic to a letter turns it from amber to normal colour immediately
- ✅ Undiacritized count in status bar matches a manual count of amber letters in a 10-word test passage (±0)
- ✅ Applying Fathatan to the 2nd character of a 4-character word triggers the soft warning tooltip; edit is not blocked
- ✅ Mid-word alef shows no amber highlight when the preceding letter already has a damma
- ✅ Tab in Word Mode jumps to the next amber word; wraps at end of document
- ✅ Tab is a no-op when `totalUndiacCount === 0`
- ✅ Numpad1 → Fatha mapping from `keymap.json` applies correctly in character mode

### Deliverables
- [ ] `static/visual-hints.js` — letter classification + undiacritized count + Tab jump
- [ ] `static/soft-rules.js` — soft validation checks + tooltip rendering
- [ ] CSS: `amber-candidate`, `word-has-undiac`, `soft-warning-underline`, `char-soft-tooltip`
- [ ] Test file with ≥3 soft rule cases for manual verification

### Rollback Plan
**If** per-letter classification causes render slowness on files >1,000 lines → classify only the visible ±10 lines around the active line; queue background classification for the rest

---

## Phase 5: Status System + Completion Workflow + Polish (2–3 days)

### Goal
**Deliver a production-ready app: complete/reset workflow, sidebar status icons, mtime conflict guard, and final polish.**

### Tasks

**5.1: Sidebar Status Icons** (2–3 hours)
- File tree entries render: `○` untouched, `●` in-progress, `✓` complete
- Status updated in sidebar immediately on transitions (no full-page reload)

**5.2: Mark Complete Flow** (3–4 hours)
- **Mark Complete** button: mouse-only; confirmation modal
- On confirm: flush cursor sidecar → copy working copy to `_diac_output/` → update sidecar `status: complete` → sidebar icon → `✓`
- Document pane enters read-only mode: keyboard navigation still works, diacritic keys are no-ops
- Banner: `"Complete — output saved to _diac_output/"` (dismissable)
- Error path: if output write fails → blocking error modal; status reverts; no partial state left

**5.3: Reset Flow** (1–2 hours)
- **Reset** button: mouse-only; confirmation modal with explicit warning
- On confirm: delete `diac_` working copy + cursor sidecar → sidebar status → `○`
- Document pane closes; user returned to file selection
- `_diac_output/` is untouched

**5.4: OQ5 — Working Copy Conflict Detection** (2–3 hours)
- On `/api/open`: compare `diac_` file's current mtime against `last_seen_mtime` stored in cursor sidecar
- If mtime differs: show a non-blocking warning banner: `"Working copy was modified externally — edits may conflict"`
- Update `last_seen_mtime` in cursor sidecar on every `/api/save_cursor` call

**5.5: Final Polish** (2–4 hours)
- `beforeunload` event: flush cursor sidecar synchronously
- File-switch: flush cursor sidecar of current file before opening new
- Keyboard shortcut reference panel (collapsible `?` overlay)
- `README.md`: install, launch, keyboard reference, file structure, browser requirement (Chrome 87+)

### Success Criteria
- ✅ Mark Complete → verify `_diac_output/chapter_1.txt` exists with correct content
- ✅ Reset → working copy and sidecar deleted; re-opening creates a fresh copy
- ✅ Tab in Word Mode skips to next amber word; wraps at end of document (re-verified end-to-end)
- ✅ Closing and reopening the browser tab resumes exact cursor position (line, word)
- ✅ Externally modifying `diac_` file between sessions triggers the mtime warning banner
- ✅ App functions correctly across a full editing session of ≥30 minutes without page refresh

### Deliverables
- [ ] `static/completion.js` — mark complete / reset modals + state
- [ ] Updated `app.py` with mtime guard in `/api/open`
- [ ] `README.md`

---

## Decision Tree & Stop Conditions

```
START
  ↓
PRE-CODING CHECKLIST
  ├─ All items checked → PHASE 1
  └─ Test corpus not collected → STOP, collect corpus first

PHASE 1: API + File Contract
  ├─ Task 1.4 byte-preservation test passes → continue Phase 1
  ├─ regex \X segmentation fails → try uniseg → retest → continue
  ├─ Task 1.4 produces incorrect bytes after 2 debugging sessions → STOP (file contract is the product)
  └─ All Phase 1 success criteria pass → PHASE 2

PHASE 2: Rendering + Word Navigation
  ├─ Zen Focus stable, navigation correct → PHASE 3
  └─ translateY jitter unresolved → scrollIntoView fallback → PHASE 3

PHASE 3: Diacritic Editing (CRITICAL PATH)
  ├─ Hard rules pass, write-through confirmed → PHASE 4
  ├─ Write lag >200ms on large files → batch writes on Escape → PHASE 4
  └─ Canonical combining order produces incorrect bytes → revisit serializer → retest

PHASE 4: Visual Hints + Soft Rules + Tab Jump
  ├─ Amber colouring accurate, Tab jump working, count correct → PHASE 5
  └─ Render perf issue → lazy classification → PHASE 5

PHASE 5: Polish + Completion
  └─ All success criteria pass → SHIP v1
```

### Explicit Stop Conditions
**STOP if:**
- Phase 1 Task 1.4 produces incorrect bytes after 2 debugging sessions (the file contract is the product — everything else is moot)
- Any phase exceeds 2× its estimated time without clear cause (reassess scope)

---

## Risk Mitigation Summary

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Grapheme segmentation edge cases in rare Arabic ligatures | Medium | High | Test Phase 1 with a corpus that includes ta marbuta, alef wasla, lam-alef ligatures |
| Byte-preservation failure: untouched clusters on an edited line are silently re-canonicalised | Medium | Critical | Phase 1 has an explicit test for this before any other task proceeds |
| `event.key` produces unexpected values on Windows Arabic 101 layout | Medium | Medium | This is a personal local app on macOS/Chrome; low risk, smoke-test if ever used on Windows |
| Zen Focus translateY fights browser scroll behaviour | Low | Medium | `overflow: hidden` + `preventDefault` on arrow keys fully owns scroll |
| Canonical combining-mark order diverges on mixed-NFC source files | Medium | High | Phase 1 tests must include a source file with non-canonical mark ordering |
| File write latency on large files slows keystroke feel | Low | Medium | Phase 3 fallback: batch writes on exit from Character Mode |
| Waw/ya amber re-classification misses cross-character context | Medium | Medium | Re-classify full word (not just edited character) on every write |
| API write failure goes unnoticed, UI and file diverge | Low | Critical | Blocking error banner on any non-200 from `/api/write_char` |

---

## Success Metrics

### Minimum Viable Success (end of Phase 4)
- ✅ Can open a real Arabic manuscript file and diacritize it start to finish
- ✅ Original file is byte-for-byte unchanged after a full session
- ✅ Working copy survives browser crash and resumes correctly

### Full v1 Success (end of Phase 5)
- ✅ Tab jump to next undiacritized word working end-to-end
- ✅ Mark Complete and Reset flows working without partial state
- ✅ mtime conflict detection working across sessions

### Deferred to v2
- Single-level undo via `Ctrl+Z` (OQ1)
- Progress percentage indicator in sidebar
- Multi-browser support

---

## Scope Boundaries

### In Scope
- ✅ `.txt` and `.md` file support
- ✅ Two-tier Word Mode / Character Mode navigation
- ✅ All 11 harakat + Group C marks (Groups A, B, C taxonomy)
- ✅ Hard rules (silent block) + Soft rules (amber warning, non-blocking, ephemeral)
- ✅ Non-destructive file contract (working copy + `_diac_output/`)
- ✅ Persistent cursor position via sidecar
- ✅ Zen Focus teleprompter with fixed-bottom character panel reservation
- ✅ Letter-level amber colouring for undiacritized candidates
- ✅ Word-level undiacritized dot indicator
- ✅ Tab jump to next undiacritized word
- ✅ Live undiacritized count in status bar
- ✅ Mark Complete + Reset flows
- ✅ Configurable `keymap.json` (read at startup, not exposed in UI)
- ✅ Working copy conflict detection (mtime guard)
- ✅ Blocking error banner on API write failure

### Out of Scope (v1)
- ❌ Letter substitution, deletion, or insertion (diacritics only)
- ❌ Undo/redo stack (replace mode + toggle-off are the correction path in v1)
- ❌ Multiple simultaneous open files (one at a time)
- ❌ Morphological validation — the user is the authority
- ❌ Keymap editor UI (file-based config only)
- ❌ Cloud sync or multi-device (local only)
- ❌ Mobile/touch support
- ❌ Firefox or Safari support (Chrome 87+ only)

---

*Plan version 1.1 — updated in Session 1 pre-development review*
*Spec version: 1.2*
