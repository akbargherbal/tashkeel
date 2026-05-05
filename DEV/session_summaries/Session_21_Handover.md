# Session 21 Handover

**Current Status:** `Ergonomics Phase 2 — Scoping in progress. Two pre-conditions answered; two open. Plan not yet written.`

---

### 🟢 What We Did (Session 21)

Three agenda items: report version comparison (done), Phase 2 scoping (partially done — blocked on two owner decisions), and ergonomic model update (done).

**Item 1 — Report version comparison (v1.2 vs v1.4):**
Full diff completed. No items were descoped between versions — scope only grew. Key changes identified:

- Numpad layout philosophy replaced: "vowel+tanween adjacent" (v1.2) → "column = vowel family, row = tier" (v1.4). This is what locked keys 4/5/6 as compound-key reserved positions.
- Number row promoted from "additive alias" (v1.2) to "primary layout, numpad mirrors it" (v1.4).
- Three items added to Phase 1 between versions: Shift+Tab backward jump, keyboard language warning, Shift+modifier support. All three are shipped.
- CAT tool framing sharpened: confirm-and-advance in professional tools requires a modifier chord (`Ctrl+Enter`), not a bare key — our Space key is a measurable improvement, not just an equivalent.
- Cognitive load weight for "known but not automatic" revised: 0.5 (v1.2) → 0.3 (v1.4). Mode-switch cost (0.2) added as a new row.
- Four open sign-off questions in v1.2 §10 are all locked by v1.4.

**Item 2 — Phase 2 scoping discussion:**
Owner identified a key insight: Phase 1 improved word-boundary navigation but left within-word navigation (Arrow × k per word) entirely on the pinky. The original ergonomic pain point — the pinky as the primary engine of diacritization — is still substantially present. This reframed Phase 2 priority: smart flow (auto-advance) is the core fix; compound keys are secondary.

A second proposal was discussed: **Full flow** — Space in Word Mode enters Character Mode directly in addition to jumping, eliminating the last pinky press on the forward path.

**Item 3 — Ergonomic model update:**
`ergonomic_model.py` updated with four schemes, a corrected Scheme B, and a new pinky-load chart column. Key correction: the previous model priced Phase 1's Character Mode entry at `space_thumb` (0.5) — it is actually `enter_pinky_stretch` (2.5). Model now reflects true shipped behaviour.

---

### 📝 Artefacts Produced

| File | Action | Details |
|------|--------|---------|
| `ergonomic_model.py` | Updated | 4 schemes: Current / Phase 1 (corrected) / Smart flow / Full flow. Third chart column now shows pinky load across all schemes. Correction rate budget (10%) explicit. |
| `Ergonomics_Executive_Summary_S21.docx` | New | 7-section reading document covering: where we stand, model numbers, the two Phase 2 proposals, correction path analysis, compound keys status, open questions, recommended path. |
| `Session_21_Handover.md` | New | This file. |

---

### 📊 Model Results (sample_text_09.txt — 128 words, 460 chars)

| Scheme | Total Score | Pinky presses | Pinky % |
|--------|------------|---------------|---------|
| A — Current | 3,241 | 716 | 61% |
| B — Phase 1 (corrected) | 2,949 | 588 | 50% |
| C — Smart flow | 1,434 | 174 | 23% |
| D — Full flow | 1,178 | 46 | 6% |

Phase 1 moved pinky share from 61% → 50%. Smart flow → 23%. Full flow → 6% (residual = correction budget only).

---

### 🔒 Key Decisions Locked This Session

| Decision | Resolution |
|----------|------------|
| Root cause of remaining ergonomic pain | Within-word Arrow × k presses — not addressed by Phase 1 |
| Phase 2 priority order | Smart flow first; compound keys are secondary |
| Correction path under smart flow | One Arrow press per mis-press; user always in control |
| Honest trade-off documented | Mis-press under smart flow is not under the cursor; must be caught visually |

---

### 📊 Current Project State

| Phase | Status | Notes |
|-------|--------|-------|
| Ergonomics Phase 1 | ✅ Complete | QA-verified Session 19; docs updated Session 20 |
| Ergonomics Phase 2 | 🔶 Scoping | Two owner decisions needed before PLAN can be written |
| Ergonomics Phase 3 | ⏸ Gated | Requires user testing data |

---

### ⏭️ Next Session Agenda (Session 22)

**Before anything else:** Owner reads `Ergonomics_Executive_Summary_S21.docx`.

1. **Answer open question (a) — compound key edge case:** When Digit4/5/6 (Shadda+Vowel) is pressed on a character that already carries a plain vowel, should the app **replace** (add Shadda silently), **block** (flash, do nothing), or **clear-then-apply** (wipe then apply both)? Required before compound key coding begins.

2. **Answer open question (b) — Phase 2 scope:** Implement smart flow and full flow together in one phase, or ship smart flow first and validate before adding full flow? Numbers favour doing both; risk management favours sequencing.

3. **Write `PLAN_ergonomics-phase2.md`** — once (a) and (b) are answered. Same format as the Phase 1 plan. Must explicitly cover: `isClusterComplete()` implementation, auto-advance trigger in `character-mode.js` (dangerous zone), Space-as-enter change in `navigation.js`, known-risk entry for the "mis-press not under cursor" trade-off, and compound keys as a deferred sub-item.

4. **Optional — run updated ergonomic model on additional samples.** Not a gate; can run in parallel with implementation. Drop files into the sample directory and run `ergonomic_model.py`.

> ⚠ **ZAP:** Ask for the latest `PLAN_ergonomics-phase2.md` at the start of Session 22 if it was produced between sessions. If not, produce it as item 3 above.

---

### 🔴 Known Issues / Watch Points

- **CSS tooltip truncation:** Soft rule tooltip text cut off in Character Mode (`#char-panel` overflow). Deferred since Session 16. Still deferred.
- **Compound key edge case:** Design question unresolved. Must be answered before Phase 2 compound-key coding begins. Does not block smart flow or full flow implementation.
- **Additional document validation:** Efficiency model rests on one 30-line poem. Run model against 2–3 additional docs before committing smart flow to production.
- **"Mis-press not under cursor" trade-off:** Documented this session. Include in Phase 2 plan's known-risks section and in onboarding notes.

---

### Session Handover Protocol

At the end of every session, produce a `Session_N_Handover.md` file before closing. The file must fit on one page and cover: (1) What we did, (2) Artefacts produced, (3) Key decisions locked, (4) Current project state, (5) Next session work items, (6) Known issues / watch points.

Rules: One page. Cut prose, not coverage. Do not count this protocol block toward the page limit — always include it in full. Produce the handover even if the session ended early or a phase was abandoned mid-way. The handover replaces memory — write it as if handing off to someone who has the plan and spec but has never seen the session conversation. File naming: `Session_N_Handover.md` where N increments per session. The incoming session must read the latest handover plus RULES.md before doing anything else. If none are attached, ask for them explicitly before proceeding. Keep all handover files alongside the project source files.
