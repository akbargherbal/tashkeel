# TASHKEEL · ERGONOMICS PROGRAMME
## Executive Summary
*Session 21 · Phase 2 Scoping*

---

## 1. Where We Stand

Phase 1 of the ergonomics programme is complete and QA-verified. The headline Phase 1 improvement was replacing a two-key exit sequence (Escape → Tab) with a single thumb key (Space). That saved 128 keypresses on a 128-word document and eliminated pinky load at the word boundary.

The problem: the improvement addressed movement between words. It did not address movement within a word — and that is where the majority of pinky load lives. Every character step inside a word still costs one Arrow press, right-pinky stretch. For 460 characters needing diacritics in our sample document, that is 460 pinky presses that Phase 1 left untouched.

The original ergonomic complaint — **the pinky is the engine that drives diacritization** — is still substantially true after Phase 1.

## 2. What the Numbers Say

The ergonomic model was updated this session to include two new schemes and to correct an earlier overestimate of Phase 1's benefit. The model runs against the known sample document profile (128 words, 460 characters needing diacritics, average 3.59 characters per word).

| Scheme | Total Score | Pinky presses | Pinky % |
| :--- | :--- | :--- | :--- |
| A — Current (pre-Phase 1) | 3,241 | 716 | 61% |
| B — Phase 1 (actual) | 2,949 | 588 | 50% |
| C — Smart flow | 1,434 | 174 | 23% |
| D — Full flow | 1,178 | 46 | 6% |

> *Correction rate assumption: 10% of characters require one Arrow press to fix a mis-press. This is the only remaining pinky work in Schemes C and D.*

Phase 1 moved the pinky share from 61% to 50%. Meaningful, but the majority of the problem remained. Smart flow drops it to 23%. Full flow — which is smart flow plus one additional change — drops it to 6%. That residual 6% is not waste; it is the user deliberately stepping back to correct a mistake, which is exactly the right use of the weakest finger.

## 3. The Two Proposed Changes for Phase 2

### 3a. Smart Flow — Auto-Advance After a Completed Character

When the user applies a diacritic that phonologically completes a character's cluster, the cursor automatically advances to the next character. No Arrow press required. The completeness rule is already defined in the report:

| Cluster state | Action |
| :--- | :--- |
| Has a short vowel (no shadda) | ✅ Complete — advance |
| Has tanween (no shadda) | ✅ Complete — advance |
| Has sukoon | ✅ Complete — advance |
| Has shadda only | ❌ Awaits vowel — stay |
| Has shadda + vowel or tanween | ✅ Complete — advance |
| No diacritic at all | ❌ Not complete — stay |

The shadda case is naturally handled: pressing Shadda alone does not advance the cursor (incomplete cluster), so the user's natural two-keypress rhythm for a shaddated character — Shadda, then vowel, then auto-advance — requires no special awareness.

**Files touched:** `diacritic-engine.js` (implement `isClusterComplete()`), `character-mode.js` (trigger auto-advance after write — a dangerous zone under RULES.md §2).

### 3b. Full Flow — Space Enters Character Mode Directly

In Phase 1, Space in Word Mode jumps to the next amber word but does not enter Character Mode. The user still presses Enter (right-pinky stretch) to open the character panel. Full flow changes Space-in-Word-Mode to jump and enter Character Mode in one keystroke.

The forward diacritization path then becomes entirely thumb-and-finger:

| Key | Action |
| :--- | :--- |
| Space (thumb) | Jump to next amber word + enter Character Mode |
| diacritic × k | Apply, auto-advance after each completed character |
| Space (thumb) | Exit Character Mode + jump to next amber word |
| Arrow right (pinky) | Correction only — step back to fix a mis-press |

**Files touched:** `navigation.js` (change Space-in-Word-Mode branch to also call Enter-char-mode logic).

## 4. The Correction Path — Is the User Still in Control?

The concern raised this session was legitimate: does auto-advance take control away from the user? The short answer is no — and here is why.

Auto-advance fires only when a cluster is phonologically complete. If the user presses the wrong diacritic — say fatha when dhamma was intended — the cluster is complete (it has a vowel), and the cursor advances. To correct:

- Press Right Arrow (pinky, one press) — steps back to the wrong character.
- Press the correct diacritic — the engine replaces the wrong one.
- Auto-advance fires again. The cursor is back on track.

Net cost of one correction: one Arrow press. The pinky is not idle; it is demoted from engine to emergency brake. That is the appropriate role for the weakest finger.

All existing navigation remains intact. Arrow keys step through characters. Escape exits to Word Mode. The user is always the driver; smart flow handles the gear changes on the open road.

**One honest trade-off to note:** a mis-press under smart flow is not sitting under the cursor when the user looks up — the cursor has moved. The error must be caught visually in the rendered text. The amber classification system (words not yet fully diacritized) provides the safety net for this, but it is worth documenting in the plan's known-risks section and the onboarding note.

## 5. Compound Keys — Phase 2 but Not the Priority

Keys 4, 5, 6 (Shadda + Fatha / Kasra / Dhamma as a single keystroke) are already reserved in the layout. They are a Phase 2 item but not the source of the pinky problem — smart flow and full flow are. Compound keys are an efficiency gain on top of a solved foundation.

One design question must be answered before coding compound keys: when the user presses a compound key on a character that already carries a plain vowel, should the app replace silently, block and flash, or clear-then-apply? This question is deferred to Session 22.

## 6. Open Questions for Session 22

| Question | What needs deciding |
| :--- | :--- |
| (a) Compound key edge case | Replace, block, or clear-then-apply when a compound key is pressed on a character that already has a plain vowel? Decision needed before compound key coding begins. |
| (b) Phase 2 scope | Implement smart flow and full flow together in one phase, or ship smart flow first and validate before adding full flow? The numbers favour doing both together; the risk-management argument favours sequencing. |
| (c) Ergonomic model — multi-file run | Run the updated model against 2–3 additional sample documents to confirm the directional conclusions hold across document types. Can be done in parallel with Phase 2 implementation — not a gate. |

## 7. Recommended Path Forward

Begin Session 22 by answering questions (a) and (b) above. Once those are resolved, produce PLAN_ergonomics-phase2.md and proceed to implementation. The plan should cover smart flow and full flow as a single phase, with compound keys as an explicitly deferred sub-item to be unlocked after (a) is answered.

The ergonomic model script is updated and ready. Drop additional sample files into the sample directory and run it — no changes needed.

---
*Prepared end of Session 21 · For review before Session 22*
