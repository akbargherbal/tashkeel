# Session 22 Handover

**Current Status:** `Ergonomics Phase 2 — Plan written and signed off. Implementation not yet started. Ready to begin Phase 1 Task 1.1 next session.`

---

### 🟢 What We Did (Session 22)

Two agenda items: locked the two open owner decisions, then wrote `PLAN_ergonomics-phase2.md`.

**Decision (a) — Compound key edge case (locked):**
When Digit4/5/6 is pressed on a character already carrying a plain vowel: **clear-then-apply**. This is not a new behaviour — it is the existing replace-mode logic extended naturally. Two sequential `applyDiacritic` calls on the existing engine produce the correct result: Shadda stacks (Group B), new vowel replaces the existing Group A mark. No new conflict rules needed. Hardcoded edge: Sukoon+Shadda is already blocked by `hardRulesCheck` — compound keys that pair Shadda with Sukoon are impossible by hard rule.

**Decision (b) — Phase 2 scope (locked):**
Smart flow and Full flow in **one phase**. Rationale: Full flow is 4 lines in `navigation.js` (not a dangerous zone); the entire implementation risk lives in Smart flow; sequencing adds overhead without reducing that risk.

**Plan written:**
`PLAN_ergonomics-phase2.md` produced and reviewed. Three implementation phases:
- Phase 1: Smart flow — `isClusterComplete()` in `diacritic-engine.js` (Task 1.1), then auto-advance trigger in `character-mode.js` (Task 1.2, dangerous zone).
- Phase 2: Full flow — Space in Word Mode enters Character Mode directly (`navigation.js`, Task 2.1, one additive block).
- Phase 3: Polish — `?` overlay update (`index.html` — gated on file attachment, ZAP).
- Compound keys: fully designed in the plan, explicitly deferred as a sub-item.

---

### 📝 Artefacts Produced

| File | Action | Details |
|------|--------|---------|
| `PLAN_ergonomics-phase2.md` | New | Full implementation plan. Same format as Phase 1 plan. Covers all five mandatory items from S21 handover: `isClusterComplete()`, auto-advance trigger, Space-as-enter, mis-press trade-off (known risk), compound keys (deferred sub-item). |
| `Session_22_Handover.md` | New | This file. |

---

### 🔒 Key Decisions Locked This Session

| Decision | Resolution |
|----------|------------|
| Compound key edge case | Clear-then-apply — handled by two sequential `applyDiacritic` calls; no new engine logic needed |
| Phase 2 scope | Smart flow + Full flow together in one phase |
| `isClusterComplete` logic | `marks` contains at least one Group A member → complete; shadda-only → false; bare → false |
| `isClusterComplete` owner | `diacritic-engine.js` — cluster-state query belongs alongside `parseCluster` and `applyDiacritic` |
| Auto-advance call site | End of `_handleDiacriticKey` success path, after `reclassifyWord`, replacing the explicit `_renderCharPanel()` call with a branch |
| Full flow ordering | `enterCharacterMode()` fires after `updateZenFocus()` in the `if (moved)` aftermath — so `_applyCharModeLineStyle` wins the CSS last |

---

### 📊 Current Project State

| Phase | Status | Notes |
|-------|--------|-------|
| Ergonomics Phase 1 | ✅ Complete | QA-verified Session 19; docs updated Session 20 |
| Ergonomics Phase 2 | 🟡 Ready to implement | Plan signed off; no blockers; start Phase 1 Task 1.1 |
| Ergonomics Phase 3 | ⏸ Gated | Requires user testing data |

---

### ⏭️ Next Session Agenda (Session 23)

**Before anything else:** Read `RULES.md` and this handover. Attach `PLAN_ergonomics-phase2.md` if not already in context.

1. **Run pre-coding checklist** (plan §Pre-Coding Checklist):
   - `pytest test_diacritic_engine.py -v` — must be green before touching anything.
   - Console: `typeof window.isClusterComplete` → must be `'undefined'`.
   - Console: `typeof window._tabJumpToNextUndiac` → must be `'function'`.
   - Console: `typeof window.scheduleCursorSave` → must be `'function'`.
   - Console: `typeof window.enterCharacterMode` → must be `'function'`.

2. **Task 1.1** — Add `isClusterComplete()` to `diacritic-engine.js` (additive, zero-risk). Verify all five console assertions before proceeding.

3. **Task 1.2** — Add `_smartFlowAdvance()` and modify `_handleDiacriticKey` success path in `character-mode.js` (dangerous zone — read RULES.md §2 first). Full Network-tab and ordering verification required before proceeding.

4. **Task 2.1** — Add full-flow block after `if (moved)` in `navigation.js`. Verify Tab and Character-Mode Space are unchanged.

5. **Phase 3 (if time)** — Attach `index.html` and update `?` overlay.

> ⚠ **ZAP:** Ask for `PLAN_ergonomics-phase2.md` at the start of Session 23 if it is not already attached. Ask for `index.html` before Phase 3 Task 3.1.

---

### 🔴 Known Issues / Watch Points

- **Mis-press not under cursor (documented trade-off):** Under smart flow, a mis-press advances the cursor before the user looks up. The error must be caught visually. Documented in plan known-risks and `?` overlay correction note. Include in onboarding notes.
- **CSS tooltip truncation:** Soft rule tooltip text cut off in Character Mode (`#char-panel` overflow). Deferred since Session 16. Still deferred.
- **Compound key edge case — implementation deferred:** Decision locked; design documented in plan §Compound Keys. Do not implement until explicitly unblocked in a dedicated session.
- **Ergonomic model — single sample:** Model results rest on one 30-line poem (`sample_text_09.txt`) and one additional run (`sample_text_06.txt`, results.md). Run against 1–2 more samples before committing smart flow to production. Not a gate — can run in parallel with implementation.
- **`index.html` not yet attached:** Required for Phase 3 Task 3.1 (`?` overlay update). Request at the start of Phase 3.

---

### Session Handover Protocol

At the end of every session, produce a `Session_N_Handover.md` file before closing. The file must fit on one page and cover: (1) What we did, (2) Artefacts produced, (3) Key decisions locked, (4) Current project state, (5) Next session work items, (6) Known issues / watch points.

Rules: One page. Cut prose, not coverage. Do not count this protocol block toward the page limit — always include it in full. Produce the handover even if the session ended early or a phase was abandoned mid-way. The handover replaces memory — write it as if handing off to someone who has the plan and spec but has never seen the session conversation. File naming: `Session_N_Handover.md` where N increments per session. The incoming session must read the latest handover plus RULES.md before doing anything else. If none are attached, ask for them explicitly before proceeding. Keep all handover files alongside the project source files.
