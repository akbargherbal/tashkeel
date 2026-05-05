# Session 10 Handover

## 1. What We Did

- Implemented the **Runtime Project Folder Selector** in full, exactly as
  specified in the Session 9 Feature Plan.
- No planning changes — pure implementation session.

---

## 2. Artefacts Produced

| File | Change |
| :--- | :--- |
| `src/app.py` | Changes A–F: startup config reader, three new routes, _OUTPUT_DIR removed |
| `src/static/api.js` | Changes G–I: `browseFolder()`, `setFolder()`, `loadFolderModal()` |
| `src/templates/index.html` | Changes J–L: sidebar header button, modal HTML+CSS, DOMContentLoaded call |
| `Session_10_Handover.md` | This file |

**`.gitignore`** — add `config.json` manually (one line); file was not supplied
this session so the edit could not be applied. Add it under the existing entries:
```
config.json
config.tmp
```

---

## 3. Key Changes — Exact Lines

### `app.py`

| Change | What changed |
| :--- | :--- |
| A + E | Replaced `ROOT_DIR` one-liner (old line 59) with `_CONFIG_PATH` constant + `_load_root_dir()` function + `ROOT_DIR = _load_root_dir()`. Priority: config.json > TASHKEEL_ROOT > cwd. |
| F | Removed `_OUTPUT_DIR: Path = ROOT_DIR / "_diac_output"` module-level constant (it was dead code — neither `scan_directory()` nor `api_mark_complete()` referenced it). Added explanatory comment in its place. |
| B | Added `GET /api/browse` — tkinter folder picker with `try/except` fallback. |
| C | Added `POST /api/set_folder` — `global ROOT_DIR`, `os.path.isdir()` validation, atomic config.json write, returns file list. |
| D | Added `GET /api/current_folder` — trivial, returns `str(ROOT_DIR)`. |
| — | Entry point logger: added `CONFIG: _CONFIG_PATH` line. |

All three new routes carry a docstring explaining their `_resolve_safe()` exemption, per the Session 9 decision and RULES.md §3.8.

### `api.js`

Three new methods added before the Error Banner section:
- `browseFolder()` — `GET /api/browse` wrapper.
- `setFolder(path)` — `POST /api/set_folder` wrapper.
- `loadFolderModal()` — wires all five elements (openBtn, browseBtn, loadBtn,
  cancelBtn, backdrop). On successful Load: closes modal, resets `editorState`
  to idle defaults (§3.3 — no new fields), clears document pane, disables Mark
  Complete / Reset, repopulates sidebar inline from `result.files`.

### `index.html`

| Change | What changed |
| :--- | :--- |
| J-css | `#sidebar-header` gained `display:flex; align-items:center; justify-content:space-between`. New `#btn-open-folder` style block added. New `#folder-modal` and sub-element CSS block added. |
| J-html | `<div id="sidebar-header">Files</div>` → `<div id="sidebar-header"><span>Files</span><button id="btn-open-folder">Open Folder</button></div>` |
| K | Modal HTML block added before `<!-- ===== SCRIPTS ===== -->`. IDs: `folder-modal`, `folder-modal-box`, `folder-modal-input`, `folder-modal-browse`, `folder-modal-error`, `folder-modal-cancel`, `folder-modal-load`. |
| L | `await API.loadFolderModal();` added immediately after `await API.loadFileTree();` in `DOMContentLoaded`. |

**Script load order: unchanged.**

---

## 4. Current Project State

| Item | State |
| :--- | :--- |
| All Phases (1–5) | ✅ Complete and verified (unchanged) |
| v1.0.0 tag | ✅ Safe checkpoint (unchanged) |
| Runtime Folder Selector | ✅ Implemented this session |
| `config.json` | Does not exist yet — created on first use of "Load" button |
| `.gitignore` | ⚠ `config.json` entry must be added manually (see §2) |

---

## 5. Verification Checklist (run before closing)

- [ ] Launch from `src/` with no env var and no config.json → sidebar shows files from `src/` (expected: dev artifacts visible — this is the correct pre-feature-use state)
- [ ] Click "Open Folder" → modal opens, input pre-filled with current ROOT_DIR
- [ ] Click "Browse…" → native OS folder picker opens → selection populates input
- [ ] Click "Load" with a valid path → modal closes, sidebar repopulates, document pane shows empty state, Mark Complete / Reset disabled
- [ ] Click "Load" with a non-existent path → inline error shown, modal stays open
- [ ] Restart server → folder persists from config.json, correct files shown on load
- [ ] Cancel button closes modal, no state change
- [ ] After folder change, open file state is fully cleared (empty state visible)
- [ ] All existing editor functionality unchanged after folder change

---

## 6. Known Issues / Watch Points

- **`.gitignore`** must be updated manually — see §2. Until it is, config.json may be committed accidentally.
- **tkinter on WSL**: `try/except` handles this — "Browse…" shows inline error and manual input remains available.
- **`editorState.status = 'idle'`**: the folder-change reset uses `'idle'` per RULES.md §3.3 and the Feature Plan. The existing Reset handler uses `'untouched'` (possible pre-existing inconsistency — not touched this session per minimum-touch rule).
- **All Session 8 watch points remain open** (`?` key on Arabic keyboard layouts; `classifyAllWords()` performance on large files; completion banner z-index).
- **plan/spec files deleted from working tree** — noted in Session 8, still open.

---

## Session Handover Protocol

This section is the standing protocol for all future sessions. Do not remove it
from any handover document — always include it in full.

At the end of every session, produce a Session_N_Handover.md file before
closing. The file must fit on one page and cover: (1) What we did, (2) Artefacts
produced, (3) Key decisions locked, (4) Current project state, (5) Next session
work items, (6) Known issues / watch points.

Rules: One page. Cut prose, not coverage. Do not count this protocol block
toward the page limit — always include it in full. Produce the handover even if
the session ended early or a phase was abandoned mid-way. The handover replaces
memory — write it as if handing off to someone who has the plan and spec but has
never seen the session conversation. File naming: Session_N_Handover.md where N
increments per session. The incoming session must read the latest handover plus
RULES.md before doing anything else. If none are attached, ask for them
explicitly before proceeding. Keep all handover files alongside the project
source files.
