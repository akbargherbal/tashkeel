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
