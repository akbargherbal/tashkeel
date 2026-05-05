# Ergonomics Design Report — v1.4
### Tashkeel Arabic Diacritics Editor · Session 13

---

## 0. Executive Summary

This report defines the complete ergonomic redesign strategy for the Tashkeel
diacritization editor. It is self-contained. All decisions documented here have
been signed off and are ready for implementation.

The end user is an experienced Arabic diacritization professional — not a
beginner. They have muscle memory from MS Word, CAT tools, and specialized
diacritic apps. We are asking them to switch tools. To earn that switch, the
first hour of contact must be:

1. Immediately less painful than whatever they use now.
2. Immediately legible — no lookup card needed after the first ten minutes.
3. Better enough to make them come back the next day.

The ergonomics changes do not need to be perfect on day one; they need to be
meaningfully better and immediately learnable. Every decision in this report
follows that constraint.

---

## 1. User Profile

The target user:

- Has extensive experience diacritizing Arabic in MS Word or professional CAT
  tools (SDL Trados, memoQ, OmegaT, Wordfast).
- Has not used a terminal as part of a professional workflow.
- Is comfortable with keyboard shortcuts — they use them daily. The concept of
  a key doing a specific action is not foreign.
- Thinks of diacritics as phonological units, not Unicode code points.
- Works in 2–4 hour sessions. Sustained physical load matters.

**Discomfort we accept:**

| Discomfort | Accepted? | Rationale |
| :--- | :--- | :--- |
| Terminal launch (`python app.py`) | ✅ | One-time per session; outside the diacritization flow |
| Learning new keyboard shortcuts | ✅ | CAT tool users already have this habit |
| Small initial learning curve for new diacritic keys | ✅ | Ten-minute ramp; then faster than the alternative |
| Giving up MS Word undo/redo | ⚠ | Must be addressed in onboarding; known current limitation |

**Discomfort we refuse to create:**

- A layout so unfamiliar that the first hour ends in confusion.
- A workflow that requires the user to hold a mental model of Unicode code
  points or key-position tables.
- Any change that makes the existing `?` key overlay less accurate without
  also updating it.

---

## 2. CAT Tool Workflow Reference

Computer-Assisted Translation tools are the closest professional parallel to
what Tashkeel does. The dominant interaction pattern across all major CAT tools:

```
[Display source segment] → [User fills target] → [Confirm + advance]
```

The confirm-and-advance step requires a modifier key combination in all major
CAT tools — typically `Ctrl+Enter` in SDL Trados and memoQ, `Ctrl+U` in
OmegaT. It is never a bare single keystroke.

**Our design goal is to do better.** The equivalent action in Tashkeel — "I am
done with this word, move to the next undiacritized one" — is a single,
unmodified thumb key. No modifier. This is a concrete, deliberate improvement
over the tools our users already know.

The structural analogy holds everywhere else:

| CAT tool concept | Tashkeel equivalent |
| :--- | :--- |
| Segment (source unit) | Word (amber-highlighted) |
| Fill target | Apply diacritics in Character Mode |
| Confirm + advance (`Ctrl+Enter`) | Exit Character Mode + jump to next undiacritized word (`Space`) |
| Next untranslated | `Tab` / `Space` jump to next amber word |
| Previous untranslated | `Shift+Tab` jump backward |
| QA / validation pass | Soft-rule tooltips |

The mental model is already familiar. What we are changing is the physical cost
of executing it.

---

## 3. Killer Features — Why Would They Switch?

The one-hour trial will succeed or fail on three things already built:

**Feature 1: Zen Focus.** The teleprompter-style zoom is something MS Word
cannot do. A professional who has spent years scrolling a flat document will
immediately understand the value. This should be the first thing shown in any
onboarding.

**Feature 2: Amber classification.** Visual distinction between diacritized and
undiacritized text, live, word-by-word. Word has no equivalent. The user can
see their own progress in the text itself in real time.

**Feature 3: Tab jump to next undiacritized.** Single key to skip to the next
word needing work. CAT tool users recognize this immediately as the "next
untranslated segment" equivalent.

The ergonomics redesign is **Feature 4** — not the hook, but the retention
mechanism. The user switches because of Features 1–3. They stay because of
Feature 4.

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

This is representative of real editorial work — a partially pre-marked
manuscript, not a blank slate.

### 4.2 Keypress economy — current vs. proposed schemes

For a word with **k** letters needing diacritics:

| Scheme | Formula | Total KP on doc | Overhead KP | Efficiency |
| :--- | :--- | ---: | ---: | ---: |
| Current (Tab · Enter · Arrow · Esc) | 2k + 2 | 1,176 | 716 | 39.1% |
| Single-key advance (Space replaces Enter + Esc) | 2k + 1 | 1,048 | 588 | 43.9% |
| Smart flow (single-key + auto-advance) | k + 1 | 588 | 128 | 78.2% |

Single-key advance delivers 128 fewer keypresses on a 128-word document,
eliminates pinky load for navigation, and carries zero design risk. Smart flow
doubles the efficiency again and is a Phase 2 implementation (§9).

### 4.3 Pinky load — current scheme

In the current scheme, every diacritized word costs one `Enter` (enter
Character Mode), k× `Arrow` (step through characters), and one `Escape`
(exit). All three are right-pinky keys.

| Key | Presses | Finger |
| :--- | ---: | :--- |
| Enter | 128 | right pinky |
| Arrow ×k | 460 | right pinky |
| Escape | 128 | right pinky |
| **Total pinky navigation** | **716** | **61% of all keypresses** |

The remaining 460 keypresses are the diacritics themselves. In the current
scheme, 100% of overhead is pinky-borne. That is the only structural problem
to fix — not the diacritic keys themselves.

---

## 5. Finger Ergonomics Model

### 5.1 Design principle

The goal is not to eliminate use of the right pinky. The goal is to use each
finger for what it is best suited for. Thumbs are strong and well-suited for
high-frequency single keys. Index and middle fingers are fast and well-suited
for repeating diacritic presses. The pinky is the weakest and least
independently controlled finger; it belongs on infrequent actions, not on
navigation that fires on every word.

### 5.2 Quantified discomfort model

**Finger discomfort weights** (index finger on home row = 1.0 baseline):

| Finger / action | Weight | Rationale |
| :--- | ---: | :--- |
| Thumb (Space — natural position) | 0.5 | Strong, high-endurance, natural rest |
| Index finger, home row | 1.0 | Baseline |
| Middle finger, home row | 1.1 | Slightly less independent than index |
| Ring finger | 1.5 | Weaker, lower independence |
| Pinky (non-stretch) | 1.8 | Weakest, least independent |
| Pinky (stretch — Escape, Arrow) | 2.5 | Weak + reach penalty |
| Right hand off home row (Numpad) | 1.4 | Hand displacement cost |

**Cognitive load weights:**

| Situation | Cost |
| :--- | ---: |
| Automatic key (well-practiced) | 0.0 |
| Known but not yet automatic (must recall) | 0.3 |
| Must look up (reference overlay) | 1.0 |
| Must count position (character tracking) | 0.5 per character |
| Mode switch (entering/exiting Character Mode) | 0.2 |

### 5.3 Model results — `sample_text_09.txt`

| Scheme | Phys score | Cog score | Total |
| :--- | ---: | ---: | ---: |
| Current | 2,637 | 604 | 3,241 |
| Single-key advance | 2,125 | 568 | 2,693 |
| Smart flow | 909 | 179 | 1,088 |

Physical discomfort is the dominant gap. The implication: the navigation fix
(single-key advance via Space) has a larger effect than key placement
improvements alone, even before smart flow is added.

---

## 6. Full Navigation Design — Locked

This section documents the complete, signed-off keyboard navigation scheme.
All existing keys remain fully functional. Every new key is an additive alias.
No existing user habit is broken.

### 6.1 Word Mode

The user is positioned on a word in the document. No panel is open.

| Key | Action |
| :--- | :--- |
| `←` Left Arrow | Move to next word in RTL reading direction |
| `→` Right Arrow | Move to previous word |
| `↓` Down Arrow | Same word position, next line |
| `↑` Up Arrow | Same word position, previous line |
| `Tab` | Jump forward to next undiacritized (amber) word; wraps at end of document |
| `Shift+Tab` | Jump backward to previous undiacritized word; wraps at start of document |
| `Space` *(new)* | Same as Tab — jump forward to next undiacritized word; thumb-operated alias |
| `Enter` | Enter Character Mode for the current word |
| `?` | Show / hide keyboard shortcuts overlay |

**On Space vs Tab:** both land on exactly the same target. Tab is the
practiced CAT-tool reflex; Space is the thumb-based ergonomic improvement.
Either works; neither disables the other. The user reaches for whichever
becomes automatic first.

**On Shift+Tab:** `Shift+` reversing a jump direction is universal across
CAT tools, IDEs, browsers, and word processors. Users will try it
instinctively. It requires no onboarding.

### 6.2 Character Mode

The user is inside a word, stepping through individual characters. The
character panel is open at the bottom of the screen.

| Key | Action |
| :--- | :--- |
| `←` Left Arrow | Advance one character in RTL reading direction; auto-exits to Word Mode and moves to next word if past the last character |
| `→` Right Arrow | Move back one character; auto-exits and moves to previous word if past the first character |
| `Escape` | Exit to Word Mode; stay on the same word |
| `Space` *(new)* | Exit Character Mode + jump to next undiacritized word in one keystroke; same destination as Tab from Word Mode |
| Diacritic key | Apply or replace diacritic on the current character |
| Same diacritic key again | Toggle off (remove) the diacritic |
| `Delete` / `Backspace` | Clear all diacritics from the current character |

**On Space in Character Mode:** the key is currently unhandled — it falls
through the entire keystroke pipeline with no effect. Adding Space here is
a clean, zero-conflict addition.

### 6.3 Backward correction workflow

When the user realizes they applied the wrong diacritic to a character they
have already passed:

- Within the same word: `→` Arrow steps back character by character.
- To a previous word: `Escape` (or let the auto-exit fire at the word
  boundary), then `→` Arrow in Word Mode, then `Enter` to re-enter
  Character Mode.

No new key is needed. The existing arrows cover this fully. The pattern is
documented here so it appears in the `?` overlay.

### 6.4 Character navigation — Arrow keys retained

Replacing Arrow-key character navigation with a Space-based scheme was
considered and rejected for this release. The risks — CTRL+Space conflicting
with Windows IME language-switch shortcuts, introducing a two-key cost at the
character level while we are removing it at the word level — outweigh the
benefit. Arrow keys for character stepping are a well-understood convention.
This decision is documented explicitly so it is not re-litigated without new
evidence. Revisit only if user testing identifies character-level navigation
as a sustained pain point.

---

## 7. Diacritic Key Layout — Locked

### 7.1 Design philosophy

The layout is organized by **phonological function**, not by physical key
position. Each column of the number row (and the matching numpad column) maps
to one vowel family. Each row maps to one phonological tier.

```
Row:    Key position    →    Tier
───────────────────────────────────────────────────
Top     7  8  9         →    Tanween (nunation)
Middle  4  5  6         →    Shadda + vowel (compound) — DEFERRED
Bottom  1  2  3         →    Plain short vowels
        0  Shift+0      →    Sukoon / Shadda alone
───────────────────────────────────────────────────
Column: 1/4/7  2/5/8  3/6/9
Family: Fatha  Kasra  Dhamma
```

The mnemonic: the user learns two rules — "column = vowel family, row = tier"
— and can reconstruct the full layout without a reference card.

### 7.2 Number-row layout (Phase 1 — active keys)

| Key | Diacritic | Arabic example |
| :--- | :--- | :--- |
| `1` | Fatha | فَ |
| `2` | Kasra | فِ |
| `3` | Dhamma | فُ |
| `7` | Tanween Fatha | فً |
| `8` | Tanween Kasra | فٍ |
| `9` | Tanween Dhamma | فٌ |
| `0` | Sukoon | فْ |
| `Shift+0` | Shadda (alone) | فّ |

Keys `4`, `5`, `6` (Shadda + Fatha/Kasra/Dhamma as a single keystroke) are
reserved positions. They are not active in Phase 1. See §7.4.

### 7.3 Numpad layout — mirrors number row exactly (Phase 1)

The numpad layout is replaced to be identical to the number-row layout above.
Users with a numpad and users on a laptop keyboard have the same layout, the
same mnemonic, and interchangeable muscle memory.

```
Numpad physical layout → new bindings:

  Tanween Fatha(7)   Tanween Kasra(8)   Tanween Dhamma(9)
  [deferred](4)      [deferred](5)      [deferred](6)
  Fatha(1)           Kasra(2)           Dhamma(3)
                     Sukoon(0)
```

Shadda alone on the numpad: `Shift+Numpad0`. Note: supporting
Shift+key combinations in the keymap handler requires a small code
change (current keymap.json maps `event.code` only, without modifier
awareness). This is a Phase 1 implementation task.

### 7.4 Compound keys — Deferred to Phase 2

Keys 4, 5, 6 (Shadda+Fatha, Shadda+Kasra, Shadda+Dhamma as single
keystrokes) are phonologically natural — shadda+vowel is one unit in Arabic
speech — but their implementation touches `character-mode.js`, a dangerous
zone under RULES.md §2.

Two questions must be answered before implementing them:

1. The edge case: what happens when the user presses a compound key on a
   character that already carries a plain vowel? (Replace with
   shadda+vowel? Block and flash? Clear first then apply?)
2. The keymap format: `keymap.json` currently maps one code → one code
   point. Compound keys need an array value. The format change must be
   backward-compatible.

These questions require a dedicated design decision before Phase 2 begins.
The key positions (4, 5, 6) are intentionally reserved so the layout is
complete from day one visually, even while the behavior ships in two stages.

### 7.5 Existing Arabic keyboard layout — unchanged

Pressing a physical Arabic diacritic key still enters the diacritic directly
via the raw Unicode range `U+064B–U+0655`. This is the MS Word muscle-memory
path. Nothing is removed. The new number-row and numpad bindings are additive
aliases alongside it.

### 7.6 Toggle and clear — unchanged

- Press the same diacritic key again on a character that already has it:
  removes it (toggle off).
- `Delete` / `Backspace`: clears all diacritics from the current character.

### 7.7 Customizable bindings — path forward

`keymap.json` is already the Phase 1 mechanism for customization. Any user
who finds the default layout uncomfortable can edit the file and restart the
Flask server. The format is intentionally simple and documented in the README.

Long-term: a UI where the user presses a key and the app records the binding
for them — analogous to VS Code's keyboard shortcut editor — is a Phase 3
item, gated on Phase 2 being stable and user demand confirmed. The JSON file
is the groundwork for that UI; no architectural rework is needed when the
time comes.

---

## 8. Keyboard Language Warning — Phase 1

### 8.1 The problem

When the OS keyboard is set to English (or any non-Arabic layout), pressing a
key in Character Mode produces a Latin character as `event.key`. The diacritic
handler finds no match, `diacriticCp` stays null, and the function returns
silently. The user sees nothing happen and has no indication why.

The typical failure sequence: the user presses the same key repeatedly,
growing increasingly confused, before realizing they need to switch OS input
language. This is a straightforward UX gap, not a complex feature.

### 8.2 The fix

Inside `handleCharacterMode` in `character-mode.js`, after the two diacritic
detection checks (raw Unicode and keymap lookup), add a third branch:

```
if diacriticCp is null
AND the key is a printable character (not Escape, not Arrow, not Delete)
AND the key is not already a mapped navigation key
→ trigger the language warning
```

The warning:
- A brief amber flash on the character panel (same visual language as the
  existing `flashBlockedTile` behavior — no new visual pattern introduced).
- A one-line non-blocking message: *"Switch keyboard to Arabic"*, displayed
  for approximately 2 seconds then dismissed automatically.
- No diacritic is written. No state changes.

### 8.3 Long-term path

Accept the Latin keystroke and map it to the corresponding Arabic diacritic
regardless of OS input language — so pressing `A` on an English keyboard in
Character Mode is treated as if the user had pressed the Arabic key in that
physical position. This removes the language-switching burden entirely. It is
medium complexity (requires a physical-key-to-diacritic position map,
independent of `event.key`) and is a Phase 3 candidate after user testing
confirms the warning alone is insufficient.

---

## 9. Single-Key Advance and Smart Flow

### 9.1 Single-key advance — Phase 1

Replacing the current two-key exit-and-advance sequence (Escape → Tab) with a
single thumb key (`Space`) that simultaneously exits Character Mode and jumps
to the next undiacritized word.

**Implementation:**

- `navigation.js`: add `'Space'` to `consumedKeys`; add a `Space` branch in
  `handleWordMode` that calls `_tabJumpToNextUndiac()`.
- `character-mode.js`: add a `Space` branch in `handleCharacterMode` that
  calls `exitCharacterMode()` then `_tabJumpToNextUndiac()`.

All existing keys (Escape, Arrow, Tab) remain fully functional. Space is an
alias, not a replacement. A user who ignores it is not broken.

### 9.2 Smart flow — Phase 2

Smart flow extends single-key advance with automatic cursor progression inside
a word: after each diacritic is applied, the cursor checks whether the current
grapheme cluster is phonologically complete and, if so, advances to the next
character without any keypress.

The phonological completeness rule:

| Cluster state | Complete? |
| :--- | :--- |
| Has a short vowel (no shadda) | ✅ |
| Has tanween (no shadda) | ✅ |
| Has sukun | ✅ |
| Has shadda only | ❌ — awaits vowel |
| Has shadda + any vowel or tanween | ✅ |
| No diacritic at all | ❌ |

A character carrying only shadda does not auto-advance — it waits for the
following vowel. This resolves the double-diacritic edge case (e.g. مَّ in
مُحمَّد) without any special-case logic.

Smart flow changes `character-mode.js` (dangerous zone under RULES.md §2) and
alters the fundamental interaction contract: users currently have explicit
control over when the cursor moves inside a word. Auto-advance is a new
contract that must be validated in user testing. Ship Phase 1 first.

---

## 10. Phased Implementation Plan

### Phase 1 — Low risk, high payoff (Session 13)

Each change is made and verified separately before the next.

| Change | Files touched | Risk |
| :--- | :--- | :--- |
| Rearrange numpad bindings to match new layout | `keymap.json` only | None |
| Add number-row aliases (Digit1–Digit3, Digit7–Digit9, Digit0) | `keymap.json` only | None |
| Add Shift+modifier support to keymap handler (for Shift+0 = Shadda) | `diacritic-engine.js` or `character-mode.js` | Low |
| Implement Space as single-key advance | `navigation.js`, `character-mode.js` | Low |
| Implement Shift+Tab as backward jump | `navigation.js` | Low |
| Keyboard language warning | `character-mode.js` | Low |
| Update `?` overlay to reflect all new keys | `completion.js` or `index.html` | Low |
| Add `config.json` to `.gitignore` | `.gitignore` | None |

### Phase 2 — After Phase 1 is stable and validated

| Change | Files touched | Risk |
| :--- | :--- | :--- |
| Define compound key edge-case behavior | Design only | — |
| Extend `keymap.json` format to support array values | `keymap.json`, handler | Low |
| Implement compound keys (Digit4/5/6 = Shadda+Vowel) | `character-mode.js` | Medium |
| Implement `isClusterComplete()` | `diacritic-engine.js` | Medium |
| Implement smart flow auto-advance | `character-mode.js` | Medium |
| Validate against 2–3 additional sample documents | — | — |

### Phase 3 — Requires user testing data first

| Change | Condition to unlock |
| :--- | :--- |
| Customizable key bindings UI (VS Code-style) | Phase 2 stable + user demand confirmed |
| Home-row layout (J K L) as opt-in preset | Customizable UI exists |
| Accept Latin keystrokes regardless of OS language | Warning (Phase 1) confirmed insufficient |
| Double-tap tanween | User testing confirms tanween frequency is a pain point |
| GUI launcher | Separate project scope decision |

---

## 11. Open Decisions Before Phase 1 Code Begins

| # | Question |
| :--- | :--- |
| 1 | Run `ergonomic_model.py` on 2–3 additional sample documents before coding, or proceed on current data? |
| 2 | Compound key edge-case behavior (Phase 2 design): replace, block, or clear-then-apply when pressing Shadda+Vowel on a character that already has a plain vowel? |

All other decisions from previous sessions are now locked.

---

## 12. Known Issues — Carry Forward

| Item | Status |
| :--- | :--- |
| `.gitignore` — `config.json` still not added | ⚠ Addressed in Phase 1 |
| `?` key behaviour on Arabic keyboard layouts | ⚠ Open |
| `classifyAllWords()` performance on large files | ⚠ Open |
| Completion banner z-index | ⚠ Open |
| Plan/spec files deleted from working tree | ⚠ Open |
