# Tashkeel — Maintenance Rules

> **Read this file before touching any code.**
> This document supersedes all session handovers and the original plan/spec.
> It exists to protect critical business logic from being broken by cosmetic or
> minor fixes. Every rule here was earned through 7 implementation sessions.

---

## 0. Before You Make Any Change

1. Identify which module(s) own the concern (§1).
2. Check whether the change touches a dangerous zone (§2).
3. Confirm you are not violating a critical invariant (§3).
4. Make the **minimum** change. Do not refactor adjacent code unless it is the
   direct cause of the bug.
5. State in the session handover exactly which lines changed and why.

---

## 1. Module Ownership

Each concern has exactly one owner. Do not move logic between modules.

| Module                       | Owns                                                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diacritic_engine.py`        | Byte-level cluster write, canonical diacritic ordering. No Flask. No global NFC.                                                                                                                                                                                                             |
| `app.py`                     | All Flask routes. `_resolve_safe()` path guard must wrap every user-supplied file path that operates **below** ROOT_DIR. The three folder-selector routes (`/api/browse`, `/api/set_folder`, `/api/current_folder`) are exempt — they operate at the ROOT_DIR level, not below it. See §3.8. |
| `static/api.js`              | All HTTP calls to the backend. The blocking error banner (`showBlockingError`). File tree rendering.                                                                                                                                                                                         |
| `static/editor-state.js`     | The `editorState` object schema. No logic — state only.                                                                                                                                                                                                                                      |
| `static/renderer.js`         | DOM rendering of the document pane. `window.segmentWord()`. `clampCursorToNavigable()`. `updateZenFocus()`.                                                                                                                                                                                  |
| `static/navigation.js`       | Word Mode keyboard state machine. Tab jump (`_tabJumpToNextUndiac`). Backward jump (`_tabJumpToPrevUndiac`). `ShiftTab` synthetic key (synthesised in `handleEditorKeystroke` from `event.shiftKey + Tab`). Full Flow Space in `handleWordMode`: `_tabJumpToNextUndiac()` followed by `enterCharacterMode()` (fired after `updateZenFocus()` so `_applyCharModeLineStyle` wins over zen class assignments — same `updateZenFocus → enterCharacterMode` ordering as the `_smartFlowAdvance()` word-boundary branch in `character-mode.js`). Debounced cursor saves.                  |
| `static/diacritic-engine.js` | Hard rules, `parseCluster`, `canonicalCluster`, `applyDiacritic`, `clearDiacritics`, `flashBlockedTile`, `isClusterComplete`.                                                                                                                                                                                     |
| `static/character-mode.js`   | Character Mode panel UI, inner-tier navigation, per-keystroke API write-through. `shiftKey` parameter threading from `handleEditorKeystroke`. Shift+0 / Shift+Numpad0 → Shadda override (also handles Shift+Numpad0 NumLock edge case via `key === 'Insert'`). Space exit+jump handler. `_triggerLanguageWarning` (amber flash + 2-second non-blocking message). `_smartFlowAdvance()` (auto-advance after a phonologically complete cluster; at a word boundary, jumps to the next undiacritized word via `_tabJumpToNextUndiac()` and automatically enters Character Mode on it — Full-Flow Auto-Continue, Session 30; ordering: `exitCharacterMode → _tabJumpToNextUndiac → updateZenFocus → enterCharacterMode → updateStatusBar → scheduleCursorSave`; called only from `_handleDiacriticKey` success path and `_handleCompoundDiacriticKey` success path; see §2). `_handleDiacriticKey` success path order: `_updateWordSpanText` → `reclassifyWord` → `isClusterComplete` check → `_smartFlowAdvance` or `_renderCharPanel` (exactly one `_renderCharPanel` fires per keystroke on either path). `_handleCompoundDiacriticKey(codepoints[])` (compound key handler — two sequential `applyDiacritic` calls build the final cluster; one `API.writeChar` fires; same success-path ordering as `_handleDiacriticKey`; called only from the compound-key detection block in `handleCharacterMode`). |
| `static/visual-hints.js`     | Amber letter classification. `classifyAllWords()` on file open. `reclassifyWord()` after edits. `undiacCount` population.                                                                                                                                                                    |
| `static/soft-rules.js`       | Ephemeral soft validation rules (5 rules per spec §8.3). Tooltip rendering on char tiles.                                                                                                                                                                                                    |
| `static/completion.js`       | Completion banner. Shortcuts overlay. `?` key listener catches both U+003F (Latin `?`) and U+061F (Arabic `؟`) — see §3.10. Escape-to-close (overlay only).                                                                                                                                                                                                      |
| `templates/index.html`       | App shell, CSS, script load order, Mark Complete handler, Reset handler.                                                                                                                                                                                                                     |

---

## 2. Dangerous Zones

These files are where a one-line change can silently break a session's worth of
logic. Apply extra scrutiny before editing them.

### `diacritic_engine.py`

The byte-preservation contract: `canonical_cluster()` is called **only** on
mutated clusters. It must **never** be called on untouched clusters — doing so
would silently reorder combining marks in lines that were not edited. The
roundtrip invariant (`''.join(regex.findall(r'\X', s))` is byte-identical to
input) is the foundation of the entire write strategy.

### `character-mode.js`

The most complex file in the codebase. Three rules that must not be violated:

- `_updateWordSpanText()` must produce span HTML **structurally identical** to
  `renderer.js` — same class names (`letter-cluster`, `punct`), same
  `data-char-idx="N"` attribute. Any divergence silently breaks
  `visual-hints.js`.
- `reclassifyWord()` must be called **after** `_updateWordSpanText()`, not
  before. The DOM spans must exist before `_classifyWord()` queries them.
- `checkSoftRulesAfterWrite()` is called at the end of `_renderCharPanel()` —
  this is the sole call site. Do not add a second call site elsewhere.
- `_smartFlowAdvance()` must be called **only** from `_handleDiacriticKey`'s
  success path (after `isClusterComplete` returns true) or from
  `_handleCompoundDiacriticKey`'s success path. Calling it from any other
  site produces a double `_renderCharPanel` call, violating the
  `checkSoftRulesAfterWrite` sole-call-site invariant above.

### `renderer.js`

`window.segmentWord()` and `clampCursorToNavigable()` are called by other
modules. Do not rename or move them. Do not duplicate `clampCursorToNavigable`
in `navigation.js` — the authoritative copy lives here only.

### `index.html` — script load order

The `<script>` load order is load-order-dependent and must not be changed:

```
editor-state.js → api.js → renderer.js → navigation.js
→ diacritic-engine.js → character-mode.js
→ visual-hints.js → soft-rules.js → completion.js
```

`diacritic-engine.js` must load before `character-mode.js` (engine exports are
dependencies). Reversing them produces silent failures.

---

## 3. Critical Invariants

These are rules that must hold at all times. Treat any change that would violate
them as a blocker — fix the approach, not the invariant.

### 3.1 Original file is never modified

`diac_<filename>` is the working copy. The source file is read once at working-
copy creation and never touched again. The `_diac_output/` copy is written only
by Mark Complete. This is enforced in `app.py`; do not add any route that writes
to the original file path.

### 3.2 `canonical_cluster()` scope (Python)

Used only for the cluster being mutated by `write_character()`. Never applied
globally or to untouched clusters. This is what makes per-keystroke writes safe.

### 3.3 `editorState` schema is locked

All fields defined in the schema must remain present. Do not add fields ad hoc.
Do not remove fields. If a new feature genuinely requires a new field, document
the addition explicitly and explain why it cannot reuse an existing field.

Fields: `filePath`, `status` (`'idle'|'open'|'complete'`), `mode`
(`'word'|'char'`), `lineIdx`, `wordIdx`, `charIdx`, `lines`, `totalUndiacCount`,
`lastSaveTime`.

### 3.4 Read-only guard placement

When `editorState.status === 'complete'`, the guards in `_handleDiacriticKey()`
and `_handleClearDiacritics()` (top of each function) make diacritic keys no-ops.
Navigation (Arrow keys, Escape) must **not** be blocked — users must still be
able to read the document. Do not move the guard to `handleCharacterMode()` —
that would block navigation too.

### 3.5 Word tokenization alignment (Python ↔ JS)

`write_character()` in Python uses `regex.split(r'(\s+)', line)` with a
capturing group. The `word_idx` sent from the frontend must index the same
non-whitespace, non-empty tokens from the same split. Punctuation is not a
separate token — it is part of its adjacent word token at the Python level, even
though the frontend renders it as a `<span class="punct">` (non-navigable). Any
change to tokenization in either layer must be mirrored in the other.

### 3.6 `beforeunload` flush strategy

Uses `navigator.sendBeacon()` with a Blob payload — not `fetch()`, not
`XMLHttpRequest()`. This is intentional: `sendBeacon` is the only API that
guarantees the request fires on tab close/crash. Do not replace it.

### 3.7 Optimistic update + revert contract

`character-mode.js` updates the in-memory cluster immediately (optimistic). If
`API.writeChar()` returns false, the cluster reverts and the panel re-renders.
`API.writeChar()` (in `api.js`) owns the blocking error banner — `character-mode.js`
does not show its own error UI. Do not break this separation.

### 3.8 `_resolve_safe()` on every backend route

Every Flask route that accepts a user-supplied file path **that operates below ROOT_DIR** must pass it through `_resolve_safe()`. This prevents path traversal attacks.

**Exempt routes (Session 10):** `/api/browse`, `/api/set_folder`, and `/api/current_folder` do not use `_resolve_safe()` — they operate at the ROOT_DIR level, not below it. `/api/set_folder` uses `os.path.isdir()` for validation instead. Using `_resolve_safe()` here would be circular (you cannot validate a path relative to ROOT_DIR when that path _is_ ROOT_DIR). This exemption is documented in each route's docstring. Do not add `_resolve_safe()` to these three routes.

### 3.9 Soft rules are ephemeral

Soft rule warnings are recomputed on every `_renderCharPanel()` call. They are
never persisted to disk or stored in `editorState`. `_renderCharPanel()` is the
sole call site for `checkSoftRulesAfterWrite()`. Do not cache soft rule results.

### 3.10 `?` key Escape scope

`completion.js` captures Escape only when the shortcuts overlay is visible. It
does not interfere with Character Mode's Escape handler (exit to Word Mode). If
you touch either Escape handler, verify the other still works.

The `?` key listener catches both `event.key === "?"` (Latin, U+003F) and
`event.key === "\u061F"` (Arabic `؟`, U+061F). This handles both Latin and
Arabic keyboard layouts on the same physical Shift+/ key. Do not replace this
union condition with an `event.code`-based check — that would hard-code a
physical key layout assumption and break the Arabic keyboard path.

### 3.11 Space in Character Mode — no write call

The Space branch in `handleCharacterMode` calls `exitCharacterMode()` then
`_tabJumpToNextUndiac()`. It must never trigger `API.writeChar()` or any other
backend write. If you modify this branch, verify in the Chrome Network tab that
no `POST /api/write_char` fires on a Space press while in Character Mode. This
is an explicit stop condition in the Phase 1 plan and must remain enforced.

---

## 4. What Requires Extra Thought Before Changing

| If you want to…                                                               | Read first                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Change any CSS on `.char-tile`, `.letter-cluster`, or `.char-tiles-container` | §2 (`character-mode.js`) — these classes are queried by `visual-hints.js` and `soft-rules.js`                                     |
| Add a diacritic key binding or change keymap handling                         | §1 (`diacritic-engine.js` and `keymap.json`) — bindings match `event.code`, not `event.key`                                       |
| Change file tree rendering                                                    | §1 (`api.js`) — status icons (`○●✓`) are updated in-place without page reload                                                     |
| Change the sidebar status icons                                               | §3.3 — `editorState.status` is the single source of truth                                                                         |
| Add a new Flask route                                                         | §3.8 — `_resolve_safe()` is mandatory                                                                                             |
| Change how lines are split or words are indexed                               | §3.5 — must be mirrored in both Python and JS                                                                                     |
| Change Zen Focus / line highlighting                                          | §1 (`renderer.js`) — `updateZenFocus()` is authoritative; `_applyCharModeLineStyle()` in `character-mode.js` must call it on exit |
| Modify the Space or ShiftTab branches in `handleWordMode` or `handleCharacterMode` | §3.11 — Space in Character Mode must never trigger `API.writeChar()`; verify in Network tab after any change |

---

## 5. Things That Are Intentionally Out of Scope (v1)

Do not implement these without a full planning session first:

- **Undo/redo** — deferred to v2. The optimistic-update model would need
  significant rework.
- **Multi-file simultaneous editing** — one file at a time is a core constraint.
- **Letter substitution, deletion, insertion** — diacritics only.
- **Firefox / Safari support** — `Intl.Segmenter` with grapheme granularity
  requires Chrome 87+. No polyfill path exists without replacing the segmenter.
- **Global NFC normalization** — explicitly forbidden. See §3.2.

---

## 6. Safe Checkpoint

The v1.0.0 git tag is the last known-good state. If the application breaks and
you cannot identify the cause, run:

```bash
git stash          # save current changes
git checkout v1.0.0
```

Or to create a new branch from the safe point:

```bash
git checkout -b fix/something v1.0.0
```

---

## 7. Maintenance Session Protocol

Every maintenance session — no matter how small — must:

1. **Start** by reading this file and the latest `Session_N_Handover.md`.
2. **State** the change before making it: what file, what function, what line.
3. **End** by producing a `Session_N+1_Handover.md` covering what changed,
   what was verified, and what the new known issues are.
4. **Never** combine a cosmetic fix with a logic change in the same session.
   If a CSS fix reveals a logic problem, document the logic problem in the
   handover and address it in a separate session.

---

## 8. Phased Planning Protocol

Every bug fix and feature — however small — must be preceded by a written
Phased Plan. This section defines what a valid plan looks like, when one is
required, and how it relates to the session handover cycle.

The protocol is intentionally project-agnostic. It can be applied verbatim to
any software project.

---

### 8.1 When a Plan Is Required

A Phased Plan is required before any session that will:

- Change a dangerous-zone file or function (as designated in the project's
  equivalent of §2)
- Add a new feature at any scale
- Fix a bug that touches more than one function
- Modify an invariant, a module boundary, or a data schema

A plan is **not** required for:

- Documentation-only sessions (comments, README, handover files)
- A single-line fix to a non-dangerous-zone file where the change and its
  complete verification are both trivially self-evident

When in doubt, write a plan. A short plan costs less than an unplanned
regression.

---

### 8.2 Plan Header

Every plan must open with a locked header:

```
Plan version:           N.M
Based on:               [source documents reviewed before writing this plan]
Current codebase state: [last known-good milestone]
Source files reviewed:  [every source file read before writing the plan]
```

`Source files reviewed` is not optional. A plan written without reading the
relevant source files is not a valid plan. If a required source file is missing,
apply the Zero-Assumption Protocol — ask for it before writing the plan.

---

### 8.3 Required Sections

Every plan must contain the following sections in order. Sections may be brief;
they may not be omitted.

**Executive Summary** — four bullets, maximum:
- *Current state* — what the system does today in the area being changed
- *Goal* — what the change accomplishes (one sentence)
- *Key architectural constraint* — the most important invariant or rule that
  governs the approach
- *Estimated time* — honest range including verification time, not just
  implementation time

**Locked Decisions** — a table of design choices that are closed before coding
begins. Format: `# | Decision | Resolution | Rationale (optional)`. Decisions
carried from a prior session appear here with a "Carried from Session N —
closed" note. A locked decision cannot be re-opened without a plan version bump.
The purpose of this section is to prevent the session from relitigating settled
questions. If a decision is not in this table, it is open and must be resolved
before coding begins.

**Assumptions to Validate Before Starting** — a numbered list of things that
must be true in the live environment before any file is touched. Each item must
include a concrete verification step: a console command, a test run, or a named
manual check. If any assumption cannot be verified, the session stops.

**Pre-Coding Checklist** — a checkbox list derived directly from the assumptions
above. This is the final gate before the first file is opened for editing. No
task begins until every box is ticked.

**Phases and Tasks** — see §8.4 and §8.5.

**Decision Tree and Stop Conditions** — see §8.6.

**Known Risks** — a table: `Risk | Likelihood | Impact | Mitigation`. Document
risks even when their likelihood is "None" — explaining why a risk does not
apply is as valuable as the mitigation itself.

**Scope Boundaries** — two explicit lists: **In Scope** (✅) and **Out of
Scope** (❌). Both lists must be populated. Naming out-of-scope items is as
important as naming in-scope ones: an item not in the ❌ list cannot be ruled
out by a later session.

**ZAP — Files Still Needed** — a table of files required to complete tasks in
this plan that have not yet been attached. Any phase whose tasks depend on a
missing file is blocked until the file is provided.

---

### 8.4 Phase and Task Structure

A plan is divided into numbered phases. Each phase has a single, sentence-length
goal. Phases are sequenced so that earlier phases prove the foundations that
later phases depend on.

**Phase structure:**

| Element | Requirement |
|---|---|
| Goal | One sentence |
| Task Ordering Note | Which tasks must be done in sequence and why (gate conditions within the phase) |
| Tasks | Numbered as phase.task: 1.1, 1.2 … 2.1, 2.2 … |
| Success Criteria | The conditions under which the phase is complete |
| Deliverables | A checkbox list of files changed or created |
| Rollback Plan | What to revert and how if the phase is abandoned |

**Ordering principle:** Prove isolated components first; wire them into
dangerous zones last. The highest-risk change in a phase is always the *last*
task, not the first. An additive task (adding a new function) must precede the
integrative task that calls it from a dangerous-zone function. Do not proceed
to task N+1 until task N is verified.

---

### 8.5 Task Entry Requirements

Every task entry must contain all six of the following. Omitting any one of them
is a planning defect.

1. **Ownership declaration** — the exact file and function being changed.
   Confirm it is the correct owner of the concern per the module ownership table.
   Do not split a concern across tasks or modules to make a change fit.

2. **Dangerous zone flag** — an explicit ⚠ warning if the file or function is
   designated as dangerous. Reference the specific rule by number.

3. **Time estimate** — an honest range that includes verification time, not
   just implementation time.

4. **Minimum change description** — what is added or changed, stated precisely
   enough that it could be implemented without the session transcript. For code
   changes: show the before-state and after-state of the target block, not just
   a narrative description. The word "minimal" is not ornamental: do not propose
   a change larger than the problem requires.

5. **Invariant checkpoint** — for each invariant in the project rules that the
   change could plausibly affect, state the invariant by name and confirm it is
   preserved (✓), or explain why it is not triggered. Do not skip this for
   "simple" changes — simple changes are where invariant violations go
   undetected.

6. **Verification steps** — a numbered list of manual checks or automated tests
   that confirm the task is complete and has not regressed anything. Each step
   states the action and the expected result. Cover both the happy path and at
   least the most relevant failure path. "pytest green" is always one of the
   steps if a test suite exists.

---

### 8.6 Stop Conditions and Revert Protocol

A stop condition is a trigger, not a guideline. When one fires, the session
reverts the relevant task immediately and documents the result in the handover.
Stop conditions are never argued away in the session — if the condition was
wrong, fix the plan in the next session.

**Universal stop conditions** (apply to every plan regardless of domain):
- The test suite, if green before the session, turns red at any point
- Any invariant named in the project rules is violated by a change, even
  transiently
- An unexpected side effect is observed and its cause cannot be immediately
  identified

**Plan-specific stop conditions** are listed in each plan's Decision Tree
section. They must cover, at minimum: cases where a write fires unexpectedly,
an ordering invariant is violated, or a sole-call-site constraint gains a second
call site.

**Decision Tree format** — every plan must include an ASCII flowchart:

```
START → PRE-CODING CHECKLIST
  ├─ [gate fails]   → STOP: [reason and action]
  └─ [all pass]     → PHASE 1
PHASE 1
  ├─ [check fails]  → REVERT task N; [action]
  └─ [all pass]     → PHASE 2
...
```

The flowchart is followed by a prose "STOP immediately if:" list. Each entry
is a single observable condition, not a category.

**Rollback plan** — every phase must describe exactly which lines to revert
and confirm what state the codebase returns to after the revert. "Revert the
file" is not a rollback plan. "Remove the added block (lines X–Y); no other
file is affected; the function returns to the state it was in before task N.M"
is a rollback plan.

---

### 8.7 Plan–Handover Relationship

The plan and the session handover are a closed loop. Neither replaces the other.

- The **plan** is written before coding begins. It is the source of truth for
  what the session intends to do.
- The **handover** is written after coding ends. It records what actually
  happened: which lines changed, which verification steps passed, which stop
  conditions fired, and what remains open.
- The **next session** reads both — the plan (intent) and the handover (current
  state) — before doing anything. If either is missing, apply the
  Zero-Assumption Protocol and ask for it explicitly.

A plan is not invalidated by the session that executes it. If the session
diverges from the plan — because a stop condition fired, a phase was abandoned,
or new information changed the approach — the divergence is recorded in the
handover and the plan is updated with a version bump before the next session
begins.

The plan version must appear in the handover's Artefacts table.

---

### 8.8 Scope Rules

- **One session, one plan domain.** A session executing a plan must not
  simultaneously make changes outside the plan's scope, however small (§7.4).
  If an adjacent issue is discovered, document it in the handover and address
  it in a separate session with its own plan.
- **No scaffolding toward out-of-scope items.** A task must not introduce code,
  interfaces, or data structures whose only purpose is to support a feature that
  is explicitly out of scope. Out-of-scope items belong in a future plan.
- **Version bump on scope change.** If the scope of a plan changes after it is
  written — even by a single task — the plan version increments (1.0 → 1.1)
  and the change is noted in the plan header.
