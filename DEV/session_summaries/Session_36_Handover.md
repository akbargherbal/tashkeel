# Session 36 Handover

**Current Status:** `Phase 2 (Tier 2) — Tasks 2.1 & 2.2 complete. 67 Python tests passing. JS tooling set up; 27 JS tests written.`

---

### 🟢 What We Did (Session 36)

- Read `RULES.md`, `TESTING_PHASED_PLAN.md`, `index.html`, and all 9 JS source files.
- Resolved a script-load-order discrepancy (see Key Decisions #1).
- Executed **Task 2.1**: created `package.json`, `vitest.config.js`, `vitest.setup.js`, and `smoke.test.js` (temporary gate file).
- Executed **Task 2.2**: created `diacritic-engine.test.js` (27 tests across 6 `describe` blocks covering `parseCluster`, `classifyMark`, `hardRulesCheck`, `applyDiacritic`, `clearDiacritics`, `isClusterComplete`).
- Divided Phase 2 remaining tasks across Sessions 37 and 38 (see Session Allocation below).

### 📝 Artefacts Produced

| File | Action | Details |
|------|--------|---------|
| `src/package.json` | New | Vitest 2.x + jsdom 24 + coverage-v8 devDependencies |
| `src/vitest.config.js` | New | `environment: jsdom`, `setupFiles: ['./vitest.setup.js']`, `globals: true` |
| `src/vitest.setup.js` | New | Loads all 9 JS modules in `index.html` script order via `new Function` |
| `src/smoke.test.js` | New | 15 smoke assertions — **delete after `npm test smoke.test.js` passes** |
| `src/diacritic-engine.test.js` | New | 27 unit tests (T_JS_01 – T_JS_27) |
| `Session_36_Handover.md` | New | This document |

Plan version in use: `1.0` (no scope changes).

### 🔒 Key Decisions Locked This Session

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Load order discrepancy | `RULES.md §2` lists `editor-state.js → api.js`. `index.html` (authoritative) shows `api.js → editor-state.js`. `vitest.setup.js` follows `index.html`. RULES.md is wrong; no production file changed; no plan version bump required. |
| 2 | DOM stub strategy | Use jsdom's real DOM (via `environment: 'jsdom'`) instead of the minimal stub from the plan. The plan's stub would break `classList.contains()` needed by visual-hints tests (Session 37). `globalThis.window = globalThis` is set defensively; `globalThis.document` is left as jsdom's. |
| 3 | `__dirname` in ESM | `vitest.setup.js` uses `fileURLToPath(import.meta.url)` + `dirname()` to derive `__dirname`, since `package.json` has `"type": "module"` and `__dirname` is not available natively in ESM. |
| 4 | `globalThis.KEYMAP` | Set to `{}` in setup file. The inline init script in `index.html` (which we skip) is the only place that sets `window.KEYMAP`. Without it, `navigation.js` keydown handler throws on `window.KEYMAP[event.code]`. |

### 📊 Current Project State

| Area | Status | Notes |
|------|--------|-------|
| Testing Phased Plan | ✅ Complete | v1.0 |
| Tier 1 (pytest) | ✅ Complete | 67 tests |
| Tier 2 — Task 2.1 (tooling setup) | ✅ Complete | Must run `npm install` + smoke test first |
| Tier 2 — Task 2.2 (diacritic-engine) | ✅ Complete | 27 tests written |
| Tier 2 — Tasks 2.3–2.5 | ⏳ Session 37 | soft-rules, visual-hints, navigation |
| Tier 2 — Tasks 2.6–2.7 | ⏳ Session 38 | renderer, completion + full verification |
| Tier 3 (Playwright) | ⏳ Session 39 | Not started |
| Compound key QA | 🔸 Deferred | Carry-over from Session 28 |
| CSS tooltip truncation | 🔸 Deferred | Carry-over from Session 16 |

### 📅 Phase 2 Session Allocation (locked this session)

| Session | Tasks | Tests added | Est. |
|---------|-------|-------------|------|
| 36 (done) | 2.1 setup + 2.2 diacritic-engine | 27 JS | — |
| 37 (next) | 2.3 soft-rules + 2.4 visual-hints + 2.5 navigation (+ 1-line prod change) | ~32 JS | 3 h |
| 38 | 2.6 renderer + 2.7 completion + full suite verification | ~13 JS | 2 h |

### ⏭️ Next Session Work Items (Session 37)

1. **Verify Task 2.1 gate first:** In `src/`, run `npm install` then `npm test smoke.test.js` → 15 passed. Delete `smoke.test.js`. Then run `npm test diacritic-engine.test.js` → 27 passed.
2. **Branch:** Ensure you are on `testing/tier-2-vitest` (create from `main` if not done yet).
3. **Task 2.3:** Create `src/soft-rules.test.js` (9 tests). Requires mock DOM setup per-test using jsdom's `document.createElement` (real elements, not stubs — see Decision #2 this session).
4. **Task 2.4:** Create `src/visual-hints.test.js` (13 tests). Uses `reclassifyWord` and `classifyAllWords` with a minimal `editorState` and DOM mock.
5. **Task 2.5:** Add **one line** to `src/static/navigation.js` (end of file): `window._tabJumpToPrevUndiac = _tabJumpToPrevUndiac;`. Run `pytest -v` immediately after to confirm 67 still pass. Then create `src/navigation.test.js` (10 tests).
6. **Attach at session start (ZAP):** `TESTING_PHASED_PLAN.md`, `Session_36_Handover.md`, `navigation.js`, `soft-rules.js`, `visual-hints.js`.

### 🔴 Known Issues / Watch Points

- **Smoke test must pass before `diacritic-engine.test.js` is run.** If `window.parseCluster` is undefined in the smoke test, the setup file failed to load `diacritic-engine.js`. Fix load order or DOM stub before proceeding.
- **Task 2.3 soft-rules DOM mock:** `_applyWarningsToPanel` calls `panel.querySelectorAll('.char-tile')` which returns a NodeList. Mock `document.getElementById` per-test to return a real jsdom element (created with `document.createElement`), NOT a plain JS object — plain objects lack `querySelectorAll`.
- **Task 2.4 `_classifyWord` DOM dependency:** Calls `document.getElementById('word-${li}-${wi}')` and `wordEl.querySelectorAll('.letter-cluster')`. Use `document.createElement` + `document.body.appendChild` (or mock `getElementById` per-test) to provide real jsdom elements.
- **Task 2.5 production change scope:** The `navigation.js` one-line addition (`window._tabJumpToPrevUndiac = _tabJumpToPrevUndiac;`) is the ONLY production file change allowed in all of Tier 2. Run the full Python suite (`pytest -v`) after adding it.
- **`_tabJumpToPrevUndiac` not yet exported:** The smoke test does NOT assert `window._tabJumpToPrevUndiac` for this reason. Add it only after the Task 2.5 production change.

---

> ### Session Handover Protocol
>
> This section is the standing protocol for all future sessions. Do not remove it from any handover document — always include it in full.
>
> At the end of every session, produce a `Session_N_Handover.md` file before closing. The file must fit on one page and cover: (1) What we did, (2) Artefacts produced, (3) Key decisions locked, (4) Current project state, (5) Next session work items, (6) Known issues / watch points.
>
> Rules: One page. Cut prose, not coverage. Do not count this protocol block toward the page limit — always include it in full. Produce the handover even if the session ended early or a phase was abandoned mid-way. The handover replaces memory — write it as if handing off to someone who has the plan and spec but has never seen the session conversation. File naming: `Session_N_Handover.md` where N increments per session. The incoming session must read the latest handover plus the current plan and spec before doing anything else. If none are attached, ask for them explicitly before proceeding. Keep all handover files alongside the project source files.
