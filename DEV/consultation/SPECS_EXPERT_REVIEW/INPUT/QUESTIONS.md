This spec assumes familiarity with the following fields:

════════════════════════════════════════
Field A: Arabic Script Linguistics & Classical Orthography
════════════════════════════════════════

Documents provided:
— arabic-diacritics-editor-spec.md (full)
— mockup-1-word-mode.html (amber highlight rendering in context)
— mockup-2-char-mode.html (character card display in context)

Skills required:

1. Working knowledge of harakat function in classical Arabic (tashkeel
   as grammatical signal vs. pronunciation guide), sufficient to evaluate
   whether the validation rules in §8 reflect actual diacritization practice
   rather than simplified textbook rules.
2. Familiarity with the special orthographic status of hamza in its various
   carriers (أ إ ؤ ئ ء) and how hamzat al-wasl (as in ال) differs from
   hamzat al-qat' — particularly which receives diacritics and when.
3. Knowledge of tanwin behavior in classical prose versus Quranic text,
   where conventions differ enough to break a single soft-rule set.

Questions a domain expert must answer:

1. §8.3 soft rule: "Alef (ا) as long vowel — warn when any diacritic is
   applied." The spec says this applies in "mid/end of word." But bare alef
   mid-word can also be hamzat al-wasl in some orthographies with no
   hamza glyph attached. Would the warning fire correctly, incorrectly, or
   silently miss these cases — and does the amber highlight suppress on ا
   even when a diacritic is grammatically valid (e.g., a maddah)?
2. §8.3 soft rule: "Alef maqsura (ى) at word end — Can take Fathatan
   only." Is this accurate for classical texts, or can alef maqsura
   legitimately appear bare (no diacritic at all) in standard fully-
   diacritized classical prose — making Fathatan not a rule but a common
   default?
3. §8.4 canonical-diacritic-free list: Waw (و) is excluded from amber
   highlighting "following a damma." Does "following" mean the preceding
   letter carries a damma, or that the waw itself carries one? The
   asymmetry between how ya and waw are described in §8.4 vs. the
   "unambiguous positional" note is underspecified — an expert should
   determine whether a position-only rule is reliable enough without
   morphological context.
4. The spec covers eight harakat (Group A + Shadda) but makes no mention
   of maddah (آ, U+0622 / U+0653) or hamza variants. Are these out of
   scope by omission or by deliberate decision? If a source file contains
   maddah on an alef, does the app render it, block it, or silently corrupt
   it on write?

────────────────────────────────────────
Field B: Unicode Arabic Text Encoding & Combining Character Semantics
────────────────────────────────────────

Documents provided:
— arabic-diacritics-editor-spec.md (full)

Skills required:

1. Precise understanding of the distinction between Unicode code points,
   Unicode scalar values, and grapheme clusters — specifically how a base
   Arabic letter + one or two combining diacritics form a single grapheme
   cluster across multiple code points.
2. Knowledge of Unicode normalization forms (NFC, NFD, NFKC) and their
   effect on precomposed Arabic characters — particularly whether common
   Arabic text files arrive in a consistent normalization form and what
   happens when the app writes back in a different one.
3. Familiarity with Unicode canonical combining class ordering: when
   multiple combining marks are on the same base character, their canonical
   order in the byte stream affects equality comparisons, search, and diff
   tools — even if they render identically.

Questions a domain expert must answer:

1. §5.2: Character Mode navigates to "first character (rightmost), since
   Arabic is RTL." Does "character" in the implementation mean grapheme
   cluster (base letter + all its diacritics as one unit) or Unicode code
   point? If it means code point, the cursor can land on a bare combining
   mark with no base letter beneath it — making the card display in the
   mockup (which shows base letter + diacritic as a unit) impossible to
   implement correctly without grapheme-cluster-aware string iteration.
2. §8.2 hard rule: "Max two combining characters per letter." Is this
   enforced by inspecting the code point sequence in the file, or does the
   app maintain a structured data model per letter? If file-based, what
   happens when a source file already contains three combining marks on a
   letter (e.g., maddah + shadda + fatha from an external source)? Is it
   rendered as-is, silently truncated, or a hard error?
3. §10 persistence: diacritics are written immediately to the working copy.
   What normalization form is written? If the original file is NFD (base
   letter + separate combining diacritic) but the app writes NFC (precomposed
   where available), the working copy diverges byte-for-byte from the
   original even for characters the user never touched — breaking any
   external diff of original vs. working copy.
4. §9 toggle-off: "pressing the same diacritic key when that diacritic is
   already on the character removes it." What constitutes "same" — code
   point identity, or normalized equivalence? For tanwin characters
   (fathatan U+064B, etc.) which have both spacing and non-spacing
   representations in different encodings, a naïve === comparison may
   produce a false "not the same" and add a duplicate rather than toggle off.

────────────────────────────────────────
Field C: Browser Keyboard Event Handling Under Non-Latin Input
────────────────────────────────────────

Documents provided:
— arabic-diacritics-editor-spec.md (§5, §7, §14 are the critical sections)
— mockup-1-word-mode.html (UI context for where key events are captured)
— mockup-2-char-mode.html (UI context for Character Mode key capture)

Skills required:

1. The distinction between event.code (physical key position, layout-
   independent) and event.key (character produced, layout-dependent) in
   browser keydown events — and which one the keymap must intercept to
   behave correctly across Windows/macOS Arabic keyboard layouts.
2. How OS-level input methods (IMEs) interact with browser key events:
   specifically, whether keydown fires before or after the IME processes
   the keystroke, and whether compositionstart / compositionend events
   interfere with the diacritic shortcut capture.
3. Browser default key behavior suppression: which keys require explicit
   event.preventDefault() in a non-input-field context (notably:
   Backspace triggers browser back-navigation; arrow keys scroll the page;
   Escape may dismiss browser UI).

Questions a domain expert must answer:

1. §7.1 keymap uses "ShiftQ", "ShiftA" etc. as identifiers. On a system
   set to the Arabic keyboard layout, pressing Shift+Q delivers a keydown
   event where event.key === "ّ" (the Shadda character) and event.code
   === "KeyQ". The two interception strategies — match on event.code +
   shiftKey vs. match on event.key value — produce different behavior:
   the former requires the user to switch keyboard layouts to use the app;
   the latter captures the diacritic character directly. Which strategy
   does the spec intend, and is the keymap format ("ShiftQ") actually
   the right abstraction for either?
2. §5.2: In Character Mode, the document pane must capture arrow keys,
   Escape, Delete, Backspace, and diacritic keystrokes. If the pane is not
   a focusable element (e.g., a plain <div>), the keydown listener must
   be attached at the document level. Does a document-level listener
   correctly intercept all these keys without conflicting with the browser's
   own Backspace (back), arrow keys (scroll), or Escape (fullscreen exit)
   default behaviors — and has the spec specified preventDefault() calls
   for each?
3. §7.2 keymap.json is read at startup. If the user's OS keyboard layout
   changes mid-session (or if the user has multiple layouts active), does
   the keymap remain valid? The spec does not address runtime layout
   detection — is this a known non-issue or an unexamined assumption?
