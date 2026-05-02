# Arabic Diacritics Editor: Implementation Plan

## Executive Summary

- **Current State**: Blank project — nothing exists yet
- **Goal**: A locally-run, keyboard-centric Flask + Vanilla JS editor for adding/correcting Arabic diacritics (tashkeel) in plain-text files, with a Zen Focus teleprompter interface and non-destructive file contract
- **Key Architectural Decision**: The working copy (`diac_` prefix) IS the persistent state — no database, no undo stack, no save button. Every keystroke writes through immediately
- **Estimated Time**: 12–20 days across 5 phases

---

## Assumptions to Validate Before Starting

1. `Intl.Segmenter` is available in the target browser (Chrome 87+, Firefox 78+, Safari 14.1+) — **validate in Phase 1**
2. Python `regex` module segments `\X` correctly for the harakat combining ranges — **validate in Phase 1**
3. Flask `send_file` / streaming is sufficient for large `.txt` files (no pagination needed for v1)
4. OS Arabic keyboard layout fires `event.key` with the diacritic character directly (confirmed by spec §7.2), not through an IME buffer — **smoke-test in Phase 2**

---

## Phase 1: Foundation — Flask Scaffold + Non-Destructive File Contract (2–4 days)

### Goal
**Prove the file contract and API surface before touching any UI.**

### Tasks

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

```python
def scan_directory(root: Path) -> list[dict]:
    """Return sorted list of eligible files with their status.
    Implementation: walk root, filter extensions, exclude hidden prefixes,
    determine status from filesystem checks."""
    pass

def get_file_status(original_path: Path) -> str:
    """Return 'untouched' | 'in_progress' | 'complete'."""
    pass
```

**1.3: Working Copy Contract** (3–5 hours)
- `POST /api/open` — receives `file_path`; creates `diac_` copy if absent; returns working copy content as lines array + cursor position
- Working copy creation: byte-for-byte copy via `shutil.copy2`; decode without normalization
- Cursor sidecar: read `{"line": N, "word": N, "char": null, "status": "in_progress"}` if it exists; return defaults if not
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

**1.4: Diacritic Write Endpoint** (2–3 hours)
- `POST /api/write_char` — receives `{file_path, line_idx, word_idx, char_idx, new_cluster}`
- Reads the working copy line, segments into grapheme clusters using `regex` `\X`, replaces the target cluster, serialises back with canonical combining-mark order (Group C first, then Group B, then Group A), writes the mutated line back
- **No global normalisation applied anywhere in this path**
- Returns `{ok: true}`

```python
def write_character(working_copy: Path, line_idx: int, 
                    word_idx: int, char_idx: int, new_cluster: str) -> None:
    """Mutate single grapheme cluster in working copy.
    Serialise with canonical order: Group C → Group B → Group A."""
    pass

def canonical_cluster(base: str, marks: set[str]) -> str:
    """Rebuild grapheme cluster from base + mark set in canonical order."""
    pass
```

**1.5: Cursor Save + Status Transitions** (2–3 hours)
- `POST /api/save_cursor` — debounced from frontend, writes cursor sidecar (500ms debounce on client side)
- `POST /api/mark_complete` — flushes cursor, copies working copy to `_diac_output/<original_filename>`, updates sidecar `status`; returns error if output dir unwritable
- `POST /api/reset` — deletes `diac_` working copy and cursor sidecar; returns `{status: "untouched"}`

### Success Criteria
- ✅ File tree returns correct files with correct statuses (verified via `/api/files` in browser)
- ✅ Opening a file creates exactly one `diac_` copy; re-opening does not create a second
- ✅ Writing a character mutation to line 5, word 3, char 2 produces correct bytes in the working copy (verified with `xxd` or `hexdump`)
- ✅ Canonical combining order is correct: a cluster with Shadda + Fatha reads back as `U+0651 U+064E` (Group B then Group A)
- ✅ Mark Complete copies file to `_diac_output/`; Reset deletes working copy cleanly
- ✅ `Intl.Segmenter` available in test browser (one-line check in console)

### Deliverables
- [ ] `app.py` with all 5 API routes
- [ ] `static/api.js` — thin JS wrapper for all API calls
- [ ] `pytest` test file with ≥10 tests covering: working copy creation, grapheme segmentation, canonical ordering, status transitions, output write
- [ ] `requirements.txt` pinned

### Rollback Plan
**If** `regex \X` does not segment harakat clusters correctly → evaluate `uniseg` library as drop-in replacement; no frontend changes required

---

## Phase 2: Document Rendering + Word Mode Navigation + Zen Focus (3–5 days)

### Goal
**Deliver a navigable, readable document pane where the user can move through words and lines using only arrow keys.**

### Tasks

**2.1: Document Renderer** (4–6 hours)
- On file open, render each line as a `<div class="line">` containing `<span class="word">` elements
- Each word span: tokenize into grapheme clusters using `Intl.Segmenter({ granularity: 'grapheme' })` and store the cluster array as a `data-clusters` JSON attribute (or in a parallel JS data structure keyed by line/word index)
- RTL: `dir="rtl"` on the document pane; Amiri font at ≥28px; all text flows right-to-left
- Words are non-contenteditable spans — no browser text editing, all input is keyboard-intercepted

```javascript
function renderDocument(lines) {
    /** Tokenize each line into words, each word into grapheme clusters.
     *  Populate #doc-pane with line/word spans.
     *  Store cluster arrays in docState.lines[i].words[j].clusters[] */
}

function segmentWord(word) {
    /** Use Intl.Segmenter to return array of grapheme cluster strings. */
}
```

**2.2: Zen Focus Teleprompter** (3–5 hours)
- The document pane has `overflow: hidden`; a single inner container scrolls via `transform: translateY()`
- Active line always lands at 50% viewport height: `translateY = -(activeLine.offsetTop - viewportHeight/2)`
- Apply CSS classes: `zen-active` (100% opacity), `zen-context` (±1–2 lines, ~55% opacity), `zen-far` (further lines, ~20% opacity)
- Smooth transition via `transition: transform 300ms ease`
- Arrow up/down updates active line and re-runs the translateY calculation

**2.3: Word Mode Keyboard Navigation** (4–6 hours)
- Global `keydown` handler (§7.2 interception pattern) — `preventDefault()` on all consumed keys
- Word Mode state: `{lineIdx, wordIdx}` in JS `editorState` object
- `←` → advance to next word in RTL reading order (next word toward start of line in DOM terms, wrapping to previous line)
- `→` → previous word, wrapping to next line
- `↑` / `↓` → same `wordIdx` on adjacent line; clamp if line is shorter
- `Enter` → switch to Character Mode (Phase 3)
- Active word gets class `word-active`; update status bar

**2.4: Status Bar (Word Mode fields)** (2–3 hours)
- Live display: `[WORD MODE]  [Line N / Total]  [Word N / Total on line]`
- `Auto-saved ✓` flash: appears on successful cursor save API call, fades after 2s via CSS opacity transition

### Success Criteria
- ✅ Opening a 200-line Arabic file renders without visible layout shift or horizontal scroll
- ✅ Active line stays visually centered through ≥50 consecutive `↓` keypresses (measure with eye or screenshot)
- ✅ `←` on word 1 of line 5 moves to last word of line 4 (verified manually)
- ✅ `↑` on a line shorter than the current `wordIdx` clamps correctly without JS error
- ✅ `Intl.Segmenter` cluster arrays for the word `يَكْتُبُ` produce 5 clusters, not 8 code points

### Deliverables
- [ ] `static/renderer.js` — document rendering + Zen Focus
- [ ] `static/navigation.js` — Word Mode state machine + keyboard handler
- [ ] `static/editor-state.js` — central `editorState` object (single source of truth for cursor)
- [ ] Manual test with a real Arabic `.txt` file (≥50 lines)

### Rollback Plan
**If** Zen Focus `translateY` jitters on long files → fall back to `scrollIntoView({ block: 'center', behavior: 'smooth' })` as a temporary measure; re-address in Phase 5

---

## Phase 3: Character Mode + Diacritic Editing (3–5 days)

### Goal
**Deliver the complete edit loop: enter a word, navigate its characters, apply/replace/toggle diacritics, and watch them persist immediately.**

### Tasks

**3.1: Character Mode Entry + Expanded Panel** (4–6 hours)
- `Enter` in Word Mode: open a fixed character panel (bottom of doc pane, fixed position)
- Panel renders the active word's grapheme clusters as large individual character tiles (≥48px, Amiri)
- Each tile shows base letter + all combining marks rendered visibly above/below
- Active character tile: solid highlight (e.g., filled background, high contrast)
- Non-active tiles in panel: slightly dimmed (70% opacity)
- Main document line dims to `zen-far` treatment while panel is open
- Mode indicator in status bar switches to `CHARACTER MODE`

**3.2: Character Mode Navigation** (3–4 hours)
- `←` → advance to next character (RTL, toward word start); at boundary → auto-exit to Word Mode and advance to next word
- `→` → previous character; at boundary → auto-exit and move to previous word
- `Escape` → exit to Word Mode, keep word position
- `editorState.charIdx` tracks position within `clusters[]` array (not raw string index — never use string indexing)

**3.3: Diacritic Application Engine** (5–8 hours)
- Intercept `event.key` for diacritic range `/^[\u064B-\u0655\u0670]$/`
- Classify incoming diacritic into Group A / B / C (hardcoded set membership, not computed)
- **Hard rules enforcement (§8.2)** — all checks run before any mutation:
  - Group A: only one allowed per cluster → if different Group A already present, this is a Replace (§9.1), not a block
  - Sukun + Shadda → hard block (silent rejection + brief flash animation on tile)
  - Max 3 combining marks total → hard block
  - Group C only on alef/waw/ya carriers → hard block
- **Replace mode**: strip existing Group A mark, insert new Group A mark, preserve Shadda and Group C
- **Toggle-off**: if incoming code point already present in cluster's mark set → remove it
- **Delete/Backspace**: remove all combining marks from current cluster
- After mutation: rebuild cluster in canonical order, call `POST /api/write_char` immediately

```javascript
function applyDiacritic(cluster, incomingCodePoint) {
    /** Returns new cluster string or null if hard-blocked.
     *  Handles replace, toggle-off, stacking per §9. */
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
- ✅ Applying Fatha to a letter that already has Kasra replaces it — Kasra is gone, Fatha present
- ✅ Applying Shadda to a letter with Sukun is silently blocked; tile flashes; no write to disk
- ✅ Pressing the same diacritic key twice: first apply adds it, second removes it
- ✅ Delete/Backspace on a cluster with 3 combining marks removes all 3; base letter remains
- ✅ `←` past the last character of a word auto-exits to Word Mode and advances one word (no extra keypress required)
- ✅ Cluster arrays never reference raw string indices; confirmed by code review of `charIdx` usage

### Deliverables
- [ ] `static/character-mode.js` — panel rendering + navigation
- [ ] `static/diacritic-engine.js` — hard rules + apply/replace/toggle/clear logic
- [ ] End-to-end test: open file → navigate to word → enter character mode → apply Shadda + Fatha → verify file bytes

### Rollback Plan
**If** immediate write-per-keystroke causes perceptible lag on large files → batch writes: accumulate mutations in-memory, flush to API on `Escape` (exit char mode) and on cursor move; acceptable tradeoff given §10 requirements

---

## Phase 4: Visual Hints + Soft Validation Rules (2–4 days)

### Goal
**Make undiacritized letters immediately visible and add the linguistic warning layer without blocking any edits.**

### Tasks

**4.1: Letter-Level Colouring (Undiacritized Candidates)** (4–6 hours)
- In Word Mode, each rendered letter span is classified on render:
  - Has ≥1 diacritic → normal colour
  - No diacritic, not in canonical-exempt list (§8.4) → amber highlight class
  - In canonical-exempt list → no highlight
- Canonical-exempt logic (§8.4): alef in mid/end position, waw if preceding letter has damma, ya if preceding letter has kasra, alef maqsura in final position
- **Pragmatic rule**: if preceding letter is undiacritized, waw/ya default to amber (cannot evaluate context)
- Re-classify affected word spans after each diacritic write

**4.2: Word-Level Undiacritized Dot Indicator** (1–2 hours)
- A word that contains ≥1 amber letter gets a small dot rendered beneath it (CSS `::after` pseudo-element)
- Dot is removed when all candidate letters in the word are diacritized

**4.3: Live Undiacritized Count** (2–3 hours)
- On file open: count all amber-candidate letters across the full document; store in `editorState.undiacritizedCount`
- Decrement/increment as edits are applied (do not re-scan full document on every keystroke)
- Status bar shows `Undiacritized: N`; updates reactively

**4.4: Soft Rules — Amber Underline + Tooltip** (4–6 hours)
- Soft rule checks run in Character Mode when a diacritic is applied (§8.3):
  - Tanwin on non-final character
  - Group A diacritic on alef long-vowel in mid-position
  - Group A diacritic on alef of ال
  - Any diacritic on word-final alef maqsura
  - ال + tanwin coexistence (word-level check)
- Soft rule fires: character tile gets amber underline; tooltip label appears beneath tile with plain-language explanation
- Edit is **not blocked** — diacritic is still applied
- Amber underline persists on the word span in Word Mode (rendered from working copy on next render)

**4.5: Keymap.json Custom Bindings** (1–2 hours)
- On startup, `/api/config` returns `customKeymap` object
- In the keydown handler: after checking `event.key` for diacritics, also check `event.code` against `customKeymap`; if a match, treat mapped codepoint as the diacritic

### Success Criteria
- ✅ A freshly opened undiacritized file shows every eligible letter in amber
- ✅ Applying a diacritic to a letter turns it from amber to normal colour immediately
- ✅ Undiacritized count in status bar matches a manual count of amber letters in a 10-word test passage (±0)
- ✅ Applying Fathatan to the 2nd character of a 4-character word triggers the soft warning tooltip; no edit is blocked
- ✅ Mid-word alef shows no amber highlight when the preceding letter already has a damma
- ✅ Numpad1 → Fatha mapping from `keymap.json` applies correctly in character mode

### Deliverables
- [ ] `static/visual-hints.js` — letter classification + undiacritized count
- [ ] `static/soft-rules.js` — soft validation checks + tooltip rendering
- [ ] CSS: `amber-candidate`, `word-has-undiac`, `soft-warning-underline`, `char-soft-tooltip`
- [ ] Test file with ≥3 soft rule cases for manual verification

### Rollback Plan
**If** per-letter classification causes render slowness on files >1,000 lines → classify only the visible ±10 lines around the active line; queue background classification for the rest

---

## Phase 5: Status System + Completion Workflow + Polish (2–3 days)

### Goal
**Deliver a production-ready app: complete/reset workflow, sidebar status icons, and resolution of the top open questions.**

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
- Document pane closes; user is returned to file selection
- `_diac_output/` is untouched

**5.4: Open Questions — Resolve in This Phase** (2–3 hours)
- **OQ1 (Undo/redo)**: Decide and document. Recommended: defer to v2; replace mode + toggle-off are sufficient for v1 per spec
- **OQ2 (Character panel position)**: Implement as fixed panel at bottom of doc pane (spec §16 assumed preference)
- **OQ3 (Tab jump-to-next-undiacritized)**: Implement in v1 — it's a 1-hour addition with high payoff. `Tab` in Word Mode: scan forward from current position for next word with undiacritized candidates; jump to it
- **OQ4 (Soft warning persistence)**: Ephemeral — recomputed on render. Not stored in sidecar
- **OQ5 (Working copy conflict detection)**: Implement lightweight mtime check: store `last_seen_mtime` in cursor sidecar; on session resume, if mtime differs, show a non-blocking warning banner: `"Working copy was modified externally"`

**5.5: Final Polish** (2–4 hours)
- `beforeunload` event: flush cursor sidecar synchronously
- File-switch: flush cursor sidecar of current file before opening new
- Keyboard shortcut reference panel (collapsible `?` overlay in the UI)
- Minimum browser requirements note in README

### Success Criteria
- ✅ Mark Complete → verify `_diac_output/chapter_1.txt` exists with correct content
- ✅ Reset → working copy and sidecar deleted; re-opening creates a fresh copy
- ✅ `Tab` in Word Mode skips to the next amber word; wraps at end of document
- ✅ Closing and reopening the browser tab resumes exact cursor position (line, word)
- ✅ Externally modifying `diac_` file between sessions triggers the mtime warning banner
- ✅ App functions correctly across a full editing session of ≥30 minutes without page refresh

### Deliverables
- [ ] `static/completion.js` — mark complete / reset modals + state
- [ ] `static/tab-jump.js` — undiacritized word jump
- [ ] Updated `app.py` with mtime guard in `/api/open`
- [ ] `README.md` covering: install, launch, keyboard reference, file structure

---

## Decision Tree & Stop Conditions

```
START
  ↓
PHASE 1: API + File Contract
  ├─ All 5 success criteria pass → PHASE 2
  ├─ regex \X segmentation fails → try uniseg → retest → PHASE 2
  └─ Fundamental filesystem permission issue → STOP, fix environment

PHASE 2: Rendering + Word Navigation
  ├─ Zen Focus stable, navigation correct → PHASE 3
  ├─ Intl.Segmenter unavailable in target browser → STOP (polyfill or target change required)
  └─ Translatey jitter unresolved → scrollIntoView fallback → PHASE 3

PHASE 3: Diacritic Editing (CRITICAL PATH)
  ├─ Hard rules pass, write-through confirmed → PHASE 4
  ├─ Write lag >200ms on large files → batch writes on Escape → PHASE 4
  └─ Canonical combining order produces incorrect bytes → revisit serializer → retest

PHASE 4: Visual Hints + Soft Rules
  ├─ Amber colouring accurate, count correct → PHASE 5
  └─ Render perf issue → lazy classification → PHASE 5

PHASE 5: Polish + Completion
  └─ All success criteria pass → SHIP v1
```

### Explicit Stop Conditions
**STOP if:**
- `Intl.Segmenter` is unavailable and no viable polyfill exists (navigation breaks fundamentally)
- Any phase exceeds 2× its estimated time without clear cause (reassess scope)
- Phase 3 write-through produces incorrect bytes after 2 debugging sessions (the file contract is the product)

---

## Risk Mitigation Summary

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Grapheme segmentation edge cases in rare Arabic ligatures | Medium | High | Test Phase 1 with a corpus that includes ta marbuta, alef wasla, lam-alef ligatures |
| `event.key` produces unexpected values on Windows Arabic 101 layout | Medium | Medium | Smoke-test on Windows early in Phase 2; the interception strategy is layout-agnostic by design |
| Zen Focus translateY fights browser scroll behaviour | Low | Medium | `overflow: hidden` on pane + `preventDefault` on arrow keys fully owns scroll; low risk |
| Canonical combining-mark order diverges from expectations on mixed-NFC source files | Medium | High | Phase 1 tests must include a source file with non-canonical mark ordering to validate round-trip |
| File write latency on large files slows keystroke feel | Low | Medium | Phase 3 fallback: batch writes on exit from Character Mode |

---

## Success Metrics

### Minimum Viable Success (end of Phase 4)
- ✅ Can open a real Arabic manuscript file and diacritize it start to finish
- ✅ Original file is byte-for-byte unchanged after a full session
- ✅ Working copy survives browser crash and resumes correctly

### Stretch Goals (Phase 5 + beyond)
- Tab jump to next undiacritized word (OQ3 — recommended for v1)
- Single-level undo via `Ctrl+Z` (OQ1 — defer to v2)
- Progress percentage indicator in sidebar (% of words fully diacritized)

---

## Scope Boundaries

### In Scope
- ✅ `.txt` and `.md` file support
- ✅ Two-tier Word Mode / Character Mode navigation
- ✅ All 11 harakat + Group C marks (Groups A, B, C taxonomy)
- ✅ Hard rules (silent block) + Soft rules (amber warning, non-blocking)
- ✅ Non-destructive file contract (working copy + `_diac_output/`)
- ✅ Persistent cursor position via sidecar
- ✅ Zen Focus teleprompter
- ✅ Letter-level amber colouring for undiacritized candidates
- ✅ Mark Complete + Reset flows
- ✅ Configurable `keymap.json` (read at startup, not exposed in UI)

### Out of Scope
- ❌ Letter substitution, deletion, or insertion (diacritics only per §18)
- ❌ Undo/redo stack (replace mode + toggle-off are the correction path in v1)
- ❌ Multiple simultaneous open files (one at a time per §18)
- ❌ Morphological validation — the user is the authority
- ❌ Keymap editor UI (file-based config only)
- ❌ Cloud sync or multi-device (local only)
- ❌ Mobile/touch support

---

## Next Steps

1. **Resolve OQ2 before writing any CSS**: Confirm character panel position (bottom fixed panel assumed)
2. **Collect a test corpus**: 3–5 real Arabic `.txt` files covering: fully bare text, partially diacritized, text with non-canonical mark ordering, text with Group C marks (hamza-bearing alefs)
3. **Validate environment**: Python 3.10+, `pip install flask regex`, confirm `Intl.Segmenter` in target browser console
4. **Start Phase 1, Task 1.4 first** — the write-and-read-back test is the highest-risk technical assumption; prove it in isolation before building the file tree or UI

---

*Plan version 1.0 — based on spec v1.1*
