## Session 15 Handover

---

### 1. What We Did

- Fixed pre-existing pytest blocker: `sample_text_05.txt` was present but pytest was being run from the repo root instead of `src/`. Correct invocation: `cd src && pytest test_diacritic_engine.py -v`.
- Executed Phase 1 Tasks 1.1, 1.2, 1.3 from `PLAN_ergonomics-phase1.md`.
- All three tasks are on branch `feature/ergonomics-phase1`.

---

### 2. Artefacts Produced / Modified

| File | Change |
|:-----|:-------|
| `src/static/navigation.js` | Task 1.1: `event.shiftKey` passed as 3rd arg to `handleCharacterMode` |
| `src/static/character-mode.js` | Task 1.1: `shiftKey = false` parameter added to signature; Task 1.3: Shift+0 override block added |
| `src/keymap.json` | Task 1.2: Full replacement — 13 entries (Digit1–3, 7–9, 0 + Numpad equivalents) |

---

### 3. Key Decisions Locked

All decisions from `PLAN_ergonomics-phase1.md` §Locked Decisions remain in force. No new decisions made this session.

---

### 4. Current Project State

| Item | State |
|:-----|:------|
| pytest (17 tests) | ✅ Green — run from `src/` |
| Task 1.1 (`shiftKey` threading) | ✅ Verified |
| Task 1.2 (`keymap.json` rearrangement) | ✅ Verified — all 13 bindings confirmed |
| Task 1.3 (Shift+0 → Shadda) | ⚠️ **Partially broken** — see §6 |
| Phase 2 (navigation extensions) | 🔲 Not started |
| Phase 3 (polish / overlay) | 🔲 Not started |

---

### 5. Next Session Work Items

1. **Fix Task 1.3 bug** (see §6) before proceeding to Phase 2. Diagnose `event.code` and `event.key` values for Shift+Numpad0 in Chrome DevTools console using: `document.addEventListener('keydown', e => console.log(e.code, e.key, e.shiftKey))`, then press Shift+Numpad0. The fix is likely a one-line addition to the override condition in `character-mode.js`.
2. **Re-verify full Task 1.3 checklist** after the fix.
3. **Begin Phase 2** starting with Task 2.1 (expose `_tabJumpToNextUndiac` and `scheduleCursorSave` on `window`).

---

### 6. Known Issues / Watch Points

**Task 1.3 partial failure — Shift+Numpad0 does not produce Shadda.**

- Shift+Digit0 (number row) → Shadda ✅
- Shift+Numpad0 → no Shadda ❌ (Sukoon appears or nothing)
- Suspected cause: on Windows with NumLock active, Shift+Numpad0 may report a different `event.code` or `event.key` than `'Numpad0'` / `'0'` — e.g. `event.key === 'Insert'`. The override condition `code === 'Numpad0'` may therefore not be reached, or the key may not pass the `isMappedKey` gate in `navigation.js` at all and never reaches `handleCharacterMode`.
- **Diagnosis step for Session 16:** paste output of `document.addEventListener('keydown', e => console.log(e.code, e.key, e.shiftKey))` for Shift+Numpad0 keypress before writing any fix.
- All Session 10/13 watch points remain open (unchanged from Session 14 handover).

---

### Session Handover Protocol

At the end of every session, produce a Session_N_Handover.md file before closing. The file must fit on one page and cover: (1) What we did, (2) Artefacts produced, (3) Key decisions locked, (4) Current project state, (5) Next session work items, (6) Known issues / watch points.

Rules: One page. Cut prose, not coverage. Do not count this protocol block toward the page limit — always include it in full. Produce the handover even if the session ended early or a phase was abandoned mid-way. The handover replaces memory — write it as if handing off to someone who has the plan and spec but has never seen the session conversation. File naming: Session_N_Handover.md where N increments per session. The incoming session must read the latest handover plus RULES.md before doing anything else. If none are attached, ask for them explicitly before proceeding. Keep all handover files alongside the project source files.