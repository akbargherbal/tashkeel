# Session 1 Handover — Arabic Diacritics Editor
**Date:** 2026-05-02
**Session type:** Pre-development — Document review, decision-locking, corpus validation

---

## 1. What We Did

- Read and analysed both founding documents: `PLAN_arabic-diacritics-editor-plan.md` (v1.0) and `SPECS_arabic-diacritics-editor-spec.md` (v1.1)
- Identified 11 issues in the plan: 2 critical (task ordering contradiction, byte-preservation gap), 4 significant gaps (OQ2 blocking CSS, word tokenization missing, amber re-classification scope, no frontend error contract), and 5 recommendations
- Locked all four blocking decisions: OQ2 → fixed bottom panel; OQ3 → Tab jump in v1; write strategy → per-keystroke; browser → Chrome 87+ only
- Produced updated **plan v1.1** incorporating all 11 fixes, locked decisions, full `editorState` schema, and Tab jump wired from Phase 2
- Identified 4 real contradictions between spec and updated plan (OQ2–OQ5 resolved in plan but still open in spec); produced updated **spec v1.2** resolving all contradictions — 8 surgical changes, no content removed
- Validated test corpus: 10 real Arabic `.txt` files from Al-Diwan dataset confirmed sufficient; non-canonical combining order present in both sampled files (35 pairs in `sample_text_09.txt`); Group C marks absent from all 3,821 poems (precomposed forms used) — will be covered by synthetic pytest strings

---

## 2. Artefacts Produced

| File | Role |
|---|---|
| `PLAN_arabic-diacritics-editor-plan.md` (v1.1) | Updated implementation plan — all decisions locked, task order corrected, `editorState` schema defined |
| `SPECS_arabic-diacritics-editor-spec.md` (v1.2) | Updated spec — §2.5 added, §5.1 Tab row added, §8.3 ephemeral note added, §16 panel locked, §17 browser added, §19 converted to resolved decisions table |

---

## 3. Key Decisions Locked

| Decision | Resolution |
|---|---|
| OQ1 Undo/redo | Deferred to v2 |
| OQ2 Character panel position | Fixed bottom panel |
| OQ3 Tab jump | In v1 — `editorState` designed for it from Phase 2 |
| OQ4 Soft warning persistence | Ephemeral — recomputed on render |
| OQ5 Conflict detection | mtime guard in Phase 5 |
| Write strategy | Per-keystroke diacritic writes; 500ms debounced cursor sidecar |
| Browser target | Chrome 87+ only — no polyfill |

---

## 4. Current Project State

| Item | State |
|---|---|
| Plan | v1.1 — complete, locked, ready to execute |
| Spec | v1.2 — consistent with plan, all OQs resolved |
| Codebase | Empty — nothing written yet |
| Test corpus | 10 files in `SAMPLE_TEXTS/` — validated ✅ |
| Environment | Python + Jupyter confirmed working on Windows (DELL) |
| `Intl.Segmenter` | To be validated in Chrome console before Session 2 begins |

---

## 5. Next Session Work Items

1. Validate `Intl.Segmenter` in Chrome console: `new Intl.Segmenter('ar', { granularity: 'grapheme' })`
2. Attach `PLAN_arabic-diacritics-editor-plan.md` (v1.1), `SPECS_arabic-diacritics-editor-spec.md` (v1.2), and this handover to Session 2
3. **Start Phase 1, Task 1.4 first** — implement `write_character()` and `canonical_cluster()` in isolation, no Flask yet
4. Test against `SAMPLE_TEXTS/` with `xxd` — verify byte-preservation of untouched clusters on an edited line
5. Only after Task 1.4 passes → build Flask scaffold (Task 1.1) and remaining Phase 1 tasks in order

---

## 6. Known Issues / Watch Points

- **Group C marks absent from corpus** — all 3,821 Al-Diwan poems use precomposed hamza/maddah. Group C hard-rule tests must use synthetic clusters constructed directly in the pytest file (e.g. `'\u0627\u0654'` for alef + combining hamza above)
- **Task 1.4 is the critical path gate** — if `write_character()` produces incorrect bytes after 2 debugging sessions, the project stops per the plan's explicit stop condition. Do not proceed to Task 1.1 until Task 1.4 passes
- **Zen Focus panel reservation** — the fixed bottom character panel height (`CHAR_PANEL_HEIGHT`) must be defined as a named constant in Phase 3 and backfilled into Phase 2's `translateY` calculation. Flag this when Phase 3 begins
- **Word tokenization** — punctuation (Arabic comma `،`, full stop `۔`) must be rendered as non-navigable `<span class="punct">` elements. This is specified in Task 1.2 of the plan but implemented in Phase 2. Do not implement naive `split(' ')` without handling punctuation tokens
- **`editorState` schema is locked** — all fields defined in Plan v1.1 Task 2.2 must be present from Phase 2 onward. Do not add fields ad hoc in later phases

---

## Session Handover Protocol

> **This section is the standing protocol for all future sessions. Do not remove it from any handover document — always include it in full.**

At the end of every session, produce a `Session_N_Handover.md` file before closing. The file must fit on one page and cover:

1. **What we did** — tasks completed, files changed, key decisions made
2. **Artefacts produced** — table of new/modified files and their role
3. **Key decisions locked** — any decisions made this session that are now permanent
4. **Current project state** — which phase is active, state of each file/component
5. **Next session work items** — ordered list, first action to take
6. **Known issues / watch points** — anything fragile, deferred, or requiring special attention

**Rules:**

- One page. Cut prose, not coverage. Do not count this protocol block toward the page limit — always include it in full.
- Produce the handover even if the session ended early or a phase was abandoned mid-way — document what was attempted and the current state.
- The handover replaces memory. Write it as if handing off to someone who has the plan and spec but has never seen the session conversation.
- File naming: `Session_N_Handover.md` where N increments per session, not per phase. Multiple sessions may cover the same phase.
- The incoming session must read the latest `Session_N_Handover.md` plus the current plan and spec before doing anything else. If none are attached, ask for them explicitly before proceeding.
- Keep all handover files alongside the project source files.
