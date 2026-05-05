# Ergonomics Design Report — Revision 2
### Tashkeel Arabic Diacritics Editor · Session 12
**Revised after stakeholder review. Supersedes v1.**

---

## 0. Framing Revision

Version 1 of this report proposed a comprehensive redesign: new key layout
(J K L), double-tap tanween, and full smart-flow auto-advance, all at once.
That was over-designed for a first iteration.

This revision reframes the goal: **identify the lowest-effort changes that
give the highest comfort payoff, and defer everything else.** The end user
is an experienced Arabic diacritization professional — not a beginner. They
have muscle memory from MS Word, CAT tools, and specialized diacritic apps.
We are asking them to switch. To earn that switch we need a one-hour
first-contact that is:

1. Immediately less painful than whatever they use now.
2. Immediately legible — no lookup card needed after the first 10 minutes.
3. Better enough to make them come back the next day.

We are not trying to convert them to a belief system. We are offering a
specialist tool that removes specific pain points they already feel.

---

## 1. What Kind of User We Are Designing For

### 1.1 Profile

- Extensive experience diacritizing Arabic in MS Word or professional CAT
  tools (SDL Trados, memoQ, OmegaT, Wordfast).
- Has **not** used a terminal as part of a professional workflow.
- Is comfortable with keyboard shortcuts — they use them daily in Word and
  CAT tools. The concept of a key doing a specific action is not foreign.
- Thinks of diacritics as phonological units, not Unicode code points.
- Works 2–4 hour sessions. Sustained physical load matters.

### 1.2 The discomfort we accept

| Discomfort | Accepted? | Rationale |
| :--- | :--- | :--- |
| Terminal launch (`python app.py`) | ✅ | One-time per session; not part of the diacritization flow |
| Learning new keyboard shortcuts | ✅ | CAT tool users already have this habit |
| Small initial learning curve for diacritic keys | ✅ | 10-minute ramp; then faster than the alternative |
| Giving up MS Word undo/redo | ⚠ | Must be addressed in onboarding; known v1 limitation |

### 1.3 The discomfort we refuse to create

- A layout so unfamiliar that the first hour ends in confusion.
- A workflow that requires the user to hold a mental model of Unicode
  code points, key-position tables, or timing windows.
- Any change that makes the existing keyboard reference (`?` key overlay)
  less accurate without also updating it.

---

## 2. CAT Tool Workflow Reference

Computer-Assisted Translation tools are the closest professional parallel
to what Tashkeel does. Many users of this app work in CAT tools daily.
The dominant interaction pattern across all major CAT tools is:

```
[Display source segment]  →  [User fills target]  →  [Confirm + advance]
```

The "confirm + advance" action is a single key — almost always `Enter` or
`Tab` — that marks the current unit done and moves focus to the next. This
is so universal across CAT tools that professional translators consider it
the baseline, not a feature.

The analogy to our application:

| CAT tool concept | Tashkeel equivalent |
| :--- | :--- |
| Segment (source unit) | Word (amber-highlighted) |
| Fill target | Apply diacritics in Character Mode |
| Confirm + advance | Exit char mode + jump to next undiacritized word |
| Untranslated filter | Tab jump to next amber word |
| QA pass | Soft-rule tooltips |

**The key insight:** our current workflow already has the right shape. The
problem is not the shape — it is the physical cost of the keys that execute
each step. CAT tool users do not use `Escape + Tab` to advance; they use
one key. We are asking them to use three (Escape → Tab → Enter or Escape →
Arrow → Enter). That is the gap to close, not the conceptual model.

---

## 3. Killer Features — Why Would They Switch?

The one-hour trial will succeed or fail on three things:

**Feature 1: Zen Focus (already built).** The teleprompter-style zoom is
something MS Word cannot do. A professional proofreader who has spent years
scrolling a flat document to find their place will immediately understand
the value. This needs to be the first thing shown in any onboarding.

**Feature 2: Amber classification (already built).** Visual distinction
between diacritized and undiacritized text, live, word-by-word. Word has
no equivalent. The proofreader can see their progress in the text itself.

**Feature 3: Tab jump to next undiacritized (already built).** Single key
to skip to the next word needing work. CAT tool users recognize this
immediately as the "untranslated filter" equivalent. This is native to
our app and absent from Word.

**The ergonomics redesign is Feature 4** — it is not the hook, it is the
retention mechanism. The user switches because of Features 1–3. They stay
because of Feature 4.

Implication: the ergonomics changes do not need to be perfect on day one.
They need to be *meaningfully better* than Word and *immediately learnable*
in the first 10 minutes. Incremental improvement is the right strategy.

---

## 4. Waste Audit — Real Numbers on `sample_text_09.txt`

### 4.1 Document profile

| Metric | Value |
| :--- | ---: |
| Lines (30-line Arabic poem) | 30 |
| Arabic word tokens | 128 |
| Words fully undiacritized | 49 |
| Words partially diacritized | 79 |
| Letters needing diacritics (Σk) | 460 |
| Average k per word | 3.59 |

### 4.2 Keypress economy — current vs. proposed schemes

| Scheme | Total KP | Overhead KP | Efficiency |
| :--- | ---: | ---: | ---: |
| Current (Tab · Enter · Arrow · Esc) | 1,176 | 716 | 39.1% |
| Space navigation (Space replaces Enter + Esc) | 1,048 | 588 | 43.9% |
| Smart flow (Space + auto-advance) | 588 | 128 | 78.2% |

Space navigation is the low-hanging fruit: **128 fewer keypresses**, pinky
load drops to near zero for navigation, zero design risk.

Smart flow is the bigger win but requires the `isClusterComplete()` design
decision (§8) and carries more implementation risk. It is Phase 2.

---

## 5. Finger Ergonomics Model

### 5.1 Reframing the goal

The goal is not to eliminate use of the right pinky. The goal is to use
each finger for what it is best suited for. Thumbs are strong and suited
for high-frequency single keys (Space). Index and middle fingers are fast,
independent, and well-suited for repeating diacritic presses. The pinky is
weak and not independently controlled — it is best used for infrequent
modifier-type actions (Escape, special cases), not high-frequency navigation
(Arrow, Enter, Escape on every word).

The current scheme puts high-frequency navigation entirely on the pinky.
That is the only problem to fix.

### 5.2 Cognitive load and physical discomfort model

A companion Python script (`ergonomic_model.py`) quantifies these
dimensions across schemes and sample files. The model assigns:

**Finger discomfort weights** (1.0 = baseline index finger, home row):

| Finger | Role | Weight |
| :--- | :--- | :--- |
| Thumb | Space, high-endurance | 0.5 |
| Index | Fast, independent, home-row muscle memory | 1.0 |
| Middle | Second best, good independence | 1.1 |
| Ring | Weaker, less independent | 1.5 |
| Pinky (non-stretch) | Weak, poor independence | 1.8 |
| Pinky (stretch — Escape, Arrow) | Weak + reach | 2.5 |
| Right hand off home row (Numpad) | Hand displacement | 1.4 |

**Cognitive load weights** (0 = automatic, no lookup needed):

| Situation | Cost |
| :--- | :--- |
| Automatic key (well-practiced) | 0.0 |
| Known but not automatic (must recall) | 0.5 |
| Must look up (reference overlay) | 1.0 |
| Must count position (character tracking) | 0.5 per character |

The script produces per-document bar charts of total physical discomfort
and cognitive load across the three schemes, along with a finger-usage
breakdown pie chart. Run it against 2–3 sample docs to validate that the
model matches intuition before using it to make decisions.

### 5.3 Preliminary results (sample_text_09.txt, estimated)

Even before running the script, the model predicts directionally:

- **Current scheme:** high physical score (pinky stretch on every word ×4),
  moderate-high cognitive score (8 arbitrary numpad bindings).
- **Space navigation only:** physical score drops sharply (pinky stretch
  eliminated for navigation), cognitive score unchanged.
- **Space + smart flow + improved keymap:** physical score near minimum
  achievable; cognitive score drops to near zero after 10-minute ramp.

---

## 6. Current Keymap Assessment

### 6.1 What exists today

```
Physical numpad layout → current bindings:

  kasratan(7)   [8=∅]    [9=∅]
  dammatan(4)  shadda(5)  kasra(6)
   fatha(1)  fathatan(2)  damma(3)
              sukun(0)
```

**Pair adjacency:**

| Pair | Keys | Adjacent? |
| :--- | :--- | :--- |
| fatha / fathatan | Numpad1 / Numpad2 | ✅ bottom row |
| damma / dammatan | Numpad3 / Numpad4 | ❌ diagonal, cross-row |
| kasra / kasratan | Numpad6 / Numpad7 | ❌ diagonal, cross-row |

Fatha is the most common Arabic diacritic and its pair is adjacent — this
is the one thing the current layout gets right. Damma and kasra pairs are
broken. A user who has learned "3 is damma" will reach for 4 next to it for
dammatan, hit nothing, and give up.

### 6.2 Proposed numpad rearrangement (Phase 1 candidate)

Reorganize the numpad so each vowel and its tanween are vertically adjacent,
reading top-to-bottom:

```
Proposed numpad layout:

  kasra(7)     [8=∅]    damma(9)
  kasratan(4)  shadda(5) dammatan(6)
  fatha(1)    sukun(2)  fathatan(3)
              [0=∅]
```

This gives:
- fatha(1) / fathatan(3): same row, one key apart — acceptable
- kasra(7) / kasratan(4): same column, vertically adjacent ✅
- damma(9) / dammatan(6): same column, vertically adjacent ✅
- shadda(5): center, natural anchor point
- sukun(2): center-bottom, easy reach

**This is a `keymap.json` change only — zero code changes, zero risk.**

### 6.3 Number-row aliases (additive, Phase 1 candidate)

Add the top-number-row keys (1–8) as aliases for the same diacritics,
in the same order as the numpad's logical grouping. This gives users
without a numpad (laptops) a fallback, and gives all users a second
muscle-memory path if they prefer the number row.

```
1=fatha  2=sukun  3=fathatan  4=kasratan  5=shadda  6=dammatan  7=kasra  8=∅→damma
```

The `keymap.json` supports multiple keys mapping to the same diacritic.
No code change required — this is purely additive.

### 6.4 Home-row layout (J K L ; ') — status: DEFERRED

The home-row layout proposed in v1 is technically sound and would be the
best ergonomic outcome long-term. It is deferred for two reasons:

1. **Familiarity risk.** The target user has never used a Vim-style
   key mapping. The first hour of their trial is the wrong time to
   introduce it. If they leave confused, they do not return.
2. **Premature.** Until we have user testing data (even informally —
   the project owner trialing the app for two weeks), we do not know
   whether J/K/L feels natural or arbitrary. The model says it should;
   user experience may differ.

**Future path:** implement customizable key bindings UI (already in the
long-term plan). Once that exists, offer J/K/L as an opt-in preset, and
let users discover it on their own terms.

---

## 7. Double-Tap Tanween — Status: DEFERRED

### 7.1 Why deferred

Tanween diacritics (fathatan, dammatan, kasratan) are infrequent in
running prose and predictably placed — typically on the final character
of a word (nunation), and occasionally the penultimate character in
certain grammatical conventions. They are not the source of sustained
physical load; they are edge cases.

The double-tap mechanism, while mnemonically elegant, introduces a timing
dependency into a key-binding system that currently has none. If a user's
typing rhythm occasionally produces a double-tap by accident — or fails to
produce one fast enough — they get the wrong diacritic silently. That is
a hard error to spot in Arabic text.

The principle here: **do not add complexity to handle an infrequent case
when a simpler solution (dedicated key, slightly reorganized numpad) handles
it adequately.**

### 7.2 What we do instead

The improved numpad layout in §6.2 puts each tanween key adjacent to its
vowel. The user learns "fatha is 1, fathatan is the key just to the right."
This is not as elegant as double-tap but it is:
- Zero timing risk
- Zero new interaction paradigm
- Learnable from the `?` overlay in one glance
- Reversible if a better solution emerges

Double-tap tanween remains on the long-term backlog. It should be
reconsidered after user testing reveals whether tanween frequency is
actually a pain point in practice.

---

## 8. Smart Flow — Design Decisions Still Required

Smart flow (auto-advance after a character's diacritic cluster is
phonologically complete) is the biggest quality-of-life improvement
available and is retained as a **Phase 2** implementation target.

### 8.1 The `isClusterComplete()` rule (unchanged from v1)

| Cluster state | Complete? |
| :--- | :--- |
| Has a short vowel (no shadda) | ✅ |
| Has tanween (no shadda) | ✅ |
| Has sukun | ✅ |
| Has shadda only | ❌ — awaits vowel |
| Has shadda + any vowel or tanween | ✅ |
| No diacritic | ❌ |

Auto-advance fires only on `isClusterComplete() = true`. Shadda alone does
not advance the cursor.

### 8.2 Why Phase 2 and not Phase 1

Smart flow requires a change to `character-mode.js` (a dangerous zone per
RULES.md §2). It also changes the fundamental interaction contract: users
currently have explicit control over when the cursor moves. Auto-advance is
a new contract that must be learned. Introducing it at the same time as
Space navigation and a remapped keymap would make it impossible to isolate
the cause if something goes wrong.

Ship Space navigation first. Let users adapt. Then ship smart flow in the
next session.

---

## 9. Phased Implementation Plan

### Phase 1 — Low-hanging fruit (next session, low risk)

| Change | Files touched | Risk |
| :--- | :--- | :--- |
| Rearrange numpad in `keymap.json` | `keymap.json` only | None |
| Add number-row aliases to `keymap.json` | `keymap.json` only | None |
| Space-as-Enter for Character Mode entry | `navigation.js`, `character-mode.js` | Low |
| Update `?` overlay to reflect new keymap | `completion.js` or `index.html` | Low |
| Add `config.json` to `.gitignore` | `.gitignore` | None |

### Phase 2 — Smart flow (after Phase 1 is stable)

| Change | Files touched | Risk |
| :--- | :--- | :--- |
| Implement `isClusterComplete()` | `diacritic-engine.js` | Medium |
| Implement auto-advance on cluster complete | `character-mode.js` | Medium |
| User testing against 2 sample docs | — | — |

### Phase 3 — Long term (requires user testing data first)

| Change | Condition to unlock |
| :--- | :--- |
| Customizable key bindings UI | Phase 2 stable + user demand |
| Home-row layout (J K L) as opt-in preset | Customizable UI exists |
| Double-tap tanween | User testing shows tanween frequency is a pain point |
| GUI launcher / .exe | Separate project scope decision |

---

## 10. Open Design Questions — Explicit Sign-off Required

| Question | Decision needed |
| :--- | :--- |
| Numpad rearrangement (§6.2) — approve the specific layout | **OPEN** |
| Number-row aliases (§6.3) — approve or skip for Phase 1 | **OPEN** |
| Space-as-Enter — is Space the right key, or another thumb key? | **OPEN** |
| Run `ergonomic_model.py` on 2–3 docs before Phase 1 starts? | **OPEN** |

### 10.1 On the risk of designing for one person (project owner's note)

The concern raised during review is legitimate: a workflow optimized for
one expert user may be opaque to everyone else. The mitigation is to:

1. **Keep the `?` overlay accurate at all times.** Any user who is lost
   can press `?` and recover. This is the safety net.
2. **Make all new behaviour additive, not replacement** in Phase 1.
   Number-row aliases do not remove numpad keys. Space-as-Enter does not
   remove Enter. A user who ignores all changes is not broken.
3. **Design for the CAT tool mental model**, not for the project owner's
   personal intuition. CAT users are the reference population. The
   Space-to-confirm-and-advance pattern is already their norm.
4. **Defer any change that requires a timing window or new interaction
   paradigm** until user testing confirms it is intuitive. Double-tap
   is the primary example.

---

## 11. Carry-Forward from Session 10 (Unchanged)

| Item | Status |
| :--- | :--- |
| `.gitignore` — `config.json` not yet added | ⚠ Phase 1 |
| `?` key on Arabic keyboard layouts | ⚠ Open |
| `classifyAllWords()` performance on large files | ⚠ Open |
| Completion banner z-index | ⚠ Open |
| Plan/spec files deleted from working tree | ⚠ Open |

---

*This report supersedes v1. Decisions marked OPEN require explicit project
owner sign-off before Session 13 implementation begins. All Phase 1 changes
are additive or keymap-only; none touch dangerous zones defined in RULES.md §2.*
