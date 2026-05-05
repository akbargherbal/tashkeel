## Session 2 Handover

---

### 1. What We Did

- Analysed both corpus files. **`sample_text_05.txt`** confirmed the critical test case: line 11 (0-idx), word 4, char 1 contains `دِّ` encoded as `d8af d990 d991` — DAL + KASRA (CCC=32, Group A) + SHADDA (CCC=33, Group B). This is Unicode-CCC-canonical order but inverts our app's editorial order (B→A). **`sample_text_02.txt`** has no non-canonical clusters.
- Verified `regex \X` behaviour: correctly segments all Arabic grapheme clusters regardless of combining-mark order; `''.join(regex.findall(r'\X', s))` is byte-identical to input — the roundtrip invariant that makes byte-preservation provable.
- Implemented **Task 1.4** in full: `canonical_cluster()`, `extract_cluster_parts()`, `segment_line_clusters()`, and `write_character()` in `diacritic_engine.py`, with no Flask dependency.
- Wrote **17 pytest tests** (T01–T17) covering: canonical ordering for all group combinations, Group C synthetic cases (corpus has none), byte-preservation of untouched clusters, correct bytes at the edited position, other-lines untouched, CRLF preservation, and all three IndexError paths.
- **17/17 tests pass**, including T11 — the critical corpus test that directly verifies the non-destructive contract with real bytes from `sample_text_05.txt`.

---

### 2. Artefacts Produced

| File                       | Role                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| `diacritic_engine.py`      | Task 1.4 implementation — `canonical_cluster()`, `write_character()`, helpers |
| `test_diacritic_engine.py` | 17-test pytest suite — all passing                                            |

---

### 3. Key Decisions Locked This Session

| Decision                              | Resolution                                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| CORPUS_DIR path                       | Hardcoded to `/mnt/user-data/uploads` in tests; on the user's Windows machine this must be changed to the `SAMPLE_TEXTS/` absolute path               |
| `write_character()` word tokenisation | `regex.split(r'(\s+)', line)` with capturing group — preserves all whitespace tokens verbatim; word_idx indexes only non-whitespace, non-empty tokens |
| `canonical_cluster()` scope           | Used **only** for mutated clusters; never called on untouched clusters anywhere in the codebase                                                       |
| `\r\n` handling                       | Preserved verbatim via `splitlines(keepends=True)` + byte-level encode/write; no `newline=` coercion                                                  |

---

### 4. Current Project State

| Item                               | State                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Plan                               | v1.1 — unchanged                                                                                       |
| Spec                               | v1.2 — unchanged                                                                                       |
| `diacritic_engine.py`              | ✅ Complete — Task 1.4 core, 17/17 tests pass                                                          |
| `app.py`                           | Not started                                                                                            |
| `static/`                          | Not started                                                                                            |
| `keymap.json`                      | Not started                                                                                            |
| `requirements.txt`                 | Not started                                                                                            |
| `Intl.Segmenter` Chrome validation | ⚠️ Still unconfirmed — user must run console check                                                     |
| CORPUS_DIR in tests                | Hardcoded to `/mnt/user-data/uploads` — must be updated to `SAMPLE_TEXTS/` path before running locally |

---

### 5. Next Session Work Items

1. **Update `CORPUS_DIR`** in `test_diacritic_engine.py` to the local `SAMPLE_TEXTS/` path and re-run — confirm 17/17 on the actual machine
2. **Confirm `Intl.Segmenter`** in Chrome console: `new Intl.Segmenter('ar', { granularity: 'grapheme' })` — must return Segmenter object without error before Phase 2
3. **Task 1.1 — Project skeleton**: `app.py`, `static/`, `templates/index.html`, `keymap.json`; Flask serving index; `/api/config` returning keymap
4. **Task 1.2 — File tree scanner**: `scan_directory()` and `get_file_status()` with correct exclusion rules
5. **Task 1.3 — Working copy contract**: `POST /api/open`, `ensure_working_copy()`, cursor sidecar read/write
6. **Task 1.4-as-endpoint**: Wire `write_character()` into `POST /api/write_char` (logic already proven)
7. **Task 1.5 — Cursor + status**: `POST /api/save_cursor`, `POST /api/mark_complete`, `POST /api/reset`

---

### 6. Known Issues / Watch Points

- **`CORPUS_DIR` path** — tests will fail on the user's machine until the path is updated from `/mnt/user-data/uploads` to the actual `SAMPLE_TEXTS/` directory path
- **`keymap.json` still missing** — needed for Task 1.1; can be generated from spec §7.4 example if no custom version exists
- **Punctuation tokenisation alignment** — `write_character()` uses plain `\s+` word splitting (no punctuation separation). The frontend in Phase 2 will split punctuation into non-navigable `<span class="punct">` elements. This means `word_idx` from the frontend must be calculated from the same `\s+` splits, with punctuation kept as part of its adjacent word token — not as a separate word index. This must be confirmed when wiring the Phase 2 word renderer to the API.
- **Group C corpus coverage** — still zero Group C marks in corpus; T04 and T05 use synthetic strings. This is correct and expected.
- **`editorState` schema is locked** — all fields from Plan v1.1 Task 2.2 must be present from Phase 2 onward; no ad hoc additions.

---

### Session Handover Protocol

> **This section is the standing protocol for all future sessions. Do not remove it from any handover document — always include it in full.**

At the end of every session, produce a `Session_N_Handover.md` file before closing. The file must fit on one page and cover: (1) What we did, (2) Artefacts produced, (3) Key decisions locked, (4) Current project state, (5) Next session work items, (6) Known issues / watch points.

**Rules:** One page. Cut prose, not coverage. Do not count this protocol block toward the page limit — always include it in full. Produce the handover even if the session ended early or a phase was abandoned mid-way. The handover replaces memory — write it as if handing off to someone who has the plan and spec but has never seen the session conversation. File naming: `Session_N_Handover.md` where N increments per session. The incoming session must read the latest handover plus the current plan and spec before doing anything else. If none are attached, ask for them explicitly before proceeding. Keep all handover files alongside the project source files.
