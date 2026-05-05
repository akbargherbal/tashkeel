# Session 11 Handover

## 1. What We Did

- Pure discussion session. Zero code changes. Zero files modified.
- Identified two distinct ergonomic failure axes in the current diacritization
  workflow: **physical** (right-pinky overload) and **cognitive** (context
  switching / key-lookup interrupting phonological flow state).
- Quantified the physical problem against `sample_text_09.txt` using a keypress
  economy model (see §3).
- Mapped the cognitive problem to the diacritic vocabulary itself and proposed a
  double-tap tanween model as a candidate solution.
- No route has been committed to. The session closes as a discovery/framing
  session only.

---

## 2. Artefacts Produced

| File | Change |
| :--- | :--- |
| `Session_11_Handover.md` | This file |

No source files were touched.

---

## 3. Key Findings (Locked for Next Session)

### 3.1 Physical ergonomics — keypress economy model

Three schemes were modelled. Per undiacritised word with **k** characters
needing diacritics:

| Scheme | Keypresses | Pinky overhead | Efficiency |
| :--- | :--- | :--- | :--- |
| Current (Tab · Enter · Arrow · Esc) | 2k + 2 | k + 2 (pinky) | k / (2k+2) ≈ 38% |
| Space navigation (Space replaces all overhead) | 2k + 1 | 0 | k / (2k+1) ≈ 43% |
| Smart flow (Space + auto-advance after diacritic) | k + 1 | 0 | k / (k+1) ≈ 75% |

Key observation: the current scheme spends ~62% of all keypresses on overhead,
and almost all of that overhead lands on the right pinky. Space navigation is a
low-risk, high-value first step — same keypress count, pinky load drops to zero.
Smart flow is the bigger win but has one open design question (see §6).

### 3.2 Cognitive ergonomics — diacritic vocabulary

The user's actual working vocabulary is **8 symbols**, but the mental model of a
professional proofreader collapses it to **5 concepts**:

- Three short vowels: fatha, kasra, damma
- Doubling: shadda
- No vowel: sukun
- Tanween is not a separate concept — it is the same three vowels nunated

**Double-tap candidate:** tap once = short vowel; tap twice = tanween of that
vowel. This reduces the learnable key set from 8 independent bindings to 5 keys
+ one rule. The rule is mnemonic because it mirrors how Arabic speakers already
think.

Current `keymap.json` assigns each diacritic to an independent key with no
mnemonic structure — a non-tech-savvy proofreader faces 8 arbitrary bindings,
which is the primary cause of early abandonment.

### 3.3 The convergence point

Physical and cognitive ergonomics converge on the same design goal: the user
should be able to diacritise an entire document using **5 home-row-adjacent
keys + the spacebar**, with no keyboard reference overlay needed after the first
10 minutes of use.

---

## 4. Current Project State

| Item | State |
| :--- | :--- |
| All Phases (1–5) | ✅ Complete and verified (unchanged) |
| v1.0.0 tag | ✅ Safe checkpoint (unchanged) |
| Runtime Folder Selector | ✅ Implemented (Session 10, unchanged) |
| Ergonomics redesign | 🔲 Not started — discovery phase only |
| `.gitignore` | ⚠ `config.json` entry still must be added manually (open since Session 10) |

---

## 5. Next Session Work Items

The goal of Session 12 is **not to code** — it is to produce a written design
report that answers these questions before a single line changes:

1. **Waste audit:** What overhead keypresses exist today, quantified per
   document type? (Build on the §3.1 model with real sample files.)
2. **Current state map:** Where does friction live across the full
   workflow — from `python app.py` to saving a completed file?
3. **Target state:** What does a 90%+ ergonomic session look like for a
   professional proofreader who has never seen a terminal? Define it concretely:
   keypress sequence, finger assignments, cognitive load per word.
4. **Physical key placement decision:** Where do the 5 diacritic keys live on
   the keyboard? Home row? Numpad? Around Space? This decision gates everything
   else.
5. **Double-tap tanween decision:** Confirm or reject. If rejected, propose an
   alternative that is equally mnemonic.
6. **Smart flow edge case resolution:** What happens when a character needs
   shadda *and* a vowel (two diacritics on the same character)? Auto-advance
   cannot fire after the first diacritic or the second is unreachable.

Produce the report as `Ergonomics_Design_Report.md` before any implementation
begins.

---

## 6. Known Issues / Watch Points

- **Smart flow — double-diacritic edge case:** shadda + vowel on the same
  character is common (e.g. مُحمَّد). Auto-advance after the first diacritic
  would strand the second. The scheme needs a rule: advance only when the
  character is "complete" — but "complete" is phonologically defined, not
  mechanically. This needs a design decision before smart flow can be
  implemented.
- **Key placement is undecided.** Until it is decided, neither the double-tap
  model nor Space navigation can be fully specified.
- **`.gitignore`** must still be updated manually — `config.json` may be
  committed accidentally until then.
- **All Session 10 watch points remain open** (`?` key on Arabic keyboard
  layouts; `classifyAllWords()` performance on large files; completion banner
  z-index; plan/spec files deleted from working tree).

---

## Session Handover Protocol

This section is the standing protocol for all future sessions. Do not remove it
from any handover document — always include it in full.

At the end of every session, produce a Session_N_Handover.md file before
closing. The file must fit on one page and cover: (1) What we did, (2) Artefacts
produced, (3) Key decisions locked, (4) Current project state, (5) Next session
work items, (6) Known issues / watch points.

Rules: One page. Cut prose, not coverage. Do not count this protocol block
toward the page limit — always include it in full. Produce the handover even if
the session ended early or a phase was abandoned mid-way. The handover replaces
memory — write it as if handing off to someone who has the plan and spec but has
never seen the session conversation. File naming: Session_N_Handover.md where N
increments per session. The incoming session must read the latest handover plus
RULES.md before doing anything else. If none are attached, ask for them
explicitly before proceeding. Keep all handover files alongside the project
source files.
