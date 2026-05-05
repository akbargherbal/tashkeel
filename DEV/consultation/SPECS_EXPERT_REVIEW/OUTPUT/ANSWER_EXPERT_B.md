Here is an expert analysis of the four domain questions raised regarding the Arabic Diacritics Editor specification.

Since the specification explicitly states the stack is **Vanilla JavaScript (ES6+)** on the frontend and **Python 3** on the backend, my answers are tailored to the specific string-handling behaviors of those two environments.

---

### 1. The Definition of "Character" in §5.2 (Character Mode Navigation)

**The issue:** The specification uses the word "character" colloquially. If implemented naively using JavaScript’s `String.prototype.length` (which counts UTF-16 code units) or Python’s `len()` (which counts Unicode code points), the cursor will step _into_ the diacritics, landing on bare combining marks.

**The solution:** "Character" in this context **must** be strictly defined and implemented as a **grapheme cluster** as defined by Unicode Standard Annex #29 (UAX #29).

- A grapheme cluster represents the user-perceived character: a base letter (e.g., `U+0628 ARABIC LETTER BA`) plus all of its applied combining marks (e.g., `U+0651 ARABIC SHADDA` + `U+064E ARABIC FATHAH`).
- **Frontend Implementation:** Because the frontend is Vanilla JS, you cannot rely on string indexing (`str[i]`). You must use `Intl.Segmenter` with `granularity: 'grapheme'` to tokenize the word into an array of grapheme clusters. The cursor index must track the grapheme cluster array, not the string index.
- **Backend Implementation:** If the Python backend performs any validation or cursor tracking, it must use a library like `uniseg` or the `regex` module (using the `\X` pattern) to match UAX #29 grapheme clusters, as Python's native `len()` counts code points.

### 2. Enforcing the "Max Two Combining Characters" Rule (§8.2)

**The issue:** How is the rule enforced, and what happens when a source file already violates it?

**The solution:** This rule must be enforced via a **structured data model per grapheme cluster**, not by raw byte-stream inspection, and it must only apply to _new input_, not existing text.

- When parsing the file, the app must accept grapheme clusters of any length. Quranic texts or heavily annotated files frequently contain three or more combining marks (e.g., `U+0627 ARABIC LETTER ALEF` + `U+0653 ARABIC MADDAH ABOVE` + `U+0651 ARABIC SHADDA` + `U+064E ARABIC FATHAH`).
- Shaping engines (like HarfBuzz, which the browser uses to render the Amiri font) are designed to render these sequences, even if they stack awkwardly.
- The §8.2 rule should be implemented as an **input-time mutation guard**. When the user presses a diacritic key, the app inspects the current grapheme cluster's array of combining code points. If the array length is $\ge 2$, the input is rejected. If the app silently truncates existing marks upon loading the file, it violates the "Non-destructive" philosophy (§2).

### 3. Persistence and Normalization Forms (§10)

**The issue:** If the app reads text in one normalization form and writes it back in another, it will alter bytes the user never touched, breaking diffs.

**The solution:** The app must be highly intentional about Unicode Normalization Forms (UAX #15).

- While pure NFD (Canonical Decomposition) is rare in Arabic, it does exist. For example, `U+0625 ARABIC LETTER ALEF WITH HAMZA BELOW` can exist in a file as the precomposed NFC code point (`U+0625`), or as the NFD sequence `U+0627 ARABIC LETTER ALEF` + `U+0655 ARABIC HAMZA BELOW`.
- If the Python backend or JS frontend applies `.normalize('NFC')` globally, it will recompose those NFD sequences. The resulting `diac_` working copy will fail a byte-for-byte diff against the original file, even on lines the user never edited.
- **Recommendation:** Do not apply global normalization. The app should read the file as raw code points, segment into grapheme clusters, mutate only the grapheme clusters the user edits, and write the file back. For the specific grapheme clusters the user _does_ edit, the app should append the new combining marks in a deterministic order (see point 4 below).

### 4. Toggle-Off and the Shadda+Vowel Ordering Ambiguity (§9)

**The issue:** What constitutes the "same" diacritic when toggling? A naive `===` comparison will fail due to Canonical Combining Class (CCC) ordering rules.

**The solution:** "Same" must mean **code point presence within the grapheme cluster's combining marks**, regardless of byte order.

- This is the most common source of bugs in Arabic text processing. Most Arabic diacritics share the same Canonical Combining Class. Specifically, `U+0651 ARABIC SHADDA` and `U+064E ARABIC FATHAH` both have **CCC = 230**.
- Because they have the same CCC, Unicode normalization (NFC/NFD) **does not reorder them**.
- Therefore, the sequence `[Base, Shadda, Fatha]` and `[Base, Fatha, Shadda]` are canonically inequivalent at the byte level, yet they render identically in the browser.
- If a user navigates to a character encoded as `[Base, Fatha, Shadda]` and presses `Shift+A` (Fatha), a naive system checking the _last_ code point will see Shadda, assume Fatha is missing, and append a second Fatha.
- **Implementation:** To toggle, the app must extract all combining marks from the active grapheme cluster into a Set. If `U+064E` is in the Set, remove it. If not, add it.
- **Writing back:** When writing the modified grapheme cluster back to the string, the app should enforce a deterministic order (e.g., always sort Shadda `U+0651` before Group A vowels) to ensure the output is consistent, even if the input was messy.

_(Note regarding the domain expert's mention of spacing vs. non-spacing tanwin: Standard Arabic text uses the non-spacing combining marks `U+064B`–`U+064D`. The spacing variants are compatibility presentation forms in the `U+FE70`–`U+FEFF` block. Applying NFKC/NFKD would destructively collapse these presentation forms, which is another reason to avoid global normalization in this app)._
