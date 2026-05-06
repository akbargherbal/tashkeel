# Testing Phased Plan — Arabic Diacritics Editor

```
Plan version:           1.0
Based on:               RULES.md, Session_33_Handover.md, TESTING_EXECUTIVE_SUMMARY.md
Current codebase state: v1.2.1 (all features shipped; no open regressions)
Source files reviewed:  app.py, diacritic_engine.py, test_diacritic_engine.py,
                        diacritic-engine.js, navigation.js, soft-rules.js,
                        visual-hints.js, character-mode.js, renderer.js,
                        api.js, completion.js, editor-state.js, index.html
```

---

## Executive Summary

- **Current state:** 17 pytest tests cover `diacritic_engine.py` only. Nine
  JavaScript modules and all Flask routes have zero automated coverage. All
  post-session-5 verification has been manual.
- **Goal:** Build a complete, three-tier automated test suite: pytest for Flask
  routes (Tier 1), Vitest + jsdom for JS pure-logic functions (Tier 2), and
  Playwright for browser-level invariants that neither tier can reach (Tier 3).
- **Key architectural constraint:** All JS exports are `window.*` globals loaded
  via `<script>` tags in a fixed order. No ES modules, no bundler. The Tier 2
  jsdom setup file must replicate that exact load order or all `window.*`
  dependencies will be undefined at test time.
- **Estimated time:** Tier 1: 3–4 h. Tier 2: 5–7 h (including one-time setup).
  Tier 3: 3–4 h. Total: 11–15 h across three sessions.

---

## Locked Decisions

| # | Decision | Resolution | Rationale |
|---|----------|------------|-----------|
| 1 | Tier 1 toolchain | Flask `app.test_client()` + existing pytest | No new tooling; reuses the already-green infrastructure |
| 2 | Tier 2 toolchain | Vitest + jsdom | ESM-native, no transformation config, first-class jsdom; carried from Session 33 — closed |
| 3 | Tier 3 toolchain | Playwright (Python API) | Python API keeps toolchain in one language; `page.on('request')` enables Space-no-write assertion; carried from Session 33 — closed |
| 4 | Tier ordering | Tier 1 → Tier 2 → Tier 3 | Each tier is a separate plan phase; tiers must not be combined |
| 5 | No production-module refactoring | Test harness fits the modules, not the reverse | Explicitly out of scope per ES §5 and RULES.md §8.8 |
| 6 | Tier 2 setup approach | Single `vitest.setup.js` that sets `global.window = global` then `require()`s each JS file in `index.html` script order | Any other approach breaks `window.*` dependency chain |
| 7 | Tier 3 scope | Tightly bounded to the 5 invariants listed in ES §4 | Do not expand until Tiers 1–2 are fully green |
| 8 | Test file naming | `test_app.py` (Tier 1), `*.test.js` (Tier 2), `test_e2e_*.py` (Tier 3) | Consistent with existing `test_diacritic_engine.py` naming convention |
| 9 | Fixture strategy (Tier 1) | `tmp_path` pytest fixture for file system; `app.test_client()` for routes; no real ROOT_DIR mutation in tests | Mirrors existing T08–T14 fixture patterns |
| 10 | Tier 3 Flask instance | Start a real Flask dev server on a free port (`pytest-flask` or `subprocess`) before each Playwright session | Playwright requires a live HTTP server; test_client() is insufficient |

---

## Assumptions to Validate Before Starting

1. **Existing tests still green.** Run `cd src && pytest test_diacritic_engine.py -v`.
   Expected: 17 passed, 0 failed. If any fail, stop and diagnose before adding new tests.

2. **pip install works.** Run `pip install pytest-flask --break-system-packages` (or
   in the project venv) and confirm it installs without error. `pytest-flask` is
   needed for the `client` fixture in Tier 1.

3. **Node / npm available for Tier 2.** Run `node --version` and `npm --version`.
   Expected: Node ≥ 18, npm ≥ 9. Tier 2 is blocked until these pass.

4. **Playwright available for Tier 3.** Run `pip install playwright --break-system-packages`
   and `playwright install chromium`. Tier 3 is blocked until this passes.

5. **`data/SAMPLE_TEXTS/` present.** The Tier 1 `test_app.py` fixture references
   `data/SAMPLE_TEXTS/sample_text_02.txt` (same as existing T08 fixture). Confirm
   the file exists at `src/data/SAMPLE_TEXTS/sample_text_02.txt`.

6. **`keymap.json` present.** Confirm `src/keymap.json` exists and is valid JSON.
   `GET /api/config` tests depend on it for the "present keymap" case.

---

## Pre-Coding Checklist

Before the first file is created or opened for editing in any phase:

- [ ] `pytest test_diacritic_engine.py -v` → 17 passed
- [ ] `pip install pytest-flask` → no errors (Tier 1 gate)
- [ ] `node --version` → ≥ 18 (Tier 2 gate)
- [ ] `npm --version` → ≥ 9 (Tier 2 gate)
- [ ] `pip install playwright && playwright install chromium` → no errors (Tier 3 gate)
- [ ] `src/data/SAMPLE_TEXTS/sample_text_02.txt` exists
- [ ] `src/keymap.json` exists and is valid JSON

Tiers 2 and 3 are individually gated — if the Node check fails, Tier 1 still proceeds.

---

## Phase 1 — Tier 1: Extend pytest to cover Flask routes

**Goal:** Achieve automated coverage of every Flask route and every Python helper
function in `app.py` using only the existing pytest infrastructure plus `pytest-flask`.

**Task ordering note:** Tasks 1.1–1.3 cover pure Python helpers (no Flask client
needed). Tasks 1.4–1.10 cover Flask routes (require `client` fixture). Complete 1.1
first; if it reveals a helper behaviour different from what the plan assumes, stop and
update the plan before proceeding to 1.4.

### Task 1.1 — `_resolve_safe()` path traversal tests

**Ownership:** `test_app.py` (new file) → tests `_resolve_safe()` in `app.py`.
`app.py` is the correct owner per module ownership table.

**Dangerous zone flag:** None. `_resolve_safe()` is a pure helper with no side effects.

**Time estimate:** 30–45 min including verification.

**Minimum change description:**

Create `src/test_app.py`. Import `app` and `_resolve_safe` from `app`. Set `ROOT_DIR`
to a known `tmp_path` before each test.

New test class `TestResolveSafe` with these cases:
- `T_RS_01` — normal relative path inside ROOT_DIR → returns resolved absolute path
- `T_RS_02` — `../` traversal attempt → raises `ValueError`
- `T_RS_03` — absolute path outside ROOT_DIR → raises `ValueError`
- `T_RS_04` — path that resolves to exactly ROOT_DIR itself → raises `ValueError`
  (ROOT_DIR is not "below" itself)
- `T_RS_05` — nested subdirectory path → allowed, returns correct absolute path

Before-state: `_resolve_safe` is called in production but never tested.
After-state: 5 tests covering the security-critical guard.

**Invariant checkpoint:**
- §3.1 (original file never modified): not triggered — no file writes.
- §3.8 (`_resolve_safe()` on every route): these tests *verify* §3.8 is enforced.
- §3.2, §3.3, §3.4, §3.5, §3.6, §3.7: not triggered.

**Verification steps:**
1. Run `pytest test_app.py::TestResolveSafe -v` → 5 passed.
2. Introduce a deliberate traversal string `"../../etc/passwd"` in T_RS_02 and confirm
   `ValueError` is raised (not `FileNotFoundError` or silent success).
3. Run the full suite `pytest -v` → 22 passed (17 existing + 5 new), 0 failed.

---

### Task 1.2 — `get_file_status()` three-state tests

**Ownership:** `test_app.py` → tests `get_file_status()` in `app.py`.

**Dangerous zone flag:** None.

**Time estimate:** 20–30 min.

**Minimum change description:**

New test class `TestGetFileStatus` with:
- `T_GFS_01` — no working copy exists → `'untouched'`
- `T_GFS_02` — working copy exists, no sidecar → `'in_progress'`
- `T_GFS_03` — working copy exists, sidecar has `status: 'complete'` → `'complete'`
- `T_GFS_04` — working copy exists, sidecar has `status: 'in_progress'` → `'in_progress'`
- `T_GFS_05` — working copy exists, sidecar JSON is corrupt → `'in_progress'`
  (corrupt sidecar falls back to defaults, which don't have `status: 'complete'`)

Each test uses `tmp_path` to create the relevant file(s).

**Invariant checkpoint:** §3.1: no original file is written. All others: not triggered.

**Verification steps:**
1. `pytest test_app.py::TestGetFileStatus -v` → 5 passed.
2. Manually corrupt the sidecar in T_GFS_05 fixture (write `"not json"`) and confirm
   the function returns `'in_progress'` not `'complete'` or an exception.
3. Full suite → 27 passed, 0 failed.

---

### Task 1.3 — `scan_directory()` exclusion rule tests

**Ownership:** `test_app.py` → tests `scan_directory()` in `app.py`.

**Dangerous zone flag:** None.

**Time estimate:** 30–45 min.

**Minimum change description:**

New test class `TestScanDirectory`. Each test builds a minimal directory tree under
`tmp_path` and asserts the returned list.

- `T_SD_01` — file with `diac_` prefix excluded, eligible original included
- `T_SD_02` — `.diac_cursor.json` sidecar excluded
- `T_SD_03` — file inside `_diac_output/` subtree excluded
- `T_SD_04` — `.log`, `.py` non-eligible extensions excluded
- `T_SD_05` — both `.txt` and `.md` files included (eligible extensions)
- `T_SD_06` — empty directory → empty list returned
- `T_SD_07` — combined fixture: all four exclusion rules fire simultaneously;
  only the single eligible original is returned

**Invariant checkpoint:** §3.1: no original file is written. All others: not triggered.

**Verification steps:**
1. `pytest test_app.py::TestScanDirectory -v` → 7 passed.
2. In T_SD_07, assert the returned list has exactly 1 entry.
3. Full suite → 34 passed, 0 failed.

---

### Task 1.4 — `GET /api/config` tests

**Ownership:** `test_app.py` → tests `api_config()` route in `app.py`.
Requires a `client` pytest fixture using `app.test_client()`.

**Dangerous zone flag:** None.

**Time estimate:** 20–30 min.

**Minimum change description:**

Add module-level `@pytest.fixture` named `client`:
```python
@pytest.fixture()
def client(tmp_path, monkeypatch):
    import app as app_module
    monkeypatch.setattr(app_module, 'ROOT_DIR', tmp_path)
    monkeypatch.setattr(app_module, 'KEYMAP_PATH', tmp_path / 'keymap.json')
    app_module.app.config['TESTING'] = True
    with app_module.app.test_client() as c:
        yield c
```

New test class `TestApiConfig`:
- `T_CFG_01` — `keymap.json` present and valid → response has `keymap` key with contents
- `T_CFG_02` — `keymap.json` absent → response has `keymap: {}`
- `T_CFG_03` — `keymap.json` present but malformed JSON → response has `keymap: {}`

**Invariant checkpoint:** §3.3 (`editorState` schema): not applicable (Python-only test).
§3.8: route does not accept a user-supplied file path; `KEYMAP_PATH` is a server-side
config — not in scope of `_resolve_safe()`. All others: not triggered.

**Verification steps:**
1. `pytest test_app.py::TestApiConfig -v` → 3 passed.
2. Confirm T_CFG_03 does not raise an exception in the test process (the route must
   swallow the parse error silently).
3. Full suite → 37 passed, 0 failed.

---

### Task 1.5 — `GET /api/files` tests

**Ownership:** `test_app.py` → tests `api_files()` route.

**Dangerous zone flag:** None.

**Time estimate:** 15–20 min.

**Minimum change description:**

New test class `TestApiFiles`:
- `T_FILES_01` — empty ROOT_DIR → `{"files": []}`
- `T_FILES_02` — one eligible `.txt` → list with one entry, correct path and status
- `T_FILES_03` — mix of eligible and excluded files → only eligible files returned

**Invariant checkpoint:** All non-applicable. The route reads; it does not write.

**Verification steps:**
1. `pytest test_app.py::TestApiFiles -v` → 3 passed.
2. Full suite → 40 passed, 0 failed.

---

### Task 1.6 — `POST /api/open` tests

**Ownership:** `test_app.py` → tests `api_open()` route.

**Dangerous zone flag:** None. Route creates a working copy but does not touch
the original — §3.1 is preserved by the route's own design, not by the tests.

**Time estimate:** 45–60 min.

**Minimum change description:**

New test class `TestApiOpen`. Each test writes a small UTF-8 Arabic text fixture to
`tmp_path / 'sample.txt'` before calling the route.

- `T_OPEN_01` — first open of a file → working copy created, response has `lines`,
  `cursor`, `status: 'in_progress'`, `conflict_detected: false`
- `T_OPEN_02` — re-open of a file with existing sidecar → cursor is restored from sidecar
- `T_OPEN_03` — mtime conflict: manually modify working copy between two opens →
  second open returns `conflict_detected: true`
- `T_OPEN_04` — `file_path` missing from request body → 400 error
- `T_OPEN_05` — `file_path` outside ROOT_DIR (traversal) → 400 error
- `T_OPEN_06` — `file_path` points to a non-existent file → 404 error
- `T_OPEN_07` — `untouched` status transitions to `in_progress` on first open

**Invariant checkpoint:**
- §3.1: `api_open()` never writes to `original`; it only creates `diac_<filename>`.
  Test T_OPEN_01 must assert that `original` bytes are unchanged after the call.
- §3.8: T_OPEN_05 directly verifies that `_resolve_safe()` is enforced.
- All others: not triggered.

**Verification steps:**
1. `pytest test_app.py::TestApiOpen -v` → 7 passed.
2. In T_OPEN_01, assert the original file bytes are unchanged after the open call.
3. Full suite → 47 passed, 0 failed.

---

### Task 1.7 — `POST /api/write_char` tests

**Ownership:** `test_app.py` → tests `api_write_char()` route.
This is the highest-risk route: a silent failure here causes UI/file divergence.

**Dangerous zone flag:** ⚠ Highest-risk route in the app (ES §2.1). The failure
contract (§3.7 + app.py docstring) is the most critical behaviour to verify.

**Time estimate:** 45–60 min.

**Minimum change description:**

New test class `TestApiWriteChar`. Fixture: a `tmp_path` directory with
`sample.txt` (small Arabic text) and its working copy `diac_sample.txt`.

- `T_WC_01` — valid request → 200 `{"ok": true}`, file bytes changed at target cluster
- `T_WC_02` — one or more required fields missing → 400 error
- `T_WC_03` — `file_path` outside ROOT_DIR → 400 error
- `T_WC_04` — working copy does not exist (only original present) → 400 error
- `T_WC_05` — `line_idx` out of range → 400 error (IndexError from engine)
- `T_WC_06` — `word_idx` out of range → 400 error
- `T_WC_07` — `char_idx` out of range → 400 error
- `T_WC_08` — successful write: other clusters on the edited line are byte-identical
  (byte-preservation contract, §3.2)

For T_WC_08: read the working copy bytes before and after; assert every cluster on the
edited line except the target is byte-identical. This is the most important
post-write assertion.

**Invariant checkpoint:**
- §3.1: T_WC_01 must assert the *original* file (`sample.txt`) is unchanged after the write.
- §3.2 (canonical_cluster scope): T_WC_08 directly verifies that untouched clusters
  on the same line are byte-preserved (the contract `canonical_cluster()` is ONLY
  called on the mutated cluster).
- §3.7 (optimistic revert contract): The route's non-200 responses (T_WC_02–T_WC_07)
  return error JSON so the frontend can detect and revert. These tests verify that
  the contract signal (non-200) is sent.
- §3.8: T_WC_03 directly verifies `_resolve_safe()` enforcement.

**Verification steps:**
1. `pytest test_app.py::TestApiWriteChar -v` → 8 passed.
2. In T_WC_01, hex-dump the working copy at the target position and confirm it matches
   `new_cluster.encode('utf-8')`.
3. Full suite → 55 passed, 0 failed.

---

### Task 1.8 — `POST /api/save_cursor` tests

**Ownership:** `test_app.py` → tests `api_save_cursor()` route.

**Dangerous zone flag:** None. The critical invariant here is the field-merge
constraint: `status` and `last_seen_mtime` must not be overwritten.

**Time estimate:** 25–35 min.

**Minimum change description:**

New test class `TestApiSaveCursor`:
- `T_SC_01` — valid request updates `line`, `word`, `char` in sidecar
- `T_SC_02` — `status` field in sidecar is NOT overwritten by `save_cursor`
  (send `{"status": "complete"}` in the cursor payload; assert sidecar `status`
  is still `'in_progress'`)
- `T_SC_03` — `last_seen_mtime` in sidecar is NOT overwritten by `save_cursor`
  (the route updates `last_seen_mtime` from the working copy's actual mtime,
  not from the incoming payload)
- `T_SC_04` — missing `file_path` or `cursor` → 400

**Invariant checkpoint:**
- §3.3 (`editorState` schema): not applicable (Python-only test).
- The `save_cursor` merge logic (lines 480–484 of `app.py`) only merges
  `"line"`, `"word"`, `"char"` keys. T_SC_02 and T_SC_03 directly verify this.
- All others: not triggered.

**Verification steps:**
1. `pytest test_app.py::TestApiSaveCursor -v` → 4 passed.
2. In T_SC_02, read the sidecar JSON after the call and assert `status` is `'in_progress'`.
3. Full suite → 59 passed, 0 failed.

---

### Task 1.9 — `POST /api/mark_complete` tests

**Ownership:** `test_app.py` → tests `api_mark_complete()` route.

**Dangerous zone flag:** None. The critical correctness requirement is that the
output file mirrors the subdirectory structure under `_diac_output/`.

**Time estimate:** 25–35 min.

**Minimum change description:**

New test class `TestApiMarkComplete`:
- `T_MC_01` — happy path: output file appears at `_diac_output/<rel_path>`,
  sidecar `status` → `'complete'`, response has `output_path`
- `T_MC_02` — subdirectory mirroring: file at `subdir/sample.txt` → output at
  `_diac_output/subdir/sample.txt`
- `T_MC_03` — working copy absent → 400
- `T_MC_04` — `file_path` outside ROOT_DIR → 400

**Invariant checkpoint:**
- §3.1: T_MC_01 must assert the *original* file is unchanged after mark_complete.
- §3.8: T_MC_04 verifies `_resolve_safe()` enforcement.
- All others: not triggered.

**Verification steps:**
1. `pytest test_app.py::TestApiMarkComplete -v` → 4 passed.
2. In T_MC_01, `assert output_path.read_bytes() == working_copy.read_bytes()` (byte-exact copy).
3. Full suite → 63 passed, 0 failed.

---

### Task 1.10 — `POST /api/reset` tests

**Ownership:** `test_app.py` → tests `api_reset()` route.

**Dangerous zone flag:** None. Critical: `_diac_output/` must be untouched by reset.

**Time estimate:** 20–25 min.

**Minimum change description:**

New test class `TestApiReset`:
- `T_RST_01` — happy path: working copy deleted, sidecar deleted, response `{"status": "untouched"}`
- `T_RST_02` — `_diac_output/` copy (if present) is NOT deleted after reset
- `T_RST_03` — idempotent: reset with no working copy → 200 (no crash)
- `T_RST_04` — `file_path` outside ROOT_DIR → 400

For T_RST_02: create an `_diac_output/sample.txt` before calling reset, then assert it
still exists after.

**Invariant checkpoint:**
- §3.1: T_RST_01 must assert the *original* file is still present after reset.
- §3.8: T_RST_04 verifies enforcement.
- All others: not triggered.

**Verification steps:**
1. `pytest test_app.py::TestApiReset -v` → 4 passed.
2. In T_RST_02, assert `_diac_output/sample.txt` byte count is unchanged.
3. Full suite → 67 passed, 0 failed.

---

### Phase 1 Success Criteria

- All 10 task test classes pass: `pytest test_app.py -v` → **50 passed, 0 failed.**
- Full suite `pytest -v` (both files) → **67 passed, 0 failed.**
- No production file (`app.py`, `diacritic_engine.py`) has been modified.

### Phase 1 Deliverables

- [x] `src/test_app.py` — new file, ~50 test functions across 10 classes

### Phase 1 Rollback Plan

`test_app.py` is a new file with no dependencies on production modules beyond imports.
If Phase 1 is abandoned mid-way, delete `src/test_app.py`. No other file is affected.
The existing `test_diacritic_engine.py` suite returns to its prior state of 17 tests.

---

## Phase 2 — Tier 2: JavaScript unit tests in Vitest + jsdom

**Goal:** Achieve automated coverage of the pure-logic JavaScript functions across
`diacritic-engine.js`, `soft-rules.js`, `visual-hints.js`, `navigation.js`, and
`renderer.js` using Vitest with a jsdom environment.

**Task ordering note:** Task 2.1 (tooling setup) is a hard gate. No JS test can be
written or run until the setup file successfully loads all `window.*` globals without
errors. Verify Task 2.1 completely before writing any test in Tasks 2.2–2.7. Within
Tasks 2.2–2.7, each task is independent — they may be done in any order after 2.1.

---

### Task 2.1 — One-time Vitest + jsdom tooling setup ⚠ Most failure-prone task

**Ownership:** New files: `src/package.json`, `src/vitest.config.js`,
`src/vitest.setup.js`. No production files are touched.

**Dangerous zone flag:** ⚠ References RULES.md §2 (index.html script load order).
The setup file must replicate the `<script>` order from `index.html` exactly:
`api.js → editor-state.js → renderer.js → navigation.js → diacritic-engine.js →
character-mode.js → visual-hints.js → soft-rules.js → completion.js`
(Tailwind and font CDN scripts are skipped — they are UI-only and unavailable in jsdom.)

**Time estimate:** 60–90 min including debugging.

**Minimum change description:**

**`src/package.json`** (new):
```json
{
  "name": "tashkeel-tests",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "jsdom": "^24.0.0",
    "@vitest/coverage-v8": "^2.0.0"
  }
}
```

**`src/vitest.config.js`** (new):
```js
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    globals: true,
  },
});
```

**`src/vitest.setup.js`** (new — most critical file in Tier 2):
```js
// Must replicate index.html <script> load order exactly.
// See RULES.md §2 (index.html script load order) and Session 33 Watch Points.
import { readFileSync } from 'fs';
import { resolve } from 'path';

const load = (rel) => {
  const src = readFileSync(resolve(__dirname, rel), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function('window', src)(global);
};

// Minimal DOM stubs required so module-level code in each file does not throw.
global.window   = global;
global.document = { getElementById: () => null, querySelectorAll: () => [],
                    createElement: () => ({ classList: { add(){}, remove(){}, toggle(){} },
                                            style: {}, dataset: {}, appendChild(){} }),
                    addEventListener: () => {},
                    documentElement: { style: { setProperty(){} } },
                    body: { appendChild(){} } };

// Load in index.html script order (Tailwind and CDN fonts skipped — UI only).
load('static/api.js');
load('static/editor-state.js');
load('static/renderer.js');
load('static/navigation.js');
load('static/diacritic-engine.js');
load('static/character-mode.js');
load('static/visual-hints.js');
load('static/soft-rules.js');
load('static/completion.js');
```

After setup:
1. Run `npm install` in `src/`.
2. Create a smoke-test file `src/smoke.test.js`:
   ```js
   test('window.parseCluster is defined', () => {
     expect(typeof window.parseCluster).toBe('function');
   });
   ```
3. Run `npm test`. Expected: 1 passed.
4. Delete `smoke.test.js` before proceeding to Task 2.2.

**Invariant checkpoint:**
- §3.3 (`editorState` schema): `editor-state.js` is loaded read-only; its schema is
  unchanged. ✓
- §2 (index.html script load order): the setup file is explicitly derived from it. ✓
- No production file is touched. All others: not triggered.

**Verification steps:**
1. `npm install` completes without errors.
2. Smoke test passes: `npm test` → 1 passed.
3. `window.parseCluster`, `window.applyDiacritic`, `window.editorState`,
   `window._tabJumpToNextUndiac` all resolve as functions/objects in the smoke test.
4. Delete smoke test; confirm `npm test` returns "no tests found" (not an error).

---

### Task 2.2 — `diacritic-engine.js` unit tests

**Ownership:** `src/diacritic-engine.test.js` (new) → tests `window.parseCluster`,
`window.classifyMark`, `window.canonicalCluster`, `window.hardRulesCheck`,
`window.applyDiacritic`, `window.clearDiacritics`, `window.isClusterComplete`.

**Dangerous zone flag:** None. These are pure functions with no DOM or state dependencies.

**Time estimate:** 60–90 min.

**Minimum change description:**

New file `src/diacritic-engine.test.js`. Mirrors the existing Python test style
(class-per-function, T-prefixed test names starting at T_JS_01).

`parseCluster`:
- `T_JS_01` — bare letter → `{ base: 'ب', marks: Set([]) }`
- `T_JS_02` — letter + fatha → `{ base: 'ب', marks: Set(['\u064e']) }`
- `T_JS_03` — letter + shadda + fatha → marks contains both

`classifyMark`:
- `T_JS_04` — fatha (U+064E) → `'A'`
- `T_JS_05` — shadda (U+0651) → `'B'`
- `T_JS_06` — hamza above (U+0654) → `'C'`
- `T_JS_07` — unknown codepoint → `null`

`hardRulesCheck`:
- `T_JS_08` — sukun + add shadda → `{ allowed: false }` (Rule 1)
- `T_JS_09` — shadda + add sukun → `{ allowed: false }` (Rule 1)
- `T_JS_10` — Group C on non-carrier (ب) → `{ allowed: false }` (Rule 2)
- `T_JS_11` — Group C on alef (carrier) → `{ allowed: true }` (Rule 2 passes)
- `T_JS_12` — 3 marks + add another Group A → `{ allowed: true }` (replace counts as 1)
- `T_JS_13` — 3 marks + add Group B (would reach 4) → `{ allowed: false }` (Rule 3)
- `T_JS_14` — toggle-off (incoming already present) → always `{ allowed: true }`

`applyDiacritic`:
- `T_JS_15` — add fatha to bare letter → cluster with fatha
- `T_JS_16` — add fatha to letter+kasra → kasra replaced by fatha (Group A replace)
- `T_JS_17` — add fatha twice (toggle) → bare letter returned
- `T_JS_18` — hard-blocked (sukun + shadda) → returns `null`
- `T_JS_19` — add shadda to letter+fatha → letter + shadda + fatha (stack, C→B→A order)

`clearDiacritics`:
- `T_JS_20` — cluster with marks → bare base letter
- `T_JS_21` — bare letter → bare letter (idempotent)

`isClusterComplete`:
- `T_JS_22` — bare letter → `false`
- `T_JS_23` — shadda only → `false`
- `T_JS_24` — fatha only → `true`
- `T_JS_25` — shadda + fatha → `true`
- `T_JS_26` — sukun → `true`
- `T_JS_27` — tanwin fatha → `true`

**Invariant checkpoint:**
- No production files touched. No DOM interaction. No `editorState` mutation.
- §3.2 (canonical_cluster scope): these tests verify that `canonicalCluster` produces
  C→B→A order (mirrors Python T03–T05). ✓

**Verification steps:**
1. `npm test diacritic-engine.test.js` → 27 passed.
2. Confirm `T_JS_18` returns `null` (not throws).
3. Full `npm test` → all tests passed.

---

### Task 2.3 — `soft-rules.js` unit tests

**Ownership:** `src/soft-rules.test.js` (new) → tests `_runSoftRules` indirectly via
`window.checkSoftRulesAfterWrite`. Since `_runSoftRules` is not exported to `window`,
tests drive it through `checkSoftRulesAfterWrite` with a mock `editorState` and
mock DOM, then inspect the `word.hasSoftWarning` flag and panel DOM mutations.

**Dangerous zone flag:** None.

**Time estimate:** 60–75 min.

**Minimum change description:**

New file `src/soft-rules.test.js`. Before each test, set up a minimal
`window.editorState` with a single line, single word, and a `clusters` array.
Also set up a mock `#char-panel` DOM element with `.char-tile[data-char-idx]` spans.

Helper function (in the test file):
```js
function setupWord(clusters) {
  window.editorState.lines = [{ words: [{ clusters, hasSoftWarning: false }] }];
  // Build mock char-panel with one tile per cluster
  const panel = document.createElement('div');
  panel.id = 'char-panel';
  clusters.forEach((_, i) => {
    const tile = document.createElement('span');
    tile.className = 'char-tile';
    tile.dataset.charIdx = i;
    panel.appendChild(tile);
  });
  document.getElementById = (id) => id === 'char-panel' ? panel : null;
}
```

Tests:
- `T_SR_01` — Rule 1: tanwin on non-final cluster → `hasSoftWarning: true`,
  tile at idx 0 has class `soft-warning-underline`
- `T_SR_02` — Rule 1: tanwin on final cluster (idx === lastIdx) → no warning
- `T_SR_03` — Rule 2: Group A on mid-position alef → warning on that tile
- `T_SR_04` — Rule 2: Group A on initial alef (idx === 0) → no warning (not mid-position)
- `T_SR_05` — Rule 3: Group A on alef of ال → warning on idx 0 (priority over Rule 2)
- `T_SR_06` — Rule 4: any diacritic on final alef maqsura → warning on last tile
- `T_SR_07` — Rule 5: ال word + tanwin on any cluster → Rule 5 warning (if not already
  caught by Rules 1–4)
- `T_SR_08` — Rule priority: Rule 3 fires before Rule 2 when both conditions are met
  (alef at idx 0 in ال word with Group A)
- `T_SR_09` — no marks on any cluster → no warnings

**Invariant checkpoint:**
- §3.9 (soft rules are ephemeral): tests verify that `hasSoftWarning` is set on the
  word object (in-memory only, never persisted). ✓
- §2 (`character-mode.js` dangerous zone: `checkSoftRulesAfterWrite` sole-call-site):
  these tests call `checkSoftRulesAfterWrite` directly, not via `_renderCharPanel`.
  This is legitimate — the tests are exercising the *function*, not the call-site
  constraint. The constraint is an architectural rule for production code; unit tests
  are allowed to call the function directly. ✓

**Verification steps:**
1. `npm test soft-rules.test.js` → 9 passed.
2. In T_SR_05, assert the warning text contains "definite article" (Rule 3 message).
3. In T_SR_08, assert only one warning exists and it matches Rule 3 (not Rule 2).
4. Full `npm test` → all tests passed.

---

### Task 2.4 — `visual-hints.js` unit tests

**Ownership:** `src/visual-hints.test.js` (new) → tests `_isAmberCandidate` (via
`window.reclassifyWord`) and `reclassifyWord` delta arithmetic.

**Dangerous zone flag:** None.

**Time estimate:** 60–75 min.

**Minimum change description:**

`_isAmberCandidate` is not exported to `window`. Tests drive it through
`reclassifyWord`, observing `word.undiacCount` and `.amber-candidate` class changes.

Alternatively, test `_isAmberCandidate` directly by temporarily exporting it in the
setup or by calling `classifyAllWords` on a minimal state.

The most reliable approach: test `classifyAllWords` with a carefully constructed
`editorState` and mock DOM, then read `word.undiacCount` values.

- `T_VH_01` — bare alef at idx > 0 (non-initial) → NOT amber (exempt)
- `T_VH_02` — bare alef at idx === 0 → IS amber (initial position, not exempt)
- `T_VH_03` — bare alef maqsura at final idx → NOT amber (exempt)
- `T_VH_04` — bare alef maqsura at non-final idx → IS amber
- `T_VH_05` — waw with preceding damma → NOT amber (long vowel role)
- `T_VH_06` — waw with preceding kasra (not damma) → IS amber
- `T_VH_07` — waw at idx 0 (no preceding cluster) → IS amber (pragmatic fallback)
- `T_VH_08` — ya with preceding kasra → NOT amber (long vowel role)
- `T_VH_09` — cluster with any combining mark → NOT amber (already diacritized)
- `T_VH_10` — Latin character → NOT amber (not in Arabic block)

`reclassifyWord` delta arithmetic:
- `T_VH_11` — word starts with 2 amber clusters; diacritize one → `totalUndiacCount`
  decreases by 1
- `T_VH_12` — clear a diacritic from a previously-diacritized cluster → `totalUndiacCount`
  increases by 1
- `T_VH_13` — delta does not go below zero (Math.max guard)

**Invariant checkpoint:**
- §3.3 (`editorState` schema): tests set `totalUndiacCount` on the state object
  (existing field). ✓ No new fields added.

**Verification steps:**
1. `npm test visual-hints.test.js` → 13 passed.
2. In T_VH_11, assert `state.totalUndiacCount === 1` (started at 2, decreased by 1).
3. Full `npm test` → all tests passed.

---

### Task 2.5 — `navigation.js` tab-jump unit tests

**Ownership:** `src/navigation.test.js` (new) → tests `window._tabJumpToNextUndiac`
and `_tabJumpToPrevUndiac` (exposed via `window._tabJumpToNextUndiac` only; the
backward function is not exported — see note below).

**Dangerous zone flag:** None. These are pure cursor-movement functions.

**Note on `_tabJumpToPrevUndiac`:** This function is defined in `navigation.js` but
NOT exported to `window` (it is only called internally from `handleWordMode`). To test
it directly, add `window._tabJumpToPrevUndiac = _tabJumpToPrevUndiac;` at the end of
`navigation.js`. This is a one-line additive change to a non-dangerous-zone file.
Per RULES.md §0 rule 4 (minimum change), this is the minimum change required.
It does not alter any logic — it only exposes an existing function.
⚠ This is the only production file change in Tier 2. Apply it in this task.

**Time estimate:** 50–65 min.

**Minimum change description:**

**Change to `src/static/navigation.js`** (one line, end of file):
```js
// Before (nothing after _tabJumpToPrevUndiac function body):
// [end of file]

// After:
window._tabJumpToPrevUndiac = _tabJumpToPrevUndiac;
```

New file `src/navigation.test.js`. Each test sets up a minimal `window.editorState`
with a `lines` array of word objects. Helper:
```js
function makeWord(undiacCount, isNavigable = true) {
  return { isNavigable, undiacCount, clusters: [] };
}
function setState(lineIdx, wordIdx, lines, total) {
  window.editorState.lineIdx = lineIdx;
  window.editorState.wordIdx = wordIdx;
  window.editorState.lines = lines;
  window.editorState.totalUndiacCount = total;
}
```

Forward jump (`_tabJumpToNextUndiac`):
- `T_NAV_01` — `totalUndiacCount === 0` → returns `false`, cursor unchanged
- `T_NAV_02` — next word on same line has undiacCount > 0 → moves there, returns `true`
- `T_NAV_03` — no more undiac words on current line, next line has one → moves there
- `T_NAV_04` — wrap: cursor on last undiac word → wraps to first undiac word in doc
- `T_NAV_05` — only one undiac word in doc, cursor already there → returns `false`
  (wrap-around finds same word, returns `false`)
- `T_NAV_06` — all words non-navigable except one (punct words skipped)

Backward jump (`_tabJumpToPrevUndiac`):
- `T_NAV_07` — `totalUndiacCount === 0` → returns `false`
- `T_NAV_08` — previous word on same line has undiacCount > 0 → moves there
- `T_NAV_09` — wrap: cursor on first undiac word → wraps to last undiac word in doc
- `T_NAV_10` — only one undiac word, cursor already there → returns `false`

**Invariant checkpoint:**
- §3.3 (`editorState` schema): tests mutate only `lineIdx`, `wordIdx`,
  `totalUndiacCount`, `lines` — all existing fields. ✓
- The one-line export addition to `navigation.js` adds zero new logic. ✓
- The function `_tabJumpToPrevUndiac` is already used by `handleWordMode` via its
  closure scope — exporting it to `window` does not change how it is called in
  production. ✓

**Verification steps:**
1. Apply the one-line addition to `navigation.js`.
2. Run existing pytest suite → still 67 passed (Python tests, confirms no breakage).
3. `npm test navigation.test.js` → 10 passed.
4. Full `npm test` → all tests passed.

---

### Task 2.6 — `renderer.js` unit tests

**Ownership:** `src/renderer.test.js` (new) → tests `window.clampCursorToNavigable`
and `window.segmentWord`.

**Dangerous zone flag:** ⚠ `renderer.js` is a dangerous zone per RULES.md §2.
`clampCursorToNavigable` and `segmentWord` must not be renamed or moved.
These tests call the functions but do NOT modify the file.

**Time estimate:** 35–50 min.

**Minimum change description:**

New file `src/renderer.test.js`. `segmentWord` uses `Intl.Segmenter` which is
available in Node 16+. Confirm it is available in the test environment before
writing segmenter tests.

`clampCursorToNavigable`:
- `T_RND_01` — `wordIdx` in bounds and navigable → unchanged
- `T_RND_02` — `wordIdx` out of bounds (>= words.length) → clamped to last word
- `T_RND_03` — current word is non-navigable (punct) → scans backward to find navigable
- `T_RND_04` — all words before current are non-navigable → scans forward
- `T_RND_05` — single navigable word in line → always lands on it

`segmentWord`:
- `T_RND_06` — ASCII word → each character is its own cluster
- `T_RND_07` — Arabic word `بَيْتٌ` → 4 clusters (base + mark each)
- `T_RND_08` — Arabic word with non-canonical combining marks → clusters correct
  (the segmenter does not reorder marks)

**Invariant checkpoint:**
- §2 (`renderer.js` dangerous zone): no production file changes. ✓
- `clampCursorToNavigable` is tested in isolation; its DOM dependency is mocked
  (the function reads `state.lines[state.lineIdx]`, not the DOM). ✓

**Verification steps:**
1. `npm test renderer.test.js` → 8 passed.
2. In T_RND_07, assert `result.length === 4`.
3. Full `npm test` → all tests passed.

---

### Task 2.7 — `completion.js` `?` / `؟` union condition test

**Ownership:** `src/completion.test.js` (new) → tests `window.toggleShortcutsOverlay`
and the `?` / `؟` key listener registered in `completion.js`.

**Dangerous zone flag:** None.

**Time estimate:** 20–30 min.

**Minimum change description:**

New file `src/completion.test.js`.

- `T_CMP_01` — `toggleShortcutsOverlay()` adds `visible` class to `#shortcuts-overlay`
- `T_CMP_02` — called twice → removes `visible` (toggle behaviour)
- `T_CMP_03` — `?` keydown event (Latin) → overlay toggles (§3.10)
- `T_CMP_04` — `؟` keydown event (Arabic U+061F) → overlay toggles (§3.10)
- `T_CMP_05` — Escape keydown when overlay is visible → overlay closes

Note: keydown listener tests require `document.dispatchEvent(new KeyboardEvent(...))`.
The jsdom environment supports this.

**Invariant checkpoint:**
- §3.10 (`?` key Escape scope): T_CMP_05 directly verifies that the Escape handler in
  `completion.js` fires only when overlay is visible. ✓ (Character Mode Escape is not
  registered in this file; that handler lives in `navigation.js` / `character-mode.js`.)

**Verification steps:**
1. `npm test completion.test.js` → 5 passed.
2. Full `npm test` → all tests passed.
3. Confirm total: **≥ 72 JS tests, 0 failed.**

---

### Phase 2 Success Criteria

- `npm test` → all JS tests passed (target: ≥ 72).
- `pytest -v` → 67 passed (unchanged from Phase 1).
- `src/static/navigation.js` has exactly one new line added (`window._tabJumpToPrevUndiac = _tabJumpToPrevUndiac;`) and no other changes.
- No other production file has been modified.

### Phase 2 Deliverables

- [x] `src/package.json`
- [x] `src/vitest.config.js`
- [x] `src/vitest.setup.js`
- [x] `src/diacritic-engine.test.js`
- [x] `src/soft-rules.test.js`
- [x] `src/visual-hints.test.js`
- [x] `src/navigation.test.js`
- [x] `src/renderer.test.js`
- [x] `src/completion.test.js`
- [x] `src/static/navigation.js` — one-line addition only

### Phase 2 Rollback Plan

The Vitest setup files (`package.json`, `vitest.config.js`, `vitest.setup.js`) and all
`*.test.js` files are new. Delete them all to revert to pre-Phase-2 state.

The one-line addition to `navigation.js`
(`window._tabJumpToPrevUndiac = _tabJumpToPrevUndiac;`) can be removed by deleting
that line. The function still exists and still works — only its test accessibility
is affected.

---

## Phase 3 — Tier 3: Playwright end-to-end tests

**Goal:** Verify the five invariants that Tiers 1–2 cannot reach: Space-no-write,
optimistic-revert, Full-Flow boundary, compound single-write, and Tab wrap-around.
These invariants require a real browser connected to a running Flask server.

**Task ordering note:** Task 3.1 (Flask server fixture) is a hard gate.
No Playwright test can run without it. Verify 3.1 completely before writing
the invariant tests in Tasks 3.2–3.6.

---

### Task 3.1 — Playwright + Flask server fixture

**Ownership:** New files: `src/conftest.py` (or additions to it),
`src/test_e2e_invariants.py`. No production files touched.

**Dangerous zone flag:** None.

**Time estimate:** 45–60 min.

**Minimum change description:**

Install: `pip install playwright pytest-playwright --break-system-packages` and
`playwright install chromium`.

**`src/conftest.py`** (new or append):
```python
import subprocess, sys, time, socket, pytest
from playwright.sync_api import sync_playwright

def _free_port():
    with socket.socket() as s:
        s.bind(('', 0))
        return s.getsockname()[1]

@pytest.fixture(scope='session')
def flask_server(tmp_path_factory):
    """Start a real Flask server in a subprocess for Playwright tests."""
    port = _free_port()
    root = tmp_path_factory.mktemp('e2e_root')
    # Copy a small sample file into root
    import shutil, pathlib
    src = pathlib.Path('data/SAMPLE_TEXTS/sample_text_02.txt')
    shutil.copy2(src, root / 'sample_text_02.txt')

    proc = subprocess.Popen(
        [sys.executable, 'app.py'],
        env={**os.environ, 'TASHKEEL_ROOT': str(root),
             'FLASK_RUN_PORT': str(port)},
        cwd=pathlib.Path(__file__).parent,
    )
    # Wait for server to be ready
    for _ in range(30):
        try:
            import urllib.request
            urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1)
            break
        except Exception:
            time.sleep(0.3)
    yield f'http://127.0.0.1:{port}'
    proc.terminate()
    proc.wait()
```

Smoke test: one test that loads the root URL and asserts the page title is present.

**Invariant checkpoint:** No production files touched. All others: not triggered.

**Verification steps:**
1. `pytest test_e2e_invariants.py::test_smoke -v` → 1 passed.
2. Flask subprocess exits cleanly after the test session.

---

### Task 3.2 — Space-no-write invariant (§3.11)

**Ownership:** `src/test_e2e_invariants.py` → tests §3.11.

**Dangerous zone flag:** ⚠ References RULES.md §3.11 (Space in Character Mode must
never trigger `POST /api/write_char`). This is an explicit invariant.

**Time estimate:** 30–45 min.

**Minimum change description:**

```python
def test_space_no_write(page, flask_server):
    write_requests = []
    page.on('request', lambda r: write_requests.append(r)
            if r.url.endswith('/api/write_char') else None)

    page.goto(flask_server)
    # Open file, enter Character Mode on first word
    # ... (click file entry, press Enter to enter char mode)
    # Press Space
    page.keyboard.press('Space')
    page.wait_for_timeout(300)  # wait for any async requests to fire

    assert len(write_requests) == 0, \
        f"Space key triggered {len(write_requests)} write_char request(s) — invariant violated"
```

**Invariant checkpoint:**
- §3.11 (Space-no-write): this test directly verifies it. ✓
- §3.7 (optimistic revert): not triggered by this test. ✓

**Verification steps:**
1. `pytest test_e2e_invariants.py::test_space_no_write -v` → 1 passed.
2. Manually introduce a bug (add an `API.writeChar()` call to the Space handler) and
   confirm the test fails. Revert the bug.

---

### Task 3.3 — Optimistic-update-then-revert (§3.7)

**Ownership:** `src/test_e2e_invariants.py` → tests §3.7.

**Dangerous zone flag:** ⚠ References RULES.md §3.7.

**Time estimate:** 40–55 min.

**Minimum change description:**

Intercept `/api/write_char` to return 500, press a diacritic key, assert the
char panel tile reverts to the original cluster text.

```python
def test_optimistic_revert(page, flask_server):
    page.route('**/api/write_char', lambda route: route.fulfill(
        status=500, content_type='application/json',
        body='{"error": "simulated failure"}'
    ))
    page.goto(flask_server)
    # Open file, enter Character Mode
    # Record tile text at charIdx 0
    original_text = page.locator('.char-tile-active').inner_text()
    # Press '1' (Fatha) — will be intercepted
    page.keyboard.press('1')
    page.wait_for_timeout(300)
    reverted_text = page.locator('.char-tile-active').inner_text()

    assert reverted_text == original_text, \
        "Tile did not revert after API failure — optimistic revert violated"
```

**Verification steps:**
1. `pytest test_e2e_invariants.py::test_optimistic_revert -v` → 1 passed.
2. Confirm the blocking error banner is visible after the simulated failure.

---

### Task 3.4 — Full-Flow Auto-Continue at word boundary

**Ownership:** `src/test_e2e_invariants.py` → tests Full-Flow Auto-Continue
(character-mode.js `_smartFlowAdvance` word-boundary branch).

**Dangerous zone flag:** ⚠ References RULES.md §2 (`character-mode.js` dangerous zone,
`_smartFlowAdvance` ordering invariant).

**Time estimate:** 40–55 min.

**Minimum change description:**

Navigate to a word's last cluster, apply a complete diacritic, assert Character Mode
automatically opens on the next undiacritized word.

```python
def test_full_flow_word_boundary(page, flask_server):
    page.goto(flask_server)
    # Open file, navigate to last cluster of first undiac word (Tab, then ArrowLeft to end)
    # Apply a complete diacritic (press '1' = Fatha)
    page.keyboard.press('1')
    page.wait_for_timeout(300)
    # Assert: char panel is still visible (Character Mode re-entered on next word)
    assert page.locator('#char-panel').is_visible(), \
        "Character Mode did not auto-continue after completing last cluster"
```

**Verification steps:**
1. `pytest test_e2e_invariants.py::test_full_flow_word_boundary -v` → 1 passed.

---

### Task 3.5 — Compound key single-write

**Ownership:** `src/test_e2e_invariants.py` → tests compound key behaviour
(one `POST /api/write_char` per compound keystroke).

**Dangerous zone flag:** None.

**Time estimate:** 30–40 min.

**Minimum change description:**

```python
def test_compound_single_write(page, flask_server):
    write_requests = []
    page.on('request', lambda r: write_requests.append(r)
            if r.url.endswith('/api/write_char') else None)
    page.goto(flask_server)
    # Open file, enter Character Mode
    # Press key '4' (Shadda + Fatha compound key)
    page.keyboard.press('4')
    page.wait_for_timeout(300)

    assert len(write_requests) == 1, \
        f"Compound key fired {len(write_requests)} write_char request(s) (expected 1)"
```

**Verification steps:**
1. `pytest test_e2e_invariants.py::test_compound_single_write -v` → 1 passed.
2. Confirm the one request body contains the compound cluster (Shadda + Fatha).

---

### Task 3.6 — Tab wrap-around

**Ownership:** `src/test_e2e_invariants.py` → tests Tab wrap-around behaviour.

**Dangerous zone flag:** None.

**Time estimate:** 30–40 min.

**Minimum change description:**

Open a file with a known number of undiacritized words. Tab past the last one and
assert the cursor wraps to the first.

```python
def test_tab_wrap_around(page, flask_server):
    page.goto(flask_server)
    # Open file; read the word highlighted (word-active class)
    first_word = page.locator('.word-active').first.inner_text()
    # Tab until wrap — press Tab N+1 times (where N = total undiac words)
    for _ in range(50):  # safe upper bound
        page.keyboard.press('Tab')
        page.wait_for_timeout(50)
    current_word = page.locator('.word-active').first.inner_text()
    assert current_word == first_word, \
        "Tab did not wrap around to the first undiacritized word"
```

**Verification steps:**
1. `pytest test_e2e_invariants.py::test_tab_wrap_around -v` → 1 passed.

---

### Phase 3 Success Criteria

- `pytest test_e2e_invariants.py -v` → **6 passed** (smoke + 5 invariants), 0 failed.
- `pytest -v` (all files) → **73 passed** (67 Python + 6 E2E), 0 failed.
- `npm test` → all JS tests still passed (unchanged from Phase 2).
- No production file was modified in Phase 3.

### Phase 3 Deliverables

- [x] `src/conftest.py` — Flask server fixture
- [x] `src/test_e2e_invariants.py` — 6 Playwright tests

### Phase 3 Rollback Plan

`conftest.py` and `test_e2e_invariants.py` are new files. Delete both to revert to
pre-Phase-3 state. The `pytest-playwright` package remains installed but is unused.
No production file was touched in Phase 3; rollback has zero production impact.

---

## Decision Tree and Stop Conditions

```
START → PRE-CODING CHECKLIST
  ├─ [pytest -v fails]          → STOP: diagnose regression before adding any test
  ├─ [pytest-flask unavailable] → STOP on Tier 1 only; proceed to Tier 2 if Node available
  ├─ [Node < 18]                → STOP on Tier 2 only; proceed to Tier 1
  ├─ [Playwright unavailable]   → STOP on Tier 3 only; proceed to Tiers 1–2
  └─ [all pass]                 → PHASE 1

PHASE 1 (Tier 1)
  ├─ [existing 17 tests go red at any point] → REVERT last task; diagnose before continuing
  ├─ [task N reveals different route behaviour than plan specifies]
  │   → STOP task N; document in handover; update plan (version bump to 1.1) before continuing
  └─ [all tasks green]          → PHASE 2

PHASE 2 (Tier 2)
  ├─ [Task 2.1 smoke test fails] → STOP all of Phase 2; fix setup file before writing tests
  ├─ [window.* function undefined in any test] → STOP that test file; fix setup file load order
  ├─ [navigation.js one-line addition causes pytest failure]
  │   → REVERT the addition; document in handover
  └─ [all tasks green]          → PHASE 3

PHASE 3 (Tier 3)
  ├─ [Flask server fixture fails to start] → STOP all of Phase 3; fix fixture
  ├─ [Space key triggers write_char in T_3.2] → STOP; this is a production bug; file separate session
  ├─ [Optimistic revert test fails (tile does not revert)] → STOP; production bug; file separate session
  └─ [all tasks green]          → DONE
```

**STOP immediately if:**
- The pytest suite (any file) goes from green to red — even on a test that was already failing before the session started.
- Any invariant named in RULES.md §3 is violated by a change, even transiently.
- An unexpected `POST /api/write_char` fires during the Space test (§3.11 violation).
- The jsdom setup file loads modules in any order other than the one specified in Task 2.1.
- Phase 3 reveals a production bug — do not fix it in this session; document it and file a separate session.

---

## Known Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| jsdom setup file load order wrong | Medium | All Tier 2 tests fail with undefined window.* | Load order is hard-coded from `index.html`; re-read `index.html` if any function is undefined |
| `Intl.Segmenter` unavailable in Node version | Low | T_RND_06–08 fail | Verify `node --version ≥ 18` in pre-coding checklist |
| Flask subprocess port conflict in CI | Low | Flask server fixture fails | Use `_free_port()` helper; retry logic in fixture |
| Playwright Arabic RTL text comparison brittle | Medium | Tab wrap test flaky | Use DOM element identity (`word-${li}-${wi}` id) rather than `inner_text()` for comparison |
| `_tabJumpToPrevUndiac` export breaks navigation.js | None (no logic change) | --- | One-line additive export; verified by running full pytest suite after addition |
| `character-mode.js` DOM mock insufficiently deep | Medium | `_renderCharPanel` calls undefined DOM method | Expand the minimal DOM stub in vitest.setup.js; `_renderCharPanel` is not directly called in any Tier 2 test |
| Windows-only NumLock edge case (`key === 'Insert'`) | Low (Linux CI) | T_JS compound key test misses | Mark as manual-only on Windows; note in test comment |

---

## Scope Boundaries

**In Scope ✅**
- Automated test files for all three tiers as described
- One-line export addition to `navigation.js` (Task 2.5)
- `conftest.py` Flask server fixture
- `package.json`, `vitest.config.js`, `vitest.setup.js` scaffolding

**Out of Scope ❌**
- Visual/CSS rendering correctness
- Cross-browser testing (Chrome 87+ only by design; Playwright uses Chromium)
- Performance benchmarking
- Any refactoring of production modules to improve testability
- Undo/redo, multi-file editing, letter substitution (RULES.md §5)
- Compound key QA (deferred from Session 28 — separate session)
- CSS tooltip truncation (deferred from Session 16 — separate session)
- Tier 3 expansion beyond the 5 listed invariants
- `api.js` unit tests (DOM-heavy; insufficient ROI for Tier 2; the route it wraps is covered by Tier 1)

---

## ZAP — Files Still Needed

All files required to execute this plan are present. No files are blocked.

| File | Status |
|------|--------|
| `app.py` | ✅ Attached and read |
| `diacritic_engine.py` | ✅ Attached and read |
| `test_diacritic_engine.py` | ✅ Attached and read |
| `diacritic-engine.js` | ✅ Attached and read |
| `navigation.js` | ✅ Attached and read |
| `soft-rules.js` | ✅ Attached and read |
| `visual-hints.js` | ✅ Attached and read |
| `character-mode.js` | ✅ Attached and read |
| `renderer.js` | ✅ Attached and read |
| `api.js` | ✅ Attached and read |
| `completion.js` | ✅ Attached and read |
| `editor-state.js` | ✅ Attached and read |
| `index.html` | ✅ Attached and read |
| `TESTING_EXECUTIVE_SUMMARY.md` | ✅ Attached and read |
| `RULES.md` | ✅ Attached and read |
