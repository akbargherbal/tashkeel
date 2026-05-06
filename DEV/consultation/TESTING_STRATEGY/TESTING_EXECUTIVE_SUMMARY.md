# Testing Executive Summary — Arabic Diacritics Editor
**Produced:** Session 33  
**Purpose:** Inform and guide the authoring of a Phased Plan for automated testing (backend + frontend).

---

## 1. Current State

The project has **17 pytest tests** covering one Python module (`diacritic_engine.py`), written in sessions 4–5. By session 33, nine additional JS modules and one Flask application have shipped with **zero automated coverage**. All post-session-5 verification has been manual.

### Existing suite at a glance

| File | Tests | What is covered |
|---|---|---|
| `test_diacritic_engine.py` | T01–T07 | `canonical_cluster()` — group ordering, empty marks, invalid base |
| `test_diacritic_engine.py` | T08–T17 | `write_character()` — byte-preservation, roundtrip, CRLF, out-of-range errors |

Everything else: **zero coverage.**

---

## 2. What Has Zero Coverage — Layer by Layer

### 2.1 Python: `app.py` (Flask routes + helpers)

| Function / Route | Risk if untested |
|---|---|
| `_resolve_safe()` | Path traversal goes undetected — a security-critical guard |
| `get_file_status()` | Three-state logic (untouched / in_progress / complete) can drift |
| `scan_directory()` | Four exclusion rules (`diac_` prefix, cursor sidecars, `_diac_output/`, eligible extensions) — silent inclusion bugs |
| `POST /api/write_char` | Failure contract (§3.7): if the endpoint returns an error and the frontend doesn't revert, the file and UI diverge silently — **worst failure mode in the app** |
| `POST /api/open` | mtime conflict detection, status transition untouched → in_progress |
| `POST /api/save_cursor` | Field merge logic (status and mtime must not be overwritten by this endpoint) |
| `POST /api/mark_complete` | Output directory mirroring, sidecar status transition |
| `POST /api/reset` | Working copy + sidecar deletion; `_diac_output/` must remain untouched |
| `POST /api/set_folder` | ROOT_DIR mutation, config.json persistence, file list response |
| `GET /api/config` | keymap.json fallback when file is absent or malformed |

### 2.2 JavaScript: `diacritic-engine.js` (entirely untested)

This is the JS mirror of the already-tested Python engine — the same logic exists in two languages but is only tested in one. Untested functions:

| Function | Risk |
|---|---|
| `parseCluster()` | All downstream logic depends on this decomposition being correct |
| `classifyMark()` | Wrong group assignment cascades into hard-rule and apply logic |
| `hardRulesCheck()` (3 rules) | Sukun+Shadda, Group C carrier, mark-count ceiling — silent accept when should block |
| `applyDiacritic()` (toggle / replace / stack) | Core mutation; wrong output written to disk on every keystroke |
| `clearDiacritics()` | Delete/Backspace behaviour |
| `isClusterComplete()` | Drives Full-Flow Auto-Continue — a mis-classification causes smart flow to misfire silently |

### 2.3 JavaScript: `navigation.js` (entirely untested)

`_tabJumpToNextUndiac()` and `_tabJumpToPrevUndiac()` both contain non-trivial two-phase wrap-around logic (scan forward/backward, then wrap). Edge cases currently exercised only by hand:

- Wrapping at end-of-document
- Single undiacritized word in the entire document
- Cursor already sitting on the only undiacritized word (must return `false`, not move)
- Document with no undiacritized words (`totalUndiacCount === 0` early-exit)

### 2.4 JavaScript: `soft-rules.js` (entirely untested)

Five linguistically precise rules applied to Arabic cluster arrays. The rule priority ordering and word-level coexistence check are pure logic with no side effects — ideal for unit testing, but currently exercised only manually.

| Rule | Edge case risk |
|---|---|
| Rule 1: Tanwin on non-final character | Final-position exemption boundary |
| Rule 2: Group A on mid-position alef | `idx > 0 AND idx < lastIdx` boundary |
| Rule 3: Group A on alef of ال | Must take priority over Rule 2 when both apply |
| Rule 4: Any diacritic on final alef maqsura | Final-index boundary |
| Rule 5: ال + tanwin coexistence | Word-level scan; must not double-warn clusters already flagged by Rules 1–4 |

### 2.5 JavaScript: `visual-hints.js` (entirely untested)

`_isAmberCandidate()` contains five exempt rules. `reclassifyWord()` maintains `totalUndiacCount` via delta arithmetic — if the delta goes wrong at any point in a session, the count drifts and is never corrected until the file is closed and reopened.

| Logic | Risk |
|---|---|
| Non-initial alef exempt | Off-by-one on `idx > 0` |
| Final alef maqsura exempt | Off-by-one on `idx === clusters.length - 1` |
| Waw after Damma exempt | Requires parsing the *preceding* cluster's marks |
| Ya after Kasra exempt | Same — context-dependent exemption |
| Pragmatic fallback for waw/ya | Preceding cluster undiacritized → should default to amber, not exempt |
| `reclassifyWord()` delta | `totalUndiacCount` drift is silent and cumulative |

### 2.6 JavaScript: `character-mode.js` (entirely untested — highest priority gap)

The most complex file in the codebase at 622 lines. Contains the app's flagship features, all untested:

| Behaviour | Risk |
|---|---|
| Optimistic-update-then-revert contract | API failure leaves UI and file in inconsistent state |
| `_handleCompoundDiacriticKey()` | Two sequential `applyDiacritic` calls; first hard-block must abort both — currently unverified |
| `_smartFlowAdvance()` (Full-Flow Auto-Continue) | Exit + jump + re-enter sequence at word boundary; wrong state leaves cursor stranded |
| Space-no-write invariant (RULES.md §3.11) | Space must never trigger `POST /api/write_char` — silent violation possible |
| Shift+0 / Numpad0 → Shadda override | Keymap value is Sukoon; Shift must override to Shadda |
| NumLock edge case (`key === 'Insert'`) | Windows-specific; only tested on one machine |
| Read-only guard after Mark Complete | Diacritic write must be a no-op when `status === 'complete'` |

### 2.7 JavaScript: `renderer.js`, `completion.js`, `api.js` (untested)

Lower-priority but non-trivial behaviours:

- `clampCursorToNavigable()` — backward scan fallback when all words on a line are punctuation
- `segmentWord()` — thin wrapper over `Intl.Segmenter`; correct cluster boundaries are foundational
- `completion.js` — `?` / `؟` union condition (Latin and Arabic question marks must both toggle the overlay)
- `API.writeChar()` — error path: `showBlockingError` must fire and `false` must be returned

---

## 3. Key Architectural Constraint

The JavaScript codebase uses **`window.*` globals, not ES modules.** All exports are attached to `window` and loaded via `<script>` tags in a fixed order defined in `index.html`. There are no `import`/`export` statements, no bundler, no CommonJS.

This means standard JS test tooling cannot simply `import` a module. Every JS test environment must either:

- Set up a **jsdom `window` object** with globals pre-loaded in the correct script order (Tier 2), or
- Drive a **real browser** against the running Flask app (Tier 3).

This is the single most consequential structural decision for the Phased Plan. The setup cost is a one-time investment; once the jsdom harness exists, adding new unit tests is cheap.

---

## 4. Recommended Tier Structure

### Tier 1 — Python: Extend the existing pytest suite (no new tooling)

**Tool:** Flask's built-in `app.test_client()` + existing pytest.  
**New tooling required:** None.  
**Targets:**

1. `_resolve_safe()` — path traversal rejection (attack vectors: `../`, absolute paths, symlinks)
2. `scan_directory()` — each exclusion rule in isolation, plus a combined fixture
3. `get_file_status()` — all three status values
4. `GET /api/config` — present keymap, absent keymap, malformed keymap
5. `GET /api/files` — empty directory, mixed eligible/ineligible files
6. `POST /api/open` — first open (creates working copy), re-open (cursor restored), mtime conflict flag, path outside ROOT_DIR (400), file not found (404)
7. `POST /api/write_char` — success (200), missing fields (400), path outside ROOT_DIR (400), no working copy (400), out-of-range indices (400)
8. `POST /api/save_cursor` — field merge: status and mtime must not be overwritten
9. `POST /api/mark_complete` — output path mirrors subdirectory structure; sidecar status → complete
10. `POST /api/reset` — working copy + sidecar deleted; `_diac_output/` untouched

### Tier 2 — JavaScript: Unit tests in jsdom (one-time tooling setup)

**Tool:** Vitest + jsdom.  
**Why Vitest over Jest:** ESM-native (no transformation config), fast, first-class jsdom integration, compatible with the project's zero-bundler environment via a small setup file.  
**One-time setup:** A `vitest.setup.js` file that sets `global.window = global`, then loads each JS module in the script order declared in `index.html`. After that, all `window.*` functions are accessible as plain function calls.  
**Targets (in priority order):**

1. `diacritic-engine.js` — all 7 exported functions (mirrors the existing Python test structure; high confidence because the logic is already understood)
2. `soft-rules.js` — `_runSoftRules()` — all 5 rules, priority ordering, boundary conditions
3. `visual-hints.js` — `_isAmberCandidate()` — all 5 exempt rules including the waw/ya context lookback
4. `visual-hints.js` — `reclassifyWord()` delta arithmetic (mock `_classifyWord` to control `undiacCount` changes)
5. `navigation.js` — `_tabJumpToNextUndiac()` and `_tabJumpToPrevUndiac()` — wrap-around, single-word, no-undiac cases
6. `renderer.js` — `clampCursorToNavigable()` — backward scan fallback
7. `renderer.js` — `segmentWord()` — known Arabic cluster boundary cases

### Tier 3 — End-to-end: Browser-driven integration tests (new tooling, tightly scoped)

**Tool:** Playwright (Python API).  
**Why Playwright:** Arabic RTL content support, Python API keeps the toolchain in one language, `page.on('request')` interception enables direct assertion that no HTTP call fires (Space-no-write invariant).  
**Targets (reserved for invariants that Tier 2 cannot reach):**

1. **Space-no-write invariant** — Space in Character Mode must produce zero `POST /api/write_char` requests
2. **Optimistic-update-then-revert** — intercept `/api/write_char` to return 500; assert in-memory cluster reverts to original and panel re-renders at the same position
3. **Full-Flow Auto-Continue at word boundary** — apply a complete diacritic on the last cluster of a word; assert Character Mode opens automatically on the next undiacritized word
4. **Compound key single-write** — press key 4 (Shadda + Fatha); assert exactly one `POST /api/write_char` fires with the combined cluster
5. **Tab wrap-around** — Tab past the last undiacritized word; assert cursor wraps to the first one

**Tier 3 is explicitly lower priority than Tiers 1–2.** The Phased Plan should phase it last and scope it tightly. Do not expand Tier 3 until Tiers 1 and 2 are fully implemented and green.

---

## 5. What is Explicitly Out of Scope

- Visual and CSS rendering correctness
- Cross-browser behaviour (Chrome 87+ only by design)
- Performance benchmarking
- Any refactoring of production modules to make them testable — the harness must fit the modules, not the reverse

---

## 6. Priority Order for the Phased Plan

1. **Tier 1** — No new tooling, immediate value, uses the already-green pytest infrastructure
2. **Tier 2** — One-time jsdom setup cost, then high ROI on the pure-logic functions
3. **Tier 3** — Flask server must be running, more setup, reserved for the invariants that Tiers 1–2 cannot reach

The Phased Plan should treat each Tier as a separate phase, with its own stop conditions and verification steps. Tiers must not be combined into a single phase.

---

## 7. Files Required to Author the Phased Plan

The following files must be attached at the start of the plan-writing session:

| File | Why needed |
|---|---|
| `app.py` | Route signatures and error shapes for Tier 1 test design |
| `diacritic-engine.js` | Function signatures for Tier 2 test design |
| `navigation.js` | `_tabJumpTo*` signatures and state dependencies |
| `soft-rules.js` | `_runSoftRules()` — rule logic and return type |
| `visual-hints.js` | `_isAmberCandidate()` and `reclassifyWord()` |
| `character-mode.js` | Tier 3 invariant specifications |
| `index.html` | Script load order — required for the jsdom setup file |
| `test_diacritic_engine.py` | Baseline — style and fixture patterns to follow |
| `RULES.md` | §8 Phased Planning Protocol |
| This document | Source of truth for the plan |
