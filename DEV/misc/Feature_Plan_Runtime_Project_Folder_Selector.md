# Session 9 — Feature Plan: Runtime Project Folder Selector

## 1. Problem Statement

`ROOT_DIR` is fixed at server startup via `TASHKEEL_ROOT` env var, defaulting to `Path.cwd()`. When launched from `src/`, the sidebar fills with dev artifacts and `.diac_cursor.json` files pollute the codebase. There is no way to change the working directory without restarting the server.

---

## 2. Scope & Constraints (from RULES.md)

| Constraint                            | Impact                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §1 Module ownership                   | New backend route lives in `app.py`. New UI lives in `index.html` (shell) + `api.js` (HTTP call). No other modules touched.                                     |
| §3.1 Original never modified          | Unaffected — we're only changing which directory is scanned                                                                                                     |
| §3.3 `editorState` schema locked      | `filePath` must be cleared/nulled when folder changes. No new fields needed.                                                                                    |
| §3.8 `_resolve_safe()` on every route | The new `/api/set_folder` route does **not** use `_resolve_safe()` — it _sets_ `ROOT_DIR` itself. But it must validate with `os.path.isdir()` before accepting. |
| §5 Out of scope                       | Nothing here conflicts                                                                                                                                          |
| §7 Maintenance protocol               | This is a planning session — no code changes today                                                                                                              |

---

## 3. Architecture Decision

### The tkinter question — final verdict

The approach from your prior project is sound **for this app**. Rationale:

- This app is **localhost-only by design**. The README says so explicitly. The tkinter risk (headless server, remote deploy) is irrelevant here.
- `tkinter.filedialog` is stdlib — zero new dependencies.
- The `try/except` fallback to manual text input means it degrades gracefully on any machine where tkinter's display backend is unavailable (e.g. WSL without an X server).
- The only alternative that gives Flask a real filesystem path is tkinter. The `<input webkitdirectory>` approach gives JS file _contents_, not a path — Flask can't use it.

**Decision: adopt the tkinter pattern with graceful fallback.**

---

## 4. What Changes — Minimum Touch Surface

| File          | Change                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.py`      | (A) Make `ROOT_DIR` a module-level mutable variable. (B) Add `GET /api/browse` route (tkinter picker). (C) Add `POST /api/set_folder` route (validates + sets ROOT_DIR + persists to config.json). (D) On startup, read `config.json` to restore last ROOT_DIR. (E) Update `_OUTPUT_DIR` whenever ROOT_DIR changes. |
| `api.js`      | (F) Add `API.browseFolder()`. (G) Add `API.setFolder(path)`. (H) Add `API.loadFolderModal()` — renders the modal and wires the two buttons.                                                                                                                                                                         |
| `index.html`  | (I) Add "Open Folder" button to the sidebar header. (J) Add the modal HTML (hidden by default). (K) On `DOMContentLoaded`, call `API.loadFolderModal()` to initialize.                                                                                                                                              |
| `config.json` | (L) New runtime file (not in source tree). Stores `{"root_dir": "..."}`. Lives alongside `app.py`. Git-ignored.                                                                                                                                                                                                     |

**Nothing else is touched.** `diacritic_engine.py`, all other JS modules, `editor-state.js` schema — untouched.

---

## 5. Detailed Behaviour Specification

### 5.1 Startup sequence (app.py)

```
1. Look for config.json alongside app.py
2. If it exists and contains a valid "root_dir" → use it as ROOT_DIR
3. Otherwise fall back to TASHKEEL_ROOT env var → then Path.cwd()
4. Log the resolved ROOT_DIR at startup (already done)
```

Priority order: `config.json` > `TASHKEEL_ROOT` env var > `cwd`.

### 5.2 `GET /api/browse` (new route)

```
1. Try: import tkinter, open filedialog.askdirectory()
2. If user picks a folder → return {"path": "<absolute path>"}
3. If user cancels → return {"path": null}
4. Except (tkinter unavailable / display error) → return {"error": "tkinter unavailable"}
```

The frontend uses the returned path to pre-fill the text input. It does **not** set ROOT_DIR — that is `set_folder`'s job.

### 5.3 `POST /api/set_folder` (new route)

```
Request: {"path": "<absolute or relative path>"}

1. Resolve to absolute path
2. Validate: os.path.isdir() — return 400 if not a directory
3. Set ROOT_DIR (module-level) to the resolved Path
4. Recompute _OUTPUT_DIR = ROOT_DIR / "_diac_output"
5. Persist to config.json (write-then-rename for atomicity, same pattern as _write_cursor)
6. Call scan_directory(ROOT_DIR) and return the file list
   → return {"ok": true, "files": [...], "root_dir": "<path>"}
```

Note: `_resolve_safe()` is **not** used here because `_resolve_safe()` validates paths _relative to ROOT_DIR_ — but this route _is_ setting ROOT_DIR. Validation is `os.path.isdir()` instead. This distinction must be documented in the route docstring.

### 5.4 Frontend modal behaviour

**Trigger:** "Open Folder" button in sidebar header.

**Modal contains:**

- Text input pre-filled with current ROOT_DIR (fetched on modal open via a new `GET /api/current_folder` route — see §5.5)
- "Browse…" button → calls `GET /api/browse` → fills text input with returned path (or shows inline error if tkinter unavailable)
- "Load" button → calls `POST /api/set_folder` → on success: closes modal, calls `API.loadFileTree()`, clears any open file state
- "Cancel" button → closes modal, no state change
- Inline validation message if path is invalid

**On successful folder load:**

1. Close modal
2. `window.currentFilePath = null`
3. `editorState.status = 'idle'` (existing valid value per §3.3)
4. Hide document pane / show empty state
5. Disable Mark Complete and Reset buttons
6. Call `API.loadFileTree()` to repopulate sidebar

### 5.5 `GET /api/current_folder` (new route, trivial)

```
Returns: {"root_dir": "<current ROOT_DIR as string>"}
```

Needed so the modal can pre-fill the text input with the currently active folder.

---

## 6. New Routes Summary

| Route                 | Method | Owner    | Purpose                                                |
| --------------------- | ------ | -------- | ------------------------------------------------------ |
| `/api/browse`         | GET    | `app.py` | Opens tkinter folder picker, returns chosen path       |
| `/api/set_folder`     | POST   | `app.py` | Validates + sets ROOT_DIR, persists, returns file list |
| `/api/current_folder` | GET    | `app.py` | Returns current ROOT_DIR string for modal pre-fill     |

---

## 7. config.json

```json
{ "root_dir": "C:\\Users\\you\\manuscripts" }
```

- Lives at `Path(__file__).parent / "config.json"` (alongside `app.py`)
- Written atomically (write-to-tmp then `os.replace`)
- Added to `.gitignore` — it is a per-machine runtime artifact, not source
- If malformed/missing, startup silently falls back (never crashes)

---

## 8. Invariants — Verification

| Invariant                             | Status after this change                                         |
| ------------------------------------- | ---------------------------------------------------------------- |
| §3.1 Original never modified          | ✅ Unaffected                                                    |
| §3.2 canonical_cluster scope          | ✅ Unaffected                                                    |
| §3.3 editorState schema locked        | ✅ No new fields — folder change resets to existing `idle` state |
| §3.5 Word tokenization alignment      | ✅ Unaffected                                                    |
| §3.8 `_resolve_safe()` on every route | ✅ New routes documented as exempt with explicit reasoning       |
| All other invariants                  | ✅ Unaffected                                                    |

---

## 9. What Is Explicitly Out of Scope for This Feature

- No change to tokenization, diacritic logic, or any editor module
- No "recent folders" list (can be v2)
- No relative path support in config.json (always stored as absolute)
- No folder _creation_ — only existing directories accepted

---

## 10. Session 9 Handover Note

This is a **planning-only session**. No code was changed. The implementation above is the agreed spec for Session 10. The implementer must:

1. Read `RULES.md` + this plan before writing a single line
2. Make changes in the order: `app.py` first, then `api.js`, then `index.html`
3. Test: launch from `src/`, verify sidebar is empty (no dev files shown), open a folder, verify file tree populates, restart app, verify folder persists
4. Produce `Session_10_Handover.md`
